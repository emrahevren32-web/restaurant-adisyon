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
}

export const satirlariDogrula = (
  noktaId: string, satirlar: readonly PortalSiparisSatiri[],
): PortalSiparisSatiri[] => {
  if(kirp(noktaId) === ''){
    throw new PortalDogrulamaError('Teslim noktası seçilmeli.')
  }
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
