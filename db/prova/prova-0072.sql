\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t1 uuid; v_t2 uuid;
  v_auth uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_kalem uuid := gen_random_uuid();
  v_yabanci uuid := gen_random_uuid();
  v_birim text;
  v_sirket uuid := gen_random_uuid();
  v_sube2  uuid := gen_random_uuid();
begin
  select id into v_t1 from public.tenant limit 1;
  if v_t1 is null then raise exception 'prova: kiracı yok'; end if;

  insert into public.tenant (id, code, name)
  values (gen_random_uuid(), 'PRV2', 'Prova İkinci İşletme')
  returning id into v_t2;

  insert into public.company (id, tenant_id, company_code, company_name)
  values (v_sirket, v_t2, 'PRV2-SRK', 'Prova İkinci A.Ş.');
  insert into public.branch (id, tenant_id, company_id, code, name)
  values (v_sube2, v_t2, v_sirket, 'PRV2-MRK', 'Prova İkinci Merkez');

  insert into public.app_user (id, tenant_id, auth_user_id, username, username_key,
                               full_name, role_code, is_active)
  values (v_user, v_t1, v_auth, 'prova_kalite', 'prova_kalite',
          'Kalite Sorumlusu', 'isletme_sahibi', true);

  select si.base_uom into v_birim from public.stock_item si limit 1;
  if v_birim is null then v_birim := 'kg'; end if;

  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  select v_kalem, v_t1, b.id, 'PRV-CORBA', 'prv-corba', 'Mercimek Çorbası', v_birim
    from public.branch b where b.tenant_id = v_t1 limit 1;
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  select v_yabanci, v_t2, b.id, 'PRV-YBN', 'prv-ybn', 'Başka İşletmenin Kalemi', v_birim
    from public.branch b where b.tenant_id = v_t2 limit 1;

  perform set_config('prova.tenant', v_t1::text, false);
  perform set_config('prova.kalem',  v_kalem::text, false);
  perform set_config('prova.yabanci', v_yabanci::text, false);
  perform set_config('prova.auth',   v_auth::text, false);

  -- ⚠️ Yerel taklit `request.jwt.claim.sub` (tekil) okuyor, Supabase
  -- `request.jwt.claims` (JSON). İKİSİ de kuruluyor (tuzak 53).
  perform set_config('request.jwt.claim.sub', v_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_auth, 'tenant_id', v_t1)::text, false);
  perform set_config('app.tenant_id', v_t1::text, false);
end; $$;

-- ── 1 · MUTLU YOL: SATIRLAR VE DAMGA BİRLİKTE YAZILIYOR ───────────────────
do $$
declare v_damga timestamptz; v_say int; v_stok_damga timestamptz; v_kim uuid;
begin
  v_damga := public.alerjen_beyani_yaz(
    current_setting('prova.kalem')::uuid,
    '[{"kod":"GLUTEN","tur":"İÇERİR"},{"kod":"SUT","tur":"İÇERİR","not":"krema"}]'::jsonb);

  select count(*) into v_say from public.stock_item_allergen
   where stock_item_id = current_setting('prova.kalem')::uuid;
  select allergen_reviewed_at, allergen_reviewed_by into v_stok_damga, v_kim
    from public.stock_item where id = current_setting('prova.kalem')::uuid;

  perform prova_bak('iki alerjen satırı yazıldı', v_say = 2);
  perform prova_bak('damga atıldı ve döndürülen değerle aynı', v_stok_damga = v_damga);
  perform prova_bak('damgayı atan kullanıcı kaydedildi', v_kim is not null);
end; $$;

-- ── 2 · CODEX SENARYOSU: YARIM YAZIM ARTIK İMKÂNSIZ ───────────────────────
-- Tanınmayan kod INSERT aşamasında patlıyor. Eski DELETE de geri alınmalı.
do $$
declare v_hata text := ''; v_say int; v_damga timestamptz;
begin
  select allergen_reviewed_at into v_damga
    from public.stock_item where id = current_setting('prova.kalem')::uuid;
  begin
    perform public.alerjen_beyani_yaz(
      current_setting('prova.kalem')::uuid,
      '[{"kod":"GLUTEN"},{"kod":"UYDURMA_KOD"}]'::jsonb);
    raise exception 'KAPI GEÇİLDİ — uydurma alerjen kodu kabul edildi';
  exception when sqlstate 'MI400' then v_hata := 'ok';
  end;

  select count(*) into v_say from public.stock_item_allergen
   where stock_item_id = current_setting('prova.kalem')::uuid;

  perform prova_bak('tanınmayan kod MI400 veriyor', v_hata = 'ok');
  -- ⚠️ ASIL SINAV BU: eski iki satır YERİNDE duruyor mu?
  perform prova_bak('düşen yazımda ESKİ SATIRLAR SİLİNMEDİ (yarım hal yok)', v_say = 2);
  perform prova_bak('düşen yazımda damga da değişmedi',
    (select allergen_reviewed_at from public.stock_item
      where id = current_setting('prova.kalem')::uuid) = v_damga);
end; $$;

-- ── 3 · BOŞ LİSTE GEÇERLİ BİR BEYANDIR ────────────────────────────────────
do $$
declare v_say int; v_damga timestamptz;
begin
  perform public.alerjen_beyani_yaz(current_setting('prova.kalem')::uuid, '[]'::jsonb);
  select count(*) into v_say from public.stock_item_allergen
   where stock_item_id = current_setting('prova.kalem')::uuid;
  select allergen_reviewed_at into v_damga
    from public.stock_item where id = current_setting('prova.kalem')::uuid;
  perform prova_bak('boş liste satırları temizledi', v_say = 0);
  perform prova_bak('boş liste de "incelendi" demektir — damga duruyor', v_damga is not null);
end; $$;

-- ── 4 · GİRDİ KAPILARI ────────────────────────────────────────────────────
do $$
declare v_h text := '';
begin
  begin
    perform public.alerjen_beyani_yaz(current_setting('prova.kalem')::uuid,
      '[{"kod":"GLUTEN"},{"kod":"GLUTEN","tur":"İZ"}]'::jsonb);
    raise exception 'KAPI GEÇİLDİ — aynı alerjen iki kez';
  exception when sqlstate 'MI409' then v_h := 'ok'; end;
  perform prova_bak('aynı alerjen iki kez → MI409', v_h = 'ok');
end; $$;

do $$
declare v_h text := '';
begin
  begin
    perform public.alerjen_beyani_yaz(current_setting('prova.kalem')::uuid,
      '[{"kod":"GLUTEN","tur":"BELKI"}]'::jsonb);
    raise exception 'KAPI GEÇİLDİ — uydurma tür';
  exception when sqlstate 'MI400' then v_h := 'ok'; end;
  perform prova_bak('uydurma tür → MI400', v_h = 'ok');
end; $$;

do $$
declare v_h text := '';
begin
  begin
    perform public.alerjen_beyani_yaz(gen_random_uuid(), '[]'::jsonb);
    raise exception 'KAPI GEÇİLDİ — olmayan kalem';
  exception when sqlstate 'MI404' then v_h := 'ok'; end;
  perform prova_bak('olmayan kalem → MI404', v_h = 'ok');
end; $$;

-- ── 5 · KİRACI DUVARI ─────────────────────────────────────────────────────
-- ⚠️ Fonksiyon `security definer`; RLS bizi KORUMUYOR. Duvar fonksiyonun
-- içinde. Bu test o duvarı sınıyor.
do $$
declare v_h text := ''; v_say int;
begin
  begin
    perform public.alerjen_beyani_yaz(current_setting('prova.yabanci')::uuid,
      '[{"kod":"GLUTEN"}]'::jsonb);
    raise exception 'KİRACI DUVARI DELİNDİ — başka işletmenin kalemine yazıldı';
  exception when sqlstate 'MI424' then v_h := 'ok'; end;
  select count(*) into v_say from public.stock_item_allergen
   where stock_item_id = current_setting('prova.yabanci')::uuid;
  perform prova_bak('başka işletmenin kalemi → MI424', v_h = 'ok');
  perform prova_bak('başka işletmenin kalemine satır YAZILMADI', v_say = 0);
end; $$;

-- ── 6 · DAMGA ELLE DEĞİŞTİRİLEMİYOR ───────────────────────────────────────
do $$
declare v_h text := '';
begin
  begin
    update public.stock_item set allergen_reviewed_at = now() - interval '30 days'
     where id = current_setting('prova.kalem')::uuid;
    raise exception 'KAPI GEÇİLDİ — damga elle değiştirildi';
  exception when sqlstate 'MI436' then v_h := 'ok'; end;
  perform prova_bak('damgayı elle değiştirme → MI436', v_h = 'ok');
end; $$;

do $$
begin
  -- Damgaya dokunmayan sıradan güncelleme ENGELLENMEMELİ.
  update public.stock_item set name = 'Mercimek Çorbası (2 kg)'
   where id = current_setting('prova.kalem')::uuid;
  perform prova_bak('damgaya dokunmayan güncelleme serbest', true);
end; $$;

-- ── 7 · DOĞRUDAN TABLO YAZIMI KAPALI ──────────────────────────────────────
do $$
begin
  perform prova_bak('authenticated artık INSERT edemiyor',
    not has_table_privilege('authenticated','public.stock_item_allergen','insert'));
  perform prova_bak('authenticated artık DELETE edemiyor',
    not has_table_privilege('authenticated','public.stock_item_allergen','delete'));
  perform prova_bak('authenticated hâlâ OKUYABİLİYOR (ekran listeyi görsün)',
    has_table_privilege('authenticated','public.stock_item_allergen','select'));
  perform prova_bak('fonksiyonu authenticated çağırabiliyor',
    has_function_privilege('authenticated','public.alerjen_beyani_yaz(uuid, jsonb)','execute'));
  perform prova_bak('anon fonksiyonu ÇAĞIRAMIYOR',
    not has_function_privilege('anon','public.alerjen_beyani_yaz(uuid, jsonb)','execute'));
end; $$;

rollback;
