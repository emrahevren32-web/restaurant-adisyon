// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Lisans yönetimi — PLATFORM tarafı (Evren360)
//
// Müşteri kendi lisansını yalnız OKUR (license.repository.ts). Platform ise
// bütün kiracıların lisansını görür, uzatır ve süre taleplerini karara bağlar.
//
// ⚠️ NEDEN RPC, NEDEN DÜZ SORGU DEĞİL
// `tenant_license` üzerinde RLS var: bir oturum yalnız kendi kiracısının
// satırını görür — platform admini dahil. Platformun hepsini görmesi için
// `security definer` fonksiyonlar kullanılıyor (0043) ve o fonksiyonların
// İLK SATIRI yetki kontrolü: `platform.manage`. Yetkiyi ekran değil
// VERİTABANI sınıyor; ekran değişse de kural değişmez.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'

export type LisansOzeti = {
  tenantId: string
  kiraciKodu: string
  isletme: string
  paket: string
  durum: string
  baslangic: string
  bitis: string
  kalanGun: number
  uzatmaSayisi: number
  toplamGun: number
  bekleyenTalep: boolean
  /** Deneme + ücretsiz uzatmalarla verilen gün. */
  ucretsizGun: number
  /** Ücretli uzatmalarla verilen gün. */
  ucretliGun: number
  ucretsizUzatma: number
  ucretliUzatma: number
}

/** Lisans defterinin bir satırı (0043/0044). */
export type LisansOlayi = {
  zaman: string
  olay: string
  eskiBitis: string
  yeniBitis: string
  gun: number
  /** null = uzatma dışı olay (açılış, talep, karar). */
  ucretli: boolean | null
  kim: string
  aciklama: string
}

export type SureTalebi = {
  id: string
  tenantId: string
  isletme: string
  gerekce: string
  durum: 'Bekliyor' | 'Onaylandı' | 'Reddedildi'
  istenme: string
  kararNotu: string
  bitis: string
}

export const lisansOzetiniOku = async (client: SupabaseClient): Promise<LisansOzeti[]> => {
  const { data, error } = await client.rpc('lisans_ozeti')
  if(error) throw new Error(`Lisans listesi okunamadı: ${error.message}`)

  return ((data as Record<string, unknown>[] | null) ?? []).map(satir => ({
    tenantId: String(satir.tenant_id ?? ''),
    kiraciKodu: String(satir.kiraci_kodu ?? ''),
    isletme: String(satir.isletme ?? ''),
    paket: String(satir.paket ?? ''),
    durum: String(satir.durum ?? ''),
    baslangic: String(satir.baslangic ?? ''),
    bitis: String(satir.bitis ?? ''),
    kalanGun: Number(satir.kalan_gun ?? 0),
    uzatmaSayisi: Number(satir.uzatma_sayisi ?? 0),
    toplamGun: Number(satir.toplam_gun ?? 0),
    bekleyenTalep: Boolean(satir.bekleyen_talep),
    ucretsizGun: Number(satir.ucretsiz_gun ?? 0),
    ucretliGun: Number(satir.ucretli_gun ?? 0),
    ucretsizUzatma: Number(satir.ucretsiz_uzatma ?? 0),
    ucretliUzatma: Number(satir.ucretli_uzatma ?? 0),
  }))
}

export const sureTalepleriniOku = async (client: SupabaseClient): Promise<SureTalebi[]> => {
  const { data, error } = await client.rpc('sure_talepleri')
  if(error) throw new Error(`Süre talepleri okunamadı: ${error.message}`)

  return ((data as Record<string, unknown>[] | null) ?? []).map(satir => ({
    id: String(satir.id ?? ''),
    tenantId: String(satir.tenant_id ?? ''),
    isletme: String(satir.isletme ?? ''),
    gerekce: String(satir.gerekce ?? ''),
    durum: (satir.durum as SureTalebi['durum']) ?? 'Bekliyor',
    istenme: String(satir.istenme ?? ''),
    kararNotu: String(satir.karar_notu ?? ''),
    bitis: String(satir.bitis ?? ''),
  }))
}

/**
 * Ay ekleyerek ya da tarih vererek uzatır. İkisinden biri zorunlu.
 *
 * ⚠️ `ucretli` bilgisi UZATMA ANINDA yazılır ve deftere geçer. Sonradan
 * "galiba bunu bedava vermiştik" diye hatırlanmaz.
 */
export const lisansiUzat = async (
  client: SupabaseClient,
  tenantId: string,
  secim: { ay?: number; yeniBitis?: string; not?: string; ucretli?: boolean },
): Promise<void> => {
  const { error } = await client.rpc('lisansi_uzat', {
    p_tenant: tenantId,
    p_yeni_bitis: secim.yeniBitis ?? null,
    p_ay: secim.ay ?? null,
    p_not: secim.not ?? null,
    p_ucretli: Boolean(secim.ucretli),
  })
  if(error) throw new Error(`Lisans uzatılamadı: ${error.message}`)
}

export const lisansGecmisiniOku = async (
  client: SupabaseClient,
  tenantId: string,
): Promise<LisansOlayi[]> => {
  const { data, error } = await client.rpc('lisans_gecmisi', { p_tenant: tenantId })
  if(error) throw new Error(`Lisans geçmişi okunamadı: ${error.message}`)

  return ((data as Record<string, unknown>[] | null) ?? []).map(satir => ({
    zaman: String(satir.zaman ?? ''),
    olay: String(satir.olay ?? ''),
    eskiBitis: String(satir.eski_bitis ?? ''),
    yeniBitis: String(satir.yeni_bitis ?? ''),
    gun: Number(satir.gun ?? 0),
    ucretli: satir.ucretli === null || satir.ucretli === undefined
      ? null
      : Boolean(satir.ucretli),
    kim: String(satir.kim ?? ''),
    aciklama: String(satir.aciklama ?? ''),
  }))
}

export const talebiKararaBagla = async (
  client: SupabaseClient,
  talepId: string,
  onay: boolean,
  ay: number,
  not: string,
  ucretli = false,
): Promise<void> => {
  const { error } = await client.rpc('sure_talebini_karara_bagla', {
    p_talep: talepId,
    p_onay: onay,
    p_ay: ay,
    p_not: not || null,
    p_ucretli: ucretli,
  })
  if(error) throw new Error(`Talep karara bağlanamadı: ${error.message}`)
}
