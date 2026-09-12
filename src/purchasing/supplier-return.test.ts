// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Tedarikçiye iade testleri
//
// Yol haritası maddesi: "Kısmi kabul, ret ve iade"
//
// Kriterin sınanabilir hâli: üç kavramın DEFTERDEKİ izinin farklı olduğunu
// göstermek.
//   • Kısmi kabul → kabul edilen kadar GİRİŞ hareketi
//   • Ret         → HİÇ hareket yok (mal depoya girmedi)
//   • İade        → ÇIKIŞ hareketi (mal girmişti, çıkıyor)
//
// Defter sahte değil: gerçek `LocalStorageStockRepository` ve gerçek
// `DepoServisi` kullanılıyor. Sahte olan yalnızca katalog ve belge depoları.
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
import type { Kabul, KabulSatiri, MalKabulDeposu, YeniKabul } from './goods-receipt.repository'
import { MalKabulServisi } from './goods-receipt.service'
import {
  IadeDogrulamaError,
  TedarikciIadeServisi,
  kabulIadeDurumu,
  type Iade,
  type IadeSatiri,
  type TedarikciIadeDeposu,
  type YeniIade,
} from './supplier-return'

const ctx: TenantCtx = { tenantId: 'tenant-1', branchId: 'branch-1', userId: 'user-1' }
const UN = 'kalem-un'

class SahteKatalog implements StokKatalogu {
  kalemListesi: KatalogKalemi[] = []
  lotListesi: KatalogLotu[] = []
  private sayac = 0
  async kalemler(): Promise<KatalogKalemi[]> { return [...this.kalemListesi] }
  async kalemEkle(_c: TenantCtx, g: YeniKalem): Promise<KatalogKalemi> {
    const k: KatalogKalemi = {
      id: `kalem-${++this.sayac}`, kod: g.kod, ad: g.ad, temelBirim: g.temelBirim,
      lotTakipli: g.lotTakipli, sktTakipli: g.sktTakipli, minMiktar: 0, aktif: true,
    }
    this.kalemListesi.push(k)
    return k
  }
  async lotlar(_c: TenantCtx, id: string): Promise<KatalogLotu[]> {
    return this.lotListesi.filter(l => l.stokKalemiId === id)
  }
  async lotEkle(_c: TenantCtx, g: YeniLot): Promise<KatalogLotu> {
    const l: KatalogLotu = {
      id: `lot-${++this.sayac}`, stokKalemiId: g.stokKalemiId, kod: g.kod,
      sonKullanma: g.sonKullanma, tedarikci: g.tedarikci, kaynakTipi: 'RECEIPT',
    }
    this.lotListesi.push(l)
    return l
  }
  async birimler(): Promise<Birim[]> { return [{ kod: 'kg', ad: 'Kilogram', boyut: 'MASS' }] }
}

class BellekKabulDeposu implements MalKabulDeposu {
  kayitlar: Kabul[] = []
  private sayac = 0
  async hepsi(): Promise<Kabul[]> { return this.kayitlar.map(k => ({ ...k, satirlar: [...k.satirlar] })) }
  async tekil(_c: TenantCtx, id: string): Promise<Kabul> {
    const k = this.kayitlar.find(x => x.id === id)
    if(!k) throw new Error('yok')
    return { ...k, satirlar: k.satirlar.map(s => ({ ...s })) }
  }
  async taslakAc(c: TenantCtx, g: YeniKabul): Promise<Kabul> {
    const kabul: Kabul = {
      id: `kbl-${++this.sayac}`, kabulNo: g.kabulNo, durum: 'DRAFT',
      tedarikciId: g.tedarikciId, tedarikciAd: 'Un Tedarik',
      kabulTarihi: '2026-09-03', olusturmaTarihi: new Date().toISOString(),
      satirlar: g.satirlar.map((s, i): KabulSatiri => ({ ...s, id: `ksat-${++this.sayac}`, siraNo: i + 1 })),
    }
    this.kayitlar.push(kabul)
    return this.tekil(c, kabul.id)
  }
  async satiraHareketBagla(_c: TenantCtx, satirId: string, hareketId: string): Promise<void> {
    this.kayitlar = this.kayitlar.map(k => ({
      ...k, satirlar: k.satirlar.map(s => (s.id === satirId ? { ...s, hareketId } : s)),
    }))
  }
  async islendiIsaretle(c: TenantCtx, id: string): Promise<Kabul> {
    this.kayitlar = this.kayitlar.map(k => (k.id === id ? { ...k, durum: 'POSTED' as const } : k))
    return this.tekil(c, id)
  }
}

class BellekIadeDeposu implements TedarikciIadeDeposu {
  kayitlar: Iade[] = []
  private sayac = 0
  async hepsi(): Promise<Iade[]> { return this.kayitlar.map(i => ({ ...i, satirlar: [...i.satirlar] })) }
  async tekil(_c: TenantCtx, id: string): Promise<Iade> {
    const i = this.kayitlar.find(x => x.id === id)
    if(!i) throw new Error('yok')
    return { ...i, satirlar: i.satirlar.map(s => ({ ...s })) }
  }
  async taslakAc(c: TenantCtx, g: YeniIade): Promise<Iade> {
    const iade: Iade = {
      id: `iade-${++this.sayac}`, iadeNo: g.iadeNo, durum: 'DRAFT',
      kabulId: g.kabulId, kabulNo: 'MK-2026-0001', tedarikciId: g.tedarikciId,
      iadeTarihi: g.iadeTarihi ?? '2026-09-04', neden: g.neden, not: g.not,
      olusturmaTarihi: new Date().toISOString(),
      satirlar: g.satirlar.map((s, i): IadeSatiri => ({ ...s, id: `isat-${++this.sayac}`, siraNo: i + 1 })),
    }
    this.kayitlar.push(iade)
    return this.tekil(c, iade.id)
  }
  async satiraHareketBagla(_c: TenantCtx, satirId: string, hareketId: string): Promise<void> {
    this.kayitlar = this.kayitlar.map(i => ({
      ...i, satirlar: i.satirlar.map(s => (s.id === satirId ? { ...s, hareketId } : s)),
    }))
  }
  async islendiIsaretle(c: TenantCtx, id: string): Promise<Iade> {
    this.kayitlar = this.kayitlar.map(i => (i.id === id ? { ...i, durum: 'POSTED' as const } : i))
    return this.tekil(c, id)
  }
}

let katalog: SahteKatalog
let depoServisi: DepoServisi
let kabulDeposu: BellekKabulDeposu
let kabulServisi: MalKabulServisi
let iadeDeposu: BellekIadeDeposu
let iadeServisi: TedarikciIadeServisi

beforeEach(() => {
  localStorage.clear()
  katalog = new SahteKatalog()
  katalog.kalemListesi = [
    { id: UN, kod: 'UN-01', ad: 'Un', temelBirim: 'kg', lotTakipli: false, sktTakipli: false, minMiktar: 0, aktif: true },
  ]
  depoServisi = new DepoServisi(
    new LocalStorageStockRepository(
      new InMemoryStockItemLookup([{ id: UN, baseUom: 'kg', tracksLot: false }]),
      new FixedTenantPolicyLookup('block'),
    ),
    katalog,
  )
  kabulDeposu = new BellekKabulDeposu()
  kabulServisi = new MalKabulServisi(kabulDeposu, depoServisi)
  iadeDeposu = new BellekIadeDeposu()
  iadeServisi = new TedarikciIadeServisi(iadeDeposu, depoServisi)
})

const miktar = async () => (await depoServisi.kalemler(ctx)).find(k => k.id === UN)?.miktar
const hareketler = () => depoServisi.hareketler(ctx, UN)

/** Sipariş 200, gelen 180, 20'si kapıda reddedildi. */
const kismiKabul = () => kabulServisi.kabulEt(ctx, {
  kabulNo: 'MK-2026-0001', tedarikciId: 'ted-1',
  satirlar: [{
    stokKalemiId: UN, kabulMiktari: 180, redMiktari: 20, birim: 'kg', birimFiyat: 12,
    redNedeni: 'Çuval yırtık',
  }],
}, () => false, () => false)

describe('KRİTER: kısmi kabul, ret ve iade defterde AYRI izler bırakıyor', () => {
  it('kısmi kabul → yalnızca kabul edilen miktar giriş olarak yazılıyor', async () => {
    await kismiKabul()

    expect(await miktar()).toBe(180)
    const h = await hareketler()
    expect(h).toHaveLength(1)
    expect(h[0].reason).toBe('PURCHASE_RECEIPT')
    expect(h[0].quantityBase).toBe(180)
  })

  it('ret → deftere HİÇ hareket yazılmıyor; iz belgede kalıyor', async () => {
    const kabul = await kismiKabul()

    // Reddedilen 20 için hareket YOK: mal depoya hiç girmedi.
    expect((await hareketler())).toHaveLength(1)
    // Ama kaybolmadı da: belgede miktarı ve gerekçesi duruyor.
    expect(kabul.satirlar[0].redMiktari).toBe(20)
    expect(kabul.satirlar[0].redNedeni).toBe('Çuval yırtık')
  })

  it('iade → ÇIKIŞ hareketi yazılıyor ve bakiye düşüyor', async () => {
    const kabul = await kismiKabul()

    await iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-2026-0001', kabulId: kabul.id, tedarikciId: 'ted-1',
      neden: 'Depoda açınca içinden böcek çıktı',
      satirlar: [{ kabulSatirId: kabul.satirlar[0].id, stokKalemiId: UN, miktar: 30, birim: 'kg' }],
    }, kabul, [])

    expect(await miktar()).toBe(150)

    const h = await hareketler()
    expect(h).toHaveLength(2)
    const iadeHareketi = h.find(x => x.reason === 'PURCHASE_RETURN')
    expect(iadeHareketi).toBeTruthy()
    // Çıkış: defterde eksi.
    expect(iadeHareketi!.quantityBase).toBe(-30)
  })

  it('iade satırı deftere düşen hareketle eşleniyor', async () => {
    const kabul = await kismiKabul()
    const iade = await iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-1', kabulId: kabul.id, tedarikciId: 'ted-1', neden: 'Bozuk',
      satirlar: [{ kabulSatirId: kabul.satirlar[0].id, stokKalemiId: UN, miktar: 10, birim: 'kg' }],
    }, kabul, [])

    expect(iade.durum).toBe('POSTED')
    expect(iade.satirlar[0].hareketId).toBeTruthy()
  })
})

describe('İade · kurallar', () => {
  it('kabul edilenden fazlası iade edilemiyor', async () => {
    const kabul = await kismiKabul()

    // Kabul 180. 200 iade etmek, olmayan malı geri göndermektir.
    await expect(iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-1', kabulId: kabul.id, tedarikciId: 'ted-1', neden: 'Bozuk',
      satirlar: [{ kabulSatirId: kabul.satirlar[0].id, stokKalemiId: UN, miktar: 200, birim: 'kg' }],
    }, kabul, [])).rejects.toThrow(/kabul edilenden fazla/)

    expect(await miktar()).toBe(180)
  })

  it('iki iade birlikte kabul miktarını aşamıyor', async () => {
    const kabul = await kismiKabul()

    const ilk = await iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-1', kabulId: kabul.id, tedarikciId: 'ted-1', neden: 'Bozuk',
      satirlar: [{ kabulSatirId: kabul.satirlar[0].id, stokKalemiId: UN, miktar: 100, birim: 'kg' }],
    }, kabul, [])

    await expect(iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-2', kabulId: kabul.id, tedarikciId: 'ted-1', neden: 'Bozuk',
      satirlar: [{ kabulSatirId: kabul.satirlar[0].id, stokKalemiId: UN, miktar: 90, birim: 'kg' }],
    }, kabul, [ilk])).rejects.toThrow(/iade edilebilir 80/)
  })

  it('gerekçesiz iade yapılamıyor', async () => {
    const kabul = await kismiKabul()
    await expect(iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-1', kabulId: kabul.id, tedarikciId: 'ted-1', neden: '   ',
      satirlar: [{ kabulSatirId: kabul.satirlar[0].id, stokKalemiId: UN, miktar: 10, birim: 'kg' }],
    }, kabul, [])).rejects.toThrow(IadeDogrulamaError)
  })

  it('başka bir kabulün satırı iade edilemiyor', async () => {
    const kabul = await kismiKabul()
    await expect(iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-1', kabulId: kabul.id, tedarikciId: 'ted-1', neden: 'Bozuk',
      satirlar: [{ kabulSatirId: 'baska-satir', stokKalemiId: UN, miktar: 10, birim: 'kg' }],
    }, kabul, [])).rejects.toThrow(/bu kabul belgesine ait değil/)
  })

  it('doğrulama düşerse deftere hiçbir şey yazılmıyor', async () => {
    const kabul = await kismiKabul()
    await expect(iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-1', kabulId: kabul.id, tedarikciId: 'ted-1', neden: 'Bozuk',
      satirlar: [
        { kabulSatirId: kabul.satirlar[0].id, stokKalemiId: UN, miktar: 10, birim: 'kg' },
        { kabulSatirId: kabul.satirlar[0].id, stokKalemiId: UN, miktar: 999, birim: 'kg' },
      ],
    }, kabul, [])).rejects.toThrow(IadeDogrulamaError)

    expect(await miktar()).toBe(180)
    expect(iadeDeposu.kayitlar).toHaveLength(0)
  })

  it('tekrar deneme güvenli: aynı iade iki kez işlenirse stok iki kez düşmüyor', async () => {
    const kabul = await kismiKabul()
    const iade = await iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-1', kabulId: kabul.id, tedarikciId: 'ted-1', neden: 'Bozuk',
      satirlar: [{ kabulSatirId: kabul.satirlar[0].id, stokKalemiId: UN, miktar: 30, birim: 'kg' }],
    }, kabul, [])

    expect(await miktar()).toBe(150)

    iadeDeposu.kayitlar = iadeDeposu.kayitlar.map(i => ({ ...i, durum: 'DRAFT' as const }))
    await iadeServisi.tekrarDene(ctx, await iadeDeposu.tekil(ctx, iade.id))

    expect(await miktar()).toBe(150)
  })
})

describe('İade · kabul satırının iade durumu', () => {
  it('iade edilen ve kalan miktar belgelerden toplanıyor', async () => {
    const kabul = await kismiKabul()
    const ilk = await iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-1', kabulId: kabul.id, tedarikciId: 'ted-1', neden: 'Bozuk',
      satirlar: [{ kabulSatirId: kabul.satirlar[0].id, stokKalemiId: UN, miktar: 50, birim: 'kg' }],
    }, kabul, [])

    const durumlar = kabulIadeDurumu(kabul, [ilk])
    expect(durumlar[0].iadeEdilen).toBe(50)
    expect(durumlar[0].kalan).toBe(130)
  })

  it('iptal edilmiş iade sayıma girmiyor', async () => {
    const kabul = await kismiKabul()
    const iade = await iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-1', kabulId: kabul.id, tedarikciId: 'ted-1', neden: 'Bozuk',
      satirlar: [{ kabulSatirId: kabul.satirlar[0].id, stokKalemiId: UN, miktar: 50, birim: 'kg' }],
    }, kabul, [])

    const iptal = { ...iade, durum: 'CANCELLED' as const }
    expect(kabulIadeDurumu(kabul, [iptal])[0].iadeEdilen).toBe(0)
  })
})
