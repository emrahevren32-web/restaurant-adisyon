\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0096 · SAKLAMA KOŞULU BİR BEYANDIR
--
-- Sorular:
--   1 · Kalite sorumlusu saklama koşulunu yazabiliyor mu?  → YAZABİLMELİ
--   2 · Gıda mühendisi açık raf ömrünü yazabiliyor mu?     → YAZABİLMELİ
--   3 · Kalite sorumlusu kartın ADINI değiştirebiliyor mu? → DEĞİŞTİREMEMELİ
--   4 · Depo sorumlusu (stock.write) yazabiliyor mu?       → YAZABİLMELİ
--   5 · İzni olmayan (satış/personel) yazabiliyor mu?      → YAZAMAMALI
--   6 · Alerjen beyan yolu hâlâ çalışıyor mu?              → ÇALIŞMALI
--   7 · Yeni kart damgayla doğabiliyor mu? (MIYOP-035)     → DOĞAMAMALI
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
  v_t uuid; v_f uuid; v_b uuid; v_rol text; v_auth uuid; v_app uuid; v_k uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);
  perform set_config('app.tenant_id', v_t::text, false);

  -- ⚠️ `kasiyer` bilerek: ne `stock.write` ne `quality.declaration` taşıyor.
  foreach v_rol in array array['kalite_sorumlusu','gida_muhendisi',
                               'depo_sorumlusu','kasiyer'] loop
    v_auth := gen_random_uuid(); v_app := gen_random_uuid();
    insert into auth.users (id, email) values (v_auth, 'p96.'||v_rol||'@o.local');
    insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                                 username_key, full_name, role_code, is_active)
    values (v_app, v_t, v_f, v_auth, 'p96'||left(md5(v_rol),6),
            'p96'||left(md5(v_rol),6), v_rol, v_rol, true);
    perform set_config('prova.auth.'||v_rol, v_auth::text, false);
  end loop;

  v_k := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active)
  values (v_k, v_t, v_b, 'P96-URUN', 'p96-urun', 'Prova Urunu', 'kg',
          true, true, true);
  perform set_config('prova.kalem', v_k::text, false);

  raise notice 'KURULUM TAMAM';
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid) to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

do $$
declare
  v_k uuid := current_setting('prova.kalem')::uuid;
  v_kod text; v_kosul text; v_acik integer; v_ad text;
begin
  -- ── 1 · KALİTE SORUMLUSU SAKLAMA KOŞULUNU YAZAR ───────────────────────
  perform prova_oturum(current_setting('prova.auth.kalite_sorumlusu')::uuid);
  begin
    update public.stock_item set storage_condition = '-18 °C' where id = v_k;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('1 · KALİTE sorumlusu saklama koşulunu YAZABİLİYOR (gelen: '
    ||v_kod||')', v_kod = '00000');

  -- ── 2 · GIDA MÜHENDİSİ AÇIK RAF ÖMRÜNÜ YAZAR ─────────────────────────
  perform prova_oturum(current_setting('prova.auth.gida_muhendisi')::uuid);
  begin
    update public.stock_item set opened_shelf_life_days = 3 where id = v_k;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('2 · GIDA MÜHENDİSİ açık raf ömrünü YAZABİLİYOR (gelen: '
    ||v_kod||')', v_kod = '00000');

  select storage_condition, opened_shelf_life_days into v_kosul, v_acik
    from public.stock_item where id = v_k;
  perform prova_bak('2b · yazılan değerler kartta duruyor',
    v_kosul = '-18 °C' and v_acik = 3);

  -- ── 3 · KALİTE KARTIN ADINI DEĞİŞTİREMEZ ─────────────────────────────
  -- ⚠️ Beyan yolu YALNIZ beyan alanları için. Kapı "başka alan da değiştiyse
  -- stock.write şart" diyor; o şart kalkarsa izin genişlemiş olur.
  perform prova_oturum(current_setting('prova.auth.kalite_sorumlusu')::uuid);
  begin
    update public.stock_item set name = 'Baska Ad' where id = v_k;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('3 · KALİTE kartın ADINI değiştiremiyor (gelen: '||v_kod||')',
    v_kod = 'MI403');

  -- ── 3b · AD DEĞİŞMEDİ Mİ? ────────────────────────────────────────────
  -- Reddedilen bir işlemin yazmadığını ayrıca ölçüyoruz: hata kodu dönüp
  -- satırın yine değişmesi, "kapı var" demenin en kötü biçimi olurdu.
  select name into v_ad from public.stock_item where id = v_k;
  perform prova_bak('3b · kartın adı DEĞİŞMEDİ', v_ad = 'Prova Urunu');

  -- ── 4 · DEPO SORUMLUSU (stock.write) YAZAR ───────────────────────────
  perform prova_oturum(current_setting('prova.auth.depo_sorumlusu')::uuid);
  begin
    update public.stock_item set storage_condition = '0-4 °C' where id = v_k;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('4 · DEPO sorumlusu da yazabiliyor (gelen: '||v_kod||')',
    v_kod = '00000');

  -- ── 5 · İZNİ OLMAYAN YAZAMAZ ─────────────────────────────────────────
  perform prova_oturum(current_setting('prova.auth.kasiyer')::uuid);
  begin
    update public.stock_item set storage_condition = 'oda sicakligi' where id = v_k;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('5 · izni olmayan YAZAMIYOR (gelen: '||v_kod||')',
    v_kod in ('MI403', '42501'));

  -- ── 6 · ALERJEN BEYAN YOLU HÂLÂ ÇALIŞIYOR ────────────────────────────
  -- ⚠️ Fonksiyon gövdesi komple değişti; eski bir alanı düşürmek alerjen
  -- beyanını sessizce kırardı.
  perform prova_oturum(current_setting('prova.auth.gida_muhendisi')::uuid);
  begin
    update public.stock_item set net_qty = 1, net_uom = 'kg' where id = v_k;
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('6 · net miktar beyanı hâlâ yazılabiliyor (gelen: '||v_kod||')',
    v_kod = '00000');
end $$;

reset role;

-- ── 7 · YENİ KART DAMGAYLA DOĞAMAZ (MIYOP-035) ───────────────────────────
-- ⚠️ `bakim_baglami()` postgres rolünde kapıyı atlıyor; bu sınama bu yüzden
-- `authenticated` altında koşuyor.
grant usage on schema public to authenticated;
set local role authenticated;
do $$
declare v_kod text;
begin
  perform prova_oturum(current_setting('prova.auth.depo_sorumlusu')::uuid);
  begin
    insert into public.stock_item (tenant_id, branch_id, code, code_key, name,
      base_uom, tracks_lot, tracks_expiry, is_active, allergen_reviewed_at)
    values (current_setting('prova.t')::uuid, current_setting('prova.b')::uuid,
            'P96-DAMGA', 'p96-damga', 'Damgali Dogan', 'kg', false, false, true, now());
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('7 · yeni kart damgayla DOĞAMIYOR (gelen: '||v_kod||')',
    v_kod = 'MI436');
end $$;

reset role;
do $$ begin raise notice '═══ PROVA 0096 · HEPSİ YEŞİL ═══'; end $$;

rollback;
