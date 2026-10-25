// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Mimari test — GİRİŞ VİTRİNİ YALNIZ OLANI SÖYLER
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// Giriş ekranı müşterinin gördüğü İLK ekran. 25.10.2026'da ölçüldüğünde
// orada üç ayrı yalan vardı:
//
// 1 · **Uydurma duyurular** (MIYOP-059) · "Planlı bakım bildirimi · Pazar
//     gecesi kısa süreli bakım penceresi uygulanacaktır" ve "Lisans
//     yenileme hatırlatması". Kayıt yokken `createDemoAnnouncements()`
//     üretiyordu, tarihler her açılışta yeniden hesaplanıyordu. Yani her
//     gün "iki gün sonra bakım" diyen, bizim vermediğimiz bir taahhüt.
//
// 2 · **Olmayan modül vaatleri** · "İşlem Yönetimi, Dijital Katalog, stok,
//     cari, finans ve personel modülleri ihtiyaca göre aktif edilir"
//     diyordu. Altı addan DÖRDÜ dondurulmuş modül.
//     Ayrıca "Security Gateway hazırlığı" — öyle bir şey YOK.
//
// 3 · **Demo veri üreticisi tetikliyordu** · duyuru bağlamı için
//     `loadCompanies()` ve `loadLicensePackages()` çağırıyordu; ikisi de
//     depo boşken demo satır üretiyor (HEDEFLER 3.10).
//
// ── NE ÖLÇÜYOR ───────────────────────────────────────────────────────────
// ⚠️ Tek tek cümle kovalamıyorum. Ölçtüğüm şey: **dondurulmuş modüllerin
// adları kayıttan okunuyor** ve bu adların hiçbiri giriş vitrininde
// geçemiyor (tuzak 90 · yüzeyi ölç). Yeni bir modül dondurulduğunda, adı
// vitrinde kalmışsa bu test onu kendiliğinden yakalar.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { projeKokunuBul } from '../core/test-support/goc-tarama'
import { BUSINESS_WORKSPACE_MODULE_REGISTRY } from '../modules/business-workspace.registry'

const SRC = join(projeKokunuBul(), 'src')
const HAM = readFileSync(join(SRC, 'pages/Login.tsx'), 'utf8') as string

/**
 * ⚠️ Yorumlar ÇIKARILIYOR. Kaldırılan yalanların GEREKÇESİ yorum olarak
 * dosyada duruyor ve o yorumlar dondurulmuş modül adlarını içeriyor —
 * içermeli, yoksa bir sonraki kişi aynı kartı geri yazar. Test
 * müşterinin GÖRDÜĞÜ metni ölçmeli, bizim notlarımızı değil.
 */
const VITRIN = HAM
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
  .replace(/^\s*\/\/.*$/gm, ' ')

/**
 * Vitrinde geçmesi meşru olan adlar. ⚠️ Üç satır, üç KARAR — ve bu liste
 * uzamaya başlarsa test değerini kaybeder, o yüzden her ekleme gerekçe
 * ister:
 *
 * · **Depo** — dondurulmuş `business-warehouse` modülünün adı, ama aynı
 *   zamanda AÇIK `business-stock` modülünün menü adı ve çalışan bir ekran.
 *   Kelime yasak değil; vaat edilen şey gerçekten var.
 * · **İşletme Çalışma Alanı** — dondurulmuş `system-workspace` kaydının
 *   adı, ama müşteriye anlattığımız şey o kayıt değil: uygulamanın
 *   kendisi. Kelime çakışması, vaat değil.
 * · **Personel** — dondurulmuş `business-personnel` modülünün adı, ama
 *   vitrinde geçtiği iki yer GİRİŞ YARDIMI: *"Personelseniz adınızı firma
 *   kodunuzla yazın."* Modül vaadi değil, kullanım talimatı.
 *
 * ⚠️ Bu üçü dışında bir ad eklenecekse önce şu sorulacak: "müşteri bunu
 * okuyup bizde böyle bir şey olduğunu anlar mı?" Cevap evetse ad listeye
 * eklenmez, CÜMLE düzeltilir.
 */
const MESRU_ADLAR = new Set(['Depo', 'İşletme Çalışma Alanı', 'Personel'])

describe('giriş vitrini · yalnız olanı söyler', () => {
  const donmusAdlar = BUSINESS_WORKSPACE_MODULE_REGISTRY
    .filter(modul => modul.foundationScope === 'frozen')
    .map(modul => modul.name)
    .filter(ad => !MESRU_ADLAR.has(ad))

  it('sağlama: dondurulmuş modül listesi gerçekten dolu', () => {
    // ⚠️ "Hiç dondurulmuş modül bulamadım" deyip yeşil geçmek en kötü
    // sonuç olurdu (tuzak 58).
    expect(donmusAdlar.length).toBeGreaterThan(5)
  })

  it('dondurulmuş hiçbir modülün adı vitrinde geçmiyor', () => {
    const gecenler = donmusAdlar.filter(ad => VITRIN.includes(ad))
    expect(
      gecenler,
      'Giriş ekranı dondurulmuş modül(ler)i vaat ediyor: '
      + `${gecenler.join(', ')}\n`
      + 'Müşterinin gördüğü ilk ekranda olmayan bir şey sayılamaz.'
    ).toEqual([])
  })

  it('uydurma duyuru bölümü geri gelmemiş (MIYOP-059)', () => {
    expect(HAM, 'duyuru okuma geri gelmiş').not.toMatch(/loadSystemAnnouncements/)
    expect(VITRIN, 'duyuru bölümü geri gelmiş').not.toMatch(/id="announcements"/)
  })

  it('giriş ekranı tarayıcı deposuna HİÇ dokunmuyor', () => {
    // ⚠️ `../storage` içindeki okuyucular depo boşken demo satır üretiyor.
    // Giriş ekranının tek veri kaynağı Supabase oturumu olmalı.
    expect(
      HAM,
      'Login.tsx yeniden `../storage` okuyor — o dosyadaki okuyucular depo '
      + 'boşken demo firma/paket/şube üretiyor (HEDEFLER 3.10)'
    ).not.toMatch(/from '\.\.\/storage'/)
  })

  it('"Security Gateway" gibi var olmayan bileşen adı yok', () => {
    for(const uydurma of ['Security Gateway', 'Unified Identity']){
      expect(VITRIN, `"${uydurma}" diye bir şey yok`).not.toContain(uydurma)
    }
  })
})
