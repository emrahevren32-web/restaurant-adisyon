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
  -- ⚠️ `claims` BOŞ METİN DEĞİL '{}' olmalı: bazı göç tetikleri bu ayarı
  -- doğrudan ::json'a çeviriyor ve boş metin sözdizimi hatası veriyor.
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{}', false);
end; $$;

-- ── KURULUM (oturumsuz — tetikler serbest) ────────────────────────────────
do $$
declare
  v_t uuid; v_b uuid; v_birim text;
  v_kalite uuid := gen_random_uuid();
  v_uretim uuid := gen_random_uuid();
  v_sevk   uuid := gen_random_uuid();
  v_depo   uuid := gen_random_uuid();
  v_ccp    uuid;
  v_kalem  uuid := gen_random_uuid();
  v_must   uuid := gen_random_uuid();
begin
  perform prova_oturumsuz();
  select t.id into v_t from public.tenant t limit 1;
  select b.id into v_b from public.branch b where b.tenant_id = v_t limit 1;
  select c.id into v_ccp from public.haccp_ccp c
    join public.haccp_plan pl on pl.id = c.plan_id
   where pl.tenant_id = v_t order by c.code limit 1;
  select 'kg' into v_birim;

  insert into public.app_user (id, tenant_id, auth_user_id, username, username_key,
                               full_name, role_code, is_active)
  values (gen_random_uuid(), v_t, v_kalite, 'p81_kalite', 'p81_kalite',
          'Kalite Sorumlusu',   'kalite_sorumlusu',   true),
         (gen_random_uuid(), v_t, v_uretim, 'p81_uretim', 'p81_uretim',
          'Üretim Sorumlusu',   'uretim_sorumlusu',   true),
         (gen_random_uuid(), v_t, v_sevk,   'p81_sevk',   'p81_sevk',
          'Sevkiyat Sorumlusu', 'sevkiyat_sorumlusu', true),
         (gen_random_uuid(), v_t, v_depo,   'p81_depo',   'p81_depo',
          'Depo Sorumlusu',     'depo_sorumlusu',     true);

  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name, base_uom)
  values (v_kalem, v_t, v_b, 'P81-KLM', 'p81-klm', 'Prova Kalemi', v_birim);

  insert into public.customer (id, tenant_id, code, code_key, name)
  values (v_must, v_t, 'P81-MUS', 'p81-mus', 'Prova Müşterisi');

  perform set_config('prova.t',      v_t::text,      false);
  perform set_config('prova.b',      v_b::text,      false);
  perform set_config('prova.ccp',    v_ccp::text,    false);
  perform set_config('prova.kalem',  v_kalem::text,  false);
  perform set_config('prova.must',   v_must::text,   false);
  perform set_config('prova.kalite', v_kalite::text, false);
  perform set_config('prova.uretim', v_uretim::text, false);
  perform set_config('prova.sevk',   v_sevk::text,   false);
  perform set_config('prova.depo',   v_depo::text,   false);
  raise notice 'KURULUM TAMAM';
end; $$;


-- ⚠️ 0089'DAN SONRA ZORUNLU: kapılar artık "bu yazım istemciden mi geldi"
-- diye soruyor (`current_user in ('anon','authenticated')`). `postgres`
-- rolüyle koşan bir prova, JWT koysa bile kapının DIŞINDA kalır ve
-- bütün yazımlar sessizce geçer — yani prova körleşir. Gerçek rolü
-- takmadan yapılan yetki provası kanıt değildir.
grant execute on function prova_bak(text, boolean), prova_oturum(uuid, uuid),
  prova_oturumsuz() to authenticated;
grant usage on schema public to authenticated;
set local role authenticated;


-- ═══ A · REÇETE KAPISI ═══════════════════════════════════════════════════
do $$
declare v_h text := ''; v_kod text := '';
begin
  -- A1 · Üretim sorumlusunda `recipe.write` VAR → yazabilmeli
  perform prova_oturum(current_setting('prova.uretim')::uuid, current_setting('prova.t')::uuid);
  insert into public.recipe (tenant_id, code, code_key, name, output_item_id, output_uom, output_qty)
  values (current_setting('prova.t')::uuid, 'P81-R1', 'p81-r1', 'Prova Reçete',
          current_setting('prova.kalem')::uuid, 'kg', 1);
  perform prova_bak('üretim sorumlusu reçete yazabiliyor', true);

  -- A2 · Depo sorumlusunda YOK → MI403
  perform prova_oturum(current_setting('prova.depo')::uuid, current_setting('prova.t')::uuid);
  begin
    insert into public.recipe (tenant_id, code, code_key, name, output_item_id, output_uom, output_qty)
    values (current_setting('prova.t')::uuid, 'P81-R2', 'p81-r2', 'Olmamalı',
            current_setting('prova.kalem')::uuid, 'kg', 1);
  exception when others then v_h := SQLERRM; v_kod := SQLSTATE;
  end;
  perform prova_bak('depo sorumlusu reçete YAZAMIYOR (MI403)', v_kod = 'MI403');
  perform prova_bak('hata mesajı izni söylüyor', v_h like '%recipe.write%');
end; $$;


-- ═══ B · SEVKİYAT KAPISI ═════════════════════════════════════════════════
do $$
declare v_kod text := ''; v_sevk_id uuid := gen_random_uuid();
begin
  -- B1 · Sevkiyat sorumlusunda `logistics.write` VAR
  perform prova_oturum(current_setting('prova.sevk')::uuid, current_setting('prova.t')::uuid);
  insert into public.shipment (id, tenant_id, branch_id, shipment_no, customer_name, customer_id)
  values (v_sevk_id, current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          'P81-S1', 'Prova Müşterisi', current_setting('prova.must')::uuid);
  perform prova_bak('sevkiyat sorumlusu sevkiyat açabiliyor', true);
  perform set_config('prova.sevkiyat', v_sevk_id::text, false);

  -- B2 · Üretim sorumlusunda YOK → MI403
  perform prova_oturum(current_setting('prova.uretim')::uuid, current_setting('prova.t')::uuid);
  begin
    insert into public.shipment (tenant_id, branch_id, shipment_no, customer_name, customer_id)
    values (current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
            'P81-S2', 'Prova Müşterisi', current_setting('prova.must')::uuid);
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('üretim sorumlusu sevkiyat AÇAMIYOR (MI403)', v_kod = 'MI403');

  -- B3 · Var olan sevkiyatı da güncelleyemez
  v_kod := '';
  begin
    update public.shipment set note = 'kurcalandı'
     where id = current_setting('prova.sevkiyat')::uuid;
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('üretim sorumlusu sevkiyatı GÜNCELLEYEMİYOR', v_kod = 'MI403');
end; $$;


-- ═══ C · HACCP ÖLÇÜM — 0068 KORUNDU MU ═══════════════════════════════════
do $$
declare v_kod text := ''; v_olcum uuid := gen_random_uuid();
begin
  -- C1 · Üretim sorumlusu ölçüm GİREBİLMELİ (0068'in bütün amacı bu)
  perform prova_oturum(current_setting('prova.uretim')::uuid, current_setting('prova.t')::uuid);
  insert into public.haccp_measurement
    (id, tenant_id, branch_id, ccp_id, measured_value, uom, result, limit_snapshot, source_type)
  values (v_olcum, current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          current_setting('prova.ccp')::uuid, 9, '°C', 'FAIL', 'en çok 4 °C', 'manual');
  perform prova_bak('⚠️ 0068 KORUNDU: üretim sorumlusu ölçüm girebiliyor', true);
  perform set_config('prova.olcum', v_olcum::text, false);

  -- C2 · Sevkiyat sorumlusu da girebilmeli
  perform prova_oturum(current_setting('prova.sevk')::uuid, current_setting('prova.t')::uuid);
  insert into public.haccp_measurement
    (tenant_id, branch_id, ccp_id, measured_value, uom, result, limit_snapshot, source_type)
  values (current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          current_setting('prova.ccp')::uuid, 2, '°C', 'PASS', 'en çok 4 °C', 'manual');
  perform prova_bak('⚠️ 0068 KORUNDU: sevkiyat sorumlusu ölçüm girebiliyor', true);

  -- C3 · Depo sorumlusunda `quality.write` YOK → giremez
  perform prova_oturum(current_setting('prova.depo')::uuid, current_setting('prova.t')::uuid);
  begin
    insert into public.haccp_measurement
      (tenant_id, branch_id, ccp_id, measured_value, uom, result, limit_snapshot, source_type)
    values (current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
            current_setting('prova.ccp')::uuid, 1, '°C', 'PASS', 'en çok 4 °C', 'manual');
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('depo sorumlusu HACCP ölçümü GİREMİYOR', v_kod = 'MI403');
end; $$;


-- ═══ D · ÖLÇÜM İPTALİ — YENİ DAR İZİN ════════════════════════════════════
do $$
declare v_h text := ''; v_kod text := '';
begin
  -- D1 · Üretim sorumlusu kendi girdiği ölçümü İPTAL EDEMEZ
  perform prova_oturum(current_setting('prova.uretim')::uuid, current_setting('prova.t')::uuid);
  begin
    update public.haccp_measurement
       set cancelled_at = now(), cancel_reason = 'yanlış prob'
     where id = current_setting('prova.olcum')::uuid;
  exception when others then v_h := SQLERRM; v_kod := SQLSTATE;
  end;
  perform prova_bak('⚠️ ASIL KAZANÇ: üretim sorumlusu ölçümü İPTAL EDEMİYOR', v_kod = 'MI403');
  perform prova_bak('mesaj "ölçüm girme yetkiniz duruyor" diyor',
                    v_h like '%Olcum GIRME yetkiniz ayri ve duruyor%');

  -- D2 · Kalite sorumlusu iptal EDEBİLİR
  perform prova_oturum(current_setting('prova.kalite')::uuid, current_setting('prova.t')::uuid);
  update public.haccp_measurement
     set cancelled_at = now(), cancel_reason = 'yanlış prob ile ölçüldü'
   where id = current_setting('prova.olcum')::uuid;
  perform prova_bak('kalite sorumlusu ölçümü iptal edebiliyor',
    (select cancelled_at is not null from public.haccp_measurement
      where id = current_setting('prova.olcum')::uuid));
end; $$;


-- ═══ E · DÜZELTİCİ FAALİYET — EKRAN GÖRÜNTÜSÜNDEKİ HATA ══════════════════
do $$
declare
  v_kod text := ''; v_fy uuid := gen_random_uuid(); v_olcum2 uuid := gen_random_uuid();
begin
  -- Kurulum: üretim sorumlusu FAIL ölçüm girsin, faaliyet AÇSIN
  perform prova_oturum(current_setting('prova.uretim')::uuid, current_setting('prova.t')::uuid);
  insert into public.haccp_measurement
    (id, tenant_id, branch_id, ccp_id, measured_value, uom, result, limit_snapshot, source_type)
  values (v_olcum2, current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          current_setting('prova.ccp')::uuid, 9, '°C', 'FAIL', 'en çok 4 °C', 'manual');
  insert into public.haccp_corrective_action
    (id, tenant_id, measurement_id, description, assigned_role, status)
  values (v_fy, current_setting('prova.t')::uuid, v_olcum2,
          'Malı KABUL ETME. Tedarikçiye iade et.', 'Depo sorumlusu', 'OPEN');
  perform prova_bak('ölçümü giren, faaliyeti AÇABİLİYOR (otomatik akış bozulmadı)', true);
  perform set_config('prova.faaliyet', v_fy::text, false);

  -- E1 · SEVKİYAT SORUMLUSU KAPATAMAZ — ekran görüntüsündeki tam hata
  perform prova_oturum(current_setting('prova.sevk')::uuid, current_setting('prova.t')::uuid);
  begin
    update public.haccp_corrective_action
       set status = 'COMPLETED', action_taken = 'iade edildi', completed_at = now()
     where id = v_fy;
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('⚠️ 14.10 HATASI KAPANDI: sevkiyat sorumlusu faaliyeti KAPATAMIYOR',
                    v_kod = 'MI403');

  -- E2 · Üretim sorumlusu da kapatamaz
  v_kod := '';
  perform prova_oturum(current_setting('prova.uretim')::uuid, current_setting('prova.t')::uuid);
  begin
    update public.haccp_corrective_action
       set status = 'COMPLETED', action_taken = 'tamam', completed_at = now()
     where id = v_fy;
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('üretim sorumlusu faaliyeti KAPATAMIYOR', v_kod = 'MI403');

  -- E3 · Ama AÇIK faaliyeti ilerletebilir (iş akışı kilitlenmiyor)
  update public.haccp_corrective_action
     set status = 'IN_PROGRESS', action_taken = 'tedarikçi arandı'
   where id = v_fy;
  perform prova_bak('üretim sorumlusu faaliyeti İLERLETEBİLİYOR (OPEN→IN_PROGRESS)',
    (select status = 'IN_PROGRESS' from public.haccp_corrective_action where id = v_fy));

  -- E4 · Atamayı değiştiremez
  v_kod := '';
  begin
    update public.haccp_corrective_action set assigned_role = 'Sevkiyat sorumlusu'
     where id = v_fy;
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('üretim sorumlusu ATAMAYI değiştiremiyor', v_kod = 'MI403');
end; $$;


-- ═══ F · KAPATANIN İMZASINI VERİTABANI ATIYOR ════════════════════════════
do $$
declare v_fy uuid := current_setting('prova.faaliyet')::uuid; v_imza uuid; v_kalite_id uuid;
begin
  select id into v_kalite_id from public.app_user
   where auth_user_id = current_setting('prova.kalite')::uuid;

  -- F1 · Kalite sorumlusu kapatabiliyor
  perform prova_oturum(current_setting('prova.kalite')::uuid, current_setting('prova.t')::uuid);
  update public.haccp_corrective_action
     set status = 'COMPLETED', action_taken = 'Mal kabul edilmedi, iade edildi',
         completed_at = now()
   where id = v_fy;
  perform prova_bak('kalite sorumlusu faaliyeti kapatabiliyor',
    (select status = 'COMPLETED' from public.haccp_corrective_action where id = v_fy));

  -- F2 · `completed_by` KENDİLİĞİNDEN doldu
  select completed_by into v_imza from public.haccp_corrective_action where id = v_fy;
  perform prova_bak('⚠️ İMZA: completed_by kendiliğinden kalite sorumlusunu gösteriyor',
                    v_imza = v_kalite_id);
end; $$;

do $$
declare
  v_fy2 uuid := gen_random_uuid(); v_olcum3 uuid := gen_random_uuid();
  v_imza uuid; v_kalite_id uuid; v_sahte uuid;
begin
  select id into v_kalite_id from public.app_user
   where auth_user_id = current_setting('prova.kalite')::uuid;
  select id into v_sahte from public.app_user
   where auth_user_id = current_setting('prova.depo')::uuid;

  -- F3 · İstemci SAHTE imza gönderse bile üstüne yazılıyor
  perform prova_oturum(current_setting('prova.uretim')::uuid, current_setting('prova.t')::uuid);
  insert into public.haccp_measurement
    (id, tenant_id, branch_id, ccp_id, measured_value, uom, result, limit_snapshot, source_type)
  values (v_olcum3, current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          current_setting('prova.ccp')::uuid, 11, '°C', 'FAIL', 'en çok 4 °C', 'manual');
  insert into public.haccp_corrective_action
    (id, tenant_id, measurement_id, description, status)
  values (v_fy2, current_setting('prova.t')::uuid, v_olcum3, 'İkinci sapma', 'OPEN');

  perform prova_oturum(current_setting('prova.kalite')::uuid, current_setting('prova.t')::uuid);
  update public.haccp_corrective_action
     set status = 'COMPLETED', action_taken = 'kapatıldı', completed_at = now(),
         completed_by = v_sahte          -- ⚠️ istemci yalan söylüyor
   where id = v_fy2;
  select completed_by into v_imza from public.haccp_corrective_action where id = v_fy2;
  perform prova_bak('⚠️ SAHTE İMZA ÜSTÜNE YAZILDI: completed_by gerçek kapatanı gösteriyor',
                    v_imza = v_kalite_id and v_imza <> v_sahte);
end; $$;

do $$
declare v_kod text := ''; v_olcum4 uuid := gen_random_uuid();
begin
  -- F4 · Doğrudan COMPLETED olarak INSERT etmek de dar izin ister
  perform prova_oturum(current_setting('prova.uretim')::uuid, current_setting('prova.t')::uuid);
  insert into public.haccp_measurement
    (id, tenant_id, branch_id, ccp_id, measured_value, uom, result, limit_snapshot, source_type)
  values (v_olcum4, current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
          current_setting('prova.ccp')::uuid, 12, '°C', 'FAIL', 'en çok 4 °C', 'manual');
  begin
    insert into public.haccp_corrective_action
      (tenant_id, measurement_id, description, status, action_taken, completed_at)
    values (current_setting('prova.t')::uuid, v_olcum4, 'Kapıyı atlama denemesi',
            'COMPLETED', 'kendim kapattım', now());
  exception when others then v_kod := SQLSTATE;
  end;
  perform prova_bak('KAPI ATLANAMIYOR: doğrudan COMPLETED olarak eklenemiyor', v_kod = 'MI403');
end; $$;


-- ═══ G · AMBALAJ BEYANI DELİĞİ ═══════════════════════════════════════════
do $$
declare v_kod text := ''; v_h text := '';
begin
  -- G1 · Depo sorumlusu ambalajı DEĞİŞTİREMEZ
  perform prova_oturum(current_setting('prova.depo')::uuid, current_setting('prova.t')::uuid);
  begin
    update public.stock_item set net_qty = 5000, net_uom = 'g'
     where id = current_setting('prova.kalem')::uuid;
  exception when others then v_h := SQLERRM; v_kod := SQLSTATE;
  end;
  perform prova_bak('⚠️ CODEX DELİĞİ KAPANDI: depo sorumlusu ambalaj beyanını YAZAMIYOR',
                    v_kod = 'MI403');
  perform prova_bak('mesaj etiket beyanı diyor', v_h like '%etiket beyaninin parcasidir%');

  -- G2 · Ama kartın GERİ KALANINI yazabiliyor (stok işi engellenmedi)
  update public.stock_item set name = 'Prova Kalemi (düzeltildi)'
   where id = current_setting('prova.kalem')::uuid;
  perform prova_bak('depo sorumlusu kart bilgisini hâlâ yazabiliyor (ad)',
    (select name = 'Prova Kalemi (düzeltildi)' from public.stock_item
      where id = current_setting('prova.kalem')::uuid));

  -- G3 · Kalite sorumlusu ambalajı yazabiliyor
  perform prova_oturum(current_setting('prova.kalite')::uuid, current_setting('prova.t')::uuid);
  update public.stock_item set net_qty = 500, net_uom = 'g'
   where id = current_setting('prova.kalem')::uuid;
  perform prova_bak('kalite sorumlusu ambalaj beyanını yazabiliyor',
    (select net_qty = 500 from public.stock_item where id = current_setting('prova.kalem')::uuid));
end; $$;


-- Buradan sonrası GÖÇ bağlamını sınıyor: istemci rolü bırakılıyor.
reset role;


-- ═══ H · OTURUMSUZ BAĞLAM SERBEST (göç güvenliği) ════════════════════════
do $$
begin
  perform prova_oturumsuz();
  insert into public.recipe (tenant_id, code, code_key, name, output_item_id, output_uom, output_qty)
  values (current_setting('prova.t')::uuid, 'P81-R9', 'p81-r9', 'Göç Reçetesi',
          current_setting('prova.kalem')::uuid, 'kg', 1);
  update public.stock_item set net_qty = 250
   where id = current_setting('prova.kalem')::uuid;
  perform prova_bak('⚠️ GÖÇ GÜVENLİ: oturumsuz bağlamda kapılar serbest', true);
end; $$;


-- ═══ I · İZİN DAĞILIMI ═══════════════════════════════════════════════════
do $$
declare v_say int;
begin
  select count(*) into v_say from role_permission
   where permission_code = 'quality.record.manage';
  perform prova_bak('yeni izin tam 6 rolde', v_say = 6);

  select count(*) into v_say from role_permission
   where permission_code = 'quality.record.manage'
     and role_code in ('uretim_sorumlusu','sevkiyat_sorumlusu','depo_sorumlusu','personel','izleyici');
  perform prova_bak('üretim/sevkiyat/depo/personel/izleyici ALMADI', v_say = 0);

  select count(*) into v_say from role_permission
   where permission_code = 'quality.write';
  perform prova_bak('quality.write hâlâ 8 rolde (0068 bozulmadı)', v_say = 8);
end; $$;

rollback;
