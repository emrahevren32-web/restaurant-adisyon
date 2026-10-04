// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Çekirdek modül görünürlüğü — TEK KAYNAK
//
// ── NEDEN AYRI DOSYA ─────────────────────────────────────────────────────
// Bu kural `App.tsx` içinde gömülüydü ve menüyü sınayan test onu HİÇ
// çağırmıyordu: test `createBusinessWorkspaceNavGroups()`'u seçeneksiz
// çağırıyor, seçenek yoksa bütün çekirdek modüller görünür sayılıyordu.
//
// Sonuç: "Ayarlar menüde mi" testi YEŞİL, ekranda YOK.
//
// Menü görünürlüğünü belirleyen İKİ ayrı kapı var ve ikisi de sessiz:
//   1. `CORE_WORKSPACE_MODULE_CODES` — sabit beyaz liste
//   2. `isCoreModuleVisible`         — bu dosyadaki kural
// Bir modül ikisinden de geçmezse menüde HİÇ üretilmez.
//
// Kural artık burada; `App.tsx` da test de aynı işlevi çağırıyor. Testin
// yeşil olup ekranın boş kalması bir daha mümkün değil.
// ═══════════════════════════════════════════════════════════════════════════

import { WORKSPACE_MODULE_CODES } from '../modules/module-code.registry'

export type CekirdekGorunurlukBaglami = {
  /** İşletme kurulumu tamamlandı mı (karşılama sihirbazı bitti mi). */
  kurulumTamam: boolean
  /** Kullanıcının bağlı en az bir entegrasyonu var mı. */
  entegrasyonVar: boolean
}

/**
 * Bir çekirdek modül WORKSPACE bölümünde görünmeli mi.
 *
 * Varsayılan HAYIR: çekirdek modüllerin çoğu ürünün iç yapısıdır ve
 * müşteriye gösterilmez. Görünecek olanlar tek tek sayılır.
 */
export const cekirdekModulGorunur = (
  kod: string, baglam: CekirdekGorunurlukBaglami,
): boolean => {
  // Karşılama YALNIZCA kurulum bitmemişken. Bittikten sonra gösterilmesi,
  // biten bir işi hep açık bırakmak olurdu.
  if(kod === WORKSPACE_MODULE_CODES.WORKSPACE_WELCOME) return !baglam.kurulumTamam

  // Modül Mağazası her zaman: müşteri neyi açabileceğini görebilmeli.
  if(kod === WORKSPACE_MODULE_CODES.MARKETPLACE) return true

  // Entegrasyon merkezi ancak bağlı bir entegrasyon varsa. Boş bir merkez,
  // doldurulacak bir kutu sanılıyor.
  if(kod === WORKSPACE_MODULE_CODES.INTEGRATION_CENTER){
    return baglam.kurulumTamam && baglam.entegrasyonVar
  }

  // ⚠️ 2026-09-13: Ayarlar buraya eklendi. Müşterinin yapılandırma
  // yapabileceği tek yerdi ve menüde HİÇ görünmüyordu — beyaz listeden
  // geçirilmesi yetmedi, bu kapıdan da geçmesi gerekiyormuş. Veri Yedeği
  // ekranı bu modülün altında duruyor.
  if(kod === WORKSPACE_MODULE_CODES.SETTINGS) return baglam.kurulumTamam

  // ⚠️ 2026-10-03: Kullanıcılar buraya eklendi. Ekran kodda vardı ama bu
  // beyaz listeden geçmediği için menüde HİÇ üretilmiyordu — Ayarlar'ın
  // 2026-09-13'te başına gelenin aynısı. Emrah'ın sorusu ("personel
  // oluştururken yetkilerini belirleyebileceğimiz ekran olmalı") yüzünden
  // bulundu; ekran yazılmış ama kapı kapalıydı.
  //
  // ROLLER modülü bilerek AÇILMADI: aynı rotaya çıkıyor ve menüde iki ayrı
  // satır gösterip tek ekrana götürmek, kullanıcıya olmayan bir ikinci
  // ekran vaat etmek olurdu.
  //
  // Kurulum bitmeden gösterilmiyor: daha kullanıcısı olmayan bir işletmeye
  // kullanıcı yönetimi göstermek, doldurulacak boş bir kutu gibi duruyor.
  if(kod === WORKSPACE_MODULE_CODES.USERS) return baglam.kurulumTamam

  return kod === WORKSPACE_MODULE_CODES.DASHBOARD
    || kod === WORKSPACE_MODULE_CODES.WORKSPACE
}
