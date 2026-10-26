// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Şahit numune — ekranın karar verdiği şeylerin sınaması
//
// ⚠️ Burada SUNUCU KURALLARI sınanmıyor: saklama sonunun partiden türediği,
// koşulun karttan kopyalandığı, kiracı sınırı ve satır kilidi
// `db/prova/prova-0093.sql` ve `prova-0094.sql` içinde ölçülüyor. Onları
// burada taklit etmek, taklidin yeşil kalıp sunucunun kırmızı olmasına
// izin verirdi.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, expect, it } from 'vitest'
import {
  bugununGunu, gerekceYeterliMi, kalanGun, numuneAlinabilir,
  numuneAlinamazSebebi, numuneKoduYeterliMi, numuneOzeti, numuneSirasi,
  suresiDolduMu,
} from './witness-sample.service'
import type { NumuneAdayi, SahitNumune } from './witness-sample.repository'

const numune = (ek: Partial<SahitNumune>): SahitNumune => ({
  id: ek.id ?? 'n1',
  kod: ek.kod ?? 'N-1',
  kalemId: 'k1', kalemAd: 'Mercimek Çorbası', kalemKodu: 'MC-01',
  lotId: 'l1', lotKodu: 'LOT-1',
  alinmaZamani: '2026-10-01T08:00:00Z',
  saklamaKosulu: '-18 °C',
  saklamaSonu: ek.saklamaSonu ?? '2026-12-31',
  durum: ek.durum ?? 'SAKLANIYOR',
  ...ek,
})

const aday = (ek: Partial<NumuneAdayi>): NumuneAdayi => ({
  lotId: 'l1', lotKodu: 'LOT-1', kalemId: 'k1',
  kalemAd: 'Mercimek Çorbası', kalemKodu: 'MC-01',
  skt: '2026-12-31', uretimPartisiMi: true,
  saklamaKosulu: '-18 °C', numunesiVar: false,
  ...ek,
})

describe('gerekçe ve kod', () => {
  it('boş gerekçe yetmez', () => {
    expect(gerekceYeterliMi('')).toBe(false)
    expect(gerekceYeterliMi('   ')).toBe(false)
    expect(gerekceYeterliMi('ok')).toBe(false)
    expect(gerekceYeterliMi('müşteri itirazı')).toBe(true)
  })

  it('numune kodu en az iki karakter', () => {
    expect(numuneKoduYeterliMi('')).toBe(false)
    expect(numuneKoduYeterliMi(' A ')).toBe(false)
    expect(numuneKoduYeterliMi('N-1')).toBe(true)
  })
})

describe('saklama süresi', () => {
  it('saklama sonu GÜNÜ hâlâ süre içindedir', () => {
    // ⚠️ Bu satır bilerek burada: `>=` yazılsa numune son gününde "süresi
    // doldu" görünürdü. SKT kapısı (0092) da aynı kuralı `<` ile yazıyor.
    expect(suresiDolduMu('2026-10-26', '2026-10-26')).toBe(false)
    expect(suresiDolduMu('2026-10-26', '2026-10-27')).toBe(true)
    expect(suresiDolduMu('2026-10-26', '2026-10-25')).toBe(false)
  })

  it('tam zaman damgası gelse de gün karşılaştırılır', () => {
    expect(suresiDolduMu('2026-10-26T00:00:00+03:00', '2026-10-27')).toBe(true)
    expect(suresiDolduMu('2026-10-26T00:00:00+03:00', '2026-10-26')).toBe(false)
  })

  it('kalan gün sayısı doğru işaretle döner', () => {
    expect(kalanGun('2026-10-30', '2026-10-26')).toBe(4)
    expect(kalanGun('2026-10-20', '2026-10-26')).toBe(-6)
    expect(kalanGun('2026-10-26', '2026-10-26')).toBe(0)
  })

  it('bugünün günü yerel güne göre, UTC kaymasıyla değil', () => {
    // Yerel saat 00:30 iken UTC hâlâ dünde olabilir; kullanıcının günü esas.
    const gun = bugununGunu(new Date(2026, 9, 26, 0, 30, 0))
    expect(gun).toBe('2026-10-26')
  })
})

describe('numune alınabilir mi', () => {
  it('saklama koşulu yazılı olmayan üründen alınamaz', () => {
    const sebep = numuneAlinamazSebebi(aday({ saklamaKosulu: undefined }))
    expect(sebep).toContain('saklama koşulu')
    expect(numuneAlinabilir(aday({ saklamaKosulu: undefined }))).toBe(false)
  })

  it('yalnız boşluktan oluşan koşul de yazılı sayılmaz', () => {
    expect(numuneAlinabilir(aday({ saklamaKosulu: '   ' }))).toBe(false)
  })

  it('açık numunesi olan partiden ikinci numune alınamaz', () => {
    expect(numuneAlinamazSebebi(aday({ numunesiVar: true })))
      .toContain('zaten var')
  })

  it('koşulu yazılı ve numunesi olmayan partiden alınabilir', () => {
    expect(numuneAlinamazSebebi(aday({}))).toBeUndefined()
    expect(numuneAlinabilir(aday({}))).toBe(true)
  })
})

describe('özet', () => {
  it('durumları sayar ve imha bekleyeni ayırır', () => {
    const ozet = numuneOzeti([
      numune({ id: '1', durum: 'SAKLANIYOR', saklamaSonu: '2026-12-31' }),
      numune({ id: '2', durum: 'SAKLANIYOR', saklamaSonu: '2026-10-01' }),
      numune({ id: '3', durum: 'ACILDI', saklamaSonu: '2026-10-02' }),
      numune({ id: '4', durum: 'IMHA', saklamaSonu: '2026-01-01' }),
    ], '2026-10-26')
    expect(ozet.saklanan).toBe(2)
    expect(ozet.acilan).toBe(1)
    expect(ozet.imha).toBe(1)
    // 2 ve 3 süresi dolmuş ve imha edilmemiş; 4 zaten imha.
    expect(ozet.imhaBekleyen).toBe(2)
  })

  it('imha edilmiş numune imha bekleyen sayılmaz', () => {
    const ozet = numuneOzeti(
      [numune({ durum: 'IMHA', saklamaSonu: '2020-01-01' })], '2026-10-26')
    expect(ozet.imhaBekleyen).toBe(0)
  })
})

describe('sıralama', () => {
  it('işi olan satır üstte: imha bekleyen, açılan, saklanan, imha', () => {
    const sirali = numuneSirasi([
      numune({ id: 'imha', kod: 'D', durum: 'IMHA', saklamaSonu: '2020-01-01' }),
      numune({ id: 'saklanan', kod: 'C', durum: 'SAKLANIYOR', saklamaSonu: '2026-12-31' }),
      numune({ id: 'acilan', kod: 'B', durum: 'ACILDI', saklamaSonu: '2026-12-31' }),
      numune({ id: 'bekleyen', kod: 'A', durum: 'SAKLANIYOR', saklamaSonu: '2026-10-01' }),
    ], '2026-10-26')
    expect(sirali.map(n => n.id)).toEqual(['bekleyen', 'acilan', 'saklanan', 'imha'])
  })

  it('aynı öncelikte saklama sonu yakın olan üstte', () => {
    const sirali = numuneSirasi([
      numune({ id: 'uzak', saklamaSonu: '2026-12-31' }),
      numune({ id: 'yakin', saklamaSonu: '2026-11-01' }),
    ], '2026-10-26')
    expect(sirali.map(n => n.id)).toEqual(['yakin', 'uzak'])
  })

  it('gelen diziyi DEĞİŞTİRMEZ', () => {
    const girdi = [
      numune({ id: 'a', saklamaSonu: '2026-12-31' }),
      numune({ id: 'b', saklamaSonu: '2026-11-01' }),
    ]
    numuneSirasi(girdi, '2026-10-26')
    expect(girdi.map(n => n.id)).toEqual(['a', 'b'])
  })
})
