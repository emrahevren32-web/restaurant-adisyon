// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Sekme başlığı · davranış sınamaları
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { SEKME_BASLIGI_SINIRI, sekmeBasligi } from './sekme-basligi'

describe('sekmeBasligi', () => {
  it('okunmamış yokken başlığa DOKUNMUYOR', () => {
    expect(sekmeBasligi('EVREN360', 0)).toBe('EVREN360')
  })

  it('okunmamış varken sayıyı başa yazıyor', () => {
    expect(sekmeBasligi('EVREN360', 1)).toBe('(1) EVREN360')
    expect(sekmeBasligi('ABC Endüstriyel Mutfak', 3)).toBe('(3) ABC Endüstriyel Mutfak')
  })

  it(`${SEKME_BASLIGI_SINIRI} üstü "${SEKME_BASLIGI_SINIRI}+" oluyor (rozetle aynı eşik)`, () => {
    expect(sekmeBasligi('EVREN360', SEKME_BASLIGI_SINIRI)).toBe(`(${SEKME_BASLIGI_SINIRI}) EVREN360`)
    expect(sekmeBasligi('EVREN360', SEKME_BASLIGI_SINIRI + 1)).toBe(`(${SEKME_BASLIGI_SINIRI}+) EVREN360`)
    expect(sekmeBasligi('EVREN360', 5000)).toBe(`(${SEKME_BASLIGI_SINIRI}+) EVREN360`)
  })

  // ⚠️ Sayı bir sayaçtan geliyor; "(NaN) EVREN360" yazan bir sekme, olmayan
  // bir hatayı varmış gibi gösterir.
  it('⚠️ okunamayan sayı başlığı BOZMUYOR', () => {
    expect(sekmeBasligi('EVREN360', Number.NaN)).toBe('EVREN360')
    expect(sekmeBasligi('EVREN360', undefined as unknown as number)).toBe('EVREN360')
    expect(sekmeBasligi('EVREN360', Number.POSITIVE_INFINITY)).toBe('EVREN360')
  })

  it('⚠️ eksi sayı önek ÜRETMİYOR', () => {
    expect(sekmeBasligi('EVREN360', -3)).toBe('EVREN360')
  })

  it('küsuratlı sayı aşağı yuvarlanıyor', () => {
    expect(sekmeBasligi('EVREN360', 2.9)).toBe('(2) EVREN360')
  })

  // ⚠️ "(3)" diye bir sekme adı, kullanıcıya NEYİN üç tane olduğunu söylemez.
  it('⚠️ başlık boşsa önek TEK BAŞINA yazılmıyor', () => {
    expect(sekmeBasligi('', 3)).toBe('')
    expect(sekmeBasligi('   ', 3)).toBe('')
  })

  it('başlığın baş/son boşluğu kırpılıyor', () => {
    expect(sekmeBasligi('  EVREN360  ', 0)).toBe('EVREN360')
    expect(sekmeBasligi('  EVREN360  ', 2)).toBe('(2) EVREN360')
  })
})
