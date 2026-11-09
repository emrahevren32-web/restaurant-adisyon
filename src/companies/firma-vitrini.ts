// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · İŞLETMENİN ADI VE LOGOSU KABUĞA ULAŞIYOR (MIYOP-103)
//
// ── NEDEN VAR ────────────────────────────────────────────────────────────
// "Firma Profili" ekranı firma adını ve logo adresini **veritabanına**
// yazıyor (`company.company_name`, `company.logo_url` · 0006). Kabuk
// (`App.tsx > workspaceChrome`) ise adı ve logoyu `loadCompanies()` ile
// **tarayıcı deposundan** okuyordu.
//
// Sonuç ölçüldü: işletme adını kaydeden kullanıcı kaydettiğini ekranda
// göremiyordu. Kenar çubuğu, üst bant ve sekme başlığı eski adı
// gösteriyordu; sayfa yenilenince de değişmiyordu, çünkü yeni ad tarayıcı
// deposunda hiç yoktu. Kullanıcı için bu "kaydetmedi" demektir — oysa
// kayıt gitmişti. En kötü hata sınıfı: iş yapıldı, ekran yapılmamış dedi.
//
// ── KURAL ────────────────────────────────────────────────────────────────
// Kabuk adı ve logoyu **defterden** okur. Tarayıcı deposu yalnız
// VERİTABANI boş olduğunda (ya da Supabase yapılandırılmadığında) geriye
// düşülen yerdir — tek merkez kararının (`tek-merkez-karari`) gereği.
//
// ⚠️ OLAY NEDEN VAR: profil ekranı ile kabuk arasında prop yolu yok
// (`BusinessWorkspaceRouteHost` araya giriyor). Üç dosyaya prop eklemek
// yerine zilin yıllardır kullandığı desen tekrarlanıyor: kaydeden taraf
// bir tarayıcı olayı yayımlıyor, kabuk onu dinleyip defterden yeniden
// okuyor. Aynı kullanıcının İKİNCİ bir sekmesi de `storage` olayı
// olmadığı için güncellenmez — orada tazeleme sayfa yenilemesiyle olur;
// bu bilinçli, çünkü ad her an değişen bir şey değil.
// ═══════════════════════════════════════════════════════════════════════════

import { firmaProfiliniOku } from './firma-profili.repository'

export const FIRMA_VITRINI_OLAYI = 'miyop:firma-vitrini-degisti'

/** Kabuğun gösterdiği iki alan. Boş dizeler "defterde yok" demek. */
export type FirmaVitrini = {
  ad: string
  logoAdresi: string
}

const tarayicidaMi = (): boolean => typeof window !== 'undefined'

/**
 * Okunan profilden kabuk vitrinini seç.
 *
 * ⚠️ SAF FONKSİYON, bilerek: kuralın kendisi burada ölçülebilsin.
 * İkisi de boşsa `null` dönüyor — "defterde bir şey yok" demek, ki
 * kabuk o zaman eski kaynağına düşsün. Boş dize döndürmek, kabuğun adını
 * BOŞ yazması olurdu: üst bantta hiçbir şey görünmezdi.
 */
export const firmaVitriniSec = (
  profil: { firmaAdi?: string | null; logoAdresi?: string | null } | null,
): FirmaVitrini | null => {
  if(!profil) return null
  const ad = (profil.firmaAdi ?? '').trim()
  const logo = (profil.logoAdresi ?? '').trim()
  if(ad === '' && logo === '') return null
  return { ad, logoAdresi: logo }
}

/** Defterden oku. Supabase yapılandırılmamışsa `null`. */
export const firmaVitriniOku = async (firmaId?: string): Promise<FirmaVitrini | null> => {
  const profil = await firmaProfiliniOku(firmaId)
  return firmaVitriniSec(profil)
}

/** "Kaydettim" haberi — Firma Profili ekranı çağırıyor. */
export const firmaVitriniDegisti = (): void => {
  if(!tarayicidaMi()) return
  window.dispatchEvent(new Event(FIRMA_VITRINI_OLAYI))
}

/** Kabuk dinliyor. Dönen fonksiyon aboneliği bırakıyor. */
export const subscribeFirmaVitrini = (dinleyici: () => void): (() => void) => {
  if(!tarayicidaMi()) return () => {}
  const isle = () => dinleyici()
  window.addEventListener(FIRMA_VITRINI_OLAYI, isle)
  return () => window.removeEventListener(FIRMA_VITRINI_OLAYI, isle)
}
