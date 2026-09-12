// Yazdırılabilir belgeler. Saf metin ürettikleri için tarayıcı gerekmiyor;
// en kritik iki şey burada sınanıyor: PARTİ NUMARASI KÂĞITTA VAR MI, ve
// müşteri adı gibi veriler HTML'e kod olarak sızıyor mu.

import { describe, it, expect } from 'vitest'
import type { Movement } from '../core/stock/stock.repository'
import { geriCagirmaRaporu } from './recall'
import type { IleriIzlemeSonucu, SoyagaciLotu } from './genealogy'
import type { Sevkiyat } from './shipment.repository'
import { geriCagirmaHtml, irsaliyeHtml, type BelgeSozlugu } from './shipment-documents'
import { yazdirmaBelgesi, kacir } from '../core/print/print'

const sozluk: BelgeSozlugu = {
  kalemAdi: id => (id === 'k1' ? 'Mercimek çorbası' : id),
  temelBirim: () => 'kg',
  lotKodu: id => (id ? `LOT-${id}` : '—'),
  firmaAdi: 'MİYOP Mutfak',
}

const sevkiyat = (yama: Partial<Sevkiyat> = {}): Sevkiyat => ({
  id: 's1', sevkiyatNo: 'SVK-2026-0001', durum: 'SHIPPED',
  musteriAd: 'Ada Lokanta', musteriTelefon: '0212 000 00 00',
  sevkTarihi: '2026-02-03', olusturmaTarihi: '2026-02-01T00:00:00Z',
  satirlar: [{
    id: 'sl1', stokKalemiId: 'k1', stokKalemiAd: 'Mercimek çorbası',
    miktar: 40, birim: 'kg', siraNo: 1,
  }],
  ...yama,
})

const hareket = (yama: Partial<Movement>): Movement => ({
  id: 'h1', tenantId: 't', branchId: 'b', stockItemId: 'k1',
  quantityBase: -40, quantityEntered: -40, uomEntered: 'kg',
  reason: 'SHIPMENT_OUT', sourceType: 'shipment', sourceId: 's1',
  idempotencyKey: 'x', occurredAt: new Date(), recordedAt: new Date(),
  ...yama,
})

const lot = (kod: string, ad = 'Un', ek: Partial<SoyagaciLotu> = {}): SoyagaciLotu => ({
  lotId: `id-${kod}`, lotKodu: kod, stokKalemiId: 'k9', stokKalemiAd: ad,
  kaynakTipi: 'RECEIPT', ...ek,
})

const sonuc = (yama: Partial<IleriIzlemeSonucu> = {}): IleriIzlemeSonucu => ({
  tureyenLotlar: [], sevkiyatlar: [], derinlikAsildi: false, ...yama,
})

describe('kacir', () => {
  it('HTML’e sızabilecek işaretleri kaçırıyor', () => {
    expect(kacir('<script>x</script>')).toBe('&lt;script&gt;x&lt;/script&gt;')
    expect(kacir('Ada & "Ev"')).toBe('Ada &amp; &quot;Ev&quot;')
  })
})

describe('irsaliyeHtml', () => {
  it('parti numarasını DEFTERDEN alıp kâğıda basıyor', () => {
    const html = irsaliyeHtml(sevkiyat(), [hareket({ lotId: 'A' })], sozluk)
    expect(html).toContain('LOT-A')
    expect(html).toContain('Ada Lokanta')
    expect(html).toContain('SVK-2026-0001')
  })

  it('FEFO çıkışı böldüğünde İKİ parti de kâğıtta görünüyor', () => {
    const html = irsaliyeHtml(sevkiyat(), [
      hareket({ id: 'h1', lotId: 'A', quantityEntered: -25, quantityBase: -25 }),
      hareket({ id: 'h2', lotId: 'B', quantityEntered: -15, quantityBase: -15 }),
    ], sozluk)

    expect(html).toContain('LOT-A')
    expect(html).toContain('LOT-B')
    // Ve neden iki satır olduğu kâğıtta yazıyor.
    expect(html).toContain('bölündü')
  })

  it('sevk edilmemiş sevkiyatta kâğıdın başına uyarı basılıyor', () => {
    const html = irsaliyeHtml(sevkiyat({ durum: 'DRAFT' }), [], sozluk)
    expect(html).toContain('henüz sevk edilmemiş')
    expect(html).toContain('Resmî irsaliye yerine geçmez')
  })

  it('defterde hareket yoksa belge satırları basılıyor, parti yerine tire', () => {
    const html = irsaliyeHtml(sevkiyat({ durum: 'DRAFT' }), [], sozluk)
    expect(html).toContain('Mercimek çorbası')
  })

  it('müşteri adı HTML olarak yorumlanmıyor', () => {
    const html = irsaliyeHtml(
      sevkiyat({ musteriAd: '<img src=x onerror=alert(1)>' }), [hareket({ lotId: 'A' })], sozluk,
    )
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('ters kayıtlar irsaliyeye satır olarak girmiyor', () => {
    const html = irsaliyeHtml(sevkiyat(), [
      hareket({ id: 'h1', lotId: 'A' }),
      hareket({ id: 'r1', lotId: 'A', reason: 'REVERSAL', quantityBase: 40,
        quantityEntered: 40, reversesMovementId: 'h1' }),
    ], sozluk)
    // Tek satır: LOT-A bir kez, tablo gövdesinde.
    expect(html.split('LOT-A').length - 1).toBe(1)
  })
})

describe('geriCagirmaHtml', () => {
  const kaynak = lot('UN-1', 'Un', { tedarikci: 'Anadolu Un' })

  it('aranacak müşteriyi ve telefonu basıyor', () => {
    const rapor = geriCagirmaRaporu(
      kaynak,
      sonuc({ sevkiyatlar: [{ sevkiyatId: 's1', lot: kaynak, miktar: 40, derinlik: 0, yol: ['UN-1'] }] }),
      [sevkiyat()],
      '2026-02-04T10:00:00Z',
    )
    const html = geriCagirmaHtml(rapor, 'MİYOP Mutfak')

    expect(html).toContain('Geri Çağırma Listesi')
    expect(html).toContain('Ada Lokanta')
    expect(html).toContain('0212 000 00 00')
    expect(html).toContain('Anadolu Un')
  })

  it('EKSİK liste, eksik olduğunu kâğıdın başında söylüyor', () => {
    const rapor = geriCagirmaRaporu(
      kaynak,
      sonuc({
        derinlikAsildi: true,
        sevkiyatlar: [{ sevkiyatId: 'yok', lot: kaynak, miktar: 5, derinlik: 0, yol: ['UN-1'] }],
      }),
      [],
    )
    const html = geriCagirmaHtml(rapor)

    expect(html).toContain('BU LİSTE EKSİK OLABİLİR')
    // Uyarı, tablodan ÖNCE basılmalı: sonra basılsaydı okunmazdı.
    expect(html.indexOf('BU LİSTE EKSİK OLABİLİR')).toBeLessThan(html.indexOf('Aranacak müşteriler'))
  })

  it('kimseye gitmemiş partide "aranacak kimse yok" yazıyor', () => {
    const html = geriCagirmaHtml(geriCagirmaRaporu(kaynak, sonuc(), []))
    expect(html).toContain('aranacak kimse yok')
    expect(html).not.toContain('BU LİSTE EKSİK OLABİLİR')
  })

  it('dolaylı gidişte zincir yolu kâğıtta görünüyor', () => {
    const mamul = lot('CRB-9', 'Mercimek çorbası', { kaynakTipi: 'PRODUCTION' })
    const rapor = geriCagirmaRaporu(
      kaynak,
      sonuc({
        tureyenLotlar: [mamul],
        sevkiyatlar: [{ sevkiyatId: 's1', lot: mamul, miktar: 12, derinlik: 1, yol: ['UN-1', 'CRB-9'] }],
      }),
      [sevkiyat()],
    )
    const html = geriCagirmaHtml(rapor)
    expect(html).toContain('UN-1 → CRB-9')
    expect(html).toContain('Etkilenen mamul partileri')
  })
})

describe('yazdirmaBelgesi', () => {
  it('tam bir HTML belgesi kuruyor ve başlığı kaçırıyor', () => {
    const belge = yazdirmaBelgesi('İrsaliye <x>', '<p>gövde</p>')
    expect(belge.startsWith('<!doctype html>')).toBe(true)
    expect(belge).toContain('<title>İrsaliye &lt;x&gt;</title>')
    expect(belge).toContain('<p>gövde</p>')
    expect(belge).toContain('@page')
  })
})
