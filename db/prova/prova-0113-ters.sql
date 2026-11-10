\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- TERS PROVA 0113 · KAPIYI KALDIRINCA PROVA GERÇEKTEN KIRMIZI VERİYOR MU
--
-- ⚠️ NEDEN VAR: `prova-0113.sql` yeşil yanıyor. Ama bir kapı provası,
-- kapı OLMASAYDI DA yeşil yanıyorsa hiçbir şey ölçmüyordur. Bu dosya
-- iki kapıyı da ayrı ayrı kaldırıp kusurun GERÇEKTEN ortaya çıktığını
-- gösteriyor:
--   1 · vitrin süzgeci (`status = 'YAYINDA'`) kalkınca TASLAK satır
--       herkese açık ekrana SIZIYOR — MIYOP-059'un ta kendisi, bu sefer
--       uydurma değil ONAYLANMAMIŞ metin;
--   2 · yazma kapısı `anon`a açılınca oturumsuz biri yazabiliyor.
--
-- `rollback` ile bitiyor: veritabanına dokunmuyor.
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
declare v_pt uuid; v_pf uuid; v_auth uuid;
begin
  select t.id into v_pt from public.tenant t where t.is_platform limit 1;
  if v_pt is null then
    raise exception 'KURULUM: is_platform kiraci bulunamadi.';
  end if;
  select c.id into v_pf from public.company c where c.tenant_id = v_pt limit 1;

  v_auth := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p113t.platform@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (gen_random_uuid(), v_pt, v_pf, v_auth, 'p113tplat', 'p113tplat',
          'Ters 113 Platform', 'super_admin', true);
  perform set_config('prova.auth.platform', v_auth::text, false);
  perform set_config('prova.pt', v_pt::text, false);
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid)
  to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- ── SAHNEYİ PLATFORM YÖNETİCİSİ KURUYOR · ROL TAKARAK ───────────────────
-- ⚠️ BU BLOK BİR HATANIN BEDELİ (09.11.2026). İlk hâlinde iki satır
-- fikstür DO bloğunun içinde, SÜPER KULLANICI olarak yazılıyordu. JWT
-- konmuştu ama `set local role authenticated` YOKTU — yani yazımlar
-- kapının DIŞINDA koştu ve `app.platform_kapisi()` hiç çalışmadı.
-- MIYOP-042'nin ta kendisi. `yazma-kapilari-tamam.arch.test.ts` bunu
-- "YENİ kör prova" diye yakaladı ve `kaydet.ps1` commit atmadı.
-- Ders: ters provanın SAHNESİ de kapının içinde kurulur; yoksa "kapı
-- kaldırılınca sızdı" cümlesi, sahnenin zaten kapısız kurulduğu bir
-- dünyada söylenmiş olur.
set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);

do $$
begin
  perform prova_bak('sağlama: sahneyi kuran kullanıcının platform.manage izni VAR',
    app.yetkim_var('platform.manage'));
  perform public.mevzuat_yaz(null, 'TERS PROVA onaylanmamis taslak', null,
    'Kaynak', 'https://ornek.gov.tr/taslak', current_date, 'HABER', 'TASLAK');
  perform public.mevzuat_yaz(null, 'TERS PROVA yayinda olan satir', null,
    'Kaynak', 'https://ornek.gov.tr/yayin', current_date, 'HABER', 'YAYINDA');
end $$;

reset role;

-- ── ÖNCE · KAPILAR YERİNDEYKEN ───────────────────────────────────────────
set local role anon;

do $$
declare v_kod text;
begin
  perform prova_bak('süzgeç yerindeyken TASLAK vitrinde YOK',
    not exists (select 1 from public.mevzuat_akisi_oku(20)
                 where baslik = 'TERS PROVA onaylanmamis taslak'));
  perform prova_bak('süzgeç yerindeyken YAYINDA olan vitrinde VAR',
    exists (select 1 from public.mevzuat_akisi_oku(20)
             where baslik = 'TERS PROVA yayinda olan satir'));

  begin
    perform public.mevzuat_yaz(null, 'Ziyaretci yazamamali', null,
      'Kaynak', 'https://ornek.gov.tr/x', current_date, 'HABER', 'YAYINDA');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('kapı yerindeyken ziyaretçi YAZAMIYOR ('||v_kod||')',
    v_kod <> '00000');
end $$;

reset role;

-- ── KAPI 1 KALDIRILIYOR · vitrin süzgeci düşüyor ─────────────────────────
-- ⚠️ İMZA 0114'TE DEĞİŞTİ: dönen sütunlara `tur` eklendi, varsayılan 12,
-- tavan 30 oldu. `create or replace` dönüş tipini DEĞİŞTİREMEZ; bu kopya
-- 0114'teki imzanın aynısı olmazsa prova "cannot change return type" ile
-- kırmızı yanar — kusuru değil kendi eskimişliğini ölçer (tuzak 190).
create or replace function public.mevzuat_akisi_oku(p_limit integer default 12)
returns table (
  baslik        text,
  ozet          text,
  kaynak_adi    text,
  kaynak_adresi text,
  yayim_tarihi  date,
  tur           text
)
language plpgsql
stable
security definer
set search_path = public, app, pg_temp
as $$
declare v_adet integer;
begin
  v_adet := least(greatest(coalesce(p_limit, 12), 1), 30);
  return query
  select r.title, r.summary, r.source_name, r.source_url, r.published_on,
         r.kind
    from public.regulation_news r
   order by r.published_on desc, r.created_at desc
   limit v_adet;
end $$;

-- ── KAPI 2 KALDIRILIYOR · yazma anon'a açılıyor ──────────────────────────
-- ⚠️ İMZA 0114'TE DEĞİŞTİ: yedi değil SEKİZ parametre; `p_tur`,
-- `p_durum`'dan ÖNCE geliyor. Sıra önemli: `p_tur` sonraya konsaydı
-- buradaki konumlu çağrılar sessizce yanlış yere düşerdi (tuzak 199).
grant execute on function
  public.mevzuat_yaz(uuid, text, text, text, text, date, text, text)
  to anon;
-- ⚠️ Gövdedeki `app.platform_kapisi()` de kaldırılıyor; yoksa ret YETKİ
-- yüzünden değil İZİN yüzünden gelir ve kırmızının sebebi belirsiz kalır.
create or replace function app.mevzuat_yaz(
  p_id uuid, p_baslik text, p_ozet text, p_kaynak_adi text,
  p_kaynak_adres text, p_yayim_tarihi date, p_tur text,
  p_durum text default 'TASLAK'
)
returns uuid
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare v_id uuid;
begin
  insert into public.regulation_news
    (title, summary, source_name, source_url, published_on, status, kind)
  values (btrim(p_baslik), nullif(btrim(coalesce(p_ozet,'')),''),
          btrim(p_kaynak_adi), btrim(p_kaynak_adres), p_yayim_tarihi,
          upper(btrim(p_durum)), upper(btrim(p_tur)))
  returning id into v_id;
  return v_id;
end $$;

set local role anon;

-- ── SONRA · KAPILAR YOKKEN ───────────────────────────────────────────────
do $$
declare v_id uuid;
begin
  -- ⚠️ BU SATIRIN YEŞİL YANMASI, KUSURUN GERÇEK OLDUĞUNUN KANITIDIR.
  -- Süzgeç olmasaydı, Emrah'ın henüz ONAYLAMADIĞI bir mevzuat cümlesi
  -- giriş ekranında herkese görünürdü. MIYOP-059 ile aynı sınıf: fark
  -- yalnız metnin uydurma değil ERKEN olması.
  perform prova_bak('⚠️ SÜZGEÇ YOKKEN onaylanmamış TASLAK vitrinde GÖRÜNDÜ — '
    ||'kusur gerçekti',
    exists (select 1 from public.mevzuat_akisi_oku(20)
             where baslik = 'TERS PROVA onaylanmamis taslak'));

  -- ⚠️ Ve ikinci kapı: kapı yokken oturumsuz biri yazabiliyor.
  v_id := public.mevzuat_yaz(null, 'KAPISIZ ziyaretci yazimi', null,
    'Kaynak', 'https://ornek.gov.tr/x', current_date, 'HABER', 'YAYINDA');
  perform prova_bak('⚠️ KAPI YOKKEN oturumsuz ziyaretçi YAZDI — kusur gerçekti '
    ||'('||coalesce(v_id::text,'yok')||')', v_id is not null);
end $$;

reset role;
rollback;
