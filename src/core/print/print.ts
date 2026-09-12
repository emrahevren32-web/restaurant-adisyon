// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Çıktı — yazdırılabilir belge penceresi
//
// Yol haritası maddeleri: "İrsaliye / sevk belgesi çıktısı",
//                         "Tek tuşla geri çağırma listesi + PDF"
//         Bitti sayılır ki: "Yazdırılabilir, PDF alınabilir"
//
// ── PDF NEDEN AYRI BİR KÜTÜPHANE DEĞİL ───────────────────────────────────
// Tarayıcının kendi yazdırma penceresi zaten "Hedef: PDF olarak kaydet"
// seçeneği sunuyor. Ayrı bir PDF kütüphanesi eklemek, Türkçe karakterler için
// ayrıca font gömmeyi, sayfa kırılmalarını elle hesaplamayı ve her belge için
// ikinci bir düzen bakımını getirirdi. Kazanç yok, bakım yükü çok.
//
// ── NEDEN AYRI PENCERE DEĞİL, GÖRÜNMEZ ÇERÇEVE ───────────────────────────
// `window.open` açılır pencere engelleyicisine takılır ve kullanıcı hiçbir
// şey olmadığını görür — düğme bozuk sanılır. Görünmez bir çerçeve (iframe)
// engellenmez.
// ═══════════════════════════════════════════════════════════════════════════

/** HTML'e gömülen her metin buradan geçer. Müşteri adı veri, kod değildir. */
export const kacir = (metin: unknown): string =>
  String(metin ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

/** Çıktı sayfasının kendi stili — uygulamanınkinden bağımsız, sade, siyah beyaz. */
const STIL = `
  *{ box-sizing:border-box }
  body{
    margin:0; padding:24px 28px;
    font:13px/1.5 -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
    color:#111; background:#fff;
  }
  h1{ font-size:19px; margin:0 0 2px }
  h2{ font-size:14px; margin:22px 0 6px; padding-bottom:4px; border-bottom:1px solid #111 }
  .ust{ display:flex; justify-content:space-between; align-items:flex-start;
        gap:24px; border-bottom:2px solid #111; padding-bottom:10px; margin-bottom:14px }
  .kucuk{ font-size:11px; color:#555 }
  dl{ display:grid; grid-template-columns:auto 1fr; gap:3px 12px; margin:0 }
  dt{ color:#555 }
  dd{ margin:0 }
  table{ width:100%; border-collapse:collapse; margin-top:6px }
  th,td{ border:1px solid #bbb; padding:5px 7px; text-align:left; vertical-align:top }
  th{ background:#f2f2f2; font-weight:600 }
  td.num,th.num{ text-align:right; font-variant-numeric:tabular-nums }
  .uyari{ border:2px solid #111; padding:9px 11px; margin:0 0 14px; font-weight:600 }
  .imza{ display:flex; gap:40px; margin-top:34px }
  .imza div{ flex:1; border-top:1px solid #111; padding-top:5px; font-size:11px; color:#555 }
  .dipnot{ margin-top:18px; font-size:11px; color:#555; line-height:1.45 }
  tr{ break-inside:avoid }
  @page{ size:A4; margin:14mm }
`

/** Tam bir HTML belgesi kurar. Testler bu işlevi çağırır; tarayıcı gerekmez. */
export const yazdirmaBelgesi = (baslik: string, govde: string): string =>
  `<!doctype html><html lang="tr"><head><meta charset="utf-8">`
  + `<title>${kacir(baslik)}</title><style>${STIL}</style></head>`
  + `<body>${govde}</body></html>`

/**
 * Belgeyi görünmez bir çerçevede açar ve yazdırma penceresini çağırır.
 *
 * Çerçeve, yazdırma bittikten sonra siliniyor — ama hemen değil: bazı
 * tarayıcılarda `print()` geri döndüğünde iş henüz bitmemiş olur ve çerçeveyi
 * o anda silmek boş sayfa bastırır.
 */
export const belgeYazdir = (baslik: string, govde: string): void => {
  if(typeof document === 'undefined') return

  const cerceve = document.createElement('iframe')
  cerceve.setAttribute('aria-hidden', 'true')
  cerceve.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;'
  document.body.appendChild(cerceve)

  const pencere = cerceve.contentWindow
  const belge = cerceve.contentDocument
  if(!pencere || !belge){ cerceve.remove(); return }

  belge.open()
  belge.write(yazdirmaBelgesi(baslik, govde))
  belge.close()

  const bas = () => {
    try{ pencere.focus(); pencere.print() }
    finally { window.setTimeout(() => cerceve.remove(), 1000) }
  }

  if(belge.readyState === 'complete') window.setTimeout(bas, 50)
  else cerceve.onload = () => window.setTimeout(bas, 50)
}
