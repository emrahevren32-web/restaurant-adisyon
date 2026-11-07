\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

create or replace function prova_oturum(p_auth uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', current_setting('prova.t'))::text, false);
  perform set_config('app.tenant_id', current_setting('prova.t'), false);
end; $$;

-- Tek tabloya deneme yazimi yapar; donen deger SQLSTATE ('00000' = gecti).
create or replace function prova_dene(p_tablo text) returns text
language plpgsql as $$
begin
  execute format('insert into public.%I default values', p_tablo);
  return '00000';
exception when others then
  return sqlstate;
end; $$;

-- ── KURULUM (bakim baglami: oturum yok, current_user = postgres) ──────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid; v_urun uuid := gen_random_uuid();
  v_rol text; v_auth uuid; v_app uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);

  -- Her rol icin bir kullanici
  foreach v_rol in array array[
    'izleyici','satinalma_sorumlusu','depo_sorumlusu','uretim_sorumlusu',
    'kalite_sorumlusu','isletme_muduru','sevkiyat_sorumlusu'
  ] loop
    v_auth := gen_random_uuid(); v_app := gen_random_uuid();
    insert into auth.users (id, email) values (v_auth, 'p88.'||v_rol||'@o.local');
    insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                                 username_key, full_name, role_code, is_active)
    values (v_app, v_t, v_f, v_auth, 'p88'||left(md5(v_rol),6), 'p88'||left(md5(v_rol),6),
            v_rol, v_rol, true);
    perform set_config('prova.auth.'||v_rol, v_auth::text, false);
    perform set_config('prova.app.'||v_rol,  v_app::text,  false);
  end loop;

  -- Akislarin dayandigi tek urun
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_urun, v_t, v_b, 'P88-URN', 'p88-urn', 'Prova Ürünü', 'kg');
  perform set_config('prova.urun', v_urun::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid), prova_dene(text)
  to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

-- ── 1 · İZLEYİCİ YİRMİ ALTI TABLONUN HİÇBİRİNE YAZAMAZ ───────────────────
select prova_oturum(current_setting('prova.auth.izleyici')::uuid);

do $$
declare v_tablo text; v_kod text; v_gecen text[] := '{}';
begin
  raise notice '── 1 · İZLEYİCİ (hiç .write izni yok)';
  foreach v_tablo in array array[
    'supplier','purchase_request','purchase_request_line','purchase_order',
    'purchase_order_line','goods_receipt','goods_receipt_line','supplier_return',
    'supplier_return_line','work_order','work_order_line','haccp_plan','haccp_ccp',
    'stock_count','stock_count_line','customer','delivery_point','customer_price',
    'sales_order','sales_order_revision','sales_order_line','order_discrepancy',
    'portal_user','portal_user_point','vehicle','driver','stock_item_nutrition'
  ] loop
    v_kod := prova_dene(v_tablo);
    if v_kod <> 'MI403' then
      v_gecen := v_gecen || (v_tablo || '=' || v_kod);
    end if;
  end loop;
  perform prova_bak('27 tablonun hepsi izleyiciyi MI403 ile geri cevirdi'
    || case when v_gecen = '{}' then '' else ' — KAPISIZ: ' || array_to_string(v_gecen, ', ') end,
    v_gecen = '{}');
end $$;

-- ── 2 · SATIN ALMA SORUMLUSU (yalnizca purchase.write) ───────────────────
select prova_oturum(current_setting('prova.auth.satinalma_sorumlusu')::uuid);

do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_urun uuid := current_setting('prova.urun')::uuid;
  v_ted uuid := gen_random_uuid(); v_tal uuid := gen_random_uuid();
  v_sip uuid := gen_random_uuid(); v_mk uuid := gen_random_uuid();
  v_mks uuid := gen_random_uuid(); v_iade uuid := gen_random_uuid();
begin
  raise notice '── 2 · SATIN ALMA SORUMLUSU';

  insert into public.supplier (id, tenant_id, code, code_key, name)
  values (v_ted, v_t, 'P88-TED', 'p88-ted', 'Prova Tedarikçi');
  perform prova_bak('tedarikci acabiliyor', true);

  insert into public.purchase_request (id, tenant_id, branch_id, request_no)
  values (v_tal, v_t, v_b, 'P88-TAL-1');
  insert into public.purchase_request_line (tenant_id, request_id, stock_item_id, qty, uom, line_no)
  values (v_t, v_tal, v_urun, 5, 'kg', 1);
  perform prova_bak('satin alma talebi + satiri yazabiliyor', true);

  insert into public.purchase_order (id, tenant_id, branch_id, order_no, supplier_id)
  values (v_sip, v_t, v_b, 'P88-SAS-1', v_ted);
  insert into public.purchase_order_line (tenant_id, order_id, stock_item_id, qty, uom, line_no)
  values (v_t, v_sip, v_urun, 5, 'kg', 1);
  perform prova_bak('siparis + satiri yazabiliyor', true);

  -- stock.write OLMADAN mal kabul (tuzak 88)
  insert into public.goods_receipt (id, tenant_id, branch_id, receipt_no, supplier_id)
  values (v_mk, v_t, v_b, 'P88-MK-1', v_ted);
  insert into public.goods_receipt_line (id, tenant_id, receipt_id, stock_item_id, uom,
                                         line_no, accepted_qty)
  values (v_mks, v_t, v_mk, v_urun, 'kg', 1, 5);
  perform prova_bak('stock.write OLMADAN mal kabul + satiri yazabiliyor (tuzak 88)', true);

  insert into public.supplier_return (id, tenant_id, branch_id, return_no, receipt_id,
                                      supplier_id, reason)
  values (v_iade, v_t, v_b, 'P88-IAD-1', v_mk, v_ted, 'Bozuk geldi');
  insert into public.supplier_return_line (tenant_id, return_id, receipt_line_id,
                                           stock_item_id, qty, uom, line_no)
  values (v_t, v_iade, v_mks, v_urun, 1, 'kg', 1);
  perform prova_bak('tedarikci iadesi + satiri yazabiliyor', true);

  perform set_config('prova.ted', v_ted::text, false);
  perform set_config('prova.mk', v_mk::text, false);

  -- Kendi alani DISINA tasamaz
  perform prova_bak('is emri acamiyor (production.write yok)',
    prova_dene('work_order') = 'MI403');
  perform prova_bak('sayim acamiyor (stock.write yok)',
    prova_dene('stock_count') = 'MI403');
  perform prova_bak('musteri acamiyor (operations.write yok)',
    prova_dene('customer') = 'MI403');
  perform prova_bak('arac ekleyemiyor (logistics.write yok)',
    prova_dene('vehicle') = 'MI403');
  perform prova_bak('haccp plani acamiyor (quality.record.manage yok)',
    prova_dene('haccp_plan') = 'MI403');
end $$;

-- ── 3 · DEPO SORUMLUSU (stock.write + logistics.write) ───────────────────
select prova_oturum(current_setting('prova.auth.depo_sorumlusu')::uuid);

do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_urun uuid := current_setting('prova.urun')::uuid;
  v_ted uuid := current_setting('prova.ted')::uuid;
  v_mk uuid := gen_random_uuid(); v_say uuid := gen_random_uuid();
begin
  raise notice '── 3 · DEPO SORUMLUSU';

  -- purchase.write OLMADAN mal kabul (tuzak 88, MIYOP-032'nin ikinci yuzu)
  insert into public.goods_receipt (id, tenant_id, branch_id, receipt_no, supplier_id)
  values (v_mk, v_t, v_b, 'P88-MK-2', v_ted);
  insert into public.goods_receipt_line (tenant_id, receipt_id, stock_item_id, uom,
                                         line_no, accepted_qty)
  values (v_t, v_mk, v_urun, 'kg', 1, 5);
  perform prova_bak('purchase.write OLMADAN mal kabul + satiri yazabiliyor (tuzak 88)', true);

  insert into public.stock_count (id, tenant_id, branch_id, count_no)
  values (v_say, v_t, v_b, 'P88-SAY-1');
  insert into public.stock_count_line (tenant_id, count_id, line_no, stock_item_id,
                                       expected_qty, uom)
  values (v_t, v_say, 1, v_urun, 10, 'kg');
  perform prova_bak('sayim + satiri yazabiliyor', true);

  insert into public.vehicle (tenant_id, plate, plate_key)
  values (v_t, '34 P88 01', '34p8801');
  insert into public.driver (tenant_id, full_name) values (v_t, 'Prova Şoför');
  perform prova_bak('arac + sofor yazabiliyor (logistics.write)', true);

  perform prova_bak('tedarikci acamiyor (purchase.write yok)',
    prova_dene('supplier') = 'MI403');
  perform prova_bak('satin alma siparisi acamiyor',
    prova_dene('purchase_order') = 'MI403');
  perform prova_bak('musteri acamiyor', prova_dene('customer') = 'MI403');
  perform prova_bak('haccp plani acamiyor', prova_dene('haccp_plan') = 'MI403');
end $$;

-- ── 4 · ÜRETİM SORUMLUSU (production.write + stock.write) ────────────────
select prova_oturum(current_setting('prova.auth.uretim_sorumlusu')::uuid);

do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_urun uuid := current_setting('prova.urun')::uuid;
  v_ie uuid := gen_random_uuid();
begin
  raise notice '── 4 · ÜRETİM SORUMLUSU';
  insert into public.work_order (id, tenant_id, branch_id, order_no, output_item_id,
                                 planned_qty, output_uom)
  values (v_ie, v_t, v_b, 'P88-IE-1', v_urun, 20, 'kg');
  insert into public.work_order_line (tenant_id, work_order_id, line_no, stock_item_id,
                                      planned_qty, uom)
  values (v_t, v_ie, 1, v_urun, 5, 'kg');
  perform prova_bak('is emri + satiri yazabiliyor', true);

  perform prova_bak('tedarikci acamiyor', prova_dene('supplier') = 'MI403');
  perform prova_bak('arac ekleyemiyor', prova_dene('vehicle') = 'MI403');
  perform prova_bak('musteri acamiyor', prova_dene('customer') = 'MI403');
end $$;

-- ── 5 · KALİTE SORUMLUSU (yalnizca quality.record.manage) ────────────────
select prova_oturum(current_setting('prova.auth.kalite_sorumlusu')::uuid);

do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_plan uuid := gen_random_uuid();
begin
  raise notice '── 5 · KALİTE SORUMLUSU';
  insert into public.haccp_plan (id, tenant_id, code, name)
  values (v_plan, v_t, 'P88-HP', 'Prova HACCP Planı');
  insert into public.haccp_ccp (tenant_id, plan_id, code, name, stage, limit_type, limit_max)
  values (v_t, v_plan, 'P88-CCP', 'Pişirme merkezi', 'COOKING', 'MAX', 85);
  perform prova_bak('haccp plani + ccp yazabiliyor', true);

  -- 27. tablo: besin degeri beyani kalite isi
  insert into public.stock_item_nutrition (tenant_id, stock_item_id, energy_kcal, protein)
  values (v_t, current_setting('prova.urun')::uuid, 120, 8.5);
  perform prova_bak('besin degeri beyanini yazabiliyor (quality.declaration)', true);

  perform prova_bak('stok sayimi acamiyor (stock.write yok)',
    prova_dene('stock_count') = 'MI403');
  perform prova_bak('tedarikci acamiyor', prova_dene('supplier') = 'MI403');
  perform prova_bak('is emri acamiyor', prova_dene('work_order') = 'MI403');
  perform prova_bak('musteri acamiyor', prova_dene('customer') = 'MI403');
end $$;

-- ── 6 · İŞLETME MÜDÜRÜ (operations.write) ────────────────────────────────
select prova_oturum(current_setting('prova.auth.isletme_muduru')::uuid);

do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_urun uuid := current_setting('prova.urun')::uuid;
  v_mus uuid := gen_random_uuid(); v_nokta uuid := gen_random_uuid();
  v_sip uuid := gen_random_uuid(); v_rev uuid := gen_random_uuid();
  v_pk uuid := gen_random_uuid();
begin
  raise notice '── 6 · İŞLETME MÜDÜRÜ';
  insert into public.customer (id, tenant_id, code, code_key, name)
  values (v_mus, v_t, 'P88-MUS', 'p88-mus', 'Prova Müşteri');
  insert into public.delivery_point (id, tenant_id, customer_id, code, code_key, name)
  values (v_nokta, v_t, v_mus, 'P88-NKT', 'p88-nkt', 'Prova Teslim Noktası');
  insert into public.customer_price (tenant_id, customer_id, stock_item_id, unit_price, uom_code)
  values (v_t, v_mus, v_urun, 42.5, 'kg');
  perform prova_bak('musteri + teslim noktasi + fiyat yazabiliyor', true);

  insert into public.sales_order (id, tenant_id, branch_id, order_no, customer_id)
  values (v_sip, v_t, v_b, 'P88-SSP-1', v_mus);
  insert into public.sales_order_revision (id, tenant_id, order_id, revision_no, source, reason, kind)
  values (v_rev, v_t, v_sip, 1, 'Telefon', 'İlk kayıt', 'MIKTAR');
  insert into public.sales_order_line (tenant_id, order_id, revision_id, line_no,
                                       stock_item_id, qty, uom_code)
  values (v_t, v_sip, v_rev, 1, v_urun, 3, 'kg');
  perform prova_bak('satis siparisi + revizyon + satiri yazabiliyor', true);

  insert into public.order_discrepancy (tenant_id, order_id, kind, noticed_step, noticed_by,
                                        description)
  values (v_t, v_sip, 'Eksik', 'Teslimde',
          current_setting('prova.app.isletme_muduru')::uuid, 'İki kasa eksik geldi');
  perform prova_bak('siparis tutarsizligi yazabiliyor', true);

  insert into public.portal_user (id, tenant_id, customer_id, email)
  values (v_pk, v_t, v_mus, 'p88.portal@o.local');
  insert into public.portal_user_point (portal_user_id, delivery_point_id, tenant_id)
  values (v_pk, v_nokta, v_t);
  perform prova_bak('portal kullanicisi + noktasi yazabiliyor', true);
end $$;

-- ── 7 · MIYOP-035 · SAHTE ALERJEN DAMGASI ───────────────────────────────
select prova_oturum(current_setting('prova.auth.depo_sorumlusu')::uuid);

do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_kod text;
begin
  raise notice '── 7 · MIYOP-035 (INSERT ile sahte alerjen damgasi)';

  begin
    insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom,
                                   allergen_reviewed_at)
    values (v_t, v_b, 'P88-SHT', 'p88-sht', 'Sahte damga', 'kg', now());
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('alerjen damgasiyla stok karti ACILAMIYOR (MI436, gelen: '||v_kod||')',
    v_kod = 'MI436');

  begin
    insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom,
                                   allergen_reviewed_by)
    values (v_t, v_b, 'P88-SHT2', 'p88-sht2', 'Sahte damga 2', 'kg',
            current_setting('prova.app.depo_sorumlusu')::uuid);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('damgalayan kisi yazilarak da ACILAMIYOR (gelen: '||v_kod||')',
    v_kod = 'MI436');

  insert into public.stock_item (tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_t, v_b, 'P88-DUZ', 'p88-duz', 'Düz stok kartı', 'kg');
  perform prova_bak('damgasiz normal stok karti ACILABILIYOR', true);
end $$;

reset role;

-- ── 8 · ENVANTER ─────────────────────────────────────────────────────────
do $$
declare v_adet int; v_ad text; v_kod text;
begin
  raise notice '── 8 · ENVANTER';
  perform set_config('request.jwt.claims', '{}', false);
  perform set_config('request.jwt.claim.sub', '', false);

  select count(*) into v_adet from pg_trigger t
   where not t.tgisinternal and t.tgfoid = to_regprocedure('app.izin_gerek_coklu()');
  -- !! 27 DEGIL 28: 0093 `witness_sample` tablosunu da ayni cokli kapinin
  -- arkasina aldi (sahit numune). Sayi BILEREK sabit tutuluyor - bir
  -- tablonun kapidan SESSIZCE cikmasi tam da burada yakalanacak sey.
  perform prova_bak('28 coklu kapi tetigi yerinde (0088''de 27 idi, 0093 witness_sample''i ekledi; sayilan: '
    ||v_adet||')', v_adet = 28);

  perform prova_bak('argumansiz kurulmus coklu kapi tetigi yok',
    not exists (select 1 from pg_trigger t
                 where not t.tgisinternal
                   and t.tgfoid = to_regprocedure('app.izin_gerek_coklu()')
                   and t.tgnargs = 0));

  perform prova_bak('esleme izinlerinin hepsi katalogda',
    not exists (
      select 1 from (select unnest(array['purchase.write','stock.write','production.write',
        'quality.record.manage','operations.write','logistics.write',
        'quality.declaration','products.write']) as k) x
       left join public.permission p on p.code = x.k where p.code is null));

  foreach v_ad in array array['app.izin_gerek_coklu()','app.stok_karti_izni()'] loop
    perform prova_bak(v_ad || ' uzerinde PUBLIC EXECUTE kapali',
      not exists (select 1 from pg_proc p,
        lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
         where p.oid = to_regprocedure(v_ad)
           and a.grantee = 0 and a.privilege_type = 'EXECUTE'));
  end loop;

  -- ⚠️ Kapi SAYMAK degil, KAPISIZ YUZEY olcmek (0085'in dersi)
  select count(*) into v_adet from (
    select distinct c.oid from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
     where n.nspname='public' and c.relkind='r'
       and a.grantee = 'authenticated'::regrole
       and a.privilege_type in ('INSERT','UPDATE','DELETE')) y
   where not exists (select 1 from pg_trigger t
                      where t.tgrelid = y.oid and not t.tgisinternal
                        and (t.tgname like 'izin\_%' or t.tgname like '%degismez%'));
  perform prova_bak('`authenticated` rolune acik ama KAPISIZ tablo yok (kalan: '||v_adet||')',
    v_adet = 0);

  perform prova_bak('izleyici rolunde hicbir .write izni yok',
    not exists (select 1 from public.role_permission
                 where role_code = 'izleyici' and permission_code like '%.write'));
end $$;

rollback;
