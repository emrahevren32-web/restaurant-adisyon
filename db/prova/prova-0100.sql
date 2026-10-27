\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0100 · AÇILIŞ SONUCU SUNUCUDA ZORUNLU (MIYOP-081)
--
-- Sorular:
--   1 · Sonuçsuz açılış yazılabiliyor mu?                 → YAZILAMAMALI
--   2 · Yalnız boşluktan oluşan sonuç geçiyor mu?         → GEÇMEMELİ
--   3 · REDDEDİLEN açılış DURUMU değiştirdi mi?           → DEĞİŞTİRMEMELİ
--   4 · REDDEDİLEN açılış SAKLAMA SONUNU değiştirdi mi?   → DEĞİŞTİRMEMELİ
--   5 · Sonuçlu açılış yazılabiliyor mu?                  → YAZILABİLMELİ
--   6 · Sonuçlu açılış saklama sonunu KISALTIYOR mu?      → KISALTMALI (0094)
--   7 · İmha sonuçsuz yazılabiliyor mu?                   → YAZILABİLMELİ
--   8 · 0093'ün gerekçe kuralı duruyor mu?                → DURUYOR
--   9 · Gerekçesiz açılış da bir şey değiştirdi mi?       → DEĞİŞTİRMEMELİ
--
-- ⚠️ 3 ve 4 en önemlileri. `app.numune_olayi()` BEFORE INSERT tetiğinde
-- `witness_sample`ı GÜNCELLİYOR; kısıt ise INSERT'ten SONRA denetleniyor.
-- Yani tetiğin yazdığı güncelleme, kısıt ihlalinde geri alınmalı. Bunu
-- varsaymak yetmez — PostgreSQL ifade atomikliğine güvenip ölçmemek,
-- "kapı var" demenin en kötü biçimi olurdu.
-- ═══════════════════════════════════════════════════════════════════════════

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

do $$
declare
  v_t uuid; v_f uuid; v_b uuid; v_auth uuid; v_app uuid; v_kalem uuid; v_i int;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);
  perform set_config('app.tenant_id', v_t::text, false);

  -- Kalite sorumlusu: hem numune alabilir hem imha onaylayabilir (0097).
  v_auth := gen_random_uuid(); v_app := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p100@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_t, v_f, v_auth, 'p100', 'p100', 'Prova 100',
          'kalite_sorumlusu', true);
  perform set_config('prova.auth', v_auth::text, false);

  -- ⚠️ Açık raf ömrü 2 gün: açılışın saklama sonunu KISALTTIĞINI (0094)
  -- ölçebilmek için. SKT 90 gün sonra, yani kısalma görünür olmalı.
  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition, opened_shelf_life_days)
  values (v_kalem, v_t, v_b, 'P100-CORBA', 'p100-corba', 'Prova Corbasi', 'kg',
          true, true, true, '-18 °C', 2);

  for v_i in 1..3 loop
    insert into public.stock_lot (tenant_id, branch_id, stock_item_id, lot_code,
                                  lot_code_key, expires_on, origin_type)
    values (v_t, v_b, v_kalem, 'P100-L'||v_i, 'p100-l'||v_i,
            current_date + 90, 'PRODUCTION');
    perform set_config('prova.l'||v_i,
      (select id::text from public.stock_lot where lot_code_key = 'p100-l'||v_i), false);
  end loop;

  raise notice 'KURULUM TAMAM';
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid) to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_kod text; v_durum text; v_sure date; v_n1 uuid; v_n2 uuid; v_n3 uuid;
begin
  perform prova_oturum(current_setting('prova.auth')::uuid);

  v_n1 := gen_random_uuid();
  insert into public.witness_sample (id, tenant_id, branch_id, stock_item_id,
    lot_id, sample_code, sample_code_key, storage_condition, keep_until)
  values (v_n1, v_t, v_b, null, current_setting('prova.l1')::uuid,
          'P100-N1', 'x', 'x', current_date);

  -- ── 1 · SONUÇSUZ AÇILIŞ ───────────────────────────────────────────────
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
    values (v_t, v_n1, 'ACILDI', 'müşteri itirazı');
    v_kod := '00000';
  exception when check_violation then v_kod := 'KISIT';
            when others then v_kod := sqlstate;
  end;
  perform prova_bak('1 · SONUÇSUZ açılış YAZILAMIYOR (gelen: '||v_kod||')',
    v_kod = 'KISIT');

  -- ── 2 · YALNIZ BOŞLUK ─────────────────────────────────────────────────
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type,
      reason, result)
    values (v_t, v_n1, 'ACILDI', 'müşteri itirazı', '   ');
    v_kod := '00000';
  exception when check_violation then v_kod := 'KISIT';
            when others then v_kod := sqlstate;
  end;
  perform prova_bak('2 · yalnız BOŞLUKtan sonuç GEÇMİYOR (gelen: '||v_kod||')',
    v_kod = 'KISIT');

  -- ── 3/4 · REDDEDİLEN AÇILIŞ HİÇBİR ŞEYİ DEĞİŞTİRMEDİ ─────────────────
  select status, keep_until into v_durum, v_sure
    from public.witness_sample where id = v_n1;
  perform prova_bak('3 · reddedilen açılış DURUMU değiştirmedi (gelen: '
    ||v_durum||')', v_durum = 'SAKLANIYOR');
  perform prova_bak('4 · reddedilen açılış SAKLAMA SONUNU değiştirmedi '
    '(gelen: '||v_sure||')', v_sure = current_date + 90);

  -- ── 5/6 · SONUÇLU AÇILIŞ GEÇİYOR VE SÜREYİ KISALTIYOR ────────────────
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type,
      reason, result)
    values (v_t, v_n1, 'ACILDI', 'müşteri itirazı', 'ürün uygun, koku normal');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('5 · SONUÇLU açılış YAZILABİLİYOR (gelen: '||v_kod||')',
    v_kod = '00000');

  select status, keep_until into v_durum, v_sure
    from public.witness_sample where id = v_n1;
  perform prova_bak('6a · durum ACILDI', v_durum = 'ACILDI');
  perform prova_bak('6b · saklama sonu açık raf ömrüne KISALDI (bugün + 2)',
    v_sure = current_date + 2);

  -- ── 7 · İMHA SONUÇSUZ YAZILABİLİYOR ───────────────────────────────────
  -- ⚠️ Kısıt YALNIZ açılışa. İmhanın sonucu gerekçesinin içindedir.
  v_n2 := gen_random_uuid();
  insert into public.witness_sample (id, tenant_id, branch_id, stock_item_id,
    lot_id, sample_code, sample_code_key, storage_condition, keep_until)
  values (v_n2, v_t, v_b, null, current_setting('prova.l2')::uuid,
          'P100-N2', 'x', 'x', current_date);
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
    values (v_t, v_n2, 'IMHA', 'süresi doldu, tutanak 2026/18');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('7 · İMHA sonuçsuz YAZILABİLİYOR (gelen: '||v_kod||')',
    v_kod = '00000');

  -- ── 8 · GEREKÇE KURALI DURUYOR (0093) ─────────────────────────────────
  -- ⚠️ ÜÇÜNCÜ, TEMİZ BİR NUMUNE. İlk yazışımda bu sınama `v_n2` üzerinde
  -- koşuyordu — ama o numune bir satır önce İMHA edilmişti, dolayısıyla
  -- MI409 ("defter kapandı") dönüyordu ve sınama **yanlış sebeple yeşil**
  -- geçiyordu: gerekçe kısıtı hiç devreye girmiyordu (tuzak 123).
  -- Beklenen hata kodu artık kesin: `check_violation`.
  v_n3 := gen_random_uuid();
  insert into public.witness_sample (id, tenant_id, branch_id, stock_item_id,
    lot_id, sample_code, sample_code_key, storage_condition, keep_until)
  values (v_n3, v_t, v_b, null, current_setting('prova.l3')::uuid,
          'P100-N3', 'x', 'x', current_date);
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type,
      reason, result)
    values (v_t, v_n3, 'ACILDI', '', 'ürün uygun');
    v_kod := '00000';
  exception when check_violation then v_kod := 'KISIT';
            when others then v_kod := sqlstate;
  end;
  perform prova_bak('8 · GEREKÇESİZ açılış hâlâ YAZILAMIYOR (gelen: '||v_kod||')',
    v_kod = 'KISIT');

  -- ── 9 · AÇIK DEFTERDE durum hâlâ SAKLANIYOR ───────────────────────────
  select status into v_durum from public.witness_sample where id = v_n3;
  perform prova_bak('9 · gerekçesiz açılış da hiçbir şeyi değiştirmedi',
    v_durum = 'SAKLANIYOR');
end $$;

reset role;
do $$ begin raise notice '═══ PROVA 0100 · HEPSİ YEŞİL ═══'; end $$;

rollback;
