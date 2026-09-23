// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Lisans uyarı eşikleri
//
// Bu hesap ekranda tek bir cümleye dönüşüyor ("7 gün sonra bitiyor") ama
// yanlış olursa müşteri lisansının bittiğini kapıda öğrenir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { kalanGun, lisansUyarisi } from './license.repository'

const bugun = new Date(2026, 8, 23) // 23.09.2026

describe('Lisans kalan gün', () => {
  it('aynı gün 0 gün', () => {
    expect(kalanGun('2026-09-23', bugun)).toBe(0)
  })

  it('saat farkı sonucu değiştirmez', () => {
    // Gün ortasında bakınca 6,5 gün kalması "6 gün" diye yuvarlanıp
    // uyarıyı bir gün erken/geç çıkarmamalı.
    expect(kalanGun('2026-09-30', new Date(2026, 8, 23, 23, 59))).toBe(7)
    expect(kalanGun('2026-09-30', new Date(2026, 8, 23, 0, 1))).toBe(7)
  })

  it('geçmiş tarih eksi döner', () => {
    expect(kalanGun('2026-09-20', bugun)).toBe(-3)
  })
})

describe('Lisans uyarısı', () => {
  it('bol zaman varsa sessiz', () => {
    const u = lisansUyarisi({ durum: 'Aktif', bitis: '2027-09-23' }, bugun)
    expect(u.seviye).toBe('iyi')
  })

  it('bir ay kala uyarır', () => {
    expect(lisansUyarisi({ durum: 'Deneme', bitis: '2026-10-20' }, bugun).seviye).toBe('uyari')
  })

  it('bir hafta kala kritik', () => {
    expect(lisansUyarisi({ durum: 'Deneme', bitis: '2026-09-29' }, bugun).seviye).toBe('kritik')
  })

  it('bugün bitiyorsa kritik ve bunu söyler', () => {
    const u = lisansUyarisi({ durum: 'Aktif', bitis: '2026-09-23' }, bugun)
    expect(u.seviye).toBe('kritik')
    expect(u.mesaj).toMatch(/bugün/i)
  })

  it('tarihi geçmiş lisans, durumu Aktif görünse bile kritiktir', () => {
    // Durum alanı bir gün güncellenmemiş olabilir; TARİH yalan söylemez.
    const u = lisansUyarisi({ durum: 'Aktif', bitis: '2026-09-01' }, bugun)
    expect(u.seviye).toBe('kritik')
  })

  it('askıya alınan lisans, tarihi dolmamış olsa bile kritiktir', () => {
    const u = lisansUyarisi({ durum: 'Askıya Alındı', bitis: '2027-01-01' }, bugun)
    expect(u.seviye).toBe('kritik')
  })
})
