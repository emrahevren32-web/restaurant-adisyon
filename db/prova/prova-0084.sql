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

create or replace function prova_oturumsuz() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{}', false);
end; $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_platform uuid; v_pfirma uuid; v_padmin uuid := gen_random_uuid();
begin
  perform prova_oturumsuz();
  select t.id into v_platform from public.tenant t where t.is_platform limit 1;
  select c.id into v_pfirma  from public.company c where c.tenant_id = v_platform limit 1;

  insert into auth.users (id, email) values (v_padmin, 'p84@miyop.local');
  insert into public.app_user (tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_platform, v_pfirma, v_padmin, 'p84_platform', 'p84_platform',
          'Platform Yöneticisi', 'super_admin', true);

  perform set_config('prova.platform', v_platform::text, false);
  perform set_config('prova.padmin', v_padmin::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

-- ── 1 · TİCARİ UNVAN ZORUNLU ──────────────────────────────────────────────
do $$
declare v_ref text;
begin
  raise notice '── 1 · TİCARİ UNVAN ZORUNLU';
  perform prova_oturumsuz();

  begin
    perform public.basvuru_gonder(
      'P84 Gıda', null, 'Ali Veli', '02161112233', 'p84a@ornek.local',
      'İstanbul', 'Ataşehir', 'OSB 1. Cadde No:1', 2, 30);
    perform prova_bak('boş unvan reddedilmeli', false);
  exception when sqlstate 'MI400' then
    perform prova_bak('boş ticari unvan MI400 alıyor', true);
  end;

  begin
    perform public.basvuru_gonder(
      'P84 Gıda', '   ', 'Ali Veli', '02161112233', 'p84a@ornek.local',
      'İstanbul', 'Ataşehir', 'OSB 1. Cadde No:1', 2, 30);
    perform prova_bak('yalnız boşluktan ibaret unvan reddedilmeli', false);
  exception when sqlstate 'MI400' then
    perform prova_bak('boşluktan ibaret unvan da reddediliyor', true);
  end;

  begin
    perform public.basvuru_gonder(
      'P84 Gıda', 'X', 'Ali Veli', '02161112233', 'p84a@ornek.local',
      'İstanbul', 'Ataşehir', 'OSB 1. Cadde No:1', 2, 30);
    perform prova_bak('tek harflik unvan reddedilmeli', false);
  exception when sqlstate 'MI400' then
    perform prova_bak('tek harflik unvan reddediliyor', true);
  end;

  -- Geçerli başvuru
  v_ref := public.basvuru_gonder(
    'P84 Gıda', '  P84 Gıda Sanayi ve Ticaret A.Ş.  ', 'Ali Veli',
    '02161112233', 'p84a@ornek.local',
    'İstanbul', 'Ataşehir', 'OSB 1. Cadde No:1', 2, 30);
  perform prova_bak('geçerli başvuru numarası döndü', v_ref is not null and length(v_ref) > 3);

  perform prova_bak('unvan BOŞLUKLARI KIRPILMIŞ kaydedildi',
    (select b.legal_name from public.business_application b
      where b.reference = v_ref) = 'P84 Gıda Sanayi ve Ticaret A.Ş.');

  perform set_config('prova.ref', v_ref, false);
end $$;

-- ── 2 · ONAY UNVANI TAŞIYOR ───────────────────────────────────────────────
do $$
declare v_basvuru uuid; v_kiraci uuid;
begin
  raise notice '── 2 · ONAY UNVANI TAŞIYOR';
  perform prova_oturum(current_setting('prova.padmin')::uuid,
                       current_setting('prova.platform')::uuid);

  select b.id into v_basvuru from public.business_application b
   where b.reference = current_setting('prova.ref');

  update public.business_application set status = 'IN_REVIEW' where id = v_basvuru;
  select o.kiraci_id into v_kiraci
    from app.basvuruyu_onayla(v_basvuru, 'Prova onayı') o;

  perform prova_bak('kiracı açıldı', v_kiraci is not null);
  perform prova_bak('company.legal_name GERÇEK unvan',
    (select c.legal_name from public.company c where c.tenant_id = v_kiraci)
      = 'P84 Gıda Sanayi ve Ticaret A.Ş.');
  perform prova_bak('company.company_name ayrı duruyor',
    (select c.company_name from public.company c where c.tenant_id = v_kiraci) = 'P84 Gıda');

  -- Müşteri kartı da gerçek unvanı göstermeli
  perform prova_bak('müşteri kartında ticari unvan görünüyor',
    (select d.ticari_unvan from app.platform_musteri_detayi(v_kiraci) d)
      = 'P84 Gıda Sanayi ve Ticaret A.Ş.');
  perform set_config('prova.kiraci', v_kiraci::text, false);
end $$;

-- ── 3 · ESKİ KAYIT: unvan yoksa firma adı kopyalanıyor ────────────────────
do $$
declare v_basvuru uuid := gen_random_uuid(); v_kiraci uuid;
begin
  raise notice '── 3 · ESKİ KAYIT DAVRANIŞI';
  perform prova_oturumsuz();

  -- Kapıyı atlayarak doğrudan yazıyoruz: 0084 ÖNCESİ bir başvuruyu taklit
  -- ediyor (legal_name null). Gerçekte bunu yalnız göç öncesi satırlar yapar.
  insert into public.business_application
    (id, reference, sector_code, company_name, owner_name, phone, email,
     city, district, address, branch_count, staff_count)
  values (v_basvuru, 'P84-ESKI-1', 'industrial-kitchen', 'P84 Eski Firma',
          'Veli Ali', '02161112244', 'p84b@ornek.local',
          'Ankara', 'Çankaya', 'Eski Mahalle 2. Sokak No:3', 1, 10);

  perform prova_oturum(current_setting('prova.padmin')::uuid,
                       current_setting('prova.platform')::uuid);
  update public.business_application set status = 'IN_REVIEW' where id = v_basvuru;
  select o.kiraci_id into v_kiraci
    from app.basvuruyu_onayla(v_basvuru, 'Eski kayıt onayı') o;

  perform prova_bak('unvansız eski kayıtta firma adı kopyalanıyor',
    (select c.legal_name from public.company c where c.tenant_id = v_kiraci)
      = 'P84 Eski Firma');
end $$;

-- ── 4 · ÜRÜN KAPISI DÜŞTÜ ─────────────────────────────────────────────────
do $$
declare v_ad text;
begin
  raise notice '── 4 · ÜRÜN KAPISI';
  foreach v_ad in array array[
    'app.platform_populer_urunler(uuid, integer, integer)',
    'public.platform_populer_urunler(uuid, integer, integer)'
  ] loop
    perform prova_bak(v_ad || ' düştü', to_regprocedure(v_ad) is null);
  end loop;

  -- 0083'ün diğer kapıları YERİNDE durmalı
  foreach v_ad in array array[
    'app.platform_musteri_listesi()',
    'app.platform_musteri_detayi(uuid)',
    'app.platform_musteri_kullanicilari(uuid)',
    'app.platform_kullanim_saatleri(uuid, integer)'
  ] loop
    perform prova_bak(v_ad || ' duruyor', to_regprocedure(v_ad) is not null);
  end loop;
end $$;

-- ── 5 · KAPILAR ───────────────────────────────────────────────────────────
do $$
declare v_yeni text; v_eski text; v_acl aclitem[];
begin
  raise notice '── 5 · KAPILAR';
  v_yeni := 'public.basvuru_gonder(text, text, text, text, text, text, text, text, '
            || 'int, int, text, text, text, text)';
  v_eski := 'public.basvuru_gonder(text, text, text, text, text, text, text, '
            || 'int, int, text, text, text, text)';

  perform prova_bak('yeni imza var', to_regprocedure(v_yeni) is not null);
  perform prova_bak('ESKİ imza düştü (iki aday kalmadı)', to_regprocedure(v_eski) is null);
  perform prova_bak('anon açık formu çağırabiliyor',
    has_function_privilege('anon', to_regprocedure(v_yeni), 'execute'));

  select coalesce(p.proacl, acldefault('f', p.proowner)) into v_acl
    from pg_proc p where p.oid = to_regprocedure('app.basvuru_firma_unvani(uuid)');
  perform prova_bak('app.basvuru_firma_unvani PUBLIC kapalı',
    not exists (select 1 from aclexplode(v_acl) a
                 where a.grantee = 0 and a.privilege_type = 'EXECUTE'));
  perform prova_bak('app.basvuru_firma_unvani anon kapalı',
    not has_function_privilege('anon',
      to_regprocedure('app.basvuru_firma_unvani(uuid)'), 'execute'));
end $$;

rollback;
