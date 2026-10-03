// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C2 — Sipariş–teslim farkı testleri
//
// Buradaki testlerin çoğu bir SAYIYI değil, bir SUSMAYI koruyor: hesaplanamayan
// satırın "tamam" sayılmaması, kalemsiz fark kaydının rastgele bir kaleme
// yazılmaması, iş emri olmayan kalemin "eksik üretim" diye raporlanmaması.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import type { Fark } from './sales-order.repository'
import {
  teslimCumlesi,
  teslimOzeti,
  teslimSatirlari,
  uretimCumlesi,
  type TeslimFarkiSatiri,
} from './sales-order-delivery'

const satir = (y: Partial<TeslimFarkiSatiri> & { kalemId: string }): TeslimFarkiSatiri => ({
  hazirlandi: 0,
  uretimOlculebilir: true,
  isEmriSayisi: 0,
  acikIsEmri: 0,
  gitti: 0,
  gittiBirimleri: [],
  birimUyusmuyor: false,
  siparisDisi: false,
  ...y,
})

const fark = (y: Partial<Fark> & { id: string }): Fark => ({
  siparisId: 'sip-1',
  tur: 'Eksik',
  adim: 'Teslimde',
  bildirenId: 'u1',
  bildirimZamani: '2026-10-01T10:00:00Z',
  aciklama: 'Eksik geldi',
  durum: 'Açık',
  ...y,
})

describe('teslimSatirlari — fark kayıtlarını kalemine iliştirme', () => {
  it('açık fark kaydını kendi kalemine yazar', () => {
    const { satirlar } = teslimSatirlari(
      [satir({ kalemId: 'k1' }), satir({ kalemId: 'k2' })],
      [fark({ id: 'f1', kalemId: 'k2' })]
    )
    expect(satirlar[0]!.acikFarklar).toHaveLength(0)
    expect(satirlar[1]!.acikFarklar.map(f => f.id)).toEqual(['f1'])
  })

  it('KARARA BAĞLANMIŞ fark kaydı artık açık değildir, listeye girmez', () => {
    const { satirlar, kalemsizFarklar } = teslimSatirlari(
      [satir({ kalemId: 'k1' })],
      [fark({ id: 'f1', kalemId: 'k1', durum: 'Karara Bağlandı' })]
    )
    expect(satirlar[0]!.acikFarklar).toHaveLength(0)
    expect(kalemsizFarklar).toHaveLength(0)
  })

  it('İNCELEMEDE olan fark hâlâ açıktır — kapanmış sayılmaz', () => {
    const { satirlar } = teslimSatirlari(
      [satir({ kalemId: 'k1' })],
      [fark({ id: 'f1', kalemId: 'k1', durum: 'İncelemede' })]
    )
    expect(satirlar[0]!.acikFarklar).toHaveLength(1)
  })

  it('KALEMİ OLMAYAN fark hiçbir kaleme yazılmaz, ayrı döner', () => {
    // "Araç geç geldi" türü bir fark rastgele bir kaleme yazılsaydı o kalem
    // suçlu görünürdü.
    const { satirlar, kalemsizFarklar } = teslimSatirlari(
      [satir({ kalemId: 'k1' }), satir({ kalemId: 'k2' })],
      [fark({ id: 'f1' })]
    )
    expect(satirlar.every(s => s.acikFarklar.length === 0)).toBe(true)
    expect(kalemsizFarklar.map(f => f.id)).toEqual(['f1'])
  })
})

describe('teslimOzeti', () => {
  it('kalanı sıfır ya da altı olan kalem TAMAMLANAN sayılır', () => {
    const { satirlar } = teslimSatirlari(
      [satir({ kalemId: 'k1', istendi: 10, gitti: 10, kalan: 0 }),
       satir({ kalemId: 'k2', istendi: 10, gitti: 12, kalan: -2 })],
      []
    )
    const o = teslimOzeti(satirlar)
    expect(o.tamamlanan).toBe(2)
    expect(o.eksikKalan).toBe(0)
  })

  it('kalanı olan kalem EKSİK sayılır', () => {
    const { satirlar } = teslimSatirlari(
      [satir({ kalemId: 'k1', istendi: 10, gitti: 4, kalan: 6 })], []
    )
    expect(teslimOzeti(satirlar).eksikKalan).toBe(1)
  })

  it('ÖLÇÜLEMEYEN kalem ne tamamlanana ne eksiğe yazılır', () => {
    // Birimler uyuşmadığı için veritabanı çıkarma yapmadı. İki kovadan birine
    // atmak, bilmediğimizi bildiğimiz gibi göstermek olurdu.
    const { satirlar } = teslimSatirlari(
      [satir({ kalemId: 'k1', istendi: 100, gitti: 5, birimUyusmuyor: true })], []
    )
    const o = teslimOzeti(satirlar)
    expect(o.olculemeyen).toBe(1)
    expect(o.tamamlanan).toBe(0)
    expect(o.eksikKalan).toBe(0)
  })

  it('SİPARİŞ DIŞI kalem ayrı sayılır, eksik sayılmaz', () => {
    const { satirlar } = teslimSatirlari(
      [satir({ kalemId: 'k1', gitti: 3, siparisDisi: true })], []
    )
    const o = teslimOzeti(satirlar)
    expect(o.siparisDisi).toBe(1)
    expect(o.eksikKalan).toBe(0)
  })

  it('açık farklar kalemli ve kalemsiz olanlar TOPLANARAK sayılır', () => {
    const { satirlar, kalemsizFarklar } = teslimSatirlari(
      [satir({ kalemId: 'k1', kalan: 0 })],
      [fark({ id: 'f1', kalemId: 'k1' }), fark({ id: 'f2' })]
    )
    expect(teslimOzeti(satirlar, kalemsizFarklar).acikFark).toBe(2)
  })

  it('açık iş emirleri toplanır', () => {
    const { satirlar } = teslimSatirlari(
      [satir({ kalemId: 'k1', isEmriSayisi: 2, acikIsEmri: 1, kalan: 0 }),
       satir({ kalemId: 'k2', isEmriSayisi: 1, acikIsEmri: 1, kalan: 0 })], []
    )
    expect(teslimOzeti(satirlar).acikIsEmri).toBe(2)
  })
})

describe('teslimCumlesi', () => {
  it('her şey yolundaysa tamamlandığını söyler', () => {
    const { satirlar } = teslimSatirlari(
      [satir({ kalemId: 'k1', istendi: 10, gitti: 10, kalan: 0 })], []
    )
    expect(teslimCumlesi(teslimOzeti(satirlar))).toBe('Sipariş tamamen teslim edildi.')
  })

  it('ÖLÇÜLEMEYEN kalem varken ASLA "tamamen teslim edildi" demez', () => {
    // Hesaplanamayan satırın üstüne "tamam" yazmak en tehlikeli yalandır:
    // kimse bir daha bakmaz.
    const { satirlar } = teslimSatirlari(
      [satir({ kalemId: 'k1', istendi: 10, gitti: 10, kalan: 0 }),
       satir({ kalemId: 'k2', istendi: 100, gitti: 5, birimUyusmuyor: true })], []
    )
    const cumle = teslimCumlesi(teslimOzeti(satirlar))
    expect(cumle).not.toContain('tamamen teslim')
    expect(cumle).toContain('ölçülemiyor')
  })

  it('açık fark kaydı varken tamamlandı demez', () => {
    const { satirlar, kalemsizFarklar } = teslimSatirlari(
      [satir({ kalemId: 'k1', istendi: 10, gitti: 10, kalan: 0 })],
      [fark({ id: 'f1', kalemId: 'k1' })]
    )
    const cumle = teslimCumlesi(teslimOzeti(satirlar, kalemsizFarklar))
    expect(cumle).not.toContain('tamamen teslim')
    expect(cumle).toContain('1 açık fark kaydı')
  })

  it('kalemi olmayan sipariş için boş cümle değil, açıklama döner', () => {
    expect(teslimCumlesi(teslimOzeti([]))).toBe('Bu siparişte kalem yok.')
  })
})

describe('uretimCumlesi', () => {
  it('iş emri YOKSA "depodan" der — sıfır üretimi eksiklik saymaz', () => {
    expect(uretimCumlesi(satir({ kalemId: 'k1', isEmriSayisi: 0 })))
      .toBe('Depodan — üretilmiyor')
  })

  it('üretilen miktarı ve açık iş emri sayısını yazar', () => {
    expect(uretimCumlesi(satir({
      kalemId: 'k1', isEmriSayisi: 2, acikIsEmri: 1,
      hazirlandi: 12, hazirlandiBirim: 'koli',
    }))).toBe('12 koli üretildi · 1 iş emri açık')
  })

  it('birim kıyaslanamıyorsa bunu AÇIKÇA yazar', () => {
    expect(uretimCumlesi(satir({
      kalemId: 'k1', isEmriSayisi: 1, hazirlandi: 40, hazirlandiBirim: 'kg',
      uretimOlculebilir: false,
    }))).toBe('40 kg üretildi (sipariş birimi farklı, kıyas yok)')
  })
})
