// Geri çağırma raporu — ekranın ve yazıcının aynı listeyi görmesini sağlayan
// birleştirme. Buradaki testlerin çoğu tek bir şeyi kolluyor: EKSİK BİR LİSTE
// EKSİK OLDUĞUNU SÖYLÜYOR MU.

import { describe, it, expect } from 'vitest'
import type { Movement } from '../core/stock/stock.repository'
import type { IleriIzlemeSonucu, SoyagaciLotu } from './genealogy'
import type { Sevkiyat } from './shipment.repository'
import { geriCagirmaRaporu, sevkiyatinLotIdleri } from './recall'

const lot = (kod: string, ad = 'Un', ek: Partial<SoyagaciLotu> = {}): SoyagaciLotu => ({
  lotId: `id-${kod}`, lotKodu: kod, stokKalemiId: 'k1', stokKalemiAd: ad,
  kaynakTipi: 'RECEIPT', ...ek,
})

const sevkiyat = (id: string, no: string, musteri: string, ek: Partial<Sevkiyat> = {}): Sevkiyat => ({
  id, sevkiyatNo: no, durum: 'SHIPPED', musteriAd: musteri,
  olusturmaTarihi: '2026-01-01T00:00:00Z', satirlar: [], ...ek,
})

const sonuc = (yama: Partial<IleriIzlemeSonucu> = {}): IleriIzlemeSonucu => ({
  tureyenLotlar: [], sevkiyatlar: [], derinlikAsildi: false, ...yama,
})

const hareket = (yama: Partial<Movement>): Movement => ({
  id: 'h1', tenantId: 't', branchId: 'b', stockItemId: 'k1',
  quantityBase: -10, quantityEntered: -10, uomEntered: 'kg',
  reason: 'SHIPMENT_OUT', sourceType: 'shipment',
  idempotencyKey: 'x', occurredAt: new Date(), recordedAt: new Date(),
  ...yama,
})

describe('geriCagirmaRaporu', () => {
  it('sevkiyat izini müşteri satırına çeviriyor', () => {
    const kaynak = lot('UN-1')
    const rapor = geriCagirmaRaporu(
      kaynak,
      sonuc({ sevkiyatlar: [{ sevkiyatId: 's1', lot: kaynak, miktar: 40, derinlik: 0, yol: ['UN-1'] }] }),
      [sevkiyat('s1', 'SVK-2026-0001', 'Ada Lokanta', { musteriTelefon: '0212', sevkTarihi: '2026-02-03' })],
    )

    expect(rapor.satirlar).toHaveLength(1)
    expect(rapor.satirlar[0].musteriAd).toBe('Ada Lokanta')
    expect(rapor.satirlar[0].musteriTelefon).toBe('0212')
    expect(rapor.satirlar[0].sevkiyatNo).toBe('SVK-2026-0001')
    expect(rapor.satirlar[0].miktar).toBe(40)
    expect(rapor.eksik).toBe(false)
  })

  it('aynı müşteriye iki sevkiyat gitse müşteri BİR kez sayılıyor', () => {
    const kaynak = lot('UN-1')
    const rapor = geriCagirmaRaporu(
      kaynak,
      sonuc({ sevkiyatlar: [
        { sevkiyatId: 's1', lot: kaynak, miktar: 10, derinlik: 0, yol: ['UN-1'] },
        { sevkiyatId: 's2', lot: kaynak, miktar: 20, derinlik: 0, yol: ['UN-1'] },
      ] }),
      [
        sevkiyat('s1', 'SVK-1', 'Ada Lokanta', { musteriTelefon: '0212' }),
        sevkiyat('s2', 'SVK-2', 'Ada Lokanta', { musteriTelefon: '0212' }),
      ],
    )

    expect(rapor.satirlar).toHaveLength(2)
    expect(rapor.musteriSayisi).toBe(1)
  })

  it('aynı adlı FARKLI müşteriler ayrı sayılıyor (telefon ayırıyor)', () => {
    const kaynak = lot('UN-1')
    const rapor = geriCagirmaRaporu(
      kaynak,
      sonuc({ sevkiyatlar: [
        { sevkiyatId: 's1', lot: kaynak, miktar: 10, derinlik: 0, yol: ['UN-1'] },
        { sevkiyatId: 's2', lot: kaynak, miktar: 20, derinlik: 0, yol: ['UN-1'] },
      ] }),
      [
        sevkiyat('s1', 'SVK-1', 'Ada Lokanta', { musteriTelefon: '0212' }),
        sevkiyat('s2', 'SVK-2', 'Ada Lokanta', { musteriTelefon: '0312' }),
      ],
    )

    expect(rapor.musteriSayisi).toBe(2)
  })

  it('belgesi bulunamayan sevkiyat SESSİZCE ATILMIYOR; rapor eksik işaretleniyor', () => {
    const kaynak = lot('UN-1')
    const rapor = geriCagirmaRaporu(
      kaynak,
      sonuc({ sevkiyatlar: [{ sevkiyatId: 'yok', lot: kaynak, miktar: 5, derinlik: 0, yol: ['UN-1'] }] }),
      [],
    )

    // Satır listede DURUYOR — atılsaydı liste kısalır, kimse fark etmezdi.
    expect(rapor.satirlar).toHaveLength(1)
    expect(rapor.satirlar[0].musteriAd).toBe('belge bulunamadı')
    expect(rapor.eksik).toBe(true)
    expect(rapor.eksikSebepleri.join(' ')).toContain('okunamadı')
  })

  it('derinlik sınırına dayanıldıysa rapor eksik işaretleniyor', () => {
    const rapor = geriCagirmaRaporu(lot('UN-1'), sonuc({ derinlikAsildi: true }), [])
    expect(rapor.eksik).toBe(true)
    expect(rapor.eksikSebepleri.join(' ')).toContain('derinlik')
  })

  it('hiçbir yere gitmemiş parti: boş liste ama EKSİK DEĞİL', () => {
    const rapor = geriCagirmaRaporu(lot('UN-1'), sonuc(), [])
    expect(rapor.satirlar).toHaveLength(0)
    expect(rapor.musteriSayisi).toBe(0)
    expect(rapor.eksik).toBe(false)
  })

  it('türeyen mamul partileri rapora taşınıyor', () => {
    const mamul = lot('CRB-9', 'Mercimek çorbası', { kaynakTipi: 'PRODUCTION' })
    const rapor = geriCagirmaRaporu(lot('UN-1'), sonuc({ tureyenLotlar: [mamul] }), [])
    expect(rapor.tureyenLotlar.map(l => l.lotKodu)).toEqual(['CRB-9'])
  })

  it('dolaylı sevkiyatın YOLU korunuyor — hangi mamulle gittiği okunabilsin', () => {
    const mamul = lot('CRB-9', 'Mercimek çorbası', { kaynakTipi: 'PRODUCTION' })
    const rapor = geriCagirmaRaporu(
      lot('UN-1'),
      sonuc({ sevkiyatlar: [{ sevkiyatId: 's1', lot: mamul, miktar: 12, derinlik: 1, yol: ['UN-1', 'CRB-9'] }] }),
      [sevkiyat('s1', 'SVK-1', 'Ada Lokanta')],
    )
    expect(rapor.satirlar[0].yol).toEqual(['UN-1', 'CRB-9'])
    expect(rapor.satirlar[0].gidenUrun).toBe('Mercimek çorbası')
  })
})

describe('sevkiyatinLotIdleri', () => {
  it('sevkiyat çıkışlarının partilerini veriyor', () => {
    const idler = sevkiyatinLotIdleri([
      hareket({ id: 'h1', lotId: 'L1' }),
      hareket({ id: 'h2', lotId: 'L2' }),
    ])
    expect(idler).toEqual(['L1', 'L2'])
  })

  it('aynı parti iki kez geçse tek kez dönüyor', () => {
    const idler = sevkiyatinLotIdleri([
      hareket({ id: 'h1', lotId: 'L1' }),
      hareket({ id: 'h2', lotId: 'L1', stockItemId: 'k2' }),
    ])
    expect(idler).toEqual(['L1'])
  })

  it('ters kaydı olan çıkış listeye GİRMİYOR — iptal edilen mal gitmedi', () => {
    const idler = sevkiyatinLotIdleri([
      hareket({ id: 'h1', lotId: 'L1' }),
      hareket({ id: 'h2', lotId: 'L2' }),
      hareket({ id: 'r1', lotId: 'L1', reason: 'REVERSAL', quantityBase: 10,
        quantityEntered: 10, reversesMovementId: 'h1' }),
    ])
    expect(idler).toEqual(['L2'])
  })

  it('sevkiyat dışı hareketler (üretim tüketimi) sayılmıyor', () => {
    const idler = sevkiyatinLotIdleri([
      hareket({ id: 'h1', lotId: 'L1', reason: 'PRODUCTION_CONSUME' }),
    ])
    expect(idler).toEqual([])
  })

  it('partisiz çıkış listeye girmiyor', () => {
    expect(sevkiyatinLotIdleri([hareket({ id: 'h1', lotId: undefined })])).toEqual([])
  })
})
