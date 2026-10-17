\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid; v_kalem uuid := gen_random_uuid();
  v_kalite uuid := gen_random_uuid();
  v_satinalma uuid := gen_random_uuid();
  v_depocu uuid := gen_random_uuid();
  v_izleyici uuid := gen_random_uuid();
  v_uretim uuid := gen_random_uuid();
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;

  insert into auth.users (id, email) values
    (v_kalite,'p86.kalite@o.local'), (v_satinalma,'p86.sa@o.local'),
    (v_depocu,'p86.depo@o.local'),   (v_izleyici,'p86.izl@o.local'),
    (v_uretim,'p86.uretim@o.local');

  insert into public.app_user (tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_t,v_f,v_kalite,   'p86kal','p86kal','Kalite',     'kalite_sorumlusu',    true),
         (v_t,v_f,v_satinalma,'p86sa', 'p86sa', 'Satın Alma', 'satinalma_sorumlusu', true),
         (v_t,v_f,v_depocu,   'p86dp', 'p86dp', 'Depo',       'depo_sorumlusu',      true),
         (v_t,v_f,v_izleyici, 'p86iz', 'p86iz', 'İzleyici',   'izleyici',            true),
         (v_t,v_f,v_uretim,   'p86ur', 'p86ur', 'Üretim',     'uretim_sorumlusu',    true);

  insert into public.stock_item (id, tenant_id, branch_id, code, code_key,
                                 name, base_uom, tracks_lot)
  values (v_kalem, v_t, v_b, 'P86-URN', 'p86-urn', 'Hazır Köfte', 'kg', true);

  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);
  perform set_config('prova.kalem', v_kalem::text, false);
  perform set_config('prova.kalite', v_kalite::text, false);
  perform set_config('prova.satinalma', v_satinalma::text, false);
  perform set_config('prova.depocu', v_depocu::text, false);
  perform set_config('prova.izleyici', v_izleyici::text, false);
  perform set_config('prova.uretim', v_uretim::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

create or replace function prova_oturum(p_auth uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', current_setting('prova.t'))::text, false);
  perform set_config('app.tenant_id', current_setting('prova.t'), false);
end; $$;

create or replace function prova_lot(p_kod text) returns uuid
language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id,
                                lot_code, lot_code_key, origin_type)
  values (v_id, current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          current_setting('prova.kalem')::uuid, p_kod, lower(p_kod), 'RECEIPT');
  return v_id;
end; $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid), prova_lot(text)
  to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

-- ── 1 · MIYOP-031 · KALİTE BEYANI GERİ AÇILDI ─────────────────────────────
select prova_oturum(current_setting('prova.kalite')::uuid);

do $$
declare v_kod text;
begin
  raise notice '── 1 · KALİTE ROLÜ (quality.declaration, stock.write YOK)';

  -- Ambalaj beyanı: 0081'in kapısı bunu istiyordu, 0085 boğmuştu
  update public.stock_item
     set net_qty = 2.5, net_uom = 'kg', updated_at = now()
   where id = current_setting('prova.kalem')::uuid;
  perform prova_bak('kalite AMBALAJ beyanini yazabiliyor (MIYOP-031 kapandi)', true);

  -- ⚠️ Alerjen damgası ELLE atılamıyor — bu 0072/0073'ün ayrı kapısı ve
  -- DOĞRU davranıyor: damga, beyan RPC'sinin parçası olarak atanır.
  -- 0086 o kapıyı gevşetmiyor; yalnız `stock.write` zorunluluğunu kaldırıyor.
  -- MIYOP-037: `when others` iddianin KENDI hatasini da yutuyordu; artik
  -- yalnizca SQLSTATE toplaniyor, iddia blogun DISINDA kuruluyor.
  begin
    update public.stock_item
       set allergen_reviewed_at = now(), updated_at = now()
     where id = current_setting('prova.kalem')::uuid;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('alerjen damgasi ELLE atilamiyor (0072/0073 kapisi duruyor; gelen: '
    || v_kod || ')', v_kod <> '00000');

  -- ⚠️ AMA depo işine karışamamalı: kartın ADINI değiştiremez
  begin
    update public.stock_item set name = 'Kalite Degistirdi'
     where id = current_setting('prova.kalem')::uuid;
    perform prova_bak('kalite kart adini degistiremez', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('kalite kart ADINI degistiremiyor', true);
  end;

  -- Yeni kart da açamaz
  begin
    insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
            'P86-KAL', 'p86-kal', 'Kalite Karti', 'kg');
    perform prova_bak('kalite yeni kart acamaz', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('kalite yeni kart ACAMIYOR (kart acmak depo isi)', true);
  end;

  -- ⚠️ EN ÖNEMLİSİ: beyanla BİRLİKTE başka kolon değiştirilemez
  begin
    update public.stock_item
       set net_qty = 9.9, min_qty = 999, updated_at = now()
     where id = current_setting('prova.kalem')::uuid;
    perform prova_bak('beyanla birlikte min_qty gecirilemez', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('beyanin yaninda KACAK kolon geciremiyor', true);
  end;
end $$;

-- ── 2 · MIYOP-032 · LOTLU MAL KABULÜ GERİ AÇILDI ──────────────────────────
select prova_oturum(current_setting('prova.satinalma')::uuid);

do $$
declare v_lot uuid;
begin
  raise notice '── 2 · SATIN ALMA SORUMLUSU (purchase.write, stock.write YOK)';

  v_lot := prova_lot('P86-LOT-SA');
  perform prova_bak('satinalmaci LOT acabiliyor (MIYOP-032 kapandi)', v_lot is not null);

  insert into public.stock_movement
    (tenant_id, branch_id, stock_item_id, lot_id, quantity_base, quantity_entered,
     uom_entered, reason, source_type, idempotency_key, occurred_at)
  values (current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          current_setting('prova.kalem')::uuid, v_lot, 50, 50, 'kg',
          'PURCHASE_RECEIPT', 'PROVA', 'p86:sa:' || gen_random_uuid()::text, now());
  perform prova_bak('satinalmaci LOTLU mal kabulunu TAMAMLAYABILIYOR', true);

  -- Ama hâlâ sayım yazamamalı
  begin
    insert into public.stock_movement
      (tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
       uom_entered, reason, source_type, idempotency_key, occurred_at)
    values (current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
            current_setting('prova.kalem')::uuid, 5, 5, 'kg',
            'COUNT_SURPLUS', 'PROVA', 'p86:sa2:' || gen_random_uuid()::text, now());
    perform prova_bak('satinalmaci sayim yazamamali', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('satinalmaci hala SAYIM yazamiyor', true);
  end;
end $$;

-- ── 3 · ÜRETİM VE DEPO AKIŞLARI ───────────────────────────────────────────
select prova_oturum(current_setting('prova.uretim')::uuid);
do $$
declare v_lot uuid;
begin
  raise notice '── 3 · ÜRETİM VE DEPO';
  v_lot := prova_lot('P86-LOT-UR');
  perform prova_bak('uretimci lot acabiliyor', v_lot is not null);
end $$;

select prova_oturum(current_setting('prova.depocu')::uuid);
do $$
declare v_lot uuid;
begin
  v_lot := prova_lot('P86-LOT-DP');
  perform prova_bak('depocu lot acabiliyor', v_lot is not null);
  update public.stock_item set name = 'Depo Degistirdi', updated_at = now()
   where id = current_setting('prova.kalem')::uuid;
  perform prova_bak('depocu kart adini degistirebiliyor', true);
end $$;

-- ── 4 · İZLEYİCİ HER YERDE KAPALI ─────────────────────────────────────────
select prova_oturum(current_setting('prova.izleyici')::uuid);
do $$
begin
  raise notice '── 4 · İZLEYİCİ (hicbir yazma izni yok)';
  begin
    perform prova_lot('P86-LOT-IZ');
    perform prova_bak('izleyici lot acamamali', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('izleyici lot acamiyor', true);
  end;

  begin
    update public.stock_item set net_qty = 1, updated_at = now()
     where id = current_setting('prova.kalem')::uuid;
    perform prova_bak('izleyici beyan yazamamali', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('izleyici BEYAN da yazamiyor (quality.declaration yok)', true);
  end;

  begin
    update public.stock_item set name = 'Izleyici', updated_at = now()
     where id = current_setting('prova.kalem')::uuid;
    perform prova_bak('izleyici kart adini degistiremez', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('izleyici kart adini degistiremiyor', true);
  end;
end $$;

reset role;

-- ── 5 · ENVANTER ──────────────────────────────────────────────────────────
do $$
declare v_t text;
begin
  raise notice '── 5 · KAPI ENVANTERI';
  perform set_config('request.jwt.claims', '{}', false);
  perform set_config('request.jwt.claim.sub', '', false);

  foreach v_t in array array[
    'izin_stock_item','izin_stock_item_ambalaj','izin_stock_lot',
    'izin_lot_genealogy','izin_stock_movement','izin_app_user',
    'izin_company','izin_branch','izin_user_branch_access','izin_tenant',
    'izin_recipe','izin_recipe_line','izin_shipment','izin_shipment_line',
    'izin_haccp_measurement','izin_haccp_corrective_action'
  ] loop
    perform prova_bak(v_t || ' yerinde',
      exists (select 1 from pg_trigger t where t.tgname = v_t and not t.tgisinternal));
  end loop;

  perform prova_bak('kalite rollerinde stock.write YOK (kapinin anlami buna bagli)',
    not exists (select 1 from public.role_permission
                 where role_code in ('kalite_sorumlusu','gida_muhendisi')
                   and permission_code = 'stock.write'));
end $$;

rollback;
