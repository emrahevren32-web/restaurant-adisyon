// Bu testlerin tamamı tek bir şeyi koruyor: EKRANDAKİ AYRINTI, BAŞLIKTAKİ
// KAYDA AİT OLSUN. Değilse yazma düğmesi yanlış kaydın verisini doğru
// kaydın kimliğiyle kaydeder (MIYOP-010 / MIYOP-064).

import { describe, it, expect } from 'vitest'
import {
  SECIM_BOS, ayrintiBeklemeSebebi, ayrintiDustu, ayrintiGeldi, ayrintiHazir,
  kabulEdilirMi, secildi,
} from './ayrinti-kapisi'

describe('ayrıntı kapısı · seçim', () => {
  it('başlangıçta hiçbir şey hazır değil', () => {
    expect(ayrintiHazir(SECIM_BOS)).toBe(false)
    expect(ayrintiBeklemeSebebi(SECIM_BOS)).toMatch(/soldan bir kayıt seçin/)
  })

  it('⚠️ SEÇİM ANINDA ekrandaki ayrıntı DÜŞÜYOR', () => {
    // Bu satır bu dosyanın sebebi: eski ayrıntı bir an bile yeni kaydın
    // başlığı altında durmamalı.
    const a = ayrintiGeldi(secildi('A'), 'A')
    expect(ayrintiHazir(a)).toBe(true)

    const b = secildi('B')
    expect(b.ekranda).toBeNull()
    expect(ayrintiHazir(b)).toBe(false)
  })

  it('seçim boşaltılınca yükleme başlamıyor', () => {
    const d = secildi(null)
    expect(d.yukleniyor).toBe(false)
    expect(ayrintiHazir(d)).toBe(false)
  })
})

describe('ayrıntı kapısı · geç gelen cevap', () => {
  it('⚠️ A→B sırasında A’nın cevabı ATILIYOR', () => {
    // Asıl tuzak bu: A'nın isteği B'den SONRA dönerse, koruma olmadan
    // B'nin ayrıntısını ezer. Ekranda B yazar, içerik A'dır.
    const b = secildi('B')
    expect(kabulEdilirMi(b, 'A')).toBe(false)
    const sonra = ayrintiGeldi(b, 'A')
    expect(sonra.ekranda).toBeNull()
    expect(ayrintiHazir(sonra)).toBe(false)
  })

  it('A’nın HATASI da B’yi etkilemiyor', () => {
    const b = secildi('B')
    const sonra = ayrintiDustu(b, 'A', 'ağ hatası')
    expect(sonra.hata).toBe('')
    expect(sonra.yukleniyor).toBe(true)
  })

  it('B’nin kendi cevabı kabul ediliyor', () => {
    const b = ayrintiGeldi(secildi('B'), 'B')
    expect(b.ekranda).toBe('B')
    expect(ayrintiHazir(b)).toBe(true)
  })

  it('aynı kaydın ikinci cevabı kuralı delmiyor (yenileme)', () => {
    let d = ayrintiGeldi(secildi('A'), 'A')
    d = ayrintiGeldi(d, 'A')
    expect(ayrintiHazir(d)).toBe(true)
  })

  it('seçim YOKKEN gelen cevap kabul edilmiyor', () => {
    expect(kabulEdilirMi(SECIM_BOS, 'A')).toBe(false)
    expect(kabulEdilirMi(secildi(null), 'A')).toBe(false)
  })
})

describe('ayrıntı kapısı · hata', () => {
  it('hata gelince ekranda ayrıntı KALMIYOR', () => {
    // Yarım veriyle açık kalan bir ekran, hata mesajından tehlikelidir.
    const d = ayrintiDustu(secildi('A'), 'A', 'Alerjen beyanı okunamadı.')
    expect(d.ekranda).toBeNull()
    expect(ayrintiHazir(d)).toBe(false)
    expect(d.yukleniyor).toBe(false)
  })

  it('hata sebebi kullanıcıya AYNEN veriliyor', () => {
    const d = ayrintiDustu(secildi('A'), 'A', 'Alerjen beyanı okunamadı.')
    expect(ayrintiBeklemeSebebi(d)).toBe('Alerjen beyanı okunamadı.')
  })

  it('yükleme sürerken sebep "bekleyin" diyor, boş değil', () => {
    const d = secildi('A')
    expect(ayrintiBeklemeSebebi(d)).toMatch(/henüz yüklenmedi/)
  })

  it('hazırken sebep YOK — düğme açık', () => {
    const d = ayrintiGeldi(secildi('A'), 'A')
    expect(ayrintiBeklemeSebebi(d)).toBe('')
  })
})

describe('ayrıntı kapısı · hazırlık ölçütü', () => {
  it('ekranda başka kayıt varken hazır DEĞİL', () => {
    const d = { secilen: 'B', ekranda: 'A', yukleniyor: false, hata: '' }
    expect(ayrintiHazir(d)).toBe(false)
  })

  it('eşleşse bile yükleme sürüyorsa hazır DEĞİL', () => {
    const d = { secilen: 'A', ekranda: 'A', yukleniyor: true, hata: '' }
    expect(ayrintiHazir(d)).toBe(false)
  })
})
