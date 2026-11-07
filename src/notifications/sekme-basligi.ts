// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Sekme başlığındaki okunmamış sayısı
//
// ── NEDEN VAR ─────────────────────────────────────────────────────────────
// Emrah 06.11'de üç geri arama talebini kaçırdı. Ölçüm (07.11, canlı site)
// zilin ÇALIŞTIĞINI gösterdi: 60 saniyede bir tazeleniyor, rozet doğru
// sayıyor. Eksik olan şuydu: **zil sessiz.** Ses yok, masaüstü bildirimi
// yok, sekme başlığında sayı yok. Rozet sessizce beliriyor ve Emrah zil
// ikonuna bakmıyorsa fark etmiyor.
//
// ⚠️ Neden sekme başlığı seçildi (Emrah kararı, 07.11):
//   · İZİN İSTEMEZ. Masaüstü bildirimi tarayıcı izni ister ve tarayıcı
//     kapalıyken yine çalışmaz.
//   · ARKA PLANDAKİ SEKMEDE DE GÖRÜNÜR. Asıl sorun buydu: Emrah başka bir
//     sekmedeyken zil ikonu görünmüyor bile.
//   · SUNUCU DEĞİŞMEZ. Anlık itme (realtime) `callback_request` üzerinde
//     okuma yetkisi isterdi — 0106 orayı bilerek kapatmıştı.
//
// ── TEK YAZAR KURALI ─────────────────────────────────────────────────────
// ⚠️ `document.title`a YAZAN TEK YER `App.tsx`tir ve oraya yazdığı değeri
// BU fonksiyon üretir. İki yazar olsaydı biri diğerini ezerdi: App başlığı
// işletme adına kurarken zil önekini sessizce silerdi ve sayı rastgele
// kaybolurdu. `sekme-basligi.arch.test.ts` bu tekliği donduruyor.
//
// Fonksiyon SAF: tarayıcıya dokunmuyor, yalnız metni üretiyor. Böylece
// kural sınanabiliyor.
// ═══════════════════════════════════════════════════════════════════════════

/** Başlıkta bu sayıdan fazlası "99+" diye yazılır (rozetle aynı eşik). */
export const SEKME_BASLIGI_SINIRI = 99

/**
 * Sekme başlığını üretir.
 *
 * @param temel    Başlığın asıl metni (işletme/platform adı).
 * @param okunmamis Okunmamış bildirim sayısı.
 *
 * ⚠️ `okunmamis` SAVUNMALI okunuyor. Sayı bir sayaçtan geliyor ve
 * `undefined`, `NaN` ya da eksi gelmesi mümkün; "(NaN) EVREN360" yazan bir
 * sekme, olmayan bir hatayı varmış gibi gösterir.
 */
export const sekmeBasligi = (temel: string, okunmamis: number): string => {
  const ad = String(temel ?? '').trim()
  const sayi = Number.isFinite(okunmamis) ? Math.floor(okunmamis) : 0

  // ⚠️ Başlık boşsa önek TEK BAŞINA yazılmıyor: "(3)" diye bir sekme adı,
  // kullanıcıya neyin üç tane olduğunu söylemez.
  if(ad === '') return ad
  if(sayi <= 0) return ad

  return `(${sayi > SEKME_BASLIGI_SINIRI ? `${SEKME_BASLIGI_SINIRI}+` : sayi}) ${ad}`
}
