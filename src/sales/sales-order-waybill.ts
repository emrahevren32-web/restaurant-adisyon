// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4C2 — İRSALİYEYİ SİPARİŞE BAĞLAMA
//
// Yol haritası maddesi: *"İrsaliye yazdırmayı siparişe bağlama."*
//
// ── NEYİN EKSİK OLDUĞU ─────────────────────────────────────────────────────
// `irsaliyeHtml` (Aşama 3) yazılıydı ve Sevkiyatlar ekranından BASILIYORDU.
// Eksik olan yol şuydu: bir siparişi açan kişi, o siparişin irsaliyesine
// ulaşmak için ekrandan çıkıp Sevkiyatlar listesinde doğru belgeyi ARAMAK
// zorundaydı. Bir siparişin üç sevkiyatı olabilir; hangisinin hangi siparişe
// ait olduğu listede yazmıyordu.
//
// Bağ zaten veritabanında var: `shipment.order_id` (0051). Bu dosya o bağı
// ekranda okunur hâle getiriyor.
//
// ⚠️ BU DOSYA BELGE ÜRETMİYOR. Belgeyi `production/shipment-documents.ts`
// üretiyor ve ikinci bir kopyası YAZILMADI — aynı kâğıdın iki ayrı üreticisi
// olsaydı biri düzeltilip diğeri unutulurdu. Buradaki iş yalnızca "bu
// siparişin hangi irsaliyeleri var" sorusunu cevaplamak.
// ═══════════════════════════════════════════════════════════════════════════

import {
  SEVKIYAT_DURUM_ETIKETLERI,
  type Sevkiyat,
  type SevkiyatDurumu,
} from '../production/shipment.repository'

export type SiparisIrsaliyesi = {
  sevkiyatId: string
  sevkiyatNo: string
  durum: SevkiyatDurumu
  durumEtiketi: string
  /** Sevk tarihi; yoksa sevk zamanı; o da yoksa boş. */
  tarih?: string
  kalemSayisi: number
  /**
   * Kâğıt RESMÎ irsaliye yerine geçer mi.
   *
   * ⚠️ Yalnız SHIPPED olan geçer. Taslak belgede mal stoktan DÜŞMEMİŞTİR;
   * iptal edilmiş belgenin arkasında ise geri çevrilmiş hareketler vardır.
   * Belge ikisinde de basılabiliyor (çıktının başında uyarı var) ama ekran
   * bunu basmadan ÖNCE söylemek zorunda.
   */
  resmiMi: boolean
}

const tarihi = (s: Sevkiyat): string | undefined => s.sevkTarihi ?? s.sevkZamani

/**
 * Bir siparişin sevkiyatları — numara sırasında.
 *
 * ⚠️ İPTAL EDİLMİŞ SEVKİYAT LİSTEDEN DÜŞMÜYOR. Kesilip sonra iptal edilen
 * bir belge müşterinin elinde kalmış olabilir; gizlemek "böyle bir kâğıt hiç
 * olmadı" demektir. Durumu yazılıyor, resmî sayılmıyor, ama duruyor.
 *
 * ⚠️ Süzme `siparisId`ye birebir eşitlikle. Siparişsiz sevkiyat (numune,
 * ikram, iç transfer) ve BAŞKA siparişin sevkiyatı buraya giremez.
 */
export const siparisIrsaliyeleri = (
  siparisId: string,
  sevkiyatlar: readonly Sevkiyat[],
): SiparisIrsaliyesi[] => (
  sevkiyatlar
    .filter(s => Boolean(siparisId) && s.siparisId === siparisId)
    .map(s => ({
      sevkiyatId: s.id,
      sevkiyatNo: s.sevkiyatNo,
      durum: s.durum,
      durumEtiketi: SEVKIYAT_DURUM_ETIKETLERI[s.durum],
      tarih: tarihi(s),
      kalemSayisi: s.satirlar.length,
      resmiMi: s.durum === 'SHIPPED',
    }))
    .sort((a, b) => a.sevkiyatNo.localeCompare(b.sevkiyatNo, 'tr', { numeric: true }))
)

/**
 * Listenin tek cümlelik özeti.
 *
 * ⚠️ "Hiç irsaliye yok" bir HATA DEĞİL: sipariş daha sevk aşamasına
 * gelmemiş olabilir. Cümle bunu suçlayıcı olmayan bir dille söylüyor,
 * çünkü ekranı okuyan kişi çoğu zaman bir eksik aramıyor.
 */
export const irsaliyeOzeti = (liste: readonly SiparisIrsaliyesi[]): string => {
  if(liste.length === 0){
    return 'Bu siparişten henüz sevkiyat çıkmamış; irsaliye de yok.'
  }

  const resmi = liste.filter(i => i.resmiMi).length
  const taslak = liste.filter(i => i.durum === 'DRAFT').length
  const iptal = liste.filter(i => i.durum === 'CANCELLED').length

  const parcalar: string[] = []
  if(resmi > 0) parcalar.push(`${resmi} sevk edildi`)
  if(taslak > 0) parcalar.push(`${taslak} taslak`)
  if(iptal > 0) parcalar.push(`${iptal} iptal`)

  return `${liste.length} sevkiyat belgesi · ${parcalar.join(' · ')}.`
}

/**
 * Yazdırma penceresinin başlığı.
 *
 * ⚠️ SİPARİŞ NUMARASI DA YAZIYOR. Üç irsaliyesi olan bir siparişte, tarayıcı
 * sekmesinde yalnız sevkiyat numarasını görmek hangi kâğıdın hangi siparişe
 * ait olduğunu söylemiyordu — bağı ekranda kurup kâğıtta koparmak olurdu.
 */
export const irsaliyeBelgeBasligi = (siparisNo: string, sevkiyatNo: string): string =>
  `İrsaliye · ${sevkiyatNo} · ${siparisNo}`

/**
 * Basmadan önce gösterilecek uyarı; resmî belgede `undefined`.
 *
 * Aynı uyarı kâğıdın başına da basılıyor (`irsaliyeHtml`). İki yerde olması
 * tekrar değil: biri basan kişiyi, diğeri kâğıdı eline alan kişiyi uyarıyor.
 */
export const irsaliyeUyarisi = (irsaliye: SiparisIrsaliyesi): string | undefined => {
  if(irsaliye.durum === 'DRAFT'){
    return 'Bu sevkiyat henüz sevk edilmedi: mal stoktan düşmedi ve çıktı '
      + 'resmî irsaliye yerine GEÇMEZ. Sevkiyatlar ekranından sevk edin.'
  }
  if(irsaliye.durum === 'CANCELLED'){
    return 'Bu sevkiyat İPTAL EDİLDİ; deftere yazılan çıkışlar geri alındı. '
      + 'Çıktı yalnızca kayıt amaçlıdır, resmî irsaliye yerine GEÇMEZ.'
  }
  return undefined
}
