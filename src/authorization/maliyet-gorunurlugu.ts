// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Parasal bilgiyi kim görür? (13.10.2026)
//
// ── NEDEN AYRI BİR DOSYA ─────────────────────────────────────────────────
// Rol açıklamalarında müşteriye şunu YAZIYORUZ:
//
//   Depo Sorumlusu  — "Fiyat ve maliyet GÖRMEZ."
//   Üretim Sorumlusu — "Ölçüm girer. Fiyat GÖRMEZ."
//   Satın Alma      — "...alış fiyatını görür."
//   Muhasebe        — "Finansı yürütür."
//
// Codex denetimi (12.10) bu sözün tutulmadığını gösterdi: stok, fire ve
// iş emri ekranları `finance.read` izni olmadan birim maliyet, stok değeri
// ve üretim maliyetini gösteriyordu. Yani ekranda yazdığımız rol tanımı
// yanlıştı — müşteriye söylediğimiz şey çalışmıyordu.
//
// ⚠️ Kural ÜÇ ekranda ayrı ayrı yazılmayacak. Üç yerde yazılan bir kural
// dördüncü ekran eklendiğinde unutulur ve bu dosyanın var olma sebebi tam
// olarak budur (tuzak 70: bir yetki sorusu tek yerde cevaplanır).
// ═══════════════════════════════════════════════════════════════════════════

import type { User } from '../types'

/** Parasal bilgiyi açan izin. Tek yerde yazılı. */
export const MALIYET_IZNI = 'finance.read'

/**
 * Bu kişi parasal bilgiyi görebilir mi?
 *
 * ⚠️ `undefined` İÇİN **HAYIR** DÖNER — menü ve rota kapılarının tersine.
 * Oralarda `undefined` "henüz yüklenmedi" sayılıp süzme yapılmıyor, çünkü
 * oradaki risk birini uygulamadan kilitlemek. Burada risk farklı: yanlış
 * tarafa düşmek, maliyeti görmemesi gereken kişiye GÖSTERMEK demek. Para
 * söz konusuysa kapalı tarafta durulur.
 *
 * Bu tavizin maliyeti de yok: App.tsx eksik izin listesini girişte
 * veritabanından tamamlıyor (13.10), yani yetkisi olan kişi hiçbir zaman
 * `undefined` ile bu fonksiyona gelmiyor.
 */
export const maliyetGorebilir = (user: User | null | undefined): boolean => {
  const izinler = user?.permissions
  if(!Array.isArray(izinler)) return false
  return izinler.includes(MALIYET_IZNI)
}

/**
 * Gizlenen parasal alanın yerine yazılacak metin.
 *
 * ⚠️ "—" TEK BAŞINA YETMEZ. Boş çizgi "veri yok" demektir; burada veri VAR
 * ama kişi göremiyor. İkisini karıştırmak, kullanıcıyı olmayan bir eksiği
 * aramaya gönderir — depocu "maliyet girilmemiş" sanıp girmeye çalışır.
 */
export const MALIYET_GIZLI = 'yetki yok'

/** Ekranın tepesinde gösterilecek tek cümlelik açıklama. */
export const MALIYET_GIZLI_ACIKLAMA =
  'Parasal bilgiler (maliyet, stok değeri, alış fiyatı) görevinizin '
  + 'kapsamında olmadığı için gizlendi. Gerekiyorsa yöneticinizden '
  + 'isteyebilirsiniz.'
