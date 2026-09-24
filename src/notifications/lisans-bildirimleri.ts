// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Lisans bildirimleri — zil, platform adminine ne söyler
//
// Emrah'ın sorusu: "Bu talebi nerede göreceğim ben?" Cevap: Lisans Yönetimi
// ekranında, ama ORAYA BAKMASI GEREKTİĞİNİ zilin söylemesi lazım. Görülmeyen
// bir talep, alınmamış talep demektir.
//
// ⚠️ Zil satırları SAKLANMAZ, defterden TÜRETİLİR (başvuru bildirimleriyle
// aynı ilke). Saklanan bildirim, gerçeklikle senkron kalmadığı gün yalan
// söyler: talep karara bağlandıktan sonra da ekranda durur.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Evren360Notification } from './evren360-notification.service'
import { lisansOzetiniOku, sureTalepleriniOku,
         type LisansOzeti, type SureTalebi } from '../billing/license-platform.repository'

/** Bitişine bu kadar gün kalan lisans zile düşer. */
export const LISANS_UYARI_GUNU = 15

const tekSatir = (metin: string) => metin.replace(/\s+/g, ' ').trim()

/**
 * Saf fonksiyon: talepler ve lisans özeti → zil satırları.
 * Ağ yok, saat yok. Kalan gün zaten veritabanından geliyor.
 */
export const lisanslariBildirimeCevir = (
  talepler: SureTalebi[],
  lisanslar: LisansOzeti[],
  okunanlar: Record<string, string> = {},
): Evren360Notification[] => {
  const satirlar: Evren360Notification[] = []

  for(const t of talepler){
    if(t.durum !== 'Bekliyor') continue
    const kimlik = `lisans_talep_${t.id}`
    satirlar.push({
      id: kimlik,
      type: 'license_expiry',
      title: 'Ek süre talebi',
      description: tekSatir(
        `${t.isletme} ek süre istedi.${t.gerekce ? ` "${t.gerekce}"` : ''}`,
      ),
      targetId: t.tenantId,
      targetLabel: t.isletme,
      severity: 'warning',
      createdAt: t.istenme,
      readAt: okunanlar[kimlik] ?? '',
    })
  }

  for(const l of lisanslar){
    if(l.kalanGun > LISANS_UYARI_GUNU) continue
    // Talebi olan işletme için ikinci bir satır çıkarmıyoruz: aynı konuyu
    // iki kez söylemek, zili gürültüye çevirir.
    if(l.bekleyenTalep) continue

    const bitti = l.kalanGun < 0
    const kimlik = `lisans_sure_${l.tenantId}_${l.bitis}`
    satirlar.push({
      id: kimlik,
      type: 'license_expiry',
      title: bitti ? 'Lisans süresi doldu' : 'Lisans süresi bitiyor',
      description: tekSatir(
        bitti
          ? `${l.isletme} lisansı ${Math.abs(l.kalanGun)} gün önce bitti.`
          : `${l.isletme} lisansı ${l.kalanGun} gün sonra bitiyor.`,
      ),
      targetId: l.tenantId,
      targetLabel: `${l.kiraciKodu} · ${l.isletme}`,
      severity: 'warning',
      createdAt: l.bitis,
      readAt: okunanlar[kimlik] ?? '',
    })
  }

  return satirlar
}

/**
 * Okuma başarısız olursa BOŞ dizi döner; hata yukarı fırlatılmaz.
 * Zil uygulamanın çerçevesinde duruyor: orada patlayan hata bütün ekranı
 * götürür. Sessiz de kalmıyoruz — konsola yazıyoruz.
 */
export const lisansBildirimleriniYukle = async (
  client: SupabaseClient,
  okunanlar: Record<string, string> = {},
): Promise<Evren360Notification[]> => {
  try {
    const [talepler, lisanslar] = await Promise.all([
      sureTalepleriniOku(client),
      lisansOzetiniOku(client),
    ])
    return lisanslariBildirimeCevir(talepler, lisanslar, okunanlar)
  } catch(e){
    console.error('[MİYOP] Lisans bildirimleri okunamadı:', e)
    return []
  }
}
