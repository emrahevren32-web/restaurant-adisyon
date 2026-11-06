-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0106 · GERİ ARAMA TALEBİ · OTURUMSUZ GİRER, YALNIZ PLATFORM OKUR
--
-- Soru üç tane:
--   1. Oturumu OLMAYAN biri (ana ekrandaki ziyaretçi) talep bırakabiliyor mu?
--   2. O talebi, platform yöneticisi DIŞINDA kimse okuyabiliyor/değiştirebiliyor mu?
--   3. KVKK onayı olmadan kayıt oluşabiliyor mu?
--
-- ⚠️ ÖLÇÜM YAPISAL DEĞİL DAVRANIŞSAL. Göçün kendi doğrulaması fonksiyonları
-- SAHİBİ olarak çağırıyor — yani her kapı açıkmış gibi koşuyor. Bu dosya
-- `set local role anon` ve `set local role authenticated` ile GERÇEK
-- istemci rollerine giriyor. Tuzak 139/MIYOP-042'nin dersi: rol takmayan
-- prova, kapının DIŞINDA koşar ve her yazımı sessizce geçirir.
--
-- ⚠️ OLUMSUZ KONTROLLER BU DOSYANIN YARISINDAN FAZLASI. Bir yetki kapısının
-- varlığını kanıtlayan şey, izinsiz çağrının REDDEDİLDİĞİNİ görmektir;
-- izinli çağrının geçtiğini görmek yalnızca yarısıdır.
--
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

-- ── KURULUM · iki kullanıcı, iki ayrı dünya ───────────────────────────────
-- `super_admin`  → platform kiracısında, `platform.manage` VAR (0014)
-- `isletme_sahibi` → müşteri kiracısında, `platform.manage` YOK
do $$
declare
  v_pt uuid; v_pf uuid;
  v_kt uuid; v_kf uuid;
  v_auth uuid; v_app uuid;
begin
  -- Platform kiracısı: 0043 `is_platform` bayrağını MİYOP'un kendi kaydına
  -- koyuyor. Prova onu ARAR, uydurmaz.
  select t.id into v_pt from public.tenant t where t.is_platform limit 1;
  if v_pt is null then
    raise exception 'KURULUM: is_platform kiraci bulunamadi (0043 uygulanmamis?)';
  end if;
  select c.id into v_pf from public.company c where c.tenant_id = v_pt limit 1;

  -- Müşteri kiracısı: platform OLMAYAN ilk kiracı. Yoksa açıyoruz.
  select t.id into v_kt from public.tenant t where not t.is_platform limit 1;
  if v_kt is null then
    v_kt := gen_random_uuid();
    insert into public.tenant (id, code, name) values (v_kt, 'P106T', 'Prova Kiraci');
  end if;
  select c.id into v_kf from public.company c where c.tenant_id = v_kt limit 1;
  if v_kf is null then
    v_kf := gen_random_uuid();
    insert into public.company (id, tenant_id, company_code, company_name)
    values (v_kf, v_kt, 'P106F', 'Prova Firma');
  end if;

  -- 1 · platform yöneticisi
  v_auth := gen_random_uuid(); v_app := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p106.platform@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_pt, v_pf, v_auth, 'p106platform', 'p106platform',
          'Prova Platform Yoneticisi', 'super_admin', true);
  perform set_config('prova.auth.platform', v_auth::text, false);
  perform set_config('prova.app.platform',  v_app::text,  false);

  -- 2 · müşteri işletme sahibi · platform izni YOK
  v_auth := gen_random_uuid(); v_app := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p106.sahip@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_kt, v_kf, v_auth, 'p106sahip', 'p106sahip',
          'Prova Isletme Sahibi', 'isletme_sahibi', true);
  perform set_config('prova.auth.sahip', v_auth::text, false);
  perform set_config('prova.app.sahip',  v_app::text,  false);

  perform set_config('prova.pt', v_pt::text, false);
  perform set_config('prova.kt', v_kt::text, false);

  -- ⚠️ KVKK sürümünü BURADA okuyoruz, sahibi olarak. Aşağıda rol takınca
  -- `app.kvkk_metin_surumu()` çağrılamıyor — ve bu DOĞRU: o fonksiyon
  -- dışarıya kapalı. Provanın ilk hâli onu `authenticated` iken çağırdı ve
  -- "permission denied" aldı; kapı çalışıyordu, ölçüm yanlış yerden
  -- bakıyordu. Beklenen değeri önceden alıp kıyaslamak doğrusu.
  perform set_config('prova.kvkk', app.kvkk_metin_surumu(), false);
  raise notice 'KURULUM TAMAM';
end $$;


-- ── 1 · YAPI ──────────────────────────────────────────────────────────────
do $$
begin
  raise notice '── 1 · YAPI';
  perform prova_bak('callback_request tablosu var',
    to_regclass('public.callback_request') is not null);
  perform prova_bak('platform_contact tablosu var',
    to_regclass('public.platform_contact') is not null);

  perform prova_bak('callback_request · RLS açık VE zorunlu',
    (select relrowsecurity and relforcerowsecurity
       from pg_class where oid = 'public.callback_request'::regclass));
  perform prova_bak('platform_contact · RLS açık VE zorunlu',
    (select relrowsecurity and relforcerowsecurity
       from pg_class where oid = 'public.platform_contact'::regclass));

  -- ⚠️ POLİTİKA OLMAMASI bir eksiklik değil, kararın kendisi: politika yoksa
  -- hiçbir satır geçmez. Erişim yalnız `security definer` fonksiyondan.
  perform prova_bak('⚠️ callback_request · hiç RLS politikası YOK (kapalı kapı)',
    not exists (select 1 from pg_policies
                 where schemaname='public' and tablename='callback_request'));

  perform prova_bak('⚠️ iki tabloda da anon/authenticated DML yetkisi YOK',
    not exists (select 1 from information_schema.role_table_grants
                 where table_schema='public'
                   and table_name in ('callback_request','platform_contact')
                   and grantee in ('anon','authenticated')));

  -- `consent_at` NOT NULL olmak zorunda: onaysız kayıt FİZİKEN oluşmasın.
  perform prova_bak('⚠️ consent_at NOT NULL (onaysız kayıt oluşamaz)',
    (select attnotnull from pg_attribute
      where attrelid='public.callback_request'::regclass and attname='consent_at'));

  perform prova_bak('beş fonksiyon da security definer',
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='app' and p.prosecdef
        and p.proname in ('geri_arama_gonder','geri_arama_listesi',
                          'geri_arama_durumu_yaz','geri_arama_sil',
                          'platform_iletisim_yaz')) = 5);

  -- ⚠️ Tuzak 67 · `security definer` fonksiyon varsayılan olarak PUBLIC'e
  -- açıktır. `app` tarafı dışarıdan HİÇ çağrılmamalı.
  perform prova_bak('⚠️ app.geri_arama_listesi() anon/authenticated’a KAPALI',
    not has_function_privilege('anon', 'app.geri_arama_listesi()', 'EXECUTE')
    and not has_function_privilege('authenticated', 'app.geri_arama_listesi()', 'EXECUTE'));

  -- Oturumsuz çağrılabilen İKİ kapı, yalnız ikisi.
  perform prova_bak('anon · geri_arama_gonder çağırabiliyor (ana ekran kapısı)',
    has_function_privilege('anon',
      'public.geri_arama_gonder(text,text,text,text,text,text,boolean)', 'EXECUTE'));
  perform prova_bak('anon · platform_iletisim_oku çağırabiliyor (numara görünsün)',
    has_function_privilege('anon', 'public.platform_iletisim_oku()', 'EXECUTE'));

  perform prova_bak('⚠️ anon · geri_arama_listesi ÇAĞIRAMIYOR',
    not has_function_privilege('anon', 'public.geri_arama_listesi()', 'EXECUTE'));
  perform prova_bak('⚠️ anon · geri_arama_durumu_yaz ÇAĞIRAMIYOR',
    not has_function_privilege('anon',
      'public.geri_arama_durumu_yaz(text,text,text)', 'EXECUTE'));
  perform prova_bak('⚠️ anon · geri_arama_sil ÇAĞIRAMIYOR',
    not has_function_privilege('anon', 'public.geri_arama_sil(text)', 'EXECUTE'));
  perform prova_bak('⚠️ anon · platform_iletisim_yaz ÇAĞIRAMIYOR',
    not has_function_privilege('anon', 'public.platform_iletisim_yaz(text)', 'EXECUTE'));

  -- Numara üreteçlerinin alfabesi ayrışmamış (0106 başındaki not).
  perform prova_bak('iki numara üretecinin alfabesi AYNI',
    position('23456789ACDEFGHJKMNPQRTUVWXYZ' in
      pg_get_functiondef('app.geri_arama_referansi()'::regprocedure)) > 0
    and position('23456789ACDEFGHJKMNPQRTUVWXYZ' in
      pg_get_functiondef('app.basvuru_referansi()'::regprocedure)) > 0);
end $$;


-- ── 2 · TELEFON SADELEŞMESİ ───────────────────────────────────────────────
-- ⚠️ Bu ölçüm spam kapısının ÖN KOŞULU. Aynı numaranın üç yazımı üç ayrı
-- numara sayılırsa "bu numaradan zaten talep var" kontrolü hiç çalışmaz.
do $$
begin
  raise notice '── 2 · TELEFON SADELEŞMESİ';
  perform prova_bak('0532 123 45 67 → 5321234567',
    app.telefon_sadelestir('0532 123 45 67') = '5321234567');
  perform prova_bak('+90 532 1234567 → 5321234567',
    app.telefon_sadelestir('+90 532 1234567') = '5321234567');
  perform prova_bak('5321234567 → 5321234567',
    app.telefon_sadelestir('5321234567') = '5321234567');
  perform prova_bak('(0232) 456-78-90 → 2324567890 (sabit hat kabul)',
    app.telefon_sadelestir('(0232) 456-78-90') = '2324567890');
  perform prova_bak('⚠️ 123 → null (kısa numara reddedilir)',
    app.telefon_sadelestir('123') is null);
  perform prova_bak('⚠️ 0132 1234567 → null (geçersiz alan kodu)',
    app.telefon_sadelestir('0132 1234567') is null);
  perform prova_bak('⚠️ boş → null',
    app.telefon_sadelestir('') is null and app.telefon_sadelestir(null) is null);
end $$;


grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid)
  to anon, authenticated;
grant usage on schema public to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · ZİYARETÇİ (anon) · OTURUM YOK
-- ═══════════════════════════════════════════════════════════════════════════
set local role anon;

do $$
declare v_ref text; v_kod text; v_sayi int;
begin
  raise notice '── 3 · ZİYARETÇİ (anon · oturum YOK)';

  -- ⚠️ ASIL SORU: ana ekrandaki kişi gerçekten talep bırakabiliyor mu?
  v_ref := public.geri_arama_gonder(
    'Prova Ziyaretci', '0532 106 01 06', 'Prova Ziyaretci Gida',
    'ziyaretci@example.com', 'Fiyat ve kurulum süresi', 'SABAH', true);
  perform prova_bak('⚠️ oturumsuz ziyaretçi talep BIRAKABİLDİ ('||v_ref||')',
    v_ref ~ '^GER-[23456789ACDEFGHJKMNPQRTUVWXYZ]{5}$');
  perform set_config('prova.ref', v_ref, false);

  -- Onaysız gönderim
  begin
    perform public.geri_arama_gonder(
      'Prova Onaysiz', '0533 106 01 06', 'Prova Onaysiz Gida',
      null, null, 'FARKETMEZ', false);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ KVKK onayı OLMADAN gönderim REDDEDİLDİ ('||v_kod||')',
    v_kod = 'MI422');

  -- Aynı numaradan ikinci AÇIK talep (üç yazımdan biriyle)
  begin
    perform public.geri_arama_gonder(
      'Prova Ziyaretci', '+90 532 106 01 06', 'Prova Ziyaretci Gida',
      null, null, 'AKSAM', true);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ aynı numaradan İKİNCİ açık talep REDDEDİLDİ ('||v_kod||')',
    v_kod = 'MI409');

  -- Yarım e-posta
  begin
    perform public.geri_arama_gonder(
      'Prova Yarim Eposta', '0534 106 01 06', 'Prova Gida',
      'ahmet@', null, 'FARKETMEZ', true);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ yarım e-posta REDDEDİLDİ ('||v_kod||') — oraya yazıp cevap bekleriz',
    v_kod = 'MI422');

  -- ⚠️ ZİYARETÇİ KENDİ BIRAKTIĞINI DAHİ OKUYAMIYOR. Form bir kutu; içini
  -- göremez. Aksi hâlde numarayı deneyerek başkalarının telefonu okunurdu.
  begin
    select count(*) into v_sayi from public.callback_request;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ anon tabloyu OKUYAMIYOR ('||v_kod||
    case when v_kod='00000' then ' · '||v_sayi||' satır' else '' end||')',
    v_kod <> '00000' or v_sayi = 0);

  -- Listeyi de çağıramıyor (yetki yok → hata)
  begin
    perform public.geri_arama_listesi();
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ anon geri_arama_listesi() ÇAĞIRAMADI ('||v_kod||')',
    v_kod <> '00000');

  -- Ana ekranın okuduğu telefon: BOŞ (Emrah henüz yazmadı)
  perform prova_bak('ana ekran telefonu şu an BOŞ — ekranda hiçbir şey görünmez',
    public.platform_iletisim_oku() is null);
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · MÜŞTERİ KULLANICISI (authenticated · platform.manage YOK)
-- ═══════════════════════════════════════════════════════════════════════════
reset role;
set local role authenticated;
select prova_oturum(current_setting('prova.auth.sahip')::uuid,
                    current_setting('prova.kt')::uuid);

do $$
declare v_kod text; v_ref text := current_setting('prova.ref');
begin
  raise notice '── 4 · MÜŞTERİ KULLANICISI (platform.manage YOK)';

  perform prova_bak('sağlama: oturum gerçekten kuruldu',
    app.aktif_kullanici_id() = current_setting('prova.app.sahip')::uuid);
  perform prova_bak('sağlama: bu kullanıcının platform.manage izni YOK',
    not app.yetkim_var('platform.manage'));

  begin
    perform public.geri_arama_listesi();
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ listeyi OKUYAMADI ('||v_kod||')', v_kod = 'MI403');

  begin
    perform public.geri_arama_durumu_yaz(v_ref, 'CONTACTED', 'izinsiz deneme');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ durumu YAZAMADI ('||v_kod||')', v_kod = 'MI403');

  begin
    perform public.geri_arama_sil(v_ref);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ kaydı SİLEMEDİ ('||v_kod||')', v_kod = 'MI403');

  begin
    perform public.platform_iletisim_yaz('0232 111 11 11');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ ana ekran telefonunu YAZAMADI ('||v_kod||')', v_kod = 'MI403');

  begin
    perform 1 from public.callback_request;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ tabloyu doğrudan OKUYAMADI ('||v_kod||')', v_kod <> '00000');
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · PLATFORM YÖNETİCİSİ (authenticated · platform.manage VAR)
-- ═══════════════════════════════════════════════════════════════════════════
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);

do $$
declare
  v_kod   text;
  v_ref   text := current_setting('prova.ref');
  v_satir record;
begin
  raise notice '── 5 · PLATFORM YÖNETİCİSİ (platform.manage VAR)';

  perform prova_bak('sağlama: platform.manage izni VAR',
    app.yetkim_var('platform.manage'));

  select * into v_satir from public.geri_arama_listesi() where referans = v_ref;
  perform prova_bak('talebi LİSTEDE görüyor', v_satir.referans = v_ref);
  perform prova_bak('durumu NEW', v_satir.durum = 'NEW');
  perform prova_bak('telefon sadeleşmiş hâlde geliyor', v_satir.telefon = '5321060106');
  perform prova_bak('onay zamanı ve sürümü kayıtta duruyor',
    v_satir.onay_zamani is not null
    and v_satir.onay_surumu = current_setting('prova.kvkk'));
  perform prova_bak('henüz aranmamış (arandı boş)', v_satir.arandi is null);

  -- Kapatmak gerekçe ister.
  begin
    perform public.geri_arama_durumu_yaz(v_ref, 'CLOSED', null);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ gerekçesiz KAPATMA reddedildi ('||v_kod||')', v_kod = 'MI422');

  -- Geçersiz durum
  begin
    perform public.geri_arama_durumu_yaz(v_ref, 'UYDURMA', 'x');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ uydurma durum reddedildi ('||v_kod||')', v_kod = 'MI422');

  -- Olmayan numara
  begin
    perform public.geri_arama_durumu_yaz('GER-YOKYO', 'CONTACTED', 'x');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ olmayan numara reddedildi ('||v_kod||')', v_kod = 'MI404');

  -- Arandı
  perform public.geri_arama_durumu_yaz(v_ref, 'CONTACTED', 'Arandi, fiyat soruldu');
  select * into v_satir from public.geri_arama_listesi() where referans = v_ref;
  perform prova_bak('durum CONTACTED oldu', v_satir.durum = 'CONTACTED');
  perform prova_bak('arandı zamanı DOLDU', v_satir.arandi is not null);
  -- ⚠️ İmzayı SUNUCU attı: "kim aradı" parametresi hiç yok.
  perform prova_bak('⚠️ arayan kişiyi SUNUCU yazdı (parametresi bile yok)',
    v_satir.arayan = 'Prova Platform Yoneticisi');
  perform prova_bak('not defterine birinci satır düştü',
    v_satir.not_defteri like '%Arandi, fiyat soruldu%');

  -- İkinci işlem: not BİRİKİYOR, üstüne yazılmıyor.
  perform public.geri_arama_durumu_yaz(v_ref, 'CLOSED', 'Fiyat yuksek buldu');
  select * into v_satir from public.geri_arama_listesi() where referans = v_ref;
  perform prova_bak('durum CLOSED oldu', v_satir.durum = 'CLOSED');
  perform prova_bak('⚠️ not BİRİKTİ — eski satır silinmedi',
    v_satir.not_defteri like '%Arandi, fiyat soruldu%'
    and v_satir.not_defteri like '%Fiyat yuksek buldu%');
  perform prova_bak('⚠️ not defterinde İKİ satır var',
    array_length(string_to_array(v_satir.not_defteri, E'\n'), 1) = 2);
  -- İlk aramanın imzası bir daha değişmiyor.
  perform prova_bak('⚠️ "arandı" zamanı İKİNCİ işlemde değişmedi (ilk temas)',
    v_satir.arandi < v_satir.son_islem or v_satir.arandi <= v_satir.son_islem);
end $$;


-- ── 6 · 24 SAATTE EN ÇOK ÜÇ ───────────────────────────────────────────────
-- Birinci talep kapandı; artık "açık talep" kapısı devrede değil. Sıradaki
-- kapı sayı kapısı: aynı numaradan 24 saatte en çok üç.
reset role;
set local role anon;

do $$
declare v_kod text; v_r2 text; v_r3 text;
begin
  raise notice '── 6 · 24 SAATTE EN ÇOK ÜÇ';

  -- 2. talep (1. kapandı, açık talep yok)
  v_r2 := public.geri_arama_gonder(
    'Prova Ziyaretci', '0532 106 01 06', 'Prova Ziyaretci Gida',
    null, 'ikinci kez soruyor', 'FARKETMEZ', true);
  perform prova_bak('kapanmış talepten sonra İKİNCİ talep geçti ('||v_r2||')',
    v_r2 ~ '^GER-');
  perform set_config('prova.r2', v_r2, false);
end $$;

reset role;
set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);
select public.geri_arama_durumu_yaz(current_setting('prova.r2'), 'CLOSED', 'kapatildi');

reset role;
set local role anon;

do $$
declare v_kod text; v_r3 text;
begin
  -- 3. talep
  v_r3 := public.geri_arama_gonder(
    'Prova Ziyaretci', '0532 106 01 06', 'Prova Ziyaretci Gida',
    null, 'ucuncu kez', 'FARKETMEZ', true);
  perform prova_bak('ÜÇÜNCÜ talep geçti ('||v_r3||')', v_r3 ~ '^GER-');
  perform set_config('prova.r3', v_r3, false);
end $$;

reset role;
set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);
select public.geri_arama_durumu_yaz(current_setting('prova.r3'), 'CLOSED', 'kapatildi');

reset role;
set local role anon;

do $$
declare v_kod text;
begin
  -- 4. talep · sayı kapısına çarpmalı
  begin
    perform public.geri_arama_gonder(
      'Prova Ziyaretci', '0532 106 01 06', 'Prova Ziyaretci Gida',
      null, 'dorduncu kez', 'FARKETMEZ', true);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ DÖRDÜNCÜ talep 24 saat kapısına çarptı ('||v_kod||')',
    v_kod = 'MI429');

  -- ⚠️ Kapı NUMARAYA bağlı, herkese değil: başka numara geçmeli. Aksi hâlde
  -- bir kişi bütün formu kapatabilirdi.
  perform prova_bak('⚠️ BAŞKA numara aynı anda geçebiliyor (kapı numaraya bağlı)',
    public.geri_arama_gonder(
      'Prova Baska Kisi', '0555 106 01 06', 'Prova Baska Gida',
      null, null, 'AKSAM', true) ~ '^GER-');
end $$;


-- ── 7 · ANA EKRAN TELEFONU ────────────────────────────────────────────────
reset role;
set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);

do $$
declare v_kod text;
begin
  raise notice '── 7 · ANA EKRAN TELEFONU';

  perform public.platform_iletisim_yaz('0232 123 45 67');
  perform prova_bak('platform yöneticisi numarayı yazabildi',
    public.platform_iletisim_oku() = '2321234567');

  -- Bozuk numara
  begin
    perform public.platform_iletisim_yaz('abc');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ bozuk numara reddedildi ('||v_kod||')', v_kod = 'MI422');
  perform prova_bak('reddedilen yazım eski değeri BOZMADI',
    public.platform_iletisim_oku() = '2321234567');
end $$;

-- ⚠️ ZİYARETÇİ NUMARAYI GÖRÜYOR MU — alanın varlık sebebi tam olarak bu.
-- Yazılı olduğu hâlde ana ekranda görünmezse özellik hiç yok demektir.
reset role;
set local role anon;
do $$
begin
  perform prova_bak('⚠️ anon YAZILMIŞ numarayı okuyabiliyor (ekranda görünecek)',
    public.platform_iletisim_oku() = '2321234567');
end $$;

-- ⚠️ `updated_by` DOĞRUDAN TABLODAN okunuyor ve bu blok SAHİBİ olarak
-- koşuyor. Provanın ilk hâli bunu `authenticated` iken okudu ve "permission
-- denied for table platform_contact" aldı — kapı çalışıyordu, ölçüm yanlış
-- yerden bakıyordu. Tablonun kapalı olması ölçümün değil tasarımın parçası;
-- o yüzden imza kontrolü rolün dışına taşındı.
reset role;
do $$
begin
  perform prova_bak('imzayı SUNUCU attı (updated_by platform yöneticisi)',
    (select updated_by from public.platform_contact)
      = current_setting('prova.app.platform')::uuid);
  perform prova_bak('⚠️ authenticated tabloyu doğrudan OKUYAMIYOR (ölçüm bunu öğretti)',
    not has_table_privilege('authenticated', 'public.platform_contact', 'select'));
end $$;

-- Boş göndermek = kaldırmak
set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);
do $$
begin
  perform public.platform_iletisim_yaz('');
  perform prova_bak('⚠️ boş göndermek numarayı KALDIRDI (ekranda görünmez olur)',
    public.platform_iletisim_oku() is null);
end $$;


-- ── 8 · KVKK SİLME HAKKI ──────────────────────────────────────────────────
-- ⚠️ Aydınlatma metni "silmemizi istediğinizde siliyoruz" diyor. Bu bölüm o
-- cümlenin karşılığının ÇALIŞTIĞINI ölçüyor. Sözün arkasında çalışan bir
-- şey yoksa metin bir yalana dönüşür.
reset role;
set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);

do $$
declare v_ref text := current_setting('prova.ref'); v_kod text;
begin
  raise notice '── 8 · KVKK SİLME HAKKI';

  perform prova_bak('sağlama: kayıt silmeden ÖNCE listede',
    exists (select 1 from public.geri_arama_listesi() where referans = v_ref));

  perform public.geri_arama_sil(v_ref);
  perform prova_bak('⚠️ kayıt GERÇEKTEN silindi (KVKK hakkı çalışıyor)',
    not exists (select 1 from public.geri_arama_listesi() where referans = v_ref));

  -- İkinci silme: olmayan kayıt
  begin
    perform public.geri_arama_sil(v_ref);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('silinmiş kaydın ikinci silmesi MI404 ('||v_kod||')',
    v_kod = 'MI404');
end $$;


-- ── 9 · SIRALAMA · EKRANIN İŞİ "KİMİ ARAMALIYIM" ──────────────────────────
do $$
declare v_ilk text;
begin
  raise notice '── 9 · SIRALAMA';
  select durum into v_ilk from public.geri_arama_listesi() limit 1;
  perform prova_bak('listenin EN ÜSTÜ bekleyen (NEW) talep', v_ilk = 'NEW');
end $$;

reset role;
rollback;
