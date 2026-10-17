\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

create or replace function prova_oturum(p_auth uuid, p_tenant uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', p_tenant)::text, false);
  perform set_config('app.tenant_id', p_tenant::text, false);
end; $$;

create or replace function prova_oturumsuz() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{}', false);
end; $$;

-- ── KURULUM: bir PLATFORM kiracısı, bir MÜŞTERİ kiracısı ──────────────────
do $$
declare
  v_platform uuid; v_pfirma uuid;
  v_padmin   uuid := gen_random_uuid();   -- platform yöneticisi (auth id)
  v_must     uuid := gen_random_uuid();   -- müşteri kiracı
  v_mfirma   uuid := gen_random_uuid();
  v_msube    uuid := gen_random_uuid();
  v_msube2   uuid := gen_random_uuid();
  v_mkul1    uuid := gen_random_uuid();   -- auth id
  v_mkul2    uuid := gen_random_uuid();
  v_mapp1    uuid := gen_random_uuid();   -- app_user id
  v_paket    uuid;
  v_kalem    uuid := gen_random_uuid();
  v_ie       uuid := gen_random_uuid();
  v_sevk     uuid := gen_random_uuid();
  v_musteri_kart uuid;
  v_basvuru uuid := gen_random_uuid();
begin
  perform prova_oturumsuz();

  select t.id into v_platform from public.tenant t where t.is_platform limit 1;
  select c.id into v_pfirma from public.company c where c.tenant_id = v_platform limit 1;

  -- Platform yöneticisi: super_admin
  insert into auth.users (id, email, last_sign_in_at)
  values (v_padmin, 'p83.platform@miyop.local', now() - interval '1 hour');
  insert into public.app_user (tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_platform, v_pfirma, v_padmin, 'p83_platform', 'p83_platform',
          'Platform Yöneticisi', 'super_admin', true);

  -- ── MÜŞTERİ KİRACI ──────────────────────────────────────────────────────
  insert into public.tenant (id, code, name, status, created_at)
  values (v_must, 'P83MUS', 'P83 Gıda Sanayi A.Ş.', 'Aktif', now() - interval '40 days');

  insert into public.company (
    id, tenant_id, company_code, company_name, legal_name,
    tax_office, tax_number, phone, email, website,
    address, city, district, authorized_person, authorized_title,
    authorized_phone, authorized_email, primary_sector_id)
  values (v_mfirma, v_must, 'P83MUS', 'P83 Gıda', 'P83 Gıda Sanayi ve Ticaret A.Ş.',
          'Kozyatağı', '1234567890', '02161112233', 'bilgi@p83.local', 'www.p83.local',
          'Organize Sanayi Bölgesi 5. Cadde No:7', 'İstanbul', 'Ataşehir',
          'Ayşe Demir', 'Genel Müdür', '05321112233', 'ayse@p83.local',
          'sector_industrial_kitchen');

  insert into public.branch (id, tenant_id, company_id, code, name, branch_type)
  values (v_msube,  v_must, v_mfirma, 'MRK', 'Merkez', 'merkez'),
         (v_msube2, v_must, v_mfirma, 'URT', 'Üretim',  'uretim');

  -- Onaylanmış başvuru: çalışan ve şube beyanı buradan geliyor
  -- ⚠️ Başvuru PENDING olarak açılır (0032 kuralı), sonra onaylanır.
  insert into public.business_application (
    id, sector_code, company_name, owner_name, phone, email,
    tax_number, tax_office, city, district, address, staff_count, branch_count)
  values (v_basvuru, 'endustriyel-mutfak', 'P83 Gıda', 'Ayşe Demir',
          '02161112233', 'bilgi@p83.local', '1234567890', 'Kozyatağı',
          'İstanbul', 'Ataşehir', 'OSB 5. Cadde No:7', 48, 2);
  -- PENDING → IN_REVIEW → APPROVED (0032 durum makinesi)
  update public.business_application
     set status = 'IN_REVIEW' where id = v_basvuru;
  update public.business_application
     set status = 'APPROVED',
         decision_note = 'Uygun bulundu.',
         decided_at = now() - interval '40 days',
         tenant_id = v_must
   where id = v_basvuru;

  -- Lisans
  -- ⚠️ Başvuru onayı kiracıya ZATEN bir deneme lisansı açıyor (0043).
  -- İkinci satır eklemek `tenant_license_tek_yururluk` kuralını kırar;
  -- var olan satır ücretli lisansa çevriliyor.
  select p.id into v_paket from public.license_package p
   where p.code = 'endustriyel-mutfak-baslangic';
  if not exists (select 1 from public.tenant_license where tenant_id = v_must) then
    insert into public.tenant_license (tenant_id, package_id, license_key, status,
                                       start_date, end_date, is_trial, note)
    values (v_must, v_paket, 'P83-LIC-0001', 'Aktif',
            current_date - 40, current_date + 50, false, 'Prova lisansı');
  else
    update public.tenant_license
       set package_id = v_paket, status = 'Aktif', is_trial = false,
           start_date = current_date - 40, end_date = current_date + 50,
           note = 'Prova lisansı'
     where tenant_id = v_must;
  end if;

  -- Kullanıcılar: biri 2 gün önce girmiş, biri hiç girmemiş, biri pasif
  insert into auth.users (id, email, last_sign_in_at)
  values (v_mkul1, 'ayse@p83.local', now() - interval '2 days'),
         (v_mkul2, 'mehmet@p83.local', null);
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_mapp1, v_must, v_mfirma, v_mkul1, 'ayse', 'ayse',
          'Ayşe Demir', 'isletme_sahibi', true),
         (gen_random_uuid(), v_must, v_mfirma, v_mkul2, 'mehmet', 'mehmet',
          'Mehmet Yıldız', 'depo_sorumlusu', true),
         (gen_random_uuid(), v_must, v_mfirma, null, 'ayrilan', 'ayrilan',
          'Ayrılan Personel', 'personel', false);

  -- Denetim kaydı: Türkiye saatiyle 09:00 ve 14:00'te hareket
  insert into public.audit_log (tenant_id, table_name, row_id, action,
                                actor_name, occurred_at, summary)
  select v_must, 'stock_item', gen_random_uuid()::text, 'INSERT', 'Ayşe Demir',
         (current_date - 3 + time '09:30') at time zone 'Europe/Istanbul', 'prova'
  from generate_series(1, 5);
  insert into public.audit_log (tenant_id, table_name, row_id, action,
                                actor_name, occurred_at, summary)
  select v_must, 'stock_item', gen_random_uuid()::text, 'UPDATE', 'Ayşe Demir',
         (current_date - 3 + time '14:30') at time zone 'Europe/Istanbul', 'prova'
  from generate_series(1, 2);
  -- 200 gün önce: 30 günlük pencerenin DIŞINDA kalmalı
  insert into public.audit_log (tenant_id, table_name, row_id, action,
                                actor_name, occurred_at, summary)
  values (v_must, 'stock_item', gen_random_uuid()::text, 'INSERT', 'Eski',
          now() - interval '200 days', 'eski');

  -- Ürün, tamamlanmış iş emri, sevkiyat
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_kalem, v_must, v_msube, 'P83-URN', 'p83-urn', 'Hazır Köfte', 'kg');

  insert into public.work_order (id, tenant_id, branch_id, order_no,
                                 output_item_id, planned_qty, output_uom,
                                 status, completed_at)
  values (v_ie, v_must, v_msube, 'P83-IE-1', v_kalem, 120, 'kg',
          'COMPLETED', now() - interval '5 days');

  select mc.id into v_musteri_kart from public.customer mc where mc.tenant_id = v_must limit 1;
  if v_musteri_kart is null then
    insert into public.customer (tenant_id, code, code_key, name)
    values (v_must, 'P83-MUS', 'p83-mus', 'Prova Müşterisi')
    returning id into v_musteri_kart;
  end if;

  insert into public.shipment (id, tenant_id, branch_id, shipment_no, customer_id,
                               customer_name, status, created_at)
  values (v_sevk, v_must, v_msube, 'P83-SV-1', v_musteri_kart,
          'Prova Müşterisi', 'DRAFT', now() - interval '4 days');
  insert into public.shipment_line (tenant_id, shipment_id, line_no,
                                    stock_item_id, qty, uom)
  values (v_must, v_sevk, 1, v_kalem, 80, 'kg');

  perform set_config('prova.platform', v_platform::text, false);
  perform set_config('prova.padmin', v_padmin::text, false);
  perform set_config('prova.must', v_must::text, false);
  perform set_config('prova.mkul1', v_mkul1::text, false);
  raise notice 'KURULUM TAMAM';
end; $$;


-- ── 1 · KAPI: KİM ÇAĞIRABİLİYOR ───────────────────────────────────────────
do $$
declare v_hata text; v_adet int;
begin
  raise notice '── 1 · KAPI';

  -- Oturumsuz
  perform prova_oturumsuz();
  begin
    perform * from app.platform_musteri_listesi();
    perform prova_bak('oturumsuz çağrı reddedilmeli', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('oturumsuz çağrı MI403 alıyor', true);
  end;

  -- Müşteri kullanıcısı (isletme_sahibi — platform.manage YOK)
  perform prova_oturum(current_setting('prova.mkul1')::uuid,
                       current_setting('prova.must')::uuid);
  begin
    perform * from app.platform_musteri_listesi();
    perform prova_bak('müşteri kullanıcısı liste görememeli', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('müşteri kullanıcısı MI403 alıyor', true);
  end;

  begin
    perform * from app.platform_musteri_detayi(current_setting('prova.must')::uuid);
    perform prova_bak('müşteri kullanıcısı detay görememeli', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('müşteri kullanıcısı detayda da MI403 alıyor', true);
  end;

  begin
    perform * from app.platform_populer_urunler(current_setting('prova.must')::uuid);
    perform prova_bak('müşteri kullanıcısı ürünlerini platform fonksiyonuyla görememeli', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('ürün fonksiyonu da MI403 atıyor', true);
  end;

  -- ⚠️ EN ÖNEMLİSİ: HİÇ SATIR OLMAYAN durumda da kapı çalışmalı.
  -- Kapı WHERE içinde olsaydı burada sessizce boş liste dönerdi.
  perform prova_oturum(current_setting('prova.mkul1')::uuid,
                       current_setting('prova.must')::uuid);
  begin
    perform * from app.platform_kullanim_saatleri(gen_random_uuid());
    perform prova_bak('boş sonuçta bile kapı çalışmalı', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('boş sonuçta bile kapı çalışıyor (WHERE tuzağı yok)', true);
  end;
end; $$;


-- ── 2 · PLATFORM YÖNETİCİSİ MÜŞTERİSİNİ GÖRÜYOR ───────────────────────────
do $$
declare r record; v_adet int;
begin
  raise notice '── 2 · LİSTE';
  perform prova_oturum(current_setting('prova.padmin')::uuid,
                       current_setting('prova.platform')::uuid);

  select count(*) into v_adet from app.platform_musteri_listesi();
  perform prova_bak('platform yöneticisi liste alabiliyor', v_adet >= 1);

  perform prova_bak('platform kiracısı listede YOK',
    not exists (select 1 from app.platform_musteri_listesi() l
                 where l.kiraci_id = current_setting('prova.platform')::uuid));

  select * into r from app.platform_musteri_listesi() l
   where l.kiraci_id = current_setting('prova.must')::uuid;

  perform prova_bak('kiracı kodu doğru',      r.kiraci_kodu = 'P83MUS');
  perform prova_bak('firma adı doğru',        r.firma_adi = 'P83 Gıda');
  perform prova_bak('il/ilçe doğru',          r.il = 'İstanbul' and r.ilce = 'Ataşehir');
  perform prova_bak('sektör doğru',           r.sektor = 'sector_industrial_kitchen');
  perform prova_bak('lisans durumu Aktif',    r.lisans_durumu = 'Aktif');
  perform prova_bak('kalan gün 50',           r.kalan_gun = 50);
  perform prova_bak('kullanıcı sayısı 3',     r.kullanici_sayisi = 3);
  perform prova_bak('son giriş dolu',         r.son_giris is not null);
  perform prova_bak('son hareket dolu',       r.son_hareket is not null);
end; $$;


-- ── 3 · DETAY: EMRAH'IN LİSTESİ ───────────────────────────────────────────
do $$
declare r record;
begin
  raise notice '── 3 · DETAY';
  perform prova_oturum(current_setting('prova.padmin')::uuid,
                       current_setting('prova.platform')::uuid);

  select * into r from app.platform_musteri_detayi(current_setting('prova.must')::uuid);

  -- 1 · Şirket bilgileri
  perform prova_bak('1.1 ad',            r.firma_adi = 'P83 Gıda');
  perform prova_bak('1.1 ticari unvan',  r.ticari_unvan = 'P83 Gıda Sanayi ve Ticaret A.Ş.');
  perform prova_bak('1.2 sektör',        r.sektor = 'sector_industrial_kitchen');
  perform prova_bak('1.3 il/ilçe/adres', r.il = 'İstanbul' and r.ilce = 'Ataşehir'
                                         and r.adres like 'Organize%');
  perform prova_bak('1.4 telefon',       r.telefon = '02161112233');
  perform prova_bak('1.4 e-posta',       r.eposta = 'bilgi@p83.local');
  perform prova_bak('1.4 web sitesi',    r.web_sitesi = 'www.p83.local');
  perform prova_bak('1.5 beyan çalışan', r.beyan_calisan_sayisi = 48);
  perform prova_bak('1.5 beyan şube',    r.beyan_sube_sayisi = 2);
  perform prova_bak('1.5 kayıtlı şube',  r.kayitli_sube_sayisi = 2);

  -- 2 · Üyelik ve lisans
  perform prova_bak('2.1 kayıt tarihi',  r.kayit_tarihi < now() - interval '39 days');
  perform prova_bak('2.2 üyelik durumu', r.uyelik_durumu = 'Aktif');
  perform prova_bak('2.2 deneme değil',  r.deneme_mi = false);
  perform prova_bak('2.3 başlangıç',     r.lisans_baslangic = current_date - 40);
  perform prova_bak('2.3 bitiş',         r.lisans_bitis = current_date + 50);
  perform prova_bak('2.5 paket kodu',    r.paket_kodu = 'endustriyel-mutfak-baslangic');
  perform prova_bak('2.5 modüller dolu', array_length(r.moduller, 1) >= 1);

  -- 3 · Yetkili ve kullanıcı
  perform prova_bak('3.1 yetkili ad',    r.yetkili_ad = 'Ayşe Demir');
  perform prova_bak('3.1 yetkili unvan', r.yetkili_unvan = 'Genel Müdür');
  perform prova_bak('3.1 yetkili tel',   r.yetkili_telefon = '05321112233');
  perform prova_bak('3.2 kullanıcı 3',   r.kullanici_sayisi = 3);
  perform prova_bak('3.2 aktif 2',       r.aktif_kullanici = 2);
  perform prova_bak('3.3 son giriş',     r.son_giris between now() - interval '3 days' and now());

  -- 4 · Kullanım
  perform prova_bak('4.1 son hareket',   r.son_hareket is not null);
  -- ⚠️ Kurulum sırasında sistemin kendi yazdığı denetim kayıtları da var
  -- (başvuru onayı, lisans). Bizim 7 satırımız EN AZ o kadar olmalı.
  perform prova_bak('4.1 son 30 gün en az 7 işlem', r.son_30_gun_islem >= 7);

  -- 5 · Ödeme
  perform prova_bak('5.1 fiyat belirlenmedi', r.fiyat_belirlendi = false);

  -- Platform kiracısı detayda DÖNMÜYOR
  perform prova_bak('platform kiracısının detayı yok',
    not exists (select 1 from app.platform_musteri_detayi(
                  current_setting('prova.platform')::uuid)));
end; $$;


-- ── 4 · KULLANICILAR · SAATLER · ÜRÜNLER ──────────────────────────────────
do $$
declare v_adet int; v_t numeric; r record;
begin
  raise notice '── 4 · AYRINTI';
  perform prova_oturum(current_setting('prova.padmin')::uuid,
                       current_setting('prova.platform')::uuid);

  select count(*) into v_adet
    from app.platform_musteri_kullanicilari(current_setting('prova.must')::uuid);
  perform prova_bak('kullanıcı listesi 3 satır', v_adet = 3);

  perform prova_bak('pasif kullanıcı en sonda',
    (select k.aktif from app.platform_musteri_kullanicilari(
       current_setting('prova.must')::uuid) k offset 2 limit 1) = false);

  perform prova_bak('şifre/e-posta sütunu DÖNMÜYOR',
    (select count(*) from information_schema.routines ro
      join information_schema.parameters pa
        on pa.specific_name = ro.specific_name
     where ro.routine_name = 'platform_musteri_kullanicilari'
       and pa.parameter_name in ('eposta','email','sifre','password')) = 0);

  -- Saat dağılımı: Türkiye saatiyle 09 ve 14
  select count(*) into v_adet
    from app.platform_kullanim_saatleri(current_setting('prova.must')::uuid, 30);
  perform prova_bak('saat dağılımı dolu', v_adet >= 2);

  perform prova_bak('09:00 diliminde 5 işlem',
    (select s.islem_sayisi from app.platform_kullanim_saatleri(
       current_setting('prova.must')::uuid, 30) s where s.saat = 9) = 5);
  perform prova_bak('14:00 diliminde 2 işlem',
    (select s.islem_sayisi from app.platform_kullanim_saatleri(
       current_setting('prova.must')::uuid, 30) s where s.saat = 14) = 2);
  -- 200 gün önceki satır 30 günlük pencerede YOK, 365 günlükte VAR.
  perform prova_bak('200 gün öncesi 30 günlük pencerede yok',
    (select coalesce(sum(s.islem_sayisi), 0) from app.platform_kullanim_saatleri(
       current_setting('prova.must')::uuid, 30) s)
    <
    (select coalesce(sum(s.islem_sayisi), 0) from app.platform_kullanim_saatleri(
       current_setting('prova.must')::uuid, 365) s));

  -- Ürünler
  select u.toplam into v_t from app.platform_populer_urunler(
    current_setting('prova.must')::uuid) u where u.tur = 'uretim';
  perform prova_bak('en çok üretilen 120 kg', v_t = 120);

  select u.toplam into v_t from app.platform_populer_urunler(
    current_setting('prova.must')::uuid) u where u.tur = 'sevkiyat';
  perform prova_bak('en çok sevk edilen 80 kg', v_t = 80);

  perform prova_bak('ürün adı dönüyor',
    exists (select 1 from app.platform_populer_urunler(
              current_setting('prova.must')::uuid) u where u.urun = 'Hazır Köfte'));
end; $$;


-- ── 5 · KAPILAR VE SARMALAYICILAR ─────────────────────────────────────────
do $$
declare v_ad text; v_acl aclitem[]; v_app int; v_pub int;
begin
  raise notice '── 5 · KAPILAR';
  perform prova_oturumsuz();

  foreach v_ad in array array[
    'app.platform_kapisi()',
    'app.platform_musteri_listesi()',
    'app.platform_musteri_detayi(uuid)',
    'app.platform_musteri_kullanicilari(uuid)',
    'app.platform_kullanim_saatleri(uuid, integer)',
    'app.platform_populer_urunler(uuid, integer, integer)',
    'public.platform_musteri_listesi()',
    'public.platform_musteri_detayi(uuid)',
    'public.platform_musteri_kullanicilari(uuid)',
    'public.platform_kullanim_saatleri(uuid, integer)',
    'public.platform_populer_urunler(uuid, integer, integer)'
  ] loop
    perform prova_bak(v_ad || ' var', to_regprocedure(v_ad) is not null);

    -- ⚠️ TUZAK 80: proacl NULL = VARSAYILAN = PUBLIC AÇIK
    select coalesce(p.proacl, acldefault('f', p.proowner)) into v_acl
      from pg_proc p where p.oid = to_regprocedure(v_ad);
    perform prova_bak(v_ad || ' · PUBLIC kapalı',
      not exists (select 1 from aclexplode(v_acl) a
                   where a.grantee = 0 and a.privilege_type = 'EXECUTE'));
    perform prova_bak(v_ad || ' · anon kapalı',
      not has_function_privilege('anon', to_regprocedure(v_ad), 'execute'));
  end loop;

  -- `authenticated` yalnız public sarmalayıcıları çağırabilmeli
  perform prova_bak('authenticated public.platform_musteri_listesi çağırabiliyor',
    has_function_privilege('authenticated',
      to_regprocedure('public.platform_musteri_listesi()'), 'execute'));
  perform prova_bak('authenticated app.* çağıramıyor',
    not has_function_privilege('authenticated',
      to_regprocedure('app.platform_musteri_listesi()'), 'execute'));

  -- Sarmalayıcı sütun sayısı app fonksiyonuyla aynı mı?
  -- ⚠️ information_schema.parameters burada BOŞ döner; RETURNS TABLE
  -- sütunları pg_proc.proargmodes içinde 't' ile işaretli.
  select (select count(*) from unnest(p.proargmodes) m where m = 't')
    into v_app from pg_proc p
   where p.oid = to_regprocedure('app.platform_musteri_detayi(uuid)');
  select (select count(*) from unnest(p.proargmodes) m where m = 't')
    into v_pub from pg_proc p
   where p.oid = to_regprocedure('public.platform_musteri_detayi(uuid)');
  perform prova_bak(
    format('detay sarmalayıcısı app ile aynı sütunları veriyor (%s = %s)', v_app, v_pub),
    v_app = v_pub and v_app >= 40);

  -- Sarmalayıcı gerçekten çalışıyor mu?
  perform prova_oturum(current_setting('prova.padmin')::uuid,
                       current_setting('prova.platform')::uuid);
  perform prova_bak('public sarmalayıcı müşteriyi döndürüyor',
    exists (select 1 from public.platform_musteri_detayi(
              current_setting('prova.must')::uuid) d
             where d.firma_adi = 'P83 Gıda'));
end; $$;

rollback;
