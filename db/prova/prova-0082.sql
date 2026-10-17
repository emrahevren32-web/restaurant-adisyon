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
  perform set_config('request.jwt.claim.sub', p_auth::text, false);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_auth, 'tenant_id', p_tenant)::text, false);
  perform set_config('app.tenant_id', p_tenant::text, false);
end; $$;

create or replace function prova_oturumsuz() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{}', false);
end; $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_b uuid; v_ccp uuid;
  v_kalite uuid := gen_random_uuid();
  v_uretim uuid := gen_random_uuid();
  v_kalem  uuid := gen_random_uuid();
begin
  perform prova_oturumsuz();
  select t.id into v_t from public.tenant t limit 1;
  select b.id into v_b from public.branch b where b.tenant_id = v_t limit 1;
  select c.id into v_ccp from public.haccp_ccp c
    join public.haccp_plan pl on pl.id = c.plan_id
   where pl.tenant_id = v_t order by c.code limit 1;

  insert into public.app_user (id, tenant_id, auth_user_id, username, username_key,
                               full_name, role_code, is_active)
  values (gen_random_uuid(), v_t, v_kalite, 'p82_kalite', 'p82_kalite',
          'Kalite Sorumlusu', 'kalite_sorumlusu', true),
         (gen_random_uuid(), v_t, v_uretim, 'p82_uretim', 'p82_uretim',
          'Üretim Sorumlusu', 'uretim_sorumlusu', true);

  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_kalem, v_t, v_b, 'P82-KLM', 'p82-klm', 'Prova Kalemi', 'kg');

  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);
  perform set_config('prova.ccp', v_ccp::text, false);
  perform set_config('prova.kalite', v_kalite::text, false);
  perform set_config('prova.uretim', v_uretim::text, false);
  raise notice 'KURULUM TAMAM';
end; $$;

-- Yardımcı: üretim sorumlusu adına FAIL ölçüm + açık faaliyet üretir
create or replace function prova_faaliyet_ac(p_deger numeric) returns uuid
language plpgsql as $$
declare v_o uuid := gen_random_uuid(); v_f uuid := gen_random_uuid();
begin
  perform prova_oturum(current_setting('prova.uretim')::uuid,
                       current_setting('prova.t')::uuid);
  insert into public.haccp_measurement
    (id, tenant_id, branch_id, ccp_id, measured_value, uom, result,
     limit_snapshot, source_type)
  values (v_o, current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          current_setting('prova.ccp')::uuid, p_deger, '°C', 'FAIL',
          'en çok 4 °C', 'manual');
  insert into public.haccp_corrective_action
    (id, tenant_id, measurement_id, description, assigned_role, status)
  values (v_f, current_setting('prova.t')::uuid, v_o,
          'Malı KABUL ETME. Tedarikçiye iade et.', 'Depo sorumlusu', 'OPEN');
  return v_f;
end $$;


-- ═══ DELİK 1 · `OPEN → CANCELLED` ════════════════════════════════════════
do $$
declare v_f uuid; v_kod text := '';
begin
  v_f := prova_faaliyet_ac(9);
  -- üretim sorumlusu (quality.write var, record.manage YOK)
  begin
    update public.haccp_corrective_action set status = 'CANCELLED' where id = v_f;
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('⚠️ DELİK 1 KAPANDI: üretim sorumlusu faaliyeti İPTAL EDEMİYOR',
                    v_kod = 'MI403');
  perform prova_bak('faaliyet hâlâ AÇIK',
    (select status = 'OPEN' from public.haccp_corrective_action where id = v_f));

  -- kalite sorumlusu iptal edebilir
  perform prova_oturum(current_setting('prova.kalite')::uuid,
                       current_setting('prova.t')::uuid);
  update public.haccp_corrective_action set status = 'CANCELLED' where id = v_f;
  perform prova_bak('kalite sorumlusu iptal edebiliyor',
    (select status = 'CANCELLED' from public.haccp_corrective_action where id = v_f));
end; $$;


-- ═══ DELİK 2 · KAPANMIŞ KAYDA SONRADAN DOKUNMA ═══════════════════════════
do $$
declare v_f uuid; v_kod text := ''; v_imza uuid; v_kalite_id uuid; v_uretim_id uuid;
begin
  select id into v_kalite_id from public.app_user
   where auth_user_id = current_setting('prova.kalite')::uuid;
  select id into v_uretim_id from public.app_user
   where auth_user_id = current_setting('prova.uretim')::uuid;

  v_f := prova_faaliyet_ac(10);

  -- kalite kapatıyor
  perform prova_oturum(current_setting('prova.kalite')::uuid,
                       current_setting('prova.t')::uuid);
  update public.haccp_corrective_action
     set status = 'COMPLETED', action_taken = 'İade edildi', completed_at = now()
   where id = v_f;
  select completed_by into v_imza from public.haccp_corrective_action where id = v_f;
  perform prova_bak('imza kapanışta kalite sorumlusunu gösteriyor', v_imza = v_kalite_id);

  -- üretim sorumlusu kapanmış kaydın METNİNİ değiştiremez
  perform prova_oturum(current_setting('prova.uretim')::uuid,
                       current_setting('prova.t')::uuid);
  begin
    update public.haccp_corrective_action
       set action_taken = 'aslında bir şey yapmadık' where id = v_f;
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('⚠️ DELİK 2a KAPANDI: kapanmış kaydın METNİ değiştirilemiyor',
                    v_kod = 'MI403');

  -- ve İMZAYI SİLEMEZ
  v_kod := '';
  begin
    update public.haccp_corrective_action set completed_by = null where id = v_f;
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('⚠️ DELİK 2b KAPANDI: imza SİLİNEMİYOR', v_kod = 'MI403');
  perform prova_bak('imza yerinde duruyor',
    (select completed_by = v_kalite_id from public.haccp_corrective_action where id = v_f));

  -- kalite sorumlusu bile imzayı BAŞKASINA yazamıyor (istemci gönderse de)
  perform prova_oturum(current_setting('prova.kalite')::uuid,
                       current_setting('prova.t')::uuid);
  update public.haccp_corrective_action
     set action_taken = 'İade edildi, tutanak tutuldu', completed_by = v_uretim_id
   where id = v_f;
  perform prova_bak('⚠️ İMZA HER AN KORUNUYOR: kalite bile üstüne başkasını yazamıyor',
    (select completed_by = v_kalite_id from public.haccp_corrective_action where id = v_f));
end; $$;


-- ═══ DELİK 3 · `COMPLETED → OPEN` GERİ ALMA ══════════════════════════════
do $$
declare v_f uuid; v_kod text := '';
begin
  v_f := prova_faaliyet_ac(11);
  perform prova_oturum(current_setting('prova.kalite')::uuid,
                       current_setting('prova.t')::uuid);
  update public.haccp_corrective_action
     set status = 'COMPLETED', action_taken = 'kapatıldı', completed_at = now()
   where id = v_f;

  perform prova_oturum(current_setting('prova.uretim')::uuid,
                       current_setting('prova.t')::uuid);
  begin
    update public.haccp_corrective_action set status = 'OPEN' where id = v_f;
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('⚠️ DELİK 3 KAPANDI: kapanmış faaliyet YENİDEN AÇILAMIYOR',
                    v_kod = 'MI403');

  -- kalite yeniden açabilir
  perform prova_oturum(current_setting('prova.kalite')::uuid,
                       current_setting('prova.t')::uuid);
  update public.haccp_corrective_action set status = 'OPEN' where id = v_f;
  perform prova_bak('kalite sorumlusu yeniden açabiliyor',
    (select status = 'OPEN' from public.haccp_corrective_action where id = v_f));
end; $$;


-- ═══ DELİK 4 · ÖLÇÜM BAĞINI TAŞIMA ═══════════════════════════════════════
do $$
declare v_f uuid; v_o2 uuid := gen_random_uuid(); v_kod text := '';
begin
  v_f := prova_faaliyet_ac(12);
  -- boşta duran ikinci bir FAIL ölçüm
  perform prova_oturum(current_setting('prova.uretim')::uuid,
                       current_setting('prova.t')::uuid);
  insert into public.haccp_measurement
    (id, tenant_id, branch_id, ccp_id, measured_value, uom, result,
     limit_snapshot, source_type)
  values (v_o2, current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          current_setting('prova.ccp')::uuid, 13, '°C', 'FAIL', 'en çok 4 °C', 'manual');

  begin
    update public.haccp_corrective_action set measurement_id = v_o2 where id = v_f;
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('⚠️ DELİK 4 KAPANDI: ölçüm bağı TAŞINAMIYOR', v_kod = 'MI425');

  -- kalite sorumlusu BİLE taşıyamıyor (yetki değil, defter kuralı)
  v_kod := '';
  perform prova_oturum(current_setting('prova.kalite')::uuid,
                       current_setting('prova.t')::uuid);
  begin
    update public.haccp_corrective_action set measurement_id = v_o2 where id = v_f;
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('kalite sorumlusu BİLE ölçüm bağını taşıyamıyor', v_kod = 'MI425');
end; $$;


-- ═══ KAPI ATLAMA · doğrudan CANCELLED olarak INSERT ══════════════════════
do $$
declare v_o uuid := gen_random_uuid(); v_kod text := '';
begin
  perform prova_oturum(current_setting('prova.uretim')::uuid,
                       current_setting('prova.t')::uuid);
  insert into public.haccp_measurement
    (id, tenant_id, branch_id, ccp_id, measured_value, uom, result,
     limit_snapshot, source_type)
  values (v_o, current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          current_setting('prova.ccp')::uuid, 14, '°C', 'FAIL', 'en çok 4 °C', 'manual');
  begin
    insert into public.haccp_corrective_action
      (tenant_id, measurement_id, description, status)
    values (current_setting('prova.t')::uuid, v_o, 'Baştan iptal', 'CANCELLED');
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('doğrudan CANCELLED olarak da EKLENEMİYOR', v_kod = 'MI403');
end; $$;


-- ═══ NORMAL AKIŞ BOZULMADI ═══════════════════════════════════════════════
do $$
declare v_f uuid;
begin
  v_f := prova_faaliyet_ac(15);
  perform prova_bak('üretim sorumlusu FAIL ölçüm girip faaliyet AÇABİLİYOR', v_f is not null);
  -- açık faaliyeti ilerletebiliyor
  update public.haccp_corrective_action
     set status = 'IN_PROGRESS', action_taken = 'tedarikçi arandı' where id = v_f;
  perform prova_bak('açık faaliyeti İLERLETEBİLİYOR (OPEN→IN_PROGRESS)',
    (select status = 'IN_PROGRESS' from public.haccp_corrective_action where id = v_f));
  perform prova_bak('ilerletirken imza boş kalıyor',
    (select completed_by is null from public.haccp_corrective_action where id = v_f));
end; $$;


-- ═══ BAKIM BAĞLAMI · `anon` SERBEST DEĞİL ════════════════════════════════
do $$
begin
  perform prova_oturumsuz();
  perform prova_bak('postgres (göç rolü) bakım bağlamı sayılıyor', app.bakim_baglami());
end; $$;

-- ⚠️ Rol değiştirerek sınamak için fonksiyonu bu işlem içinde geçici olarak
-- açıyoruz; `rollback` ile geri alınıyor. 0082 `anon`dan bilerek geri aldı —
-- zaten o tablolara yazamıyor, ama mantığın kendisi burada sınanıyor.
grant execute on function app.bakim_baglami() to anon;

do $$
begin
  perform prova_oturumsuz();
  set local role anon;
  perform prova_bak('⚠️ anon BAKIM BAĞLAMI SAYILMIYOR (0082 düzeltmesi)',
                    not app.bakim_baglami());
  reset role;
end; $$;

do $$
begin
  perform prova_oturumsuz();
  set local role authenticated;
  perform prova_bak('oturumsuz `authenticated` de bakım sayılmıyor',
                    not app.bakim_baglami());
  reset role;
end; $$;

do $$
begin
  perform prova_oturumsuz();
  perform prova_bak('⚠️ ESKİ KURAL OLSAYDI anon da serbest olurdu — fark burada',
                    app.bakim_baglami() and not (current_user in ('anon','authenticated')));
end; $$;

-- ═══ GÖÇ GÜVENLİĞİ ═══════════════════════════════════════════════════════
do $$
declare v_f uuid := gen_random_uuid(); v_o uuid := gen_random_uuid();
begin
  perform prova_oturumsuz();
  insert into public.haccp_measurement
    (id, tenant_id, branch_id, ccp_id, measured_value, uom, result,
     limit_snapshot, source_type)
  values (v_o, current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          current_setting('prova.ccp')::uuid, 16, '°C', 'FAIL', 'en çok 4 °C', 'manual');
  insert into public.haccp_corrective_action
    (id, tenant_id, measurement_id, description, status, action_taken, completed_at)
  values (v_f, current_setting('prova.t')::uuid, v_o, 'Göç kaydı', 'COMPLETED',
          'geçmiş veriden taşındı', now());
  perform prova_bak('⚠️ GÖÇ GÜVENLİ: oturumsuz bakım bağlamında kapılar serbest',
    (select status = 'COMPLETED' from public.haccp_corrective_action where id = v_f));
end; $$;

rollback;
