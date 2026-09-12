// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — Denetim kaydının okunabilirliği testleri
//
// Buradaki testler "veritabanı doğru yazıyor mu" sorusunu SINAMAZ — onun
// yeri canlı doğrulama (0027 sonundaki sorgu). Bunlar "yazılanı doğru
// okuyor muyuz" sorusunu sınıyor. Denetim kaydının yanlış Türkçeleştirilmesi,
// hiç olmamasından daha tehlikelidir: kullanıcı yanlış bir cümleye güvenir.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  ISLEM_ETIKETLERI, KULLANICI_ALANLARI, alanAdi, tabloAdi, type DenetimKaydi,
} from './audit.repository'
import {
  alanDegeriniYaz, baslik, degeriYaz, degisimiYaz, denetimOzeti, gunOnce,
  islemAdi, kisaOzet,
} from './audit.service'

const kayit = (yama: Partial<DenetimKaydi> = {}): DenetimKaydi => ({
  id: yama.id ?? 1,
  tarih: yama.tarih ?? '2026-09-12T21:00:00Z',
  tablo: yama.tablo ?? 'stock_count',
  satirId: yama.satirId ?? 'abc',
  islem: yama.islem ?? 'UPDATE',
  aktorAd: yama.aktorAd,
  ozet: yama.ozet,
  degisimler: yama.degisimler ?? [],
  kayit: yama.kayit,
})

describe('Değer çevirisi', () => {
  it('"yok" ile "boş" AYRI gösteriliyor', () => {
    // Denetimde bu ayrım "sildi mi, boş mu bıraktı" sorusunu cevaplar.
    expect(degeriYaz(null)).toBe('(yok)')
    expect(degeriYaz(undefined)).toBe('(yok)')
    expect(degeriYaz('')).toBe('(boş)')
    expect(degeriYaz('   ')).toBe('(boş)')
  })

  it('mantıksal değerler Türkçe', () => {
    expect(degeriYaz(true)).toBe('evet')
    expect(degeriYaz(false)).toBe('hayır')
  })

  it('sıfır "yok" DEĞİL — gerçek bir sayıdır', () => {
    expect(degeriYaz(0)).toBe('0')
  })

  it('belge durumları Türkçeleşiyor', () => {
    expect(degeriYaz('OPEN')).toBe('Sayım sürüyor')
    expect(degeriYaz('APPLIED')).toBe('Uygulandı')
    expect(degeriYaz('CANCELLED')).toBe('İptal')
  })

  it('sözlükte olmayan değer ham hâliyle kalıyor', () => {
    // Uydurmuyoruz: bilinmeyen bir kodu tahmin etmek yanlış bilgi üretir.
    expect(degeriYaz('BILINMEYEN_KOD')).toBe('BILINMEYEN_KOD')
  })

  it('uzun kimlikler kısaltılıyor', () => {
    expect(degeriYaz('3f8a1c2d-9e4b-4f11-a0c3-77bde91f2a55')).toBe('3f8a1c2d…')
  })

  it('sayı Türkçe biçimle yazılıyor', () => {
    expect(degeriYaz(93.237)).toBe('93,237')
  })
})

describe('Etiketler', () => {
  it('tablo adları Türkçe', () => {
    expect(tabloAdi('stock_count')).toBe('Sayım')
    expect(tabloAdi('haccp_measurement')).toBe('HACCP ölçümü')
  })

  it('sözlükte olmayan tablo ham adıyla görünüyor', () => {
    expect(tabloAdi('bilinmeyen_tablo')).toBe('bilinmeyen_tablo')
  })

  it('alan adları Türkçe, eksikler ham', () => {
    expect(alanAdi('counted_qty')).toBe('Sayılan')
    expect(alanAdi('bilinmeyen_alan')).toBe('bilinmeyen_alan')
  })

  it('üç işlemin de etiketi var', () => {
    expect(ISLEM_ETIKETLERI.INSERT).toBe('Oluşturuldu')
    expect(ISLEM_ETIKETLERI.UPDATE).toBe('Değiştirildi')
    expect(ISLEM_ETIKETLERI.DELETE).toBe('Silindi')
  })
})

describe('Satır özeti', () => {
  it('durum değişimi tek cümleyle okunuyor', () => {
    const k = kayit({
      ozet: 'SAY-2026-0003',
      degisimler: [{ alan: 'status', eski: 'OPEN', yeni: 'APPLIED' }],
    })
    expect(baslik(k)).toBe('Sayım SAY-2026-0003')
    expect(islemAdi(k)).toBe('Değiştirildi')
    expect(kisaOzet(k)).toBe('Durum: Sayım sürüyor → Uygulandı')
  })

  it('özet yoksa satır kimliği gösteriliyor — gizlenmiyor', () => {
    expect(baslik(kayit({ ozet: undefined, satirId: 'xyz' }))).toBe('Sayım xyz')
  })

  it('çok alan değişince ilk üçü yazılıp gerisi sayılıyor', () => {
    const k = kayit({ degisimler: [
      { alan: 'a', eski: 1, yeni: 2 },
      { alan: 'b', eski: 1, yeni: 2 },
      { alan: 'c', eski: 1, yeni: 2 },
      { alan: 'd', eski: 1, yeni: 2 },
      { alan: 'e', eski: 1, yeni: 2 },
    ] })
    expect(kisaOzet(k)).toContain('+2 alan daha')
  })

  it('oluşturma ve silme ayrı cümle', () => {
    expect(kisaOzet(kayit({ islem: 'INSERT' }))).toBe('Kayıt açıldı')
    expect(kisaOzet(kayit({ islem: 'DELETE' }))).toBe('Kayıt silindi')
  })

  it('değişim cümlesi eski ve yeni değeri birlikte veriyor', () => {
    expect(degisimiYaz({ alan: 'counted_qty', eski: null, yeni: 167 }))
      .toBe('Sayılan: (yok) → 167')
  })
})

// ── Kullanıcı kimlikleri ────────────────────────────────────────────────
// Canlı denetimde çıktı: "Uygulayan: (yok) → f3d3aebd…". Kayıt teknik olarak
// doğruydu ama denetimin sorduğu "kim uyguladı" sorusunu cevapsız bırakıyordu.
describe('Kullanıcı alanları ada çevriliyor', () => {
  const adlar = { 'f3d3aebd-1111-2222-3333-444455556666': 'ABC Bey' }

  it('kullanıcı alanı ada dönüşüyor', () => {
    expect(alanDegeriniYaz('applied_by', 'f3d3aebd-1111-2222-3333-444455556666', adlar))
      .toBe('ABC Bey')
  })

  it('sözlükte olmayan kimlik kısaltılmış hâliyle kalıyor — uydurulmuyor', () => {
    expect(alanDegeriniYaz('applied_by', '99999999-1111-2222-3333-444455556666', adlar))
      .toBe('99999999…')
  })

  it('kullanıcı OLMAYAN alanlar çeviriden etkilenmiyor', () => {
    expect(alanDegeriniYaz('counted_qty', 167, adlar)).toBe('167')
    expect(alanDegeriniYaz('status', 'APPLIED', adlar)).toBe('Uygulandı')
  })

  it('değişim cümlesi de adı kullanıyor', () => {
    expect(degisimiYaz(
      { alan: 'applied_by', eski: null, yeni: 'f3d3aebd-1111-2222-3333-444455556666' },
      adlar,
    )).toBe('Uygulayan: (yok) → ABC Bey')
  })

  it('bilinen kullanıcı alanları listelenmiş', () => {
    expect(KULLANICI_ALANLARI.has('opened_by')).toBe(true)
    expect(KULLANICI_ALANLARI.has('applied_by')).toBe(true)
    expect(KULLANICI_ALANLARI.has('counted_qty')).toBe(false)
  })
})

describe('Denetim özeti', () => {
  it('işlem türleri ayrı sayılıyor', () => {
    const o = denetimOzeti([
      kayit({ islem: 'INSERT', aktorAd: 'Ali' }),
      kayit({ islem: 'UPDATE', aktorAd: 'Ali' }),
      kayit({ islem: 'UPDATE', aktorAd: 'Veli' }),
      kayit({ islem: 'DELETE' }),
    ])
    expect(o.toplam).toBe(4)
    expect(o.olusturma).toBe(1)
    expect(o.degisiklik).toBe(2)
    expect(o.silme).toBe(1)
    expect(o.kisi).toBe(2)
  })

  it('aktörü çözülemeyen kayıtlar AYRICA sayılıyor', () => {
    // SQL konsolundan yapılan işler böyle görünür. Gizlemek yerine sayıyoruz:
    // "kim yaptı bilinmiyor" da bir denetim bulgusudur.
    const o = denetimOzeti([kayit({ aktorAd: 'Ali' }), kayit({}), kayit({})])
    expect(o.aktorsuz).toBe(2)
    expect(o.kisi).toBe(1)
  })
})

describe('gunOnce', () => {
  it('geçmiş tarihi ISO gün olarak veriyor', () => {
    expect(gunOnce(7, new Date('2026-09-12T08:00:00Z'))).toBe('2026-09-05')
  })
})
