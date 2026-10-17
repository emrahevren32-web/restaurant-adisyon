\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

-- ── KURULUM (postgres olarak) ─────────────────────────────────────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid; v_kalem uuid := gen_random_uuid();
  v_izleyici uuid := gen_random_uuid();
  v_depocu   uuid := gen_random_uuid();
  v_satinalma uuid := gen_random_uuid();
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;

  insert into auth.users (id, email) values
    (v_izleyici, 'p85.izleyici@ornek.local'),
    (v_depocu,   'p85.depocu@ornek.local'),
    (v_satinalma,'p85.satinalma@ornek.local');

  insert into public.app_user (tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_t, v_f, v_izleyici,  'p85izleyici',  'p85izleyici',  'İzleyici Kişi',  'izleyici', true),
         (v_t, v_f, v_depocu,    'p85depocu',    'p85depocu',    'Depo Sorumlusu', 'depo_sorumlusu', true),
         (v_t, v_f, v_satinalma, 'p85satinalma', 'p85satinalma', 'Satın Almacı',   'satinalma_sorumlusu', true);

  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_kalem, v_t, v_b, 'P85-KLM', 'p85-klm', 'Prova Kalemi', 'kg');

  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);
  perform set_config('prova.f', v_f::text, false);
  perform set_config('prova.kalem', v_kalem::text, false);
  perform set_config('prova.izleyici', v_izleyici::text, false);
  perform set_config('prova.depocu', v_depocu::text, false);
  perform set_config('prova.satinalma', v_satinalma::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

-- Oturum kurucu: JWT claim + ROL. `bakim_baglami()` current_user'a bakıyor,
-- o yüzden GERÇEK rol değiştirmek şart — postgres olarak sınamak yalan olur.
create or replace function prova_oturum(p_auth uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth,
                      'tenant_id', current_setting('prova.t'))::text, false);
  perform set_config('app.tenant_id', current_setting('prova.t'), false);
end; $$;

create or replace function prova_hareket(p_sebep text, p_miktar numeric default 5)
returns void language plpgsql as $$
begin
  insert into public.stock_movement
    (tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
     uom_entered, reason, source_type, source_id, idempotency_key, note,
     occurred_at)
  values (current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          current_setting('prova.kalem')::uuid, p_miktar, p_miktar, 'kg',
          p_sebep, 'PROVA', gen_random_uuid(),
          'p85:' || p_sebep || ':' || gen_random_uuid()::text,
          'prova notu yeterince uzun', now());
end; $$;

grant execute on function prova_bak(text, boolean) to authenticated;
grant execute on function prova_oturum(uuid) to authenticated;
grant execute on function prova_hareket(text, numeric) to authenticated;
grant usage on schema public to authenticated;

-- ── 1 · İZLEYİCİ DEFTERE YAZAMAZ ──────────────────────────────────────────
do $$
begin
  raise notice '── 1 · İZLEYİCİ (salt okunur rol)';
end $$;

set local role authenticated;
select prova_oturum(current_setting('prova.izleyici')::uuid);

do $$
declare v_sebep text;
begin
  foreach v_sebep in array array[
    'PURCHASE_RECEIPT','PRODUCTION_OUTPUT','SHIPMENT_OUT',
    'COUNT_SURPLUS','WASTE','TRANSFER_IN','OPENING_BALANCE'
  ] loop
    begin
      perform prova_hareket(v_sebep);
      perform prova_bak('izleyici ' || v_sebep || ' yazamamali', false);
    exception when sqlstate 'MI403' then
      perform prova_bak('izleyici ' || v_sebep || ' reddedildi', true);
    end;
  end loop;

  -- Stok kartı, lot ve şube erişimi de kapalı olmalı
  begin
    insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
            'P85-YENI', 'p85-yeni', 'İzleyici Kalemi', 'kg');
    perform prova_bak('izleyici stok karti acamamali', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('izleyici stok karti acamiyor', true);
  end;

  begin
    insert into public.user_branch_access (tenant_id, user_id, branch_id)
    select current_setting('prova.t')::uuid, u.id, current_setting('prova.b')::uuid
      from public.app_user u where u.auth_user_id = current_setting('prova.izleyici')::uuid;
    perform prova_bak('izleyici KENDINE sube erisimi veremez', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('izleyici kendine sube erisimi veremiyor (MIYOP-007)', true);
  end;

  begin
    update public.company set company_name = 'Ele Gecirildi'
     where tenant_id = current_setting('prova.t')::uuid;
    perform prova_bak('izleyici firma adini degistiremez', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('izleyici firma adini degistiremiyor', true);
  end;

  begin
    update public.tenant set name = 'Ele Gecirildi'
     where id = current_setting('prova.t')::uuid;
    perform prova_bak('izleyici isletme adini degistiremez', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('izleyici isletme adini degistiremiyor', true);
  end;
end $$;

-- ── 2 · MEŞRU AKIŞLAR ÇALIŞMAYA DEVAM EDİYOR ──────────────────────────────
select prova_oturum(current_setting('prova.depocu')::uuid);

do $$
declare v_sebep text;
begin
  raise notice '── 2 · DEPO SORUMLUSU (stock.write)';
  foreach v_sebep in array array[
    'PURCHASE_RECEIPT','SHIPMENT_OUT','COUNT_SURPLUS','TRANSFER_IN'
  ] loop
    perform prova_hareket(v_sebep);
    perform prova_bak('depocu ' || v_sebep || ' yazabiliyor', true);
  end loop;

  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          'P85-DEPO', 'p85-depo', 'Depocu Kalemi', 'kg');
  perform prova_bak('depocu stok karti acabiliyor', true);
end $$;

select prova_oturum(current_setting('prova.satinalma')::uuid);

do $$
begin
  raise notice '── 3 · SATIN ALMA SORUMLUSU (purchase.write, stock.write YOK)';
  -- Mal kabul yazabilmeli: kapi `reason`a bakip purchase.write'i kabul ediyor.
  perform prova_hareket('PURCHASE_RECEIPT');
  perform prova_bak('satinalmaci mal kabulu yazabiliyor (purchase.write)', true);

  -- Ama uretim cikisi yazamamali.
  begin
    perform prova_hareket('PRODUCTION_OUTPUT');
    perform prova_bak('satinalmaci uretim cikisi yazamamali', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('satinalmaci uretim cikisi yazamiyor', true);
  end;

  -- Sayim da yazamamali (stock.write yok).
  begin
    perform prova_hareket('COUNT_SURPLUS');
    perform prova_bak('satinalmaci sayim yazamamali', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('satinalmaci sayim yazamiyor', true);
  end;
end $$;

-- ── 4 · KENDİ PROFİLİ AÇIK KALSIN ─────────────────────────────────────────
select prova_oturum(current_setting('prova.izleyici')::uuid);

do $$
begin
  raise notice '── 4 · KENDI PROFILI';
  update public.app_user set phone = '05550001122'
   where auth_user_id = current_setting('prova.izleyici')::uuid;
  perform prova_bak('izleyici KENDI telefonunu degistirebiliyor', true);

  begin
    update public.app_user set full_name = 'Degistirildi'
     where auth_user_id = current_setting('prova.depocu')::uuid;
    perform prova_bak('izleyici BASKASININ adini degistiremez', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('izleyici baskasinin adini degistiremiyor', true);
  end;
end $$;

reset role;

-- ── 5 · BAKIM BAĞLAMI VE 0081'İN KAPILARI ─────────────────────────────────
do $$
declare v_tetik text;
begin
  raise notice '── 5 · KAPI ENVANTERI';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{}', false);

  -- postgres olarak (oturumsuz, kullanici rolu degil) kapi acik olmali:
  -- goc ve yedek geri yukleme bu bagmda calisiyor.
  perform prova_bak('bakim baglami taniniyor', app.bakim_baglami());

  foreach v_tetik in array array[
    'izin_stock_movement','izin_stock_item','izin_stock_lot','izin_lot_genealogy',
    'izin_company','izin_branch','izin_user_branch_access','izin_tenant',
    'izin_app_user',
    'izin_recipe','izin_recipe_line','izin_shipment','izin_shipment_line',
    'izin_haccp_measurement','izin_haccp_corrective_action','izin_stock_item_ambalaj'
  ] loop
    perform prova_bak(v_tetik || ' yerinde',
      exists (select 1 from pg_trigger t
               where t.tgname = v_tetik and not t.tgisinternal));
  end loop;

  perform prova_bak('izleyici rolunun hicbir yazma izni yok',
    not exists (select 1 from public.role_permission
                 where role_code = 'izleyici'
                   and permission_code like '%.write'));
end $$;

rollback;
