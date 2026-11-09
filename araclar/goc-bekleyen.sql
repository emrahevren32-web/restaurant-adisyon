-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · BEKLEYEN GÖÇ · 0113 · MEVZUAT AKIŞI · 09.11.2026
--
-- Canlı veritabanı **göç 0112'de**. Bu dosya tek göç taşıyor.
--
-- ⚠️ BU GÖÇ ÖNCE ÖNCEKİ DÖRDÜNÜ ÖLÇÜYOR. İlk bloğu 0109, 0110, 0111 ve
-- 0112'nin gerçekten yürürlükte olduğuna bakıyor; biri eksikse hiç
-- başlamadan duruyor ve hangisinin eksik olduğunu söylüyor. Dün dördü
-- tek "Run" ile uygulanmıştı ve ekranda yalnız SONUNCU özet tablosu
-- görülmüştü — çıkarım sağlamdı ama çıkarım ölçüm değildir.
--
-- ⚠️ YENİ TABLO: `regulation_news`. Giriş vitrinindeki mevzuat akışı.
-- Kiracıya bağlı DEĞİL (MİYOP'un kendi içeriği), kiracı yedeğine girmez.
-- RLS açık + zorunlu, politika YOK, `anon`/`authenticated` için tabloda
-- hiçbir yetki YOK. Erişim yalnız fonksiyonlardan.
--
-- ⚠️ YENİ İZİN AÇILMIYOR: yönetim `platform.manage` ile korunuyor.
--
-- ⚠️ Ekran tarafı HENÜZ YOK. Göç uygulanınca hiçbir şey görünmez — tablo
-- boş ve kapalı. Vitrin kutusu ve EVREN360 ekranı ayrıca yazılıyor;
-- kayıt yoksa kutu zaten hiç çizilmeyecek.
--
-- ⚠️ Prova veritabanında uygulandı, iki kez koşturuldu ve ölçüldü:
-- temiz PostgreSQL 16, **114 göç · 65 prova · 0 kırmızı**.
-- `prova-0113.sql` 29 iddia, `prova-0113-ters.sql` kapılar kaldırılınca
-- taslağın vitrine sızdığını ve oturumsuz yazımın geçtiğini gösteriyor.
--
-- ⚠️ Bu dosyayı BOŞALTMAK, göçü uygulamanın SON adımıdır (kontrol
-- listesi 130). "Run" tuşuna basmak son adım değildir.
-- ═══════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0113 — MEVZUAT AKIŞI (giriş vitrini · EVREN360 yönetimi)
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- Emrah'ın isteği (09.11.2026): *"gıda yönetmeliklerinde yapılan son
-- haberler, kanunlar, bildirimler vs kaynak gösterilerek akış halinde yer
-- alsın."* Giriş ekranının köşesinde sade bir kutu; yönetimi EVREN360'da.
--
-- ── ⚠️ BU KÖŞENİN BİR GEÇMİŞİ VAR ───────────────────────────────────────
-- Giriş vitrininde DAHA ÖNCE bir duyuru bölümü vardı ve KALDIRILDI
-- (MIYOP-059): kayıt yokken `createDemoAnnouncements()` uyduruyordu —
-- *"Pazar gecesi kısa süreli bakım penceresi uygulanacaktır"* — ve
-- tarihler her açılışta yeniden hesaplanıyordu. Yani bizim vermediğimiz
-- bir taahhüt, her gün yeniden. 09.11'de o bölümün ölü CSS'i de silindi
-- (MIYOP-107) ve geri gelmediğini ölçen bir nöbet kondu.
--
-- **Aynı köşeye ikinci kez kutu koyuyoruz.** Farkı tek cümleyle:
-- **her satır gerçek, KAYNAK BAĞLANTILI ve elle yazılmış; kayıt yoksa
-- kutu HİÇ ÇİZİLMEZ.** Bu göç o farkı veritabanında zorunlu kılıyor:
-- kaynak adı ve adresi NOT NULL, adres `https://` olmak zorunda, ve
-- herkese açık okuma yalnız YAYINDA satırları döndürüyor.
--
-- ── İÇERİK NEREDEN GELİYOR ───────────────────────────────────────────────
-- Emrah'ın kendisinden, EVREN360 panelinden. **Otomatik çekme YOK** ve
-- bu bilinçli: FREE planda zamanlanmış iş yok, bir ayrıştırıcı kaynak
-- sitenin yapısı değişince sessizce bozulur, ve yanlış özetlenmiş bir
-- yönetmelik maddesi bir gıda işletmesine YANLIŞ İŞ YAPTIRIR.
-- ⚠️ Tablo yine de baştan `TASLAK / YAYINDA / ARSIV` durumuyla kuruluyor:
-- ileride otomatik besleme eklenirse satırlar TASLAK olarak düşsün,
-- Emrah onaylamadan yayına çıkmasın. O gün tabloyu değiştirmek gerekmesin
-- diye bugün yazılıyor.
--
-- ── KİRACIYA BAĞLI DEĞİL ────────────────────────────────────────────────
-- Bu MİYOP'un kendi içeriği, bir işletmenin verisi değil —
-- `callback_request` ve `platform_contact` ile aynı sınıf. Dolayısıyla:
--   · `tenant_id` kolonu YOK,
--   · kiracı yedeğine (`tenant-export`) GİRMEZ,
--   · `audit_log`a GİRMEZ (o defter `tenant_id` ister; kiracısız satır
--     oraya yazılamaz — 0106'da aynı karar verildi). İz tablonun KENDİ
--     içinde: `created_by`, `updated_by`, `created_at`, `updated_at`.
--
-- ── YENİ İZİN AÇILMIYOR ─────────────────────────────────────────────────
-- Yönetim `platform.manage` ile korunuyor (`app.platform_kapisi()`, 0083).
-- İzin kataloğuna ekleme yapmak bir mimari testi kırar (tuzak 52) ve
-- burada yeni bir izne gerek yok: bu ekran zaten yalnız platform sahibinin.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · ÖNCEKİ DÖRT GÖÇ YÜRÜRLÜKTE Mİ ────────────────────────────────────
-- ⚠️ 0109–0112 canlıya tek "Run" ile uygulandı ve ekranda yalnız SONUNCU
-- özet tablosu görüldü. Çıkarım sağlamdı (hata olsaydı çalıştırma orada
-- dururdu) ama ÇIKARIM ÖLÇÜM DEĞİLDİR. Bu blok dördünü de ölçüyor; biri
-- eksikse 0113 hiç başlamıyor.
do $$
declare v_olay text; v_turet text;
begin
  select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') into v_olay
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_olayi';
  select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') into v_turet
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_turet';

  if coalesce(v_olay, '') !~ 'new\.occurred_at\s*:=\s*now\(\)' then
    raise exception '0113: GOC 0109 YURURLUKTE DEGIL (olay zamani damgasi yok). '
      'Once araclar/goc-bekleyen.sql icindeki dort gocu uygulayin.';
  end if;
  if not exists (select 1 from pg_class where relname = 'callback_request_acik_talep_tekil') then
    raise exception '0113: GOC 0110 YURURLUKTE DEGIL (acik talep indeksi yok).';
  end if;
  if not exists (select 1 from pg_constraint
                  where conname = 'witness_sample_code_not_blank'
                    and pg_get_constraintdef(oid) ~ '>= 2') then
    raise exception '0113: GOC 0111 YURURLUKTE DEGIL (numune kodu esigi 2 degil).';
  end if;
  if coalesce(v_turet, '') !~ 'new\.taken_at\s*:=\s*now\(\)' then
    raise exception '0113: GOC 0112 YURURLUKTE DEGIL (alinma zamani damgasi yok).';
  end if;

  raise notice '0113: 0109-0112 yururlukte, olculdu. Devam.';
end $$;


-- ── 1 · TABLO ────────────────────────────────────────────────────────────
create table if not exists public.regulation_news (
  id             uuid primary key default gen_random_uuid(),

  -- Başlık ekranda görünen tek zorunlu metin.
  title          text not null
                   constraint regulation_news_baslik_uzunluk
                   check (length(btrim(title)) between 5 and 200),
  -- Özet isteğe bağlı: kısa bir cümle. Boşsa ekran yalnız başlığı gösterir.
  summary        text
                   constraint regulation_news_ozet_uzunluk
                   check (summary is null or length(summary) <= 600),

  -- ⚠️ KAYNAK ZORUNLU. Emrah'ın isteğinin çekirdeği bu: "kaynak
  -- gösterilerek". Kaynaksız bir mevzuat cümlesi, MIYOP-059'un
  -- uydurma duyurusundan farksızdır.
  source_name    text not null
                   constraint regulation_news_kaynak_uzunluk
                   check (length(btrim(source_name)) between 2 and 120),
  -- ⚠️ `https://` ZORUNLU ve bu bir güvenlik kapısıdır, biçim tercihi
  -- değil: bu adres HERKESE AÇIK bir sayfada tıklanabilir bağlantı
  -- olarak çizilecek. `javascript:` ile başlayan bir değer yazılabilseydi,
  -- panele erişen birinin ziyaretçinin tarayıcısında kod çalıştırması
  -- mümkün olurdu. Kapı tarayıcıda değil VERİTABANINDA.
  source_url     text not null
                   constraint regulation_news_kaynak_adresi
                   check (source_url ~ '^https://[^[:space:]]+$'
                          and length(source_url) <= 500),

  -- ⚠️ BU TARİH İSTEMCİDEN GELİR VE BU DOĞRU. 0109/0112'de `occurred_at`
  -- ve `taken_at` sunucuya damgalandı; onlar İMZAYDI (sistemde ne zaman
  -- oldu). Bu ise BEYAN: mevzuat ne zaman yayımlandı. Sunucunun bunu
  -- bilmesi mümkün değil. Yine de sınırlanıyor (aşağıdaki kısıt).
  published_on   date not null
                   constraint regulation_news_yayim_tarihi
                   check (published_on >= date '2000-01-01'),

  status         text not null default 'TASLAK'
                   constraint regulation_news_durum_gecerli
                   check (status in ('TASLAK','YAYINDA','ARSIV')),

  created_at     timestamptz not null default now(),
  created_by     uuid references public.app_user(id) on delete set null,
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.app_user(id) on delete set null
);

comment on table public.regulation_news is
  'Giris vitrinindeki mevzuat akisi. MIYOP un kendi icerigi; kiraciya '
  'bagli DEGIL, kiraci yedegine GIRMEZ (0113).';
comment on column public.regulation_news.source_url is
  'Kaynagin adresi. https:// ZORUNLU -- bu adres herkese acik bir sayfada '
  'tiklanabilir cizilir; javascript: bir deger yazilabilseydi ziyaretcinin '
  'tarayicisinda kod calisirdi (0113).';
comment on column public.regulation_news.published_on is
  'Mevzuatin YAYIM tarihi. Istemciden gelir: bu bir BEYAN, imza degil.';
comment on column public.regulation_news.status is
  'TASLAK yazildi yayinda degil / YAYINDA vitrinde gorunur / ARSIV kaldirildi. '
  'Ileride otomatik besleme eklenirse satirlar TASLAK dusecek (0113).';

-- Vitrin sorgusu: yayındakiler, tarihe göre.
create index if not exists regulation_news_yayin_tarih
  on public.regulation_news (status, published_on desc, created_at desc);

-- ⚠️ RLS AÇIK, POLİTİKA YOK — yani `anon`/`authenticated` için hiçbir
-- satır geçmez. Erişim yalnız `security definer` fonksiyonlardan.
-- İkinci savunma hattı: GRANT de verilmiyor (0106'nın aynısı).
alter table public.regulation_news enable row level security;
alter table public.regulation_news force  row level security;

revoke all on public.regulation_news from anon, authenticated;


-- ── 2 · HERKESE AÇIK OKUMA · YALNIZ YAYINDAKİLER ─────────────────────────
-- ⚠️ `status`, `created_by`, `updated_by` DIŞARI ÇIKMIYOR. Vitrine çıkan
-- tek şey okunacak olan: başlık, özet, kaynak, tarih.
create or replace function public.mevzuat_akisi_oku(p_limit integer default 5)
returns table (
  baslik        text,
  ozet          text,
  kaynak_adi    text,
  kaynak_adresi text,
  yayim_tarihi  date
)
language plpgsql
stable
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_adet integer;
begin
  -- ⚠️ TAVAN SUNUCUDA. İstemci "hepsini ver" diyemez; 10.000 satırlık
  -- bir istek giriş ekranını da veritabanını da yorar.
  v_adet := least(greatest(coalesce(p_limit, 5), 1), 20);

  return query
  select r.title, r.summary, r.source_name, r.source_url, r.published_on
    from public.regulation_news r
   where r.status = 'YAYINDA'
   order by r.published_on desc, r.created_at desc
   limit v_adet;
end $$;

comment on function public.mevzuat_akisi_oku(integer) is
  'Giris vitrininin okudugu akis. Yalniz YAYINDA satirlar; status ve '
  'imzalar disari CIKMAZ. Tavan sunucuda (en cok 20).';


-- ── 3 · YÖNETİM LİSTESİ · YALNIZ PLATFORM ────────────────────────────────
create or replace function app.mevzuat_listesi()
returns table (
  kimlik        uuid,
  baslik        text,
  ozet          text,
  kaynak_adi    text,
  kaynak_adresi text,
  yayim_tarihi  date,
  durum         text,
  olusturma     timestamptz,
  yazan         text,
  son_islem     timestamptz,
  son_yazan     text
)
language plpgsql
stable
security definer
set search_path = public, app, pg_temp
as $$
begin
  -- ⚠️ Kapı gövdenin İLK satırında, WHERE içinde değil (0083'ün dersi):
  -- WHERE'e koysaydık hiç satır yokken izinsiz çağrı hata almadan boş
  -- liste alır ve "yetkim var" sanırdı.
  perform app.platform_kapisi();

  return query
  select r.id, r.title, r.summary, r.source_name, r.source_url,
         r.published_on, r.status, r.created_at, y.full_name,
         r.updated_at, s.full_name
    from public.regulation_news r
    left join public.app_user y on y.id = r.created_by
    left join public.app_user s on s.id = r.updated_by
   order by r.published_on desc, r.created_at desc;
end $$;

create or replace function public.mevzuat_listesi()
returns table (
  kimlik        uuid,
  baslik        text,
  ozet          text,
  kaynak_adi    text,
  kaynak_adresi text,
  yayim_tarihi  date,
  durum         text,
  olusturma     timestamptz,
  yazan         text,
  son_islem     timestamptz,
  son_yazan     text
)
language sql
stable
security definer
set search_path = public, app, pg_temp
as $$ select * from app.mevzuat_listesi() $$;


-- ── 4 · YAZMA · YALNIZ PLATFORM ──────────────────────────────────────────
-- ⚠️ `created_by`, `updated_by`, `created_at`, `updated_at` PARAMETRE
-- OLARAK BİLE YOK (0087'nin kuralı). İmza sunucunun.
create or replace function app.mevzuat_yaz(
  p_id           uuid,
  p_baslik       text,
  p_ozet         text,
  p_kaynak_adi   text,
  p_kaynak_adres text,
  p_yayim_tarihi date,
  p_durum        text default 'TASLAK'
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_kim     uuid;
  v_baslik  text;
  v_ozet    text;
  v_kaynak  text;
  v_adres   text;
  v_durum   text;
  v_id      uuid;
begin
  perform app.platform_kapisi();
  v_kim := app.aktif_kullanici_id();

  v_baslik := btrim(coalesce(p_baslik, ''));
  if length(v_baslik) < 5 then
    raise exception 'Başlık en az beş karakter olmalı.' using errcode = 'MI422';
  end if;
  if length(v_baslik) > 200 then
    raise exception 'Başlık çok uzun (en çok 200 karakter).' using errcode = 'MI422';
  end if;

  v_ozet := nullif(btrim(coalesce(p_ozet, '')), '');
  if v_ozet is not null and length(v_ozet) > 600 then
    raise exception 'Özet çok uzun (en çok 600 karakter).' using errcode = 'MI422';
  end if;

  v_kaynak := btrim(coalesce(p_kaynak_adi, ''));
  if length(v_kaynak) < 2 then
    raise exception 'Kaynak adı yazılmadı (örnek: Resmî Gazete).'
      using errcode = 'MI422';
  end if;

  -- ⚠️ ADRES KAPISI. Kısıt da var ama hata mesajı burada anlaşılır olsun:
  -- kullanıcı "check constraint" metni değil sebebini görsün.
  v_adres := btrim(coalesce(p_kaynak_adres, ''));
  if v_adres !~ '^https://[^[:space:]]+$' then
    raise exception
      'Kaynak adresi https:// ile başlamalı ve boşluk içermemeli. '
      'Bu bağlantı giriş ekranında tıklanabilir olarak gösteriliyor.'
      using errcode = 'MI422';
  end if;
  if length(v_adres) > 500 then
    raise exception 'Kaynak adresi çok uzun.' using errcode = 'MI422';
  end if;

  if p_yayim_tarihi is null then
    raise exception 'Yayım tarihi yazılmadı.' using errcode = 'MI422';
  end if;
  -- ⚠️ GELECEK TARİH REDDEDİLİYOR ama bir gün PAY BIRAKILIYOR: sunucu
  -- UTC, Türkiye UTC+3. Akşam 21:00'den sonra Türkiye'de "bugün" olan
  -- gün sunucuda hâlâ dünkü olabilir.
  if p_yayim_tarihi > current_date + 1 then
    raise exception 'Yayım tarihi gelecekte olamaz.' using errcode = 'MI422';
  end if;
  if p_yayim_tarihi < date '2000-01-01' then
    raise exception 'Yayım tarihi çok eski görünüyor.' using errcode = 'MI422';
  end if;

  v_durum := upper(btrim(coalesce(p_durum, 'TASLAK')));
  if v_durum not in ('TASLAK','YAYINDA','ARSIV') then
    raise exception 'Geçersiz durum: %', p_durum using errcode = 'MI422';
  end if;

  if p_id is null then
    insert into public.regulation_news
      (title, summary, source_name, source_url, published_on, status,
       created_by, updated_by)
    values (v_baslik, v_ozet, v_kaynak, v_adres, p_yayim_tarihi, v_durum,
            v_kim, v_kim)
    returning id into v_id;
  else
    update public.regulation_news
       set title        = v_baslik,
           summary      = v_ozet,
           source_name  = v_kaynak,
           source_url   = v_adres,
           published_on = p_yayim_tarihi,
           status       = v_durum,
           updated_at   = now(),
           updated_by   = v_kim
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Kayıt bulunamadı.' using errcode = 'MI404';
    end if;
  end if;

  return v_id;
end $$;

create or replace function public.mevzuat_yaz(
  p_id           uuid,
  p_baslik       text,
  p_ozet         text,
  p_kaynak_adi   text,
  p_kaynak_adres text,
  p_yayim_tarihi date,
  p_durum        text default 'TASLAK'
)
returns uuid
language sql
volatile
security definer
set search_path = public, app, pg_temp
as $$
  select app.mevzuat_yaz(p_id, p_baslik, p_ozet, p_kaynak_adi,
                         p_kaynak_adres, p_yayim_tarihi, p_durum)
$$;


-- ── 5 · SİLME · YALNIZ PLATFORM ──────────────────────────────────────────
-- ⚠️ Bu tablo bir DEFTER DEĞİL: yanlış girilmiş bir haber satırının
-- saklanmasının kimseye faydası yok. Şahit numune ya da denetim kaydı
-- olsaydı silme HİÇ olmazdı. Fark bilerek yazılıyor ki bir gün biri
-- "orada siliniyor, burada da silinsin" demesin.
create or replace function app.mevzuat_sil(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare v_var boolean;
begin
  perform app.platform_kapisi();
  delete from public.regulation_news where id = p_id returning true into v_var;
  if v_var is null then
    raise exception 'Kayıt bulunamadı.' using errcode = 'MI404';
  end if;
end $$;

create or replace function public.mevzuat_sil(p_id uuid)
returns void
language sql
volatile
security definer
set search_path = public, app, pg_temp
as $$ select app.mevzuat_sil(p_id) $$;


-- ── 6 · KAPILAR ELLE KAPATILIYOR (tuzak 67) ──────────────────────────────
-- `security definer` bir fonksiyon varsayılan olarak PUBLIC'e açıktır.
-- Açık bırakmak, kapıyı takıp kilitlemeyi unutmaktır.
do $$
declare v_ad text;
begin
  -- `app` tarafı: dışarıdan hiç çağrılmaz.
  foreach v_ad in array array[
    'app.mevzuat_listesi()',
    'app.mevzuat_yaz(uuid, text, text, text, text, date, text)',
    'app.mevzuat_sil(uuid)'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('revoke all on function %s from anon', v_ad);
    execute format('revoke all on function %s from authenticated', v_ad);
    execute format('grant execute on function %s to service_role', v_ad);
  end loop;

  -- `public` tarafı · OTURUMSUZ çağrılabilen TEK kapı (vitrin).
  execute 'revoke all on function public.mevzuat_akisi_oku(integer) from public';
  execute 'grant execute on function public.mevzuat_akisi_oku(integer) '
          'to anon, authenticated, service_role';

  -- `public` tarafı · yalnız OTURUMLU, içinde izin kontrolü var.
  foreach v_ad in array array[
    'public.mevzuat_listesi()',
    'public.mevzuat_yaz(uuid, text, text, text, text, date, text)',
    'public.mevzuat_sil(uuid)'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('revoke all on function %s from anon', v_ad);
    execute format('grant execute on function %s to authenticated, service_role', v_ad);
  end loop;
end $$;


-- ── 7 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare v_say int;
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema = 'public' and table_name = 'regulation_news') then
    raise exception '0113 DOGRULAMA: regulation_news tablosu olusmadi.';
  end if;

  -- RLS açık VE zorunlu, politika YOK.
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
                  where n.nspname = 'public' and c.relname = 'regulation_news'
                    and c.relrowsecurity and c.relforcerowsecurity) then
    raise exception '0113 DOGRULAMA: RLS acik ve zorunlu degil.';
  end if;
  select count(*) into v_say from pg_policies
   where schemaname = 'public' and tablename = 'regulation_news';
  if v_say > 0 then
    raise exception '0113 DOGRULAMA: tabloda % politika var; kapali kapi olmali.', v_say;
  end if;

  -- anon/authenticated tabloya DOKUNAMAZ.
  select count(*) into v_say from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'regulation_news'
     and grantee in ('anon','authenticated');
  if v_say > 0 then
    raise exception '0113 DOGRULAMA: tabloda % adet anon/authenticated yetkisi var.', v_say;
  end if;

  -- Vitrin kapısı anon'a AÇIK; yönetim kapıları KAPALI.
  if not has_function_privilege('anon', 'public.mevzuat_akisi_oku(integer)', 'execute') then
    raise exception '0113 DOGRULAMA: vitrin okumasi anon a kapali.';
  end if;
  if has_function_privilege('anon', 'public.mevzuat_listesi()', 'execute') then
    raise exception '0113 DOGRULAMA: yonetim listesi anon a ACIK.';
  end if;
  if has_function_privilege('anon', 'public.mevzuat_yaz(uuid, text, text, text, text, date, text)', 'execute') then
    raise exception '0113 DOGRULAMA: yazma kapisi anon a ACIK.';
  end if;
  if has_function_privilege('anon', 'public.mevzuat_sil(uuid)', 'execute') then
    raise exception '0113 DOGRULAMA: silme kapisi anon a ACIK.';
  end if;

  -- Yönetim kapılarının gövdesinde platform kapısı var mı?
  if (select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'app' and p.proname = 'mevzuat_yaz')
     !~ 'app\.platform_kapisi\(\)' then
    raise exception '0113 DOGRULAMA: yazma kapisinda platform kapisi yok.';
  end if;

  -- ⚠️ İmza PARAMETRE OLARAK BİLE olmamalı (0087).
  if (select count(*) from information_schema.parameters
       where specific_schema = 'app'
         and specific_name in (select specific_name from information_schema.routines
                                where routine_schema = 'app' and routine_name = 'mevzuat_yaz')
         and parameter_name in ('p_created_by','p_updated_by','p_created_at','p_updated_at')) > 0 then
    raise exception '0113 DOGRULAMA: imza alani parametreye girmis.';
  end if;

  raise notice '0113 TAMAM · mevzuat akisi kuruldu; vitrin okumasi acik, '
    'yonetim yalniz platformda, kaynak adresi https zorunlu.';
end $$;


-- ── ÖZET ──────────────────────────────────────────────────────────────────
select 'tablo' as ne, 'regulation_news (kiraciya bagli DEGIL)' as deger
union all
select 'vitrin okumasi', 'public.mevzuat_akisi_oku(limit) · anon · yalniz YAYINDA'
union all
select 'yonetim', 'liste/yaz/sil · yalniz platform.manage'
union all
select 'kaynak adresi', 'https:// ZORUNLU (kisit + fonksiyon)'
union all
select 'kayit sayisi', (select count(*)::text from public.regulation_news)
union all
select 'yayindaki kayit', (select count(*)::text from public.regulation_news where status='YAYINDA')
union all
select 'dogrulama', 'gecti';
