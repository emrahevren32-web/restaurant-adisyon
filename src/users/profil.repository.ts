// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Profilim · veritabanı erişimi
//
// ── NEDEN YAZILDI ────────────────────────────────────────────────────────
// Profilim ekranı "Kullanıcı kaydı bulunamadı" diyordu ve HİÇ çalışmıyordu.
// Sebep ölçüldü: ekran `loadUsers()` ile **localStorage**'ı okuyor, giriş
// yapan kullanıcı ise Supabase'deki `app_user` satırından geliyor ve o
// listeye hiç yazılmıyor. `findIndex` bu yüzden hep `-1` dönüyordu.
// Yani ekran, kullanıcının giriş yaptığı dünyadan BAŞKA bir dünyayı
// okuyordu (tuzak 82).
//
// ── NEYİ DEĞİŞTİREBİLİR, NEYİ DEĞİŞTİREMEZ ───────────────────────────────
// Emrah'ın kararı (20.10): ad-soyad ve telefon açık; kullanıcı adı ve rol
// kapalı (onlar yönetici işi); profil fotoğrafı şimdilik yok; şifre
// değiştirme açık.
//
// ⚠️ BU SINIR EKRANDA DEĞİL, VERİTABANINDA. `app_user` üzerinde
// `authenticated` rolünün **tablo seviyesinde UPDATE hakkı YOKTUR**; yalnız
// `full_name`, `phone`, `profile_photo_url`, `updated_at` kolonlarında
// vardır (göç 0012). Yani ekranı atlayıp REST'e `role_code` göndermek
// `42501` ile reddedilir. Ekrandaki "salt okunur" rozetleri bir KOLAYLIK;
// koruma aşağıda.
// Prova: `db/prova/prova-0091.sql` — depo sorumlusu kendi adını yazıyor
// ama kendini admin YAPAMIYOR.
//
// ⚠️ Kendi satırı dışına çıkamaz: `app.kullanici_satiri_izni()` (0085)
// `users.manage` yoksa yalnız `auth.uid()` ile eşleşen satıra izin veriyor.
// Başkasının satırı `MI403` alır.
//
// ⚠️ Değişiklik DENETİME düşüyor (göç 0091). Eski ekran `addActionLog` ile
// tarayıcıya yazıyordu — yani "kim yaptı" kaydı da sahteydi.
// ═══════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseConfigured } from '../core/supabase'

/** Profilim ekranının gösterdiği her şey. Boş alan `null`, uydurulmaz. */
export type Profilim = {
  id: string
  adSoyad: string
  kullaniciAdi: string
  telefon: string | null
  rolKodu: string | null
  /** Firma adı — salt okunur, Firma Profili ekranının işi. */
  firmaAdi: string | null
  /** Erişebildiği şubeler — salt okunur, Şube Yetkileri ekranının işi. */
  subeler: string[]
  /** Giriş adresi; oturumdan gelir, `app_user`da durmaz. */
  girisAdresi: string | null
}

export type ProfilYazimi = {
  adSoyad: string
  telefon: string
}

/** İşlem sonucu. ⚠️ `hata` doluysa ekran ONU gösterir, kendi cümlesini değil. */
export type ProfilSonucu =
  | { durum: 'oldu' }
  | { durum: 'hata'; mesaj: string }

const YAPILANDIRILMADI = 'Veritabanı bağlantısı yapılandırılmamış.'

/**
 * Oturumdaki kullanıcının kendi profilini okur.
 *
 * ⚠️ `currentUser`dan DEĞİL, veritabanından okuyor. Oturumdaki kopya giriş
 * anında alınmıştı; aradan geçen sürede yönetici adı değiştirmiş olabilir.
 * Ekranın gösterdiği şey, kaydedilmiş olan şey olmalı.
 */
export const profilimiOku = async (): Promise<Profilim | null> => {
  if(!isSupabaseConfigured()) return null
  const supabase = getSupabase()

  const { data: oturum, error: oturumHatasi } = await supabase.auth.getUser()
  if(oturumHatasi || !oturum?.user) return null

  const { data, error } = await supabase
    .from('app_user')
    .select('id, full_name, username, phone, role_code, company_id')
    .eq('auth_user_id', oturum.user.id)
    .maybeSingle()

  if(error || !data) return null

  // Firma adı ve şubeler AYRI okunuyor: biri düşerse profil yine görünsün.
  // ⚠️ Okunamayan alan `null`/boş kalır — "—" diye gösterilir, uydurulmaz.
  let firmaAdi: string | null = null
  if(data.company_id){
    const { data: firma } = await supabase
      .from('company')
      .select('company_name')
      .eq('id', data.company_id)
      .maybeSingle()
    firmaAdi = firma?.company_name ?? null
  }

  const subeler: string[] = []
  const { data: erisimler } = await supabase
    .from('user_branch_access')
    .select('branch:branch_id(name, is_active)')
    .eq('user_id', data.id)
  for(const satir of erisimler ?? []){
    const sube = (satir as { branch?: { name?: string; is_active?: boolean } }).branch
    if(sube?.name && sube.is_active !== false) subeler.push(sube.name)
  }

  return {
    id: data.id,
    adSoyad: data.full_name ?? '',
    kullaniciAdi: data.username ?? '',
    telefon: data.phone ?? null,
    rolKodu: data.role_code ?? null,
    firmaAdi,
    subeler: subeler.sort((a, b) => a.localeCompare(b, 'tr-TR')),
    girisAdresi: oturum.user.email ?? null,
  }
}

/**
 * Ad-soyad ve telefonu yazar. BAŞKA HİÇBİR ALANA dokunmaz.
 *
 * ⚠️ `role_code` ya da `username` buraya eklenirse veritabanı `42501` ile
 * reddeder — kolon yetkisi yok. O yüzden bu nesneyi genişletmeyin;
 * genişletmek gerekiyorsa önce göç yazılır ve gerekçesi tartışılır.
 */
export const profilimiYaz = async (
  kimlik: string,
  degerler: ProfilYazimi,
): Promise<ProfilSonucu> => {
  if(!isSupabaseConfigured()) return { durum: 'hata', mesaj: YAPILANDIRILMADI }

  const adSoyad = degerler.adSoyad.trim()
  if(!adSoyad) return { durum: 'hata', mesaj: 'Ad soyad zorunludur.' }

  const telefon = degerler.telefon.trim()

  const { error } = await getSupabase()
    .from('app_user')
    .update({
      full_name: adSoyad,
      // ⚠️ Boş telefon `null` yazılıyor, boş metin değil: "bilinmiyor" ile
      // "boş bırakıldı" aynı şey değil (projenin genel kuralı).
      phone: telefon || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', kimlik)

  if(error){
    console.warn('[MİYOP] Profil kaydedilemedi:', error.message)
    // ⚠️ Ham veritabanı metni kullanıcıya GÖSTERİLMEZ (0030'un kuralı).
    return {
      durum: 'hata',
      mesaj: error.code === '42501' || error.code === 'MI403'
        ? 'Bu alanı değiştirme yetkiniz yok.'
        : 'Profil kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.',
    }
  }

  return { durum: 'oldu' }
}

/**
 * Şifre değiştirme.
 *
 * ⚠️ Şifre MİYOP'un veritabanına HİÇ yazılmaz; yalnız Supabase Auth'un
 * özeti durur (0076'nın kuralı). Buradan da yalnız Auth'a iletiliyor.
 * ⚠️ Hiçbir günlüğe, hata nesnesine ya da denetim kaydına girmez.
 */
export const sifremiDegistir = async (yeniSifre: string): Promise<ProfilSonucu> => {
  if(!isSupabaseConfigured()) return { durum: 'hata', mesaj: YAPILANDIRILMADI }

  if(yeniSifre.length < 8){
    return { durum: 'hata', mesaj: 'Şifre en az 8 karakter olmalı.' }
  }

  const supabase = getSupabase()
  const { error } = await supabase.auth.updateUser({ password: yeniSifre })
  if(error){
    // ⚠️ Sağlayıcının ham metni dışarı verilmiyor.
    console.warn('[MİYOP] Şifre değiştirilemedi:', error.message)
    return {
      durum: 'hata',
      mesaj: 'Şifre değiştirilemedi. Yeni şifre kurallara uymuyor olabilir.',
    }
  }

  // Geçici şifre bayrağı varsa düşsün (0076). Zaten düşmüşse bir şey
  // değişmez; bu çağrı sessizce idempotenttir.
  const { error: bayrakHatasi } = await supabase.rpc('sifremi_belirledim')
  if(bayrakHatasi){
    // Şifre DEĞİŞTİ; bayrak düşmediyse kullanıcıyı bekletmenin anlamı yok.
    console.warn('[MİYOP] Geçici şifre bayrağı düşürülemedi:', bayrakHatasi.message)
  }

  return { durum: 'oldu' }
}
