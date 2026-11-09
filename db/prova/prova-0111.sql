\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0111 · NUMUNE METİN EŞİKLERİ EKRANLA AYNI (MIYOP-105)
--
-- Sorular (hepsi CANLI YAZIMLA, kısıt tanımını okumakla değil):
--   1 · Tek karakterlik numune kodu yazılabiliyor mu?  → HAYIR
--   2 · İki karakterlik kod yazılabiliyor mu?          → EVET
--   3 · İki karakterlik gerekçe ile açılış?            → HAYIR
--   4 · Gerekçe uzun ama sonuç iki karakter?           → HAYIR
--   5 · Gerekçe ve sonuç yeterliyken açılış?           → EVET
--   6 · `ALINDI` hâlâ gerekçesiz yazılabiliyor mu?     → EVET (muafiyet)
--   7 · `IMHA` hâlâ sonuçsuz yazılabiliyor mu?         → EVET (muafiyet)
--
-- ⚠️ `set local role authenticated` TAKILIYOR (MIYOP-042).
--
-- ⚠️ EŞİKLERİN EKRANLA AYNI OLDUĞU BURADA ÖLÇÜLEMEZ: prova SQL, eşiğin
-- diğer yarısı TypeScript'te. Onu `src/quality/numune-kapisi.arch.test.ts`
-- ölçüyor. Bu dosya yalnız veritabanı tarafının eşiği uyguladığını
-- gösteriyor.
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

-- ── SAHNE ─────────────────────────────────────────────────────────────────
do $$
declare v_t uuid; v_f uuid; v_b uuid; v_auth uuid; v_kalem uuid; v_lot uuid; v_i int;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);

  v_auth := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p111.kalite@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (gen_random_uuid(), v_t, v_f, v_auth, 'p111kal', 'p111kal',
          'Prova 111 Kalite', 'kalite_sorumlusu', true);
  perform set_config('prova.auth', v_auth::text, false);

  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition, opened_shelf_life_days)
  values (v_kalem, v_t, v_b, 'P111-URN', 'p111-urn', 'Prova 111 Urun', 'kg',
          true, true, true, '-18 °C', 5);

  -- ⚠️ Her başarılı numune KENDİ partisinde: "aynı partide ikinci açık
  -- numune olamaz" kuralı (0093) tek parti kullanılırsa reddi YANLIŞ
  -- sebebe bağlardı.
  for v_i in 1..4 loop
    v_lot := gen_random_uuid();
    insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                  lot_code_key, expires_on, origin_type)
    values (v_lot, v_t, v_b, v_kalem, 'P111-LOT'||v_i, 'p111-lot'||v_i,
            current_date + 60, 'PRODUCTION');
    perform set_config('prova.lot'||v_i, v_lot::text, false);
  end loop;
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid) to authenticated;
grant usage on schema public to authenticated;
set local role authenticated;

-- ── 1-2 · NUMUNE KODU EŞİĞİ ──────────────────────────────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_kod text; v_n1 uuid; v_n2 uuid; v_n3 uuid;
begin
  perform prova_oturum(current_setting('prova.auth')::uuid, v_t);

  begin
    insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                       sample_code_key, taken_at)
    values (v_t, v_b, current_setting('prova.lot1')::uuid, 'A', 'x', now());
    v_kod := '00000';
  exception when check_violation then v_kod := 'KISIT';
  end;
  perform prova_bak('⚠️ TEK karakterlik numune kodu REDDEDILDI ('||v_kod||')',
    v_kod = 'KISIT');

  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, v_b, current_setting('prova.lot1')::uuid, 'A1', 'x', now())
  returning id into v_n1;
  perform prova_bak('IKI karakterlik kod yazilabildi', v_n1 is not null);
  perform set_config('prova.n1', v_n1::text, false);

  -- Olay provaları için iki numune daha
  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, v_b, current_setting('prova.lot2')::uuid, 'P111-N2', 'x', now())
  returning id into v_n2;
  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, v_b, current_setting('prova.lot3')::uuid, 'P111-N3', 'x', now())
  returning id into v_n3;
  perform set_config('prova.n2', v_n2::text, false);
  perform set_config('prova.n3', v_n3::text, false);
end $$;

-- ── 3-5 · GEREKÇE VE SONUÇ EŞİĞİ ─────────────────────────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_n2 uuid := current_setting('prova.n2')::uuid;
  v_kod text; v_olay bigint;
begin
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type,
                                             reason, result)
    values (v_t, v_n2, 'ACILDI', 'ok', 'Urun uygun');
    v_kod := '00000';
  exception when check_violation then v_kod := 'KISIT';
  end;
  perform prova_bak('⚠️ IKI karakterlik gerekce ile acilis REDDEDILDI ('||v_kod||')',
    v_kod = 'KISIT');

  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type,
                                             reason, result)
    values (v_t, v_n2, 'ACILDI', 'Musteri itirazi', 'ok');
    v_kod := '00000';
  exception when check_violation then v_kod := 'KISIT';
  end;
  perform prova_bak('⚠️ IKI karakterlik SONUC ile acilis REDDEDILDI ('||v_kod||')',
    v_kod = 'KISIT');

  insert into public.witness_sample_event (tenant_id, sample_id, event_type,
                                           reason, result)
  values (v_t, v_n2, 'ACILDI', 'Musteri itirazi', 'Urun uygun')
  returning id into v_olay;
  perform prova_bak('yeterli gerekce + sonuc ile acilis YAZILDI', v_olay is not null);
end $$;

-- ── 6-7 · MUAFİYETLER YERİNDE Mİ ─────────────────────────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_n1 uuid := current_setting('prova.n1')::uuid;
  v_n3 uuid := current_setting('prova.n3')::uuid;
  v_olay bigint;
begin
  -- ALINDI gerekçe istemiyor: numune almanın gerekçesi yok.
  insert into public.witness_sample_event (tenant_id, sample_id, event_type)
  values (v_t, v_n1, 'ALINDI')
  returning id into v_olay;
  perform prova_bak('ALINDI hala GEREKCESIZ yazilabiliyor (muafiyet yerinde)',
    v_olay is not null);

  -- IMHA sonuç istemiyor: sonucu gerekçesinin içinde (imha tutanağı).
  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
  values (v_t, v_n3, 'IMHA', 'Saklama suresi doldu')
  returning id into v_olay;
  perform prova_bak('IMHA hala SONUCSUZ yazilabiliyor (muafiyet yerinde)',
    v_olay is not null);
end $$;

reset role;
rollback;
