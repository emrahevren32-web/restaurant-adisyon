// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / Üretim — Reçete servisi
//
// Yol haritası maddesi: "Reçete yönetimi gerçek veriye bağlı"
//
// ── BU DOSYANIN ASIL İŞİ: ÖLÇEKLEME ──────────────────────────────────────
// Reçete "100 porsiyon için" yazılır. İş emri "350 porsiyon" der. Aradaki
// hesap burada ve üç ayrı düzeltme içeriyor — üçü de karıştırılırsa üretim
// ya eksik malzemeyle başlar ya da depoda olmayan malı ister:
//
//   1. ÖLÇEK      = istenen / reçete miktarı          (350 / 100 = 3,5)
//   2. VERİM      = prosesin kaybı. %92 verimle 350 kg çıkarmak için
//                   350 / 0,92 = 380,4 kg'lık girdi hazırlamak gerekir.
//   3. SATIR FİRESİ = malzemenin kendi kaybı. %20 firesi olan soğandan
//                   8 kg kullanmak için 8 / 0,80 = 10 kg çıkmak gerekir.
//
// Sıra önemlidir: önce verim (üretimin tamamına), sonra fire (her satıra).
// Ters sırada uygularsak fire payı verimle bir kez daha çarpılır ve her
// malzemeden sistematik olarak fazla istenir.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../core/context'
import { convertUom } from '../core/stock/uom'
import type { KatalogKalemi } from '../warehouse/warehouse.catalog'
import {
  RECETE_GECISLERI,
  type Recete,
  type ReceteDeposu,
  type ReceteDurumu,
  type ReceteGirdisi,
  type ReceteSatiri,
} from './recipe.repository'

export class ReceteDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'ReceteDogrulamaError'
  }
}

export class GecersizReceteGecisiError extends Error {
  constructor(mevcut: ReceteDurumu, istenen: ReceteDurumu) {
    super(`Reçete "${mevcut}" durumundan "${istenen}" durumuna geçemez.`)
    this.name = 'GecersizReceteGecisiError'
  }
}

const yuvarla = (deger: number) => Math.round(deger * 1e6) / 1e6

// ═══════════════════════════════════════════════════════════════════════════
// Ölçekleme
// ═══════════════════════════════════════════════════════════════════════════

export type OlceklenmisSatir = {
  satir: ReceteSatiri
  /** Reçetedeki miktarın ölçeklenmiş hâli — fire payı HARİÇ. */
  netMiktar: number
  /** Depodan gerçekten çekilecek miktar — fire payı DAHİL. */
  brutMiktar: number
  birim: string
}

/**
 * Reçeteyi istenen çıktı miktarına ölçekler.
 *
 * @param hedefMiktar Kaç birim mamul isteniyor (reçetenin çıktı biriminde).
 */
export const receteyiOlcekle = (
  recete: Recete,
  hedefMiktar: number,
): OlceklenmisSatir[] => {
  if(!(hedefMiktar > 0)){
    throw new ReceteDogrulamaError('Üretim miktarı 0’dan büyük olmalıdır.')
  }
  if(!(recete.ciktiMiktari > 0)){
    throw new ReceteDogrulamaError('Reçetenin çıktı miktarı 0’dan büyük olmalıdır.')
  }

  const olcek = hedefMiktar / recete.ciktiMiktari
  // Verim: %92 verimle 350 çıkarmak için 350/0,92 girdi gerekir.
  const verimDuzeltmesi = 100 / (recete.verim > 0 ? recete.verim : 100)

  return recete.satirlar.map(satir => {
    const net = yuvarla(satir.miktar * olcek * verimDuzeltmesi)
    // Fire payı: %20 firesi olan malzemeden 8 kullanmak için 8/0,80 çıkmak gerekir.
    // Payda 0 olamaz — şema `waste_pct < 100` diye kısıtlıyor.
    const brut = yuvarla(net / (1 - (satir.firePayi / 100)))
    return { satir, netMiktar: net, brutMiktar: brut, birim: satir.birim }
  })
}

export type YeterlilikSatiri = OlceklenmisSatir & {
  /** Depodaki bakiye, satırın biriminde. */
  eldeki: number
  /** Eksik miktar; 0 ise yeterli. */
  eksik: number
  yeterli: boolean
  /** Birim çevrilemedi (ör. kg ↔ adet). Yeterlilik hesaplanamaz. */
  cevrilemedi?: boolean
}

/**
 * Ölçeklenmiş reçetenin depodaki bakiyeye karşı yeterliliği.
 *
 * ── NEDEN BURADA BİRİM ÇEVRİLİYOR ────────────────────────────────────────
 * Reçete "0,5 kg tuz" der; defter gram tutar. Çevirmeden kıyaslamak, 0,5 ile
 * 500'ü karşılaştırmak olurdu — sistem "tuz yetmiyor" der ve iş emri hiç
 * başlamazdı. Bu tuzağa depo çıkışında bir kez düşüldü (bkz. warehouse.service).
 *
 * Çevrilemeyen birim SESSİZCE "yeterli" sayılmaz: kullanıcının görmesi için
 * işaretlenir. "Bilmiyorum"u "sorun yok" saymak, üretimi yarıda bırakır.
 */
export const yeterliligiHesapla = (
  olceklenmis: readonly OlceklenmisSatir[],
  bakiyeler: ReadonlyMap<string, number>,
  kalemler: readonly KatalogKalemi[],
): YeterlilikSatiri[] =>
  olceklenmis.map(o => {
    const kalem = kalemler.find(k => k.id === o.satir.stokKalemiId)
    const temelBakiye = bakiyeler.get(o.satir.stokKalemiId) ?? 0

    if(!kalem){
      return { ...o, eldeki: 0, eksik: o.brutMiktar, yeterli: false, cevrilemedi: true }
    }

    let eldeki: number
    try{
      eldeki = kalem.temelBirim === o.birim
        ? temelBakiye
        : convertUom(temelBakiye, kalem.temelBirim, o.birim)
    } catch {
      return { ...o, eldeki: 0, eksik: o.brutMiktar, yeterli: false, cevrilemedi: true }
    }

    const eksik = yuvarla(Math.max(0, o.brutMiktar - eldeki))
    return { ...o, eldeki: yuvarla(eldeki), eksik, yeterli: eksik === 0 }
  })

/** Tümü yeterli mi? İş emri açma kapısı bunu soruyor. */
export const hepsiYeterli = (satirlar: readonly YeterlilikSatiri[]): boolean =>
  satirlar.length > 0 && satirlar.every(s => s.yeterli)

// ═══════════════════════════════════════════════════════════════════════════
// Servis
// ═══════════════════════════════════════════════════════════════════════════

export class ReceteServisi {
  constructor(private readonly depo: ReceteDeposu) {}

  hepsi(ctx: TenantCtx): Promise<Recete[]> { return this.depo.hepsi(ctx) }
  tekil(ctx: TenantCtx, id: string): Promise<Recete> { return this.depo.tekil(ctx, id) }

  async ekle(ctx: TenantCtx, girdi: ReceteGirdisi, mevcutlar: readonly Recete[]): Promise<Recete> {
    return this.depo.ekle(ctx, this.dogrula(girdi, mevcutlar))
  }

  async guncelle(
    ctx: TenantCtx, recete: Recete, girdi: ReceteGirdisi, mevcutlar: readonly Recete[],
  ): Promise<Recete> {
    if(recete.durum === 'ARCHIVED'){
      // Arşiv, geçmişin kaydıdır. Değiştirmek, ona bakan iş emirlerinin
      // dayandığı zemini sonradan kaydırmak olurdu.
      throw new ReceteDogrulamaError(
        'Arşivlenmiş reçete düzenlenemez. Önce yeniden yürürlüğe alın.',
      )
    }
    return this.depo.guncelle(ctx, recete.id, this.dogrula(girdi, mevcutlar, recete.id))
  }

  async durumDegistir(ctx: TenantCtx, recete: Recete, durum: ReceteDurumu): Promise<Recete> {
    if(!RECETE_GECISLERI[recete.durum].includes(durum)){
      throw new GecersizReceteGecisiError(recete.durum, durum)
    }
    if(durum === 'ACTIVE' && recete.satirlar.length === 0){
      // Malzemesiz bir reçeteyle iş emri açılırsa hiçbir şey tüketilmez ve
      // mamul yoktan var olur. Deftere göre bedava üretim yapmış oluruz.
      throw new ReceteDogrulamaError(
        'Malzemesi olmayan reçete yürürlüğe alınamaz. En az bir kalem ekleyin.',
      )
    }
    return this.depo.durumDegistir(ctx, recete.id, durum)
  }

  private dogrula(
    girdi: ReceteGirdisi, mevcutlar: readonly Recete[], hariçId?: string,
  ): ReceteGirdisi {
    const kod = girdi.kod.trim()
    const ad = girdi.ad.trim()

    if(!kod) throw new ReceteDogrulamaError('Reçete kodu zorunludur.')
    if(!ad) throw new ReceteDogrulamaError('Reçete adı zorunludur.')
    if(!girdi.ciktiKalemiId) throw new ReceteDogrulamaError('Üretilecek mamul seçilmelidir.')
    if(!(girdi.ciktiMiktari > 0)){
      throw new ReceteDogrulamaError('Çıktı miktarı 0’dan büyük olmalıdır.')
    }

    const verim = girdi.verim ?? 100
    if(!(verim > 0 && verim <= 100)){
      // %100'den büyük verim, girdiden daha çok mamul çıkması demektir.
      throw new ReceteDogrulamaError('Verim %0 ile %100 arasında olmalıdır.')
    }

    if(girdi.satirlar.length === 0){
      throw new ReceteDogrulamaError('Reçete en az bir malzeme içermelidir.')
    }

    const gorulen = new Set<string>()
    girdi.satirlar.forEach((satir, i) => {
      const sira = i + 1
      if(!satir.stokKalemiId){
        throw new ReceteDogrulamaError(`${sira}. satırda malzeme seçilmemiş.`)
      }
      if(!(satir.miktar > 0)){
        throw new ReceteDogrulamaError(`${sira}. satırın miktarı 0’dan büyük olmalıdır.`)
      }
      if(satir.firePayi < 0 || satir.firePayi >= 100){
        throw new ReceteDogrulamaError(
          `${sira}. satırın fire payı %0 ile %100 arasında olmalıdır (100 hariç).`,
        )
      }
      if(satir.stokKalemiId === girdi.ciktiKalemiId){
        // Doğrudan döngü. Veritabanı da engelliyor ama hata mesajı orada
        // teknik olurdu; burada ne yapıldığı yazılı.
        throw new ReceteDogrulamaError(
          'Bir mamul kendi reçetesinin malzemesi olamaz.',
        )
      }
      if(gorulen.has(satir.stokKalemiId)){
        throw new ReceteDogrulamaError(
          `${sira}. satırdaki malzeme reçetede zaten var. Aynı malzeme iki kez yazılamaz.`,
        )
      }
      gorulen.add(satir.stokKalemiId)
    })

    const anahtar = kod.trim().toLowerCase()
    if(mevcutlar.some(r => r.id !== hariçId && r.kod.trim().toLowerCase() === anahtar)){
      throw new ReceteDogrulamaError(`"${kod}" kodu başka bir reçetede kullanılıyor.`)
    }

    return {
      ...girdi,
      kod, ad, verim,
      not: girdi.not?.trim() || undefined,
      satirlar: girdi.satirlar.map(s => ({ ...s, not: s.not?.trim() || undefined })),
    }
  }
}

/**
 * Dolaylı döngü kontrolü: A'nın reçetesinde B, B'nin reçetesinde A.
 *
 * Veritabanı yalnızca doğrudan döngüyü (A → A) engelliyor; dolaylısı için her
 * satır eklemede özyinelemeli sorgu gerekirdi. Burada, kaydetmeden ÖNCE
 * bakıyoruz.
 *
 * @returns Döngüye yol açan mamulün adı; döngü yoksa `null`.
 */
export const donguVarMi = (
  ciktiKalemiId: string,
  malzemeIdleri: readonly string[],
  receteler: readonly Recete[],
): string | null => {
  const ziyaret = new Set<string>([ciktiKalemiId])
  const kuyruk = [...malzemeIdleri]

  while(kuyruk.length > 0){
    const kalemId = kuyruk.shift()!
    if(ziyaret.has(kalemId)){
      const carpisan = receteler.find(r => r.ciktiKalemiId === kalemId)
      return carpisan?.ciktiKalemiAd ?? carpisan?.ad ?? 'bilinmeyen mamul'
    }
    ziyaret.add(kalemId)

    // Bu malzemenin kendisi bir mamulse, onun malzemeleri de zincire girer.
    for(const alt of receteler.filter(r => r.ciktiKalemiId === kalemId)){
      kuyruk.push(...alt.satirlar.map(s => s.stokKalemiId))
    }
  }

  return null
}
