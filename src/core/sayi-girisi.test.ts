// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Sayı girişi testleri
//
// En önemli test: "12.450" ON İKİ BİN DÖRT YÜZ ELLİ okunmalı, on iki buçuk
// DEĞİL. Noktayı ondalık sanan bir okuyucu, bir faturayı bin kat küçültür.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { sayiBicimle, sayiOku, sayiYazarken } from './sayi-girisi'

describe('sayiYazarken — kullanıcı yazarken biçim', () => {
  it('binlik ayracını kendiliğinden koyar', () => {
    expect(sayiYazarken('12450')).toBe('12.450')
    expect(sayiYazarken('1234567')).toBe('1.234.567')
  })

  it('dört basamağa kadar ayraç koymaz, beşinciden itibaren koyar', () => {
    expect(sayiYazarken('999')).toBe('999')
    expect(sayiYazarken('1000')).toBe('1.000')
  })

  it('virgül yazıldığında SİLMİYOR — yoksa ondalık yazılamaz', () => {
    // Her tuşta virgül silinseydi kullanıcı küsurat giremezdi.
    expect(sayiYazarken('12450,')).toBe('12.450,')
  })

  it('ondalık haneyi sınırlar', () => {
    expect(sayiYazarken('12450,756')).toBe('12.450,75')
    expect(sayiYazarken('5,129', 3)).toBe('5,129')
  })

  it('harf ve işaretleri atar', () => {
    expect(sayiYazarken('12a4b50')).toBe('12.450')
    expect(sayiYazarken('dasdasd')).toBe('')
  })

  it('yapıştırılan Türkçe biçimi bozmadan geri verir', () => {
    expect(sayiYazarken('12.450,75')).toBe('12.450,75')
  })

  it('klavyedeki NOKTA ondalık olarak yazıldığında anlar', () => {
    // "12.45" üç haneli kuyruk değil → ondalık kastedilmiş.
    expect(sayiYazarken('12.45')).toBe('12,45')
    // "12.450" üç haneli kuyruk → binlik kastedilmiş.
    expect(sayiYazarken('12.450')).toBe('12.450')
  })

  it('başa yazılan sıfırları temizler', () => {
    expect(sayiYazarken('007')).toBe('7')
  })
})

describe('sayiOku — ekrandaki metinden deftere giden sayı', () => {
  it('binlik ayracını ondalık SANMAZ', () => {
    expect(sayiOku('12.450')).toBe(12450)
    expect(sayiOku('1.234.567')).toBe(1234567)
  })

  it('virgülü ondalık okur', () => {
    expect(sayiOku('12.450,75')).toBe(12450.75)
    expect(sayiOku('0,5')).toBe(0.5)
  })

  it('BOŞ metin 0 değil undefined döner', () => {
    // Sıfır bir fiyattır ("bedava"); boşluk "yazılmadı" demektir.
    expect(sayiOku('')).toBeUndefined()
    expect(sayiOku('   ')).toBeUndefined()
  })

  it('sıfır yazıldıysa sıfır döner', () => {
    expect(sayiOku('0')).toBe(0)
  })

  it('okunamayan metinde undefined döner, 0 uydurmaz', () => {
    expect(sayiOku('abc')).toBeUndefined()
  })

  it('yazma ve okuma birbirinin tersidir', () => {
    const yazilan = sayiYazarken('1234567,89')
    expect(yazilan).toBe('1.234.567,89')
    expect(sayiOku(yazilan)).toBe(1234567.89)
  })
})

describe('sayiBicimle', () => {
  it('sayıyı Türkçe biçimde yazar', () => {
    expect(sayiBicimle(12450.5)).toBe('12.450,5')
    expect(sayiBicimle(1000)).toBe('1.000')
  })
})
