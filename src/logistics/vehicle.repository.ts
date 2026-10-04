// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · A4B — Araç ve şoför deposu
//
// Yol haritası maddesi: "Araç ve şoför kartları"
//          Bitti sayılır ki: "Plaka, şoför, kapasite ve soğutma bilgisi kayıtlı"
//
// Biçim müşteri deposuyla (0047) BİREBİR aynı: bir PORT ve onun Postgres
// uygulaması (ADR-003). Aynı işi iki farklı şekilde yapmak, iki farklı hata
// demektir.
//
// ⚠️ SON SÖZ 0064'TE. Buradaki hiçbir kontrol güvenlik sınırı değildir:
// kiracı yalıtımı RLS'te, aidiyet denetimi MI424 tetiğinde, sevk sonrası
// kilit MI434'tedir.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'
import {
  aracDogrula, plakaAnahtari, soforDogrula,
  type Arac, type Sofor, type YeniArac, type YeniSofor,
} from './vehicle.service'

export class AracHatasi extends Error {
  constructor(mesaj: string) {
    super(mesaj)
    this.name = 'AracHatasi'
  }
}

export class PlakaCakismasiError extends Error {
  constructor(plaka: string) {
    super(`"${plaka}" plakası zaten kayıtlı. Aynı araç ikinci kez açılamaz.`)
    this.name = 'PlakaCakismasiError'
  }
}

export interface AracDeposu {
  araclar(ctx: TenantCtx): Promise<Arac[]>
  aracEkle(ctx: TenantCtx, girdi: YeniArac): Promise<Arac>
  aracGuncelle(ctx: TenantCtx, id: string, girdi: YeniArac): Promise<Arac>
  /** Kart SİLİNMEZ, pasife alınır — geçmiş irsaliyelerin bağı kopmasın. */
  aracDurum(ctx: TenantCtx, id: string, aktif: boolean): Promise<void>

  soforler(ctx: TenantCtx): Promise<Sofor[]>
  soforEkle(ctx: TenantCtx, girdi: YeniSofor): Promise<Sofor>
  soforGuncelle(ctx: TenantCtx, id: string, girdi: YeniSofor): Promise<Sofor>
  soforDurum(ctx: TenantCtx, id: string, aktif: boolean): Promise<void>
}

const metin = (d: string | null): string | undefined => {
  const m = (d ?? '').trim()
  return m === '' ? undefined : m
}
const sayi = (d: unknown): number | undefined =>
  d === null || d === undefined ? undefined : Number(d)

type AracKaydi = {
  id: string; plate: string; plate_key: string; name: string | null
  capacity_kg: string | number | null; is_refrigerated: boolean
  min_temp_c: string | number | null; max_temp_c: string | number | null
  note: string | null; is_active: boolean
}

type SoforKaydi = {
  id: string; full_name: string; phone: string | null
  licence_class: string | null; licence_valid_until: string | null
  note: string | null; is_active: boolean
}

const aracaCevir = (k: AracKaydi): Arac => ({
  id: k.id,
  plaka: k.plate,
  plakaAnahtari: k.plate_key,
  ad: metin(k.name),
  kapasiteKg: sayi(k.capacity_kg),
  sogutmali: k.is_refrigerated,
  minSicaklik: sayi(k.min_temp_c),
  maxSicaklik: sayi(k.max_temp_c),
  not: metin(k.note),
  aktif: k.is_active,
})

const sofereCevir = (k: SoforKaydi): Sofor => ({
  id: k.id,
  adSoyad: k.full_name,
  telefon: metin(k.phone),
  ehliyetSinifi: metin(k.licence_class),
  ehliyetGecerlilik: metin(k.licence_valid_until),
  not: metin(k.note),
  aktif: k.is_active,
})

const ARAC_SUTUNLARI =
  'id, plate, plate_key, name, capacity_kg, is_refrigerated, min_temp_c, max_temp_c, note, is_active'
const SOFOR_SUTUNLARI =
  'id, full_name, phone, licence_class, licence_valid_until, note, is_active'

/** 23505 = tekillik ihlali. Plaka anahtarı çakıştıysa iyi bir cümle kuruyoruz. */
const cakismaVarsaCevir = (hata: { code?: string } | null, plaka: string) => {
  if(hata?.code === '23505') throw new PlakaCakismasiError(plaka)
}

export class PostgresAracDeposu implements AracDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async araclar(_ctx: TenantCtx): Promise<Arac[]> {
    const { data, error } = await this.client
      .from('vehicle').select(ARAC_SUTUNLARI).order('plate')
    if(error) throw new AracHatasi(`Araçlar okunamadı: ${error.message}`)
    return ((data as unknown as AracKaydi[] | null) ?? []).map(aracaCevir)
  }

  async aracEkle(ctx: TenantCtx, girdi: YeniArac): Promise<Arac> {
    const temiz = aracDogrula(girdi)
    const { data, error } = await this.client
      .from('vehicle')
      .insert({
        tenant_id: ctx.tenantId,
        plate: temiz.plaka,
        // ⚠️ Anahtarı EKRAN değil depo üretiyor. Ekranda üretseydik ikinci
        // bir çağıran (Excel aktarımı, betik) farklı kural uygulardı.
        plate_key: plakaAnahtari(temiz.plaka),
        name: temiz.ad ?? null,
        capacity_kg: temiz.kapasiteKg ?? null,
        is_refrigerated: temiz.sogutmali,
        min_temp_c: temiz.minSicaklik ?? null,
        max_temp_c: temiz.maxSicaklik ?? null,
        note: temiz.not ?? null,
      })
      .select(ARAC_SUTUNLARI)
      .single()
    cakismaVarsaCevir(error, temiz.plaka)
    if(error) throw new AracHatasi(`Araç eklenemedi: ${error.message}`)
    return aracaCevir(data as unknown as AracKaydi)
  }

  async aracGuncelle(_ctx: TenantCtx, id: string, girdi: YeniArac): Promise<Arac> {
    const temiz = aracDogrula(girdi)
    const { data, error } = await this.client
      .from('vehicle')
      .update({
        plate: temiz.plaka,
        plate_key: plakaAnahtari(temiz.plaka),
        name: temiz.ad ?? null,
        capacity_kg: temiz.kapasiteKg ?? null,
        is_refrigerated: temiz.sogutmali,
        min_temp_c: temiz.minSicaklik ?? null,
        max_temp_c: temiz.maxSicaklik ?? null,
        note: temiz.not ?? null,
      })
      .eq('id', id)
      .select(ARAC_SUTUNLARI)
      .single()
    cakismaVarsaCevir(error, temiz.plaka)
    if(error) throw new AracHatasi(`Araç güncellenemedi: ${error.message}`)
    return aracaCevir(data as unknown as AracKaydi)
  }

  async aracDurum(_ctx: TenantCtx, id: string, aktif: boolean): Promise<void> {
    const { error } = await this.client
      .from('vehicle').update({ is_active: aktif }).eq('id', id)
    if(error) throw new AracHatasi(`Araç durumu değiştirilemedi: ${error.message}`)
  }

  async soforler(_ctx: TenantCtx): Promise<Sofor[]> {
    const { data, error } = await this.client
      .from('driver').select(SOFOR_SUTUNLARI).order('full_name')
    if(error) throw new AracHatasi(`Şoförler okunamadı: ${error.message}`)
    return ((data as unknown as SoforKaydi[] | null) ?? []).map(sofereCevir)
  }

  async soforEkle(ctx: TenantCtx, girdi: YeniSofor): Promise<Sofor> {
    const temiz = soforDogrula(girdi)
    const { data, error } = await this.client
      .from('driver')
      .insert({
        tenant_id: ctx.tenantId,
        full_name: temiz.adSoyad,
        phone: temiz.telefon ?? null,
        licence_class: temiz.ehliyetSinifi ?? null,
        licence_valid_until: temiz.ehliyetGecerlilik ?? null,
        note: temiz.not ?? null,
      })
      .select(SOFOR_SUTUNLARI)
      .single()
    if(error) throw new AracHatasi(`Şoför eklenemedi: ${error.message}`)
    return sofereCevir(data as unknown as SoforKaydi)
  }

  async soforGuncelle(_ctx: TenantCtx, id: string, girdi: YeniSofor): Promise<Sofor> {
    const temiz = soforDogrula(girdi)
    const { data, error } = await this.client
      .from('driver')
      .update({
        full_name: temiz.adSoyad,
        phone: temiz.telefon ?? null,
        licence_class: temiz.ehliyetSinifi ?? null,
        licence_valid_until: temiz.ehliyetGecerlilik ?? null,
        note: temiz.not ?? null,
      })
      .eq('id', id)
      .select(SOFOR_SUTUNLARI)
      .single()
    if(error) throw new AracHatasi(`Şoför güncellenemedi: ${error.message}`)
    return sofereCevir(data as unknown as SoforKaydi)
  }

  async soforDurum(_ctx: TenantCtx, id: string, aktif: boolean): Promise<void> {
    const { error } = await this.client
      .from('driver').update({ is_active: aktif }).eq('id', id)
    if(error) throw new AracHatasi(`Şoför durumu değiştirilemedi: ${error.message}`)
  }
}
