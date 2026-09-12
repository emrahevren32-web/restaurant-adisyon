// HACCP servisi. Buradaki testlerin çoğu tek bir soruyu kolluyor:
// KAYIT TUTULDU DİYE KONTROL EDİLMİŞ SAYILIYOR MU? Sayılmamalı.

import { describe, it, expect, beforeEach } from 'vitest'
import type { TenantCtx } from '../core/context'
import {
  type Ccp, type DuzelticiFaaliyet, type FaaliyetDurumu, type HaccpDeposu,
  type Olcum, type OlcumKaynagi, type OlcumSonucu, type YeniOlcum,
} from './haccp.repository'
import {
  HaccpDogrulamaError, HaccpServisi, asamaninCcpleri, haccpOzeti,
  limitOzeti, sapmaMetni, sonucHesapla,
} from './haccp.service'

const ctx: TenantCtx = { tenantId: 't1', branchId: 'b1', userId: 'u1' }

const ccp = (yama: Partial<Ccp> = {}): Ccp => ({
  id: 'c1', planId: 'p1', kod: 'CCP-1', ad: 'Soğuk zincir · mal kabul',
  asama: 'RECEIVING', limitTipi: 'MAX', limitUst: 4, birim: '°C',
  durum: 'ACTIVE', sorumluRol: 'Depo sorumlusu',
  duzelticiTalimat: 'Malı kabul etme, iade et.', ...yama,
})

/** Bellekte yaşayan HACCP defteri. */
class BellekDepo implements HaccpDeposu {
  ccpListesi: Ccp[] = []
  olcumListesi: Olcum[] = []
  faaliyetListesi: DuzelticiFaaliyet[] = []
  sayac = 0

  async ccpler() { return this.ccpListesi }
  async olcumler() { return this.olcumListesi }
  async kaynaginOlcumleri(_c: TenantCtx, tip: OlcumKaynagi, id: string) {
    return this.olcumListesi.filter(o => o.kaynakTipi === tip && o.kaynakId === id)
  }
  async lotunOlcumleri(_c: TenantCtx, lotId: string) {
    return this.olcumListesi.filter(o => o.lotId === lotId)
  }
  async olcumYaz(
    _c: TenantCtx, girdi: YeniOlcum, sonuc: OlcumSonucu,
    ozet: string, birim: string,
  ): Promise<Olcum> {
    this.sayac += 1
    const kayit: Olcum = {
      id: `o${this.sayac}`, ccpId: girdi.ccpId, deger: girdi.deger, birim,
      sonuc, limitOzeti: ozet, kaynakTipi: girdi.kaynakTipi,
      kaynakId: girdi.kaynakId, lotId: girdi.lotId,
      stokKalemiId: girdi.stokKalemiId,
      olcumZamani: girdi.olcumZamani ?? '2026-09-10T08:00:00Z',
      not: girdi.not,
    }
    this.olcumListesi.push(kayit)
    return kayit
  }
  async olcumIptal(_c: TenantCtx, olcumId: string, gerekce: string) {
    const o = this.olcumListesi.find(x => x.id === olcumId)
    if(o){ o.iptalZamani = '2026-09-10T09:00:00Z'; o.iptalGerekcesi = gerekce }
  }
  async faaliyetler(_c: TenantCtx, durum?: FaaliyetDurumu) {
    return durum ? this.faaliyetListesi.filter(f => f.durum === durum) : this.faaliyetListesi
  }
  async faaliyetAc(_c: TenantCtx, olcumId: string, aciklama: string, rol?: string) {
    const f: DuzelticiFaaliyet = {
      id: `f${this.faaliyetListesi.length + 1}`, olcumId,
      aciklama, atananRol: rol, durum: 'OPEN',
    }
    this.faaliyetListesi.push(f)
    return f
  }
  async faaliyetGuncelle(_c: TenantCtx, id: string, yama: Partial<DuzelticiFaaliyet>) {
    const f = this.faaliyetListesi.find(x => x.id === id)!
    Object.assign(f, yama)
    return f
  }
}

// ═══════════════════════════════════════════════════════════════════════════
describe('sonucHesapla · karar SAYIDAN çıkıyor, metinden değil', () => {
  it('MAX limitte sınırın altı ve TAM SINIR uygun', () => {
    const c = ccp({ limitTipi: 'MAX', limitUst: 4 })
    expect(sonucHesapla(c, 3.9)).toBe('PASS')
    // Sınır değeri uygun sayılır: 4,0'ı reddetmek her termometreyi
    // uygunsuz gösterirdi.
    expect(sonucHesapla(c, 4)).toBe('PASS')
    expect(sonucHesapla(c, 4.1)).toBe('FAIL')
  })

  it('MIN limitte pişirme sıcaklığı', () => {
    const c = ccp({ limitTipi: 'MIN', limitAlt: 75, limitUst: undefined })
    expect(sonucHesapla(c, 74.9)).toBe('FAIL')
    expect(sonucHesapla(c, 75)).toBe('PASS')
    expect(sonucHesapla(c, 82)).toBe('PASS')
  })

  it('RANGE limitte soğuk oda iki yönden de kontrol ediliyor', () => {
    const c = ccp({ limitTipi: 'RANGE', limitAlt: 0, limitUst: 4 })
    expect(sonucHesapla(c, -1)).toBe('FAIL')   // donma riski
    expect(sonucHesapla(c, 0)).toBe('PASS')
    expect(sonucHesapla(c, 4)).toBe('PASS')
    expect(sonucHesapla(c, 5)).toBe('FAIL')
  })

  it('negatif limit (donmuş ürün) doğru çalışıyor', () => {
    const c = ccp({ limitTipi: 'MAX', limitUst: -18 })
    expect(sonucHesapla(c, -20)).toBe('PASS')
    expect(sonucHesapla(c, -18)).toBe('PASS')
    expect(sonucHesapla(c, -15)).toBe('FAIL')
  })

  it('sayı olmayan değer UYGUN sayılmıyor', () => {
    expect(sonucHesapla(ccp(), Number.NaN)).toBe('FAIL')
    expect(sonucHesapla(ccp(), Number.POSITIVE_INFINITY)).toBe('FAIL')
  })

  it('limiti eksik tanımlanmış CCP ölçümü UYGUN sayamıyor', () => {
    // Yarım tanımlı bir kural, sessizce "geçti" dememeli.
    expect(sonucHesapla(ccp({ limitTipi: 'MAX', limitUst: undefined }), 1)).toBe('FAIL')
    expect(sonucHesapla(ccp({ limitTipi: 'RANGE', limitAlt: 0, limitUst: undefined }), 1)).toBe('FAIL')
  })
})

describe('limitOzeti ve sapmaMetni', () => {
  it('kayda gömülecek özet insan diliyle', () => {
    expect(limitOzeti(ccp({ limitMetni: 'En çok 4 °C' }))).toBe('En çok 4 °C (°C)')
    expect(limitOzeti(ccp({ limitMetni: undefined }))).toBe('en çok 4 °C')
    expect(limitOzeti(ccp({ limitMetni: undefined, limitTipi: 'MIN', limitAlt: 75 })))
      .toBe('en az 75 °C')
    expect(limitOzeti(ccp({ limitMetni: undefined, limitTipi: 'RANGE', limitAlt: 0, limitUst: 4 })))
      .toBe('0 – 4 °C')
  })

  it('sapma metni ÖLÇÜLENİ ve SINIRI birlikte söylüyor', () => {
    const m = sapmaMetni(ccp(), 7.5)
    expect(m).toContain('7,5')
    expect(m).toContain('4')
  })
})

describe('asamaninCcpleri', () => {
  it('yalnızca o aşamanın AKTİF noktalarını veriyor', () => {
    const liste = [
      ccp({ id: 'a', asama: 'RECEIVING' }),
      ccp({ id: 'b', asama: 'COOKING' }),
      ccp({ id: 'c', asama: 'RECEIVING', durum: 'PASSIVE' }),
    ]
    expect(asamaninCcpleri(liste, 'RECEIVING').map(c => c.id)).toEqual(['a'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('HaccpServisi.olcumEkle', () => {
  let depo: BellekDepo
  let servis: HaccpServisi
  beforeEach(() => { depo = new BellekDepo(); servis = new HaccpServisi(depo) })

  it('uygun ölçüm yazılıyor, faaliyet AÇILMIYOR', async () => {
    const { olcum, faaliyet } = await servis.olcumEkle(ctx, ccp(), {
      ccpId: 'c1', deger: 3, kaynakTipi: 'goods_receipt', kaynakId: 'mk1',
    })
    expect(olcum.sonuc).toBe('PASS')
    expect(faaliyet).toBeUndefined()
    expect(depo.faaliyetListesi).toHaveLength(0)
  })

  it('LİMİT AŞILINCA düzeltici faaliyet KENDİLİĞİNDEN açılıyor', async () => {
    const { olcum, faaliyet } = await servis.olcumEkle(ctx, ccp(), {
      ccpId: 'c1', deger: 9, kaynakTipi: 'goods_receipt', kaynakId: 'mk1',
    })
    expect(olcum.sonuc).toBe('FAIL')
    expect(faaliyet).toBeDefined()
    expect(faaliyet!.durum).toBe('OPEN')
    // Faaliyet, NE YAPILACAĞINI da söylüyor — CCP'nin talimatı kayda geçiyor.
    expect(faaliyet!.aciklama).toContain('Malı kabul etme')
    expect(faaliyet!.atananRol).toBe('Depo sorumlusu')
  })

  it('limit metni kayda GÖMÜLÜYOR — sonra limit değişse bile', async () => {
    const c = ccp({ limitMetni: 'En çok 4 °C' })
    const { olcum } = await servis.olcumEkle(ctx, c, {
      ccpId: 'c1', deger: 3, kaynakTipi: 'manual',
    })
    expect(olcum.limitOzeti).toBe('En çok 4 °C (°C)')

    // İşletme limiti gevşetiyor…
    const gevsek = ccp({ limitTipi: 'MAX', limitUst: 8, limitMetni: 'En çok 8 °C' })
    const { olcum: yeni } = await servis.olcumEkle(ctx, gevsek, {
      ccpId: 'c1', deger: 7, kaynakTipi: 'manual',
    })
    // …eski kayıt ESKİ limitiyle duruyor.
    expect(depo.olcumListesi[0].limitOzeti).toBe('En çok 4 °C (°C)')
    expect(yeni.limitOzeti).toBe('En çok 8 °C (°C)')
  })

  it('ölçüm PARTİYE bağlanıyor — geri çağırmanın dayandığı bağ', async () => {
    await servis.olcumEkle(ctx, ccp(), {
      ccpId: 'c1', deger: 9, kaynakTipi: 'goods_receipt', kaynakId: 'mk1',
      lotId: 'LOT-1', stokKalemiId: 'k1',
    })
    const partininOlcumleri = await servis.lotunOlcumleri(ctx, 'LOT-1')
    expect(partininOlcumleri).toHaveLength(1)
    expect(partininOlcumleri[0].sonuc).toBe('FAIL')
  })

  it('belgeye bağlı ölçümler o belgeden okunabiliyor', async () => {
    await servis.olcumEkle(ctx, ccp(), { ccpId: 'c1', deger: 3, kaynakTipi: 'goods_receipt', kaynakId: 'mk1' })
    await servis.olcumEkle(ctx, ccp({ id: 'c2', kod: 'CCP-2' }), { ccpId: 'c2', deger: 2, kaynakTipi: 'goods_receipt', kaynakId: 'mk1' })
    await servis.olcumEkle(ctx, ccp(), { ccpId: 'c1', deger: 3, kaynakTipi: 'goods_receipt', kaynakId: 'mk2' })
    expect(await servis.kaynaginOlcumleri(ctx, 'goods_receipt', 'mk1')).toHaveLength(2)
  })

  it('pasif kontrol noktasına ölçüm yazılamıyor', async () => {
    await expect(servis.olcumEkle(ctx, ccp({ durum: 'PASSIVE' }), {
      ccpId: 'c1', deger: 3, kaynakTipi: 'manual',
    })).rejects.toThrow(HaccpDogrulamaError)
  })

  it('sayı olmayan değer reddediliyor', async () => {
    await expect(servis.olcumEkle(ctx, ccp(), {
      ccpId: 'c1', deger: Number.NaN, kaynakTipi: 'manual',
    })).rejects.toThrow(HaccpDogrulamaError)
  })
})

describe('HaccpServisi · iptal ve kapanış', () => {
  let depo: BellekDepo
  let servis: HaccpServisi
  beforeEach(() => { depo = new BellekDepo(); servis = new HaccpServisi(depo) })

  it('gerekçesiz iptal REDDEDİLİYOR — gerekçesiz iptal silmedir', async () => {
    const { olcum } = await servis.olcumEkle(ctx, ccp(), { ccpId: 'c1', deger: 3, kaynakTipi: 'manual' })
    await expect(servis.olcumIptalEt(ctx, olcum, '   ')).rejects.toThrow(HaccpDogrulamaError)
  })

  it('iptal edilen ölçüm SİLİNMİYOR, gerekçesiyle duruyor', async () => {
    const { olcum } = await servis.olcumEkle(ctx, ccp(), { ccpId: 'c1', deger: 3, kaynakTipi: 'manual' })
    await servis.olcumIptalEt(ctx, olcum, 'Termometre bozuktu, yanlış okundu.')
    expect(depo.olcumListesi).toHaveLength(1)
    expect(depo.olcumListesi[0].iptalGerekcesi).toContain('Termometre')
  })

  it('aynı ölçüm iki kez iptal edilemiyor', async () => {
    const { olcum } = await servis.olcumEkle(ctx, ccp(), { ccpId: 'c1', deger: 3, kaynakTipi: 'manual' })
    await servis.olcumIptalEt(ctx, olcum, 'gerekçe')
    await expect(servis.olcumIptalEt(ctx, depo.olcumListesi[0], 'yine'))
      .rejects.toThrow(HaccpDogrulamaError)
  })

  it('NE YAPILDIĞI yazılmadan faaliyet kapatılamıyor', async () => {
    const { faaliyet } = await servis.olcumEkle(ctx, ccp(), { ccpId: 'c1', deger: 9, kaynakTipi: 'manual' })
    await expect(servis.faaliyetiKapat(ctx, faaliyet!, '  ')).rejects.toThrow(HaccpDogrulamaError)
  })

  it('faaliyet kapanınca yapılan iş ve zaman kaydediliyor', async () => {
    const { faaliyet } = await servis.olcumEkle(ctx, ccp(), { ccpId: 'c1', deger: 9, kaynakTipi: 'manual' })
    const kapali = await servis.faaliyetiKapat(ctx, faaliyet!, 'Mal iade edildi, tedarikçi bilgilendirildi.')
    expect(kapali.durum).toBe('COMPLETED')
    expect(kapali.yapilanIs).toContain('iade')
    expect(kapali.kapanisZamani).toBeTruthy()
  })
})

describe('haccpOzeti · kontrol panelinin GERÇEK rakamları', () => {
  const olcum = (yama: Partial<Olcum>): Olcum => ({
    id: 'o', ccpId: 'c1', deger: 3, birim: '°C', sonuc: 'PASS',
    limitOzeti: 'en çok 4 °C', kaynakTipi: 'manual',
    olcumZamani: '2026-09-10T08:00:00Z', ...yama,
  })

  it('bugünün ölçümlerini sayıyor, dünküleri saymıyor', () => {
    const o = haccpOzeti([
      olcum({ id: '1' }),
      olcum({ id: '2', sonuc: 'FAIL' }),
      olcum({ id: '3', olcumZamani: '2026-09-09T08:00:00Z' }),
    ], [], '2026-09-10')

    expect(o.bugunOlcum).toBe(2)
    expect(o.bugunUygun).toBe(1)
    expect(o.bugunUygunsuz).toBe(1)
    expect(o.uygunlukYuzdesi).toBe(50)
  })

  it('İPTAL EDİLMİŞ ölçüm yüzdeye karışmıyor', () => {
    const o = haccpOzeti([
      olcum({ id: '1' }),
      olcum({ id: '2', sonuc: 'FAIL', iptalZamani: '2026-09-10T09:00:00Z' }),
    ], [], '2026-09-10')

    // İptali de saysaydık yüzde %50 çıkardı ve hiçbir şey anlatmazdı.
    expect(o.bugunOlcum).toBe(1)
    expect(o.uygunlukYuzdesi).toBe(100)
  })

  it('açık ve süren faaliyetler birlikte sayılıyor', () => {
    const f = (durum: FaaliyetDurumu): DuzelticiFaaliyet =>
      ({ id: 'f', olcumId: 'o', aciklama: 'x', durum })
    const o = haccpOzeti([], [f('OPEN'), f('IN_PROGRESS'), f('COMPLETED'), f('CANCELLED')])
    expect(o.acikFaaliyet).toBe(2)
  })

  it('hiç ölçüm yoksa yüzde 100 ama ÖLÇÜM SAYISI 0 — ekran ikisini de gösterir', () => {
    const o = haccpOzeti([], [], '2026-09-10')
    expect(o.bugunOlcum).toBe(0)
    expect(o.uygunlukYuzdesi).toBe(100)
  })
})
