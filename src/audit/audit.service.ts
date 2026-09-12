// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4 — Denetim kaydının okunabilir hâli
//
// Denetim kaydı ham hâliyle işe yaramaz: `{"status":{"eski":"OPEN",
// "yeni":"APPLIED"}}` bir kullanıcıya hiçbir şey söylemez. Buradaki işlerin
// tamamı "veritabanının yazdığını insanın okuyabileceği cümleye çevirmek".
//
// ⚠️ Çeviri YORUM YAPMAZ. Kaydın söylemediği hiçbir şeyi eklemiyoruz; sadece
// söylediğini Türkçeleştiriyoruz. Denetim kaydının değeri, ne yazdığına
// güvenilebilmesinden geliyor.
// ═══════════════════════════════════════════════════════════════════════════

import {
  ISLEM_ETIKETLERI, KULLANICI_ALANLARI, alanAdi, tabloAdi,
  type AlanDegisimi, type DenetimKaydi,
} from './audit.repository'

/** Belge durumlarının Türkçesi. Sözlükte yoksa ham değer görünür. */
const DURUM_ETIKETLERI: Record<string, string> = {
  DRAFT: 'Hazırlanıyor',
  OPEN: 'Sayım sürüyor',
  APPLIED: 'Uygulandı',
  CANCELLED: 'İptal',
  PLANNED: 'Planlandı',
  LOADED: 'Yüklendi',
  DELIVERED: 'Teslim edildi',
}

/**
 * Tek bir değerin okunabilir hâli.
 *
 * `null` ile boş metin AYRI gösteriliyor: "(boş)" ile "(yok)" farklı şeyler.
 * Birincisi yazılmış ama boş bir alan, ikincisi hiç değer olmaması. Denetimde
 * bu ayrım "sildi mi, boş mu bıraktı" sorusunu cevaplıyor.
 */
export const degeriYaz = (deger: unknown): string => {
  if(deger === null || deger === undefined) return '(yok)'
  if(typeof deger === 'boolean') return deger ? 'evet' : 'hayır'
  if(typeof deger === 'number') return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 }).format(deger)
  const m = String(deger)
  if(m.trim() === '') return '(boş)'
  if(DURUM_ETIKETLERI[m]) return DURUM_ETIKETLERI[m]
  // ISO zaman damgası → yerel zaman. Uzunluk ve 'T' ile ayırt ediliyor;
  // yanlış tahmin edersek ham metni gösteriyoruz, uydurmuyoruz.
  if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(m)){
    const t = new Date(m)
    if(!Number.isNaN(t.getTime())) return t.toLocaleString('tr-TR')
  }
  if(/^\d{4}-\d{2}-\d{2}$/.test(m)){
    const t = new Date(`${m}T00:00:00`)
    if(!Number.isNaN(t.getTime())) return t.toLocaleDateString('tr-TR')
  }
  // Kimlikler uzun ve okunmaz; kısaltıp tam hâlini başlıkta veriyoruz.
  if(/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(m)) return `${m.slice(0, 8)}…`
  return m
}

/**
 * Alanın değerini, alanı BİLEREK yazar.
 *
 * `opened_by` gibi alanların değeri bir kullanıcı kimliğidir; kısaltılmış
 * kimlik göstermek ("f3d3aebd…") denetimin sorduğu soruyu cevapsız bırakır.
 * Sözlükte adı varsa ad, yoksa kısaltılmış kimlik gösterilir.
 */
export const alanDegeriniYaz = (
  alan: string, deger: unknown, kullanicilar: Record<string, string> = {},
): string => {
  if(KULLANICI_ALANLARI.has(alan) && typeof deger === 'string'){
    const ad = kullanicilar[deger]
    if(ad) return ad
  }
  return degeriYaz(deger)
}

export const degisimiYaz = (
  d: AlanDegisimi, kullanicilar: Record<string, string> = {},
): string =>
  `${alanAdi(d.alan)}: ${alanDegeriniYaz(d.alan, d.eski, kullanicilar)}`
  + ` → ${alanDegeriniYaz(d.alan, d.yeni, kullanicilar)}`

/**
 * Kaydın tek satırlık başlığı: "Sayım SAY-2026-0003 · Uygulandı".
 *
 * `ozet` tetikleyicide belgenin numarasından/adından türetiliyor; yoksa
 * satır kimliği kalıyor. Kimliği göstermek çirkin ama dürüst — "bilinmeyen
 * belge" yazmak, hangi satır olduğunu gizlerdi.
 */
export const baslik = (kayit: DenetimKaydi): string =>
  `${tabloAdi(kayit.tablo)} ${kayit.ozet ?? kayit.satirId}`

export const islemAdi = (kayit: DenetimKaydi): string =>
  ISLEM_ETIKETLERI[kayit.islem] ?? kayit.islem

/**
 * "Ne oldu" satırı.
 *
 * UPDATE'te en fazla üç alan yazılır; gerisi "+2 alan daha" olur. Bir
 * güncellemede otuz alan değişmişse hepsini listeye sığdırmaya çalışmak
 * listeyi okunmaz yapar — ayrıntı satırın kendisinde duruyor.
 */
export const kisaOzet = (
  kayit: DenetimKaydi, kullanicilar: Record<string, string> = {}, enFazla = 3,
): string => {
  if(kayit.islem !== 'UPDATE'){
    return kayit.islem === 'INSERT' ? 'Kayıt açıldı' : 'Kayıt silindi'
  }
  if(kayit.degisimler.length === 0) return 'Değişiklik ayrıntısı yok'
  const ilk = kayit.degisimler.slice(0, enFazla)
    .map(d => degisimiYaz(d, kullanicilar)).join(' · ')
  const kalan = kayit.degisimler.length - enFazla
  return kalan > 0 ? `${ilk} · +${kalan} alan daha` : ilk
}

export type DenetimOzeti = {
  toplam: number
  olusturma: number
  degisiklik: number
  silme: number
  /** Kaç ayrı kişi işlem yapmış. Aktörü bilinmeyenler ayrı sayılır. */
  kisi: number
  /** Aktörü çözülemeyen kayıt sayısı — SQL konsolundan yapılan işler. */
  aktorsuz: number
}

export const denetimOzeti = (kayitlar: DenetimKaydi[]): DenetimOzeti => ({
  toplam: kayitlar.length,
  olusturma: kayitlar.filter(k => k.islem === 'INSERT').length,
  degisiklik: kayitlar.filter(k => k.islem === 'UPDATE').length,
  silme: kayitlar.filter(k => k.islem === 'DELETE').length,
  kisi: new Set(kayitlar.map(k => k.aktorAd).filter(Boolean)).size,
  aktorsuz: kayitlar.filter(k => !k.aktorAd).length,
})

/** Bugünden geriye n gün — varsayılan aralık. */
export const gunOnce = (n: number, bugun: Date = new Date()): string => {
  const t = new Date(bugun)
  t.setDate(t.getDate() - n)
  return t.toISOString().slice(0, 10)
}
