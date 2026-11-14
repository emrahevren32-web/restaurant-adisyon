// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Siparişe SON ONAY — ekranın bildiği kadarı (göç 0117)
//
// ── KARAR ────────────────────────────────────────────────────────────────
// Emrah (12.11.2026): *"ne olursa olsun son onayı veren tek bir yetkili
// olsun … bence müdürdür o kişi."*
//
// Kural: son onayı İŞLETME MÜDÜRÜ verir. İşletmede müdür rolünde aktif
// kimse yoksa İŞLETME SAHİBİ verir; müdür atandığı an bu yol kapanır.
//
// ── BU DOSYADA KURAL YOK, BİLEREK ────────────────────────────────────────
// Kural TEK yerde yazılı: `app.son_onay_yetkim_var()` (0117). Ekran onu
// yeniden hesaplamıyor, SUNUCUYA SORUYOR. Burada rol adına bakan bir satır
// yazsaydım kural iki yerde dururdu ve biri bir gün güncellenmezdi —
// üstelik "işletmede müdür var mı" sorusunun cevabı tarayıcıda yok.
//
// ⚠️ GERÇEK SINIR VERİTABANINDA: `app.siparis_onay_kapisi()` aynı
// fonksiyonu çağırıyor ve yetkisiz çağrıyı `MI403` ile reddediyor. Buradaki
// düğme kapatma yalnız nezaket: çalışmayacak düğmeyi göstermemek ve
// SEBEBİNİ söylemek.
//
// ⚠️ CEVAP CANLI: giriş anında okunan izin listesine bağlı değil. Müdür
// atanınca ekranı yeniden açmak yeter, yeniden giriş gerekmez.
// ═══════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseConfigured } from '../core/supabase'

/**
 * `true`  → bu hesap son onayı verebilir
 * `false` → veremez
 * `null`  → OKUNAMADI. ⚠️ `false` DEĞİL: "veremezsiniz" demek için bilmek
 *           gerekir; bilmediğimiz bir şeyi kural gibi söylemeyiz.
 */
export type SonOnayYetkisi = boolean | null

export const SON_ONAY_KURALI =
  'Siparişe son onayı İşletme Müdürü verir; işletmede müdür rolünde kimse '
  + 'yoksa işletme sahibi verir.'

export const SON_ONAY_YETKISI_YOK =
  `${SON_ONAY_KURALI} Bu hesap son onayı veremez; sipariş onay bekliyor `
  + 'olarak durur.'

export const SON_ONAY_OKUNAMADI =
  'Son onay yetkiniz okunamadı. Sayfayı yenileyin; okunana kadar düğme '
  + 'kapalı kalır.'

/**
 * "Onaylandı" düğmesi neden kapalı? Açıksa `undefined`.
 *
 * ⚠️ SIRA VERİTABANIYLA AYNI (0117): önce YETKİ, sonra ZİNCİR. Yetkisi
 * olmayana "şu adım eksik" demek, o adım tamamlanınca düğmenin açılacağını
 * sandırırdı.
 */
export const sonOnayKapaliSebebi = (
  yetki: SonOnayYetkisi, zincirTamam: boolean, zincirOzeti: string,
): string | undefined => {
  if(yetki === false) return SON_ONAY_YETKISI_YOK
  if(yetki === null) return SON_ONAY_OKUNAMADI
  if(!zincirTamam) return zincirOzeti
  return undefined
}

/**
 * Sunucuya sorar: bu hesap son onayı verebilir mi?
 *
 * ⚠️ HATA FIRLATMAZ, `null` döner. Bu soru düşerse sipariş ekranının
 * tamamı açılmamalı diye bir şey yok; yalnız "Onaylandı" düğmesi kapalı
 * kalır ve sebebi yazılır.
 */
export const sonOnayYetkisiniOku = async (): Promise<SonOnayYetkisi> => {
  if(!isSupabaseConfigured()) return null
  try{
    const { data, error } = await getSupabase().rpc('son_onay_yetkim_var')
    if(error){
      console.warn('[MİYOP] Son onay yetkisi okunamadı:', error.message)
      return null
    }
    // ⚠️ Yalnız GERÇEK `true` evet sayılır. `null`, 'true' metni ya da başka
    // bir biçim "evet" değildir.
    if(data === true) return true
    if(data === false) return false
    return null
  } catch (e) {
    console.warn('[MİYOP] Son onay yetkisi okunamadı:', e)
    return null
  }
}
