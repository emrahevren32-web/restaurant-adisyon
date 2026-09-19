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
                    and primary_sector_id = 'industrial-kitchen') then
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
