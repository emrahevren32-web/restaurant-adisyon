// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · AYRINTI KAPISI — "ekrandaki ayrıntı, seçili kayda mı ait?"
//
// ── NEDEN VAR (MIYOP-010 + MIYOP-064 · A3) ───────────────────────────────
// Altı ekranda aynı desen vardı: solda liste, sağda seçilen kaydın ayrıntısı.
// Seçim HEMEN değişiyor, ayrıntı ise istekler dönünce yazılıyordu:
//
//     const sec = async (k) => {
//       setSecili(k)                  // ① seçim anında değişti
//       await ayrintiYukle(k)         // ② ayrıntı saniyeler sonra geldi
//     }
//
// ① ile ② arasında ekranda **yeni kaydın adı, eski kaydın ayrıntısı** durur.
// Etiket ekranında bunun anlamı şuydu: B ürününün etiketine A ürününün
// alerjeni basılabiliyordu. Kaydet'e basıldığında da A'nın beyanı B'nin
// kartına yazılabiliyordu. Codex bunu MIYOP-010'da Etiketler için, MIYOP-064
// ile Depo, Siparişler, Müşteriler, İş Emirleri ve Sevkiyatlar için işaret
// etti. Tek ekrana yama atmak aileyi kapatmaz.
//
// ⚠️ İKİNCİ KUSUR: GEÇ GELEN CEVAP. Hızlı A→B seçiminde A'nın isteği B'den
// SONRA dönebilir ve B'nin ayrıntısını ezer. Ekranda B yazar, içerik A'dır.
// Hiçbir hata mesajı çıkmaz; yanlış olan şey sessizce doğru görünür.
//
// ── KARAR: KİMLİK, SÜRÜM NUMARASIDIR ─────────────────────────────────────
// Ayrı bir sayaç tutmak yerine, gelen cevabın hangi kayda ait olduğunu
// soruyoruz. Seçili kayıt değiştiyse gelen cevap ATILIR. Bu hem geç gelen
// cevabı hem de "eski ayrıntı ekranda kaldı" hâlini tek kuralla kapatıyor.
//
// ⚠️ Aynı kaydın iki kez seçilmesi (yenileme) bu kuralı delmez: ikisi de
// aynı kimliği taşır, geç gelen aynı veriyi yazar. Zararsız.
//
// ── BU DOSYA SAF ─────────────────────────────────────────────────────────
// React yok, istek yok, zaman yok. Ekranlar kendi state'lerini tutmaya devam
// ediyor; buradan yalnız İKİ SORUNUN cevabını alıyorlar:
//   1. "Gelen cevabı yazayım mı?"  → kabulEdilirMi()
//   2. "Yazma/yazdırma düğmesi açık mı?" → ayrintiHazir()
// Saf olduğu için kararın kendisi testle donduruldu; altı ekran aynı kararı
// paylaşıyor ve hiçbiri kendi yorumunu yazmıyor.
// ═══════════════════════════════════════════════════════════════════════════

export type SecimDurumu = {
  /** Kullanıcının SEÇTİĞİ kayıt. Seçim anında değişir. */
  secilen: string | null
  /** Ayrıntısı EKRANDA duran kayıt. Yükleme bitince seçilene eşitlenir. */
  ekranda: string | null
  yukleniyor: boolean
  hata: string
}

export const SECIM_BOS: SecimDurumu = {
  secilen: null, ekranda: null, yukleniyor: false, hata: '',
}

/**
 * Yeni bir kayıt seçildi.
 *
 * ⚠️ `ekranda` ANINDA null oluyor. Bu satır bu dosyanın varlık sebebi:
 * eski ayrıntı bir an bile yeni kaydın başlığı altında durmamalı.
 */
export const secildi = (kimlik: string | null): SecimDurumu => ({
  secilen: kimlik,
  ekranda: null,
  yukleniyor: kimlik !== null,
  hata: '',
})

/**
 * Gelen cevap yazılsın mı?
 *
 * ⚠️ Tek ölçüt: cevap, ŞU AN seçili olan kayda mı ait. Değilse atılır —
 * geç gelen cevap bu satırda durur.
 */
export const kabulEdilirMi = (d: SecimDurumu, gelenKimlik: string): boolean =>
  d.secilen !== null && d.secilen === gelenKimlik

/** Ayrıntı geldi ve kabul edildi. */
export const ayrintiGeldi = (d: SecimDurumu, kimlik: string): SecimDurumu =>
  (kabulEdilirMi(d, kimlik)
    ? { secilen: d.secilen, ekranda: kimlik, yukleniyor: false, hata: '' }
    : d)

/**
 * Ayrıntı gelmedi.
 *
 * ⚠️ `ekranda` null KALIYOR: hata aldıysak elimizde gösterilecek doğru bir
 * ayrıntı yok demektir. Yarım veriyle açık kalan bir ekran, hata mesajından
 * daha tehlikelidir.
 */
export const ayrintiDustu = (
  d: SecimDurumu, kimlik: string, mesaj: string,
): SecimDurumu =>
  (kabulEdilirMi(d, kimlik)
    ? { secilen: d.secilen, ekranda: null, yukleniyor: false, hata: mesaj }
    : d)

/**
 * Ekrandaki ayrıntı seçili kayda AİT Mİ?
 *
 * Yazma ve yazdırma düğmeleri buna bakar. `false` iken basılan bir düğme,
 * yanlış kaydın verisini doğru kaydın kimliğiyle kaydeder.
 */
export const ayrintiHazir = (d: SecimDurumu): boolean =>
  d.secilen !== null && d.ekranda === d.secilen && !d.yukleniyor

/**
 * Düğme kapalıysa SEBEBİ. Kullanıcı neden basamadığını bilmezse kuralı
 * atlamanın yolunu arar (tuzak 126).
 */
export const ayrintiBeklemeSebebi = (d: SecimDurumu): string => {
  if(d.secilen === null) return 'Önce soldan bir kayıt seçin.'
  if(d.hata) return d.hata
  if(!ayrintiHazir(d)) return 'Bu kaydın ayrıntısı henüz yüklenmedi; bir saniye.'
  return ''
}
