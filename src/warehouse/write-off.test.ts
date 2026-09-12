// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — Fire, zayi ve SKT imhası testleri
//
// Üç iddia sınanıyor:
//   1. Fire/zayi/imha GEREKÇESİZ yazılamaz — ve bu kural servis katmanında,
//      yani hangi ekrandan gelirse gelsin geçerli.
//   2. Üç sebep birbirinden AYRI raporlanabiliyor (kodları ayırmanın tek
//      anlamı bu).
//   3. Toplu imha, kullanıcının gönderdiği rakamı değil DEFTERDEKİ bakiyeyi
//      yazıyor; iki kez basılırsa ikinci kez yazmıyor.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import type { TenantCtx } from '../core/context'
import { LocalStorageStockRepository } from '../core/stock/stock.localstorage'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import { FixedTenantPolicyLookup } from '../core/stock/tenant-policy-lookup'
import { DepoServisi } from './warehouse.service'
import type { Birim, KatalogKalemi, KatalogLotu, StokKatalogu, YeniKalem, YeniLot } from './warehouse.catalog'
import {
  ZAYI_ACIKLAMALARI, ZAYI_ETIKETLERI, ZAYI_NEDENLERI, zayiNedeniMi,
  type ZayiHareketi,
} from './write-off.repository'
import {
  GerekceGerekliError, gerekceYeterliMi, gunOnce, kalemBazindaZayi, zayiOzeti,
} from './write-off.service'

const ctx: TenantCtx = { tenantId: 't1', branchId: 'b1', userId: 'u1' }
const UN = 'kalem-un'
const TAVUK = 'kalem-tavuk'

class SahteKatalog implements StokKatalogu {
  kalemListesi: KatalogKalemi[] = []
  lotListesi: KatalogLotu[] = []
  private sayac = 0
  async kalemler(){ return [...this.kalemListesi] }
  async kalemEkle(_c: TenantCtx, g: YeniKalem){
    const k: KatalogKalemi = { id: `k-${++this.sayac}`, kod: g.kod, ad: g.ad, temelBirim: g.temelBirim,
      lotTakipli: g.lotTakipli, sktTakipli: g.sktTakipli, minMiktar: g.minMiktar ?? 0, aktif: true }
    this.kalemListesi.push(k); return k
  }
  async lotlar(_c: TenantCtx, id: string){ return this.lotListesi.filter(l => l.stokKalemiId === id) }
  async lotEkle(_c: TenantCtx, g: YeniLot){
    const l: KatalogLotu = { id: `lot-${++this.sayac}`, stokKalemiId: g.stokKalemiId, kod: g.kod,
      sonKullanma: g.sonKullanma, tedarikci: g.tedarikci, kaynakTipi: g.kaynakTipi ?? 'RECEIPT' }
    this.lotListesi.push(l); return l
  }
  async birimler(): Promise<Birim[]>{ return [{ kod: 'kg', ad: 'Kilogram', boyut: 'MASS' }] }
}

let katalog: SahteKatalog
let servis: DepoServisi

beforeEach(() => {
  localStorage.clear()
  katalog = new SahteKatalog()
  katalog.kalemListesi = [
    { id: UN, kod: 'UN-01', ad: 'Un', temelBirim: 'kg', lotTakipli: false, sktTakipli: false, minMiktar: 0, aktif: true },
    { id: TAVUK, kod: 'TVK-01', ad: 'Tavuk', temelBirim: 'kg', lotTakipli: true, sktTakipli: true, minMiktar: 0, aktif: true },
  ]
  const defter = new LocalStorageStockRepository(
    new InMemoryStockItemLookup([
      { id: UN, baseUom: 'kg', tracksLot: false },
      { id: TAVUK, baseUom: 'kg', tracksLot: true },
    ]),
    new FixedTenantPolicyLookup('block'),
  )
  servis = new DepoServisi(defter, katalog)
})

const bakiye = async (id: string) => (await servis.kalemler(ctx)).find(k => k.id === id)?.miktar

// ── 1 · Gerekçe zorunluluğu ────────────────────────────────────────────────

describe('Gerekçe zorunluluğu', () => {
  it.each(ZAYI_NEDENLERI)('%s gerekçesiz yazılamıyor', async neden => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, `k-${neden}`)
    await expect(
      servis.cikis(ctx, { stokKalemiId: UN, miktar: 5, birim: 'kg', neden }, `c-${neden}`),
    ).rejects.toBeInstanceOf(GerekceGerekliError)
    // Hareket yazılmadığı için bakiye de değişmemeli.
    expect(await bakiye(UN)).toBe(100)
  })

  it('boşluktan ibaret gerekçe de reddediliyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, 'k1')
    await expect(
      servis.cikis(ctx, { stokKalemiId: UN, miktar: 5, birim: 'kg', neden: 'WASTE', not: '   ' }, 'c1'),
    ).rejects.toBeInstanceOf(GerekceGerekliError)
  })

  it('gerekçe yazılınca hareket deftere düşüyor ve not korunuyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, 'k1')
    await servis.cikis(ctx, {
      stokKalemiId: UN, miktar: 5, birim: 'kg', neden: 'LOSS', not: 'Depoda çuval yırtıldı, döküldü.',
    }, 'c1')

    expect(await bakiye(UN)).toBe(95)
    const hareketler = await servis.hareketler(ctx, UN)
    const zayi = hareketler.find(h => h.reason === 'LOSS')
    expect(zayi?.note).toBe('Depoda çuval yırtıldı, döküldü.')
  })

  it('zayi OLMAYAN nedenler gerekçesiz geçebiliyor', async () => {
    // Sevkiyatın belgesi zaten var; ona ayrıca gerekçe dayatmak gereksiz
    // sürtünme olurdu. Kural sadece belgesiz üç nedene ait.
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, 'k1')
    await servis.cikis(ctx, { stokKalemiId: UN, miktar: 5, birim: 'kg', neden: 'SHIPMENT_OUT' }, 'c1')
    expect(await bakiye(UN)).toBe(95)
  })

  it('gerekceYeterliMi üç harften kısa metni yeterli saymıyor', () => {
    expect(gerekceYeterliMi(undefined)).toBe(false)
    expect(gerekceYeterliMi('')).toBe(false)
    expect(gerekceYeterliMi('  ')).toBe(false)
    expect(gerekceYeterliMi('ok')).toBe(false)
    expect(gerekceYeterliMi('Bozuldu')).toBe(true)
  })
})

// ── 2 · Sebep kodlarının ayrılığı ──────────────────────────────────────────

describe('Üç sebep birbirinden ayrı', () => {
  it('fire, zayi ve imha AYRI kodlarla deftere yazılıyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, 'k1')
    await servis.cikis(ctx, { stokKalemiId: UN, miktar: 3, birim: 'kg', neden: 'WASTE', not: 'İşlenirken kayıp' }, 'c1')
    await servis.cikis(ctx, { stokKalemiId: UN, miktar: 2, birim: 'kg', neden: 'LOSS', not: 'Kayboldu' }, 'c2')
    await servis.cikis(ctx, { stokKalemiId: UN, miktar: 1, birim: 'kg', neden: 'EXPIRY_WRITE_OFF', not: 'SKT geçti' }, 'c3')

    const kodlar = (await servis.hareketler(ctx, UN)).map(h => h.reason)
    expect(kodlar).toContain('WASTE')
    expect(kodlar).toContain('LOSS')
    expect(kodlar).toContain('EXPIRY_WRITE_OFF')
    expect(await bakiye(UN)).toBe(94)
  })

  it('her sebebin etiketi ve açıklaması var (ekranda seçim yapılabilsin)', () => {
    ZAYI_NEDENLERI.forEach(neden => {
      expect(ZAYI_ETIKETLERI[neden]?.length).toBeGreaterThan(0)
      expect(ZAYI_ACIKLAMALARI[neden]?.length).toBeGreaterThan(10)
    })
  })

  it('zayiNedeniMi yalnızca üç kodu tanıyor', () => {
    expect(zayiNedeniMi('WASTE')).toBe(true)
    expect(zayiNedeniMi('LOSS')).toBe(true)
    expect(zayiNedeniMi('EXPIRY_WRITE_OFF')).toBe(true)
    expect(zayiNedeniMi('SHIPMENT_OUT')).toBe(false)
    expect(zayiNedeniMi('PRODUCTION_WASTE')).toBe(false)
  })
})

// ── 3 · Toplu SKT imhası ───────────────────────────────────────────────────

describe('Toplu SKT imhası', () => {
  const lotAc = async (kod: string, sonKullanma: string, miktar: number, anahtar: string) => {
    const hareket = await servis.malKabul(ctx, {
      stokKalemiId: TAVUK, miktar, birim: 'kg', yeniLot: { kod, sonKullanma },
    }, anahtar)
    return hareket.lotId as string
  }

  it('lotun TAMAMI imha ediliyor — miktar defterden geliyor', async () => {
    const lotId = await lotAc('LOT-A', '2020-01-01', 40, 'k1')

    const sonuc = await servis.imhaEt(ctx, [{ kalemId: TAVUK, lotId }], 'SKT geçti, imha tutanağı 2026/14')

    expect(sonuc.hatalar).toEqual([])
    expect(sonuc.yazilan).toHaveLength(1)
    expect(sonuc.yazilan[0].reason).toBe('EXPIRY_WRITE_OFF')
    expect(sonuc.yazilan[0].quantityBase).toBe(-40)
    expect(await bakiye(TAVUK)).toBe(0)
  })

  it('iki kez basılırsa ikinci imha YAZILMIYOR', async () => {
    const lotId = await lotAc('LOT-B', '2020-01-01', 25, 'k1')
    await servis.imhaEt(ctx, [{ kalemId: TAVUK, lotId }], 'SKT geçti')

    const ikinci = await servis.imhaEt(ctx, [{ kalemId: TAVUK, lotId }], 'SKT geçti')

    // Bakiye zaten sıfır: ikinci turda "imha edilecek bakiye yok" der.
    expect(ikinci.yazilan).toHaveLength(0)
    expect(ikinci.hatalar).toHaveLength(1)
    expect(await bakiye(TAVUK)).toBe(0)
  })

  it('gerekçesiz toplu imha hiç başlamıyor', async () => {
    const lotId = await lotAc('LOT-C', '2020-01-01', 10, 'k1')
    await expect(servis.imhaEt(ctx, [{ kalemId: TAVUK, lotId }], ''))
      .rejects.toBeInstanceOf(GerekceGerekliError)
    expect(await bakiye(TAVUK)).toBe(10)
  })

  it('bir lot hata verse diğerleri yazılmaya devam ediyor', async () => {
    const iyi = await lotAc('LOT-D', '2020-01-01', 12, 'k1')
    await lotAc('LOT-E', '2020-01-01', 8, 'k2')

    const sonuc = await servis.imhaEt(ctx, [
      { kalemId: TAVUK, lotId: 'olmayan-lot' },
      { kalemId: TAVUK, lotId: iyi },
    ], 'SKT geçti')

    expect(sonuc.hatalar).toHaveLength(1)
    expect(sonuc.hatalar[0].lotId).toBe('olmayan-lot')
    expect(sonuc.yazilan).toHaveLength(1)
    // İyi lot düştü, öteki lot (8) duruyor.
    expect(await bakiye(TAVUK)).toBe(8)
  })

  it('süresi geçmiş lotlar uyarı listesinden imha sonrası düşüyor', async () => {
    const lotId = await lotAc('LOT-F', '2020-01-01', 15, 'k1')

    const once = await servis.uyarilar(ctx)
    expect(once.suresiGecmis.map(u => u.lotId)).toContain(lotId)

    await servis.imhaEt(ctx, [{ kalemId: TAVUK, lotId }], 'SKT geçti, imha edildi')

    const sonra = await servis.uyarilar(ctx)
    // Bakiyesi sıfırlanan lot artık uyarı üretmiyor — uyarı lotun varlığından
    // değil, lotta MAL BULUNMASINDAN doğuyor.
    expect(sonra.suresiGecmis.map(u => u.lotId)).not.toContain(lotId)
  })
})

// ── 4 · Rapor ──────────────────────────────────────────────────────────────

const hareket = (o: Partial<ZayiHareketi> & { neden: ZayiHareketi['neden'] }): ZayiHareketi => ({
  id: o.id ?? Math.random().toString(36).slice(2),
  tarih: o.tarih ?? '2026-09-01T10:00:00Z',
  kalemId: o.kalemId ?? UN,
  kalemAd: o.kalemAd ?? 'Un',
  kalemKodu: o.kalemKodu ?? 'UN-01',
  lotKodu: o.lotKodu,
  neden: o.neden,
  miktar: o.miktar ?? 1,
  birim: o.birim ?? 'kg',
  birimMaliyet: o.birimMaliyet,
  not: o.not,
})

describe('Zayi raporu', () => {
  it('üç sebep ayrı toplanıyor', () => {
    const ozet = zayiOzeti([
      hareket({ neden: 'WASTE', miktar: 3, birimMaliyet: 10 }),
      hareket({ neden: 'WASTE', miktar: 2, birimMaliyet: 10 }),
      hareket({ neden: 'LOSS', miktar: 4, birimMaliyet: 5 }),
    ])

    const fire = ozet.find(o => o.neden === 'WASTE')!
    expect(fire.adet).toBe(2)
    expect(fire.birimBazinda).toEqual([{ birim: 'kg', miktar: 5 }])
    expect(fire.tutar).toBe(50)

    const zayi = ozet.find(o => o.neden === 'LOSS')!
    expect(zayi.tutar).toBe(20)
  })

  it('hareketi olmayan sebep de listede kalıyor', () => {
    // "Bu ay hiç imha yok" ile "imhayı ölçmüyoruz" farklı şeyler.
    const ozet = zayiOzeti([hareket({ neden: 'WASTE' })])
    expect(ozet).toHaveLength(3)
    expect(ozet.find(o => o.neden === 'EXPIRY_WRITE_OFF')!.adet).toBe(0)
  })

  it('farklı birimler TOPLANMIYOR, ayrı satır oluyor', () => {
    // "12 kg + 3 adet = 15" anlamsız bir rakamdır.
    const ozet = zayiOzeti([
      hareket({ neden: 'WASTE', miktar: 12, birim: 'kg' }),
      hareket({ neden: 'WASTE', miktar: 3, birim: 'adet' }),
    ])
    const fire = ozet.find(o => o.neden === 'WASTE')!
    expect(fire.birimBazinda).toHaveLength(2)
    expect(fire.birimBazinda).toContainEqual({ birim: 'kg', miktar: 12 })
    expect(fire.birimBazinda).toContainEqual({ birim: 'adet', miktar: 3 })
  })

  it('maliyeti bilinmeyen hareketler ayrıca sayılıyor (tutar eksik demek)', () => {
    const ozet = zayiOzeti([
      hareket({ neden: 'LOSS', miktar: 5, birimMaliyet: 10 }),
      hareket({ neden: 'LOSS', miktar: 5 }),
    ])
    const zayi = ozet.find(o => o.neden === 'LOSS')!
    expect(zayi.tutar).toBe(50)
    expect(zayi.maliyetsiz).toBe(1)
  })

  it('kalem bazında sıralama en pahalı kaybı öne alıyor', () => {
    const satirlar = kalemBazindaZayi([
      hareket({ neden: 'WASTE', kalemId: UN, kalemAd: 'Un', miktar: 10, birimMaliyet: 2 }),
      hareket({ neden: 'LOSS', kalemId: TAVUK, kalemAd: 'Tavuk', miktar: 3, birimMaliyet: 90 }),
      hareket({ neden: 'WASTE', kalemId: TAVUK, kalemAd: 'Tavuk', miktar: 1, birimMaliyet: 90 }),
    ])

    expect(satirlar[0].kalemAd).toBe('Tavuk')
    expect(satirlar[0].miktar).toBe(4)
    expect(satirlar[0].tutar).toBe(360)
    expect(satirlar[0].adet).toBe(2)
    expect(satirlar[1].kalemAd).toBe('Un')
  })

  it('gunOnce geçmiş tarihi ISO gün olarak veriyor', () => {
    expect(gunOnce(30, new Date('2026-09-12T08:00:00Z'))).toBe('2026-08-13')
    expect(gunOnce(0, new Date('2026-09-12T08:00:00Z'))).toBe('2026-09-12')
  })
})
