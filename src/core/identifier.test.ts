import { describe, expect, it } from 'vitest'
import { isSameIdentifier, normalizeIdentifier } from './identifier'

/**
 * Bu testler bir regresyon kaydıdır: Türkçe yerel ayarıyla küçültme kullanıldığında
 * 'ISTANBUL' ile 'istanbul' eşleşmiyordu ve sistem aynı kodla ikinci bir şube
 * açılmasına izin veriyordu.
 */
describe('normalizeIdentifier', () => {
  it('büyük/küçük harf farkını yok sayar', () => {
    expect(isSameIdentifier('istanbul', 'ISTANBUL')).toBe(true)
  })

  it('Türkçe noktalı ve noktasız i varyantlarını aynı sayar', () => {
    expect(isSameIdentifier('ISTANBUL', 'istanbul')).toBe(true)
    expect(isSameIdentifier('İSTANBUL', 'istanbul')).toBe(true)
    expect(isSameIdentifier('ıstanbul', 'istanbul')).toBe(true)
    expect(isSameIdentifier('İstanbul', 'ISTANBUL')).toBe(true)
  })

  // Codex incelemesi (2026-08-24): NFC olmadan 'İ' (tek karakter U+0130) ile
  // 'I' + birleşen nokta (U+0049 U+0307) farklı tanımlayıcı sayılıyordu.
  it('kanonik olarak eşdeğer Unicode dizilerini aynı sayar', () => {
    expect(isSameIdentifier('\u0130STANBUL', 'I\u0307STANBUL')).toBe(true)
    expect(isSameIdentifier('\u0130STANBUL', 'istanbul')).toBe(true)
    expect(isSameIdentifier('R\u00c9\u00c7ETE', 'RE\u0301\u00c7ETE')).toBe(true)
  })

  it('baştaki ve sondaki boşlukları yok sayar', () => {
    expect(isSameIdentifier('  MERKEZ  ', 'merkez')).toBe(true)
  })

  it('gerçekten farklı kodları ayırt eder', () => {
    expect(isSameIdentifier('ISTANBUL', 'ANKARA')).toBe(false)
    expect(normalizeIdentifier('ankara')).toBe('ANKARA')
  })
})
