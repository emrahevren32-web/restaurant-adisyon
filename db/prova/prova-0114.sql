\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0114 · MEVZUAT KÜTÜPHANESİ · tür kolonu, sabit sıra, yeniden
--              verilen yetkiler
--
-- Sorular:
--   1 · `kind` kolonu var mı; varsayılanı HABER mi; kısıt dört değeri mi
--       sınırlıyor?                                          → EVET
--   2 · Vitrin `tur` alanını dışarı veriyor mu?               → EVET
--   3 · ⚠️ SIRA TÜRE GÖRE Mİ: TARİHİ YENİ bir HABER, TARİHİ ESKİ bir
--       KANUN'un ÜSTÜNE ÇIKABİLİYOR mu?                       → HAYIR
--   4 · Tür yazılmadan kayıt açılabiliyor mu?                 → HAYIR (MI422)
--   5 · Uydurma tür (`DUYURU`) kabul ediliyor mu?             → HAYIR (MI422)
--   6 · Küçük harf `kanun` yazılırsa KANUN'a dönüyor mu?      → EVET
--   7 · Güncelleme türü değiştirebiliyor mu?                  → EVET
--   8 · ⚠️ DÜŞÜRÜLEN FONKSİYONLARIN YETKİLERİ GERİ VERİLDİ Mİ? (tuzak 67)
--       anon → yalnız okuma · authenticated → yönetim kapıları
--   9 · İkinci bir mevzuat tablosu açıldı mı?                 → HAYIR
--
-- ⚠️ 3. SORU BU GÖÇÜN VAR OLMA SEBEBİ. Emrah ilk kaydı girdiğinde
-- (17.12.2011 tarihli bir yönetmelik) ekran onu bir haber gibi tarihe
-- göre dizdi. Kütüphane bağlantısının yeri tarihe göre DEĞİŞMEMELİ.
--
-- ⚠️ 8. SORU DA ÖYLE: 0114 dönüş tipi ve parametre sayısı değiştiği için
-- fonksiyonları DÜŞÜRÜYOR. `drop function` yetkileri de siler. Göç onları
-- yeniden veriyor; bu prova verildiğini ÖLÇÜYOR. Ölçülmeyen bir grant,
-- demo sabahı "izin yok" diye patlayan bir ekrandır.
--
-- ⚠️ `set local role anon` ve `authenticated` TAKILIYOR (MIYOP-042).
-- Rol takmayan prova süper kullanıcı olarak koşar ve her şey geçer.
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
  v_pt uuid; v_pf uuid; v_auth uuid; v_app uuid;
begin
  select t.id into v_pt from public.tenant t where t.is_platform limit 1;
  if v_pt is null then
    raise exception 'KURULUM: is_platform kiraci bulunamadi (0043 uygulanmamis?)';
  end if;
  select c.id into v_pf from public.company c where c.tenant_id = v_pt limit 1;

  v_auth := gen_random_uuid(); v_app := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p114.platform@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_pt, v_pf, v_auth, 'p114platform', 'p114platform',
          'Prova 114 Platform', 'super_admin', true);
  perform set_config('prova.auth.platform', v_auth::text, false);
  perform set_config('prova.pt', v_pt::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid)
  to anon, authenticated;
grant usage on schema public to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- 1 · TÜR KOLONU (rol takmadan, katalog okuması)
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare v_kisit text; v_vars text; v_bos boolean;
begin
  raise notice '── 1 · TÜR KOLONU';

  perform prova_bak('kind kolonu var',
    exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='regulation_news'
               and column_name='kind'));

  select is_nullable = 'NO', column_default
    into v_bos, v_vars
    from information_schema.columns
   where table_schema='public' and table_name='regulation_news'
     and column_name='kind';
  perform prova_bak('kind NOT NULL', v_bos);
  perform prova_bak('⚠️ varsayılan HABER (var olan satırın türünü sessizce '
    ||'değiştirmemek için) — bulunan: '||coalesce(v_vars,'yok'),
    coalesce(v_vars,'') like '%HABER%');

  select pg_get_constraintdef(oid) into v_kisit from pg_constraint
   where conname = 'regulation_news_tur_gecerli';
  perform prova_bak('kısıt dört türü sınırlıyor — bulunan: '
    ||coalesce(v_kisit,'yok'),
    v_kisit like '%HABER%' and v_kisit like '%KANUN%'
    and v_kisit like '%YONETMELIK%' and v_kisit like '%TEBLIG%');
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2 · YAZMA · tür zorunlu, büyük harfe çevriliyor
-- ═══════════════════════════════════════════════════════════════════════════
set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);

do $$
declare v_kod text; v_id uuid; v_tur text;
begin
  raise notice '── 2 · YAZMA · tür zorunlu';

  perform prova_bak('sağlama: sahneyi kuran kullanıcının platform.manage izni VAR',
    app.yetkim_var('platform.manage'));

  -- 4 · tür yazılmadan
  begin
    perform public.mevzuat_yaz(null, 'P114 tursuz satir', null, 'Kaynak',
      'https://mevzuat.gov.tr/p114-tursuz', current_date, null, 'TASLAK');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ tür YAZILMADAN kayıt AÇILAMIYOR ('||v_kod||')',
    v_kod = 'MI422');

  -- 5 · uydurma tür
  begin
    perform public.mevzuat_yaz(null, 'P114 uydurma tur', null, 'Kaynak',
      'https://mevzuat.gov.tr/p114-uydurma', current_date, 'DUYURU', 'TASLAK');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('uydurma tür (DUYURU) REDDEDİLİYOR ('||v_kod||')',
    v_kod = 'MI422');

  -- 6 · küçük harf
  v_id := public.mevzuat_yaz(null, 'P114 kucuk harf kanun', null, 'Kaynak',
    'https://mevzuat.gov.tr/p114-kucuk', current_date, '  kanun  ', 'YAYINDA');
  -- ⚠️ Tabloyu DOĞRUDAN okumuyoruz: `authenticated`in tabloda okuma yetkisi
  -- YOK (kapı orada). Tür, yönetim listesi kapısından okunuyor.
  select l.tur into v_tur from public.mevzuat_listesi() l where l.kimlik = v_id;
  perform prova_bak('küçük harf `  kanun  ` → KANUN — bulunan: '
    ||coalesce(v_tur,'yok'), v_tur = 'KANUN');

  -- 7 · güncelleme türü değiştiriyor
  perform public.mevzuat_yaz(v_id, 'P114 kucuk harf kanun', null, 'Kaynak',
    'https://mevzuat.gov.tr/p114-kucuk', current_date, 'TEBLIG', 'YAYINDA');
  select l.tur into v_tur from public.mevzuat_listesi() l where l.kimlik = v_id;
  perform prova_bak('güncelleme türü DEĞİŞTİREBİLİYOR (KANUN → TEBLIG) — '
    ||'bulunan: '||coalesce(v_tur,'yok'), v_tur = 'TEBLIG');
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3 · SIRA · türe göre, tarihe göre DEĞİL
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare
  v_kanun_sira int; v_haber_sira int; v_yonet_sira int; v_teblig_sira int;
begin
  raise notice '── 3 · SIRA TÜRE GÖRE';

  -- ⚠️ Sahne BİLE BİLE ters kuruluyor: kanun ESKİ tarihli (2011), haber
  -- BUGÜNKÜ. Tarihe göre dizilse haber üste çıkar — Emrah'ın gördüğü şey.
  perform public.mevzuat_yaz(null, 'P114 SIRA kanun eski', null, 'Kaynak',
    'https://mevzuat.gov.tr/p114-kanun', date '2011-12-17', 'KANUN', 'YAYINDA');
  perform public.mevzuat_yaz(null, 'P114 SIRA yonetmelik eski', null, 'Kaynak',
    'https://mevzuat.gov.tr/p114-yon', date '2012-01-05', 'YONETMELIK', 'YAYINDA');
  perform public.mevzuat_yaz(null, 'P114 SIRA teblig eski', null, 'Kaynak',
    'https://mevzuat.gov.tr/p114-teb', date '2013-02-02', 'TEBLIG', 'YAYINDA');
  perform public.mevzuat_yaz(null, 'P114 SIRA haber bugun', null, 'Kaynak',
    'https://mevzuat.gov.tr/p114-haber', current_date, 'HABER', 'YAYINDA');

  with sirali as (
    select baslik, row_number() over () as sira
      from public.mevzuat_akisi_oku(30)
  )
  select max(case when baslik = 'P114 SIRA kanun eski'       then sira end),
         max(case when baslik = 'P114 SIRA yonetmelik eski'  then sira end),
         max(case when baslik = 'P114 SIRA teblig eski'      then sira end),
         max(case when baslik = 'P114 SIRA haber bugun'      then sira end)
    into v_kanun_sira, v_yonet_sira, v_teblig_sira, v_haber_sira
    from sirali;

  perform prova_bak('dördü de vitrinde',
    v_kanun_sira is not null and v_yonet_sira is not null
    and v_teblig_sira is not null and v_haber_sira is not null);

  perform prova_bak('⚠️ 2011 tarihli KANUN, BUGÜNKÜ haberin ÜSTÜNDE '
    ||'(kanun: '||v_kanun_sira||' · haber: '||v_haber_sira||')',
    v_kanun_sira < v_haber_sira);
  perform prova_bak('KANUN < YONETMELIK ('||v_kanun_sira||' < '
    ||v_yonet_sira||')', v_kanun_sira < v_yonet_sira);
  perform prova_bak('YONETMELIK < TEBLIG ('||v_yonet_sira||' < '
    ||v_teblig_sira||')', v_yonet_sira < v_teblig_sira);
  perform prova_bak('TEBLIG < HABER ('||v_teblig_sira||' < '
    ||v_haber_sira||')', v_teblig_sira < v_haber_sira);
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4 · YÖNETİM LİSTESİ · tür de dönüyor
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare v_tur text;
begin
  raise notice '── 4 · YÖNETİM LİSTESİ';

  -- ⚠️ `information_schema.columns` FONKSİYON dönüş sütunlarını
  -- LİSTELEMEZ; ilk hâli orayı sorup boş bulmuş ve haksız yere kırmızı
  -- yanmıştı. Doğru yer fonksiyonun imzası.
  perform prova_bak('yönetim listesi `tur` sütununu döndürüyor — imza: '
    ||pg_get_function_result('public.mevzuat_listesi()'::regprocedure),
    pg_get_function_result('public.mevzuat_listesi()'::regprocedure)
      ~ 'tur[[:space:]]+text');

  select l.tur into v_tur from public.mevzuat_listesi() l
   where l.baslik = 'P114 SIRA kanun eski';
  perform prova_bak('listede kanun satırının türü KANUN — bulunan: '
    ||coalesce(v_tur,'yok'), v_tur = 'KANUN');
end $$;

reset role;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5 · VİTRİN ZİYARETÇİYE AÇIK, YAZMA KAPALI · tür alanı dışarı veriliyor
-- ═══════════════════════════════════════════════════════════════════════════
set local role anon;

do $$
declare v_tur text; v_kod text;
begin
  raise notice '── 5 · ZİYARETÇİ';

  select a.tur into v_tur from public.mevzuat_akisi_oku(30) a
   where a.baslik = 'P114 SIRA kanun eski';
  perform prova_bak('oturumsuz ziyaretçi `tur` alanını OKUYOR — bulunan: '
    ||coalesce(v_tur,'yok'), v_tur = 'KANUN');

  begin
    perform public.mevzuat_yaz(null, 'P114 ziyaretci', null, 'Kaynak',
      'https://mevzuat.gov.tr/p114-z', current_date, 'KANUN', 'YAYINDA');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('⚠️ ziyaretçi YAZAMIYOR ('||v_kod||')', v_kod <> '00000');

  begin
    perform 1 from public.regulation_news limit 1;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('ziyaretçi tabloyu DOĞRUDAN okuyamıyor ('||v_kod||')',
    v_kod <> '00000');
end $$;

reset role;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6 · YETKİLER GERİ VERİLDİ Mİ (tuzak 67 · `drop function` grantları siler)
-- ═══════════════════════════════════════════════════════════════════════════
do $$
begin
  raise notice '── 6 · YETKİLER';

  perform prova_bak('⚠️ anon → mevzuat_akisi_oku ÇAĞIRABİLİR',
    has_function_privilege('anon', 'public.mevzuat_akisi_oku(integer)', 'execute'));

  perform prova_bak('anon → mevzuat_yaz ÇAĞIRAMAZ',
    not has_function_privilege('anon',
      'public.mevzuat_yaz(uuid,text,text,text,text,date,text,text)', 'execute'));
  perform prova_bak('anon → mevzuat_listesi ÇAĞIRAMAZ',
    not has_function_privilege('anon', 'public.mevzuat_listesi()', 'execute'));
  perform prova_bak('anon → mevzuat_sil ÇAĞIRAMAZ',
    not has_function_privilege('anon', 'public.mevzuat_sil(uuid)', 'execute'));

  perform prova_bak('⚠️ authenticated → mevzuat_yaz ÇAĞIRABİLİR '
    ||'(düşen fonksiyonun yetkisi geri verildi)',
    has_function_privilege('authenticated',
      'public.mevzuat_yaz(uuid,text,text,text,text,date,text,text)', 'execute'));
  perform prova_bak('authenticated → mevzuat_listesi ÇAĞIRABİLİR',
    has_function_privilege('authenticated', 'public.mevzuat_listesi()', 'execute'));
  perform prova_bak('authenticated → mevzuat_sil ÇAĞIRABİLİR',
    has_function_privilege('authenticated', 'public.mevzuat_sil(uuid)', 'execute'));
end $$;


-- ═══════════════════════════════════════════════════════════════════════════
-- 7 · TEK TABLO · ikinci bir mevzuat tablosu AÇILMADI
-- ═══════════════════════════════════════════════════════════════════════════
do $$
declare v_say int; v_adlar text;
begin
  raise notice '── 7 · TEK TABLO';

  select count(*), string_agg(table_name, ', ')
    into v_say, v_adlar
    from information_schema.tables
   where table_schema = 'public' and table_type = 'BASE TABLE'
     and (table_name like '%regulation%' or table_name like '%mevzuat%');
  perform prova_bak('⚠️ tek mevzuat tablosu var (iki yerde iki gerçek yok) — '
    ||'bulunan: '||coalesce(v_adlar,'yok'), v_say = 1);

  -- ⚠️ Tek okuma fonksiyonu: ikinci bir kapı açılsa `YAYINDA` süzgeci iki
  -- yerde tutulmak zorunda kalırdı.
  select count(*) into v_say from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'mevzuat%oku%';
  perform prova_bak('tek vitrin okuma fonksiyonu var — bulunan: '||v_say,
    v_say = 1);
end $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8 · YETKİ TABLOSU · 7 fonksiyon × 4 rol, TEK TEK (MIYOP-108 · 12.11.2026)
--
-- Codex 4. tur: bu prova vitrinin ve yönetim kabuklarının yetkisini canlı
-- çağrıyla ölçüyordu ama `app.*` yardımcılarını ve `service_role` satırını
-- ÖLÇMÜYORDU. Mimari test (mevzuat-kapisi.arch.test.ts) aynı tabloyu göç
-- METNİNDEN okuyor; burada VERİTABANININ KENDİSİNE soruluyor. İkisi
-- birbirinin yerine geçmez.
--
-- ⚠️ PUBLIC bir rol değildir; `has_function_privilege('public', …)` diye
-- sorulamaz. ACL'den okunuyor: `grantee = 0` PUBLIC demektir. ACL NULL ise
-- fonksiyon hiç kısıtlanmamıştır ve PUBLIC varsayılan olarak ÇAĞIRABİLİR —
-- o yüzden "satır yok" ile "kapalı" ayrı ölçülüyor.
-- ═══════════════════════════════════════════════════════════════════════════
reset role;

do $$
declare
  v record;
  v_public boolean;
  v_bulunan boolean;
  v_say int := 0;
begin
  raise notice '── 8 · YETKİ TABLOSU';

  for v in
    select * from (values
      -- fonksiyon,                                                              public, anon,  authenticated, service_role
      ('public.mevzuat_akisi_oku(integer)',                                       false,  true,  true,  true),
      ('public.mevzuat_listesi()',                                                false,  false, true,  true),
      ('public.mevzuat_yaz(uuid, text, text, text, text, date, text, text)',      false,  false, true,  true),
      ('public.mevzuat_sil(uuid)',                                                false,  false, true,  true),
      ('app.mevzuat_listesi()',                                                   false,  false, false, true),
      ('app.mevzuat_yaz(uuid, text, text, text, text, date, text, text)',         false,  false, false, true),
      ('app.mevzuat_sil(uuid)',                                                   false,  false, false, true)
    ) as t(fn, b_public, b_anon, b_auth, b_servis)
  loop
    select p.proacl is null
           or exists (select 1 from aclexplode(p.proacl) a
                       where a.grantee = 0 and a.privilege_type = 'EXECUTE')
      into v_public
      from pg_proc p where p.oid = v.fn::regprocedure;
    perform prova_bak(v.fn||' · PUBLIC '||case when v.b_public then 'AÇIK' else 'KAPALI' end,
      v_public = v.b_public);

    v_bulunan := has_function_privilege('anon', v.fn, 'execute');
    perform prova_bak(v.fn||' · anon '||case when v.b_anon then 'AÇIK' else 'KAPALI' end,
      v_bulunan = v.b_anon);

    v_bulunan := has_function_privilege('authenticated', v.fn, 'execute');
    perform prova_bak(v.fn||' · authenticated '||case when v.b_auth then 'AÇIK' else 'KAPALI' end,
      v_bulunan = v.b_auth);

    v_bulunan := has_function_privilege('service_role', v.fn, 'execute');
    perform prova_bak(v.fn||' · service_role '||case when v.b_servis then 'AÇIK' else 'KAPALI' end,
      v_bulunan = v.b_servis);
    v_say := v_say + 1;
  end loop;

  perform prova_bak('yedi fonksiyonun yedisi de ölçüldü — bulunan: '||v_say, v_say = 7);

  -- ⚠️ ARTAKALAN İMZA YOK: 0114 yedi parametreli `mevzuat_yaz`ı düşürdü.
  -- Yanında eski imza kalsaydı çağrılar belirsizleşirdi (tuzak 67).
  select count(*) into v_say from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname in ('public', 'app') and p.proname like 'mevzuat%';
  perform prova_bak('mevzuat fonksiyonu TAM yedi tane (artakalan imza yok) — bulunan: '||v_say,
    v_say = 7);
end $$;

do $$ begin raise notice '──── 0114 provası: TAMAM'; end $$;

rollback;
