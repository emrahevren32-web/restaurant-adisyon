// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Mal kabul testleri
//
// Yol haritası maddesi: "Mal kabul → stok girişi"
//          Bitti sayılır ki: "Kabul yapılınca stok kartı ve lot kendiliğinden
//                             oluşuyor"
//
// ── DEFTER SAHTE DEĞİL ───────────────────────────────────────────────────
// Burada gerçek `LocalStorageStockRepository` ve gerçek `DepoServisi`
// kullanılıyor. Sebebi kriterin kendisi: "kabul yapılınca stok oluşuyor mu"
// sorusunun cevabı ancak GERÇEK bir defterle alınabilir. Sahte bir defterle
// yalnızca "servis doğru metodu çağırdı mı" sınanmış olurdu.
//
// O defter uygulaması `stock.contract.suite.ts` içindeki sözleşme testlerinden
// geçiyor ve aynı gövde canlı Postgres'e karşı da yeşil. Yani buradaki
// bakiyeler, üretimde de aynı kuralları uygulayan bir defterden geliyor.
//
// Sahte olan iki şey var: stok KATALOĞU (Postgres okuma yüzeyi) ve mal kabul
// BELGE deposu. İkisinin de davranışı yok, veri tutuyorlar.
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
import type {
  Kabul, KabulSatiri, MalKabulDeposu, YeniKabul,
} from './goods-receipt.repository'
import {
  MalKabulDogrulamaError,
  MalKabulServisi,
  kabulSatiriOner,
  siparisDurumu,
  siparisTeslimDurumu,
} from './goods-receipt.service'
import type { Siparis } from './purchase.types'

const ctx: TenantCtx = { tenantId: 'tenant-1', branchId: 'branch-1', userId: 'user-1' }

const UN = 'kalem-un'          // lot yok, SKT yok
const TAVUK = 'kalem-tavuk'    // lot + SKT
const BAHARAT = 'kalem-baharat' // temel birim GRAM — birim çevrimi için

class SahteKatalog implements StokKatalogu {
  kalemListesi: KatalogKalemi[] = []
  lotListesi: KatalogLotu[] = []
  private sayac = 0

  async kalemler(): Promise<KatalogKalemi[]> { return [...this.kalemListesi] }
  async kalemEkle(_c: TenantCtx, g: YeniKalem): Promise<KatalogKalemi> {
    const kalem: KatalogKalemi = {
      id: `kalem-${++this.sayac}`, kod: g.kod, ad: g.ad, temelBirim: g.temelBirim,
      lotTakipli: g.lotTakipli, sktTakipli: g.sktTakipli, minMiktar: g.minMiktar ?? 0, aktif: true,
    }
    this.kalemListesi.push(kalem)
    return kalem
  }
  async lotlar(_c: TenantCtx, id: string): Promise<KatalogLotu[]> {
    return this.lotListesi.filter(l => l.stokKalemiId === id)
  }
  async lotEkle(_c: TenantCtx, g: YeniLot): Promise<KatalogLotu> {
    const lot: KatalogLotu = {
      id: `lot-${++this.sayac}`, stokKalemiId: g.stokKalemiId, kod: g.kod,
      sonKullanma: g.sonKullanma, tedarikci: g.tedarikci, kaynakTipi: g.kaynakTipi ?? 'RECEIPT',
    }
    this.lotListesi.push(lot)
    return lot
  }
  async birimler(): Promise<Birim[]> {
    return [
      { kod: 'kg', ad: 'Kilogram', boyut: 'MASS' },
      { kod: 'g', ad: 'Gram', boyut: 'MASS' },
    ]
  }
}

/** Belge deposu — davranışı yok, veri tutuyor. */
class BellekKabulDeposu implements MalKabulDeposu {
  kayitlar: Kabul[] = []
  private sayac = 0

  async hepsi(): Promise<Kabul[]> { return this.kayitlar.map(k => ({ ...k, satirlar: [...k.satirlar] })) }

  async tekil(_c: TenantCtx, id: string): Promise<Kabul> {
    const kabul = this.kayitlar.find(k => k.id === id)
    if(!kabul) throw new Error(`Kabul bulunamadı: ${id}`)
    return { ...kabul, satirlar: kabul.satirlar.map(s => ({ ...s })) }
  }

  async taslakAc(_c: TenantCtx, girdi: YeniKabul): Promise<Kabul> {
    if(this.kayitlar.some(k => k.kabulNo === girdi.kabulNo)){
      throw new Error(`"${girdi.kabulNo}" kabul numarası zaten kullanılıyor.`)
    }
    const kabul: Kabul = {
      id: `kbl-${++this.sayac}`,
      kabulNo: girdi.kabulNo,
      durum: 'DRAFT',
      siparisId: girdi.siparisId,
      tedarikciId: girdi.tedarikciId,
      tedarikciAd: 'Et Tedarik',
      kabulTarihi: girdi.kabulTarihi ?? '2026-09-03',
      irsaliyeNo: girdi.irsaliyeNo,
      not: girdi.not,
      olusturmaTarihi: new Date().toISOString(),
      satirlar: girdi.satirlar.map((s, i): KabulSatiri => ({
        ...s, id: `ksat-${++this.sayac}`, siraNo: i + 1,
      })),
    }
    this.kayitlar.push(kabul)
    return this.tekil(_c, kabul.id)
  }

  async satiraHareketBagla(_c: TenantCtx, satirId: string, hareketId: string): Promise<void> {
    this.kayitlar = this.kayitlar.map(k => ({
      ...k,
      satirlar: k.satirlar.map(s => (s.id === satirId ? { ...s, hareketId } : s)),
    }))
  }

  async islendiIsaretle(c: TenantCtx, id: string): Promise<Kabul> {
    this.kayitlar = this.kayitlar.map(k => (
      k.id === id ? { ...k, durum: 'POSTED' as const, islenmeZamani: new Date().toISOString() } : k
    ))
    return this.tekil(c, id)
  }
}

let katalog: SahteKatalog
let depoServisi: DepoServisi
let kabulDeposu: BellekKabulDeposu
let servis: MalKabulServisi

const lotGerekli = (id: string) => katalog.kalemListesi.find(k => k.id === id)?.lotTakipli ?? false
const sktGerekli = (id: string) => katalog.kalemListesi.find(k => k.id === id)?.sktTakipli ?? false

beforeEach(() => {
  localStorage.clear()
  katalog = new SahteKatalog()
  katalog.kalemListesi = [
    { id: UN, kod: 'UN-01', ad: 'Un', temelBirim: 'kg', lotTakipli: false, sktTakipli: false, minMiktar: 0, aktif: true },
    { id: TAVUK, kod: 'TVK-01', ad: 'Tavuk', temelBirim: 'kg', lotTakipli: true, sktTakipli: true, minMiktar: 0, aktif: true },
    { id: BAHARAT, kod: 'BHR-01', ad: 'Baharat', temelBirim: 'g', lotTakipli: false, sktTakipli: false, minMiktar: 0, aktif: true },
  ]

  depoServisi = new DepoServisi(
    new LocalStorageStockRepository(
      new InMemoryStockItemLookup([
        { id: UN, baseUom: 'kg', tracksLot: false },
        { id: TAVUK, baseUom: 'kg', tracksLot: true },
        { id: BAHARAT, baseUom: 'g', tracksLot: false },
      ]),
      new FixedTenantPolicyLookup('block'),
    ),
    katalog,
  )

  kabulDeposu = new BellekKabulDeposu()
  servis = new MalKabulServisi(kabulDeposu, depoServisi)
})

const miktar = async (kalemId: string) =>
  (await depoServisi.kalemler(ctx)).find(k => k.id === kalemId)?.miktar

const kabulEt = (girdi: YeniKabul) => servis.kabulEt(ctx, girdi, lotGerekli, sktGerekli)

describe('Mal kabul · KRİTER: kabul yapılınca stok ve lot oluşuyor', () => {
  it('kabul edilen miktar deftere düşüyor ve bakiye oradan türetiliyor', async () => {
    expect(await miktar(UN)).toBe(0)

    const kabul = await kabulEt({
      kabulNo: 'MK-2026-0001',
      tedarikciId: 'ted-1',
      irsaliyeNo: 'IRS-889',
      satirlar: [
        { stokKalemiId: UN, kabulMiktari: 250, redMiktari: 0, birim: 'kg', birimFiyat: 12 },
      ],
    })

    expect(kabul.durum).toBe('POSTED')
    expect(await miktar(UN)).toBe(250)

    // Kabul satırı ile defterdeki hareket birbirine bağlı: "bu kabul gerçekten
    // deftere işlendi mi" sorusunun cevabı.
    const hareketler = await depoServisi.hareketler(ctx, UN)
    expect(hareketler).toHaveLength(1)
    expect(kabul.satirlar[0].hareketId).toBe(hareketler[0].id)
    expect(hareketler[0].reason).toBe('PURCHASE_RECEIPT')
  })

  it('lot izleyen kalemde lot KENDİLİĞİNDEN oluşuyor, SKT lota taşınıyor', async () => {
    await kabulEt({
      kabulNo: 'MK-2026-0002',
      tedarikciId: 'ted-1',
      satirlar: [{
        stokKalemiId: TAVUK, kabulMiktari: 40, redMiktari: 0, birim: 'kg', birimFiyat: 180,
        lotKodu: 'TVK-2609-A', sonKullanma: '2026-09-20',
      }],
    })

    const lotlar = await depoServisi.lotBakiyeleri(ctx, TAVUK)
    expect(lotlar).toHaveLength(1)
    expect(lotlar[0].kod).toBe('TVK-2609-A')
    expect(lotlar[0].sonKullanma).toBe('2026-09-20')
    expect(lotlar[0].miktar).toBe(40)
    // Lotun kimden geldiği de kayıtlı: geri çağırma bu bağa dayanıyor.
    expect(lotlar[0].tedarikci).toBe('Et Tedarik')
  })

  it('birim çevrimi yapılıyor: 2 kg baharat deftere 2000 g olarak düşüyor', async () => {
    await kabulEt({
      kabulNo: 'MK-2026-0003',
      tedarikciId: 'ted-1',
      satirlar: [{ stokKalemiId: BAHARAT, kabulMiktari: 2, redMiktari: 0, birim: 'kg', birimFiyat: 400 }],
    })

    expect(await miktar(BAHARAT)).toBe(2000)
  })

  it('reddedilen miktar deftere HİÇ yazılmıyor — depoya girmemiş mal stok değildir', async () => {
    await kabulEt({
      kabulNo: 'MK-2026-0004',
      tedarikciId: 'ted-1',
      satirlar: [{
        stokKalemiId: UN, kabulMiktari: 80, redMiktari: 20, birim: 'kg', birimFiyat: 12,
        redNedeni: 'Çuval yırtık, nem almış',
      }],
    })

    expect(await miktar(UN)).toBe(80)
    const hareketler = await depoServisi.hareketler(ctx, UN)
    expect(hareketler).toHaveLength(1)
    expect(hareketler[0].quantityBase).toBe(80)
  })

  it('tamamı reddedilen kalem için hiç hareket yazılmıyor', async () => {
    const kabul = await kabulEt({
      kabulNo: 'MK-2026-0005',
      tedarikciId: 'ted-1',
      satirlar: [{
        stokKalemiId: UN, kabulMiktari: 0, redMiktari: 50, birim: 'kg', birimFiyat: 12,
        redNedeni: 'Sıcaklık zinciri kırılmış',
      }],
    })

    expect(await miktar(UN)).toBe(0)
    expect(kabul.satirlar[0].hareketId).toBeUndefined()
    // Belge yine de kapanır: ret de bir sonuçtur, kayıt altına alınmalıdır.
    expect(kabul.durum).toBe('POSTED')
  })
})

describe('Mal kabul · tekrar deneme güvenli', () => {
  it('aynı kabul ikinci kez işlenirse stok İKİ KATINA ÇIKMIYOR', async () => {
    const kabul = await kabulEt({
      kabulNo: 'MK-2026-0006',
      tedarikciId: 'ted-1',
      satirlar: [{ stokKalemiId: UN, kabulMiktari: 100, redMiktari: 0, birim: 'kg', birimFiyat: 12 }],
    })

    expect(await miktar(UN)).toBe(100)

    // Belgeyi elle taslağa çevirip tekrar deniyoruz: gerçek hayatta bu, ilk
    // denemede ağ koptuğunda olan şeydir.
    kabulDeposu.kayitlar = kabulDeposu.kayitlar.map(k => ({ ...k, durum: 'DRAFT' as const }))
    const tekrar = await servis.tekrarDene(ctx, await kabulDeposu.tekil(ctx, kabul.id))

    // Satırın hareketi zaten var: atlandı.
    expect(await miktar(UN)).toBe(100)
    expect(tekrar.durum).toBe('POSTED')
    expect((await depoServisi.hareketler(ctx, UN))).toHaveLength(1)
  })

  it('işlenmiş bir kabul tekrar denenemiyor', async () => {
    const kabul = await kabulEt({
      kabulNo: 'MK-2026-0007',
      tedarikciId: 'ted-1',
      satirlar: [{ stokKalemiId: UN, kabulMiktari: 10, redMiktari: 0, birim: 'kg', birimFiyat: 12 }],
    })

    await expect(servis.tekrarDene(ctx, kabul)).rejects.toThrow(MalKabulDogrulamaError)
  })
})

describe('Mal kabul · doğrulama', () => {
  const temel = { kabulNo: 'MK-X', tedarikciId: 'ted-1' }

  it('lot izleyen kalem lot numarasız kabul edilemiyor', async () => {
    await expect(kabulEt({
      ...temel,
      satirlar: [{ stokKalemiId: TAVUK, kabulMiktari: 5, redMiktari: 0, birim: 'kg', birimFiyat: 1, sonKullanma: '2026-12-01' }],
    })).rejects.toThrow(/lot izliyor/)
  })

  it('SKT izleyen kalem son kullanma tarihi olmadan kabul edilemiyor', async () => {
    await expect(kabulEt({
      ...temel,
      satirlar: [{ stokKalemiId: TAVUK, kabulMiktari: 5, redMiktari: 0, birim: 'kg', birimFiyat: 1, lotKodu: 'L-1' }],
    })).rejects.toThrow(/SKT izliyor/)
  })

  it('gerekçesiz ret kabul edilmiyor', async () => {
    await expect(kabulEt({
      ...temel,
      satirlar: [{ stokKalemiId: UN, kabulMiktari: 0, redMiktari: 5, birim: 'kg', birimFiyat: 1 }],
    })).rejects.toThrow(/gerekçe/)
  })

  it('ne kabul ne ret içeren satır reddediliyor', async () => {
    await expect(kabulEt({
      ...temel,
      satirlar: [{ stokKalemiId: UN, kabulMiktari: 0, redMiktari: 0, birim: 'kg', birimFiyat: 1 }],
    })).rejects.toThrow(MalKabulDogrulamaError)
  })

  it('kalemsiz kabul açılamıyor', async () => {
    await expect(kabulEt({ ...temel, satirlar: [] })).rejects.toThrow(MalKabulDogrulamaError)
  })

  it('doğrulama düşerse deftere HİÇBİR ŞEY yazılmıyor', async () => {
    await expect(kabulEt({
      ...temel,
      satirlar: [
        { stokKalemiId: UN, kabulMiktari: 100, redMiktari: 0, birim: 'kg', birimFiyat: 12 },
        // İkinci satır bozuk: lot izleyen kalemde lot yok.
        { stokKalemiId: TAVUK, kabulMiktari: 5, redMiktari: 0, birim: 'kg', birimFiyat: 1 },
      ],
    })).rejects.toThrow(MalKabulDogrulamaError)

    // Birinci satır da yazılmamış olmalı: doğrulama HEPSİNDEN önce koşuyor.
    expect(await miktar(UN)).toBe(0)
    expect(kabulDeposu.kayitlar).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Sipariş kapanışı
// ═══════════════════════════════════════════════════════════════════════════

const siparis = (satirlar: Array<{ id: string; kalem: string; miktar: number }>): Siparis => ({
  id: 'sip-1', siparisNo: 'SIP-2026-0001', durum: 'SENT',
  tedarikciId: 'ted-1', paraBirimi: 'TRY', olusturmaTarihi: '2026-09-01T00:00:00Z',
  satirlar: satirlar.map((s, i) => ({
    id: s.id, stokKalemiId: s.kalem, miktar: s.miktar, birim: 'kg', birimFiyat: 10, siraNo: i + 1,
  })),
})

const kabulKaydi = (satirlar: Array<{ siparisSatirId: string; kabul: number; red?: number }>): Kabul => ({
  id: 'kbl-x', kabulNo: 'MK-X', durum: 'POSTED', siparisId: 'sip-1',
  tedarikciId: 'ted-1', kabulTarihi: '2026-09-03', olusturmaTarihi: '2026-09-03T00:00:00Z',
  satirlar: satirlar.map((s, i) => ({
    id: `ks-${i}`, siparisSatirId: s.siparisSatirId, stokKalemiId: UN,
    kabulMiktari: s.kabul, redMiktari: s.red ?? 0, birim: 'kg', birimFiyat: 10, siraNo: i + 1,
  })),
})

describe('Mal kabul · siparişin kapanışı', () => {
  const sip = siparis([
    { id: 'ss-1', kalem: UN, miktar: 100 },
    { id: 'ss-2', kalem: TAVUK, miktar: 40 },
  ])

  it('hiç kabul yoksa sipariş durumu değişmiyor', () => {
    expect(siparisTeslimDurumu(siparisDurumu(sip, []))).toBeNull()
  })

  it('bir kısmı geldiyse KISMEN TESLİM', () => {
    const durumlar = siparisDurumu(sip, [kabulKaydi([{ siparisSatirId: 'ss-1', kabul: 60 }])])
    expect(durumlar[0].kabulEdilen).toBe(60)
    expect(durumlar[0].kalan).toBe(40)
    expect(siparisTeslimDurumu(durumlar)).toBe('PARTIAL')
  })

  it('hepsi geldiyse TESLİM ALINDI', () => {
    const durumlar = siparisDurumu(sip, [
      kabulKaydi([{ siparisSatirId: 'ss-1', kabul: 100 }, { siparisSatirId: 'ss-2', kabul: 40 }]),
    ])
    expect(siparisTeslimDurumu(durumlar)).toBe('RECEIVED')
  })

  it('iki ayrı sevkiyatla gelen mal toplanıyor', () => {
    const durumlar = siparisDurumu(sip, [
      kabulKaydi([{ siparisSatirId: 'ss-1', kabul: 60 }]),
      kabulKaydi([{ siparisSatirId: 'ss-1', kabul: 40 }, { siparisSatirId: 'ss-2', kabul: 40 }]),
    ])
    expect(durumlar[0].kabulEdilen).toBe(100)
    expect(siparisTeslimDurumu(durumlar)).toBe('RECEIVED')
  })

  it('reddedilen miktar siparişi kapatmıyor — mal hâlâ gelmedi', () => {
    const durumlar = siparisDurumu(sip, [
      kabulKaydi([{ siparisSatirId: 'ss-1', kabul: 70, red: 30 }, { siparisSatirId: 'ss-2', kabul: 40 }]),
    ])
    expect(durumlar[0].reddedilen).toBe(30)
    expect(durumlar[0].kalan).toBe(30)
    expect(siparisTeslimDurumu(durumlar)).toBe('PARTIAL')
  })

  it('iptal edilmiş kabul sayıma girmiyor', () => {
    const iptal = { ...kabulKaydi([{ siparisSatirId: 'ss-1', kabul: 100 }]), durum: 'CANCELLED' as const }
    expect(siparisDurumu(sip, [iptal])[0].kabulEdilen).toBe(0)
  })

  it('kabul satırı önerisi KALAN kadar geliyor, sipariş miktarı kadar değil', () => {
    const durumlar = siparisDurumu(sip, [kabulKaydi([{ siparisSatirId: 'ss-1', kabul: 60 }])])
    // Varsayılanın sipariş miktarı olması, fazladan kabule giden en kısa yol.
    expect(kabulSatiriOner(durumlar[0]).kabulMiktari).toBe(40)
  })
})
