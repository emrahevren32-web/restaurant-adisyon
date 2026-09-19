// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Zil ikonundaki başvuru bildirimleri
//
// ── NEDEN VAR ─────────────────────────────────────────────────────────────
// Zil, bugüne kadar `localStorage` okuyordu. Başvuru formu artık Postgres'e
// yazıyor, dolayısıyla zil HİÇBİR ŞEY görmüyordu. Emrah dört kez "bildirim
// gelmiyor" dedi; haklıydı. Üstelik zilde iki adet UYDURMA bildirim
// duruyordu ("Placeholder: destek talebi servisi bağlandığında...") — kural
// açıktı: görmemesi gereken hiçbir şey ekranda olmaz.
//
// ── TASARIM: BİLDİRİM SAKLANMAZ, TÜRETİLİR ───────────────────────────────
// Bildirimleri bir tabloya yazmıyoruz. Sebebi: yazsaydık iki gerçek olurdu
// — başvurunun durumu ve bildirimin durumu — ve bunlar kaçınılmaz olarak
// ayrışırdı (0036'nın dersi). Bildirim, başvuru defterinin O ANKİ hâlinden
// hesaplanıyor. Defter neyse zil odur.
//
// Saklanan TEK şey, Emrah'ın neyi okuduğu. O gerçekten kişisel ekran
// durumu, veri değil; `localStorage`da durması doğru yer.
//
// ── KİMLİK NEDEN DURUMU İÇERİYOR ─────────────────────────────────────────
// Bildirim kimliği `basvuru_<id>_<durum>`. Başvuru PENDING'den IN_REVIEW'a
// geçtiğinde kimlik değişir, yani YENİ ve OKUNMAMIŞ bir bildirim olur.
// Kimlik yalnız başvuru kimliği olsaydı, bir kez okunan başvuru bir daha
// asla haber vermezdi — oysa durum değişikliği tam da haber verilecek şey.
// ═══════════════════════════════════════════════════════════════════════════

import type { Basvuru, BasvuruDefteri } from '../onboarding/application.repository'
import { beklemeGunu, vergiBilgisiEksik } from '../onboarding/application.service'
import type { Evren360Notification } from './evren360-notification.service'

/** Zilde en fazla bu kadar satır. Daha fazlası panel değil, liste ekranıdır. */
export const BILDIRIM_SINIRI = 30

/** Bu kadar gün bekleyen açık başvuru artık "bilgi" değil, "uyarı". */
export const GECIKME_ESIGI_GUN = 3

const tekSatir = (metin: string) => metin.replace(/\s+/g, ' ').trim()

/**
 * Başvuru defterini zil satırlarına çevirir.
 *
 * Saf fonksiyon: ağ yok, saat okuma yok (`beklemeGunu` hariç), yan etki yok.
 * Kuralların tamamı burada olduğu için testte birebir sınanabiliyor.
 *
 * @param basvurular Defterdeki başvurular (hepsi; süzme burada yapılıyor).
 * @param okunanlar  Bildirim kimliği → okunma zamanı.
 */
export const basvurulariBildirimeCevir = (
  basvurular: Basvuru[],
  okunanlar: Record<string, string> = {},
): Evren360Notification[] => {
  const satirlar: Evren360Notification[] = []

  for(const b of basvurular){
    const kimlik = `basvuru_${b.id}_${b.durum}`
    const okundu = okunanlar[kimlik] ?? ''

    if(b.durum === 'PENDING' || b.durum === 'IN_REVIEW'){
      const gun = beklemeGunu(b)
      const gecikti = gun >= GECIKME_ESIGI_GUN
      const eksikNot = vergiBilgisiEksik(b) ? ' Vergi bilgisi alınmamış.' : ''
      const bekleme = gun === 0 ? 'bugün geldi' : `${gun} gündür bekliyor`

      satirlar.push({
        id: kimlik,
        type: 'business_application',
        title: b.durum === 'PENDING' ? 'Yeni işletme başvurusu' : 'İncelemedeki başvuru',
        description: tekSatir(
          `${b.firmaAdi} · ${b.yetkiliAdi} · ${b.il}/${b.ilce} — ${bekleme}.${eksikNot}`,
        ),
        targetId: b.id,
        targetLabel: `${b.referans} · ${b.firmaAdi}`,
        severity: gecikti ? 'warning' : 'info',
        createdAt: b.olusturmaZamani,
        readAt: okundu,
      })
      continue
    }

    // ── Onaylanmış ama giriş hesabı açılmamış ──────────────────────────────
    // Bu, müşterinin GİREMEDİĞİ bir işletme demek. Sessiz kalırsa kimse fark
    // etmez; en pahalı hata türü bu. O yüzden ayrı bir bildirim.
    if(b.durum === 'APPROVED' && !b.davetZamani){
      satirlar.push({
        id: `${kimlik}_hesapsiz`,
        type: 'business_application',
        title: 'Giriş hesabı açılmadı',
        description: tekSatir(
          `${b.firmaAdi} onaylandı ama giriş hesabı yok. Müşteri şu an giriş yapamaz.`,
        ),
        targetId: b.id,
        targetLabel: `${b.referans} · ${b.firmaAdi}`,
        severity: 'warning',
        createdAt: b.kararZamani || b.guncellemeZamani,
        readAt: okunanlar[`${kimlik}_hesapsiz`] ?? '',
      })
    }
  }

  return satirlar
    .sort((a, c) => c.createdAt.localeCompare(a.createdAt))
    .slice(0, BILDIRIM_SINIRI)
}

/**
 * Defteri okur ve zil satırlarını döndürür.
 *
 * Okuma başarısız olursa BOŞ DİZİ döner ve hata yukarı fırlatılmaz: zil,
 * uygulamanın çerçevesinde duruyor. Orada patlayan bir hata bütün ekranı
 * götürürdü — bildirim gösterememek, ekranı kaybetmekten iyidir.
 * Sessiz de kalmıyoruz: konsola yazıyoruz.
 */
export const basvuruBildirimleriniYukle = async (
  defter: BasvuruDefteri,
  okunanlar: Record<string, string> = {},
): Promise<Evren360Notification[]> => {
  try {
    const basvurular = await defter.liste()
    return basvurulariBildirimeCevir(basvurular, okunanlar)
  } catch(e){
    console.error('[MİYOP] Başvuru bildirimleri okunamadı:', e)
    return []
  }
}
