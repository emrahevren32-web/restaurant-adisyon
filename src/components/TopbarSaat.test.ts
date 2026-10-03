// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Üst panel saati testleri
//
// Biçimleyiciler saf fonksiyon; React'siz sınanıyor. Asıl korunan şey
// Türkçe gün/ay adlarının doğru sırada olması: dizideki tek kaymada saat
// her gün YANLIŞ günü yazar ve kimse fark etmez.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { saatBasligi, saatiYaz, tarihiYaz } from './TopbarSaat'

describe('saatiYaz', () => {
  it('iki haneli yazıyor', () => {
    expect(saatiYaz(new Date(2026, 9, 3, 9, 5))).toBe('09:05')
    expect(saatiYaz(new Date(2026, 9, 3, 14, 30))).toBe('14:30')
  })

  it('gece yarısını 00:00 yazıyor, 24:00 değil', () => {
    expect(saatiYaz(new Date(2026, 9, 3, 0, 0))).toBe('00:00')
  })

  it('SANİYE göstermiyor', () => {
    // Küçük yazıda okunmuyor ve akan rakam gözü sürekli oraya çekiyor.
    expect(saatiYaz(new Date(2026, 9, 3, 14, 30, 59))).toBe('14:30')
  })
})

describe('tarihiYaz', () => {
  it('gün, ay ve gün adını Türkçe yazıyor', () => {
    // 3 Ekim 2026 bir Cumartesi.
    expect(tarihiYaz(new Date(2026, 9, 3))).toBe('3 Ekim Cumartesi')
  })

  it('ay dizisi kaymıyor — ocak ve aralık uçları', () => {
    // Dizide tek bir kayma olsa saat her gün yanlış ayı yazar ve kimse
    // fark etmez; uçları ayrıca sınıyoruz.
    expect(tarihiYaz(new Date(2026, 0, 1))).toContain('Ocak')
    expect(tarihiYaz(new Date(2026, 11, 31))).toContain('Aralık')
  })

  it('YIL yazmıyor — bugünün yılını kimse merak etmiyor', () => {
    expect(tarihiYaz(new Date(2026, 9, 3))).not.toContain('2026')
  })
})

describe('saatBasligi', () => {
  it('üstüne gelince tam tarihi, yılıyla birlikte veriyor', () => {
    expect(saatBasligi(new Date(2026, 9, 3, 14, 5)))
      .toBe('3 Ekim 2026 Cumartesi · 14:05')
  })
})
