// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · MEVZUAT AKIŞI — EKRANIN KARAR VERDİĞİ ŞEYLER
//
// ── BU DOSYADA NE VAR, NE YOK ────────────────────────────────────────────
// YOK: kimin yazabileceği, hangi satırın yayında olduğu, kaydın imzası.
//      Hiçbiri burada kararlaştırılmıyor — hepsi göç 0113'ün kapılarında.
//      ⚠️ Birini buraya kopyalamak, aynı kuralı iki yerde tutmak olurdu.
//
// VAR: yalnız EKRANIN kendi işi — alanların boş geçilmemesi, adresin
//      biçimi, tarih gösterimi ve "kutu çizilsin mi" kararı.
//
// ⚠️ EŞİKLER SUNUCUDAKİLERLE AYNI OLMAK ZORUNDA. MIYOP-105 tam olarak
// bunun ayrışmasıydı: ekran 2-3 karakter istiyordu, veritabanı yalnız
// "boş olmasın" diyordu ve API'den yazan biri gerekçe yerine `.` koyup
// geçebiliyordu. Bu sefer baştan bağlanıyor: `mevzuat-kapisi.arch.test.ts`
// aşağıdaki sayıları GÖÇ METNİNDEN okuyup karşılaştırıyor.
// ═══════════════════════════════════════════════════════════════════════════

/** Göç 0113'teki `regulation_news_baslik_uzunluk` kısıtının alt sınırı. */
export const BASLIK_EN_AZ = 5
/** Aynı kısıtın üst sınırı. */
export const BASLIK_EN_COK = 200
/** `regulation_news_ozet_uzunluk`. */
export const OZET_EN_COK = 600
/** `regulation_news_kaynak_uzunluk`. */
export const KAYNAK_EN_AZ = 2
export const KAYNAK_EN_COK = 120
/** `regulation_news_kaynak_adresi` uzunluk sınırı. */
export const ADRES_EN_COK = 500

/** Giriş vitrininde en çok kaç satır gösterilecek. */
export const VITRIN_SATIR_SINIRI = 5

export const MEVZUAT_DURUMLARI = ['TASLAK', 'YAYINDA', 'ARSIV'] as const
export type MevzuatDurumu = (typeof MEVZUAT_DURUMLARI)[number]

export const MEVZUAT_DURUM_ETIKETI: Record<MevzuatDurumu, string> = {
  TASLAK: 'Taslak',
  YAYINDA: 'Yayında',
  ARSIV: 'Arşiv',
}

export type MevzuatGirdisi = {
  baslik: string
  ozet: string
  kaynakAdi: string
  kaynakAdresi: string
  yayimTarihi: string
  durum: MevzuatDurumu
}

/**
 * Kaynak adresi geçerli mi?
 *
 * ⚠️ `https://` ZORUNLU ve bu bir biçim tercihi DEĞİL, güvenlik kapısı:
 * bu adres giriş ekranında TIKLANABİLİR bir bağlantı olarak çiziliyor.
 * `javascript:` ile başlayan bir değer, panele erişen birinin ziyaretçinin
 * tarayıcısında kod çalıştırması demek olurdu.
 * ⚠️ Asıl kapı veritabanında (0113 · `regulation_news_kaynak_adresi`).
 * Buradaki kontrol kullanıcıya SEBEBİNİ ERKEN söylemek için; tarayıcıdaki
 * kontrol bir güvenlik sınırı değildir.
 */
export const adresGecerliMi = (adres: string | undefined): boolean =>
  /^https:\/\/[^\s]+$/.test((adres ?? '').trim())
  && (adres ?? '').trim().length <= ADRES_EN_COK

/** Yayım tarihi gelecekte olamaz; sunucu da bir gün pay bırakıyor (0113). */
export const yayimTarihiGecerliMi = (
  isoGun: string | undefined, bugun: Date = new Date(),
): boolean => {
  const metin = (isoGun ?? '').trim()
  if(!/^\d{4}-\d{2}-\d{2}$/.test(metin)) return false
  const gun = Date.parse(`${metin}T00:00:00Z`)
  if(Number.isNaN(gun)) return false
  const enEski = Date.parse('2000-01-01T00:00:00Z')
  // ⚠️ Bir gün pay: sunucu UTC, Türkiye UTC+3. Akşam 21:00'den sonra
  // Türkiye'de "bugün" olan gün sunucuda hâlâ dünkü olabilir.
  const enGec = Date.UTC(
    bugun.getUTCFullYear(), bugun.getUTCMonth(), bugun.getUTCDate()) + 86400000
  return gun >= enEski && gun <= enGec
}

/**
 * Formdaki bütün eksikleri TEK LİSTEDE döndürür.
 *
 * ⚠️ Tarayıcının `required` niteliği KULLANILMIYOR: o, eksikleri tek tek
 * ve İngilizce gösteriyor (geri arama formunda aynı karar verilmişti).
 */
export const mevzuatDogrula = (
  girdi: MevzuatGirdisi, bugun: Date = new Date(),
): string[] => {
  const eksikler: string[] = []

  const baslik = (girdi.baslik ?? '').trim()
  if(baslik.length < BASLIK_EN_AZ) eksikler.push('Başlık en az beş karakter olmalı.')
  else if(baslik.length > BASLIK_EN_COK){
    eksikler.push(`Başlık çok uzun (en çok ${BASLIK_EN_COK} karakter).`)
  }

  if((girdi.ozet ?? '').trim().length > OZET_EN_COK){
    eksikler.push(`Özet çok uzun (en çok ${OZET_EN_COK} karakter).`)
  }

  const kaynak = (girdi.kaynakAdi ?? '').trim()
  if(kaynak.length < KAYNAK_EN_AZ){
    eksikler.push('Kaynak adı yazılmadı (örnek: Resmî Gazete).')
  } else if(kaynak.length > KAYNAK_EN_COK){
    eksikler.push(`Kaynak adı çok uzun (en çok ${KAYNAK_EN_COK} karakter).`)
  }

  if(!adresGecerliMi(girdi.kaynakAdresi)){
    eksikler.push('Kaynak adresi https:// ile başlamalı ve boşluk içermemeli. '
      + 'Bu bağlantı giriş ekranında tıklanabilir olarak gösteriliyor.')
  }

  if(!yayimTarihiGecerliMi(girdi.yayimTarihi, bugun)){
    eksikler.push('Yayım tarihi geçersiz; gelecekte olamaz.')
  }

  if(!MEVZUAT_DURUMLARI.includes(girdi.durum)){
    eksikler.push('Durum seçilmedi.')
  }

  return eksikler
}

/**
 * `2026-11-09` → `09.11.2026`. Boş ya da bozuk metinde olduğu gibi döner.
 *
 * ⚠️ Metin 10 karaktere kırpılıyor: sunucu bazı yollarda tam zaman damgası
 * döndürebilir (şahit numunede aynı tuzağa düşülmüştü).
 */
export const tarihiGoster = (isoGun: string | undefined): string => {
  const metin = (isoGun ?? '').trim().slice(0, 10)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(metin)) return metin
  const [yil, ay, gun] = metin.split('-')
  return `${gun}.${ay}.${yil}`
}

/**
 * Vitrin kutusu çizilsin mi?
 *
 * ⚠️ BOŞ KUTU ÇİZİLMEZ ve bu kararın bir geçmişi var: aynı köşede
 * MIYOP-059'un uydurma duyuruları vardı. Boş bir "Mevzuat" başlığı
 * okuyana "burada bir şey olmalıydı" der; hiç olmaması dürüsttür.
 * `platform_iletisim_oku`da da aynı karar verilmişti: numara boşsa ekran
 * hiçbir şey göstermiyor.
 */
export const vitrinGosterilsinMi = (satirSayisi: number): boolean =>
  Number.isFinite(satirSayisi) && satirSayisi > 0
