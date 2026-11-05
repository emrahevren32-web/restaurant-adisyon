// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Test desteği — KAYNAK METİNDEN YORUMLARI SOYMA
//
// ── NEDEN TEK KOPYA (MIYOP-089'un dersi) ─────────────────────────────────
// Kodu metin olarak okuyan her mimari test, iddiasını kurmadan önce
// yorumları atmak zorunda. Sebebi iki yönlü:
//   · bu depoda yorumlar KALDIRILAN kodu kelime kelime alıntılıyor
//     (bilerek — yoksa bir sonraki kişi aynı şeyi geri yazar), yani
//     yorumlu metinde arama yapan "geri gelmemiş" kontrolü kendi notumuza
//     takılıp kırılır;
//   · ve tersi daha sinsi: korunan bir satırı `//` ile SUSTURMAK, düz
//     metne bakan bir bekçiyi yeşil bırakır (MIYOP-098, tuzak 181).
//
// ⚠️ Bu soyucu her teste yeniden YAZILMAZ, buradan alınır. İkiz bir kopya,
// asıl ölçüm bozulduğunda sessizce yeşil verir — MIYOP-089'da tam bu oldu.
//
// ⚠️ SINIRI: bu bir ayrıştırıcı değil, bir metin soyucusu. `https://` gibi
// dizgeler bozulmasın diye `//` yalnız iki nokta üst üste gelmiyorsa
// atılıyor. Dizge içindeki başka bir `//` için güvencesi yok.
// ═══════════════════════════════════════════════════════════════════════════

/** Blok yorumları ve satır içi yorumları atar. */
export const yorumsuzKod = (metin: string): string => metin
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .map(satir => satir.replace(/(^|[^:])\/\/.*$/, '$1'))
  .join('\n')
