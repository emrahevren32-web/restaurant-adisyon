// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C3 — Portala giriş bağlantısını karşılama
//
// ── AKIŞ ──────────────────────────────────────────────────────────────────
// 1. Müşteri, mutfağın sitesindeki forma e-postasını yazar.
// 2. Supabase o adrese TEK KULLANIMLIK bir bağlantı yollar.
// 3. Müşteri tıklar → Supabase kimliği doğrular → adresin sonuna bir parça
//    ekleyerek portala geri gönderir:  #access_token=…&type=magiclink
// 4. Bu dosya o parçayı okur.
//
// ── NİÇİN PAROLA YOK ──────────────────────────────────────────────────────
// Parola unutulur, sızar, sıfırlanır ve her biri destek yüküdür. Müşterinin
// gelen kutusu zaten onun güvenlik sınırıdır. Bu projenin kuralı da aynı:
// parola hiçbir zaman istenmez.
//
// ── NİÇİN ELLE OKUYORUZ ───────────────────────────────────────────────────
// İstemci `detectSessionInUrl: false` ile kuruldu (core/supabase.ts) ve bu
// bilinçli — davet akışı (0039) buna dayanıyor. Bayrağı açmak orayı bozardı.
// Parçayı burada okuyup oturumu biz kuruyoruz.
//
// ── ⚠️ ADRESTEKİ JETON GİZLİDİR ───────────────────────────────────────────
// `access_token` o kişinin oturumudur. Kayda, günlüğe, hata bildirimine
// ASLA yazılmaz; okunur okunmaz adres çubuğundan silinir. Yoksa müşteri
// ekran görüntüsü aldığında hesabını da göndermiş olur.
// ═══════════════════════════════════════════════════════════════════════════

export type PortalGirisi =
  | { durum: 'yok' }
  | { durum: 'hata'; mesaj: string }
  | { durum: 'var'; erisimJetonu: string; yenilemeJetonu: string }

const hataCumlesi = (kod: string, aciklama: string): string => {
  if(/expired/i.test(kod) || /expired/i.test(aciklama)){
    return 'Giriş bağlantısının süresi dolmuş. Aşağıdan yeni bir bağlantı isteyin.'
  }
  if(/access_denied|invalid|otp/i.test(kod)){
    return 'Giriş bağlantısı geçersiz ya da daha önce kullanılmış. '
      + 'Yeni bir bağlantı isteyin.'
  }
  return aciklama || 'Giriş bağlantısı işlenemedi.'
}

/**
 * Adres parçasını çözümler. Saf fonksiyon: `window`a dokunmaz.
 *
 * @param hash `window.location.hash` — başındaki `#` olsun ya da olmasın.
 */
export const portalGirisiniCozumle = (hash: string): PortalGirisi => {
  const ham = (hash || '').replace(/^#/, '').trim()
  if(ham.length === 0) return { durum: 'yok' }

  const p = new URLSearchParams(ham)

  const hataKodu = p.get('error_code') || p.get('error') || ''
  if(hataKodu){
    return { durum: 'hata', mesaj: hataCumlesi(hataKodu, p.get('error_description') || '') }
  }

  // ⚠️ Yalnız `magiclink`. `invite` ve `recovery` PERSONEL akışıdır (0039) ve
  // onları burada yutmak, davet edilen bir çalışanı şifre belirleme ekranına
  // hiç ulaştırmazdı.
  if(p.get('type') !== 'magiclink') return { durum: 'yok' }

  const erisim = p.get('access_token') || ''
  const yenileme = p.get('refresh_token') || ''
  if(!erisim || !yenileme){
    return {
      durum: 'hata',
      mesaj: 'Giriş bağlantısı eksik görünüyor. E-postadaki bağlantının '
        + 'tamamını kullanın ya da yeni bir bağlantı isteyin.',
    }
  }
  return { durum: 'var', erisimJetonu: erisim, yenilemeJetonu: yenileme }
}

/**
 * Kiracıya verilecek gömme kodu.
 *
 * Emrah: "MİYOP bana bir form linki verecek, ben o linki kendi siteme
 * ekleyeceğim."
 *
 * ⚠️ Bağlantı bir SIR DEĞİL ve olmamalı: hangi müşteri olduğunu taşımıyor,
 * kimliği e-posta belirliyor. Bağlantıyı gören biri yalnızca giriş ekranını
 * görür. Bağlantıya sır koysaydık, o sır kiracının açık web sitesinde
 * yazılı olurdu.
 */
export const portalBaglantisi = (koken: string): string =>
  `${koken.replace(/\/+$/, '')}/portal`

export const gommeKodu = (koken: string): string =>
  `<iframe src="${portalBaglantisi(koken)}" `
  + `style="width:100%;height:900px;border:0" `
  + `title="Sipariş formu"></iframe>`
