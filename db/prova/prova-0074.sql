\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

create or replace function prova_esit(p_ad text, p_a numeric, p_b numeric) returns void
language plpgsql as $$
begin
  if p_a is not distinct from p_b then raise notice '  ✓ % (%)', p_ad, p_b;
  else raise exception '  ✗ %  beklenen=%  gelen=%', p_ad, p_b, p_a; end if;
end; $$;

create or replace function prova_oturum(p_auth uuid, p_tenant uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', p_tenant)::text, false);
  perform set_config('app.tenant_id', p_tenant::text, false);
end; $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_sube uuid;
  v_patron uuid := gen_random_uuid(); v_depocu uuid := gen_random_uuid();
  v_un uuid := gen_random_uuid(); v_corba uuid := gen_random_uuid();
  v_gizem uuid := gen_random_uuid();      -- hiç alınmamış, reçetesiz
  v_a uuid := gen_random_uuid(); v_b uuid := gen_random_uuid();  -- döngü
  v_musteri uuid := gen_random_uuid();
  v_siparis uuid := gen_random_uuid(); v_rev uuid := gen_random_uuid();
  v_sevk uuid := gen_random_uuid();
  v_recete uuid := gen_random_uuid();
begin
  select id into v_t from public.tenant limit 1;
  select id into v_sube from public.branch where tenant_id = v_t limit 1;
  update public.tenant set negative_stock_policy = 'warn' where id = v_t;

  insert into public.app_user (id, tenant_id, auth_user_id, username, username_key,
                               full_name, role_code, is_active)
  values (gen_random_uuid(), v_t, v_patron, 'prv_patron', 'prv_patron',
          'Patron', 'isletme_sahibi', true),
         (gen_random_uuid(), v_t, v_depocu, 'prv_depocu', 'prv_depocu',
          'Depocu', 'depo_sorumlusu', true);

  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_un,    v_t, v_sube, 'PRV-UN',    'prv-un',    'Un',            'kg'),
         (v_corba, v_t, v_sube, 'PRV-CORBA', 'prv-corba', 'Mercimek Çorbası','kg'),
         (v_gizem, v_t, v_sube, 'PRV-GIZEM', 'prv-gizem', 'Gizemli Kalem', 'kg'),
         (v_a,     v_t, v_sube, 'PRV-A',     'prv-a',     'Döngü A',       'kg'),
         (v_b,     v_t, v_sube, 'PRV-B',     'prv-b',     'Döngü B',       'kg');

  -- ── ALIŞ: 100 kg un, 20 TL/kg ───────────────────────────────────────────
  insert into public.stock_movement
    (tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
     uom_entered, reason, source_type, idempotency_key, occurred_at, unit_cost, currency)
  values (v_t, v_sube, v_un, 100, 100, 'kg', 'PURCHASE_RECEIPT', 'goods_receipt',
          'prv-alis-un', now() - interval '20 days', 20, 'TRY');

  -- ── REÇETE: 10 kg çorba = 2 kg un (verim %100, fire %0) ────────────────
  insert into public.recipe (id, tenant_id, code, code_key, name,
                             output_item_id, output_qty, output_uom, yield_pct, status)
  values (v_recete, v_t, 'PRV-R1', 'prv-r1', 'Mercimek Çorbası Reçetesi',
          v_corba, 10, 'kg', 100, 'ACTIVE');
  insert into public.recipe_line (tenant_id, recipe_id, line_no, stock_item_id, qty, uom, waste_pct)
  values (v_t, v_recete, 1, v_un, 2, 'kg', 0);

  -- ── DÖNGÜ: A'nın reçetesinde B, B'nin reçetesinde A ────────────────────
  insert into public.recipe (id, tenant_id, code, code_key, name,
                             output_item_id, output_qty, output_uom, yield_pct, status)
  values (gen_random_uuid(), v_t, 'PRV-RA', 'prv-ra', 'A Reçetesi', v_a, 1, 'kg', 100, 'ACTIVE')
  returning id into v_recete;
  insert into public.recipe_line (tenant_id, recipe_id, line_no, stock_item_id, qty, uom, waste_pct)
  values (v_t, v_recete, 1, v_b, 1, 'kg', 0);
  insert into public.recipe (id, tenant_id, code, code_key, name,
                             output_item_id, output_qty, output_uom, yield_pct, status)
  values (gen_random_uuid(), v_t, 'PRV-RB', 'prv-rb', 'B Reçetesi', v_b, 1, 'kg', 100, 'ACTIVE')
  returning id into v_recete;
  insert into public.recipe_line (tenant_id, recipe_id, line_no, stock_item_id, qty, uom, waste_pct)
  values (v_t, v_recete, 1, v_a, 1, 'kg', 0);

  -- ── ÜRETİM: 50 kg çorba girişi (satışı karşılasın) ─────────────────────
  insert into public.stock_movement
    (tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
     uom_entered, reason, source_type, idempotency_key, occurred_at)
  values (v_t, v_sube, v_corba, 50, 50, 'kg', 'PRODUCTION_OUTPUT', 'work_order',
          'prv-uretim-corba', now() - interval '15 days'),
         (v_t, v_sube, v_un, -10, -10, 'kg', 'PRODUCTION_CONSUME', 'work_order',
          'prv-tuketim-un', now() - interval '15 days'),
         (v_t, v_sube, v_gizem, 30, 30, 'kg', 'OPENING_BALANCE', 'manual',
          'prv-acilis-gizem', now() - interval '25 days');

  -- ── MÜŞTERİ + SİPARİŞ (fiyat satırda) ──────────────────────────────────
  insert into public.customer (id, tenant_id, code, code_key, name)
  values (v_musteri, v_t, 'PRV-M1', 'prv-m1', 'Migros');

  insert into public.sales_order (id, tenant_id, branch_id, order_no, customer_id,
                                  order_date, status, current_revision)
  values (v_siparis, v_t, v_sube, 'PRV-SIP-1', v_musteri,
          (now() - interval '10 days')::date, 'Taslak', 1);
  insert into public.sales_order_revision (id, tenant_id, order_id, revision_no,
                                           kind, source, reason, created_at)
  values (v_rev, v_t, v_siparis, 1, 'MIKTAR', 'Telefon', 'İlk kayıt',
          now() - interval '10 days');
  -- ⚠️ Fiyat KG başına 15 TL; çorbanın temel birimi de kg.
  insert into public.sales_order_line (tenant_id, order_id, revision_id, line_no,
                                       stock_item_id, qty, uom_code, unit_price, currency)
  values (v_t, v_siparis, v_rev, 1, v_corba, 5, 'kg', 15, 'TRY');
  -- ⚠️ Un TON fiyatıyla: 20.000 TL/ton → temel birimde 20 TL/kg olmalı.
  insert into public.sales_order_line (tenant_id, order_id, revision_id, line_no,
                                       stock_item_id, qty, uom_code, unit_price, currency)
  values (v_t, v_siparis, v_rev, 2, v_un, 0.004, 'ton', 20000, 'TRY');

  -- ── SİPARİŞİ ONAY ZİNCİRİNDEN GEÇİR ───────────────────────────────────
  -- ⚠️ KURALIN İÇİNDEN GEÇİLİYOR, ETRAFINDAN DEĞİL. Sevkiyat ancak "Hazır"
  -- siparişe bağlanabiliyor (0051) ve "Onaylandı"ya geçmek için zorunlu
  -- onay adımları gerekiyor (0053). Bu prova kiracısında zorunlu adım
  -- bırakılmıyor; durum akışı ise AYNEN izleniyor.
  update public.order_approval_step set required = false where tenant_id = v_t;
  update public.sales_order set status = 'Onay Bekliyor' where id = v_siparis;
  update public.sales_order set status = 'Onaylandı'     where id = v_siparis;
  update public.sales_order set status = 'Hazırlanıyor'  where id = v_siparis;
  update public.sales_order set status = 'Hazır'         where id = v_siparis;

  -- ── SEVKİYAT: 5 kg çorba + 4 kg un (siparişe bağlı) ────────────────────
  insert into public.shipment (id, tenant_id, branch_id, shipment_no, customer_name,
                               customer_id, order_id, status, shipped_on, shipped_at)
  values (v_sevk, v_t, v_sube, 'PRV-SVK-1', 'Migros', v_musteri, v_siparis,
          'SHIPPED', (now() - interval '5 days')::date, now() - interval '5 days');
  insert into public.shipment_line (tenant_id, shipment_id, line_no, stock_item_id, qty, uom)
  values (v_t, v_sevk, 1, v_corba, 5, 'kg'),
         (v_t, v_sevk, 2, v_un, 4, 'kg');
  insert into public.stock_movement
    (tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
     uom_entered, reason, source_type, source_id, idempotency_key, occurred_at)
  values (v_t, v_sube, v_corba, -5, -5, 'kg', 'SHIPMENT_OUT', 'shipment', v_sevk,
          'prv-sevk-corba', now() - interval '5 days'),
         (v_t, v_sube, v_un, -4, -4, 'kg', 'SHIPMENT_OUT', 'shipment', v_sevk,
          'prv-sevk-un', now() - interval '5 days');

  -- ── SİPARİŞSİZ SEVKİYAT: 6 kg gizemli kalem (fiyatsız + maliyetsiz) ────
  insert into public.shipment (id, tenant_id, branch_id, shipment_no, customer_name,
                               customer_id, status, shipped_on, shipped_at)
  values (gen_random_uuid(), v_t, v_sube, 'PRV-SVK-2', 'Şok', v_musteri,
          'SHIPPED', (now() - interval '4 days')::date, now() - interval '4 days')
  returning id into v_sevk;
  insert into public.shipment_line (tenant_id, shipment_id, line_no, stock_item_id, qty, uom)
  values (v_t, v_sevk, 1, v_gizem, 6, 'kg');
  insert into public.stock_movement
    (tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
     uom_entered, reason, source_type, source_id, idempotency_key, occurred_at)
  values (v_t, v_sube, v_gizem, -6, -6, 'kg', 'SHIPMENT_OUT', 'shipment', v_sevk,
          'prv-sevk-gizem', now() - interval '4 days');

  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.sube', v_sube::text, false);
  perform set_config('prova.patron', v_patron::text, false);
  perform set_config('prova.depocu', v_depocu::text, false);
  perform set_config('prova.un', v_un::text, false);
  perform set_config('prova.corba', v_corba::text, false);
  perform set_config('prova.gizem', v_gizem::text, false);
  perform set_config('prova.a', v_a::text, false);
end; $$;

-- ── 1 · MALİYET HESABI ────────────────────────────────────────────────────
do $$
declare v_an timestamptz := now();
begin
  perform prova_esit('un maliyeti = son alış (20 TL/kg)',
    app.kalem_maliyeti(current_setting('prova.un')::uuid, v_an), 20);

  -- 10 kg çorba = 2 kg un × 20 TL = 40 TL → kg başına 4 TL
  perform prova_esit('çorba maliyeti reçeteden (4 TL/kg)',
    app.kalem_maliyeti(current_setting('prova.corba')::uuid, v_an), 4);

  perform prova_bak('alınmamış, reçetesiz kalemin maliyeti BİLİNMİYOR (null)',
    app.kalem_maliyeti(current_setting('prova.gizem')::uuid, v_an) is null);

  -- ⚠️ Bu test olmasa A→B→A reçetesi sunucuyu sonsuza kilitlerdi.
  perform prova_bak('döngülü reçete sonsuza gitmiyor, null dönüyor',
    app.kalem_maliyeti(current_setting('prova.a')::uuid, v_an) is null);
end; $$;

-- Verim ve fire payı doğru uygulanıyor mu?
do $$
declare v_maliyet numeric;
begin
  update public.recipe set yield_pct = 80
   where output_item_id = current_setting('prova.corba')::uuid and status = 'ACTIVE';
  update public.recipe_line set waste_pct = 20
   where recipe_id = (select id from public.recipe
                       where output_item_id = current_setting('prova.corba')::uuid
                         and status = 'ACTIVE');
  -- 2 kg × (100/80) × 1/(1-0,20) = 3,125 kg un → 62,50 TL / 10 kg = 6,25 TL/kg
  v_maliyet := app.kalem_maliyeti(current_setting('prova.corba')::uuid, now());
  perform prova_esit('verim %80 + fire %20 → 6,25 TL/kg (recipe.service.ts formülü)',
    round(v_maliyet, 4), 6.25);

  update public.recipe set yield_pct = 100
   where output_item_id = current_setting('prova.corba')::uuid and status = 'ACTIVE';
  update public.recipe_line set waste_pct = 0
   where recipe_id = (select id from public.recipe
                       where output_item_id = current_setting('prova.corba')::uuid
                         and status = 'ACTIVE');
end; $$;

-- ── 2 · SATIŞ VE KÂRLILIK ─────────────────────────────────────────────────
do $$
declare r record;
begin
  perform prova_oturum(current_setting('prova.patron')::uuid,
                       current_setting('prova.t')::uuid);

  select * into r from app.satis_karliligi(
    current_setting('prova.sube')::uuid,
    (current_date - 30), current_date)
   where kalem_id = current_setting('prova.corba')::uuid;

  perform prova_esit('çorba · satılan miktar', r.miktar, 5);
  perform prova_esit('çorba · ciro (5 kg × 15 TL)', r.ciro, 75);
  perform prova_esit('çorba · maliyet (5 kg × 4 TL)', r.maliyet, 20);
  perform prova_esit('çorba · brüt kâr', r.kar, 55);
  perform prova_esit('çorba · marj (55/75)', round(r.marj, 4), 0.7333);
  perform prova_esit('çorba · fiyatsız miktar yok', r.fiyatsiz_miktar, 0);
  perform prova_bak('çorba · maliyeti biliniyor', r.maliyetsiz = false);
end; $$;

-- ⚠️ EN KRİTİK TEST: fiyat KOLİ/TON cinsindeyse temel birime indiriliyor mu?
do $$
declare r record;
begin
  select * into r from app.satis_karliligi(
    current_setting('prova.sube')::uuid, (current_date - 30), current_date)
   where kalem_id = current_setting('prova.un')::uuid;
  -- 20.000 TL/ton = 20 TL/kg; 4 kg satıldı → 80 TL ciro, 80 TL maliyet, 0 kâr
  perform prova_esit('un · TON fiyatı KG''a indirildi (ciro 80 TL)', r.ciro, 80);
  perform prova_esit('un · maliyet 80 TL', r.maliyet, 80);
  perform prova_esit('un · kâr sıfır (maliyetine satılmış)', r.kar, 0);
end; $$;

do $$
declare r record;
begin
  select * into r from app.satis_karliligi(
    current_setting('prova.sube')::uuid, (current_date - 30), current_date)
   where kalem_id = current_setting('prova.gizem')::uuid;
  perform prova_esit('siparişsiz sevkiyat · ciroya GİRMİYOR', r.ciro, 0);
  perform prova_esit('siparişsiz sevkiyat · fiyatsız miktar raporlanıyor',
    r.fiyatsiz_miktar, 6);
  perform prova_bak('maliyeti bilinmeyen kalem İŞARETLENİYOR', r.maliyetsiz = true);
  perform prova_bak('maliyeti bilinmeyince kâr da NULL (0 değil)', r.kar is null);
  perform prova_bak('maliyeti bilinmeyince marj da NULL', r.marj is null);
end; $$;

-- ── 0075 · FİYATI BİLİNMEYEN MAL "ZARAR" DEĞİL ───────────────────────────
-- ⚠️ Emrah'ın GERÇEK verisinde çıktı: siparişe bağlı olmayan sevkiyatta
-- ciro 0 ama maliyet tam miktar üzerinden yazılıyordu → kâr eksi çıkıyor
-- ve "zararına satılan ürün" KRİTİK bulgusu yanlış yere ateşleniyordu.
do $$
declare r record; v_un uuid := current_setting('prova.un')::uuid; v_sevk uuid;
begin
  -- Un'dan 10 kg daha, ama SİPARİŞSİZ bir sevkiyatla (fiyatı bilinmiyor).
  -- Un'un maliyeti BİLİNİYOR (20 TL/kg) — tuzak tam burada.
  insert into public.shipment (id, tenant_id, branch_id, shipment_no, customer_name,
                               customer_id, status, shipped_on, shipped_at)
  values (gen_random_uuid(), current_setting('prova.t')::uuid,
          current_setting('prova.sube')::uuid, 'PRV-SVK-3', 'Carrefour',
          (select id from public.customer where code = 'PRV-M1'),
          'SHIPPED', (now() - interval '3 days')::date, now() - interval '3 days')
  returning id into v_sevk;
  insert into public.shipment_line (tenant_id, shipment_id, line_no, stock_item_id, qty, uom)
  values (current_setting('prova.t')::uuid, v_sevk, 1, v_un, 10, 'kg');
  insert into public.stock_movement
    (tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
     uom_entered, reason, source_type, source_id, idempotency_key, occurred_at)
  values (current_setting('prova.t')::uuid, current_setting('prova.sube')::uuid,
          v_un, -10, -10, 'kg', 'SHIPMENT_OUT', 'shipment', v_sevk,
          'prv-sevk-un-siparissiz', now() - interval '3 days');

  select * into r from app.satis_karliligi(
    current_setting('prova.sube')::uuid, (current_date - 30), current_date)
   where kalem_id = v_un;

  -- 4 kg fiyatlı (20 TL/kg) + 10 kg fiyatsız = 14 kg satıldı
  perform prova_esit('un · toplam satılan 14 kg', r.miktar, 14);
  perform prova_esit('un · fiyatsız 10 kg', r.fiyatsiz_miktar, 10);
  perform prova_esit('un · ciro yalnız fiyatlı 4 kg (80 TL)', r.ciro, 80);
  -- ⚠️ ASIL SINAV: maliyet 14 kg üzerinden (280 TL) DEĞİL, 4 kg (80 TL)
  perform prova_esit('un · maliyet YALNIZ fiyatlı miktar üzerinden (80 TL)',
    r.maliyet, 80);
  perform prova_esit('un · kâr sıfır — SAHTE ZARAR YOK', r.kar, 0);
end; $$;

do $$
declare r record;
begin
  -- Hiç fiyatı olmayan ama maliyeti BİLİNEN bir kalem: zarar yazılmamalı.
  select * into r from app.satis_karliligi(
    current_setting('prova.sube')::uuid, (current_date - 30), current_date)
   where kalem_id = current_setting('prova.gizem')::uuid;
  perform prova_bak('fiyatı hiç bilinmeyen kalemde kâr NULL, eksi DEĞİL',
    r.kar is null);
end; $$;

-- ── 3 · STOK DEVİR HIZI ───────────────────────────────────────────────────
do $$
declare r record;
begin
  -- un çıkışı: 10 (üretim tüketimi) + 4 (siparişli sevkiyat)
  --            + 10 (0075 provasındaki siparişsiz sevkiyat) = 24
  select * into r from app.stok_devri(
    current_setting('prova.sube')::uuid, (current_date - 30), current_date)
   where kalem_id = current_setting('prova.un')::uuid;
  perform prova_esit('un · dönem çıkışı = üretim tüketimi + sevkiyatlar', r.cikis, 24);
  perform prova_bak('un · devir hızı hesaplandı', r.devir is not null);
  perform prova_bak('un · kaç günde bir devrettiği yazılı', r.gun is not null);
end; $$;

do $$
declare v_say int;
begin
  -- Ortalama stoku 0 olan kalem için devir NULL olmalı, sonsuz değil.
  select count(*) into v_say from app.stok_devri(
    current_setting('prova.sube')::uuid, (current_date - 30), current_date)
   where devir is not null and devir = 'Infinity'::numeric;
  perform prova_bak('hiçbir yerde sonsuz devir yok', v_say = 0);
end; $$;

-- ── 4 · YETKİ KAPISI ──────────────────────────────────────────────────────
do $$
declare v_h text := '';
begin
  perform prova_oturum(current_setting('prova.depocu')::uuid,
                       current_setting('prova.t')::uuid);
  begin
    perform * from app.satis_karliligi(current_setting('prova.sube')::uuid,
                                       (current_date - 30), current_date);
    raise exception 'KAPI GEÇİLDİ — depocu ciroyu okudu';
  exception when sqlstate 'MI403' then v_h := 'ok'; end;
  perform prova_bak('depo sorumlusu ciroyu GÖREMİYOR (MI403)', v_h = 'ok');

  v_h := '';
  begin
    perform * from app.stok_devri(current_setting('prova.sube')::uuid,
                                  (current_date - 30), current_date);
    raise exception 'KAPI GEÇİLDİ — depocu devir hızını okudu';
  exception when sqlstate 'MI403' then v_h := 'ok'; end;
  perform prova_bak('depo sorumlusu devir hızını GÖREMİYOR (MI403)', v_h = 'ok');
end; $$;

-- ── 5 · İPTAL EDİLMİŞ SEVKİYAT CİROYA GİRMİYOR ────────────────────────────
do $$
declare v_hareket uuid; v_once numeric; v_sonra numeric;
begin
  perform prova_oturum(current_setting('prova.patron')::uuid,
                       current_setting('prova.t')::uuid);
  select ciro into v_once from app.satis_karliligi(
    current_setting('prova.sube')::uuid, (current_date - 30), current_date)
   where kalem_id = current_setting('prova.corba')::uuid;

  select id into v_hareket from public.stock_movement
   where idempotency_key = 'prv-sevk-corba';
  insert into public.stock_movement
    (tenant_id, branch_id, stock_item_id, quantity_base, quantity_entered,
     uom_entered, reason, source_type, idempotency_key, occurred_at, reverses_movement_id)
  values (current_setting('prova.t')::uuid, current_setting('prova.sube')::uuid,
          current_setting('prova.corba')::uuid, 5, 5, 'kg', 'REVERSAL', 'shipment',
          'prv-sevk-corba-iptal', now() - interval '4 days', v_hareket);

  select coalesce(ciro, 0) into v_sonra from app.satis_karliligi(
    current_setting('prova.sube')::uuid, (current_date - 30), current_date)
   where kalem_id = current_setting('prova.corba')::uuid;

  perform prova_esit('iptalden önce çorba cirosu', v_once, 75);
  perform prova_esit('iptalden sonra çorba cirosu SIFIR', coalesce(v_sonra, 0), 0);
end; $$;

rollback;
