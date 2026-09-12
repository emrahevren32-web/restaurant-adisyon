// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 / Depo çekirdeği — Depo servisi testleri
//
// Defter SAHTE DEĞİL: burada gerçek `LocalStorageStockRepository` kullanılıyor.
// Sebebi, servisin asıl işinin defterle konuşmak olması — sahte bir defterle
// test etmek, yalnızca "servis doğru metodu çağırdı mı" sorusunu cevaplardı;
// asıl merak ettiğimiz ise "bakiye doğru çıktı mı".
//
// O uygulama, `stock.contract.suite.ts` içindeki 28 sözleşme testinden geçiyor
// ve aynı gövde canlı Postgres'e karşı da yeşil (G6.5, 2026-08-28). Yani
// buradaki bakiyeler, üretimde de aynı kuralları uygulayan bir defterden
// geliyor.
//
// Sahte olan tek şey KATALOG: stok kartları ve lotlar. O bir Postgres okuma
// yüzeyi, davranışı yok.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest'
import type { TenantCtx } from '../core/context'
import { LocalStorageStockRepository } from '../core/stock/stock.localstorage'
import { InMemoryStockItemLookup } from '../core/stock/stock-item-lookup'
import { FixedTenantPolicyLookup } from '../core/stock/tenant-policy-lookup'
import { DuplicateIdempotencyKeyError } from '../core/stock/stock.repository'
import {
  BirimCevrilemezError,
  DepoServisi,
  LotGerekliError,
  YetersizStokError,
  fefoSirala,
  kalanGun,
} from './warehouse.service'
import type {
  Birim,
  KatalogKalemi,
  KatalogLotu,
  StokKatalogu,
  YeniKalem,
  YeniLot,
} from './warehouse.catalog'

const ctx: TenantCtx = { tenantId: 'tenant-1', branchId: 'branch-1', userId: 'user-1' }

const UN = 'kalem-un'
const TAVUK = 'kalem-tavuk'
// Temel birimi GRAM olan bir kalem: birim dönüşümünü sınamak için.
const BAHARAT = 'kalem-baharat'

/** Bellekte yaşayan katalog — Postgres okuma yüzeyinin yerine geçer. */
class SahteKatalog implements StokKatalogu {
  kalemListesi: KatalogKalemi[] = []
  lotListesi: KatalogLotu[] = []
  private sayac = 0

  async kalemler(): Promise<KatalogKalemi[]> { return [...this.kalemListesi] }

  async kalemEkle(_ctx: TenantCtx, girdi: YeniKalem): Promise<KatalogKalemi> {
    const kalem: KatalogKalemi = {
      id: `kalem-${++this.sayac}`,
      kod: girdi.kod,
      ad: girdi.ad,
      temelBirim: girdi.temelBirim,
      lotTakipli: girdi.lotTakipli,
      sktTakipli: girdi.sktTakipli,
      minMiktar: girdi.minMiktar ?? 0,
      aktif: true,
    }
    this.kalemListesi.push(kalem)
    return kalem
  }

  async lotlar(_ctx: TenantCtx, stokKalemiId: string): Promise<KatalogLotu[]> {
    return this.lotListesi.filter(lot => lot.stokKalemiId === stokKalemiId)
  }

  async lotEkle(_ctx: TenantCtx, girdi: YeniLot): Promise<KatalogLotu> {
    const lot: KatalogLotu = {
      id: `lot-${++this.sayac}`,
      stokKalemiId: girdi.stokKalemiId,
      kod: girdi.kod,
      sonKullanma: girdi.sonKullanma,
      tedarikci: girdi.tedarikci,
      kaynakTipi: girdi.kaynakTipi ?? 'RECEIPT',
    }
    this.lotListesi.push(lot)
    return lot
  }

  async birimler(): Promise<Birim[]> {
    return [{ kod: 'kg', ad: 'Kilogram', boyut: 'MASS' }]
  }
}

let katalog: SahteKatalog
let servis: DepoServisi

beforeEach(() => {
  localStorage.clear()
  katalog = new SahteKatalog()
  katalog.kalemListesi = [
    { id: UN, kod: 'UN-01', ad: 'Un', temelBirim: 'kg', lotTakipli: false, sktTakipli: false, minMiktar: 10, aktif: true },
    { id: TAVUK, kod: 'TVK-01', ad: 'Tavuk', temelBirim: 'kg', lotTakipli: true, sktTakipli: true, minMiktar: 0, aktif: true },
    { id: BAHARAT, kod: 'BHR-01', ad: 'Baharat', temelBirim: 'g', lotTakipli: false, sktTakipli: false, minMiktar: 0, aktif: true },
  ]

  const defter = new LocalStorageStockRepository(
    new InMemoryStockItemLookup([
      { id: UN, baseUom: 'kg', tracksLot: false },
      { id: TAVUK, baseUom: 'kg', tracksLot: true },
      { id: BAHARAT, baseUom: 'g', tracksLot: false },
    ]),
    new FixedTenantPolicyLookup('block'),
  )
  servis = new DepoServisi(defter, katalog)
})

const miktar = async (kalemId: string) =>
  (await servis.kalemler(ctx)).find(k => k.id === kalemId)?.miktar

describe('Depo · mal kabul', () => {
  it('miktar deftere yazılıyor ve bakiye oradan türetiliyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, 'kabul-1')

    expect(await miktar(UN)).toBe(100)

    const hareketler = await servis.hareketler(ctx, UN)
    expect(hareketler).toHaveLength(1)
    expect(hareketler[0].reason).toBe('PURCHASE_RECEIPT')
    expect(hareketler[0].quantityBase).toBe(100)
  })

  it('lot takipli kalemde yeni lot açılıyor ve hareket ona bağlanıyor', async () => {
    await servis.malKabul(ctx, {
      stokKalemiId: TAVUK,
      miktar: 25,
      birim: 'kg',
      yeniLot: { kod: 'LOT-A', sonKullanma: '2027-01-31', tedarikci: 'Et Tedarik' },
    }, 'kabul-2')

    const lotlar = await servis.lotBakiyeleri(ctx, TAVUK)
    expect(lotlar).toHaveLength(1)
    expect(lotlar[0].kod).toBe('LOT-A')
    expect(lotlar[0].miktar).toBe(25)
    expect(lotlar[0].sonKullanma).toBe('2027-01-31')
  })

  it('lot takipli kaleme lotsuz mal kabul yapılamıyor', async () => {
    await expect(
      servis.malKabul(ctx, { stokKalemiId: TAVUK, miktar: 5, birim: 'kg' }, 'kabul-3'),
    ).rejects.toBeInstanceOf(LotGerekliError)

    expect(await servis.hareketler(ctx, TAVUK)).toHaveLength(0)
  })

  it('SKT takipli kalemde tarihsiz lot açılamıyor', async () => {
    await expect(
      servis.malKabul(ctx, {
        stokKalemiId: TAVUK, miktar: 5, birim: 'kg', yeniLot: { kod: 'LOT-X' },
      }, 'kabul-4'),
    ).rejects.toThrow(/son kullanma/i)
  })

  it('aynı idempotency anahtarı stoku ikiye katlamıyor', async () => {
    // Kullanıcı "Kaydet"e iki kez basarsa olan tam olarak budur.
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 40, birim: 'kg' }, 'kabul-tekrar')
    await expect(
      servis.malKabul(ctx, { stokKalemiId: UN, miktar: 40, birim: 'kg' }, 'kabul-tekrar'),
    ).rejects.toBeInstanceOf(DuplicateIdempotencyKeyError)

    expect(await miktar(UN)).toBe(40)
  })
})

describe('Depo · çıkış (FEFO)', () => {
  const ikiLotKur = async () => {
    // Bilerek TERS sırada açılıyor: FEFO'nun ekleme sırasını değil SKT'yi
    // dikkate aldığını görmek istiyoruz.
    await servis.malKabul(ctx, {
      stokKalemiId: TAVUK, miktar: 30, birim: 'kg',
      yeniLot: { kod: 'LOT-UZAK', sonKullanma: '2027-01-01' },
    }, 'kabul-uzak')
    await servis.malKabul(ctx, {
      stokKalemiId: TAVUK, miktar: 20, birim: 'kg',
      yeniLot: { kod: 'LOT-YAKIN', sonKullanma: '2026-06-01' },
    }, 'kabul-yakin')
  }

  it('önce en yakın SKT’li lottan düşüyor', async () => {
    await ikiLotKur()
    await servis.cikis(ctx, {
      stokKalemiId: TAVUK, miktar: 20, birim: 'kg', neden: 'PRODUCTION_CONSUME',
    }, 'cikis-1')

    const lotlar = await servis.lotBakiyeleri(ctx, TAVUK)
    const yakin = lotlar.find(l => l.kod === 'LOT-YAKIN')
    const uzak = lotlar.find(l => l.kod === 'LOT-UZAK')
    expect(yakin?.miktar).toBe(0)
    expect(uzak?.miktar).toBe(30)
  })

  it('tek lot yetmezse sonrakine taşıyor', async () => {
    await ikiLotKur()
    const hareketler = await servis.cikis(ctx, {
      stokKalemiId: TAVUK, miktar: 45, birim: 'kg', neden: 'PRODUCTION_CONSUME',
    }, 'cikis-2')

    expect(hareketler).toHaveLength(2)
    expect(hareketler[0].quantityBase).toBe(-20) // LOT-YAKIN tamamen
    expect(hareketler[1].quantityBase).toBe(-25) // kalanı LOT-UZAK'tan
    expect(await miktar(TAVUK)).toBe(5)
  })

  it('yetersiz stokta HİÇ hareket yazmıyor', async () => {
    await ikiLotKur()
    await expect(
      servis.cikis(ctx, {
        stokKalemiId: TAVUK, miktar: 500, birim: 'kg', neden: 'PRODUCTION_CONSUME',
      }, 'cikis-3'),
    ).rejects.toBeInstanceOf(YetersizStokError)

    // Kısmi çıkış yazılmış olsaydı defter yalan söylerdi: kullanıcı hata
    // mesajı görürken stok yine de azalmış olurdu.
    expect(await miktar(TAVUK)).toBe(50)
  })

  it('lotsuz kalemde tek hareket yazıyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, 'kabul-un')
    const hareketler = await servis.cikis(ctx, {
      stokKalemiId: UN, miktar: 30, birim: 'kg', neden: 'WASTE', not: 'İşlenirken kayıp',
    }, 'cikis-un')

    expect(hareketler).toHaveLength(1)
    expect(await miktar(UN)).toBe(70)
  })
})

describe('Depo · sayım', () => {
  it('eksik sayım farkı negatif hareket olarak yazılıyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, 'kabul-s1')
    const hareket = await servis.sayim(ctx, { stokKalemiId: UN, sayilan: 80, birim: 'kg' }, 'sayim-1')

    expect(hareket?.reason).toBe('COUNT_SHORTAGE')
    expect(hareket?.quantityBase).toBe(-20)
    expect(await miktar(UN)).toBe(80)
  })

  it('fazla sayım farkı pozitif hareket olarak yazılıyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, 'kabul-s2')
    const hareket = await servis.sayim(ctx, { stokKalemiId: UN, sayilan: 130, birim: 'kg' }, 'sayim-2')

    expect(hareket?.reason).toBe('COUNT_SURPLUS')
    expect(hareket?.quantityBase).toBe(30)
  })

  it('fark yoksa hiç hareket yazmıyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, 'kabul-s3')
    const hareket = await servis.sayim(ctx, { stokKalemiId: UN, sayilan: 100, birim: 'kg' }, 'sayim-3')

    expect(hareket).toBeNull()
    expect(await servis.hareketler(ctx, UN)).toHaveLength(1)
  })

  it('lot takipli kalemde lot seçilmeden sayım yapılamıyor', async () => {
    await expect(
      servis.sayim(ctx, { stokKalemiId: TAVUK, sayilan: 10, birim: 'kg' }, 'sayim-4'),
    ).rejects.toBeInstanceOf(LotGerekliError)
  })
})

describe('Depo · kritik stok', () => {
  it('bakiye minimumun altına düşünce işaretleniyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, 'kabul-k1')
    expect((await servis.kalemler(ctx)).find(k => k.id === UN)?.kritik).toBe(false)

    await servis.cikis(ctx, { stokKalemiId: UN, miktar: 95, birim: 'kg', neden: 'PRODUCTION_CONSUME' }, 'cikis-k1')
    expect((await servis.kalemler(ctx)).find(k => k.id === UN)?.kritik).toBe(true)
  })
})

describe('Depo · birim dönüşümü', () => {
  // Bu grubun tamamı tek bir kuralı koruyor: kullanıcı istediği birimde yazar,
  // defter tek birimde tutar, KIYASLAR temel birimde yapılır. Kıyası çevirmeyi
  // unutmak sessiz ve tehlikeli bir hatadır — testler onu kırmızıya döndürür.

  it('mal kabul kullanıcının birimini kabul eder, defter temele çevirir', async () => {
    // "2 kg baharat geldi" — kalemin defteri GRAM tutuyor.
    await servis.malKabul(ctx, { stokKalemiId: BAHARAT, miktar: 2, birim: 'kg' }, 'kabul-b3')
    expect(await miktar(BAHARAT)).toBe(2000)
  })

  it('çıkış da kullanıcının biriminde yapılabilir', async () => {
    await servis.malKabul(ctx, { stokKalemiId: BAHARAT, miktar: 2, birim: 'kg' }, 'kabul-b4')

    // 500 gram çıkar → 1500 g kalır.
    await servis.cikis(ctx, { stokKalemiId: BAHARAT, miktar: 500, birim: 'g', neden: 'WASTE', not: 'Döküldü' }, 'cikis-b4')
    expect(await miktar(BAHARAT)).toBe(1500)

    // 1 KİLO çıkar → 500 g kalır. Kıyas çevrilmeseydi "1 < 1500, yeter" denip
    // yalnızca 1 gram düşerdi ve bakiye 1499 kalırdı.
    await servis.cikis(ctx, { stokKalemiId: BAHARAT, miktar: 1, birim: 'kg', neden: 'WASTE', not: 'Döküldü' }, 'cikis-b5')
    expect(await miktar(BAHARAT)).toBe(500)
  })

  it('yetersiz stok kıyası da çevrilmiş miktarla yapılıyor', async () => {
    await servis.malKabul(ctx, {
      stokKalemiId: TAVUK, miktar: 2, birim: 'kg',
      yeniLot: { kod: 'LOT-KG', sonKullanma: '2027-01-01' },
    }, 'kabul-b6')

    // 5000 gram = 5 kg isteniyor, defterde 2 kg var → reddedilmeli.
    // Çevrilmeseydi "5000 > 2" değil, "5000 g" ile "2 kg" kıyaslanır ve
    // yanlış tarafa düşerdi.
    await expect(
      servis.cikis(ctx, { stokKalemiId: TAVUK, miktar: 5000, birim: 'g', neden: 'PRODUCTION_CONSUME' }, 'cikis-b6'),
    ).rejects.toBeInstanceOf(YetersizStokError)

    expect(await miktar(TAVUK)).toBe(2)
  })

  it('sayım farkı da çevrilmiş miktardan hesaplanıyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: BAHARAT, miktar: 2, birim: 'kg' }, 'kabul-b7')

    // Defterde 2000 g var; sayımda "1,5 kg" bulundu → fark −500 g olmalı.
    const hareket = await servis.sayim(ctx, { stokKalemiId: BAHARAT, sayilan: 1.5, birim: 'kg' }, 'sayim-b2')
    expect(hareket?.reason).toBe('COUNT_SHORTAGE')
    expect(hareket?.quantityBase).toBe(-500)
    expect(await miktar(BAHARAT)).toBe(1500)
  })

  it('çevrilemeyen birim reddediliyor ve deftere dokunulmuyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, 'kabul-b8')

    // Kütle ile adet arasında dönüşüm yok — uydurmak yerine reddediyoruz.
    await expect(
      servis.cikis(ctx, { stokKalemiId: UN, miktar: 3, birim: 'adet', neden: 'WASTE', not: 'Döküldü' }, 'cikis-b8'),
    ).rejects.toBeInstanceOf(BirimCevrilemezError)

    expect(await miktar(UN)).toBe(100)
  })
})

describe('FEFO sıralaması', () => {
  it('tarihi olmayan lot en sona düşüyor', () => {
    const sirali = fefoSirala([
      { kod: 'C', sonKullanma: undefined },
      { kod: 'A', sonKullanma: '2027-01-01' },
      { kod: 'B', sonKullanma: '2026-06-01' },
    ])
    expect(sirali.map(l => l.kod)).toEqual(['B', 'A', 'C'])
  })

  it('eşit tarihlerde sıra kod ile belirleniyor — her koşumda aynı', () => {
    const sirali = fefoSirala([
      { kod: 'Z', sonKullanma: '2026-06-01' },
      { kod: 'A', sonKullanma: '2026-06-01' },
    ])
    expect(sirali.map(l => l.kod)).toEqual(['A', 'Z'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Yol haritası: "Kritik stok ve geçerlilik uyarıları defterden okuyor"
//              Bitti sayılır ki: "Uyarılar gerçek rakamdan geliyor"
//
// Kriterin sınanabilir hâli: uyarının SAKLANMADIĞINI göstermek. Bunu kanıtlayan
// tek deney, uyarıyı doğuran şeyi değiştirip uyarının kendiliğinden değişmesini
// beklemektir. Aşağıdaki testler tam olarak bunu yapıyor: mal girince kritik
// uyarısı kayboluyor, mal çıkınca geri geliyor, lot boşalınca SKT uyarısı
// susuyor. Hiçbirinde bir bayrak güncellenmiyor.
// ═══════════════════════════════════════════════════════════════════════════

/** Testlerin tarihe göre kaymaması için sabit bir "bugün". */
const BUGUN = new Date(2026, 5, 15) // 15 Haziran 2026

const gunSonra = (gun: number) => {
  const t = new Date(BUGUN.getFullYear(), BUGUN.getMonth(), BUGUN.getDate() + gun)
  const iki = (n: number) => String(n).padStart(2, '0')
  return `${t.getFullYear()}-${iki(t.getMonth() + 1)}-${iki(t.getDate())}`
}

describe('SKT gün hesabı', () => {
  it('bugünün tarihi 0 gün', () => {
    expect(kalanGun(gunSonra(0), BUGUN)).toBe(0)
  })

  it('geçmiş tarih negatif, gelecek tarih pozitif', () => {
    expect(kalanGun(gunSonra(-3), BUGUN)).toBe(-3)
    expect(kalanGun(gunSonra(45), BUGUN)).toBe(45)
  })

  it('saat farkı sonucu kaydırmıyor — gün başına sabitleniyor', () => {
    // Günün başı ile sonunda aynı cevap gelmeli; yoksa kullanıcı aynı ekranı
    // sabah ve akşam açtığında farklı sayı görür.
    const sabah = new Date(2026, 5, 15, 0, 1)
    const gece = new Date(2026, 5, 15, 23, 59)
    expect(kalanGun(gunSonra(10), sabah)).toBe(kalanGun(gunSonra(10), gece))
  })
})

describe('Depo · kritik stok uyarısı', () => {
  it('bakiye en az seviyenin altındayken uyarı var, mal girince kendiliğinden kayboluyor', async () => {
    // UN kaleminin `minMiktar` değeri 10.
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 8, birim: 'kg' }, 'kritik-1')

    const once = await servis.uyarilar(ctx, 30, BUGUN)
    expect(once.kritikKalemler.map(k => k.id)).toContain(UN)

    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 50, birim: 'kg' }, 'kritik-2')

    const sonra = await servis.uyarilar(ctx, 30, BUGUN)
    expect(sonra.kritikKalemler.map(k => k.id)).not.toContain(UN)
  })

  it('mal çıkınca uyarı kendiliğinden geri geliyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 50, birim: 'kg' }, 'kritik-3')
    expect((await servis.uyarilar(ctx, 30, BUGUN)).kritikKalemler).toHaveLength(0)

    await servis.cikis(ctx, {
      stokKalemiId: UN, miktar: 45, birim: 'kg', neden: 'PRODUCTION_CONSUME',
    }, 'kritik-4')

    expect((await servis.uyarilar(ctx, 30, BUGUN)).kritikKalemler.map(k => k.id)).toEqual([UN])
  })

  it('en az seviyesi tanımlı olmayan kalem hiç uyarı üretmiyor', async () => {
    // BAHARAT'ın minMiktar'ı 0; bakiyesi de 0. "0 <= 0" diye kritik saymak,
    // deponun yarısını sürekli kırmızı gösterirdi.
    const uyarilar = await servis.uyarilar(ctx, 30, BUGUN)
    expect(uyarilar.kritikKalemler.map(k => k.id)).not.toContain(BAHARAT)
  })
})

describe('Depo · raf ömrü uyarısı', () => {
  it('SKT’si geçmiş ama bakiyesi olan lot "süresi geçmiş" listesine düşüyor', async () => {
    await servis.malKabul(ctx, {
      stokKalemiId: TAVUK, miktar: 20, birim: 'kg',
      yeniLot: { kod: 'LOT-ESKI', sonKullanma: gunSonra(-5) },
    }, 'skt-1')

    const uyarilar = await servis.uyarilar(ctx, 30, BUGUN)
    expect(uyarilar.suresiGecmis).toHaveLength(1)
    expect(uyarilar.suresiGecmis[0].lotKodu).toBe('LOT-ESKI')
    expect(uyarilar.suresiGecmis[0].kalanGun).toBe(-5)
    expect(uyarilar.suresiGecmis[0].miktar).toBe(20)
    expect(uyarilar.yaklasan).toHaveLength(0)
  })

  it('eşik içindeki lot "yaklaşan", eşiğin dışındaki hiç uyarı üretmiyor', async () => {
    await servis.malKabul(ctx, {
      stokKalemiId: TAVUK, miktar: 5, birim: 'kg',
      yeniLot: { kod: 'LOT-YAKIN', sonKullanma: gunSonra(10) },
    }, 'skt-2')
    await servis.malKabul(ctx, {
      stokKalemiId: TAVUK, miktar: 5, birim: 'kg',
      yeniLot: { kod: 'LOT-UZAK', sonKullanma: gunSonra(200) },
    }, 'skt-3')

    const uyarilar = await servis.uyarilar(ctx, 30, BUGUN)
    expect(uyarilar.yaklasan.map(u => u.lotKodu)).toEqual(['LOT-YAKIN'])
    expect(uyarilar.suresiGecmis).toHaveLength(0)
  })

  it('lotun bakiyesi tükenince uyarı susuyor — bayrak değil, rakam', async () => {
    await servis.malKabul(ctx, {
      stokKalemiId: TAVUK, miktar: 12, birim: 'kg',
      yeniLot: { kod: 'LOT-BITEN', sonKullanma: gunSonra(-1) },
    }, 'skt-4')

    expect((await servis.uyarilar(ctx, 30, BUGUN)).suresiGecmis).toHaveLength(1)

    // Süresi geçen mal imha ediliyor: lot boşalıyor.
    await servis.cikis(ctx, {
      stokKalemiId: TAVUK, miktar: 12, birim: 'kg', neden: 'EXPIRY_WRITE_OFF', not: 'SKT geçti',
    }, 'skt-5')

    // Lot kaydı hâlâ duruyor (defter append-only), ama uyarı yok: uyarıyı
    // doğuran şey lotun VARLIĞI değil, içindeki MALDI.
    const sonra = await servis.uyarilar(ctx, 30, BUGUN)
    expect(sonra.suresiGecmis).toHaveLength(0)
    expect((await servis.lotBakiyeleri(ctx, TAVUK)).map(l => l.kod)).toContain('LOT-BITEN')
  })

  it('en acil olan başta: süresi en çok geçmiş lot ilk sırada', async () => {
    await servis.malKabul(ctx, {
      stokKalemiId: TAVUK, miktar: 3, birim: 'kg',
      yeniLot: { kod: 'LOT-DUN', sonKullanma: gunSonra(-1) },
    }, 'skt-6')
    await servis.malKabul(ctx, {
      stokKalemiId: TAVUK, miktar: 3, birim: 'kg',
      yeniLot: { kod: 'LOT-COKESKI', sonKullanma: gunSonra(-40) },
    }, 'skt-7')

    const uyarilar = await servis.uyarilar(ctx, 30, BUGUN)
    expect(uyarilar.suresiGecmis.map(u => u.lotKodu)).toEqual(['LOT-COKESKI', 'LOT-DUN'])
  })

  it('SKT takibi olmayan kalem raf ömrü uyarısı üretmiyor', async () => {
    await servis.malKabul(ctx, { stokKalemiId: UN, miktar: 100, birim: 'kg' }, 'skt-8')

    const uyarilar = await servis.uyarilar(ctx, 30, BUGUN)
    expect(uyarilar.suresiGecmis).toHaveLength(0)
    expect(uyarilar.yaklasan).toHaveLength(0)
  })
})
