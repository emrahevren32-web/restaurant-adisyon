import { describe, expect, it } from 'vitest'
import {
  FIRMA_VITRINI_OLAYI,
  firmaVitriniDegisti,
  firmaVitriniSec,
  subscribeFirmaVitrini,
} from './firma-vitrini'

describe('firma vitrini · kabuk defterden okuyor (MIYOP-103)', () => {
  it('ad ve logo defterden geliyor, boşluklar kırpılıyor', () => {
    expect(firmaVitriniSec({ firmaAdi: '  Evren Gıda  ', logoAdresi: ' https://x/y.png ' }))
      .toEqual({ ad: 'Evren Gıda', logoAdresi: 'https://x/y.png' })
  })

  it('⚠️ ikisi de boşsa null — kabuk eski kaynağına düşsün', () => {
    // Boş dize döndürmek, üst bantta hiçbir ad göstermemek olurdu.
    expect(firmaVitriniSec({ firmaAdi: '', logoAdresi: '' })).toBeNull()
    expect(firmaVitriniSec({ firmaAdi: '   ', logoAdresi: null })).toBeNull()
    expect(firmaVitriniSec(null)).toBeNull()
  })

  it('biri doluysa vitrin var; eksik alan boş dize kalıyor', () => {
    expect(firmaVitriniSec({ firmaAdi: 'Evren Gıda', logoAdresi: null }))
      .toEqual({ ad: 'Evren Gıda', logoAdresi: '' })
    expect(firmaVitriniSec({ firmaAdi: null, logoAdresi: 'https://x/y.png' }))
      .toEqual({ ad: '', logoAdresi: 'https://x/y.png' })
  })

  it('"kaydettim" haberi dinleyiciye ulaşıyor', () => {
    let sayi = 0
    const birak = subscribeFirmaVitrini(() => { sayi += 1 })
    firmaVitriniDegisti()
    firmaVitriniDegisti()
    expect(sayi).toBe(2)
    birak()
  })

  it('⚠️ abonelik bırakıldıktan sonra haber GELMİYOR (sızıntı yok)', () => {
    // Bırakılmayan bir dinleyici, ekran değiştikçe birikir ve her
    // kaydetmede defteri gereksiz kez okur.
    let sayi = 0
    const birak = subscribeFirmaVitrini(() => { sayi += 1 })
    birak()
    firmaVitriniDegisti()
    expect(sayi).toBe(0)
  })

  it('olay adı sabit — kaydeden ve dinleyen aynı adı kullanıyor', () => {
    // Sağlama: ad değişirse iki taraf sessizce ayrışır.
    expect(FIRMA_VITRINI_OLAYI).toBe('miyop:firma-vitrini-degisti')
  })
})
