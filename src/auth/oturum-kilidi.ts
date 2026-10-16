// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Vardiya kilidi — 45 dakika hareketsizlikte oturum kilitlenir
//
// ── NEDEN ─────────────────────────────────────────────────────────────────
// 15.10.2026'da ölçüldü: uygulamada otomatik çıkış diye bir şey yoktu.
// Oturum, tarayıcı kapanana kadar açık kalıyordu.
//
// Mutfakta tablet açık kalır. Kimse çıkış yapmaz. Bir sonraki vardiya aynı
// hesapla çalışmaya devam eder. VE O ANDAN SONRA DEFTERDEKİ HER İMZA YANLIŞ
// KİŞİYİ GÖSTERİR — "bu sıcaklığı kim ölçtü" sorusunun cevabı, sabah giriş
// yapan kişi olur.
//
// Bu, kullanım kılavuzuna "hesabı görev adıyla değil kişinin adıyla aç" diye
// yazdığımız sorunun aynısı. Orada çözdük, burada açıktı: görev adıyla
// açılmış bir hesap da, vardiya boyunca devredilen bir oturum da aynı yalanı
// söyler.
//
// ── TASARIM KARARI · ZAMANLAYICIYA DEĞİL SAATE BAKIYORUZ ──────────────────
// ⚠️ `setTimeout` TEK BAŞINA YETMEZ. Tablet uyuduğunda zamanlayıcı da uyur;
// üç saat sonra uyandığında "45 dakika doldu" olayı hiç ateşlenmez ve oturum
// açık bulunur. Tam da korkulan durum budur.
//
// Bu yüzden son hareket ZAMAN DAMGASI olarak saklanıyor ve kilit kararı her
// seferinde `şimdi - sonHareket` karşılaştırmasıyla veriliyor. Zamanlayıcı
// yalnızca "ara sıra bak" görevi görüyor; kararı o vermiyor.
//
// ── ÇIKIŞ DEĞİL KİLİT ─────────────────────────────────────────────────────
// Emrah'ın kararı (15.10): kilitlensin ama ÇIKIŞ YAPMASIN. Yarım kalan bir
// sayım, yazılmakta olan bir düzeltici faaliyet kaybolmasın. Ekranın üstüne
// bir kilit perdesi iniyor, şifre girilince perde kalkıyor ve kişi kaldığı
// yerden devam ediyor.
// ═══════════════════════════════════════════════════════════════════════════

/** Hareketsizlik sınırı. Emrah'ın kararı: bir iş arası bundan kısa,
 *  vardiya değişimi bundan uzun. */
export const KILIT_SURESI_MS = 45 * 60 * 1000

/** Son hareketin saklandığı anahtar. */
export const SON_HAREKET_ANAHTARI = 'ra_son_hareket'

/**
 * Kullanıcının "buradayım" dediği olaylar.
 *
 * ⚠️ `scroll` ve `touchstart` BİLEREK VAR: tablette parmakla gezinmek de
 * hareketti. Yalnız `click` ve `keydown` dinleseydik, listeyi kaydırarak
 * inceleyen kişi kırk beş dakika sonra kilitlenirdi.
 */
export const HAREKET_OLAYLARI = [
  'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart', 'visibilitychange',
] as const

/**
 * Bu oturum kilitlenmeli mi?
 *
 * ⚠️ FAIL-CLOSED. Geçersiz ya da okunamayan bir zaman damgası "kilitleme"
 * değil "KİLİTLE" demektir. Bilinmeyen durumda açık kalan bir kilit, kilit
 * değildir (tuzak 71'in aynı dersi).
 */
export const kilitlenmeliMi = (
  sonHareket: number | null | undefined,
  simdi: number,
  sureMs: number = KILIT_SURESI_MS,
): boolean => {
  if(typeof sonHareket !== 'number' || !Number.isFinite(sonHareket)) return true
  if(sonHareket <= 0) return true
  // Saat ileri alınmış ya da damga geleceğe yazılmış: "az önce hareket etti"
  // sayıyoruz. Aksi hâlde sistem saati oynayan bir cihazda kilit hiç açılmaz.
  if(sonHareket > simdi) return false
  return (simdi - sonHareket) >= sureMs
}

/** Kilide kaç milisaniye kaldı (kilitliyse 0). */
export const kilideKalan = (
  sonHareket: number | null | undefined,
  simdi: number,
  sureMs: number = KILIT_SURESI_MS,
): number => {
  if(kilitlenmeliMi(sonHareket, simdi, sureMs)) return 0
  const gecen = Math.max(0, simdi - (sonHareket as number))
  return Math.max(0, sureMs - gecen)
}

/**
 * Son hareket damgasını okur.
 *
 * ⚠️ `try/catch`: gizli sekmede ve depolama kapalıyken `localStorage`
 * erişimi HATA ATAR, boş dönmez. Sarmazsak uygulama açılmaz.
 */
export const sonHareketiOku = (depo?: Storage): number | null => {
  try{
    const d = depo ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)
    if(!d) return null
    const ham = d.getItem(SON_HAREKET_ANAHTARI)
    if(!ham) return null
    const sayi = Number(ham)
    return Number.isFinite(sayi) && sayi > 0 ? sayi : null
  } catch { return null }
}

export const sonHareketiYaz = (an: number, depo?: Storage): void => {
  try{
    const d = depo ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)
    d?.setItem(SON_HAREKET_ANAHTARI, String(an))
  } catch { /* depolama yoksa kilit yalnız bu sekmede çalışır */ }
}

export const sonHareketiSil = (depo?: Storage): void => {
  try{
    const d = depo ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)
    d?.removeItem(SON_HAREKET_ANAHTARI)
  } catch { /* yok sayılır */ }
}

/**
 * Hareket damgasını ne sıklıkta yazalım.
 *
 * Her tuş vuruşunda `localStorage`a yazmak gereksiz; dakikada bir yeter.
 * Kilit kararı zaten damga ile saat farkından çıkıyor.
 */
export const YAZMA_ARALIGI_MS = 60 * 1000

export const yazmaZamaniMi = (
  sonYazilan: number | null | undefined,
  simdi: number,
): boolean => {
  if(typeof sonYazilan !== 'number' || !Number.isFinite(sonYazilan)) return true
  return (simdi - sonYazilan) >= YAZMA_ARALIGI_MS
}

/** Kilit perdesinde görünecek metinler. */
export const KILIT_BASLIK = 'Vardiya kilidi'

export const kilitAciklamasi = (adSoyad: string): string =>
  `${adSoyad.trim() || 'Bu hesap'} olarak açık bırakılan oturum, 45 dakika `
  + 'hareketsizlik sonrası kilitlendi. Devam etmek için şifrenizi girin.'

/**
 * ⚠️ Perdede KİMİN oturumu olduğu YAZIYOR.
 *
 * Emrah'ın gerekçesi: vardiya değişiminde gelen kişi, ekranda başkasının
 * adını görünce kendi hesabına geçer. Yalnız bir şifre kutusu gösterseydik,
 * yeni gelen kişi oraya KENDİ şifresini yazar, açılmaz, "bozuk" der ve
 * çoğu zaman eski oturumu kullanmaya devam ederdi.
 */
export const kilitDevamEtiketi = (adSoyad: string): string =>
  `${adSoyad.trim() || 'Hesap'} olarak devam et`

export const KILIT_BASKA_KULLANICI =
  'Bu hesap sizin değilse çıkış yapın ve kendi giriş adınızla girin — '
  + 'yaptığınız her kayıt, giriş yapan kişinin adına yazılır.'

export const KILIT_SIFRE_HATALI =
  'Şifre doğrulanamadı. Oturumunuz açık kalmaya devam ediyor; '
  + 'yarım kalan işiniz kaybolmadı.'
