-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · G7 · NEGATİF KONTROL — RLS'i KAPAT
--
-- ⛔⛔⛔ BU DOSYAYI ÜRETİM PROJESİNDE ASLA ÇALIŞTIRMA. ⛔⛔⛔
--      Çalıştırırsan tüm müşteri verisi birbirine açılır.
--      Yalnızca G7 sınama projesinde, yalnızca birkaç dakikalığına.
--
-- Yol haritası maddesi:
--   "RLS kapatıldığında testler kırmızıya dönüyor mu?"
--   Bitti sayılır ki: "Dönüyorsa test gerçekten izolasyonu ölçüyor"
--
-- ── NEDEN BÖYLE BİR ŞEY YAPIYORUZ ─────────────────────────────────────────
-- Geçen bir test, doğru sebepten mi geçiyor? Bunu bilmenin tek yolu, ölçtüğünü
-- iddia ettiği şeyi BOZUP testin kırıldığını görmektir. İzolasyon testi RLS
-- kapalıyken de yeşil kalıyorsa, o test izolasyonu değil başka bir şeyi
-- ölçüyordur (ör. uygulamanın kendi filtresini) ve bize yanlış güven verir.
--
-- ── SIRA ──────────────────────────────────────────────────────────────────
--   1. npm run test:live      → YEŞİL olmalı (izolasyon çalışıyor)
--   2. bu dosyayı çalıştır    → RLS kapanır
--   3. npm run test:live      → KIRMIZI olmalı  ← kanıt bu adımdadır
--   4. g7_rls_ac.sql çalıştır → RLS geri açılır
--   5. npm run test:live      → tekrar YEŞİL olmalı
--
-- 4. adımı atlarsan sınama projen korumasız kalır. Zaten sahte veri var ama
-- alışkanlık iyi olsun: kapattığını geri aç.
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenant         disable row level security;
alter table company        disable row level security;
alter table branch         disable row level security;
alter table app_user       disable row level security;
alter table stock_item     disable row level security;
alter table stock_lot      disable row level security;
alter table stock_movement disable row level security;

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- Yedi satırın hepsinde rls_acik = false olmalı.
select
  c.relname   as tablo,
  c.relrowsecurity as rls_acik,
  c.relforcerowsecurity as rls_zorunlu
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('tenant','company','branch','app_user','stock_item','stock_lot','stock_movement')
order by c.relname;
