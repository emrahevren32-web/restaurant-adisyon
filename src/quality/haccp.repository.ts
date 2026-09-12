// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3.5 / HACCP — tipler ve depo sınırı
//
// ── MOCK MODELİNDEN DEVRALINAN, BİR YERİ DÜZELTİLEN ──────────────────────
// `src/haccp/haccp.types.ts` iyi bir model kurmuş: plan → CCP → izleme →
// düzeltici faaliyet. Buradaki tek yapısal fark kritik limitte:
//
//   mock:  criticalLimit: string        → "≤ 4°C"
//   burada: limitTipi + limitAlt/limitUst → sayı
//
// Metinden PASS/FAIL çıkarılamaz. Metin kalıyor ama yalnızca GÖSTERİM için;
// karar sayıdan çıkıyor. HACCP'in tamamı bu karara dayanıyor.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

export type UretimAsamasi =
  | 'RECEIVING' | 'STORAGE' | 'PREPARATION' | 'COOKING'
  | 'BLAST_CHILLING' | 'HOT_HOLDING' | 'PACKAGING' | 'LABELING' | 'DISPATCH'

export const ASAMA_ETIKETLERI: Record<UretimAsamasi, string> = {
  RECEIVING: 'Mal kabul',
  STORAGE: 'Depolama',
  PREPARATION: 'Hazırlık',
  COOKING: 'Pişirme',
  BLAST_CHILLING: 'Hızlı soğutma',
  HOT_HOLDING: 'Sıcak bekletme',
  PACKAGING: 'Paketleme',
  LABELING: 'Etiketleme',
  DISPATCH: 'Sevkiyat',
}

export type LimitTipi = 'MAX' | 'MIN' | 'RANGE'
export type OlcumSonucu = 'PASS' | 'FAIL'
export type CcpDurumu = 'ACTIVE' | 'PASSIVE' | 'SUSPENDED'
export type FaaliyetDurumu = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

export const FAALIYET_ETIKETLERI: Record<FaaliyetDurumu, string> = {
  OPEN: 'Açık',
  IN_PROGRESS: 'Sürüyor',
  COMPLETED: 'Kapandı',
  CANCELLED: 'İptal',
}

export type TehlikeTipi = 'BIOLOGICAL' | 'CHEMICAL' | 'PHYSICAL' | 'ALLERGEN'

export const TEHLIKE_ETIKETLERI: Record<TehlikeTipi, string> = {
  BIOLOGICAL: 'Biyolojik',
  CHEMICAL: 'Kimyasal',
  PHYSICAL: 'Fiziksel',
  ALLERGEN: 'Alerjen',
}

/** Ölçümün bağlandığı belge türü. Zincirin bağı bu alanda. */
export type OlcumKaynagi =
  | 'goods_receipt' | 'work_order' | 'cold_room' | 'shipment' | 'manual'

export type Ccp = {
  id: string
  planId: string
  kod: string
  ad: string
  asama: UretimAsamasi
  limitTipi: LimitTipi
  limitAlt?: number
  limitUst?: number
  birim: string
  limitMetni?: string
  olcumYontemi?: string
  olcumSikligi?: string
  sorumluRol?: string
  tehlikeTipi?: TehlikeTipi
  tehlikeNotu?: string
  duzelticiTalimat?: string
  durum: CcpDurumu
}

export type Olcum = {
  id: string
  ccpId: string
  ccpAd?: string
  ccpKod?: string
  asama?: UretimAsamasi
  deger: number
  birim: string
  sonuc: OlcumSonucu
  limitOzeti: string
  kaynakTipi: OlcumKaynagi
  kaynakId?: string
  lotId?: string
  stokKalemiId?: string
  olcumZamani: string
  not?: string
  iptalZamani?: string
  iptalGerekcesi?: string
}

export type YeniOlcum = {
  ccpId: string
  deger: number
  kaynakTipi: OlcumKaynagi
  kaynakId?: string
  lotId?: string
  stokKalemiId?: string
  olcumZamani?: string
  not?: string
}

export type DuzelticiFaaliyet = {
  id: string
  olcumId: string
  aciklama: string
  atananRol?: string
  durum: FaaliyetDurumu
  yapilanIs?: string
  kapanisZamani?: string
  dogrulamaNotu?: string
  dogrulamaZamani?: string
}

export interface HaccpDeposu {
  ccpler(ctx: TenantCtx): Promise<Ccp[]>
  olcumler(ctx: TenantCtx, limit?: number): Promise<Olcum[]>
  /** Bir belgeye (mal kabul, iş emri…) bağlı ölçümler. */
  kaynaginOlcumleri(ctx: TenantCtx, kaynakTipi: OlcumKaynagi, kaynakId: string): Promise<Olcum[]>
  /** Bir partiye bağlı ölçümler — izlenebilirlik ekranı bunu okuyor. */
  lotunOlcumleri(ctx: TenantCtx, lotId: string): Promise<Olcum[]>
  olcumYaz(ctx: TenantCtx, girdi: YeniOlcum, sonuc: OlcumSonucu, limitOzeti: string, birim: string): Promise<Olcum>
  olcumIptal(ctx: TenantCtx, olcumId: string, gerekce: string): Promise<void>
  faaliyetler(ctx: TenantCtx, durum?: FaaliyetDurumu): Promise<DuzelticiFaaliyet[]>
  faaliyetAc(ctx: TenantCtx, olcumId: string, aciklama: string, atananRol?: string): Promise<DuzelticiFaaliyet>
  faaliyetGuncelle(ctx: TenantCtx, id: string, yama: Partial<DuzelticiFaaliyet>): Promise<DuzelticiFaaliyet>
}

const metin = (d: unknown): string | undefined => {
  const s = typeof d === 'string' ? d.trim() : ''
  return s === '' ? undefined : s
}
const sayi = (d: unknown): number => {
  const n = Number(d)
  return Number.isFinite(n) ? n : 0
}
const sayiVeyaYok = (d: unknown): number | undefined =>
  d === null || d === undefined ? undefined : sayi(d)

// ═══════════════════════════════════════════════════════════════════════════
// Postgres uygulaması — kiracı süzmesini RLS yapar (ADR-004)
// ═══════════════════════════════════════════════════════════════════════════

type CcpKaydi = {
  id: string; plan_id: string; code: string; name: string; stage: string
  limit_type: string; limit_min: number | null; limit_max: number | null
  uom: string; limit_text: string | null
  monitoring_method: string | null; monitoring_frequency: string | null
  responsible_role: string | null
  hazard_type: string | null; hazard_note: string | null
  corrective_instruction: string | null; status: string
}

const ccpyeCevir = (k: CcpKaydi): Ccp => ({
  id: k.id,
  planId: k.plan_id,
  kod: k.code,
  ad: k.name,
  asama: k.stage as UretimAsamasi,
  limitTipi: k.limit_type as LimitTipi,
  limitAlt: sayiVeyaYok(k.limit_min),
  limitUst: sayiVeyaYok(k.limit_max),
  birim: k.uom,
  limitMetni: metin(k.limit_text),
  olcumYontemi: metin(k.monitoring_method),
  olcumSikligi: metin(k.monitoring_frequency),
  sorumluRol: metin(k.responsible_role),
  tehlikeTipi: (k.hazard_type ?? undefined) as TehlikeTipi | undefined,
  tehlikeNotu: metin(k.hazard_note),
  duzelticiTalimat: metin(k.corrective_instruction),
  durum: k.status as CcpDurumu,
})

type OlcumKaydi = {
  id: string; ccp_id: string; measured_value: number | string; uom: string
  result: string; limit_snapshot: string
  source_type: string; source_id: string | null
  lot_id: string | null; stock_item_id: string | null
  measured_at: string; note: string | null
  cancelled_at: string | null; cancel_reason: string | null
  haccp_ccp?: { name: string; code: string; stage: string } | null
}

const olcumeCevir = (k: OlcumKaydi): Olcum => ({
  id: k.id,
  ccpId: k.ccp_id,
  ccpAd: k.haccp_ccp?.name,
  ccpKod: k.haccp_ccp?.code,
  asama: k.haccp_ccp?.stage as UretimAsamasi | undefined,
  deger: sayi(k.measured_value),
  birim: k.uom,
  sonuc: k.result as OlcumSonucu,
  limitOzeti: k.limit_snapshot,
  kaynakTipi: k.source_type as OlcumKaynagi,
  kaynakId: k.source_id ?? undefined,
  lotId: k.lot_id ?? undefined,
  stokKalemiId: k.stock_item_id ?? undefined,
  olcumZamani: k.measured_at,
  not: metin(k.note),
  iptalZamani: k.cancelled_at ?? undefined,
  iptalGerekcesi: metin(k.cancel_reason),
})

type FaaliyetKaydi = {
  id: string; measurement_id: string; description: string
  assigned_role: string | null; status: string
  action_taken: string | null; completed_at: string | null
  verification_note: string | null; verified_at: string | null
}

const faaliyeteCevir = (k: FaaliyetKaydi): DuzelticiFaaliyet => ({
  id: k.id,
  olcumId: k.measurement_id,
  aciklama: k.description,
  atananRol: metin(k.assigned_role),
  durum: k.status as FaaliyetDurumu,
  yapilanIs: metin(k.action_taken),
  kapanisZamani: k.completed_at ?? undefined,
  dogrulamaNotu: metin(k.verification_note),
  dogrulamaZamani: k.verified_at ?? undefined,
})

const CCP_SECIM = `
  id, plan_id, code, name, stage, limit_type, limit_min, limit_max, uom,
  limit_text, monitoring_method, monitoring_frequency, responsible_role,
  hazard_type, hazard_note, corrective_instruction, status
`

const OLCUM_SECIM = `
  id, ccp_id, measured_value, uom, result, limit_snapshot,
  source_type, source_id, lot_id, stock_item_id, measured_at, note,
  cancelled_at, cancel_reason,
  haccp_ccp ( name, code, stage )
`

const FAALIYET_SECIM = `
  id, measurement_id, description, assigned_role, status,
  action_taken, completed_at, verification_note, verified_at
`

export class PostgresHaccpDeposu implements HaccpDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async ccpler(_ctx: TenantCtx): Promise<Ccp[]> {
    const { data, error } = await this.client
      .from('haccp_ccp').select(CCP_SECIM).order('code', { ascending: true })
    if(error) throw new Error(error.message)
    return ((data as unknown as CcpKaydi[] | null) ?? []).map(ccpyeCevir)
  }

  async olcumler(_ctx: TenantCtx, limit = 200): Promise<Olcum[]> {
    const { data, error } = await this.client
      .from('haccp_measurement').select(OLCUM_SECIM)
      .order('measured_at', { ascending: false }).limit(limit)
    if(error) throw new Error(error.message)
    return ((data as unknown as OlcumKaydi[] | null) ?? []).map(olcumeCevir)
  }

  async kaynaginOlcumleri(
    _ctx: TenantCtx, kaynakTipi: OlcumKaynagi, kaynakId: string,
  ): Promise<Olcum[]> {
    const { data, error } = await this.client
      .from('haccp_measurement').select(OLCUM_SECIM)
      .eq('source_type', kaynakTipi).eq('source_id', kaynakId)
      .order('measured_at', { ascending: true })
    if(error) throw new Error(error.message)
    return ((data as unknown as OlcumKaydi[] | null) ?? []).map(olcumeCevir)
  }

  async lotunOlcumleri(_ctx: TenantCtx, lotId: string): Promise<Olcum[]> {
    const { data, error } = await this.client
      .from('haccp_measurement').select(OLCUM_SECIM)
      .eq('lot_id', lotId).order('measured_at', { ascending: true })
    if(error) throw new Error(error.message)
    return ((data as unknown as OlcumKaydi[] | null) ?? []).map(olcumeCevir)
  }

  async olcumYaz(
    ctx: TenantCtx, girdi: YeniOlcum,
    sonuc: OlcumSonucu, limitOzeti: string, birim: string,
  ): Promise<Olcum> {
    const { data, error } = await this.client
      .from('haccp_measurement')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        ccp_id: girdi.ccpId,
        measured_value: girdi.deger,
        uom: birim,
        result: sonuc,
        limit_snapshot: limitOzeti,
        source_type: girdi.kaynakTipi,
        source_id: girdi.kaynakId ?? null,
        lot_id: girdi.lotId ?? null,
        stock_item_id: girdi.stokKalemiId ?? null,
        measured_at: girdi.olcumZamani ?? new Date().toISOString(),
        measured_by: ctx.userId ?? null,
        note: girdi.not ?? null,
      })
      .select(OLCUM_SECIM)
      .single()
    if(error) throw new Error(error.message)
    return olcumeCevir(data as unknown as OlcumKaydi)
  }

  async olcumIptal(_ctx: TenantCtx, olcumId: string, gerekce: string): Promise<void> {
    const { error } = await this.client
      .from('haccp_measurement')
      .update({ cancelled_at: new Date().toISOString(), cancel_reason: gerekce })
      .eq('id', olcumId)
    if(error) throw new Error(error.message)
  }

  async faaliyetler(_ctx: TenantCtx, durum?: FaaliyetDurumu): Promise<DuzelticiFaaliyet[]> {
    let sorgu = this.client
      .from('haccp_corrective_action').select(FAALIYET_SECIM)
      .order('created_at', { ascending: false })
    if(durum) sorgu = sorgu.eq('status', durum)
    const { data, error } = await sorgu
    if(error) throw new Error(error.message)
    return ((data as unknown as FaaliyetKaydi[] | null) ?? []).map(faaliyeteCevir)
  }

  async faaliyetAc(
    ctx: TenantCtx, olcumId: string, aciklama: string, atananRol?: string,
  ): Promise<DuzelticiFaaliyet> {
    const { data, error } = await this.client
      .from('haccp_corrective_action')
      .insert({
        tenant_id: ctx.tenantId,
        measurement_id: olcumId,
        description: aciklama,
        assigned_role: atananRol ?? null,
      })
      .select(FAALIYET_SECIM)
      .single()
    if(error) throw new Error(error.message)
    return faaliyeteCevir(data as unknown as FaaliyetKaydi)
  }

  async faaliyetGuncelle(
    _ctx: TenantCtx, id: string, yama: Partial<DuzelticiFaaliyet>,
  ): Promise<DuzelticiFaaliyet> {
    const kayit: Record<string, unknown> = {}
    if(yama.durum !== undefined) kayit.status = yama.durum
    if(yama.yapilanIs !== undefined) kayit.action_taken = yama.yapilanIs
    if(yama.kapanisZamani !== undefined) kayit.completed_at = yama.kapanisZamani
    if(yama.dogrulamaNotu !== undefined) kayit.verification_note = yama.dogrulamaNotu
    if(yama.dogrulamaZamani !== undefined) kayit.verified_at = yama.dogrulamaZamani
    if(yama.atananRol !== undefined) kayit.assigned_role = yama.atananRol

    const { data, error } = await this.client
      .from('haccp_corrective_action').update(kayit).eq('id', id)
      .select(FAALIYET_SECIM).single()
    if(error) throw new Error(error.message)
    return faaliyeteCevir(data as unknown as FaaliyetKaydi)
  }
}
