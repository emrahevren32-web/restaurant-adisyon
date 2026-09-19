-- ═══════════════════════════════════════════════════════════════════════════
-- 0036 — app.yetkim_var: ETKİN İZİN = BİRİNCİL ROL ∪ EK ROLLER
--
-- ── NEDEN VAR ────────────────────────────────────────────────────────────
-- "Onay Bekleyen İşletmeler" ekranı 0 kayıt gösterdi. Veritabanında
-- başvuru VARDI (MIY-JQ28C). Sebep şuydu:
--
--   Tarayıcı tarafı izni şöyle hesaplıyor (0015, permission.repository.ts):
--       etkin izinler = app_user.role_code  ∪  user_role satırları
--   0032'de yazdığım `app.yetkim_var` ise SADECE `user_role`a bakıyordu.
--
-- Emrah'ın `app_user.role_code` değeri 'admin' (0008). `admin` rolü
-- `platform.manage` iznini alıyor (0014). Ama `user_role` tablosunda satırı
-- YOK — o tabloya yalnız `assign_user_roles` RPC'si yazıyor ve hiç
-- çağrılmadı. Sonuç: tarayıcı "yetkin var" diyip menüyü açtı, veritabanı
-- "yetkin yok" deyip bütün satırları gizledi. Ekran boş, hata yok.
--
-- ── DERS ─────────────────────────────────────────────────────────────────
-- Aynı kural iki yerde yazılıysa, ikisi kaçınılmaz olarak ayrışır. 0015 bu
-- kuralı yazıyla koydu: "Etkin izin kümesi = birincil rol ∪ buradaki tüm
-- roller (BİRLEŞİM)." Tarayıcı ona uydu, benim SQL fonksiyonum uymadı.
-- Bu göç fonksiyonu kurala getiriyor; ayrıca bir mimari testi (aşağıdaki
-- dosya) bundan sonra ayrışmayı kırmızıya düşürüyor.
--
-- ── EK SIKILAŞTIRMA ──────────────────────────────────────────────────────
-- Fonksiyon artık `is_active` de bakıyor. Kapatılmış bir kullanıcının
-- izni olmamalı; 0032'deki hâli bunu sınamıyordu. Bu bir GEVŞEME değil,
-- daralma — mevcut hiçbir açık kapı kapanmıyor, açık kalması gereken
-- kapı (aktif kullanıcı) aynı kalıyor.
--
-- Veri değişmiyor: tek satır bile insert/update edilmiyor. Yalnız
-- fonksiyon gövdesi değişiyor. Geri alınabilir.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.yetkim_var(p_izin text)
returns boolean
language plpgsql stable security definer set search_path = public, app as $$
declare
  v_auth uuid;
  v_var  boolean;
begin
  -- Oturum yoksa (göç sırasında, arka plan işinde) auth.uid() patlayabilir.
  begin
    v_auth := auth.uid();
  exception when others then v_auth := null;
  end;
  if v_auth is null then return false; end if;

  select exists (
    select 1
      from app_user u
      join role_permission rp
        on rp.permission_code = p_izin
       -- BİRLEŞİM: ya birincil rol eşleşir, ya da kullanıcının o role ait
       -- bir `user_role` satırı vardır. Tarayıcıdaki kural birebir bu.
       and ( rp.role_code = u.role_code
             or exists (select 1 from user_role ur
                         where ur.user_id   = u.id
                           and ur.role_code = rp.role_code) )
     where u.auth_user_id = v_auth
       and u.is_active
  ) into v_var;

  return coalesce(v_var, false);
end $$;

comment on function app.yetkim_var(text) is
  'Oturumdaki AKTİF kullanıcının verilen izni var mı. Etkin izin kümesi = '
  'app_user.role_code (birincil rol) ∪ user_role (ek roller) — 0015''te '
  'konan kural; tarayıcı tarafı (permission.repository.ts) da aynısını '
  'uygular. Kiracıya ait OLMAYAN tabloların politikaları bunu kullanır '
  '(bkz. business_application, 0032/0035).';

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- Göç sırasında oturum yok, bu yüzden fonksiyonu ÇAĞIRARAK sınayamayız
-- (auth.uid() null → her zaman false). Bunun yerine fonksiyonun dayandığı
-- BİRLEŞİMİ aynı sorguyla, kullanıcı kullanıcı gösteriyoruz.
--
-- 1) Platform yöneticisi `platform.manage` görüyor mu? Görmüyorsa göç
--    burada durur — sessizce "geçti" demesine izin vermiyoruz.
do $$
declare
  v_gorur boolean;
begin
  select exists (
    select 1
      from app_user u
      join role_permission rp
        on rp.permission_code = 'platform.manage'
       and ( rp.role_code = u.role_code
             or exists (select 1 from user_role ur
                         where ur.user_id = u.id and ur.role_code = rp.role_code) )
     where u.auth_user_id = '141939e8-5779-43af-b468-9cbc8ee2b1fb'
       and u.is_active
  ) into v_gorur;

  if not v_gorur then
    raise exception 'DURDU: platform yöneticisi platform.manage iznini hâlâ '
      'görmüyor. app_user.role_code ya da role_permission eşlemesi beklenenden '
      'farklı. Ekran yine boş kalırdı.';
  end if;
  raise notice 'Platform yöneticisi platform.manage iznini goruyor.';
end $$;

-- 1b) Fonksiyonun GÖVDESİ gerçekten iki kaynağa da bakıyor mu?
--     Yukarıdaki kontrol birleşim SORGUSUNU sınıyor, fonksiyonu değil.
--     Bu ayrım önemli: göç sırasında oturum yok, `app.yetkim_var()` her
--     zaman false döner, yani fonksiyonu çağırarak sınayamayız. Gövdesini
--     okuyabiliriz.
do $$
declare
  v_kaynak text;
begin
  select pg_get_functiondef(p.oid) into v_kaynak
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'yetkim_var';

  if v_kaynak is null then
    raise exception 'DURDU: app.yetkim_var bulunamadi.';
  end if;
  if v_kaynak not like '%u.role_code%' then
    raise exception 'DURDU: app.yetkim_var birincil role (app_user.role_code) '
      'bakmiyor. Ekran yine bos kalirdi.';
  end if;
  if v_kaynak not like '%user_role%' then
    raise exception 'DURDU: app.yetkim_var ek rollere (user_role) bakmiyor.';
  end if;
  if v_kaynak not like '%is_active%' then
    raise exception 'DURDU: app.yetkim_var kapatilmis kullaniciyi eliyor mu belli degil.';
  end if;
  raise notice 'Fonksiyon gövdesi iki kaynaga da bakiyor (birincil rol + ek roller).';
end $$;

-- 2) Kim hangi izni görüyor: insan gözüyle bakılacak tablo.
--    `platform_yonetimi` sütunu yalnız MİYOP personelinde 'evet' olmalı.
select
  u.username                            as kullanici,
  u.role_code                           as birincil_rol,
  coalesce((select string_agg(ur.role_code, ', ' order by ur.role_code)
              from user_role ur where ur.user_id = u.id), '—') as ek_roller,
  (select count(distinct rp.permission_code)
     from role_permission rp
    where rp.role_code = u.role_code
       or exists (select 1 from user_role ur
                   where ur.user_id = u.id and ur.role_code = rp.role_code))
                                        as etkin_izin_adedi,
  case when exists (
    select 1 from role_permission rp
     where rp.permission_code = 'platform.manage'
       and ( rp.role_code = u.role_code
             or exists (select 1 from user_role ur
                         where ur.user_id = u.id and ur.role_code = rp.role_code)))
  then 'evet' else 'hayir' end          as platform_yonetimi,
  u.is_active                           as aktif_mi
from app_user u
order by u.username;

-- 3) Bekleyen başvuru gerçekten orada mı? (RLS'i atlayan göç oturumundan
--    bakıyoruz — ekran boşsa sorun yetkidedir, veride değil.)
select status as durum, count(*) as adet
from business_application
group by status
order by status;
