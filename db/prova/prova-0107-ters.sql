\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- TERS PROVA 0107 · KAPIYI KALDIRINCA PROVA GERÇEKTEN KIRMIZI VERİYOR MU
--
-- ⚠️ NEDEN VAR: `prova-0107.sql` yeşil yanıyor. Ama bir kapı provası,
-- kapı OLMASAYDI DA yeşil yanıyorsa hiçbir şey ölçmüyordur. Bu dosya
-- 0107'nin politikalarını geri alıp eski `for all` hâlini kuruyor ve
-- izinsiz kullanıcının numuneleri GERÇEKTEN okuyabildiğini gösteriyor.
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
declare
  v_t uuid; v_f uuid; v_b uuid; v_auth uuid; v_kalem uuid; v_lot uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);

  v_auth := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p107t.personel@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (gen_random_uuid(), v_t, v_f, v_auth, 'p107tper', 'p107tper',
          'Ters Personel', 'personel', true);
  perform set_config('prova.auth.personel', v_auth::text, false);

  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition)
  values (v_kalem, v_t, v_b, 'P107T-URN', 'p107t-urn', 'Ters Urun', 'kg',
          true, true, true, '-18 °C');
  v_lot := gen_random_uuid();
  insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                lot_code_key, expires_on, origin_type)
  values (v_lot, v_t, v_b, v_kalem, 'P107T-LOT', 'p107t-lot',
          current_date + 90, 'PRODUCTION');
  -- ⚠️ `numune_turet` tetigi oturumdan kiraci okuyor: oturumsuz yazim
  -- MI403 aliyor. Sahneyi kurarken de oturum aciliyor (yazma hakki
  -- `personel`in `production.write` izninden geliyor).
  perform prova_oturum(v_auth, v_t);
  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, v_b, v_lot, 'P107T-N1', 'p107t-n1', now());
end $$;

-- ── ÖNCE: KAPI YERİNDEYKEN GÖRMÜYOR ───────────────────────────────────────
grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid) to authenticated;
grant usage on schema public to authenticated;
set local role authenticated;

do $$
declare v_n int;
begin
  perform prova_oturum(current_setting('prova.auth.personel')::uuid,
                       current_setting('prova.t')::uuid);
  select count(*) into v_n from public.witness_sample;
  perform prova_bak('kapi yerindeyken izinsiz kullanici GORMUYOR (gorulen: '||v_n||')',
    v_n = 0);
end $$;

reset role;

-- ── KAPI KALDIRILIYOR: 0107 ÖNCESİNİN HÂLİ ───────────────────────────────
drop policy if exists witness_sample_okuma       on public.witness_sample;
drop policy if exists witness_sample_ekleme      on public.witness_sample;
drop policy if exists witness_sample_guncelleme  on public.witness_sample;
drop policy if exists witness_sample_silme       on public.witness_sample;
create policy witness_sample_tenant_isolation on public.witness_sample
  using      (tenant_id = app.current_tenant_id())
  with check (tenant_id = app.current_tenant_id());

set local role authenticated;

-- ── SONRA: KAPI YOKKEN GÖRÜYOR ───────────────────────────────────────────
do $$
declare v_n int;
begin
  perform prova_oturum(current_setting('prova.auth.personel')::uuid,
                       current_setting('prova.t')::uuid);
  select count(*) into v_n from public.witness_sample;
  -- ⚠️ BU SATIRIN YEŞİL YANMASI, KUSURUN GERÇEK OLDUĞUNUN KANITIDIR.
  -- 0107 öncesinde `personel` — ekranı hiç açamayan kullanıcı — bütün
  -- şahit numuneleri API'den okuyabiliyordu.
  perform prova_bak('⚠️ KAPI YOKKEN izinsiz kullanici GORUYOR — kusur gercekti '
    ||'(gorulen: '||v_n||')', v_n > 0);
end $$;

reset role;
rollback;
