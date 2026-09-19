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
    else if(vergi.length < 10 || vergi.length > 11){
      hatalar.push('Vergi/TC numarası 10 ya da 11 haneli olmalı. Boş da bırakabilirsiniz.')
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
