-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0111 — ŞAHİT NUMUNE METİN EŞİKLERİ EKRANLA AYNI OLDU
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- **MIYOP-105 · P2 · EKRAN İLE VERİTABANI AYNI ŞEYİ İSTEMİYORDU.**
--
-- Ekranın eşikleri (`src/quality/witness-sample.service.ts`, ölçüldü):
--     numuneKoduYeterliMi  → btrim uzunluk >= 2
--     gerekceYeterliMi     → btrim uzunluk >= 3   (gerekçe VE açılış sonucu)
-- Ekran bunları gerçekten uyguluyor (`src/pages/SahitNumune.tsx` satır
-- 224, 292-293: düğme bu koşullar sağlanmadan etkin olmuyor).
--
-- Veritabanının istediği (0093, 0100):
--     sample_code → `btrim(sample_code) <> ''`      yani 1 karakter yeter
--     reason      → `btrim(reason) <> ''`           yani 1 karakter yeter
--     result      → `btrim(result) <> ''`           yani 1 karakter yeter
--
-- Yani API'den yazan biri — ya da ileride ekranı atlayan bir yol —
-- gerekçe yerine `.` yazıp geçebiliyordu. Şahit numune defterinin tek
-- işi bir tartışmada neyin neden yapıldığını söylemek; tek karakterlik
-- bir gerekçe o işi yapmaz. Tarayıcıdaki kontrol bir güvenlik sınırı
-- değildir (bu depodaki temel kural): kural veritabanında olmalı.
--
-- ⚠️ BU BİR "KAPI SIKMA" GÖÇÜ, DAVRANIŞ DEĞİŞİKLİĞİ DEĞİL: ekran zaten
-- bu eşikleri uyguluyordu, yani hiçbir ekran akışı değişmiyor. Değişen
-- tek şey, ekranı atlayan yolun da aynı eşiğe çarpması.
--
-- ── NE DEĞİŞMİYOR ────────────────────────────────────────────────────────
-- · `ALINDI` olayı gerekçe İSTEMİYOR (0093) — numune alındı, o kadar.
-- · Sonuç yalnız `ACILDI` için zorunlu (0100); `IMHA`nın sonucu
--   gerekçesinin içinde.
-- · Numune kodunun BİÇİMİ hâlâ serbest: işletmenin kendi defteri.
--
-- ── VAR OLAN KAYITLAR ────────────────────────────────────────────────────
-- 0100'ün deseni uygulanıyor: kısıt eklenmeden ÖNCE ihlal sayılıyor.
-- Olay defteri DEĞİŞMEZ (update/delete tetikle engelli), yani eski bir
-- kaydı düzeltmek mümkün değil. İhlal varsa göç DURUYOR ve ne yapılacağını
-- söylüyor — sessizce yarım uygulanmış bir kısıt bırakmıyor.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · ÖNCE ÖLÇ ─────────────────────────────────────────────────────────
do $$
declare v_kod int; v_ger int; v_son int;
begin
  select count(*) into v_kod from public.witness_sample
   where length(btrim(sample_code)) < 2;
  select count(*) into v_ger from public.witness_sample_event
   where event_type <> 'ALINDI'
     and length(btrim(coalesce(reason, ''))) < 3;
  select count(*) into v_son from public.witness_sample_event
   where event_type = 'ACILDI'
     and length(btrim(coalesce(result, ''))) < 3;

  if v_kod > 0 or v_ger > 0 or v_son > 0 then
    raise exception
      '0111: eski kayitlar yeni esikleri karsilamiyor '
      '(kisa kod: %, kisa gerekce: %, kisa sonuc: %). Kisit EKLENMEDI. '
      'Olay defteri degismez oldugu icin bu kayitlar duzeltilemez; bu '
      'durumda kurali yalniz YENI kayitlar icin zorlamak gerekir '
      '(`not valid` ile) ve o karar YAZILARAK verilmelidir.',
      v_kod, v_ger, v_son;
  end if;

  raise notice '0111: eski kayitlarda ihlal yok; kisitlar eklenebilir.';
end $$;


-- ── 2 · NUMUNE KODU · EN AZ İKİ KARAKTER ─────────────────────────────────
alter table public.witness_sample
  drop constraint if exists witness_sample_code_not_blank;
alter table public.witness_sample
  add constraint witness_sample_code_not_blank check (
    length(btrim(sample_code)) >= 2
  );

comment on constraint witness_sample_code_not_blank on public.witness_sample is
  'Numune kodu en az iki karakter (0111). Esik EKRANLA AYNI: '
  'numuneKoduYeterliMi (witness-sample.service.ts). Bicim serbest.';


-- ── 3 · GEREKÇE · EN AZ ÜÇ KARAKTER ──────────────────────────────────────
-- ⚠️ `ALINDI` dışarıda: numune almanın gerekçesi yoktur.
alter table public.witness_sample_event
  drop constraint if exists witness_sample_event_reason_required;
alter table public.witness_sample_event
  add constraint witness_sample_event_reason_required check (
    event_type = 'ALINDI'
    or length(btrim(coalesce(reason, ''))) >= 3
  );

comment on constraint witness_sample_event_reason_required
  on public.witness_sample_event is
  'Acilis ve imha gerekce ister, en az uc karakter (0093 + 0111). Esik '
  'EKRANLA AYNI: gerekceYeterliMi. Tek karakterlik gerekce defterin '
  'isini yapmaz.';


-- ── 4 · AÇILIŞ SONUCU · EN AZ ÜÇ KARAKTER ────────────────────────────────
alter table public.witness_sample_event
  drop constraint if exists witness_sample_event_result_required;
alter table public.witness_sample_event
  add constraint witness_sample_event_result_required check (
    event_type <> 'ACILDI'
    or length(btrim(coalesce(result, ''))) >= 3
  );

comment on constraint witness_sample_event_result_required
  on public.witness_sample_event is
  'Acilis SONUC ister, en az uc karakter (0100 + 0111). Esik EKRANLA AYNI: '
  'gerekceYeterliMi. Acilis saklama sonunu KISALTIR (0094); sonucsuz '
  'acilis numunenin omrunu sebepsiz azaltirdi.';


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
-- ⚠️ "Kısıtı yazdım" demek yetmez: kısıtın TANIMININ yürürlükte olduğu
-- ölçülüyor. Kısıtların GERÇEKTEN reddettiği ayrı ölçülüyor —
-- `db/prova/prova-0111.sql` canlı yazımla sınıyor; bu blok onun yerine
-- geçmez.
do $$
begin
  -- Kısıt tanımları yerinde mi?
  if not exists (select 1 from pg_constraint
                  where conname = 'witness_sample_code_not_blank'
                    and pg_get_constraintdef(oid) ~ '>= 2') then
    raise exception '0111 DOGRULAMA: numune kodu esigi 2 degil.';
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'witness_sample_event_reason_required'
                    and pg_get_constraintdef(oid) ~ '>= 3') then
    raise exception '0111 DOGRULAMA: gerekce esigi 3 degil.';
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'witness_sample_event_result_required'
                    and pg_get_constraintdef(oid) ~ '>= 3') then
    raise exception '0111 DOGRULAMA: sonuc esigi 3 degil.';
  end if;
  -- ALINDI hâlâ gerekçeden muaf mı?
  if not exists (select 1 from pg_constraint
                  where conname = 'witness_sample_event_reason_required'
                    and pg_get_constraintdef(oid) ~ 'ALINDI') then
    raise exception '0111 DOGRULAMA: ALINDI muafiyeti dustu.';
  end if;
  -- IMHA hâlâ sonuçtan muaf mı?
  if not exists (select 1 from pg_constraint
                  where conname = 'witness_sample_event_result_required'
                    and pg_get_constraintdef(oid) ~ 'ACILDI') then
    raise exception '0111 DOGRULAMA: sonuc kisiti ACILDI ile sinirli degil.';
  end if;

  raise notice '0111 TAMAM · numune metin esikleri ekranla ayni '
    '(kod >= 2, gerekce >= 3, sonuc >= 3).';
end $$;


-- ── ÖZET ──────────────────────────────────────────────────────────────────
select 'numune kodu' as ne, 'en az 2 karakter' as esik,
       (select count(*)::text from public.witness_sample) as mevcut_kayit
union all
select 'gerekce (ALINDI haric)', 'en az 3 karakter',
       (select count(*)::text from public.witness_sample_event where event_type <> 'ALINDI')
union all
select 'acilis sonucu', 'en az 3 karakter',
       (select count(*)::text from public.witness_sample_event where event_type = 'ACILDI')
union all
select 'dogrulama', 'gecti', '';
