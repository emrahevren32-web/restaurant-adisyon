\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0112 · NUMUNE ALINMA ZAMANI SUNUCU DAMGASI
--
-- Sorular:
--   1 · İstemci GELECEK tarih gönderince `taken_at` o mu olur?   → HAYIR
--   2 · İstemci GEÇMİŞ tarih gönderince?                          → HAYIR
--   3 · Hiç göndermeyince?                                        → sunucu anı
--   4 · İmzanın "kim" tarafı hâlâ sunucudan mı?                   → EVET
--   5 · 0094'ün kuralları yerinde mi (SKT, saklama koşulu, anahtar)? → EVET
--
-- ⚠️ `set local role authenticated` TAKILIYOR (MIYOP-042).
--
-- ⚠️ BU KUSUR 0109'UNKİYLE AYNI ÖNEMDE DEĞİL ve prova bunu iddia da
-- etmiyor: `taken_at` hiçbir kuralın girdisi değil, kaydırılması bir
-- kapı açmıyor. Ölçtüğü şey defterin kendi doğruluğu.
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
  insert into auth.users (id, email) values (v_auth, 'p112.kalite@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (gen_random_uuid(), v_t, v_f, v_auth, 'p112kal', 'p112kal',
          'Prova 112 Kalite', 'kalite_sorumlusu', true);
  perform set_config('prova.auth', v_auth::text, false);

  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition, opened_shelf_life_days)
  values (v_kalem, v_t, v_b, 'P112-URN', 'p112-urn', 'Prova 112 Urun', 'kg',
          true, true, true, '-18 °C', 3);

  -- Üç ayrı parti: "aynı partide ikinci açık numune olamaz" kuralı (0093)
  -- tek parti kullanılırsa reddi YANLIŞ sebebe bağlardı.
  for v_i in 1..3 loop
    v_lot := gen_random_uuid();
    insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                  lot_code_key, expires_on, origin_type)
    values (v_lot, v_t, v_b, v_kalem, 'P112-LOT'||v_i, 'p112-lot'||v_i,
            current_date + 30, 'PRODUCTION');
    perform set_config('prova.lot'||v_i, v_lot::text, false);
  end loop;
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid) to authenticated;
grant usage on schema public to authenticated;
set local role authenticated;

do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_auth uuid := current_setting('prova.auth')::uuid;
  v_n1 uuid; v_n2 uuid; v_n3 uuid;
  v_z1 timestamptz; v_z2 timestamptz; v_z3 timestamptz; v_kim uuid;
  v_kullanici uuid;
begin
  perform prova_oturum(v_auth, v_t);
  select id into v_kullanici from public.app_user where auth_user_id = v_auth;

  -- 1 · GELECEK TARİH
  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, v_b, current_setting('prova.lot1')::uuid, 'P112-N1', 'x',
          now() + interval '30 days')
  returning id, taken_at into v_n1, v_z1;
  perform prova_bak('⚠️ GELECEK tarih yok sayildi (fark: '
    ||(now() - v_z1)||')', v_z1 between now() - interval '5 seconds'
                                    and now() + interval '5 seconds');

  -- 2 · GEÇMİŞ TARİH
  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, v_b, current_setting('prova.lot2')::uuid, 'P112-N2', 'x',
          now() - interval '400 days')
  returning id, taken_at into v_n2, v_z2;
  perform prova_bak('⚠️ GECMIS tarih yok sayildi (fark: '
    ||(now() - v_z2)||')', v_z2 between now() - interval '5 seconds'
                                    and now() + interval '5 seconds');

  -- 3 · HİÇ GÖNDERİLMEYİNCE (ekranın yaptığı)
  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key)
  values (v_t, v_b, current_setting('prova.lot3')::uuid, 'P112-N3', 'x')
  returning id, taken_at, taken_by into v_n3, v_z3, v_kim;
  perform prova_bak('gonderilmeyince de sunucu ani yaziliyor',
    v_z3 between now() - interval '5 seconds' and now() + interval '5 seconds');

  -- 4 · İMZANIN "KİM" TARAFI
  perform prova_bak('imzanin KIM tarafi sunucudan (oturumdaki kullanici)',
    v_kim = v_kullanici);

  -- 5 · 0094'ün kuralları yerinde mi
  perform prova_bak('saklama sonu partinin SKT''si (0093)',
    (select keep_until from public.witness_sample where id = v_n3) = current_date + 30);
  perform prova_bak('saklama kosulu URUN KARTINDAN kopyalandi (0093)',
    (select storage_condition from public.witness_sample where id = v_n3) = '-18 °C');
  perform prova_bak('acik raf omru URUN KARTINDAN kopyalandi (0094)',
    (select opened_shelf_life_days from public.witness_sample where id = v_n3) = 3);
  perform prova_bak('kimlik anahtari SUNUCUDA turetildi (0094)',
    (select sample_code_key from public.witness_sample where id = v_n3) = 'P112-N3');
end $$;

reset role;

-- ── GÖVDE ÖLÇÜMÜ ──────────────────────────────────────────────────────────
-- ⚠️ TUZAK 181/194: yorumlar ölçümden önce siliniyor; bu göçün kendi
-- yorumları yasakladığı metni içeriyor.
do $$
declare v_govde text;
begin
  select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_turet';

  perform prova_bak('govde: taken_at damgasi var',
    v_govde ~ 'new\.taken_at\s*:=\s*now\(\)');
  perform prova_bak('govde: taken_by damgasi yerinde',
    v_govde ~ 'new\.taken_by\s*:=\s*app\.aktif_kullanici_id\(\)');
  perform prova_bak('govde: kiraci siniri yerinde (MIYOP-075)',
    v_govde ~ 'app\.current_tenant_id\(\)');
end $$;

rollback;
