\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- TERS PROVA 0114 · KUSUR GERÇEK Mİ
--
-- Düz prova "sıra türe göre" ve "yetkiler geri verildi" diyor. Ama bir
-- iddia, ancak kuralı KALDIRDIĞINDA kırmızıya dönüyorsa bir şey ölçüyor.
-- Bu dosya 0114'ün iki kuralını tek tek kaldırıyor ve kusurun GERÇEKTEN
-- ortaya çıktığını gösteriyor. Sonunda `rollback` — hiçbiri kalmıyor.
--
-- KALDIRILAN KURAL 1 · vitrin sıralamasındaki `case r.kind`
--   → BUGÜN girilmiş bir HABER, 2011 tarihli bir KANUN'un ÜSTÜNE çıkıyor.
--     Emrah'ın 10.11'de ekranda gördüğü şey tam buydu.
--
-- KALDIRILAN KURAL 2 · göçün sonunda anon'a verilen okuma yetkisi
--   → Giriş ekranı "permission denied" alıyor; vitrin BOŞ kalıyor.
--     ⚠️ Bu, 0114 fonksiyonları DÜŞÜRDÜĞÜ için gerçek bir risktir:
--     `drop function` yetkileri de siler (tuzak 67). Göç yeniden
--     vermeseydi demo sabahı ekran sessizce boş açılırdı.
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

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid)
  to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- ── SAHNE ─────────────────────────────────────────────────────────────────
do $$
declare v_pt uuid; v_pf uuid; v_auth uuid; v_app uuid;
begin
  select t.id into v_pt from public.tenant t where t.is_platform limit 1;
  if v_pt is null then
    raise exception 'KURULUM: is_platform kiraci bulunamadi';
  end if;
  select c.id into v_pf from public.company c where c.tenant_id = v_pt limit 1;

  v_auth := gen_random_uuid(); v_app := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p114t.platform@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_pt, v_pf, v_auth, 'p114tplatform', 'p114tplatform',
          'Prova 114 Ters', 'super_admin', true);
  perform set_config('prova.auth.platform', v_auth::text, false);
  perform set_config('prova.pt', v_pt::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);

do $$
begin
  perform prova_bak('sağlama: sahneyi kuran kullanıcının platform.manage izni VAR',
    app.yetkim_var('platform.manage'));
  perform public.mevzuat_yaz(null, 'TERS114 kanun 2011', null, 'Kaynak',
    'https://mevzuat.gov.tr/t114-kanun', date '2011-12-17', 'KANUN', 'YAYINDA');
  perform public.mevzuat_yaz(null, 'TERS114 haber bugun', null, 'Kaynak',
    'https://mevzuat.gov.tr/t114-haber', current_date, 'HABER', 'YAYINDA');
end $$;

reset role;

-- ── ÖNCE · KURALLAR YERİNDEYKEN ──────────────────────────────────────────
set local role anon;

do $$
declare v_kanun int; v_haber int;
begin
  raise notice '── ÖNCE · kurallar yerinde';

  with sirali as (
    select baslik, row_number() over () as sira
      from public.mevzuat_akisi_oku(30)
  )
  select max(case when baslik = 'TERS114 kanun 2011' then sira end),
         max(case when baslik = 'TERS114 haber bugun' then sira end)
    into v_kanun, v_haber from sirali;

  perform prova_bak('sıra kuralı yerindeyken 2011 KANUN üstte '
    ||'(kanun: '||v_kanun||' · haber: '||v_haber||')', v_kanun < v_haber);
end $$;

reset role;

-- ── KURAL 1 KALDIRILIYOR · tür sıralaması düşüyor ────────────────────────
-- ⚠️ İmzanın AYNISI olmak zorunda: `create or replace` dönüş tipini
-- değiştiremez. Kaldırılan tek şey `order by case r.kind`.
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
  select r.title, r.summary, r.source_name, r.source_url, r.published_on, r.kind
    from public.regulation_news r
   where r.status = 'YAYINDA'
   order by r.published_on desc, r.created_at desc
   limit v_adet;
end $$;

set local role anon;

do $$
declare v_kanun int; v_haber int;
begin
  raise notice '── SONRA · sıra kuralı yok';

  with sirali as (
    select baslik, row_number() over () as sira
      from public.mevzuat_akisi_oku(30)
  )
  select max(case when baslik = 'TERS114 kanun 2011' then sira end),
         max(case when baslik = 'TERS114 haber bugun' then sira end)
    into v_kanun, v_haber from sirali;

  -- ⚠️ BU SATIRIN YEŞİL YANMASI, KUSURUN GERÇEK OLDUĞUNUN KANITIDIR.
  -- Sıra kuralı olmasaydı, kalıcı kütüphane bağlantıları haberlerin
  -- ALTINA düşer ve giriş ekranında görünmez olurdu.
  perform prova_bak('⚠️ SIRA KURALI YOKKEN bugünkü HABER, 2011 KANUN''un '
    ||'ÜSTÜNE ÇIKTI — kusur gerçekti (haber: '||v_haber||' · kanun: '
    ||v_kanun||')', v_haber < v_kanun);
end $$;

reset role;

-- ── KURAL 2 KALDIRILIYOR · anon'un okuma yetkisi düşüyor ─────────────────
revoke execute on function public.mevzuat_akisi_oku(integer) from anon;

set local role anon;

do $$
declare v_kod text;
begin
  raise notice '── SONRA · anon yetkisi yok';
  begin
    perform 1 from public.mevzuat_akisi_oku(30);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  -- ⚠️ BU SATIRIN YEŞİL YANMASI, 0114'ÜN YENİDEN VERDİĞİ YETKİNİN
  -- GEREKLİ OLDUĞUNUN KANITIDIR. `drop function` yetkiyi de siler.
  perform prova_bak('⚠️ YETKİ GERİ VERİLMESEYDİ vitrin "permission denied" '
    ||'alıp BOŞ kalacaktı — kusur gerçekti ('||v_kod||')', v_kod = '42501');
end $$;

reset role;

do $$ begin raise notice '──── 0114 ters provası: TAMAM'; end $$;

rollback;
