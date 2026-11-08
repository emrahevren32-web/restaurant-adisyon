\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0107 · ŞAHİT NUMUNE OKUMA KAPISI (MIYOP-100)
--
-- Sorular:
--   1 · `quality.read` taşımayan kullanıcı numuneyi okuyabiliyor mu?  → HAYIR
--   2 · Olay defterini okuyabiliyor mu?                               → HAYIR
--   3 · `quality.read` taşıyan kullanıcı okuyabiliyor mu?             → EVET
--   4 · Başka işletmenin yetkili kullanıcısı görüyor mu?              → HAYIR
--   5 · Yazma akışı kırıldı mı?                                       → HAYIR
--   6 · Olay yazan tetik numuneyi hâlâ bulabiliyor mu?                → EVET
--   7 · Eski `for all` politikası gerçekten düştü mü?                 → EVET
--
-- ⚠️ `set local role authenticated` TAKILIYOR (MIYOP-042). JWT koymak
-- yetmez: rolü takmayan bir prova kapının DIŞINDA, süper kullanıcı olarak
-- koşar ve RLS hiç devreye girmez — yani tam da ölçülmek istenen şey
-- ölçülmemiş olur.
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

-- ── KURULUM (süper kullanıcı · sahne kurmak ölçüm değildir) ───────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid;
  v_t2 uuid; v_f2 uuid; v_b2 uuid;
  v_rol text; v_auth uuid; v_app uuid;
  v_kalem uuid; v_lot uuid; v_numune uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);

  -- ⚠️ İKİNCİ KİRACI: kiracı duvarının hâlâ durduğunu ölçmek için. İzin
  -- kapısı eklerken kiracı kapısını düşürmek, bir deliği kapatıp
  -- diğerini açmak olurdu.
  v_t2 := gen_random_uuid();
  insert into public.tenant (id, code, name) values (v_t2, 'P107', 'Prova 107 Gida');
  v_f2 := gen_random_uuid();
  insert into public.company (id, tenant_id, company_code, company_name)
    values (v_f2, v_t2, 'P107', 'Prova 107 Gida A.S.');
  v_b2 := gen_random_uuid();
  insert into public.branch (id, tenant_id, company_id, code, name, branch_type, is_head_office)
    values (v_b2, v_t2, v_f2, 'MRK', 'Merkez', 'merkez', true);
  perform set_config('prova.t2', v_t2::text, false);

  -- Kullanıcılar: kalite (quality.read VAR) · personel (quality.read YOK)
  -- · uretim (yazabilir, quality.read VAR) · yabanci (öteki kiracıda)
  foreach v_rol in array array['kalite_sorumlusu','personel','uretim_sorumlusu'] loop
    v_auth := gen_random_uuid(); v_app := gen_random_uuid();
    insert into auth.users (id, email) values (v_auth, 'p107.'||v_rol||'@o.local');
    insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                                 username_key, full_name, role_code, is_active)
    values (v_app, v_t, v_f, v_auth, 'p107'||left(md5(v_rol),6),
            'p107'||left(md5(v_rol),6), v_rol, v_rol, true);
    perform set_config('prova.auth.'||v_rol, v_auth::text, false);
  end loop;

  v_auth := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p107.yabanci@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (gen_random_uuid(), v_t2, v_f2, v_auth, 'p107yab', 'p107yab',
          'Yabanci Kalite', 'kalite_sorumlusu', true);
  perform set_config('prova.auth.yabanci', v_auth::text, false);

  -- ⚠️ SAĞLAMA: rollerin izin durumu VARSAYILMIYOR, ÖLÇÜLÜYOR. Katalog
  -- değişirse bu prova sessizce anlamsızlaşmasın.
  if exists (select 1 from public.role_permission
              where role_code='personel' and permission_code='quality.read') then
    raise exception 'PROVA GECERSIZ: `personel` artik quality.read tasiyor; '
      'bu prova "izinsiz kullanici" olarak onu kullaniyor.';
  end if;
  if not exists (select 1 from public.role_permission
                  where role_code='kalite_sorumlusu' and permission_code='quality.read') then
    raise exception 'PROVA GECERSIZ: `kalite_sorumlusu` quality.read tasimiyor.';
  end if;

  -- Ürün + parti + numune (süper kullanıcı olarak, doğrudan)
  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active,
                                 storage_condition)
  values (v_kalem, v_t, v_b, 'P107-URN', 'p107-urn', 'Prova 107 Urun', 'kg',
          true, true, true, '-18 °C');

  v_lot := gen_random_uuid();
  insert into public.stock_lot (id, tenant_id, branch_id, stock_item_id, lot_code,
                                lot_code_key, expires_on, origin_type)
  values (v_lot, v_t, v_b, v_kalem, 'P107-LOT', 'p107-lot',
          current_date + 90, 'PRODUCTION');
  perform set_config('prova.lot', v_lot::text, false);
  perform set_config('prova.kalem', v_kalem::text, false);
  perform set_config('prova.b', v_b::text, false);

  raise notice 'KURULUM TAMAM';
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid) to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

-- ── 1 · YETKİLİ KULLANICI NUMUNE ALIYOR (yazma akışı kırılmadı) ───────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid; v_id uuid; v_n int;
begin
  raise notice '── YAZMA AKISI';
  perform prova_oturum(current_setting('prova.auth.kalite_sorumlusu')::uuid, v_t);

  insert into public.witness_sample (tenant_id, branch_id, lot_id, sample_code,
                                     sample_code_key, taken_at)
  values (v_t, current_setting('prova.b')::uuid, current_setting('prova.lot')::uuid,
          'P107-N1', 'p107-n1', now())
  returning id into v_id;
  perform prova_bak('kalite sorumlusu numune ALABILIYOR (returning ile)', v_id is not null);
  perform set_config('prova.numune', v_id::text, false);

  -- ⚠️ Olay yazan tetik (`app.numune_olayi`) numuneyi BULABILMELI. O tetik
  -- `security definer` ve sahibi `postgres`; okuma politikası ona engel
  -- olmamalı. Olmasaydı açılış kaydı hiç yazılamazdı.
  insert into public.witness_sample_event (tenant_id, sample_id, event_type, reason, result)
  values (v_t, v_id, 'ACILDI', 'Musteri talebi', 'Urun uygun');
  select count(*) into v_n from public.witness_sample_event where sample_id = v_id;
  perform prova_bak('olay yazildi ve tetik numuneyi buldu (satir: '||v_n||')', v_n >= 1);

  select count(*) into v_n from public.witness_sample where id = v_id and status = 'ACILDI';
  perform prova_bak('durum ACILDI''ya dondu (tetik gercekten calisti)', v_n = 1);
end $$;

-- ── 2 · `quality.read` TAŞIMAYAN KULLANICI OKUYAMIYOR ─────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid; v_n int;
begin
  raise notice '── OKUMA KAPISI';
  perform prova_oturum(current_setting('prova.auth.personel')::uuid, v_t);

  -- ⚠️ "Hata almıyor, SATIR GÖRMÜYOR." RLS reddetmez, süzer. Beklenen
  -- sonuç sıfır satırdır; hata bekleyen bir iddia burada yanılırdı.
  select count(*) into v_n from public.witness_sample;
  perform prova_bak('⚠️ izinsiz kullanici HIC numune gormuyor (gorulen: '||v_n||')', v_n = 0);

  select count(*) into v_n from public.witness_sample_event;
  perform prova_bak('⚠️ izinsiz kullanici OLAY DEFTERINI de gormuyor (gorulen: '||v_n||')',
    v_n = 0);

  -- Numunenin kimliği bilinse bile
  select count(*) into v_n from public.witness_sample
   where id = current_setting('prova.numune')::uuid;
  perform prova_bak('kimligi bilinen numune de gorunmuyor', v_n = 0);
end $$;

-- ── 3 · YETKİLİ KULLANICI OKUYABİLİYOR ────────────────────────────────────
do $$
declare v_t uuid := current_setting('prova.t')::uuid; v_n int; v_sebep text;
begin
  perform prova_oturum(current_setting('prova.auth.kalite_sorumlusu')::uuid, v_t);

  select count(*) into v_n from public.witness_sample
   where id = current_setting('prova.numune')::uuid;
  perform prova_bak('kalite sorumlusu numuneyi GORUYOR', v_n = 1);

  select e.reason into v_sebep from public.witness_sample_event e
   where e.sample_id = current_setting('prova.numune')::uuid and e.event_type = 'ACILDI';
  perform prova_bak('acilis gerekcesini de goruyor (gelen: '||coalesce(v_sebep,'YOK')||')',
    v_sebep = 'Musteri talebi');

  -- ⚠️ Kontrol boşlukta yeşil yanmasın: izinli kullanıcı için sayı
  -- gerçekten sıfırdan büyük olmalı, yoksa 2. bölüm de anlamsızdı.
  select count(*) into v_n from public.witness_sample;
  perform prova_bak('izinli kullanici icin liste BOS DEGIL (gorulen: '||v_n||')', v_n > 0);
end $$;

-- ── 4 · KİRACI DUVARI HÂLÂ DURUYOR ────────────────────────────────────────
do $$
declare v_n int;
begin
  raise notice '── KIRACI DUVARI';
  -- Yetkili ama BAŞKA işletmeden
  perform prova_oturum(current_setting('prova.auth.yabanci')::uuid,
                       current_setting('prova.t2')::uuid);
  select count(*) into v_n from public.witness_sample;
  perform prova_bak('⚠️ baska isletmenin YETKILI kullanicisi gormuyor (gorulen: '||v_n||')',
    v_n = 0);
  select count(*) into v_n from public.witness_sample_event;
  perform prova_bak('baska isletme olay defterini de gormuyor', v_n = 0);
end $$;

-- ── 5 · OTURUMSUZ HİÇBİR ŞEY GÖRMÜYOR ─────────────────────────────────────
do $$
declare v_n int;
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claims', '{}', false);
  perform set_config('app.tenant_id', '', false);
  select count(*) into v_n from public.witness_sample;
  perform prova_bak('oturumsuz kullanici hicbir numune gormuyor', v_n = 0);
end $$;

reset role;

-- ── 6 · POLİTİKA YAPISI ───────────────────────────────────────────────────
do $$
declare v_n int;
begin
  raise notice '── POLITIKA YAPISI';
  select count(*) into v_n from pg_policies
   where schemaname='public' and tablename in ('witness_sample','witness_sample_event')
     and cmd='ALL';
  perform prova_bak('⚠️ eski `for all` politikasi DUSTU (kalan: '||v_n||')', v_n = 0);

  select count(*) into v_n from pg_policies
   where schemaname='public' and tablename in ('witness_sample','witness_sample_event')
     and cmd='SELECT' and qual like '%quality.read%';
  perform prova_bak('iki okuma politikasi da izni soruyor (bulunan: '||v_n||')', v_n = 2);

  -- ⚠️ Yazma kapısı TETİKTE kalmalı; RLS'e kopyalamak iki gerçek üretirdi.
  perform prova_bak('yazma kapisi tetigi yerinde',
    exists (select 1 from pg_trigger
             where tgrelid = 'public.witness_sample'::regclass
               and tgname = 'izin_witness_sample' and not tgisinternal));
end $$;

rollback;
