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

  it('baştaki ve sondaki boşlukları yok sayar', () => {
    expect(isSameIdentifier('  MERKEZ  ', 'merkez')).toBe(true)
  })

  it('gerçekten farklı kodları ayırt eder', () => {
    expect(isSameIdentifier('ISTANBUL', 'ANKARA')).toBe(false)
    expect(normalizeIdentifier('ankara')).toBe('ANKARA')
  })
})
