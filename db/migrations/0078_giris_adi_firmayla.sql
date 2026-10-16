-- ═══════════════════════════════════════════════════════════════════════════
-- 0078 · GİRİŞ ADI FİRMAYLA BİRLİKTE + KULLANICI ADI DEĞİŞTİRME
-- ---------------------------------------------------------------------------
-- 0077 kullanıcı adıyla girişi açtı ama Emrah hemen asıl soruyu sordu:
--
--   "diyelim sisteme aynı noktadan giriş yapan 35 adet firma var ve bu
--    firmaların 40ar adet personeli var. sence depocu yazarak giriş yapmaya
--    çalışmak ne kadar doğru?"
--
-- Haklı. 0077'de iki ayrı sorun vardı ve ikisi de burada kapanıyor.
--
-- ── SORUN 1 · "depocu" HANGİ FİRMANIN DEPOCUSU? ──────────────────────────
-- Giriş ekranı oturumsuz; hangi firma olduğunu BİLMİYOR. 0077 çakışmada
-- adres döndürmüyordu (doğru karar) ama kullanıcıya düşen sonuç şuydu:
-- "giriş başarısız" → sonra bir "işletme kodu" kutusu beliriyor. En acemi
-- kullanıcıya, en kötü anda, hiç duymadığı bir kavram öğretiliyordu.
--
-- Çözüm: GİRİŞ ADI FİRMAYI ZATEN İÇERSİN.
--     alaattin.kocatepe@ABCGIDA
-- Tek alan, tek şey ezberlemek, sıfır çakışma. E-posta gibi göründüğü için
-- kimse yabancılık çekmiyor. ⚠️ Bu bir e-posta DEĞİL, posta gitmez.
--
-- ⚠️ A5'te her müşteriye kendi alt alan adı verilince (abcgida.miyop.com.tr)
-- `@ABCGIDA` kısmı adresten gelecek ve kullanıcı yalnız adını yazacak.
-- O gün geldiğinde BU FONKSİYON DEĞİŞMEZ: ikinci parametre zaten var.
--
-- ── SORUN 2 · GÖREV ADI KULLANICI ADI OLAMAZ ─────────────────────────────
-- Emrah: "depocu diye değilde isimsoyisimle girsin". Haklı ve gerekçesi
-- sandığından güçlü:
--
-- ⚠️ "depocu" hesabı DEVREDİLİR. Alaattin işten ayrılır, yerine gelen aynı
-- hesabı kullanır. O andan sonra defterdeki her imza yalan söyler:
-- "depocu onayladı" cümlesi KİMİN onayladığını söylemez. İzlenebilirlik ve
-- HACCP'in tek dayanağı imzanın bir KİŞİYİ göstermesidir. Görev adıyla
-- açılan hesap, müşteriye sattığımız iki şeyi birden çürütür.
--
-- Kullanıcı adı artık ad.soyad olabilsin diye `kullanici_adi_duzelt`
-- NOKTAYA izin veriyor. Mevcut kayıtlar etkilenmiyor (noktaları yok).
--
-- ── BU GÖÇ NE YAPMIYOR ───────────────────────────────────────────────────
-- Auth'taki giriş adresini DEĞİŞTİRMİYOR. Gerek yok: 0077 adresi kuraldan
-- üretmiyor, `auth.users`tan OKUYOR (tuzak 66). Bu yüzden kullanıcı adını
-- değiştirmek Auth tarafında hiçbir şey gerektirmiyor — eski adres sessizce
-- çalışmaya devam eder, kişi yeni adıyla girer.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · KULLANICI ADI ARTIK NOKTA TAŞIYABİLİR ────────────────────────────
-- ⚠️ `username_key` ÜRETİLMİŞ (generated) BİR SÜTUN DEĞİL, düz bir sütun
-- (0001). Bu yüzden normalleştiriciyi değiştirmek eski satırların
-- anahtarlarını bozmaz ve hiçbir indeks yeniden kurulmaz.
create or replace function app.kullanici_adi_duzelt(p_ad text)
returns text
language sql
immutable
as $$
  -- ⚠️ SIRA ÖNEMLİ: önce kırp (40), SONRA baştaki/sondaki noktayı at.
  -- Tersi olsaydı kırpma sonu noktaya denk geldiğinde "ali.veli." gibi bir
  -- ad kaydedilebilirdi.
  select btrim(
    left(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            translate(lower(btrim(coalesce(p_ad, ''))), 'çğıöşüÇĞİÖŞÜ', 'cgiosucgiosu'),
            -- Boşluk ve alt çizgi NOKTAYA dönüyor: "Alaattin Kocatepe" yazan
            -- yönetici "alaattin.kocatepe" elde etsin, "alaattinkocatepe" değil.
            '[\s_]+', '.', 'g'),
          '[^a-z0-9.]', '', 'g'),
        '\.{2,}', '.', 'g'),
      40),
    '.')
$$;

comment on function app.kullanici_adi_duzelt(text) is
  'Kullanıcı adını tek biçime indirir: küçük harf, Türkçe harfler '
  'sadeleşir, boşluk noktaya döner, nokta dışındaki işaretler atılır. '
  'Nokta BİLEREK korunuyor — ad.soyad biçimi okunabilir olsun diye.';


-- ── 2 · KİŞİNİN GİRİŞ ADI (ekranda gösterilen kısa biçim) ────────────────
-- ⚠️ BU AD İKİ YERDE ÜRETİLMEMELİ. Ekran `username + '@' + tenant.code`
-- diye kendi başına kurabilirdi; o gün kurallardan biri değişince ekran ile
-- sunucu farklı şey söylerdi. Tek kaynak burası (tuzak 66).
create or replace function app.giris_adi(p_kullanici uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.username || '@' || upper(regexp_replace(t.code, '[^A-Za-z0-9]', '', 'g'))
    from public.app_user u
    join public.tenant t on t.id = u.tenant_id
   where u.id = p_kullanici
     and u.tenant_id = app.current_tenant_id()
$$;

-- Listeler için: kiracının bütün kullanıcılarının giriş adı, TEK çağrıda.
create or replace function app.giris_adlari()
returns table (kullanici_id uuid, giris_adi text)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id,
         u.username || '@' || upper(regexp_replace(t.code, '[^A-Za-z0-9]', '', 'g'))
    from public.app_user u
    join public.tenant t on t.id = u.tenant_id
   where u.tenant_id = app.current_tenant_id()
$$;


-- ── 3 · GİRİŞ ADRESİ ÇÖZÜMÜ: ad@FIRMAKODU ANLAŞILIYOR ────────────────────
create or replace function app.giris_adresi_bul(
  p_kullanici text,
  p_isletme   text default null
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_girdi text := btrim(coalesce(p_kullanici, ''));
  v_ad    text;
  v_kod   text;
  v_alan  text;
  v_adres text;
  v_say   int;
begin
  if v_girdi = '' then return 'bos@bulunamadi.miyop.local'; end if;

  v_kod := nullif(lower(regexp_replace(coalesce(p_isletme, ''), '[^A-Za-z0-9]', '', 'g')), '');

  if position('@' in v_girdi) > 0 then
    -- @'in SAĞINDAKİ parça bir işletme kodu mu, yoksa e-posta alan adı mı?
    v_alan := lower(regexp_replace(split_part(v_girdi, '@', 2), '[^A-Za-z0-9]', '', 'g'));

    -- ⚠️ Alan adının TAMAMI normalleştirilerek karşılaştırılıyor, yalnız
    -- ilk parçası değil. Böylece `biri@abc.com` ('abccom') ile ABC kodlu
    -- işletme karışmıyor, ama `depocu@abcgida.miyop.local` de
    -- ('abcgidamiyoplocal') işletme kodu sanılmıyor — o zaten gerçek
    -- adrestir ve olduğu gibi geçmelidir.
    if exists (
      select 1 from public.tenant t
       where lower(regexp_replace(t.code, '[^A-Za-z0-9]', '', 'g')) = v_alan
    ) then
      v_kod   := v_alan;
      v_girdi := split_part(v_girdi, '@', 1);
    else
      -- Gerçek e-posta (ya da hiç tanımadığımız bir şey). Kararı Auth verir.
      return lower(v_girdi);
    end if;
  end if;

  v_ad := app.kullanici_adi_duzelt(v_girdi);
  if v_ad = '' then return 'bos@bulunamadi.miyop.local'; end if;

  -- ⚠️ `is_active` SÜZGECİ BİLEREK YOK. Burası kimlik doğrulama değil, ad
  -- çevirisi. Pasif kullanıcıyı `authenticateUser` zaten reddediyor ve ona
  -- "hesabınız kapalı" diyebiliyor; burada saklasaydık "şifre yanlış"
  -- derdik ve kişi şifresini boş yere değiştirmeye çalışırdı.
  select count(*) into v_say
    from public.app_user a
    join public.tenant t on t.id = a.tenant_id
    join auth.users u    on u.id = a.auth_user_id
   where a.username_key = v_ad
     and u.email is not null
     and (v_kod is null
          or lower(regexp_replace(t.code, '[^A-Za-z0-9]', '', 'g')) = v_kod);

  if v_say <> 1 then
    -- Bulunamadı YA DA birden çok işletmede var. İkisinde de aynı cevap:
    -- hangisi olduğunu söylemek, olmayan bir bilgiyi sızdırmak olurdu.
    return v_ad || '@bulunamadi.miyop.local';
  end if;

  select lower(u.email) into v_adres
    from public.app_user a
    join public.tenant t on t.id = a.tenant_id
    join auth.users u    on u.id = a.auth_user_id
   where a.username_key = v_ad
     and u.email is not null
     and (v_kod is null
          or lower(regexp_replace(t.code, '[^A-Za-z0-9]', '', 'g')) = v_kod);

  return v_adres;
end;
$$;

comment on function app.giris_adresi_bul(text, text) is
  'Giriş adını (ad@FIRMAKODU, yalın kullanıcı adı ya da gerçek e-posta) '
  'Supabase Auth giriş adresine çevirir. Bulunamayan ya da birden çok '
  'işletmede bulunan ad için de GEÇERLİ BİÇİMDE sahte bir adres döner — '
  'böylece "bu ad var mı" sorusu dışarıdan cevaplanamaz. Şifre görmez.';


-- ── 4 · KULLANICI ADINI DEĞİŞTİRME ───────────────────────────────────────
-- "depocu" diye açılmış hesapları ada çevirebilmek için. Auth'a dokunmaz.
create or replace function app.personel_kullanici_adi_degistir(
  p_kullanici uuid,
  p_yeni_ad   text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := app.current_tenant_id();
  v_ad     text := app.kullanici_adi_duzelt(p_yeni_ad);
  v_rol    text;
begin
  if not app.yetkim_var('users.manage') then
    raise exception 'Kullanıcı adı değiştirmek için `users.manage` izni gerekiyor.'
      using errcode = 'MI403';
  end if;
  if v_ad = '' or length(v_ad) < 3 then
    raise exception 'Kullanıcı adı en az 3 karakter olmalı.' using errcode = 'MI400';
  end if;

  select u.role_code into v_rol
    from public.app_user u
   where u.id = p_kullanici and u.tenant_id = v_tenant;
  if v_rol is null then
    raise exception 'Kullanıcı bu işletmede bulunamadı.' using errcode = 'MI424';
  end if;

  -- ⚠️ 0076'daki kuralın aynısı: platform rolleri bu kapıdan yönetilmez.
  if v_rol in ('super_admin', 'admin') then
    raise exception 'Platform yöneticisinin kullanıcı adı buradan değiştirilemez.'
      using errcode = 'MI403';
  end if;

  if exists (select 1 from public.app_user u
              where u.tenant_id = v_tenant
                and u.username_key = v_ad
                and u.id <> p_kullanici) then
    raise exception 'Bu kullanıcı adı işletmenizde zaten kullanılıyor.'
      using errcode = 'MI409';
  end if;

  update public.app_user
     set username = v_ad, username_key = v_ad, updated_at = now()
   where id = p_kullanici;

  return app.giris_adi(p_kullanici);
end;
$$;


-- ── 5 · PostgREST KAPILARI ───────────────────────────────────────────────
create or replace function public.giris_adresi_bul(
  p_kullanici text, p_isletme text default null
)
returns text
language sql stable security definer set search_path = public, app, pg_temp
as $$ select app.giris_adresi_bul(p_kullanici, p_isletme) $$;

create or replace function public.giris_adi(p_kullanici uuid)
returns text
language sql stable security definer set search_path = public, app, pg_temp
as $$ select app.giris_adi(p_kullanici) $$;

create or replace function public.giris_adlari()
returns table (kullanici_id uuid, giris_adi text)
language sql stable security definer set search_path = public, app, pg_temp
as $$ select * from app.giris_adlari() $$;

create or replace function public.personel_kullanici_adi_degistir(
  p_kullanici uuid, p_yeni_ad text
)
returns text
language sql security definer set search_path = public, app, pg_temp
as $$ select app.personel_kullanici_adi_degistir(p_kullanici, p_yeni_ad) $$;

-- ⚠️ POSTGRESQL'DE FONKSİYON VARSAYILANI `PUBLIC EXECUTE` (tuzak 67) ve
-- `anon`un `app` şeması üzerinde `usage` hakkı var. Her fonksiyonun kapısı
-- ELLE kapatılıyor; dışarıya açılan tek yüzey `public` sarmalayıcılardır.
do $$
declare v_ad text;
begin
  foreach v_ad in array array[
    'app.giris_adresi_bul(text, text)',
    'app.giris_adi(uuid)',
    'app.giris_adlari()',
    'app.personel_kullanici_adi_degistir(uuid, text)',
    'app.kullanici_adi_duzelt(text)'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('grant execute on function %s to service_role', v_ad);
  end loop;
end;
$$;

-- `giris_adresi_bul` GİRİŞ EKRANINDAN çağrılıyor; oturum henüz yok.
revoke all     on function public.giris_adresi_bul(text, text) from public;
grant  execute on function public.giris_adresi_bul(text, text)
  to anon, authenticated, service_role;

do $$
declare v_ad text;
begin
  foreach v_ad in array array[
    'public.giris_adi(uuid)',
    'public.giris_adlari()',
    'public.personel_kullanici_adi_degistir(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('revoke all on function %s from anon', v_ad);
    execute format('grant execute on function %s to authenticated, service_role', v_ad);
  end loop;
end;
$$;


-- ── 6 · DOĞRULAMA ────────────────────────────────────────────────────────
do $$
declare v_ad text;
begin
  foreach v_ad in array array[
    'app.giris_adresi_bul(text, text)',
    'app.giris_adi(uuid)',
    'app.giris_adlari()',
    'app.personel_kullanici_adi_degistir(uuid, text)',
    'public.giris_adresi_bul(text, text)',
    'public.giris_adi(uuid)',
    'public.giris_adlari()',
    'public.personel_kullanici_adi_degistir(uuid, text)'
  ] loop
    if to_regprocedure(v_ad) is null then
      raise exception '0078: % oluşmadı.', v_ad;
    end if;
  end loop;

  -- ⚠️ PUBLIC kapısı kapandı mı? (varsayılan AÇIKTIR)
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(p.proacl) a
    where n.nspname in ('app', 'public')
      and p.proname in ('giris_adresi_bul', 'giris_adi', 'giris_adlari',
                        'personel_kullanici_adi_degistir')
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception '0078: fonksiyonlardan biri HERKESE açık kalmış.';
  end if;

  if has_function_privilege('anon', 'public.giris_adi(uuid)', 'execute') then
    raise exception '0078: anon kullanıcı listesine ulaşabiliyor.';
  end if;
  if not has_function_privilege('anon', 'public.giris_adresi_bul(text, text)', 'execute') then
    raise exception '0078: anon çağıramıyor — giriş ekranı adı çeviremez.';
  end if;

  -- Nokta korunuyor, boşluk noktaya dönüyor, Türkçe harf sadeleşiyor.
  if app.kullanici_adi_duzelt('Alaattin Kocatepe') <> 'alaattin.kocatepe' then
    raise exception '0078: ad.soyad biçimi üretilmiyor (% geldi).',
      app.kullanici_adi_duzelt('Alaattin Kocatepe');
  end if;
  if app.kullanici_adi_duzelt('  Şükrü  ÖZÇİĞDEM  ') <> 'sukru.ozcigdem' then
    raise exception '0078: Türkçe harfler sadeleşmiyor (% geldi).',
      app.kullanici_adi_duzelt('  Şükrü  ÖZÇİĞDEM  ');
  end if;
  -- ⚠️ ESKİ KAYITLAR BOZULMAMALI: noktasız ad noktasız kalır.
  if app.kullanici_adi_duzelt('depocu') <> 'depocu' then
    raise exception '0078: mevcut kullanıcı adları değişiyor.';
  end if;
  -- ⚠️ 40 karakter sınırı KORUNUYOR ve sonu noktayla bitmiyor.
  if length(app.kullanici_adi_duzelt(repeat('ab ', 30))) > 40
     or right(app.kullanici_adi_duzelt(repeat('ab ', 30)), 1) = '.' then
    raise exception '0078: uzun ad kırpılmıyor ya da nokta ile bitiyor (%).',
      app.kullanici_adi_duzelt(repeat('ab ', 30));
  end if;

  -- Sahte adres dönüşü KORUNUYOR (kullanıcı adı sayılamasın).
  if app.giris_adresi_bul('kesinlikle-boyle-biri-yok') is null then
    raise exception '0078: bulunamayan ad için NULL dönüyor.';
  end if;
  if app.giris_adresi_bul('Birisi@Ornek.COM') <> 'birisi@ornek.com' then
    raise exception '0078: e-posta girdisi olduğu gibi dönmüyor.';
  end if;

  raise notice '0078 TAMAM · giriş adı ad.soyad@FIRMAKODU; kullanıcı adı değiştirilebilir';
end;
$$;

-- ── 7 · ⚠️ PostgREST ŞEMA ÖNBELLEĞİNİ TAZELE ─────────────────────────────
-- 12.10.2026'da bulundu: göç başarıyla çalıştı ama ekran
--   "Could not find the function public.personel_kullanici_adi_degistir
--    in the schema cache"
-- dedi. Sebep: PostgREST hangi fonksiyonların VAR olduğunu bir önbellekten
-- okuyor ve yeni fonksiyonu kendiliğinden görmesi dakikalar sürebiliyor.
-- Yani göç doğru, veritabanı doğru, ekran yanlış.
--
-- ⚠️ YENİ `public` FONKSİYONU EKLEYEN HER GÖÇÜN SONUNA BU SATIR KONUR.
-- Konmazsa hata, göçte bir yanlışlık varmış gibi görünür ve insan olmayan
-- bir sorunu aramaya başlar.
notify pgrst, 'reload schema';
