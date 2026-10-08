// "Sistemi bırakırsam verim bende kalır mı?" sorusunun testi.
// Burada sınanan şey biçimleme değil, bir SÖZ: dosyanın içinde her şey var
// ve dosya AÇILABİLİYOR.

import { describe, it, expect } from 'vitest'
import {
  defteriKur, excelDosyaAdi, hucre, okubeniSayfasi, sayfaAdi, sutunlar,
  tabloAciklamasi, tabloyuSayfalara,
} from './tablo-defteri'
import type { DisaAktarmaKunyesi, DisaAktarmaSonucu } from './tenant-export'

const kunye = (yama: Partial<DisaAktarmaKunyesi> = {}): DisaAktarmaKunyesi => ({
  aciklama: 'x', bicimSurumu: 1,
  olusturmaZamani: '2026-10-08T10:00:00.000Z',
  kiracıId: 'b8b4eaa8-8d9d-4ce5-bf0f-7b0026d095a0',
  subeId: 'b1',
  tablolar: [{ tablo: 'stock_item', satir: 2 }],
  toplamSatir: 2, eksikTablolar: [],
  ...yama,
})

describe('hucre', () => {
  it('sayıyı SAYI olarak bırakır — Excel’de toplanabilsin', () => {
    expect(hucre(42.5)).toBe(42.5)
  })

  // ⚠️ "0532..." bir telefondur. Sayıya çevirseydik baştaki sıfır giderdi
  // ve numara bozulurdu. Lot kodları ve vergi numaraları da aynı.
  it('sayı GİBİ DURAN metni metin bırakır', () => {
    expect(hucre('0532 000 00 00')).toBe('0532 000 00 00')
    expect(hucre('00123')).toBe('00123')
  })

  // ⚠️ `[object Object]` yazmak veriyi YOK ETMEKTİR. Denetim kaydındaki
  // `changes` alanı tam olarak böyle bir alandır.
  it('nesneyi JSON metnine çevirir, [object Object] yazmaz', () => {
    expect(hucre({ eski: 10, yeni: 20 })).toBe('{"eski":10,"yeni":20}')
    expect(hucre([1, 2])).toBe('[1,2]')
  })

  it('null boş hücre olur', () => {
    expect(hucre(null)).toBeNull()
    expect(hucre(undefined)).toBeNull()
  })

  it('tarihi ISO metnine çevirir', () => {
    expect(hucre(new Date('2026-10-08T10:00:00.000Z'))).toBe('2026-10-08T10:00:00.000Z')
  })

  it('boolean olduğu gibi kalır', () => {
    expect(hucre(true)).toBe(true)
  })
})

describe('sutunlar', () => {
  // ⚠️ YALNIZ İLK SATIRA BAKSAYDIK, bazı satırlarda boş olan bir alan
  // dosyadan TAMAMEN düşerdi ve kimse fark etmezdi.
  it('BÜTÜN satırları tarar, ilkini değil', () => {
    const s = sutunlar([{ id: 1 }, { id: 2, not: 'x' }])
    expect(s).toEqual(['id', 'not'])
  })

  // İki dışa aktarım aynı veriden aynı dosyayı üretmeli ki karşılaştırılsın.
  it('ilk görülen sırayı korur, alfabetik sıralamaz', () => {
    expect(sutunlar([{ zz: 1, aa: 2 }])).toEqual(['zz', 'aa'])
  })

  it('satır yoksa sütun da yoktur', () => {
    expect(sutunlar([])).toEqual([])
  })
})

describe('sayfaAdi', () => {
  it('31 karakteri aşmaz', () => {
    const ad = sayfaAdi('cok_cok_cok_cok_uzun_bir_tablo_adi_var_burada', new Set())
    expect(ad.length).toBeLessThanOrEqual(31)
  })

  it('Excel’in kabul etmediği işaretleri temizler', () => {
    expect(sayfaAdi('a/b:c*d', new Set())).toBe('a_b_c_d')
  })

  // ⚠️ İki tablo aynı sayfa adına düşerse EXCEL DOSYAYI AÇMAZ. "Yedeğim
  // var" diyen ama açılmayan bir dosya, olmayan yedekten kötüdür.
  it('çakışmayı numaralandırır', () => {
    const k = new Set<string>()
    expect(sayfaAdi('stok', k)).toBe('stok')
    expect(sayfaAdi('stok', k)).toBe('stok~2')
    expect(sayfaAdi('stok', k)).toBe('stok~3')
  })
})

describe('tabloyuSayfalara', () => {
  it('başlıkları ve satırları aynı sırada yazar', () => {
    const [s] = tabloyuSayfalara('stock_item',
      [{ id: 'a', name: 'Un' }, { id: 'b', name: 'Tuz' }], new Set())
    expect(s.basliklar).toEqual(['id', 'name'])
    expect(s.satirlar).toEqual([['a', 'Un'], ['b', 'Tuz']])
  })

  // ⚠️ "Bu tablo boştu" ile "bu tablo dosyaya girmedi" AYNI ŞEY DEĞİL.
  it('boş tablo da sayfa olarak VAR', () => {
    const s = tabloyuSayfalara('vehicle', [], new Set())
    expect(s).toHaveLength(1)
    expect(s[0].ad).toBe('vehicle')
  })

  it('bir satırda olmayan alan boş hücre olur, sütun kaybolmaz', () => {
    const [s] = tabloyuSayfalara('x', [{ id: 1, not: 'a' }, { id: 2 }], new Set())
    expect(s.basliklar).toEqual(['id', 'not'])
    expect(s.satirlar[1]).toEqual([2, null])
  })
})

describe('okubeniSayfasi', () => {
  // ⚠️ "Her şey burada" demek, sunucuyu geri kuracağını sanan birini
  // yanıltır. Dosyanın NE OLMADIĞI da yazılı.
  it('dosyada NE OLMADIĞINI söyler', () => {
    const s = okubeniSayfasi(kunye())
    const metin = s.satirlar.flat().join(' ')
    expect(metin).toContain('BU DOSYADA OLMAYANLAR')
    expect(metin).toContain('pg_dump')
  })

  it('her tablonun Türkçe açıklamasını yazar', () => {
    const s = okubeniSayfasi(kunye())
    const metin = s.satirlar.flat().join(' ')
    expect(metin).toContain('Stok kartları')
  })

  // Dosyanın eksik olduğunu okumadan tabloya geçilmesin.
  it('eksik tablo varsa UYARIYI yazar', () => {
    const s = okubeniSayfasi(kunye({
      eksikTablolar: ['audit_log'],
      uyari: '1 tablo okunamadı. BU DOSYA EKSİKTİR, yedek olarak kullanmayın.',
    }))
    const metin = s.satirlar.flat().join(' ')
    expect(metin).toContain('EKSİKTİR')
    expect(metin).toContain('audit_log')
  })

  it('eksik yoksa uyarı da yazmaz', () => {
    const metin = okubeniSayfasi(kunye()).satirlar.flat().join(' ')
    expect(metin).not.toContain('UYARI')
  })

  it('okunamayan tablonun satır sayısına 0 yazmaz, sebebini yazar', () => {
    const s = okubeniSayfasi(kunye({
      tablolar: [{ tablo: 'audit_log', satir: 0, atlandi: 'izin yok' }],
    }))
    const metin = s.satirlar.flat().join(' ')
    expect(metin).toContain('izin yok')
  })
})

describe('defteriKur', () => {
  const sonuc = (): DisaAktarmaSonucu => ({
    kunye: kunye({
      tablolar: [
        { tablo: 'stock_item', satir: 1 },
        { tablo: 'vehicle', satir: 0 },
        { tablo: 'audit_log', satir: 0, atlandi: 'izin yok' },
      ],
    }),
    veri: { stock_item: [{ id: 'a', name: 'Un' }], vehicle: [] },
  })

  it('OKUBENİ sayfası EN BAŞTA', () => {
    expect(defteriKur(sonuc())[0].ad).toBe('OKUBENI')
  })

  it('her okunan tablo için bir sayfa üretir', () => {
    const adlar = defteriKur(sonuc()).map(s => s.ad)
    expect(adlar).toContain('stock_item')
    expect(adlar).toContain('vehicle')
  })

  // Okunamayan tablonun BOŞ bir sayfası olsaydı, dosyayı açan kişi
  // "bu tablo boşmuş" sanırdı. Oysa okunamamış.
  it('okunamayan tablo için SAHTE BOŞ SAYFA üretmez', () => {
    expect(defteriKur(sonuc()).map(s => s.ad)).not.toContain('audit_log')
  })

  it('künyedeki tablo sırasını korur', () => {
    const adlar = defteriKur(sonuc()).map(s => s.ad)
    expect(adlar.indexOf('stock_item')).toBeLessThan(adlar.indexOf('vehicle'))
  })
})

describe('excelDosyaAdi', () => {
  it('JSON yedeğiyle karışmayacak bir ad üretir', () => {
    const ad = excelDosyaAdi('b8b4eaa8-8d9d', new Date('2026-10-08T10:00:00.000Z'))
    expect(ad).toBe('miyop-verilerim-b8b4eaa8-2026-10-08-10-00-00.xlsx')
  })
})

describe('tabloAciklamasi', () => {
  it('bilmediği tabloyu uydurmaz', () => {
    expect(tabloAciklamasi('yarin_eklenen_tablo')).toBe('(açıklama yok)')
  })

  it('stok defterinin ne olduğunu açıkça söyler', () => {
    expect(tabloAciklamasi('stock_movement')).toContain('STOK DEFTERİ')
  })
})
