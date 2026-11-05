// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · PARA BİRİMİ BESLEMESİ (birim testi) · 01.11.2026 · HEDEFLER 3.4.6
//
// `billing.ts` içindeki `formatCurrency` eskiden sabit 'TRY' yazıyordu ve bu
// dosyayı **38 ekran** kullanıyor. Artık değer dışarıdan besleniyor.
//
// ⚠️ Bu dosya DAVRANIŞI ölçüyor, yazımı değil: "₺ mi € mu basıyor", "besleme
// gelince ekran haberdar oluyor mu", "çıkışta sıfırlanıyor mu".
// ═══════════════════════════════════════════════════════════════════════════

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  aktifParaBirimiKodu,
  formatCurrency,
  paraBirimiAyarla,
  paraBirimiDegisinceBildir,
  paraBirimiKimligiKur,
  paraBirimiOturumSurumu,
  paraBirimiYazimiBitti,
} from './billing'

afterEach(() => { paraBirimiAyarla(null) })

describe('para birimi beslemesi', () => {
  it('okunmadığında ₺ basıyor · 0103 tetiğinin varsayılanı', () => {
    // ⚠️ Bu "uydurma varsayılan" DEĞİL: göç 0103 her yeni kiracı için
    // `currency_code = 'TRY'` yazıyor, yani okunmadan önceki en olası
    // doğru cevap bu.
    expect(aktifParaBirimiKodu()).toBe('TRY')
    expect(formatCurrency(1234.5)).toContain('₺')
  })

  it('⚠️ beslenince GERÇEKTEN değişiyor — asıl borç buydu', () => {
    paraBirimiAyarla('EUR')
    expect(aktifParaBirimiKodu()).toBe('EUR')
    const yazi = formatCurrency(1234.5)
    expect(yazi).toContain('€')
    expect(yazi, 'eski biçimlendirici önbellekte kalmış').not.toContain('₺')
  })

  it('çıkışta sıfırlanıyor · başka işletmenin para birimi ekranda kalmaz', () => {
    paraBirimiAyarla('USD')
    expect(formatCurrency(1)).toContain('$')
    paraBirimiAyarla(null)
    expect(aktifParaBirimiKodu()).toBe('TRY')
    expect(formatCurrency(1)).toContain('₺')
  })

  it('küçük harf ve boşluk temizleniyor', () => {
    paraBirimiAyarla('  eur ')
    expect(aktifParaBirimiKodu()).toBe('EUR')
  })

  it('boş metin "okunmadı" sayılıyor', () => {
    paraBirimiAyarla('EUR')
    paraBirimiAyarla('   ')
    expect(aktifParaBirimiKodu()).toBe('TRY')
  })

  it('⚠️ değişince HABER VERİYOR — yoksa ekranda eski değer kalırdı', () => {
    // Değer giriş SONRASI geliyor; o ana kadar çizilmiş fiyatlar ₺ kalırdı.
    // Dinleyici olmadan bu çözüm yarım olurdu.
    const haber = vi.fn()
    const birak = paraBirimiDegisinceBildir(haber)
    paraBirimiAyarla('GBP')
    expect(haber).toHaveBeenCalledTimes(1)
    birak()
    paraBirimiAyarla('USD')
    expect(haber, 'bırakıldıktan sonra hâlâ çağrılıyor').toHaveBeenCalledTimes(1)
  })

  it('aynı değer yeniden beslenirse haber VERMİYOR · gereksiz çizim yok', () => {
    paraBirimiAyarla('EUR')
    const haber = vi.fn()
    const birak = paraBirimiDegisinceBildir(haber)
    paraBirimiAyarla('EUR')
    expect(haber).not.toHaveBeenCalled()
    birak()
  })

  it('⚠️ geçersiz kod ekranı ÇÖKERTMİYOR, ₺ye düşüyor ve SESSİZ kalmıyor', () => {
    const uyari = vi.spyOn(console, 'warn').mockImplementation(() => {})
    paraBirimiAyarla('XXZZ')
    expect(() => formatCurrency(5)).not.toThrow()
    expect(formatCurrency(5)).toContain('₺')
    expect(uyari, 'geçersiz kod sessizce yutuldu').toHaveBeenCalled()
    uyari.mockRestore()
  })
  // ── MIYOP-086 · BAYAT CEVAP ───────────────────────────────────────────
  // Codex'in ölçtüğü sıra: A çıkar → B girer ve USD cevabı gelir → A'nın
  // iptal edilmiş okuması EUR ile döner. Eskiden ekranda EUR kalıyordu.

  it('⚠️ ESKİ oturumun geç gelen cevabı YENİ oturumu bozmuyor', () => {
    paraBirimiKimligiKur('A|firma-A')
    const aSurumu = paraBirimiOturumSurumu()   // A'nın okuması başladı
    paraBirimiKimligiKur('B|firma-B')          // A çıktı, B girdi
    const bSurumu = paraBirimiOturumSurumu()

    paraBirimiAyarla('USD', bSurumu)           // B'nin cevabı
    expect(aktifParaBirimiKodu()).toBe('USD')

    paraBirimiAyarla('EUR', aSurumu)           // A'nın GEÇ gelen cevabı
    expect(
      aktifParaBirimiKodu(),
      'bayat cevap yeni oturumun para birimini ezdi (MIYOP-086)'
    ).toBe('USD')
    expect(formatCurrency(1)).toContain('$')
  })

  it('aynı oturumda gelen cevap UYGULANIYOR · kaydet-sonra-oku bozulmadı', () => {
    const surum = paraBirimiOturumSurumu()
    paraBirimiAyarla('EUR', surum)
    expect(aktifParaBirimiKodu()).toBe('EUR')
  })

  it('⚠️ çıkış sıfırlaması SÜRÜMSÜZ çağrılır ve her zaman geçerlidir', () => {
    // Çıkışta sayaç artıyor; sıfırlama sürüm taşısaydı kendi kendini
    // geçersiz kılardı ve önceki işletmenin para birimi ekranda kalırdı.
    paraBirimiKimligiKur('cikis-A|firma')
    paraBirimiAyarla('GBP', paraBirimiOturumSurumu())
    paraBirimiKimligiKur(null)                 // çıkış
    paraBirimiAyarla(null)
    expect(aktifParaBirimiKodu()).toBe('TRY')
  })

  // ── MIYOP-096 · SAYAÇ ÇOK ARTIYORDU ───────────────────────────────────
  // Codex ölçtü: `App.tsx`teki etki `currentUser` NESNESİNE bağlıydı. Kişi
  // kendi adını değiştirince yeni nesne doğuyor, etki koşuyor, sayaç
  // artıyordu — ve o sırada uçan MEŞRU okuma sessizce atılıyordu.

  it('⚠️ AYNI kimlik yeniden kurulursa sayaç ARTMIYOR (MIYOP-096)', () => {
    const once = paraBirimiKimligiKur('u-96|f-96')
    const sonra = paraBirimiKimligiKur('u-96|f-96')
    expect(sonra, 'aynı kimlik sayacı artırdı — meşru okuma atılır').toBe(once)
  })

  it('⚠️ ad değişimi sırasında uçan MEŞRU okuma hâlâ UYGULANIYOR', () => {
    paraBirimiKimligiKur('u-96b|f-96b')
    const okumaSurumu = paraBirimiOturumSurumu()   // okuma başladı
    paraBirimiKimligiKur('u-96b|f-96b')            // ad değişti, KİMLİK aynı
    paraBirimiAyarla('EUR', okumaSurumu)           // okuma geç geldi
    expect(
      aktifParaBirimiKodu(),
      'kimlik değişmediği hâlde okuma atıldı (MIYOP-096)'
    ).toBe('EUR')
  })

  it('negatif denetim · kimlik GERÇEKTEN değişince okuma atılıyor', () => {
    paraBirimiKimligiKur('u-96c|f-96c')
    const okumaSurumu = paraBirimiOturumSurumu()
    paraBirimiKimligiKur('BASKA-u|BASKA-f')        // gerçekten başka kişi
    paraBirimiAyarla('EUR', okumaSurumu)
    expect(aktifParaBirimiKodu(), 'kapı artık hiç bitmiyor').toBe('TRY')
  })

  // ── MIYOP-094 · SAYAÇ AZ ARTIYORDU ────────────────────────────────────
  // Aynı oturumda sayaç hiç değişmiyordu: giriş anındaki okuma (TRY) geç
  // gelip az önce kaydedilen EUR'yu eziyordu.

  it('⚠️ YAZMA sayacı artırıyor — bayat giriş okuması kaydı ezemiyor', () => {
    paraBirimiKimligiKur('u-94|f-94')
    const girisOkumasi = paraBirimiOturumSurumu()  // giriş okuması başladı

    const yazmaSonrasi = paraBirimiYazimiBitti()   // EUR kaydedildi
    expect(yazmaSonrasi, 'yazma sayacı artırmadı').toBeGreaterThan(girisOkumasi)

    paraBirimiAyarla('EUR', yazmaSonrasi)          // kaydetme sonrası geri okuma
    expect(aktifParaBirimiKodu()).toBe('EUR')

    paraBirimiAyarla('TRY', girisOkumasi)          // giriş okuması GEÇ geldi
    expect(
      aktifParaBirimiKodu(),
      'bayat giriş okuması kaydedilen para birimini ezdi (MIYOP-094)'
    ).toBe('EUR')
  })

  it('negatif denetim · yazma sayacı artırmasaydı bayat okuma KAZANIRDI', () => {
    // Kapının gerçekten ısırdığını gösteren kontrol: aynı sıra, ama
    // aradaki sayaç artışı YOK. Eski davranış tam buydu.
    paraBirimiKimligiKur('u-94b|f-94b')
    const girisOkumasi = paraBirimiOturumSurumu()
    paraBirimiAyarla('EUR', girisOkumasi)          // yazma sayaç artırmadı
    paraBirimiAyarla('TRY', girisOkumasi)          // bayat okuma
    expect(aktifParaBirimiKodu(), 'negatif denetim anlamsız').toBe('TRY')
  })

  it('bayat cevap dinleyicileri de UYANDIRMIYOR · gereksiz çizim yok', () => {
    paraBirimiKimligiKur('uyandirma-A|firma')
    const eski = paraBirimiOturumSurumu()
    paraBirimiKimligiKur('uyandirma-B|firma')
    const haber = vi.fn()
    const birak = paraBirimiDegisinceBildir(haber)
    paraBirimiAyarla('EUR', eski)
    expect(haber).not.toHaveBeenCalled()
    birak()
  })
})
