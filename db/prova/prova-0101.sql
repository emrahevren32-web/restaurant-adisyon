\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- PROVA 0101 · FİRE DÖKÜMÜ FİNANS KAPISI
--
-- 27.10 canlı teşhis: `app.fire_dokumu` finans kapısı YOK. Fire dökümü
-- TUTAR taşıyor; kapısı olmayan bir rapor, maliyeti herkese gösterir.
--
-- Sorular:
--   1 · Kapı duruyor mu, `definer` değil mi, içinde ham hesap var mı?
--   2 · Ham hesap `_ham`'da mı, içinde kapı var mı?
--   3 · Dış yüzey (public) KAPIYI mı çağırıyor, `_ham`'ı mı?
--   4 · anon çağırabiliyor mu?                        → ÇAĞIRAMAMALI
--   5 · FİNANS İZNİ OLMAYAN dökümü okuyabiliyor mu?   → OKUYAMAMALI
--   6 · Finans izni OLAN okuyabiliyor mu?             → OKUYABİLMELİ
--   7 · Kapıdan geçen çağrı GERÇEK fireyi döndürüyor mu?
--
-- ⚠️ Ölçüm bloğu `set local role authenticated` İÇİNDE koşuyor: RLS açık,
-- yani gerçek bir kullanıcının gördüğü neyse o ölçülüyor.
--
-- ⚠️ 5 ve 6 bu provanın ASIL işi. Yapısal kontrol (1–4) kapının METNİNİ
-- ölçer; 5 ve 6 kapının ÇALIŞTIĞINI ölçer. MIYOP-078'de yapısal kontrolüm
-- yeşildi ve kapı yoktu — çünkü olumsuz kontrol yoktu (tuzak 131).
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

-- ── 1–4 · YAPISAL ──────────────────────────────────────────────────────────
do $$
declare
  v_kapi text; v_ham text; v_dis text; v_definer boolean;
begin
  select p.prosrc, p.prosecdef into v_kapi, v_definer
    from pg_proc p where p.oid = to_regprocedure('app.fire_dokumu(uuid, date, date)');
  perform prova_bak('1a · app.fire_dokumu VAR', v_kapi is not null);
  perform prova_bak('1b · kapı finance.read soruyor',
    v_kapi like '%yetkim_var(''finance.read'')%');
  perform prova_bak('1c · kapı `security definer` DEĞİL', v_definer is false);
  perform prova_bak('1d · kapının gövdesinde ham hesap YOK',
    v_kapi not like '%stock_movement%');

  select p.prosrc, p.prosecdef into v_ham, v_definer
    from pg_proc p where p.oid = to_regprocedure('app.fire_dokumu_ham(uuid, date, date)');
  perform prova_bak('2a · app.fire_dokumu_ham VAR', v_ham is not null);
  perform prova_bak('2b · hesap _ham''da', v_ham like '%stock_movement%');
  perform prova_bak('2c · _ham''da kapı YOK', v_ham not like '%yetkim_var%');
  perform prova_bak('2d · _ham `security definer` DEĞİL', v_definer is false);

  select p.prosrc into v_dis
    from pg_proc p where p.oid = to_regprocedure('public.fire_dokumu(uuid, date, date)');
  perform prova_bak('3a · public.fire_dokumu VAR', v_dis is not null);
  perform prova_bak('3b · dış yüzey KAPIYI çağırıyor', v_dis like '%app.fire_dokumu(%');
  perform prova_bak('3c · dış yüzey _ham''ı ATLAMIYOR',
    v_dis not like '%fire_dokumu_ham%');

  perform prova_bak('4 · anon public.fire_dokumu''yu ÇAĞIRAMIYOR',
    not has_function_privilege('anon',
      'public.fire_dokumu(uuid, date, date)'::regprocedure, 'execute'));
end $$;

-- ── KURULUM · iki kullanıcı ve gerçek bir fire ─────────────────────────────
do $$
declare
  v_t uuid; v_f uuid; v_b uuid; v_auth uuid; v_app uuid; v_kalem uuid;
begin
  select t.id into v_t from public.tenant t limit 1;
  select c.id into v_f from public.company c where c.tenant_id = v_t limit 1;
  select b.id into v_b from public.branch  b where b.tenant_id = v_t limit 1;
  perform set_config('prova.t', v_t::text, false);
  perform set_config('prova.b', v_b::text, false);
  perform set_config('app.tenant_id', v_t::text, false);

  -- Finans izni OLAN
  v_auth := gen_random_uuid(); v_app := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p101@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_t, v_f, v_auth, 'p101', 'p101', 'Prova 101',
          'isletme_sahibi', true);
  perform set_config('prova.auth', v_auth::text, false);

  -- ⚠️ Finans izni OLMAYAN. `depo_sorumlusu` rolünde `finance.read` YOK;
  -- aşağıda bunu VARSAYMIYORUM, ÖLÇÜYORUM (5a).
  v_auth := gen_random_uuid(); v_app := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p101.depo@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (v_app, v_t, v_f, v_auth, 'p101depo', 'p101depo', 'Prova 101 Depo',
          'depo_sorumlusu', true);
  perform set_config('prova.auth.depo', v_auth::text, false);

  -- Gerçek bir fire: 10 kg alındı, 4 kg SKT'den imha.
  v_kalem := gen_random_uuid();
  insert into public.stock_item (id, tenant_id, branch_id, code, code_key, name,
                                 base_uom, tracks_lot, tracks_expiry, is_active, min_qty)
  values (v_kalem, v_t, v_b, 'P101-FIRE', 'p101-fire', 'Fire Kalemi', 'kg',
          false, false, true, 0);
  -- ⚠️ `note` ZORUNLU: `stock_movement_zayi_gerekce_check` WASTE / LOSS /
  -- EXPIRY_WRITE_OFF için en az 3 karakter gerekçe istiyor. İlk yazışımda
  -- yazmadım ve prova kırmızı verdi — kısıt haklıydı: gerekçesiz zayi
  -- kaydı, sonradan kimseye hesap vermeyen bir kayıttır.
  insert into public.stock_movement (tenant_id, branch_id, stock_item_id,
    quantity_base, quantity_entered, uom_entered, reason, source_type,
    idempotency_key, occurred_at, note)
  values
    (v_t, v_b, v_kalem, 10, 10, 'kg', 'PURCHASE_RECEIPT', 'manual', 'p101:1', now(), null),
    (v_t, v_b, v_kalem, -4,  4, 'kg', 'EXPIRY_WRITE_OFF', 'manual', 'p101:2', now(),
     'SKT gecti, prova kaydi');
  perform set_config('prova.kalem', v_kalem::text, false);
end $$;

-- ── İSTEMCİ ROLÜ ───────────────────────────────────────────────────────────
-- ⚠️ 27.10 · İLK YAZIŞIMDA BU SATIR YOKTU ve mimari test
-- (`yazma-kapilari-tamam.arch.test.ts`) provayı **KÖR PROVA** diye kırmızı
-- verdi — haklıydı. JWT koymak yetmez: `set local role authenticated`
-- yapılmazsa prova tablo sahibi olarak koşar, **RLS atlanır** ve ölçüm
-- "gerçek bir kullanıcı bunu okuyabiliyor mu" sorusuna cevap vermez.
-- MI403 yine gelirdi (izin kontrolü JWT'ye bakıyor) ama 6b ve 7 YANLIŞ
-- SEBEPLE yeşil olurdu: RLS'siz okunan bir rapor, kapıyı değil sahipliği
-- ölçer. MIYOP-042'nin ta kendisi (tuzak: kör prova).
grant execute on function prova_bak(text,boolean), prova_oturum(uuid) to authenticated;
grant usage on schema public to authenticated;

set local role authenticated;

-- ── 5–7 · KAPI ÇALIŞIYOR MU (asıl ölçüm) ───────────────────────────────────
do $$
declare
  v_t uuid := current_setting('prova.t')::uuid;
  v_b uuid := current_setting('prova.b')::uuid;
  v_kalem uuid := current_setting('prova.kalem')::uuid;
  v_kod text; v_miktar numeric; v_izin boolean;
begin
  -- ── Finans izni OLMAYAN oturum ──
  perform prova_oturum(current_setting('prova.auth.depo')::uuid);

  -- ⚠️ Rolün izni YOK diye VARSAYMIYORUM; ölçüyorum. Varsaysaydım ve rol
  -- bir gün `finance.read` alsaydı, 5b sessizce anlamsızlaşırdı.
  v_izin := app.yetkim_var('finance.read');
  perform prova_bak('5a · depo_sorumlusu''nda finance.read YOK (ölçüldü)',
    v_izin is false);

  begin
    perform * from public.fire_dokumu(v_b, current_date - 30, current_date);
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('5b · FİNANS izni olmayan fire dökümünü OKUYAMIYOR '
    '(gelen: '||v_kod||')', v_kod = 'MI403');

  -- ── Finans izni OLAN oturum ──
  perform prova_oturum(current_setting('prova.auth')::uuid);

  perform prova_bak('6a · isletme_sahibi''nde finance.read VAR (ölçüldü)',
    app.yetkim_var('finance.read'));

  begin
    select d.miktar into v_miktar
      from public.fire_dokumu(v_b, current_date - 30, current_date) d
     where d.kalem_id = v_kalem;
    v_kod := '00000';
  exception when others then v_kod := sqlstate; v_miktar := null;
  end;
  perform prova_bak('6b · FİNANS izni olan OKUYABİLİYOR (gelen: '||v_kod||')',
    v_kod = '00000');

  -- ⚠️ 7 · Kapıyı onarmak raporu BOZMAMALI. "Kapı var ama rapor boş"
  -- da bir arıza. 4 kg imha yazdım; döküm 4 demeli.
  perform prova_bak('7 · kapıdan geçen çağrı GERÇEK fireyi döndürüyor '
    '(gelen: '||coalesce(v_miktar::text,'NULL')||' kg)', v_miktar = 4);
end $$;

reset role;
do $$ begin raise notice '═══ PROVA 0101 · HEPSİ YEŞİL ═══'; end $$;

rollback;
