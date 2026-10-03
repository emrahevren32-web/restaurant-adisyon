// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C2 — SİPARİŞ–TESLİM FARKI: "ne istendi, ne hazırlandı, ne gitti"
//
// Üç sayı yan yana durunca aradaki boşluk kendiliğinden görünür. Bu dosya o
// üç sayıyı HESAPLAMAZ — hesap 0058'de, veritabanında. Burada yapılan iş,
// satırları okunur cümlelere çevirmek ve açık fark kayıtlarını kalemlerine
// iliştirmek.
//
// ⚠️ Niçin hesap burada değil: üç sayı üç ayrı sorgudan gelseydi, aralarındaki
// saniyede yazılan bir sevkiyat ya da bir mamul girişi sessizce kaçar, rapor
// tutarsız bir an gösterirdi. Rapor tek bir sorgunun tek bir anıdır.
// ═══════════════════════════════════════════════════════════════════════════

import type { Fark } from './sales-order.repository'

/** 0058'in döndürdüğü bir satır — bir sipariş kalemi. */
export type TeslimFarkiSatiri = {
  kalemId: string
  kalemAdi?: string
  /** Siparişin ŞU ANKİ (en son satırlı revizyondaki) miktarı. */
  istendi?: number
  istendiBirim?: string
  /** İş emirlerinden deftere yazılmış GERÇEK mamul girişi (defter biriminde). */
  hazirlandi: number
  hazirlandiBirim?: string
  /** Sipariş birimi defter birimiyle aynı mı — değilse üretim kıyaslanamaz. */
  uretimOlculebilir: boolean
  isEmriSayisi: number
  acikIsEmri: number
  /** Sevk edilmiş sevkiyatların toplamı. */
  gitti: number
  gittiBirimleri: string[]
  /** Sipariş − gitti. Birimler uyuşmuyorsa YOK (hesaplanmadı). */
  kalan?: number
  birimUyusmuyor: boolean
  /** Siparişte olmayan ama sevkiyatta çıkan kalem. */
  siparisDisi: boolean
}

/** Ekrana basılan satır: 0058'in satırı + o kaleme düşen açık fark kayıtları. */
export type TeslimSatiri = TeslimFarkiSatiri & {
  acikFarklar: Fark[]
}

const ACIK_DURUMLAR: ReadonlyArray<Fark['durum']> = ['Açık', 'İncelemede']

/**
 * Fark kayıtlarını kalemlerine iliştirir.
 *
 * ⚠️ Kalemi OLMAYAN fark kayıtları bilerek dışarıda bırakılıyor ve ayrı
 * döndürülüyor: bir sevkiyatın tamamına dair açılmış fark ("araç geç geldi")
 * rastgele bir kaleme yazılsaydı o kalem suçlu görünürdü.
 */
export const teslimSatirlari = (
  satirlar: TeslimFarkiSatiri[],
  farklar: Fark[]
): { satirlar: TeslimSatiri[]; kalemsizFarklar: Fark[] } => {
  const acik = farklar.filter(f => ACIK_DURUMLAR.includes(f.durum))
  const kalemli = new Map<string, Fark[]>()
  const kalemsiz: Fark[] = []

  for(const f of acik){
    if(!f.kalemId){ kalemsiz.push(f); continue }
    const liste = kalemli.get(f.kalemId) ?? []
    liste.push(f)
    kalemli.set(f.kalemId, liste)
  }

  return {
    satirlar: satirlar.map(s => ({ ...s, acikFarklar: kalemli.get(s.kalemId) ?? [] })),
    kalemsizFarklar: kalemsiz,
  }
}

export type TeslimOzeti = {
  kalemSayisi: number
  /** Kalanı sıfırlanmış kalem sayısı. */
  tamamlanan: number
  /** Kalanı olan kalem sayısı. */
  eksikKalan: number
  /** Birim uyuşmazlığı yüzünden HESAPLANAMAYAN kalem sayısı. */
  olculemeyen: number
  /** Siparişte olmayıp sevkiyatta çıkan kalem sayısı. */
  siparisDisi: number
  acikFark: number
  acikIsEmri: number
}

/**
 * ⚠️ "Ölçülemeyen" ayrı sayılıyor ve tamamlanana da eksiğe de katılmıyor.
 * Bilmediğimiz bir şeyi iki kovadan birine atmak, raporu okuyan kişiye
 * bilmediğimizi bildiğimiz gibi göstermek olurdu.
 */
export const teslimOzeti = (
  satirlar: TeslimSatiri[],
  kalemsizFarklar: Fark[] = []
): TeslimOzeti => {
  let tamamlanan = 0, eksikKalan = 0, olculemeyen = 0, siparisDisi = 0
  let acikFark = kalemsizFarklar.length, acikIsEmri = 0

  for(const s of satirlar){
    acikFark += s.acikFarklar.length
    acikIsEmri += s.acikIsEmri
    if(s.siparisDisi){ siparisDisi += 1; continue }
    if(s.kalan === undefined){ olculemeyen += 1; continue }
    if(s.kalan <= 0) tamamlanan += 1
    else eksikKalan += 1
  }

  return {
    kalemSayisi: satirlar.length,
    tamamlanan, eksikKalan, olculemeyen, siparisDisi,
    acikFark, acikIsEmri,
  }
}

/**
 * Tek cümlelik durum. Ekranın üstünde duruyor ki kullanıcı tabloyu okumadan
 * önce "bu sipariş kapandı mı" sorusunun cevabını görsün.
 *
 * ⚠️ Ölçülemeyen kalem varsa "tamamlandı" DENMEZ. Hesaplanamayan bir satırın
 * üstüne "tamam" yazmak, en tehlikeli yalandır: kimse bir daha bakmaz.
 */
export const teslimCumlesi = (o: TeslimOzeti): string => {
  if(o.kalemSayisi === 0) return 'Bu siparişte kalem yok.'

  const parcalar: string[] = []
  if(o.eksikKalan > 0)  parcalar.push(`${o.eksikKalan} kalem eksik`)
  if(o.olculemeyen > 0) parcalar.push(`${o.olculemeyen} kalem ölçülemiyor (birim farklı)`)
  if(o.siparisDisi > 0) parcalar.push(`${o.siparisDisi} kalem sipariş dışı`)
  if(o.acikFark > 0)    parcalar.push(`${o.acikFark} açık fark kaydı`)

  if(parcalar.length === 0) return 'Sipariş tamamen teslim edildi.'
  return parcalar.join(' · ')
}

/**
 * Bir kalemin üretim sütununda ne yazacağı.
 *
 * ⚠️ İş emri HİÇ yoksa bu kalem depodan karşılanıyor demektir ve üretim 0
 * olması DOĞRUDUR; "eksik" yazmak yanlış alarm olurdu. Bu ayrımı tek yerde
 * tutuyoruz ki ekranlar arasında farklı yorumlanmasın.
 */
export const uretimCumlesi = (s: TeslimFarkiSatiri): string => {
  if(s.isEmriSayisi === 0) return 'Depodan — üretilmiyor'
  if(!s.uretimOlculebilir){
    return `${s.hazirlandi} ${s.hazirlandiBirim ?? ''} üretildi (sipariş birimi farklı, kıyas yok)`.trim()
  }
  const acik = s.acikIsEmri > 0 ? ` · ${s.acikIsEmri} iş emri açık` : ''
  return `${s.hazirlandi} ${s.hazirlandiBirim ?? ''} üretildi${acik}`.trim()
}
