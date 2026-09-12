-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · G7 · NEGATİF KONTROL — RLS'i GERİ AÇ
--
-- `g7_rls_kapat.sql`'in tersi. Negatif kontrolden hemen sonra çalıştır.
-- ADR-004: her tabloda `enable` + `force`. `force` satırı unutulmamalı —
-- onsuz tablo sahibi RLS'i atlar ve koruma yarım kalır.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenant         enable row level security;
alter table tenant         force  row level security;
alter table company        enable row level security;
alter table company        force  row level security;
alter table branch         enable row level security;
alter table branch         force  row level security;
alter table app_user       enable row level security;
alter table app_user       force  row level security;
alter table stock_item     enable row level security;
alter table stock_item     force  row level security;
alter table stock_lot      enable row level security;
alter table stock_lot      force  row level security;
alter table stock_movement enable row level security;
alter table stock_movement force  row level security;

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- Yedi satırın hepsinde rls_acik VE rls_zorunlu true olmalı.
select
  c.relname             as tablo,
  c.relrowsecurity      as rls_acik,
  c.relforcerowsecurity as rls_zorunlu
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('tenant','company','branch','app_user','stock_item','stock_lot','stock_movement')
order by c.relname;
