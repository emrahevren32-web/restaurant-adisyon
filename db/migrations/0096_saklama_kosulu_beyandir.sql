-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0096 — SAKLAMA KOŞULU BİR BEYANDIR, KALİTE DE YAZABİLİR
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- 0093 saklama koşulunu ürün kartına taşıdı (`stock_item.storage_condition`),
-- 0094 açık raf ömrünü ekledi (`opened_shelf_life_days`). İkisi de şahit
-- numunenin ZORUNLU girdisi: koşulu yazılmayan üründen numune alınamıyor.
--
-- Ama kartın yazma kapısı (`app.stok_karti_izni`, 0085/0072) bu iki alanı
-- "sıradan kart alanı" sayıyor ve `stock.write` istiyor. `stock.write` şu
-- rollerde var: depo sorumlusu, üretim sorumlusu, işletme müdürü, işletme
-- sahibi. ŞU ROLLERDE YOK: **kalite sorumlusu ve gıda mühendisi.**
--
-- Yani ortaya şu çıkıyordu: şahit numunenin kuralını kalite departmanı
-- uyguluyor, o kuralın girdisini kalite departmanı YAZAMIYOR. Numune
-- alınamadığında gidip depocuya "şu koşulu yazar mısın" demesi gerekiyordu.
--
-- ── NEDEN `quality.declaration` DOĞRU İZİN ───────────────────────────────
-- Saklama koşulu bir stok özelliği değil, MÜŞTERİYE YAPILAN BİR BEYANDIR.
-- Emrah'ın kuralı: *"Müşteriye saklaması gereken koşullar söylenir ve
-- satılan ürün aynı şartlarda bizde de saklanır."* Etikete basılan, müşteriye
-- söylenen ve numunenin uymak zorunda olduğu şey aynı cümle.
--
-- Alerjen beyanı 0072/0073'te tam bu sebeple `quality.declaration` iznine
-- bağlanmıştı ve kapı o alanlar için zaten "yalnız beyan alanları
-- değiştiyse yeter" diyor. Bu göç o listeye iki alan daha ekliyor.
--
-- ⚠️ `stock.write` KALDIRILMIYOR. Depocu ve üretim de yazmaya devam ediyor;
-- tek değişiklik kalite tarafının ARTIK YAZABİLMESİ. Birine izin vermek için
-- diğerinden almak, çalışan bir akışı bozmak olurdu.
--
-- ⚠️ Listeye alan eklemek, `quality.declaration` taşıyan birinin o alanları
-- değiştirebilmesi demek — kartın GERİ KALANINI değil. Kapı
-- `(to_jsonb(new) - v_beyan) = (to_jsonb(old) - v_beyan)` ile ölçüyor:
-- başka tek bir alan bile değiştiyse `stock.write` şartı geri geliyor.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.stok_karti_izni()
returns trigger
language plpgsql set search_path = public, app
as $$
declare
  -- ⚠️ YALNIZ BU ALANLAR DEĞİŞTİYSE `quality.declaration` yeter.
  -- `updated_at` listede olmak ZORUNDA: `app.touch_updated_at()` her
  -- güncellemede onu değiştiriyor, listede olmasaydı beyan yolu hiçbir
  -- zaman çalışmazdı.
  v_beyan constant text[] := array[
    'net_qty', 'net_uom',
    'allergen_reviewed_at', 'allergen_reviewed_by',
    -- ── 0096 · ŞAHİT NUMUNENİN GİRDİLERİ ──────────────────────────────
    -- Saklama koşulu müşteriye yapılan beyandır (0093); açık raf ömrü de
    -- aynı beyanın parçası (0094). Kalite sorumlusu ve gıda mühendisi
    -- bunları yazamazsa numune kuralını uygulayamazlar.
    'storage_condition', 'opened_shelf_life_days',
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
    '(net miktar, alerjen damgasi, saklama kosulu, acik raf omru) '
    'degistiriyorsaniz `quality.declaration` de yeter; hesabinizda ikisi de yok.'
    using errcode = 'MI403';
end $$;


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare v_govde text;
begin
  select pg_get_functiondef(p.oid) into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'stok_karti_izni';
  if v_govde is null then
    raise exception '0096: app.stok_karti_izni bulunamadı.';
  end if;

  -- Yeni iki alan beyan listesinde mi?
  if v_govde !~ 'storage_condition' or v_govde !~ 'opened_shelf_life_days' then
    raise exception '0096: saklama koşulu ve açık raf ömrü beyan listesine girmedi.';
  end if;

  -- ⚠️ ESKİ ALANLAR KAYBOLMADI MI? Fonksiyon gövdesi komple değiştiği için
  -- bir alanı düşürmek sessizce alerjen beyanını kırardı.
  if v_govde !~ 'net_qty' or v_govde !~ 'net_uom'
     or v_govde !~ 'allergen_reviewed_at' or v_govde !~ 'allergen_reviewed_by'
     or v_govde !~ 'updated_at' then
    raise exception '0096: eski beyan alanlarından biri listeden düştü.';
  end if;

  -- ⚠️ `stock.write` yolu duruyor mu? Kaldırmak depocuyu kilitlerdi.
  if v_govde !~ 'yetkim_var\(''stock\.write''\)' then
    raise exception '0096: stock.write yolu kaybolmuş.';
  end if;

  -- ⚠️ MIYOP-035 koruması duruyor mu?
  if v_govde !~ 'MI436' then
    raise exception '0096: yeni kartın damgayla doğma koruması kaybolmuş.';
  end if;

  -- Tetik hâlâ bağlı mı?
  if not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                  where c.relname = 'stock_item' and g.tgname = 'izin_stock_item'
                    and not g.tgisinternal) then
    raise exception '0096: izin_stock_item tetiği bağlı değil.';
  end if;

  raise notice '0096: Saklama koşulu ve açık raf ömrü beyan alanı sayılıyor.';
end $$;
