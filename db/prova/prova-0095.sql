\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0095 · KULLANILABİLİR BAKİYE VE ANALİZ KRİTİK SAYISI
--
-- MIYOP-074'ün son ayağı. Göç 0092'den beri "depodaki mal" ile
-- "kullanılabilir mal" ayrı iki şey; Analiz ekranı bunu bilmiyordu ve
-- Depo ekranından BAŞKA bir cevap veriyordu.
--
-- Sorular:
--   1 · Görünüm var ve RLS'i atlıyor mu?                → VAR, ATLAMAMALI
--   2 · anon kullanılabilir bakiyeyi görüyor mu?         → GÖRMEMELİ
--   3 · SKT'si geçmiş parti kullanılabilirden düşüyor mu?→ DÜŞMELİ
--   4 · SKT GÜNÜ hâlâ kullanılabilir mi?                 → KULLANILABİLİR
--   5 · Tarihsiz parti düşüyor mu?                       → DÜŞMEMELİ
--   6 · Kullanılabilir negatife iniyor mu?               → İNMEMELİ
--   7 · Analiz kritik sayısı artık onu okuyor mu?        → OKUMALI
--   8 · Eşiğe TAM inmiş kalem kritik mi?                 → KRİTİK (<=)
--   9 · Başka kiracının bakiyesi görünüyor mu?           → GÖRÜNMEMELİ
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

-- ── 1/2 · GÖRÜNÜM VE YETKİ (yapısal) ─────────────────────────────────────
do $$
declare v_sec boolean;
begin
  perform prova_bak('1a · stock_usable_balance görünümü var',
    exists (select 1 from information_schema.views
             where table_schema = 'public' and table_name = 'stock_usable_balance'));

  select 'security_invoker=on' = any(c.reloptions) into v_sec
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relname = 'stock_usable_balance';
  perform prova_bak('1b · security_invoker AÇIK (RLS atlanmıyor)', v_sec is true);

  perform prova_bak('2 · anon kullanılabilir bakiyeyi GÖRMÜYOR',
    not has_table_privilege('anon', 'public.stock_usable_balance', 'select'));
end $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid; v_auth uuid; v_app uuid;
  v_gecmis uuid; v_bugun uuid; v_tarihsiz uuid; v_esik uuid; v_negatif uuid;
  v_lg uuid; v_lb uuid; v_lt uuid; v_le uuid;
  v_tb uuid; v_fb uuid; v_bb uuid; v_kb uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);
  perform set_config('app.tenant_id', v_t::text, false);

  v_auth := gen_random_uuid(); v_app := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p95@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_t, v_f, v_auth, 'p95', 'p95', 'Prova 95', 'isletme_sahibi', true);
  perform set_config('prova.auth', v_auth::text, false);

  -- Dört kalem: hepsi lot takipli, eşikleri farklı.
  v_gecmis := gen_random_uuid(); v_bugun := gen_random_uuid();
  v_tarihsiz := gen_random_uuid(); v_esik := gen_random_uuid();
  v_negatif := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active, min_qty)
  values
    (v_gecmis,   v_t, v_b, 'P95-GECMIS',   'p95-gecmis',   'SKT Gecmis',  'kg', true, true,  true, 5),
    (v_bugun,    v_t, v_b, 'P95-BUGUN',    'p95-bugun',    'SKT Bugun',   'kg', true, true,  true, 5),
    -- ⚠️ `tracks_expiry = false` BİLEREK: görünüm bayrağa değil TARİHE bakmalı.
    (v_tarihsiz, v_t, v_b, 'P95-TARIHSIZ', 'p95-tarihsiz', 'Tarihsiz',    'kg', true, false, true, 5),
    (v_esik,     v_t, v_b, 'P95-ESIK',     'p95-esik',     'Esikte',      'kg', true, true,  true, 10),
    -- ⚠️ Lot takipsiz: negatif bakiyeyi lotsuz yazabilmek için. Lot takipli
    -- kalemde göç "lot_id olmadan hareket yazılamaz" diyor ve haklı.
    (v_negatif,  v_t, v_b, 'P95-NEGATIF',  'p95-negatif',  'Negatif',     'kg', false, false, true, 0);

  insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                lot_code_key, expires_on, origin_type)
  values
    (gen_random_uuid(), v_t, v_b, v_gecmis,   'P95-LG', 'p95-lg', current_date - 1, 'RECEIPT'),
    (gen_random_uuid(), v_t, v_b, v_bugun,    'P95-LB', 'p95-lb', current_date,     'RECEIPT'),
    (gen_random_uuid(), v_t, v_b, v_tarihsiz, 'P95-LT', 'p95-lt', null,             'RECEIPT'),
    (gen_random_uuid(), v_t, v_b, v_esik,     'P95-LE', 'p95-le', current_date + 90,'RECEIPT');

  select id into v_lg from public.stock_lot where lot_code_key = 'p95-lg';
  select id into v_lb from public.stock_lot where lot_code_key = 'p95-lb';
  select id into v_lt from public.stock_lot where lot_code_key = 'p95-lt';
  select id into v_le from public.stock_lot where lot_code_key = 'p95-le';

  -- Bakiye: her kaleme 100 kg giriş, eşikteki kaleme TAM 10 kg.
  insert into public.stock_movement (tenant_id, branch_id, stock_item_id, lot_id,
    quantity_base, quantity_entered, uom_entered, reason, source_type,
    idempotency_key, occurred_at)
  values
    (v_t, v_b, v_gecmis,   v_lg, 100, 100, 'kg', 'PURCHASE_RECEIPT', 'manual', 'p95:1', now()),
    (v_t, v_b, v_bugun,    v_lb, 100, 100, 'kg', 'PURCHASE_RECEIPT', 'manual', 'p95:2', now()),
    (v_t, v_b, v_tarihsiz, v_lt, 100, 100, 'kg', 'PURCHASE_RECEIPT', 'manual', 'p95:3', now()),
    (v_t, v_b, v_esik,     v_le,  10,  10, 'kg', 'PURCHASE_RECEIPT', 'manual', 'p95:4', now());

  -- ── NEGATİF BAKİYE ──────────────────────────────────────────────────────
  -- ⚠️ Kiracının politikası 'block' olduğu için negatif bakiye YAZILAMIYOR
  -- (göç 0011, I12) — ki doğrusu da bu. Ama bazı kiracılar 'allow' seçiyor
  -- ve o kiracıda fiziksel bakiye eksiye düşebiliyor. Görünümün
  -- `greatest(0, …)` koruması TAM O DURUM için var; sınamak için politika
  -- bu provada geçici olarak gevşetiliyor, sonra geri alınıyor.
  -- ⚠️ Prova `rollback` ile bittiği için canlı politikaya dokunmuyor.
  update public.tenant set negative_stock_policy = 'allow' where id = v_t;

  insert into public.stock_movement (tenant_id, branch_id, stock_item_id,
    quantity_base, quantity_entered, uom_entered, reason, source_type,
    idempotency_key, occurred_at)
  values (v_t, v_b, v_negatif, -3, 3, 'kg', 'COUNT_SHORTAGE', 'manual', 'p95:5', now());

  update public.tenant set negative_stock_policy = 'block' where id = v_t;

  -- ── BAŞKA KİRACI ────────────────────────────────────────────────────────
  v_tb := gen_random_uuid(); v_fb := gen_random_uuid(); v_bb := gen_random_uuid();
  insert into public.tenant (id, code, name) values (v_tb, 'P95B', 'Prova 95 B');
  insert into public.company (id, tenant_id, company_code, company_name)
    values (v_fb, v_tb, 'P95B-F', 'B Firma');
  insert into public.branch (id, tenant_id, company_id, code, name, branch_type,
                             is_active, is_head_office)
    values (v_bb, v_tb, v_fb, 'P95B-M', 'B Merkez', 'merkez', true, true);
  v_kb := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active, min_qty)
  values (v_kb, v_tb, v_bb, 'P95B-U', 'p95b-u', 'B Urunu', 'kg', false, false, true, 0);
  perform set_config('app.tenant_id', v_tb::text, false);
  insert into public.stock_movement (tenant_id, branch_id, stock_item_id,
    quantity_base, quantity_entered, uom_entered, reason, source_type,
    idempotency_key, occurred_at)
  values (v_tb, v_bb, v_kb, 50, 50, 'kg', 'PURCHASE_RECEIPT', 'manual', 'p95b:1', now());
  perform set_config('app.tenant_id', v_t::text, false);
  perform set_config('prova.kb', v_kb::text, false);

  perform set_config('prova.gecmis',   v_gecmis::text,   false);
  perform set_config('prova.bugunk',   v_bugun::text,    false);
  perform set_config('prova.tarihsiz', v_tarihsiz::text, false);
  perform set_config('prova.esik',     v_esik::text,     false);
  perform set_config('prova.negatif',  v_negatif::text,  false);

  raise notice 'KURULUM TAMAM';
end $$;

grant execute on function prova_bak(text,boolean) to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_fiz numeric; v_gec numeric; v_kul numeric; v_kritik numeric;
begin
  perform set_config('request.jwt.claim.sub', current_setting('prova.auth'), false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', current_setting('prova.auth'), 'tenant_id', v_t)::text, false);
  perform set_config('app.tenant_id', v_t::text, false);

  -- ── 3 · SKT'Sİ GEÇMİŞ PARTİ DÜŞÜYOR ──────────────────────────────────
  select qty, expired_qty, usable_qty into v_fiz, v_gec, v_kul
    from public.stock_usable_balance
   where stock_item_id = current_setting('prova.gecmis')::uuid;
  perform prova_bak('3a · fiziksel bakiye 100', v_fiz = 100);
  perform prova_bak('3b · süresi geçmiş 100', v_gec = 100);
  perform prova_bak('3c · kullanılabilir 0', v_kul = 0);

  -- ── 4 · SKT GÜNÜ HÂLÂ KULLANILABİLİR ─────────────────────────────────
  select expired_qty, usable_qty into v_gec, v_kul
    from public.stock_usable_balance
   where stock_item_id = current_setting('prova.bugunk')::uuid;
  perform prova_bak('4 · SKT GÜNÜ hâlâ kullanılabilir (100)',
    v_gec = 0 and v_kul = 100);

  -- ── 5 · TARİHSİZ PARTİ DÜŞMÜYOR (bayrak kapalı olsa da) ──────────────
  select expired_qty, usable_qty into v_gec, v_kul
    from public.stock_usable_balance
   where stock_item_id = current_setting('prova.tarihsiz')::uuid;
  perform prova_bak('5 · tarihsiz parti düşmüyor (100)',
    v_gec = 0 and v_kul = 100);

  -- ── 6 · KULLANILABİLİR NEGATİFE İNMİYOR ──────────────────────────────
  select qty, usable_qty into v_fiz, v_kul
    from public.stock_usable_balance
   where stock_item_id = current_setting('prova.negatif')::uuid;
  perform prova_bak('6a · fiziksel bakiye -3 (defter öyle söylüyor)', v_fiz = -3);
  perform prova_bak('6b · kullanılabilir 0, negatif değil', v_kul = 0);

  -- ── 7/8 · ANALİZ KRİTİK SAYISI ───────────────────────────────────────
  select g.deger into v_kritik
    from app.isletme_gostergeleri(v_b, current_date - 30, current_date) g
   where g.anahtar = 'kritik_kalem';

  -- Kritik olması gerekenler:
  --   P95-GECMIS  kullanılabilir 0  < 5   ✓ (ESKİDEN SAYILMIYORDU: fiziksel 100)
  --   P95-ESIK    kullanılabilir 10 = 10  ✓ (ESKİDEN SAYILMIYORDU: `<` idi)
  -- Kritik OLMAMASI gerekenler:
  --   P95-BUGUN   100 > 5
  --   P95-TARIHSIZ 100 > 5
  --   P95-NEGATIF  min_qty 0 → eşik yok
  perform prova_bak('7/8 · kritik kalem sayısı 2 (SKT geçmiş + eşiğe tam inmiş), '
    || 'gelen: ' || coalesce(v_kritik::text, 'NULL'), v_kritik = 2);

  -- ── 9 · BAŞKA KİRACININ BAKİYESİ GÖRÜNMÜYOR ──────────────────────────
  perform prova_bak('9 · B kiracısının bakiyesi görünmüyor',
    not exists (select 1 from public.stock_usable_balance
                 where stock_item_id = current_setting('prova.kb')::uuid));
end $$;

do $$ begin raise notice '═══ PROVA 0095 · HEPSİ YEŞİL ═══'; end $$;

rollback;
