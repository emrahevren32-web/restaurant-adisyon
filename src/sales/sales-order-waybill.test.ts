// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · İrsaliye–sipariş bağı testleri
//
// Korunan üç şey: (1) başka siparişin ya da siparişsiz bir sevkiyatın belgesi
// bu siparişte GÖRÜNMESİN; (2) iptal edilmiş belge GİZLENMESİN — müşterinin
// elinde kalmış olabilir; (3) taslak ve iptal belgesi RESMÎ sayılmasın.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import type { Sevkiyat } from '../production/shipment.repository'
import {
  irsaliyeBelgeBasligi,
  irsaliyeOzeti,
  irsaliyeUyarisi,
  siparisIrsaliyeleri,
} from './sales-order-waybill'

const sevkiyat = (ek: Partial<Sevkiyat> = {}): Sevkiyat => ({
  id: 'S1',
  sevkiyatNo: 'SHP-000001',
  durum: 'SHIPPED',
  musteriAd: 'Migros',
  olusturmaTarihi: '2026-10-01T08:00:00Z',
  satirlar: [
    { id: 'r1', stokKalemiId: 'K1', miktar: 10, birim: 'koli', siraNo: 1 },
  ],
  ...ek,
})

describe('siparisIrsaliyeleri', () => {
  it('yalnız BU siparişin sevkiyatlarını veriyor', () => {
    const liste = siparisIrsaliyeleri('SIP-1', [
      sevkiyat({ id: 'a', sevkiyatNo: 'SHP-000001', siparisId: 'SIP-1' }),
      sevkiyat({ id: 'b', sevkiyatNo: 'SHP-000002', siparisId: 'SIP-2' }),
      sevkiyat({ id: 'c', sevkiyatNo: 'SHP-000003' }), // siparişsiz: numune
    ])
    expect(liste.map(i => i.sevkiyatId)).toEqual(['a'])
  })

  it('numara sırasına diziyor', () => {
    const liste = siparisIrsaliyeleri('SIP-1', [
      sevkiyat({ id: 'c', sevkiyatNo: 'SHP-000010', siparisId: 'SIP-1' }),
      sevkiyat({ id: 'a', sevkiyatNo: 'SHP-000002', siparisId: 'SIP-1' }),
    ])
    expect(liste.map(i => i.sevkiyatNo)).toEqual(['SHP-000002', 'SHP-000010'])
  })

  it('İPTAL EDİLMİŞ belgeyi GİZLEMİYOR', () => {
    // Kesilip sonra iptal edilen kâğıt müşterinin elinde kalmış olabilir.
    const liste = siparisIrsaliyeleri('SIP-1', [
      sevkiyat({ siparisId: 'SIP-1', durum: 'CANCELLED' }),
    ])
    expect(liste).toHaveLength(1)
    expect(liste[0].resmiMi).toBe(false)
    expect(liste[0].durumEtiketi).toBeTruthy()
  })

  it('yalnız SEVK EDİLMİŞ belge resmî sayılıyor', () => {
    const [taslak] = siparisIrsaliyeleri('SIP-1', [
      sevkiyat({ siparisId: 'SIP-1', durum: 'DRAFT' }),
    ])
    const [sevk] = siparisIrsaliyeleri('SIP-1', [
      sevkiyat({ siparisId: 'SIP-1', durum: 'SHIPPED' }),
    ])
    expect(taslak.resmiMi).toBe(false)
    expect(sevk.resmiMi).toBe(true)
  })

  it('tarih olarak sevk tarihini, yoksa sevk zamanını veriyor', () => {
    const [a] = siparisIrsaliyeleri('SIP-1', [
      sevkiyat({ siparisId: 'SIP-1', sevkTarihi: '2026-10-03', sevkZamani: '2026-10-04T10:00:00Z' }),
    ])
    const [b] = siparisIrsaliyeleri('SIP-1', [
      sevkiyat({ siparisId: 'SIP-1', sevkZamani: '2026-10-04T10:00:00Z' }),
    ])
    expect(a.tarih).toBe('2026-10-03')
    expect(b.tarih).toBe('2026-10-04T10:00:00Z')
  })

  it('kalem sayısını belgeden alıyor', () => {
    const [i] = siparisIrsaliyeleri('SIP-1', [
      sevkiyat({
        siparisId: 'SIP-1',
        satirlar: [
          { id: 'r1', stokKalemiId: 'K1', miktar: 1, birim: 'koli', siraNo: 1 },
          { id: 'r2', stokKalemiId: 'K2', miktar: 2, birim: 'kg', siraNo: 2 },
        ],
      }),
    ])
    expect(i.kalemSayisi).toBe(2)
  })

  it('sipariş kimliği boşsa HİÇBİR ŞEY döndürmüyor', () => {
    // Boş kimlikle süzmek, siparişsiz sevkiyatları yanlışlıkla toplardı.
    expect(siparisIrsaliyeleri('', [sevkiyat({ siparisId: undefined })])).toEqual([])
  })
})

describe('irsaliyeOzeti', () => {
  it('hiç sevkiyat yoksa bunu SUÇLAYICI OLMAYAN bir dille söylüyor', () => {
    expect(irsaliyeOzeti([])).toContain('henüz sevkiyat çıkmamış')
  })

  it('durumları ayrı ayrı sayıyor', () => {
    const liste = siparisIrsaliyeleri('SIP-1', [
      sevkiyat({ id: 'a', sevkiyatNo: 'SHP-000001', siparisId: 'SIP-1', durum: 'SHIPPED' }),
      sevkiyat({ id: 'b', sevkiyatNo: 'SHP-000002', siparisId: 'SIP-1', durum: 'DRAFT' }),
      sevkiyat({ id: 'c', sevkiyatNo: 'SHP-000003', siparisId: 'SIP-1', durum: 'CANCELLED' }),
    ])
    const c = irsaliyeOzeti(liste)
    expect(c).toContain('3 sevkiyat belgesi')
    expect(c).toContain('1 sevk edildi')
    expect(c).toContain('1 taslak')
    expect(c).toContain('1 iptal')
  })
})

describe('irsaliyeBelgeBasligi', () => {
  it('SİPARİŞ numarasını da yazıyor', () => {
    // Üç irsaliyesi olan siparişte, sekmede yalnız sevkiyat numarası görmek
    // hangi kâğıdın hangi siparişe ait olduğunu söylemiyordu.
    const b = irsaliyeBelgeBasligi('SIP-2026-0001', 'SHP-000002')
    expect(b).toContain('SIP-2026-0001')
    expect(b).toContain('SHP-000002')
  })
})

describe('irsaliyeUyarisi', () => {
  const tek = (durum: Sevkiyat['durum']) =>
    siparisIrsaliyeleri('SIP-1', [sevkiyat({ siparisId: 'SIP-1', durum })])[0]

  it('sevk edilmiş belgede uyarı YOK', () => {
    expect(irsaliyeUyarisi(tek('SHIPPED'))).toBeUndefined()
  })

  it('taslakta "resmî irsaliye yerine geçmez" diyor', () => {
    expect(irsaliyeUyarisi(tek('DRAFT'))).toContain('GEÇMEZ')
  })

  it('iptalde çıkışların geri alındığını söylüyor', () => {
    expect(irsaliyeUyarisi(tek('CANCELLED'))).toContain('geri alındı')
  })
})
