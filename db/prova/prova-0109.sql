\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0109 · NUMUNE OLAY ZAMANI SUNUCUDAN DAMGALANIYOR (MIYOP-101)
--
-- Sorular:
--   1 · Açık raf ömrü numuneye karttan kopyalandı mı?   → EVET (fikstür sağlaması)
--   2 · Normal yolda saklama sonu kısalıyor mu?          → EVET (bugün + 2)
--   3 · İstemci GELECEK tarih gönderince de kısalıyor mu?→ EVET (artık)
--   4 · İstemci GEÇMİŞ tarih gönderince fazla kısalıyor mu? → HAYIR
--   5 · Olay satırının kendi `occurred_at`ı sunucu anı mı?  → EVET
--   6 · Fonksiyon gövdesinde `coalesce(new.occurred_at` kaldı mı? → HAYIR
--   7 · 0094'ün kapıları yerinde mi (kiracı, satır kilidi, least)? → EVET
--
-- ⚠️ `set local role authenticated` TAKILIYOR (MIYOP-042). Rol takmayan
-- prova süper kullanıcı olarak koşar ve her yazım sessizce geçer.
--
-- ⚠️ FİKSTÜR SAĞLAMASI NEDEN VAR: bu kusurun İLK ölçümü yanıltıcıydı.
-- Ürün kartına açık raf ömrü yazılmamıştı; `v_acik` NULL olduğu için
-- `keep_until` gelecek tarih yüzünden değil, kuralın hiç işlemediği için
-- sabit kalmıştı. Yani "kusur doğrulandı" çıktısı YANLIŞ SEBEBE bağlıydı.
-- O yüzden bu prova ölçmeden önce fikstürün kendisini ölçüyor.
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
  v_t uuid; v_f uuid; v_b uuid; v_auth uuid; v_kalem uuid; v_lot uuid; v_i int;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);

  v_auth := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p109.kalite@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (gen_random_uuid(), v_t, v_f, v_auth, 'p109kal', 'p109kal',
          'Prova 109 Kalite', 'kalite_sorumlusu', true);
  perform set_config('prova.auth', v_auth::text, false);

  -- ⚠️ AÇIK RAF ÖMRÜ ÜRÜN KARTINDA (0094): tetik numuneye BURADAN kopyalar.
  -- Ekrandan gelen değer yok sayılır; o yüzden kartı doldurmadan ölçüm
  -- yapmak kuralı hiç çalıştırmaz.
  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition, opened_shelf_life_days)
  values (v_kalem, v_t, v_b, 'P109-URN', 'p109-urn', 'Prova 109 Urun', 'kg',
          true, true, true, '-18 °C', 2);

  -- ⚠️ ÜÇ AYRI PARTİ: "aynı partide ikinci açık numune olamaz" kuralı (0093)
  -- tek parti kullanılırsa ikinci ve üçüncü yazımı YANLIŞ sebeple reddederdi.
  -- SKT bugünden 20 gün sonra: açık raf ömrü (2 gün) SKT'den DAHA YAKIN,
  -- yani `least()` gerçekten kısaltmak zorunda.
  for v_i in 1..3 loop
    v_lot := gen_random_uuid();
    insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                  lot_code_key, expires_on, origin_type)
    values (v_lot, v_t, v_b, v_kalem, 'P109-LOT'||v_i, 'p109-lot'||v_i,
            current_date + 20, 'PRODUCTION');
    perform set_config('prova.lot'||v_i, v_lot::text, false);
  end loop;
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid) to authenticated;
grant usage on schema public to authenticated;
set local role authenticated;

-- ── ÖLÇÜM ─────────────────────────────────────────────────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_n1 uuid; v_n2 uuid; v_n3 uuid;
  v_skt date; v_s1 date; v_s2 date; v_s3 date;
  v_omur int; v_damga timestamptz; v_fark interval;
begin
  perform prova_oturum(current_setting('prova.auth')::uuid, v_t);

  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, v_b, current_setting('prova.lot1')::uuid, 'P109-N1', 'x', now())
  returning id, keep_until into v_n1, v_skt;
  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, v_b, current_setting('prova.lot2')::uuid, 'P109-N2', 'x', now())
  returning id into v_n2;
  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, v_b, current_setting('prova.lot3')::uuid, 'P109-N3', 'x', now())
  returning id into v_n3;

  -- 1 · FİKSTÜR SAĞLAMASI. Bu kırmızı yanarsa ölçümün geri kalanı anlamsızdır.
  select opened_shelf_life_days into v_omur from public.witness_sample where id = v_n1;
  perform prova_bak('fikstur: acik raf omru numuneye kopyalandi (deger: '
    ||coalesce(v_omur::text,'YOK')||')', v_omur = 2);
  perform prova_bak('fikstur: muhurlu numunenin saklama sonu partinin SKT''si ('
    ||v_skt||')', v_skt = current_date + 20);

  -- 2 · NORMAL YOL · ekran `occurred_at` göndermez (repository ölçüldü).
  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
  values (v_t, v_n1, 'ACILDI', 'Normal yol', 'Urun uygun');
  select keep_until into v_s1 from public.witness_sample where id = v_n1;
  perform prova_bak('normal yolda saklama sonu KISALDI (bugun+2 = '||(current_date+2)
    ||', olculen '||v_s1||')', v_s1 = current_date + 2);

  -- 3 · GELECEK TARİH · MIYOP-101'in ta kendisi.
  insert into public.witness_sample_event (tenant_id, sample_id, event_type,
                                           occurred_at, reason, result)
  values (v_t, v_n2, 'ACILDI', now() + interval '30 days', 'Gelecek tarih', 'Urun uygun');
  select keep_until into v_s2 from public.witness_sample where id = v_n2;
  perform prova_bak('GELECEK tarihli olayda da saklama sonu KISALDI (olculen '
    ||v_s2||', SKT '||v_skt||')', v_s2 = current_date + 2);

  -- 4 · GEÇMİŞ TARİH · damga tek yönlü değil: geçmiş tarih de yok sayılmalı.
  -- Yoksa istemci saklama sonunu HAKSIZ YERE kısaltıp numuneyi erken
  -- imha edilebilir gösterebilirdi.
  insert into public.witness_sample_event (tenant_id, sample_id, event_type,
                                           occurred_at, reason, result)
  values (v_t, v_n3, 'ACILDI', now() - interval '10 days', 'Gecmis tarih', 'Urun uygun');
  select keep_until into v_s3 from public.witness_sample where id = v_n3;
  perform prova_bak('GECMIS tarihli olay saklama sonunu FAZLA kisaltmadi (olculen '
    ||v_s3||', yanlis olan '||(current_date-8)||')', v_s3 = current_date + 2);

  -- 5 · OLAY SATIRININ KENDİ DAMGASI.
  select occurred_at into v_damga from public.witness_sample_event where sample_id = v_n2;
  v_fark := now() - v_damga;
  perform prova_bak('olayin occurred_at''i sunucu ani (fark '||v_fark||')',
    v_fark between interval '-5 seconds' and interval '5 seconds');
end $$;

reset role;

-- ── GÖVDE ÖLÇÜMÜ ──────────────────────────────────────────────────────────
-- ⚠️ TUZAK 181: `pg_get_functiondef` yorumları da döndürüyor; ölçümden
-- önce yorumlar siliniyor. Aksi hâlde 0109'un kendi açıklama satırındaki
-- `coalesce(new.occurred_at` yazısı provayı yanıltırdı.
do $$
declare v_govde text;
begin
  select regexp_replace(pg_get_functiondef(p.oid), '--[^\n]*', '', 'g') into v_govde
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'app' and p.proname = 'numune_olayi';

  perform prova_bak('govde: sunucu damgasi var',
    v_govde ~ 'new\.occurred_at\s*:=\s*now\(\)');
  perform prova_bak('govde: coalesce(new.occurred_at ... ) KALMADI',
    v_govde !~ 'coalesce\s*\(\s*new\.occurred_at');
  perform prova_bak('govde: kiraci siniri yerinde (MIYOP-075)',
    v_govde ~ 'app\.current_tenant_id\(\)');
  perform prova_bak('govde: satir kilidi yerinde (MIYOP-077)',
    v_govde ~* 'for\s+update');
  perform prova_bak('govde: least() yerinde (saklama sonu uzayamaz)',
    v_govde ~ 'least');
  perform prova_bak('tetik bagli',
    exists (select 1 from pg_trigger g join pg_class c on c.oid = g.tgrelid
             where c.relname = 'witness_sample_event' and g.tgname = 'numune_olayi'
               and not g.tgisinternal));
end $$;

rollback;
