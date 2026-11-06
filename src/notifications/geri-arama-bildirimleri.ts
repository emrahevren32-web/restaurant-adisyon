// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Zildeki geri arama bildirimleri
//
// ── NEDEN VAR ─────────────────────────────────────────────────────────────
// Emrah 06.11'de ana ekrandaki formu doldurdu, `GER-5XPUW` numarasını aldı,
// talep panelde göründü — **ama zil çalmadı.** Bu bir hata değildi; 0106
// baştan beri *"yeni talep gelince bildirim yok"* diye yazılı bir eksikti
// (HEDEFLER 4.11.1). Emrah: *"bildirim zili kurulsun şimdi, sonradan
// uğraşmayalım."*
//
// ⚠️ Bu eksik neden pahalı: geri arama talebi, bir müşteri adayının
// **telefonunu bırakıp beklediği** andır. Başvuru bir gün bekleyebilir —
// o kişi zaten karar vermiştir. Bilgi isteyen kişi bekleyemez; cevapsız
// kalırsa başka yere bakar ve bir daha gelmez. Panelde görünüp zilde
// görünmemesi, Emrah ekranı açmadıkça talebin **hiç duyulmaması** demekti.
//
// ── TASARIM: BİLDİRİM SAKLANMAZ, TÜRETİLİR ───────────────────────────────
// `basvuru-bildirimleri.ts` ile birebir aynı desen ve aynı gerekçe:
// bildirimi bir tabloya yazsaydık iki gerçek olurdu — talebin durumu ve
// bildirimin durumu — ve bunlar kaçınılmaz olarak ayrışırdı. Bildirim,
// talep listesinin O ANKİ hâlinden hesaplanıyor. Liste neyse zil odur.
//
// Saklanan TEK şey, Emrah'ın neyi okuduğu (`localStorage`). O kişisel ekran
// durumudur, veri değil.
//
// ── KİMLİK NEDEN DURUMU İÇERİYOR ─────────────────────────────────────────
// `geri_arama_<referans>_<durum>`. Talep BEKLİYOR'dan ARANDI'ya geçtiğinde
// kimlik değişir. Kimlik yalnız numara olsaydı, bir kez okunan talep bir
// daha haber vermezdi — oysa burada haber verilecek şey zaten durumdur.
// ═══════════════════════════════════════════════════════════════════════════

import {
  telefonuGoster,
  UYGUN_SAAT_ETIKETLERI,
  type UygunSaat,
} from '../onboarding/geri-arama.service'
import type { GeriAramaDefteri, GeriAramaSatiri } from '../onboarding/geri-arama.repository'
import type { Evren360Notification } from './evren360-notification.service'

/** Zilde en fazla bu kadar geri arama satırı. */
export const GERI_ARAMA_BILDIRIM_SINIRI = 30

/**
 * Bu kadar saat bekleyen talep artık "bilgi" değil, "uyarı".
 *
 * ⚠️ BAŞVURUDAKİ EŞİK 3 GÜN, BURASI 4 SAAT — ve bu fark bilinçli.
 * Başvuru yapan kişi kararını vermiştir, bir gün bekleyebilir. Bilgi
 * isteyen kişi beklemez: aynı gün dönülmeyen bir numara, çoktan başka
 * yere bakmış bir numaradır.
 *
 * ⚠️ Bu bir TAAHHÜT DEĞİL. Ekranda hiçbir yerde "4 saatte ararız"
 * yazmıyor ve yazmayacak (böyle bir sözü tutacak nöbet düzeni yok).
 * Bu eşik yalnız zilin rengini belirliyor: Emrah'a "bu beklemeye başladı"
 * demek için.
 */
export const GERI_ARAMA_UYARI_ESIGI_SAAT = 4

const tekSatir = (metin: string) => metin.replace(/\s+/g, ' ').trim()

/** Talep geleli kaç saat oldu. Okunamayan tarih 0 sayılır (uyarı üretmez). */
export const beklemeSaati = (olusturma: string, simdi: Date = new Date()): number => {
  const t = new Date(olusturma).getTime()
  if(Number.isNaN(t)) return 0
  const fark = simdi.getTime() - t
  return fark <= 0 ? 0 : Math.floor(fark / 3_600_000)
}

/** "şimdi geldi" · "3 saat önce" · "2 gün önce" */
const beklemeMetni = (saat: number): string => {
  if(saat < 1) return 'şimdi geldi'
  if(saat < 24) return `${saat} saattir bekliyor`
  const gun = Math.floor(saat / 24)
  return `${gun} gündür bekliyor`
}

/**
 * Geri arama taleplerini zil satırlarına çevirir.
 *
 * Saf fonksiyon: ağ yok, yan etki yok, saat DIŞARIDAN veriliyor.
 * ⚠️ Saati parametre yapmak bilinçli: içeride `new Date()` çağırsaydık
 * "4 saat sonra uyarıya döner" kuralı ancak gerçek zamanı bekleyerek
 * sınanabilirdi — yani hiç sınanmazdı.
 *
 * @param satirlar Panelin gördüğü talep listesi (hepsi; süzme burada).
 * @param okunanlar Bildirim kimliği → okunma zamanı.
 * @param simdi Şimdiki zaman (testte sabitlenir).
 */
export const geriAramaTalepleriniBildirimeCevir = (
  satirlar: GeriAramaSatiri[],
  okunanlar: Record<string, string> = {},
  simdi: Date = new Date(),
): Evren360Notification[] => {
  const bildirimler: Evren360Notification[] = []

  for(const satir of satirlar){
    // ⚠️ YALNIZ BEKLEYEN TALEP ZİLE DÜŞER.
    // Arandı ya da kapandı olanlar bir iş değil, bir kayıttır. Zil
    // "yapılacak iş" listesidir; yapılmış işi orada tutmak, zili
    // okunmaz hâle getirir ve asıl bekleyeni gizler.
    if(satir.durum !== 'NEW') continue

    const kimlik = `geri_arama_${satir.referans}_${satir.durum}`
    const saat = beklemeSaati(satir.olusturma, simdi)
    const gecikti = saat >= GERI_ARAMA_UYARI_ESIGI_SAAT

    // Uygun arama saati, Emrah'ın ZİLDEN okuması gereken bilgi: "şimdi mi
    // arayayım, akşam mı" sorusunun cevabı. Ekranı açmadan görebilmeli.
    const saatEtiketi = UYGUN_SAAT_ETIKETLERI[satir.uygunSaat as UygunSaat]
    const saatNotu = saatEtiketi && satir.uygunSaat !== 'FARKETMEZ'
      ? ` Uygun saat: ${saatEtiketi}.`
      : ''
    const konuNotu = satir.konu ? ` Sorduğu: ${satir.konu}` : ''

    bildirimler.push({
      id: kimlik,
      type: 'callback_request',
      title: 'Geri arama talebi',
      description: tekSatir(
        `${satir.adSoyad} · ${satir.isletmeAdi} · ${telefonuGoster(satir.telefon)}`
        + ` — ${beklemeMetni(saat)}.${saatNotu}${konuNotu}`,
      ),
      // ⚠️ `targetId` NUMARA (GER-XXXXX), kayıt kimliği değil. Ekran
      // numarayla arıyor; iç kimlik (uuid) hiçbir yerde gösterilmiyor ve
      // tıklanan satırı bulmaya yaramaz.
      targetId: satir.referans,
      targetLabel: `${satir.referans} · ${satir.isletmeAdi}`,
      severity: gecikti ? 'warning' : 'info',
      createdAt: satir.olusturma,
      readAt: okunanlar[kimlik] ?? '',
    })
  }

  return bildirimler
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, GERI_ARAMA_BILDIRIM_SINIRI)
}

/**
 * Defteri okur ve zil satırlarını döndürür.
 *
 * Okuma düşerse BOŞ DİZİ döner, hata yukarı fırlatılmaz: zil uygulamanın
 * çerçevesinde duruyor; orada patlayan bir hata bütün ekranı götürürdü.
 * Bildirim gösterememek, ekranı kaybetmekten iyidir. Sessiz de kalmıyoruz:
 * konsola yazılıyor.
 */
export const geriAramaBildirimleriniYukle = async (
  defter: GeriAramaDefteri,
  okunanlar: Record<string, string> = {},
  simdi: Date = new Date(),
): Promise<Evren360Notification[]> => {
  try {
    const satirlar = await defter.listele()
    return geriAramaTalepleriniBildirimeCevir(satirlar, okunanlar, simdi)
  } catch(e){
    console.error('[MİYOP] Geri arama bildirimleri okunamadı:', e)
    return []
  }
}
