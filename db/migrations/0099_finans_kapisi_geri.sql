-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0099 — 0095 FİNANS KAPISINI YOK ETMİŞ, GERİ KONUYOR
--
-- ── NE OLDU · P0, BENİM HATAM (MIYOP-078 · Codex, 27.10) ─────────────────
-- 0065 `app.isletme_gostergeleri` fonksiyonunu yazdı. **0071 onu İKİYE
-- AYIRDI:**
--   · `app.isletme_gostergeleri_ham` → ham hesap (iç fonksiyon)
--   · `app.isletme_gostergeleri`     → `finance.read` İZİN KAPISI, _ham'ı sarar
--
-- 0095'i yazarken gövdeyi **0065'ten** kopyaladım ve `isletme_gostergeleri`
-- adına yazdım. Yani 0071'in izin kapısını ham hesapla EZDİM.
--
-- ⚠️ SONUÇ: `finance.read` izni OLMAYAN bir kullanıcı — depo sorumlusu,
-- üretim sorumlusu, kalite sorumlusu, gıda mühendisi — kendi kiracısının
-- fire tutarını, alış maliyetini ve stok maliyeti göstergelerini doğrudan
-- RPC'den okuyabiliyordu. Ekran kapısı duruyordu ama kapı ekranda değil
-- veritabanında olmalıydı ve orada artık yoktu.
--
-- ⚠️ **KENDİ DOĞRULAMAM BU HATAYI GİZLEDİ.** 0095 şunu ölçüyordu:
-- *"`isletme_gostergeleri` gövdesinde `stock_usable_balance` geçiyor mu?"*
-- Ham gövdeyi oraya yazdığım için ÖLÇÜM GEÇTİ. Doğru yere (`_ham`) yazsaydım
-- kendi doğrulamam KIRMIZI verecekti. Yani doğrulama, yanlış fonksiyonu
-- ölçüyordu (tuzak 127).
--
-- ⚠️ Provam da yakalayamadı: `prova-0095.sql` göstergeleri `isletme_sahibi`
-- oturumunda çağırıyordu ve onda `finance.read` VAR. Kapının kalkması o
-- oturumda hiçbir fark yaratmıyordu — **olumsuz kontrol yoktu.**
--
-- ── BU GÖÇ NE YAPIYOR ────────────────────────────────────────────────────
-- 1. Düzeltilmiş kritik stok hesabını DOĞRU YERE, `_ham` fonksiyonuna yazar.
-- 2. `app.isletme_gostergeleri` fonksiyonunu 0071'deki hâline — izin
--    kapısına — geri döndürür.
-- 3. Kapının gerçekten orada olduğunu, `security definer` OLMADIĞINI ve
--    ham hesabın doğru fonksiyonda olduğunu ölçer.
--
-- ⚠️ `fire_dokumu` kapısına DOKUNULMADI: 0095 onu hiç yazmamıştı.
-- ⚠️ 27.10 · ÖNCE BU GÖÇ onun durumunu da SINIYORDU ve canlıda patladı —
-- böylece P0 onarımını rehin aldı (Supabase tek işlem). Kontrol kaldırıldı;
-- `fire_dokumu` ayrı bir soru ve `araclar/teshis-fire-dokumu.sql` ile
-- ölçülüyor. Bir onarım göçü, onarımla ilgisi olmayan bir kontrol yüzünden
-- durmamalı (tuzak 129).
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · DÜZELTİLMİŞ HESAP DOĞRU YERE ─────────────────────────────────────
-- ⚠️ Gövde 0095'in aynısı; tek fark ADI. Kritik kalem bloğu
-- `stock_usable_balance` okuyor ve eşiği `<=` ile karşılaştırıyor
-- (MIYOP-074 · bkz. 0095 başlığı).
create or replace function app.isletme_gostergeleri_ham(
  p_sube uuid,
  p_bas  date,
  p_bit  date
)
returns table (
  anahtar text,
  deger   numeric,
  ek      numeric
)
language sql
stable
set search_path = public, app, pg_temp
as $$
with
-- İptal edilmiş hareketler: ters kayıt + ters çevirdiği, ikisi birden.
iptal as (
  select m.id from public.stock_movement m where m.reason = 'REVERSAL'
  union
  select m.reverses_movement_id from public.stock_movement m
   where m.reason = 'REVERSAL' and m.reverses_movement_id is not null
),
-- Dönem içi hareketler, iptal edilmişler ayıklanmış.
donem as (
  select m.*
    from public.stock_movement m
   where m.branch_id = p_sube
     and m.occurred_at >= p_bas::timestamptz
     and m.occurred_at <  (p_bit + 1)::timestamptz
     and m.id not in (select id from iptal)
),
fire as (
  select d.*,
         app.kalem_alis_fiyati(d.stock_item_id, d.occurred_at) as birim_fiyat
    from donem d
   where d.reason = any(app.fire_nedenleri())
     and d.quantity_base < 0
),
-- Bugün elde duran partiler. ⚠️ Bakiyesi SIFIR ya da EKSİ olan parti
-- "elde" değildir; SKT'si geçmiş ama tükenmiş bir parti riski değildir.
parti as (
  select b.lot_id, b.stock_item_id, b.qty, l.expires_on,
         app.kalem_alis_fiyati(b.stock_item_id, now()) as birim_fiyat
    from public.stock_lot_balance b
    join public.stock_lot l on l.id = b.lot_id
   where b.branch_id = p_sube
     and b.qty > 0
     and l.expires_on is not null
),
siparis as (
  select s.* from public.sales_order s
   where s.order_date >= p_bas and s.order_date <= p_bit
)

-- ── PARA ──────────────────────────────────────────────────────────────────
select 'fire_tutari',
       coalesce(sum(abs(f.quantity_base) * f.birim_fiyat), 0),
       null::numeric
  from fire f
union all
-- ⚠️ DÜRÜSTLÜK GÖSTERGESİ. Fiyatı bulunamayan fire hareketi varsa yukarıdaki
-- tutar EKSİKTİR ve ekran bunu yazmak zorunda. Sessizce düşük bir rakam
-- göstermek, hiç göstermemekten kötüdür.
select 'fire_fiyatsiz_hareket', count(*)::numeric, null
  from fire f where f.birim_fiyat is null
union all
select 'fire_kalem_sayisi', count(distinct f.stock_item_id)::numeric, null
  from fire f
union all
select 'alim_tutari',
       coalesce(sum(d.quantity_base * app.kalem_alis_fiyati(d.stock_item_id, d.occurred_at)), 0),
       null
  from donem d where d.reason = 'PURCHASE_RECEIPT' and d.quantity_base > 0

-- ── BUGÜNÜN RİSKİ ─────────────────────────────────────────────────────────
union all
select 'skt_gecmis_deger',
       coalesce(sum(p.qty * p.birim_fiyat), 0),
       count(*)::numeric
  from parti p where p.expires_on < current_date
union all
select 'skt_yaklasan_deger',
       coalesce(sum(p.qty * p.birim_fiyat), 0),
       count(*)::numeric
  from parti p
 where p.expires_on >= current_date
   and p.expires_on <= current_date + 30
union all
-- ⚠️ Negatif bakiye bir DEFTER TUTARSIZLIĞI işaretidir: olmayan maldan
-- çıkış yazılmış. Rapor bunu saklamaz; sayının kendisi bir uyarıdır.
select 'negatif_bakiyeli_kalem', count(*)::numeric, null
  from public.stock_balance b where b.branch_id = p_sube and b.qty < 0
union all
-- ⚠️ MIYOP-074 · BURADA `stock_balance` (FİZİKSEL bakiye) ve `<` YAZIYORDU.
-- İki ayrı fark, ikisi de Analiz ekranındaki sayıyı Depo ekranındakinden
-- AYIRIYORDU:
--   1. Fiziksel bakiye, süresi geçmiş malı da sayıyordu. Depo ekranı
--      (`warehouse.service.ts`) kritik kararını KULLANILABİLİR bakiyeden
--      veriyor; süresi geçmiş mal sipariş ihtiyacını karşılamaz.
--   2. `<` ile `<=` farkı: minimum miktara TAM OLARAK inmiş kalem Depo
--      ekranında kritik, Analiz'de değildi.
-- Aynı soruya iki ekranın iki ayrı cevap vermesi, ikisine de güveni bitirir.
select 'kritik_kalem', count(*)::numeric, null
  from public.stock_item i
  left join public.stock_usable_balance b
         on b.stock_item_id = i.id and b.branch_id = p_sube
 where i.branch_id = p_sube
   and i.is_active
   and i.min_qty > 0
   and coalesce(b.usable_qty, 0) <= i.min_qty

-- ── MÜŞTERİ ───────────────────────────────────────────────────────────────
union all
select 'siparis_sayisi', count(*)::numeric, null from siparis
union all
select 'iptal_siparis', count(*)::numeric, null
  from siparis s where s.status = 'İptal'
union all
-- ⚠️ "Geciken" = teslim tarihi GEÇMİŞ ve hâlâ teslim edilmemiş. İptal
-- edilenler sayılmaz: iptal bir gecikme değildir.
select 'geciken_siparis', count(*)::numeric, null
  from public.sales_order s
 where s.requested_delivery_date is not null
   and s.requested_delivery_date < current_date
   and s.status not in ('Teslim Edildi', 'İptal')
union all
select 'onay_bekleyen_siparis', count(*)::numeric, null
  from public.sales_order s where s.status = 'Onay Bekliyor'
union all
-- Teslimde fark kaydı açılmış sipariş sayısı: "ne istendi, ne gitti"
-- tartışmasının kaç kez yaşandığı.
select 'farkli_teslim_siparis', count(distinct g.order_id)::numeric, null
  from public.order_discrepancy g
  join siparis s on s.id = g.order_id
$$;

-- ── 2 · İZİN KAPISI GERİ ─────────────────────────────────────────────────
-- ⚠️ 0071'in metninin AYNISI, bilerek. Yeniden yazmak, kapının ifadesini
-- ikinci kez türetmek olurdu.
--
-- ⚠️ Kapı `security definer` OLMAMALI: definer olsaydı izin kontrolünü
-- geçen bir çağrı RLS'i de aşar ve BÜTÜN kiracıları okurdu. 0071 bunu
-- yazmıştı, doğrulama aşağıda tekrarlıyor.
create or replace function app.isletme_gostergeleri(
  p_sube uuid, p_bas date, p_bit date
)
returns table (anahtar text, deger numeric, ek numeric)
language plpgsql
stable
set search_path = public, app, pg_temp
as $$
begin
  -- ⚠️ HATA MESAJI NE OLDUĞUNU SÖYLÜYOR. "Yetkiniz yok" diyen ama hangi
  -- yetki olduğunu söylemeyen bir mesaj, kullanıcıyı da yöneticiyi de
  -- çaresiz bırakır.
  if not app.yetkim_var('finance.read') then
    raise exception 'Bu rapor maliyet bilgisi içeriyor; `finance.read` izni '
      'gerekiyor. İşletme sahibi, müdür, muhasebe ve satın alma görebilir.'
      using errcode = 'MI403';
  end if;

  return query select * from app.isletme_gostergeleri_ham(p_sube, p_bas, p_bit);
end;
$$;


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare v_kapi text; v_ham text; v_fire text;
begin
  select pg_get_functiondef(p.oid) into v_kapi
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'isletme_gostergeleri';
  select pg_get_functiondef(p.oid) into v_ham
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'isletme_gostergeleri_ham';
  select pg_get_functiondef(p.oid) into v_fire
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'fire_dokumu';

  if v_kapi is null or v_ham is null or v_fire is null then
    raise exception '0099: gösterge fonksiyonlarından biri yok.';
  end if;

  -- ⚠️ ASIL ÖLÇÜM: kapı GERİ GELDİ Mİ?
  if v_kapi !~ 'finance\.read' then
    raise exception
      '0099: app.isletme_gostergeleri finans izni sormuyor (MIYOP-078 açık).';
  end if;
  if v_kapi !~ 'isletme_gostergeleri_ham' then
    raise exception '0099: kapı ham hesabı çağırmıyor.';
  end if;
  -- ⚠️ Kapının içinde HAM HESAP OLMAMALI. Bu, 078'in geri gelmesinin tam
  -- imzası: hesap kapının içine yazılmışsa kapı yeniden ezilmiş demektir.
  if v_kapi ~ 'stock_usable_balance' or v_kapi ~ 'stock_movement' then
    raise exception
      '0099: ham hesap yine İZİN KAPISININ içine yazılmış (MIYOP-078 tekrarı).';
  end if;

  -- ⚠️ `security definer` olmamalı — yoksa RLS de aşılır.
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'app'
                and p.proname in ('isletme_gostergeleri','fire_dokumu')
                and p.prosecdef) then
    raise exception '0099: gösterge kapısı security definer; RLS aşılabilir.';
  end if;

  -- ⚠️ DÜZELTME DOĞRU YERDE Mİ? (MIYOP-074)
  if v_ham !~ 'stock_usable_balance' then
    raise exception '0099: kullanılabilir bakiye düzeltmesi _ham''a yazılmamış.';
  end if;
  if v_ham !~ 'usable_qty, 0\) <= i\.min_qty' then
    raise exception '0099: kritik eşiği _ham''da <= değil.';
  end if;

  -- ⚠️ 27.10 · BURADA `fire_dokumu` KAPISI DA SINANIYOR VE `raise exception`
  -- İLE PATLIYORDU. Canlıda patladı ve **P0 ONARIMINI REHİN ALDI**: Supabase
  -- bütün betiği tek işlemde çalıştırdığı için, bu ikincil kontrol
  -- başarısız olunca yukarıdaki kapı onarımı da GERİ ALINDI. Yani fazladan
  -- koyduğum bir kontrol yüzünden açık kapalı kalmadı (tuzak 129).
  --
  -- Kontrol kaldırıldı. `fire_dokumu` AYRI bir sorudur ve ayrı ölçülür:
  -- `araclar/teshis-fire-dokumu.sql` bir TABLO döndürüyor (Supabase NOTICE
  -- göstermiyor, sonuç tablosu gösteriyor). Onarım göçünün işi onarmaktır;
  -- başka bir derdi teşhis etmek değil.
  --
  -- ⚠️ `v_fire` yine okunuyor ama YALNIZ fonksiyonun var olduğunu
  -- doğrulamak için (yukarıdaki null kontrolü). Durumu bu göç yargılamıyor.

  raise notice '0099: Finans kapısı geri kondu; düzeltilmiş hesap _ham''da.';
end $$;


-- ── 3 · PANODAN GELEN METİN BOZULMAMIŞ MI (MIYOP-079) ────────────────────
-- ⚠️ Codex, Codex'e YAPIŞTIRILAN metinde `İ/ı` karakterlerinin bozulduğunu
-- gördü (`Ä°`/`Ä±`). Depo dosyası doğru UTF-8 ve yerel provada doğru
-- çalışıyor — ama CANLIYA pano üzerinden gitti ve pano yolu metni
-- bozabilir. "Dosya doğru" demek "canlıdaki fonksiyon doğru" demek değildir.
--
-- Bu blok CANLIDA ölçüyor: dört i varyantı tek harfe katlanıyor mu?
-- Bozulmuş bir fonksiyon burada patlar.
do $$
begin
  if app.kimlik_anahtari('İSTANBUL') <> app.kimlik_anahtari('istanbul') then
    raise exception
      '0099: kimlik anahtarı dört i varyantını katlamıyor — 0094 metni pano '
      'yolunda bozulmuş olabilir (MIYOP-079). Gelen: % / %',
      app.kimlik_anahtari('İSTANBUL'), app.kimlik_anahtari('istanbul');
  end if;
  if app.kimlik_anahtari('ıI') <> 'II' or app.kimlik_anahtari('İi') <> 'II' then
    raise exception '0099: kimlik anahtarı ı/İ çevirisi bozuk.';
  end if;
  if app.kimlik_anahtari(' n-1 ') <> 'N-1' then
    raise exception '0099: kimlik anahtarı boşluk kırpmıyor.';
  end if;
  raise notice '0099: Kimlik anahtarı canlıda doğru (dört i varyantı katlanıyor).';
end $$;
