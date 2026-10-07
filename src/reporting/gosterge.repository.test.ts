// Dönem hesabı. Yanlış bir dönem, doğru hesaplanmış yanlış bir rapor demektir.

import { describe, it, expect } from 'vitest'
import { oncekiDonem, sonGunler } from './gosterge.repository'

describe('sonGunler', () => {
  it('son 30 günü BUGÜN DAHİL verir', () => {
    const d = sonGunler(30, new Date(2026, 9, 7))
    expect(d.bit).toBe('2026-10-07')
    expect(d.bas).toBe('2026-09-08')
  })

  it('tek günlük dönemde baş ve bit aynıdır', () => {
    const d = sonGunler(1, new Date(2026, 9, 7))
    expect(d.bas).toBe('2026-10-07')
    expect(d.bit).toBe('2026-10-07')
  })

  // ⚠️ Ay ve yıl sınırı: 1 Ocak’ta geriye gidince önceki yıla düşmeli.
  it('yıl sınırını doğru geçer', () => {
    const d = sonGunler(7, new Date(2027, 0, 3))
    expect(d.bas).toBe('2026-12-28')
    expect(d.bit).toBe('2027-01-03')
  })
})

describe('oncekiDonem', () => {
  // Karşılaştırma işletmenin KENDİ geçmişiyle yapılıyor; o yüzden önceki
  // dönem AYNI UZUNLUKTA olmalı, yoksa "arttı" cümlesi yalan olur.
  it('aynı uzunlukta ve hemen öncesinde bir dönem verir', () => {
    const o = oncekiDonem({ bas: '2026-09-08', bit: '2026-10-07' })
    expect(o.bit).toBe('2026-09-07')
    expect(o.bas).toBe('2026-08-09')
  })

  it('tek günlük dönemin öncesi de tek gündür', () => {
    const o = oncekiDonem({ bas: '2026-10-07', bit: '2026-10-07' })
    expect(o.bas).toBe('2026-10-06')
    expect(o.bit).toBe('2026-10-06')
  })

  it('iki dönem ÇAKIŞMAZ', () => {
    const d = { bas: '2026-09-08', bit: '2026-10-07' }
    const o = oncekiDonem(d)
    expect(o.bit < d.bas).toBe(true)
  })
})
