-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Dilim 0 / G4
-- 0007 — `anon` rolünü müşteri verisinden tamamen çıkar
--
-- BULGU: 0006 sonrası yetki tablosunda TÜM tablolarda `anon, authenticated`
-- göründü. Oysa 0006 `anon`'a yalnızca referans tablolarını vermişti.
--
-- Kaynağı: Supabase projesindeki "Automatically expose new tables" ayarı.
-- public şemasında açılan her tabloyu Data API rollerine otomatik açıyor.
-- Yani `tenant`, `company`, `stock_movement` dahil her şeye oturum açmamış
-- istemcinin GRANT'i vardı.
--
-- Şu an veri sızmıyor — RLS satırları süzüyor. Ama bu, koruma tek katmana
-- inmiş demektir. ADR-004'ün tamamı "bir katmanın hatası müşteri verisini
-- açığa çıkarmasın" üzerine kurulu. Politikada yapılacak tek bir yazım hatası,
-- GRANT de varken doğrudan sızıntıya dönerdi.
--
-- Bu yüzden `anon` müşteri verisinden tamamen çıkarılıyor: iki bağımsız
-- savunma hattı geri geliyor.
-- ═══════════════════════════════════════════════════════════════════════════

revoke all privileges on
  tenant, company, branch, app_user, user_branch_access,
  stock_item, stock_lot, stock_movement, lot_genealogy
  from anon;

revoke all privileges on stock_balance, stock_lot_balance from anon;

-- Bundan sonra public şemasında açılacak tablolar da `anon`'a otomatik
-- açılmasın. Referans tablosu gerekirse GRANT'i elle, bilerek verilir.
alter default privileges in schema public revoke all on tables from anon;

-- Referans tabloları açık kalır: ürünün sabit listeleri, müşteri verisi değil.
grant select on uom, uom_conversion, permission, role, role_permission to anon;

-- ── Doğrulama ──────────────────────────────────────────────────────────────
-- Beklenen: yalnızca beş referans tablosunda `anon` görünmeli.
-- Diğer her satırda sadece `authenticated` olmalı.
select
  c.relname as nesne,
  case c.relkind when 'r' then 'tablo' when 'v' then 'görünüm' end as tur,
  coalesce((
    select string_agg(distinct g.grantee, ', ' order by g.grantee)
    from information_schema.role_table_grants g
    where g.table_schema = 'public'
      and g.table_name = c.relname
      and g.grantee in ('anon','authenticated')
  ), '(yok)') as yetkili_roller,
  case
    when exists (
      select 1 from information_schema.role_table_grants g
      where g.table_schema = 'public' and g.table_name = c.relname and g.grantee = 'anon'
    ) and c.relname not in ('uom','uom_conversion','permission','role','role_permission')
    then '!! anon erisebiliyor'
    else 'tamam'
  end as durum
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r','v')
order by durum desc, c.relname;
