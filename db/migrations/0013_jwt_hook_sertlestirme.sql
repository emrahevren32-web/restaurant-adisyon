-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Dilim 0 / G6 — JWT hook sertleştirme
-- 0013 — Pasif kullanıcı ve askıya alınmış tenant artık claim almaz
--
-- ⚠️ NEDEN BU MIGRATION VAR (Codex incelemesi, 2026-08-26):
--
--   0009'daki hook YALNIZCA `auth_user_id` eşleşmesine bakıyordu:
--       select tenant_id from app_user where auth_user_id = ...
--
--   Yani `app_user.is_active = false` yapılmış (işten çıkarılmış) bir kullanıcı
--   ve `tenant.status = 'Askıda'` (ödemesi durmuş) bir tenant, jeton yenilendiği
--   her seferinde `tenant_id` claim'ini almaya DEVAM ediyordu. RLS bu claim'e
--   bakarak satırları açtığı için, pasif kullanıcı doğrudan REST çağrısıyla
--   tenant verisine erişmeyi sürdürebilirdi.
--
--   Uygulamanın giriş kodu (`storage.ts` içindeki `authenticateUser`) pasif
--   kullanıcıyı zaten reddedip oturumu kapatıyor — ama bu YALNIZCA uygulamanın
--   kendi giriş ekranından geçenler için geçerli. Elinde geçerli bir refresh
--   token'ı olan biri uygulamayı hiç açmadan jeton yenileyebilir. Kapı,
--   uygulamada değil, jetonu basan yerde kapatılmalı.
--
-- ÇÖZÜM: hook sorgusu aktif kullanıcı + aktif tenant ile sınırlanıyor ve
-- eşleşme yoksa claim AÇIKÇA siliniyor (`claims - 'tenant_id'`). Açıkça
-- silmek önemli: 0009 eşleşme bulamadığında claim'e hiç dokunmuyordu, yani
-- daha önce basılmış bir claim taşınabilirdi.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function app.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims      jsonb;
  v_tenant_id uuid;
begin
  -- Aktif kullanıcı VE aktif tenant şartı. Herhangi biri sağlanmazsa
  -- v_tenant_id null kalır ve aşağıda claim silinir.
  select u.tenant_id
    into v_tenant_id
  from public.app_user u
  join public.tenant   t on t.id = u.tenant_id
  where u.auth_user_id = (event ->> 'user_id')::uuid
    and u.is_active
    and t.status = 'Aktif'
  limit 1;

  claims := event -> 'claims';

  if v_tenant_id is not null then
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
  else
    -- AÇIKÇA sil. Eşleşme yoksa claim'e "dokunmamak" yetmez: pasife alınmış
    -- bir kullanıcının jetonu yenilenirken eski claim taşınabilirdi.
    claims := claims - 'tenant_id';
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

comment on function app.custom_access_token_hook(jsonb) is
  'Supabase Auth "Customize Access Token" hook''u. AKTİF kullanıcının AKTİF tenant''ının '
  'kimliğini JWT''nin tenant_id claim''ine yazar; şartlar sağlanmazsa claim''i siler. '
  'app.current_tenant_id() (0001) bunu okur. Bkz. 0009 (ilk hâli) ve 0013 (sertleştirme).';

-- ── İzinler ──────────────────────────────────────────────────────────────
-- 0009 yalnızca app_user için okuma izni ve politikası vermişti. Sorgu artık
-- `tenant` tablosuna da katılıyor; tenant'ta da RLS açık + FORCE (0001) ve
-- hook çalıştığı anda JWT henüz basılmadığı için app.current_tenant_id() NULL
-- döner — mevcut tenant_self_isolation politikası supabase_auth_admin'i süzer.
-- Bu yüzden aynı desende dar bir okuma izni + politika gerekiyor.
grant select on table public.tenant to supabase_auth_admin;

drop policy if exists tenant_auth_admin_read on public.tenant;
create policy tenant_auth_admin_read on public.tenant
  as permissive
  for select
  to supabase_auth_admin
  using (true);

-- 0009'daki app_user izinleri hâlâ gerekli — tekrar çalıştırılabilir olsun
-- diye burada da tekrarlanıyor (aynı sonucu verir).
grant usage  on schema app             to supabase_auth_admin;
grant select on table public.app_user  to supabase_auth_admin;
grant execute on function app.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function app.custom_access_token_hook(jsonb) from authenticated, anon, public;

drop policy if exists app_user_auth_admin_read on public.app_user;
create policy app_user_auth_admin_read on public.app_user
  as permissive
  for select
  to supabase_auth_admin
  using (true);

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- Hook'un şu an hangi kullanıcılara claim BASACAĞINI gösterir. Pasif kullanıcı
-- veya aktif olmayan tenant satırlarında `claim_alir_mi` false olmalı.
select
  u.username                                        as kullanici,
  u.is_active                                       as kullanici_aktif,
  t.code                                            as tenant,
  t.status                                          as tenant_durumu,
  (u.is_active and t.status = 'Aktif')              as claim_alir_mi
from public.app_user u
join public.tenant   t on t.id = u.tenant_id
order by t.code, u.username;

-- ⚠️ Dashboard adımı TEKRAR GEREKMEZ: hook zaten etkin (0009'da yapıldı) ve
-- aynı şema/fonksiyon adına bakıyor — `create or replace` gövdeyi değiştirir,
-- kaydı değil. Ama değişiklik yalnızca YENİ basılan jetonlara yansır; açık
-- oturumlar bir sonraki jeton yenilemesinde (ya da çıkış/giriş ile) etkilenir.
