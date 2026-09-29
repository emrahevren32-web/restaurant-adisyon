// Siparişten sevkiyat türetme — en kritik iki şey burada sınanıyor:
// AYNI MALIN İKİ KEZ GİTMEMESİ ve BİRİM UYUŞMAZLIĞINDA SAYI UYDURULMAMASI.

import { describe, it, expect } from 'vitest'
import type { Siparis, SiparisDurumu } from './sales-order.repository'
import {
  sevkiyatTuret, sevkOzeti, sevkToplami, SevkiyatTuretmeError,
  TURETILEBILIR_DURUMLAR, type KalemSevkDurumu,
} from './sales-order-shipment'

const siparis = (yama: Partial<Siparis> = {}): Siparis => ({
  id: 'sip1', siparisNo: 'SIP-2026-0001',
  musteriId: 'm1', musteriAdi: 'Migros',
  noktaId: 'n1', noktaAdi: 'Ataşehir',
  siparisTarihi: '2026-09-20', sevkTarihi: '2026-09-25',
  durum: 'Hazır', guncelRevizyon: 1,
  olusturmaZamani: '2026-09-20T08:00:00Z',
  ...yama,
})

const durum = (yama: Partial<KalemSevkDurumu> = {}): KalemSevkDurumu => ({
  kalemId: 'k1', kalemAdi: 'Mercimek çorbası',
  siparisMiktar: 40, siparisBirim: 'koli',
  sevkMiktar: 0, sevkBirimleri: [],
  kalan: 40, birimUyusmuyor: false, siparisDisi: false,
  ...yama,
})

describe('sevkiyatTuret', () => {
  it('kalan miktarı yazıyor, SİPARİŞ MİKTARINI DEĞİL', () => {
    // Asıl tehlike bu: 15 koli gitmişken tam 40'ı tekrar yazsaydık müşteriye
    // iki katı mal giderdi ve kimse fark etmezdi.
    const g = sevkiyatTuret(siparis(), [durum({ sevkMiktar: 15, kalan: 25 })], 'SVK-2026-0002')
    expect(g.satirlar).toHaveLength(1)
    expect(g.satirlar[0]?.miktar).toBe(25)
    expect(g.satirlar[0]?.birim).toBe('koli')
  })

  it('sevkiyatı siparişe ve müşteri kartına bağlıyor', () => {
    const g = sevkiyatTuret(siparis(), [durum()], 'SVK-2026-0002')
    expect(g.siparisId).toBe('sip1')
    expect(g.musteriId).toBe('m1')
    expect(g.noktaId).toBe('n1')
    expect(g.musteriAd).toBe('Migros')
    expect(g.sevkTarihi).toBe('2026-09-25')
  })

  it('tamamı gitmiş kalemi sevkiyata koymuyor', () => {
    const g = sevkiyatTuret(siparis(), [
      durum({ kalemId: 'k1', sevkMiktar: 40, kalan: 0 }),
      durum({ kalemId: 'k2', siparisMiktar: 25, sevkMiktar: 0, kalan: 25 }),
    ], 'SVK-2026-0003')
    expect(g.satirlar.map(s => s.stokKalemiId)).toEqual(['k2'])
  })

  it('kalan kalmadıysa sevkiyat kurmuyor, SEBEBİNİ SÖYLÜYOR', () => {
    expect(() => sevkiyatTuret(
      siparis({ durum: 'Sevk Edildi' }), [durum({ sevkMiktar: 40, kalan: 0 })], 'SVK-X',
    )).toThrow(/sevk edilmemiş kalemi kalmadı/)
  })

  it('siparişte olmayan kalemi sevkiyata KOYMUYOR', () => {
    // Sipariş dışı gidiş bir fark konusudur; onu yeni bir sevkiyata
    // kopyalamak, hatayı çoğaltmak olurdu.
    expect(() => sevkiyatTuret(siparis(), [
      durum({ kalemId: 'k1', sevkMiktar: 40, kalan: 0 }),
      durum({ kalemId: 'kX', siparisMiktar: undefined, siparisBirim: undefined,
              sevkMiktar: 2, sevkBirimleri: ['koli'], kalan: undefined,
              siparisDisi: true }),
    ], 'SVK-X')).toThrow(SevkiyatTuretmeError)
  })

  it('BİRİM UYUŞMUYORSA sayı uydurmuyor, duruyor', () => {
    expect(() => sevkiyatTuret(siparis(), [
      durum({ sevkMiktar: 3, sevkBirimleri: ['kg'], kalan: undefined, birimUyusmuyor: true }),
    ], 'SVK-X')).toThrow(/birimi ile sevk birimi uyuşmuyor/)
  })

  it('hazır olmayan siparişten sevkiyat çıkmıyor', () => {
    for(const d of ['Taslak', 'Onaylandı', 'Hazırlanıyor', 'İptal'] as SiparisDurumu[]){
      expect(() => sevkiyatTuret(siparis({ durum: d }), [durum()], 'SVK-X'))
        .toThrow(/Sevkiyat çıkarmak için önce siparişi "Hazır" yapın/)
    }
  })

  it('türetilebilir durumlar, 0050 akışındaki sevk durumlarıyla aynı', () => {
    expect([...TURETILEBILIR_DURUMLAR])
      .toEqual(['Hazır', 'Kısmi Sevk', 'Sevk Edildi'])
  })
})

describe('sevkOzeti', () => {
  it('hiç gitmemiş kalemi söylüyor', () => {
    expect(sevkOzeti(durum())).toBe('40 koli · henüz sevk edilmedi')
  })

  it('kısmi gidişte kalanı söylüyor', () => {
    expect(sevkOzeti(durum({ sevkMiktar: 15, kalan: 25 })))
      .toBe('40 koli · 15 gitti · 25 kaldı')
  })

  it('tamamlanmışı söylüyor', () => {
    expect(sevkOzeti(durum({ sevkMiktar: 40, kalan: 0 }))).toBe('40 koli · tamamı gitti')
  })

  it('birim uyuşmazlığında "hesaplanamıyor" DİYOR, sayı vermiyor', () => {
    const c = sevkOzeti(durum({ sevkMiktar: 3, sevkBirimleri: ['kg'],
      kalan: undefined, birimUyusmuyor: true }))
    expect(c).toMatch(/hesaplanamıyor/)
    expect(c).not.toMatch(/kaldı/)
  })

  it('sipariş dışı kalemi ayrı yazıyor', () => {
    expect(sevkOzeti(durum({ siparisDisi: true, siparisMiktar: undefined,
      siparisBirim: undefined, sevkMiktar: 2, sevkBirimleri: ['koli'], kalan: undefined })))
      .toBe('siparişte yok · 2 koli gitti')
  })
})

describe('sevkToplami', () => {
  it('tamamlanan, bekleyen ve FAZLA gideni ayrı sayıyor', () => {
    const t = sevkToplami([
      durum({ kalemId: 'a', sevkMiktar: 40, kalan: 0 }),
      durum({ kalemId: 'b', sevkMiktar: 15, kalan: 25 }),
      // Sipariştekinden fazla gitmiş: kalan eksiye düşer.
      durum({ kalemId: 'c', sevkMiktar: 45, kalan: -5 }),
    ])
    expect(t).toMatchObject({ kalemSayisi: 3, tamamlanan: 1, bekleyen: 1, fazlaGiden: 1 })
  })

  it('eksik ile fazla birbirini GÖTÜRMÜYOR', () => {
    const t = sevkToplami([
      durum({ kalemId: 'a', sevkMiktar: 30, kalan: 10 }),
      durum({ kalemId: 'b', sevkMiktar: 50, kalan: -10 }),
    ])
    expect(t.bekleyen).toBe(1)
    expect(t.fazlaGiden).toBe(1)
    expect(t.tamamlanan).toBe(0)
  })

  it('hesaplanamayan ve sipariş dışı kalemleri ayrı sayıyor', () => {
    const t = sevkToplami([
      durum({ kalemId: 'a', sevkMiktar: 40, kalan: 0 }),
      durum({ kalemId: 'b', kalan: undefined, birimUyusmuyor: true }),
      durum({ kalemId: 'c', siparisDisi: true, kalan: undefined }),
    ])
    expect(t.hesaplanamayan).toBe(1)
    expect(t.siparisDisiKalem).toBe(1)
    expect(t.kalemSayisi).toBe(2)
  })
})

describe('sevkiyatTuret · müşteri adı', () => {
  it('kart adı boşsa sevkiyat kurmuyor — irsaliyede kimi arayacağımız yazmalı', () => {
    expect(() => sevkiyatTuret(
      siparis({ musteriAdi: '  ' }), [durum()], 'SVK-X',
    )).toThrow(/müşteri kartı okunamadı/)
  })
})
