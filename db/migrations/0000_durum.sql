-- ═══════════════════════════════════════════════════════════════════════════
-- Durum kontrolü — hiçbir şey değiştirmez, sadece ne kurulduğunu gösterir.
--
-- "politika" sütunu önemlidir: RLS açık ama politikası 0 olan bir tablo,
-- süper kullanıcı dışında HERKESE kapalıdır.
-- ═══════════════════════════════════════════════════════════════════════════

select
  c.relname                                                     as tablo,
  (select count(*) from information_schema.columns col
    where col.table_schema = 'public' and col.table_name = c.relname) as kolon,
  case when c.relrowsecurity      then 'açık' else 'KAPALI' end as rls,
  case when c.relforcerowsecurity then 'evet' else 'hayır'  end as force,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname)  as politika
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;
