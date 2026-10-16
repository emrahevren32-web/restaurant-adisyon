-- ═══════════════════════════════════════════════════════════════════════════
-- 0077 · KULLANICI ADIYLA GİRİŞ
-- ---------------------------------------------------------------------------
-- 0076 personel hesabını açtı ama yarım bıraktı: hesap var, kişi GİREMİYOR.
-- Giriş ekranı e-posta istiyor; personelin e-postası yok. Emrah 11.10'da
-- "depocu" hesabını açtı ve haklı olarak sordu:
--     "şimdi bu kullanıcı adı parola ile nasıl giriş yapıcam?"
-- Cevap: yapamıyordu. Bu göç o yolu açıyor.
--
-- ── NASIL ÇALIŞIYOR ───────────────────────────────────────────────────────
-- Kişi "depocu" yazar. Ekran, giriş yapmadan ÖNCE bu fonksiyona sorar:
-- "bu kullanıcı adının giriş adresi nedir?" Dönen adresle Supabase Auth'a
-- gidilir. Kullanıcı o adresi hiç görmez.
--
-- ⚠️ ADRES UYDURULMUYOR, `auth.users`TAN OKUNUYOR. İlk tasarımda adresi
-- kuraldan (kullanıcıadı@işletmekodu.miyop.local) üretecektim; o tasarım
-- İŞLETME SAHİBİNİ KAPIDA BIRAKIRDI — onun giriş adresi GERÇEK e-postası
-- ve kurala uymuyor. Kuraldan üretilen bir adres, kuralın dışında kalan
-- herkesi dışarıda bırakır. Gerçek adres tek bir yerde duruyor: Auth.
--
-- ── ⚠️ GÜVENLİK: KULLANICI ADI SAYMA (enumeration) ───────────────────────
-- Bu fonksiyon GİRİŞ YAPMAMIŞ kişiye açık olmak ZORUNDA — giriş ekranı
-- henüz oturumsuz. Dolayısıyla "bu kullanıcı adı var mı" sorusunun
-- cevabını sızdırma riski taşıyor.
--
-- Önlem: BULUNAMAYAN ad için de GEÇERLİ BİÇİMDE bir adres dönüyor
-- (`<ad>@bulunamadi.miyop.local`). O adresle giriş denemesi Supabase'de
-- "hatalı kullanıcı adı veya şifre" ile biter — yani VAR OLAN yanlış
-- şifreyle AYNI cevabı verir. Dışarıdan ikisi ayırt edilemez.
--
-- ⚠️ Fonksiyon ŞİFRE GÖRMEZ, ŞİFRE DOĞRULAMAZ, OTURUM AÇMAZ. Yalnız bir
-- ad çevirisi yapar. Kimlik doğrulaması olduğu gibi Supabase Auth'ta.
--
-- ── AYNI KULLANICI ADI BİRDEN ÇOK İŞLETMEDE OLABİLİR ─────────────────────
-- `username_key` yalnız KİRACI İÇİNDE tekil (0001). On müşterinin onunda
-- da "depocu" olabilir. O yüzden ikinci bir parametre var: işletme kodu.
-- Birden çok eşleşme varsa adres DÖNMÜYOR — tahmin edip yanlış işletmenin
-- kapısını açmaktansa "bulunamadı" demek doğrudur.
-- ⚠️ Her müşteriye kendi alt alan adı verildiğinde (A5) bu parametre
-- adresten gelecek ve kullanıcıya hiç sorulmayacak.
-- ═══════════════════════════════════════════════════════════════════════════

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
  v_adres text;
  v_say   int;
begin
  if v_girdi = '' then return 'bos@bulunamadi.miyop.local'; end if;

  -- @ varsa zaten e-postadır; çeviriye gerek yok.
  if position('@' in v_girdi) > 0 then return lower(v_girdi); end if;

  v_ad := app.kullanici_adi_duzelt(v_girdi);
  if v_ad = '' then return 'bos@bulunamadi.miyop.local'; end if;

  v_kod := nullif(lower(regexp_replace(coalesce(p_isletme, ''), '[^A-Za-z0-9]', '', 'g')), '');

  -- ⚠️ `is_active` SÜZGECİ BİLEREK YOK. Burası kimlik doğrulama değil, ad
  -- çevirisi. Pasif kullanıcıyı `authenticateUser` zaten reddediyor ve
  -- ona "hesabınız kapalı" diyebiliyor; burada saklasaydık "şifre yanlış"
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
  'Kullanıcı adını, o kişinin Supabase Auth giriş adresine çevirir. '
  'Girdi zaten e-posta ise olduğu gibi döner. Bulunamayan ya da birden '
  'çok işletmede bulunan ad için de GEÇERLİ BİÇİMDE sahte bir adres döner '
  '— böylece "bu ad var mı" sorusu dışarıdan cevaplanamaz. Şifre görmez, '
  'oturum açmaz.';

-- ⚠️ POSTGRESQL'DE FONKSİYON VARSAYILANI `PUBLIC EXECUTE`. Yani bu
-- fonksiyon yazıldığı anda HERKESE açıldı — `anon`un `app` şeması üzerinde
-- `usage` hakkı var (0001), dolayısıyla kapıyı elle kapatmak ZORUNLU.
-- Dışarıya açılan kapı aşağıdaki `public` sarmalayıcıdır; asıl fonksiyon
-- yalnız onun içinden (sahibi olarak) çağrılır.
revoke all     on function app.giris_adresi_bul(text, text) from public;
grant  execute on function app.giris_adresi_bul(text, text) to service_role;

-- ── PostgREST kapısı ──────────────────────────────────────────────────────
create or replace function public.giris_adresi_bul(
  p_kullanici text, p_isletme text default null
)
returns text
language sql stable security definer set search_path = public, app, pg_temp
as $$ select app.giris_adresi_bul(p_kullanici, p_isletme) $$;

-- ⚠️ `anon`A AÇIK OLMAK ZORUNDA. Giriş ekranı henüz oturumsuz; burayı
-- `authenticated`la sınırlamak, kullanıcı adıyla girişi imkânsız kılardı.
-- Bu bilinçli bir kapı ve yukarıdaki "sahte adres" önlemi onun bedeli.
revoke all     on function public.giris_adresi_bul(text, text) from public;
grant  execute on function public.giris_adresi_bul(text, text)
  to anon, authenticated, service_role;


-- ── DOĞRULAMA ─────────────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('app.giris_adresi_bul(text, text)') is null
     or to_regprocedure('public.giris_adresi_bul(text, text)') is null then
    raise exception '0077: giris_adresi_bul oluşmadı.';
  end if;

  if not has_function_privilege('anon', 'public.giris_adresi_bul(text, text)', 'execute') then
    raise exception '0077: anon çağıramıyor — giriş ekranı kullanıcı adını çeviremez.';
  end if;

  -- ⚠️ Sahte adres dönüşü KORUNUYOR. Biri "bulunamadı diye null dönsün,
  -- daha temiz" derse bu kontrol onu durdurur: null dönmek, var olmayan
  -- kullanıcıyı var olandan AYIRT EDİLEBİLİR yapar.
  -- ⚠️ Asıl fonksiyonun PUBLIC kapısı kapandı mı? (varsayılan AÇIKTIR)
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral aclexplode(p.proacl) a
    where n.nspname = 'app' and p.proname = 'giris_adresi_bul'
      and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception '0077: app.giris_adresi_bul HERKESE açık kalmış — PUBLIC EXECUTE kapatılmadı.';
  end if;

  if app.giris_adresi_bul('kesinlikle-boyle-biri-yok') is null then
    raise exception '0077: bulunamayan ad için NULL dönüyor — kullanıcı adı sayılabilir hâle gelir.';
  end if;

  if app.giris_adresi_bul('Birisi@Ornek.COM') <> 'birisi@ornek.com' then
    raise exception '0077: e-posta girdisi olduğu gibi dönmüyor.';
  end if;

  raise notice '0077 TAMAM · kullanıcı adıyla giriş açıldı; bulunamayan ad sızdırmıyor';
end;
$$;
