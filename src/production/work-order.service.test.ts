// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 — Üretim iş emri testleri
//
// Yol haritası maddeleri ve kriterleri:
//   "Üretim iş emri açma"                         → Yetersiz stokla başlatılamıyor
//   "Hammadde tüketimi deftere yazıyor"           → FEFO ile en yakın SKT'li lot
//   "Mamul girişi + yeni lot oluşumu"             → Verim oranı hesaba katılıyor
//   "Üretim firesi ayrı hareket olarak yazılıyor" → Fire gizlenmiyor
//   "İptal edilen iş emri tüketimi geri alıyor"   → Ters kayıtla, silmeyle değil
//
// Stok kısmında sahte YOK: gerçek `LocalStorageStockRepository` ve gerçek
// `DepoServisi`. Sahte bir defter, tam da sınamak istediğimiz şeyi
// (FEFO, ters kayıt, negatif bakiye engeli) sahteleştirirdi.
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
  IS_EMRI_GECISLERI,
  type IsEmri,
  type IsEmriDeposu,
  type IsEmriDurumu,
  type YeniIsEmri,
} from './work-order.repository'
import {
  GecersizIsEmriGecisiError,
  IsEmriServisi,
  YetersizStokIleBaslatilamazError,
  receteyiIsEmrineDok,
  sonrakiIsEmriNo,
} from './work-order.service'

const ctx: TenantCtx = { tenantId: 'tenant-1', branchId: 'branch-1', userId: 'user-1' }

const CORBA = 'kalem-corba'        // mamul, lot + SKT takipli, temel birim kg
const MERCIMEK = 'kalem-mercimek'  // lot + SKT takipli, temel birim g
const SOGAN = 'kalem-sogan'        // lotsuz, temel birim kg

const KALEMLER: KatalogKalemi[] = [
  { id: CORBA, kod: 'MML-01', ad: 'Mercimek Çorbası', temelBirim: 'kg', lotTakipli: true, sktTakipli: true, minMiktar: 0, aktif: true },
  { id: MERCIMEK, kod: 'HAM-01', ad: 'Mercimek', temelBirim: 'g', lotTakipli: true, sktTakipli: true, minMiktar: 0, aktif: true },
  { id: SOGAN, kod: 'HAM-02', ad: 'Soğan', temelBirim: 'kg', lotTakipli: false, sktTakipli: false, minMiktar: 0, aktif: true },
]

class BellekKatalog implements StokKatalogu {
  kalemListesi: KatalogKalemi[] = [...KALEMLER]
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
      sonKullanma: g.sonKullanma, tedarikci: g.tedarikci,
      kaynakTipi: g.kaynakTipi ?? 'RECEIPT',
    }
    this.lotListesi.push(l)
    return l
  }
  async birimler(): Promise<Birim[]> {
    return [{ kod: 'kg', ad: 'Kilogram', boyut: 'MASS' }, { kod: 'g', ad: 'Gram', boyut: 'MASS' }]
  }
}

class BellekIsEmriDeposu implements IsEmriDeposu {
  kayitlar: IsEmri[] = []
  private sayac = 0
  async hepsi(): Promise<IsEmri[]> {
    return this.kayitlar.map(i => ({ ...i, satirlar: i.satirlar.map(s => ({ ...s })) }))
  }
  async tekil(_c: TenantCtx, id: string): Promise<IsEmri> {
    const i = this.kayitlar.find(x => x.id === id)
    if(!i) throw new Error(`İş emri bulunamadı: ${id}`)
    return { ...i, satirlar: i.satirlar.map(s => ({ ...s })) }
  }
  async ekle(c: TenantCtx, g: YeniIsEmri): Promise<IsEmri> {
    const i: IsEmri = {
      id: `ue-${++this.sayac}`, isEmriNo: g.isEmriNo, durum: 'DRAFT',
      receteId: g.receteId, ciktiKalemiId: g.ciktiKalemiId,
      planlananMiktar: g.planlananMiktar, ciktiBirimi: g.ciktiBirimi,
      verim: g.verim ?? 100, planlananTarih: g.planlananTarih, not: g.not,
      olusturmaTarihi: new Date().toISOString(),
      satirlar: g.satirlar.map((s, n) => ({
        ...s, id: `ues-${++this.sayac}`, siraNo: n + 1,
        stokKalemiAd: KALEMLER.find(k => k.id === s.stokKalemiId)?.ad,
      })),
    }
    this.kayitlar.push(i)
    return this.tekil(c, i.id)
  }
  async guncelle(c: TenantCtx, id: string, g: YeniIsEmri): Promise<IsEmri> {
    const mevcut = this.kayitlar.find(x => x.id === id)!
    const guncel: IsEmri = {
      ...mevcut, isEmriNo: g.isEmriNo, planlananMiktar: g.planlananMiktar,
      satirlar: g.satirlar.map((s, n) => ({ ...s, id: `ues-${++this.sayac}`, siraNo: n + 1 })),
    }
    this.kayitlar = this.kayitlar.map(x => (x.id === id ? guncel : x))
    return this.tekil(c, id)
  }
  async durumDegistir(
    c: TenantCtx, id: string, durum: IsEmriDurumu,
    zaman?: { baslama?: string; bitis?: string },
  ): Promise<IsEmri> {
    this.kayitlar = this.kayitlar.map(x => (x.id === id ? {
      ...x, durum,
      baslamaZamani: zaman?.baslama ?? x.baslamaZamani,
      bitisZamani: zaman?.bitis ?? x.bitisZamani,
    } : x))
    return this.tekil(c, id)
  }
}

let katalog: BellekKatalog
let depoServisi: DepoServisi
let depo: BellekIsEmriDeposu
let servis: IsEmriServisi

beforeEach(() => {
  localStorage.clear()
  katalog = new BellekKatalog()
  depoServisi = new DepoServisi(
    new LocalStorageStockRepository(
      new InMemoryStockItemLookup([
        { id: CORBA, baseUom: 'kg', tracksLot: true },
        { id: MERCIMEK, baseUom: 'g', tracksLot: true },
        { id: SOGAN, baseUom: 'kg', tracksLot: false },
      ]),
      new FixedTenantPolicyLookup('block'),
    ),
    katalog,
  )
  depo = new BellekIsEmriDeposu()
  servis = new IsEmriServisi(depo, depoServisi)
})

const bakiye = async (kalemId: string) =>
  (await depoServisi.kalemler(ctx)).find(k => k.id === kalemId)?.miktar

const bakiyeHaritasi = async () =>
  new Map((await depoServisi.kalemler(ctx)).map(k => [k.id, k.miktar]))

/** Depoya iki mercimek lotu koyar; SKT'ler farklı, FEFO sınanabilsin. */
const mercimekDoldur = async () => {
  await depoServisi.malKabul(ctx, {
    stokKalemiId: MERCIMEK, miktar: 10, birim: 'kg', birimMaliyet: 40,
    yeniLot: { kod: 'LOT-YAKIN', sonKullanma: '2026-10-01' },
  }, 'giris-1')
  await depoServisi.malKabul(ctx, {
    stokKalemiId: MERCIMEK, miktar: 10, birim: 'kg', birimMaliyet: 60,
    yeniLot: { kod: 'LOT-UZAK', sonKullanma: '2027-06-01' },
  }, 'giris-2')
}

const soganDoldur = () => depoServisi.malKabul(ctx, {
  stokKalemiId: SOGAN, miktar: 20, birim: 'kg', birimMaliyet: 15,
}, 'giris-3')

/** 12 kg mercimek + 5 kg soğan planlı iş emri. */
const isEmriAc = (yama: Partial<YeniIsEmri> = {}) => servis.ekle(ctx, {
  isEmriNo: 'UE-2026-0001',
  ciktiKalemiId: CORBA,
  planlananMiktar: 100,
  ciktiBirimi: 'kg',
  verim: 92,
  satirlar: [
    { stokKalemiId: MERCIMEK, planlananMiktar: 12, birim: 'kg' },
    { stokKalemiId: SOGAN, planlananMiktar: 5, birim: 'kg' },
  ],
  ...yama,
})

const baslat = async (isEmri: IsEmri) =>
  servis.baslat(ctx, isEmri, await bakiyeHaritasi(), KALEMLER)

const lotTakipli = (id: string) => KALEMLER.find(k => k.id === id)?.lotTakipli ?? false
const sktTakipli = (id: string) => KALEMLER.find(k => k.id === id)?.sktTakipli ?? false

// ═══════════════════════════════════════════════════════════════════════════
describe('KRİTER: yetersiz stokla iş emri başlatılamıyor', () => {
  it('boş depoyla başlatma reddediliyor ve eksik miktar söyleniyor', async () => {
    const isEmri = await isEmriAc()

    await expect(baslat(isEmri)).rejects.toThrow(YetersizStokIleBaslatilamazError)
    // Defterde hiçbir şey oluşmadı — reddetmek yarım yazmaktan iyidir.
    expect(await bakiye(MERCIMEK)).toBe(0)
  })

  it('bir malzeme eksikse diğerleri de tüketilmiyor', async () => {
    // Kısmi tüketim, üretilemeyecek bir iş için depoyu boşaltmaktır.
    await soganDoldur()
    const isEmri = await isEmriAc()

    await expect(baslat(isEmri)).rejects.toThrow(/Mercimek/)
    expect(await bakiye(SOGAN)).toBe(20)
  })

  it('hata mesajı hangi malzemeden ne kadar eksik olduğunu söylüyor', async () => {
    await depoServisi.malKabul(ctx, {
      stokKalemiId: MERCIMEK, miktar: 5, birim: 'kg',
      yeniLot: { kod: 'L1', sonKullanma: '2027-01-01' },
    }, 'g1')
    await soganDoldur()
    const isEmri = await isEmriAc()

    // 12 kg gerekiyor, 5 kg var → 7 kg eksik.
    await expect(baslat(isEmri)).rejects.toThrow(/7 kg eksik/)
  })

  it('planı YAZMAK serbest — kısıt yalnızca başlatmada', async () => {
    // Yarın gelecek malla üretim planlanabilir; kapı deftere yazarken kapanır.
    const isEmri = await isEmriAc()
    expect(isEmri.durum).toBe('DRAFT')
    expect(isEmri.satirlar).toHaveLength(2)
  })

  it('yeterli stokla başlıyor', async () => {
    await mercimekDoldur()
    await soganDoldur()

    const baslamis = await baslat(await isEmriAc())
    expect(baslamis.durum).toBe('STARTED')
    expect(baslamis.baslamaZamani).toBeDefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('KRİTER: hammadde tüketimi deftere yazılıyor, FEFO ile', () => {
  it('çıkış en yakın SKT’li lottan başlıyor', async () => {
    await mercimekDoldur()   // LOT-YAKIN 10 kg (2026-10), LOT-UZAK 10 kg (2027-06)
    await soganDoldur()
    await baslat(await isEmriAc())   // 12 kg mercimek

    const lotlar = await depoServisi.lotBakiyeleri(ctx, MERCIMEK)
    // Önce yakın lot tamamen tüketildi, kalan 2 kg uzak lottan gitti.
    expect(lotlar.find(l => l.kod === 'LOT-YAKIN')!.miktar).toBe(0)
    expect(lotlar.find(l => l.kod === 'LOT-UZAK')!.miktar).toBe(8_000)
  })

  it('tüketim negatif hareket olarak ve doğru sebeple yazılıyor', async () => {
    await mercimekDoldur()
    await soganDoldur()
    const isEmri = await baslat(await isEmriAc())

    const tuketim = (await depoServisi.hareketler(ctx, MERCIMEK))
      .filter(h => h.reason === 'PRODUCTION_CONSUME')

    // FEFO iki lota böldü → iki hareket, toplamı 12 kg = 12.000 g.
    expect(tuketim).toHaveLength(2)
    expect(tuketim.reduce((t, h) => t + h.quantityBase, 0)).toBe(-12_000)
    // Hepsi bu iş emrine bağlı — soyağacının dayandığı bağ budur.
    expect(tuketim.every(h => h.sourceId === isEmri.id)).toBe(true)
    expect(tuketim.every(h => h.sourceType === 'work_order')).toBe(true)
  })

  it('bakiye tüketilen kadar düşüyor', async () => {
    await mercimekDoldur()
    await soganDoldur()
    await baslat(await isEmriAc())

    expect(await bakiye(MERCIMEK)).toBe(8_000)   // 20 kg − 12 kg
    expect(await bakiye(SOGAN)).toBe(15)         // 20 kg − 5 kg
  })

  it('aynı iş emri iki kez başlatılamıyor, stok iki kez düşmüyor', async () => {
    // Ağ koptu, kullanıcı tekrar bastı — en sık gerçek hata.
    await mercimekDoldur()
    await soganDoldur()
    const baslamis = await baslat(await isEmriAc())

    await expect(baslat(baslamis)).rejects.toThrow(GecersizIsEmriGecisiError)
    expect(await bakiye(MERCIMEK)).toBe(8_000)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('KRİTER: mamul girişi + yeni lot, verim hesaba katılıyor', () => {
  const hazirla = async () => {
    await mercimekDoldur()
    await soganDoldur()
    return baslat(await isEmriAc())
  }

  it('mamul deftere giriş olarak yazılıyor ve yeni lot açılıyor', async () => {
    const isEmri = await hazirla()

    await servis.tamamla(ctx, isEmri, {
      uretilenMiktar: 92, lotKodu: 'MML-LOT-1', sonKullanma: '2026-09-20',
    }, lotTakipli, sktTakipli)

    expect(await bakiye(CORBA)).toBe(92)

    const cikti = (await depoServisi.hareketler(ctx, CORBA))
      .filter(h => h.reason === 'PRODUCTION_OUTPUT')
    expect(cikti).toHaveLength(1)
    expect(cikti[0].sourceId).toBe(isEmri.id)

    // Lotun kaynağı PRODUCTION: "bu parti satın alınmadı, üretildi".
    const lot = katalog.lotListesi.find(l => l.kod === 'MML-LOT-1')!
    expect(lot.kaynakTipi).toBe('PRODUCTION')
    expect(lot.sonKullanma).toBe('2026-09-20')
  })

  it('gerçekten çıkan miktar yazılıyor, plandan kopyalanmıyor', async () => {
    // Plan 100 kg'dı. Gerçekte 88 çıktıysa defterde 88 durmalı — asıl verim bu.
    // Plandan kopyalasaydık verim her zaman "tam tuttu" görünür, hiç ölçülemezdi.
    const isEmri = await hazirla()

    await servis.tamamla(ctx, isEmri, {
      uretilenMiktar: 88, lotKodu: 'MML-LOT-1', sonKullanma: '2026-09-20',
    }, lotTakipli, sktTakipli)

    expect(await bakiye(CORBA)).toBe(88)
    expect(isEmri.planlananMiktar).toBe(100)
  })

  it('mamul maliyeti tüketilen hammaddeden geliyor; verim onu yükseltiyor', async () => {
    const isEmri = await hazirla()

    // Tüketim: 10 kg × 40 TL (yakın lot) + 2 kg × ortalama, artı 5 kg soğan × 15.
    // Az mamul çıkarsa aynı para daha az birime bölünür → birim maliyet yükselir.
    const az = await servis.maliyet(ctx, isEmri, 80)
    const cok = await servis.maliyet(ctx, isEmri, 100)

    expect(az.toplamMaliyet).toBe(cok.toplamMaliyet)
    expect(az.birimMaliyet).toBeGreaterThan(cok.birimMaliyet)
  })

  it('lot takipli mamul lot kodsuz tamamlanamıyor', async () => {
    const isEmri = await hazirla()

    await expect(servis.tamamla(ctx, isEmri, {
      uretilenMiktar: 92, sonKullanma: '2026-09-20',
    }, lotTakipli, sktTakipli)).rejects.toThrow(/lot kodu zorunludur/)

    expect(await bakiye(CORBA)).toBe(0)
  })

  it('SKT takipli mamul tarihsiz tamamlanamıyor', async () => {
    const isEmri = await hazirla()

    await expect(servis.tamamla(ctx, isEmri, {
      uretilenMiktar: 92, lotKodu: 'MML-LOT-1',
    }, lotTakipli, sktTakipli)).rejects.toThrow(/son kullanma/i)
  })

  it('başlamamış iş emri tamamlanamıyor', async () => {
    const isEmri = await isEmriAc()

    await expect(servis.tamamla(ctx, isEmri, {
      uretilenMiktar: 92, lotKodu: 'X', sonKullanma: '2026-09-20',
    }, lotTakipli, sktTakipli)).rejects.toThrow(GecersizIsEmriGecisiError)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('KRİTER: üretim firesi ayrı hareket olarak yazılıyor', () => {
  it('fire tüketimden AYRI bir sebeple deftere düşüyor', async () => {
    await mercimekDoldur()
    await soganDoldur()
    const isEmri = await baslat(await isEmriAc())

    await servis.tamamla(ctx, isEmri, {
      uretilenMiktar: 90, lotKodu: 'MML-LOT-1', sonKullanma: '2026-09-20',
      fireler: [{ stokKalemiId: SOGAN, miktar: 2, birim: 'kg', neden: 'Yere döküldü' }],
    }, lotTakipli, sktTakipli)

    const hareketler = await depoServisi.hareketler(ctx, SOGAN)
    const tuketim = hareketler.filter(h => h.reason === 'PRODUCTION_CONSUME')
    const fire = hareketler.filter(h => h.reason === 'PRODUCTION_WASTE')

    // İkisi AYRI satır: "reçeteye göre kullandık" ile "yere döktük" aynı yere
    // düşseydi fire oranı hiç görünmez, iyileştirilemezdi.
    expect(tuketim).toHaveLength(1)
    expect(fire).toHaveLength(1)
    expect(fire[0].quantityBase).toBe(-2)
    expect(fire[0].note).toMatch(/Yere döküldü/)

    // Bakiye ikisini birden düşürüyor: 20 − 5 − 2 = 13
    expect(await bakiye(SOGAN)).toBe(13)
  })

  it('fire yazılmazsa hiçbir fire hareketi oluşmuyor', async () => {
    await mercimekDoldur()
    await soganDoldur()
    const isEmri = await baslat(await isEmriAc())

    await servis.tamamla(ctx, isEmri, {
      uretilenMiktar: 92, lotKodu: 'MML-LOT-1', sonKullanma: '2026-09-20',
    }, lotTakipli, sktTakipli)

    const fire = (await depoServisi.hareketler(ctx, SOGAN))
      .filter(h => h.reason === 'PRODUCTION_WASTE')
    expect(fire).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('KRİTER: iptal, tüketimi TERS KAYITLA geri alıyor', () => {
  it('başlamış iş emri iptal edilince bakiye eski değerine dönüyor', async () => {
    await mercimekDoldur()
    await soganDoldur()
    const isEmri = await baslat(await isEmriAc())
    expect(await bakiye(MERCIMEK)).toBe(8_000)

    const iptal = await servis.iptalEt(ctx, isEmri)

    expect(iptal.durum).toBe('CANCELLED')
    expect(await bakiye(MERCIMEK)).toBe(20_000)
    expect(await bakiye(SOGAN)).toBe(20)
  })

  it('hareketler SİLİNMİYOR — tüketim ve tersi yan yana duruyor', async () => {
    await mercimekDoldur()
    await soganDoldur()
    const isEmri = await baslat(await isEmriAc())
    await servis.iptalEt(ctx, isEmri)

    const hareketler = await depoServisi.hareketler(ctx, SOGAN)
    expect(hareketler.filter(h => h.reason === 'PRODUCTION_CONSUME')).toHaveLength(1)
    expect(hareketler.filter(h => h.reason === 'REVERSAL')).toHaveLength(1)
    // "Neden bu rakam değişti" sorusunun cevabı defterde duruyor.
    expect(hareketler.length).toBeGreaterThanOrEqual(3)
  })

  it('tamamlanmış iş emri iptal edilince MAMUL DE geri alınıyor', async () => {
    await mercimekDoldur()
    await soganDoldur()
    const isEmri = await baslat(await isEmriAc())
    const tamam = await servis.tamamla(ctx, isEmri, {
      uretilenMiktar: 92, lotKodu: 'MML-LOT-1', sonKullanma: '2026-09-20',
    }, lotTakipli, sktTakipli)

    expect(await bakiye(CORBA)).toBe(92)

    await servis.iptalEt(ctx, tamam)

    // Mamul de, hammadde de eski hâline döndü.
    expect(await bakiye(CORBA)).toBe(0)
    expect(await bakiye(MERCIMEK)).toBe(20_000)
  })

  it('taslak iş emri iptal edilince defter hiç değişmiyor', async () => {
    await mercimekDoldur()
    const isEmri = await isEmriAc()

    await servis.iptalEt(ctx, isEmri)

    expect(await bakiye(MERCIMEK)).toBe(20_000)
    expect(await depoServisi.hareketler(ctx, MERCIMEK)).toHaveLength(2)
  })

  it('iptal edilmiş iş emrinden çıkış yok', async () => {
    const isEmri = await isEmriAc()
    const iptal = await servis.iptalEt(ctx, isEmri)

    await expect(baslat(iptal)).rejects.toThrow(GecersizIsEmriGecisiError)
    expect(IS_EMRI_GECISLERI.CANCELLED).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('SOYAĞACI: bu mamulün içinde hangi lotlar var', () => {
  it('iş emrinin bütün hareketleri source_id ile bulunabiliyor', async () => {
    await mercimekDoldur()
    await soganDoldur()
    const isEmri = await baslat(await isEmriAc())
    await servis.tamamla(ctx, isEmri, {
      uretilenMiktar: 92, lotKodu: 'MML-LOT-1', sonKullanma: '2026-09-20',
      fireler: [{ stokKalemiId: SOGAN, miktar: 1, birim: 'kg' }],
    }, lotTakipli, sktTakipli)

    const hareketler = await servis.hareketleri(ctx, isEmri)

    // FEFO 2 + soğan 1 + fire 1 + mamul 1 = 5
    expect(hareketler).toHaveLength(5)
    expect(hareketler.every(h => h.sourceId === isEmri.id)).toBe(true)

    // Tüketilen lotlar: bu mamulün İÇİNDE ne var sorusunun cevabı.
    const tuketilenLotlar = hareketler
      .filter(h => h.quantityBase < 0 && h.lotId)
      .map(h => h.lotId)
    expect(new Set(tuketilenLotlar).size).toBe(2)   // LOT-YAKIN ve LOT-UZAK
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('yardımcılar', () => {
  it('reçeteden iş emri satırı üretirken BRÜT miktar kopyalanıyor', () => {
    // Fire ve verim dahil miktar. Reçete yarın değişse bile bu iş emrinin
    // neye göre planlandığı belli kalsın diye kopyalanıyor, bağ verilmiyor.
    const satirlar = receteyiIsEmrineDok([
      { satir: { stokKalemiId: MERCIMEK }, brutMiktar: 12.5, birim: 'kg' },
    ])

    expect(satirlar).toEqual([
      { stokKalemiId: MERCIMEK, planlananMiktar: 12.5, birim: 'kg' },
    ])
  })

  it('iş emri numarası sırayla artıyor', () => {
    expect(sonrakiIsEmriNo([], 2026)).toBe('UE-2026-0001')
    expect(sonrakiIsEmriNo(['UE-2026-0001', 'UE-2026-0007'], 2026)).toBe('UE-2026-0008')
    // Başka yılın numaraları sayaca karışmıyor.
    expect(sonrakiIsEmriNo(['UE-2025-0099'], 2026)).toBe('UE-2026-0001')
  })
})
