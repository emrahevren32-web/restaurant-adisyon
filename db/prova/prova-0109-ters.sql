\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- TERS PROVA 0109 · DAMGAYI KALDIRINCA PROVA GERÇEKTEN KIRMIZI VERİYOR MU
--
-- ⚠️ NEDEN VAR: `prova-0109.sql` yeşil yanıyor. Ama bir damga provası,
-- damga OLMASAYDI DA yeşil yanıyorsa hiçbir şey ölçmüyordur. Bu dosya
-- `app.numune_olayi()`yi 0109 ÖNCESİNİN hâline — `coalesce(new.occurred_at,
-- now())` — geri alıp istemcinin gelecek tarihinin saklama kuralını
-- GERÇEKTEN etkisiz bıraktığını gösteriyor.
--
-- ⚠️ Geri alınan gövde, 0094'ün gövdesinin AYNISI: yalnız `v_an` satırı
-- farklı. Kapıları (kiracı, satır kilidi, least) kaldırmıyoruz; yoksa
-- kırmızının sebebi belirsiz kalırdı.
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
  v_t uuid; v_f uuid; v_b uuid; v_auth uuid; v_kalem uuid; v_lot uuid; v_i int;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);

  v_auth := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p109t.kalite@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (gen_random_uuid(), v_t, v_f, v_auth, 'p109tkal', 'p109tkal',
          'Ters 109 Kalite', 'kalite_sorumlusu', true);
  perform set_config('prova.auth', v_auth::text, false);

  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition, opened_shelf_life_days)
  values (v_kalem, v_t, v_b, 'P109T-URN', 'p109t-urn', 'Ters 109 Urun', 'kg',
          true, true, true, '-18 °C', 2);

  for v_i in 1..2 loop
    v_lot := gen_random_uuid();
    insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                  lot_code_key, expires_on, origin_type)
    values (v_lot, v_t, v_b, v_kalem, 'P109T-LOT'||v_i, 'p109t-lot'||v_i,
            current_date + 20, 'PRODUCTION');
    perform set_config('prova.lot'||v_i, v_lot::text, false);
  end loop;
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid) to authenticated;
grant usage on schema public to authenticated;

-- ── ÖNCE · DAMGA YERİNDEYKEN GELECEK TARİH İŞLEMİYOR ─────────────────────
set local role authenticated;

do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_n uuid; v_sonra date;
begin
  perform prova_oturum(current_setting('prova.auth')::uuid, v_t);
  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, current_setting('prova.b')::uuid, current_setting('prova.lot1')::uuid,
          'P109T-N1', 'x', now())
  returning id into v_n;

  insert into public.witness_sample_event (tenant_id, sample_id, event_type,
                                           occurred_at, reason, result)
  values (v_t, v_n, 'ACILDI', now() + interval '30 days', 'Gelecek tarih', 'Uygun');
  select keep_until into v_sonra from public.witness_sample where id = v_n;
  perform prova_bak('damga yerindeyken GELECEK tarih ise yaramiyor (keep_until '
    ||v_sonra||')', v_sonra = current_date + 2);
end $$;

reset role;

-- ── DAMGA KALDIRILIYOR: 0109 ÖNCESİNİN HÂLİ ──────────────────────────────
create or replace function app.numune_olayi()
returns trigger
language plpgsql security definer set search_path = public, app, pg_temp
as $$
declare
  v_kiraci uuid;
  v_durum  text;
  v_acik   integer;
  v_an     timestamptz;
begin
  v_kiraci := app.current_tenant_id();
  if v_kiraci is null then
    raise exception 'MİYOP: oturumda işletme kimliği yok; numune kaydı yazılamaz.'
      using errcode = 'MI403';
  end if;
  new.tenant_id     := v_kiraci;
  new.actor_user_id := app.aktif_kullanici_id();
  v_an              := coalesce(new.occurred_at, now());

  select s.status, s.opened_shelf_life_days
    into v_durum, v_acik
    from public.witness_sample s
   where s.id = new.sample_id and s.tenant_id = v_kiraci
     for update;

  if v_durum is null then
    raise exception 'MİYOP: numune bulunamadı.' using errcode = 'MI404';
  end if;
  if v_durum = 'IMHA' then
    raise exception 'MİYOP: imha edilmiş numuneye yeni kayıt eklenemez.'
      using errcode = 'MI409';
  end if;

  if new.event_type = 'ACILDI' then
    update public.witness_sample s
       set status = 'ACILDI',
           keep_until = case when v_acik is null then s.keep_until
                             else least(s.keep_until, (v_an::date + v_acik)) end
     where s.id = new.sample_id and s.tenant_id = v_kiraci;
  elsif new.event_type = 'IMHA' then
    update public.witness_sample s set status = 'IMHA'
     where s.id = new.sample_id and s.tenant_id = v_kiraci;
  end if;

  return new;
end $$;

set local role authenticated;

-- ── SONRA · DAMGA YOKKEN GELECEK TARİH KURALI İPTAL EDİYOR ───────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_n uuid; v_skt date; v_sonra date;
begin
  perform prova_oturum(current_setting('prova.auth')::uuid, v_t);
  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, current_setting('prova.b')::uuid, current_setting('prova.lot2')::uuid,
          'P109T-N2', 'x', now())
  returning id, keep_until into v_n, v_skt;

  insert into public.witness_sample_event (tenant_id, sample_id, event_type,
                                           occurred_at, reason, result)
  values (v_t, v_n, 'ACILDI', now() + interval '30 days', 'Gelecek tarih', 'Uygun');
  select keep_until into v_sonra from public.witness_sample where id = v_n;

  -- ⚠️ BU SATIRIN YEŞİL YANMASI, KUSURUN GERÇEK OLDUĞUNUN KANITIDIR.
  -- 0109 öncesinde açılmış bir numune, SKT'ye kadar (burada 20 gün yerine
  -- 2 gün olmalıydı) mühürlüymüş gibi davranıyordu.
  perform prova_bak('⚠️ DAMGA YOKKEN gelecek tarih saklama sonunu KISALTMADI — '
    ||'kusur gercekti (keep_until '||v_sonra||', dogrusu '||(current_date+2)||')',
    v_sonra = v_skt and v_sonra <> current_date + 2);
end $$;

reset role;
rollback;
