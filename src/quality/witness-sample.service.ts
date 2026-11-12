// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3.9 / Kalite — ŞAHİT NUMUNE: EKRANIN KARAR VERDİĞİ ŞEYLER
//
// ── BU DOSYADA NE VAR, NE YOK ────────────────────────────────────────────
// YOK: saklama sonu, saklama koşulu, açık raf ömrü, imza, kiracı. Bunların
//      hiçbiri burada hesaplanmıyor — hepsi 0093/0094 tetiklerinde.
//      ⚠️ Birini buraya kopyalamak, aynı kuralı iki yerde tutmak olurdu;
//      biri bir gün güncellenmez ve hangisinin doğru olduğu bilinmez.
//
// VAR: yalnız EKRANIN kendi işi — sıralama, "süresi doldu mu" GÖSTERİMİ ve
//      gerekçe/kod gibi girdilerin boş geçilmemesi.
//
// ── "SÜRESİ DOLDU" NEDEN BURADA HESAPLANIYOR ─────────────────────────────
// Bu bir KAPI DEĞİL, bir GÖSTERİM. Sunucu saklama sonunu yazıyor; ekran
// "bugün o günü geçti mi" diye bakıp satırı işaretliyor. Bir yazma kuralı
// olsaydı veritabanında olmak zorundaydı.
// ⚠️ Karşılaştırma `>` ile: saklama sonu GÜNÜ hâlâ saklama süresi içindedir.
// `>=` yazmak, numuneyi son gününde "süresi doldu" göstermek olurdu — SKT
// kapısında (0092) aynı kural `<` ile yazılıydı, ikisi tutarlı.
// ═══════════════════════════════════════════════════════════════════════════

import type { SahitNumune, NumuneAdayi } from './witness-sample.repository'

// ═══════════════════════════════════════════════════════════════════════════
// METİN SÖZLEŞMESİ · EKRAN İLE VERİTABANI AYNI SORUYA AYNI CEVABI VERİR
// (MIYOP-105'in eksik kalan yarısı · Codex 4. tur · göç 0115)
//
// İlk hâli `metin.trim().length` idi; veritabanı ise `length(btrim(metin))`
// diyordu. Sayılar aynıydı (2 ve 3) ama SÖZLEŞME aynı değildi:
//   · `btrim` yalnız boşluğu (U+0020) kırpar; `trim` sekmeyi, satır sonunu
//     ve bütün Unicode boşluklarını kırpar. Üç sekme ekranda BOŞ,
//     veritabanında ÜÇ KARAKTER sayılıyordu: API'den yazan geçebiliyordu.
//   · `.length` UTF-16 birimi sayar; `length()` kod noktası. Tek bir emoji
//     ekranda 2, veritabanında 1 karakterdi.
//
// ⚠️ ŞİMDİ TEK TANIM VAR VE İKİ KATMAN ONU AYNI METİNLE TAŞIYOR:
//   KIRPMA · aşağıdaki küme (JavaScript `trim` kümesinin AYNISI, açık
//            yazılmış) metnin başından ve sonundan atılır.
//   SAYMA  · kalan metnin KOD NOKTASI sayısı.
//
// ⚠️ `KIRPILAN_BOSLUKLAR` 0115'in üç kısıt tanımında HARFİ HARFİNE duruyor
// ve `numune-kapisi.arch.test.ts` onu orada ARIYOR. Kümeyi burada
// değiştirip göç yazmamak (ya da tersi) testi kırmızı yakar.
//
// ⚠️ METİN ASCII KAÇIŞLARIYLA YAZILI, karakterlerin kendisiyle DEĞİL:
// görünmez bir karakter dosyada fark edilmeden değişebilir ya da panodan
// geçerken düşebilir (tuzak 203).
//
// ⚠️ SINIRI: sıfır genişlikli karakterler (U+200B gibi) boşluk sayılmıyor
// — `trim` de saymıyor. Sözleşme "iki katman aynı cevabı verir"dir;
// "anlamsız metin yazılamaz" değildir.
// ═══════════════════════════════════════════════════════════════════════════
export const KIRPILAN_BOSLUKLAR =
  '\\u0009-\\u000D\\u0020\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF'

const KIRPMA_DESENI = new RegExp(
  `^[${KIRPILAN_BOSLUKLAR}]+|[${KIRPILAN_BOSLUKLAR}]+$`, 'g')

/**
 * Baştaki ve sondaki boşluklar atıldıktan sonra kalan KOD NOKTASI sayısı.
 * Veritabanındaki karşılığı:
 *   length(regexp_replace(metin, '^[küme]+|[küme]+$', '', 'g'))
 */
export const anlamliUzunluk = (metin: string | undefined): number =>
  Array.from((metin ?? '').replace(KIRPMA_DESENI, '')).length

/** Gerekçe "boş sayılır mı" kararı tek yerde (zayi defteriyle aynı eşik). */
export const gerekceYeterliMi = (metin: string | undefined): boolean =>
  anlamliUzunluk(metin) >= 3

/** Numune kodu boş geçilemez; biçimi serbest (işletmenin kendi defteri). */
export const numuneKoduYeterliMi = (metin: string | undefined): boolean =>
  anlamliUzunluk(metin) >= 2

/** Bugünün ISO günü (YYYY-MM-DD) — yerel saate göre, kullanıcının günü. */
export const bugununGunu = (bugun: Date = new Date()): string => {
  const kayma = bugun.getTimezoneOffset() * 60000
  return new Date(bugun.getTime() - kayma).toISOString().slice(0, 10)
}

/**
 * Saklama süresi dolmuş mu? `saklamaSonu` DAHİL son gündür.
 * ⚠️ Tarih metni 10 karaktere kırpılıyor: sunucu bazı yollarda tam zaman
 * damgası döndürebilir ve '2026-10-26T00:00:00' metni '2026-10-26' ile
 * doğrudan karşılaştırıldığında yanlış sonuç verir.
 */
export const suresiDolduMu = (
  saklamaSonu: string, bugun: string = bugununGunu(),
): boolean => bugun > saklamaSonu.slice(0, 10)

/** Saklama sonuna kaç gün kaldı (negatif: kaç gün geçti). */
export const kalanGun = (
  saklamaSonu: string, bugun: string = bugununGunu(),
): number => {
  const sonu = Date.parse(`${saklamaSonu.slice(0, 10)}T00:00:00Z`)
  const simdi = Date.parse(`${bugun}T00:00:00Z`)
  if(Number.isNaN(sonu) || Number.isNaN(simdi)) return 0
  return Math.round((sonu - simdi) / 86400000)
}

/**
 * Bu partiden numune alınabilir mi, alınamazsa NEDEN?
 *
 * ⚠️ Sebep metni dönüyor, boolean değil. "Seçilemez" demek yetmez: kullanıcı
 * eksik olanı düzeltebilsin diye nerede olduğunu söylemek gerekiyor. Eksik
 * olan ürün kartıdır ve kullanıcı ona gidebilir.
 *
 * ⚠️ Buradaki engeller SUNUCUNUN engellerinin AYNISI (0093): koşulsuz ürün
 * ve açık numunesi olan parti sunucuda da reddedilir. Burada tekrar
 * söylenmesinin tek sebebi, reddedilecek bir satırı kullanıcıya denetmemek.
 */
export const numuneAlinamazSebebi = (aday: NumuneAdayi): string | undefined => {
  if(aday.numunesiVar){
    return 'Bu partinin açık bir şahit numunesi zaten var.'
  }
  if(!aday.saklamaKosulu || aday.saklamaKosulu.trim() === ''){
    // ⚠️ YOL ADIYLA YAZILI. "Ürün kartına yazın" demek, kullanıcıyı
    // aramaya gönderir; üstelik "Stok Kartları" ekranı DONMUŞ durumda ve
    // oradan yazılamaz — yanlış yere yönlendirmek hiç yönlendirmemekten
    // kötüdür.
    return 'Ürün kartında saklama koşulu yazılı değil. Şahit numune, müşteriye '
      + 'bildirilen koşulun AYNISINDA saklanmak zorunda. Depo ekranında ürünü '
      + 'seçip "Saklama Beyanı" düğmesinden koşulu yazın.'
  }
  return undefined
}

export const numuneAlinabilir = (aday: NumuneAdayi): boolean =>
  numuneAlinamazSebebi(aday) === undefined

/**
 * ⚠️ `NumuneOzeti` ve `numuneOzeti()` 27.10.2026'DA SİLİNDİ — MIYOP-080.
 *
 * Ne yapıyordu: elindeki numune dizisinden durum sayılarını çıkarıyordu
 * (saklanan / açılmış / imha / imha bekleyen) ve ekran onu çağırıyordu.
 *
 * Neden silindi: ekran defteri **kesilmiş** olarak okuyor (en fazla 500
 * satır). Kesilmiş bir listeden sayı çıkarmak, 500'üncüden sonraki eski bir
 * açık kaydı hem listeden hem SAYIDAN düşürüyordu — sayı yanlış olduğu hâlde
 * doğru görünüyordu. Sayılar artık `PostgresSahitNumuneDeposu.ozet()` ile
 * SUNUCUDA sayılıyor.
 *
 * ⚠️ Fonksiyon "çalışıyor ama yanlış yerde" olduğu için bırakılmadı: duran
 * bir yardımcıyı bir gün biri yeniden çağırır ve aynı hatayı geri getirir.
 * Tam liste elindeyken sayım gerekirse `satirlar.filter(...)` üç satırdır.
 */

/**
 * Listeleme sırası: işi olan satır üstte.
 * 1. İmha bekleyenler (süresi dolmuş, hâlâ imha edilmemiş)
 * 2. Açılmış olanlar (üstünde bir tartışma var)
 * 3. Saklananlar, saklama sonu yakın olan üstte
 * 4. İmha edilmişler en altta
 */
export const numuneSirasi = (
  numuneler: SahitNumune[], bugun: string = bugununGunu(),
): SahitNumune[] => {
  const oncelik = (n: SahitNumune): number => {
    if(n.durum === 'IMHA') return 3
    if(suresiDolduMu(n.saklamaSonu, bugun)) return 0
    if(n.durum === 'ACILDI') return 1
    return 2
  }
  return [...numuneler].sort((a, b) => (
    oncelik(a) - oncelik(b)
    || a.saklamaSonu.localeCompare(b.saklamaSonu)
    || a.kod.localeCompare(b.kod, 'tr-TR')
  ))
}
