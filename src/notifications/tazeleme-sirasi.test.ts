import { describe, expect, it } from 'vitest'
import { sonTazelemeMi, yeniTazeleme } from './tazeleme-sirasi'

describe('zil tazelemesi · son istek kazanır (MIYOP-104)', () => {
  it('ilk tazeleme 1 alıyor; sıfır "hiç başlamadı" demek', () => {
    const sayac = { current: 0 }
    expect(yeniTazeleme(sayac)).toBe(1)
    expect(sonTazelemeMi(sayac, 0)).toBe(false)
    expect(sonTazelemeMi(sayac, 1)).toBe(true)
  })

  it('⚠️ ESKİ isteğin cevabı atılıyor — kusurun ta kendisi', () => {
    const sayac = { current: 0 }
    const a = yeniTazeleme(sayac)   // t0 · yoklama
    const b = yeniTazeleme(sayac)   // t1 · "okundu" olayı tazeleme başlattı
    // t2 · B dönüyor: yazılır.
    expect(sonTazelemeMi(sayac, b)).toBe(true)
    // t3 · A dönüyor (daha yavaştı): YAZILMAZ. Yazılsaydı okunmuş bildirim
    // yeniden okunmamış görünürdü.
    expect(sonTazelemeMi(sayac, a)).toBe(false)
  })

  it('tek istek havadayken cevap elbette yazılıyor', () => {
    // Sağlama: kural "hiçbir şeyi yazma"ya dönüşmemeli.
    const sayac = { current: 0 }
    const a = yeniTazeleme(sayac)
    expect(sonTazelemeMi(sayac, a)).toBe(true)
  })

  it('arka arkaya üç istekte yalnız en sonuncusu yazıyor', () => {
    const sayac = { current: 0 }
    const sira = [yeniTazeleme(sayac), yeniTazeleme(sayac), yeniTazeleme(sayac)]
    expect(sira.map(s => sonTazelemeMi(sayac, s))).toEqual([false, false, true])
  })

  it('her kabın kendi sayacı var (iki zil birbirini etkilemez)', () => {
    const bir = { current: 0 }
    const iki = { current: 0 }
    const a = yeniTazeleme(bir)
    yeniTazeleme(iki)
    expect(sonTazelemeMi(bir, a)).toBe(true)
  })
})
