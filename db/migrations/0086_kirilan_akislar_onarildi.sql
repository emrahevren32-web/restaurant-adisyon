-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0086 · 0085'İN KIRDIĞI İKİ AKIŞ ONARILIYOR
--
-- Codex denetimi (17.10.2026, MIYOP-031 ve MIYOP-032) 0085'in iki meşru
-- akışı kırdığını buldu. İkisi de gerçek. Kapı takarken kapının ARKASINDA
-- kimin çalıştığına yeterince bakmamışım.
--
-- ── KIRIK 1 · KALİTE ROLÜ ETİKET BEYANINI YAZAMIYOR (MIYOP-031) ──────────
-- 0081 `izin_stock_item_ambalaj` tetiğini TAM DA BUNUN İÇİN yazmıştı:
-- ambalaj beyanı `quality.declaration` ister, `stock.write` istemez.
-- 0085 ise `stock_item` tablosunun TAMAMINA `stock.write` isteyen ikinci
-- bir tetik ekledi. İki tetik de çalışıyor, ikincisi birincisini boğuyor.
--
-- Ölçüldü: `kalite_sorumlusu` ve `gida_muhendisi` rollerinin izinleri
-- arasında `stock.write` YOK — olması da gerekmiyor, kalite depocu değil.
-- Sonuç: Etiketler ekranı (`quality.declaration` ister) kalite rolünde
-- çalışmaz hâle geldi.
--
-- ── KIRIK 2 · SATIN ALMACI LOTLU MAL KABULÜ YAPAMIYOR (MIYOP-032) ────────
-- 0085 stok defterinin kapısını `reason`a bakacak şekilde yazdım:
-- `PURCHASE_RECEIPT` için `purchase.write` yeterli. Ama mal kabulü yalnız
-- hareket yazmaz, LOT da açar — ve `stock_lot` kapısına düz
-- `stock.write` koymuşum. `satinalma_sorumlusu`nda o izin yok.
--
-- Sonuç daha da kötü: hareket geçer, lot düşer. YARIM KALMIŞ bir mal
-- kabul. Tam olarak kaçınmaya çalıştığımız şey.
--
-- ── DERS ─────────────────────────────────────────────────────────────────
-- Bir akışın izni TEK tabloya bakılarak belirlenemez. Mal kabul üç tabloya
-- birden yazıyor (hareket, lot, belge); kapı üçünde de AYNI izin kümesini
-- kabul etmek zorunda. Tuzak 88.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · STOK KARTI · BEYAN KOLONLARI KALİTEYE AÇIK ────────────────────────
-- ⚠️ TUZAK 79'UN UYGULAMASI: "hangi kolon değişti" diye SAYMIYORUZ.
-- Beyan kolonlarını JSON'dan ÇIKARIP geri kalanın aynı olup olmadığına
-- bakıyoruz. Böylece yarın `stock_item`a eklenen HER YENİ KOLON
-- kendiliğinden korunan tarafta kalır — kolon listesi bayatlamaz.
create or replace function app.stok_karti_izni()
returns trigger
language plpgsql
set search_path = public, app
as $$
declare
  -- `updated_at` beyanla birlikte değişir; korunan sayılmaz.
  v_beyan constant text[] := array[
    'net_qty', 'net_uom',
    'allergen_reviewed_at', 'allergen_reviewed_by',
    'updated_at'
  ];
begin
  if app.bakim_baglami() then
    return coalesce(new, old);
  end if;

  -- Depo işi: kart açma, ad/kategori/min miktar değiştirme.
  if app.yetkim_var('stock.write') then
    return coalesce(new, old);
  end if;

  -- Kalite işi: YALNIZ beyan kolonları değiştiyse `quality.declaration`
  -- yeter. Yeni kart AÇAMAZ — kart açmak depo işidir.
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
  'Stok karti kapisi. `stock.write` her seyi acar. `quality.declaration` '
  'YALNIZ beyan kolonlarini (ambalaj, alerjen onayi) acar. Kolon listesi '
  'yerine JSON farki kullaniliyor: yeni kolonlar kendiliginden korunur.';

drop trigger if exists izin_stock_item on public.stock_item;
create trigger izin_stock_item
  before insert or update on public.stock_item
  for each row execute function app.stok_karti_izni();


-- ── 2 · LOT · AKIŞIN İZNİNİ KABUL EDEN KAPI ───────────────────────────────
-- Lot üç yerde açılıyor: mal kabul (purchase.write), üretim çıkışı
-- (production.write), depo işlemleri (stock.write). Sevk iadesi de lot
-- açabiliyor (logistics.write). Dördünden biri yeterli.
--
-- ⚠️ Bu kapı stok defteri kapısından DAHA GENİŞ olmak zorunda: defter
-- `reason` sütununu görüyor, lot tablosu görmüyor. Daha dar yazmak, mal
-- kabulü yarıda bırakır — hareket geçer, lot düşer.
create or replace function app.lot_izni()
returns trigger
language plpgsql
set search_path = public, app
as $$
declare
  v_izinler constant text[] := array[
    'stock.write', 'purchase.write', 'production.write', 'logistics.write'
  ];
  v_izin text;
begin
  if app.bakim_baglami() then
    return coalesce(new, old);
  end if;

  foreach v_izin in array v_izinler loop
    if app.yetkim_var(v_izin) then
      return coalesce(new, old);
    end if;
  end loop;

  raise exception
    'Lot kaydi icin su izinlerden biri gerekiyor: %. Hesabinizda yok.',
    array_to_string(v_izinler, ', ')
    using errcode = 'MI403';
end $$;

comment on function app.lot_izni() is
  'Lot ve secere kapisi. Lot; mal kabul, uretim, sevk ve depo islemlerinde '
  'aciliyor. Tek izne baglamak mal kabulu YARIDA birakirdi (0086).';

drop trigger if exists izin_stock_lot on public.stock_lot;
create trigger izin_stock_lot
  before insert or update on public.stock_lot
  for each row execute function app.lot_izni();

drop trigger if exists izin_lot_genealogy on public.lot_genealogy;
create trigger izin_lot_genealogy
  before insert or update on public.lot_genealogy
  for each row execute function app.lot_izni();


-- ── 3 · KAPILAR (tuzak 67) ────────────────────────────────────────────────
revoke all on function app.stok_karti_izni() from public;
revoke all on function app.stok_karti_izni() from anon;
revoke all on function app.lot_izni()        from public;
revoke all on function app.lot_izni()        from anon;


-- ── 4 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare
  v_ad   text;
  v_rol  text;
begin
  -- Tetikler yerinde mi
  foreach v_ad in array array['izin_stock_item','izin_stock_lot','izin_lot_genealogy'] loop
    if not exists (select 1 from pg_trigger t where t.tgname = v_ad and not t.tgisinternal) then
      raise exception '0086: % tetigi yok.', v_ad;
    end if;
  end loop;

  -- 0081'in ambalaj tetigi HALA yerinde olmali: iki tetik birlikte calisiyor
  if not exists (
    select 1 from pg_trigger t
     where t.tgname = 'izin_stock_item_ambalaj' and not t.tgisinternal
  ) then
    raise exception '0086: 0081 ambalaj tetigi kayboldu.';
  end if;

  -- ⚠️ KIRIĞIN SEBEBİ BURADA SABİTLENİYOR: kalite rollerinde `stock.write`
  -- OLMAMALI. Biri "kolay çözüm" diye onlara stok yetkisi verirse, kalite
  -- sorumlusu depo kartı açabilir hale gelir ve bu kapı anlamsizlasir.
  foreach v_rol in array array['kalite_sorumlusu','gida_muhendisi'] loop
    if exists (
      select 1 from role_permission
       where role_code = v_rol and permission_code = 'stock.write'
    ) then
      raise exception
        '0086: % rolune stock.write verilmis. Beyan kapisinin anlami kalmaz; '
        'dogru cozum beyani ayri yetkilendirmektir.', v_rol;
    end if;
    if not exists (
      select 1 from role_permission
       where role_code = v_rol and permission_code = 'quality.declaration'
    ) then
      raise exception '0086: % rolunde quality.declaration yok.', v_rol;
    end if;
  end loop;

  -- Satin almaci lot acabilmeli: izin kumesinde purchase.write olmali
  if not exists (
    select 1 from role_permission
     where role_code = 'satinalma_sorumlusu' and permission_code = 'purchase.write'
  ) then
    raise exception '0086: satinalma_sorumlusu purchase.write kaybetmis.';
  end if;

  -- PUBLIC kapisi (tuzak 67 + 80)
  foreach v_ad in array array['app.stok_karti_izni()','app.lot_izni()'] loop
    if exists (
      select 1 from pg_proc p,
        lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
       where p.oid = to_regprocedure(v_ad)
         and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception '0086: % uzerinde PUBLIC EXECUTE acik.', v_ad;
    end if;
  end loop;

  raise notice '0086 tamam: kalite beyani ve lotlu mal kabulu geri acildi.';
end $$;
