// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / İzlenebilirlik — Lot soyağacı
//
// Yol haritası maddesi: "Lot soyağacı bağlanıyor"
//         Bitti sayılır ki: "'Bu mamulün içinde hangi lotlar var' cevaplanabiliyor"
//
// ── AYRI BİR SOYAĞACI TABLOSU YOK ────────────────────────────────────────
// Şemada `lot_genealogy` diye bir tablo duruyor (0003) ve BİLEREK boş.
// Zincir zaten defterde:
//
//   Mamul lotu  ──▶ onu yazan PRODUCTION_OUTPUT hareketi
//               ──▶ o hareketin `source_id`'si = iş emri
//               ──▶ aynı `source_id`'li ÇIKIŞ hareketleri = tüketilen partiler
//               ──▶ her biri için baştan başla (o parti de üretilmiş olabilir)
//
// Ayrı bir tablo tutsaydık, defterle senkron kalması gereken İKİNCİ bir gerçek
// doğardı. Bir hareket unutulduğu gün geri çağırma listesi eksik çıkardı ve
// bunu kimse fark etmezdi — çünkü tablo "dolu" görünürdü. Türetilen bir zincir
// yanlış olamaz: defter neyse zincir odur.
//
// ── DÖNGÜ VE DERİNLİK ────────────────────────────────────────────────────
// Hamurdan ekmek, ekmekten galeta unu, galeta unundan köfte… zincir uzayabilir.
// Veri hatası yüzünden kendine dönen bir zincir sonsuza kadar inerdi; bu yüzden
// hem ziyaret edilen lotlar işaretleniyor hem de bir derinlik sınırı var.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'

/** Zincirin bir halkası: defterdeki bir lot. */
export type SoyagaciLotu = {
  lotId: string
  lotKodu: string
  stokKalemiId: string
  stokKalemiAd: string
  sonKullanma?: string
  /** RECEIPT: satın alındı · PRODUCTION: üretildi · OPENING: açılış */
  kaynakTipi: 'RECEIPT' | 'PRODUCTION' | 'OPENING'
  /** Satın alınmışsa tedarikçi adı. */
  tedarikci?: string
}

/** Bir lota giren/çıkan hareketin soyağacı için gereken alanları. */
export type SoyagaciHareketi = {
  id: string
  stokKalemiId: string
  lotId?: string
  /** İşaretli: giriş +, çıkış −. Temel birimde. */
  miktar: number
  neden: string
  kaynakTipi: string
  /** Bu hareketi doğuran belgenin kimliği (iş emri, mal kabul…). */
  kaynakId?: string
  tarih: string
}

export interface SoyagaciKaynagi {
  lot(ctx: TenantCtx, lotId: string): Promise<SoyagaciLotu | null>
  /** Lot kodu ya da kalem adıyla arama — ekranın giriş noktası. */
  lotAra(ctx: TenantCtx, arama: string): Promise<SoyagaciLotu[]>
  /** Bir lota GİRİŞ yazan hareketler — o parti nasıl doldu. */
  lotaGirisler(ctx: TenantCtx, lotId: string): Promise<SoyagaciHareketi[]>
  /** Bir belgenin (iş emri, mal kabul) yazdığı bütün hareketler. */
  belgeninHareketleri(ctx: TenantCtx, kaynakId: string): Promise<SoyagaciHareketi[]>
  /** Bir lottan ÇIKIŞ yazan hareketler — o parti nereye gitti. */
  lottanCikislar(ctx: TenantCtx, lotId: string): Promise<SoyagaciHareketi[]>
  /** İş emri numarasını kimliğinden çözer; ekran için. */
  isEmriNo(ctx: TenantCtx, isEmriId: string): Promise<string | undefined>
}

/** Soyağacındaki bir düğüm. Kök, sorulan lotun kendisidir. */
export type SoyagaciDugumu = {
  lot: SoyagaciLotu
  /** Bu partiden ne kadarı bir üst halkaya girdi (temel birimde). Kökte 0. */
  kullanilanMiktar: number
  /** Bu lotu üreten iş emri; satın alınmışsa boş. */
  isEmriId?: string
  isEmriNo?: string
  /** Bu lotun içine giren partiler. */
  icindekiler: SoyagaciDugumu[]
  /** Kök 0. */
  derinlik: number
  /**
   * Zincir burada kesildi mi?
   *
   * `derinlik`  — sınıra dayandı, daha aşağısı var ama inilmedi
   * `dongu`     — bu lot zincirde zaten geçti (veri hatası)
   * `bilinmiyor`— lotu üreten iş emri defterde bulunamadı
   */
  kesildi?: 'derinlik' | 'dongu' | 'bilinmiyor'
}

/** Makul bir tavan: gıdada dört kademeden derin zincir neredeyse yok. */
export const VARSAYILAN_DERINLIK = 6

/**
 * "Bu mamulün içinde hangi partiler var?"
 *
 * Verilen lottan başlayıp aşağı iner: onu üreten iş emrini bulur, o iş emrinin
 * tükettiği partileri bulur, her biri için aynısını yapar.
 */
export const soyagaciCikar = async (
  ctx: TenantCtx,
  kaynak: SoyagaciKaynagi,
  lotId: string,
  maxDerinlik = VARSAYILAN_DERINLIK,
): Promise<SoyagaciDugumu | null> => {
  const kok = await kaynak.lot(ctx, lotId)
  if(!kok) return null
  return inis(ctx, kaynak, kok, 0, 0, new Set<string>(), maxDerinlik)
}

const inis = async (
  ctx: TenantCtx,
  kaynak: SoyagaciKaynagi,
  lot: SoyagaciLotu,
  kullanilanMiktar: number,
  derinlik: number,
  ziyaret: Set<string>,
  maxDerinlik: number,
): Promise<SoyagaciDugumu> => {
  const dugum: SoyagaciDugumu = {
    lot, kullanilanMiktar, derinlik, icindekiler: [],
  }

  // Döngü koruması: aynı lot zincirde ikinci kez geçerse veri hatası vardır.
  if(ziyaret.has(lot.lotId)){ dugum.kesildi = 'dongu'; return dugum }
  ziyaret.add(lot.lotId)

  // Satın alınan ya da açılış partisinin "içi" yoktur; zincir orada biter.
  // Tedarikçi partisine kadar inmek zaten hedefti (geri izleme kriteri).
  if(lot.kaynakTipi !== 'PRODUCTION') return dugum

  if(derinlik >= maxDerinlik){ dugum.kesildi = 'derinlik'; return dugum }

  // Bu partiyi hangi üretim doldurdu?
  const girisler = await kaynak.lotaGirisler(ctx, lot.lotId)
  const uretim = girisler.find(h => h.neden === 'PRODUCTION_OUTPUT' && h.kaynakId)
  if(!uretim?.kaynakId){ dugum.kesildi = 'bilinmiyor'; return dugum }

  dugum.isEmriId = uretim.kaynakId
  dugum.isEmriNo = await kaynak.isEmriNo(ctx, uretim.kaynakId)

  // O üretimin tükettiği partiler. Ters kayıtlar sayılmaz: iptal edilmiş bir
  // tüketim mamulün içine girmedi.
  const tuketimler = (await kaynak.belgeninHareketleri(ctx, uretim.kaynakId))
    .filter(h => h.miktar < 0 && h.lotId && h.neden !== 'REVERSAL')

  // Aynı partiden birden çok satır çıkmış olabilir (FEFO bölmesi); topluyoruz.
  const partiToplamlari = new Map<string, number>()
  for(const h of tuketimler){
    partiToplamlari.set(h.lotId!, (partiToplamlari.get(h.lotId!) ?? 0) + Math.abs(h.miktar))
  }

  for(const [altLotId, miktar] of partiToplamlari){
    const altLot = await kaynak.lot(ctx, altLotId)
    if(!altLot) continue
    dugum.icindekiler.push(
      await inis(ctx, kaynak, altLot, miktar, derinlik + 1, new Set(ziyaret), maxDerinlik),
    )
  }

  return dugum
}

// ═══════════════════════════════════════════════════════════════════════════
// Düzleştirme — ekran ve rapor için
// ═══════════════════════════════════════════════════════════════════════════

export type SoyagaciSatiri = SoyagaciDugumu & { yol: string[] }

/** Ağacı, girinti düzeyi belli düz bir listeye çevirir. */
export const soyagaciniDuzlestir = (
  dugum: SoyagaciDugumu,
  yol: string[] = [],
): SoyagaciSatiri[] => {
  const buYol = [...yol, dugum.lot.lotKodu]
  return [
    { ...dugum, yol: buYol },
    ...dugum.icindekiler.flatMap(alt => soyagaciniDuzlestir(alt, buYol)),
  ]
}

/**
 * Zincirin ucundaki TEDARİKÇİ partileri.
 *
 * "Bu mamul hangi tedarikçilerden gelen malla yapıldı" sorusunun cevabı.
 * Geri çağırmada aranan liste budur: bir tedarikçi partisi bozuk çıkarsa,
 * ters yönden bakıp hangi mamullere girdiği bulunur.
 */
export const tedarikciPartileri = (dugum: SoyagaciDugumu): SoyagaciDugumu[] =>
  soyagaciniDuzlestir(dugum)
    .filter(s => s.lot.kaynakTipi === 'RECEIPT')

/** Zincirde kopukluk var mı? Varsa ekran bunu SÖYLEMELİ, gizlememeli. */
export const kopukluklar = (dugum: SoyagaciDugumu): SoyagaciSatiri[] =>
  soyagaciniDuzlestir(dugum).filter(s => s.kesildi !== undefined)

// ═══════════════════════════════════════════════════════════════════════════
// İLERİ İZLEME — "bu parti nereye gitti"
//
// Soyağacı içeri doğru bakar: mamulün içinde ne var. İleri izleme dışarı
// bakar: bu hammadde partisi hangi mamullere girdi, o mamuller hangi
// sevkiyatlarla kime gitti.
//
// Geri çağırmanın işe yarayan yönü budur. "Şu tedarikçi partisi bozuk çıktı"
// denildiğinde aranan liste buradan gelir.
// ═══════════════════════════════════════════════════════════════════════════

/** İleri izlemede bulunan bir sevkiyat izi. */
export type SevkiyatIzi = {
  sevkiyatId: string
  /** Hangi partiden gitti. */
  lot: SoyagaciLotu
  /** Bu sevkiyata bu partiden ne kadar gitti (temel birimde). */
  miktar: number
  /** Kaç kademe sonra bu sevkiyata ulaşıldı. Doğrudan sevkte 0. */
  derinlik: number
  /** Kökten buraya kadar geçilen partiler. */
  yol: string[]
}

export type IleriIzlemeSonucu = {
  /** Bu partiden türeyen mamul partileri (kendisi hariç). */
  tureyenLotlar: SoyagaciLotu[]
  /** Ulaşılan sevkiyatlar. */
  sevkiyatlar: SevkiyatIzi[]
  /** Derinlik sınırına dayanıldı mı? Dayanıldıysa liste EKSİK olabilir. */
  derinlikAsildi: boolean
}

/**
 * "Bu parti nereye gitti?"
 *
 * Partiden çıkan hareketleri okur:
 *   • `SHIPMENT_OUT` → doğrudan bir sevkiyat; kaydedilir
 *   • `PRODUCTION_CONSUME` → bir üretime girdi; o üretimin ÇIKTI lotunu bulup
 *     aynı soruyu ona sorar (özyineleme)
 *
 * Fire, imha ve iade dallanmaz: o mal müşteriye gitmedi.
 */
export const ileriIzle = async (
  ctx: TenantCtx,
  kaynak: SoyagaciKaynagi,
  lotId: string,
  maxDerinlik = VARSAYILAN_DERINLIK,
): Promise<IleriIzlemeSonucu> => {
  const sonuc: IleriIzlemeSonucu = {
    tureyenLotlar: [], sevkiyatlar: [], derinlikAsildi: false,
  }
  const kok = await kaynak.lot(ctx, lotId)
  if(!kok) return sonuc

  await cikis(ctx, kaynak, kok, 0, [kok.lotKodu], new Set<string>(), maxDerinlik, sonuc)
  return sonuc
}

const cikis = async (
  ctx: TenantCtx,
  kaynak: SoyagaciKaynagi,
  lot: SoyagaciLotu,
  derinlik: number,
  yol: string[],
  ziyaret: Set<string>,
  maxDerinlik: number,
  sonuc: IleriIzlemeSonucu,
): Promise<void> => {
  if(ziyaret.has(lot.lotId)) return
  ziyaret.add(lot.lotId)

  if(derinlik >= maxDerinlik){ sonuc.derinlikAsildi = true; return }

  const cikislar = await kaynak.lottanCikislar(ctx, lot.lotId)

  for(const h of cikislar){
    if(h.neden === 'REVERSAL') continue     // iptal edilmiş çıkış gitmedi

    if(h.neden === 'SHIPMENT_OUT' && h.kaynakId){
      sonuc.sevkiyatlar.push({
        sevkiyatId: h.kaynakId,
        lot,
        miktar: Math.abs(h.miktar),
        derinlik,
        yol,
      })
      continue
    }

    // Üretime girdiyse, o üretimin ÇIKTISINI bul ve zinciri sürdür.
    if(h.neden !== 'PRODUCTION_CONSUME' || !h.kaynakId) continue

    const isEmriHareketleri = await kaynak.belgeninHareketleri(ctx, h.kaynakId)
    const ciktilar = isEmriHareketleri.filter(
      x => x.neden === 'PRODUCTION_OUTPUT' && x.lotId,
    )

    for(const cikti of ciktilar){
      const mamulLot = await kaynak.lot(ctx, cikti.lotId!)
      if(!mamulLot) continue
      if(!sonuc.tureyenLotlar.some(l => l.lotId === mamulLot.lotId)){
        sonuc.tureyenLotlar.push(mamulLot)
      }
      await cikis(
        ctx, kaynak, mamulLot, derinlik + 1,
        [...yol, mamulLot.lotKodu], ziyaret, maxDerinlik, sonuc,
      )
    }
  }
}

/** Aynı sevkiyata birden çok partiden mal gitmiş olabilir; kimlikleri tekilleştirir. */
export const etkilenenSevkiyatIdleri = (sonuc: IleriIzlemeSonucu): string[] =>
  [...new Set(sonuc.sevkiyatlar.map(s => s.sevkiyatId))]

// ═══════════════════════════════════════════════════════════════════════════
// YAŞAM DÖNGÜSÜ — "bu partiye ne oldu"
//
// Yol haritası maddesi: "Ürün geçmişi ekranı"
//         Bitti sayılır ki: "Bir mamulün tüm yaşam döngüsü tek sayfada"
//
// Soyağacı içeri, ileri izleme dışarı bakar. Bu üçüncü görüş ise PARTİNİN
// KENDİSİNE bakar: ne zaman doğdu, ne zaman ne kadarı çıktı, şu an ne kaldı.
// Üçü bir arada olduğunda "tek sayfada tüm yaşam döngüsü" cümlesi karşılanır.
// ═══════════════════════════════════════════════════════════════════════════

export type YasamDongusuOlayi = {
  hareket: SoyagaciHareketi
  /** Bu olaydan SONRA partide kalan miktar (temel birimde). */
  kalan: number
}

/**
 * Bir partinin bütün hareketleri, zaman sırasıyla ve kalan bakiyesiyle.
 *
 * Bakiye burada da SAKLANMIYOR, toplanarak türetiliyor (ADR-001). Son satırın
 * `kalan` değeri, o partiden depoda kalan miktardır.
 */
export const lotYasamDongusu = async (
  ctx: TenantCtx,
  kaynak: SoyagaciKaynagi,
  lotId: string,
): Promise<YasamDongusuOlayi[]> => {
  const [girisler, cikislar] = await Promise.all([
    kaynak.lotaGirisler(ctx, lotId),
    kaynak.lottanCikislar(ctx, lotId),
  ])
  return yasamDongusunuKur([...girisler, ...cikislar])
}

/** Sıralama ve bakiye toplama — saf; test bunu çağırır. */
export const yasamDongusunuKur = (
  hareketler: readonly SoyagaciHareketi[],
): YasamDongusuOlayi[] => {
  const sirali = [...hareketler].sort((a, b) => {
    const fark = new Date(a.tarih).getTime() - new Date(b.tarih).getTime()
    // Aynı saniyeye düşen hareketlerde kimlik sırası: liste her açılışta
    // aynı çıksın. Rastgele sıralanan bir geçmiş, aynı ekranı iki kez açan
    // kullanıcıya iki farklı hikâye anlatır.
    return fark !== 0 ? fark : a.id.localeCompare(b.id)
  })

  let kalan = 0
  return sirali.map(hareket => {
    kalan += hareket.miktar
    return { hareket, kalan }
  })
}
