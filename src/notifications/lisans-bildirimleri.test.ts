// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Lisans zil satırları
//
// "Bu talebi nerede göreceğim?" sorusunun cevabı zildir. Zil yanlış çalışırsa
// talep görülmez; görülmeyen talep, alınmamış talep demektir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import { lisanslariBildirimeCevir, LISANS_UYARI_GUNU } from './lisans-bildirimleri'
import type { SureTalebi } from '../billing/license-platform.repository'
import type { LisansOzeti } from '../billing/license-platform.repository'

const talep = (uzer: Partial<SureTalebi> = {}): SureTalebi => ({
  id: 't1', tenantId: 'k1', isletme: 'Gümüş Tavukçuluk', gerekce: 'Kurulum sürüyor',
  durum: 'Bekliyor', istenme: '2026-09-23T10:00:00Z', kararNotu: '', bitis: '2026-10-23',
  ...uzer,
})

const lisans = (uzer: Partial<LisansOzeti> = {}): LisansOzeti => ({
  tenantId: 'k1', kiraciKodu: 'GUM001', isletme: 'Gümüş Tavukçuluk',
  paket: 'Endüstriyel Mutfak · Başlangıç', durum: 'Deneme',
  baslangic: '2026-09-23', bitis: '2026-10-23', kalanGun: 30,
  uzatmaSayisi: 0, toplamGun: 30, bekleyenTalep: false,
  ...uzer,
})

describe('Lisans bildirimleri', () => {
  it('bekleyen talep zile düşer', () => {
    const satirlar = lisanslariBildirimeCevir([talep()], [])
    expect(satirlar).toHaveLength(1)
    expect(satirlar[0].title).toBe('Ek süre talebi')
    expect(satirlar[0].description).toContain('Gümüş Tavukçuluk')
    expect(satirlar[0].description).toContain('Kurulum sürüyor')
  })

  it('karara bağlanmış talep zilde DURMAZ', () => {
    // Saklanan bildirim olsaydı burada kalırdı; türetildiği için kayboluyor.
    expect(lisanslariBildirimeCevir([talep({ durum: 'Onaylandı' })], [])).toHaveLength(0)
    expect(lisanslariBildirimeCevir([talep({ durum: 'Reddedildi' })], [])).toHaveLength(0)
  })

  it('süresi bol olan lisans zile düşmez', () => {
    expect(lisanslariBildirimeCevir([], [lisans({ kalanGun: 30 })])).toHaveLength(0)
  })

  it('eşiğe gelen lisans uyarı verir', () => {
    const satirlar = lisanslariBildirimeCevir([], [lisans({ kalanGun: LISANS_UYARI_GUNU })])
    expect(satirlar).toHaveLength(1)
    expect(satirlar[0].title).toBe('Lisans süresi bitiyor')
  })

  it('süresi dolmuş lisans kaç gün önce bittiğini söyler', () => {
    const satirlar = lisanslariBildirimeCevir([], [lisans({ kalanGun: -4 })])
    expect(satirlar[0].title).toBe('Lisans süresi doldu')
    expect(satirlar[0].description).toContain('4 gün önce')
  })

  it('talebi olan işletme için İKİ satır çıkmaz', () => {
    // Aynı konuyu iki kez söylemek zili gürültüye çevirir.
    const satirlar = lisanslariBildirimeCevir(
      [talep()],
      [lisans({ kalanGun: 2, bekleyenTalep: true })],
    )
    expect(satirlar).toHaveLength(1)
    expect(satirlar[0].title).toBe('Ek süre talebi')
  })

  it('okunmuş bildirim okunma zamanını taşır', () => {
    const satirlar = lisanslariBildirimeCevir([talep()], [], { lisans_talep_t1: '2026-09-23T12:00:00Z' })
    expect(satirlar[0].readAt).toBe('2026-09-23T12:00:00Z')
  })
})
