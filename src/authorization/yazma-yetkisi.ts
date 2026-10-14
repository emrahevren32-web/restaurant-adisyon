// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Bu kişi bu ekranda YAZABİLİR Mİ? (14.10.2026)
//
// ── NEDEN AYRI BİR DOSYA ─────────────────────────────────────────────────
// Görme tarafı bitti: menü kapısı ve rota kapısı aynı kuraldan geçiyor.
// Ama Emrah'ın tamamlanma ölçütünde bir kelime daha var:
//
//   *"herkes kendine verilen yetkiler çerçevesinde HAREKET edebiliyorsa
//    bu iş tamamdır."*
//
// Hareket = yazma. Codex denetimi (`docs/izin-kapilari-dogrulama-2026-10-13.md`)
// dört ekranda yazma kapısının YANLIŞ İZNE bağlı olduğunu gösterdi — her
// biri kuralı kendi içinde yazdığı için dördü de birbirinden habersiz
// sapmıştı:
//
//   Reçeteler   `production.write`  → olması gereken: `recipe.write`
//   HACCP       `quality.write` VEYA `stock.write` → yalnız `quality.write`
//   Sevkiyatlar `stock.write`       → `logistics.write`
//   Etiket/beyan `quality.write` VEYA `products.write` → `quality.declaration`
//
// En tehlikelisi HACCP'ti: `stock.write` yeterli sayıldığı için DEPO
// SORUMLUSU kalite ölçümü girip düzeltici faaliyet kapatabiliyordu. Oysa
// rol açıklaması "Kalite kaydı ve HACCP ölçümü girer" cümlesini yalnız
// kalite sorumlusu için kuruyor.
//
// İkincisi beyan: 0073'te `quality.declaration` izni TAM BU İŞ İÇİN
// açılmıştı ve ekran onu hiç sormuyordu.
//
// ⚠️ Kural artık tek yerde. Beşinci ekran eklendiğinde kendi kuralını
// yazmasın (tuzak 70: bir yetki sorusu tek yerde cevaplanır).
// ═══════════════════════════════════════════════════════════════════════════

import type { User } from '../types'

/**
 * Bu kişi bu izni taşıyor mu?
 *
 * ⚠️ `undefined` İÇİN **HAYIR** DÖNER — eski `!permissions || ...` kalıbının
 * tersine. O kalıp "izin listesi yüklenmemişse yazabilsin" diyordu; yani
 * listesi kaybolan kullanıcı HER ŞEYİ yazabiliyordu. `normalizeUser`ın
 * izin listesini düşürdüğü hata (12.10) tam buraya bağlanıyordu.
 *
 * Bugün bunun bir bedeli yok: App.tsx eksik izin listesini girişte
 * veritabanından tamamlıyor, tamamlayamazsa oturumu kapatıyor (13.10).
 * Yani yetkisi olan kişi buraya hiçbir zaman `undefined` ile gelmiyor.
 *
 * ⚠️ Bu bir GÜVENLİK SINIRI DEĞİL, bir ARAYÜZ kapısıdır: amacı kullanıcıya
 * çalışmayacak düğme göstermemek. Gerçek sınır veritabanında (RLS + sütun
 * seviyesi GRANT). Tarayıcıdaki listeyi değiştiren biri yine yazamaz.
 */
export const yazabilirMi = (
  user: User | null | undefined,
  izin: string,
): boolean => {
  const izinler = user?.permissions
  if(!Array.isArray(izinler)) return false
  return izinler.includes(izin)
}

/**
 * Yazma yetkisi olmayana gösterilecek açıklama.
 *
 * ⚠️ Düğmeyi sessizce gizlemek yerine SEBEBİNİ söylüyoruz. Sessiz gizleme,
 * kullanıcıyı "ekran bozuk" ya da "düğme nerede" diye aramaya gönderir.
 */
export const YAZMA_YETKISI_YOK =
  'Bu ekranda değişiklik yapma yetkiniz yok; kayıtları görüntüleyebilirsiniz.'
