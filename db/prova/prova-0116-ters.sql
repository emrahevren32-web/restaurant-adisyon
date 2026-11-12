\set ON_ERROR_STOP on
begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- TERS PROVA 0116 · KUSUR GERÇEK MİYDİ
--
-- 0116'nın yazdığı fonksiyon 0106'daki ESKİ gövdesine geri çevriliyor ve
-- aynı çağrının platform yöneticisine HAM İNDEKS HATASI döndürdüğü
-- gösteriliyor. Sonunda `rollback`.
--
-- ⚠️ Eski gövde bu dosyaya 0106'dan HARFİ HARFİNE alındı; "eskisi böyleydi"
-- diye yeniden yazılmadı. Yeniden yazılan bir "eski hâl", kusuru değil
-- benim hatırladığımı ölçerdi.
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
-- ⚠️ Talepler doğrudan tabloya yazılıyor: `callback_request` hiçbir istemci
-- rolüne açık değil (0106), sahneyi kurmanın başka yolu yok. ÖLÇÜLEN şey
-- sahne değil, durum yazma kapısı — o `authenticated` rolüyle çağrılıyor.
do $$
declare
  v_pt uuid; v_pf uuid; v_kt uuid; v_kf uuid; v_auth uuid;
begin
  select t.id into v_pt from public.tenant t where t.is_platform limit 1;
  if v_pt is null then raise exception 'KURULUM: is_platform kiraci yok'; end if;
  select c.id into v_pf from public.company c where c.tenant_id = v_pt limit 1;

  v_auth := gen_random_uuid();
  insert into auth.users (id, email) values (v_auth, 'p116T.platform@o.local');
  insert into public.app_user (id, tenant_id, company_id, auth_user_id, username,
                               username_key, full_name, role_code, is_active)
  values (gen_random_uuid(), v_pt, v_pf, v_auth, 'p116Tplatform', 'p116Tplatform',
          'Prova 116T Platform', 'super_admin', true);
  perform set_config('prova.auth.platform', v_auth::text, false);
  perform set_config('prova.pt', v_pt::text, false);

  -- A numarası: eski KAPALI talep + yeni AÇIK talep (çakışma sahnesi)
  insert into public.callback_request
    (reference, full_name, phone, company_name, best_time, consent_at,
     consent_version, status, contact_note, created_at)
  values ('GER-P116T-A1','Prova Eski','5321160001','Prova A Ltd','FARKETMEZ', now(),
          'prova','CLOSED','ilk not satiri', now() - interval '3 days');
  insert into public.callback_request
    (reference, full_name, phone, company_name, best_time, consent_at, consent_version)
  values ('GER-P116T-A2','Prova Yeni','5321160001','Prova A Ltd','FARKETMEZ', now(), 'prova');

  -- B numarası: yalnız KAPALI talep (meşru yeniden açma)
  insert into public.callback_request
    (reference, full_name, phone, company_name, best_time, consent_at,
     consent_version, status, contact_note, created_at)
  values ('GER-P116T-B1','Prova Tek','5321160002','Prova B Ltd','FARKETMEZ', now(),
          'prova','CLOSED','b ilk not', now() - interval '2 days');
end $$;

grant execute on function prova_bak(text,boolean), prova_oturum(uuid,uuid)
  to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- ── ÖNCE · 0116 yerindeyken ──────────────────────────────────────────────
set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);
do $$
declare v_kod text;
begin
  perform prova_bak('sağlama: çağıranın platform.manage izni VAR',
    app.yetkim_var('platform.manage'));
  begin
    perform public.geri_arama_durumu_yaz('GER-P116T-A1', 'NEW', 'deneme');
    v_kod := '00000';
  exception when others then v_kod := sqlstate;
  end;
  perform prova_bak('0116 yerindeyken çakışma MI409 veriyor ('||v_kod||')', v_kod = 'MI409');
end $$;
reset role;

-- ── KURAL GERİ ÇEVRİLİYOR · 0106'nın gövdesi ─────────────────────────────
create or replace function app.geri_arama_durumu_yaz(
  p_reference text,
  p_status    text,
  p_note      text default null
)
returns void
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_ben     uuid;
  v_ad      text;
  v_satir   public.callback_request;
  v_durum   text;
  v_not     text;
  v_satirim text;
begin
  if not app.yetkim_var('platform.manage') then
    raise exception 'Geri arama talebini yalnızca EVREN360 platform yöneticisi güncelleyebilir.'
      using errcode = 'MI403';
  end if;

  -- ⚠️ İMZAYI SUNUCU ATAR. "Kim aradı" istemciden gelmiyor; parametresi
  -- bile yok (0087'nin kuralı).
  v_ben := app.aktif_kullanici_id();
  if v_ben is null then
    raise exception 'Bu işlem için oturum gerekiyor.' using errcode = 'MI403';
  end if;
  select full_name into v_ad from public.app_user where id = v_ben;

  v_durum := upper(btrim(coalesce(p_status, '')));
  if v_durum not in ('NEW','CONTACTED','CLOSED') then
    raise exception 'Geçersiz durum: %', p_status using errcode = 'MI422';
  end if;

  select * into v_satir from public.callback_request where reference = btrim(p_reference);
  if not found then
    raise exception 'Geri arama talebi bulunamadı: %', p_reference using errcode = 'MI404';
  end if;

  v_not := nullif(btrim(coalesce(p_note, '')), '');

  -- Kapatmak bir karardır: gerekçesiz kapanış, kapanmamış bir talepten
  -- kötüdür — liste temiz görünür, yapılan iş kayıtsız kalır.
  if v_durum = 'CLOSED' and v_not is null then
    raise exception 'Talebi kapatırken kısa bir not yazın (ne oldu?).'
      using errcode = 'MI422';
  end if;

  -- Not BİRİKİYOR, üstüne yazılmıyor.
  v_satirim := to_char(now(), 'DD.MM.YYYY HH24:MI')
    || ' · ' || coalesce(v_ad, '(ad yok)')
    || ' · ' || v_durum
    || coalesce(' · ' || v_not, '');

  update public.callback_request
     set status       = v_durum,
         contact_note = coalesce(contact_note || E'\n', '') || v_satirim,
         -- İlk aramanın imzası bir daha değişmiyor.
         contacted_at = case when contacted_at is null and v_durum <> 'NEW'
                             then now() else contacted_at end,
         contacted_by = case when contacted_by is null and v_durum <> 'NEW'
                             then v_ben else contacted_by end,
         updated_at   = now(),
         updated_by   = v_ben
   where reference = btrim(p_reference);
end $$;

-- ── SONRA · eski gövdeyle ────────────────────────────────────────────────
set local role authenticated;
select prova_oturum(current_setting('prova.auth.platform')::uuid,
                    current_setting('prova.pt')::uuid);
do $$
declare v_kod text; v_metin text;
begin
  begin
    perform public.geri_arama_durumu_yaz('GER-P116T-A1', 'NEW', 'deneme');
    v_kod := '00000'; v_metin := '';
  exception when others then v_kod := sqlstate; v_metin := sqlerrm;
  end;
  -- ⚠️ BU SATIRLARIN YEŞİL YANMASI, KUSURUN GERÇEK OLDUĞUNUN KANITIDIR.
  perform prova_bak('⚠️ ESKİ GÖVDEYLE cevap HAM 23505 idi ('||v_kod||') — kusur gerçekti',
    v_kod = '23505');
  perform prova_bak('⚠️ ve cümlede ham indeks adı vardı: '||v_metin,
    v_metin ~ 'callback_request_acik_talep_tekil');
end $$;
reset role;

do $$ begin raise notice '──── 0116 ters provası: TAMAM'; end $$;
rollback;
