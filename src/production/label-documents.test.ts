// Yanlış alerjen beyanı insan hayatına mal olur. Bu testlerin tamamı tek bir
// şeyi koruyor: EKSİK VERİYLE "TEMİZ" GÖRÜNEN BİR ETİKET BASILMASIN.

import { describe, it, expect } from 'vitest'
import {
  etiketEksikleri, etiketHtml, etiketKesilebilir, type EtiketVerisi,
} from './label-documents'

const tam = (yama: Partial<EtiketVerisi> = {}): EtiketVerisi => ({
  urunAdi: 'Mercimek çorbası',
  netMiktar: '5 kg',
  lotKodu: 'LOT-2026-0412',
  uretimTarihi: '2026-10-01',
  sonKullanma: '2026-10-08',
  saklama: '0–4 °C',
  firmaAdi: 'ABC Gıda A.Ş.',
  firmaAdresi: 'Organize Sanayi, Ankara',
  bilesenler: [
    { ad: 'Su', alerjenMi: false },
    { ad: 'Süt tozu', alerjenMi: true },
    { ad: 'Buğday unu', alerjenMi: true },
  ],
  alerjenler: [
    { kod: 'GLUTEN', ad: 'Gluten içeren tahıllar', tur: 'İÇERİR' },
    { kod: 'SUT', ad: 'Süt (laktoz dâhil)', tur: 'İÇERİR' },
  ],
  besin: {
    enerjiKj: 88, enerjiKcal: 21, yag: 0.1, doymusYag: 0.1,
    karbonhidrat: 2.4, seker: 1.1, protein: 1.6, tuz: 0.05,
  },
  alerjeniIncelenmemis: [],
  besinEksikleri: [],
  ...yama,
})

describe('etiketKesilebilir', () => {
  it('veri tamsa kesilebiliyor', () => {
    expect(etiketKesilebilir(tam())).toBe(true)
    expect(etiketEksikleri(tam())).toEqual([])
  })

  it('alerjeni İNCELENMEMİŞ malzeme varsa kesilemiyor', () => {
    // "Alerjen yok" ile "bakılmamış" aynı şey değildir.
    const v = tam({ alerjeniIncelenmemis: ['Baharat karışımı'] })
    expect(etiketKesilebilir(v)).toBe(false)
    expect(etiketEksikleri(v)[0]).toContain('Baharat karışımı')
  })

  it('besin değeri türetilemiyorsa kesilemiyor', () => {
    expect(etiketKesilebilir(tam({ besin: undefined }))).toBe(false)
  })

  it('gramaj, parti ve SKT yoksa kesilemiyor', () => {
    expect(etiketKesilebilir(tam({ netMiktar: undefined }))).toBe(false)
    expect(etiketKesilebilir(tam({ lotKodu: undefined }))).toBe(false)
    expect(etiketKesilebilir(tam({ sonKullanma: undefined }))).toBe(false)
  })
})

describe('etiketHtml', () => {
  it('zorunlu bilgiler kâğıtta', () => {
    const h = etiketHtml(tam())
    expect(h).toContain('Mercimek çorbası')
    expect(h).toContain('5 kg')
    expect(h).toContain('LOT-2026-0412')
    expect(h).toContain('08.10.2026')
    expect(h).toContain('ABC Gıda A.Ş.')
  })

  it('ALERJEN TAŞIYAN bileşen BÜYÜK HARFLE vurgulanıyor', () => {
    // Mevzuat alerjenin ayırt edilebilir olmasını istiyor. Renk ya da yalnız
    // kalın yazı yetmez — siyah beyaz termal yazıcıda kaybolur.
    const h = etiketHtml(tam())
    expect(h).toContain('BUĞDAY UNU')
    expect(h).toContain('SÜT TOZU')
    // Alerjen olmayan bileşen büyütülmüyor.
    expect(h).not.toContain('>SU<')
  })

  it('alerjen uyarı satırı basılıyor', () => {
    const h = etiketHtml(tam())
    expect(h).toContain('Alerjen uyarısı')
    expect(h).toContain('Gluten içeren tahıllar, Süt (laktoz dâhil) içerir')
  })

  it('"İZ" uyarısı, İÇERİR satırından AYRI basılıyor', () => {
    const h = etiketHtml(tam({
      alerjenler: [{ kod: 'SUSAM', ad: 'Susam', tur: 'İZ' }],
    }))
    expect(h).toContain('içerebilir')
    expect(h).toContain('aynı tesiste işlenmektedir')
    expect(h).not.toContain('Alerjen uyarısı')
  })

  it('EKSİK VERİDE "alerjen içermez" YAZMIYOR', () => {
    // Bu, bu dosyadaki en önemli test. Boş bir alerjen listesini "temiz" diye
    // basmak, bilinmeyeni bilinen gibi göstermektir.
    const h = etiketHtml(tam({
      alerjenler: [], alerjeniIncelenmemis: ['Baharat karışımı'],
    }))
    expect(h).not.toContain('Bilinen alerjen içermez')
    expect(h).toContain('TASLAK ETİKET')
    expect(h).toContain('AMBALAJA YAPIŞTIRILAMAZ')
  })

  it('veri tamken ve alerjen yokken AÇIKÇA söylüyor', () => {
    const h = etiketHtml(tam({ alerjenler: [], bilesenler: [{ ad: 'Su', alerjenMi: false }] }))
    expect(h).toContain('Bilinen alerjen içermez')
    expect(h).not.toContain('TASLAK ETİKET')
  })

  it('besin tablosu YARIM basılmıyor', () => {
    const h = etiketHtml(tam({ besin: undefined }))
    expect(h).not.toContain('Beslenme bildirimi')
    expect(h).toContain('TASLAK ETİKET')
  })

  it('besin tablosunda doymuş yağ ve şeker GİRİNTİLİ', () => {
    const h = etiketHtml(tam())
    expect(h).toContain('— doymuş yağ')
    expect(h).toContain('— şeker')
  })

  it('ürün adı HTML olarak yorumlanmıyor', () => {
    const h = etiketHtml(tam({ urunAdi: '<img src=x onerror=alert(1)>' }))
    expect(h).not.toContain('<img src=x')
    expect(h).toContain('&lt;img src=x')
  })
})
