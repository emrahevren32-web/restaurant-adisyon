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
