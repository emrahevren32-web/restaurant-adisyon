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
  -- ⚠️ Yerel taklit `request.jwt.claim.sub` (tekil), Supabase `request.jwt.claims`.
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', p_tenant)::text, false);
  perform set_config('app.tenant_id', p_tenant::text, false);
end; $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_birim text;
  v_gida uuid := gen_random_uuid(); v_depo uuid := gen_random_uuid();
  v_kalite uuid := gen_random_uuid();
  v_kalem uuid := gen_random_uuid();
begin
  select id into v_t from public.tenant limit 1;
  select si.base_uom into v_birim from public.stock_item si limit 1;
  if v_birim is null then v_birim := 'kg'; end if;

  insert into public.app_user (id, tenant_id, auth_user_id, username, username_key,
                               full_name, role_code, is_active)
  values (gen_random_uuid(), v_t, v_gida,   'prv_gida',   'prv_gida',
          'Gıda Mühendisi', 'gida_muhendisi',  true),
         (gen_random_uuid(), v_t, v_depo,   'prv_depo',   'prv_depo',
          'Depocu',         'depo_sorumlusu',  true),
         (gen_random_uuid(), v_t, v_kalite, 'prv_kalite', 'prv_kalite',
          'Kalite Sorumlusu','kalite_sorumlusu', true);

  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  select v_kalem, v_t, b.id, 'PRV-ETK', 'prv-etk', 'Mercimek Çorbası', v_birim
    from public.branch b where b.tenant_id = v_t limit 1;

  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.gida', v_gida::text, false);
  perform set_config('prova.depo', v_depo::text, false);
  perform set_config('prova.kalite', v_kalite::text, false);
  perform set_config('prova.kalem', v_kalem::text, false);
end; $$;

-- ── 1 · GIDA MÜHENDİSİ YAZABİLİYOR ────────────────────────────────────────
do $$
declare v_say int;
begin
  perform prova_oturum(current_setting('prova.gida')::uuid,
                       current_setting('prova.t')::uuid);
  perform public.alerjen_beyani_yaz(current_setting('prova.kalem')::uuid,
    '[{"kod":"GLUTEN","tur":"İÇERİR"},{"kod":"SUT","tur":"İZ"}]'::jsonb);
  select count(*) into v_say from public.stock_item_allergen
   where stock_item_id = current_setting('prova.kalem')::uuid;
  perform prova_bak('gıda mühendisi beyanı yazabiliyor', v_say = 2);
end; $$;

-- ── 2 · KALİTE SORUMLUSU YAZABİLİYOR ──────────────────────────────────────
do $$
begin
  perform prova_oturum(current_setting('prova.kalite')::uuid,
                       current_setting('prova.t')::uuid);
  perform public.alerjen_beyani_yaz(current_setting('prova.kalem')::uuid,
    '[{"kod":"GLUTEN","tur":"İÇERİR"}]'::jsonb);
  perform prova_bak('kalite sorumlusu beyanı yazabiliyor', true);
end; $$;

-- ── 3 · DEPOCU YAZAMIYOR ──────────────────────────────────────────────────
do $$
declare v_h text := ''; v_say int;
begin
  perform prova_oturum(current_setting('prova.depo')::uuid,
                       current_setting('prova.t')::uuid);
  begin
    perform public.alerjen_beyani_yaz(current_setting('prova.kalem')::uuid,
      '[{"kod":"SOYA","tur":"İÇERİR"}]'::jsonb);
    raise exception 'KAPI GEÇİLDİ — depocu etiket beyanı yazdı';
  exception when sqlstate 'MI403' then v_h := 'ok'; end;
  select count(*) into v_say from public.stock_item_allergen
   where stock_item_id = current_setting('prova.kalem')::uuid;
  perform prova_bak('depo sorumlusu MI403 alıyor', v_h = 'ok');
  -- ⚠️ ASIL SINAV: reddedilen çağrı eski beyanı BOZMADI mı?
  perform prova_bak('reddedilen çağrı eski beyanı bozmadı', v_say = 1);
end; $$;

-- ── 4 · HATA MESAJI NE GEREKTİĞİNİ SÖYLÜYOR ───────────────────────────────
do $$
declare v_mesaj text := '';
begin
  perform prova_oturum(current_setting('prova.depo')::uuid,
                       current_setting('prova.t')::uuid);
  begin
    perform public.alerjen_beyani_yaz(current_setting('prova.kalem')::uuid, '[]'::jsonb);
  exception when sqlstate 'MI403' then
    get stacked diagnostics v_mesaj = message_text;
  end;
  perform prova_bak('mesaj izin adını söylüyor', v_mesaj like '%quality.declaration%');
  perform prova_bak('mesaj hangi rollerde olduğunu söylüyor',
    v_mesaj like '%gıda mühendisi%' and v_mesaj like '%kalite sorumlusu%');
end; $$;

-- ── 5 · BESİN DEĞERİ DE AYNI KAPIDA ───────────────────────────────────────
do $$
declare v_h text := '';
begin
  perform prova_oturum(current_setting('prova.depo')::uuid,
                       current_setting('prova.t')::uuid);
  begin
    insert into public.stock_item_nutrition (tenant_id, stock_item_id, basis, source)
    values (current_setting('prova.t')::uuid, current_setting('prova.kalem')::uuid,
            '100g', 'Tedarikçi spesifikasyonu');
    raise exception 'KAPI GEÇİLDİ — depocu besin değeri yazdı';
  exception
    when sqlstate 'MI403' then v_h := 'ok';
    when undefined_column then v_h := 'sutun';
  end;
  perform prova_bak('depocu besin değeri YAZAMIYOR', v_h = 'ok');
end; $$;

do $$
declare v_say int;
begin
  perform prova_oturum(current_setting('prova.gida')::uuid,
                       current_setting('prova.t')::uuid);
  insert into public.stock_item_nutrition (tenant_id, stock_item_id, basis, source)
  values (current_setting('prova.t')::uuid, current_setting('prova.kalem')::uuid,
          '100g', 'Tedarikçi spesifikasyonu')
  on conflict do nothing;
  select count(*) into v_say from public.stock_item_nutrition
   where stock_item_id = current_setting('prova.kalem')::uuid;
  perform prova_bak('gıda mühendisi besin değeri yazabiliyor', v_say = 1);
end; $$;

-- ── 6 · KATALOG VE ROL AÇIKLAMALARI ───────────────────────────────────────
do $$
declare v_say int;
begin
  select count(*) into v_say from permission;
  perform prova_bak('izin kataloğu 34 izin (33 + quality.declaration)', v_say = 34);

  select count(*) into v_say from role where coalesce(btrim(description), '') = '';
  perform prova_bak('açıklaması boş rol yok', v_say = 0);

  select count(*) into v_say from role where length(description) < 40;
  perform prova_bak('her rol açıklaması en az 40 karakter (tek kelimelik yok)', v_say = 0);

  perform prova_bak('gıda mühendisi reçeteyi DEĞİŞTİREMİYOR',
    not exists (select 1 from role_permission
                 where role_code = 'gida_muhendisi' and permission_code = 'recipe.write'));
  perform prova_bak('gıda mühendisi üretime yazamıyor',
    not exists (select 1 from role_permission
                 where role_code = 'gida_muhendisi' and permission_code = 'production.write'));
  perform prova_bak('gıda mühendisi reçeteyi GÖRÜYOR (alerjen oradan türüyor)',
    exists (select 1 from role_permission
             where role_code = 'gida_muhendisi' and permission_code = 'recipe.read'));
end; $$;

rollback;
