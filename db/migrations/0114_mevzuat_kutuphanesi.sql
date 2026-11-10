-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0114 — MEVZUAT KÜTÜPHANESİ (kalıcı bağlantılar) · tür kolonu
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- Emrah (10.11.2026) `gidamo.org.tr/mevzuat/ilgili-mevzuat` sayfasını
-- göstererek: *"ben aslında bu adresteki gibi olsun istemiştim."*
--
-- ⚠️ O SAYFA BİR HABER AKIŞI DEĞİL. Ölçüldü (ekran görüntüsü): üç başlık,
-- üç bağlantı —
--     Kanunlar    → "Gıda İle İlgili Kanunlar"
--     Yönetmelik  → "...Tüm Yönetmelikler"
--     Tebliğler   → "...Tüm Tebliğler"
-- Üçü de `mevzuat.gov.tr`deki tam listeye gidiyor. Yani kırk maddelik bir
-- katalog değil, **üç kalıcı kapı**: elle bakımı neredeyse sıfır,
-- bozulacak bir ayrıştırıcı yok, içeriğin güncelliği kaynağın kendi işi.
--
-- 0113 ise bir HABER AKIŞI kurmuştu: tarihli, en yeni üstte. Emrah ilk
-- kaydı girince ikisinin tutmadığı görüldü — girdiği şey bir mevzuattı
-- ("Yönetmelik", 17.12.2011) ve ekran eski bir tarihi öne çıkarıyordu.
--
-- ── EMRAH OTOMATİK TOPLAMA DA İSTEDİ · neden bugün değil ────────────────
-- *"Sistem kendi bulsun haberlerini."* Ölçüldü: Resmî Gazete'nin resmî
-- bir RSS/JSON/API ucu BULUNAMADI; bunu yapanlar günlük dizin sayfasını
-- HTML ayrıştırarak okuyor ve kaynak sitesi değiştiğinde SESSİZCE boş
-- döner. Karar (Emrah, 10.11): **önce kütüphane** (bozulmaz, bakım
-- istemez), otomatik toplama demo sonrasına.
-- ⚠️ Bu tablo o gün de değişmeyecek: toplayıcı eklendiğinde satırlar
-- `tur='HABER'` ve `status='TASLAK'` olarak düşecek.
--
-- ── KARAR · İKİNCİ TABLO AÇILMIYOR ───────────────────────────────────────
-- `regulation_news`e bir `kind` kolonu ekleniyor:
--     HABER                        → akış (ileride otomatik beslenecek)
--     KANUN · YONETMELIK · TEBLIG  → kütüphane (kalıcı bağlantılar)
--
-- ⚠️ İkinci bir tablo açmak aynı kapıları (RLS, platform kapısı, https
-- zorunluluğu, imza damgası) İKİNCİ KEZ yazmak olurdu — iki yerde iki
-- gerçek. Bu depodaki en pahalı hata sınıfı tam budur. Tek tablo, tek
-- kapı, iki görünüm.
--
-- ⚠️ VARSAYILAN `HABER` ve bu bilinçli: 0113'ten gelen satırlar haber
-- olarak yazılmıştı. Varsayılanı başka bir şey yapmak, var olan kaydın
-- türünü SESSİZCE değiştirmek olurdu. Kaç satırın böyle kaldığını göçün
-- özeti SÖYLÜYOR ki elle düzeltilebilsin.
--
-- ── TEK OKUMA FONKSİYONU ─────────────────────────────────────────────────
-- Vitrin tek çağrıyla hem kütüphaneyi hem akışı alıyor; `tur` alanı da
-- dönüyor ve sıralama sunucuda sabit: kanun → yönetmelik → tebliğ →
-- haber, her birinin içinde tarihe göre.
-- ⚠️ İkinci bir okuma fonksiyonu açmak ikinci bir kapı demekti; aynı
-- süzgeci (`YAYINDA`) iki yerde tutmak gerekirdi.
--
-- ⚠️ FONKSİYONLAR ÖNCE DÜŞÜRÜLÜYOR, SONRA YAZILIYOR. `create or replace`
-- dönüş tipi ya da parametre sayısı değişince ESKİSİNİ DEĞİŞTİRMEZ,
-- YANINA İKİNCİSİNİ KOYAR; çağrılar belirsizleşir. Düşürülen fonksiyonun
-- YETKİLERİ DE GİDER — aşağıda hepsi yeniden veriliyor ve ölçülüyor.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0 · 0113 YÜRÜRLÜKTE Mİ ───────────────────────────────────────────────
do $$
begin
  if to_regclass('public.regulation_news') is null then
    raise exception '0114: GOC 0113 YURURLUKTE DEGIL (regulation_news yok). '
      'Once 0113 uygulanmali.';
  end if;
  raise notice '0114: 0113 yururlukte, olculdu. Devam.';
end $$;


-- ── 1 · TÜR KOLONU ───────────────────────────────────────────────────────
alter table public.regulation_news
  add column if not exists kind text not null default 'HABER';

alter table public.regulation_news drop constraint if exists regulation_news_tur_gecerli;
alter table public.regulation_news
  add constraint regulation_news_tur_gecerli check (
    kind in ('HABER','KANUN','YONETMELIK','TEBLIG')
  );

comment on column public.regulation_news.kind is
  'HABER = akis (ileride otomatik beslenecek) · KANUN/YONETMELIK/TEBLIG = '
  'kutuphane (kalici baglantilar). Varsayilan HABER: 0113ten gelen '
  'satirlarin turunu sessizce degistirmemek icin (0114).';

-- Vitrin sorgusu: yayındakiler, tür sırasına göre.
drop index if exists public.regulation_news_yayin_tarih;
create index if not exists regulation_news_yayin_tur
  on public.regulation_news (status, kind, published_on desc);


-- ── 2 · VİTRİN OKUMASI · tür de dönüyor ──────────────────────────────────
-- ⚠️ Dönüş tipi değiştiği için önce DÜŞÜRÜLÜYOR.
drop function if exists public.mevzuat_akisi_oku(integer);

create or replace function public.mevzuat_akisi_oku(p_limit integer default 12)
returns table (
  baslik        text,
  ozet          text,
  kaynak_adi    text,
  kaynak_adresi text,
  yayim_tarihi  date,
  tur           text
)
language plpgsql
stable
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_adet integer;
begin
  -- ⚠️ TAVAN SUNUCUDA. İstemci "hepsini ver" diyemez; giriş ekranını da
  -- veritabanını da yorar.
  v_adet := least(greatest(coalesce(p_limit, 12), 1), 30);

  return query
  select r.title, r.summary, r.source_name, r.source_url, r.published_on, r.kind
    from public.regulation_news r
   where r.status = 'YAYINDA'
   order by case r.kind
              when 'KANUN'      then 1
              when 'YONETMELIK' then 2
              when 'TEBLIG'     then 3
              else 4
            end,
            r.published_on desc, r.created_at desc
   limit v_adet;
end $$;

comment on function public.mevzuat_akisi_oku(integer) is
  'Giris vitrininin okudugu tek kapi: kutuphane + akis. Yalniz YAYINDA '
  'satirlar; status ve imzalar disari CIKMAZ. Sira: kanun, yonetmelik, '
  'teblig, haber. Tavan sunucuda (en cok 30).';


-- ── 3 · YÖNETİM LİSTESİ · tür de dönüyor ─────────────────────────────────
drop function if exists public.mevzuat_listesi();
drop function if exists app.mevzuat_listesi();

create or replace function app.mevzuat_listesi()
returns table (
  kimlik        uuid,
  baslik        text,
  ozet          text,
  kaynak_adi    text,
  kaynak_adresi text,
  yayim_tarihi  date,
  tur           text,
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
         r.published_on, r.kind, r.status, r.created_at, y.full_name,
         r.updated_at, s.full_name
    from public.regulation_news r
    left join public.app_user y on y.id = r.created_by
    left join public.app_user s on s.id = r.updated_by
   order by case r.kind
              when 'KANUN'      then 1
              when 'YONETMELIK' then 2
              when 'TEBLIG'     then 3
              else 4
            end,
            r.published_on desc, r.created_at desc;
end $$;

create or replace function public.mevzuat_listesi()
returns table (
  kimlik        uuid,
  baslik        text,
  ozet          text,
  kaynak_adi    text,
  kaynak_adresi text,
  yayim_tarihi  date,
  tur           text,
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


-- ── 4 · YAZMA · tür ZORUNLU ──────────────────────────────────────────────
-- ⚠️ Parametre sayısı değiştiği için eski imza DÜŞÜRÜLÜYOR.
drop function if exists public.mevzuat_yaz(uuid, text, text, text, text, date, text);
drop function if exists app.mevzuat_yaz(uuid, text, text, text, text, date, text);

create or replace function app.mevzuat_yaz(
  p_id           uuid,
  p_baslik       text,
  p_ozet         text,
  p_kaynak_adi   text,
  p_kaynak_adres text,
  p_yayim_tarihi date,
  p_tur          text,
  p_durum        text default 'TASLAK'
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_kim    uuid;
  v_baslik text;
  v_ozet   text;
  v_kaynak text;
  v_adres  text;
  v_tur    text;
  v_durum  text;
  v_id     uuid;
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

  -- ⚠️ ADRES KAPISI. Bu bağlantı giriş ekranında TIKLANABİLİR çiziliyor;
  -- `javascript:` bir değer ziyaretçinin tarayıcısında kod çalıştırırdı.
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

  -- ⚠️ TÜR ZORUNLU (0114). Vitrin satırın hangi başlık altına gireceğini
  -- türden okuyor; türsüz bir satırın yeri yok.
  v_tur := upper(btrim(coalesce(p_tur, '')));
  if v_tur not in ('HABER','KANUN','YONETMELIK','TEBLIG') then
    raise exception 'Tür seçilmedi (kanun, yönetmelik, tebliğ ya da haber).'
      using errcode = 'MI422';
  end if;

  if p_yayim_tarihi is null then
    raise exception 'Yayım tarihi yazılmadı.' using errcode = 'MI422';
  end if;
  -- ⚠️ Bir gün pay: sunucu UTC, Türkiye UTC+3. Akşam 21:00'den sonra
  -- Türkiye'de "bugün" olan gün sunucuda hâlâ dünkü olabilir.
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
      (title, summary, source_name, source_url, published_on, kind,
       status, created_by, updated_by)
    values (v_baslik, v_ozet, v_kaynak, v_adres, p_yayim_tarihi, v_tur,
            v_durum, v_kim, v_kim)
    returning id into v_id;
  else
    update public.regulation_news
       set title        = v_baslik,
           summary      = v_ozet,
           source_name  = v_kaynak,
           source_url   = v_adres,
           published_on = p_yayim_tarihi,
           kind         = v_tur,
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
  p_tur          text,
  p_durum        text default 'TASLAK'
)
returns uuid
language sql
volatile
security definer
set search_path = public, app, pg_temp
as $$
  select app.mevzuat_yaz(p_id, p_baslik, p_ozet, p_kaynak_adi,
                         p_kaynak_adres, p_yayim_tarihi, p_tur, p_durum)
$$;


-- ── 5 · KAPILAR YENİDEN KAPATILIYOR (tuzak 67) ───────────────────────────
-- ⚠️ DÜŞÜRÜLÜP yeniden yazılan fonksiyonun YETKİLERİ DE GİTTİ. Yeni
-- fonksiyon varsayılan olarak PUBLIC'e açıktır; kapatmayı unutmak 0113'te
-- kurulan kapıyı sessizce açık bırakırdı.
do $$
declare v_ad text;
begin
  foreach v_ad in array array[
    'app.mevzuat_listesi()',
    'app.mevzuat_yaz(uuid, text, text, text, text, date, text, text)',
    'app.mevzuat_sil(uuid)'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('revoke all on function %s from anon', v_ad);
    execute format('revoke all on function %s from authenticated', v_ad);
    execute format('grant execute on function %s to service_role', v_ad);
  end loop;

  execute 'revoke all on function public.mevzuat_akisi_oku(integer) from public';
  execute 'grant execute on function public.mevzuat_akisi_oku(integer) '
          'to anon, authenticated, service_role';

  foreach v_ad in array array[
    'public.mevzuat_listesi()',
    'public.mevzuat_yaz(uuid, text, text, text, text, date, text, text)',
    'public.mevzuat_sil(uuid)'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('revoke all on function %s from anon', v_ad);
    execute format('grant execute on function %s to authenticated, service_role', v_ad);
  end loop;
end $$;


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
declare v_say int; v_govde text;
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='regulation_news'
                    and column_name='kind') then
    raise exception '0114 DOGRULAMA: kind kolonu olusmadi.';
  end if;

  -- ⚠️ ESKİ İMZA KALMAMALI: kalsaydı çağrılar belirsizleşirdi.
  select count(*) into v_say from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname in ('app','public') and p.proname = 'mevzuat_yaz';
  if v_say <> 2 then
    raise exception '0114 DOGRULAMA: mevzuat_yaz % adet (2 olmali); eski imza kalmis.', v_say;
  end if;
  select count(*) into v_say from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname = 'public' and p.proname = 'mevzuat_akisi_oku';
  if v_say <> 1 then
    raise exception '0114 DOGRULAMA: mevzuat_akisi_oku % adet (1 olmali).', v_say;
  end if;

  select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'mevzuat_akisi_oku';
  if v_govde !~ 'r\.kind' then
    raise exception '0114 DOGRULAMA: vitrin turu dondurmuyor.';
  end if;
  if v_govde !~ 'YONETMELIK' then
    raise exception '0114 DOGRULAMA: vitrin tur sirasina gore vermiyor.';
  end if;
  if v_govde !~ 'YAYINDA' then
    raise exception '0114 DOGRULAMA: vitrin suzgeci dustu; taslak sizar.';
  end if;

  select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'mevzuat_yaz';
  if v_govde !~ 'Tür seçilmedi' then
    raise exception '0114 DOGRULAMA: tur zorunlu degil.';
  end if;
  if v_govde !~ 'app\.platform_kapisi\(\)' then
    raise exception '0114 DOGRULAMA: platform kapisi dustu.';
  end if;
  if v_govde !~ 'https://' then
    raise exception '0114 DOGRULAMA: adres kapisi dustu.';
  end if;

  -- ⚠️ YETKİLER: düşürülen fonksiyonun yetkileri de gider.
  if not has_function_privilege('anon', 'public.mevzuat_akisi_oku(integer)', 'execute') then
    raise exception '0114 DOGRULAMA: vitrin okumasi anon a kapali kaldi.';
  end if;
  if has_function_privilege('anon', 'public.mevzuat_listesi()', 'execute') then
    raise exception '0114 DOGRULAMA: yonetim listesi anon a ACIK.';
  end if;
  if has_function_privilege('anon',
       'public.mevzuat_yaz(uuid, text, text, text, text, date, text, text)', 'execute') then
    raise exception '0114 DOGRULAMA: yazma kapisi anon a ACIK.';
  end if;
  if not has_function_privilege('authenticated',
       'public.mevzuat_yaz(uuid, text, text, text, text, date, text, text)', 'execute') then
    raise exception '0114 DOGRULAMA: yazma kapisi oturumlu kullaniciya kapali kaldi.';
  end if;

  raise notice '0114 TAMAM · mevzuat kutuphanesi kuruldu; vitrin kanun/'
    'yonetmelik/teblig/haber sirasina gore veriyor.';
end $$;


-- ── ÖZET ──────────────────────────────────────────────────────────────────
-- ⚠️ "HABER kalan kayit" satiri bilerek var: var olan satirlarin turu
-- SESSIZCE degistirilmedi, kac tane oldugunu burada soyluyoruz.
select 'turler' as ne, 'HABER (akis) · KANUN · YONETMELIK · TEBLIG (kutuphane)' as deger
union all
select 'vitrin sirasi', 'kanun > yonetmelik > teblig > haber, icinde tarihe gore'
union all
select 'tur yeni kayitta', 'ZORUNLU'
union all
select 'toplam kayit', (select count(*)::text from public.regulation_news)
union all
select 'HABER kalan kayit (turu elle duzeltilecek)',
       (select count(*)::text from public.regulation_news where kind = 'HABER')
union all
select 'dogrulama', 'gecti';
