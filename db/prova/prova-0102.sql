-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0102 · GİRİŞ ADRESİ KAPISI DIŞARI KAPANDI MI?
--
-- Soru: `giris_adresi_bul` artık dışarıdan sorulamıyor mu, ve BULUNAN bir
-- hesapla BULUNMAYAN bir hesap aynı cevabı mı veriyor?
--
-- ⚠️ 1.8.5 · prova-0077 bu ayrımı HİÇ ÖLÇMÜYORDU: yalnız bulunan hesabı
-- sınıyordu. Sızıntının kendisi "iki hâlin FARKLI cevap vermesi" idi;
-- yani ölçülmesi gereken şey tam olarak o FARKtı.
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

-- ⚠️ ROL ALTINDA ÇAĞIRIP SONUCU YUTMADAN YAKALAR.
-- `security invoker` (varsayılan): çağıranın yetkisiyle çalışır, yani
-- `set role anon` altında gerçekten anon'un yetkisi ölçülür. Hata
-- yutulmaz, SQLSTATE olarak geri verilir.
create or replace function prova_dene(p_ad text, p_isletme text)
returns text language plpgsql as $$
begin
  perform public.giris_adresi_bul(p_ad, p_isletme);
  return 'CAGRILDI';
exception when others then
  return sqlstate;
end; $$;

-- ── KURULUM: iki işletme, bir VAR bir YOK hesap ──────────────────────────
do $$
declare
  v_abc uuid := gen_random_uuid(); v_prv uuid := gen_random_uuid();
  a_patron uuid := gen_random_uuid(); a_depo uuid := gen_random_uuid();
  p_depo uuid := gen_random_uuid();
begin
  insert into public.tenant (id, code, name) values
    (v_abc, 'ABCGIDA', 'ABC Endüstriyel Mutfak A.Ş.'),
    (v_prv, 'PRV2',    'Prova İkinci');

  insert into auth.users (id, email) values
    (a_patron, 'ABC.Bey@Gercek-Eposta.COM'),
    (a_depo,   'depocu@abcgida.miyop.local'),
    (p_depo,   'depocu@prv2.miyop.local');

  insert into public.app_user (id, tenant_id, auth_user_id, username, username_key,
                               full_name, role_code, is_active) values
    (gen_random_uuid(), v_abc, a_patron, 'abcbey', 'abcbey',
     'ABC Bey', 'isletme_sahibi', true),
    (gen_random_uuid(), v_abc, a_depo, 'depocu', 'depocu',
     'Alaattin Kocatepe', 'depo_sorumlusu', true),
    (gen_random_uuid(), v_prv, p_depo, 'depocu', 'depocu',
     'Başka Depocu', 'depo_sorumlusu', true);
end; $$;

-- ── 1 · YAPISAL: KAPI KİMDE ──────────────────────────────────────────────
do $$
begin
  perform prova_bak('fonksiyon DURUYOR (silinmedi)',
    to_regprocedure('public.giris_adresi_bul(text, text)') is not null);
  perform prova_bak('anon''un EXECUTE hakkı YOK',
    not has_function_privilege('anon',
      'public.giris_adresi_bul(text, text)', 'execute'));
  perform prova_bak('⚠️ authenticated''ın da EXECUTE hakkı YOK (yarım onarım değil)',
    not has_function_privilege('authenticated',
      'public.giris_adresi_bul(text, text)', 'execute'));
  perform prova_bak('service_role çağırabiliyor (Edge Function''ın yolu)',
    has_function_privilege('service_role',
      'public.giris_adresi_bul(text, text)', 'execute'));
  perform prova_bak('app şemasındaki asıl fonksiyon anon''a kapalı',
    not has_function_privilege('anon',
      'app.giris_adresi_bul(text, text)', 'execute'));
end; $$;

-- ── 2 · PUBLIC KAPISI (varsayılan AÇIKTIR) ───────────────────────────────
do $$
begin
  perform prova_bak('HERKESE (PUBLIC) açık değil',
    not exists (
      select 1 from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      cross join lateral aclexplode(p.proacl) a
      where n.nspname = 'public' and p.proname = 'giris_adresi_bul'
        and a.grantee = 0 and a.privilege_type = 'EXECUTE'));
end; $$;

-- ── 3 · CANLI ÖLÇÜM · anon ROLÜYLE ───────────────────────────────────────
-- ⚠️ KÖR PROVA OLMASIN (tuzak 139): yetki tablosuna bakmak yetmez,
-- rolün altına GİRİP gerçekten çağırmak gerekir.
set role anon;
select set_config('prova.anon_var', prova_dene('depocu', 'ABCGIDA'), false);
select set_config('prova.anon_yok', prova_dene('boyle-biri-kesinlikle-yok', 'ABCGIDA'), false);
select set_config('prova.anon_bos', prova_dene('', 'ABCGIDA'), false);
reset role;

do $$
declare v_var text := current_setting('prova.anon_var');
        v_yok text := current_setting('prova.anon_yok');
        v_bos text := current_setting('prova.anon_bos');
begin
  perform prova_bak('anon VAR OLAN adı soramıyor (42501 geldi: ' || v_var || ')',
    v_var = '42501');
  perform prova_bak('anon OLMAYAN adı da soramıyor (42501 geldi: ' || v_yok || ')',
    v_yok = '42501');
  perform prova_bak('⚠️ 1.8.5 · İKİ HÂL BİREBİR AYNI CEVAP (var=' || v_var ||
                    ' / yok=' || v_yok || ')', v_var = v_yok);
  perform prova_bak('boş girdi de aynı cevabı veriyor', v_bos = v_var);
end; $$;

-- ── 4 · CANLI ÖLÇÜM · authenticated ROLÜYLE ──────────────────────────────
-- ⚠️ ASIL KAPSAM DÜZELTMESİ BURADA ÖLÇÜLÜYOR: oturum açmış biri BAŞKA
-- işletmenin kullanıcı adını sorup gerçek Auth adresini alabiliyordu.
set role authenticated;
select set_config('prova.auth_var', prova_dene('depocu', 'ABCGIDA'), false);
select set_config('prova.auth_baska', prova_dene('abcbey', 'ABCGIDA'), false);
select set_config('prova.auth_yok', prova_dene('boyle-biri-kesinlikle-yok', 'ABCGIDA'), false);
reset role;

do $$
declare v_var   text := current_setting('prova.auth_var');
        v_baska text := current_setting('prova.auth_baska');
        v_yok   text := current_setting('prova.auth_yok');
begin
  perform prova_bak('oturum açmış kullanıcı da soramıyor (' || v_var || ')',
    v_var = '42501');
  perform prova_bak('⚠️ işletme sahibinin GERÇEK e-postası artık sorulamıyor (' ||
                    v_baska || ')', v_baska = '42501');
  perform prova_bak('oturumluyken de iki hâl aynı cevap', v_var = v_yok);
end; $$;

-- ── 5 · EDGE FUNCTION''IN YOLU AÇIK KALDI MI ─────────────────────────────
-- ⚠️ Kapıyı kapatırken girişin kendisini kırmadığımızı ölçmezsek,
-- "sızıntı kapandı" demek "giriş çalışıyor" demek olmaz.
set role service_role;
select set_config('prova.servis', prova_dene('depocu', 'ABCGIDA'), false);
select set_config('prova.servis_adres',
  coalesce(public.giris_adresi_bul('depocu', 'ABCGIDA'), '(bos)'), false);
reset role;

do $$
begin
  perform prova_bak('service_role çağırabildi (' || current_setting('prova.servis') || ')',
    current_setting('prova.servis') = 'CAGRILDI');
  perform prova_bak('⚠️ ve DOĞRU adresi çözdü — giriş kırılmadı',
    current_setting('prova.servis_adres') = 'depocu@abcgida.miyop.local');
end; $$;

-- ── 6 · PERSONEL AKIŞI DOKUNULMADI ───────────────────────────────────────
-- ⚠️ `authenticated` hakkını topluca almak personel hesabı açmayı kırardı.
do $$
begin
  perform prova_bak('public.personel_giris_adresi DURUYOR',
    to_regprocedure('public.personel_giris_adresi(uuid, text)') is not null);
  perform prova_bak('⚠️ ve authenticated''a AÇIK kaldı (personel açma kırılmadı)',
    has_function_privilege('authenticated',
      'public.personel_giris_adresi(uuid, text)', 'execute'));
  perform prova_bak('anon personel adresini soramıyor',
    not has_function_privilege('anon',
      'public.personel_giris_adresi(uuid, text)', 'execute'));
end; $$;

-- ── 7 · FONKSİYONUN KENDİSİ DEĞİŞMEDİ ────────────────────────────────────
-- Bu göç yalnız YETKİ değiştirdi; gövdeye dokunmadı.
do $$
begin
  perform prova_bak('hâlâ tek satır text döndürüyor (liste değil)',
    (select pg_catalog.pg_get_function_result(p.oid)
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app' and p.proname = 'giris_adresi_bul') = 'text');
  perform prova_bak('hâlâ veri yazmıyor (stable)',
    (select provolatile from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'app' and p.proname = 'giris_adresi_bul') = 's');
end; $$;

rollback;
