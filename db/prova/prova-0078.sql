-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0078 · ad.soyad@FIRMAKODU ile giriş + kullanıcı adı değiştirme
-- ⚠️ Bu dosya göç DEĞİL. `db/migrations` altına ASLA konmaz.
-- ═══════════════════════════════════════════════════════════════════════════
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

-- ── KURULUM: ÜÇ işletme, aynı görev adı hepsinde ─────────────────────────
do $$
declare
  v_abc uuid := gen_random_uuid(); v_ers uuid := gen_random_uuid();
  v_bat uuid := gen_random_uuid();
  a_patron uuid := gen_random_uuid(); a_depo uuid := gen_random_uuid();
  e_depo uuid := gen_random_uuid(); b_depo uuid := gen_random_uuid();
  a_sef uuid := gen_random_uuid();
begin
  insert into public.tenant (id, code, name) values
    (v_abc, 'ABCGIDA', 'ABC Endüstriyel Mutfak A.Ş.'),
    (v_ers, 'ERSIN',   'Ersin Gıda'),
    (v_bat, 'ABC',     'ABC Kısa Kodlu A.Ş.');  -- ⚠️ 'abc.com' ile karışma tuzağı

  insert into auth.users (id, email) values
    (a_patron, 'ABC.Bey@Gercek-Eposta.COM'),
    (a_depo,   'depocu@abcgida.miyop.local'),
    (e_depo,   'depocu@ersin.miyop.local'),
    (b_depo,   'depocu@abc.miyop.local'),
    (a_sef,    'sukru.ozcigdem@abcgida.miyop.local');

  insert into public.app_user (id, tenant_id, auth_user_id, username, username_key,
                               full_name, role_code, is_active) values
    (gen_random_uuid(), v_abc, a_patron, 'abcbey', 'abcbey',
     'ABC Bey', 'isletme_sahibi', true),
    -- ⚠️ ÜÇ FİRMADA DA "depocu". 0077'nin çuvalladığı tam bu durum.
    (gen_random_uuid(), v_abc, a_depo, 'depocu', 'depocu',
     'Alaattin Kocatepe', 'depo_sorumlusu', true),
    (gen_random_uuid(), v_ers, e_depo, 'depocu', 'depocu',
     'Ersin Depocusu', 'depo_sorumlusu', true),
    (gen_random_uuid(), v_bat, b_depo, 'depocu', 'depocu',
     'ABC Kısa Depocusu', 'depo_sorumlusu', true),
    (gen_random_uuid(), v_abc, a_sef, 'sukru.ozcigdem', 'sukru.ozcigdem',
     'Şükrü Özçiğdem', 'sef', true);

  perform set_config('prova.abc', v_abc::text, false);
  perform set_config('prova.ers', v_ers::text, false);
  perform set_config('prova.patron', a_patron::text, false);
  perform set_config('prova.depoauth', a_depo::text, false);
end; $$;

-- ── 1 · ÜÇ FİRMADA AYNI AD — FİRMA KODUYLA AYRILIYOR ─────────────────────
do $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);
  perform prova_bak('oturum YOKken çalışıyor (giriş ekranı oturumsuz)', auth.uid() is null);

  perform prova_bak('⚠️ depocu@ABCGIDA → ABC''nin depocusu',
    app.giris_adresi_bul('depocu@ABCGIDA') = 'depocu@abcgida.miyop.local');
  perform prova_bak('⚠️ depocu@ERSIN → Ersin''in depocusu',
    app.giris_adresi_bul('depocu@ERSIN') = 'depocu@ersin.miyop.local');
  perform prova_bak('küçük/büyük harf farkı önemsiz',
    app.giris_adresi_bul('Depocu@abcgida') = 'depocu@abcgida.miyop.local');
  perform prova_bak('ad.soyad@FIRMAKODU çözülüyor',
    app.giris_adresi_bul('sukru.ozcigdem@ABCGIDA') = 'sukru.ozcigdem@abcgida.miyop.local');
  perform prova_bak('⚠️ yazılışı bozuk ad bile doğru kişiye gidiyor (Şükrü Özçiğdem)',
    app.giris_adresi_bul('Şükrü Özçiğdem@ABCGIDA') = 'sukru.ozcigdem@abcgida.miyop.local');
end; $$;

-- ── 2 · FİRMA KODU YOKSA: ÜÇ EŞLEŞME VAR, ADRES YOK ──────────────────────
do $$
begin
  -- 0077'nin davranışı korunuyor: tahmin etmektense "bulunamadı" demek.
  perform prova_bak('⚠️ yalın "depocu" üç firmada var → adres sızmıyor',
    app.giris_adresi_bul('depocu') like '%@bulunamadi.miyop.local');
  perform prova_bak('yalın ad TEK firmada varsa hâlâ çalışıyor (eski hesaplar bozulmadı)',
    app.giris_adresi_bul('abcbey') = 'abc.bey@gercek-eposta.com');
end; $$;

-- ── 3 · E-POSTA İLE FİRMA KODU KARIŞMIYOR ────────────────────────────────
do $$
begin
  -- ⚠️ 'ABC' diye bir işletme kodu VAR. Buna rağmen 'biri@abc.com' bir
  -- e-postadır; alan adının TAMAMI ('abccom') karşılaştırıldığı için
  -- işletme sanılmıyor.
  perform prova_bak('⚠️ biri@abc.com e-posta sayılıyor, ABC işletmesi değil',
    app.giris_adresi_bul('biri@abc.com') = 'biri@abc.com');
  perform prova_bak('depocu@ABC gerçekten ABC işletmesine gidiyor',
    app.giris_adresi_bul('depocu@ABC') = 'depocu@abc.miyop.local');
  perform prova_bak('işletme sahibinin gerçek e-postası olduğu gibi geçiyor',
    app.giris_adresi_bul('ABC.Bey@Gercek-Eposta.COM') = 'abc.bey@gercek-eposta.com');
  perform prova_bak('⚠️ dahili adres olduğu gibi geçiyor (işletme kodu sanılmıyor)',
    app.giris_adresi_bul('depocu@abcgida.miyop.local') = 'depocu@abcgida.miyop.local');
end; $$;

-- ── 4 · KULLANICI ADI SAYILAMIYOR ────────────────────────────────────────
do $$
begin
  perform prova_bak('var olan firmada OLMAYAN ad → sahte adres',
    app.giris_adresi_bul('yokboyle.biri@ABCGIDA') like '%@bulunamadi.miyop.local');
  perform prova_bak('OLMAYAN firma kodu → e-posta sayılıp Auth''a bırakılıyor',
    app.giris_adresi_bul('depocu@YOKBOYLEFIRMA') = 'depocu@yokboylefirma');
  perform prova_bak('⚠️ bulunamayan ad ile üç firmada bulunan ad AYNI biçimde dönüyor',
    split_part(app.giris_adresi_bul('yokboyle.biri@ABCGIDA'), '@', 2)
      = split_part(app.giris_adresi_bul('depocu'), '@', 2));
end; $$;

-- ── 5 · KULLANICI ADI NORMALLEŞTİRME ─────────────────────────────────────
do $$
begin
  perform prova_bak('"Alaattin Kocatepe" → alaattin.kocatepe',
    app.kullanici_adi_duzelt('Alaattin Kocatepe') = 'alaattin.kocatepe');
  perform prova_bak('üç boşluk tek nokta oluyor',
    app.kullanici_adi_duzelt('Ali   Veli') = 'ali.veli');
  perform prova_bak('baştaki/sondaki nokta atılıyor',
    app.kullanici_adi_duzelt('  .Ali Veli.  ') = 'ali.veli');
  perform prova_bak('alt çizgi de noktaya dönüyor',
    app.kullanici_adi_duzelt('ali_veli') = 'ali.veli');
  perform prova_bak('⚠️ ESKİ kayıtlar bozulmuyor (depocu → depocu)',
    app.kullanici_adi_duzelt('depocu') = 'depocu');
  perform prova_bak('üç isimli kişi de düzgün',
    app.kullanici_adi_duzelt('Mehmet Ali Yılmaz') = 'mehmet.ali.yilmaz');
end; $$;

-- ── 6 · GİRİŞ ADI EKRANDA: TEK KAYNAK, KİRACI DUVARI VAR ─────────────────
do $$
declare v_depo uuid; v_ersdepo uuid;
begin
  perform prova_oturum(current_setting('prova.patron')::uuid,
                       current_setting('prova.abc')::uuid);
  select id into v_depo from public.app_user
   where tenant_id = current_setting('prova.abc')::uuid and username_key = 'depocu';
  select id into v_ersdepo from public.app_user
   where tenant_id = current_setting('prova.ers')::uuid and username_key = 'depocu';

  perform prova_bak('giriş adı kısa ve okunur biçimde dönüyor',
    app.giris_adi(v_depo) = 'depocu@ABCGIDA');
  perform prova_bak('⚠️ BAŞKA işletmenin kullanıcısının giriş adı GÖRÜNMÜYOR',
    app.giris_adi(v_ersdepo) is null);
  perform prova_bak('liste yalnız kendi işletmesini veriyor',
    (select count(*) from app.giris_adlari()) = 3);
  perform prova_bak('listedeki ad tekil çağrıyla aynı (iki yerde üretilmiyor)',
    (select giris_adi from app.giris_adlari() where kullanici_id = v_depo)
      = app.giris_adi(v_depo));
end; $$;

-- ── 7 · KULLANICI ADI DEĞİŞTİRME ─────────────────────────────────────────
do $$
declare v_depo uuid; v_patron uuid; v_yeni text; v_h text := '';
begin
  select id into v_depo from public.app_user
   where tenant_id = current_setting('prova.abc')::uuid and username_key = 'depocu';
  select id into v_patron from public.app_user
   where tenant_id = current_setting('prova.abc')::uuid and username_key = 'abcbey';

  -- Yetkisiz kişi değiştiremez.
  perform prova_oturum(current_setting('prova.depoauth')::uuid,
                       current_setting('prova.abc')::uuid);
  begin
    perform app.personel_kullanici_adi_degistir(v_depo, 'baska.ad');
    raise exception 'KAPI GEÇİLDİ — depocu kendi adını değiştirdi';
  exception when sqlstate 'MI403' then v_h := 'ok'; end;
  perform prova_bak('yetkisiz kullanıcı kullanıcı adı değiştiremiyor', v_h = 'ok');

  perform prova_oturum(current_setting('prova.patron')::uuid,
                       current_setting('prova.abc')::uuid);

  -- Çakışma
  v_h := '';
  begin
    perform app.personel_kullanici_adi_degistir(v_depo, 'Şükrü Özçiğdem');
    raise exception 'KAPI GEÇİLDİ — çakışan ad kabul edildi';
  exception when sqlstate 'MI409' then v_h := 'ok'; end;
  perform prova_bak('işletmede kullanılan ad ikinci kez verilemiyor', v_h = 'ok');

  -- Çok kısa
  v_h := '';
  begin
    perform app.personel_kullanici_adi_degistir(v_depo, 'ab');
    raise exception 'KAPI GEÇİLDİ — iki harfli ad kabul edildi';
  exception when sqlstate 'MI400' then v_h := 'ok'; end;
  perform prova_bak('üç karakterden kısa ad reddediliyor', v_h = 'ok');

  -- Başka kiracının kullanıcısı
  v_h := '';
  begin
    perform app.personel_kullanici_adi_degistir(
      (select id from public.app_user
        where tenant_id = current_setting('prova.ers')::uuid limit 1), 'yeni.ad');
    raise exception 'KAPI GEÇİLDİ — başka işletmenin kullanıcısı değiştirildi';
  exception when sqlstate 'MI424' then v_h := 'ok'; end;
  perform prova_bak('⚠️ başka işletmenin kullanıcısına dokunulamıyor', v_h = 'ok');

  -- Mutlu yol
  v_yeni := app.personel_kullanici_adi_degistir(v_depo, 'Alaattin Kocatepe');
  perform prova_bak('görev adı kişi adına çevrildi',
    v_yeni = 'alaattin.kocatepe@ABCGIDA');
  perform prova_bak('kayıt gerçekten değişti',
    (select username_key from public.app_user where id = v_depo) = 'alaattin.kocatepe');
end; $$;

-- ── 8 · ⚠️ ADI DEĞİŞEN KİŞİ HÂLÂ GİREBİLİYOR ─────────────────────────────
do $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '', false);

  -- Bu, 0077'de adresi `auth.users`tan OKUMA kararının karşılığı: kullanıcı
  -- adı değişti, Auth'taki adrese HİÇ DOKUNULMADI, giriş yine çalışıyor.
  -- Adres kuraldan üretilseydi bu kişi şu anda kapıda kalmış olurdu.
  perform prova_bak('⚠️ YENİ adıyla giriyor',
    app.giris_adresi_bul('alaattin.kocatepe@ABCGIDA') = 'depocu@abcgida.miyop.local');
  perform prova_bak('ESKİ adı artık ABC''de çalışmıyor',
    app.giris_adresi_bul('depocu@ABCGIDA') like '%@bulunamadi.miyop.local');
  perform prova_bak('diğer firmaların depocusu etkilenmedi',
    app.giris_adresi_bul('depocu@ERSIN') = 'depocu@ersin.miyop.local');
end; $$;

-- ── 9 · KAPILAR ──────────────────────────────────────────────────────────
do $$
begin
  -- !! BU SATIR BİR ZAMANLAR OLUMLU BİR KONTROLDÜ ve o gün doğruydu:
  -- 0078 `giris_adresi_bul`u anon'a AÇMIŞTI, çünkü giriş ekranı oturumsuzken
  -- adres çevirmek zorundaydı. 0102 onu KAPATTI (Codex denetimi: cevabın
  -- biçimi "bu kullanıcı var mı" sorusunu parola bilmeden cevaplıyordu);
  -- çeviriyi artık `giris-yap` Edge Function'ı service_role ile yapıyor.
  -- Kontrol silinmedi, TERSİNE çevrildi: kapanan bir kapının tekrar
  -- açılması da ölçülmeli. (Aynı aile prova-0093'te de düzeltildi.)
  perform prova_bak('⚠️ anon giriş adını ÇEVİREMİYOR (0102 kapattı)',
    not has_function_privilege('anon', 'public.giris_adresi_bul(text, text)', 'execute'));
  perform prova_bak('⚠️ oturum açmış kullanıcı da çeviremiyor (0102 kapsam düzeltmesi)',
    not has_function_privilege('authenticated', 'public.giris_adresi_bul(text, text)', 'execute'));
  perform prova_bak('çeviri service_role''de DURUYOR — giriş kırılmadı',
    has_function_privilege('service_role', 'public.giris_adresi_bul(text, text)', 'execute'));
  perform prova_bak('⚠️ anon kullanıcı listesine ULAŞAMIYOR',
    not has_function_privilege('anon', 'public.giris_adlari()', 'execute'));
  perform prova_bak('⚠️ anon kullanıcı adı DEĞİŞTİREMİYOR',
    not has_function_privilege('anon', 'public.personel_kullanici_adi_degistir(uuid, text)', 'execute'));
  perform prova_bak('app şemasındaki asıl fonksiyonlar herkese açık değil',
    not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(p.proacl) a
      where n.nspname = 'app'
        and p.proname in ('giris_adresi_bul', 'giris_adi', 'giris_adlari',
                          'personel_kullanici_adi_degistir')
        and a.grantee = 0 and a.privilege_type = 'EXECUTE'));
end; $$;

rollback;
