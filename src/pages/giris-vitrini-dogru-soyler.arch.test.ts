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

/**
 * ⚠️ VİTRİN ARTIK İKİ DOSYA (06.11.2026).
 *
 * "Sizi Arayalım" formu `GeriAramaFormu.tsx` içine ayrıldı; müşterinin
 * gördüğü metnin bir kısmı artık orada. Bu dosyanın kapsamı Login.tsx'te
 * kalsaydı, aynı kural korumak istediği yüzeyin yarısını görmez olurdu —
 * `rpc.arch.test.ts` içinde yazılı olan ders bu:
 *
 *   "Bir kuralın kapsamı, korumak istediği YERLERİN tamamı olmalı."
 *
 * Yeni bir bölüm ayrı bir dosyaya çıkarıldığında bu listeye eklenmesi
 * gerekiyor; eklenmezse kural sessizce küçülür.
 */
const VITRIN_DOSYALARI = [
  'pages/Login.tsx',
  'pages/GeriAramaFormu.tsx',
] as const

const oku = (yol: string) => readFileSync(join(SRC, yol), 'utf8') as string

const HAM = VITRIN_DOSYALARI.map(oku).join('\n')

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
    for(const yol of VITRIN_DOSYALARI){
      expect(
        oku(yol),
        `${yol} \`../storage\` okuyor — o dosyadaki okuyucular depo boşken `
        + 'demo firma/paket/şube üretiyor (HEDEFLER 3.10)'
      ).not.toMatch(/from '\.\.?\/storage'/)
    }
  })

  it('sağlama: vitrin dosyalarının hepsi diskte ve okundu', () => {
    // ⚠️ Tuzak 58 · "hiç dosya bulamadım" deyip yeşil geçmek en kötü sonuç.
    expect(VITRIN_DOSYALARI.length).toBeGreaterThanOrEqual(2)
    for(const yol of VITRIN_DOSYALARI){
      expect(oku(yol).length, `${yol} boş`).toBeGreaterThan(500)
    }
  })

  it('⚠️ "Sizi Arayalım" formu vitrine BAĞLI (bölüm kaybolmasın)', () => {
    // Form ayrı dosyada; Login.tsx onu çizmiyorsa müşteri hiç görmez ve
    // kimse fark etmez — ekran yine açılır, yine düzgün görünür.
    const giris = oku('pages/Login.tsx')
    expect(giris).toContain('<GeriAramaFormu />')
    expect(oku('pages/GeriAramaFormu.tsx')).toContain('id="geri-arama"')
    // Üstteki menüdeki bağlantının gideceği yer gerçekten var mı.
    expect(giris).toContain('href="#geri-arama"')
  })

  it('"Security Gateway" gibi var olmayan bileşen adı yok', () => {
    for(const uydurma of ['Security Gateway', 'Unified Identity']){
      expect(VITRIN, `"${uydurma}" diye bir şey yok`).not.toContain(uydurma)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// MIYOP-107 · KALDIRILAN BÖLÜMÜN CSS'İ DE KALDIRILDI
//
// Uydurma duyurular (MIYOP-059) ekrandan kaldırılmıştı ama CSS'i
// `styles.css`te kalmıştı: `.unified-login-announcement`, `...-list`,
// `.unified-login-announcement time` ve üç grup kuralındaki payı.
//
// ⚠️ ÖLÜ KURAL ZARARSIZ GÖRÜNÜR. Gerçek bedeli şu: dosyayı okuyan kişiye
// "böyle bir bölüm var" der. Bir sonraki kişi onu geri yazmaya çalışır —
// yani kaldırılmış bir YALANIN iskeleti ayakta kalır.
// ═══════════════════════════════════════════════════════════════════════════
describe('giriş vitrini · kaldırılan duyuruların CSS izi de yok (MIYOP-107)', () => {
  const CSS = oku('styles.css')

  it('sağlama · styles.css okundu', () => {
    // ⚠️ Tuzak 58 · boş dosya okuyup yeşil geçmek en kötü sonuç.
    expect(CSS.length).toBeGreaterThan(100000)
    // Vitrin CSS'i gerçekten bu dosyada mı? Yoksa aşağıdaki "yok" iddiası
    // hiçbir şey ölçmez.
    expect(CSS).toContain('.unified-login-card {')
  })

  it('⚠️ `.unified-login-announcement` seçicisi KALMADI', () => {
    // Yorum satırı sayılmasın: CSS yorumları önce silinecek.
    const kod = CSS.replace(/\/\*[\s\S]*?\*\//g, ' ')
    expect(kod).not.toContain('unified-login-announcement')
  })

  it('duyuru bölümünü çizen bir ekran da yok', () => {
    expect(VITRIN).not.toContain('unified-login-announcement')
  })
})
