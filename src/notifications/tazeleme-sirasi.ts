// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · ZİL TAZELEMESİ — SON İSTEK KAZANIR (MIYOP-104)
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// Zil (`AppShell`) bildirimleri DÖRT ayrı tetikleyiciyle tazeliyor:
// dakikada bir yoklama, sekmeye dönüş, panelin açılması ve "okundu"
// işaretinin yayımladığı olay. Yani aynı anda birden fazla istek havada
// olabiliyor ve **cevaplar gönderildikleri sırayla dönmek zorunda değil.**
//
// Kusur şöyle yaşanıyordu:
//   t0 · tazeleme A başlıyor, "okunanlar" listesini BOŞ okuyor
//   t1 · Emrah bildirime tıklıyor → okundu işareti kaydediliyor
//        → olay → tazeleme B başlıyor, "okunanlar"ı OKUNMUŞ okuyor
//   t2 · B dönüyor → bildirim okunmuş görünüyor (doğru)
//   t3 · A dönüyor (daha yavaştı) → kendi ESKİ anlık görüntüsünü yazıyor
//        → bildirim yeniden OKUNMAMIŞ görünüyor
//
// Sonuç: rozet yeniden "1" oluyor, sekme başlığı yeniden `(1) EVREN360`
// yazıyor. Emrah okuduğu bildirimi ikinci kez okuyor ve bir süre sonra
// zile güvenmeyi bırakıyor — zilin tek işi güvenilir olmak.
//
// ── KURAL ────────────────────────────────────────────────────────────────
// **Yalnız EN SON başlayan isteğin cevabı ekrana yazılır.** Daha önce
// başlamış bir isteğin cevabı, kendisinden sonra bir istek başladıysa
// ATILIR: o cevap tanım gereği daha eski bir dünyayı anlatıyor.
//
// ⚠️ Kural neden burada, `AppShell` içinde değil: üç satırlık bir sayaç
// bile ölçülmediği sürece bir niyettir. Burada saf fonksiyon olduğu için
// `tazeleme-sirasi.test.ts` onu doğrudan sınıyor.
//
// ⚠️ "İsteği iptal et" (AbortController) DEĞİL, bilerek. İptal ağ isteğini
// kesmeye çalışır; buradaki sorun ağ değil, YAZMA SIRASI. Üç kaynak
// `Promise.all` ile birlikte okunuyor ve iptal edilse bile yarısı dönmüş
// olabilir. Cevabı yazmadan önce "hâlâ en yeni miyim" diye sormak,
// iptalden hem daha basit hem daha kesin.
// ═══════════════════════════════════════════════════════════════════════════

/** Sayaç kabı — React tarafında `useRef(0)`, testte düz bir nesne. */
export type SiraSayaci = { current: number }

/**
 * Yeni bir tazeleme başlat ve sıra numarasını al.
 *
 * ⚠️ Sayaç ÖNCE artıyor: ilk tazeleme 1 alır. Sıfır "hiç tazeleme
 * başlamadı" demek; bir isteğin sıra numarası asla 0 olmaz.
 */
export const yeniTazeleme = (sayac: SiraSayaci): number => {
  sayac.current += 1
  return sayac.current
}

/**
 * Bu cevap ekrana yazılabilir mi?
 *
 * Yalnız en son başlayan istek için `true`. Kendisinden sonra bir istek
 * başladıysa `false` — o cevap eski bir dünyayı anlatıyor.
 */
export const sonTazelemeMi = (sayac: SiraSayaci, sira: number): boolean =>
  sira === sayac.current
