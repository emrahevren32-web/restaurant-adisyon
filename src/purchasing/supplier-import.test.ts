// ═══════════════════════════════════════════════════════════════════════════
// Tedarikçi içe aktarma testleri.
//
// Ortak çekirdeğin (core/import/sheet.ts) kuralları stok kartı testlerinde
// ayrıntılı sınanıyor. Buradakiler TEDARİKÇİYE ÖZGÜ olanlar: e-posta biçimi,
// isteğe bağlı alanların boş bırakılabilmesi ve mevcut kayıtla eşleşme.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { satirlariYaz } from '../core/import/sheet'
import { TEDARIKCI_SUTUNLARI, tedarikcileriCozumle } from './supplier-import'
import type { Tedarikci } from './supplier.repository'

const tedarikci = (kod: string, ad: string): Tedarikci => ({
  id: `id-${kod}`, kod, ad, aktif: true,
})

const BASLIK = ['Kod', 'Ad', 'Vergi No', 'Yetkili', 'Telefon', 'E-posta', 'Adres', 'Not']

describe('tedarikçi içe aktarma', () => {
  it('bütün alanlar okunur', () => {
    const o = tedarikcileriCozumle([
      BASLIK,
      ['TED-001', 'ABC Gıda', '1234567890', 'Ahmet Yılmaz',
       '0212 000 00 00', 'siparis@abcgida.com', 'İstanbul', 'Salı teslimat'],
    ], [])

    expect(o.yeni).toBe(1)
    const satir = o.satirlar[0]
    if(satir.durum === 'YENI'){
      expect(satir.girdi.ad).toBe('ABC Gıda')
      expect(satir.girdi.vergiNo).toBe('1234567890')
      expect(satir.girdi.eposta).toBe('siparis@abcgida.com')
      expect(satir.girdi.not).toBe('Salı teslimat')
    }
  })

  it('yalnızca kod ve ad yeterlidir', () => {
    // Müşterinin elindeki liste çoğu zaman iki sütundan ibarettir.
    const o = tedarikcileriCozumle([
      ['Kod', 'Ad'],
      ['TED-001', 'ABC Gıda'],
    ], [])

    expect(o.eksikSutunlar).toEqual([])
    expect(o.yeni).toBe(1)
    const satir = o.satirlar[0]
    if(satir.durum === 'YENI'){
      // Boş alan boş METİN değil, TANIMSIZ olmalı: veritabanında "" ile null
      // farklı şeylerdir ve "" bir e-posta adresi gibi görünür.
      expect(satir.girdi.eposta).toBeUndefined()
      expect(satir.girdi.telefon).toBeUndefined()
    }
  })

  it('mevcut kod GÜNCELLEME olur', () => {
    const o = tedarikcileriCozumle([
      ['Kod', 'Ad', 'Telefon'],
      ['ted-001', 'ABC Gıda A.Ş.', '0216 111 11 11'],
    ], [tedarikci('TED-001', 'ABC Gıda')])

    expect(o.guncelleme).toBe(1)
    const satir = o.satirlar[0]
    if(satir.durum === 'GUNCELLEME') expect(satir.mevcutId).toBe('id-TED-001')
  })

  it('bozuk e-posta ÖNİZLEMEDE yakalanır', () => {
    // Yazma anında yakalansaydı, 300 satırlık dosyanın ortasında patlardı ve
    // kullanıcı hangi satır olduğunu aramak zorunda kalırdı.
    const o = tedarikcileriCozumle([
      ['Kod', 'Ad', 'E-posta'],
      ['TED-001', 'ABC', 'siparis@abcgida.com'],
      ['TED-002', 'DEF', 'bu bir eposta degil'],
    ], [])

    expect(o.yeni).toBe(1)
    expect(o.hatali).toBe(1)
    const ikinci = o.satirlar[1]
    if(ikinci.durum === 'HATA') expect(ikinci.hatalar[0].alan).toBe('E-posta')
  })

  it('başlıklar farklı yazılmış olabilir', () => {
    const o = tedarikcileriCozumle([
      ['CARİ KOD', 'Firma Adı', 'VKN', 'İlgili Kişi', 'GSM', 'Mail'],
      ['TED-001', 'ABC Gıda', '123', 'Ahmet', '0555', 'a@b.com'],
    ], [])

    expect(o.eksikSutunlar).toEqual([])
    const satir = o.satirlar[0]
    if(satir.durum === 'YENI'){
      expect(satir.girdi.vergiNo).toBe('123')
      expect(satir.girdi.yetkili).toBe('Ahmet')
      expect(satir.girdi.telefon).toBe('0555')
    }
  })

  it('aynı kod iki kez geçerse ikincisi reddedilir', () => {
    const o = tedarikcileriCozumle([
      ['Kod', 'Ad'],
      ['TED-001', 'İlk'],
      ['TED-001', 'İkinci'],
    ], [])

    expect(o.yeni).toBe(1)
    expect(o.hatali).toBe(1)
  })

  it('zorunlu sütun eksikse hiçbir satır okunmaz', () => {
    const o = tedarikcileriCozumle([
      ['Firma', 'Şehir'],
      ['ABC', 'İstanbul'],
    ], [])

    expect(o.eksikSutunlar).toEqual(['Kod', 'Ad'])
    expect(o.satirlar).toHaveLength(0)
  })

  it('şablonda zorunlu olanlar kod ve addır', () => {
    expect(TEDARIKCI_SUTUNLARI.filter(s => s.zorunlu).map(s => s.baslik))
      .toEqual(['Kod', 'Ad'])
  })

  it('yazma: yeniler eklenir, mevcutlar güncellenir', async () => {
    const eklenenler: string[] = []
    const guncellenenler: string[] = []

    const s = await satirlariYaz(
      tedarikcileriCozumle([
        ['Kod', 'Ad'],
        ['TED-001', 'Var olan'],
        ['TED-002', 'Yeni'],
      ], [tedarikci('TED-001', 'Var olan')]),
      async g => { eklenenler.push(g.kod) },
      async id => { guncellenenler.push(id) },
    )

    expect(eklenenler).toEqual(['TED-002'])
    expect(guncellenenler).toEqual(['id-TED-001'])
    expect(s.basarisiz).toEqual([])
  })
})
