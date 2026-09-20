// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 4D / KAPI — Başvuru kuralları
//
// Kurallar İKİ yerde duruyor: burada (ekran hemen söyleyebilsin) ve
// veritabanında (hiçbir yol atlayamasın). İkisi de gerekli:
//   · yalnız ekranda olsa → elle istek atan atlar
//   · yalnız veritabanında olsa → kullanıcı formu doldurup gönderdikten
//     SONRA ham bir veritabanı hatası görür
//
// ⚠️ İKİ YERDE OLAN KURAL AYRIŞIR. Bu yüzden `application.arch.test.ts`
// buradaki geçiş tablosunu 0032'deki tetikleyiciyle KARŞILAŞTIRIYOR.
// Ayrıştıkları an test kırmızıya döner.
// ═══════════════════════════════════════════════════════════════════════════

import type {
  Basvuru, BasvuruDurumu, YeniBasvuru,
} from './application.repository'
import { DURUM_ETIKETLERI, SON_DURUMLAR } from './application.repository'

/**
 * Hangi durumdan hangisine geçilebilir.
 *
 * 0032'deki `app.basvuru_gecisi()` ile BİREBİR aynı olmak zorunda.
 *
 * `IN_REVIEW → PENDING` bilerek var: "inceliyorum" deyip sonra bırakmak
 * meşru bir iştir, başvuruyu havada bırakmamak gerekir.
 */
export const GECISLER: Record<BasvuruDurumu, readonly BasvuruDurumu[]> = {
  PENDING: ['IN_REVIEW', 'REJECTED', 'CANCELLED'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'CANCELLED', 'PENDING'],
  APPROVED: [],
  REJECTED: [],
  CANCELLED: [],
}

export const gecisGecerliMi = (
  onceki: BasvuruDurumu, yeni: BasvuruDurumu,
): boolean => GECISLER[onceki].includes(yeni)

export const sonDurumMu = (durum: BasvuruDurumu): boolean =>
  SON_DURUMLAR.includes(durum)

/** Karar verilmiş her durum gerekçe ister. */
export const GEREKCE_EN_AZ = 3

export const gerekceYeterliMi = (gerekce: string | undefined): boolean =>
  (gerekce ?? '').trim().length >= GEREKCE_EN_AZ

// ── Form doğrulaması ──────────────────────────────────────────────────────
// Sınırlar 0032'deki `check` kısıtlarıyla aynı. Amaç kullanıcıya ekranda
// söylemek; son söz veritabanının.

type Kural = {
  alan: keyof YeniBasvuru
  ad: string
  enAz: number
  enCok: number
}

const KURALLAR: Kural[] = [
  { alan: 'firmaAdi', ad: 'Firma adı', enAz: 2, enCok: 200 },
  { alan: 'yetkiliAdi', ad: 'Yetkili adı', enAz: 2, enCok: 120 },
  { alan: 'telefon', ad: 'Telefon', enAz: 7, enCok: 30 },
  // ⚠️ Vergi alanları buradan ÇIKARILDI (0038). Zorunlu değiller; dolu
  // yazılırlarsa biçimleri aşağıda ayrıca sınanıyor.
  { alan: 'il', ad: 'İl', enAz: 2, enCok: 60 },
  { alan: 'ilce', ad: 'İlçe', enAz: 2, enCok: 60 },
  { alan: 'adres', ad: 'Adres', enAz: 5, enCok: 500 },
]

/**
 * TC kimlik numarası geçerli mi?
 *
 * ── KURALLAR ─────────────────────────────────────────────────────────────
 *   · 11 hane, hepsi rakam
 *   · İlk hane 0 olamaz
 *   · 10. hane = ((1,3,5,7,9. hanelerin toplamı × 7) − (2,4,6,8. hanelerin
 *     toplamı)) mod 10
 *   · 11. hane = ilk 10 hanenin toplamı mod 10
 *
 * ── "SON HANE HER ZAMAN ÇİFTTİR" ─────────────────────────────────────────
 * Emrah bunu hatırlattı ve doğru. Üstelik kuralın kendisinden çıkıyor:
 *   T = tek konumdaki haneler (1,3,5,7,9), C = çift konumdakiler (2,4,6,8)
 *   d10 ≡ 7T − C          (mod 10)
 *   d11 ≡ T + C + d10 ≡ T + C + 7T − C ≡ 8T   (mod 10)
 * 8T her zaman çift olduğundan d11 de her zaman çifttir.
 *
 * Yani AYRI bir "son hane çift olmalı" kuralı yazmıyoruz: aşağıdaki
 * hesap onu zaten kapsıyor. Ayrıca yazmak, aynı kuralı iki yere koymak
 * olurdu — bu depoda o hatanın bedelini ödedik (0036).
 *
 * ⚠️ 10 HANELİ VERGİ NUMARASI SINANMIYOR. VKN'nin de bir kontrol
 * algoritması var ama yanlış uygulanmış bir kontrol, GEÇERLİ numarayla
 * gelen gerçek bir müşteriyi kapıda durdurur. Emin olmadığım bir kuralı
 * kapı bekçisi yapmıyorum; şimdilik yalnız "10 hane, hepsi rakam".
 */
export const tcKimlikGecerliMi = (deger: string): boolean => {
  const n = deger.trim()
  if(!/^\d{11}$/.test(n)) return false
  if(n[0] === '0') return false

  const h = n.split('').map(Number)
  const tek  = h[0] + h[2] + h[4] + h[6] + h[8]
  const cift = h[1] + h[3] + h[5] + h[7]

  const onuncu = ((tek * 7) - cift) % 10
  // ⚠️ JavaScript'te `%` negatif sonuç verebilir (-3 % 10 === -3).
  // `+ 10) % 10` olmadan geçerli numaralar reddedilirdi.
  if(((onuncu + 10) % 10) !== h[9]) return false

  const onbirinci = (h.slice(0, 10).reduce((t, x) => t + x, 0)) % 10
  return onbirinci === h[10]
}

/**
 * Zorunlu bir sayı alanını doğrular. Boş bırakılan alanla 0 yazılan alanı
 * AYIRIYOR: biri "cevaplamadı", diğeri "sıfır dedi" — ikisi aynı cümleyi
 * hak etmiyor.
 */
const sayiDogrula = (
  deger: number | null | undefined,
  ad: string,
  enAz: number,
  enCok: number,
): string[] => {
  if(deger === null || deger === undefined) return [`${ad} zorunludur.`]
  if(!Number.isFinite(deger)) return [`${ad} bir sayı olmalı.`]
  if(!Number.isInteger(deger)) return [`${ad} tam sayı olmalı.`]
  if(deger < enAz) return [`${ad} en az ${enAz} olmalı.`]
  if(deger > enCok) return [`${ad} en fazla ${enCok} olabilir.`]
  return []
}

/** 0032'deki kısıtla aynı: boşluksuz, tek @, noktalı alan adı. */
const EPOSTA = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Formu doğrular ve İNSAN CÜMLELERİ döndürür.
 *
 * Boş dizi = geçerli. Tek tek değil TOPLU döndürüyor: kullanıcıyı "bir
 * hatayı düzelt, gönder, sıradaki hatayı gör" döngüsüne sokmak eziyettir.
 */
export const basvuruDogrula = (basvuru: YeniBasvuru): string[] => {
  const hatalar: string[] = []

  for(const kural of KURALLAR){
    const deger = (basvuru[kural.alan] ?? '').toString().trim()
    if(deger.length === 0){
      hatalar.push(`${kural.ad} zorunludur.`)
    } else if(deger.length < kural.enAz){
      hatalar.push(`${kural.ad} en az ${kural.enAz} karakter olmalı.`)
    } else if(deger.length > kural.enCok){
      hatalar.push(`${kural.ad} en fazla ${kural.enCok} karakter olabilir.`)
    }
  }

  const eposta = (basvuru.eposta ?? '').trim()
  if(eposta.length === 0) hatalar.push('E-posta zorunludur.')
  else if(!EPOSTA.test(eposta)) hatalar.push('E-posta adresi geçerli görünmüyor.')

  // ── Vergi bilgisi: isteğe bağlı, ama yazıldıysa doğru olmalı (0038) ────
  // Başvuru anı sözleşme anı değil. Vergi levhası bilgisi fatura kesilirken
  // kesin olarak alınır; ilk ekranda zorunlu tutmak formu yarıda bıraktırır.
  const vergi = (basvuru.vergiNo ?? '').trim()
  if(vergi.length > 0){
    if(!/^\d+$/.test(vergi)) hatalar.push('Vergi/TC numarası yalnız rakamlardan oluşur.')
    else if(vergi.length !== 10 && vergi.length !== 11){
      hatalar.push('Vergi/TC numarası 10 ya da 11 haneli olmalı. Boş da bırakabilirsiniz.')
    }
    else if(vergi.length === 11 && !tcKimlikGecerliMi(vergi)){
      hatalar.push('TC kimlik numarası geçerli görünmüyor. Lütfen kontrol edin.')
    }
  }
  const vergiDairesi = (basvuru.vergiDairesi ?? '').trim()
  if(vergiDairesi.length > 120){
    hatalar.push('Vergi dairesi en fazla 120 karakter olabilir.')
  }

  // ── İşletmenin büyüklüğü: ZORUNLU (0038) ──────────────────────────────
  // Şube sayısı fiyat sorusu değil KURULUM sorusu: onayda tek merkez şube
  // açılıyor. Personel sayısı da kaç kullanıcı hesabı gerektiğini söylüyor.
  hatalar.push(...sayiDogrula(basvuru.subeSayisi, 'Şube sayısı', 1, 500))
  hatalar.push(...sayiDogrula(basvuru.personelSayisi, 'Yaklaşık personel sayısı', 1, 20000))

  if((basvuru.not ?? '').length > 1000){
    hatalar.push('Not en fazla 1000 karakter olabilir.')
  }

  return hatalar
}

/**
 * Vergi bilgisi eksik mi?
 *
 * 0038'den sonra bu alan başvuruda isteğe bağlı. Eksiklik SESSİZ KALMAMALI:
 * fatura kesileceği gün fark edilirse iş durur. Ekran bunu hem listede hem
 * onay kartında söylüyor; kural tek yerde dursun diye burada.
 */
export const vergiBilgisiEksik = (
  b: { vergiNo?: string; vergiDairesi?: string },
): boolean =>
  (b.vergiDairesi ?? '').trim().length === 0 || (b.vergiNo ?? '').trim().length === 0

// ── Liste özeti ───────────────────────────────────────────────────────────

export type BasvuruOzeti = {
  toplam: number
  bekleyen: number
  inceleniyor: number
  onaylanan: number
  reddedilen: number
  iptal: number
  /** MİYOP'un eline alması gereken sayı: bekleyen + inceleniyor. */
  ilgiBekleyen: number
}

export const basvuruOzeti = (basvurular: Basvuru[]): BasvuruOzeti => {
  const say = (d: BasvuruDurumu) => basvurular.filter(b => b.durum === d).length
  const bekleyen = say('PENDING')
  const inceleniyor = say('IN_REVIEW')
  return {
    toplam: basvurular.length,
    bekleyen,
    inceleniyor,
    onaylanan: say('APPROVED'),
    reddedilen: say('REJECTED'),
    iptal: say('CANCELLED'),
    ilgiBekleyen: bekleyen + inceleniyor,
  }
}

/** Ekranda gösterilecek durum etiketi. */
export const durumEtiketi = (durum: BasvuruDurumu): string =>
  DURUM_ETIKETLERI[durum] ?? durum

/**
 * Bir başvurunun kaç gün beklediği.
 *
 * Neden gerekli: "başvurdum, kimse dönmedi" demonun en kötü anıdır.
 * Bekleme süresi görünür olmazsa unutulur.
 */
export const beklemeGunu = (
  basvuru: Basvuru, simdi: Date = new Date(),
): number => {
  const bas = new Date(basvuru.olusturmaZamani).getTime()
  return Math.max(0, Math.floor((simdi.getTime() - bas) / 86_400_000))
}
