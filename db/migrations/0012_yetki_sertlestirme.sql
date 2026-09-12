-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Dilim 0 / G6 — Yetki sertleştirme
-- 0012 — tenant ve app_user üzerinde yetki yükseltmesini kapatır
--
-- ⚠️ NEDEN BU MIGRATION VAR (Codex incelemesi, 2026-08-26):
--
--   `0006_yetkiler.sql` şunu yazıyordu:
--       grant select, insert, update on tenant, company, branch, app_user, ...
--         to authenticated;
--
--   RLS bu tablolarda "hangi SATIRI" görebileceğini süzüyor — ama "hangi
--   SÜTUNU yazabileceğini" süzmüyor. Sonuç, iki gerçek yetki yükseltmesi:
--
--   (a) tenant.negative_stock_policy — sıradan bir kullanıcı doğrudan REST
--       çağrısıyla politikayı 'allow' yapıp I12'yi kendi tenant'ı için
--       kapatabilirdi. (Codex'in doğrudan bulduğu madde.)
--
--   (b) DAHA AĞIRI — Codex'in maddesi buraya kadar gitmiyordu ama aynı kusurun
--       aynı satırdaki devamı: `app_user` üzerindeki UPDATE yetkisi
--       `role_code` sütununu da kapsıyordu. Yani HERHANGİ bir personel
--       kendi satırında `role_code = 'admin'` yazıp yönetici olabilirdi.
--       Aynı şekilde `tenant.status`'u 'Aktif' yapıp askıya alınmış bir
--       tenant kendi askısını kaldırabilirdi. Bunlar tek satırlık REST
--       çağrılarıydı.
--
-- ÇÖZÜM: tablo seviyesi UPDATE kaldırılıyor, yerine YALNIZCA zararsız
-- sütunlara kolon seviyesi UPDATE veriliyor. PostgreSQL'de tablo seviyesi bir
-- GRANT varken tek bir sütunu REVOKE etmek İŞE YARAMAZ (kolon ve tablo
-- yetkileri ayrı tutulur) — bu yüzden önce tablo yetkisi tamamen kaldırılıp
-- sonra istenen sütunlar tek tek veriliyor. Sıra önemlidir.
--
-- Politika değişikliği için yetki kontrollü bir RPC bırakılıyor
-- (`app.set_negative_stock_policy`) — yönetici bunu çağırabilir, personel
-- çağıramaz.
--
-- ✅ KIRILMA RİSKİ İNCELENDİ: `src/` içinde Supabase üzerinden `tenant` veya
-- `app_user` tablosuna YAZAN tek bir çağrı yok (yalnızca `storage.ts:5082`
-- bir SELECT yapıyor — giriş akışı). Bu migration bugünkü hiçbir ekranı
-- bozmaz. Dilim 1'de gerçek kullanıcı yönetimi geldiğinde, kullanıcı
-- oluşturma/rol atama işlemleri bu RPC ile aynı desende yetki kontrollü
-- fonksiyonlar olarak yazılmalıdır — doğrudan tablo INSERT/UPDATE'i ile değil.
--
-- Tekrar çalıştırılabilir (idempotent).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. tenant: yalnızca görünen adı değiştirilebilir ──────────────────────
-- code (kimlik), status (askı durumu) ve negative_stock_policy (I12) artık
-- doğrudan yazılamaz. Tenant satırı oluşturmak da platform işidir (bkz. 0008).
revoke insert, update on tenant from authenticated;
grant  update (name, updated_at) on tenant to authenticated;

-- ── 2. app_user: yalnızca kendi profil bilgileri ──────────────────────────
-- role_code, is_active, tenant_id, company_id, username, username_key ve
-- auth_user_id artık doğrudan yazılamaz — yetki yükseltmesinin kapısı buydu.
revoke insert, update on app_user from authenticated;
grant  update (full_name, phone, profile_photo_url, updated_at) on app_user
  to authenticated;

-- ── 3. Politika değişikliği için yetki kontrollü RPC ──────────────────────
-- SECURITY DEFINER: fonksiyon sahibinin yetkileriyle çalışır (RLS'i atlar),
-- bu yüzden yetkilendirmeyi fonksiyonun KENDİSİ yapmak zorundadır. Hedef
-- tenant kullanıcıdan parametre olarak ALINMAZ — çağıranın kendi oturumundan
-- türetilir; böylece başka bir tenant'ın politikasına dokunulamaz.
create or replace function app.set_negative_stock_policy(p_policy text)
returns text
language plpgsql
security definer
set search_path = public, app, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  if p_policy is null or p_policy not in ('allow', 'warn', 'block') then
    raise exception 'Geçersiz negatif stok politikası: %. allow, warn veya block olmalı.', p_policy
      using errcode = 'MI400';
  end if;

  select u.tenant_id
    into v_tenant_id
  from public.app_user u
  join public.tenant   t on t.id = u.tenant_id
  where u.auth_user_id = auth.uid()
    and u.is_active
    and u.role_code = 'admin'
    and t.status    = 'Aktif';

  if v_tenant_id is null then
    raise exception 'Bu işlem için aktif tenant''ta yönetici yetkisi gerekir.'
      using errcode = 'MI403';
  end if;

  update public.tenant
     set negative_stock_policy = p_policy,
         updated_at            = now()
   where id = v_tenant_id;

  return p_policy;
end $$;

comment on function app.set_negative_stock_policy(text) is
  'ADR-001 I12 — tenant negatif stok politikasını değiştirir. Yalnızca aktif tenant''ın '
  'aktif yöneticisi çağırabilir. Hedef tenant çağıranın oturumundan türetilir, '
  'parametre olarak alınmaz. Bkz. 0012 başlığı.';

revoke execute on function app.set_negative_stock_policy(text) from public, anon;
grant  execute on function app.set_negative_stock_policy(text) to authenticated;

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- `authenticated` rolünün tenant ve app_user üzerinde HANGİ sütunlarda UPDATE
-- yetkisi kaldığını listeler. Beklenen:
--   tenant   → name, updated_at
--   app_user → full_name, phone, profile_photo_url, updated_at
-- Bu listede role_code, is_active, status veya negative_stock_policy
-- GÖRÜNMEMELİ.
select
  table_name  as tablo,
  column_name as yazilabilir_sutun
from information_schema.column_privileges
where grantee     = 'authenticated'
  and privilege_type = 'UPDATE'
  and table_schema = 'public'
  and table_name in ('tenant', 'app_user')
order by table_name, column_name;

-- Tablo seviyesinde UPDATE/INSERT kalmadığını da doğrula — bu sorgu
-- tenant/app_user için UPDATE veya INSERT satırı DÖNDÜRMEMELİ.
select
  table_name     as tablo,
  privilege_type as kalan_tablo_yetkisi
from information_schema.role_table_grants
where grantee = 'authenticated'
  and table_schema = 'public'
  and table_name in ('tenant', 'app_user')
  and privilege_type in ('INSERT', 'UPDATE')
order by table_name, privilege_type;
