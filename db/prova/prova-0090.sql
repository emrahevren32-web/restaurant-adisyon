\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

-- ⚠️ MIYOP-042/Codex: portal oturumunda `tenant_id` claim'i ve
-- `app.tenant_id` GUC'u YOKTUR. Önceki prova onları kendisi koyuyordu ve
-- gerçekte olmayan bir kolaylık sağlıyordu. Burada iki ayrı oturum kurucu
-- var: iç kullanıcı (kiracılı) ve portal müşterisi (KİRACISIZ).
create or replace function prova_ic_oturum(p_auth uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', current_setting('prova.t'))::text, false);
  perform set_config('app.tenant_id', current_setting('prova.t'), false);
end; $$;

create or replace function prova_portal_oturum(p_auth uuid, p_eposta text)
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  -- Yalnız `sub` ve `email`. Kiracı bilgisi YOK — gerçekte de yok.
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'email', p_eposta)::text, false);
  perform set_config('app.tenant_id', '', false);
end; $$;

create or replace function prova_dene(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return '00000';
exception when others then
  perform set_config('prova.son_hata', sqlerrm, false);
  return sqlstate;
end; $$;

create or replace function prova_son_hata() returns text
language sql as $$ select coalesce(current_setting('prova.son_hata', true), '') $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid;
  v_urun uuid := gen_random_uuid(); v_mus uuid := gen_random_uuid();
  v_nokta uuid := gen_random_uuid(); v_pauth uuid := gen_random_uuid();
  v_rol text; v_auth uuid; v_app uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);

  foreach v_rol in array array['izleyici','kalite_sorumlusu','isletme_sahibi'] loop
    v_auth := gen_random_uuid(); v_app := gen_random_uuid();
    insert into auth.users (id, email) values (v_auth, 'p90.'||v_rol||'@o.local');
    insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                                 username_key, full_name, role_code, is_active)
    values (v_app, v_t, v_f, v_auth, 'p90'||left(md5(v_rol),6),
            'p90'||left(md5(v_rol),6), v_rol, v_rol, true);
    perform set_config('prova.auth.'||v_rol, v_auth::text, false);
    perform set_config('prova.app.'||v_rol,  v_app::text,  false);
  end loop;

  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_urun, v_t, v_b, 'P90-URN', 'p90-urn', 'Prova Ürünü', 'kg');
  insert into public.customer (id, tenant_id, code, code_key, name)
  values (v_mus, v_t, 'P90-MUS', 'p90-mus', 'Portal Müşterisi');
  insert into public.delivery_point (id, tenant_id, customer_id, code, code_key, name)
  values (v_nokta, v_t, v_mus, 'P90-NKT', 'p90-nkt', 'Portal Noktası');
  insert into public.customer_price (tenant_id, customer_id, stock_item_id, unit_price, uom_code)
  values (v_t, v_mus, v_urun, 50, 'kg');

  insert into auth.users (id, email) values (v_pauth, 'p90.portal@musteri.local');
  insert into public.portal_user (tenant_id, customer_id, email)
  values (v_t, v_mus, 'p90.portal@musteri.local');

  perform set_config('prova.urun',  v_urun::text,  false);
  perform set_config('prova.nokta', v_nokta::text, false);
  perform set_config('prova.pauth', v_pauth::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

grant execute on function prova_bak(text,boolean), prova_ic_oturum(uuid),
  prova_portal_oturum(uuid,text), prova_dene(text), prova_son_hata()
  to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

-- ── 1 · MIYOP-044 · ÜÇ İÇ YARDIMCI SQL'DEN ULAŞILAMAZ ────────────────────
select prova_ic_oturum(current_setting('prova.auth.isletme_sahibi')::uuid);

do $$
declare v_kod text;
begin
  raise notice '── 1 · MIYOP-044 (ic yardimcilarin PUBLIC hakki)';

  v_kod := prova_dene('select app.lisansi_uzat('
    || quote_literal(current_setting('prova.t')) || '::uuid, '
    || 'current_date + 30, 1, ''kacak'', false)');
  perform prova_bak('app.lisansi_uzat SQL''den cagrilamiyor (gelen: '||v_kod||')',
    v_kod = '42501');

  v_kod := prova_dene('select app.basvuruyu_onayla('
    || quote_literal(gen_random_uuid()::text) || '::uuid, ''kacak'')');
  perform prova_bak('app.basvuruyu_onayla SQL''den cagrilamiyor (gelen: '||v_kod||')',
    v_kod = '42501');

  v_kod := prova_dene('select app.lisans_olayi_yaz('
    || quote_literal(current_setting('prova.t')) || '::uuid, '
    || quote_literal(gen_random_uuid()::text) || '::uuid, ''KACAK'', null, null, null)');
  perform prova_bak('app.lisans_olayi_yaz SQL''den cagrilamiyor (gelen: '||v_kod||')',
    v_kod = '42501');

  -- Dış kabuklar DURUYOR: kapatma, meşru yolu kesmemeli
  perform prova_bak('public.lisansi_uzat hala cagrilabilir',
    has_function_privilege('authenticated',
      (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'lisansi_uzat' limit 1), 'execute'));
  perform prova_bak('public.basvuruyu_onayla hala cagrilabilir',
    has_function_privilege('authenticated',
      (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = 'basvuruyu_onayla' limit 1), 'execute'));
end $$;

-- ── 2 · PORTAL · KİRACISIZ OTURUMLA, İKİ RPC DE ──────────────────────────
select prova_portal_oturum(current_setting('prova.pauth')::uuid,
                           'p90.portal@musteri.local');

do $$
declare v_no text; v_kod text;
begin
  raise notice '── 2 · PORTAL (kiraci claim''i YOK — gercek hali)';
  perform prova_bak('portal oturumunda tenant_id claim''i YOK',
    coalesce(current_setting('request.jwt.claims', true)::json ->> 'tenant_id', '') = '');
  perform prova_bak('portal oturumunda bakim baglami KAPALI',
    app.bakim_baglami() = false);

  begin
    v_no := public.portal_siparis_ver(
      current_setting('prova.nokta')::uuid,
      jsonb_build_array(jsonb_build_object(
        'kalem_id', current_setting('prova.urun'), 'miktar', 4, 'birim', 'kg')));
    v_kod := '00000';
  exception when others then
    v_kod := sqlstate; perform set_config('prova.son_hata', sqlerrm, false);
  end;
  perform prova_bak('portaldan siparis VERILEBILIYOR (gelen: '||v_kod||
    case when v_kod = '00000' then '' else ' — '||prova_son_hata() end||')',
    v_kod = '00000');
  perform set_config('prova.no', coalesce(v_no, ''), false);

  -- ⚠️ 0089 provasinin KAPSAMADIGI yol (Codex): guncelleme RPC'si
  begin
    perform public.portal_siparis_guncelle(
      v_no,
      jsonb_build_array(jsonb_build_object(
        'kalem_id', current_setting('prova.urun'), 'miktar', 9, 'birim', 'kg')),
      'Miktar artti');
    v_kod := '00000';
  exception when others then
    v_kod := sqlstate; perform set_config('prova.son_hata', sqlerrm, false);
  end;
  perform prova_bak('portaldan siparis GUNCELLENEBILIYOR (gelen: '||v_kod||
    case when v_kod = '00000' then '' else ' — '||prova_son_hata() end||')',
    v_kod = '00000');

  -- Kapı hâlâ yerinde: RPC dışından yazamaz
  perform prova_bak('portal kullanicisi sales_order''a DOGRUDAN yazamiyor',
    prova_dene(format(
      'insert into public.sales_order (tenant_id, branch_id, order_no, customer_id)
       values (%L, %L, ''P90-KACAK'', (select id from public.customer where code = ''P90-MUS''))',
      current_setting('prova.t'), current_setting('prova.b'))) in ('MI403','42501'));
end $$;

-- ── 3 · DARALTMA MEŞRU AKIŞLARI KIRMADI ──────────────────────────────────
select prova_ic_oturum(current_setting('prova.auth.kalite_sorumlusu')::uuid);

do $$
declare v_kod text;
begin
  raise notice '── 3 · DARALTMA SONRASI MESRU AKISLAR';

  -- `alerjen_beyani_yaz` definer''dir ve stok karti kapisi ARTIK DAR.
  -- Yine de calismali: kapi `quality.declaration`i kabul ediyor (0086).
  v_kod := prova_dene('select public.alerjen_beyani_yaz('
    || quote_literal(current_setting('prova.urun')) || '::uuid, ''[]''::jsonb)');
  perform prova_bak('kalite rolu alerjen beyanini yazabiliyor (gelen: '||v_kod||
    case when v_kod = '00000' then '' else ' — '||prova_son_hata() end||')',
    v_kod = '00000');

  -- Ambalaj beyanı da (0081'in ayrı kapısı, o da daraltıldı)
  v_kod := prova_dene(format(
    'update public.stock_item set net_qty = 750, net_uom = ''g'', updated_at = now()
      where id = %L', current_setting('prova.urun')));
  perform prova_bak('kalite rolu ambalaj beyanini yazabiliyor (gelen: '||v_kod||')',
    v_kod = '00000');
end $$;

-- ── 4 · DARALTMANIN GERİ GETİRDİĞİ KORUMALAR ─────────────────────────────
select prova_ic_oturum(current_setting('prova.auth.izleyici')::uuid);

do $$
declare v_kod text;
begin
  raise notice '── 4 · IZLEYICI HALA DISARIDA';
  perform prova_bak('izleyici stok karti acamiyor',
    prova_dene(format(
      'insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
       values (%L, %L, ''P90-IZL'', ''p90-izl'', ''Kaçak'', ''kg'')',
      current_setting('prova.t'), current_setting('prova.b'))) in ('MI403','42501'));
  perform prova_bak('izleyici alerjen damgasi atamiyor',
    prova_dene(format(
      'update public.stock_item set allergen_reviewed_at = now() where id = %L',
      current_setting('prova.urun'))) in ('MI403','MI436','42501'));
  perform prova_bak('izleyici recete yazamiyor',
    prova_dene(format(
      'insert into public.recipe (tenant_id, code, code_key, name, output_item_id,
                                  output_uom, output_qty)
       values (%L, ''P90-R'', ''p90-r'', ''Kaçak'', %L, ''kg'', 1)',
      current_setting('prova.t'), current_setting('prova.urun'))) in ('MI403','42501'));
end $$;

reset role;

-- ── 5 · ENVANTER ─────────────────────────────────────────────────────────
do $$
declare v_ad text; v_say int;
begin
  raise notice '── 5 · ENVANTER';
  perform set_config('request.jwt.claims', '{}', false);
  perform set_config('request.jwt.claim.sub', '', false);

  -- Dokuz kapı DAR
  v_say := 0;
  foreach v_ad in array array[
    'app.izin_gerek()', 'app.stok_hareketi_izni()', 'app.stok_karti_izni()',
    'app.lot_izni()', 'app.kullanici_satiri_izni()', 'app.onay_karari_izni()',
    'app.ambalaj_beyani_izni()', 'app.haccp_olcum_izni()', 'app.haccp_faaliyet_izni()'
  ] loop
    if position('app.kapi_disi_baglam()'
                in pg_get_functiondef(to_regprocedure(v_ad))) = 0 then
      v_say := v_say + 1;
    end if;
  end loop;
  perform prova_bak('dokuz kapi DAR (sayilan: '||v_say||'/9)', v_say = 9);

  perform prova_bak('`izin_gerek_coklu` GEVSEK kaldi (038/039 onun uzerinden onarildi)',
    position('app.kapi_disi_baglam()'
             in pg_get_functiondef(to_regprocedure('app.izin_gerek_coklu()'))) > 0);

  perform prova_bak('MIYOP-035 kontrolu stok karti kapisinda duruyor',
    position('MI436' in pg_get_functiondef(to_regprocedure('app.stok_karti_izni()'))) > 0);
  perform prova_bak('onay imzasi sunucuda duruyor',
    position('new.decided_by := v_ben'
             in pg_get_functiondef(to_regprocedure('app.onay_karari_izni()'))) > 0);

  -- Gevşek kapının ardındaki yüzey küçüldü
  select count(*) into v_say from (
    select distinct p.oid from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     join (select distinct c.relname from pg_trigger t join pg_class c on c.oid = t.tgrelid
            where not t.tgisinternal
              and t.tgfoid = to_regprocedure('app.izin_gerek_coklu()')) k
       on p.prosrc ~* ('(insert into|update|delete from)[[:space:]]+(public\.)?'
                       || k.relname || '[[:space:](]')
     where p.prosecdef and n.nspname in ('app','public')) s;
  perform prova_bak('gevsek kapinin ardinda 6 rutin kaldi (0089''da 11 idi; sayilan: '
    ||v_say||')', v_say = 6);
end $$;

rollback;
