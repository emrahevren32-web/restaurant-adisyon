// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 / Depo çekirdeği — Depo servisi
//
// Ekranın konuştuğu TEK yüz. Altında iki şey var:
//   • `StockRepository`  — defter (ADR-001, I1–I12; sözleşmesi kanıtlanmış)
//   • `StokKatalogu`     — stok kartları ve lotlar
//
// Ekran ikisini de doğrudan çağırmaz. Sebebi basit: "mal kabul" tek bir iş
// gibi görünür ama aslında iki adımdır (gerekiyorsa lot oluştur, sonra deftere
// yaz) ve bu adımların sırası bir kuraldır — ekranda tekrarlanırsa, ikinci bir
// ekran yazıldığı gün sıra bozulur.
//
// ── STOKA YAZAN TEK KAPI ──────────────────────────────────────────────────
// Buradaki hiçbir metot miktarı hesaplayıp bir yere YAZMAZ. Miktar her zaman
// `defter.quantityOf()` ile defterden TÜRETİLİR ve her değişiklik
// `defter.postMovement()` üzerinden geçer. `stock_item` tablosunda zaten bir
// `current_qty` sütunu yoktur (0003) — yani bu kural burada bir tercih değil,
// şemanın kendisi.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'
import type {
  LotBalance,
  Movement,
  NewMovement,
  SourceType,
  StockRepository,
} from '../core/stock/stock.repository'
import { convertUom } from '../core/stock/uom'
import type { KatalogKalemi, KatalogLotu, StokKatalogu, YeniKalem } from './warehouse.catalog'
import { zayiNedeniMi } from './write-off.repository'
import { GerekceGerekliError, gerekceYeterliMi } from './write-off.service'

/** Ekranda gösterilen kalem: kart bilgisi + defterden türetilmiş miktar. */
export type DepoKalemi = KatalogKalemi & {
  miktar: number
  /** `minMiktar` tanımlıysa ve bakiye onun altındaysa. */
  kritik: boolean
}

/** Ekranda gösterilen lot: kart bilgisi + defterden türetilmiş bakiye. */
export type DepoLotu = KatalogLotu & { miktar: number }

/**
 * Raf ömrü uyarısı — bir kalemin bir lotu için.
 *
 * `miktar` alanı önemlidir: uyarı, lotun VAR OLMASINDAN değil, o lotta HÂLÂ
 * MAL BULUNMASINDAN doğar. Bakiyesi sıfırlanmış bir lot için "SKT'si geçti"
 * demek yanlış olurdu — o mal zaten çıkmış, tüketilmiş ya da imha edilmiştir.
 * Bakiye ise defterden geliyor. Yani uyarı gerçek rakamdan doğuyor.
 */
export type RafOmruUyarisi = {
  kalemId: string
  kalemAd: string
  lotId: string
  lotKodu: string
  sonKullanma: string
  /** Temel birimde, defterden türetilmiş kalan. */
  miktar: number
  birim: string
  /** Bugüne göre kalan gün; geçmiş tarihlerde negatif. */
  kalanGun: number
}

/** Depo ekranının tepesindeki uyarı özeti. Hepsi defterden türetilir. */
export type DepoUyarilari = {
  /** Bakiyesi en az seviyenin altına düşmüş kalemler. */
  kritikKalemler: DepoKalemi[]
  /** SKT'si geçmiş ama hâlâ bakiyesi olan lotlar — imha bekliyor. */
  suresiGecmis: RafOmruUyarisi[]
  /** Eşik gün içinde SKT'si dolacak lotlar — önce bunlar tüketilmeli. */
  yaklasan: RafOmruUyarisi[]
}

export type MalKabulGirdisi = {
  stokKalemiId: string
  miktar: number
  birim: string
  /** Var olan bir lota ekleniyorsa. */
  lotId?: string
  /** Yeni lot açılıyorsa (lot takipli kalemlerde lotId yoksa zorunlu). */
  yeniLot?: { kod: string; sonKullanma?: string; tedarikci?: string }
  birimMaliyet?: number
  paraBirimi?: string
  not?: string
}

/**
 * Çıkış nedenleri.
 *
 * `PURCHASE_RETURN` (tedarikçiye iade) 2026-09-03'te eklendi. Neden çıkış
 * listesinde: iade edilen mal DEPOYA GİRMİŞTİ ve şimdi çıkıyor. Kapıda
 * reddedilen maldan farkı budur — o hiç girmedi, dolayısıyla deftere de
 * yazılmaz. İkisini aynı şey saymak, hiç sahip olunmamış malı bir an için
 * sahip olunmuş gibi göstermek olurdu.
 */
export type CikisNedeni =
  | 'PRODUCTION_CONSUME'
  | 'PRODUCTION_WASTE'
  | 'SHIPMENT_OUT'
  | 'WASTE'
  | 'LOSS'
  | 'EXPIRY_WRITE_OFF'
  | 'PURCHASE_RETURN'

export type CikisGirdisi = {
  stokKalemiId: string
  miktar: number
  birim: string
  neden: CikisNedeni
  /** Belirtilirse bu lottan düşülür; belirtilmezse lot takipli kalemde FEFO uygulanır. */
  lotId?: string
  /**
   * Bu çıkışı doğuran belgenin kimliği (iş emri, sevkiyat…).
   *
   * Lot soyağacı bunun üzerine kurulu: "bu mamulün içinde hangi lotlar var"
   * sorusu, `source_id` bu iş emrine eşit olan çıkış hareketlerinin `lot_id`
   * alanlarından cevaplanıyor. Yazılmazsa zincir defterde kopar ve geri
   * çağırma listesi üretilemez.
   */
  kaynakId?: string
  not?: string
}

/**
 * Çıkış nedeninin hangi belge türünden geldiği.
 *
 * Eskiden tek satırlık bir üçlü koşuldu ve satın alma iadesini de "work_order"
 * sayıyordu — yanlış. Defterdeki `source_type`, "bu hareketi hangi süreç
 * doğurdu" sorusunun cevabıdır ve raporlar buna göre süzülür.
 */
const cikisKaynakTipi = (neden: CikisNedeni): SourceType => {
  if(neden === 'SHIPMENT_OUT') return 'shipment'
  if(neden === 'PURCHASE_RETURN') return 'goods_receipt'
  if(neden === 'PRODUCTION_CONSUME' || neden === 'PRODUCTION_WASTE') return 'work_order'
  return 'manual'
}

/** Üretimden çıkan mamulün deftere yazılması. */
export type UretimGirisiGirdisi = {
  stokKalemiId: string
  miktar: number
  birim: string
  /** Var olan bir lota ekleniyorsa. */
  lotId?: string
  /** Yeni lot açılıyorsa (lot takipli kalemlerde lotId yoksa zorunlu). */
  yeniLot?: { kod: string; sonKullanma?: string }
  /** İş emrinin kimliği — soyağacının mamul tarafı. */
  kaynakId?: string
  birimMaliyet?: number
  paraBirimi?: string
  not?: string
}

export type SayimGirdisi = {
  stokKalemiId: string
  /** Fiziksel olarak SAYILAN miktar (fark değil, mutlak değer). */
  sayilan: number
  birim: string
  /** Lot takipli kalemlerde zorunlu: sayım hangi lot için yapıldı. */
  lotId?: string
  not?: string
}

/** Sayım BELGESİNDEN gelen fark. Fark önceden hesaplanmıştır, temel birimdedir. */
export type SayimFarkiGirdisi = {
  stokKalemiId: string
  lotId?: string
  /** İşaretli fark: fazla +, eksik −. Temel birimde. */
  fark: number
  birim: string
  /** Sayım belgesinin kimliği — kilidin tanıdığı anahtar. */
  sayimId: string
  not?: string
}

export class YetersizStokError extends Error {
  constructor(
    public readonly stokKalemiId: string,
    public readonly istenen: number,
    public readonly mevcut: number,
  ) {
    super(
      `Yetersiz stok: ${istenen} istendi, defterde ${mevcut} var. `
      + 'Lot takipli kalemlerde çıkış, var olan lot bakiyelerinden fazlasını alamaz.',
    )
    this.name = 'YetersizStokError'
  }
}

/**
 * Girilen birim kalemin temel birimine ÇEVRİLEMİYOR.
 *
 * Örnek: temel birimi `kg` olan bir kaleme `adet` cinsinden çıkış. Kütle ile
 * sayı arasında bir dönüşüm yoktur — kaç adet bir kilo eder, kaleme göre değişir
 * ve sistemin bilmediği bir şeydir. Uydurmak yerine reddediyoruz.
 */
export class BirimCevrilemezError extends Error {
  constructor(
    public readonly istenen: string,
    public readonly temelBirim: string,
    kalemAdi: string,
  ) {
    super(
      `"${kalemAdi}" kaleminin defteri "${temelBirim}" cinsinden tutuluyor ve `
      + `"${istenen}" bu birime çevrilemiyor. Farklı ölçü aileleri (kütle, hacim, adet) `
      + 'arasında dönüşüm tanımlı değildir.',
    )
    this.name = 'BirimCevrilemezError'
  }
}

export class LotGerekliError extends Error {
  constructor(kalemAdi: string) {
    super(`"${kalemAdi}" lot takipli bir kalem: işlem için bir lot seçilmeli veya yeni lot açılmalı.`)
    this.name = 'LotGerekliError'
  }
}

/**
 * FEFO sırası — First Expired, First Out.
 *
 * Endüstriyel mutfakta doğru sıra budur: en yakın SKT'li parti önce tüketilir,
 * yoksa raf ömrü dolar ve mal fire olur. Tarihi olmayan lotlar EN SONA düşer;
 * tarihsiz bir lotu öne almak, tarihi yaklaşan malı rafta bırakmak olurdu.
 * Eşitlikte lot kodu kullanılıyor ki sıra her koşumda aynı olsun — rastgele
 * sıra, aynı girdiyle farklı hareketler üretirdi.
 */
export const fefoSirala = <T extends { sonKullanma?: string; kod: string }>(lotlar: T[]): T[] =>
  [...lotlar].sort((a, b) => {
    if(a.sonKullanma && b.sonKullanma) return a.sonKullanma.localeCompare(b.sonKullanma) || a.kod.localeCompare(b.kod)
    if(a.sonKullanma) return -1
    if(b.sonKullanma) return 1
    return a.kod.localeCompare(b.kod)
  })

const yuvarla = (deger: number) => Math.round(deger * 1e6) / 1e6

/** Varsayılan uyarı eşiği: SKT'ye bu kadar gün kalınca uyar. */
export const YAKLASAN_SKT_GUN = 30

/**
 * SKT'ye kalan gün sayısı.
 *
 * ── NEDEN SAAT DEĞİL GÜN ─────────────────────────────────────────────────
 * `expires_on` bir TARİHTİR (saat taşımaz). İki tarih arasını milisaniyeden
 * hesaplayıp bölmek, saat farkı yüzünden "0 gün" ile "1 gün" arasında gidip
 * gelen bir sonuç üretir — kullanıcı aynı ekranı iki kez açtığında farklı
 * sayı görür. Bu yüzden iki tarafı da GÜN BAŞINA sabitliyoruz.
 *
 * Yerel saat dilimi bilerek kullanılıyor: kullanıcı "bugün" derken kendi
 * takvim gününü kastediyor, UTC'yi değil.
 */
export const kalanGun = (sonKullanma: string, bugun: Date = new Date()): number => {
  const [yil, ay, gun] = sonKullanma.slice(0, 10).split('-').map(Number)
  if(!yil || !ay || !gun) return Number.NaN

  const skt = new Date(yil, ay - 1, gun).getTime()
  const bugunBasi = new Date(bugun.getFullYear(), bugun.getMonth(), bugun.getDate()).getTime()
  return Math.round((skt - bugunBasi) / 86400000)
}

/**
 * Miktarı kalemin TEMEL birimine çevirir.
 *
 * ── NEDEN ZORUNLU ────────────────────────────────────────────────────────
 * Çıkış ve sayım, girileni defterdeki bakiyeyle KIYASLAR ve bakiye her zaman
 * temel birimdedir. Kıyası çevirmeden yapmak sessiz ve tehlikeli bir hatadır:
 * temel birimi `g` olan bir kaleme `2 kg` çıkış istendiğinde kıyas
 * "2 < 49960, yeter" der — oysa istenen 2000 g'dır.
 *
 * Dönüşüm tablosu `core/stock/uom.ts`'te ve veritabanındaki
 * `app.convert_uom()` ile birebir aynı sayıları taşıyor (I7). Yani ekranın
 * yaptığı kıyas ile defterin yaptığı çevrim ayrışamaz.
 */
const temeleCevir = (miktar: number, birim: string, kalem: KatalogKalemi): number => {
  try {
    return yuvarla(convertUom(miktar, birim, kalem.temelBirim))
  } catch {
    throw new BirimCevrilemezError(birim, kalem.temelBirim, kalem.ad)
  }
}

/**
 * Verilen birimlerden, bu kalemin defterine çevrilebilenler.
 *
 * Ekran birim listesini bununla süzüyor: kullanıcıya seçemeyeceği bir birim
 * göstermek, hatayı forma değil kaydet düğmesine ertelemek olurdu.
 */
export const cevrilebilirBirimler = (temelBirim: string, birimKodlari: string[]): string[] =>
  birimKodlari.filter(kod => {
    try { convertUom(1, kod, temelBirim); return true } catch { return false }
  })

export class DepoServisi {
  constructor(
    private readonly defter: StockRepository,
    private readonly katalog: StokKatalogu,
  ) {}

  /** Tüm kalemler, her birinin bakiyesi defterden türetilmiş hâlde. */
  async kalemler(ctx: TenantCtx): Promise<DepoKalemi[]> {
    const kartlar = await this.katalog.kalemler(ctx)
    const miktarlar: number[] = await Promise.all(
      kartlar.map(kart => this.defter.quantityOf(ctx, kart.id)),
    )
    return kartlar.map((kart, i) => {
      const miktar = yuvarla(miktarlar[i])
      return {
        ...kart,
        miktar,
        kritik: kart.minMiktar > 0 && miktar <= kart.minMiktar,
      }
    })
  }

  /**
   * Depo uyarıları — hepsi defterden türetilir, hiçbiri saklanmaz.
   *
   * ── YOL HARİTASI MADDESİ ─────────────────────────────────────────────
   * "Kritik stok ve geçerlilik uyarıları defterden okuyor"
   * Bitti sayılır ki: "Uyarılar gerçek rakamdan geliyor"
   *
   * Bu kriterin anlamı şudur: uyarı, bir yere yazılmış bir bayrak DEĞİLDİR.
   * Eski sistemde "kritik" bir alan olsaydı, mal girişi yapıldığında o alanı
   * güncellemeyi unutan tek bir kod yolu, ekranı sonsuza kadar yalancı
   * yapardı. Burada uyarı her okumada bakiyeden yeniden doğuyor: mal girince
   * kendiliğinden kayboluyor, tükenince kendiliğinden geliyor.
   *
   * Aynı sebeple raf ömrü uyarısı lotun VARLIĞINA değil BAKİYESİNE bakıyor.
   * Bakiyesi sıfırlanmış bir lot için "SKT'si geçti" demek, çoktan imha
   * edilmiş bir malı her gün tekrar bildirmek olurdu — ve kullanıcı bir süre
   * sonra bütün uyarılara bakmaz olurdu.
   */
  async uyarilar(
    ctx: TenantCtx,
    esikGun: number = YAKLASAN_SKT_GUN,
    bugun: Date = new Date(),
  ): Promise<DepoUyarilari> {
    const tumKalemler = await this.kalemler(ctx)

    // Lot bakiyesi yalnızca SKT takipli kalemler için sorgulanıyor. Diğerlerinde
    // sorulacak bir raf ömrü yok; hepsini sorgulamak sonucu değiştirmez, sadece
    // depodaki her kalem için gereksiz bir tur atardı.
    const sktliKalemler = tumKalemler.filter(kalem => kalem.sktTakipli)
    const lotDemetleri = await Promise.all(
      sktliKalemler.map(kalem => this.lotBakiyeleri(ctx, kalem.id)),
    )

    const suresiGecmis: RafOmruUyarisi[] = []
    const yaklasan: RafOmruUyarisi[] = []

    sktliKalemler.forEach((kalem, i) => {
      lotDemetleri[i].forEach(lot => {
        // Bakiyesi kalmamış lot uyarı üretmez: o mal artık depoda değil.
        if(lot.miktar <= 0) return
        // Tarihsiz lot uyarı üretmez: hakkında söylenecek bir şey yok.
        if(!lot.sonKullanma) return

        const gun = kalanGun(lot.sonKullanma, bugun)
        if(Number.isNaN(gun)) return

        const uyari: RafOmruUyarisi = {
          kalemId: kalem.id,
          kalemAd: kalem.ad,
          lotId: lot.id,
          lotKodu: lot.kod,
          sonKullanma: lot.sonKullanma,
          miktar: lot.miktar,
          birim: kalem.temelBirim,
          kalanGun: gun,
        }

        if(gun < 0) suresiGecmis.push(uyari)
        else if(gun <= esikGun) yaklasan.push(uyari)
      })
    })

    // En acili en üstte: süresi en çok geçmiş, sonra SKT'si en yakın olan.
    suresiGecmis.sort((a, b) => a.kalanGun - b.kalanGun)
    yaklasan.sort((a, b) => a.kalanGun - b.kalanGun)

    return {
      kritikKalemler: tumKalemler.filter(kalem => kalem.kritik),
      suresiGecmis,
      yaklasan,
    }
  }

  kalemEkle(ctx: TenantCtx, girdi: YeniKalem): Promise<KatalogKalemi> {
    return this.katalog.kalemEkle(ctx, girdi)
  }

  /** Bir kalemin hareket dökümü — "bu rakam nereden geldi" sorusunun cevabı. */
  hareketler(ctx: TenantCtx, stokKalemiId: string): Promise<Movement[]> {
    return this.defter.ledgerOf(ctx, stokKalemiId)
  }

  /**
   * Bir hareketi TERS KAYITLA geri alır.
   *
   * Defter append-only'dir (ADR-001): yanlış bir hareket SİLİNMEZ, karşıtı
   * yazılır. Bakiye eski değerine döner ama ikisi de defterde durur — "neden
   * bu rakam değişti" sorusunun cevabı böyle korunur.
   */
  tersKayit(ctx: TenantCtx, hareketId: string, idempotencyKey: string): Promise<Movement> {
    return this.defter.reverseMovement(ctx, hareketId, idempotencyKey)
  }

  /** Lot bakiyeleri, kart bilgisiyle birleştirilmiş ve FEFO sırasında. */
  async lotBakiyeleri(ctx: TenantCtx, stokKalemiId: string): Promise<DepoLotu[]> {
    // Tip açıkça yazılıyor: `Promise.all` ile gelen demeti çıkarıma bırakmak,
    // iki elemandan biri bir gün `any`'ye düşerse diğerini de sessizce
    // `any` yapar ve aşağıdaki eşleştirme tip denetiminden kaçardı.
    const [bakiyeler, kartlar]: [LotBalance[], KatalogLotu[]] = await Promise.all([
      this.defter.lotBalances(ctx, stokKalemiId),
      this.katalog.lotlar(ctx, stokKalemiId),
    ])
    const bakiyeHaritasi = new Map<string, number>(bakiyeler.map(b => [b.lotId, b.qty]))
    return fefoSirala(kartlar).map(lot => ({ ...lot, miktar: yuvarla(bakiyeHaritasi.get(lot.id) ?? 0) }))
  }

  // ── MAL KABUL ────────────────────────────────────────────────────────────
  async malKabul(
    ctx: TenantCtx,
    girdi: MalKabulGirdisi,
    idempotencyKey: string,
  ): Promise<Movement> {
    if(girdi.miktar <= 0) throw new Error('Mal kabul miktarı 0’dan büyük olmalıdır.')

    const kalem = await this.kalemiBul(ctx, girdi.stokKalemiId)

    let lotId = girdi.lotId
    if(kalem.lotTakipli && !lotId){
      if(!girdi.yeniLot?.kod) throw new LotGerekliError(kalem.ad)
      if(kalem.sktTakipli && !girdi.yeniLot.sonKullanma){
        throw new Error(`"${kalem.ad}" SKT takipli: yeni lot için son kullanma tarihi zorunludur.`)
      }
      // Lot ÖNCE açılır, hareket SONRA yazılır. Ters sıra mümkün değil: hareket
      // var olmayan bir lota bağlanamaz (yabancı anahtar).
      const lot = await this.katalog.lotEkle(ctx, {
        stokKalemiId: kalem.id,
        kod: girdi.yeniLot.kod,
        sonKullanma: girdi.yeniLot.sonKullanma,
        tedarikci: girdi.yeniLot.tedarikci,
        kaynakTipi: 'RECEIPT',
      })
      lotId = lot.id
    }

    const hareket: NewMovement = {
      stockItemId: kalem.id,
      lotId,
      quantity: girdi.miktar,
      uom: girdi.birim,
      reason: 'PURCHASE_RECEIPT',
      sourceType: 'goods_receipt',
      unitCost: girdi.birimMaliyet,
      currency: girdi.paraBirimi,
      note: girdi.not,
    }
    return this.defter.postMovement(ctx, hareket, idempotencyKey)
  }

  // ── ÜRETİM ÇIKTISI ───────────────────────────────────────────────────────
  /**
   * Üretimden çıkan mamulü deftere yazar.
   *
   * Mal kabulün aynası: o dışarıdan gelen malı, bu içeride üretileni yazar.
   * İki fark var ve ikisi de izlenebilirlik içindir:
   *
   *   • Lotun kaynak tipi `PRODUCTION` — "bu parti satın alınmadı, üretildi".
   *     Geri çağırmada zincir burada yön değiştirir: mamul lotundan iş emrine,
   *     iş emrinden tüketilen hammadde lotlarına inilir.
   *   • `sourceId` iş emrine bağlanır. Yazılmazsa mamul defterde durur ama
   *     "hangi üretimden çıktı" sorusu cevapsız kalır.
   */
  async uretimGirisi(
    ctx: TenantCtx,
    girdi: UretimGirisiGirdisi,
    idempotencyKey: string,
  ): Promise<Movement> {
    if(girdi.miktar <= 0) throw new Error('Üretim miktarı 0’dan büyük olmalıdır.')

    const kalem = await this.kalemiBul(ctx, girdi.stokKalemiId)

    let lotId = girdi.lotId
    if(kalem.lotTakipli && !lotId){
      if(!girdi.yeniLot?.kod) throw new LotGerekliError(kalem.ad)
      if(kalem.sktTakipli && !girdi.yeniLot.sonKullanma){
        throw new Error(`"${kalem.ad}" SKT takipli: yeni lot için son kullanma tarihi zorunludur.`)
      }
      const lot = await this.katalog.lotEkle(ctx, {
        stokKalemiId: kalem.id,
        kod: girdi.yeniLot.kod,
        sonKullanma: girdi.yeniLot.sonKullanma,
        kaynakTipi: 'PRODUCTION',
      })
      lotId = lot.id
    }

    return this.defter.postMovement(ctx, {
      stockItemId: kalem.id,
      lotId,
      quantity: girdi.miktar,
      uom: girdi.birim,
      reason: 'PRODUCTION_OUTPUT',
      sourceType: 'work_order',
      sourceId: girdi.kaynakId,
      unitCost: girdi.birimMaliyet,
      currency: girdi.paraBirimi,
      note: girdi.not,
    }, idempotencyKey)
  }

  // ── ÇIKIŞ / TÜKETİM ──────────────────────────────────────────────────────
  /**
   * Lot takipli kalemlerde çıkış birden çok lota bölünebilir; bu yüzden geriye
   * hareket DİZİSİ döner. Her parça kendi idempotency anahtarını taşır
   * (`${idempotencyKey}:lot:${sıra}`) — aynı çıkış iki kez gönderilirse
   * parçaların hiçbiri tekrar yazılmaz (I2).
   */
  async cikis(
    ctx: TenantCtx,
    girdi: CikisGirdisi,
    idempotencyKey: string,
  ): Promise<Movement[]> {
    if(girdi.miktar <= 0) throw new Error('Çıkış miktarı 0’dan büyük olmalıdır.')

    // Fire/zayi/imhanın belgesi yoktur; tek dayanağı yazanın beyanıdır.
    // Bu yüzden gerekçe EKRAN kuralı değil SERVİS kuralı: hangi ekrandan,
    // hangi toplu işten gelirse gelsin boş geçilemez.
    if(zayiNedeniMi(girdi.neden) && !gerekceYeterliMi(girdi.not)){
      throw new GerekceGerekliError(girdi.neden)
    }

    const kalem = await this.kalemiBul(ctx, girdi.stokKalemiId)
    // Kıyaslar temel birimde yapılır; girilen değer önce oraya çevrilir.
    const istenenTemel = temeleCevir(girdi.miktar, girdi.birim, kalem)

    const yaz = (miktar: number, birim: string, lotId: string | undefined, anahtarEki: string) =>
      this.defter.postMovement(ctx, {
        stockItemId: kalem.id,
        lotId,
        // İşaret burada veriliyor: defter işaretli tutulur (ADR-001), çıkış negatiftir.
        quantity: -miktar,
        uom: birim,
        reason: girdi.neden,
        sourceType: cikisKaynakTipi(girdi.neden),
        sourceId: girdi.kaynakId,
        note: girdi.not,
      }, `${idempotencyKey}${anahtarEki}`)

    if(!kalem.lotTakipli){
      // Lotsuz kalem: tek hareket. Kullanıcının YAZDIĞI birim olduğu gibi
      // deftere geçer (`quantity_entered`/`uom_entered`) — denetimde "kaç kilo
      // dedi" sorusunun cevabı böyle korunur. Çevrimi defter kendisi yapar.
      // Negatife düşme kararı da defterin/politikanın işi (I12).
      return [await yaz(girdi.miktar, girdi.birim, girdi.lotId, '')]
    }

    if(girdi.lotId){
      const secilen = (await this.lotBakiyeleri(ctx, kalem.id)).find(lot => lot.id === girdi.lotId)
      if(!secilen) throw new Error('Seçilen lot bu kaleme ait değil.')
      if(secilen.miktar < istenenTemel){
        throw new YetersizStokError(kalem.id, istenenTemel, secilen.miktar)
      }
      return [await yaz(girdi.miktar, girdi.birim, girdi.lotId, '')]
    }

    // FEFO dağıtımı
    const lotlar = (await this.lotBakiyeleri(ctx, kalem.id)).filter(lot => lot.miktar > 0)
    const toplam = yuvarla(lotlar.reduce((acc, lot) => acc + lot.miktar, 0))
    if(toplam < istenenTemel){
      // Lot takipli bir kalemde "olmayan lottan çıkış" diye bir şey yoktur.
      // Politika `allow` olsa bile hangi lottan düşüleceği belirsiz kalırdı;
      // bu yüzden burada bilinçli olarak REDDEDİYORUZ.
      throw new YetersizStokError(kalem.id, istenenTemel, toplam)
    }

    const hareketler: Movement[] = []
    let kalan = istenenTemel
    let sira = 0
    for(const lot of lotlar){
      if(kalan <= 0) break
      const pay = yuvarla(Math.min(lot.miktar, kalan))
      if(pay <= 0) continue
      // Parçalar TEMEL birimde yazılır. Kullanıcının yazdığı birimde yazmak
      // yanlış olurdu: "60 kg" isteğinin 49,96 kg + 10,04 kg diye bölünmesi
      // kullanıcının söylediği bir şey değil, sistemin türettiği bir dağıtımdır.
      hareketler.push(await yaz(pay, kalem.temelBirim, lot.id, `:lot:${sira}`))
      kalan = yuvarla(kalan - pay)
      sira += 1
    }
    return hareketler
  }

  // ── SKT İMHASI ───────────────────────────────────────────────────────────
  /**
   * SKT'si geçmiş lotların TOPLU imhası.
   *
   * ── Neden lotun tamamı ────────────────────────────────────────────────
   * Süresi geçmiş bir lotun bir kısmını imha edip kalanını depoda bırakmak
   * anlamsızdır; kalan da geçmiştir. Bu yüzden miktar kullanıcıdan değil
   * DEFTERDEN gelir: imha anındaki tam bakiye. Kullanıcının ekranda gördüğü
   * rakamı geri göndermesini beklemek, arada değişmiş bir bakiyeyi sessizce
   * yanlış yazmak demek olurdu.
   *
   * ── Neden `imha:lotId` anahtarı ───────────────────────────────────────
   * Düğmeye iki kez basılırsa ikinci imha YAZILMAZ (I2). Anahtar lota
   * sabitlenmiş: bir lot bir kez imha edilir. Sonradan aynı lota mal
   * girer ve o da imha edilmesi gerekirse ayrı çıkış ekranı kullanılır —
   * nadir durum, ve sessiz mükerrer kayıttan iyidir.
   *
   * ── Neden tek tek, toplu değil ────────────────────────────────────────
   * Bir lotun imhası hata verirse (bakiye değişmiş, kilit var) diğerleri
   * yazılmaya devam eder ve hangi lotta ne olduğu raporlanır. Hepsini tek
   * işleme bağlamak, tek bir sorunlu lot yüzünden 30 lotun imhasını
   * engellerdi.
   */
  async imhaEt(
    ctx: TenantCtx,
    lotlar: Array<{ kalemId: string; lotId: string }>,
    gerekce: string,
  ): Promise<{ yazilan: Movement[]; hatalar: Array<{ lotId: string; mesaj: string }> }> {
    if(!gerekceYeterliMi(gerekce)) throw new GerekceGerekliError('EXPIRY_WRITE_OFF')

    const yazilan: Movement[] = []
    const hatalar: Array<{ lotId: string; mesaj: string }> = []

    for(const hedef of lotlar){
      try {
        const kalem = await this.kalemiBul(ctx, hedef.kalemId)
        const lot = (await this.lotBakiyeleri(ctx, hedef.kalemId))
          .find(l => l.id === hedef.lotId)
        if(!lot) throw new Error('Lot bu kaleme ait değil.')
        if(lot.miktar <= 0) throw new Error('Lotta imha edilecek bakiye kalmamış.')

        const hareketler = await this.cikis(ctx, {
          stokKalemiId: hedef.kalemId,
          // Bakiye TEMEL birimdedir; imha da temel birimde yazılır.
          miktar: lot.miktar,
          birim: kalem.temelBirim,
          neden: 'EXPIRY_WRITE_OFF',
          lotId: hedef.lotId,
          not: gerekce.trim(),
        }, `imha:${hedef.lotId}`)
        yazilan.push(...hareketler)
      } catch(hata){
        hatalar.push({
          lotId: hedef.lotId,
          mesaj: hata instanceof Error ? hata.message : 'Bilinmeyen hata',
        })
      }
    }

    return { yazilan, hatalar }
  }

  // ── SAYIM ────────────────────────────────────────────────────────────────
  /**
   * Fiziksel sayım sonucunu deftere işler.
   *
   * Deftere yazılan şey sayılan miktar DEĞİL, FARKTIR — çünkü defter mutlak
   * değerleri değil değişimleri saklar (I1). Fark sıfırsa hiçbir şey yazılmaz
   * ve `null` döner: değişmeyen bir şey için hareket açmak, dökümü gürültüyle
   * doldurur.
   */
  async sayim(
    ctx: TenantCtx,
    girdi: SayimGirdisi,
    idempotencyKey: string,
  ): Promise<Movement | null> {
    if(girdi.sayilan < 0) throw new Error('Sayım sonucu negatif olamaz.')

    const kalem = await this.kalemiBul(ctx, girdi.stokKalemiId)
    const sayilanTemel = temeleCevir(girdi.sayilan, girdi.birim, kalem)

    let mevcut: number
    if(kalem.lotTakipli){
      if(!girdi.lotId) throw new LotGerekliError(kalem.ad)
      const lot = (await this.lotBakiyeleri(ctx, kalem.id)).find(l => l.id === girdi.lotId)
      if(!lot) throw new Error('Seçilen lot bu kaleme ait değil.')
      mevcut = lot.miktar
    } else {
      mevcut = yuvarla(await this.defter.quantityOf(ctx, kalem.id))
    }

    const fark = yuvarla(sayilanTemel - mevcut)
    if(fark === 0) return null

    return this.defter.postMovement(ctx, {
      stockItemId: kalem.id,
      lotId: girdi.lotId,
      // Deftere yazılan FARK'tır ve fark temel birimde hesaplandı. Kullanıcının
      // yazdığı değer nota geçiyor: "40 kg saydım" bilgisi denetimde kaybolmasın.
      quantity: fark,
      uom: kalem.temelBirim,
      reason: fark > 0 ? 'COUNT_SURPLUS' : 'COUNT_SHORTAGE',
      sourceType: 'count',
      note: girdi.not
        ?? `Sayım: ${girdi.sayilan} ${girdi.birim} (defterde ${mevcut} ${kalem.temelBirim})`,
    }, idempotencyKey)
  }

  /**
   * Sayım BELGESİNİN yazdığı fark hareketi.
   *
   * `sayim()`'den farkı: fark burada ZATEN HESAPLANMIŞTIR ve belge kimliğiyle
   * birlikte gelir. Belge kimliği şart, çünkü 0025'teki sayım kilidi tam olarak
   * ona bakıyor: açık bir sayımdaki kaleme yazılabilen tek hareket, o sayımın
   * kendi hareketidir (`source_type = 'count'` ve `source_id = sayım kimliği`).
   * Kimliği geçmezsek kendi kilidimize takılırız.
   */
  async sayimFarki(
    ctx: TenantCtx,
    girdi: SayimFarkiGirdisi,
    idempotencyKey: string,
  ): Promise<Movement> {
    if(girdi.fark === 0){
      throw new Error('Fark sıfırken hareket yazılmaz.')
    }
    const kalem = await this.kalemiBul(ctx, girdi.stokKalemiId)
    if(kalem.lotTakipli && !girdi.lotId) throw new LotGerekliError(kalem.ad)

    return this.defter.postMovement(ctx, {
      stockItemId: kalem.id,
      lotId: girdi.lotId,
      // Fark zaten temel birimde geldi (beklenen de sayılan da temel birimde
      // tutuluyor); burada ikinci bir dönüşüm YAPILMAZ — çift dönüşüm bin
      // katlık sessiz hatanın klasik yeridir.
      quantity: girdi.fark,
      uom: kalem.temelBirim,
      reason: girdi.fark > 0 ? 'COUNT_SURPLUS' : 'COUNT_SHORTAGE',
      sourceType: 'count',
      sourceId: girdi.sayimId,
      note: girdi.not,
    }, idempotencyKey)
  }

  private async kalemiBul(ctx: TenantCtx, stokKalemiId: string): Promise<KatalogKalemi> {
    const kalem = (await this.katalog.kalemler(ctx)).find(k => k.id === stokKalemiId)
    if(!kalem) throw new Error(`Stok kalemi bulunamadı: ${stokKalemiId}`)
    return kalem
  }
}
