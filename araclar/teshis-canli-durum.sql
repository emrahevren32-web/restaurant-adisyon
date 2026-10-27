-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · TEŞHİS · 27.10.2026 · Supabase SQL editörüne yapıştır ve ÇALIŞTIR
--
-- Hiçbir şeyi DEĞİŞTİRMEZ, yalnız okur. Çıktı bir TABLODUR — Supabase NOTICE
-- satırlarını göstermediği için bilgi sonuç tablosuyla taşınıyor.
--
-- Her satırın `durum` sütununa bak: "OK" olmayan varsa sonucun tamamını
-- bana olduğu gibi at.
-- ═══════════════════════════════════════════════════════════════════════════
select 'kimlik_anahtari · dört i varyantı' as soru,
       case when app.kimlik_anahtari('İSTANBUL') = app.kimlik_anahtari('istanbul')
            then 'OK' else 'BOZUK · pano kodlaması' end as durum,
       app.kimlik_anahtari('İSTANBUL')||' / '||app.kimlik_anahtari('istanbul') as bulunan
union all
select 'isletme_gostergeleri · finans kapısı',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='app' and p.proname='isletme_gostergeleri'
                            and pg_get_functiondef(p.oid) ~ 'finance\.read')
            then 'OK' else 'KAPI YOK · MIYOP-078' end,
       coalesce((select substring(pg_get_functiondef(p.oid) from 'yetkim_var\(''[a-z.]+''\)')
                   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='app' and p.proname='isletme_gostergeleri'), 'fonksiyon yok')
union all
select 'isletme_gostergeleri_ham · yeni hesap',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='app' and p.proname='isletme_gostergeleri_ham'
                            and pg_get_functiondef(p.oid) ~ 'stock_usable_balance')
            then 'OK' else 'ESKİ HESAP' end, ''
union all
select 'fire_dokumu · kaç tane ve nerede',
       'BİLGİ',
       coalesce((select string_agg(n.nspname||'.'||p.proname, ' | ' order by n.nspname)
                   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where p.proname in ('fire_dokumu','fire_dokumu_ham')), 'hiç yok')
union all
select 'fire_dokumu (app) · finans kapısı',
       case when exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                          where n.nspname='app' and p.proname='fire_dokumu'
                            and pg_get_functiondef(p.oid) ~ 'finance\.read')
            then 'OK' else 'KAPI YOK' end,
       coalesce((select left(replace(pg_get_functiondef(p.oid), chr(10), ' '), 300)
                   from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='app' and p.proname='fire_dokumu'), 'app.fire_dokumu YOK')
union all
select 'witness_sample_event · sonuç kısıtı (0100)',
       case when exists (select 1 from pg_constraint c
                          where c.conrelid='public.witness_sample_event'::regclass
                            and c.conname='witness_sample_event_result_required')
            then 'OK' else 'YOK · 0100 uygulanmamış' end, ''
union all
select 'stock_usable_balance görünümü (0095)',
       case when to_regclass('public.stock_usable_balance') is not null
            then 'OK' else 'YOK' end, ''
union all
select 'numune imha kapısı (0097)',
       case when exists (select 1 from pg_trigger g join pg_class c on c.oid=g.tgrelid
                          where c.relname='witness_sample_event'
                            and g.tgname='izin_numune_olayi' and not g.tgisinternal)
            then 'OK' else 'YOK · 0097 uygulanmamış' end, '';
