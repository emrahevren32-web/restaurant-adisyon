\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0097 · ŞAHİT NUMUNE İMHASI BİR ONAY İŞİDİR
--
-- Emrah (26.10): *"Müdür onaylar ama müdür yoksa gıda mühendisi veya
-- kalitecide onaylayabilir."*
--
-- 0093 üç olayı da aynı kapıya bağlamıştı; yani ÜRETİM SORUMLUSU numuneyi
-- imha edebiliyordu. Bu prova daralmayı ölçüyor ve daralmanın NORMAL AKIŞI
-- bozmadığını ayrıca sınıyor.
--
-- Sorular:
--   1 · Üretim sorumlusu numune ALABİLİYOR mu?        → ALABİLMELİ (0093)
--   2 · Üretim sorumlusu AÇILIŞ yazabiliyor mu?       → YAZABİLMELİ (0093)
--   3 · Üretim sorumlusu İMHA yazabiliyor mu?         → YAZAMAMALI (0097)
--   4 · Reddedilen imha durumu değiştirdi mi?         → DEĞİŞTİRMEMELİ
--   5 · Kalite sorumlusu imhayı onaylayabiliyor mu?   → ONAYLAYABİLMELİ
--   6 · Gıda mühendisi onaylayabiliyor mu?            → ONAYLAYABİLMELİ
--   7 · İşletme müdürü onaylayabiliyor mu?            → ONAYLAYABİLMELİ
--   8 · Depo sorumlusu hiçbirini yazabiliyor mu?      → YAZAMAMALI
--   9 · İmha imzasını SUNUCU mu yazdı?                → SUNUCU
--  10 · İmhadan sonra durum IMHA mı?                  → IMHA
--  11 · Eski gevşek tetik düştü mü? (yapısal)         → DÜŞMÜŞ OLMALI
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

-- ── 11 · YAPISAL · ESKİ GEVŞEK TETİK DÜŞTÜ MÜ ────────────────────────────
-- ⚠️ İki kapı birlikte dururken istek EN GEVŞEK kapıdan geçer. Yeni kapıyı
-- eklemek yetmez; eskisinin gittiğini ölçmek gerekir.
do $$
begin
  perform prova_bak('11a · yeni kapı (izin_numune_olayi) bağlı',
    exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
             where c.relname = 'witness_sample_event'
               and g.tgname = 'izin_numune_olayi' and not g.tgisinternal));
  perform prova_bak('11b · eski gevşek kapı (izin_witness_sample_event) GİTTİ',
    not exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
                 where c.relname = 'witness_sample_event'
                   and g.tgname = 'izin_witness_sample_event' and not g.tgisinternal));
end $$;

-- ── KURULUM ───────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid; v_rol text; v_auth uuid; v_app uuid;
  v_kalem uuid; v_i int;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);
  perform set_config('app.tenant_id', v_t::text, false);

  foreach v_rol in array array['uretim_sorumlusu','kalite_sorumlusu',
                               'gida_muhendisi','isletme_muduru',
                               'depo_sorumlusu'] loop
    v_auth := gen_random_uuid(); v_app := gen_random_uuid();
    insert into auth.users (id, email) values (v_auth, 'p97.'||v_rol||'@o.local');
    insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                                 username_key, full_name, role_code, is_active)
    values (v_app, v_t, v_f, v_auth, 'p97'||left(md5(v_rol),6),
            'p97'||left(md5(v_rol),6), v_rol, v_rol, true);
    perform set_config('prova.auth.'||v_rol, v_auth::text, false);
    perform set_config('prova.app.'||v_rol,  v_app::text,  false);
  end loop;

  -- Saklama koşulu ve açık raf ömrü TANIMLI ürün (0093/0094 şartı).
  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition, opened_shelf_life_days)
  values (v_kalem, v_t, v_b, 'P97-CORBA', 'p97-corba', 'Prova Corbasi', 'kg',
          true, true, true, '-18 °C', 2);
  perform set_config('prova.kalem', v_kalem::text, false);

  -- Beş parti: her sınama kendi numunesini alsın (aynı partide tek açık
  -- numune kuralı 0093'te duruyor).
  for v_i in 1..5 loop
    insert into public.stock_lot (tenant_id, branch_id, stock_item_id, lot_code,
                                  lot_code_key, expires_on, origin_type)
    values (v_t, v_b, v_kalem, 'P97-L'||v_i, 'p97-l'||v_i,
            current_date + 90, 'PRODUCTION');
    perform set_config('prova.l'||v_i,
      (select id::text from public.stock_lot where lot_code_key = 'p97-l'||v_i), false);
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
  v_kod text; v_durum text; v_imza uuid;
  v_n1 uuid; v_n2 uuid; v_n3 uuid; v_n4 uuid;
begin
  -- ── 1 · ÜRETİM NUMUNE ALABİLİYOR (0093 bozulmadı) ─────────────────────
  perform prova_oturum(current_setting('prova.auth.uretim_sorumlusu')::uuid);
  v_n1 := gen_random_uuid();
  begin
    insert into public.witness_sample (id, tenant_id, branch_id, stock_item_id,
      lot_id, sample_code, sample_code_key, storage_condition, keep_until)
    values (v_n1, v_t, v_b, null, current_setting('prova.l1')::uuid,
            'P97-N1', 'x', 'x', current_date);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('1 · ÜRETİM numune ALABİLİYOR (gelen: '||v_kod||')',
    v_kod = '00000');

  -- ── 2 · ÜRETİM AÇILIŞ YAZABİLİYOR (0093 bozulmadı) ────────────────────
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type,
      reason, result)
    values (v_t, v_n1, 'ACILDI', 'müşteri itirazı', 'ürün uygun');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('2 · ÜRETİM açılış YAZABİLİYOR (gelen: '||v_kod||')',
    v_kod = '00000');

  -- ── 3 · ÜRETİM İMHA YAZAMIYOR (0097'nin kendisi) ──────────────────────
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
    values (v_t, v_n1, 'IMHA', 'süresi doldu');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('3 · ÜRETİM imha YAZAMIYOR (gelen: '||v_kod||')',
    v_kod = 'MI403');

  -- ── 4 · REDDEDİLEN İMHA DURUMU DEĞİŞTİRMEDİ ───────────────────────────
  -- ⚠️ Hata kodu dönüp satırın yine değişmesi, "kapı var" demenin en kötü
  -- biçimi olurdu. Durum açılışta ACILDI olmuştu, IMHA OLMAMALI.
  select status into v_durum from public.witness_sample where id = v_n1;
  perform prova_bak('4 · reddedilen imha durumu DEĞİŞTİRMEDİ (gelen: '||v_durum||')',
    v_durum = 'ACILDI');

  -- ── 5 · KALİTE SORUMLUSU ONAYLAYABİLİYOR ──────────────────────────────
  perform prova_oturum(current_setting('prova.auth.kalite_sorumlusu')::uuid);
  v_n2 := gen_random_uuid();
  insert into public.witness_sample (id, tenant_id, branch_id, stock_item_id,
    lot_id, sample_code, sample_code_key, storage_condition, keep_until)
  values (v_n2, v_t, v_b, null, current_setting('prova.l2')::uuid,
          'P97-N2', 'x', 'x', current_date);
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
    values (v_t, v_n2, 'IMHA', 'süresi doldu, tutanak 2026/14');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('5 · KALİTE SORUMLUSU imhayı ONAYLAYABİLİYOR (gelen: '
    ||v_kod||')', v_kod = '00000');

  -- ── 9/10 · İMZA SUNUCUDA, DURUM IMHA ──────────────────────────────────
  select s.status, e.actor_user_id into v_durum, v_imza
    from public.witness_sample s
    join public.witness_sample_event e on e.sample_id = s.id and e.event_type = 'IMHA'
   where s.id = v_n2;
  perform prova_bak('10 · imhadan sonra durum IMHA', v_durum = 'IMHA');
  perform prova_bak('9 · imha imzasını SUNUCU yazdı (onaylayan kişi)',
    v_imza = current_setting('prova.app.kalite_sorumlusu')::uuid);

  -- ── 6 · GIDA MÜHENDİSİ ONAYLAYABİLİYOR ────────────────────────────────
  perform prova_oturum(current_setting('prova.auth.gida_muhendisi')::uuid);
  v_n3 := gen_random_uuid();
  insert into public.witness_sample (id, tenant_id, branch_id, stock_item_id,
    lot_id, sample_code, sample_code_key, storage_condition, keep_until)
  values (v_n3, v_t, v_b, null, current_setting('prova.l3')::uuid,
          'P97-N3', 'x', 'x', current_date);
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
    values (v_t, v_n3, 'IMHA', 'müdür yok, gıda mühendisi onayladı');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('6 · GIDA MÜHENDİSİ imhayı ONAYLAYABİLİYOR (gelen: '
    ||v_kod||')', v_kod = '00000');

  -- ── 7 · İŞLETME MÜDÜRÜ ONAYLAYABİLİYOR ────────────────────────────────
  perform prova_oturum(current_setting('prova.auth.isletme_muduru')::uuid);
  v_n4 := gen_random_uuid();
  insert into public.witness_sample (id, tenant_id, branch_id, stock_item_id,
    lot_id, sample_code, sample_code_key, storage_condition, keep_until)
  values (v_n4, v_t, v_b, null, current_setting('prova.l4')::uuid,
          'P97-N4', 'x', 'x', current_date);
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
    values (v_t, v_n4, 'IMHA', 'müdür onayı');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('7 · İŞLETME MÜDÜRÜ imhayı ONAYLAYABİLİYOR (gelen: '
    ||v_kod||')', v_kod = '00000');

  -- ── 8 · DEPO SORUMLUSU HİÇBİRİNİ YAZAMIYOR ────────────────────────────
  -- ⚠️ İsmet "depocu kontrolünde" dedi; kontrol fiziksel sorumluluktur.
  -- Depocu defteri GÖRÜR (menü izni `quality.read`) ama kayıt AÇMAZ.
  perform prova_oturum(current_setting('prova.auth.depo_sorumlusu')::uuid);
  begin
    insert into public.witness_sample (tenant_id, branch_id, stock_item_id,
      lot_id, sample_code, sample_code_key, storage_condition, keep_until)
    values (v_t, v_b, null, current_setting('prova.l5')::uuid,
            'P97-N5', 'x', 'x', current_date);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('8a · DEPO sorumlusu numune ALAMIYOR (gelen: '||v_kod||')',
    v_kod = 'MI403');
  begin
    insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason)
    values (v_t, v_n4, 'ACILDI', 'depocu denemesi');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('8b · DEPO sorumlusu olay YAZAMIYOR (gelen: '||v_kod||')',
    v_kod = 'MI403');
end $$;

reset role;
do $$ begin raise notice '═══ PROVA 0097 · HEPSİ YEŞİL ═══'; end $$;

rollback;
