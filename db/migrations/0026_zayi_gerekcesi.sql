-- ═══════════════════════════════════════════════════════════════════════════
-- MİYOP · Aşama 4 / Güven katmanı
-- 0026 — Fire, zayi ve imha kayıtlarında gerekçe zorunlu
--
-- Yol haritası maddesi:
--   "Fire, zayi, SKT geçmiş lot imhası" → üçü ayrı sebep koduyla VE gerekçeyle
--
-- ── NEDEN VERİTABANINDA ──────────────────────────────────────────────────
-- Kural şu anda üç yerde birden duruyor: ekranda (alan zorunlu), serviste
-- (`DepoServisi.cikis` GerekceGerekliError fırlatır) ve buradan sonra
-- defterde. Üçü fazlalık değil, üç ayrı saldırı yüzeyi:
--
--   Ekran   → kullanıcıyı yönlendirir, ama başka ekran yazabilir.
--   Servis  → tüm ekranları kapsar, ama SQL konsolundan yazan kapsanmaz.
--   Defter  → her yolu kapatır. Son söz burada.
--
-- Sayım kilidiyle (0025) aynı gerekçe: "ekranda düğmeyi kapatmak kilit
-- değildir".
--
-- ── NEDEN "NOT VALID" ────────────────────────────────────────────────────
-- Kısıt yalnızca BUNDAN SONRAKİ satırlara uygulanıyor. Mevcut kayıtlar
-- kural yokken yazıldı; onları geriye dönük geçersiz saymak, geçmişi
-- bugünün kuralıyla yargılamak olurdu — ve migration eski veri yüzünden
-- çakılırdı. Defter append-only: eski satırlara gerekçe EKLEYEMEYİZ zaten.
--
-- Geçmişi de zorlamak istenirse (temizlik sonrası):
--   alter table stock_movement validate constraint stock_movement_zayi_gerekce_check;
--
-- ── NEDEN 3 KARAKTER ─────────────────────────────────────────────────────
-- Uygulamadaki `gerekceYeterliMi` ile aynı eşik. "x" ya da "." yazıp geçmek
-- kuralı boşa çıkarırdı; 3 karakter en azından bir kelime demek. Anlamlı
-- gerekçeyi yazılım zorlayamaz — bunu denetim ve amir zorlar. Yazılımın
-- yapabileceği, alanın BOŞ geçilememesidir.
-- ═══════════════════════════════════════════════════════════════════════════

alter table stock_movement drop constraint if exists stock_movement_zayi_gerekce_check;

alter table stock_movement add constraint stock_movement_zayi_gerekce_check
  check (
    reason not in ('WASTE', 'LOSS', 'EXPIRY_WRITE_OFF')
    or (note is not null and length(btrim(note)) >= 3)
  )
  not valid;

-- ── Doğrulama ─────────────────────────────────────────────────────────────
-- Beklenen: bir satır, convalidated = false (yalnızca yeni kayıtlara uygulanır)
select conname, convalidated as gecmise_de_uygulaniyor
from pg_constraint
where conname = 'stock_movement_zayi_gerekce_check';
