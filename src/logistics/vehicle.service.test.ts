// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Araç ve şoför kartı testleri
//
// En önemlisi plaka anahtarı: Türkçe yerelde büyük harfe çevirmek 'i' harfini
// 'İ' yapar ve plakada öyle bir harf yoktur. Aynı araç iki kez açılabilirdi.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest'
import {
  AracDogrulamaError,
  aracDogrula, aracEtiketi, ehliyetUyarisi, plakaAnahtari, plakaYaz,
  soforDogrula, sogutmaUyarisi, tasiyanSatiri,
  type Arac, type Sofor,
} from './vehicle.service'

const arac = (ek: Partial<Arac> = {}): Arac => ({
  id: 'a1', plaka: '34 ABC 123', plakaAnahtari: '34ABC123',
  sogutmali: false, aktif: true, ...ek,
})

const sofor = (ek: Partial<Sofor> = {}): Sofor => ({
  id: 's1', adSoyad: 'Hasan Yıldız', aktif: true, ...ek,
})

describe('plakaAnahtari', () => {
  it('boşluk, tire ve noktayı atıyor, büyük harfe çeviriyor', () => {
    expect(plakaAnahtari('34 abc 123')).toBe('34ABC123')
    expect(plakaAnahtari('34-ABC-123')).toBe('34ABC123')
    expect(plakaAnahtari(' 34.abc.123 ')).toBe('34ABC123')
  })

  it('TÜRKÇE YERELE DÜŞMÜYOR — "i" harfi "İ" olmuyor', () => {
    // Türkçe yerelde 'i'.toLocaleUpperCase('tr') → 'İ'. Plakada noktalı İ
    // yoktur; yerel kullansaydık "34FİT1" yazılır, kullanıcı "34FIT1" diye
    // arayınca bulamaz ve aynı aracı ikinci kez açardı.
    expect(plakaAnahtari('34 fit 1')).toBe('34FIT1')
    expect(plakaAnahtari('34 fit 1')).not.toContain('İ')
  })

  it('aynı araç farklı yazımlarda aynı anahtarı veriyor', () => {
    const yazimlar = ['34 ABC 123', '34abc123', '34-abc-123', '  34 AbC 123  ']
    const anahtarlar = new Set(yazimlar.map(plakaAnahtari))
    expect(anahtarlar.size).toBe(1)
  })
})

describe('plakaYaz', () => {
  it('KULLANICININ YAZDIĞINI bozmuyor', () => {
    // Araya boşluk koyan bir "güzelleştirme" yabancı plakayı bozardı.
    expect(plakaYaz('BG 1234 AX')).toBe('BG 1234 AX')
    expect(plakaYaz('  34ABC123  ')).toBe('34ABC123')
  })
})

describe('aracDogrula', () => {
  it('geçerli aracı temizleyip döndürüyor', () => {
    const a = aracDogrula({ plaka: '  34 abc 123 ', ad: ' Frigo 1 ', sogutmali: false })
    expect(a.plaka).toBe('34 abc 123')
    expect(a.ad).toBe('Frigo 1')
  })

  it('boş plaka reddediliyor', () => {
    expect(() => aracDogrula({ plaka: '  ', sogutmali: false })).toThrow(AracDogrulamaError)
  })

  it('dört karakterden kısa plaka reddediliyor', () => {
    expect(() => aracDogrula({ plaka: '34A', sogutmali: false })).toThrow(/dört karakter/)
  })

  it('YABANCI VE RÖMORK PLAKASI kabul ediliyor', () => {
    // Türk plaka kalıbı dayatılsaydı bu araçlar sisteme hiç yazılamaz ve
    // sevkiyatları kayıt dışı kalırdı.
    expect(() => aracDogrula({ plaka: 'BG 1234 AX', sogutmali: false })).not.toThrow()
    expect(() => aracDogrula({ plaka: '34 RM 0001', sogutmali: false })).not.toThrow()
  })

  it('sıfır kapasite reddediliyor — boş bırakmak başka şey', () => {
    expect(() => aracDogrula({ plaka: '34ABC123', sogutmali: false, kapasiteKg: 0 }))
      .toThrow(/sıfırdan büyük/)
    expect(() => aracDogrula({ plaka: '34ABC123', sogutmali: false })).not.toThrow()
  })

  it('SOĞUTMASIZ ARACA sıcaklık aralığı yazılamıyor', () => {
    expect(() => aracDogrula({
      plaka: '34ABC123', sogutmali: false, minSicaklik: -18, maxSicaklik: 0,
    })).toThrow(/yetenek sanar/)
  })

  it('ters aralık reddediliyor', () => {
    expect(() => aracDogrula({
      plaka: '34ABC123', sogutmali: true, minSicaklik: 4, maxSicaklik: -20,
    })).toThrow(/büyük olamaz/)
  })
})

describe('soforDogrula', () => {
  it('adı zorunlu kılıyor', () => {
    expect(() => soforDogrula({ adSoyad: '   ' })).toThrow(AracDogrulamaError)
  })

  it('ehliyet sınıfını büyük harfe çeviriyor', () => {
    expect(soforDogrula({ adSoyad: 'Hasan', ehliyetSinifi: 'e' }).ehliyetSinifi).toBe('E')
  })

  it('boş alanları undefined yapıyor — boş metin yazmıyor', () => {
    const s = soforDogrula({ adSoyad: 'Hasan', telefon: '  ' })
    expect(s.telefon).toBeUndefined()
  })
})

describe('aracEtiketi', () => {
  it('plaka, ad ve soğutma aralığını birleştiriyor', () => {
    const e = aracEtiketi(arac({ ad: 'Frigo 1', sogutmali: true, minSicaklik: -20, maxSicaklik: 4 }))
    expect(e).toContain('34 ABC 123')
    expect(e).toContain('Frigo 1')
    expect(e).toContain('-20…4 °C')
  })

  it('PASİF aracı işaretliyor', () => {
    expect(aracEtiketi(arac({ aktif: false }))).toContain('PASİF')
  })

  it('soğutmasız araçta aralık yazmıyor', () => {
    expect(aracEtiketi(arac())).toBe('34 ABC 123')
  })
})

describe('sogutmaUyarisi', () => {
  it('soğutmasız araçta CCP-8 uyarısı veriyor', () => {
    expect(sogutmaUyarisi(arac())).toContain('CCP-8')
  })

  it('soğutmalı araçta uyarı YOK', () => {
    expect(sogutmaUyarisi(arac({ sogutmali: true }))).toBeUndefined()
  })

  it('araç seçilmemişse uyarı YOK', () => {
    // Araçsız sevkiyat geçerli: kargoyla gönderen işletme de var.
    expect(sogutmaUyarisi(undefined)).toBeUndefined()
  })
})

describe('ehliyetUyarisi', () => {
  const bugun = new Date(2026, 9, 4) // 4 Ekim 2026

  it('dolmuş ehliyeti söylüyor', () => {
    expect(ehliyetUyarisi(sofor({ ehliyetGecerlilik: '2026-10-01' }), bugun))
      .toContain('3 gün önce doldu')
  })

  it('bugün dolan ehliyeti ayrı söylüyor', () => {
    expect(ehliyetUyarisi(sofor({ ehliyetGecerlilik: '2026-10-04' }), bugun))
      .toContain('BUGÜN')
  })

  it('30 gün kala uyarıyor', () => {
    expect(ehliyetUyarisi(sofor({ ehliyetGecerlilik: '2026-10-20' }), bugun))
      .toContain('16 gün')
  })

  it('uzak tarihte uyarmıyor', () => {
    expect(ehliyetUyarisi(sofor({ ehliyetGecerlilik: '2027-10-04' }), bugun)).toBeUndefined()
  })

  it('tarih yoksa ya da bozuksa uyarmıyor', () => {
    expect(ehliyetUyarisi(sofor(), bugun)).toBeUndefined()
    expect(ehliyetUyarisi(sofor({ ehliyetGecerlilik: 'dasdasd' }), bugun)).toBeUndefined()
  })
})

describe('tasiyanSatiri', () => {
  it('plaka ve şoförü birleştiriyor', () => {
    const t = tasiyanSatiri(
      { plaka: '34 ABC 123', ad: 'Frigo 1' },
      { adSoyad: 'Hasan Yıldız', telefon: '0555' },
    )
    expect(t.plaka).toBe('34 ABC 123 · Frigo 1')
    expect(t.sofor).toBe('Hasan Yıldız · 0555')
  })

  it('SEÇİLMEMİŞSE TİRE basıyor, satırı gizlemiyor', () => {
    // Boş bırakılmış taşıyan alanı "burayı elle doldur" der; satırı hiç
    // basmamak o soruyu ortadan kaldırırdı.
    const t = tasiyanSatiri(undefined, undefined)
    expect(t.plaka).toBe('—')
    expect(t.sofor).toBe('—')
  })
})
