// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Zincirin tamamı, tek testte
//
// Yol haritası maddesi: "Bu aşamanın testleri (mal kabul + defter)"
//                       Bitti sayılır ki: "Hepsi yeşil"
//
// ── NEDEN AYRI BİR DOSYA ─────────────────────────────────────────────────
// Her servisin kendi testi var ve hepsi yeşil. Ama servislerin tek tek doğru
// olması, ARALARINDAKİ bağın doğru olduğunu göstermez: mal kabul kendi
// testinde doğru davranıp, sipariş durumunu güncellemeyi unutabilir; iade
// kendi testinde doğru çıkışı yazıp, kabul belgesiyle bağını koparabilir.
//
// Bu dosya zincirin TAMAMINI bir kez yürütüyor — demoda anlatılan hikâyenin
// aynısını, aynı sırayla:
//
//   tedarikçi → talep → onay → sipariş → gönder → kısmi kabul → DEFTER
//            → ikinci kabul → sipariş kapanır → iade → DEFTER → maliyet
//
// Buradaki her `expect`, demoda ekranda gösterilecek bir rakamdır. Biri
// kırmızıya dönerse, demoda o ekranda yanlış bir sayı duruyor demektir.
//
// ── GERÇEK DEFTER KULLANILIYOR ───────────────────────────────────────────
// Stok kısmında sahte yok: gerçek `LocalStorageStockRepository` ve gerçek
// `DepoServisi`. Sahte bir defter, tam da sınamak istediğimiz şeyi (ADR-001
// değişmezlerini) sahteleştirirdi. Sahte olanlar yalnızca belge depoları —
// onlar Postgres'e yazmaktan başka bir şey yapmıyor.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import type { TenantCtx } from '../core/context'
import { LocalStorageStockRepository } from '../core/stock/stock.localstorage'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import { FixedTenantPolicyLookup } from '../core/stock/tenant-policy-lookup'
import { DepoServisi } from '../warehouse/warehouse.service'
import { maliyetiHesapla } from '../warehouse/stock-cost'
import { kalemleriCozumle } from '../warehouse/catalog-import'
import { satirlariYaz } from '../core/import/sheet'
import { normalizeIdentifier } from '../core/identifier'
import type {
  Birim, KatalogKalemi, KatalogLotu, StokKatalogu, YeniKalem, YeniLot,
} from '../warehouse/warehouse.catalog'
import {
  TedarikciKoduCakismasiError,
  type Tedarikci, type TedarikciDeposu, type TedarikciGirdisi,
} from './supplier.repository'
import { TedarikciServisi } from './supplier.service'
import type {
  SatinAlmaDeposu, YeniSiparis, YeniTalep,
} from './purchase.repository'
import { SatinAlmaServisi, sonrakiBelgeNo } from './purchase.service'
import type {
  Siparis, SiparisDurumu, Talep, TalepDurumu,
} from './purchase.types'
import type {
  Kabul, KabulSatiri, MalKabulDeposu, YeniKabul,
} from './goods-receipt.repository'
import { MalKabulServisi, siparisDurumu, siparisTeslimDurumu } from './goods-receipt.service'
import {
  TedarikciIadeServisi, kabulIadeDurumu,
  type Iade, type IadeSatiri, type TedarikciIadeDeposu, type YeniIade,
} from './supplier-return'

const ctx: TenantCtx = { tenantId: 'tenant-1', branchId: 'branch-1', userId: 'user-1' }

/** Mercimek. Temel birim GRAM, sipariş KİLO — birim tuzağı bilerek kuruldu. */
const MERCIMEK = 'kalem-mercimek'

// ═══════════════════════════════════════════════════════════════════════════
// Bellek depoları — yalnızca "Postgres'e yaz" işini taklit ederler
// ═══════════════════════════════════════════════════════════════════════════

class BellekKatalog implements StokKatalogu {
  kalemListesi: KatalogKalemi[] = []
  lotListesi: KatalogLotu[] = []
  private sayac = 0
  async kalemler(): Promise<KatalogKalemi[]> { return [...this.kalemListesi] }
  async kalemEkle(_c: TenantCtx, g: YeniKalem): Promise<KatalogKalemi> {
    if(this.kalemListesi.some(k => normalizeIdentifier(k.kod) === normalizeIdentifier(g.kod))){
      throw new Error(`"${g.kod}" kodu başka bir kalemde kullanılıyor.`)
    }
    const k: KatalogKalemi = {
      id: `kalem-${++this.sayac}`, kod: g.kod, ad: g.ad, kategori: g.kategori,
      temelBirim: g.temelBirim, lotTakipli: g.lotTakipli, sktTakipli: g.sktTakipli,
      minMiktar: g.minMiktar ?? 0, aktif: true,
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
  async birimler(): Promise<Birim[]> {
    return [
      { kod: 'kg', ad: 'Kilogram', boyut: 'MASS' },
      { kod: 'g', ad: 'Gram', boyut: 'MASS' },
    ]
  }
}

class BellekTedarikciDeposu implements TedarikciDeposu {
  kayitlar: Tedarikci[] = []
  private sayac = 0
  async hepsi(): Promise<Tedarikci[]> { return [...this.kayitlar] }
  async ekle(_c: TenantCtx, g: TedarikciGirdisi): Promise<Tedarikci> {
    if(this.kayitlar.some(k => normalizeIdentifier(k.kod) === normalizeIdentifier(g.kod))){
      throw new TedarikciKoduCakismasiError(g.kod)
    }
    const k: Tedarikci = { id: `ted-${++this.sayac}`, aktif: true, ...g }
    this.kayitlar.push(k)
    return k
  }
  async guncelle(_c: TenantCtx, id: string, g: TedarikciGirdisi): Promise<Tedarikci> {
    const guncel = { ...this.bul(id), ...g }
    this.kayitlar = this.kayitlar.map(k => (k.id === id ? guncel : k))
    return guncel
  }
  async aktiflikDegistir(_c: TenantCtx, id: string, aktif: boolean): Promise<Tedarikci> {
    const guncel = { ...this.bul(id), aktif }
    this.kayitlar = this.kayitlar.map(k => (k.id === id ? guncel : k))
    return guncel
  }
  private bul(id: string){
    const k = this.kayitlar.find(x => x.id === id)
    if(!k) throw new Error(`Tedarikçi bulunamadı: ${id}`)
    return k
  }
}

class BellekSatinAlmaDeposu implements SatinAlmaDeposu {
  talepListesi: Talep[] = []
  siparisListesi: Siparis[] = []
  private sayac = 0
  async talepler(): Promise<Talep[]> { return [...this.talepListesi] }
  async siparisler(): Promise<Siparis[]> { return [...this.siparisListesi] }
  async talepEkle(_c: TenantCtx, g: YeniTalep): Promise<Talep> {
    const t: Talep = {
      id: `tal-${++this.sayac}`, talepNo: g.talepNo, durum: 'DRAFT',
      gerekenTarih: g.gerekenTarih, not: g.not,
      olusturmaTarihi: new Date().toISOString(),
      satirlar: g.satirlar.map((s, i) => ({ ...s, id: `tsat-${++this.sayac}`, siraNo: i + 1 })),
    }
    this.talepListesi.push(t)
    return t
  }
  async talepDurumDegistir(_c: TenantCtx, id: string, durum: TalepDurumu, kararNotu?: string){
    const mevcut = this.talepListesi.find(t => t.id === id)
    if(!mevcut) throw new Error(`Talep bulunamadı: ${id}`)
    const guncel = { ...mevcut, durum, kararNotu }
    this.talepListesi = this.talepListesi.map(t => (t.id === id ? guncel : t))
    return guncel
  }
  async siparisEkle(_c: TenantCtx, g: YeniSiparis): Promise<Siparis> {
    const s: Siparis = {
      id: `sip-${++this.sayac}`, siparisNo: g.siparisNo, durum: 'DRAFT',
      tedarikciId: g.tedarikciId, talepId: g.talepId,
      paraBirimi: g.paraBirimi ?? 'TRY', beklenenTarih: g.beklenenTarih, not: g.not,
      olusturmaTarihi: new Date().toISOString(),
      satirlar: g.satirlar.map((x, i) => ({ ...x, id: `ssat-${++this.sayac}`, siraNo: i + 1 })),
    }
    this.siparisListesi.push(s)
    return s
  }
  async siparisDurumDegistir(_c: TenantCtx, id: string, durum: SiparisDurumu): Promise<Siparis> {
    const mevcut = this.siparisListesi.find(s => s.id === id)
    if(!mevcut) throw new Error(`Sipariş bulunamadı: ${id}`)
    const guncel = { ...mevcut, durum }
    this.siparisListesi = this.siparisListesi.map(s => (s.id === id ? guncel : s))
    return guncel
  }
}

class BellekKabulDeposu implements MalKabulDeposu {
  kayitlar: Kabul[] = []
  private sayac = 0
  async hepsi(): Promise<Kabul[]> {
    return this.kayitlar.map(k => ({ ...k, satirlar: k.satirlar.map(s => ({ ...s })) }))
  }
  async tekil(_c: TenantCtx, id: string): Promise<Kabul> {
    const k = this.kayitlar.find(x => x.id === id)
    if(!k) throw new Error(`Kabul bulunamadı: ${id}`)
    return { ...k, satirlar: k.satirlar.map(s => ({ ...s })) }
  }
  async taslakAc(c: TenantCtx, g: YeniKabul): Promise<Kabul> {
    const kabul: Kabul = {
      id: `kbl-${++this.sayac}`, kabulNo: g.kabulNo, durum: 'DRAFT',
      siparisId: g.siparisId, tedarikciId: g.tedarikciId,
      irsaliyeNo: g.irsaliyeNo, not: g.not,
      kabulTarihi: g.kabulTarihi ?? '2026-09-05',
      olusturmaTarihi: new Date().toISOString(),
      satirlar: g.satirlar.map((s, i): KabulSatiri => ({ ...s, id: `ksat-${++this.sayac}`, siraNo: i + 1 })),
    }
    this.kayitlar.push(kabul)
    return this.tekil(c, kabul.id)
  }
  async satiraHareketBagla(_c: TenantCtx, satirId: string, hareketId: string){
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
  async hepsi(): Promise<Iade[]> {
    return this.kayitlar.map(i => ({ ...i, satirlar: i.satirlar.map(s => ({ ...s })) }))
  }
  async tekil(_c: TenantCtx, id: string): Promise<Iade> {
    const i = this.kayitlar.find(x => x.id === id)
    if(!i) throw new Error(`İade bulunamadı: ${id}`)
    return { ...i, satirlar: i.satirlar.map(s => ({ ...s })) }
  }
  async taslakAc(c: TenantCtx, g: YeniIade): Promise<Iade> {
    const iade: Iade = {
      id: `iade-${++this.sayac}`, iadeNo: g.iadeNo, durum: 'DRAFT',
      kabulId: g.kabulId, tedarikciId: g.tedarikciId,
      iadeTarihi: g.iadeTarihi ?? '2026-09-06', neden: g.neden, not: g.not,
      olusturmaTarihi: new Date().toISOString(),
      satirlar: g.satirlar.map((s, i): IadeSatiri => ({ ...s, id: `isat-${++this.sayac}`, siraNo: i + 1 })),
    }
    this.kayitlar.push(iade)
    return this.tekil(c, iade.id)
  }
  async satiraHareketBagla(_c: TenantCtx, satirId: string, hareketId: string){
    this.kayitlar = this.kayitlar.map(i => ({
      ...i, satirlar: i.satirlar.map(s => (s.id === satirId ? { ...s, hareketId } : s)),
    }))
  }
  async islendiIsaretle(c: TenantCtx, id: string): Promise<Iade> {
    this.kayitlar = this.kayitlar.map(i => (i.id === id ? { ...i, durum: 'POSTED' as const } : i))
    return this.tekil(c, id)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Kurulum
// ═══════════════════════════════════════════════════════════════════════════

let katalog: BellekKatalog
let depoServisi: DepoServisi
let tedarikciServisi: TedarikciServisi
let satinAlma: SatinAlmaServisi
let satinAlmaDeposu: BellekSatinAlmaDeposu
let kabulServisi: MalKabulServisi
let kabulDeposu: BellekKabulDeposu
let iadeServisi: TedarikciIadeServisi
let iadeDeposu: BellekIadeDeposu

beforeEach(() => {
  localStorage.clear()

  katalog = new BellekKatalog()
  katalog.kalemListesi = [{
    id: MERCIMEK, kod: 'MRC-001', ad: 'Yeşil Mercimek', kategori: 'Bakliyat',
    // ⚠️ Temel birim GRAM. Sipariş ve kabul KİLO üzerinden yapılacak.
    // Zincirin en sessiz hatası burada saklı: bin katlık bir çarpan.
    temelBirim: 'g', lotTakipli: true, sktTakipli: true, minMiktar: 100_000, aktif: true,
  }]

  depoServisi = new DepoServisi(
    new LocalStorageStockRepository(
      new InMemoryStockItemLookup([{ id: MERCIMEK, baseUom: 'g', tracksLot: true }]),
      new FixedTenantPolicyLookup('block'),
    ),
    katalog,
  )

  tedarikciServisi = new TedarikciServisi(new BellekTedarikciDeposu())
  satinAlmaDeposu = new BellekSatinAlmaDeposu()
  satinAlma = new SatinAlmaServisi(satinAlmaDeposu)
  kabulDeposu = new BellekKabulDeposu()
  kabulServisi = new MalKabulServisi(kabulDeposu, depoServisi)
  iadeDeposu = new BellekIadeDeposu()
  iadeServisi = new TedarikciIadeServisi(iadeDeposu, depoServisi)
})

const bakiye = async () =>
  (await depoServisi.kalemler(ctx)).find(k => k.id === MERCIMEK)?.miktar

const lotTakipli = () => true
const sktTakipli = () => true

/** Kabul sonrası siparişin teslim durumunu ekrandaki gibi günceller. */
const teslimDurumunuTazele = async (siparis: Siparis) => {
  const kabuller = await kabulServisi.hepsi(ctx)
  const teslim = siparisTeslimDurumu(siparisDurumu(siparis, kabuller))
  return teslim ? satinAlma.teslimDurumunuGuncelle(ctx, siparis, teslim) : siparis
}

// ═══════════════════════════════════════════════════════════════════════════
// Zincirin tamamı
// ═══════════════════════════════════════════════════════════════════════════

describe('KRİTER: Aşama 2 zinciri uçtan uca, defterle birlikte', () => {
  it('tedarikçiden deftere: talep → onay → sipariş → kabul → iade → maliyet', async () => {
    // ── 1. Tedarikçi ────────────────────────────────────────────────────
    const tedarikci = await tedarikciServisi.ekle(ctx, {
      kod: 'TED-001', ad: 'ABC Gıda', eposta: 'siparis@abcgida.com',
    })
    expect(tedarikci.aktif).toBe(true)

    // ── 2. Talep: "buna ihtiyacım var" ──────────────────────────────────
    // Talepte tedarikçi ve fiyat YOKTUR — henüz kimden alınacağı belli değil.
    let talep = await satinAlma.talepAc(ctx, {
      talepNo: sonrakiBelgeNo('SAT', [], 2026),
      satirlar: [{ stokKalemiId: MERCIMEK, miktar: 200, birim: 'kg' }],
    })
    expect(talep.talepNo).toBe('SAT-2026-0001')
    expect(talep.durum).toBe('DRAFT')

    // ── 3. Onaya gönder ve onayla ───────────────────────────────────────
    talep = await satinAlma.talepDurumDegistir(ctx, talep, 'SUBMITTED')
    talep = await satinAlma.talepDurumDegistir(ctx, talep, 'APPROVED')
    expect(talep.durum).toBe('APPROVED')

    // ── 4. Siparişe çevir: burada tedarikçi ve fiyat girilir ────────────
    let siparis = await satinAlma.talepteSiparisOlustur(ctx, talep, {
      siparisNo: sonrakiBelgeNo('SIP', [], 2026),
      tedarikciId: tedarikci.id,
      // 40 TL / KİLO. Defter GRAM tutuyor — çarpanı sistem çözecek.
      fiyatlar: { [MERCIMEK]: 40 },
    })
    expect(siparis.talepId).toBe(talep.id)
    expect(siparis.satirlar[0].miktar).toBe(200)
    expect(siparis.satirlar[0].birimFiyat).toBe(40)

    siparis = await satinAlma.siparisDurumDegistir(ctx, siparis, 'SENT')
    expect(siparis.durum).toBe('SENT')

    // ── 5. İlk sevkiyat: 200 istendi, 150 geldi, 10'u kapıda reddedildi ──
    await kabulServisi.kabulEt(ctx, {
      kabulNo: 'MK-2026-0001', siparisId: siparis.id, tedarikciId: tedarikci.id,
      irsaliyeNo: 'IRS-001',
      satirlar: [{
        stokKalemiId: MERCIMEK, siparisSatirId: siparis.satirlar[0].id,
        kabulMiktari: 150, redMiktari: 10, redNedeni: 'Çuval yırtık',
        birim: 'kg', birimFiyat: 40,
        lotKodu: 'LOT-A', sonKullanma: '2027-01-31',
      }],
    }, lotTakipli, sktTakipli)

    // DEFTER: 150 kg girildi, 150.000 g yazıldı. Ret deftere HİÇ yazılmadı.
    expect(await bakiye()).toBe(150_000)
    const ilkHareketler = await depoServisi.hareketler(ctx, MERCIMEK)
    expect(ilkHareketler).toHaveLength(1)
    expect(ilkHareketler[0].reason).toBe('PURCHASE_RECEIPT')
    expect(ilkHareketler[0].quantityBase).toBe(150_000)
    // Kullanıcının YAZDIĞI değer de korunuyor — denetimde "kaç kilo dedi".
    expect(ilkHareketler[0].quantityEntered).toBe(150)
    expect(ilkHareketler[0].uomEntered).toBe('kg')

    // Lot kendiliğinden açıldı.
    const lotlar = await depoServisi.lotBakiyeleri(ctx, MERCIMEK)
    expect(lotlar).toHaveLength(1)
    expect(lotlar[0].kod).toBe('LOT-A')
    expect(lotlar[0].miktar).toBe(150_000)

    // Sipariş kısmen teslim: 200'ün 150'si geldi.
    siparis = await teslimDurumunuTazele(siparis)
    expect(siparis.durum).toBe('PARTIAL')

    // ── 6. İkinci sevkiyat: kalan 50 kg ─────────────────────────────────
    await kabulServisi.kabulEt(ctx, {
      kabulNo: 'MK-2026-0002', siparisId: siparis.id, tedarikciId: tedarikci.id,
      satirlar: [{
        stokKalemiId: MERCIMEK, siparisSatirId: siparis.satirlar[0].id,
        kabulMiktari: 50, redMiktari: 0, birim: 'kg', birimFiyat: 50,
        lotKodu: 'LOT-B', sonKullanma: '2027-03-31',
      }],
    }, lotTakipli, sktTakipli)

    expect(await bakiye()).toBe(200_000)

    // Sipariş kapandı: 200'ün 200'ü geldi.
    siparis = await teslimDurumunuTazele(siparis)
    expect(siparis.durum).toBe('RECEIVED')

    // ── 7. Maliyet: iki farklı fiyat, tek ortalama ──────────────────────
    // 150 kg × 40 TL = 6.000 · 50 kg × 50 TL = 2.500 → 8.500 TL / 200.000 g
    let maliyet = maliyetiHesapla(await depoServisi.hareketler(ctx, MERCIMEK))
    expect(maliyet.miktar).toBe(200_000)
    expect(maliyet.deger).toBe(8_500)
    expect(maliyet.birimMaliyet).toBe(0.0425)   // gram başına
    expect(maliyet.sonAlisFiyati).toBe(50)
    expect(maliyet.sonAlisBirimi).toBe('kg')

    // ── 8. İade: kabul edilmiş maldan 20 kg geri gidiyor ────────────────
    const kabuller = await kabulServisi.hepsi(ctx)
    const ilkKabul = kabuller.find(k => k.kabulNo === 'MK-2026-0001')!
    const iadeDurumu = kabulIadeDurumu(ilkKabul, [])
    expect(iadeDurumu[0].kalan).toBe(150)   // henüz iade edilmemiş

    await iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-2026-0001', kabulId: ilkKabul.id, tedarikciId: tedarikci.id,
      neden: 'Malın içinden haşere çıktı',
      satirlar: [{
        kabulSatirId: ilkKabul.satirlar[0].id, stokKalemiId: MERCIMEK,
        miktar: 20, birim: 'kg', lotKodu: 'LOT-A',
      }],
    }, ilkKabul, [])

    // DEFTER: çıkış yazıldı, bakiye düştü.
    expect(await bakiye()).toBe(180_000)
    const sonHareketler = await depoServisi.hareketler(ctx, MERCIMEK)
    const iadeHareketi = sonHareketler.find(h => h.reason === 'PURCHASE_RETURN')
    expect(iadeHareketi).toBeDefined()
    expect(iadeHareketi!.quantityBase).toBe(-20_000)

    // FEFO: en yakın SKT'li LOT-A'dan düştü, LOT-B'ye dokunulmadı.
    const sonLotlar = await depoServisi.lotBakiyeleri(ctx, MERCIMEK)
    expect(sonLotlar.find(l => l.kod === 'LOT-A')!.miktar).toBe(130_000)
    expect(sonLotlar.find(l => l.kod === 'LOT-B')!.miktar).toBe(50_000)

    // Kabul belgesi SİLİNMEDİ; iade edilen miktar oradan izleniyor.
    const iadeler = await iadeServisi.hepsi(ctx)
    expect(kabulIadeDurumu(ilkKabul, iadeler)[0].iadeEdilen).toBe(20)
    expect(kabulIadeDurumu(ilkKabul, iadeler)[0].kalan).toBe(130)

    // ── 9. Maliyet iadeden sonra ────────────────────────────────────────
    // İade ORTALAMADAN çıkar: 20 kg = 20.000 g × 0,0425 = 850 TL.
    maliyet = maliyetiHesapla(sonHareketler)
    expect(maliyet.miktar).toBe(180_000)
    expect(maliyet.deger).toBe(7_650)
    expect(maliyet.birimMaliyet).toBe(0.0425)   // ortalama DEĞİŞMEDİ

    // ── 10. Defterin tamamı ─────────────────────────────────────────────
    // Üç hareket: iki giriş, bir çıkış. Ret hiçbirinde yok.
    expect(sonHareketler).toHaveLength(3)
    expect(sonHareketler.map(h => h.reason).sort()).toEqual(
      ['PURCHASE_RECEIPT', 'PURCHASE_RECEIPT', 'PURCHASE_RETURN'],
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Zincirin kopmaması gereken yerler
// ═══════════════════════════════════════════════════════════════════════════

describe('zincir atlanamıyor', () => {
  const talepAc = () => satinAlma.talepAc(ctx, {
    talepNo: 'SAT-2026-0001',
    satirlar: [{ stokKalemiId: MERCIMEK, miktar: 100, birim: 'kg' }],
  })

  it('onaylanmamış talepten sipariş çıkmıyor', async () => {
    const talep = await talepAc()

    await expect(satinAlma.talepteSiparisOlustur(ctx, talep, {
      siparisNo: 'SIP-2026-0001', tedarikciId: 'ted-1',
    })).rejects.toThrow(/onaylanmış/)
  })

  it('reddedilen talep sonradan onaylanamıyor', async () => {
    // Ret bir SON durumdur. "Yanlışlıkla reddettim" durumunda yeni talep açılır;
    // geçmişi değiştirmek, kararın izini silmek olurdu.
    let talep = await talepAc()
    talep = await satinAlma.talepDurumDegistir(ctx, talep, 'SUBMITTED')
    talep = await satinAlma.talepDurumDegistir(ctx, talep, 'REJECTED', 'Bütçe yok')

    await expect(satinAlma.talepDurumDegistir(ctx, talep, 'APPROVED')).rejects.toThrow()
  })

  it('aynı mal kabulü iki kez işlense bile stok iki katına çıkmıyor', async () => {
    // Idempotency (I2). Ağ koptu, kullanıcı tekrar bastı — en sık gerçek hata.
    const kabul = await kabulServisi.kabulEt(ctx, {
      kabulNo: 'MK-2026-0001', tedarikciId: 'ted-1',
      satirlar: [{
        stokKalemiId: MERCIMEK, kabulMiktari: 10, redMiktari: 0,
        birim: 'kg', birimFiyat: 40, lotKodu: 'LOT-A', sonKullanma: '2027-01-31',
      }],
    }, lotTakipli, sktTakipli)

    expect(await bakiye()).toBe(10_000)

    // İşlenmiş belge tekrar denenirse servis reddediyor…
    await expect(kabulServisi.tekrarDene(ctx, kabul)).rejects.toThrow()
    // …ve bakiye kıpırdamıyor.
    expect(await bakiye()).toBe(10_000)
  })

  it('kabul edilenden fazlası iade edilemiyor', async () => {
    await kabulServisi.kabulEt(ctx, {
      kabulNo: 'MK-2026-0001', tedarikciId: 'ted-1',
      satirlar: [{
        stokKalemiId: MERCIMEK, kabulMiktari: 10, redMiktari: 0,
        birim: 'kg', birimFiyat: 40, lotKodu: 'LOT-A', sonKullanma: '2027-01-31',
      }],
    }, lotTakipli, sktTakipli)

    const kabul = (await kabulServisi.hepsi(ctx))[0]

    await expect(iadeServisi.iadeEt(ctx, {
      iadeNo: 'IAD-2026-0001', kabulId: kabul.id, tedarikciId: 'ted-1',
      neden: 'Deneme',
      satirlar: [{
        kabulSatirId: kabul.satirlar[0].id, stokKalemiId: MERCIMEK,
        miktar: 25, birim: 'kg', lotKodu: 'LOT-A',
      }],
    }, kabul, [])).rejects.toThrow(/iade edilebilir 10/)

    expect(await bakiye()).toBe(10_000)
  })

  it('depoda olmayan mal çıkamıyor (I12)', async () => {
    await expect(depoServisi.cikis(ctx, {
      stokKalemiId: MERCIMEK, miktar: 5, birim: 'kg', neden: 'PRODUCTION_CONSUME',
    }, 'deneme')).rejects.toThrow()

    expect(await bakiye()).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Kurulum: Excel'den kart aç, o kartla hemen mal kabul yap
// ═══════════════════════════════════════════════════════════════════════════

describe('kurulum zinciri: Excel → kart → mal kabul', () => {
  it('Excel’den aktarılan kart, aynı oturumda mal kabul alabiliyor', async () => {
    // Yol haritası kriteri: "Kağıttan gelen müşteri 20 dakikada kuruluyor."
    // Bunun sınanabilir hâli: içe aktarma ile açılan bir kartın, elle
    // dokunmadan zincirin geri kalanında çalışması.
    const onizleme = kalemleriCozumle([
      ['Kod', 'Ad', 'Kategori', 'Birim', 'Lot Takibi', 'SKT Takibi', 'En Az Miktar'],
      ['PRC-001', 'Baldo Pirinç', 'Bakliyat', 'kg', 'Hayır', 'Hayır', '50'],
      ['MRC-001', 'Kopya Mercimek', '', 'kg', 'Hayır', 'Hayır', ''],
    ], katalog.kalemListesi, await katalog.birimler())

    // MRC-001 zaten var → yeni açılmaz.
    expect(onizleme.yeni).toBe(1)
    expect(onizleme.guncelleme).toBe(1)

    const sonuc = await satirlariYaz(onizleme, g => katalog.kalemEkle(ctx, g))
    expect(sonuc.eklendi).toBe(1)
    expect(sonuc.basarisiz).toEqual([])

    const pirinc = katalog.kalemListesi.find(k => k.kod === 'PRC-001')!
    expect(pirinc.temelBirim).toBe('kg')
    expect(pirinc.minMiktar).toBe(50)

    // Yeni kart için deftere yazabilmek üzere depo servisini o kalemi de
    // tanıyacak şekilde kuruyoruz — gerçekte bunu veritabanı yapıyor.
    const servis2 = new DepoServisi(
      new LocalStorageStockRepository(
        new InMemoryStockItemLookup([
          { id: MERCIMEK, baseUom: 'g', tracksLot: true },
          { id: pirinc.id, baseUom: 'kg', tracksLot: false },
        ]),
        new FixedTenantPolicyLookup('block'),
      ),
      katalog,
    )
    const kabul2 = new MalKabulServisi(new BellekKabulDeposu(), servis2)

    await kabul2.kabulEt(ctx, {
      kabulNo: 'MK-2026-0001', tedarikciId: 'ted-1',
      satirlar: [{
        stokKalemiId: pirinc.id, kabulMiktari: 500, redMiktari: 0,
        birim: 'kg', birimFiyat: 30,
      }],
    }, () => false, () => false)

    const bakiyeler = await servis2.kalemler(ctx)
    expect(bakiyeler.find(k => k.id === pirinc.id)?.miktar).toBe(500)
  })
})
