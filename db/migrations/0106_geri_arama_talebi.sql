-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Göç 0106 · GERİ ARAMA TALEBİ (ana ekran · satış kapısı)
--
-- ── NEDEN ─────────────────────────────────────────────────────────────────
-- Ana ekranda bugün tek bir kapı var: "İşletme Başvurusu". O form 14 alan
-- istiyor (vergi dairesi, adres, şube sayısı…) ve ANLAMI "ben MİYOP'u
-- almaya karar verdim" demektir. Oysa ilk temas çoğu zaman şudur:
-- *"bu ne, kaça, bize uyar mı?"* O kişi 14 alan doldurmaz; kapatır gider.
--
-- Emrah'ın istediği (06.11.2026): *"Bilgi isteyenleri arayabileceğimiz bir
-- form doldursunlar."* Bu göç o formun veritabanı tarafı.
--
-- ⚠️ BU TABLO MÜŞTERİNİN VERİSİ DEĞİL, MİYOP'UN KENDİ SATIŞ VERİSİ.
-- Kiracıya (tenant) bağlı değil, çünkü talebi bırakan kişinin daha bir
-- kiracısı yok. Bu yüzden:
--   · `tenant_id` kolonu YOK ve RLS kiracıya göre süzmüyor;
--   · kiracı yedeğine (`tenant-export`) GİRMEZ — işletmenin verisi değil;
--   · `audit_log`a (Değişiklik Kaydı) GİRMEZ, çünkü o defter kiracıya
--     bağlıdır (`audit_log.tenant_id`) ve kiracısız bir satır oraya
--     yazılamaz. İz tablonun KENDİ içinde duruyor: `contacted_at`,
--     `contacted_by`, biriken `contact_note`, `updated_at`, `updated_by`.
--     ⚠️ Bu bir ihmal değil, ölçülmüş bir karar. Denetim kaydına yazmayı
--     denemek, kiracısız satırda `tenant_id` null bırakmak demekti.
--
-- ── ÜÇ KAPI ───────────────────────────────────────────────────────────────
-- 1. YAZMA (herkese açık) · `public.geri_arama_gonder(...)`
--    Tabloya DOĞRUDAN insert yetkisi HİÇ verilmiyor — 0033'ün dersi.
--    Fonksiyon `status`, `contacted_*`, `consent_at` parametrelerini
--    PARAMETRE OLARAK BİLE kabul etmiyor; yazılamayacak alanı göndermek
--    mümkün değil.
-- 2. OKUMA (yalnız platform) · `public.geri_arama_listesi()`
--    Kapı gövdenin ilk satırında: `app.platform_kapisi()` (0083).
-- 3. DURUM YAZMA (yalnız platform) · `public.geri_arama_durumu_yaz(...)`
--    İmzayı SUNUCU atıyor (0087'nin kuralı): kimin aradığı istemciden
--    gelmiyor, `app.aktif_kullanici_id()`den geliyor.
--
-- `anon` ve `authenticated` rollerine bu iki tabloda HİÇBİR DML yetkisi
-- verilmiyor. Bu yüzden `app.izin_gerek(...)` tetiği de yok: tetik, açık
-- bir yazma yüzeyini kapatmak içindir; burada kapatılacak yüzey yok
-- (0088'in ölçüsü "role açık ama kapısız tablo" idi — bu tablolar role
-- hiç açık değil).
--
-- ── KVKK ──────────────────────────────────────────────────────────────────
-- Ad ve telefon kişisel veridir. `consent_at` kolonu **NOT NULL**: onay
-- olmadan kayıt fiziken oluşamaz. Bu, ekrandaki bir onay kutusundan
-- güçlüdür — kutu atlanabilir, kolon atlanamaz.
--
-- ⚠️ OTOMATİK SAKLAMA SÜRESİ YOK ve aydınlatma metni bu yüzden hiçbir
-- süre VAAT ETMİYOR. Kendiliğinden silen bir iş (cron) kurulu değil;
-- kurmadan "12 ay sonra silinir" yazmak, tutulmayacak bir söz olurdu.
-- Silme hakkı ise GERÇEK: `public.geri_arama_sil(...)` tek çağrıyla
-- kaydı yok ediyor ve ekranda düğmesi var.
--
-- ── SPAM ──────────────────────────────────────────────────────────────────
-- Form oturumsuz. İki gerçek sınır sunucuda:
--   · aynı telefon için AÇIK (NEW) bir talep varsa ikincisi reddedilir;
--   · aynı telefondan 24 saat içinde en çok 3 talep.
-- ⚠️ IP sınırı YOK. PostgREST başlıkları `request.headers` ile okunabilir
-- ama o başlığa güvenmek (x-forwarded-for sahtedir) bir koruma sanılırdı.
-- Söylenmeyen sınır, yanlış sanılan sınırdan iyidir.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · TELEFON NORMALİZASYONU ────────────────────────────────────────────
-- ⚠️ Telefon EKRANDA değil veritabanında normalleşiyor. Sebep somut: aynı
-- numara `0532 123 45 67`, `+90 532 1234567`, `5321234567` diye üç kez
-- girilirse "aynı numaradan ikinci talep" kontrolü hiç çalışmaz — üç ayrı
-- numara sanılır ve spam kapısı kâğıt üstünde kalır.
create or replace function app.telefon_sadelestir(p_telefon text)
returns text
language plpgsql
immutable
as $$
declare
  v_rakam text;
begin
  v_rakam := regexp_replace(coalesce(p_telefon, ''), '[^0-9]', '', 'g');

  -- +90 532 … → 90 ile başlayan 12 hane
  if length(v_rakam) = 12 and left(v_rakam, 2) = '90' then
    v_rakam := right(v_rakam, 10);
  -- 0532 … → 0 ile başlayan 11 hane
  elsif length(v_rakam) = 11 and left(v_rakam, 1) = '0' then
    v_rakam := right(v_rakam, 10);
  end if;

  -- Türkiye'de abone numarası 10 hane. İlk hane 2-4 sabit hat, 5 cep.
  -- ⚠️ Yalnız cebi kabul etmek yanlış olurdu: bilgi isteyen bir işletmenin
  -- santrali olabilir ve o numaradan da aranabilir.
  if length(v_rakam) <> 10 or left(v_rakam, 1) not in ('2','3','4','5') then
    return null;
  end if;

  return v_rakam;
end $$;

comment on function app.telefon_sadelestir(text) is
  'Telefonu 10 haneli abone numarasina indirger; gecersizse null. '
  'Normalizasyon burada olmak zorunda: ayni numaranin uc yazimi spam '
  'kapisini anlamsiz kilardi (0106).';


-- ── 2 · OKUNABİLİR NUMARA ─────────────────────────────────────────────────
-- `GER-K7R3Q`. Telefonda okunur, elle yazılır.
--
-- ⚠️ Alfabe 0033'ün (`app.basvuru_referansi`) alfabesiyle BİREBİR AYNI ve
-- bu bilinçli bir tekrar. Tek bir ortak fonksiyona indirmek, demo
-- öncesinde başvuru akışının canlı numara üretecini değiştirmek demekti —
-- kozmetik bir sadeleşme için alınacak bir risk değil. Tekrarın bedeli
-- İKİSİNİN AYRIŞMASI olurdu; o yüzden alfabelerin aynı kaldığı hem
-- aşağıdaki doğrulamada hem `src/onboarding/geri-arama-kapisi.arch.test.ts`
-- içinde ölçülüyor.
create or replace function app.geri_arama_referansi()
returns text
language plpgsql
volatile
as $$
declare
  v_alfabe text := '23456789ACDEFGHJKMNPQRTUVWXYZ';
  v_kod    text := '';
  i        int;
begin
  for i in 1..5 loop
    v_kod := v_kod || substr(v_alfabe, 1 + floor(random() * length(v_alfabe))::int, 1);
  end loop;
  return 'GER-' || v_kod;
end $$;

comment on function app.geri_arama_referansi() is
  'Okunabilir geri arama numarasi (GER-XXXXX). Anahtar DEGIL.';


-- ── 3 · KVKK METİN SÜRÜMÜ ─────────────────────────────────────────────────
-- ⚠️ SÜRÜMÜ İSTEMCİ GÖNDERMİYOR. Gönderseydi kayıt, kişinin aslında
-- görmediği bir metne onay verdiğini söyleyebilirdi. Sunucu hangi metnin
-- yürürlükte olduğunu kendisi biliyor ve onu damgalıyor.
--
-- Sürümün sonundaki sekiz harf, ekranda gösterilen metnin md5 özetinin ilk
-- sekiz hanesi. Metin değişip sürüm değişmezse arch testi kırılıyor —
-- yani "onay verilen metin" ile "gösterilen metin" ayrışamıyor.
create or replace function app.kvkk_metin_surumu()
returns text
language sql
immutable
as $$ select '2026-11-06-7b40ca4d'::text $$;

comment on function app.kvkk_metin_surumu() is
  'Yururlukteki aydinlatma metninin surumu. Sonundaki 8 hane metnin md5 '
  'ozetidir; metin degisip surum degismezse arch testi kirilir (0106).';


-- ── 4 · TABLO ─────────────────────────────────────────────────────────────
create table if not exists public.callback_request (
  -- ⚠️ `id` kolonu var çünkü tuzak 149: `id`siz tabloda satır kimliği
  -- okunamıyor. Burada denetim kaydı yazmıyoruz ama kimlik yine de
  -- tablonun kendi işi (silme, durum yazma hep numara üzerinden gidiyor).
  id             uuid primary key default gen_random_uuid(),

  reference      text not null,
  created_at     timestamptz not null default now(),

  -- ── Kişinin verdiği bilgi ───────────────────────────────────────────────
  full_name      text not null
                   constraint callback_request_ad_uzunluk
                   check (length(btrim(full_name)) between 2 and 120),
  -- 10 haneli abone numarası. Sadeleştirmeyi fonksiyon yapıyor; kısıt
  -- sadeleşmiş hâli zorluyor ki ham metin kaçak yoldan girmesin.
  phone          text not null
                   constraint callback_request_telefon_bicim
                   check (phone ~ '^[2-5][0-9]{9}$'),
  company_name   text not null
                   constraint callback_request_firma_uzunluk
                   check (length(btrim(company_name)) between 2 and 160),
  -- İsteğe bağlı: bilgi isteyen herkesin iş e-postası olmayabilir.
  email          text
                   constraint callback_request_eposta_uzunluk
                   check (email is null or length(email) between 5 and 160),
  -- "Ne hakkında bilgi istiyorsunuz" — serbest metin, isteğe bağlı.
  topic          text
                   constraint callback_request_konu_uzunluk
                   check (topic is null or length(topic) <= 600),
  best_time      text not null default 'FARKETMEZ'
                   constraint callback_request_saat_gecerli
                   check (best_time in ('SABAH','OGLEDEN_SONRA','AKSAM','FARKETMEZ')),

  -- ── KVKK ────────────────────────────────────────────────────────────────
  -- ⚠️ NOT NULL. Onaysız kayıt oluşamaz.
  consent_at      timestamptz not null,
  consent_version text not null,

  -- ── Satış tarafı ────────────────────────────────────────────────────────
  status         text not null default 'NEW'
                   constraint callback_request_durum_gecerli
                   check (status in ('NEW','CONTACTED','CLOSED')),
  -- İLK temasın imzası. Sonraki işlemler `updated_*` alanlarına düşer;
  -- "ne zaman arandı" sorusunun cevabı ilk aramadır.
  contacted_at   timestamptz,
  contacted_by   uuid references public.app_user(id) on delete set null,
  -- Not BİRİKİYOR: her durum değişikliği bir satır ekliyor, üstüne
  -- yazmıyor. Olay tablosu açmadan geçmişi tutmanın yolu bu.
  contact_note   text,

  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.app_user(id) on delete set null
);

comment on table public.callback_request is
  'Ana ekrandaki "Sizi Arayalim" formunun kayitlari. MIYOP un kendi satis '
  'verisi; kiraciya bagli DEGIL, kiraci yedegine GIRMEZ (0106).';
comment on column public.callback_request.consent_at is
  'KVKK onay zamani. NOT NULL: onaysiz kayit olusamaz.';
comment on column public.callback_request.contact_note is
  'Birikimli not. Her durum degisikligi bir satir EKLER, uzerine yazmaz.';

create unique index if not exists callback_request_referans_tekil
  on public.callback_request (reference);
-- Spam kapısının ve listenin ikisi de bu iki sorguyu yapıyor.
create index if not exists callback_request_telefon_zaman
  on public.callback_request (phone, created_at desc);
create index if not exists callback_request_durum_zaman
  on public.callback_request (status, created_at desc);

alter table public.callback_request alter column reference set default app.geri_arama_referansi();

-- ⚠️ RLS AÇIK, POLİTİKA YOK — yani `anon`/`authenticated` için hiçbir satır
-- geçmez. Erişim yalnız `security definer` fonksiyonlardan. İkinci savunma
-- hattı: aşağıda GRANT da verilmiyor, yani iki kat birbirinden bağımsız.
alter table public.callback_request enable row level security;
alter table public.callback_request force  row level security;

revoke all on public.callback_request from anon, authenticated;


-- ── 5 · ANA EKRANDA GÖRÜNECEK TELEFON ─────────────────────────────────────
-- Emrah'ın isteği: *"şimdilik yazmasın ama admin panelimde orası için
-- telefon numarası girebileceğim yer olsun."*
--
-- ⚠️ BAYRAK (feature flag) YOK, VERİ VAR. Numara boşsa ana ekranda hiçbir
-- şey görünmüyor; yazıldığı an görünüyor. Davranış veriyi izliyor, ayrı
-- bir "göster/gizle" düğmesi ikinci bir gerçeklik yaratırdı.
create table if not exists public.platform_contact (
  id            uuid primary key default gen_random_uuid(),
  -- Tek satır garantisi: `unique` + `check` birlikte ikinci satırı
  -- fiziken imkânsız kılıyor.
  singleton     boolean not null default true unique
                  constraint platform_contact_tek_satir check (singleton),
  -- Boş olabilir: "henüz yazılmadı" bir değerdir (0103'ün dersi).
  public_phone  text
                  constraint platform_contact_telefon_bicim
                  check (public_phone is null or public_phone ~ '^[2-5][0-9]{9}$'),
  updated_at    timestamptz not null default now(),
  updated_by    uuid references public.app_user(id) on delete set null
);

comment on table public.platform_contact is
  'EVREN360 un dısarıya gosterdigi iletisim bilgisi. Tek satir. Numara '
  'bossa ana ekranda hic gorunmez -- bayrak degil veri (0106).';

insert into public.platform_contact (singleton) values (true)
on conflict (singleton) do nothing;

alter table public.platform_contact enable row level security;
alter table public.platform_contact force  row level security;

revoke all on public.platform_contact from anon, authenticated;


-- ── 6 · YAZMA KAPISI · HERKESE AÇIK ───────────────────────────────────────
create or replace function app.geri_arama_gonder(
  p_full_name    text,
  p_phone        text,
  p_company_name text,
  p_email        text default null,
  p_topic        text default null,
  p_best_time    text default 'FARKETMEZ',
  p_consent      boolean default false
)
returns text
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_telefon text;
  v_saat    text;
  v_eposta  text;
  v_ref     text;
  v_adet    int;
  i         int;
begin
  -- ⚠️ ONAY İLK KONTROL. Onay yoksa hiçbir kişisel veri işlenmiyor:
  -- doğrulama bile yapılmıyor, çünkü doğrulama da bir işlemedir.
  if coalesce(p_consent, false) is not true then
    raise exception 'Formu gönderebilmek için kişisel verilerin işlenmesine onay vermeniz gerekiyor.'
      using errcode = 'MI422';
  end if;

  v_telefon := app.telefon_sadelestir(p_phone);
  if v_telefon is null then
    raise exception 'Telefon numarası anlaşılamadı. Başında sıfır olacak şekilde on bir hane yazın (örnek: 0532 123 45 67).'
      using errcode = 'MI422';
  end if;

  if length(btrim(coalesce(p_full_name, ''))) < 2 then
    raise exception 'Ad soyad yazılmadı.' using errcode = 'MI422';
  end if;
  if length(btrim(coalesce(p_company_name, ''))) < 2 then
    raise exception 'İşletme adı yazılmadı.' using errcode = 'MI422';
  end if;

  v_saat := upper(btrim(coalesce(p_best_time, '')));
  if v_saat not in ('SABAH','OGLEDEN_SONRA','AKSAM','FARKETMEZ') then
    v_saat := 'FARKETMEZ';
  end if;

  v_eposta := nullif(lower(btrim(coalesce(p_email, ''))), '');
  -- E-posta isteğe bağlı; YAZILDIYSA e-postaya benzemek zorunda. Yarım
  -- yazılmış bir adres, hiç yazılmamış bir adresten kötüdür: oraya yazıp
  -- cevap bekleriz.
  if v_eposta is not null and v_eposta !~ '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$' then
    raise exception 'E-posta adresi eksik görünüyor. Düzeltin ya da boş bırakın.'
      using errcode = 'MI422';
  end if;

  -- ── Spam kapısı 1 · açık talep ──────────────────────────────────────────
  if exists (
    select 1 from public.callback_request
     where phone = v_telefon and status = 'NEW'
  ) then
    raise exception 'Bu numara için bekleyen bir geri arama talebi zaten var. En kısa sürede arayacağız.'
      using errcode = 'MI409';
  end if;

  -- ── Spam kapısı 2 · 24 saatte en çok üç ─────────────────────────────────
  select count(*) into v_adet
    from public.callback_request
   where phone = v_telefon
     and created_at > now() - interval '24 hours';
  if v_adet >= 3 then
    raise exception 'Bu numaradan bugün çok sayıda talep geldi. Yarın tekrar deneyin ya da bizi arayın.'
      using errcode = 'MI429';
  end if;

  for i in 1..5 loop
    begin
      insert into public.callback_request
        (reference, full_name, phone, company_name, email, topic, best_time,
         consent_at, consent_version)
      values
        (app.geri_arama_referansi(), btrim(p_full_name), v_telefon,
         btrim(p_company_name), v_eposta,
         nullif(btrim(coalesce(p_topic, '')), ''), v_saat,
         now(), app.kvkk_metin_surumu())
      returning reference into v_ref;
      return v_ref;
    exception when unique_violation then
      -- Çakışan tek şey numara olabilir (telefon tekil değil). Döngü
      -- tekrar denesin.
      null;
    end;
  end loop;

  raise exception 'Talep numarası üretilemedi. Lütfen tekrar deneyin.'
    using errcode = 'MI500';
end $$;

comment on function app.geri_arama_gonder is
  'Geri arama talebinin TEK giris kapisi. status, contacted_* ve consent_at '
  'PARAMETRE OLARAK BILE yok. Onay ilk kontrol (0106).';

create or replace function public.geri_arama_gonder(
  p_full_name    text,
  p_phone        text,
  p_company_name text,
  p_email        text default null,
  p_topic        text default null,
  p_best_time    text default 'FARKETMEZ',
  p_consent      boolean default false
)
returns text
language sql
volatile
security definer
set search_path = public, app, pg_temp
as $$
  select app.geri_arama_gonder(
    p_full_name, p_phone, p_company_name, p_email, p_topic, p_best_time, p_consent)
$$;

comment on function public.geri_arama_gonder is
  'Formun disariya acik kapisi. Govde app.geri_arama_gonder icinde. '
  'PostgREST yalniz public semasini yayinlar -- bkz. 0016 ve 0034.';


-- ── 7 · ANA EKRANIN OKUDUĞU TELEFON · HERKESE AÇIK ────────────────────────
-- ⚠️ `anon` bu fonksiyonu çağırabiliyor ve bu BİLİNÇLİ: numaranın orada
-- durmasının amacı görünmesi. Tablonun kendisi kapalı; dışarı çıkan tek
-- şey bu tek alan. `updated_by` (kim yazdı) dışarı çıkmıyor.
create or replace function public.platform_iletisim_oku()
returns text
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$ select public_phone from public.platform_contact limit 1 $$;

comment on function public.platform_iletisim_oku is
  'Ana ekranda gosterilecek telefon. Bos olabilir -- o zaman ekran hicbir '
  'sey gostermez. Tablonun diger alanlari disariya CIKMAZ (0106).';


-- ── 8 · OKUMA · YALNIZ PLATFORM ───────────────────────────────────────────
create or replace function app.geri_arama_listesi()
returns table (
  referans      text,
  olusturma     timestamptz,
  ad_soyad      text,
  telefon       text,
  firma_adi     text,
  eposta        text,
  konu          text,
  uygun_saat    text,
  durum         text,
  arandi        timestamptz,
  arayan        text,
  not_defteri   text,
  son_islem     timestamptz,
  onay_zamani   timestamptz,
  onay_surumu   text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- ⚠️ Kapı gövdenin İLK satırında, WHERE içinde değil (0083'ün dersi):
  -- WHERE'e koysaydık hiç satır yokken izinsiz çağrı hata almadan boş
  -- liste alırdı ve "yetkim var" sanırdı.
  perform app.platform_kapisi();

  return query
  select
    c.reference,
    c.created_at,
    c.full_name,
    c.phone,
    c.company_name,
    c.email,
    c.topic,
    c.best_time,
    c.status,
    c.contacted_at,
    u.full_name,
    c.contact_note,
    c.updated_at,
    c.consent_at,
    c.consent_version
  from public.callback_request c
  left join public.app_user u on u.id = c.contacted_by
  order by
    -- Bekleyen talep her zaman en üstte: ekranın işi "kimi aramalıyım".
    case c.status when 'NEW' then 0 when 'CONTACTED' then 1 else 2 end,
    c.created_at desc;
end $$;

comment on function app.geri_arama_listesi is
  'EVREN360 geri arama listesi. Yalniz platform.manage. Bekleyen talepler '
  'en ustte (0106).';

create or replace function public.geri_arama_listesi()
returns table (
  referans      text,
  olusturma     timestamptz,
  ad_soyad      text,
  telefon       text,
  firma_adi     text,
  eposta        text,
  konu          text,
  uygun_saat    text,
  durum         text,
  arandi        timestamptz,
  arayan        text,
  not_defteri   text,
  son_islem     timestamptz,
  onay_zamani   timestamptz,
  onay_surumu   text
)
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$ select * from app.geri_arama_listesi() $$;


-- ── 9 · DURUM YAZMA · YALNIZ PLATFORM ─────────────────────────────────────
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

  -- Not BİRİKİYOR, üstüne yazılmıyor.
  v_satirim := to_char(now(), 'DD.MM.YYYY HH24:MI')
    || ' · ' || coalesce(v_ad, '(ad yok)')
    || ' · ' || v_durum
    || coalesce(' · ' || v_not, '');

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
end $$;

comment on function app.geri_arama_durumu_yaz is
  'Durum degistirme. Imzayi sunucu atar; "kim aradi" parametresi YOK. '
  'Kapanis gerekce ister. Not birikir (0106).';

create or replace function public.geri_arama_durumu_yaz(
  p_reference text,
  p_status    text,
  p_note      text default null
)
returns void
language sql
volatile
security definer
set search_path = public, app, pg_temp
as $$ select app.geri_arama_durumu_yaz(p_reference, p_status, p_note) $$;


-- ── 10 · SİLME · KVKK HAKKI ───────────────────────────────────────────────
-- ⚠️ Bu fonksiyon aydınlatma metnindeki sözün KARŞILIĞI. Metin "silmemizi
-- istediğinizde siliyoruz" diyor; bu, o cümleyi tutulabilir yapan şey.
-- Sözün arkasında çalışan bir şey olmazsa metin bir yalana dönüşür.
create or replace function app.geri_arama_sil(p_reference text)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Kaydı yalnızca EVREN360 platform yöneticisi silebilir.'
      using errcode = 'MI403';
  end if;

  delete from public.callback_request where reference = btrim(p_reference);
  if not found then
    raise exception 'Geri arama talebi bulunamadı: %', p_reference using errcode = 'MI404';
  end if;
end $$;

comment on function app.geri_arama_sil is
  'KVKK silme hakkinin karsiligi. Kayit geri donusu olmadan silinir (0106).';

create or replace function public.geri_arama_sil(p_reference text)
returns void
language sql
volatile
security definer
set search_path = public, app, pg_temp
as $$ select app.geri_arama_sil(p_reference) $$;


-- ── 11 · ANA EKRAN TELEFONUNU YAZMA · YALNIZ PLATFORM ─────────────────────
create or replace function app.platform_iletisim_yaz(p_phone text)
returns text
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_ben     uuid;
  v_telefon text;
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Bu ayarı yalnızca EVREN360 platform yöneticisi değiştirebilir.'
      using errcode = 'MI403';
  end if;
  v_ben := app.aktif_kullanici_id();

  -- Boş göndermek SİLMEK demektir: numara kaldırılır, ana ekranda hiçbir
  -- şey görünmez. "Silmek" için ayrı bir fonksiyon açmak, aynı işi iki
  -- kapıya bölmek olurdu.
  if nullif(btrim(coalesce(p_phone, '')), '') is null then
    v_telefon := null;
  else
    v_telefon := app.telefon_sadelestir(p_phone);
    if v_telefon is null then
      raise exception 'Telefon numarası anlaşılamadı. Başında sıfır olacak şekilde on bir hane yazın.'
        using errcode = 'MI422';
    end if;
  end if;

  update public.platform_contact
     set public_phone = v_telefon,
         updated_at   = now(),
         updated_by   = v_ben;

  return coalesce(v_telefon, '');
end $$;

comment on function app.platform_iletisim_yaz is
  'Ana ekranda gorunecek telefonu yazar. Bos gondermek numarayi KALDIRIR. '
  'Yalniz platform.manage (0106).';

create or replace function public.platform_iletisim_yaz(p_phone text)
returns text
language sql
volatile
security definer
set search_path = public, app, pg_temp
as $$ select app.platform_iletisim_yaz(p_phone) $$;


-- ── 12 · KAPILAR ELLE KAPATILIYOR (tuzak 67) ──────────────────────────────
-- `security definer` bir fonksiyon varsayılan olarak PUBLIC'e açıktır.
-- Açık bırakmak, kapıyı takıp kilitlemeyi unutmaktır.
do $$
declare v_ad text;
begin
  -- `app` tarafı: dışarıdan hiç çağrılmaz.
  foreach v_ad in array array[
    'app.geri_arama_gonder(text, text, text, text, text, text, boolean)',
    'app.geri_arama_listesi()',
    'app.geri_arama_durumu_yaz(text, text, text)',
    'app.geri_arama_sil(text)',
    'app.platform_iletisim_yaz(text)'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('revoke all on function %s from anon', v_ad);
    execute format('revoke all on function %s from authenticated', v_ad);
    execute format('grant execute on function %s to service_role', v_ad);
  end loop;

  -- `public` tarafı · OTURUMSUZ çağrılabilen iki kapı.
  foreach v_ad in array array[
    'public.geri_arama_gonder(text, text, text, text, text, text, boolean)',
    'public.platform_iletisim_oku()'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('grant execute on function %s to anon, authenticated, service_role', v_ad);
  end loop;

  -- `public` tarafı · yalnız OTURUMLU, içinde izin kontrolü var.
  foreach v_ad in array array[
    'public.geri_arama_listesi()',
    'public.geri_arama_durumu_yaz(text, text, text)',
    'public.geri_arama_sil(text)',
    'public.platform_iletisim_yaz(text)'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('revoke all on function %s from anon', v_ad);
    execute format('grant execute on function %s to authenticated, service_role', v_ad);
  end loop;

  -- Yardımcılar.
  execute 'revoke all on function app.telefon_sadelestir(text) from public';
  execute 'revoke all on function app.geri_arama_referansi() from public';
  execute 'revoke all on function app.kvkk_metin_surumu() from public';
  execute 'grant execute on function app.telefon_sadelestir(text) to service_role';
  execute 'grant execute on function app.geri_arama_referansi() to service_role';
  execute 'grant execute on function app.kvkk_metin_surumu() to service_role';
end $$;


-- ── 13 · DOĞRULAMA ────────────────────────────────────────────────────────
do $$
declare
  v_ref        text;
  v_ref2       text;
  v_onaysiz    boolean := false;
  v_bozuk_tel  boolean := false;
  v_ikinci     boolean := false;
  v_tel        text;
  v_ikinci_sat int;
begin
  -- 1 · Onaysız gönderim REDDEDİLİYOR (KVKK kapısı gerçek mi)
  begin
    perform public.geri_arama_gonder(
      '0106 Onaysiz Deneme', '05321230106', '0106 Deneme Gida',
      null, null, 'FARKETMEZ', false);
  exception when others then v_onaysiz := true;
  end;
  if not v_onaysiz then
    raise exception 'DOGRULAMA BASARISIZ: onaysiz gonderim gecti.';
  end if;

  -- 2 · Bozuk telefon REDDEDİLİYOR
  begin
    perform public.geri_arama_gonder(
      '0106 Bozuk Telefon', '123', '0106 Deneme Gida',
      null, null, 'FARKETMEZ', true);
  exception when others then v_bozuk_tel := true;
  end;
  if not v_bozuk_tel then
    raise exception 'DOGRULAMA BASARISIZ: bozuk telefon gecti.';
  end if;

  -- 3 · Geçerli gönderim numara döndürüyor
  v_ref := public.geri_arama_gonder(
    '0106 Dogrulama Kisi', '0532 123 01 06', '0106 Dogrulama Gida',
    'dogrulama-0106@example.com', 'Fiyat bilgisi', 'SABAH', true);
  if v_ref !~ '^GER-[23456789ACDEFGHJKMNPQRTUVWXYZ]{5}$' then
    raise exception 'Numara bicimi beklenmedik: %', v_ref;
  end if;

  -- 4 · Telefon SADELEŞMİŞ hâlde yazıldı (üç yazım tek numara)
  select phone into v_tel from public.callback_request where reference = v_ref;
  if v_tel <> '5321230106' then
    raise exception 'Telefon sadelesmemis: %', v_tel;
  end if;

  -- 5 · Onay damgası SUNUCUDAN geldi
  if (select consent_version from public.callback_request where reference = v_ref)
     <> app.kvkk_metin_surumu() then
    raise exception 'DOGRULAMA BASARISIZ: onay surumu sunucudan damgalanmamis.';
  end if;

  -- 6 · Aynı numaradan İKİNCİ açık talep reddediliyor
  begin
    perform public.geri_arama_gonder(
      '0106 Ikinci Deneme', '+90 532 123 01 06', '0106 Dogrulama Gida',
      null, null, 'AKSAM', true);
  exception when others then v_ikinci := true;
  end;
  if not v_ikinci then
    raise exception 'DOGRULAMA BASARISIZ: ayni numaradan ikinci acik talep gecti.';
  end if;

  -- 7 · Durum yazma notu BİRİKTİRİYOR ve imzayı sunucu atıyor
  --     (göç bağlamında oturum yok; `app.` sürümü çağrılırsa izin kontrolü
  --      patlar — bu yüzden doğrudan tabloyu okuyup kontrol ediyoruz.)
  --     ⚠️ Davranış provası `db/prova/prova-0106.sql` içinde, GERÇEK
  --     oturumla ve `authenticated` rolüyle koşuyor.

  -- 8 · Farklı numara geçiyor ve AYRI numara alıyor
  v_ref2 := public.geri_arama_gonder(
    '0106 Ucuncu Kisi', '0232 123 01 06', '0106 Santral Gida',
    null, null, 'OGLEDEN_SONRA', true);
  if v_ref2 = v_ref then
    raise exception 'Iki talep ayni numarayi aldi: %', v_ref;
  end if;
  -- Sabit hat da kabul edildi mi
  select count(*) into v_ikinci_sat from public.callback_request
   where reference = v_ref2 and phone = '2321230106';
  if v_ikinci_sat <> 1 then
    raise exception 'Sabit hat numarasi reddedildi.';
  end if;

  -- 9 · Alfabe 0033 ile AYNI (ayrisma kontrolu)
  if position('23456789ACDEFGHJKMNPQRTUVWXYZ' in pg_get_functiondef(
       'app.geri_arama_referansi()'::regprocedure)) = 0
  or position('23456789ACDEFGHJKMNPQRTUVWXYZ' in pg_get_functiondef(
       'app.basvuru_referansi()'::regprocedure)) = 0 then
    raise exception 'DOGRULAMA BASARISIZ: iki numara ureteci alfabede ayrismis.';
  end if;

  -- 10 · Tabloda `anon`/`authenticated` DML yetkisi YOK
  if exists (
    select 1 from information_schema.role_table_grants
     where table_schema = 'public'
       and table_name in ('callback_request','platform_contact')
       and grantee in ('anon','authenticated')
  ) then
    raise exception 'DOGRULAMA BASARISIZ: tabloya dogrudan yetki verilmis.';
  end if;

  -- 11 · Tek satır garantisi
  begin
    insert into public.platform_contact (singleton) values (true);
    raise exception 'DOGRULAMA BASARISIZ: platform_contact ikinci satir aldi.';
  exception when unique_violation then null;
  end;

  raise notice '0106 dogrulama: numara % ve % uretildi, telefon sadelesti, onaysiz/bozuk/ikinci talep reddedildi.',
    v_ref, v_ref2;

  -- Doğrulama kayıtları SİLİNİYOR. ⚠️ Burada silmek doğru: bu tablo bir
  -- olay defteri değil, satış listesi. Emrah'ın listesinde "0106 Dogrulama
  -- Gida" diye bir müşteri adayı görünmesi, ekranı yalancı yapardı.
  delete from public.callback_request where reference in (v_ref, v_ref2);
end $$;


-- ── 14 · ÖZET ─────────────────────────────────────────────────────────────
select 'callback_request satiri' as ne,
       (select count(*)::text from public.callback_request) as deger
union all
select 'anon/authenticated tablo yetkisi (0 olmali)',
       (select count(*)::text from information_schema.role_table_grants
         where table_schema = 'public'
           and table_name in ('callback_request','platform_contact')
           and grantee in ('anon','authenticated'))
union all
select 'anon geri_arama_gonder cagirabiliyor',
       case when has_function_privilege('anon',
         'public.geri_arama_gonder(text,text,text,text,text,text,boolean)',
         'EXECUTE') then 'evet' else 'HAYIR' end
union all
select 'anon geri_arama_listesi cagirabiliyor (HAYIR olmali)',
       case when has_function_privilege('anon',
         'public.geri_arama_listesi()', 'EXECUTE') then 'EVET' else 'hayir' end
union all
select 'ana ekran telefonu',
       coalesce(nullif(public.platform_iletisim_oku(), ''), '(bos - ekranda gorunmez)')
union all
select 'kvkk metin surumu', app.kvkk_metin_surumu()
union all
select 'dogrulama', 'gecti';
