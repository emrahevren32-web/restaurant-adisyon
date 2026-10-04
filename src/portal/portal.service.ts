// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C3 — Portal servisi
//
// ⚠️ SON SÖZ 0054'TE. Buradaki kontroller müşteriye iyi bir cümle kurmak için
// var; kuralı uygulayan MI431/MI432 tetikleri ve `security definer`
// fonksiyonlar. Bu ekran müşterinin elinde çalışıyor — buradaki hiçbir
// kontrole GÜVENİLMEZ, hepsi sunucuda tekrar yapılıyor.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  PortalDeposu, PortalNoktasi, PortalSiparisi, PortalSiparisSatiri, PortalUrunu,
} from './portal.repository'

export class PortalDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'PortalDogrulamaError'
  }
}

const kirp = (d?: string) => (d ?? '').trim()

export class PortalServisi {
  constructor(private readonly depo: PortalDeposu) {}

  noktalarim(): Promise<PortalNoktasi[]> { return this.depo.noktalarim() }
  urunlerim(noktaId: string): Promise<PortalUrunu[]> { return this.depo.urunlerim(noktaId) }
  enErkenSevk(noktaId: string): Promise<string | undefined> {
    return this.depo.enErkenSevk(noktaId)
  }
  siparislerim(): Promise<PortalSiparisi[]> { return this.depo.siparislerim() }
  satirlarim(no: string) { return this.depo.satirlarim(no) }

  // ⚠️ `async` (tuzak 41): değilse doğrulama senkron fırlatır, Promise hiç
  // doğmaz ve `.catch()` yazan çağıran hatayı hiç görmez.
  async siparisVer(
    noktaId: string, satirlar: readonly PortalSiparisSatiri[],
    teslimTarihi?: string, not?: string,
  ): Promise<string> {
    const temiz = satirlariDogrula(noktaId, satirlar)
    return this.depo.siparisVer(noktaId, temiz, kirp(teslimTarihi) || undefined,
      kirp(not) || undefined)
  }

  /**
   * Var olan siparişe yeni revizyon yazar — 0063.
   *
   * ⚠️ `async` (tuzak 41). ⚠️ Teslim NOKTASI burada değişmiyor: nokta ya da
   * tarih değişikliği LOJİSTİK revizyonudur ve üretimi yeniden onaylatmayı
   * gerektirmez. Portaldan yapılan bu iş MİKTAR revizyonudur.
   */
  async siparisGuncelle(
    siparisNo: string, satirlar: readonly PortalSiparisSatiri[], gerekce?: string,
  ): Promise<number> {
    if(kirp(siparisNo) === ''){
      throw new PortalDogrulamaError('Hangi siparişin güncelleneceği belli değil.')
    }
    const temiz = siparisSatirlariniDogrula(satirlar)
    return this.depo.siparisGuncelle(siparisNo, temiz, kirp(gerekce) || undefined)
  }
}

export const satirlariDogrula = (
  noktaId: string, satirlar: readonly PortalSiparisSatiri[],
): PortalSiparisSatiri[] => {
  if(kirp(noktaId) === ''){
    throw new PortalDogrulamaError('Teslim noktası seçilmeli.')
  }
  return siparisSatirlariniDogrula(satirlar)
}

/**
 * Satır listesinin kendi kontrolü — nokta seçiminden BAĞIMSIZ.
 *
 * Güncellemede nokta sorulmuyor: siparişin noktası değişmiyor (o bir
 * LOJİSTİK revizyonudur). Kontrolü ayırmasaydık, güncelleme için uydurma
 * bir nokta kimliği geçirmek gerekirdi.
 */
export const siparisSatirlariniDogrula = (
  satirlar: readonly PortalSiparisSatiri[],
): PortalSiparisSatiri[] => {
  if(satirlar.length === 0){
    throw new PortalDogrulamaError('Sipariş en az bir ürün içermeli.')
  }
  const gorulen = new Set<string>()
  satirlar.forEach((s, i) => {
    const sira = i + 1
    if(kirp(s.kalemId) === ''){
      throw new PortalDogrulamaError(`${sira}. satırda ürün seçilmemiş.`)
    }
    if(!(s.miktar > 0)){
      throw new PortalDogrulamaError(`${sira}. satırın miktarı sıfırdan büyük olmalı.`)
    }
    if(kirp(s.birim) === ''){
      throw new PortalDogrulamaError(`${sira}. satırın birimi zorunlu.`)
    }
    if(gorulen.has(s.kalemId)){
      // İki satır toplanmaz: biri diğerini gizler ve müşteri hangisinin
      // gittiğini bilemez.
      throw new PortalDogrulamaError(
        `${sira}. satırdaki ürün siparişte zaten var. Miktarı tek satırda yazın.`,
      )
    }
    gorulen.add(s.kalemId)
  })
  return satirlar.map(s => ({ ...s, birim: kirp(s.birim) }))
}

/**
 * Portaldan hangi durumdaki sipariş değiştirilebilir — 0063'ün kuralının
 * ekran tarafı.
 *
 * ⚠️ SON SÖZ SUNUCUDA (MI433). Buradaki liste, reddedileceği belli bir
 * düğmeyi müşteriye bastırmamak için var.
 *
 * ⚠️ "Hazır" da listede ve bu bilinçli: mal paketlenmiş olsa bile müşteri
 * değişiklik isteyebilir. Engellersek müşteri telefonu açar ve değişiklik
 * SİSTEM DIŞINDA olur — defterin işi gerçeği yazmaktır.
 */
export const PORTALDAN_DEGISTIRILEBILIR: readonly string[] =
  ['Taslak', 'Onay Bekliyor', 'Onaylandı', 'Hazırlanıyor', 'Hazır']

export const guncellenebilirMi = (durum: string): boolean =>
  PORTALDAN_DEGISTIRILEBILIR.includes(durum)

/** Değiştirilemiyorsa SEBEBİ; değiştirilebiliyorsa `undefined`. */
export const guncellemeEngeli = (durum: string): string | undefined => {
  if(guncellenebilirMi(durum)) return undefined
  if(durum === 'İptal'){
    return 'Bu sipariş iptal edilmiş. Yeni bir sipariş girebilirsiniz.'
  }
  // Kısmi Sevk · Sevk Edildi · Teslim Edildi
  return 'Bu siparişin malı yola çıktı; portaldan değiştirilemez. '
    + 'Eksik, fazla ya da hasarlı bir durum varsa işletmeye bildirin.'
}

/**
 * Müşteriye gösterilen durum metni.
 *
 * ⚠️ İç durumlar müşteriye AYNEN gösterilmiyor. "Hazırlanıyor" müşteri için
 * anlamlı, "Kısmi Sevk" değil — müşteri kendi kapısında ne olduğunu bilmek
 * ister, bizim depo hâlimizi değil.
 */
export const portalDurumu = (durum: string): string => {
  switch(durum){
    case 'Taslak':        return 'Hazırlanmadı'
    case 'Onay Bekliyor': return 'İnceleniyor'
    case 'Onaylandı':     return 'Onaylandı'
    case 'Hazırlanıyor':  return 'Hazırlanıyor'
    case 'Hazır':         return 'Sevke hazır'
    case 'Kısmi Sevk':    return 'Kısmen yolda'
    case 'Sevk Edildi':   return 'Yolda'
    case 'Teslim Edildi': return 'Teslim edildi'
    case 'İptal':         return 'İptal'
    default:              return durum
  }
}

/**
 * Müşteriye söylenecek tarih cümlesi.
 *
 * Söz verilen tarih istenen tarihten farklıysa BUNU SÖYLÜYORUZ. Sessizce
 * kendi tarihimizi göstermek, müşterinin beklediği günü kaçırmasına yol
 * açardı ve bunu ancak mal gelmeyince anlardı.
 */
export const tarihCumlesi = (s: PortalSiparisi): string => {
  const yaz = (d?: string) =>
    (d ? new Date(`${d}T00:00:00`).toLocaleDateString('tr-TR') : '—')
  if(!s.sozTarihi) return `Sevk: ${yaz(s.sevkTarihi)}`
  if(s.sevkTarihi && s.sozTarihi !== s.sevkTarihi){
    return `Sevk: ${yaz(s.sevkTarihi)} · söz verilen teslim: ${yaz(s.sozTarihi)}`
  }
  return `Teslim: ${yaz(s.sozTarihi)}`
}
