// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Karşılama ekranı · ölçüm · MIYOP-065
//
// ── NEDEN YAZILDI ────────────────────────────────────────────────────────
// Karşılama ekranı **"İlk stok kartı tamamlandı"** rozetini
// `hasBusinessModules` ile ölçüyordu — yani bir MODÜL kaydının varlığıyla.
// Bir modülün kurulu olması, stok kartı açıldığını kanıtlamaz. Yeni müşteri
// hiçbir şey yapmadan "tamamlandı" görüyordu. Bu bir *mış gibi*.
//
// ⚠️ Rozet ya GERÇEK sorgudan ölçülür ya da hiç konmaz. Buradaki iş birinci
// seçenek: üç adımın üçü de veritabanından sayılıyor.
//
// ── "ÖLÇÜLEMEDİ" BİR CEVAPTIR ────────────────────────────────────────────
// ⚠️ Sorgu düşerse `null` dönüyor — `0` DEĞİL. Sıfır "hiç yok" demek,
// `null` "sayamadım" demek. İkisini birleştirmek, bir okuma arızasını
// "işiniz bitmemiş" diye göstermek olurdu (kontrol listesi 45: bir
// kontrolün üç sonucu vardır — geçti, kaldı, ÖLÇEMEDİM).
//
// ⚠️ Her sayım AYRI çağrı: biri düşerse ötekiler yine görünsün. Hepsini tek
// bir hata dalında birleştirmek, bir satırın arızasını bütün ekrana yaymak
// olurdu.
//
// ⚠️ Kiracı süzmesi sorguya ELLE eklenmiyor — RLS yapar (ADR-004).
// ═══════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseConfigured } from '../core/supabase'

export type KarsilamaDurumu = {
  firmaAdi: string | null
  /** Vergi numarası girilmiş mi? `null` = ölçülemedi. */
  vergiNumarasiVar: boolean | null
  /** Açılmış ürün/hammadde kartı sayısı. `null` = ölçülemedi. */
  urunKartiSayisi: number | null
  /** İşletmedeki kullanıcı sayısı. `null` = ölçülemedi. */
  kullaniciSayisi: number | null
}

const BILINMIYOR: KarsilamaDurumu = {
  firmaAdi: null,
  vergiNumarasiVar: null,
  urunKartiSayisi: null,
  kullaniciSayisi: null,
}

/** Satır saymanın en ucuz yolu: veri getirmeden yalnız sayıyı iste. */
const say = async (tablo: string): Promise<number | null> => {
  try{
    const { count, error } = await getSupabase()
      .from(tablo)
      .select('id', { count: 'exact', head: true })
    if(error || count === null || count === undefined){
      if(error) console.warn(`[MİYOP] ${tablo} sayılamadı:`, error.message)
      return null
    }
    return count
  } catch {
    return null
  }
}

export const karsilamaDurumunuOku = async (): Promise<KarsilamaDurumu> => {
  if(!isSupabaseConfigured()) return BILINMIYOR

  let firmaAdi: string | null = null
  let vergiNumarasiVar: boolean | null = null
  try{
    const { data, error } = await getSupabase()
      .from('company')
      .select('company_name, tax_number')
    if(!error && data && data.length === 1){
      const satir = data[0] as { company_name?: string | null; tax_number?: string | null }
      firmaAdi = (satir.company_name ?? '').trim() || null
      vergiNumarasiVar = Boolean((satir.tax_number ?? '').trim())
    }
    // ⚠️ Birden fazla satırda TAHMİN EDİLMİYOR: `null` kalır, ekran "—" der.
  } catch {
    // Bkz. dosya başı: "ölçülemedi" bir cevaptır.
  }

  return {
    firmaAdi,
    vergiNumarasiVar,
    urunKartiSayisi: await say('stock_item'),
    kullaniciSayisi: await say('app_user'),
  }
}
