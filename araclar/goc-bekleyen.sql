-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · BEKLEYEN GÖÇ · 0115 + 0116 · 12.11.2026
--
-- ⚠️ BU DOSYA SUPABASE'E YAPIŞTIRILACAK. Canlı veritabanı **göç 0114'te**;
-- aşağıdaki iki göç henüz UYGULANMADI. İkisi de Codex 4. tur bulgusu.
--
-- 0115 · NUMUNE METİNLERİ (MIYOP-105'in eksik kalan yarısı)
--   Ekran gerekçeyi `trim()` ile, veritabanı `btrim()` ile ölçüyordu.
--   `btrim` yalnız boşluğu kırpar: üç sekme ya da üç satır sonu ekranda BOŞ,
--   veritabanında ÜÇ KARAKTER sayılıyordu. Üç kısıt artık ekranla AYNI
--   kümeyi kırpıyor. Eşikler DEĞİŞMEDİ (kod 2, gerekçe 3, sonuç 3).
--   ⚠️ Göç önce desenin BU SUNUCUDA çalıştığını ölçüyor (25 karakter tek
--   tek), sonra eski kayıtları ölçüyor. İkisinden biri tutmazsa kısıtlara
--   DOKUNMADAN durur ve sebebini söyler.
--
-- 0116 · GERİ ARAMA (MIYOP-109)
--   Aynı numaranın bekleyen başka bir talebi varken "Tekrar beklemeye al"
--   ekrana ham veritabanı hatası (indeks adı) çıkarıyordu. Artık anlaşılır
--   bir cümle ve öteki talebin numarası çıkıyor; kayıt ve not değişmiyor.
--   Fonksiyonun imzası aynı kaldı, yetkiler korunuyor.
--
-- ⚠️ EKRAN TARAFI DA YÜKLENECEK (`miyop-yukle.ps1`): şahit numune ekranı
-- metni artık aynı sözleşmeyle sayıyor. Yüklenmezse ekran ile veritabanı
-- yalnız TEK bir uç durumda ayrışır (tek emoji ile yazılmış numune kodu:
-- ekran kabul eder, veritabanı reddeder). Kimsenin verisi bozulmaz.
--
-- ⚠️ SON TABLO ÜÇ ŞEYİ BİRDEN GÖSTERİR ve hepsi `tamam` yazmalı:
-- 0115 kısıtları · 0116 fonksiyonu · mevzuat fonksiyon sayısı (Codex'in
-- "canlıda artakalan eski imza var mı" sorusu — salt okunur ölçüm).
--
-- ⚠️ BU DOSYADA GÖRÜNMEZ KARAKTER YOK ve olmamalı: 0115'in deseni `\uXXXX`
-- kaçışlarıyla yazılı. Panodan yapıştırılırken bozulmaması için.
--
-- ⚠️ Bu dosyayı BOŞALTMAK, göçü uygulamanın SON adımıdır (kontrol
-- listesi 130). "Run" tuşuna basmak son adım değildir.
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0115 — NUMUNE METİNLERİ · BOŞLUK VE SAYMA SÖZLEŞMESİ
--               (MIYOP-105'in EKSİK KALAN yarısı · Codex 4. tur, 11.11.2026)
--
-- ── NE OLDU ──────────────────────────────────────────────────────────────
-- 0111 ekran ile veritabanının EŞİK SAYILARINI eşitledi (kod ≥ 2, gerekçe
-- ve açılış sonucu ≥ 3) ve "MIYOP-105 kapandı" dedim. Codex 4. turda
-- gösterdi ki yalnız SAYI eşitlenmiş, **sözleşme eşitlenmemiş**:
--
--     ekran       →  `metin.trim().length`
--     veritabanı  →  `length(btrim(metin))`
--
-- PostgreSQL'in `btrim`i varsayılan olarak YALNIZ BOŞLUK karakterini
-- (U+0020) kırpar. JavaScript'in `trim`i ise sekme, satır sonu ve bütün
-- Unicode boşluklarını kırpar. Yani:
--
--     reason = E'\t\t\t'   →  ekranda BOŞ, veritabanında 3 KARAKTER
--     result = E'\n\n\n'   →  ekranda BOŞ, veritabanında 3 KARAKTER
--
-- ⚠️ ÖLÇÜLDÜ (11.11, PostgreSQL 16):
--     select length(btrim(E'\t\t\t')), length(btrim(E'\n\n\n')), length(btrim('   '));
--     →  3 | 3 | 0
-- API'den yazan biri gerekçe yerine üç sekme koyup geçebiliyordu. 0111'in
-- kapattığını söylediğim delik, başka bir karakterle açık duruyordu.
--
-- ⚠️ İKİNCİ AYRIŞMA TERS YÖNDE: ekran `.length` ile UTF-16 BİRİMİ sayıyor,
-- veritabanı `length()` ile KOD NOKTASI. Tek bir emoji ekranda 2, veritabanında
-- 1 karakterdir: ekranın "yeterli" dediği bir metni veritabanı reddedebilirdi.
-- Bu bir delik değil ama aynı sınıftan: iki katman aynı soruya iki cevap
-- veriyordu.
--
-- ── SÖZLEŞME · TEK TANIM, İKİ KATMAN ─────────────────────────────────────
--   KIRPMA: metnin başındaki ve sonundaki şu karakterler atılır —
--     U+0009–U+000D (sekme, satır sonu, dikey sekme, sayfa, satır başı)
--     U+0020 · U+00A0 · U+1680 · U+2000–U+200A · U+2028 · U+2029
--     U+202F · U+205F · U+3000 · U+FEFF
--   Bu, JavaScript `String.prototype.trim` kümesinin AYNISI.
--   SAYMA: kalan metnin KOD NOKTASI sayısı.
--
-- Ekran tarafı aynı deseni AYNI METİNLE taşıyor
-- (`witness-sample.service.ts` → `KIRPILAN_BOSLUKLAR`) ve
-- `numune-kapisi.arch.test.ts` o metni bu dosyadaki kısıt tanımlarında
-- ARIYOR. Küme elle iki yere yazılmıyor; biri değişirse test kırmızı yanar.
--
-- ⚠️ SINIRI DA YAZILI: sıfır genişlikli karakterler (U+200B gibi) boşluk
-- SAYILMIYOR — JavaScript de saymıyor. Sözleşme "iki katman aynı cevabı
-- verir"dir; "anlamsız metin yazılamaz" DEĞİLDİR. Üç sıfır genişlikli
-- karakter iki katmandan da geçer. Bunu kapatmak ayrı bir karardır.
--
-- ⚠️ DESEN BU DOSYADA YALNIZ ASCII KAÇIŞLARIYLA DURUYOR (`\u00A0` gibi).
-- İlk yazımda karakterlerin KENDİSİ dosyaya girmişti (12.11): gözle
-- görünmüyor, ama U+2028'i SQL editörü satır sonuna çevirebilir, panodan
-- geçerken U+FEFF düşebilirdi — kısıt sessizce başka bir küme taşırdı.
-- Göç panodan yapıştırılarak çalıştırıldığı için bu dosyada ve
-- `araclar/goc-bekleyen.sql`de görünmez karakter OLMAMALI; mimari test
-- bunu da ölçüyor.
--
-- ── NEDEN FONKSİYON DEĞİL, KISITIN İÇİNDE AÇIK DESEN ─────────────────────
-- Bir `app.*` yardımcı fonksiyon yazmak deseni tek yere indirirdi. Ama
-- kısıtın içindeki fonksiyon, YAZAN ROLÜN yetkisiyle çalışır: `authenticated`
-- rolüne EXECUTE vermek gerekirdi ve bu depoda `app` şemasının PUBLIC/
-- authenticated yüzeyi bilerek dar tutuluyor (tuzak 67, MIYOP-044). Yeni bir
-- yüzey açmak yerine desen üç kısıtta AÇIK yazıldı; aynılığını mimari test
-- ölçüyor.
--
-- ⚠️ ESKİ KAYITLAR ÖNCE ÖLÇÜLÜYOR (0111'in kuralı): yeni sözleşmeyi
-- karşılamayan satır varsa kısıt DEĞİŞTİRİLMİYOR ve sayısı söyleniyor.
-- Olay defteri değişmez; geçmişe uydurma düzeltme yazılmaz.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · BU SUNUCU DESENİ ANLIYOR MU ──────────────────────────────────────
-- ⚠️ Desen `\uXXXX` kaçışları kullanıyor. Bunları düzenli ifade motoru
-- yorumluyor; farklı bir sürümde ya da `standard_conforming_strings`
-- kapalıyken sessizce HİÇBİR ŞEY kırpmayan bir desene dönüşebilirdi.
-- Kısıtı kurmadan önce desenin BU sunucuda çalıştığı ölçülüyor.
do $$
declare
  v_desen constant text :=
    '^[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+|[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+$';
  v_kod int;
begin
  -- ⚠️ KÜMENİN HER ÜYESİ AYRI ÖLÇÜLÜYOR. "Sekme ve satır sonu çalışıyor"
  -- demek, U+3000'in de çalıştığını göstermez; bir aralık yanlış yazılmışsa
  -- yalnız o üye sessizce dışarıda kalırdı.
  foreach v_kod in array array[
    9, 10, 11, 12, 13, 32, 160, 5760,
    8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202,
    8232, 8233, 8239, 8287, 12288, 65279
  ] loop
    if length(regexp_replace(repeat(chr(v_kod), 3), v_desen, '', 'g')) <> 0 then
      raise exception
        '0115: kirpma deseni BU SUNUCUDA U+% karakterini kirpmiyor. '
        'Kisitlar DEGISTIRILMEDI.', upper(to_hex(v_kod));
    end if;
  end loop;

  -- ⚠️ TERSİ DE ÖLÇÜLÜYOR: her şeyi silen bir desen yukarıdaki döngüden
  -- geçerdi. İçteki boşluk kalmalı, harf kalmalı, sıfır genişlikli
  -- karakter (U+200B · JavaScript de kırpmıyor) kalmalı.
  if regexp_replace(E' \ta\tb\n ', v_desen, '', 'g') <> E'a\tb'
     or length(regexp_replace('abc', v_desen, '', 'g')) <> 3
     or length(regexp_replace(repeat(chr(8203), 3), v_desen, '', 'g')) <> 3 then
    raise exception
      '0115: kirpma deseni BU SUNUCUDA beklendigi gibi calismiyor '
      '(kirpmamasi gerekeni kirpiyor). Kisitlar DEGISTIRILMEDI.';
  end if;
  raise notice '0115: kirpma deseni bu sunucuda olculdu (25 karakter tek tek), calisiyor.';
end $$;


-- ── 1 · ÖNCE ESKİ KAYITLARI ÖLÇ ──────────────────────────────────────────
do $$
declare
  v_desen constant text :=
    '^[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+|[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+$';
  v_kod int; v_ger int; v_son int;
begin
  select count(*) into v_kod from public.witness_sample
   where length(regexp_replace(sample_code, v_desen, '', 'g')) < 2;
  select count(*) into v_ger from public.witness_sample_event
   where event_type <> 'ALINDI'
     and length(regexp_replace(coalesce(reason, ''), v_desen, '', 'g')) < 3;
  select count(*) into v_son from public.witness_sample_event
   where event_type = 'ACILDI'
     and length(regexp_replace(coalesce(result, ''), v_desen, '', 'g')) < 3;

  if v_kod > 0 or v_ger > 0 or v_son > 0 then
    raise exception
      '0115: eski kayitlar yeni sozlesmeyi karsilamiyor '
      '(kod: %, gerekce: %, sonuc: %). Kisitlar DEGISTIRILMEDI. '
      'Olay defteri degismez; bu kayitlar duzeltilemez. Bu durumda kural '
      'yalniz YENI kayitlara uygulanir (`not valid`) ve o karar YAZILARAK '
      'verilir.', v_kod, v_ger, v_son;
  end if;
  raise notice '0115: eski kayitlarda ihlal yok; kisitlar degistirilebilir.';
end $$;


-- ── 2 · NUMUNE KODU · EN AZ İKİ KARAKTER ─────────────────────────────────
alter table public.witness_sample
  drop constraint if exists witness_sample_code_not_blank;
alter table public.witness_sample
  add constraint witness_sample_code_not_blank check (
    length(regexp_replace(sample_code, '^[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+|[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+$', '', 'g')) >= 2
  );

comment on constraint witness_sample_code_not_blank on public.witness_sample is
  'Numune kodu en az iki karakter (0111). Kirpma ve sayma EKRANLA AYNI '
  'sozlesme (0115): JavaScript trim kumesi kirpilir, kod noktasi sayilir. '
  'Ekrandaki karsiligi: numuneKoduYeterliMi (witness-sample.service.ts).';


-- ── 3 · GEREKÇE · EN AZ ÜÇ KARAKTER ──────────────────────────────────────
-- ⚠️ `ALINDI` dışarıda: numune almanın gerekçesi yoktur.
alter table public.witness_sample_event
  drop constraint if exists witness_sample_event_reason_required;
alter table public.witness_sample_event
  add constraint witness_sample_event_reason_required check (
    event_type = 'ALINDI'
    or length(regexp_replace(coalesce(reason, ''), '^[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+|[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+$', '', 'g')) >= 3
  );

comment on constraint witness_sample_event_reason_required
  on public.witness_sample_event is
  'Acilis ve imha gerekce ister, en az uc karakter (0093 + 0111). Kirpma '
  've sayma EKRANLA AYNI sozlesme (0115). Uc sekme ya da uc satir sonu '
  'gerekce DEGILDIR.';


-- ── 4 · AÇILIŞ SONUCU · EN AZ ÜÇ KARAKTER ────────────────────────────────
alter table public.witness_sample_event
  drop constraint if exists witness_sample_event_result_required;
alter table public.witness_sample_event
  add constraint witness_sample_event_result_required check (
    event_type <> 'ACILDI'
    or length(regexp_replace(coalesce(result, ''), '^[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+|[\u0009-\u000D\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]+$', '', 'g')) >= 3
  );

comment on constraint witness_sample_event_result_required
  on public.witness_sample_event is
  'Acilis SONUC ister, en az uc karakter (0100 + 0111). Kirpma ve sayma '
  'EKRANLA AYNI sozlesme (0115).';


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
-- ⚠️ Kısıtın TANIMININ yürürlükte olduğu ölçülüyor. Kısıtların GERÇEKTEN
-- reddettiğini `db/prova/prova-0115.sql` canlı yazımla sınıyor; bu blok
-- onun yerine geçmez.
do $$
declare v_ad text;
begin
  foreach v_ad in array array[
    'witness_sample_code_not_blank',
    'witness_sample_event_reason_required',
    'witness_sample_event_result_required'
  ] loop
    if not exists (select 1 from pg_constraint
                    where conname = v_ad
                      and pg_get_constraintdef(oid) ~ 'regexp_replace') then
      raise exception '0115 DOGRULAMA: % yeni sozlesmeyi tasimiyor.', v_ad;
    end if;
    if exists (select 1 from pg_constraint
                where conname = v_ad
                  and pg_get_constraintdef(oid) ~ 'btrim') then
      raise exception '0115 DOGRULAMA: % hala btrim kullaniyor.', v_ad;
    end if;
  end loop;
  raise notice '0115 TAMAM · numune metinleri ekranla ayni sozlesmeyle olculuyor.';
end $$;


-- ── ÖZET ──────────────────────────────────────────────────────────────────
select 'sozlesme' as ne,
       'JavaScript trim kumesi kirpilir · kod noktasi sayilir' as deger
union all
select 'degisen kisit', '3 (numune kodu · gerekce · acilis sonucu)'
union all
select 'esikler', 'kod >= 2 · gerekce >= 3 · sonuc >= 3 (DEGISMEDI)'
union all
select 'numune sayisi', (select count(*)::text from public.witness_sample)
union all
select 'olay sayisi', (select count(*)::text from public.witness_sample_event)
union all
select 'dogrulama', 'gecti';


-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0116 — GERİ ARAMA · YENİDEN BEKLEMEYE ALMA ÇAKIŞMASI
--               (MIYOP-109 · Codex 4. tur, 11.11.2026)
--
-- ── NE OLDU ──────────────────────────────────────────────────────────────
-- 0110 "aynı telefonda tek açık talep" kuralını kısmi tekillik indeksiyle
-- (`callback_request_acik_talep_tekil`) zorladı ve başvuru yolunda
-- (`geri_arama_gonder`) indeks hatasını anlaşılır `MI409`a çevirdi.
-- Ama talebin durumunu değiştiren İKİNCİ yolu (`geri_arama_durumu_yaz`)
-- çevirmedi. Sonuç (Codex kaynaktan gösterdi, burada ölçüldü):
--
--   aynı numaranın eski bir CLOSED talebi + yeni bir NEW talebi varken
--   eski talepte "Tekrar beklemeye al" →
--   `duplicate key value violates unique constraint
--    "callback_request_acik_talep_tekil"`  (23505)
--
-- Veri KORUNUYORDU — indeks işini yapıyor. Bozuk olan şey cümleydi:
-- platform yöneticisi neden yeniden açamadığını ham indeks adından
-- okumak zorundaydı.
--
-- ⚠️ BU, 0110'DA YAZDIĞIM KONTROL LİSTESİ MADDESİNİN (147) İHLALİYDİ:
-- *"Yeni bir tekillik indeksi eklerken, yazma döngüsünün hangi yollardan
-- o indekse çarpabileceği sayılır."* INSERT yolunu saydım, UPDATE yolunu
-- saymadım. Brifte Codex'e sorduğum soru da tam buydu.
--
-- ── NE DEĞİŞİYOR ─────────────────────────────────────────────────────────
-- `app.geri_arama_durumu_yaz` yeniden yazılıyor — İMZA AYNI, o yüzden
-- `create or replace` yerinde değiştiriyor ve YETKİLER KORUNUYOR (düşürme
-- yok; tuzak 67 burada tetiklenmiyor, ama yetkiler yine de ölçülüyor).
--
--   1. ÖN KONTROL: talep yeniden NEW yapılıyorsa, telefon kilidi alınır
--      (0110'la aynı: 110 + telefon) ve o numaranın başka açık talebi
--      varsa `MI409` ile, **öteki talebin numarası söylenerek** durulur.
--   2. İKİNCİ KAT: UPDATE yine de indekse çarparsa aynı `MI409`a çevrilir —
--      ama yalnız O indeks için; başka bir tekillik bu cümleyle örtülmez.
--
-- ⚠️ ÇAKIŞMADA HİÇBİR ŞEY DEĞİŞMİYOR: ne durum, ne not defteri. Reddedilen
-- bir denemenin deftere "NEW" satırı düşürmesi, olmamış bir işi kayda
-- geçirmek olurdu.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · 0110 YÜRÜRLÜKTE Mİ ───────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_class where relname = 'callback_request_acik_talep_tekil') then
    raise exception '0116: GOC 0110 YURURLUKTE DEGIL (tekillik indeksi yok).';
  end if;
  raise notice '0116: 0110 yururlukte, olculdu. Devam.';
end $$;


-- ── 1 · DURUM YAZMA · çakışma anlaşılır cevap veriyor ────────────────────
create or replace function app.geri_arama_durumu_yaz(
  p_reference text,
  p_status    text,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_ben     uuid;
  v_ad      text;
  v_satir   public.callback_request;
  v_durum   text;
  v_not     text;
  v_satirim text;
  v_diger   text;
  v_kisit   text;
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Geri arama talebini yalnızca EVREN360 platform yöneticisi güncelleyebilir.'
      using errcode = 'MI403';
  end if;

  -- ⚠️ İMZAYI SUNUCU ATAR. "Kim aradı" istemciden gelmiyor; parametresi
  -- bile yok (0087'nin kuralı).
  v_ben := app.aktif_kullanici_id();
  if v_ben is null then
    raise exception 'Bu işlem için oturum gerekiyor.' using errcode = 'MI403';
  end if;
  select full_name into v_ad from public.app_user where id = v_ben;

  v_durum := upper(btrim(coalesce(p_status, '')));
  if v_durum not in ('NEW','CONTACTED','CLOSED') then
    raise exception 'Geçersiz durum: %', p_status using errcode = 'MI422';
  end if;

  select * into v_satir from public.callback_request where reference = btrim(p_reference);
  if not found then
    raise exception 'Geri arama talebi bulunamadı: %', p_reference using errcode = 'MI404';
  end if;

  v_not := nullif(btrim(coalesce(p_note, '')), '');

  -- Kapatmak bir karardır: gerekçesiz kapanış, kapanmamış bir talepten
  -- kötüdür — liste temiz görünür, yapılan iş kayıtsız kalır.
  if v_durum = 'CLOSED' and v_not is null then
    raise exception 'Talebi kapatırken kısa bir not yazın (ne oldu?).'
      using errcode = 'MI422';
  end if;

  -- ⚠️ YENİDEN BEKLEMEYE ALMA ÇAKIŞMASI (MIYOP-109 · 0116).
  -- 0110 "aynı telefonda tek açık talep" kuralını indeksle zorluyor. Eski
  -- bir talebi yeniden NEW yapmak, o numaranın BAŞKA bir açık talebi varken
  -- indekse çarpar — ve bu fonksiyon o hatayı çevirmediği için platform
  -- yöneticisi ekranda ham indeks adını görüyordu.
  -- Kilit `geri_arama_gonder` ile AYNI (110 + telefon): yeniden açma ile
  -- yeni bir başvuru aynı anda gelirse sıraya girerler.
  if v_durum = 'NEW' and v_satir.status <> 'NEW' then
    perform pg_advisory_xact_lock(110, hashtext(v_satir.phone));
    select reference into v_diger
      from public.callback_request
     where phone = v_satir.phone and status = 'NEW' and id <> v_satir.id
     limit 1;
    if v_diger is not null then
      raise exception
        'Bu numaranın bekleyen başka bir talebi var (%). Aynı numara için '
        'iki açık talep olamaz; önce onu sonuçlandırın.', v_diger
        using errcode = 'MI409';
    end if;
  end if;

  -- Not BİRİKİYOR, üstüne yazılmıyor.
  v_satirim := to_char(now(), 'DD.MM.YYYY HH24:MI')
    || ' · ' || coalesce(v_ad, '(ad yok)')
    || ' · ' || v_durum
    || coalesce(' · ' || v_not, '');

  begin
    update public.callback_request
       set status       = v_durum,
           contact_note = coalesce(contact_note || E'\n', '') || v_satirim,
           -- İlk aramanın imzası bir daha değişmiyor.
           contacted_at = case when contacted_at is null and v_durum <> 'NEW'
                               then now() else contacted_at end,
           contacted_by = case when contacted_by is null and v_durum <> 'NEW'
                               then v_ben else contacted_by end,
           updated_at   = now(),
           updated_by   = v_ben
     where reference = btrim(p_reference);
  exception when unique_violation then
    -- ⚠️ İKİNCİ KAT. Yukarıdaki ön kontrol bunu zaten yakalar; buraya
    -- düşülmesi, kilidi almayan bir yazma yolunun araya girdiğini gösterir.
    -- Hangi kısıtın çarptığı OKUNUYOR: başka bir tekillik bu cümleyle
    -- örtülürse yanlış sebep söylenmiş olur (0110'un dersi).
    get stacked diagnostics v_kisit = constraint_name;
    if v_kisit = 'callback_request_acik_talep_tekil' then
      raise exception
        'Bu numaranın bekleyen başka bir talebi var. Aynı numara için iki '
        'açık talep olamaz; önce onu sonuçlandırın.'
        using errcode = 'MI409';
    end if;
    raise;
  end;
end $$;

comment on function app.geri_arama_durumu_yaz(text, text, text) is
  'Geri arama talebinin durumunu yazar (yalniz platform.manage). Imza '
  'sunucudan. Yeniden NEW yapilirken ayni numaranin baska acik talebi '
  'varsa MI409 verir ve HICBIR SEY degismez (0116 · MIYOP-109).';


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare v_govde text; v_say int;
begin
  -- Tek tanım: imza değişmedi, yanına ikincisi konmamış olmalı.
  select count(*) into v_say from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'geri_arama_durumu_yaz';
  if v_say <> 1 then
    raise exception '0116 DOGRULAMA: app.geri_arama_durumu_yaz % tanimli (1 olmali).', v_say;
  end if;

  select pg_get_functiondef('app.geri_arama_durumu_yaz(text, text, text)'::regprocedure)
    into v_govde;
  if v_govde !~ 'MI409' or v_govde !~ 'pg_advisory_xact_lock' then
    raise exception '0116 DOGRULAMA: govde cakisma kontrolunu tasimiyor.';
  end if;
  if v_govde !~ 'platform\.manage' then
    raise exception '0116 DOGRULAMA: platform kapisi govdeden dusmus.';
  end if;

  -- ⚠️ YETKİLER: `create or replace` yetkileri korur — ama "korur" bir
  -- beklentidir, ölçüm değil.
  if has_function_privilege('anon', 'public.geri_arama_durumu_yaz(text, text, text)', 'execute') then
    raise exception '0116 DOGRULAMA: anon durum yazabiliyor.';
  end if;
  if not has_function_privilege('authenticated', 'public.geri_arama_durumu_yaz(text, text, text)', 'execute') then
    raise exception '0116 DOGRULAMA: authenticated kabugu cagiramiyor.';
  end if;
  if has_function_privilege('authenticated', 'app.geri_arama_durumu_yaz(text, text, text)', 'execute')
     or has_function_privilege('anon', 'app.geri_arama_durumu_yaz(text, text, text)', 'execute') then
    raise exception '0116 DOGRULAMA: ic yardimci disaridan cagrilabiliyor.';
  end if;

  raise notice '0116 TAMAM · yeniden beklemeye alma cakismasi anlasilir cevap veriyor.';
end $$;


-- ── ÖZET ──────────────────────────────────────────────────────────────────
select 'degisen' as ne, 'app.geri_arama_durumu_yaz (imza ayni, yetkiler korundu)' as deger
union all
select 'cakisma cevabi', 'MI409 · oteki talebin numarasiyla'
union all
select 'cakismada degisen kayit', 'YOK (durum ve not defteri ayni kalir)'
union all
select 'acik talep', (select count(*)::text from public.callback_request where status = 'NEW')
union all
select 'ayni numarada cift acik talep',
       (select count(*)::text from (select phone from public.callback_request
                                     where status = 'NEW' group by phone having count(*) > 1) x)
union all
select 'dogrulama', 'gecti';

-- ═══════════════════════════════════════════════════════════════════════════
-- SON ÖZET · iki göç + bir salt okunur ölçüm (ekrana ÇIKAN tablo budur)
-- ═══════════════════════════════════════════════════════════════════════════
select ne, deger from (
  select 1 as sira, '0115 · numune kisitlari yeni sozlesmede' as ne,
         (select count(*)::text || ' / 3'
            || case when count(*) = 3 then ' · tamam' else ' · EKSIK' end
            from pg_constraint
           where conname in ('witness_sample_code_not_blank',
                             'witness_sample_event_reason_required',
                             'witness_sample_event_result_required')
             and pg_get_constraintdef(oid) ~ 'regexp_replace'
             and pg_get_constraintdef(oid) !~ 'btrim') as deger
  union all
  select 2, '0116 · yeniden acma cakismasi MI409 veriyor',
         case when pg_get_functiondef(
                     'app.geri_arama_durumu_yaz(text, text, text)'::regprocedure) ~ 'MI409'
               and pg_get_functiondef(
                     'app.geri_arama_durumu_yaz(text, text, text)'::regprocedure) ~ 'pg_advisory_xact_lock'
              then 'tamam' else 'EKSIK' end
  union all
  select 3, 'mevzuat fonksiyonu sayisi (beklenen 7 · artakalan imza yok)',
         (select count(*)::text
            || case when count(*) = 7 then ' · tamam' else ' · BEKLENMEYEN' end
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname in ('public', 'app') and p.proname like 'mevzuat%')
  union all
  select 4, 'numune / olay sayisi (dokunulmadi)',
         (select count(*)::text from public.witness_sample) || ' / '
         || (select count(*)::text from public.witness_sample_event)
  union all
  select 5, 'geri arama talebi sayisi (dokunulmadi)',
         (select count(*)::text from public.callback_request)
) t
order by sira;
