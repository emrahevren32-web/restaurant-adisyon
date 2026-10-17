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

do $$
declare
  v_t uuid; v_t2 uuid; v_sirket uuid := gen_random_uuid(); v_sube2 uuid := gen_random_uuid();
  v_patron uuid := gen_random_uuid(); v_depocu uuid := gen_random_uuid();
begin
  select id into v_t from public.tenant limit 1;
  insert into public.tenant (id, code, name)
  values (gen_random_uuid(), 'PRV2', 'Prova İkinci') returning id into v_t2;
  insert into public.company (id, tenant_id, company_code, company_name)
  values (v_sirket, v_t2, 'PRV2-S', 'Prova İkinci A.Ş.');
  insert into public.branch (id, tenant_id, company_id, code, name)
  values (v_sube2, v_t2, v_sirket, 'PRV2-M', 'Prova İkinci Merkez');

  insert into public.app_user (id, tenant_id, auth_user_id, username, username_key,
                               full_name, role_code, is_active)
  values (gen_random_uuid(), v_t, v_patron, 'prv_patron', 'prv_patron',
          'Patron', 'isletme_sahibi', true),
         (gen_random_uuid(), v_t, v_depocu, 'prv_depocu', 'prv_depocu',
          'Depocu', 'depo_sorumlusu', true);

  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.t2', v_t2::text, false);
  perform set_config('prova.sube2', v_sube2::text, false);
  perform set_config('prova.patron', v_patron::text, false);
  perform set_config('prova.depocu', v_depocu::text, false);
end; $$;

-- ── 1 · MUTLU YOL ─────────────────────────────────────────────────────────
do $$
declare r record; v_auth uuid := gen_random_uuid(); v_u record;
begin
  perform prova_oturum(current_setting('prova.patron')::uuid,
                       current_setting('prova.t')::uuid);
  select * into r from app.personel_hesabi_ac(
    v_auth, 'Depo Cu', 'Ahmet Yılmaz', 'depo_sorumlusu');

  perform prova_bak('kullanıcı adı normalleşti (Depo Cu → depocu)',
    r.kullanici_adi = 'depocu');
  perform prova_bak('giriş adresi üretildi ve .miyop.local ile bitiyor',
    r.giris_adresi like 'depocu@%.miyop.local');

  select * into v_u from public.app_user where id = r.kullanici_id;
  perform prova_bak('hesap doğru kiracıda',
    v_u.tenant_id = current_setting('prova.t')::uuid);
  perform prova_bak('rol birincil rolde yazılı', v_u.role_code = 'depo_sorumlusu');
  perform prova_bak('⚠️ İLK GİRİŞTE ŞİFRE DEĞİŞTİRME ZORUNLU',
    v_u.must_change_password = true);
  perform prova_bak('ek rol tablosuna da yazıldı (etkin izin BİRLEŞİM)',
    exists (select 1 from public.user_role ur
             where ur.user_id = r.kullanici_id and ur.role_code = 'depo_sorumlusu'));
  perform prova_bak('merkez şubeye erişim verildi',
    exists (select 1 from public.user_branch_access a where a.user_id = r.kullanici_id));
end; $$;

-- ── 2 · YETKİ YÜKSELTME KAPISI — EN KRİTİK TEST ──────────────────────────
do $$
declare v_h text := '';
begin
  perform prova_oturum(current_setting('prova.patron')::uuid,
                       current_setting('prova.t')::uuid);
  begin
    perform * from app.personel_hesabi_ac(
      gen_random_uuid(), 'sahtepatron', 'Sahte Patron', 'admin');
    raise exception 'KAPI GEÇİLDİ — işletme içinden PLATFORM hesabı açıldı';
  exception when sqlstate 'MI403' then v_h := 'ok'; end;
  perform prova_bak('işletme sahibi `admin` rolü VEREMİYOR', v_h = 'ok');

  v_h := '';
  begin
    perform * from app.personel_hesabi_ac(
      gen_random_uuid(), 'sahtesuper', 'Sahte Super', 'super_admin');
    raise exception 'KAPI GEÇİLDİ — super_admin açıldı';
  exception when sqlstate 'MI403' then v_h := 'ok'; end;
  perform prova_bak('`super_admin` rolü de VERİLEMİYOR', v_h = 'ok');
end; $$;

-- ── 3 · YETKİSİ OLMAYAN AÇAMIYOR ──────────────────────────────────────────
do $$
declare v_h text := ''; v_say_once int; v_say_sonra int;
begin
  select count(*) into v_say_once from public.app_user;
  perform prova_oturum(current_setting('prova.depocu')::uuid,
                       current_setting('prova.t')::uuid);
  begin
    perform * from app.personel_hesabi_ac(
      gen_random_uuid(), 'yenikisi', 'Yeni Kişi', 'personel');
    raise exception 'KAPI GEÇİLDİ — depocu kullanıcı açtı';
  exception when sqlstate 'MI403' then v_h := 'ok'; end;
  select count(*) into v_say_sonra from public.app_user;
  perform prova_bak('depo sorumlusu kullanıcı AÇAMIYOR (MI403)', v_h = 'ok');
  perform prova_bak('reddedilen çağrıdan geriye kullanıcı KALMADI',
    v_say_once = v_say_sonra);
end; $$;

-- ── 4 · GİRDİ KAPILARI ────────────────────────────────────────────────────
do $$
declare v_h text := '';
begin
  perform prova_oturum(current_setting('prova.patron')::uuid,
                       current_setting('prova.t')::uuid);

  begin
    perform * from app.personel_hesabi_ac(gen_random_uuid(), 'depocu', 'İkinci Depocu', 'personel');
    raise exception 'KAPI GEÇİLDİ — aynı kullanıcı adı iki kez';
  exception when sqlstate 'MI409' then v_h := 'ok'; end;
  perform prova_bak('aynı kullanıcı adı ikinci kez açılamıyor (MI409)', v_h = 'ok');

  v_h := '';
  begin
    perform * from app.personel_hesabi_ac(gen_random_uuid(), 'ab', 'Kısa Ad', 'personel');
    raise exception 'KAPI GEÇİLDİ — 2 harflik kullanıcı adı';
  exception when sqlstate 'MI400' then v_h := 'ok'; end;
  perform prova_bak('3 harften kısa kullanıcı adı reddediliyor', v_h = 'ok');

  v_h := '';
  begin
    perform * from app.personel_hesabi_ac(gen_random_uuid(), 'bosadli', '   ', 'personel');
    raise exception 'KAPI GEÇİLDİ — boş ad soyad';
  exception when sqlstate 'MI400' then v_h := 'ok'; end;
  perform prova_bak('ad soyad boş olamıyor (defterde "kim yaptı" yazacak)', v_h = 'ok');

  v_h := '';
  begin
    perform * from app.personel_hesabi_ac(gen_random_uuid(), 'uydurma', 'Uydurma Rol', 'ascibasi');
    raise exception 'KAPI GEÇİLDİ — tanınmayan rol';
  exception when sqlstate 'MI400' then v_h := 'ok'; end;
  perform prova_bak('tanınmayan rol reddediliyor', v_h = 'ok');

  v_h := '';
  begin
    perform * from app.personel_hesabi_ac(null, 'authsiz', 'Auth Yok', 'personel');
    raise exception 'KAPI GEÇİLDİ — auth kimliği olmadan hesap';
  exception when sqlstate 'MI400' then v_h := 'ok'; end;
  perform prova_bak('giriş hesabı kimliği olmadan app_user açılamıyor', v_h = 'ok');
end; $$;

-- ── 5 · BAŞKA İŞLETMENİN ŞUBESİ VERİLEMEZ ────────────────────────────────
do $$
declare v_h text := '';
begin
  begin
    perform * from app.personel_hesabi_ac(
      gen_random_uuid(), 'yabancisube', 'Yabancı Şube', 'personel',
      array[current_setting('prova.sube2')::uuid]);
    raise exception 'KİRACI DUVARI DELİNDİ — başka işletmenin şubesi verildi';
  exception when sqlstate 'MI424' then v_h := 'ok'; end;
  perform prova_bak('başka işletmenin şubesi verilemiyor (MI424)', v_h = 'ok');
end; $$;

-- ── 6 · ŞİFREMİ BELİRLEDİM — YALNIZ KENDİ BAYRAĞI ────────────────────────
do $$
declare v_yeni uuid; r record;
begin
  perform prova_oturum(current_setting('prova.patron')::uuid,
                       current_setting('prova.t')::uuid);
  select * into r from app.personel_hesabi_ac(
    gen_random_uuid(), 'ascibasi', 'Mehmet Usta', 'uretim_sorumlusu');
  v_yeni := r.kullanici_id;

  -- Patron kendi bayrağını düşürse bile YENİ kullanıcınınki durmalı
  perform app.sifremi_belirledim();
  perform prova_bak('⚠️ başkasının zorunlu şifre değişimi DÜŞMÜYOR',
    (select must_change_password from public.app_user where id = v_yeni) = true);

  -- Yeni kullanıcı kendi oturumuyla düşürüyor
  perform prova_oturum(
    (select auth_user_id from public.app_user where id = v_yeni),
    current_setting('prova.t')::uuid);
  perform app.sifremi_belirledim();
  perform prova_bak('kendi bayrağını düşürebiliyor',
    (select must_change_password from public.app_user where id = v_yeni) = false);
end; $$;

-- ── 7 · YÖNETİCİ ŞİFRE SIFIRLAYINCA BAYRAK GERİ KALKIYOR ─────────────────
do $$
declare v_k uuid; v_h text := '';
begin
  select id into v_k from public.app_user
   where tenant_id = current_setting('prova.t')::uuid and username_key = 'ascibasi';

  -- Depocu sıfırlayamaz
  perform prova_oturum(current_setting('prova.depocu')::uuid,
                       current_setting('prova.t')::uuid);
  begin
    perform app.personel_sifresi_sifirlandi(v_k);
    raise exception 'KAPI GEÇİLDİ — depocu şifre sıfırladı';
  exception when sqlstate 'MI403' then v_h := 'ok'; end;
  perform prova_bak('yetkisiz kullanıcı şifre sıfırlayamıyor', v_h = 'ok');

  perform prova_oturum(current_setting('prova.patron')::uuid,
                       current_setting('prova.t')::uuid);
  perform app.personel_sifresi_sifirlandi(v_k);
  perform prova_bak('yönetici sıfırlayınca bayrak geri kalkıyor',
    (select must_change_password from public.app_user where id = v_k) = true);
end; $$;

-- ── 8 · ŞİFRE HİÇBİR YERDE DURMUYOR ──────────────────────────────────────
do $$
declare v_say int;
begin
  select count(*) into v_say from information_schema.columns
   where table_schema = 'public' and table_name = 'app_user'
     and column_name ~* '(password|sifre|parola)'
     and column_name <> 'must_change_password';
  perform prova_bak('⚠️ app_user''da şifre tutan sütun YOK', v_say = 0);
end; $$;

rollback;
