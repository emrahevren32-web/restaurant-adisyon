// ═══════════════════════════════════════════════════════════════════════════
// TEKERLEK ZİNCİRİ · geniş tablonun üstünde fare tekerleği sayfayı kaydırsın
// ---------------------------------------------------------------------------
// Emrah, 10.10: *"o kısım üstünde scroll tüm sayfa için çalışmıyor, çalışsın.
// Yani o bölüm içinde aşağı yukarı gitme bittiğinde tüm sayfa için aşağı
// yukarı hareket ettirsin."*
//
// ⚠️ BU BİR CSS SORUNU DEĞİL. Önce CSS ile çözdüğümü sandım (`overflow-y:clip`,
// `overscroll-behavior-y:auto`) ve YANILDIM. Chromium'da ölçtüm:
//
//   yatay taşma VAR  + overscroll-behavior:auto    → tekerlek YUTULUYOR
//   yatay taşma VAR  + overflow-y:clip             → tekerlek YUTULUYOR
//   yatay taşma YOK  + aynı CSS                    → sayfa kayıyor
//
// Yani tarayıcı, YATAY kaydırılabilen bir kutunun üstündeki DİKEY tekerleği
// o kutuya kilitliyor; kutu dikey kayamadığı için hiçbir şey olmuyor.
// `overscroll-behavior` bunu değiştirmiyor. Tek CSS çözümü yatay kaydırmayı
// kapatmak olurdu — o zaman geniş tablolar okunamaz hale gelir.
//
// Bu yüzden çözüm JavaScript: tekerleği biz zincirliyoruz.
//
// ⚠️ SADECE TUZAĞA DÜŞÜLDÜĞÜNDE devreye giriyor. Kutunun kendisi dikey
// kayabiliyorsa (ör. yan menü, bildirim listesi) hiç karışmıyoruz —
// tarayıcının kendi davranışı doğrudur, onu taklit etmeye çalışmak
// kaydırmayı bozar.
// ═══════════════════════════════════════════════════════════════════════════

/** Kaydırma kabı yapan `overflow` değerleri. `clip`/`hidden`/`visible` değil. */
export const KAYDIRAN_TASMALAR: ReadonlySet<string> = new Set([
  'auto', 'scroll', 'overlay',
])

/** Bir kutunun karar vermek için gereken ölçüleri. DOM'dan ayrı tutuluyor ki
 *  kural tarayıcısız da sınanabilsin. */
export type KutuOlcusu = {
  tasmaX: string
  tasmaY: string
  kaydirmaUstu: number
  kaydirmaYuksekligi: number
  gorunenYukseklik: number
  kaydirmaGenisligi: number
  gorunenGenislik: number
}

/** 1 piksel pay: tarayıcılar kesirli yükseklikleri yuvarlar, 0.5px fark
 *  "kaydırılabilir" sayılmamalı. */
const PAY = 1

export function dikeyKaydirabilir(k: KutuOlcusu, deltaY: number): boolean {
  if (!KAYDIRAN_TASMALAR.has(k.tasmaY)) return false
  const pay = k.kaydirmaYuksekligi - k.gorunenYukseklik
  if (pay <= PAY) return false
  if (deltaY > 0) return k.kaydirmaUstu < pay - PAY
  return k.kaydirmaUstu > PAY
}

/** Tuzak: yatay kayabiliyor ama dikey kayamıyor. Tarayıcı tekerleği buraya
 *  kilitler ve hiçbir şey olmaz. */
export function yatayTuzak(k: KutuOlcusu): boolean {
  if (!KAYDIRAN_TASMALAR.has(k.tasmaX)) return false
  return k.kaydirmaGenisligi - k.gorunenGenislik > PAY
}

/** Firefox satır/sayfa birimiyle de tekerlek olayı gönderir; piksele çeviriyoruz. */
export function tekerlekPiksele(
  deltaY: number, deltaMode: number, gorunenYukseklik: number,
): number {
  if (deltaMode === 1) return deltaY * 16
  if (deltaMode === 2) return deltaY * gorunenYukseklik
  return deltaY
}

// ── DOM TARAFI ─────────────────────────────────────────────────────────────

function olcuyuAl(e: HTMLElement): KutuOlcusu {
  const s = getComputedStyle(e)
  return {
    tasmaX: s.overflowX,
    tasmaY: s.overflowY,
    kaydirmaUstu: e.scrollTop,
    kaydirmaYuksekligi: e.scrollHeight,
    gorunenYukseklik: e.clientHeight,
    kaydirmaGenisligi: e.scrollWidth,
    gorunenGenislik: e.clientWidth,
  }
}

/** Hiç taşması olmayan kutular için `getComputedStyle` çağırmıyoruz;
 *  tekerlek olayı saniyede onlarca kez gelir. */
function tasmasiVar(e: HTMLElement): boolean {
  return e.scrollHeight - e.clientHeight > PAY || e.scrollWidth - e.clientWidth > PAY
}

/**
 * Belgeye tekerlek zincirini kurar. Geri dönen işlev dinleyiciyi kaldırır.
 */
export function tekerlegiZincirle(belge: Document = document): () => void {
  const dinle = (olay: WheelEvent) => {
    // Başkası işini bitirmişse karışma; ctrl+tekerlek yakınlaştırmadır.
    if (olay.defaultPrevented || olay.ctrlKey) return
    if (olay.deltaY === 0) return
    // Kullanıcı yatay kaydırıyorsa (trackpad) dokunmuyoruz.
    if (Math.abs(olay.deltaX) > Math.abs(olay.deltaY)) return

    let dugum: Element | null =
      olay.target instanceof Element ? olay.target : null
    let tuzak: HTMLElement | null = null

    while (dugum) {
      if (dugum instanceof HTMLElement && tasmasiVar(dugum)) {
        const o = olcuyuAl(dugum)
        // Kutu dikey kayabiliyor → tarayıcı doğru işi yapıyor, çekil.
        if (dikeyKaydirabilir(o, olay.deltaY)) return
        if (yatayTuzak(o)) { tuzak = dugum; break }
      }
      dugum = dugum.parentElement
    }

    if (!tuzak) return

    // Tuzağın üstünde dikey kaydırılabilen ilk atayı bul.
    let ata: HTMLElement | null = tuzak.parentElement
    while (ata) {
      if (tasmasiVar(ata)) {
        const o = olcuyuAl(ata)
        if (dikeyKaydirabilir(o, olay.deltaY)) {
          olay.preventDefault()
          ata.scrollTop +=
            tekerlekPiksele(olay.deltaY, olay.deltaMode, ata.clientHeight)
          return
        }
      }
      ata = ata.parentElement
    }

    // Kaydıran bir kap yoksa sayfanın kendisi kalır. Kök öğenin `overflow`
    // değeri `visible` olduğu için yukarıdaki kural onu yakalamaz.
    const kok = (belge.scrollingElement ?? belge.documentElement) as HTMLElement | null
    if (!kok) return
    const pay = kok.scrollHeight - kok.clientHeight
    if (pay <= PAY) return
    if (olay.deltaY > 0 ? kok.scrollTop >= pay - PAY : kok.scrollTop <= PAY) return
    olay.preventDefault()
    kok.scrollTop += tekerlekPiksele(olay.deltaY, olay.deltaMode, kok.clientHeight)
  }

  // ⚠️ `passive: false` ŞART. Pasif dinleyicide `preventDefault()` yok sayılır
  // ve tarayıcı tekerleği yine yutar.
  belge.addEventListener('wheel', dinle, { passive: false })
  return () => belge.removeEventListener('wheel', dinle)
}
