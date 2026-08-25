-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Dilim 0 / G4
-- 0006 — Rol yetkileri (GRANT) ve görünüm güvenliği
--
-- İKİ AYRI KATMAN, karıştırılmamalı:
--
--   GRANT  → "bu role bu tabloya erişebilir mi?"   (masaya oturma izni)
--   RLS    → "hangi satırları görebilir?"           (tabaktakiler)
--
-- RLS politikası yazmak yetmez; GRANT yoksa PostgreSQL 42501 döndürür.
-- Bağlantı testi tam olarak bunu yakaladı.
-- ═══════════════════════════════════════════════════════════════════════════

grant usage on schema public to anon, authenticated;
grant usage on schema app    to anon, authenticated;

grant execute on function app.current_tenant_id()                  to anon, authenticated;
grant execute on function app.convert_uom(numeric, text, text)     to anon, authenticated;

-- ── Referans tabloları: okuma herkese açık ─────────────────────────────────
-- Bunlar ürünün sabit listeleridir (kg, g, lt / izin kodları / rol adları).
-- Müşteri verisi değildir, gizli değildir. Yazma yetkisi KİMSEYE verilmiyor:
-- bu tablolar yalnızca migration ile değişir.
grant select on uom, uom_conversion, permission, role, role_permission
  to anon, authenticated;

-- ── Tenant kapsamlı tablolar: yalnızca oturum açmış kullanıcı ──────────────
-- Satır süzmesini RLS yapar; GRANT sadece kapıyı açar.
-- `anon` bu tabloların hiçbirine erişemez — oturum açmadan müşteri verisi yok.
grant select, insert, update on
  tenant, company, branch, app_user, user_branch_access,
  stock_item, stock_lot, lot_genealogy
  to authenticated;

-- DELETE yetkisi hiçbir tabloda verilmiyor. Silme yerine pasife alma
-- (is_active = false) kullanılır; kayıt kaybolmaz, iz kalır.

-- ── Defter: oku ve ekle, o kadar ───────────────────────────────────────────
-- UPDATE ve DELETE verilmiyor. Tetikleyici zaten reddediyor ama yetkiyi de
-- vermiyoruz: iki bağımsız savunma hattı.
grant select, insert on stock_movement to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- GÖRÜNÜM GÜVENLİĞİ — bu bölüm atlanırsa RLS delinir
--
-- PostgreSQL'de görünümler varsayılan olarak SAHİBİNİN yetkileriyle çalışır.
-- Yani `stock_balance` görünümünü sorgulayan bir kullanıcı, altındaki
-- `stock_movement` tablosunun RLS politikasını ATLAR ve TÜM tenant'ların
-- stoklarını görür.
--
-- `security_invoker = on` bunu tersine çevirir: görünüm, onu çağıran
-- kullanıcının yetkileriyle çalışır ve RLS uygulanır.
--
-- Bu, RLS kurulmuş bir sistemde en sık gözden kaçan açıktır.
-- ═══════════════════════════════════════════════════════════════════════════

alter view stock_balance     set (security_invoker = on);
alter view stock_lot_balance set (security_invoker = on);

grant select on stock_balance, stock_lot_balance to authenticated;

-- ── Doğrulama ──────────────────────────────────────────────────────────────
select
  c.relname as nesne,
  case c.relkind when 'r' then 'tablo' when 'v' then 'görünüm' end as tur,
  case
    when c.relkind = 'v' then
      case when 'security_invoker=on' = any(c.reloptions) then 'evet' else 'HAYIR' end
    else '—'
  end as security_invoker,
  coalesce((
    select string_agg(distinct g.grantee, ', ' order by g.grantee)
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.table_name = c.relname
      and g.grantee in ('anon','authenticated')
  ), '(yok)') as yetkili_roller
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','v')
order by c.relkind desc, c.relname;
