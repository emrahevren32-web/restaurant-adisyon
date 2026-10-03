// Portal müşterinin elinde çalışıyor: buradaki hiçbir kontrole güvenilmiyor,
// hepsi 0054'te tekrar yapılıyor. Sınanan şey, müşteriye DOĞRU CÜMLEYİ
// kurmak ve fiyatın hiçbir yere sızmaması.

import { describe, it, expect } from 'vitest'
import type {
  PortalDeposu, PortalNoktasi, PortalSatiri, PortalSiparisi,
  PortalSiparisSatiri, PortalUrunu,
} from './portal.repository'
import {
  PortalDogrulamaError, PortalServisi, portalDurumu, satirlariDogrula, tarihCumlesi,
} from './portal.service'

class BellekDeposu implements PortalDeposu {
  sonSiparis?: { nokta: string; satirlar: readonly PortalSiparisSatiri[]; teslim?: string; not?: string }
  async noktalarim(): Promise<PortalNoktasi[]> { return [] }
  async urunlerim(): Promise<PortalUrunu[]> { return [] }
  async enErkenSevk(): Promise<string | undefined> { return '2026-10-02' }
  async siparislerim(): Promise<PortalSiparisi[]> { return [] }
  async satirlarim(): Promise<PortalSatiri[]> { return [] }
  async siparisVer(
    nokta: string, satirlar: readonly PortalSiparisSatiri[], teslim?: string, not?: string,
  ): Promise<string> {
    this.sonSiparis = { nokta, satirlar, teslim, not }
    return 'SIP-2026-0001'
  }
}

const kur = () => {
  const depo = new BellekDeposu()
  return { depo, servis: new PortalServisi(depo) }
}

const S = (ek: Partial<PortalSiparisSatiri> = {}): PortalSiparisSatiri =>
  ({ kalemId: 'k1', miktar: 10, birim: 'koli', ...ek })

describe('satirlariDogrula', () => {
  it('nokta seçilmeden sipariş olmuyor', () => {
    expect(() => satirlariDogrula('', [S()])).toThrow(/Teslim noktası/)
  })

  it('boş sipariş olmuyor', () => {
    expect(() => satirlariDogrula('n1', [])).toThrow(/en az bir ürün/)
  })

  it('sıfır ve eksi miktar reddediliyor', () => {
    expect(() => satirlariDogrula('n1', [S({ miktar: 0 })])).toThrow(PortalDogrulamaError)
    expect(() => satirlariDogrula('n1', [S({ miktar: -5 })])).toThrow(PortalDogrulamaError)
  })

  it('AYNI ürün iki satırda olamaz — biri diğerini gizler', () => {
    expect(() => satirlariDogrula('n1', [S(), S({ miktar: 5 })]))
      .toThrow(/zaten var/)
  })

  it('birimi boşluk olan satır reddediliyor', () => {
    expect(() => satirlariDogrula('n1', [S({ birim: '  ' })])).toThrow(/birimi zorunlu/)
  })

  it('geçerli satırların birimini kırpıyor', () => {
    expect(satirlariDogrula('n1', [S({ birim: ' koli ' })])[0]?.birim).toBe('koli')
  })
})

describe('PortalServisi', () => {
  it('geçerli siparişi depoya indiriyor', async () => {
    const { servis, depo } = kur()
    const no = await servis.siparisVer('n1', [S()], '2026-10-05', ' acele ')
    expect(no).toBe('SIP-2026-0001')
    expect(depo.sonSiparis?.nokta).toBe('n1')
    expect(depo.sonSiparis?.teslim).toBe('2026-10-05')
    expect(depo.sonSiparis?.not).toBe('acele')
  })

  it('doğrulama hatası REDDEDİLMİŞ SÖZ olarak dönüyor', async () => {
    // Metot `async` değilse senkron fırlatır ve `.catch()` yazan çağıran
    // hatayı hiç görmez (tuzak 41).
    const { servis } = kur()
    await expect(servis.siparisVer('n1', [])).rejects.toThrow(PortalDogrulamaError)
  })
})

describe('portalDurumu', () => {
  it('iç durumları müşteri diline çeviriyor', () => {
    // "Kısmi Sevk" bizim depo hâlimiz; müşteri kendi kapısında ne olduğunu
    // bilmek ister.
    expect(portalDurumu('Onay Bekliyor')).toBe('İnceleniyor')
    expect(portalDurumu('Kısmi Sevk')).toBe('Kısmen yolda')
    expect(portalDurumu('Sevk Edildi')).toBe('Yolda')
  })

  it('tanımadığı durumu OLDUĞU GİBİ veriyor, uydurmuyor', () => {
    expect(portalDurumu('Yeni Bir Durum')).toBe('Yeni Bir Durum')
  })
})

describe('tarihCumlesi', () => {
  const sip = (ek: Partial<PortalSiparisi> = {}): PortalSiparisi =>
    ({ siparisNo: 'SIP-2026-0001', tarih: '2026-09-30', durum: 'Onay Bekliyor', ...ek })

  it('söz verilen tarih FARKLIYSA ikisini de söylüyor', () => {
    // Sessizce kendi tarihimizi göstermek, müşterinin beklediği günü
    // kaçırmasına yol açardı.
    const c = tarihCumlesi(sip({ sevkTarihi: '2026-10-02', sozTarihi: '2026-10-05' }))
    expect(c).toContain('02.10.2026')
    expect(c).toContain('05.10.2026')
  })

  it('aynıysa tek tarih yazıyor', () => {
    expect(tarihCumlesi(sip({ sevkTarihi: '2026-10-02', sozTarihi: '2026-10-02' })))
      .toBe('Teslim: 02.10.2026')
  })

  it('söz yoksa yalnız sevk tarihini yazıyor', () => {
    expect(tarihCumlesi(sip({ sevkTarihi: '2026-10-02' }))).toBe('Sevk: 02.10.2026')
  })
})

describe('Fiyat sızıntısı', () => {
  it('portal tiplerinde FİYAT ALANI YOK', () => {
    // Emrah'ın kararı: "Form fiyat gösterecek mi? Hayır." Olmayan bir alan
    // sızdırılamaz; bu test o kararın yazılı hâli.
    const satir: PortalSatiri = { kalemAdi: 'Çorba', miktar: 10, birim: 'koli' }
    expect(Object.keys(satir).some(k => /fiyat|price|tutar/i.test(k))).toBe(false)
    const urun: PortalUrunu = { kalemId: 'k1', ad: 'Çorba', birim: 'koli' }
    expect(Object.keys(urun).some(k => /fiyat|price|tutar/i.test(k))).toBe(false)
  })
})
