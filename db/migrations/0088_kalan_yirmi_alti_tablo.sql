-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0088 · MIYOP-001'İN KALANI · 27 TABLO + SAHTE ALERJEN DAMGASI
--
-- Codex denetimi (17.10.2026) MIYOP-001'in kalan yüzeyini satır satır
-- listeledi: **iş izni kapısı olmayan 26 tablo.** Hepsinde RLS yalnız
-- `tenant_id = app.current_tenant_id()` diyor; `authenticated` rolünün
-- INSERT/UPDATE (yedisinde DELETE) hakkı var.
--
-- Örnek: `izleyici` kendi kiracısındaki **HACCP KRİTİK KONTROL NOKTASI
-- LİMİTLERİNİ** değiştirebiliyordu. Bir gıda güvenliği sisteminde bundan
-- daha kötü bir açık az bulunur.
--
-- ── NASIL EŞLEŞTİRİLDİ ───────────────────────────────────────────────────
-- 0085'te hata yaptım: kapıyı taktım, arkasında kimin çalıştığına
-- bakmadım ve iki akış kırdım (tuzak 88). Bu sefer önce EKRANLARIN
-- kapılarını ölçtüm ve aynı izni kullandım:
--
--   Suppliers, PurchaseFlow   → purchase.write
--   WorkOrders                → production.write
--   Sayimlar                  → stock.write
--   Musteriler, Siparisler    → operations.write
--   Sevkiyatlar               → logistics.write
--   Haccp                     → quality.write / quality.record.manage
--
-- ⚠️ Mal kabul ve tedarikçi iadesi İKİ ROLÜN işi: satın almacı belgeyi
-- açar, depocu malı alır. İkisi de kabul ediliyor.
--
-- ⚠️ HACCP PLANI VE KKN'si `quality.record.manage` istiyor, `quality.write`
-- değil. Ölçüm girmek ile LİMİTİ DEĞİŞTİRMEK aynı şey değil: biri kayıt,
-- diğeri kuralın kendisi (0081'in ikiye ayırma kararının devamı).
--
-- ── 27. TABLO · BESİN DEĞERİ (kendi ölçümüm, Codex listesinde yok) ───────
-- Kapıları koyduktan sonra "kapısız yazılabilir tablo kaldı mı" diye
-- veritabanını ölçtüm. Bir tane kaldı: `stock_item_nutrition`.
-- 0072 alerjen beyanının doğrudan yazılmasını kapatmıştı; **besin değeri
-- tablosu o temizlikte atlanmış.** `authenticated` rolünün hâlâ
-- INSERT/UPDATE/DELETE hakkı var ve bu tablo GIDA ETİKETİNE basılıyor.
--
-- 0072'nin yöntemi (hakkı tamamen geri alıp RPC'ye zorlamak) burada
-- uygulanamaz: besin değeri için yazma RPC'si YOK, ekran doğrudan yazıyor.
-- Hakkı geri almak çalışan bir ekranı kırardı (tuzak 88). Bu yüzden
-- kapı konuyor: beyan (`quality.declaration`), ürün yönetimi
-- (`products.write`) ya da stok (`stock.write`) izinlerinden biri yeterli.
--
-- ── 2 · SAHTE ALERJEN DAMGASI (MIYOP-035) ────────────────────────────────
-- 0072'nin damga koruması yalnız UPDATE'te çalışıyor. Yeni kart AÇARKEN
-- `allergen_reviewed_at` doldurulabiliyordu: depo rolü, beyan RPC'si hiç
-- çağrılmadan "alerjeni incelendi" iddiası olan bir kart oluşturabiliyor
-- ve etiket servisi bunu "incelendi · alerjen yok" diye basıyordu.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · ÇOKLU İZİN KAPISI ─────────────────────────────────────────────────
-- Tetik argümanlarının HERHANGİ BİRİ yeterli. Tek izinli kapı için de
-- kullanılabilir; `izin_gerek`in genelleştirilmiş hâli.
create or replace function app.izin_gerek_coklu()
returns trigger
language plpgsql
set search_path = public, app
as $$
declare v_izin text;
begin
  -- ⚠️ ARGÜMAN KONTROLÜ EN BAŞTA. Bakım bağlamından SONRA olursa,
  -- argümansız kurulmuş bir tetik göç sırasında sessizce geçerdi ve
  -- hata ilk müşteri isteğine kadar ortaya çıkmazdı.
  if tg_nargs = 0 then
    raise exception 'app.izin_gerek_coklu: izin argumani verilmemis (% tablosu).',
      tg_table_name;
  end if;

  if app.bakim_baglami() then
    return coalesce(new, old);
  end if;

  foreach v_izin in array tg_argv loop
    if app.yetkim_var(v_izin) then
      return coalesce(new, old);
    end if;
  end loop;

  raise exception
    'Bu islem icin su izinlerden biri gerekiyor: %. Hesabinizda yok. (% tablosu)',
    array_to_string(tg_argv, ', '), tg_table_name
    using errcode = 'MI403';
end $$;

comment on function app.izin_gerek_coklu() is
  'Genel yazma kapisi, COKLU izin. Tetik argumanlarindan biri yeterli. '
  'Argumansiz kurulursa PATLAR — sessizce herkesi gecirmez (0088).';

revoke all on function app.izin_gerek_coklu() from public;
revoke all on function app.izin_gerek_coklu() from anon;


-- ── 2 · YİRMİ ALTI TABLO ──────────────────────────────────────────────────
do $$
declare

  v_eslesme jsonb := jsonb_build_object(
    -- Satın alma
    'supplier',              '["purchase.write"]',
    'purchase_request',      '["purchase.write"]',
    'purchase_request_line', '["purchase.write"]',
    'purchase_order',        '["purchase.write"]',
    'purchase_order_line',   '["purchase.write"]',
    -- Mal kabul ve iade: belgeyi satın almacı açar, malı depocu alır
    'goods_receipt',         '["purchase.write","stock.write"]',
    'goods_receipt_line',    '["purchase.write","stock.write"]',
    'supplier_return',       '["purchase.write","stock.write"]',
    'supplier_return_line',  '["purchase.write","stock.write"]',
    -- Üretim
    'work_order',            '["production.write"]',
    'work_order_line',       '["production.write"]',
    -- Kalite: PLAN ve LİMİT, ölçüm girmekten farklıdır
    'haccp_plan',            '["quality.record.manage"]',
    'haccp_ccp',             '["quality.record.manage"]',
    -- Depo
    'stock_count',           '["stock.write"]',
    'stock_count_line',      '["stock.write"]',
    -- Müşteri ve sipariş
    'customer',              '["operations.write"]',
    'delivery_point',        '["operations.write"]',
    'customer_price',        '["operations.write"]',
    'sales_order',           '["operations.write"]',
    'sales_order_revision',  '["operations.write"]',
    'sales_order_line',      '["operations.write"]',
    'order_discrepancy',     '["operations.write"]',
    'portal_user',           '["operations.write"]',
    'portal_user_point',     '["operations.write"]',
    -- Lojistik
    'vehicle',               '["logistics.write"]',
    'driver',                '["logistics.write"]',
    -- Besin değeri · 0072'nin alerjen temizliğinde atlanmış 27. tablo
    'stock_item_nutrition',  '["quality.declaration","products.write","stock.write"]'
  );
  v_tablo text;
  v_izinler text;
  v_tetik text;
  v_kurulan int := 0;
begin
  for v_tablo, v_izinler in
    select key, (select string_agg(format('%L', x), ', ')
                   from jsonb_array_elements_text(value::jsonb) x)
      from jsonb_each_text(v_eslesme)
  loop
    -- Tablo yoksa SESSİZCE GEÇME — eşleme bayatlamış demektir.
    if to_regclass('public.' || quote_ident(v_tablo)) is null then
      raise exception '0088: `%` tablosu yok. Esleme bayatlamis.', v_tablo;
    end if;

    v_tetik := 'izin_' || v_tablo;
    execute format('drop trigger if exists %I on public.%I', v_tetik, v_tablo);
    execute format(
      'create trigger %I before insert or update or delete on public.%I '
      'for each row execute function app.izin_gerek_coklu(%s)',
      v_tetik, v_tablo, v_izinler);
    v_kurulan := v_kurulan + 1;
  end loop;

  if v_kurulan <> 27 then
    raise exception '0088: 27 tetik bekleniyordu, % kuruldu.', v_kurulan;
  end if;
  raise notice '0088: % tabloya is izni kapisi kondu.', v_kurulan;
end $$;


-- ── 3 · SAHTE ALERJEN DAMGASI (MIYOP-035) ─────────────────────────────────
-- 0086'nın stok kartı kapısı korunuyor; üstüne INSERT kontrolü ekleniyor.
create or replace function app.stok_karti_izni()
returns trigger
language plpgsql
set search_path = public, app
as $$
declare
  v_beyan constant text[] := array[
    'net_qty', 'net_uom',
    'allergen_reviewed_at', 'allergen_reviewed_by',
    'updated_at'
  ];
begin
  if app.bakim_baglami() then
    return coalesce(new, old);
  end if;

  -- ⚠️ MIYOP-035: YENİ KART İNCELENMİŞ DOĞAMAZ.
  -- 0072'nin damga koruması yalnız UPDATE'te çalışıyordu. Damga, beyan
  -- işleminin SONUCUDUR; kartın doğuştan gelen bir özelliği değil.
  if tg_op = 'INSERT'
     and (new.allergen_reviewed_at is not null
          or new.allergen_reviewed_by is not null)
  then
    raise exception
      'Yeni stok karti "alerjeni incelendi" damgasiyla olusturulamaz. '
      'Damga, beyan islemi yapildiginda sunucu tarafindan atilir.'
      using errcode = 'MI436';
  end if;

  if app.yetkim_var('stock.write') then
    return coalesce(new, old);
  end if;

  if tg_op = 'UPDATE'
     and app.yetkim_var('quality.declaration')
     and (to_jsonb(new) - v_beyan) = (to_jsonb(old) - v_beyan)
  then
    return new;
  end if;

  raise exception
    'Stok karti icin `stock.write` gerekiyor. Yalniz beyan alanlarini '
    'degistiriyorsaniz `quality.declaration` de yeter; hesabinizda ikisi de yok.'
    using errcode = 'MI403';
end $$;

comment on function app.stok_karti_izni() is
  'Stok karti kapisi. `stock.write` her seyi acar; `quality.declaration` '
  'YALNIZ beyan kolonlarini. 0088: yeni kart incelenmis damgasiyla '
  'olusturulamaz (MIYOP-035).';

revoke all on function app.stok_karti_izni() from public;
revoke all on function app.stok_karti_izni() from anon;


-- ── 4 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare
  v_tablo text;
  v_adet  int;
  v_ad    text;
begin
  -- Yirmi alti tetigin hepsi yerinde mi
  select count(*) into v_adet
    from pg_trigger t
   where not t.tgisinternal
     and t.tgname like 'izin\_%'
     and t.tgfoid = to_regprocedure('app.izin_gerek_coklu()');
  if v_adet <> 27 then
    raise exception '0088: coklu kapi tetigi sayisi % (27 bekleniyordu).', v_adet;
  end if;

  -- Argumansiz kurulmus tetik KALMAMALI: argumansiz kapi herkesi gecirirdi
  if exists (
    select 1 from pg_trigger t
     where not t.tgisinternal
       and t.tgfoid = to_regprocedure('app.izin_gerek_coklu()')
       and t.tgnargs = 0
  ) then
    raise exception '0088: argumansiz coklu kapi tetigi var.';
  end if;

  -- Onceki goclerin kapilari yerinde mi
  foreach v_ad in array array[
    'izin_stock_movement','izin_stock_item','izin_stock_lot','izin_lot_genealogy',
    'izin_company','izin_branch','izin_app_user','izin_user_branch_access',
    'izin_tenant','izin_order_approval','izin_order_approval_step',
    'izin_recipe','izin_shipment','izin_haccp_measurement',
    'izin_haccp_corrective_action','izin_stock_item_ambalaj'
  ] loop
    if not exists (select 1 from pg_trigger t where t.tgname = v_ad and not t.tgisinternal) then
      raise exception '0088: onceki kapi % kayboldu.', v_ad;
    end if;
  end loop;

  -- Esleme kullanilan izinlerin hepsi KATALOGDA olmali
  for v_tablo in select unnest(array[
    'purchase.write','stock.write','production.write','quality.record.manage',
    'operations.write','logistics.write','quality.declaration','products.write'
  ]) loop
    if not exists (select 1 from permission where code = v_tablo) then
      raise exception '0088: `%` izni katalogda yok.', v_tablo;
    end if;
  end loop;

  -- PUBLIC kapisi (tuzak 67 + 80)
  foreach v_ad in array array['app.izin_gerek_coklu()','app.stok_karti_izni()'] loop
    if exists (
      select 1 from pg_proc p,
        lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       where p.oid = to_regprocedure(v_ad)
         and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception '0088: % uzerinde PUBLIC EXECUTE acik.', v_ad;
    end if;
  end loop;

  -- ⚠️ EN ÖNEMLİ DOĞRULAMA: kapı SAYMAK yerine KAPISIZ YÜZEY ölçülüyor.
  -- 0085'te "kapandı" dedim, çünkü taktığım kapıları saymıştım. Yanlıştı.
  select count(*) into v_adet
    from (
      select distinct c.oid
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
       where n.nspname = 'public' and c.relkind = 'r'
         and a.grantee = 'authenticated'::regrole
         and a.privilege_type in ('INSERT','UPDATE','DELETE')
    ) y
   where not exists (
     select 1 from pg_trigger t
      where t.tgrelid = y.oid and not t.tgisinternal
        and (t.tgname like 'izin\_%' or t.tgname like '%degismez%'));
  if v_adet <> 0 then
    raise exception '0088: `authenticated` rolune acik ama kapisiz % tablo kaldi.', v_adet;
  end if;

  raise notice '0088 tamam: 27 tabloya kapi kondu, kapisiz yazma yuzeyi 0, sahte alerjen damgasi kapandi.';
end $$;
