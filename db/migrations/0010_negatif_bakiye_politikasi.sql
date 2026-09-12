-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Production Foundation · Dilim 0 / G6 — I12 şeması
-- 0010 — tenant.negative_stock_policy
--
-- ADR-001 I12: "Negatif bakiye politikası (allow/warn/block) tenant ayarına
-- göre davranır." Bu ayarı tutacak bir sütun 0001-0009'un hiçbirinde yoktu —
-- bu migration onu ekliyor. Tekrar çalıştırılabilir: sütun zaten varsa
-- hiçbir şey yapmaz (`add column if not exists`), veri kaybetmez.
--
-- ⛔ BU DOSYANIN İLK HÂLİNDEKİ ŞU İDDİA YANLIŞTI (2026-08-26, Codex incelemesi):
--
--     "Zorlama veritabanı tetikleyicisinde DEĞİL, uygulama katmanındadır.
--      Bu bilinçli bir tercih: veritabanı seviyesinde sert bir `check` kısıtı,
--      'warn' ve 'allow' politikalarını imkansız kılardı."
--
-- Gerekçenin `check` kısmı doğru, çıkarılan SONUÇ yanlıştı. Bir `check` kısıtı
-- gerçekten politikayı okuyamaz — ama bir TETİKLEYİCİ okuyabilir ve yalnızca
-- 'block' politikasında reddedebilir; 'warn'/'allow' hiç etkilenmez.
--
-- Uygulama katmanına bırakılan zorlama ise aslında hiç zorlama değildi:
-- `0006_yetkiler.sql` her `authenticated` kullanıcıya `stock_movement`
-- üzerinde doğrudan INSERT verdiği için kontrol tek bir REST çağrısıyla
-- atlanabiliyordu, ayrıca okuma ile yazma arasında TOCTOU yarışı vardı.
--
-- Bu dosya YERİNDE KALIYOR — sütunu o ekliyor ve üretimde çalıştırıldı.
-- Gerçek zorlama:            0011_negatif_bakiye_zorlamasi.sql
-- Politikayı kim değiştirir: 0012_yetki_sertlestirme.sql
-- ═══════════════════════════════════════════════════════════════════════════

alter table tenant
  add column if not exists negative_stock_policy text not null default 'block'
  check (negative_stock_policy in ('allow', 'warn', 'block'));

comment on column tenant.negative_stock_policy is
  'ADR-001 I12 — postMovement() bakiyeyi negatife düşürecek bir hareketle karşılaşınca: '
  '''allow'' sessizce izin verir, ''warn'' izin verip Movement.warning''i doldurur, '
  '''block'' (varsayılan) hareketi reddeder. Zorlama app.stock_movement_negative_guard() '
  'tetikleyicisindedir (0011); repository katmanındaki kontrol hızlı başarısızlık ve '
  'uyarı metni içindir. Bu sütunu yalnızca app.set_negative_stock_policy() değiştirebilir (0012).';

-- ── Doğrulama ────────────────────────────────────────────────────────────
-- Her tenant satırı görünmeli, hepsinde negative_stock_policy dolu (varsayılan 'block').
select code, name, negative_stock_policy from tenant order by code;
