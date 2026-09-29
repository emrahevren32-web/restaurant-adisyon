// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C2 — SİPARİŞTEN SEVKİYAT TÜRETME
//
// Yol haritası maddesi: "Siparişten iş emri ve sevkiyat türetme".
//
// Burada SAF MANTIK var: veritabanı da yok, ekran da yok. Sebebi, aynı
// hesabın üç yerden çağrılacak olması — ekran, portal (A4C3) ve ileride
// toplu sevk. Üçünün aynı sayıyı bulması, hesabın tek yerde durmasına bağlı.
//
// ⚠️ SON SÖZ 0051'DE. Buradaki kontroller kullanıcıya iyi bir cümle kurmak
// için var; kuralı uygulayan MI426/MI427/MI428 tetikleri.
// ═══════════════════════════════════════════════════════════════════════════

import type { YeniSevkiyat } from '../production/shipment.repository'
import type { Siparis, SiparisDurumu } from './sales-order.repository'

/**
 * Bir kalemin sevk durumu — `app.siparis_sevk_durumu()` çıktısının TS karşılığı.
 *
 * ⚠️ `kalan` İSTEĞE BAĞLI ve bu bilinçli. Birimler uyuşmuyorsa veritabanı
 * NULL döndürüyor: 100 kg'dan 5 koli çıkarılmaz. Burada 0 yazsaydık,
 * bilmediğimiz bir şeyi "bitti" diye göstermiş olurduk.
 */
export type KalemSevkDurumu = {
  kalemId: string
  kalemAdi?: string
  siparisMiktar?: number
  siparisBirim?: string
  sevkMiktar: number
  sevkBirimleri: string[]
  kalan?: number
  birimUyusmuyor: boolean
  /** Siparişte olmayan bir kalem gönderilmiş. Fark kaydı konusudur. */
  siparisDisi: boolean
}

export class SevkiyatTuretmeError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'SevkiyatTuretmeError'
  }
}

/**
 * Siparişten sevkiyat ancak bu durumlarda türetilir.
 *
 * "Hazırlanıyor" bilerek DIŞARIDA: mal henüz üretim bandında. Sevkiyatı
 * taslak olarak hazırlamak serbest, ama siparişe bağlamak mal hazır
 * olduğunda anlamlı. 0051 bunu MI428 ile söylüyor.
 */
export const TURETILEBILIR_DURUMLAR: readonly SiparisDurumu[] =
  ['Hazır', 'Kısmi Sevk', 'Sevk Edildi']

const sayiyla = (n: number) => n.toLocaleString('tr-TR')

/**
 * Siparişin KALAN kalemlerinden bir sevkiyat taslağı kurar.
 *
 * Neden kalan, neden sipariş miktarı değil: aynı siparişten ikinci sevkiyat
 * çıkarken tam miktarı tekrar yazsaydık, müşteriye iki katı mal giderdi ve
 * kimse fark etmezdi.
 */
export const sevkiyatTuret = (
  siparis: Siparis,
  durumlar: readonly KalemSevkDurumu[],
  sevkiyatNo: string,
): YeniSevkiyat => {
  if(!TURETILEBILIR_DURUMLAR.includes(siparis.durum)){
    throw new SevkiyatTuretmeError(
      `${siparis.siparisNo} siparişi "${siparis.durum}" durumunda. Sevkiyat `
      + 'çıkarmak için önce siparişi "Hazır" yapın — hazır olmayan malın '
      + 'yola çıkması, olmayan malı sevk etmektir.',
    )
  }

  // Birim uyuşmazlığını SESSİZCE ATLAMIYORUZ. Atlarsak eksik bir sevkiyat
  // kurulur ve eksikliğin sebebi hiçbir yerde yazmaz.
  const karisik = durumlar.filter(d => d.birimUyusmuyor)
  if(karisik.length > 0){
    const adlar = karisik.map(d => d.kalemAdi ?? d.kalemId).join(', ')
    throw new SevkiyatTuretmeError(
      `Şu kalemlerde sipariş birimi ile sevk birimi uyuşmuyor: ${adlar}. `
      + 'Kalan miktar hesaplanamıyor; sevkiyatı elle kurun ya da önce '
      + 'birimleri düzeltin.',
    )
  }

  const satirlar = durumlar
    .filter(d => !d.siparisDisi && (d.kalan ?? 0) > 0)
    .map(d => ({
      stokKalemiId: d.kalemId,
      miktar: d.kalan as number,
      birim: d.siparisBirim as string,
    }))

  if(satirlar.length === 0){
    throw new SevkiyatTuretmeError(
      `${siparis.siparisNo} siparişinin sevk edilmemiş kalemi kalmadı.`,
    )
  }

  if(!siparis.musteriId || !(siparis.musteriAdi ?? '').trim()){
    // Belgede müşteri adı YAZILI olmak zorunda: geri çağırmada "kimi
    // arayacağız" sorusunu cevaplayan yer orası.
    throw new SevkiyatTuretmeError(
      `${siparis.siparisNo} siparişinin müşteri kartı okunamadı; sevkiyat `
      + 'çıkarılamıyor.',
    )
  }

  const girdi: YeniSevkiyat = {
    sevkiyatNo,
    musteriId: siparis.musteriId,
    // ⚠️ Ad KOPYALANIYOR ve donuyor: kart yarın yeniden adlandırılsa bile
    // bugün kesilen irsaliye değişmez.
    musteriAd: (siparis.musteriAdi ?? '').trim(),
    siparisId: siparis.id,
    satirlar,
  }
  if(siparis.noktaId) girdi.noktaId = siparis.noktaId
  if(siparis.sevkTarihi) girdi.sevkTarihi = siparis.sevkTarihi
  return girdi
}

/** Ekranda kalemin yanına yazılan tek satır: "40 koli · 15 gitti · 25 kaldı". */
export const sevkOzeti = (d: KalemSevkDurumu): string => {
  if(d.siparisDisi){
    return `siparişte yok · ${sayiyla(d.sevkMiktar)} ${d.sevkBirimleri.join('/')} gitti`
  }
  const bas = `${sayiyla(d.siparisMiktar ?? 0)} ${d.siparisBirim ?? ''}`.trim()
  if(d.birimUyusmuyor){
    return `${bas} · ${sayiyla(d.sevkMiktar)} ${d.sevkBirimleri.join('/')} gitti `
      + '· birimler uyuşmuyor, kalan hesaplanamıyor'
  }
  if(d.sevkMiktar === 0) return `${bas} · henüz sevk edilmedi`
  const kalan = d.kalan ?? 0
  if(kalan <= 0) return `${bas} · tamamı gitti`
  return `${bas} · ${sayiyla(d.sevkMiktar)} gitti · ${sayiyla(kalan)} kaldı`
}

/**
 * Siparişin bütününe bakan tek cümle. Ekranın üst şeridinde duruyor.
 *
 * "Fazla" ayrı sayılıyor: eksik gönderimle fazla gönderim birbirini
 * götürmez, ikisi de ayrı birer fark konusudur.
 */
export type SevkOzetiToplam = {
  kalemSayisi: number
  tamamlanan: number
  bekleyen: number
  fazlaGiden: number
  siparisDisiKalem: number
  hesaplanamayan: number
}

export const sevkToplami = (durumlar: readonly KalemSevkDurumu[]): SevkOzetiToplam => {
  const icerdeki = durumlar.filter(d => !d.siparisDisi && !d.birimUyusmuyor)
  return {
    kalemSayisi: durumlar.filter(d => !d.siparisDisi).length,
    tamamlanan: icerdeki.filter(d => d.kalan === 0).length,
    bekleyen:   icerdeki.filter(d => (d.kalan ?? 0) > 0).length,
    // Sipariştekinden FAZLA gitmiş: kalan eksiye düşer. Eksikle
    // toplanmıyor — ikisi ayrı birer fark konusudur.
    fazlaGiden: icerdeki.filter(d => (d.kalan ?? 0) < 0).length,
    siparisDisiKalem: durumlar.filter(d => d.siparisDisi).length,
    hesaplanamayan:   durumlar.filter(d => d.birimUyusmuyor).length,
  }
}
