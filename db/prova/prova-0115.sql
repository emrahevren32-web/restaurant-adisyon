\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0115 · NUMUNE METİNLERİ · BOŞLUK VE SAYMA SÖZLEŞMESİ
--              (MIYOP-105'in eksik kalan yarısı · Codex 4. tur)
--
-- Sorular (hepsi CANLI YAZIMLA, kısıt tanımını okumakla değil):
--   1 · Üç SEKMEDEN oluşan gerekçe ile açılış?              → HAYIR
--   2 · Üç SATIR SONUNDAN oluşan sonuç ile açılış?           → HAYIR
--   3 · Bölünemez boşluk (U+00A0) + tek harften oluşan kod?  → HAYIR
--   4 · İdeografik boşluk (U+3000) x3 gerekçe?               → HAYIR
--   5 · Sekmeyle SARILI ama içi dolu gerekçe?                → EVET
--   6 · İki emoji (iki kod noktası) gerekçe?                 → HAYIR
--   7 · Üç emoji (üç kod noktası) gerekçe?                   → EVET
--   8 · `ALINDI` hâlâ gerekçesiz, `IMHA` hâlâ sonuçsuz?      → EVET
--
-- ⚠️ 1 ve 2, Codex'in verdiği iki örneğin AYNISI. 0111 uygulanmışken ikisi
-- de GEÇİYORDU; ters prova (`prova-0115-ters.sql`) bunu gösteriyor.
--
-- ⚠️ 6-7 SAYMA sözleşmesi: veritabanı kod noktası sayar. Ekran da artık
-- öyle sayıyor (`anlamliUzunluk`); iki katmanın aynı cevabı verdiğini
-- `src/quality/numune-kapisi.arch.test.ts` ölçüyor. Bu dosya yalnız
-- veritabanı yarısını gösterir.
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
  insert into auth.users (id, email) values (v_auth, 'p115.kalite@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (gen_random_uuid(), v_t, v_f, v_auth, 'p115kal', 'p115kal',
          'Prova 115 Kalite', 'kalite_sorumlusu', true);
  perform set_config('prova.auth', v_auth::text, false);

  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition, opened_shelf_life_days)
  values (v_kalem, v_t, v_b, 'P115-URN', 'p115-urn', 'Prova 115 Urun', 'kg',
          true, true, true, '-18 °C', 5);

  -- ⚠️ Her başarılı numune KENDİ partisinde: "aynı partide ikinci açık
  -- numune olamaz" kuralı (0093) tek parti kullanılırsa reddi YANLIŞ
  -- sebebe bağlardı.
  for v_i in 1..6 loop
    v_lot := gen_random_uuid();
    insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                  lot_code_key, expires_on, origin_type)
    values (v_lot, v_t, v_b, v_kalem, 'P115-LOT'||v_i, 'p115-lot'||v_i,
            current_date + 60, 'PRODUCTION');
    perform set_config('prova.lot'||v_i, v_lot::text, false);
  end loop;
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid) to authenticated;
grant usage on schema public to authenticated;
set local role authenticated;

-- ── SAHNE · altı numune, her biri kendi partisinde ───────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_i int; v_n uuid;
begin
  perform prova_oturum(current_setting('prova.auth')::uuid, v_t);
  for v_i in 1..5 loop
    insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                       sample_code_key, taken_at)
    values (v_t, v_b, current_setting('prova.lot'||v_i)::uuid, 'P115-N'||v_i, 'x', now())
    returning id into v_n;
    perform set_config('prova.n'||v_i, v_n::text, false);
  end loop;
  perform prova_bak('sağlama: beş numune kuruldu (kısıt meşru kodu reddetmiyor)',
    current_setting('prova.n5') <> '');
end $$;

-- ── 1-2 · CODEX'İN İKİ ÖRNEĞİ ────────────────────────────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_n1 uuid := current_setting('prova.n1')::uuid;
  v_kod text;
begin
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
    values (v_t, v_n1, 'ACILDI', E'\t\t\t', 'Urun uygun');
    v_kod := '00000';
  exception when check_violation then v_kod := 'KISIT';
  end;
  perform prova_bak('⚠️ ÜÇ SEKMEDEN oluşan gerekçe REDDEDİLDİ ('||v_kod||')', v_kod = 'KISIT');

  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
    values (v_t, v_n1, 'ACILDI', 'Musteri itirazi', E'\n\n\n');
    v_kod := '00000';
  exception when check_violation then v_kod := 'KISIT';
  end;
  perform prova_bak('⚠️ ÜÇ SATIR SONUNDAN oluşan sonuç REDDEDİLDİ ('||v_kod||')', v_kod = 'KISIT');
end $$;

-- ── 3-4 · UNICODE BOŞLUKLARI ─────────────────────────────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_n1 uuid := current_setting('prova.n1')::uuid;
  v_kod text;
begin
  begin
    insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                       sample_code_key, taken_at)
    values (v_t, v_b, current_setting('prova.lot6')::uuid, U&'\00A0\00A0A\00A0', 'x', now());
    v_kod := '00000';
  exception when check_violation then v_kod := 'KISIT';
  end;
  perform prova_bak('⚠️ bölünemez boşluk + TEK harfli numune kodu REDDEDİLDİ ('||v_kod||')',
    v_kod = 'KISIT');

  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
    values (v_t, v_n1, 'ACILDI', U&'\3000\3000\3000', 'Urun uygun');
    v_kod := '00000';
  exception when check_violation then v_kod := 'KISIT';
  end;
  perform prova_bak('⚠️ üç İDEOGRAFİK BOŞLUK gerekçe REDDEDİLDİ ('||v_kod||')', v_kod = 'KISIT');
end $$;

-- ── 5 · MEŞRU METİN HÂLÂ GEÇİYOR ─────────────────────────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_n1 uuid := current_setting('prova.n1')::uuid;
  v_olay bigint;
begin
  -- ⚠️ Kapı gevşetilmedi ama SIKILAŞTIRILMADI da: kenarında boşluk olan
  -- gerçek bir gerekçe reddedilirse kullanıcı sebebini anlayamaz.
  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
  values (v_t, v_n1, 'ACILDI', E'\tMusteri itirazi\n', E'  Urun uygun\t')
  returning id into v_olay;
  perform prova_bak('sekmeyle SARILI ama içi dolu gerekçe + sonuç YAZILDI', v_olay is not null);
end $$;

-- ── 6-7 · SAYMA · KOD NOKTASI ────────────────────────────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_n2 uuid := current_setting('prova.n2')::uuid;
  v_kod text; v_olay bigint;
begin
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
    values (v_t, v_n2, 'ACILDI', U&'\+01F600\+01F600', 'Urun uygun');
    v_kod := '00000';
  exception when check_violation then v_kod := 'KISIT';
  end;
  perform prova_bak('İKİ emoji (iki kod noktası) gerekçe REDDEDİLDİ ('||v_kod||')', v_kod = 'KISIT');

  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
  values (v_t, v_n2, 'ACILDI', U&'\+01F600\+01F600\+01F600', 'Urun uygun')
  returning id into v_olay;
  perform prova_bak('ÜÇ emoji (üç kod noktası) gerekçe YAZILDI', v_olay is not null);
end $$;

-- ── 8 · MUAFİYETLER YERİNDE Mİ ───────────────────────────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_olay bigint;
begin
  insert into public.witness_sample_event (tenant_id, sample_id, event_type)
  values (v_t, current_setting('prova.n3')::uuid, 'ALINDI')
  returning id into v_olay;
  perform prova_bak('ALINDI hâlâ GEREKÇESİZ yazılabiliyor (muafiyet yerinde)', v_olay is not null);

  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
  values (v_t, current_setting('prova.n4')::uuid, 'IMHA', 'Saklama suresi doldu')
  returning id into v_olay;
  perform prova_bak('IMHA hâlâ SONUÇSUZ yazılabiliyor (muafiyet yerinde)', v_olay is not null);
end $$;

reset role;
do $$ begin raise notice '──── 0115 provası: TAMAM'; end $$;
rollback;
