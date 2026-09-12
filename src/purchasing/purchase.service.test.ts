// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Satın alma servisi testleri
//
// Yol haritası maddesi: "Satın alma talebi ve siparişi"
//                       Bitti sayılır ki: "Talep → sipariş akışı uçtan uca"
//
// Kriterin sınanabilir hâli: talebi açıp onaylatıp siparişe dönüştüren TEK bir
// testin, aradaki hiçbir adımı atlamadan yeşil olması. Aşağıdaki "uçtan uca"
// bloğu bunu yapıyor; diğerleri o yolun her adımındaki kuralları koruyor.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import type { TenantCtx } from '../core/context'
import type {
  SatinAlmaDeposu,
  YeniSiparis,
  YeniTalep,
} from './purchase.repository'
import { SatinAlmaServisi, sonrakiBelgeNo } from './purchase.service'
import {
  GecersizDurumGecisiError,
  SatinAlmaDogrulamaError,
  siparisToplami,
  type Siparis,
  type SiparisDurumu,
  type Talep,
  type TalepDurumu,
} from './purchase.types'

const ctx: TenantCtx = { tenantId: 'tenant-1', branchId: 'branch-1', userId: 'user-1' }

const DOMATES = 'kalem-domates'
const UN = 'kalem-un'

class BellekDeposu implements SatinAlmaDeposu {
  talepListesi: Talep[] = []
  siparisListesi: Siparis[] = []
  private sayac = 0

  async talepler(): Promise<Talep[]> { return [...this.talepListesi] }
  async siparisler(): Promise<Siparis[]> { return [...this.siparisListesi] }

  async talepEkle(_ctx: TenantCtx, girdi: YeniTalep): Promise<Talep> {
    const talep: Talep = {
      id: `tal-${++this.sayac}`,
      talepNo: girdi.talepNo,
      durum: 'DRAFT',
      gerekenTarih: girdi.gerekenTarih,
      not: girdi.not,
      olusturmaTarihi: new Date().toISOString(),
      satirlar: girdi.satirlar.map((s, i) => ({ ...s, id: `tsat-${++this.sayac}`, siraNo: i + 1 })),
    }
    this.talepListesi.push(talep)
    return talep
  }

  async talepDurumDegistir(
    _ctx: TenantCtx, id: string, durum: TalepDurumu, kararNotu?: string,
  ): Promise<Talep> {
    const guncel = { ...this.talepBul(id), durum, kararNotu }
    this.talepListesi = this.talepListesi.map(t => (t.id === id ? guncel : t))
    return guncel
  }

  async siparisEkle(_ctx: TenantCtx, girdi: YeniSiparis): Promise<Siparis> {
    const siparis: Siparis = {
      id: `sip-${++this.sayac}`,
      siparisNo: girdi.siparisNo,
      durum: 'DRAFT',
      tedarikciId: girdi.tedarikciId,
      talepId: girdi.talepId,
      paraBirimi: girdi.paraBirimi ?? 'TRY',
      beklenenTarih: girdi.beklenenTarih,
      not: girdi.not,
      olusturmaTarihi: new Date().toISOString(),
      satirlar: girdi.satirlar.map((s, i) => ({ ...s, id: `ssat-${++this.sayac}`, siraNo: i + 1 })),
    }
    this.siparisListesi.push(siparis)
    return siparis
  }

  async siparisDurumDegistir(_ctx: TenantCtx, id: string, durum: SiparisDurumu): Promise<Siparis> {
    const mevcut = this.siparisListesi.find(s => s.id === id)
    if(!mevcut) throw new Error(`Sipariş bulunamadı: ${id}`)
    const guncel = { ...mevcut, durum }
    this.siparisListesi = this.siparisListesi.map(s => (s.id === id ? guncel : s))
    return guncel
  }

  private talepBul(id: string): Talep {
    const talep = this.talepListesi.find(t => t.id === id)
    if(!talep) throw new Error(`Talep bulunamadı: ${id}`)
    return talep
  }
}

let depo: BellekDeposu
let servis: SatinAlmaServisi

beforeEach(() => {
  depo = new BellekDeposu()
  servis = new SatinAlmaServisi(depo)
})

const ornekTalep: YeniTalep = {
  talepNo: 'SAT-2026-0001',
  satirlar: [
    { stokKalemiId: DOMATES, miktar: 40, birim: 'kg' },
    { stokKalemiId: UN, miktar: 100, birim: 'kg' },
  ],
}

describe('Satın alma · UÇTAN UCA: talep → onay → sipariş', () => {
  it('mutfak talep açar, yönetici onaylar, satın alma siparişe çevirir', async () => {
    // 1. Mutfak ihtiyacı yazar. Tedarikçi ve fiyat YOK — mutfak bunları bilmez.
    const taslak = await servis.talepAc(ctx, ornekTalep)
    expect(taslak.durum).toBe('DRAFT')
    expect(taslak.satirlar).toHaveLength(2)

    // 2. Onaya gönderilir.
    const onayda = await servis.talepDurumDegistir(ctx, taslak, 'SUBMITTED')
    expect(onayda.durum).toBe('SUBMITTED')

    // 3. Yönetici onaylar.
    const onayli = await servis.talepDurumDegistir(ctx, onayda, 'APPROVED')
    expect(onayli.durum).toBe('APPROVED')

    // 4. Satın alma siparişe çevirir: tedarikçi ve fiyat BURADA giriliyor.
    const siparis = await servis.talepteSiparisOlustur(ctx, onayli, {
      siparisNo: 'SIP-2026-0001',
      tedarikciId: 'ted-1',
      fiyatlar: { [DOMATES]: 18.5, [UN]: 12 },
    })

    expect(siparis.durum).toBe('DRAFT')
    expect(siparis.talepId).toBe(onayli.id)
    // Kalemler ve miktarlar talepten AYNEN geldi.
    expect(siparis.satirlar.map(s => [s.stokKalemiId, s.miktar]))
      .toEqual([[DOMATES, 40], [UN, 100]])
    expect(siparisToplami(siparis.satirlar)).toBe(40 * 18.5 + 100 * 12)

    // 5. Tedarikçiye gönderilir.
    const gonderilen = await servis.siparisDurumDegistir(ctx, siparis, 'SENT')
    expect(gonderilen.durum).toBe('SENT')
  })
})

describe('Satın alma · talep kuralları', () => {
  it('kalemsiz talep açılamıyor', async () => {
    await expect(servis.talepAc(ctx, { talepNo: 'SAT-1', satirlar: [] }))
      .rejects.toThrow(SatinAlmaDogrulamaError)
  })

  it('sıfır veya eksi miktarlı kalem reddediliyor', async () => {
    await expect(servis.talepAc(ctx, {
      talepNo: 'SAT-1', satirlar: [{ stokKalemiId: UN, miktar: 0, birim: 'kg' }],
    })).rejects.toThrow(SatinAlmaDogrulamaError)
  })

  it('taslak talep doğrudan onaylanamıyor — önce onaya gönderilmeli', async () => {
    const taslak = await servis.talepAc(ctx, ornekTalep)
    await expect(servis.talepDurumDegistir(ctx, taslak, 'APPROVED'))
      .rejects.toThrow(GecersizDurumGecisiError)
  })

  it('reddetme gerekçesiz yapılamıyor', async () => {
    const taslak = await servis.talepAc(ctx, ornekTalep)
    const onayda = await servis.talepDurumDegistir(ctx, taslak, 'SUBMITTED')

    await expect(servis.talepDurumDegistir(ctx, onayda, 'REJECTED'))
      .rejects.toThrow(SatinAlmaDogrulamaError)

    const reddedilen = await servis.talepDurumDegistir(ctx, onayda, 'REJECTED', 'Bütçe dışı')
    expect(reddedilen.durum).toBe('REJECTED')
    expect(reddedilen.kararNotu).toBe('Bütçe dışı')
  })

  it('reddedilen talep geri açılamıyor — yeni talep gerekir', async () => {
    const taslak = await servis.talepAc(ctx, ornekTalep)
    const onayda = await servis.talepDurumDegistir(ctx, taslak, 'SUBMITTED')
    const reddedilen = await servis.talepDurumDegistir(ctx, onayda, 'REJECTED', 'Bütçe dışı')

    await expect(servis.talepDurumDegistir(ctx, reddedilen, 'APPROVED'))
      .rejects.toThrow(GecersizDurumGecisiError)
  })
})

describe('Satın alma · sipariş kuralları', () => {
  it('onaysız talepten sipariş oluşturulamıyor', async () => {
    const taslak = await servis.talepAc(ctx, ornekTalep)

    // Onay adımı süs değil: sipariş bir taahhüttür.
    await expect(servis.talepteSiparisOlustur(ctx, taslak, {
      siparisNo: 'SIP-1', tedarikciId: 'ted-1',
    })).rejects.toThrow(SatinAlmaDogrulamaError)
  })

  it('tedarikçisiz sipariş açılamıyor', async () => {
    await expect(servis.siparisAc(ctx, {
      siparisNo: 'SIP-1', tedarikciId: '',
      satirlar: [{ stokKalemiId: UN, miktar: 10, birim: 'kg', birimFiyat: 5 }],
    })).rejects.toThrow(SatinAlmaDogrulamaError)
  })

  it('talep olmadan doğrudan sipariş açılabiliyor — düzenli alımlar için', async () => {
    const siparis = await servis.siparisAc(ctx, {
      siparisNo: 'SIP-2026-0009', tedarikciId: 'ted-1',
      satirlar: [{ stokKalemiId: UN, miktar: 500, birim: 'kg', birimFiyat: 11.4 }],
    })
    expect(siparis.talepId).toBeUndefined()
    expect(siparis.durum).toBe('DRAFT')
  })

  it('fiyatı girilmemiş sipariş gönderilemiyor', async () => {
    const siparis = await servis.siparisAc(ctx, {
      siparisNo: 'SIP-1', tedarikciId: 'ted-1',
      satirlar: [{ stokKalemiId: UN, miktar: 10, birim: 'kg', birimFiyat: 0 }],
    })
    // Fiyatsız sipariş, ortalama maliyeti sıfırla besler.
    await expect(servis.siparisDurumDegistir(ctx, siparis, 'SENT'))
      .rejects.toThrow(SatinAlmaDogrulamaError)
  })

  it('gönderilmiş sipariş taslağa geri dönemiyor', async () => {
    const siparis = await servis.siparisAc(ctx, {
      siparisNo: 'SIP-1', tedarikciId: 'ted-1',
      satirlar: [{ stokKalemiId: UN, miktar: 10, birim: 'kg', birimFiyat: 5 }],
    })
    const gonderilen = await servis.siparisDurumDegistir(ctx, siparis, 'SENT')

    await expect(servis.siparisDurumDegistir(ctx, gonderilen, 'DRAFT'))
      .rejects.toThrow(GecersizDurumGecisiError)
  })

  it('teslim durumları elle seçilemiyor — mal kabulün sonucudur', async () => {
    const siparis = await servis.siparisAc(ctx, {
      siparisNo: 'SIP-1', tedarikciId: 'ted-1',
      satirlar: [{ stokKalemiId: UN, miktar: 10, birim: 'kg', birimFiyat: 5 }],
    })
    const gonderilen = await servis.siparisDurumDegistir(ctx, siparis, 'SENT')

    // "Sistemde teslim alınmış ama depoda olmayan mal" üretmenin yolu budur.
    await expect(servis.siparisDurumDegistir(ctx, gonderilen, 'RECEIVED'))
      .rejects.toThrow(GecersizDurumGecisiError)
  })
})

describe('Satın alma · teslim durumu', () => {
  const gonderilmisSiparis = async () => {
    const siparis = await servis.siparisAc(ctx, {
      siparisNo: 'SIP-T1', tedarikciId: 'ted-1',
      satirlar: [{ stokKalemiId: UN, miktar: 10, birim: 'kg', birimFiyat: 5 }],
    })
    return servis.siparisDurumDegistir(ctx, siparis, 'SENT')
  }

  it('mal kabul kapısından PARTIAL ve RECEIVED yazılabiliyor', async () => {
    const gonderilen = await gonderilmisSiparis()

    const kismi = await servis.teslimDurumunuGuncelle(ctx, gonderilen, 'PARTIAL')
    expect(kismi.durum).toBe('PARTIAL')

    const tamam = await servis.teslimDurumunuGuncelle(ctx, kismi, 'RECEIVED')
    expect(tamam.durum).toBe('RECEIVED')
  })

  it('gönderilmemiş siparişe teslim işlenemiyor', async () => {
    const taslak = await servis.siparisAc(ctx, {
      siparisNo: 'SIP-T2', tedarikciId: 'ted-1',
      satirlar: [{ stokKalemiId: UN, miktar: 10, birim: 'kg', birimFiyat: 5 }],
    })
    // Sipariş henüz tedarikçiye gitmedi; malın gelmiş olması mümkün değil.
    await expect(servis.teslimDurumunuGuncelle(ctx, taslak, 'RECEIVED'))
      .rejects.toThrow(SatinAlmaDogrulamaError)
  })
})

describe('Satın alma · belge numarası', () => {
  it('boş listede ilk numarayı üretiyor', () => {
    expect(sonrakiBelgeNo('SAT', [], 2026)).toBe('SAT-2026-0001')
  })

  it('en büyük numaranın bir fazlasını üretiyor', () => {
    expect(sonrakiBelgeNo('SAT', ['SAT-2026-0001', 'SAT-2026-0007', 'SAT-2026-0003'], 2026))
      .toBe('SAT-2026-0008')
  })

  it('başka yılın ve başka önekin numaraları sayıma girmiyor', () => {
    expect(sonrakiBelgeNo('SAT', ['SAT-2025-0042', 'SIP-2026-0099'], 2026))
      .toBe('SAT-2026-0001')
  })
})

describe('Satın alma · toplam', () => {
  it('miktar × birim fiyat toplanıyor, kuruşta yuvarlanıyor', () => {
    expect(siparisToplami([
      { id: '1', stokKalemiId: UN, miktar: 3, birim: 'kg', birimFiyat: 10.333, siraNo: 1 },
      { id: '2', stokKalemiId: DOMATES, miktar: 2, birim: 'kg', birimFiyat: 5.5, siraNo: 2 },
    ])).toBe(42)
  })
})
