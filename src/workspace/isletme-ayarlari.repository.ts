// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · İşletme Ayarları · veritabanı erişimi · MIYOP-060b
//
// ── NEDEN YAZILDI ────────────────────────────────────────────────────────
// Ekran para birimini ve KDV oranını gösteriyordu ama ikisinin de
// veritabanında KARŞILIĞI YOKTU: değerler `localStorage`a yazılıyordu.
// Üstüne `DEFAULT_SETTINGS.vatRate = 10` duruyordu ve form bunu
// **işletmenin KDV oranı** gibi gösteriyordu. ⚠️ Kimse %10 demedi.
//
// Emrah'ın kararı (29.10.2026): *"Kiracı ayarları tablosu yap. Herkes kendi
// KDV oranını ve para birimini kendi seçsin."* → göç **0103**,
// `public.tenant_settings`.
//
// ── BELİRLENMEMİŞ, BİR DEĞERDİR ──────────────────────────────────────────
// ⚠️ `kdvOrani` `null` olabilir ve bu bir eksiklik DEĞİL, bir cevaptır:
// *"işletme henüz seçmedi"*. Ekran bunu BOŞ gösterir. Veritabanında da
// varsayılanı yoktur (0103 bunu kendi doğrulamasında ölçüyor) — buraya bir
// `?? 10` koymak, kaldırılan yalanı geri getirmek olur.
//
// ── KAPILAR · ÖLÇÜLDÜ (prova-0103, 30 ölçüm) ─────────────────────────────
//   · RLS (force) → satır kiracıya bağlı.
//   · `izin_tenant_settings` → `app.izin_gerek('settings.manage')`.
//     ⚠️ Bu izin `isletme_muduru`da YOK; provada MI403 ile ölçüldü.
//   · `denetim_tenant_settings` → kim neyi değiştirdi, yazılı.
//   · ⚠️ `updated_at`/`updated_by` SUNUCUDA yazılıyor; istemciden gelen
//     değer yok sayılıyor. Provada istemci bile bile 2020 tarihi ve
//     başkasının kimliğini gönderdi, ikisi de yok sayıldı. Bu yüzden
//     aşağıdaki yazma nesnesinde o iki alan YOKTUR — konsa bile işe
//     yaramazdı, ama orada durması "ekran zaman yazıyor" yanılsaması
//     doğururdu.
//   · Satırı EKRAN AÇMAZ: `tenant` tablosuna AFTER INSERT tetiği açar.
//     Satır yoksa burada da açılmaz — sebebi ekranda yazılır.
// ═══════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseConfigured } from '../core/supabase'
import { paraBirimiAyarla } from '../billing'

/** Ekranın sunduğu seçenekler. ⚠️ Veritabanı biçimi `^[A-Z]{3}$` (0103). */
export const PARA_BIRIMLERI = [
  { kod: 'TRY', ad: 'Türk Lirası (TRY)' },
  { kod: 'USD', ad: 'Dolar (USD)' },
  { kod: 'EUR', ad: 'Euro (EUR)' },
  { kod: 'GBP', ad: 'Sterlin (GBP)' },
] as const

export type IsletmeAyarlari = {
  id: string
  paraBirimi: string
  /** ⚠️ `null` = işletme HENÜZ SEÇMEDİ. Varsayılanı yok. */
  kdvOrani: number | null
  guncellendi: string | null
}

/** Ekrandan gelen ham değerler. KDV metin: boş bırakmak geçerli bir cevap. */
export type IsletmeAyarlariYazimi = {
  paraBirimi: string
  kdvOrani: string
}

export type AyarSonucu =
  | { durum: 'oldu'; ayarlar: IsletmeAyarlari }
  | { durum: 'hata'; mesaj: string }

const YAPILANDIRILMADI = 'Veritabanı bağlantısı yapılandırılmamış.'

const SUTUNLAR = 'id, currency_code, vat_rate, updated_at'

type AyarSatiri = Record<string, unknown>

const ayaraCevir = (satir: AyarSatiri): IsletmeAyarlari => {
  const ham = satir.vat_rate
  // ⚠️ Postgres `numeric` değerini supabase-js METİN olarak döndürebiliyor.
  // `Number(null)` 0 verir; o yüzden önce null ayıklanıyor — yoksa
  // "belirlenmemiş" KDV ekranda **%0** diye görünürdü ve bu, kaldırdığımız
  // yalanın aynısı olurdu (sadece 10 yerine 0).
  const kdv = ham === null || ham === undefined || ham === '' ? null : Number(ham)
  return {
    id: String(satir.id ?? ''),
    paraBirimi: typeof satir.currency_code === 'string' ? satir.currency_code : 'TRY',
    kdvOrani: kdv === null || Number.isNaN(kdv) ? null : kdv,
    guncellendi: typeof satir.updated_at === 'string' ? satir.updated_at : null,
  }
}

/**
 * ⚠️ Kiracı süzmesi sorguya ELLE eklenmiyor — RLS yapar (ADR-004).
 * ⚠️ Satır yoksa `null` döner ve EKRAN AÇMAZ: satırı veritabanı açar
 * (0103'ün `trg_kiraci_ayarlari` tetiği).
 */
export const isletmeAyarlariniOku = async (): Promise<IsletmeAyarlari | null> => {
  if(!isSupabaseConfigured()) return null

  const { data, error } = await getSupabase().from('tenant_settings').select(SUTUNLAR)
  if(error || !data){
    if(error) console.warn('[MİYOP] İşletme ayarları okunamadı:', error.message)
    return null
  }

  const satirlar = data as unknown as AyarSatiri[]
  // ⚠️ Birden çok satır varsa TAHMİN EDİLMEZ. 0103 `tenant_id`yi tekil
  // yaptığı için bu hâl olmamalı; olduysa bir şey bozuktur ve ekranın
  // rastgele birini seçmesi onu gizler.
  if(satirlar.length !== 1) return null

  const ayarlar = ayaraCevir(satirlar[0])

  // ⚠️ TEK YERDEN BESLEME · 01.11.2026 · HEDEFLER 3.4.6.
  // `billing.ts` içindeki `formatCurrency` eşzamanlı çalışıyor ve
  // veritabanını okuyamaz; değeri DIŞARIDAN almak zorunda. Besleme burada
  // yapılıyor çünkü burası para biriminin veritabanından okunduğu TEK yer:
  // hem girişteki okuma hem de kaydetme sonrası geri okuma buradan geçiyor.
  // Böylece "kaydettim ama ekranda eski para birimi duruyor" hâli oluşmuyor.
  paraBirimiAyarla(ayarlar.paraBirimi)

  return ayarlar
}

/** KDV girdisinin denetimi. Boş SERBEST: "seçmedim" geçerli bir cevap. */
export const kdvOraniniDenetle = (ham: string): string | null => {
  const temiz = (ham || '').trim().replace(',', '.')
  if(!temiz) return null
  const sayi = Number(temiz)
  if(!Number.isFinite(sayi)) return 'KDV oranı bir sayı olmalı.'
  if(sayi < 0 || sayi > 100) return 'KDV oranı %0 ile %100 arasında olmalı.'
  return null
}

export const isletmeAyarlariniYaz = async (
  kimlik: string,
  degerler: IsletmeAyarlariYazimi,
): Promise<AyarSonucu> => {
  if(!isSupabaseConfigured()) return { durum: 'hata', mesaj: YAPILANDIRILMADI }
  if(!kimlik) return { durum: 'hata', mesaj: 'Ayar kaydı bulunamadı.' }

  const paraBirimi = (degerler.paraBirimi || '').trim().toUpperCase()
  if(!PARA_BIRIMLERI.some(p => p.kod === paraBirimi)){
    return { durum: 'hata', mesaj: 'Geçersiz para birimi.' }
  }

  const kdvHatasi = kdvOraniniDenetle(degerler.kdvOrani)
  if(kdvHatasi) return { durum: 'hata', mesaj: kdvHatasi }

  const temizKdv = (degerler.kdvOrani || '').trim().replace(',', '.')

  const { error } = await getSupabase()
    .from('tenant_settings')
    .update({
      currency_code: paraBirimi,
      // ⚠️ Boş girdi `null` yazılıyor: işletme oranı GERİ ALABİLMELİ.
      // "Seçmedim" durumuna dönmek de bir karardır.
      vat_rate: temizKdv ? Number(temizKdv) : null,
      // ⚠️ `updated_at`/`updated_by` BİLEREK YOK — sunucu yazıyor (0103).
    })
    .eq('id', kimlik)

  if(error){
    console.warn('[MİYOP] İşletme ayarları kaydedilemedi:', error.message)
    // ⚠️ Ham veritabanı metni kullanıcıya GÖSTERİLMEZ (0030'un kuralı).
    return {
      durum: 'hata',
      mesaj: error.code === '42501' || error.code === 'MI403'
        ? 'İşletme ayarlarını değiştirme yetkiniz yok. Bu yetki işletme sahibindedir.'
        : 'Ayarlar kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin.',
    }
  }

  // ⚠️ Geri okunuyor: ekranda görünen şey, kaydedilmiş olan şey.
  const ayarlar = await isletmeAyarlariniOku()
  if(!ayarlar){
    return {
      durum: 'hata',
      mesaj: 'Kayıt gönderildi ama güncel ayarlar okunamadı. Sayfayı yenileyin.',
    }
  }

  return { durum: 'oldu', ayarlar }
}
