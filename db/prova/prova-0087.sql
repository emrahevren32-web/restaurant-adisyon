\set ON_ERROR_STOP on
begin;

create or replace function prova_bak(p_ad text, p_kosul boolean) returns void
language plpgsql as $$
begin
  if p_kosul then raise notice '  ✓ %', p_ad;
  else raise exception '  ✗ %', p_ad; end if;
end; $$;

do $$
declare
  v_t uuid; v_f uuid; v_b uuid; v_sip uuid := gen_random_uuid();
  v_mudur uuid := gen_random_uuid(); v_personel uuid := gen_random_uuid();
  v_mudur_app uuid := gen_random_uuid(); v_pers_app uuid := gen_random_uuid();
  v_mus uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;

  insert into auth.users (id, email) values
    (v_mudur,'p87.mudur@o.local'), (v_personel,'p87.pers@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_mudur_app, v_t,v_f,v_mudur,   'p87md','p87md','Müdür',   'isletme_muduru', true),
         (v_pers_app,  v_t,v_f,v_personel,'p87pr','p87pr','Personel','personel',       true);

  select mc.id into v_mus from public.customer mc where mc.tenant_id = v_t limit 1;
  if v_mus is null then
    insert into public.customer (tenant_id, code, code_key, name)
    values (v_t, 'P87-MUS', 'p87-mus', 'Prova Müşterisi') returning id into v_mus;
  end if;

  insert into public.sales_order (id, tenant_id, branch_id, order_no, customer_id)
  values (v_sip, v_t, v_b, 'P87-SIP-1', v_mus);

  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.sip', v_sip::text, false);
  perform set_config('prova.mudur', v_mudur::text, false);
  perform set_config('prova.mudur_app', v_mudur_app::text, false);
  perform set_config('prova.personel', v_personel::text, false);
  raise notice 'KURULUM TAMAM';
end $$;

create or replace function prova_oturum(p_auth uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', current_setting('prova.t'))::text, false);
  perform set_config('app.tenant_id', current_setting('prova.t'), false);
end; $$;

create or replace function prova_onay(p_adim text, p_kim uuid default null,
                                      p_tarih timestamptz default null)
returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into public.order_approval
    (id, tenant_id, order_id, revision_no, step_code, decision, note,
     decided_by, decided_at)
  values (v_id, current_setting('prova.t')::uuid, current_setting('prova.sip')::uuid,
          1, p_adim, 'Olumlu', 'prova',
          p_kim, coalesce(p_tarih, now()));
  return v_id;
end; $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid),
  prova_onay(text, uuid, timestamptz) to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

-- ── 1 · PERSONEL MÜDÜR ADINA ONAY YAZAMAZ ─────────────────────────────────
select prova_oturum(current_setting('prova.personel')::uuid);

do $$
declare v_adim text;
begin
  raise notice '── 1 · PERSONEL (operations.approve YOK)';
  select s.code into v_adim from public.order_approval_step s
   where s.tenant_id = current_setting('prova.t')::uuid
     and s.permission_code = 'operations.approve' and s.required
   order by s.sort_order limit 1;
  perform prova_bak('zorunlu onay adimi bulundu: ' || coalesce(v_adim,'YOK'), v_adim is not null);
  perform set_config('prova.adim', v_adim, false);

  -- Kendi adına
  begin
    perform prova_onay(v_adim);
    perform prova_bak('personel onay yazamamali', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('personel KENDI adina onay yazamiyor', true);
  end;

  -- ⚠️ MÜDÜRÜN KİMLİĞİNİ YAZARAK
  begin
    perform prova_onay(v_adim, current_setting('prova.mudur_app')::uuid);
    perform prova_bak('personel MUDUR adina onay yazamamali', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('personel MUDURUN KIMLIGIYLE de yazamiyor (MIYOP-002)', true);
  end;

  -- Uydurma adım koduyla
  begin
    perform prova_onay('UYDURMA_ADIM');
    perform prova_bak('uydurma adim kabul edilmemeli', false);
  exception when sqlstate 'MI422' then
    perform prova_bak('uydurma adim koduyla onay yazilamiyor', true);
  end;

  -- Zorunlu adımı etkisizleştirme
  begin
    update public.order_approval_step set required = false
     where tenant_id = current_setting('prova.t')::uuid and code = v_adim;
    perform prova_bak('personel zorunlu adimi kapatamamali', false);
  exception when sqlstate 'MI403' then
    perform prova_bak('personel ZORUNLU ADIMI kapatamiyor', true);
  end;
end $$;

-- ── 2 · MÜDÜR ONAYLAYABİLİR, İMZA SUNUCUDAN ──────────────────────────────
select prova_oturum(current_setting('prova.mudur')::uuid);

do $$
declare v_id uuid; r record;
begin
  raise notice '── 2 · MÜDÜR (operations.approve VAR)';

  -- ⚠️ BİLEREK BAŞKASININ KİMLİĞİNİ VE GEÇMİŞ TARİHİ GÖNDERİYORUZ
  v_id := prova_onay(current_setting('prova.adim'),
                     (select id from public.app_user
                       where auth_user_id = current_setting('prova.personel')::uuid),
                     timestamptz '2020-01-01 00:00:00+00');
  perform prova_bak('mudur onay yazabiliyor', v_id is not null);

  select * into r from public.order_approval where id = v_id;
  perform prova_bak('SAHTE KIMLIK uzerine yazildi — imza gercek karar vereni gosteriyor',
    r.decided_by = current_setting('prova.mudur_app')::uuid);
  perform prova_bak('GECMISE TARIHLI onay kabul edilmedi',
    r.decided_at > timestamptz '2024-01-01');
end $$;

reset role;

-- ── 3 · ENVANTER ──────────────────────────────────────────────────────────
do $$
declare v_t text;
begin
  raise notice '── 3 · ENVANTER';
  perform set_config('request.jwt.claims', '{}', false);
  perform set_config('request.jwt.claim.sub', '', false);

  foreach v_t in array array[
    'izin_order_approval','izin_order_approval_step','order_approval_degismez'
  ] loop
    perform prova_bak(v_t || ' yerinde',
      exists (select 1 from pg_trigger t where t.tgname = v_t and not t.tgisinternal));
  end loop;

  perform prova_bak('zincirdeki her adimin izni katalogda',
    not exists (select 1 from public.order_approval_step s
                 left join public.permission p on p.code = s.permission_code
                where p.code is null));
  perform prova_bak('personel rolunde operations.approve YOK',
    not exists (select 1 from public.role_permission
                 where role_code = 'personel' and permission_code = 'operations.approve'));
end $$;

rollback;
