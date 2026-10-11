-- ═══════════════════════════════════════════════════════════════════════════
-- 0076 · PERSONEL HESABI İŞLETMENİN KENDİ ELİNDE
-- ---------------------------------------------------------------------------
-- Bugüne kadar Kullanıcılar ekranı şunu yazıyordu:
--   "Yeni kullanıcı bu ekrandan açılmıyor... bu iş Supabase panelinden
--    yapılıyor."
-- ⚠️ Bu cümle müşteriye BİZİM İÇ ARACIMIZIN ADINI söylüyor ve Emrah'ın
-- kuralını çiğniyor: "müşterinin görmemesi gereken hiçbir şey müşteri
-- ekranında olmasın." Dahası müşteri kendi personelini açamıyor.
--
-- ── EMRAH'IN KARARI (11.10) ───────────────────────────────────────────────
--   İşletme sahibi / müdür → gerçek e-posta + şifre, kendi sıfırlar
--   PERSONEL               → KULLANICI ADI + ŞİFRE, e-posta YOK
--                            şifresini YÖNETİCİ sıfırlar
--
-- Gerekçe: bir depocunun iş e-postası çoğu zaman YOKTUR. Ondan e-posta
-- istemek kurulumu kilitler. Ayrıca ücretsiz plandaki davet e-postası
-- limiti (saatte birkaç tane) böylece tamamen devre dışı kalıyor:
-- 15 personel için 15 e-posta diye bir şey kalmıyor.
--
-- ⚠️ 2FA DEMODAN ÖNCE YOK (Emrah onayladı). Patronun korunması bugün
-- denetim kaydıyla: her kritik işlemde kim yaptığı duruyor.
--
-- ── GEÇİCİ ŞİFRE KURALI (Emrah onayladı) ─────────────────────────────────
-- Yönetici ilk şifreyi belirler. Karşılığında ÜÇ ŞART:
--   1. Şifre BİZİM veritabanımıza HİÇ yazılmaz — yalnız Supabase Auth'un
--      özeti durur. Bu göçte şifreyi tutan tek bir sütun bile yok.
--   2. Hiçbir günlüğe, denetim kaydına, hata bildirimine düşmez.
--   3. İLK GİRİŞTE DEĞİŞTİRMEK ZORUNLU → `must_change_password`.
-- Yol haritasındaki "okunabilir geçici şifre hiçbir yerde durmuyor"
-- maddesi böyle karşılanıyor.
--
-- ── İŞ BÖLÜMÜ ─────────────────────────────────────────────────────────────
-- Supabase Auth'ta kullanıcı yaratmak `service_role` anahtarı ister ve o
-- anahtar TARAYICIYA ASLA İNMEZ. 0039'daki kalıbın aynısı:
--   1. Edge Function (`personel-hesabi-ac`) — Auth kullanıcısını yaratır.
--   2. Bu göçteki `app.personel_hesabi_ac` — kalan her şeyi TEK İŞLEMDE:
--      app_user + user_role + şube erişimi + zorunlu şifre bayrağı.
-- Bölünme keyfi değil: veritabanı işini SQL'de tutmak provada sınamamı
-- sağlıyor. Edge Function'ın içinde kalsaydı ilk kez canlıda çalışırdı.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1 · İLK GİRİŞTE ŞİFRE DEĞİŞTİRME BAYRAĞI ─────────────────────────────
alter table app_user
  add column if not exists must_change_password boolean not null default false;

comment on column app_user.must_change_password is
  'TRUE ise kullanıcı giriş yapar yapmaz şifresini değiştirmek ZORUNDA. '
  'Yönetici bir personel hesabı açtığında ya da şifresini sıfırladığında '
  'kuruluyor. Geçici şifre bu yüzden bir yerde saklanmak zorunda değil.';


-- ── 2 · PERSONELİN GİRİŞ ADRESİ TEK YERDE ÜRETİLİYOR ─────────────────────
-- ⚠️ Supabase Auth e-posta ZORUNLU tutuyor ama personelin e-postası yok.
-- Çözüm: hiçbir zaman posta gitmeyecek DAHİLİ bir adres. Kullanıcı
-- "depocu" yazıp girer; bu adresi hiç görmez.
--
-- ⚠️ ADRES BURADA ÜRETİLİYOR, EDGE FUNCTION'DA DEĞİL. İki yerde üretilseydi
-- bir gün biri birini değiştirir ve kullanıcı sessizce giriş yapamaz hâle
-- gelirdi; sebebini bulmak günler alırdı.
--
-- ⚠️ `.miyop.local` BİLEREK: `.local` ayrılmış bir son ek, internette
-- karşılığı yok. Gerçek bir alan adı kullansaydık o adrese yanlışlıkla
-- posta gidebilirdi.
create or replace function app.personel_giris_adresi(
  p_kiraci uuid, p_kullanici_adi text
)
returns text
language plpgsql
stable
set search_path = public, app, pg_temp
as $$
declare v_kod text;
begin
  select lower(regexp_replace(t.code, '[^A-Za-z0-9]', '', 'g'))
    into v_kod from public.tenant t where t.id = p_kiraci;
  if v_kod is null or v_kod = '' then
    raise exception 'İşletme kodu bulunamadı.' using errcode = 'MI404';
  end if;
  return lower(btrim(p_kullanici_adi)) || '@' || v_kod || '.miyop.local';
end;
$$;

create or replace function public.personel_giris_adresi(
  p_kiraci uuid, p_kullanici_adi text
)
returns text
language sql stable security definer set search_path = public, app, pg_temp
as $$ select app.personel_giris_adresi(p_kiraci, p_kullanici_adi) $$;


-- ── 3 · KULLANICI ADI NORMALLEŞTİRME ─────────────────────────────────────
-- ⚠️ `username` ile `username_key` AYNI kurallarla üretiliyor (0039'daki
-- gibi). Tekillik `username_key` üzerinden; büyük/küçük harf ya da Türkçe
-- karakter farkıyla iki "Depocu" açılamaz.
create or replace function app.kullanici_adi_duzelt(p_ad text)
returns text
language sql
immutable
as $$
  select left(
    regexp_replace(
      translate(lower(btrim(coalesce(p_ad, ''))), 'çğıöşüÇĞİÖŞÜ', 'cgiosucgiosu'),
      '[^a-z0-9]', '', 'g'),
    40)
$$;


-- ── 4 · PERSONEL HESABI AÇ ────────────────────────────────────────────────
-- ⚠️ `security definer` + kiracı duvarı BURADA. Çağıranın app_user'a
-- doğrudan yazma yetkisi yok; RLS bizi korumuyor, duvarı kendimiz kuruyoruz
-- (0063 ve 0072'deki kalıp).
create or replace function app.personel_hesabi_ac(
  p_auth_user_id  uuid,
  p_kullanici_adi text,
  p_ad_soyad      text,
  p_rol           text,
  p_subeler       uuid[] default null
)
returns table (kullanici_id uuid, kullanici_adi text, giris_adresi text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid := app.current_tenant_id();
  v_firma  uuid;
  v_ad     text;
  v_kid    uuid;
  v_sube   uuid;
  v_say    int;
begin
  if v_tenant is null then
    raise exception 'Oturumda işletme bilgisi yok.' using errcode = 'MI403';
  end if;

  if not app.yetkim_var('users.manage') then
    raise exception 'Kullanıcı açmak için `users.manage` izni gerekiyor. '
      'Bu izin işletme sahibinde bulunur.'
      using errcode = 'MI403';
  end if;

  if p_auth_user_id is null then
    raise exception 'Giriş hesabı kimliği boş; Edge Function onu yaratıp '
      'buraya vermek zorunda.' using errcode = 'MI400';
  end if;

  v_ad := app.kullanici_adi_duzelt(p_kullanici_adi);
  if length(v_ad) < 3 then
    raise exception 'Kullanıcı adı en az 3 harf/rakam olmalı (gelen: %).',
      coalesce(p_kullanici_adi, '') using errcode = 'MI400';
  end if;

  if coalesce(btrim(p_ad_soyad), '') = '' then
    raise exception 'Ad soyad boş olamaz; defterde "kim yaptı" yazacak.'
      using errcode = 'MI400';
  end if;

  if exists (select 1 from public.app_user u
              where u.tenant_id = v_tenant and u.username_key = v_ad) then
    raise exception 'Bu işletmede "%" kullanıcı adı zaten var.', v_ad
      using errcode = 'MI409';
  end if;

  if not exists (select 1 from public.role r where r.code = p_rol) then
    raise exception 'Tanınmayan rol: %. Listeden seçilmeli.', p_rol
      using errcode = 'MI400';
  end if;

  -- ⚠️ YETKİ YÜKSELTME KAPISI. Bu kapı olmasaydı bir işletme sahibi
  -- kendine `admin` ya da `super_admin` rolünde bir hesap açıp PLATFORMUN
  -- tamamına, yani BÜTÜN MÜŞTERİLERE erişebilirdi. Kiracı duvarının en
  -- sessiz deliği budur: duvarı delmeye gerek yok, duvarın üstünde bir
  -- hesap açmak yeter.
  if p_rol in ('super_admin', 'admin') then
    raise exception 'Platform rolleri (% ) işletme içinden verilemez.', p_rol
      using errcode = 'MI403';
  end if;

  select c.id into v_firma from public.company c
   where c.tenant_id = v_tenant order by c.created_at limit 1;

  insert into public.app_user (
    tenant_id, company_id, auth_user_id,
    username, username_key, full_name, role_code, is_active,
    must_change_password
  ) values (
    v_tenant, v_firma, p_auth_user_id,
    v_ad, v_ad, btrim(p_ad_soyad), p_rol, true,
    true   -- ⚠️ İLK GİRİŞTE ŞİFRE DEĞİŞECEK
  ) returning id into v_kid;

  -- ⚠️ İKİ YER: `app_user.role_code` birincil rol, `user_role` ek roller;
  -- etkin izin İKİSİNİN BİRLEŞİMİ (0036). Aynı rol ikisine de yazılıyor ki
  -- yetki ekranı bu kullanıcıyı doğru göstersin.
  insert into public.user_role (tenant_id, user_id, role_code)
  values (v_tenant, v_kid, p_rol)
  on conflict (user_id, role_code) do nothing;

  -- Şube erişimi: verilmemişse merkez şube.
  if p_subeler is null or array_length(p_subeler, 1) is null then
    select b.id into v_sube from public.branch b
     where b.tenant_id = v_tenant and b.is_head_office
     order by b.created_at limit 1;
    if v_sube is null then
      select b.id into v_sube from public.branch b
       where b.tenant_id = v_tenant order by b.created_at limit 1;
    end if;
    if v_sube is null then
      raise exception 'İşletmenin hiç şubesi yok; hesap bağlanamaz.'
        using errcode = 'MI500';
    end if;
    insert into public.user_branch_access (tenant_id, user_id, branch_id)
    values (v_tenant, v_kid, v_sube)
    on conflict (user_id, branch_id) do nothing;
  else
    -- ⚠️ BAŞKA İŞLETMENİN ŞUBESİ VERİLEMEZ.
    select count(*) into v_say from unnest(p_subeler) as s(id)
     where not exists (select 1 from public.branch b
                        where b.id = s.id and b.tenant_id = v_tenant);
    if v_say > 0 then
      raise exception 'Verilen şubelerden %''i bu işletmeye ait değil.', v_say
        using errcode = 'MI424';
    end if;
    insert into public.user_branch_access (tenant_id, user_id, branch_id)
    select v_tenant, v_kid, s.id from unnest(p_subeler) as s(id)
    on conflict (user_id, branch_id) do nothing;
  end if;

  return query
    select v_kid, v_ad, app.personel_giris_adresi(v_tenant, v_ad);
end;
$$;

comment on function app.personel_hesabi_ac(uuid, text, text, text, uuid[]) is
  'Mevcut işletmeye personel hesabı bağlar: app_user + user_role + şube '
  'erişimi + "ilk girişte şifre değiştir" bayrağı, TEK İŞLEMDE. Supabase '
  'Auth kullanıcısını YARATMAZ — onu Edge Function yaratır. ŞİFREYİ HİÇ '
  'GÖRMEZ ve hiçbir yere yazmaz. Platform rolleri verilemez (MI403).';


-- ── 5 · ŞİFREMİ BELİRLEDİM ────────────────────────────────────────────────
-- ⚠️ Yalnız ÇAĞIRANIN KENDİ bayrağını düşürür; parametre ALMIYOR.
-- Parametre alsaydı bir kullanıcı başkasının zorunlu şifre değişimini
-- iptal edebilirdi.
create or replace function app.sifremi_belirledim()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_auth uuid;
begin
  begin v_auth := auth.uid(); exception when others then v_auth := null; end;
  if v_auth is null then
    raise exception 'Oturum yok.' using errcode = 'MI403';
  end if;
  update public.app_user set must_change_password = false, updated_at = now()
   where auth_user_id = v_auth;
end;
$$;

create or replace function public.sifremi_belirledim()
returns void
language sql security definer set search_path = public, app, pg_temp
as $$ select app.sifremi_belirledim() $$;


-- ── 6 · ŞİFRE SIFIRLANDI, YENİDEN DEĞİŞTİRİLSİN ──────────────────────────
-- Yönetici Auth tarafında şifreyi sıfırladıktan sonra bunu çağırır.
create or replace function app.personel_sifresi_sifirlandi(p_kullanici uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_tenant uuid := app.current_tenant_id();
begin
  if not app.yetkim_var('users.manage') then
    raise exception 'Şifre sıfırlamak için `users.manage` izni gerekiyor.'
      using errcode = 'MI403';
  end if;
  if not exists (select 1 from public.app_user u
                  where u.id = p_kullanici and u.tenant_id = v_tenant) then
    raise exception 'Kullanıcı bu işletmede bulunamadı.' using errcode = 'MI424';
  end if;
  update public.app_user
     set must_change_password = true, updated_at = now()
   where id = p_kullanici;
end;
$$;

create or replace function public.personel_sifresi_sifirlandi(p_kullanici uuid)
returns void
language sql security definer set search_path = public, app, pg_temp
as $$ select app.personel_sifresi_sifirlandi(p_kullanici) $$;


-- ── 7 · PostgREST KAPILARI ────────────────────────────────────────────────
create or replace function public.personel_hesabi_ac(
  p_auth_user_id uuid, p_kullanici_adi text, p_ad_soyad text,
  p_rol text, p_subeler uuid[] default null
)
returns table (kullanici_id uuid, kullanici_adi text, giris_adresi text)
language sql security definer set search_path = public, app, pg_temp
as $$ select * from app.personel_hesabi_ac(
        p_auth_user_id, p_kullanici_adi, p_ad_soyad, p_rol, p_subeler) $$;

do $$
declare v_ad text;
begin
  foreach v_ad in array array[
    'public.personel_hesabi_ac(uuid, text, text, text, uuid[])',
    'public.personel_giris_adresi(uuid, text)',
    'public.sifremi_belirledim()',
    'public.personel_sifresi_sifirlandi(uuid)'
  ] loop
    execute format('revoke all on function %s from public', v_ad);
    execute format('revoke all on function %s from anon', v_ad);
    execute format('grant execute on function %s to authenticated, service_role', v_ad);
  end loop;
end;
$$;


-- ── 8 · DOĞRULAMA ─────────────────────────────────────────────────────────
do $$
declare v_ad text; v_eksik text := '';
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'app_user'
       and column_name = 'must_change_password'
  ) then
    raise exception '0076: must_change_password sütunu yok.';
  end if;

  foreach v_ad in array array[
    'app.personel_hesabi_ac(uuid, text, text, text, uuid[])',
    'app.personel_giris_adresi(uuid, text)',
    'app.kullanici_adi_duzelt(text)',
    'app.sifremi_belirledim()',
    'app.personel_sifresi_sifirlandi(uuid)',
    'public.personel_hesabi_ac(uuid, text, text, text, uuid[])',
    'public.personel_giris_adresi(uuid, text)',
    'public.sifremi_belirledim()',
    'public.personel_sifresi_sifirlandi(uuid)'
  ] loop
    if to_regprocedure(v_ad) is null then v_eksik := v_eksik || v_ad || ' '; end if;
  end loop;
  if v_eksik <> '' then
    raise exception '0076: oluşmayan fonksiyon(lar): %', v_eksik;
  end if;

  -- ⚠️ ŞİFRE SÜTUNU OLMAMALI. Bu kontrol olmasaydı bir gün biri
  -- "kolay olsun" diye geçici şifreyi tabloya yazardı.
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'app_user'
       and column_name ~* '(password|sifre|parola)'
       and column_name <> 'must_change_password'
  ) then
    raise exception '0076: app_user''da şifre tutan bir sütun var — '
      'geçici şifre hiçbir yerde durmamalı.';
  end if;

  -- Yetki yükseltme kapısı kodda duruyor mu?
  if not exists (
    select 1 from pg_proc p
     where p.oid = to_regprocedure('app.personel_hesabi_ac(uuid, text, text, text, uuid[])')
       and pg_get_functiondef(p.oid) like '%super_admin%'
  ) then
    raise exception '0076: platform rolü kapısı yok — işletme içinden '
      'admin hesabı açılabilir.';
  end if;

  if exists (
    select 1 from pg_proc p, aclexplode(p.proacl) a
     where p.oid = to_regprocedure('public.personel_hesabi_ac(uuid, text, text, text, uuid[])')
       and a.grantee = 0 and a.privilege_type = 'EXECUTE'
  ) then
    raise exception '0076: PUBLIC EXECUTE açık kalmış.';
  end if;

  if has_function_privilege('anon',
       'public.personel_hesabi_ac(uuid, text, text, text, uuid[])', 'execute') then
    raise exception '0076: hesap açma anon''a açık.';
  end if;

  raise notice '0076 TAMAM · personel hesabı işletmeden açılıyor; ilk girişte şifre zorunlu';
end;
$$;
