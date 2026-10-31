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
})
