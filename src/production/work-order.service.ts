// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / Üretim — İş emri servisi
//
// Yol haritası maddeleri:
//   "Üretim iş emri açma"                        → Yetersiz stokla başlatılamıyor
//   "Hammadde tüketimi deftere yazıyor"          → FEFO ile en yakın SKT'li lot
//   "Mamul girişi + yeni lot oluşumu"            → Verim oranı hesaba katılıyor
//   "Üretim firesi ayrı hareket olarak yazılıyor"→ Fire gizlenmiyor
//   "İptal edilen iş emri tüketimi geri alıyor"  → Ters kayıtla, silmeyle değil
//
// ── ÜÇ AN, ÜÇ DEFTER YAZIMI ──────────────────────────────────────────────
//   BAŞLAT   — hammadde çıkışları (PRODUCTION_CONSUME). FEFO'yu `DepoServisi`
//              yapıyor; bu dosya lot seçmiyor, seçtirmiyor.
//   TAMAMLA  — mamul girişi (PRODUCTION_OUTPUT) + varsa fire (PRODUCTION_WASTE).
//   İPTAL    — yazılmış her hareketin TERSİ. Silme yok (ADR-001).
//
// Bu dosya deftere DOĞRUDAN dokunmaz: her şey `DepoServisi` üzerinden geçer,
// o da `postMovement()` kapısından. Mimari test bunu zorluyor.
//
// ── NEDEN İDEMPOTENCY ANAHTARI SATIR KİMLİĞİNE SABİT ─────────────────────
// `ue:${satirId}` — rastgele değil. Ağ koptuğunda kullanıcı "Başlat"a tekrar
// basar; aynı anahtar aynı hareketi ikinci kez yazmaz (I2). Rastgele anahtar
// kullansaydık ikinci basış depoyu bir kez daha boşaltırdı.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'
import type { Movement } from '../core/stock/stock.repository'
import type { DepoServisi } from '../warehouse/warehouse.service'
import type { KatalogKalemi } from '../warehouse/warehouse.catalog'
import { maliyetiHesapla } from '../warehouse/stock-cost'
import {
  IS_EMRI_GECISLERI,
  type IsEmri,
  type IsEmriDeposu,
  type IsEmriDurumu,
  type IsEmriSatiri,
  type YeniIsEmri,
} from './work-order.repository'
import { hepsiYeterli, yeterliligiHesapla, type YeterlilikSatiri } from './recipe.service'

export class IsEmriDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'IsEmriDogrulamaError'
  }
}

export class YetersizStokIleBaslatilamazError extends Error {
  constructor(public readonly eksikler: readonly YeterlilikSatiri[]) {
    const liste = eksikler
      .map(e => `${e.satir.stokKalemiAd ?? e.satir.stokKalemiId}: ${e.eksik} ${e.birim} eksik`)
      .join(', ')
    super(`Depoda yeterli hammadde yok. ${liste}`)
    this.name = 'YetersizStokIleBaslatilamazError'
  }
}

export class GecersizIsEmriGecisiError extends Error {
  constructor(mevcut: IsEmriDurumu, istenen: IsEmriDurumu) {
    super(`İş emri "${mevcut}" durumundan "${istenen}" durumuna geçemez.`)
    this.name = 'GecersizIsEmriGecisiError'
  }
}

const yuvarla = (d: number) => Math.round(d * 1e6) / 1e6
const paraYuvarla = (d: number) => Math.round(d * 100) / 100

/**
 * İş emri satırlarını `recipe.service`'in yeterlilik biçimine çevirir.
 *
 * İş emri satırı planı ZATEN brüt taşıyor (fire ve verim reçeteden
 * ölçeklenirken uygulandı ve kopyalandı). Bu yüzden net = brüt.
 */
const yeterlilikGirdisi = (satirlar: readonly IsEmriSatiri[]) =>
  satirlar.map(satir => ({
    satir: {
      id: satir.id,
      stokKalemiId: satir.stokKalemiId,
      stokKalemiAd: satir.stokKalemiAd,
      miktar: satir.planlananMiktar,
      birim: satir.birim,
      firePayi: 0,
      siraNo: satir.siraNo,
    },
    netMiktar: satir.planlananMiktar,
    brutMiktar: satir.planlananMiktar,
    birim: satir.birim,
  }))

export type TamamlamaGirdisi = {
  /** Gerçekten çıkan mamul miktarı. Plandan farklı olabilir — olmalıdır da. */
  uretilenMiktar: number
  /** Mamul lot takipliyse zorunlu. */
  lotKodu?: string
  sonKullanma?: string
  /**
   * Üretim sırasında ZAYİ OLAN hammadde.
   *
   * Planlanan tüketimden AYRI yazılır (PRODUCTION_WASTE): "reçeteye göre
   * kullandık" ile "yere döktük" aynı satıra düşerse, fire oranı hiçbir zaman
   * görünmez ve iyileştirilemez.
   */
  fireler?: Array<{ stokKalemiId: string; miktar: number; birim: string; neden?: string }>
  not?: string
}

export type UretimMaliyeti = {
  /** Tüketilen hammaddenin toplam parasal değeri. */
  toplamMaliyet: number
  /** Mamulün birim maliyeti — çıktı biriminde. */
  birimMaliyet: number
  /** Maliyeti bilinmeyen (fiyatsız) hammadde var mı? */
  eksikVeri: boolean
}

export class IsEmriServisi {
  constructor(
    private readonly depo: IsEmriDeposu,
    private readonly depoServisi: DepoServisi,
  ) {}

  hepsi(ctx: TenantCtx): Promise<IsEmri[]> { return this.depo.hepsi(ctx) }
  tekil(ctx: TenantCtx, id: string): Promise<IsEmri> { return this.depo.tekil(ctx, id) }

  async ekle(ctx: TenantCtx, girdi: YeniIsEmri): Promise<IsEmri> {
    return this.depo.ekle(ctx, this.dogrula(girdi))
  }

  async guncelle(ctx: TenantCtx, isEmri: IsEmri, girdi: YeniIsEmri): Promise<IsEmri> {
    if(isEmri.durum !== 'DRAFT'){
      // Başlamış bir iş emrinin planını değiştirmek, defterde yazılı olanla
      // kâğıtta yazılanı ayırırdı.
      throw new IsEmriDogrulamaError(
        'Yalnızca taslak iş emri düzenlenebilir. Başlamış üretimin planı değiştirilemez.',
      )
    }
    return this.depo.guncelle(ctx, isEmri.id, this.dogrula(girdi))
  }

  /**
   * Yeterlilik durumu — ekran "Başlat" düğmesini buna bakarak açar.
   *
   * @param bakiyeler Kalem kimliği → TEMEL birimde bakiye.
   */
  yeterlilik(
    isEmri: IsEmri,
    bakiyeler: ReadonlyMap<string, number>,
    kalemler: readonly KatalogKalemi[],
  ): YeterlilikSatiri[] {
    return yeterliligiHesapla(yeterlilikGirdisi(isEmri.satirlar), bakiyeler, kalemler)
  }

  /**
   * ⚠️ KRİTER: "Yetersiz stokla iş emri başlatılamıyor."
   *
   * Kapı burada. Planı YAZMAK serbesttir — yarın gelecek malla üretim
   * planlanabilir. Ama deftere yazmak eldeki mala bağlıdır.
   *
   * Kontrol iki kez yapılıyor ve bu bilinçli: burada, kullanıcıya hangi
   * malzemeden ne kadar eksik olduğunu söyleyebilmek için; defterde ise
   * negatif bakiye politikasıyla (I12), çünkü bu kontrolle çıkış arasında
   * geçen sürede başka biri aynı maldan çekmiş olabilir.
   */
  async baslat(
    ctx: TenantCtx,
    isEmri: IsEmri,
    bakiyeler: ReadonlyMap<string, number>,
    kalemler: readonly KatalogKalemi[],
  ): Promise<IsEmri> {
    this.gecisiDogrula(isEmri, 'STARTED')

    if(isEmri.satirlar.length === 0){
      // Malzemesiz üretim, mamulün yoktan var olması demektir.
      throw new IsEmriDogrulamaError('Malzemesi olmayan iş emri başlatılamaz.')
    }

    const durumlar = this.yeterlilik(isEmri, bakiyeler, kalemler)
    if(!hepsiYeterli(durumlar)){
      throw new YetersizStokIleBaslatilamazError(durumlar.filter(d => !d.yeterli))
    }

    for(const satir of isEmri.satirlar){
      await this.depoServisi.cikis(ctx, {
        stokKalemiId: satir.stokKalemiId,
        miktar: satir.planlananMiktar,
        birim: satir.birim,
        neden: 'PRODUCTION_CONSUME',
        // FEFO'yu depo servisi uyguluyor: lot SEÇMİYORUZ, seçtirmiyoruz.
        kaynakId: isEmri.id,
        not: `${isEmri.isEmriNo} üretim tüketimi`,
      }, `ue:${satir.id}`)
    }

    return this.depo.durumDegistir(ctx, isEmri.id, 'STARTED', {
      baslama: new Date().toISOString(),
    })
  }

  /**
   * Mamulü deftere yazar ve iş emrini kapatır.
   *
   * ── VERİM BURADA GÖRÜNÜR OLUR ──────────────────────────────────────────
   * Planlanan çıktı reçetenin verimine göre hesaplanmıştı. Gerçekte çıkan
   * miktar farklı olabilir ve OLMALIDIR da — asıl verim budur. Bu yüzden
   * `uretilenMiktar` kullanıcıdan alınıyor, plandan kopyalanmıyor: plandan
   * kopyalasaydık verim her zaman "tam tuttu" görünür ve hiçbir zaman
   * ölçülemezdi.
   */
  async tamamla(
    ctx: TenantCtx,
    isEmri: IsEmri,
    girdi: TamamlamaGirdisi,
    lotGerekliMi: (stokKalemiId: string) => boolean,
    sktGerekliMi: (stokKalemiId: string) => boolean,
  ): Promise<IsEmri> {
    this.gecisiDogrula(isEmri, 'COMPLETED')

    if(!(girdi.uretilenMiktar > 0)){
      throw new IsEmriDogrulamaError('Üretilen miktar 0’dan büyük olmalıdır.')
    }
    if(lotGerekliMi(isEmri.ciktiKalemiId) && !girdi.lotKodu?.trim()){
      throw new IsEmriDogrulamaError(
        'Mamul lot takipli: yeni parti için lot kodu zorunludur.',
      )
    }
    if(sktGerekliMi(isEmri.ciktiKalemiId) && !girdi.sonKullanma){
      throw new IsEmriDogrulamaError(
        'Mamul SKT takipli: son kullanma tarihi zorunludur.',
      )
    }

    // Fireler ÖNCE yazılır: mamul girişi iş emrinin son adımıdır ve o yazılınca
    // belge kapanır. Ters sırada fire yazımı düşerse belge kapanmış olurdu.
    for(const [sira, fire] of (girdi.fireler ?? []).entries()){
      if(!(fire.miktar > 0)) continue
      await this.depoServisi.cikis(ctx, {
        stokKalemiId: fire.stokKalemiId,
        miktar: fire.miktar,
        birim: fire.birim,
        neden: 'PRODUCTION_WASTE',
        kaynakId: isEmri.id,
        not: `${isEmri.isEmriNo} üretim firesi${fire.neden ? ` · ${fire.neden}` : ''}`,
      }, `ue-fire:${isEmri.id}:${sira}`)
    }

    const maliyet = await this.maliyet(ctx, isEmri, girdi.uretilenMiktar)

    await this.depoServisi.uretimGirisi(ctx, {
      stokKalemiId: isEmri.ciktiKalemiId,
      miktar: girdi.uretilenMiktar,
      birim: isEmri.ciktiBirimi,
      yeniLot: girdi.lotKodu?.trim()
        ? { kod: girdi.lotKodu.trim(), sonKullanma: girdi.sonKullanma }
        : undefined,
      kaynakId: isEmri.id,
      // Mamulün maliyeti tüketilen hammaddeden gelir. Fiyatsız hammadde varsa
      // rakam eksik veriye dayanır; o yüzden hiç yazmıyoruz — yanlış bir sayı,
      // olmayan bir sayıdan kötüdür.
      birimMaliyet: maliyet.eksikVeri ? undefined : maliyet.birimMaliyet,
      not: `${isEmri.isEmriNo} üretim çıktısı${girdi.not ? ` · ${girdi.not}` : ''}`,
    }, `ue-cikti:${isEmri.id}`)

    return this.depo.durumDegistir(ctx, isEmri.id, 'COMPLETED', {
      bitis: new Date().toISOString(),
    })
  }

  /**
   * ⚠️ KRİTER: "İptal edilen iş emri tüketimi geri alıyor — ters kayıtla,
   * silmeyle değil."
   *
   * Bu iş emrinin deftere yazdığı HER hareketin tersi yazılır. Hareketler
   * silinmez; defterde hem tüketim hem iadesi yan yana durur ve "neden bu
   * rakam değişti" sorusu cevaplanabilir kalır.
   *
   * Taslak iş emri hiç deftere yazmamıştır; onda iptal yalnızca durum
   * değişikliğidir.
   */
  async iptalEt(ctx: TenantCtx, isEmri: IsEmri): Promise<IsEmri> {
    this.gecisiDogrula(isEmri, 'CANCELLED')

    for(const hareket of await this.hareketleri(ctx, isEmri)){
      // Zaten ters kaydı olan bir hareketi tekrar çevirmek bakiyeyi bozardı.
      // İdempotency anahtarı hareket kimliğine sabit: tekrar denemek güvenli.
      if(hareket.reason === 'REVERSAL') continue
      await this.depoServisi.tersKayit(ctx, hareket.id, `ue-iptal:${hareket.id}`)
    }

    return this.depo.durumDegistir(ctx, isEmri.id, 'CANCELLED')
  }

  /**
   * Bu iş emrinin deftere yazdığı hareketler.
   *
   * Ayrı bir bağ tablosu YOK: hareketler `source_id` ile iş emrine bağlı.
   * Soyağacı da, iptal de aynı bağı kullanıyor — tek gerçek, tek yol.
   */
  async hareketleri(ctx: TenantCtx, isEmri: IsEmri): Promise<Movement[]> {
    const kalemIdleri = [
      ...new Set([...isEmri.satirlar.map(s => s.stokKalemiId), isEmri.ciktiKalemiId]),
    ]

    const hepsi: Movement[] = []
    for(const kalemId of kalemIdleri){
      const defter = await this.depoServisi.hareketler(ctx, kalemId)
      hepsi.push(...defter.filter(h => h.sourceId === isEmri.id))
    }
    return hepsi
  }

  /**
   * Üretim maliyeti: tüketilen hammaddenin parasal değeri.
   *
   * Her hammaddenin birim maliyeti kendi defterinden türetiliyor
   * (`stock-cost.ts`, yürürlükteki yöntem ADR-007). Tüketilen miktarla
   * çarpılıp toplanıyor; mamulün birim maliyeti bu toplamın üretilen miktara
   * bölünmesidir.
   *
   * Verim buraya kendiliğinden giriyor: 120 kg hammaddeden 92 kg mamul
   * çıktıysa, 120 kg'ın parası 92 kg'a bölünür ve birim maliyet yükselir.
   * Ayrıca bir "verim düzeltmesi" YOK — gerçek zaten bu.
   */
  async maliyet(
    ctx: TenantCtx, isEmri: IsEmri, uretilenMiktar: number,
  ): Promise<UretimMaliyeti> {
    let toplam = 0
    let eksikVeri = false

    for(const hareket of await this.hareketleri(ctx, isEmri)){
      if(hareket.quantityBase >= 0) continue    // yalnızca tüketim
      if(hareket.reason === 'REVERSAL') continue

      const defter = await this.depoServisi.hareketler(ctx, hareket.stockItemId)
      const m = maliyetiHesapla(defter)
      if(m.birimMaliyet === 0) eksikVeri = true
      toplam += Math.abs(hareket.quantityBase) * m.birimMaliyet
    }

    return {
      toplamMaliyet: paraYuvarla(toplam),
      birimMaliyet: uretilenMiktar > 0 ? yuvarla(toplam / uretilenMiktar) : 0,
      eksikVeri,
    }
  }

  private gecisiDogrula(isEmri: IsEmri, istenen: IsEmriDurumu): void {
    if(!IS_EMRI_GECISLERI[isEmri.durum].includes(istenen)){
      throw new GecersizIsEmriGecisiError(isEmri.durum, istenen)
    }
  }

  private dogrula(girdi: YeniIsEmri): YeniIsEmri {
    const no = girdi.isEmriNo.trim()
    if(!no) throw new IsEmriDogrulamaError('İş emri numarası zorunludur.')
    if(!girdi.ciktiKalemiId) throw new IsEmriDogrulamaError('Üretilecek mamul seçilmelidir.')
    if(!(girdi.planlananMiktar > 0)){
      throw new IsEmriDogrulamaError('Planlanan miktar 0’dan büyük olmalıdır.')
    }

    const gorulen = new Set<string>()
    girdi.satirlar.forEach((satir, i) => {
      const sira = i + 1
      if(!satir.stokKalemiId){
        throw new IsEmriDogrulamaError(`${sira}. satırda malzeme seçilmemiş.`)
      }
      if(!(satir.planlananMiktar > 0)){
        throw new IsEmriDogrulamaError(`${sira}. satırın miktarı 0’dan büyük olmalıdır.`)
      }
      if(satir.stokKalemiId === girdi.ciktiKalemiId){
        throw new IsEmriDogrulamaError('Bir mamul kendi üretiminin malzemesi olamaz.')
      }
      if(gorulen.has(satir.stokKalemiId)){
        throw new IsEmriDogrulamaError(`${sira}. satırdaki malzeme iş emrinde zaten var.`)
      }
      gorulen.add(satir.stokKalemiId)
    })

    return { ...girdi, isEmriNo: no, not: girdi.not?.trim() || undefined }
  }
}

/**
 * Reçeteden iş emri satırları üretir.
 *
 * Ölçeklenmiş miktarlar buraya KOPYALANIR, referans verilmez: reçete yarın
 * değişse bile bu iş emrinin neye göre planlandığı belli kalır. Reçeteye bağ
 * bırakıp sonra okusaydık, geçmiş üretimlerin planı geriye dönük değişirdi.
 */
export const receteyiIsEmrineDok = (
  olceklenmis: ReadonlyArray<{ satir: { stokKalemiId: string }; brutMiktar: number; birim: string }>,
): YeniIsEmri['satirlar'] =>
  olceklenmis.map(o => ({
    stokKalemiId: o.satir.stokKalemiId,
    planlananMiktar: o.brutMiktar,
    birim: o.birim,
  }))

/** Belge numarası üreticisi — satın almadakiyle aynı kural. */
export const sonrakiIsEmriNo = (
  mevcutlar: readonly string[], yil = new Date().getFullYear(),
): string => {
  const onek = `UE-${yil}-`
  const enBuyuk = mevcutlar
    .filter(no => no.startsWith(onek))
    .map(no => Number(no.slice(onek.length)))
    .filter(n => Number.isFinite(n))
    .reduce((a, b) => Math.max(a, b), 0)
  return `${onek}${String(enBuyuk + 1).padStart(4, '0')}`
}
