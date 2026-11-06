// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · GERİ ARAMA TALEBİ · kurallar (ekrandan bağımsız)
//
// ── NEDEN AYRI DOSYA ─────────────────────────────────────────────────────
// Ekran bir kuralı sınayamaz: React bileşeni açılmadan çalışmaz, açıldığında
// da tarayıcı gerektirir. Kurallar burada, saf fonksiyonlar hâlinde duruyor;
// testler bunları doğrudan çağırıyor.
//
// ⚠️ BU DOSYA BİR GÜVENLİK SINIRI DEĞİL. Asıl kapı veritabanındadır
// (`db/migrations/0106_geri_arama_talebi.sql` · `app.geri_arama_gonder`).
// Buradaki doğrulamanın tek işi, kişiye bütün eksikleri TEK SEFERDE
// göstermek — sunucuya gidip tek tek hata almasın. Burayı atlayan biri
// sunucuda aynı duvara çarpar.
// ═══════════════════════════════════════════════════════════════════════════

/** Uygun arama saati. Veritabanındaki `best_time` kısıtıyla birebir aynı. */
export const UYGUN_SAATLER = ['SABAH', 'OGLEDEN_SONRA', 'AKSAM', 'FARKETMEZ'] as const
export type UygunSaat = typeof UYGUN_SAATLER[number]

export const UYGUN_SAAT_ETIKETLERI: Record<UygunSaat, string> = {
  SABAH: 'Sabah (09:00 – 12:00)',
  OGLEDEN_SONRA: 'Öğleden sonra (13:00 – 17:00)',
  AKSAM: 'Akşam (17:00 – 20:00)',
  FARKETMEZ: 'Farketmez',
}

export type GeriAramaTalebi = {
  adSoyad: string
  telefon: string
  isletmeAdi: string
  eposta: string
  konu: string
  uygunSaat: UygunSaat
  onay: boolean
}

export const bosGeriAramaTalebi = (): GeriAramaTalebi => ({
  adSoyad: '',
  telefon: '',
  isletmeAdi: '',
  eposta: '',
  konu: '',
  uygunSaat: 'FARKETMEZ',
  onay: false,
})

// ═══════════════════════════════════════════════════════════════════════════
// KVKK AYDINLATMA METNİ
//
// ⚠️ BU METİN TASLAKTIR VE HUKUKÇUYA GÖSTERİLMELİDİR. Emrah'ın isteği
// üzerine yazıldı (06.11.2026); onaylanana kadar "taslak" olduğu burada
// yazılı duruyor.
//
// ⚠️ METİNDE SAKLAMA SÜRESİ VAAT EDİLMİYOR, VE BU BİLİNÇLİ. "12 ay sonra
// silinir" demek için kendiliğinden silen bir işin kurulu olması gerekir;
// kurulu DEĞİL (bkz. 0106 başlığı). Tutulmayacak bir söz yazmak yerine,
// tutulan söz yazıldı: silme talebi geldiğinde kayıt siliniyor —
// `public.geri_arama_sil(...)` ve ekrandaki Sil düğmesi onun karşılığı.
//
// ⚠️ SÜRÜM, METNİN ÖZETİNE BAĞLI. Metin değişip `KVKK_METIN_SURUMU`
// değişmezse `geri-arama-kapisi.arch.test.ts` kırılır ve yeni sürümü
// adıyla söyler. Sebebi: veritabanı her kayda "hangi metne onay verildi"
// diye bu sürümü damgalıyor. Sürüm metinden ayrışırsa kayıt, kişinin hiç
// görmediği bir metne onay verdiğini söyler.
// ═══════════════════════════════════════════════════════════════════════════
export const KVKK_AYDINLATMA_METNI =
  'Bu formda verdiğiniz ad soyad, telefon, işletme adı ve yazdıysanız '
  + 'e-posta adresiniz; yalnızca sizi arayıp MİYOP hakkında bilgi vermek '
  + 'için işlenir. Veri sorumlusu EVREN360\'tır. Bu bilgiler bir pazarlama '
  + 'listesine eklenmez, üçüncü kişilere satılmaz veya devredilmez. '
  + 'Kaydınızı silmemizi ya da düzeltmemizi istediğinizde bunu yapıyoruz; '
  + 'bize ulaşmanız yeterli.'

export const KVKK_ONAY_CUMLESI =
  'Yukarıdaki bilgilendirmeyi okudum; bu amaçla aranmayı kabul ediyorum.'

/**
 * Yürürlükteki metnin sürümü.
 *
 * ⚠️ `db/migrations/0106_geri_arama_talebi.sql` içindeki
 * `app.kvkk_metin_surumu()` AYNI değeri döndürmek zorunda — damgayı sunucu
 * atıyor, istemci göndermiyor. İkisi ayrışırsa arch testi kırılır.
 */
export const KVKK_METIN_SURUMU = '2026-11-06-7b40ca4d'

/**
 * Telefonu 10 haneli abone numarasına indirger; anlaşılmazsa `null`.
 *
 * ⚠️ AYNI KURAL VERİTABANINDA DA VAR (`app.telefon_sadelestir`). Çift
 * yazım bilinçli: ekran kişiye hemen "bu numara anlaşılmadı" diyebilmeli,
 * ama asıl kayıt sunucuda sadeleşmiş hâliyle duruyor — çünkü "bu
 * numaradan zaten talep var" kontrolü ancak sadeleşmiş numarayla çalışır.
 * İkisinin ayrışmaması arch testiyle ölçülüyor.
 */
export const telefonSadelestir = (telefon: string | null | undefined): string | null => {
  let rakam = (telefon ?? '').replace(/[^0-9]/g, '')
  if(rakam.length === 12 && rakam.startsWith('90')) rakam = rakam.slice(-10)
  else if(rakam.length === 11 && rakam.startsWith('0')) rakam = rakam.slice(-10)
  if(rakam.length !== 10) return null
  if(!['2', '3', '4', '5'].includes(rakam[0])) return null
  return rakam
}

/** `5321234567` → `0532 123 45 67`. Yalnız gösterim. */
export const telefonuGoster = (sade: string | null | undefined): string => {
  if(!sade || sade.length !== 10) return sade ?? ''
  return `0${sade.slice(0, 3)} ${sade.slice(3, 6)} ${sade.slice(6, 8)} ${sade.slice(8)}`
}

/** E-posta YAZILDIYSA e-postaya benzemek zorunda. Kural sunucudakiyle aynı. */
const epostaBenziyorMu = (eposta: string): boolean =>
  /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(eposta)

/**
 * Formdaki bütün eksikleri TEK LİSTEDE döndürür.
 *
 * ⚠️ Tarayıcının `required` niteliği KULLANILMIYOR: o, eksikleri tek tek
 * ve İngilizce gösteriyor (başvuru formunda aynı karar verilmişti).
 */
export const geriAramaDogrula = (talep: GeriAramaTalebi): string[] => {
  const eksikler: string[] = []

  const ad = talep.adSoyad.trim()
  if(ad.length < 2) eksikler.push('Ad soyad yazılmadı.')
  else if(ad.length > 120) eksikler.push('Ad soyad çok uzun (en çok 120 karakter).')

  if(telefonSadelestir(talep.telefon) === null){
    eksikler.push('Telefon numarası anlaşılamadı. Başında sıfır olacak şekilde '
      + 'on bir hane yazın (örnek: 0532 123 45 67).')
  }

  const firma = talep.isletmeAdi.trim()
  if(firma.length < 2) eksikler.push('İşletme adı yazılmadı.')
  else if(firma.length > 160) eksikler.push('İşletme adı çok uzun (en çok 160 karakter).')

  const eposta = talep.eposta.trim()
  if(eposta.length > 0 && !epostaBenziyorMu(eposta)){
    eksikler.push('E-posta adresi eksik görünüyor. Düzeltin ya da boş bırakın.')
  }
  if(eposta.length > 160) eksikler.push('E-posta adresi çok uzun.')

  if(talep.konu.trim().length > 600){
    eksikler.push('Not çok uzun (en çok 600 karakter).')
  }

  if(!UYGUN_SAATLER.includes(talep.uygunSaat)){
    eksikler.push('Uygun arama saati seçilmedi.')
  }

  // ⚠️ EN SONDA DEĞİL, AMA EN ÖNEMLİSİ: onay yoksa gönderim yok. Sunucu da
  // aynı şeyi söylüyor ve `consent_at` kolonu NOT NULL.
  if(!talep.onay){
    eksikler.push('Aranmayı kabul ettiğinizi işaretlemeniz gerekiyor.')
  }

  return eksikler
}

/** Durum kodları — veritabanındaki `status` kısıtıyla birebir. */
export const GERI_ARAMA_DURUMLARI = ['NEW', 'CONTACTED', 'CLOSED'] as const
export type GeriAramaDurumu = typeof GERI_ARAMA_DURUMLARI[number]

export const DURUM_ETIKETLERI: Record<GeriAramaDurumu, string> = {
  NEW: 'Bekliyor',
  CONTACTED: 'Arandı',
  CLOSED: 'Kapandı',
}
