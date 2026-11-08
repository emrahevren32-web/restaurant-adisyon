\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0108 · NUMUNE YAZMA KAPISI DARALDI
--
-- Sorular:
--   1 · `personel` numune ALABILIYOR mu?              → ALAMAMALI (MI403)
--   2 · `personel` olay yazabiliyor mu?               → YAZAMAMALI
--   3 · `uretim_sorumlusu` hâlâ alabiliyor mu?        → ALABİLMELİ
--   4 · `kalite_sorumlusu` hâlâ alabiliyor mu?        → ALABİLMELİ
--   5 · `depo_sorumlusu` alabiliyor mu?               → ALAMAMALI (değişmedi)
--   6 · İmha hâlâ dar kapıda mı?                      → EVET
--   7 · Yazabilen her rol okuyabiliyor mu?            → EVET
--
-- ⚠️ `set local role authenticated` TAKILIYOR (MIYOP-042).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
declare v_ad text := coalesce(p_ad, '(iddia metni NULL uretti)');
begin
  if p_kosul then raise notice '  ✓ %', v_ad;
  else raise exception '  ✗ %', v_ad; end if;
end; $$;

create or replace function prova_oturum(p_auth uuid, p_tenant uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', p_tenant)::text, false);
  perform set_config('app.tenant_id', p_tenant::text, false);
end; $$;

do $$
declare
  v_t uuid; v_f uuid; v_b uuid; v_rol text; v_auth uuid;
  v_kalem uuid; v_lot uuid; v_i int := 0;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);

  foreach v_rol in array array['personel','uretim_sorumlusu','kalite_sorumlusu','depo_sorumlusu'] loop
    v_auth := gen_random_uuid();
    insert into auth.users (id, email) values (v_auth, 'p108.'||v_rol||'@o.local');
    insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                                 username_key, full_name, role_code, is_active)
    values (gen_random_uuid(), v_t, v_f, v_auth, 'p108'||left(md5(v_rol),6),
            'p108'||left(md5(v_rol),6), v_rol, v_rol, true);
    perform set_config('prova.auth.'||v_rol, v_auth::text, false);
  end loop;

  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition)
  values (v_kalem, v_t, v_b, 'P108-URN', 'p108-urn', 'Prova 108 Urun', 'kg',
          true, true, true, '-18 °C');

  -- ⚠️ Her rol KENDİ partisinden numune alacak: "aynı partide ikinci açık
  -- numune olamaz" kuralı (0093) yüzünden tek parti kullanmak, ikinci
  -- rolün reddini YANLIŞ sebebe bağlardı.
  foreach v_rol in array array['personel','uretim_sorumlusu','kalite_sorumlusu','depo_sorumlusu'] loop
    v_i := v_i + 1;
    v_lot := gen_random_uuid();
    insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                  lot_code_key, expires_on, origin_type)
    values (v_lot, v_t, v_b, v_kalem, 'P108-LOT'||v_i, 'p108-lot'||v_i,
            current_date + 90, 'PRODUCTION');
    perform set_config('prova.lot.'||v_rol, v_lot::text, false);
  end loop;

  -- Sağlama: rollerin izin durumu VARSAYILMIYOR
  if exists (select 1 from public.role_permission
              where role_code='personel'
                and permission_code in ('quality.record.manage','quality.write')) then
    raise exception 'PROVA GECERSIZ: personel hala numune izni tasiyor.';
  end if;
  if not exists (select 1 from public.role_permission
                  where role_code='uretim_sorumlusu' and permission_code='quality.write') then
    raise exception 'PROVA GECERSIZ: uretim_sorumlusu quality.write tasimiyor.';
  end if;
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid) to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

-- ── 1 · PERSONEL ARTIK YAZAMIYOR ──────────────────────────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid; v_kod text := '';
begin
  raise notice '── PERSONEL DISARIDA';
  perform prova_oturum(current_setting('prova.auth.personel')::uuid, v_t);
  begin
    insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                       sample_code_key, taken_at)
    values (v_t, current_setting('prova.b')::uuid,
            current_setting('prova.lot.personel')::uuid, 'P108-PER', 'p108-per', now());
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ personel numune ALAMIYOR (gelen: '
    ||coalesce(nullif(v_kod,''),'HATA YOK — KAPI ACIK')||')', v_kod = 'MI403');
end $$;

-- ── 2 · ÜRETİM VE KALİTE HÂLÂ YAZABİLİYOR ─────────────────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid; v_id uuid; v_rol text;
begin
  raise notice '── AKIS KIRILMADI';
  foreach v_rol in array array['uretim_sorumlusu','kalite_sorumlusu'] loop
    perform prova_oturum(current_setting('prova.auth.'||v_rol)::uuid, v_t);
    insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                       sample_code_key, taken_at)
    values (v_t, current_setting('prova.b')::uuid,
            current_setting('prova.lot.'||v_rol)::uuid,
            'P108-'||upper(left(v_rol,3)), 'p108-'||left(v_rol,3), now())
    returning id into v_id;
    perform prova_bak(v_rol||' numune ALABILIYOR', v_id is not null);
    perform set_config('prova.numune.'||v_rol, v_id::text, false);
  end loop;
end $$;

-- ── 3 · DEPO SORUMLUSU HÂLÂ YAZAMIYOR (karar değişmedi) ──────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid; v_kod text := '';
begin
  perform prova_oturum(current_setting('prova.auth.depo_sorumlusu')::uuid, v_t);
  begin
    insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                       sample_code_key, taken_at)
    values (v_t, current_setting('prova.b')::uuid,
            current_setting('prova.lot.depo_sorumlusu')::uuid,
            'P108-DEP', 'p108-dep', now());
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('depo sorumlusu yazamiyor (gelen: '
    ||coalesce(nullif(v_kod,''),'HATA YOK')||')', v_kod = 'MI403');
end $$;

-- ── 4 · OLAY DEFTERİ · personel açamıyor, üretim açabiliyor ──────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid; v_kod text := ''; v_n int;
begin
  raise notice '── OLAY DEFTERI';
  perform prova_oturum(current_setting('prova.auth.personel')::uuid, v_t);
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
    values (v_t, current_setting('prova.numune.uretim_sorumlusu')::uuid,
            'ACILDI', 'Personel denemesi');
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ personel ACILIS yazamiyor (gelen: '
    ||coalesce(nullif(v_kod,''),'HATA YOK — KAPI ACIK')||')', v_kod = 'MI403');

  perform prova_oturum(current_setting('prova.auth.uretim_sorumlusu')::uuid, v_t);
  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
  values (v_t, current_setting('prova.numune.uretim_sorumlusu')::uuid,
          'ACILDI', 'Musteri talebi', 'Urun uygun');
  select count(*) into v_n from public.witness_sample_event
   where sample_id = current_setting('prova.numune.uretim_sorumlusu')::uuid
     and event_type = 'ACILDI';
  perform prova_bak('uretim sorumlusu ACILIS yazabiliyor', v_n = 1);

  -- İmha HÂLÂ dar kapıda: üretim imha YAZAMAZ (0097 kararı)
  v_kod := '';
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
    values (v_t, current_setting('prova.numune.uretim_sorumlusu')::uuid,
            'IMHA', 'Uretim imha denemesi');
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ imha HALA dar kapida: uretim imha yazamiyor (gelen: '
    ||coalesce(nullif(v_kod,''),'HATA YOK')||')', v_kod = 'MI403');
end $$;

reset role;

-- ── 5 · ÜÇ KAPI EŞİT Mİ ───────────────────────────────────────────────────
do $$
declare v_n int; v_roller text;
begin
  raise notice '── UC KAPI';
  select count(*), coalesce(string_agg(y.role_code, ', '), '-') into v_n, v_roller
    from (select distinct role_code from public.role_permission
           where permission_code in ('quality.record.manage','quality.write')) y
   where not exists (select 1 from public.role_permission r
                      where r.role_code = y.role_code
                        and r.permission_code = 'quality.read');
  perform prova_bak('⚠️ YAZABILEN HER ROL OKUYABILIYOR (aykiri: '||v_roller||')', v_n = 0);

  perform prova_bak('tetik `quality.write` istiyor',
    pg_get_triggerdef((select t.oid from pg_trigger t
      where t.tgrelid='public.witness_sample'::regclass
        and t.tgname='izin_witness_sample' and not t.tgisinternal)) like '%quality.write%');
  perform prova_bak('tetikte `production.write` KALMADI',
    pg_get_triggerdef((select t.oid from pg_trigger t
      where t.tgrelid='public.witness_sample'::regclass
        and t.tgname='izin_witness_sample' and not t.tgisinternal)) not like '%production.write%');
end $$;

rollback;
