import { describe, expect, it } from 'vitest'
import { kullaniciAdiOner, gorevAdiMi } from './kullanici-adi'

/**
 * ⚠️ AŞAĞIDAKİ TABLO ELLE YAZILMADI — doğrudan veritabanındaki
 * `app.kullanici_adi_duzelt` (0078) çalıştırılarak üretildi. Amacı tek:
 * ekrandaki önizleme ile sunucunun kaydettiği ad AYRIŞIRSA bunu burada
 * yakalamak. Sunucudaki kural değişirse bu test kırmızıya döner ve
 * `kullanici-adi.ts` güncellenmeden geçilemez.
 */
const SUNUCUDAN: Array<[string, string]> = [
  ['Alaattin Kocatepe', 'alaattin.kocatepe'],
  ['Şükrü Özçiğdem', 'sukru.ozcigdem'],
  ['  .Ali Veli.  ', 'ali.veli'],
  ['ali_veli', 'ali.veli'],
  ['depocu', 'depocu'],
  ['Mehmet Ali Yılmaz', 'mehmet.ali.yilmaz'],
  ['İsmet Çağrı', 'ismet.cagri'],
  ['ÖZGÜR ŞAHİN', 'ozgur.sahin'],
  ['Ayşe-Nur Gül', 'aysenur.gul'],
  ['abc', 'abc'],
  ['a', 'a'],
  ["Jean-Luc O'Brien", 'jeanluc.obrien'],
  ['Üçüncü  İşçi', 'ucuncu.isci'],
  ['ahmet..yilmaz', 'ahmet.yilmaz'],
  ['ĞİÖŞÜÇ', 'giosuc'],
  ['Ali 123', 'ali.123'],
  ['   ', ''],
]

describe('kullaniciAdiOner — sunucudaki kuralla birebir', () => {
  it.each(SUNUCUDAN)('"%s" → beklenen', (girdi, beklenen) => {
    expect(kullaniciAdiOner(girdi)).toBe(beklenen)
  })

  it('⚠️ 40 karakterde kırpar ve NOKTAYLA BİTMEZ', () => {
    const uzun = kullaniciAdiOner('ab '.repeat(30))
    expect(uzun.length).toBeLessThanOrEqual(40)
    expect(uzun.endsWith('.')).toBe(false)
  })
})

describe('gorevAdiMi — görev adıyla açılan hesap uyarısı', () => {
  it('saf görev adlarını yakalar', () => {
    expect(gorevAdiMi('depocu')).toBe(true)
    expect(gorevAdiMi('kalite.sorumlusu')).toBe(true)
    expect(gorevAdiMi('MUHASEBE')).toBe(true)
  })

  it('⚠️ içinde kişi adı geçeni yakalamaz — o hesap bir kişiyi gösteriyor', () => {
    expect(gorevAdiMi('ali.depocu')).toBe(false)
    expect(gorevAdiMi('alaattin.kocatepe')).toBe(false)
  })

  it('boş girdi uyarı üretmez', () => {
    expect(gorevAdiMi('')).toBe(false)
    expect(gorevAdiMi('   ')).toBe(false)
  })
})
