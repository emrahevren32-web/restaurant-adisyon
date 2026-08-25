-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Dilim 0 / G3
-- 0005 — Referans tablolarına okuma politikası
--
-- SORUN: Supabase projesinde "Enable automatic RLS" açık olduğu için, public
-- şemasında açılan HER tabloda RLS otomatik etkinleşiyor. Bu iyi bir varsayılan,
-- ama politikasız RLS = herkese kapalı demektir.
--
-- Beş tablo bundan etkilendi: permission, role, role_permission, uom,
-- uom_conversion. Bunlar tenant'a ait DEĞİLDİR — ürünün sabit referans
-- listeleridir ve her oturum açmış kullanıcı okuyabilmelidir. Politika
-- eklenmezse uygulama ilk isteğinde "izin yok" alır: kullanıcı yetkilerini
-- çözemez, kg'ı grama çeviremez.
--
-- Yazma politikası KASTEN eklenmiyor. Bu tablolar yalnızca migration ile
-- (süper kullanıcı olarak) değişir; uygulama onlara yazamaz.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  v_tablo text;
begin
  foreach v_tablo in array array['permission','role','role_permission','uom','uom_conversion']
  loop
    execute format('alter table %I enable row level security', v_tablo);
    execute format('alter table %I force  row level security', v_tablo);
    execute format('drop policy if exists %I on %I', v_tablo || '_read_all', v_tablo);
    execute format(
      'create policy %I on %I for select using (true)',
      v_tablo || '_read_all', v_tablo
    );
  end loop;
end $$;

-- ── Doğrulama ──────────────────────────────────────────────────────────────
-- Her tablonun RLS durumu ve kaç politikası olduğu. Politikasız RLS'li tablo
-- kalmamalı: "politika" sütunu 0 olan satır, o tabloya kimsenin erişemeyeceği
-- anlamına gelir.
select
  c.relname                                             as tablo,
  case when c.relrowsecurity      then 'açık' else 'KAPALI' end as rls,
  case when c.relforcerowsecurity then 'evet' else 'hayır'  end as force,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as politika
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;
