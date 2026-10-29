// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Giriş adının BİÇİMİ · saf karar
//
// ── NEDEN AYRI BİR DOSYA ──────────────────────────────────────────────────
// Bu kural 29.10.2026'ya kadar `src/auth/giris-adresi.ts` içindeydi. O dosya
// kullanıcı adını sunucuya sorup gerçek giriş adresine çeviriyordu ve
// kaldırıldı (MIYOP-043; kaydı `docs/kararlar/kaldirilan-moduller.md §6`):
// çeviri `supabase/functions/giris-yap` Edge Function'ına taşındı.
//
// ⚠️ Ama dosyanın İÇİNDEKİ HER ŞEY sızıntı değildi. Aşağıdaki karar hiçbir
// şey sormuyor, hiçbir yere gitmiyor — tek bir dizgiye bakıyor. Onu da
// silmek `Login.tsx`i kırdı (tip denetimi yakaladı) ve kuralı oraya
// kopyalamak, "ayırmayı TEK YERDE yap" kararını bozardı.
//
// ── KARAR ─────────────────────────────────────────────────────────────────
// `includes('@')` YETMEZ. Personelin giriş adı `ad.soyad@ABCGIDA` biçiminde
// ve o da @ taşıyor — ama bir e-posta DEĞİL, oraya posta gitmez. Ayıran şey
// @'in SAĞINDA nokta olup olmamasıdır: işletme kodlarında nokta yok.
//
// ⚠️ AYNI KURALIN İKİNCİ KOPYASI `giris-yap` Edge Function'ında duruyor ve
// durmak ZORUNDA: o ayrı bir çalışma ortamı, buradan import edemez. İkisi
// ayrışırsa, tarayıcının "e-posta değil" dediği bir girdiyi sunucu e-posta
// sayar. Metni `src/auth/giris-sunucuda.arch.test.ts` ölçüyor.
// ═══════════════════════════════════════════════════════════════════════════

/** Girdi KESİNLİKLE bir e-posta mı? (`giris-yap/index.ts` ile AYNI kural) */
export const kesinEpostaMi = (girdi: string): boolean => {
  const g = (girdi || '').trim()
  if(!g.includes('@')) return false
  return g.slice(g.indexOf('@') + 1).includes('.')
}
