// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · VITEST KURULUM DOSYASI · 01.11.2026
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// Testler **TEK İŞÇİDE, TEK SÜREÇTE** koşuyor (`vitest.config.ts` →
// `singleThread: true`, tuzak 152). Bu bilinçli bir karar: paralel havuz
// 429 saniyede 28 sahte kırmızı veriyordu, tek işçi 8 saniyede sıfır.
//
// ⚠️ AMA BEDELİ ŞU: tek süreçte **modül düzeyindeki her değişken test
// dosyaları arasında PAYLAŞILIR.** Bir dosya onu değiştirip bırakırsa,
// sonraki dosya o değerle başlar ve testin yeşilliği **çalışma sırasına**
// bağlı hâle gelir. Böyle bir kırılma en kötü cinstendir: tek başına yeşil,
// takım içinde kırmızı — ya da tam tersi.
//
// ── ÖLÇÜLDÜ · 01.11.2026 ────────────────────────────────────────────────
// `billing.ts` bugün modül düzeyinde `aktifParaBirimi` tutmaya başladı
// (HEDEFLER 3.4.6). Ölçtük: **o dosyayı içeri alan tek bir test dosyası
// var** (`billing.para-birimi.test.ts`) ve o da kendi `afterEach`'iyle
// temizliyor. Yani BUGÜN sızıntı YOK.
//
// ⚠️ Bu dosya bugünkü bir hatayı düzeltmiyor; YARINKİNİ engelliyor.
// İkinci bir test dosyası `billing`i içeri aldığı gün — ki fiyat
// biçimlendirmesini 38 ekran kullanıyor, olacaktır — sızıntı sessizce
// başlardı. Sıfırlama artık MERKEZÎ: her testten sonra, her dosyada.
//
// ⚠️ Buraya yeni bir sıfırlama eklemeden önce düşün: modül düzeyinde
// durum tutmak zaten son çaredir. `billing`de gerekçesi yazılı
// (`formatCurrency` eşzamanlı ve çizim sırasında çağrılıyor, veritabanı
// okuyamaz). Gerekçesi olmayan bir global, buraya satır eklenerek
// meşrulaştırılmaz — kaldırılır.
// ═══════════════════════════════════════════════════════════════════════════

import { afterEach } from 'vitest'
import { paraBirimiAyarla } from '../../billing'

afterEach(() => {
  // `null` = "işletmenin seçimi henüz okunmadı". Her test bu noktadan
  // başlasın; bir öncekinin seçtiği para birimiyle değil.
  paraBirimiAyarla(null)
})
