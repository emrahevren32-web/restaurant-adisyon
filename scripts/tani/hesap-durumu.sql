-- ═══════════════════════════════════════════════════════════════════════════
-- TANI · Giriş hesabı açma denemesi ne yaptı?
--
-- Bu dosya bir GÖÇ DEĞİL, hiçbir şeyi değiştirmez. Yalnız okur.
-- Supabase SQL Editor'de TAMAMINI seçip çalıştırın.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1 · 0039 uygulandı mı? ───────────────────────────────────────────────
-- Beklenen: iki satır (invited_at, owner_user_id).
select column_name as kolon
  from information_schema.columns
 where table_schema = 'public' and table_name = 'business_application'
   and column_name in ('invited_at', 'owner_user_id')
 order by 1;

-- ── 2 · Kapılar yerinde mi? ──────────────────────────────────────────────
-- Beklenen: public.isletme_kullanicisi_ac, public.yetkim_var,
--           app.isletme_kullanicisi_ac, app.yetkim_var
select n.nspname as sema, p.proname as fonksiyon
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where p.proname in ('isletme_kullanicisi_ac', 'yetkim_var')
 order by 1, 2;

-- ── 3 · `authenticated` bu tabloda ne yapabiliyor? ───────────────────────
-- ⚠️ EKRANDAKİ HATANIN ASIL SORUSU BU.
-- Beklenen: SELECT satırı MUTLAKA olmalı. Yoksa yetki gerçekten kayıp.
select privilege_type as yetki
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'business_application'
   and grantee = 'authenticated'
 order by 1;

-- ── 4 · `anon` ne yapabiliyor? ───────────────────────────────────────────
-- Beklenen: yalnızca INSERT, ve yalnız belirli kolonlarda. SELECT OLMAMALI.
-- Ekranda "permission denied" görülüyorsa istek anon olarak gitmiş demektir.
select privilege_type as yetki, column_name as kolon
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'business_application'
   and grantee = 'anon'
 order by 1, 2;

-- ── 5 · Davet gerçekten açıldı mı? ───────────────────────────────────────
select a.reference as numara, a.company_name as firma, a.status as durum,
       a.invited_at as davet_zamani,
       u.username as acilan_kullanici, u.role_code as rolu, u.is_active as aktif
  from business_application a
  left join app_user u on u.id = a.owner_user_id
 order by a.created_at;

-- ── 6 · Emrah'ın hesabı bozulmuş mu? ─────────────────────────────────────
-- Beklenen: tek satır, aktif, rol 'admin'.
select u.username, u.role_code, u.is_active, u.auth_user_id,
       (select count(*) from user_role r where r.user_id = u.id) as ek_rol_adedi
  from app_user u
 where u.auth_user_id = '141939e8-5779-43af-b468-9cbc8ee2b1fb';

-- ── 7 · Kaç kullanıcı var? ───────────────────────────────────────────────
select t.code as kiraci, u.username as kullanici, u.role_code as rol
  from app_user u join tenant t on t.id = u.tenant_id
 order by t.code, u.username;
