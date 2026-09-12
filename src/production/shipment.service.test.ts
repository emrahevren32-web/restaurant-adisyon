// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 — Sevkiyat testleri
//
// Yol haritası maddesi: "Sevkiyat → stok çıkışı"
//         Bitti sayılır ki: "Sevk edilen lot kaydediliyor"
//
// Kriterin sınanabilir hâli: sevkiyattan sonra defterde HANGİ PARTİDEN
// gittiğinin yazılı olması — hem tek partide hem FEFO'nun böldüğü durumda.
// Belgede lot kolonu YOK; kriter defterde karşılanıyor ve testi de orada.
//
// Stok kısmında sahte yok: gerçek `LocalStorageStockRepository` ve gerçek
// `DepoServisi`. FEFO'yu ve ters kaydı sahteleştirseydik hiçbir şey sınamazdık.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import type { TenantCtx } from '../core/context'
import { LocalStorageStockRepository } from '../core/stock/stock.localstorage'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import { FixedTenantPolicyLookup } from '../core/stock/tenant-policy-lookup'
import { DepoServisi } from '../warehouse/warehouse.service'
import type {
  Birim, KatalogKalemi, KatalogLotu, StokKatalogu, YeniKalem, YeniLot,
} from '../warehouse/warehouse.catalog'
import {
  SEVKIYAT_GECISLERI,
  type Sevkiyat,
  type SevkiyatDeposu,
  type SevkiyatDurumu,
  type YeniSevkiyat,
} from './shipment.repository'
import {
  GecersizSevkiyatGecisiError,
  SevkiyatServisi,
  YetersizStokIleSevkEdilemezError,
  sonrakiSevkiyatNo,
} from './shipment.service'

const ctx: TenantCtx = { tenantId: 't1', branchId: 'b1', userId: 'u1' }
const CORBA = 'kalem-corba'   // lot + SKT takipli, temel birim kg

const KALEMLER: KatalogKalemi[] = [
  { id: CORBA, kod: 'MML-01', ad: 'Mercimek Çorbası', temelBirim: 'kg',
    lotTakipli: true, sktTakipli: true, minMiktar: 0, aktif: true },
]

class BellekKatalog implements StokKatalogu {
  kalemListesi: KatalogKalemi[] = [...KALEMLER]
  lotListesi: KatalogLotu[] = []
  private sayac = 0
  async kalemler(){ return [...this.kalemListesi] }
  async kalemEkle(_c: TenantCtx, g: YeniKalem): Promise<KatalogKalemi> {
    const k: KatalogKalemi = {
      id: `k-${++this.sayac}`, kod: g.kod, ad: g.ad, temelBirim: g.temelBirim,
      lotTakipli: g.lotTakipli, sktTakipli: g.sktTakipli, minMiktar: 0, aktif: true,
    }
    this.kalemListesi.push(k); return k
  }
  async lotlar(_c: TenantCtx, id: string){ return this.lotListesi.filter(l => l.stokKalemiId === id) }
  async lotEkle(_c: TenantCtx, g: YeniLot): Promise<KatalogLotu> {
    const l: KatalogLotu = {
      id: `lot-${++this.sayac}`, stokKalemiId: g.stokKalemiId, kod: g.kod,
      sonKullanma: g.sonKullanma, tedarikci: g.tedarikci, kaynakTipi: g.kaynakTipi ?? 'RECEIPT',
    }
    this.lotListesi.push(l); return l
  }
  async birimler(): Promise<Birim[]> { return [{ kod: 'kg', ad: 'Kilogram', boyut: 'MASS' }] }
}

class BellekSevkiyatDeposu implements SevkiyatDeposu {
  kayitlar: Sevkiyat[] = []
  private sayac = 0
  async hepsi(){ return this.kayitlar.map(s => ({ ...s, satirlar: s.satirlar.map(x => ({ ...x })) })) }
  async tekil(_c: TenantCtx, id: string): Promise<Sevkiyat> {
    const s = this.kayitlar.find(x => x.id === id)
    if(!s) throw new Error(`Sevkiyat bulunamadı: ${id}`)
    return { ...s, satirlar: s.satirlar.map(x => ({ ...x })) }
  }
  async kimliklerden(_c: TenantCtx, idler: readonly string[]) {
    return this.kayitlar.filter(s => idler.includes(s.id))
  }
  async ekle(c: TenantCtx, g: YeniSevkiyat): Promise<Sevkiyat> {
    const s: Sevkiyat = {
      id: `svk-${++this.sayac}`, sevkiyatNo: g.sevkiyatNo, durum: 'DRAFT',
      musteriAd: g.musteriAd, musteriTelefon: g.musteriTelefon, adres: g.adres,
      hedefSubeId: g.hedefSubeId, sevkTarihi: g.sevkTarihi, not: g.not,
      olusturmaTarihi: new Date().toISOString(),
      satirlar: g.satirlar.map((x, i) => ({
        ...x, id: `svks-${++this.sayac}`, siraNo: i + 1,
        stokKalemiAd: KALEMLER.find(k => k.id === x.stokKalemiId)?.ad,
      })),
    }
    this.kayitlar.push(s)
    return this.tekil(c, s.id)
  }
  async guncelle(c: TenantCtx, id: string, g: YeniSevkiyat): Promise<Sevkiyat> {
    const mevcut = this.kayitlar.find(x => x.id === id)!
    const guncel: Sevkiyat = {
      ...mevcut, sevkiyatNo: g.sevkiyatNo, musteriAd: g.musteriAd,
      satirlar: g.satirlar.map((x, i) => ({ ...x, id: `svks-${++this.sayac}`, siraNo: i + 1 })),
    }
    this.kayitlar = this.kayitlar.map(x => (x.id === id ? guncel : x))
    return this.tekil(c, id)
  }
  async durumDegistir(c: TenantCtx, id: string, durum: SevkiyatDurumu, zaman?: string) {
    this.kayitlar = this.kayitlar.map(x => (x.id === id
      ? { ...x, durum, sevkZamani: zaman ?? x.sevkZamani } : x))
    return this.tekil(c, id)
  }
}

let katalog: BellekKatalog
let depoServisi: DepoServisi
let depo: BellekSevkiyatDeposu
let servis: SevkiyatServisi

beforeEach(() => {
  localStorage.clear()
  katalog = new BellekKatalog()
  depoServisi = new DepoServisi(
    new LocalStorageStockRepository(
      new InMemoryStockItemLookup([{ id: CORBA, baseUom: 'kg', tracksLot: true }]),
      new FixedTenantPolicyLookup('block'),
    ),
    katalog,
  )
  depo = new BellekSevkiyatDeposu()
  servis = new SevkiyatServisi(depo, depoServisi)
})

/** İki parti çorba: biri yakın SKT'li, biri uzak. FEFO sınanabilsin. */
const depoyuDoldur = async () => {
  await depoServisi.malKabul(ctx, {
    stokKalemiId: CORBA, miktar: 40, birim: 'kg', birimMaliyet: 20,
    yeniLot: { kod: 'MML-YAKIN', sonKullanma: '2026-10-01' },
  }, 'g1')
  await depoServisi.malKabul(ctx, {
    stokKalemiId: CORBA, miktar: 40, birim: 'kg', birimMaliyet: 25,
    yeniLot: { kod: 'MML-UZAK', sonKullanma: '2027-01-01' },
  }, 'g2')
}

const sevkiyatAc = (miktar = 30, yama: Partial<YeniSevkiyat> = {}) => servis.ekle(ctx, {
  sevkiyatNo: 'SVK-2026-0001',
  musteriAd: 'Otel Marmara',
  musteriTelefon: '0212 000 00 00',
  satirlar: [{ stokKalemiId: CORBA, miktar, birim: 'kg' }],
  ...yama,
})

const bakiyeHaritasi = async () =>
  new Map((await depoServisi.kalemler(ctx)).map(k => [k.id, k.miktar]))

const sevkEt = async (s: Sevkiyat) =>
  servis.sevkEt(ctx, s, await bakiyeHaritasi(), KALEMLER)

const bakiye = async () =>
  (await depoServisi.kalemler(ctx)).find(k => k.id === CORBA)?.miktar

// ═══════════════════════════════════════════════════════════════════════════
describe('KRİTER: sevk edilen lot kaydediliyor', () => {
  it('çıkış FEFO ile en yakın SKT’li partiden yazılıyor', async () => {
    await depoyuDoldur()
    await sevkEt(await sevkiyatAc(30))

    const lotlar = await depoServisi.lotBakiyeleri(ctx, CORBA)
    expect(lotlar.find(l => l.kod === 'MML-YAKIN')!.miktar).toBe(10)
    expect(lotlar.find(l => l.kod === 'MML-UZAK')!.miktar).toBe(40)
  })

  it('hangi partiden gittiği DEFTERDE yazılı', async () => {
    await depoyuDoldur()
    const sevkiyat = await sevkEt(await sevkiyatAc(30))

    const hareketler = await servis.hareketleri(ctx, sevkiyat)
    expect(hareketler).toHaveLength(1)
    expect(hareketler[0].reason).toBe('SHIPMENT_OUT')
    expect(hareketler[0].lotId).toBeDefined()
    expect(hareketler[0].sourceId).toBe(sevkiyat.id)
  })

  it('FEFO çıkışı BÖLDÜĞÜNDE her iki parti de deftere yazılıyor', async () => {
    // Belgede tek satır var ama defterde iki hareket olacak. Lot bilgisini
    // belgede tutsaydık, ikinci parti kayıtsız kalırdı ve geri çağırma
    // listesi eksik çıkardı.
    await depoyuDoldur()
    const sevkiyat = await sevkEt(await sevkiyatAc(55))

    const hareketler = await servis.hareketleri(ctx, sevkiyat)
    expect(hareketler).toHaveLength(2)
    expect(new Set(hareketler.map(h => h.lotId)).size).toBe(2)
    expect(hareketler.reduce((t, h) => t + h.quantityBase, 0)).toBe(-55)
  })

  it('sevkiyat notunda müşteri adı geçiyor — defterden okunabilir', async () => {
    await depoyuDoldur()
    const sevkiyat = await sevkEt(await sevkiyatAc(10))
    const hareketler = await servis.hareketleri(ctx, sevkiyat)

    expect(hareketler[0].note).toMatch(/Otel Marmara/)
  })

  it('bakiye sevk edilen kadar düşüyor', async () => {
    await depoyuDoldur()
    await sevkEt(await sevkiyatAc(30))
    expect(await bakiye()).toBe(50)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('sevk kapısı', () => {
  it('depoda yoksa sevk edilemiyor ve defter kıpırdamıyor', async () => {
    const sevkiyat = await sevkiyatAc(30)
    await expect(sevkEt(sevkiyat)).rejects.toThrow(YetersizStokIleSevkEdilemezError)
    expect(await bakiye()).toBe(0)
  })

  it('eksik miktar hata mesajında yazıyor', async () => {
    await depoServisi.malKabul(ctx, {
      stokKalemiId: CORBA, miktar: 10, birim: 'kg',
      yeniLot: { kod: 'L1', sonKullanma: '2027-01-01' },
    }, 'g1')
    await expect(sevkEt(await sevkiyatAc(30))).rejects.toThrow(/20 kg eksik/)
  })

  it('aynı sevkiyat iki kez gönderilemiyor', async () => {
    await depoyuDoldur()
    const sevkiyat = await sevkEt(await sevkiyatAc(30))

    await expect(sevkEt(sevkiyat)).rejects.toThrow(GecersizSevkiyatGecisiError)
    expect(await bakiye()).toBe(50)
  })

  it('müşterisiz sevkiyat açılamıyor', async () => {
    // Geri çağırmada "kimi arayacağız" sorusunun cevabı budur.
    await expect(sevkiyatAc(10, { musteriAd: '   ' })).rejects.toThrow(/Müşteri adı/)
  })

  it('boş sevkiyat açılamıyor', async () => {
    await expect(servis.ekle(ctx, {
      sevkiyatNo: 'SVK-1', musteriAd: 'X', satirlar: [],
    })).rejects.toThrow(/en az bir kalem/)
  })

  it('sevk edilmiş belge düzenlenemiyor', async () => {
    await depoyuDoldur()
    const sevkiyat = await sevkEt(await sevkiyatAc(10))

    await expect(servis.guncelle(ctx, sevkiyat, {
      sevkiyatNo: 'SVK-2026-0001', musteriAd: 'Başka Müşteri',
      satirlar: [{ stokKalemiId: CORBA, miktar: 5, birim: 'kg' }],
    })).rejects.toThrow(/hazırlanmakta/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('iptal — ters kayıtla', () => {
  it('sevk edilmiş sevkiyat iptal edilince bakiye geri geliyor', async () => {
    await depoyuDoldur()
    const sevkiyat = await sevkEt(await sevkiyatAc(30))
    expect(await bakiye()).toBe(50)

    const iptal = await servis.iptalEt(ctx, sevkiyat)

    expect(iptal.durum).toBe('CANCELLED')
    expect(await bakiye()).toBe(80)
  })

  it('çıkış hareketi SİLİNMİYOR, tersi yazılıyor', async () => {
    await depoyuDoldur()
    const sevkiyat = await sevkEt(await sevkiyatAc(30))
    await servis.iptalEt(ctx, sevkiyat)

    const defter = await depoServisi.hareketler(ctx, CORBA)
    expect(defter.filter(h => h.reason === 'SHIPMENT_OUT')).toHaveLength(1)
    expect(defter.filter(h => h.reason === 'REVERSAL')).toHaveLength(1)
  })

  it('taslak sevkiyat iptal edilince defter hiç değişmiyor', async () => {
    await depoyuDoldur()
    const sevkiyat = await sevkiyatAc(30)
    await servis.iptalEt(ctx, sevkiyat)

    expect(await bakiye()).toBe(80)
    expect(await depoServisi.hareketler(ctx, CORBA)).toHaveLength(2)
  })

  it('iptal edilmiş sevkiyattan çıkış yok', async () => {
    const iptal = await servis.iptalEt(ctx, await sevkiyatAc(10))
    await expect(sevkEt(iptal)).rejects.toThrow(GecersizSevkiyatGecisiError)
    expect(SEVKIYAT_GECISLERI.CANCELLED).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('belge numarası', () => {
  it('sırayla artıyor ve yıllar karışmıyor', () => {
    expect(sonrakiSevkiyatNo([], 2026)).toBe('SVK-2026-0001')
    expect(sonrakiSevkiyatNo(['SVK-2026-0003'], 2026)).toBe('SVK-2026-0004')
    expect(sonrakiSevkiyatNo(['SVK-2025-0099'], 2026)).toBe('SVK-2026-0001')
  })
})
