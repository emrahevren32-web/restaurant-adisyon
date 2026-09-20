// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Davet bağlantısını karşılama (A4D madde 6)
//
// ── AKIŞ ──────────────────────────────────────────────────────────────────
// 1. Emrah başvuruyu onaylar, "Giriş hesabı aç ve davet gönder" der.
// 2. Supabase işletme sahibine bir e-posta yollar.
// 3. Müşteri bağlantıya tıklar → Supabase kimliği doğrular → müşteriyi
//    uygulamaya geri gönderir ve adresin SONUNA bir parça ekler:
//       #access_token=…&refresh_token=…&type=invite
// 4. Bu dosya o parçayı okur; uygulama "şifre belirle" ekranını açar.
//
// ── NEDEN ELLE OKUYORUZ ──────────────────────────────────────────────────
// Supabase istemcisi `detectSessionInUrl: false` ile kuruldu (core/supabase.ts).
// Yani adresteki oturumu KENDİLİĞİNDEN yutmuyor. Bu bilinçli: yutsaydı
// kullanıcı sessizce içeri girmiş olurdu ve şifresi hâlâ olmazdı —
// bir dahaki girişte kapıda kalırdı. Biz parçayı okuyup önce şifreyi
// belirletiyoruz.
//
// ── ⚠️ ADRESTEKİ JETON GİZLİDİR ──────────────────────────────────────────
// `access_token` o kullanıcının oturumudur. Kayda, günlüğe, hata
// bildirimine ASLA yazılmaz. Okur okumaz adres çubuğundan siliyoruz;
// yoksa müşteri ekran görüntüsü alıp gönderdiğinde hesabını da göndermiş
// olur.
// ═══════════════════════════════════════════════════════════════════════════

/** Davet mi, şifre sıfırlama mı? İkisi de aynı yoldan gelir. */
export type DavetTuru = 'invite' | 'recovery'

export type DavetBilgisi =
  | { durum: 'yok' }
  | { durum: 'hata'; mesaj: string }
  | { durum: 'var'; tur: DavetTuru; erisimJetonu: string; yenilemeJetonu: string }

/** Supabase'in hata kodlarını insan cümlesine çevirir. */
const hataCumlesi = (kod: string, aciklama: string): string => {
  if(/expired/i.test(kod) || /expired/i.test(aciklama)){
    return 'Davet bağlantısının süresi dolmuş. Yeni bir davet isteyin.'
  }
  if(/access_denied|invalid/i.test(kod)){
    return 'Davet bağlantısı geçersiz. Bağlantının tamamını kopyaladığınızdan '
      + 'emin olun ya da yeni bir davet isteyin.'
  }
  return aciklama || 'Davet bağlantısı işlenemedi.'
}

/**
 * Adres parçasını çözümler.
 *
 * Saf fonksiyon: `window`a dokunmaz, böylece testte birebir sınanabiliyor.
 *
 * @param hash `window.location.hash` — başındaki `#` olsun ya da olmasın.
 */
export const davetiCozumle = (hash: string): DavetBilgisi => {
  const ham = (hash || '').replace(/^#/, '').trim()
  if(ham.length === 0) return { durum: 'yok' }

  const p = new URLSearchParams(ham)

  const hataKodu = p.get('error_code') || p.get('error') || ''
  if(hataKodu){
    return { durum: 'hata', mesaj: hataCumlesi(hataKodu, p.get('error_description') || '') }
  }

  const tur = p.get('type')
  if(tur !== 'invite' && tur !== 'recovery') return { durum: 'yok' }

  const erisim = p.get('access_token') || ''
  const yenileme = p.get('refresh_token') || ''
  if(!erisim || !yenileme){
    // Tür doğru ama jeton yok: yarım bir bağlantı. Sessizce geçmiyoruz.
    return {
      durum: 'hata',
      mesaj: 'Davet bağlantısı eksik görünüyor. E-postadaki bağlantının '
        + 'tamamını kullanın ya da yeni bir davet isteyin.',
    }
  }

  return { durum: 'var', tur, erisimJetonu: erisim, yenilemeJetonu: yenileme }
}

/**
 * Adres çubuğundaki gizli parçayı siler.
 *
 * ⚠️ `replaceState` kullanılıyor, `location.hash = ''` DEĞİL: ikincisi
 * geçmişe yeni bir kayıt ekler ve kullanıcı "geri" dediğinde jeton
 * adres çubuğuna geri gelir.
 */
export const adresiTemizle = (pencere: Window = window) => {
  try {
    const temiz = `${pencere.location.pathname}${pencere.location.search}`
    pencere.history.replaceState(null, '', temiz)
  } catch {
    // Geçmiş API'si engellenmişse ekran yine çalışır; yalnız adres kirli kalır.
  }
}

/** Şifre kuralı. Kısa şifre, kapıyı açık bırakmaktır. */
export const SIFRE_EN_AZ = 8

export const sifreDogrula = (sifre: string, tekrar: string): string[] => {
  const hatalar: string[] = []
  const s = sifre ?? ''

  if(s.length < SIFRE_EN_AZ) hatalar.push(`Şifre en az ${SIFRE_EN_AZ} karakter olmalı.`)
  if(s.length > 72) hatalar.push('Şifre en fazla 72 karakter olabilir.')
  if(!/[a-zçğıöşü]/i.test(s)) hatalar.push('Şifre en az bir harf içermeli.')
  if(!/\d/.test(s)) hatalar.push('Şifre en az bir rakam içermeli.')
  if(/^\s|\s$/.test(s)) hatalar.push('Şifrenin başında ya da sonunda boşluk olmamalı.')
  if(s !== tekrar) hatalar.push('İki şifre aynı değil.')

  return hatalar
}
