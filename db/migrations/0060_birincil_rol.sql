-- ═══════════════════════════════════════════════════════════════════════════
-- 0060 · BİRİNCİL ROLÜ EKRANDAN DEĞİŞTİRME — `set_primary_role`
-- ---------------------------------------------------------------------------
-- Emrah (04.10.2026): *"her rolün kullanıcılarını tanımladığımız yetki
-- grupları olsa daha mı iyi olur? Mesela her departmanı rol olarak oluştursak,
-- her departmana birer personel atasak gibi?"*
--
-- Karar: ana ekran ROL ÖNCE çalışacak — rolü aç, içine kişi ekle. 40 kişilik
-- bir fabrikada ilk kurulumu kişi kişi dolaşarak yapmak 40 ekran demek.
--
-- ── NEDEN YENİ BİR FONKSİYON GEREKTİ ───────────────────────────────────────
-- Bir kişinin yetkisi İKİ yerden geliyor (0036):
--   `app_user.role_code`  → BİRİNCİL rol (ana görev)
--   `user_role`           → EK roller
-- Etkin izin ikisinin BİRLEŞİMİ.
--
-- `assign_user_roles` (0015) yalnız İKİNCİSİNİ değiştiriyor. Birincil rol
-- uygulamaya KAPALI: 0012 `app_user` üzerinde update'i geri aldı ve yalnız
-- `full_name, phone, profile_photo_url, updated_at` sütunlarını açtı. Yani
-- "Hasan depodan sevkiyata geçti" diyen bir yönetici bunu ekrandan
-- yapamıyordu; Supabase paneline girmek gerekiyordu.
--
-- Grup ekranı bu hâlde YARIM çalışırdı: kişiyi gruba ekleyebilir ama ana
-- görevinden çıkaramazdınız. Yarım çalışan bir ekran koymaktansa kapıyı
-- denetimli açıyoruz.
--
-- ⚠️ 0012'NİN KARARI DEĞİŞMEDİ. `app_user`a doğrudan update hâlâ YASAK;
-- yazma yalnız bu `security definer` fonksiyondan geçiyor ve fonksiyon
-- kimin neyi yapabileceğini kendi içinde denetliyor. 0015'in dersi aynen
-- geçerli: RLS satırı korur, SATIRIN İÇERİĞİNİ korumaz — tabloya doğrudan
-- update verseydik herhangi bir personel kendi `role_code`unu
-- `isletme_sahibi` yapardı ve RLS bunu ENGELLEMEZDİ.
--
-- ⚠️ EK ROLLERE DOKUNMUYOR — ve bu bilerek. Hasan'ın ana görevi Depo'dan
-- Sevkiyat'a geçince, Depo rolü EK rol olarak duruyorsa depo yetkileri
-- DEVAM EDER. Burada sessizce silseydik, yönetici bilerek verdiği bir ek
-- rolü kaybederdi. Ekran bunun yerine durumu SÖYLÜYOR ve tek tıkla
-- kaldırma sunuyor.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.set_primary_role(
  p_user_id   uuid,
  p_role_code text
)
returns text
language plpgsql
security definer
-- ⚠️ TUZAK 44: sertleşmiş fonksiyonun çağırdığı HER şey nitelikli olmalı.
-- Burada `auth.uid()` çağrılıyor; `auth` şeması yola açıkça yazılı.
set search_path = public, app, auth, pg_temp
as $$
declare
  v_caller_id     uuid;
  v_caller_tenant uuid;
  v_caller_role   text;
  v_target_tenant uuid;
  v_target_role   text;
  v_sahip_sayisi  integer;
begin
  -- ── Çağıran kim? ────────────────────────────────────────────────────────
  select u.id, u.tenant_id, u.role_code
    into v_caller_id, v_caller_tenant, v_caller_role
  from public.app_user u
  join public.tenant t on t.id = u.tenant_id
  where u.auth_user_id = auth.uid()
    and u.is_active
    and t.status = 'Aktif';

  if v_caller_id is null then
    raise exception 'Aktif bir oturum bulunamadı.' using errcode = 'MI403';
  end if;

  if v_caller_role not in ('super_admin','admin','isletme_sahibi') then
    raise exception 'Ana görev değiştirmek için işletme sahibi veya yönetici olmalısınız.'
      using errcode = 'MI403';
  end if;

  -- ── Hedef BİZİM kullanıcımız mı? ────────────────────────────────────────
  -- Yabancı anahtar "böyle bir kullanıcı var mı" der, "BİZİM kullanıcımız mı"
  -- demez (MI424'ün dersi).
  select u.tenant_id, u.role_code into v_target_tenant, v_target_role
  from public.app_user u where u.id = p_user_id;

  if v_target_tenant is null or v_target_tenant <> v_caller_tenant then
    raise exception 'Bu kullanıcı sizin işletmenizde değil.' using errcode = 'MI403';
  end if;

  if not exists (select 1 from public.role r where r.code = p_role_code) then
    raise exception 'Tanımsız rol: %', p_role_code using errcode = 'MI400';
  end if;

  -- ── Yetki yükseltme kapısı — `assign_user_roles` ile AYNI kural ─────────
  if p_role_code = 'super_admin' and v_caller_role <> 'super_admin' then
    raise exception 'super_admin rolünü yalnızca platform yöneticisi verebilir.'
      using errcode = 'MI403';
  end if;

  if p_role_code = 'admin' and v_caller_role not in ('super_admin','admin') then
    raise exception 'admin rolünü işletme sahibi veremez.' using errcode = 'MI403';
  end if;

  -- ── KENDİ ANA GÖREVİNİ DEĞİŞTİREMEZSİN ──────────────────────────────────
  -- İşletme sahibi kendini "depo sorumlusu" yaparsa bir daha bu ekrana
  -- giremez ve işletmeyi kimse yönetemez. Kilidi dışarıdan açacak kimse
  -- yok: parolayı biz tutmuyoruz, rolü de biz değiştiremiyoruz.
  if p_user_id = v_caller_id then
    raise exception 'Kendi ana görevinizi bu ekrandan değiştiremezsiniz; '
      'kendinizi yetkisiz bırakırsanız işletmeye kimse giremez.'
      using errcode = 'MI403';
  end if;

  -- ── SON İŞLETME SAHİBİ GÖREVDEN ALINAMAZ ────────────────────────────────
  -- İki sahip birbirini indirirse sıfır sahip kalır. Yukarıdaki "kendini
  -- değiştiremezsin" kuralı bunu tek başına engellemiyor.
  if v_target_role = 'isletme_sahibi' and p_role_code <> 'isletme_sahibi' then
    select count(*) into v_sahip_sayisi
      from public.app_user
     where tenant_id = v_caller_tenant
       and role_code = 'isletme_sahibi'
       and is_active;

    if v_sahip_sayisi <= 1 then
      raise exception 'İşletmenin son sahibi görevden alınamaz. Önce başka '
        'birini işletme sahibi yapın.' using errcode = 'MI403';
    end if;
  end if;

  -- Aynı rol tekrar yazılırsa gereksiz bir denetim satırı doğmasın.
  if v_target_role = p_role_code then
    return p_role_code;
  end if;

  update public.app_user
     set role_code  = p_role_code,
         updated_at = now()
   where id = p_user_id;

  return p_role_code;
end $$;

comment on function public.set_primary_role(uuid, text) is
  'Bir kullanıcının BİRİNCİL rolünü (app_user.role_code) değiştirir. Yalnızca '
  'aktif tenant''ın super_admin / admin / isletme_sahibi kullanıcısı çağırabilir; '
  'hedef çağıranın tenant''ında olmalı. İşletme sahibi platform rollerini veremez, '
  'kimse KENDİ ana görevini değiştiremez, işletmenin SON sahibi görevden alınamaz. '
  'EK rollere (user_role) DOKUNMAZ. Bkz. docs/yetki-cercevesi.md';

revoke execute on function public.set_primary_role(uuid, text) from public, anon;
grant  execute on function public.set_primary_role(uuid, text) to authenticated;

-- ── Doğrulama ────────────────────────────────────────────────────────────
do $$
begin
  if to_regprocedure('public.set_primary_role(uuid, text)') is null then
    raise exception '0060: set_primary_role oluşmadı.';
  end if;

  -- ⚠️ 0012'nin kararı hâlâ ayakta mı? Fonksiyonu eklerken tabloyu yanlışlıkla
  -- açmış olsaydık bu göç sessizce bir delik yaratırdı.
  if exists (
    select 1 from information_schema.table_privileges
     where table_schema = 'public' and table_name = 'app_user'
       and grantee = 'authenticated' and privilege_type = 'UPDATE'
       and exists (
         select 1 from information_schema.column_privileges c
          where c.table_schema = 'public' and c.table_name = 'app_user'
            and c.grantee = 'authenticated' and c.privilege_type = 'UPDATE'
            and c.column_name = 'role_code')
  ) then
    raise exception '0060: app_user.role_code doğrudan update''e açık — '
      '0012''nin kapattığı kapı yeniden açılmış.';
  end if;

  raise notice '0060 TAMAM · set_primary_role eklendi (app_user tablosu kapalı kaldı)';
end;
$$;
