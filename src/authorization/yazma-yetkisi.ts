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
 * çalışmayacak düğme göstermemek.
 *
 * ⚠️ 14.10 DÜZELTME — BU YORUM YANLIŞTI. Burada "gerçek sınır
 * veritabanındadır" yazıyordu ve Codex denetimi bunun DOĞRU OLMADIĞINI
 * gösterdi: `recipe`, `haccp_*` ve `shipment` tablolarında RLS yalnız
 * KİRACI eşitliğine bakıyordu, izne değil. Yani konsoldan repository'yi
 * çağıran biri yazabiliyordu. Bir yorumun doğru olduğunu varsaymak,
 * kapının takılı olduğunu varsaymaktır.
 *
 * 0081 bunu düzeltti: her tablonun kendi `izin_*` tetiği var ve izni
 * olmayan çağrı MI403 ile reddediliyor. Artık burası gerçekten yalnız
 * arayüz nezaketi — sınır veritabanında.
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

/**
 * HACCP kaydını DÜZELTME yetkisi (0081).
 *
 * `quality.write` ölçüm girer; `quality.record.manage` ölçümü iptal eder ve
 * düzeltici faaliyeti kapatır. İkincisi kalite sorumlusu, gıda mühendisi,
 * işletme müdürü ve işletme sahibindedir.
 */
export const KALITE_KAYIT_DUZELTME = 'quality.record.manage'

export const KAPATMA_YETKISI_YOK =
  'Düzeltici faaliyeti kapatmak kalite kararıdır. Ölçümü siz girebilirsiniz '
  + 'ama "çözüldü" beyanını kalite sorumlusu, gıda mühendisi ya da yönetim '
  + 'yazar. Yapılan işi not alıp onlara bildirin.'

/**
 * ŞAHİT NUMUNE — ORTAK BİR İŞ (0093).
 *
 * Emrah'ın kararı (25.10.2026): *"Her ikisine de bağla sen. Bunun ortak bir
 * iş olabileceğini de belirt. Çünkü gerçekten ikisi de bakabilir buna."*
 * İsmet'in anlattığı akış da öyle: numuneyi ÜRETİM alıyor, gıda teknikeri ve
 * depocunun kontrolünde.
 *
 * ⚠️ Depocu bu listede YOK ve bu bilinçli. İsmet "depocu kontrolünde" dedi;
 * kontrol fiziksel bir sorumluluktur, kayıt açma yetkisi değil. İzin vermek,
 * depocunun kendi başına numune kaydı AÇMASI demek olurdu.
 *
 * ⚠️ GERÇEK SINIR VERİTABANINDA: `izin_witness_sample` tetiği
 * `app.izin_gerek_coklu('quality.record.manage', 'production.write')`.
 * Buradaki liste onun ekrandaki yüzü — ikisinin aynı kaldığını
 * `src/quality/numune-kapisi.arch.test.ts` ÖLÇÜYOR.
 */
export const NUMUNE_IZINLERI = ['quality.record.manage', 'production.write'] as const

/**
 * MAL KABUL — EKRAN, VERİTABANININ ZATEN VERDİĞİ KARARA UYUYOR (05.11.2026).
 *
 * ── NE BOZUKTU ───────────────────────────────────────────────────────────
 * `PurchaseFlow` ekranının BÜTÜN yazma yüzeyi — "Yeni Talep", "Yeni
 * Sipariş", durum geçişleri ve **"Mal Kabul Yap"** — tek bir izne
 * bağlıydı: `purchase.write`. Oysa göç **0088** mal kabulü başka türlü
 * karara bağlamıştı:
 *
 *     'goods_receipt',         '["purchase.write","stock.write"]'
 *     'goods_receipt_line',    '["purchase.write","stock.write"]'
 *     'supplier_return',       '["purchase.write","stock.write"]'
 *     'supplier_return_line',  '["purchase.write","stock.write"]'
 *
 * (İade de aynı kuralda: mal zaten depoya girmişti, geri çıkışı da depo
 * yazıyor. Dördü tek karardır, ekran da dördünü tek kapıya bağlıyor.)
 *
 * Yani VERİTABANI "depocu da mal kabul edebilir" diyordu, EKRAN hayır
 * diyordu. Gerekçesi 0085/0086'da yazılı ve hâlâ geçerli: *belgeyi satın
 * almacı açar, malı depocu alır.* Bir akışın izni tek tabloya bakılarak
 * belirlenemez (tuzak 88).
 *
 * ⚠️ KURBAN **DEPO SORUMLUSU** ve bu, ürünün kendi kararıyla çelişiyordu.
 * Göç **0080** (30.10) müşteriye gösterilen rol açıklamalarını düzeltirken
 * şunu yazmıştı: *"MAL KABUL DEPO SORUMLUSUNUN İŞİDİR. O rolde
 * `purchase.read` zaten var ve mal kabulü o yapıyor."* Ama depo
 * sorumlusunda `purchase.write` **YOK** (izinleri: stok, lojistik, üretim
 * okuma, kalite okuma, `purchase.read`). Yani:
 *   · 0080 diyor ki mal kabulü depo sorumlusu yapar,
 *   · 0088 diyor ki veritabanı `stock.write` ile buna izin verir,
 *   · ekran diyor ki `purchase.write` yoksa düğme yok.
 * Üç yerden ikisi aynı şeyi söylüyordu; ekran tek başına ayrı düşmüştü ve
 * rolün ASIL İŞİNİ yaptırmıyordu.
 *
 * ⚠️ Bu kapı **yeni bir yetki vermiyor**: `stock.write` zaten vardı ve
 * veritabanı zaten kabul ediyordu. Değişen tek şey, ekranın aynı cevabı
 * vermesi.
 *
 * ── NE DEĞİŞMEDİ ─────────────────────────────────────────────────────────
 * Talep açma, sipariş açma ve sipariş durumunu ilerletme hâlâ YALNIZ
 * `purchase.write`. Mal kabul etmek ile tedarikçiye sipariş geçmek ayrı
 * iki yetkidir; bu ayrım bilerek korunuyor.
 *
 * ⚠️ GERÇEK SINIR VERİTABANINDA. Buradaki liste onun ekrandaki yüzü;
 * ikisinin aynı kaldığını `src/purchasing/mal-kabul-kapisi.arch.test.ts`
 * ÖLÇÜYOR (`numune-kapisi.arch.test.ts` ile aynı kalıp).
 */
export const MAL_KABUL_IZINLERI = ['purchase.write', 'stock.write'] as const

/** Listedeki izinlerden EN AZ BİRİ yeterli. */
export const herhangiBiriyleYazabilir = (
  user: User | null | undefined,
  izinler: readonly string[],
): boolean => izinler.some(izin => yazabilirMi(user, izin))

export const numuneYazabilirMi = (user: User | null | undefined): boolean =>
  NUMUNE_IZINLERI.some(izin => yazabilirMi(user, izin))

export const NUMUNE_YETKISI_YOK =
  'Şahit numune kaydı kalite ya da üretim sorumluluğundadır. Numuneleri '
  + 'görüntüleyebilirsiniz; kayıt açmak, açılış ve imha yazmak için kalite '
  + 'sorumlusu, gıda mühendisi ya da üretim sorumlusu yetkisi gerekiyor.'

/**
 * ŞAHİT NUMUNE İMHASI BİR ONAY İŞİDİR (göç 0097).
 *
 * Emrah'ın kararı (26.10.2026): *"Müdür onaylar ama müdür yoksa gıda
 * mühendisi veya kalitecide onaylayabilir."*
 *
 * Üçünün ortak izni `quality.record.manage` — HACCP'te ölçüm İPTALİ için
 * 0081'de açılan izin. Oradaki ayrımın aynısı: numune almak ve açmak bir
 * İŞ, imha etmek bir KARAR.
 *
 * ⚠️ `uretim_sorumlusu` bu izni TAŞIMIYOR ve kararın amacı tam bu: numuneyi
 * alan kişi, kendi aldığı numuneyi kendi başına yok edemiyor. Şahit numune
 * bir tartışmada işletmenin tek kanıtı.
 *
 * ⚠️ "MÜDÜR YOKSA" KOŞULU KODA YAZILMADI. Sistem müdürün o gün işte olup
 * olmadığını bilemez; bilmediği bir şeyi kural gibi yazmak "mış gibi"
 * yapmak olurdu. Üçü de onaylayabiliyor, sıralama ekranda yazılı.
 *
 * ⚠️ GERÇEK SINIR VERİTABANINDA: `app.numune_olayi_izni()` (0097).
 */
export const numuneImhaOnaylayabilirMi = (user: User | null | undefined): boolean =>
  yazabilirMi(user, KALITE_KAYIT_DUZELTME)

export const NUMUNE_IMHA_YETKISI_YOK =
  'Şahit numune imhası bir onay işidir. İşletme müdürü onaylar; müdür yoksa '
  + 'gıda mühendisi ya da kalite sorumlusu onaylayabilir. Numuneyi alabilir '
  + 've müşteri önünde açabilirsiniz — imhayı onlar yazar.'
