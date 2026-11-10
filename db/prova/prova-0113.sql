\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0113 · MEVZUAT AKIŞI · ÜÇ KAPI
--
-- Sorular:
--   1 · Tablo kapalı mı (RLS açık+zorunlu, politika yok, DML yetkisi yok)?
--   2 · Oturumsuz ziyaretçi akışı OKUYABİLİYOR mu?        → EVET (vitrin)
--   3 · TASLAK ve ARSIV satırlar vitrine SIZIYOR mu?      → HAYIR
--   4 · Ziyaretçi yönetim kapılarını çağırabiliyor mu?    → HAYIR
--   5 · Ziyaretçi tabloyu doğrudan okuyabiliyor mu?       → HAYIR
--   6 · platform.manage'i OLMAYAN kullanıcı yazabiliyor mu? → HAYIR (MI403)
--   7 · Platform yöneticisi yazabiliyor/listeleyebiliyor mu? → EVET
--   8 · `javascript:` ve `http://` adres reddediliyor mu?  → EVET (MI422)
--   9 · Gelecek tarihli yayım reddediliyor mu?             → EVET
--  10 · Tavan işliyor mu (1000 istensin, en çok 20 gelsin)? → EVET
--  11 · Vitrin `status`/imza alanlarını DIŞARI veriyor mu? → HAYIR
--
-- ⚠️ 10.11.2026 · ÇAĞRILARA `'HABER'` TÜRÜ EKLENDİ (göç 0114). Tür
-- zorunlu oldu ve bu prova akışı ölçtüğü için hepsi HABER. Kütüphane
-- türlerini (KANUN/YONETMELIK/TEBLIG) `prova-0114.sql` ölçüyor.
-- ⚠️ ESKİ ÇAĞRI SESSİZCE BOZULMADI, PATLADI — ve bu şans eseri:
-- `p_tur` yeni parametre, varsayılanı olan `p_durum`dan ÖNCE kondu;
-- yedi argümanlı eski çağrının son argümanı (`'YAYINDA'`) `p_tur`a
-- düştü ve "Tür seçilmedi" hatası verdi. Uyumlu bir değer olsaydı
-- çağrı sessizce YANLIŞ ÇALIŞIRDI.
--
-- ⚠️ `set local role anon` ve `authenticated` TAKILIYOR (MIYOP-042).
-- Rol takmayan prova süper kullanıcı olarak koşar ve her şey geçer.
--
-- ⚠️ BU EKRANIN GEÇMİŞİ: aynı köşede MIYOP-059'un uydurma duyuruları
-- vardı. Bu provanın 3. sorusu tam o yüzden var: vitrine yalnız YAYINDA
-- olan, kaynaklı, elle yazılmış satır çıkabilir.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
declare v_ad text := coalesce(p_ad, '(iddia metni NULL uretti)');
begin
  if p_kosul then raise notice '  ✓ %', v_ad;
  else raise exception '  ✗ %', v_ad; end if;
end; $$;

create or replace function prova_oturum(p_auth uuid, p_tenant uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', p_tenant)::text, false);
  perform set_config('app.tenant_id', p_tenant::text, false);
end; $$;

-- ── SAHNE ─────────────────────────────────────────────────────────────────
do $$
declare
  v_pt uuid; v_pf uuid; v_kt uuid; v_kf uuid; v_auth uuid; v_app uuid;
begin
  -- Platform kiracısı ARANIYOR, uydurulmuyor (0043'ün `is_platform` bayrağı).
  select t.id into v_pt from public.tenant t where t.is_platform limit 1;
  if v_pt is null then
    raise exception 'KURULUM: is_platform kiraci bulunamadi (0043 uygulanmamis?)';
  end if;
  select c.id into v_pf from public.company c where c.tenant_id = v_pt limit 1;

  select t.id into v_kt from public.tenant t where not t.is_platform limit 1;
  if v_kt is null then
    v_kt := gen_random_uuid();
    insert into public.tenant (id, code, name) values (v_kt, 'P113T', 'Prova Kiraci');
  end if;
  select c.id into v_kf from public.company c where c.tenant_id = v_kt limit 1;
  if v_kf is null then
    v_kf := gen_random_uuid();
    insert into public.company (id, tenant_id, company_code, company_name)
    values (v_kf, v_kt, 'P113F', 'Prova Firma');
  end if;

  -- 1 · platform yöneticisi (`super_admin` → `platform.manage` VAR, 0014)
  v_auth := gen_random_uuid(); v_app := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p113.platform@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_pt, v_pf, v_auth, 'p113platform', 'p113platform',
          'Prova 113 Platform', 'super_admin', true);
  perform set_config('prova.auth.platform', v_auth::text, false);
  perform set_config('prova.app.platform',  v_app::text,  false);

  -- 2 · müşteri işletme sahibi · platform izni YOK
  v_auth := gen_random_uuid(); v_app := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p113.sahip@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_kt, v_kf, v_auth, 'p113sahip', 'p113sahip',
          'Prova 113 Sahip', 'isletme_sahibi', true);
  perform set_config('prova.auth.sahip', v_auth::text, false);
  perform set_config('prova.app.sahip',  v_app::text,  false);

  perform set_config('prova.pt', v_pt::text, false);
  perform set_config('prova.kt', v_kt::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · TABLO KAPALI MI (rol takmadan, katalog okuması)
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare v_say int;
begin
  raise notice '── 1 · TABLO KAPALI MI';

  perform prova_bak('regulation_news tablosu var',
    to_regclass('public.regulation_news') is not null);

  perform prova_bak('⚠️ RLS açık VE zorunlu',
    (select relrowsecurity and relforcerowsecurity
       from pg_class where oid = 'public.regulation_news'::regclass));

  select count(*) into v_say from pg_policies
   where schemaname = 'public' and tablename = 'regulation_news';
  perform prova_bak('⚠️ hiç RLS politikası YOK (kapalı kapı) — bulunan: '||v_say,
    v_say = 0);

  select count(*) into v_say from information_schema.role_table_grants
   where table_schema = 'public' and table_name = 'regulation_news'
     and grantee in ('anon','authenticated');
  perform prova_bak('⚠️ anon/authenticated DML yetkisi YOK — bulunan: '||v_say,
    v_say = 0);

  perform prova_bak('kaynak adresi kısıtı https ister',
    (select pg_get_constraintdef(oid) from pg_constraint
      where conname = 'regulation_news_kaynak_adresi') ~ 'https');
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · PLATFORM YÖNETİCİSİ · yazıyor
-- ═══════════════════════════════════════════════════════════════════════════
grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid)
  to anon, authenticated;
grant usage on schema public to anon, authenticated;

set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);

do $$
declare v_id uuid; v_kod text; v_i int;
begin
  raise notice '── 2 · PLATFORM YÖNETİCİSİ';

  perform prova_bak('sağlama: platform.manage izni VAR',
    app.yetkim_var('platform.manage'));

  v_id := public.mevzuat_yaz(null,
    'Gıda Hijyeni Yönetmeliğinde değişiklik',
    'Yüzey temizliği kayıtlarının saklama süresi güncellendi.',
    'Resmî Gazete', 'https://www.resmigazete.gov.tr/ornek',
    current_date - 2, 'HABER', 'YAYINDA');
  perform prova_bak('platform yöneticisi YAYINDA satır yazabildi', v_id is not null);
  perform set_config('prova.yayinda', v_id::text, false);

  v_id := public.mevzuat_yaz(null, 'Henuz yayinlanmamis taslak baslik',
    null, 'Tarim ve Orman Bakanligi', 'https://www.tarimorman.gov.tr/ornek',
    current_date - 1, 'HABER', 'TASLAK');
  perform prova_bak('TASLAK satır yazabildi', v_id is not null);

  v_id := public.mevzuat_yaz(null, 'Arsivlenmis eski bir duyuru',
    null, 'Resmî Gazete', 'https://www.resmigazete.gov.tr/eski',
    current_date - 400, 'HABER', 'ARSIV');
  perform prova_bak('ARSIV satır yazabildi', v_id is not null);

  -- ⚠️ `javascript:` — bu adres vitrinde TIKLANABİLİR çizilecek.
  begin
    perform public.mevzuat_yaz(null, 'Zararli baglanti denemesi', null,
      'Kaynak', 'javascript:alert(1)', current_date, 'HABER', 'YAYINDA');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ `javascript:` adres REDDEDİLDİ ('||v_kod||')', v_kod = 'MI422');

  begin
    perform public.mevzuat_yaz(null, 'Sifresiz baglanti denemesi', null,
      'Kaynak', 'http://ornek.gov.tr/x', current_date, 'HABER', 'YAYINDA');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ `http://` adres REDDEDİLDİ ('||v_kod||')', v_kod = 'MI422');

  begin
    perform public.mevzuat_yaz(null, 'Gelecekten gelen haber', null,
      'Kaynak', 'https://ornek.gov.tr/x', current_date + 30, 'HABER', 'YAYINDA');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ GELECEK tarihli yayım REDDEDİLDİ ('||v_kod||')', v_kod = 'MI422');

  begin
    perform public.mevzuat_yaz(null, 'Kisa', null,
      'Kaynak', 'https://ornek.gov.tr/x', current_date, 'HABER', 'YAYINDA');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ beş karakterden kısa başlık REDDEDİLDİ ('||v_kod||')',
    v_kod = 'MI422');

  begin
    perform public.mevzuat_yaz(null, 'Kaynaksiz bir haber basligi', null,
      '', 'https://ornek.gov.tr/x', current_date, 'HABER', 'YAYINDA');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ KAYNAK ADI boş geçilemedi ('||v_kod||')', v_kod = 'MI422');

  perform prova_bak('yönetim listesi okunabiliyor',
    (select count(*) from public.mevzuat_listesi()) >= 3);

  -- Tavan ölçümü için 25 satır daha (hepsi YAYINDA).
  -- ⚠️ 0114 tavanı 20'den 30'a çıkardı; tavanı ÖLÇEBİLMEK için
  -- yayındaki satır sayısı tavandan FAZLA olmak zorunda.
  for v_i in 1..35 loop
    perform public.mevzuat_yaz(null, 'Tavan olcumu satiri '||v_i, null,
      'Resmî Gazete', 'https://www.resmigazete.gov.tr/t'||v_i,
      current_date - v_i, 'HABER', 'YAYINDA');
  end loop;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · MÜŞTERİ KULLANICISI · platform.manage YOK
-- ═══════════════════════════════════════════════════════════════════════════
reset role;
set local role authenticated;
select prova_oturum(current_setting('prova.auth.sahip')::uuid,
                    current_setting('prova.kt')::uuid);

do $$
declare v_kod text;
begin
  raise notice '── 3 · MÜŞTERİ KULLANICISI (platform.manage YOK)';

  perform prova_bak('sağlama: bu kullanıcının platform.manage izni YOK',
    not app.yetkim_var('platform.manage'));

  begin
    perform public.mevzuat_listesi();
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ yönetim listesini OKUYAMADI ('||v_kod||')', v_kod = 'MI403');

  begin
    perform public.mevzuat_yaz(null, 'Musteri bunu yazamamali', null,
      'Kaynak', 'https://ornek.gov.tr/x', current_date, 'HABER', 'YAYINDA');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ YAZAMADI ('||v_kod||')', v_kod = 'MI403');

  begin
    perform public.mevzuat_sil(current_setting('prova.yayinda')::uuid);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ SİLEMEDİ ('||v_kod||')', v_kod = 'MI403');

  begin
    perform count(*) from public.regulation_news;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ tabloyu DOĞRUDAN okuyamadı ('||v_kod||')', v_kod <> '00000');

  -- ⚠️ Ama vitrin akışını okuyabilmeli: o herkese açık.
  perform prova_bak('vitrin akışını okuyabiliyor (herkese açık)',
    (select count(*) from public.mevzuat_akisi_oku(5)) = 5);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · OTURUMSUZ ZİYARETÇİ (anon) · vitrin
-- ═══════════════════════════════════════════════════════════════════════════
reset role;
set local role anon;

do $$
declare v_kod text; v_say int;
begin
  raise notice '── 4 · ZİYARETÇİ (anon · oturum YOK)';

  select count(*) into v_say from public.mevzuat_akisi_oku(5);
  perform prova_bak('⚠️ oturumsuz ziyaretçi akışı OKUYABİLDİ ('||v_say||' satır)',
    v_say = 5);

  -- ⚠️ ASIL SORU: taslak ve arşiv sızıyor mu?
  perform prova_bak('⚠️ TASLAK başlık vitrinde YOK',
    not exists (select 1 from public.mevzuat_akisi_oku(20)
                 where baslik = 'Henuz yayinlanmamis taslak baslik'));
  perform prova_bak('⚠️ ARSIV başlık vitrinde YOK',
    not exists (select 1 from public.mevzuat_akisi_oku(20)
                 where baslik = 'Arsivlenmis eski bir duyuru'));

  -- Tavan: 1000 istendi, en çok 20 gelmeli.
  select count(*) into v_say from public.mevzuat_akisi_oku(1000);
  perform prova_bak('⚠️ TAVAN sunucuda: 1000 istendi, '||v_say||' geldi', v_say = 30);
  select count(*) into v_say from public.mevzuat_akisi_oku(0);
  perform prova_bak('sıfır istendi, en az bir geldi ('||v_say||')', v_say = 1);

  -- Sıralama: en yeni önce.
  perform prova_bak('en yeni satır başta',
    (select yayim_tarihi from public.mevzuat_akisi_oku(1))
      = (select max(yayim_tarihi) from public.mevzuat_akisi_oku(20)));

  -- Yönetim kapıları kapalı.
  begin
    perform public.mevzuat_listesi();
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ yönetim listesini ÇAĞIRAMADI ('||v_kod||')', v_kod <> '00000');

  begin
    perform public.mevzuat_yaz(null, 'Ziyaretci bunu yazamamali', null,
      'Kaynak', 'https://ornek.gov.tr/x', current_date, 'HABER', 'YAYINDA');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ YAZAMADI ('||v_kod||')', v_kod <> '00000');

  begin
    perform public.mevzuat_sil(gen_random_uuid());
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ SİLEMEDİ ('||v_kod||')', v_kod <> '00000');

  begin
    perform count(*) from public.regulation_news;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ tabloyu DOĞRUDAN okuyamadı ('||v_kod||')', v_kod <> '00000');
end $$;

reset role;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · VİTRİN NE DÖNDÜRÜYOR · fazlası çıkmıyor
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare v_sutunlar text;
begin
  raise notice '── 5 · VİTRİNİN DÖNDÜRDÜĞÜ ALANLAR';

  select string_agg(p.parameter_name, ',' order by p.ordinal_position)
    into v_sutunlar
    from information_schema.parameters p
    join information_schema.routines r on r.specific_name = p.specific_name
   where r.routine_schema = 'public' and r.routine_name = 'mevzuat_akisi_oku'
     and p.parameter_mode = 'OUT';

  -- ⚠️ 0114 `tur` alanını EKLEDİ (kütüphane başlıkları için gerekli).
  -- Beklenen liste elle güncellendi: alan eklemek bilinçli bir karardır,
  -- sessizce geçmemeli.
  perform prova_bak('vitrin alanları: '||coalesce(v_sutunlar,'(yok)'),
    v_sutunlar = 'baslik,ozet,kaynak_adi,kaynak_adresi,yayim_tarihi,tur');
  perform prova_bak('⚠️ `durum` vitrine ÇIKMIYOR',
    coalesce(v_sutunlar,'') not like '%durum%');
  perform prova_bak('⚠️ imza alanları vitrine ÇIKMIYOR',
    coalesce(v_sutunlar,'') not like '%yazan%');
end $$;

rollback;
