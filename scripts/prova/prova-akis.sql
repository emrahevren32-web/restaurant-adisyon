-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Göç provası — UÇTAN UCA AKIŞ (yalnız yerel prova, göç DEĞİL)
--
-- ⚠️ BU DOSYA `db/migrations` ALTINDA DEĞİL VE OLMAMALI.
-- Sebebi: oturum taklit ediyor. Göçler her ortamda aynı şekilde çalışmak
-- zorunda; oturum taklidi yalnız burada meşru.
--
-- Göçlerin kendi doğrulama blokları oturumsuz çalışabilen kuralları sınar
-- (yetkisiz çağrı reddedildi mi, durum makinesi tuttu mu). Ama onayın
-- MUTLU YOLU oturum ister: kiracı/firma/şube yazma politikaları
-- `platform.manage` iznine bağlı. O yüzden akış burada sınanıyor.
--
-- Taklit iki ayardan oluşuyor:
--   `prova.uid`     → goc-prova.sh'ın kurduğu `auth.uid()` taklidi okur
--   `app.tenant_id` → `app.current_tenant_id()` okur (0001, gerçek yol)
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- MİYOP platform yöneticisi (0008'de kurulan UID).
set app.prova_auth = '141939e8-5779-43af-b468-9cbc8ee2b1fb';
select set_config('prova.uid', current_setting('app.prova_auth'), false);
select set_config('app.tenant_id', (select id::text from tenant where code = 'MIYOP'), false);

-- ⚠️ BURADA BİR ŞEY YAPMIYORUZ — VE BU BİLİNÇLİ.
--
-- Eskiden bu satırlar `user_role` tablosuna elle bir satır ekliyordu, çünkü
-- 0032'deki `app.yetkim_var` YALNIZ o tabloya bakıyordu. Provayı geçirmek
-- için attığım o satır, canlıdaki asıl sorunu benden SAKLADI: Emrah'ın
-- `user_role` satırı yoktu, ekran boş kaldı.
--
-- 0036 fonksiyonu 0015'in kuralına getirdi: etkin izin = birincil rol ∪ ek
-- roller. Artık prova canlıyla AYNI veriyle çalışıyor: yalnız
-- `app_user.role_code = 'admin'` var, `user_role` satırı YOK. Aşağıdaki
-- kontrol geçerse ekran da dolar.
do $$
begin
  if exists (select 1 from user_role ur
               join app_user u on u.id = ur.user_id
              where u.auth_user_id = current_setting('app.prova_auth')::uuid) then
    raise exception 'PROVA GECERSIZ: platform yoneticisine user_role satiri '
      'eklenmis. Prova canliyla ayni veriyle calismali; o satir canlida YOK.';
  end if;
end $$;

do $$
declare
  v_yetki boolean;
begin
  select app.yetkim_var('platform.manage') into v_yetki;
  if not v_yetki then
    raise exception 'PROVA KURULUMU BASARISIZ: platform.manage gorunmuyor. '
      'auth.uid() taklidi calismiyor ya da app.yetkim_var birincil role '
      '(app_user.role_code) bakmiyor -- 0036 oncesi hata tam buydu.';
  end if;
  raise notice 'Oturum taklidi hazir: user_role satiri YOK, platform.manage = % (birincil rolden)', v_yetki;
end $$;

-- ── Uçtan uca: başvur → incele → onayla ──────────────────────────────────
do $$
declare
  v_ref    text;
  v_id     uuid;
  v_sonuc  record;
  v_ikinci_red boolean := false;
  v_kiraci_adet int;
begin
  v_ref := public.basvuru_gonder(
    'Gümüş Tavukçuluk', 'Turgut Özer', '02324786854',
    'prova-akis@example.com', 'izmir', 'bornova',
    'pınarbaşı çamlık parkı karşısı', 2, 18,
    '39432904234', 'bornova', 'industrial-kitchen', 'prova akis notu');

  if v_ref !~ '^MIY-[23456789ACDEFGHJKMNPQRTUVWXYZ]{5}$' then
    raise exception 'Numara bicimi beklenmedik: %', v_ref;
  end if;

  select id into v_id from business_application where reference = v_ref;

  -- İncelemeye al (ekranın "İncele" düğmesinin yaptığı iş)
  update business_application set status = 'IN_REVIEW' where id = v_id;

  -- Onayla — DIŞ kapıdan, yani uygulamanın çağırdığı yoldan
  select * into v_sonuc
    from public.basvuruyu_onayla(v_id, 'belgeler tam, onaylandi');

  -- Kiracı kodu biçimi: GUM001 gibi (Türkçe harfler ASCII'ye indirilmiş)
  if v_sonuc.kiraci_kodu !~ '^[A-Z]{3}[0-9]{3}$' then
    raise exception 'Kiraci kodu beklenen bicimde degil: %', v_sonuc.kiraci_kodu;
  end if;
  if v_sonuc.kiraci_kodu not like 'GUM%' then
    raise exception 'Kiraci kodu isletme adindan turetilmedi: %', v_sonuc.kiraci_kodu;
  end if;

  if not exists (select 1 from tenant where id = v_sonuc.kiraci_id
                   and name = 'Gümüş Tavukçuluk') then
    raise exception 'Kiraci olusmadi ya da adi tasinmadi.';
  end if;

  -- Firma bilgileri başvurudan taşınmış olmalı: müşteri aynı şeyi ikinci
  -- kez yazmasın.
  if not exists (select 1 from company
                  where id = v_sonuc.firma_id
                    and tenant_id = v_sonuc.kiraci_id
                    and default_branch_id = v_sonuc.sube_id
                    and tax_number = '39432904234'
                    and authorized_person = 'Turgut Özer'
                    and primary_sector_id = 'sector_industrial_kitchen') then  -- 0041: tek yazim
    raise exception 'Firma olusmadi ya da basvuru bilgileri tasinmadi.';
  end if;

  if not exists (select 1 from branch where id = v_sonuc.sube_id
                   and is_head_office and branch_type = 'merkez') then
    raise exception 'Merkez sube olusmadi.';
  end if;

  if not exists (select 1 from business_application
                  where id = v_id and status = 'APPROVED'
                    and tenant_id = v_sonuc.kiraci_id) then
    raise exception 'Basvuru onaya gecmedi ya da kiraciya baglanmadi.';
  end if;

  -- Olay defteri üç adımı da görmüş olmalı: PENDING → IN_REVIEW → APPROVED
  if (select count(*) from business_application_event where application_id = v_id) <> 3 then
    raise exception 'Olay defteri uc adimi gormedi (gelen: %).',
      (select count(*) from business_application_event where application_id = v_id);
  end if;

  -- İkinci onay reddedilmeli ve YENİ KİRACI AÇMAMALI
  begin
    perform public.basvuruyu_onayla(v_id, 'ikinci onay denemesi');
  exception when others then v_ikinci_red := true;
  end;

  select count(*) into v_kiraci_adet from tenant where name = 'Gümüş Tavukçuluk';

  if not v_ikinci_red then
    raise exception 'Ikinci onay reddedilmedi.';
  end if;
  if v_kiraci_adet <> 1 then
    raise exception 'Ikinci onay yeni kiraci acti (adet: %).', v_kiraci_adet;
  end if;

  raise notice 'UCTAN UCA GECTI · numara: % · kiraci: % · sube: %',
    v_ref, v_sonuc.kiraci_kodu, v_sonuc.sube_id;
end $$;

-- ── Aynı isimden ikinci işletme: kod artmalı ──────────────────────────────
do $$
declare
  v_ref text;
  v_id  uuid;
  v_kod text;
begin
  v_ref := public.basvuru_gonder(
    'Gümüş Tavukçuluk', 'Ikinci Yetkili', '02324786855',
    'prova-akis-2@example.com', 'izmir', 'bornova', 'ikinci adres',
    1, 6, '39432904235', 'bornova', 'industrial-kitchen');
  select id into v_id from business_application where reference = v_ref;
  update business_application set status = 'IN_REVIEW' where id = v_id;
  select kiraci_kodu into v_kod from public.basvuruyu_onayla(v_id, 'ikinci isletme');

  if v_kod = (select code from tenant where name = 'Gümüş Tavukçuluk' order by created_at limit 1) then
    raise exception 'Ayni kod iki kiraciya verildi: %', v_kod;
  end if;
  raise notice 'Ayni isimden ikinci isletme ayri kod aldi: %', v_kod;
end $$;

select 'UCTAN UCA PROVA' as ne, 'GECTI' as sonuc
union all
select 'acilan kiraci', count(*)::text from tenant where name = 'Gümüş Tavukçuluk'
union all
select 'onaylanan basvuru', count(*)::text from business_application where status = 'APPROVED';

-- ═══════════════════════════════════════════════════════════════════════════
-- EKRANIN YETKİSİYLE KARAR VERME (0037'den sonra eklendi)
--
-- ⚠️ Buraya kadarki her şey SAHİP oturumunda koştu. Canlıda ekran `authenticated`
-- rolüyle konuşuyor ve tam orada patladı:
--     "permission denied for table business_application_event"
-- Sebep: olay tetikleyicisi çağıranın yetkisiyle yazmaya çalışıyordu.
--
-- Prova sahip yetkisiyle koştuğu için bunu göremedi. Artık rol değiştirip
-- ekranın yaptığı işi ekranın yetkisiyle yapıyoruz.
-- ═══════════════════════════════════════════════════════════════════════════

select public.basvuru_gonder(
  'Yetki Provasi Gida', 'Deneme Yetkili', '05321234999',
  'yetki-provasi@example.com', 'izmir', 'bornova', 'yetki provasi adresi',
  1, 4, null, null, 'industrial-kitchen') as yeni_basvuru \gset

set role authenticated;

-- "İncelemeye Al" düğmesinin yaptığı iş.
update business_application set status = 'IN_REVIEW'
 where reference = :'yeni_basvuru';

-- "Onayla" düğmesinin yaptığı iş — dış kapıdan.
select kiraci_kodu as onayla_kiraci_kodu
  from public.basvuruyu_onayla(
    (select id from business_application where reference = :'yeni_basvuru'),
    'ekran yetkisiyle onay provasi');

reset role;

do $$
declare
  v_olay int;
begin
  select count(*) into v_olay
    from business_application_event e
    join business_application a on a.id = e.application_id
   where a.reference is not null and a.email = 'yetki-provasi@example.com';

  if v_olay <> 3 then
    raise exception 'Ekran yetkisiyle olay defteri dolmadi (beklenen 3, gelen %).', v_olay;
  end if;
  raise notice 'Ekran yetkisiyle karar verildi ve olay defteri doldu (% olay).', v_olay;
end $$;

-- Prova satırlarını bırakma: bakım fonksiyonu @example.com satırlarını siler.
select app.dogrulama_kayitlarini_sil() as prova_satiri_silindi;

-- ═══════════════════════════════════════════════════════════════════════════
-- GİRİŞ HESABI (0039) — Edge Function'ın veritabanı tarafı
--
-- Edge Function burada YOK: Auth kullanıcısını o yaratıyor. Provada onun
-- yerine uydurma bir Auth kimliği veriyoruz. Sınanan şey, kimlik geldikten
-- SONRA olan her şey: app_user, rol, şube erişimi, başvuru damgası ve
-- ikinci çağrının reddi.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_ref     text;
  v_id      uuid;
  v_onay    record;
  v_auth    uuid := gen_random_uuid();
  v_sonuc   record;
  v_ikinci  boolean := false;
  v_kullanici record;
begin
  v_ref := public.basvuru_gonder(
    'Hesap Provasi Gida', 'Hesap Yetkili', '05321234777',
    'Hesap.Yetkili@hesapprovasi.example.com', 'izmir', 'bornova',
    'hesap provasi adresi', 1, 8, null, null, 'industrial-kitchen');
  select id into v_id from business_application where reference = v_ref;
  update business_application set status = 'IN_REVIEW' where id = v_id;
  select * into v_onay from public.basvuruyu_onayla(v_id, 'hesap provasi onayi');

  -- Edge Function'ın yaptığı çağrı
  select * into v_sonuc from app.isletme_kullanicisi_ac(v_id, v_auth);

  if v_sonuc.kullanici_adi <> 'hesapyetkili' then
    raise exception 'Kullanici adi e-postadan turetilmedi: %', v_sonuc.kullanici_adi;
  end if;

  select u.tenant_id, u.company_id, u.role_code, u.is_active, u.full_name
    into v_kullanici
    from app_user u where u.id = v_sonuc.kullanici_id;

  if v_kullanici.tenant_id <> v_onay.kiraci_id then
    raise exception 'Kullanici yanlis kiraciya baglandi.';
  end if;
  if v_kullanici.role_code <> 'isletme_sahibi' then
    raise exception 'Birincil rol isletme_sahibi degil: %', v_kullanici.role_code;
  end if;
  if not exists (select 1 from user_role
                  where user_id = v_sonuc.kullanici_id and role_code = 'isletme_sahibi') then
    raise exception 'Ek rol satiri (user_role) acilmadi.';
  end if;
  if not exists (select 1 from user_branch_access ub
                  join branch b on b.id = ub.branch_id
                 where ub.user_id = v_sonuc.kullanici_id and b.is_head_office) then
    raise exception 'Merkez sube erisimi verilmedi.';
  end if;
  if not exists (select 1 from business_application
                  where id = v_id and owner_user_id = v_sonuc.kullanici_id
                    and invited_at is not null) then
    raise exception 'Basvuruya davet damgasi vurulmadi.';
  end if;

  -- ⚠️ İkinci çağrı YENİ HESAP AÇMAMALI. Edge Function ağ hatasında
  -- yeniden denenebilir.
  begin
    perform app.isletme_kullanicisi_ac(v_id, gen_random_uuid());
  exception when others then v_ikinci := true;
  end;
  if not v_ikinci then
    raise exception 'Ikinci hesap acma cagrisi reddedilmedi.';
  end if;

  -- İşletme sahibi PLATFORM yetkisi ALMAMALI. "Firması kapsamında her şey,
  -- benim işimi bozamayacak derecede" tam olarak buranın sınavı.
  if exists (
    select 1 from role_permission rp
     where rp.permission_code like 'platform.%'
       and ( rp.role_code = v_kullanici.role_code
             or exists (select 1 from user_role ur
                         where ur.user_id = v_sonuc.kullanici_id
                           and ur.role_code = rp.role_code))
  ) then
    raise exception 'Isletme sahibi platform yetkisi aldi. Izolasyon kirik.';
  end if;

  raise notice 'GIRIS HESABI GECTI · kullanici: % · kiraci: % · platform yetkisi: yok',
    v_sonuc.kullanici_adi, v_sonuc.kiraci_kodu;
end $$;

select app.dogrulama_kayitlarini_sil() as hesap_provasi_temizlendi;

-- ── 0041 · Onaydan doğan firmanın sektörü tek yazımda mı ────────────────
do $$
declare v_kotu int;
begin
  select count(*) into v_kotu from company
   where primary_sector_id is not null and primary_sector_id not like 'sector\_%';
  if v_kotu > 0 then
    raise exception 'AKIS: onaydan doğan % firmanın sektörü kod yazımında kaldı', v_kotu;
  end if;
  raise notice 'AKIS: onaydan doğan firmaların sektörü sector_ yazımında · GECTI';
end $$;

-- ── 0042 · Onaydan doğan işletmenin lisansı ──────────────────────────────
-- A4D madde 3. Lisans tarayıcıda değil defterde doğuyor mu?
do $$
declare
  v_kiraci uuid; v_paket text; v_durum text; v_bitis date; v_adet int;
begin
  select id into v_kiraci from tenant where code = 'GUM001';
  if v_kiraci is null then raise exception 'AKIS: GUM001 kiracisi yok'; end if;

  select p.code, l.status, l.end_date into v_paket, v_durum, v_bitis
    from tenant_license l join license_package p on p.id = l.package_id
   where l.tenant_id = v_kiraci and l.status in ('Deneme','Aktif');

  if v_paket is null then
    raise exception 'AKIS: onaydan doğan kiracının lisansı YOK';
  end if;
  if v_paket <> 'endustriyel-mutfak-baslangic' then
    raise exception 'AKIS: sektör paketi seçilmedi (gelen: %)', v_paket;
  end if;
  if v_durum <> 'Deneme' then
    raise exception 'AKIS: lisans Deneme durumunda açılmadı (gelen: %)', v_durum;
  end if;
  if v_bitis <= current_date then
    raise exception 'AKIS: lisans doğar doğmaz bitmiş (bitiş: %)', v_bitis;
  end if;

  -- İkinci kez çağrılırsa ikinci lisans DOĞMAMALI
  perform app.kiraci_lisansi_ac(v_kiraci, 'sector_industrial_kitchen');
  select count(*) into v_adet from tenant_license
   where tenant_id = v_kiraci and status in ('Deneme','Aktif');
  if v_adet <> 1 then
    raise exception 'AKIS: ikinci lisans doğdu (adet: %)', v_adet;
  end if;

  raise notice 'AKIS: lisans defterde · paket % · % · bitiş % · GECTI', v_paket, v_durum, v_bitis;
end $$;

-- ── 0043 · Lisans defteri, platform muafiyeti, süre talebi ───────────────
do $$
declare
  v_kiraci uuid; v_platform int; v_uzatma int; v_bitis1 date; v_bitis2 date; v_olay int;
begin
  -- 1) Platformun lisansı OLMAMALI
  select count(*) into v_platform
    from tenant_license l join tenant t on t.id = l.tenant_id
   where t.is_platform;
  if v_platform > 0 then
    raise exception 'AKIS: platform kiracısında lisans var (%).', v_platform;
  end if;

  select id into v_kiraci from tenant where code = 'GUM001';

  -- 2) İki kez uzat → defter iki UZATILDI satırı tutmalı
  select end_date into v_bitis1 from app.lisansi_uzat(v_kiraci, null, 1, 'prova 1');
  select end_date into v_bitis2 from app.lisansi_uzat(v_kiraci, null, 2, 'prova 2');
  if v_bitis2 <= v_bitis1 then
    raise exception 'AKIS: ikinci uzatma ileri almadı (% → %).', v_bitis1, v_bitis2;
  end if;

  select count(*) into v_uzatma from license_event
   where tenant_id = v_kiraci and kind = 'UZATILDI';
  if v_uzatma <> 2 then
    raise exception 'AKIS: uzatma sayısı defterde 2 değil (%).', v_uzatma;
  end if;

  -- 3) Süre talebi açılınca deftere düşmeli
  insert into license_extension_request (tenant_id, reason)
  values (v_kiraci, 'prova talebi');
  select count(*) into v_olay from license_event
   where tenant_id = v_kiraci and kind = 'SURE_TALEBI';
  if v_olay <> 1 then
    raise exception 'AKIS: süre talebi deftere düşmedi (%).', v_olay;
  end if;

  -- 4) Aynı anda ikinci bekleyen talep AÇILAMAMALI
  begin
    insert into license_extension_request (tenant_id, reason)
    values (v_kiraci, 'ikinci talep');
    raise exception 'AKIS: ikinci bekleyen talep açıldı, kuyruk şişiyor.';
  exception when unique_violation then null;
  end;

  raise notice 'AKIS: lisans defteri · % uzatma · platform lisanssız · talep kuyruğu tek · GECTI', v_uzatma;
end $$;

-- ── 0046 · LİSANS BİTİNCE YAZMA KİLİDİ ───────────────────────────────────
-- A4D'nin son maddesi. Sınanan cümle: "Lisans bitince yeni kayıt girilemez
-- AMA veri okunabilir." Bu cümlenin üç ayağı var ve üçü de ayrı ayrı
-- kanıtlanmalı — ikisi doğru, biri yanlış olursa ürün ya müşteriyi kilitler
-- ya da sınırı hiç uygulamaz.
--
-- ⚠️ Bu blok göç dosyasında DEĞİL, burada: oturum taklidi gerekiyor. Göç,
-- kiracısız bir oturumda koşar ve kilit tam olarak orada devreye GİRMEZ.
-- Yani göçün kendi doğrulaması bu davranışı sınayamaz; burada sınanır.
do $$
declare
  v_kiraci uuid;
  v_sube   uuid;
  v_bitis  date;
  v_baslar date;
  v_okundu int;
  v_kalem  uuid;
begin
  select id into v_kiraci from tenant where code = 'GUM001';
  select id into v_sube   from branch where tenant_id = v_kiraci limit 1;
  if v_sube is null then raise exception '0046 prova: GUM001 şubesi yok'; end if;

  select start_date, end_date into v_baslar, v_bitis from tenant_license
   where tenant_id = v_kiraci and status in ('Deneme','Aktif');

  -- ── 1) LİSANS GEÇERLİ · yazma AÇIK olmalı ──────────────────────────────
  -- Önce olumlu tarafı kanıtlıyoruz. Bu olmadan, aşağıdaki reddin lisanstan
  -- mı yoksa başka bir engelden mi geldiğini bilemezdik.
  perform set_config('app.tenant_id', v_kiraci::text, false);

  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_kiraci, v_sube, 'KLT-0046', 'klt-0046', '0046 kilit provasi kalemi', 'kg')
  returning id into v_kalem;

  if v_kalem is null then
    raise exception '0046 prova: lisans geçerliyken yazma çalışmadı.';
  end if;

  -- ── 2) LİSANSI BİTİR ───────────────────────────────────────────────────
  -- Kiracı oturumu bunu yapamaz (tenant_license müşteriye salt okunur).
  -- Provada süper kullanıcıyız, o yüzden tarihi elle geriye alıyoruz.
  -- Canlıda bu iş kendiliğinden olur: takvim ilerler.
  -- ⚠️ `end_date >= start_date` kısıtı var (0042). Bu yüzden başlangıcı da
  -- geriye almak gerekiyor; canlıda süresi dolmuş bir lisansta bu ikisi
  -- zaten tutarlıdır — sınama gerçeğin şeklini bozmasın.
  perform set_config('app.tenant_id', '', false);
  update tenant_license
     set start_date = current_date - 60,
         end_date   = current_date - 1
   where tenant_id = v_kiraci and status in ('Deneme','Aktif');
  perform set_config('app.tenant_id', v_kiraci::text, false);

  -- ── 3) YAZMA KAPALI olmalı ─────────────────────────────────────────────
  begin
    insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
    values (v_kiraci, v_sube, 'KLT-0046-B', 'klt-0046-b', '0046 bu kalem girmemeli', 'kg');
    raise exception '0046 prova: lisans bittiği hâlde YENİ KAYIT GİRDİ.';
  exception when sqlstate 'MI410' then null;
  end;

  -- Güncelleme de kapalı olmalı: "yeni kayıt giremez" demek "var olanı
  -- değiştirebilir" demek değil. Fiyatı değiştirip kaçmak da yazmaktır.
  begin
    update stock_item set name = 'degistirilmis' where id = v_kalem;
    raise exception '0046 prova: lisans bittiği hâlde KAYIT DEĞİŞTİRDİ.';
  exception when sqlstate 'MI410' then null;
  end;

  -- Silme de kapalı olmalı.
  begin
    delete from stock_item where id = v_kalem;
    raise exception '0046 prova: lisans bittiği hâlde KAYIT SİLDİ.';
  exception when sqlstate 'MI410' then null;
  end;

  -- ── 4) OKUMA AÇIK olmalı ───────────────────────────────────────────────
  -- Kilidin can alıcı yarısı. Müşteri kendi verisine her zaman erişir.
  select count(*) into v_okundu from stock_item where tenant_id = v_kiraci;
  if v_okundu = 0 then
    raise exception '0046 prova: lisans bitince OKUMA da kapandı — '
                    'bu bir rehin alma, abonelik sınırı değil.';
  end if;

  -- ── 5) EK SÜRE TALEBİ AÇIK olmalı ──────────────────────────────────────
  -- Kapıyı kilitleyip anahtarı içeride bırakmadığımızın kanıtı. Müşteri ek
  -- süreyi tam da lisansı bittiğinde talep eder; o tablo muaf.
  delete from license_extension_request where tenant_id = v_kiraci;
  insert into license_extension_request (tenant_id, reason)
  values (v_kiraci, '0046 lisans bitmisken talep');

  if not exists (select 1 from license_extension_request
                  where tenant_id = v_kiraci and status = 'Bekliyor') then
    raise exception '0046 prova: lisans bitince ek süre TALEBİ DE kapandı.';
  end if;

  -- ── 6) TOPARLA ─────────────────────────────────────────────────────────
  perform set_config('app.tenant_id', '', false);
  update tenant_license set start_date = v_baslar, end_date = v_bitis
   where tenant_id = v_kiraci and status in ('Deneme','Aktif');
  delete from stock_item where id = v_kalem;
  perform set_config('app.tenant_id', (select id::text from tenant where code = 'MIYOP'), false);

  raise notice '0046: yazma kilidi · ekleme/güncelleme/silme kapalı · '
               'okuma açık (% satır) · süre talebi açık · GECTI', v_okundu;
end $$;

-- ── 0047 · MÜŞTERİ KARTI, TESLİM NOKTASI, FİYAT DEFTERİ ──────────────────
-- Buradaki iki kural ekranda değil FONKSİYONDA duruyor ve ikisi de sessizce
-- yanlış çalışabilir: fiyat seçimi ve pencere çözümü. Yanlış fiyat, yanlış
-- kesilmiş bir irsaliye demektir — müşteriyle para tartışması.
do $$
declare
  v_kiraci uuid; v_sube uuid; v_kalem uuid;
  v_musteri uuid; v_nokta_a uuid; v_nokta_b uuid;
  v_fiyat numeric; v_kesim time; v_fark smallint; v_kaynak text;
begin
  select id into v_kiraci from tenant where code = 'GUM001';
  select id into v_sube   from branch where tenant_id = v_kiraci limit 1;
  perform set_config('app.tenant_id', v_kiraci::text, false);

  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_kiraci, v_sube, 'FYT-01', 'fyt-01', 'Mercimek çorbası 5 kg', 'kg')
  returning id into v_kalem;

  -- Müşteride varsayılan pencere VAR: 10:00, ertesi gün.
  insert into customer (tenant_id, code, code_key, name, payment_term_days,
                        order_cutoff_time, delivery_lead_days)
  values (v_kiraci, 'MIG', 'MIG', 'Migros', 45, '10:00', 1)
  returning id into v_musteri;

  -- A noktası: KENDİ penceresi var (06:00, aynı gün).
  insert into delivery_point (tenant_id, customer_id, code, code_key, name,
                              order_cutoff_time, delivery_lead_days)
  values (v_kiraci, v_musteri, 'ATA', 'ATA', 'Migros Ataşehir', '06:00', 0)
  returning id into v_nokta_a;

  -- B noktası: kendi penceresi YOK → müşterinin varsayılanına düşmeli.
  insert into delivery_point (tenant_id, customer_id, code, code_key, name)
  values (v_kiraci, v_musteri, 'KAD', 'KAD', 'Migros Kadıköy')
  returning id into v_nokta_b;

  -- ── 1) PENCERE ÇÖZÜMÜ · nokta → müşteri → yok ──────────────────────────
  select kesim_saati, gun_farki, kaynak into v_kesim, v_fark, v_kaynak
    from app.siparis_penceresi(v_nokta_a);
  if v_kesim <> '06:00'::time or v_fark <> 0 or v_kaynak <> 'nokta' then
    raise exception '0047 prova: noktanın kendi penceresi kullanılmadı (% / % / %).',
      v_kesim, v_fark, v_kaynak;
  end if;

  select kesim_saati, gun_farki, kaynak into v_kesim, v_fark, v_kaynak
    from app.siparis_penceresi(v_nokta_b);
  if v_kesim <> '10:00'::time or v_fark <> 1 or v_kaynak <> 'musteri' then
    raise exception '0047 prova: penceresiz nokta müşteri varsayılanına düşmedi (% / % / %).',
      v_kesim, v_fark, v_kaynak;
  end if;

  -- ── 2) FİYAT · müşteri geneli ──────────────────────────────────────────
  insert into customer_price (tenant_id, customer_id, stock_item_id,
                              unit_price, uom_code, valid_from)
  values (v_kiraci, v_musteri, v_kalem, 100, 'kg', current_date - 10);

  v_fiyat := app.musteri_fiyati(v_nokta_a, v_kalem);
  if v_fiyat <> 100 then
    raise exception '0047 prova: müşteri geneli fiyat okunmadı (%).', v_fiyat;
  end if;

  -- ── 3) FİYAT · noktaya özel, geneli YENMELİ ────────────────────────────
  -- Emrah'ın cevabı: aynı müşterinin farklı noktalarına farklı fiyat, EVET.
  insert into customer_price (tenant_id, customer_id, delivery_point_id,
                              stock_item_id, unit_price, uom_code, valid_from)
  values (v_kiraci, v_musteri, v_nokta_a, v_kalem, 115, 'kg', current_date - 10);

  v_fiyat := app.musteri_fiyati(v_nokta_a, v_kalem);
  if v_fiyat <> 115 then
    raise exception '0047 prova: noktaya özel fiyat geneli yenmedi (%).', v_fiyat;
  end if;

  -- B noktası noktaya özel satırdan ETKİLENMEMELİ: hâlâ genel fiyat.
  v_fiyat := app.musteri_fiyati(v_nokta_b, v_kalem);
  if v_fiyat <> 100 then
    raise exception '0047 prova: bir noktanın fiyatı diğerine sızdı (%).', v_fiyat;
  end if;

  -- ── 4) FİYAT · en yeni tarih kazanmalı (zam) ───────────────────────────
  insert into customer_price (tenant_id, customer_id, delivery_point_id,
                              stock_item_id, unit_price, uom_code, valid_from)
  values (v_kiraci, v_musteri, v_nokta_a, v_kalem, 130, 'kg', current_date);

  v_fiyat := app.musteri_fiyati(v_nokta_a, v_kalem);
  if v_fiyat <> 130 then
    raise exception '0047 prova: zam geçerli olmadı (%).', v_fiyat;
  end if;

  -- GEÇMİŞ DURMALI: zam öncesi tarihte eski fiyat okunmalı. Eklemeli
  -- defterin bütün sebebi bu — kesilmiş irsaliye yalan söylemesin.
  v_fiyat := app.musteri_fiyati(v_nokta_a, v_kalem, current_date - 5);
  if v_fiyat <> 115 then
    raise exception '0047 prova: geçmiş tarihli fiyat kaybolmuş (%).', v_fiyat;
  end if;

  -- ── 5) FİYAT · kaldırma satırı NULL döndürmeli, sıfır DEĞİL ────────────
  insert into customer_price (tenant_id, customer_id, delivery_point_id,
                              stock_item_id, unit_price, uom_code, valid_from, removed)
  values (v_kiraci, v_musteri, v_nokta_a, v_kalem, 0, 'kg', current_date + 1, true);

  v_fiyat := app.musteri_fiyati(v_nokta_a, v_kalem, current_date + 1);
  if v_fiyat is not null then
    raise exception '0047 prova: kaldırılmış fiyat hâlâ okunuyor (%). '
                    'Sıfır dönerse ürün bedava satılmış görünür.', v_fiyat;
  end if;

  -- ── 6) FİYAT DEFTERİ DEĞİŞMEZ ──────────────────────────────────────────
  begin
    update customer_price set note = 'olmaz' where stock_item_id = v_kalem;
    raise exception '0047 prova: fiyat güncellenebildi — defter değişmez değil.';
  exception when sqlstate 'MI403' then null;
  end;

  begin
    delete from customer_price where stock_item_id = v_kalem;
    raise exception '0047 prova: fiyat silinebildi — defter değişmez değil.';
  exception when sqlstate 'MI403' then null;
  end;

  -- ── 7) NOKTA, BAŞKA KİRACININ MÜŞTERİSİNE BAĞLANAMAZ ───────────────────
  -- Yabancı anahtar bunu söylemiyor: iki kolon iki ayrı satıra bakıyor.
  begin
    insert into delivery_point (tenant_id, customer_id, code, code_key, name)
    values ((select id from tenant where code = 'MIYOP'), v_musteri,
            'HAT', 'HAT', 'Yanlış kiracı');
    raise exception '0047 prova: nokta başka kiracıya yazıldı.';
  exception when sqlstate 'MI422' then null;
  end;

  perform set_config('app.tenant_id', (select id::text from tenant where code = 'MIYOP'), false);
  raise notice '0047: müşteri kartı · pencere nokta→müşteri→yok · fiyat '
               'nokta>müşteri, en yeni tarih, geçmiş duruyor, kaldırma NULL · '
               'defter değişmez · GECTI';
end $$;

-- ── 0050 · SİPARİŞ DEFTERİ ───────────────────────────────────────────────
-- Bu bloğun sınadığı şey ürünün SATTIĞI cümle: "sonradan kimse 'ben bunu
-- istemiştim' diyemesin." Kurallar tetiklerde duruyor; tetiğin VAR olması
-- değil ÇALIŞTIĞI kanıtlanmalı.
do $$
declare
  v_kiraci uuid; v_sube uuid; v_kullanici uuid;
  v_musteri uuid; v_nokta_a uuid; v_nokta_b uuid;
  v_baska_musteri uuid; v_baska_nokta uuid;
  v_kalem1 uuid; v_kalem2 uuid;
  v_siparis uuid; v_rev1 uuid; v_rev2 uuid; v_rev3 uuid;
  v_fark uuid; v_baska_siparis uuid; v_baska_fark uuid;
  v_adet int; v_miktar numeric; v_rev_no int; v_olay int;
begin
  select id into v_kiraci from tenant where code = 'GUM001';
  select id into v_sube   from branch where tenant_id = v_kiraci limit 1;
  select id into v_kullanici from app_user where tenant_id = v_kiraci limit 1;
  -- GUM001 onaydan doğuyor ama kendi personeli olmayabilir; fark kaydı
  -- "kim fark etti" alanını ZORUNLU tutuyor (Emrah: "farkı ilk fark eden
  -- bayrak kaldırmalı"). Rol kodunu var olan bir kullanıcıdan alıyoruz ki
  -- rol kataloguna (0014) uygun olsun.
  if v_kullanici is null then
    insert into app_user (tenant_id, username, username_key, full_name, role_code)
    select v_kiraci, 'siparisci', 'SIPARISCI', 'Sipariş Personeli', u.role_code
      from app_user u limit 1
    returning id into v_kullanici;
  end if;
  perform set_config('app.tenant_id', v_kiraci::text, false);

  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_kiraci, v_sube, 'SIP-01', 'sip-01', 'Mercimek çorbası', 'kg')
  returning id into v_kalem1;
  insert into stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_kiraci, v_sube, 'SIP-02', 'sip-02', 'Pilav', 'kg')
  returning id into v_kalem2;

  insert into customer (tenant_id, code, code_key, name)
  values (v_kiraci, 'SIPMUS', 'SIPMUS', 'Sipariş Müşterisi') returning id into v_musteri;
  insert into delivery_point (tenant_id, customer_id, code, code_key, name)
  values (v_kiraci, v_musteri, 'A', 'A', 'A Noktası') returning id into v_nokta_a;
  insert into delivery_point (tenant_id, customer_id, code, code_key, name)
  values (v_kiraci, v_musteri, 'B', 'B', 'B Noktası') returning id into v_nokta_b;

  insert into customer (tenant_id, code, code_key, name)
  values (v_kiraci, 'BASKA', 'BASKA', 'Başka Müşteri') returning id into v_baska_musteri;
  insert into delivery_point (tenant_id, customer_id, code, code_key, name)
  values (v_kiraci, v_baska_musteri, 'X', 'X', 'X Noktası') returning id into v_baska_nokta;

  -- ── 1) TESLİM NOKTASI MÜŞTERİYE AİT OLMALI ─────────────────────────────
  begin
    insert into sales_order (tenant_id, branch_id, order_no, customer_id, delivery_point_id)
    values (v_kiraci, v_sube, 'SIP-HATA', v_musteri, v_baska_nokta);
    raise exception '0050 prova: başka müşterinin noktasına sipariş yazıldı.';
  exception when sqlstate 'MI424' then null;
  end;

  -- ── 2) SİPARİŞ AÇ · REV 1 ──────────────────────────────────────────────
  insert into sales_order (tenant_id, branch_id, order_no, customer_id,
                           delivery_point_id, requested_ship_date,
                           requested_delivery_date, created_by)
  values (v_kiraci, v_sube, 'SIP-2026-0001', v_musteri, v_nokta_a,
          current_date + 1, current_date + 2, v_kullanici)
  returning id into v_siparis;

  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason, created_by)
  values (v_kiraci, v_siparis, 1, 'MIKTAR', 'Telefon', 'İlk sipariş', v_kullanici)
  returning id into v_rev1;

  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
  values (v_kiraci, v_siparis, v_rev1, 1, v_kalem1, 200, 'kg'),
         (v_kiraci, v_siparis, v_rev1, 2, v_kalem2, 50, 'koli');

  select count(*) into v_adet from app.siparis_guncel_satirlari(v_siparis);
  if v_adet <> 2 then raise exception '0050 prova: güncel satır 2 değil (%).', v_adet; end if;

  -- ── 3) DEFTER DEĞİŞMEZ ─────────────────────────────────────────────────
  begin
    update sales_order_line set qty = 150 where order_id = v_siparis;
    raise exception '0050 prova: sipariş satırı ÜSTÜNE YAZILDI.';
  exception when sqlstate 'MI403' then null;
  end;
  begin
    delete from sales_order_line where order_id = v_siparis;
    raise exception '0050 prova: sipariş satırı SİLİNDİ.';
  exception when sqlstate 'MI403' then null;
  end;

  -- ── 4) SEVK ÖNCESİ REVİZYON SERBEST · 200 → 150 ────────────────────────
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason, created_by)
  values (v_kiraci, v_siparis, 2, 'MIKTAR', 'Telefon', 'Müşteri 150 istedi', v_kullanici)
  returning id into v_rev2;
  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
  values (v_kiraci, v_siparis, v_rev2, 1, v_kalem1, 150, 'kg'),
         (v_kiraci, v_siparis, v_rev2, 2, v_kalem2, 50, 'koli');

  select qty into v_miktar from app.siparis_guncel_satirlari(v_siparis)
   where stock_item_id = v_kalem1;
  if v_miktar <> 150 then raise exception '0050 prova: güncel miktar 150 değil (%).', v_miktar; end if;

  -- GEÇMİŞ DURMALI: rev 1'deki 200 hâlâ okunabilir olmalı. Defterin bütün
  -- sebebi bu — "ben 200 istemiştim" tartışmasını bitiren şey.
  select l.qty into v_miktar
    from sales_order_line l join sales_order_revision r on r.id = l.revision_id
   where r.order_id = v_siparis and r.revision_no = 1 and l.stock_item_id = v_kalem1;
  if v_miktar <> 200 then raise exception '0050 prova: eski revizyon kaybolmuş (%).', v_miktar; end if;

  -- ── 5) DURUM AKIŞI ─────────────────────────────────────────────────────
  begin
    update sales_order set status = 'Sevk Edildi' where id = v_siparis;
    raise exception '0050 prova: Taslak → Sevk Edildi atlandı.';
  exception when sqlstate 'MI422' then null;
  end;

  update sales_order set status = 'Onaylandı'    where id = v_siparis;
  update sales_order set status = 'Hazırlanıyor' where id = v_siparis;
  update sales_order set status = 'Hazır'        where id = v_siparis;
  update sales_order set status = 'Sevk Edildi'  where id = v_siparis;

  -- ── 6) SEVK SONRASI MİKTAR REVİZYONU · FARKSIZ REDDEDİLMELİ ────────────
  -- Emrah: "Sevk edildikten sonra 200 değil de 150 istiyorum olmaz — en
  -- başından istediği şeyi üretmişim."
  begin
    insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason)
    values (v_kiraci, v_siparis, 3, 'MIKTAR', 'Telefon', 'Vazgeçtim, 100 olsun');
    raise exception '0050 prova: sevk sonrası miktar SERBESTÇE değişti.';
  exception when sqlstate 'MI425' then null;
  end;

  -- ── 7) SEVK SONRASI LOJİSTİK REVİZYONU · SERBEST ───────────────────────
  -- Emrah: "a noktasına değil b noktasına olur."
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind, source, reason, created_by)
  values (v_kiraci, v_siparis, 3, 'LOJISTIK', 'Telefon', 'A yerine B noktasına', v_kullanici)
  returning id into v_rev3;
  update sales_order set delivery_point_id = v_nokta_b where id = v_siparis;

  -- Lojistik revizyonu satır TAŞIMAZ.
  begin
    insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
    values (v_kiraci, v_siparis, v_rev3, 1, v_kalem1, 999, 'kg');
    raise exception '0050 prova: lojistik revizyonuna satır yazıldı.';
  exception when sqlstate 'MI422' then null;
  end;

  -- Güncel satırlar hâlâ REV 2'den gelmeli: lojistik revizyonu atlanıyor.
  select revision_no into v_rev_no from app.siparis_guncel_satirlari(v_siparis) limit 1;
  if v_rev_no <> 2 then
    raise exception '0050 prova: lojistik revizyonu güncel satırları bozdu (rev %).', v_rev_no;
  end if;

  -- ── 8) FARK KAYDI · "farkı ilk fark eden bayrak kaldırır" ──────────────
  insert into order_discrepancy (tenant_id, order_id, stock_item_id, kind, qty,
                                 uom_code, noticed_step, noticed_by, description)
  values (v_kiraci, v_siparis, v_kalem2, 'Eksik', 2, 'koli', 'Teslimde',
          v_kullanici, 'Müşteri 2 koli eksik geldi dedi')
  returning id into v_fark;

  -- Karara bağlarken karar alanları BOŞ BIRAKILAMAZ: içi boş kapatılmış
  -- bir inceleme, hiç açılmamış incelemeden kötüdür.
  begin
    update order_discrepancy set status = 'Karara Bağlandı' where id = v_fark;
    raise exception '0050 prova: fark kararsız kapatıldı.';
  exception when check_violation then null;
  end;

  update order_discrepancy
     set status = 'Karara Bağlandı', resolution = 'Müşteri Hatası',
         decision_note = 'Müşteri 48 koli sipariş etmiş, 50 sandı',
         decided_by = v_kullanici, decided_at = now()
   where id = v_fark;

  -- ── 9) FARKA BAĞLI MİKTAR REVİZYONU · ARTIK SERBEST ────────────────────
  insert into sales_order_revision (tenant_id, order_id, revision_no, kind,
                                    source, reason, discrepancy_id, created_by)
  values (v_kiraci, v_siparis, 4, 'MIKTAR', 'Telefon',
          'Fark incelemesi sonucu düzeltildi', v_fark, v_kullanici)
  returning id into v_rev2;
  insert into sales_order_line (tenant_id, order_id, revision_id, line_no, stock_item_id, qty, uom_code)
  values (v_kiraci, v_siparis, v_rev2, 1, v_kalem1, 150, 'kg'),
         (v_kiraci, v_siparis, v_rev2, 2, v_kalem2, 48, 'koli');

  select qty into v_miktar from app.siparis_guncel_satirlari(v_siparis)
   where stock_item_id = v_kalem2;
  if v_miktar <> 48 then raise exception '0050 prova: farka bağlı revizyon işlemedi (%).', v_miktar; end if;

  -- ── 10) BAŞKA SİPARİŞİN FARKINA BAĞLANAMAZ ─────────────────────────────
  insert into sales_order (tenant_id, branch_id, order_no, customer_id, delivery_point_id)
  values (v_kiraci, v_sube, 'SIP-2026-0002', v_musteri, v_nokta_a)
  returning id into v_baska_siparis;
  insert into order_discrepancy (tenant_id, order_id, kind, noticed_step, noticed_by, description)
  values (v_kiraci, v_baska_siparis, 'Eksik', 'Yolda', v_kullanici, 'Başka siparişin farkı')
  returning id into v_baska_fark;

  begin
    insert into sales_order_revision (tenant_id, order_id, revision_no, kind,
                                      source, reason, discrepancy_id)
    values (v_kiraci, v_siparis, 5, 'MIKTAR', 'Telefon', 'Yanlış fark', v_baska_fark);
    raise exception '0050 prova: revizyon BAŞKA siparişin farkına bağlandı.';
  exception when sqlstate 'MI424' then null;
  end;

  -- ── 11) OLAY DEFTERİ DOLDU MU ──────────────────────────────────────────
  -- Açıldı + 4 durum + 4 revizyon + fark + fark kararı = en az 11
  select count(*) into v_olay from sales_order_event where order_id = v_siparis;
  if v_olay < 11 then
    raise exception '0050 prova: olay defteri eksik (% olay).', v_olay;
  end if;

  begin
    update sales_order_event set detail = 'olmaz' where order_id = v_siparis;
    raise exception '0050 prova: olay defteri değiştirildi.';
  exception when sqlstate 'MI403' then null;
  end;

  perform set_config('app.tenant_id', (select id::text from tenant where code = 'MIYOP'), false);
  raise notice '0050: sipariş defteri · satır değişmez · sevk öncesi revizyon serbest · '
               'sevk sonrası miktar FARKA BAĞLI · lojistik serbest · geçmiş duruyor · '
               'olay defteri % kayıt · GECTI', v_olay;
end $$;
