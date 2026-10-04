// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4B — ARAÇ VE ŞOFÖR KARTLARI
//
// Yol haritası: *"Araç ve şoför kartları — plaka, şoför, kapasite ve soğutma
// bilgisi kayıtlı."*
//
// Bu dosya saf mantıktır: doğrulama, biçimleme, uyarı cümleleri. Veritabanı
// kuralları 0064'tedir ve son söz oradadır (MI424, MI434).
// ═══════════════════════════════════════════════════════════════════════════

export type Arac = {
  id: string
  plaka: string
  /** Aramada ve tekillikte kullanılan boşluksuz/büyük harf hâli. */
  plakaAnahtari: string
  ad?: string
  kapasiteKg?: number
  sogutmali: boolean
  minSicaklik?: number
  maxSicaklik?: number
  not?: string
  aktif: boolean
}

export type Sofor = {
  id: string
  adSoyad: string
  telefon?: string
  ehliyetSinifi?: string
  ehliyetGecerlilik?: string
  not?: string
  aktif: boolean
}

export class AracDogrulamaError extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'AracDogrulamaError'
  }
}

const kirp = (d?: string) => (d ?? '').trim()

/**
 * Plakanın arama/tekillik anahtarı: boşluksuz, tiresiz, BÜYÜK HARF.
 * "34 ABC 123", "34-abc-123" ve "34abc123" aynı araçtır.
 *
 * ⚠️ BÜYÜK HARFE ÇEVİRME 'en-US' İLE YAPILIYOR, 'tr' İLE DEĞİL.
 * Türkçe yerelde `'i'.toLocaleUpperCase('tr')` → `'İ'` döner. Plakada
 * noktalı İ diye bir harf yoktur; Türkçe yerel kullansaydık "34 fit 1"
 * plakası "34FİT1" olur, kullanıcı "34FIT1" diye arayınca bulunamaz ve
 * aynı araç ikinci kez açılabilirdi. Plaka Latin harfleriyle yazılır.
 */
export const plakaAnahtari = (plaka: string): string =>
  kirp(plaka).replace(/[\s\-._]/g, '').toLocaleUpperCase('en-US')

/**
 * Ekranda gösterilecek plaka — kullanıcının yazdığı hâli korunur.
 *
 * ⚠️ BİÇİMLENDİRMEYE ÇALIŞMIYORUZ. "34 ABC 123" diye araya boşluk koyan bir
 * kod, yabancı plakayı ("BG 1234 AX"), römork plakasını ve geçici plakayı
 * bozardı. Anahtar normalleştirilir, GÖSTERİM kullanıcınındır.
 */
export const plakaYaz = (plaka: string): string => kirp(plaka)

export type YeniArac = {
  plaka: string
  ad?: string
  kapasiteKg?: number
  sogutmali: boolean
  minSicaklik?: number
  maxSicaklik?: number
  not?: string
}

/**
 * Araç kartı doğrulaması.
 *
 * ⚠️ PLAKA BİÇİMİ ZORLANMIYOR. Türk plaka kalıbı (iki rakam + harf + rakam)
 * dayatılsaydı yabancı çekici, römork ve geçici plaka girilemezdi — ve
 * işletme o aracı sisteme hiç yazamadığı için sevkiyatı kayıt dışı kalırdı.
 * Yalnız en az dört karakter aranıyor: "1" diye bir plaka yoktur.
 */
export const aracDogrula = (girdi: YeniArac): YeniArac => {
  const plaka = kirp(girdi.plaka)
  if(plaka === ''){
    throw new AracDogrulamaError('Plaka zorunludur.')
  }
  if(plakaAnahtari(plaka).length < 4){
    throw new AracDogrulamaError(`"${plaka}" bir plakaya benzemiyor; en az dört karakter olmalı.`)
  }
  if(girdi.kapasiteKg !== undefined && !(girdi.kapasiteKg > 0)){
    // Sıfır kapasite "hiç mal taşımaz" demektir ve bu bir karardır; boş
    // bırakmak "bilinmiyor" demektir. İkisi aynı şey değil.
    throw new AracDogrulamaError('Kapasite sıfırdan büyük olmalı; bilinmiyorsa boş bırakın.')
  }
  if(!girdi.sogutmali && (girdi.minSicaklik !== undefined || girdi.maxSicaklik !== undefined)){
    throw new AracDogrulamaError(
      'Soğutmasız araca sıcaklık aralığı yazılamaz. Yazılsaydı ekran bunu bir '
      + 'yetenek sanar ve soğuk zincir ürününü bu araca yükletirdi.',
    )
  }
  if(girdi.minSicaklik !== undefined && girdi.maxSicaklik !== undefined
     && girdi.minSicaklik > girdi.maxSicaklik){
    throw new AracDogrulamaError('En düşük sıcaklık, en yüksekten büyük olamaz.')
  }
  return { ...girdi, plaka, ad: kirp(girdi.ad) || undefined, not: kirp(girdi.not) || undefined }
}

export type YeniSofor = {
  adSoyad: string
  telefon?: string
  ehliyetSinifi?: string
  ehliyetGecerlilik?: string
  not?: string
}

export const soforDogrula = (girdi: YeniSofor): YeniSofor => {
  const ad = kirp(girdi.adSoyad)
  if(ad === ''){
    throw new AracDogrulamaError('Şoförün adı soyadı zorunludur.')
  }
  return {
    ...girdi,
    adSoyad: ad,
    telefon: kirp(girdi.telefon) || undefined,
    ehliyetSinifi: kirp(girdi.ehliyetSinifi).toLocaleUpperCase('en-US') || undefined,
    ehliyetGecerlilik: kirp(girdi.ehliyetGecerlilik) || undefined,
    not: kirp(girdi.not) || undefined,
  }
}

/** Açılır listede görünen satır: "34 ABC 123 · Frigo 1 · −20…4 °C". */
export const aracEtiketi = (a: Arac): string => {
  const parcalar = [plakaYaz(a.plaka)]
  if(a.ad) parcalar.push(a.ad)
  if(a.sogutmali){
    const aralik = a.minSicaklik !== undefined && a.maxSicaklik !== undefined
      ? `${a.minSicaklik}…${a.maxSicaklik} °C`
      : 'soğutmalı'
    parcalar.push(aralik)
  }
  if(!a.aktif) parcalar.push('PASİF')
  return parcalar.join(' · ')
}

/**
 * Yükleme öncesi soğutma uyarısı.
 *
 * ⚠️ ENGELLEMİYOR, UYARIYOR. Kuru gıda soğutmasız araçla gider ve bu
 * doğrudur; hangi ürünün soğuk zincire girdiğini bugün sistem bilmiyor
 * ("sıcaklık rejimi" maddesi henüz yapılmadı). Engelleseydik doğru
 * sevkiyatları da durdururduk.
 */
export const sogutmaUyarisi = (a: Arac | undefined): string | undefined => {
  if(!a) return undefined
  if(a.sogutmali) return undefined
  return 'Bu araç soğutmasız. Soğuk ya da donuk ürün yüklenecekse CCP-8 '
    + '(sevk aracı en çok 4 °C) karşılanamaz.'
}

/**
 * Ehliyet geçerlilik uyarısı.
 *
 * Denetimde sorulan ilk şeylerden biri. 30 gün kala uyarıyoruz: o gün
 * öğrenmek, sevkiyatı o gün durdurmak demek.
 */
export const ehliyetUyarisi = (s: Sofor, bugun: Date = new Date()): string | undefined => {
  if(!s.ehliyetGecerlilik) return undefined
  const son = new Date(`${s.ehliyetGecerlilik}T00:00:00`)
  if(Number.isNaN(son.getTime())) return undefined
  const gun = Math.floor((son.getTime() - new Date(
    bugun.getFullYear(), bugun.getMonth(), bugun.getDate(),
  ).getTime()) / 86_400_000)
  if(gun < 0) return `Ehliyeti ${-gun} gün önce doldu.`
  if(gun === 0) return 'Ehliyeti BUGÜN doluyor.'
  if(gun <= 30) return `Ehliyetinin dolmasına ${gun} gün kaldı.`
  return undefined
}

/**
 * İrsaliyedeki "Taşıyan" satırı.
 *
 * ⚠️ Araç ya da şoför seçilmemişse TİRE basılıyor, satır gizlenmiyor.
 * Boş bırakılmış bir taşıyan alanı, kâğıdı imzalayan kişiye "burayı elle
 * doldur" der; satırı hiç basmamak o soruyu ortadan kaldırırdı.
 */
export const tasiyanSatiri = (
  arac?: Pick<Arac, 'plaka' | 'ad'>, sofor?: Pick<Sofor, 'adSoyad' | 'telefon'>,
): { plaka: string; sofor: string } => ({
  plaka: arac ? [plakaYaz(arac.plaka), arac.ad].filter(Boolean).join(' · ') : '—',
  sofor: sofor ? [sofor.adSoyad, sofor.telefon].filter(Boolean).join(' · ') : '—',
})
