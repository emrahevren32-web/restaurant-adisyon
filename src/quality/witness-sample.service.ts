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

/** Gerekçe "boş sayılır mı" kararı tek yerde (zayi defteriyle aynı eşik). */
export const gerekceYeterliMi = (metin: string | undefined): boolean =>
  (metin ?? '').trim().length >= 3

/** Numune kodu boş geçilemez; biçimi serbest (işletmenin kendi defteri). */
export const numuneKoduYeterliMi = (metin: string | undefined): boolean =>
  (metin ?? '').trim().length >= 2

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
