// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Firma Profili · veritabanı erişimi · MIYOP-060 / 062 / 063
//
// ── NEDEN YAZILDI ────────────────────────────────────────────────────────
// Ekran Kaydet'e basınca veriyi `localStorage`a yazıyordu. Yani müşteri
// vergi numarasını girip kaydediyor, "kaydedildi" yazısını görüyor, başka
// bir bilgisayardan giriyor ve **hiçbir şey yok**. Demoda ilk fark edilecek
// şey buydu.
//
// Üç kusur aynı kökten geliyordu:
//   · MIYOP-060 · boş alan UYDURULARAK dolduruluyordu: ticari unvan boşsa
//     ekran firma adını unvan gibi gösteriyordu. ⚠️ Göç 0084 bu yalanı
//     veritabanı tarafında ONARMIŞTI; ikinci katmanda yaşıyordu (tuzak 106).
//   · MIYOP-062 · dört alan (kısa ad, web, posta kodu, yetkili unvanı)
//     kayıtta SESSİZCE düşüyordu — tipte vardı, kayıtta yoktu.
//   · MIYOP-063 · bir firmayı kaydetmek diğerinin yerel kaydını siliyordu.
// Üçü de "ortak koleksiyonu tarayıcıda tut" deseninin sonucuydu. Ekran
// veritabanına bağlanınca üçü birden kapanıyor.
//
// ── YAZMA SÖZLEŞMESİ · ÖLÇÜLDÜ ───────────────────────────────────────────
// ⚠️ `authenticated` rolü `company` tablosunda **tablo seviyesinde**
// `select, insert, update` hakkına sahip (0006). Profilim'deki gibi kolon
// kısıtı YOKTUR. Yani koruma kolonda değil, TETİKTE:
//   · `izin_company` (0085) → `app.izin_gerek('company.manage')`
//     Yetkisiz UPDATE **sunucuda** reddediliyor; ekranı atlayıp REST'e
//     gitmek işe yaramıyor.
//   · RLS `company_tenant_isolation` (0001) satırı kiracıya bağlıyor.
//   · `denetim_company` (0091) → kim neyi değiştirdi, yazılı.
// Ölçüm (29.10, yerel prova veritabanı, 103 göç): `company` üzerinde beş
// tetik var ve `izin_company`in gövdesi `app.yetkim_var(tg_argv[0])`
// çağırıyor.
//
// ── KİM DEĞİŞTİREBİLİR ───────────────────────────────────────────────────
// Emrah'ın kararı (21.10): **yalnız işletme sahibi.** Müdür değiştiremez.
// ⚠️ Bu karar zaten veritabanında yazılıydı: göç 0015 `isletme_muduru`
// rolüne `company.manage` iznini VERMİYOR, ve gerekçesi göçün içinde:
// *"müdür işi yürütür, işletmenin kimliğini ve kimin neye erişeceğini
// değiştirmez. O yetki sahiptedir."*
// Ekrandaki "salt okunur" rozeti bir KOLAYLIK; asıl kapı yukarıda.
//
// ── BOŞ ALAN ─────────────────────────────────────────────────────────────
// ⚠️ Boş olan boş döner. Uydurulmaz, başka bir alandan doldurulmaz.
// Boşaltılan alan `null` yazılır — "bilinmiyor" ile "boş bırakıldı" aynı
// şey değil (projenin genel kuralı).
// ═══════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseConfigured } from '../core/supabase'

/** Firma Profili ekranının gösterdiği her şey. Boş alan `null`. */
export type FirmaProfili = {
  id: string
  /** Salt okunur: kiracı açılırken verilir, ekrandan değişmez. */
  firmaKodu: string | null
  firmaAdi: string
  kisaAd: string | null
  ticariUnvan: string | null
  vergiDairesi: string | null
  vergiNumarasi: string | null
  telefon: string | null
  eposta: string | null
  web: string | null
  adres: string | null
  il: string | null
  ilce: string | null
  postaKodu: string | null
  logoAdresi: string | null
  yetkiliAdSoyad: string | null
  yetkiliUnvan: string | null
  yetkiliTelefon: string | null
  yetkiliEposta: string | null
  /** Son kaydın zamanı. "Kaydedildi" iddiasının tek kanıtı budur. */
  guncellendi: string | null
}

/** Ekranın yazabildiği alanlar. ⚠️ Firma kodu, sektör ve durum YOK. */
export type FirmaProfiliYazimi = {
  firmaAdi: string
  kisaAd: string
  ticariUnvan: string
  vergiDairesi: string
  vergiNumarasi: string
  telefon: string
  eposta: string
  web: string
  adres: string
  il: string
  ilce: string
  postaKodu: string
  logoAdresi: string
  yetkiliAdSoyad: string
  yetkiliUnvan: string
  yetkiliTelefon: string
  yetkiliEposta: string
}

/**
 * Vergi numarası biçimi.
 *
 * ⚠️ BOŞ SERBESTTİR: yeni açılmış bir işletme numarasını henüz girmemiş
 * olabilir ve onu kapıda bırakmayız. Ama GİRİLDİYSE doğru olmalı: Türkiye'de
 * tüzel kişinin VKN'si **10 hane**, gerçek kişinin TC Kimlik No'su **11
 * hanedir**. Yanlış numara e-fatura/e-irsaliye tarafında reddedilir ve o
 * red, buradan aylar sonra görünür.
 *
 * ⚠️ Boşluklar temizlenir (kullanıcı `1234 567 890` yazabiliyor), ama harf
 * ya da tire SESSİZCE ATILMAZ — kullanıcı bir şey yazmıştır, biz onu
 * "düzeltip" kaydedersek neyin kaydedildiğini bilmez.
 */
export const vergiNumarasiniDenetle = (ham: string): string | null => {
  const temiz = (ham || '').replace(/\s/g, '')
  if(!temiz) return null
  if(!/^[0-9]+$/.test(temiz)){
    return 'Vergi numarası yalnız rakamlardan oluşur.'
  }
  if(temiz.length !== 10 && temiz.length !== 11){
    return 'Vergi numarası 10 hane (VKN) ya da 11 hane (TC Kimlik No) olmalı. '
      + `Girilen: ${temiz.length} hane.`
  }
  return null
}

export type FirmaSonucu =
  | { durum: 'oldu'; profil: FirmaProfili }
  | { durum: 'hata'; mesaj: string }

const YAPILANDIRILMADI = 'Veritabanı bağlantısı yapılandırılmamış.'

/** ⚠️ Boş metin `null`a döner; "" diye yazmak boşluğu veri gibi gösterir. */
const bos = (deger: unknown): string | null => {
  const metin = typeof deger === 'string' ? deger.trim() : ''
  return metin ? metin : null
}

const SUTUNLAR = [
  'id', 'company_code', 'company_name', 'short_name', 'legal_name',
  'tax_office', 'tax_number', 'phone', 'email', 'website', 'address',
  'city', 'district', 'postal_code', 'logo_url',
  'authorized_person', 'authorized_title', 'authorized_phone',
  'authorized_email', 'updated_at',
].join(', ')

type FirmaSatiri = Record<string, unknown>

const profileCevir = (satir: FirmaSatiri): FirmaProfili => ({
  id: String(satir.id ?? ''),
  firmaKodu: bos(satir.company_code),
  firmaAdi: typeof satir.company_name === 'string' ? satir.company_name : '',
  kisaAd: bos(satir.short_name),
  ticariUnvan: bos(satir.legal_name),
  vergiDairesi: bos(satir.tax_office),
  vergiNumarasi: bos(satir.tax_number),
  telefon: bos(satir.phone),
  eposta: bos(satir.email),
  web: bos(satir.website),
  adres: bos(satir.address),
  il: bos(satir.city),
  ilce: bos(satir.district),
  postaKodu: bos(satir.postal_code),
  logoAdresi: bos(satir.logo_url),
  yetkiliAdSoyad: bos(satir.authorized_person),
  yetkiliUnvan: bos(satir.authorized_title),
  yetkiliTelefon: bos(satir.authorized_phone),
  yetkiliEposta: bos(satir.authorized_email),
  guncellendi: bos(satir.updated_at),
})

/**
 * Oturumdaki kullanıcının firmasını okur.
 *
 * ⚠️ Kiracı süzmesini BU DOSYA YAPMAZ — RLS yapar (ADR-004). Sorguya
 * `tenant_id` eşitliği EKLEMİYORUZ; eklersek "filtre var, demek ki güvenli"
 * yanılsaması doğar ve RLS'in kapalı kalması fark edilmez.
 *
 * ⚠️ `company_id` boş kalmış kullanıcılar var (köprü dosyasının notu). RLS
 * zaten tek kiracıya indirdiği için, eşleşme yoksa ve geriye TEK satır
 * kaldıysa o satır kullanılır. Birden fazla satır varsa TAHMİN EDİLMEZ:
 * `null` döner ve ekran sebebini yazar.
 */
export const firmaProfiliniOku = async (
  firmaId?: string,
): Promise<FirmaProfili | null> => {
  if(!isSupabaseConfigured()) return null

  const { data, error } = await getSupabase().from('company').select(SUTUNLAR)
  if(error || !data){
    if(error) console.warn('[MİYOP] Firma profili okunamadı:', error.message)
    return null
  }

  // ⚠️ `as unknown as` ŞART: supabase-js'in dönüş tipi hata hâlinde
  // `GenericStringError[]` olabiliyor ve doğrudan dönüşüm `tsc`de TS2352
  // veriyor. Hata zaten yukarıda ayıklandı; burada kalan şey satırlardır.
  const satirlar = data as unknown as FirmaSatiri[]
  if(satirlar.length === 0) return null

  const satir = satirlar.find(item => String(item.id ?? '') === (firmaId ?? ''))
    ?? (satirlar.length === 1 ? satirlar[0] : undefined)

  return satir ? profileCevir(satir) : null
}

/**
 * Firma profilini yazar ve YAZILMIŞ HÂLİNİ geri okur.
 *
 * ⚠️ Geri okuma bilinçli: ekranın gösterdiği şey, kaydedilmiş olan şey
 * olmalı. Formdaki değeri "başarılı" diye ekranda bırakmak, veritabanının
 * başka bir şey yazmış olma ihtimalini gizler.
 *
 * ⚠️ Bu nesneye `company_code`, `primary_sector_id`, `status`,
 * `default_branch_id` ya da `tenant_id` EKLENMEZ. Hiçbiri bu ekranın işi
 * değil; eklemek, bir ekranın kiracının kimliğini değiştirebilmesi demek.
 */
export const firmaProfiliniYaz = async (
  firmaId: string,
  degerler: FirmaProfiliYazimi,
): Promise<FirmaSonucu> => {
  if(!isSupabaseConfigured()) return { durum: 'hata', mesaj: YAPILANDIRILMADI }

  const firmaAdi = degerler.firmaAdi.trim()
  if(!firmaAdi) return { durum: 'hata', mesaj: 'Firma adı zorunludur.' }
  if(!firmaId) return { durum: 'hata', mesaj: 'Firma kaydı bulunamadı.' }

  // ⚠️ Biçim yanlışsa veritabanına HİÇ gidilmiyor: yanlış numarayı kaydedip
  // aylar sonra e-fatura tarafında öğrenmektense burada söylemek ucuzdur.
  const vergiHatasi = vergiNumarasiniDenetle(degerler.vergiNumarasi)
  if(vergiHatasi) return { durum: 'hata', mesaj: vergiHatasi }

  const { error } = await getSupabase()
    .from('company')
    .update({
      company_name: firmaAdi,
      short_name: bos(degerler.kisaAd),
      legal_name: bos(degerler.ticariUnvan),
      tax_office: bos(degerler.vergiDairesi),
      tax_number: bos(degerler.vergiNumarasi.replace(/\s/g, '')),
      phone: bos(degerler.telefon),
      email: bos(degerler.eposta),
      website: bos(degerler.web),
      address: bos(degerler.adres),
      city: bos(degerler.il),
      district: bos(degerler.ilce),
      postal_code: bos(degerler.postaKodu),
      logo_url: bos(degerler.logoAdresi),
      authorized_person: bos(degerler.yetkiliAdSoyad),
      authorized_title: bos(degerler.yetkiliUnvan),
      authorized_phone: bos(degerler.yetkiliTelefon),
      authorized_email: bos(degerler.yetkiliEposta),
      updated_at: new Date().toISOString(),
    })
    .eq('id', firmaId)

  if(error){
    console.warn('[MİYOP] Firma profili kaydedilemedi:', error.message)
    // ⚠️ Ham veritabanı metni kullanıcıya GÖSTERİLMEZ (0030'un kuralı).
    return {
      durum: 'hata',
      mesaj: error.code === '42501' || error.code === 'MI403'
        ? 'Firma bilgilerini değiştirme yetkiniz yok. Bu yetki işletme sahibindedir.'
        : 'Firma bilgileri kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.',
    }
  }

  const profil = await firmaProfiliniOku(firmaId)
  if(!profil){
    // Yazım geçti ama geri okuma düştü. "Kaydedildi" demek doğru olur ama
    // ekranda ne göstereceğimizi bilmiyoruz; kullanıcıya yenilemesini
    // söylemek, yanlış bir tablo göstermekten dürüsttür.
    return {
      durum: 'hata',
      mesaj: 'Kayıt gönderildi ama güncel bilgiler okunamadı. Sayfayı yenileyin.',
    }
  }

  return { durum: 'oldu', profil }
}
