\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

-- ── 1 · YAPI ──────────────────────────────────────────────────────────────
select prova_bak('_ham fonksiyonları TEK kopya',
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app' and p.proname in ('isletme_gostergeleri_ham','fire_dokumu_ham')) = 2);

select prova_bak('kapılar plpgsql (üç çalıştırmadan sonra bile)',
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     join pg_language l on l.oid=p.prolang
    where n.nspname='app' and p.proname in ('isletme_gostergeleri','fire_dokumu')
      and l.lanname='plpgsql') = 2);

select prova_bak('kapılar security INVOKER (definer kiracı duvarını delerdi)',
  not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app' and p.proname in ('isletme_gostergeleri','fire_dokumu')
      and p.prosecdef));

select prova_bak('ham hesaplar sql/plpgsql gövdesini koruyor (kapıya dönüşmemiş)',
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app' and p.proname like '%_ham'
      and pg_get_functiondef(p.oid) not like '%yetkim_var%') = 2);

-- ── 2 · DAVRANIŞ ──────────────────────────────────────────────────────────
-- Kiracı + iki kullanıcı: biri finance.read'li (isletme_sahibi), biri değil.
do $$
declare v_tenant uuid; v_auth_yetkili uuid := gen_random_uuid();
        v_auth_yetkisiz uuid := gen_random_uuid();
begin
  select id into v_tenant from public.tenant limit 1;
  if v_tenant is null then raise exception 'prova: kiracı yok'; end if;

  insert into public.app_user (id, tenant_id, auth_user_id, username, username_key,
                               full_name, role_code, is_active)
  values (gen_random_uuid(), v_tenant, v_auth_yetkili,  'prova_patron', 'prova_patron',
          'Patron', 'isletme_sahibi', true),
         (gen_random_uuid(), v_tenant, v_auth_yetkisiz, 'prova_depocu', 'prova_depocu',
          'Depocu', 'depo_sorumlusu', true);

  perform set_config('prova.yetkili',  v_auth_yetkili::text,  false);
  perform set_config('prova.yetkisiz', v_auth_yetkisiz::text, false);
end; $$;

-- ⚠️ Yerel taklit `request.jwt.claim.sub` (tekil, noktalı) okuyor; Supabase
-- `request.jwt.claims` (çoğul, JSON). İKİSİ de kuruluyor (tuzak 53).
do $$
declare v_sub text := current_setting('prova.yetkisiz');
begin
  perform set_config('request.jwt.claim.sub', v_sub, false);
  perform set_config('request.jwt.claims', json_build_object('sub', v_sub)::text, false);
end; $$;

do $$
declare v_hata text;
begin
  begin
    perform * from app.isletme_gostergeleri(null, current_date - 7, current_date);
    raise exception 'KAPI GEÇİLDİ — yetkisiz kullanıcı göstergeleri okudu';
  exception when sqlstate 'MI403' then
    v_hata := 'ok';
  end;
  perform prova_bak('finance.read''siz kullanıcı göstergelerde MI403 alıyor', v_hata = 'ok');
end; $$;

do $$
declare v_hata text;
begin
  begin
    perform * from app.fire_dokumu(null, current_date - 7, current_date);
    raise exception 'KAPI GEÇİLDİ — yetkisiz kullanıcı fire dökümünü okudu';
  exception when sqlstate 'MI403' then
    v_hata := 'ok';
  end;
  perform prova_bak('finance.read''siz kullanıcı fire dökümünde MI403 alıyor', v_hata = 'ok');
end; $$;

do $$
declare v_sub text := current_setting('prova.yetkili');
begin
  perform set_config('request.jwt.claim.sub', v_sub, false);
  perform set_config('request.jwt.claims', json_build_object('sub', v_sub)::text, false);
end; $$;

do $$
declare v_say int;
begin
  select count(*) into v_say
    from app.isletme_gostergeleri(null, current_date - 7, current_date);
  perform prova_bak('finance.read''li kullanıcı göstergeleri okuyor', v_say > 0);
end; $$;

do $$
declare v_say int;
begin
  -- Fire dökümü boş dönebilir; önemli olan MI403 ALMAMASI.
  select count(*) into v_say
    from app.fire_dokumu(null, current_date - 7, current_date);
  perform prova_bak('finance.read''li kullanıcı fire dökümünü okuyor (satır: ' || v_say || ')', true);
end; $$;

rollback;
