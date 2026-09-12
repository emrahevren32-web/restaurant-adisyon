-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Dilim 0 / G6 — JWT tenant_id claim'i
-- 0009 — Custom Access Token Hook: app_user.tenant_id'yi JWT'ye enjekte eder
--
-- ⚠️ NEDEN GEREKLİ: `app.current_tenant_id()` (bkz. 0001) `tenant_id`'yi iki
-- yerden okur: `request.jwt.claims ->> 'tenant_id'` (Supabase Auth JWT'si) ya
-- da `app.tenant_id` oturum ayarı (migration/test/script bağlantıları için).
-- Uygulama tarafı (`PostgresStockRepository`, G6.5) Supabase Auth'un normal
-- oturum jetonuyla bağlanır — ama bu proje şu ana kadar JWT'ye `tenant_id`
-- YAZAN hiçbir mekanizma kurmamıştı. Sonuç: uygulama canlıda bağlansa bile
-- `app.current_tenant_id()` NULL döner, RLS "yabancı" sayıp HER sorguda sıfır
-- satır döndürür. Bu bir güvenlik açığı DEĞİL (RLS varsayılan kapalı/güvenli
-- taraf) ama gerçek bir işlevsel engel — bu migration'la kapatılıyor.
--
-- Bu dosya yalnızca fonksiyonu ve izinleri kurar. Devreye ALINMASI için
-- Supabase Dashboard'da BİR kerelik, sırsız bir adım gerekir — dosya
-- sonundaki "Dashboard adımı" bölümüne bakın.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Hook fonksiyonu ──────────────────────────────────────────────────────
-- Supabase'in "Customize Access Token (JWT) Claims" hook sözleşmesi:
-- `(event jsonb) returns jsonb`, event->>'user_id' çağıran kullanıcının
-- auth.users.id'sidir, event->'claims' o ana kadar biriken claim kümesidir.
-- Resmi örnek public şemasında verilir; bu projede altyapı fonksiyonları
-- `app` şemasında toplandığı için (bkz. 0001, app.current_tenant_id()) aynı
-- yerde tutuyoruz.
create or replace function app.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims      jsonb;
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id
  from public.app_user
  where auth_user_id = (event ->> 'user_id')::uuid
  limit 1;

  claims := event -> 'claims';

  if v_tenant_id is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

comment on function app.custom_access_token_hook(jsonb) is
  'Supabase Auth "Customize Access Token" hook''u. app_user.tenant_id''yi '
  'JWT''nin tenant_id claim''ine yazar — app.current_tenant_id() (0001) bunu okur.';

-- ── İzinler ──────────────────────────────────────────────────────────────
-- Hook'u YALNIZCA Supabase'in kendi auth sunucusu (supabase_auth_admin)
-- çalıştırabilir. Resmi örnekle birebir aynı desen (bkz. Supabase dokümanı
-- "Customizing Access Token (JWT) Claims").
grant usage on schema app to supabase_auth_admin;

grant execute
  on function app.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

revoke execute
  on function app.custom_access_token_hook(jsonb)
  from authenticated, anon, public;

-- app_user'da RLS açık + FORCE (0001). Hook çalıştığı anda JWT henüz
-- basılmadığı için app.current_tenant_id() NULL döner — mevcut
-- app_user_tenant_isolation politikası supabase_auth_admin'i de süzer.
-- Bu yüzden supabase_auth_admin'e ayrı, dar bir okuma izni ve politikası
-- gerekir (yalnızca SELECT, yalnızca bu rol için).
grant select on table public.app_user to supabase_auth_admin;

drop policy if exists app_user_auth_admin_read on public.app_user;
create policy app_user_auth_admin_read on public.app_user
  as permissive
  for select
  to supabase_auth_admin
  using (true);

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- Fonksiyon kuruldu mu ve izinler doğru mu — veri değiştirmez.
select
  p.proname                                   as fonksiyon,
  n.nspname                                   as sema,
  has_function_privilege('supabase_auth_admin', p.oid, 'execute') as auth_admin_calisirabilir_mi
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'app' and p.proname = 'custom_access_token_hook';

-- ═══════════════════════════════════════════════════════════════════════════
-- Dashboard adımı (BİR KEZ, sırsız — SQL Editor'de değil, Dashboard'da yapılır)
--
-- 1. Supabase Dashboard → ilgili proje → Authentication → Hooks (Auth Hooks).
-- 2. "Customize Access Token (JWT) Claims hook" bölümünü bul.
-- 3. "Enable hook" aç, tür olarak "Postgres Function" seç.
-- 4. Şema: app  ·  Fonksiyon: custom_access_token_hook  seç.
-- 5. Kaydet.
--
-- ⚠️ Bundan sonra: hook yalnızca YENİ basılan JWT'leri etkiler. Emrah'ın o an
-- açık oturumu varsa (tarayıcıda oturum açmış durumda), tenant_id claim'ini
-- almak için ÇIKIŞ YAPIP TEKRAR GİRİŞ yapması gerekir — mevcut jeton otomatik
-- yenilenmez. Yeni giriş yapan her kullanıcı otomatik olarak claim'i alır.
--
-- Devreye alındıktan sonra hızlı sağlama (tarayıcı konsolunda, oturum açıkken):
--   supabase.auth.getSession().then(s => console.log(
--     JSON.parse(atob(s.data.session.access_token.split('.')[1])).tenant_id
--   ))
-- `undefined` değil, tenant UUID'si basılmalı.
-- ═══════════════════════════════════════════════════════════════════════════
