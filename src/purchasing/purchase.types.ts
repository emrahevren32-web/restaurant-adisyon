// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Satın alma: ortak tipler ve durum kuralları
//
// Yol haritası maddesi: "Satın alma talebi ve siparişi"
//                       Bitti sayılır ki: "Talep → sipariş akışı uçtan uca"
//
// ── DURUM GEÇİŞLERİ NEDEN BURADA ─────────────────────────────────────────
// "Hangi durumdan hangisine geçilebilir" sorusu bir İŞ KURALIDIR. Ekrandaki
// düğmeleri gizleyerek uygulanırsa yalnızca görünürde uygulanmış olur: ikinci
// bir giriş yolu (Excel içe aktarma, API, bir sonraki ekran) kuralı hiç
// görmez. Bu yüzden geçiş tablosu tek bir yerde, veri olarak duruyor ve
// ekranlar da servisler de aynı tablodan okuyor.
// ═══════════════════════════════════════════════════════════════════════════

export type TalepDurumu =
  | 'DRAFT'      // Taslak — hâlâ düzenlenebilir
  | 'SUBMITTED'  // Onaya gönderildi
  | 'APPROVED'   // Onaylandı — siparişe dönüştürülebilir
  | 'REJECTED'   // Reddedildi
  | 'CANCELLED'  // İptal

export type SiparisDurumu =
  | 'DRAFT'      // Taslak — tedarikçi ve fiyat girilirken
  | 'SENT'       // Tedarikçiye gönderildi; mal bekleniyor
  | 'PARTIAL'    // Kısmen teslim alındı (mal kabul maddesinde kullanılacak)
  | 'RECEIVED'   // Tamamı teslim alındı
  | 'CANCELLED'

/**
 * İzin verilen geçişler.
 *
 * Boş dizi = son durum. `REJECTED` ve `CANCELLED` bilerek çıkışsızdır:
 * reddedilen bir talebi "geri açmak", onay kaydını sessizce geçersiz kılardı.
 * Gerekirse yeni talep açılır — ve o zaman iki kayıt da tarihte kalır.
 */
export const TALEP_GECISLERI: Readonly<Record<TalepDurumu, readonly TalepDurumu[]>> = {
  DRAFT:     ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED:  ['CANCELLED'],
  REJECTED:  [],
  CANCELLED: [],
}

/**
 * `PARTIAL` ve `RECEIVED`e geçiş BURADAN yapılmaz.
 *
 * O ikisi mal kabulün sonucudur, bir kullanıcı kararı değil: teslim alınan
 * miktar sipariş miktarına eşitse RECEIVED, azsa PARTIAL olur. Elle
 * seçilebilir yapmak, "sistemde teslim alınmış ama depoda olmayan mal"
 * üretirdi — ve stok defteriyle sipariş kaydı ayrışırdı.
 */
export const SIPARIS_GECISLERI: Readonly<Record<SiparisDurumu, readonly SiparisDurumu[]>> = {
  DRAFT:     ['SENT', 'CANCELLED'],
  SENT:      ['CANCELLED'],
  PARTIAL:   [],
  RECEIVED:  [],
  CANCELLED: [],
}

export const TALEP_DURUM_ETIKETLERI: Readonly<Record<TalepDurumu, string>> = {
  DRAFT: 'Taslak',
  SUBMITTED: 'Onay bekliyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  CANCELLED: 'İptal',
}

export const SIPARIS_DURUM_ETIKETLERI: Readonly<Record<SiparisDurumu, string>> = {
  DRAFT: 'Taslak',
  SENT: 'Gönderildi',
  PARTIAL: 'Kısmen teslim',
  RECEIVED: 'Teslim alındı',
  CANCELLED: 'İptal',
}

export type TalepSatiri = {
  id: string
  stokKalemiId: string
  /** Ekranda göstermek için; kaynak `stock_item`. */
  stokKalemiAd?: string
  miktar: number
  birim: string
  not?: string
  siraNo: number
}

export type Talep = {
  id: string
  talepNo: string
  durum: TalepDurumu
  gerekenTarih?: string
  not?: string
  kararNotu?: string
  olusturanId?: string
  kararVerenId?: string
  kararTarihi?: string
  olusturmaTarihi: string
  satirlar: TalepSatiri[]
}

export type SiparisSatiri = {
  id: string
  stokKalemiId: string
  stokKalemiAd?: string
  miktar: number
  birim: string
  birimFiyat: number
  not?: string
  siraNo: number
}

export type Siparis = {
  id: string
  siparisNo: string
  durum: SiparisDurumu
  tedarikciId: string
  tedarikciAd?: string
  talepId?: string
  paraBirimi: string
  beklenenTarih?: string
  not?: string
  gonderimTarihi?: string
  olusturmaTarihi: string
  satirlar: SiparisSatiri[]
}

export class GecersizDurumGecisiError extends Error {
  constructor(nesne: string, mevcut: string, istenen: string) {
    super(`${nesne} "${mevcut}" durumundan "${istenen}" durumuna geçemez.`)
    this.name = 'GecersizDurumGecisiError'
  }
}

export class SatinAlmaDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'SatinAlmaDogrulamaError'
  }
}

/** Sipariş toplamı. Tek yerde: ekran ve rapor aynı sayıyı görmeli. */
export const siparisToplami = (satirlar: readonly SiparisSatiri[]): number =>
  Math.round(satirlar.reduce((t, s) => t + (s.miktar * s.birimFiyat), 0) * 100) / 100
