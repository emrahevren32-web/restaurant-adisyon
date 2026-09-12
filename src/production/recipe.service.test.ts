// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 — Reçete servisi testleri
//
// Yol haritası maddesi: "Reçete yönetimi gerçek veriye bağlı"
//                       Bitti sayılır ki: "Reçete kalemleri stok kartlarına bağlı"
//
// Kriterin sınanabilir hâli: reçete satırının stok kartına bağlı OLMASININ
// bir işe yaraması. Serbest metin olsaydı "depoda var mı" sorusu sorulamazdı.
// Aşağıdaki "yeterlilik" bloğu tam olarak bunu sınıyor — bağ kopsa o testler
// yazılamaz hâle gelirdi.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import type { TenantCtx } from '../core/context'
import type { KatalogKalemi } from '../warehouse/warehouse.catalog'
import {
  ReceteKoduCakismasiError,
  type Recete,
  type ReceteDeposu,
  type ReceteDurumu,
  type ReceteGirdisi,
} from './recipe.repository'
import {
  GecersizReceteGecisiError,
  ReceteDogrulamaError,
  ReceteServisi,
  donguVarMi,
  hepsiYeterli,
  receteyiOlcekle,
  yeterliligiHesapla,
} from './recipe.service'

const ctx: TenantCtx = { tenantId: 'tenant-1', branchId: 'branch-1', userId: 'user-1' }

const CORBA = 'kalem-corba'      // mamul, temel birim: porsiyon
const MERCIMEK = 'kalem-mercimek' // temel birim: g
const SOGAN = 'kalem-sogan'       // temel birim: kg
const TUZ = 'kalem-tuz'           // temel birim: g

const KALEMLER: KatalogKalemi[] = [
  { id: CORBA, kod: 'MML-01', ad: 'Mercimek Çorbası', temelBirim: 'porsiyon', lotTakipli: true, sktTakipli: true, minMiktar: 0, aktif: true },
  { id: MERCIMEK, kod: 'HAM-01', ad: 'Yeşil Mercimek', temelBirim: 'g', lotTakipli: true, sktTakipli: true, minMiktar: 0, aktif: true },
  { id: SOGAN, kod: 'HAM-02', ad: 'Kuru Soğan', temelBirim: 'kg', lotTakipli: false, sktTakipli: false, minMiktar: 0, aktif: true },
  { id: TUZ, kod: 'HAM-03', ad: 'Tuz', temelBirim: 'g', lotTakipli: false, sktTakipli: false, minMiktar: 0, aktif: true },
]

/** 100 porsiyon çorba. Verim %100, fire yok — ölçekleme testlerinin temeli. */
const RECETE: Recete = {
  id: 'rct-1', kod: 'RCT-001', ad: 'Mercimek Çorbası', durum: 'ACTIVE',
  ciktiKalemiId: CORBA, ciktiKalemiAd: 'Mercimek Çorbası',
  ciktiMiktari: 100, ciktiBirimi: 'porsiyon', verim: 100,
  olusturmaTarihi: '2026-09-07',
  satirlar: [
    { id: 's1', stokKalemiId: MERCIMEK, miktar: 5, birim: 'kg', firePayi: 0, siraNo: 1 },
    { id: 's2', stokKalemiId: SOGAN, miktar: 2, birim: 'kg', firePayi: 0, siraNo: 2 },
    { id: 's3', stokKalemiId: TUZ, miktar: 100, birim: 'g', firePayi: 0, siraNo: 3 },
  ],
}

const ile = (yama: Partial<Recete>): Recete => ({ ...RECETE, ...yama })

class BellekDeposu implements ReceteDeposu {
  kayitlar: Recete[] = []
  private sayac = 0
  async hepsi(): Promise<Recete[]> { return [...this.kayitlar] }
  async tekil(_c: TenantCtx, id: string): Promise<Recete> {
    const r = this.kayitlar.find(x => x.id === id)
    if(!r) throw new Error(`Reçete bulunamadı: ${id}`)
    return r
  }
  async ekle(_c: TenantCtx, g: ReceteGirdisi): Promise<Recete> {
    const anahtar = g.kod.toLowerCase()
    if(this.kayitlar.some(r => r.kod.toLowerCase() === anahtar)){
      throw new ReceteKoduCakismasiError(g.kod)
    }
    const r: Recete = {
      id: `rct-${++this.sayac}`, kod: g.kod, ad: g.ad, durum: 'DRAFT',
      ciktiKalemiId: g.ciktiKalemiId, ciktiMiktari: g.ciktiMiktari,
      ciktiBirimi: g.ciktiBirimi, verim: g.verim ?? 100, not: g.not,
      olusturmaTarihi: new Date().toISOString(),
      satirlar: g.satirlar.map((s, i) => ({ ...s, id: `rs-${++this.sayac}`, siraNo: i + 1 })),
    }
    this.kayitlar.push(r)
    return r
  }
  async guncelle(_c: TenantCtx, id: string, g: ReceteGirdisi): Promise<Recete> {
    const mevcut = this.kayitlar.find(r => r.id === id)!
    const guncel: Recete = {
      ...mevcut, kod: g.kod, ad: g.ad, ciktiKalemiId: g.ciktiKalemiId,
      ciktiMiktari: g.ciktiMiktari, ciktiBirimi: g.ciktiBirimi,
      verim: g.verim ?? 100, not: g.not,
      satirlar: g.satirlar.map((s, i) => ({ ...s, id: `rs-${++this.sayac}`, siraNo: i + 1 })),
    }
    this.kayitlar = this.kayitlar.map(r => (r.id === id ? guncel : r))
    return guncel
  }
  async durumDegistir(_c: TenantCtx, id: string, durum: ReceteDurumu): Promise<Recete> {
    const guncel = { ...this.kayitlar.find(r => r.id === id)!, durum }
    this.kayitlar = this.kayitlar.map(r => (r.id === id ? guncel : r))
    return guncel
  }
}

const GECERLI_GIRDI: ReceteGirdisi = {
  kod: 'RCT-001', ad: 'Mercimek Çorbası',
  ciktiKalemiId: CORBA, ciktiMiktari: 100, ciktiBirimi: 'porsiyon', verim: 100,
  satirlar: [{ stokKalemiId: MERCIMEK, miktar: 5, birim: 'kg', firePayi: 0 }],
}

let depo: BellekDeposu
let servis: ReceteServisi

beforeEach(() => {
  depo = new BellekDeposu()
  servis = new ReceteServisi(depo)
})

// ═══════════════════════════════════════════════════════════════════════════
describe('ölçekleme', () => {
  it('reçete istenen miktara oranlanır', () => {
    // 100 porsiyonluk reçeteden 350 porsiyon → her şey 3,5 katı.
    const o = receteyiOlcekle(RECETE, 350)

    expect(o.map(x => x.netMiktar)).toEqual([17.5, 7, 350])
    // Fire yoksa brüt = net.
    expect(o.map(x => x.brutMiktar)).toEqual([17.5, 7, 350])
  })

  it('reçetenin kendi miktarı istenirse hiçbir şey değişmez', () => {
    const o = receteyiOlcekle(RECETE, 100)
    expect(o.map(x => x.brutMiktar)).toEqual([5, 2, 100])
  })

  it('verim düşükse DAHA ÇOK girdi gerekir', () => {
    // %80 verimle 100 porsiyon çıkarmak için 100/0,80 = 125 birimlik girdi.
    const o = receteyiOlcekle(ile({ verim: 80 }), 100)

    expect(o[0].netMiktar).toBe(6.25)   // 5 / 0,80
    expect(o[1].netMiktar).toBe(2.5)
  })

  it('satır firesi yalnızca o satırı büyütür', () => {
    // Soğanın %20'si kabuk: 2 kg kullanmak için 2/0,80 = 2,5 kg çıkmalı.
    const o = receteyiOlcekle(ile({
      satirlar: [
        { id: 's1', stokKalemiId: MERCIMEK, miktar: 5, birim: 'kg', firePayi: 0, siraNo: 1 },
        { id: 's2', stokKalemiId: SOGAN, miktar: 2, birim: 'kg', firePayi: 20, siraNo: 2 },
      ],
    }), 100)

    expect(o[0].brutMiktar).toBe(5)     // firesiz satır büyümedi
    expect(o[1].netMiktar).toBe(2)
    expect(o[1].brutMiktar).toBe(2.5)
  })

  it('verim ve fire birlikte, doğru sırada uygulanır', () => {
    // Önce verim (üretimin tamamına), sonra fire (satıra).
    // Soğan: 2 × (100/80) = 2,5 net → 2,5 / 0,80 = 3,125 brüt.
    // Ters sırada 3,125 değil başka bir sayı çıkardı ve her üretimde
    // sistematik olarak fazla malzeme istenirdi.
    const o = receteyiOlcekle(ile({
      verim: 80,
      satirlar: [{ id: 's2', stokKalemiId: SOGAN, miktar: 2, birim: 'kg', firePayi: 20, siraNo: 1 }],
    }), 100)

    expect(o[0].netMiktar).toBe(2.5)
    expect(o[0].brutMiktar).toBe(3.125)
  })

  it('0 veya eksi miktar ölçeklenemez', () => {
    expect(() => receteyiOlcekle(RECETE, 0)).toThrow(ReceteDogrulamaError)
    expect(() => receteyiOlcekle(RECETE, -5)).toThrow(ReceteDogrulamaError)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('KRİTER: satır stok kartına bağlı olduğu için "depoda var mı" sorulabiliyor', () => {
  /** Bakiyeler TEMEL birimde — defter öyle tutuyor. */
  const bakiye = (v: Partial<Record<string, number>>) =>
    new Map<string, number>(Object.entries(v) as Array<[string, number]>)

  it('yeterli stokta eksik çıkmaz', () => {
    const o = receteyiOlcekle(RECETE, 100)
    const y = yeterliligiHesapla(o, bakiye({
      [MERCIMEK]: 10_000,   // 10 kg (temel birim g)
      [SOGAN]: 5,           // 5 kg
      [TUZ]: 500,           // 500 g
    }), KALEMLER)

    expect(y.every(s => s.yeterli)).toBe(true)
    expect(hepsiYeterli(y)).toBe(true)
  })

  it('birim çevrilerek kıyaslanır — 5 kg ile 5.000 g karışmıyor', () => {
    // Reçete "5 kg mercimek" der, defter GRAM tutar. Çevirmeden kıyaslasaydık
    // 5 ile 5.000'i karşılaştırır, "yetiyor" derdik — oysa 5 gram var.
    const o = receteyiOlcekle(RECETE, 100)
    const y = yeterliligiHesapla(o, bakiye({ [MERCIMEK]: 5, [SOGAN]: 5, [TUZ]: 500 }), KALEMLER)

    const mercimek = y.find(s => s.satir.stokKalemiId === MERCIMEK)!
    expect(mercimek.eldeki).toBe(0.005)   // 5 g = 0,005 kg
    expect(mercimek.yeterli).toBe(false)
    expect(mercimek.eksik).toBe(4.995)
  })

  it('eksik miktar tam olarak hesaplanıyor', () => {
    const o = receteyiOlcekle(RECETE, 200)   // 10 kg mercimek gerek
    const y = yeterliligiHesapla(o, bakiye({ [MERCIMEK]: 6_000 }), KALEMLER)

    const mercimek = y.find(s => s.satir.stokKalemiId === MERCIMEK)!
    expect(mercimek.eldeki).toBe(6)
    expect(mercimek.eksik).toBe(4)
    expect(hepsiYeterli(y)).toBe(false)
  })

  it('hiç bakiyesi olmayan kalem eksik sayılır', () => {
    const o = receteyiOlcekle(RECETE, 100)
    const y = yeterliligiHesapla(o, bakiye({}), KALEMLER)

    expect(y.every(s => !s.yeterli)).toBe(true)
  })

  it('fire payı yeterlilik hesabına girer', () => {
    // 2 kg soğan lazım ama %20 fire var → 2,5 kg çekilecek.
    // Depoda 2,2 kg varsa YETMEZ; fireyi görmezden gelseydik "yeter" derdik
    // ve üretim yarıda kalırdı.
    const o = receteyiOlcekle(ile({
      satirlar: [{ id: 's2', stokKalemiId: SOGAN, miktar: 2, birim: 'kg', firePayi: 20, siraNo: 1 }],
    }), 100)
    const y = yeterliligiHesapla(o, bakiye({ [SOGAN]: 2.2 }), KALEMLER)

    expect(y[0].brutMiktar).toBe(2.5)
    expect(y[0].yeterli).toBe(false)
  })

  it('çevrilemeyen birim sessizce "yeterli" sayılmaz', () => {
    // kg ↔ adet çevrilemez. "Bilmiyorum"u "sorun yok" saymak, üretimi
    // depoda olmayan malla başlatırdı.
    const o = receteyiOlcekle(ile({
      satirlar: [{ id: 's9', stokKalemiId: SOGAN, miktar: 3, birim: 'adet', firePayi: 0, siraNo: 1 }],
    }), 100)
    const y = yeterliligiHesapla(o, bakiye({ [SOGAN]: 1000 }), KALEMLER)

    expect(y[0].cevrilemedi).toBe(true)
    expect(y[0].yeterli).toBe(false)
  })

  it('kataloğda olmayan kalem eksik sayılır', () => {
    const o = receteyiOlcekle(ile({
      satirlar: [{ id: 's9', stokKalemiId: 'yok-boyle-kalem', miktar: 1, birim: 'kg', firePayi: 0, siraNo: 1 }],
    }), 100)

    expect(yeterliligiHesapla(o, bakiye({}), KALEMLER)[0].yeterli).toBe(false)
  })

  it('boş liste "hepsi yeterli" sayılmaz', () => {
    // Malzemesiz bir üretim, yoktan mamul demektir.
    expect(hepsiYeterli([])).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('reçete kuralları', () => {
  it('geçerli reçete taslak olarak açılır', async () => {
    const r = await servis.ekle(ctx, GECERLI_GIRDI, [])

    expect(r.durum).toBe('DRAFT')
    expect(r.satirlar).toHaveLength(1)
    expect(r.satirlar[0].stokKalemiId).toBe(MERCIMEK)
  })

  it('malzemesiz reçete kaydedilemez', async () => {
    await expect(servis.ekle(ctx, { ...GECERLI_GIRDI, satirlar: [] }, []))
      .rejects.toThrow(/en az bir malzeme/)
  })

  it('mamul kendi malzemesi olamaz', async () => {
    await expect(servis.ekle(ctx, {
      ...GECERLI_GIRDI,
      satirlar: [{ stokKalemiId: CORBA, miktar: 1, birim: 'porsiyon', firePayi: 0 }],
    }, [])).rejects.toThrow(/kendi reçetesinin malzemesi/)
  })

  it('aynı malzeme iki kez yazılamaz', async () => {
    // İki satır olsaydı, birini güncelleyip diğerini unutmak kaçınılmazdı.
    await expect(servis.ekle(ctx, {
      ...GECERLI_GIRDI,
      satirlar: [
        { stokKalemiId: MERCIMEK, miktar: 2, birim: 'kg', firePayi: 0 },
        { stokKalemiId: MERCIMEK, miktar: 3, birim: 'kg', firePayi: 0 },
      ],
    }, [])).rejects.toThrow(/zaten var/)
  })

  it('%100’den büyük verim reddedilir', async () => {
    // Girdiden daha çok mamul çıkması, maddenin korunumuna aykırıdır.
    await expect(servis.ekle(ctx, { ...GECERLI_GIRDI, verim: 120 }, []))
      .rejects.toThrow(/Verim/)
  })

  it('aynı kod iki reçetede olamaz', async () => {
    const ilk = await servis.ekle(ctx, GECERLI_GIRDI, [])
    await expect(servis.ekle(ctx, GECERLI_GIRDI, [ilk])).rejects.toThrow(/kullanılıyor/)
  })

  it('kod kıyası büyük/küçük harfe takılmaz', async () => {
    const ilk = await servis.ekle(ctx, GECERLI_GIRDI, [])
    await expect(servis.ekle(ctx, { ...GECERLI_GIRDI, kod: 'rct-001' }, [ilk]))
      .rejects.toThrow(/kullanılıyor/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('durum geçişleri', () => {
  it('taslak yürürlüğe alınabilir', async () => {
    const r = await servis.ekle(ctx, GECERLI_GIRDI, [])
    expect((await servis.durumDegistir(ctx, r, 'ACTIVE')).durum).toBe('ACTIVE')
  })

  it('yürürlükteki reçete taslağa GERİ DÖNEMEZ', async () => {
    // Ona bakan iş emirlerinin altını boşaltırdı.
    const r = await servis.ekle(ctx, GECERLI_GIRDI, [])
    const aktif = await servis.durumDegistir(ctx, r, 'ACTIVE')

    await expect(servis.durumDegistir(ctx, aktif, 'DRAFT'))
      .rejects.toThrow(GecersizReceteGecisiError)
  })

  it('arşivden geri dönülebilir — yanlışlıkla arşivlemek meşru bir hatadır', async () => {
    const r = await servis.ekle(ctx, GECERLI_GIRDI, [])
    const aktif = await servis.durumDegistir(ctx, r, 'ACTIVE')
    const arsiv = await servis.durumDegistir(ctx, aktif, 'ARCHIVED')

    expect((await servis.durumDegistir(ctx, arsiv, 'ACTIVE')).durum).toBe('ACTIVE')
  })

  it('arşivlenmiş reçete düzenlenemez', async () => {
    const r = await servis.ekle(ctx, GECERLI_GIRDI, [])
    const aktif = await servis.durumDegistir(ctx, r, 'ACTIVE')
    const arsiv = await servis.durumDegistir(ctx, aktif, 'ARCHIVED')

    await expect(servis.guncelle(ctx, arsiv, GECERLI_GIRDI, []))
      .rejects.toThrow(/Arşivlenmiş/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
describe('döngü kontrolü', () => {
  /** Hamur → Ekmek. Ekmeğin reçetesinde hamur var. */
  const HAMUR = 'kalem-hamur'
  const EKMEK = 'kalem-ekmek'

  const hamurRecetesi: Recete = ile({
    id: 'rct-hamur', kod: 'RCT-H', ad: 'Hamur',
    ciktiKalemiId: HAMUR, ciktiKalemiAd: 'Hamur',
    satirlar: [{ id: 'h1', stokKalemiId: MERCIMEK, miktar: 1, birim: 'kg', firePayi: 0, siraNo: 1 }],
  })

  const ekmekRecetesi: Recete = ile({
    id: 'rct-ekmek', kod: 'RCT-E', ad: 'Ekmek',
    ciktiKalemiId: EKMEK, ciktiKalemiAd: 'Ekmek',
    satirlar: [{ id: 'e1', stokKalemiId: HAMUR, miktar: 1, birim: 'kg', firePayi: 0, siraNo: 1 }],
  })

  it('düz zincirde döngü yok', () => {
    expect(donguVarMi(EKMEK, [HAMUR], [hamurRecetesi, ekmekRecetesi])).toBeNull()
  })

  it('dolaylı döngü yakalanır: hamurun içine ekmek konamaz', () => {
    // Ekmek ← hamur zaten var. Hamurun reçetesine ekmek eklemek zinciri
    // kapatır ve ölçekleme sonsuza kadar dönerdi.
    expect(donguVarMi(HAMUR, [EKMEK], [hamurRecetesi, ekmekRecetesi])).not.toBeNull()
  })

  it('mamulle ilgisi olmayan malzeme döngü sayılmaz', () => {
    expect(donguVarMi(EKMEK, [MERCIMEK, SOGAN], [hamurRecetesi, ekmekRecetesi])).toBeNull()
  })
})
