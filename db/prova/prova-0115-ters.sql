\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- TERS PROVA 0115 · KUSUR GERÇEK MİYDİ
--
-- Düz prova "üç sekme reddediliyor" diyor. Bu dosya 0115'in kısıtlarını
-- 0111'deki ESKİ hâline (`btrim`) geri çeviriyor ve Codex'in iki örneğinin
-- GERÇEKTEN geçtiğini gösteriyor. Sonunda `rollback` — hiçbiri kalmıyor.
--
-- ⚠️ Bu dosyanın yeşil yanması, 0111'den sonra söylediğim "MIYOP-105
-- kapandı" cümlesinin YANLIŞ olduğunun kanıtıdır.
--
-- ⚠️ SAHNE DE KAPININ İÇİNDE (tuzak 197): numuneyi ve olayı yazan,
-- `authenticated` rolündeki kalite sorumlusu.
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
declare v_t uuid; v_f uuid; v_b uuid; v_auth uuid; v_kalem uuid; v_lot uuid; v_i int;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);

  v_auth := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p115.kalite@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (gen_random_uuid(), v_t, v_f, v_auth, 'p115kal', 'p115kal',
          'Prova 115 Kalite', 'kalite_sorumlusu', true);
  perform set_config('prova.auth', v_auth::text, false);

  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition, opened_shelf_life_days)
  values (v_kalem, v_t, v_b, 'P115-URN', 'p115-urn', 'Prova 115 Urun', 'kg',
          true, true, true, '-18 °C', 5);

  -- ⚠️ Her başarılı numune KENDİ partisinde: "aynı partide ikinci açık
  -- numune olamaz" kuralı (0093) tek parti kullanılırsa reddi YANLIŞ
  -- sebebe bağlardı.
  for v_i in 1..6 loop
    v_lot := gen_random_uuid();
    insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                  lot_code_key, expires_on, origin_type)
    values (v_lot, v_t, v_b, v_kalem, 'P115-LOT'||v_i, 'p115-lot'||v_i,
            current_date + 60, 'PRODUCTION');
    perform set_config('prova.lot'||v_i, v_lot::text, false);
  end loop;
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid) to authenticated;
grant usage on schema public to authenticated;
set local role authenticated;

-- ── SAHNE ─────────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_n uuid; v_kod text;
begin
  perform prova_oturum(current_setting('prova.auth')::uuid, v_t);
  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, v_b, current_setting('prova.lot1')::uuid, 'P115T-N1', 'x', now())
  returning id into v_n;
  perform set_config('prova.n1', v_n::text, false);

  -- ÖNCE · kural yerindeyken
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
    values (v_t, v_n, 'ACILDI', E'\t\t\t', E'\n\n\n');
    v_kod := '00000';
  exception when check_violation then v_kod := 'KISIT';
  end;
  perform prova_bak('kural yerindeyken üç sekme + üç satır sonu REDDEDİLİYOR ('||v_kod||')',
    v_kod = 'KISIT');
end $$;

reset role;

-- ── KURAL GERİ ÇEVRİLİYOR · 0111'in `btrim` kısıtları ────────────────────
alter table public.witness_sample_event
  drop constraint witness_sample_event_reason_required;
alter table public.witness_sample_event
  add constraint witness_sample_event_reason_required check (
    event_type = 'ALINDI'
    or length(btrim(coalesce(reason, ''))) >= 3
  );
alter table public.witness_sample_event
  drop constraint witness_sample_event_result_required;
alter table public.witness_sample_event
  add constraint witness_sample_event_result_required check (
    event_type <> 'ACILDI'
    or length(btrim(coalesce(result, ''))) >= 3
  );

set local role authenticated;

-- ── SONRA · ESKİ KISITLA ─────────────────────────────────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_olay bigint;
begin
  perform prova_oturum(current_setting('prova.auth')::uuid, v_t);
  -- ⚠️ BU SATIRIN YEŞİL YANMASI, KUSURUN GERÇEK OLDUĞUNUN KANITIDIR.
  -- 0111 uygulanmışken, gerekçesi üç sekme ve sonucu üç satır sonu olan
  -- bir açılış kaydı deftere GİRİYORDU — ve olay defteri değişmez olduğu
  -- için bir daha düzeltilemezdi.
  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
  values (v_t, current_setting('prova.n1')::uuid, 'ACILDI', E'\t\t\t', E'\n\n\n')
  returning id into v_olay;
  perform prova_bak('⚠️ ESKİ KISITLA üç sekme gerekçe + üç satır sonu sonuç DEFTERE GİRDİ — '
    ||'kusur gerçekti', v_olay is not null);
end $$;

reset role;
do $$ begin raise notice '──── 0115 ters provası: TAMAM'; end $$;
rollback;
