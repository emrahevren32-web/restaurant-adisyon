// ═══════════════════════════════════════════════════════════════════════════
// Excel içe aktarma testleri.
//
// Buradaki senaryolar kurgu değil, bir müşterinin göndereceği dosyanın hâlleri:
// sütunlar başka sırada, başlıklar başka yazılmış, ondalık virgüllü, aynı kod
// iki kez, sonda üç boş satır. Bunların her biri gerçek bir dosyada olur ve
// her biri sessiz bir hataya dönüşebilir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import { satirlariYaz } from '../core/import/sheet'
import { KALEM_SUTUNLARI, kalemleriCozumle } from './catalog-import'
import type { Birim, KatalogKalemi } from './warehouse.catalog'

const BIRIMLER: Birim[] = [
  { kod: 'kg', ad: 'Kilogram', boyut: 'AGIRLIK' },
  { kod: 'g', ad: 'Gram', boyut: 'AGIRLIK' },
  { kod: 'adet', ad: 'Adet', boyut: 'SAYI' },
]

const kalem = (kod: string, ad: string): KatalogKalemi => ({
  id: `id-${kod}`, kod, ad, temelBirim: 'kg',
  lotTakipli: true, sktTakipli: true, minMiktar: 0, aktif: true,
})

const BASLIK = ['Kod', 'Ad', 'Kategori', 'Birim', 'Lot Takibi', 'SKT Takibi', 'En Az Miktar']

describe('stok kartı içe aktarma · mutlu yol', () => {
  it('yeni kartlar YENİ olarak işaretlenir', () => {
    const o = kalemleriCozumle([
      BASLIK,
      ['MRC-001', 'Yeşil Mercimek', 'Bakliyat', 'kg', 'Evet', 'Evet', '100'],
      ['PRC-001', 'Baldo Pirinç', 'Bakliyat', 'kg', 'Evet', 'Evet', '150'],
    ], [], BIRIMLER)

    expect(o.yeni).toBe(2)
    expect(o.guncelleme).toBe(0)
    expect(o.hatali).toBe(0)

    const ilk = o.satirlar[0]
    expect(ilk.durum).toBe('YENI')
    if(ilk.durum === 'YENI'){
      expect(ilk.girdi.ad).toBe('Yeşil Mercimek')
      expect(ilk.girdi.temelBirim).toBe('kg')
      expect(ilk.girdi.lotTakipli).toBe(true)
      expect(ilk.girdi.minMiktar).toBe(100)
    }
  })

  it('kodu zaten olan kart GÜNCELLEME olur, kopya açılmaz', () => {
    const o = kalemleriCozumle([
      BASLIK,
      ['MRC-001', 'Yeşil Mercimek (yeni ad)', '', 'kg', 'Evet', 'Evet', '120'],
    ], [kalem('MRC-001', 'Yeşil Mercimek')], BIRIMLER)

    expect(o.yeni).toBe(0)
    expect(o.guncelleme).toBe(1)
    const satir = o.satirlar[0]
    if(satir.durum === 'GUNCELLEME') expect(satir.mevcutId).toBe('id-MRC-001')
  })

  it('kod eşleşmesi büyük/küçük harf ve boşluğa takılmaz', () => {
    const o = kalemleriCozumle([
      BASLIK,
      ['  mrc-001 ', 'Mercimek', '', 'kg', 'Hayır', 'Hayır', ''],
    ], [kalem('MRC-001', 'Yeşil Mercimek')], BIRIMLER)

    expect(o.guncelleme).toBe(1)
  })
})

describe('dosyanın gerçek hâlleri', () => {
  it('sütunlar başka sırada olabilir', () => {
    // Kullanıcı kolonları istediği gibi dizer; sıraya güvenmek kırılgandır.
    const o = kalemleriCozumle([
      ['Ad', 'Birim', 'Kod', 'Lot Takibi', 'SKT Takibi'],
      ['Zeytinyağı', 'kg', 'ZYT-001', 'Hayır', 'Evet'],
    ], [], BIRIMLER)

    expect(o.hatali).toBe(0)
    const satir = o.satirlar[0]
    if(satir.durum === 'YENI'){
      expect(satir.girdi.kod).toBe('ZYT-001')
      expect(satir.girdi.lotTakipli).toBe(false)
      expect(satir.girdi.sktTakipli).toBe(true)
    }
  })

  it('başlıklar farklı yazılmış olabilir', () => {
    // "Stok Kodu" / "ÜRÜN ADI" / "Ölçü Birimi" hepsi tanınır.
    const o = kalemleriCozumle([
      ['Stok Kodu', 'ÜRÜN ADI', 'Ölçü Birimi'],
      ['UN-001', 'Ekmeklik Un', 'kg'],
    ], [], BIRIMLER)

    expect(o.eksikSutunlar).toEqual([])
    expect(o.yeni).toBe(1)
  })

  it('ondalık virgülle de noktayla da yazılabilir', () => {
    const o = kalemleriCozumle([
      BASLIK,
      ['A-1', 'Virgüllü', '', 'kg', 'Hayır', 'Hayır', '1.250,5'],
      ['A-2', 'Noktalı', '', 'kg', 'Hayır', 'Hayır', '1250.5'],
    ], [], BIRIMLER)

    expect(o.hatali).toBe(0)
    const degerler = o.satirlar.map(s => (s.durum === 'YENI' ? s.girdi.minMiktar : null))
    expect(degerler).toEqual([1250.5, 1250.5])
  })

  it('sondaki boş satırlar sayılmaz', () => {
    // Excel dosyalarının sonunda bolca bulunur ve "1 kart eklenecek" yerine
    // "4 kart eklenecek" yazsaydı kullanıcı haklı olarak korkardı.
    const o = kalemleriCozumle([
      BASLIK,
      ['A-1', 'Bir Şey', '', 'kg', 'Hayır', 'Hayır', ''],
      ['', '', '', '', '', '', ''],
      [null, undefined, '', '  ', '', '', ''],
    ], [], BIRIMLER)

    expect(o.satirlar).toHaveLength(1)
    expect(o.yeni).toBe(1)
  })

  it('evet/hayır’ın on türlü yazımı anlaşılır', () => {
    const o = kalemleriCozumle([
      ['Kod', 'Ad', 'Birim', 'Lot Takibi', 'SKT Takibi'],
      ['A-1', 'X', 'kg', 'E', 'VAR'],
      ['A-2', 'Y', 'kg', 'x', '1'],
      ['A-3', 'Z', 'kg', 'Hayır', 'yok'],
    ], [], BIRIMLER)

    expect(o.hatali).toBe(0)
    const lotlar = o.satirlar.map(s => (s.durum === 'YENI' ? s.girdi.lotTakipli : null))
    expect(lotlar).toEqual([true, true, false])
  })

  it('boş bırakılan lot/SKT sütunu "hayır" sayılır', () => {
    const o = kalemleriCozumle([
      ['Kod', 'Ad', 'Birim'],
      ['A-1', 'X', 'kg'],
    ], [], BIRIMLER)

    const satir = o.satirlar[0]
    expect(satir.durum).toBe('YENI')
    if(satir.durum === 'YENI'){
      expect(satir.girdi.lotTakipli).toBe(false)
      expect(satir.girdi.minMiktar).toBe(0)
    }
  })
})

describe('reddedilenler', () => {
  it('tanımsız birim reddedilir ve geçerliler söylenir', () => {
    const o = kalemleriCozumle([
      BASLIK,
      ['A-1', 'X', '', 'kilo', 'Hayır', 'Hayır', ''],
    ], [], BIRIMLER)

    expect(o.hatali).toBe(1)
    const satir = o.satirlar[0]
    if(satir.durum === 'HATA'){
      expect(satir.hatalar[0].alan).toBe('Birim')
      expect(satir.hatalar[0].mesaj).toMatch(/kg/)
    }
  })

  it('aynı kod dosyada iki kez geçerse ikincisi reddedilir', () => {
    // Hangisinin doğru olduğunu bilemeyiz; sessizce üzerine yazmak en kötüsü.
    const o = kalemleriCozumle([
      BASLIK,
      ['A-1', 'İlk', '', 'kg', 'Hayır', 'Hayır', ''],
      ['A-1', 'İkinci', '', 'kg', 'Hayır', 'Hayır', ''],
    ], [], BIRIMLER)

    expect(o.yeni).toBe(1)
    expect(o.hatali).toBe(1)
    const ikinci = o.satirlar[1]
    if(ikinci.durum === 'HATA') expect(ikinci.hatalar[0].mesaj).toMatch(/2\. satırda/)
  })

  it('anlaşılmayan evet/hayır sessizce "hayır" sayılmaz', () => {
    // Lot takibini yanlışlıkla kapatmak, sonradan geri alınması zor bir hata.
    const o = kalemleriCozumle([
      BASLIK,
      ['A-1', 'X', '', 'kg', 'belki', 'Hayır', ''],
    ], [], BIRIMLER)

    expect(o.hatali).toBe(1)
  })

  it('sayı olmayan en az miktar reddedilir', () => {
    const o = kalemleriCozumle([
      BASLIK,
      ['A-1', 'X', '', 'kg', 'Hayır', 'Hayır', 'çok'],
    ], [], BIRIMLER)

    expect(o.hatali).toBe(1)
  })

  it('hatalı satır diğerlerini durdurmaz', () => {
    const o = kalemleriCozumle([
      BASLIK,
      ['A-1', 'İyi', '', 'kg', 'Hayır', 'Hayır', ''],
      ['', 'Kodsuz', '', 'kg', 'Hayır', 'Hayır', ''],
      ['A-3', 'Yine iyi', '', 'kg', 'Hayır', 'Hayır', ''],
    ], [], BIRIMLER)

    expect(o.yeni).toBe(2)
    expect(o.hatali).toBe(1)
  })
})

describe('yanlış dosya', () => {
  it('zorunlu sütun eksikse HİÇBİR satır okunmaz', () => {
    // 400 satırın 400'ü aynı sebeple düşerdi; onun yerine tek bir mesaj.
    const o = kalemleriCozumle([
      ['Ürün', 'Miktar'],
      ['Mercimek', '100'],
    ], [], BIRIMLER)

    expect(o.eksikSutunlar).toEqual(['Kod', 'Ad', 'Birim'])
    expect(o.satirlar).toHaveLength(0)
  })

  it('tanınmayan sütunlar hata değil, uyarı olarak bildirilir', () => {
    // Kullanıcının dosyasında bizim okumadığımız sütunlar olması normaldir.
    // Ama "Birim" yerine "Ambalaj" yazdıysa bunu görmesi gerekir.
    const o = kalemleriCozumle([
      ['Kod', 'Ad', 'Birim', 'Raf Yeri', 'Tedarikçi'],
      ['A-1', 'X', 'kg', 'A-12', 'ABC'],
    ], [], BIRIMLER)

    expect(o.bilinmeyenSutunlar).toEqual(['Raf Yeri', 'Tedarikçi'])
    expect(o.yeni).toBe(1)
  })

  it('bomboş dosya sessizce geçer, hata üretmez', () => {
    expect(kalemleriCozumle([], [], BIRIMLER).satirlar).toHaveLength(0)
  })
})

describe('şablon sütunları', () => {
  it('miktar sütunu YOKTUR', () => {
    // ADR-001: bakiye defterden türetilir, dışarıdan atanmaz. Excel'den
    // miktar okumak, hareketi olmayan bir bakiye üretirdi.
    const alanlar = KALEM_SUTUNLARI.map(s => s.alan)
    expect(alanlar).not.toContain('miktar')
    expect(alanlar).not.toContain('mevcutMiktar')
  })

  it('zorunlu sütunlar kod, ad ve birimdir', () => {
    expect(KALEM_SUTUNLARI.filter(s => s.zorunlu).map(s => s.baslik))
      .toEqual(['Kod', 'Ad', 'Birim'])
  })
})

describe('yazma aşaması', () => {
  const onizleme = () => kalemleriCozumle([
    BASLIK,
    ['A-1', 'Bir', '', 'kg', 'Hayır', 'Hayır', ''],
    ['A-2', 'İki', '', 'kg', 'Hayır', 'Hayır', ''],
    ['', 'Kodsuz', '', 'kg', 'Hayır', 'Hayır', ''],
  ], [kalem('A-2', 'İki')], BIRIMLER)

  it('yeniler eklenir, mevcutlar güncellenir, hatalılar hiç denenmez', async () => {
    const eklenenler: string[] = []
    const guncellenenler: string[] = []

    const s = await satirlariYaz(
      onizleme(),
      async g => { eklenenler.push(g.kod) },
      async id => { guncellenenler.push(id) },
    )

    expect(eklenenler).toEqual(['A-1'])
    expect(guncellenenler).toEqual(['id-A-2'])
    expect(s.eklendi).toBe(1)
    expect(s.guncellendi).toBe(1)
    expect(s.basarisiz).toEqual([])
  })

  it('güncelleyici verilmezse mevcutlar ATLANIR, üzerine yazılmaz', async () => {
    const s = await satirlariYaz(onizleme(), async () => {})

    expect(s.eklendi).toBe(1)
    expect(s.guncellendi).toBe(0)
  })

  it('bir satır düşerse kalanlar yine yazılır', async () => {
    // 400 kartın 399'unu, 200. satırdaki bir çakışma yüzünden kaybetmek
    // kimsenin işine yaramaz.
    const s = await satirlariYaz(
      kalemleriCozumle([
        BASLIK,
        ['A-1', 'Bir', '', 'kg', 'Hayır', 'Hayır', ''],
        ['A-2', 'İki', '', 'kg', 'Hayır', 'Hayır', ''],
        ['A-3', 'Üç', '', 'kg', 'Hayır', 'Hayır', ''],
      ], [], BIRIMLER),
      async g => {
        if(g.kod === 'A-2') throw new Error('"A-2" kodu başka bir kalemde kullanılıyor.')
      },
    )

    expect(s.eklendi).toBe(2)
    expect(s.basarisiz).toHaveLength(1)
    expect(s.basarisiz[0].kod).toBe('A-2')
    expect(s.basarisiz[0].satir).toBe(3)
  })
})
