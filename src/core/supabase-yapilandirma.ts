// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · ".env.local gerçekten dolduruldu mu" kuralı — TEK SATIRLIK KAPI
//
// ── NEDEN AYRI DOSYA ──────────────────────────────────────────────────────
// Kural `supabase.ts` içindeydi ve o dosya YÜKLENİRKEN `createClient` çağırır.
// Yani kuralı sınamak için modülü almak, yan etki olarak bir Supabase
// istemcisi kurmak demekti (`Multiple GoTrueClient instances` uyarısının
// kaynağı da bu). Saf kural saf bir dosyada durursa sınanması bedava olur.
//
// ── NEDEN VAR (01.11.2026) ───────────────────────────────────────────────
// Kural `!anonKey.startsWith('BURAYA')` idi — BÜYÜK harfle. `.env.example`
// ise yer tutucuyu KÜÇÜK harfle yazıyor: `buraya_anon_public_anahtari`.
// Şablonu kopyalayıp doldurmayı unutan biri için bekçi HİÇ ÖTMÜYORDU:
// 25 karakter > 20 ve 'buraya…'.startsWith('BURAYA') yanlış. Uygulama
// "yapılandırıldım" diyor, istemci uyduruk anahtarla kuruluyor, ekranlar
// anlaşılmaz ağ hatalarıyla doluyordu — oysa tam bu durum için yazılmış,
// nereye ne yazılacağını anlatan bir hata mesajı vardı.
//
// ⚠️ Kusur yazım hatası DEĞİL YERLEŞİMDİ: yer tutucu bir dosyada
// (`.env.example`), onu tanıyan kural başka dosyada. İki metin zamanla
// birbirinden ayrıldı ve kimse fark etmedi. Bu yüzden yanındaki sınama
// `.env.example`'ı OKUYUP oradaki değerlerin burada reddedildiğini ölçüyor:
// şablon değişirse sınama kırmızı verir, ikisi bir daha sessizce ayrılamaz.
// (Tuzak 139: kuralı belgeye yazmak hatırlatma, teste yazmak engellemedir.)
//
// ⚠️ DAR TUTULDU, HEVESLİ DEĞİL. "İçinde x geçiyorsa reddet" demek gerçek
// bir anahtarı reddedebilir ve o zaman uygulama HİÇ açılmaz — yanlış
// "yapılandırılmamış" cevabı, yanlış "yapılandırıldı" cevabından daha da
// kötüdür. Gerçek `anon` anahtarı bir JWT'dir ve `eyJ` ile başlar.
// ═══════════════════════════════════════════════════════════════════════════

/** Anahtarın en az bu kadar uzun olması beklenir; gerçek JWT çok daha uzun. */
export const EN_KISA_ANAHTAR = 20

/**
 * `.env.local` doldurulmuş mu? Yalnız biçime bakar, sunucuya BAĞLANMAZ.
 * "Doğru anahtar mı" sorusunu yanıtlamaz; "hâlâ şablon mu" sorusunu yanıtlar.
 */
export const yapilandirmaGecerli = (adres: string, anahtar: string): boolean => {
  const u = (adres || '').trim()
  const k = (anahtar || '').trim()
  if(!u.startsWith('https://')) return false
  if(k.length <= EN_KISA_ANAHTAR) return false
  // Şablonun adresi: https://xxxxxxxxxxxx.supabase.co
  if(/^https:\/\/x+\.supabase\.co\/?$/i.test(u)) return false
  // Şablonun anahtarı: buraya_anon_public_anahtari (büyük/küçük harf farketmez)
  if(k.toUpperCase().startsWith('BURAYA')) return false
  return true
}
