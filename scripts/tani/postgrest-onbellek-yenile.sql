-- ═══════════════════════════════════════════════════════════════════════════
-- TANI · PostgREST şema önbelleğini yenile
--
-- ── NE ZAMAN GEREKİR ─────────────────────────────────────────────────────
-- Ekran şöyle bir şey diyorsa:
--     "Could not find the function public.<ad>(...) in the schema cache"
--     "Could not find the table 'public.<ad>' in the schema cache"
--
-- Sebep: fonksiyon/tablo veritabanında VAR, ama Supabase'in REST katmanı
-- (PostgREST) şemanın eski fotoğrafıyla çalışıyor. Yeni göç sonrası
-- fotoğrafın yenilenmesi gerekir.
--
-- ── BU DEPODA ÜÇÜNCÜ KEZ OLDU ────────────────────────────────────────────
--   · 0030 · client_error tablosu görünmedi
--   · 0038 · basvuru_gonder'ın YENİ imzası görünmedi
-- Göçlerin sonuna `notify` satırını koyuyorum ama her zaman yetmiyor;
-- bu yüzden elle çalıştırılabilir bir dosya olarak duruyor.
--
-- Bu bir göç DEĞİL. Veriye dokunmaz, şema değiştirmez. Kaç kez
-- çalıştırılırsa çalıştırılsın sonuç aynıdır.
-- ═══════════════════════════════════════════════════════════════════════════

notify pgrst, 'reload schema';

-- Bilgi: kapının veritabanındaki hâli. Buradaki imza ekranın çağırdığıyla
-- aynıysa sorun kesinlikle önbellektedir.
select n.nspname                                      as sema,
       p.proname                                      as fonksiyon,
       pg_get_function_identity_arguments(p.oid)      as imza
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'app')
   and p.proname in ('basvuru_gonder', 'basvuruyu_onayla')
 order by n.nspname, p.proname;

-- ⚠️ BU DOSYA İŞE YARAMAZSA: Supabase panelinde
--    Settings → General → Restart server
-- Sunucu yeniden başlarken uygulama 20-30 saniye hata verir; veri kaybı YOK.
