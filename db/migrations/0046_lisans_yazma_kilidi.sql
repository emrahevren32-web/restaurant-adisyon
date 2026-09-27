-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · 0046 — LİSANS BİTİNCE YAZMA KİLİDİ
-- ═══════════════════════════════════════════════════════════════════════════
-- Emrah kararı (b şıkkı): "Lisans bitince yeni kayıt girilemesin ama veri
-- okunabilsin." Yani kapı kapanır, kasa açık kalır. Müşteri kendi verisine
-- her zaman erişir — bu bir rehin alma aracı değil, bir abonelik sınırı.
--
-- ── NİÇİN VERİTABANINDA, ARAYÜZDE DEĞİL ───────────────────────────────────
-- Arayüzdeki bir kontrol yalnızca düğmeyi gizler. Aynı oturumun jetonuyla
-- doğrudan API'ye yazmak hâlâ mümkün olur. Sınır, veriyi tutan yerde
-- durmuyorsa sınır değildir.
--
-- ── NİÇİN RLS DEĞİL, TETİK ────────────────────────────────────────────────
-- Mevcut politikalar tek parça: `using` hem SELECT'i hem UPDATE/DELETE'i,
-- `with check` INSERT'i yönetiyor. Lisans şartını `using`e koymak OKUMAYI
-- da kapatırdı — istediğimizin tam tersi. Komut başına ayrı politikaya
-- bölmek 35 tabloda RLS'i baştan yazmak demek: en çok korktuğumuz şeyi
-- (izolasyonu) elleyen bir göç. Üstelik RLS reddi "new row violates
-- row-level security policy" der; müşteri bundan hiçbir şey anlamaz.
--
-- Tetik ise EKLEMELİ: okuma yoluna hiç dokunmuyor, ters giderse tek
-- komutla kalkıyor ve reddi TÜRKÇE bir cümleyle söylüyor.
--
-- ── NİÇİN SATIR BAŞINA DEĞİL, KOMUT BAŞINA ────────────────────────────────
-- `for each statement`: Excel'den 5.000 satır aktarılırken lisans 5.000 kez
-- sorgulanmaz, bir kez sorgulanır. Lisans bir komutun ortasında değişmez.
--
-- ── KİLİT NEYE BAKAR ──────────────────────────────────────────────────────
-- `status` alanına DEĞİL, `end_date`e bakar. Çünkü bu şemada hiçbir şey
-- statüyü kendiliğinden 'Süresi Doldu'ya çevirmiyor — bir gece işi yok.
-- Statüye bakan bir kilit, süresi dolmuş her lisansı 'Aktif' görüp asla
-- kapanmazdı. Takvim yalan söylemez.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · KARAR FONKSİYONU ──────────────────────────────────────────────────
-- Dört durumda yazmaya İZİN VERİR:
--   a) Oturumda kiracı yok (NULL). Göç, service_role işi, yerel betik.
--      ⚠️ Bu şart olmazsa bu migration'ın kendisi bile çalışmaz.
--   b) Kiracı platformun kendisi. Evren360'a lisans sınırı uygulanmaz.
--   c) Kiracının hiç lisans satırı yok. Kilidi "veri eksikliği" üzerine
--      kurmuyoruz: eksik kayıt, müşteriyi kilitlemek için gerekçe değil.
--   d) Aktif/Deneme bir lisans var ve bitiş tarihi bugünü kapsıyor.
create or replace function app.lisans_yazmaya_izin_veriyor_mu()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := app.current_tenant_id();
  v_var    boolean;
  v_gecerli boolean;
begin
  if v_tenant is null then
    return true;                                  -- (a)
  end if;

  if exists (select 1 from public.tenant where id = v_tenant and is_platform) then
    return true;                                  -- (b)
  end if;

  select exists (select 1 from public.tenant_license where tenant_id = v_tenant)
    into v_var;

  if not v_var then
    return true;                                  -- (c)
  end if;

  select exists (
    select 1 from public.tenant_license
     where tenant_id = v_tenant
       and status in ('Deneme', 'Aktif')
       and end_date >= current_date
  ) into v_gecerli;

  return v_gecerli;                               -- (d)
end;
$$;

comment on function app.lisans_yazmaya_izin_veriyor_mu() is
  'Bu oturum yeni kayıt yazabilir mi? Lisans bitmişse false. Oturumda kiracı '
  'yoksa, kiracı platformsa veya hiç lisans satırı yoksa true. Okumayı hiç '
  'etkilemez — yalnızca 0046 yazma kilidi bunu kullanır.';

-- ── 2 · KİLİT TETİĞİ ──────────────────────────────────────────────────────
create or replace function app.lisans_yazma_kilidi()
returns trigger
language plpgsql
as $$
begin
  if app.lisans_yazmaya_izin_veriyor_mu() then
    return null;      -- statement tetiğinde dönüş yok sayılır; yol açık.
  end if;

  raise exception
    'Lisans süresi doldu. Kayıtlarınız yerinde ve okunabilir; yeni kayıt '
    'eklenemez, mevcut kayıt değiştirilemez. Şirket Ayarları > Lisans '
    'ekranından ek süre talebi iletebilirsiniz.'
    using errcode = 'MI410';
end;
$$;

comment on function app.lisans_yazma_kilidi() is
  'Lisans bitmişse yazmayı MI410 ile reddeder. Komut başına çalışır '
  '(for each statement), satır başına değil.';

-- ── 3 · TETİĞİ BÜTÜN KİRACI TABLOLARINA TAK ───────────────────────────────
-- Tablo listesi ELLE YAZILMIYOR, veritabanından okunuyor: yarın eklenecek
-- kiracı tablosu da kendiliğinden kapsama giriyor. Elle yazılmış liste, en
-- çok ihtiyaç duyulduğu anda eksik kalır (izolasyon provasındaki aynı ders).
do $$
declare
  v_tablo text;
  v_sayac int := 0;

  -- ⚠️ MUAF TABLOLAR — HER BİRİNİN GEREKÇESİ YAZILI OLMAK ZORUNDA.
  --
  --  · license_extension_request
  --      EN ÖNEMLİSİ. Müşteri ek süreyi tam da lisansı BİTTİĞİNDE talep
  --      eder. Bu tabloyu kilitlemek, kapıyı kilitleyip anahtarı içeride
  --      bırakmaktır. Kilidin kendisini anlamsız kılar.
  --  · tenant_license / license_event / license_package /
  --    license_package_module
  --      Lisansın kendi kayıtları. Uzatmayı platform yazar; kilidin
  --      uzatmanın önüne geçmesi saçma olurdu.
  --  · client_error
  --      Hata defteri. Lisans bittiğinde ekranda çıkan hatayı da yazamazsak
  --      neyin bozulduğunu asla öğrenemeyiz.
  --  · tenant_backup_log
  --      Yedek günlüğü; platform işi (0029). Müşterinin lisansı bitse de
  --      yedeği alınmaya devam eder — veri okunabilir kalacaksa korunmalı da.
  --  · business_application / business_application_event
  --      Platform tabloları (0032). Yeni başvuru bir kiracı yazımı değil.
  --  · audit_log
  --      Denetim kaydı (0027). ⚠️ BU MUAFİYET ZORUNLU, tercih değil:
  --      denetim, izin verilen yazımların TETİĞİNDEN yazılıyor. Muaf
  --      olmazsa, kilidin bile bile serbest bıraktığı bir işlem (ek süre
  --      talebi) denetim satırında takılır ve reddedilir. Provada tam
  --      olarak bu oldu: ilk yazımda tablo adını `audit_event` sanmıştım,
  --      gerçek ad `audit_log`; yanlış ad yüzünden muafiyet hiç işlemedi
  --      ve süre talebi kilitlendi. Ders: muafiyet listesindeki her ad
  --      şemadan doğrulanır, akıldan yazılmaz.
  v_muaf text[] := array[
    'license_extension_request',
    'tenant_license', 'license_event', 'license_package', 'license_package_module',
    'client_error', 'tenant_backup_log',
    'business_application', 'business_application_event',
    'audit_log'
  ];
begin
  for v_tablo in
    select c.table_name
      from information_schema.columns c
      join pg_tables t on t.tablename = c.table_name and t.schemaname = 'public'
     where c.table_schema = 'public'
       and c.column_name  = 'tenant_id'
       and not (c.table_name = any (v_muaf))
     group by c.table_name
     order by c.table_name
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      'trg_lisans_kilidi_' || v_tablo, v_tablo);

    execute format(
      'create trigger %I before insert or update or delete on public.%I '
      'for each statement execute function app.lisans_yazma_kilidi()',
      'trg_lisans_kilidi_' || v_tablo, v_tablo);

    v_sayac := v_sayac + 1;
  end loop;

  raise notice '0046: yazma kilidi % kiracı tablosuna takıldı.', v_sayac;

  if v_sayac < 20 then
    raise exception
      '0046: yalnızca % tabloya takıldı. Kiracı tablosu sayısı bundan çok '
      'daha fazla — tablo keşfi bozulmuş olmalı.', v_sayac;
  end if;
end;
$$;

-- ── 4 · MUAF TABLOLARDA TETİK OLMADIĞINI DOĞRULA ──────────────────────────
-- Muafiyet listesi yazıldı diye uygulanmış saymıyoruz. Özellikle
-- `license_extension_request`: orada bir tetik varsa kilit kendi kendini
-- kilitler ve bunu ancak müşteri lisansı bittiğinde fark ederiz.
do $$
declare
  v_kacak text;
begin
  select string_agg(c.relname, ', ')
    into v_kacak
    from pg_trigger g
    join pg_class c on c.oid = g.tgrelid
   where g.tgname like 'trg_lisans_kilidi_%'
     and c.relname in (
       'license_extension_request', 'tenant_license', 'license_event',
       'license_package', 'license_package_module',
       'client_error', 'tenant_backup_log',
       'business_application', 'business_application_event', 'audit_log');

  if v_kacak is not null then
    raise exception '0046: muaf olması gereken tabloya kilit takılmış: %', v_kacak;
  end if;
end;
$$;

-- ── 4B · MUAFİYET ADLARI ŞEMADA VAR MI ───────────────────────────────────
-- Yanlış yazılmış bir muafiyet adı hata vermez, sessizce hiçbir şeyi muaf
-- etmez — ve bunu ancak müşterinin lisansı bittiğinde fark ederiz. Bu blok
-- tam da o sessizliği kırıyor. (Provada `audit_event` yazmıştım, tablonun
-- gerçek adı `audit_log`'du.)
do $$
declare
  v_yok text;
begin
  select string_agg(a, ', ') into v_yok
    from unnest(array[
      'license_extension_request',
      'tenant_license', 'license_event', 'license_package', 'license_package_module',
      'client_error', 'tenant_backup_log',
      'business_application', 'business_application_event',
      'audit_log'
    ]) as a
   where not exists (
     select 1 from pg_tables where schemaname = 'public' and tablename = a);

  if v_yok is not null then
    raise exception '0046: muafiyet listesinde şemada olmayan tablo adı var: %. '
                    'Yanlış yazılmış bir ad hiçbir şeyi muaf etmez.', v_yok;
  end if;
end;
$$;

-- ── 5 · DAVRANIŞ SINAMASI · GÖÇ OTURUMU KİLİTLENMEMELİ ────────────────────
-- Bu migration'ın kendisi bir "kiracısız" oturumda koşuyor. (a) şartı
-- bozulursa buradan sonraki HER göç kilitlenir. O yüzden kuralı, kuralın
-- kurulduğu yerde sınıyoruz.
--
-- ⚠️ Geçmişte iki kez, sınama bloğu SINAMADIĞI bir duruma bel bağladı
-- (0044: lisansın 'Deneme' olduğunu varsaydı, canlıda 'Aktif'ti). Bu yüzden
-- burada tek bir DEĞİŞMEZ sınanıyor: kiracısız oturum yazabilir.
do $$
begin
  if app.current_tenant_id() is not null then
    raise notice '0046: göç oturumunda kiracı var (%), sınama atlandı.',
      app.current_tenant_id();
    return;
  end if;

  if not app.lisans_yazmaya_izin_veriyor_mu() then
    raise exception '0046: kiracısız oturum yazamıyor — bu haliyle bütün '
                    'göçler kilitlenir.';
  end if;

  raise notice '0046 TAMAM · kilit kuruldu · kiracısız oturum serbest · '
               'okuma yolu hiç ellenmedi';
end;
$$;
