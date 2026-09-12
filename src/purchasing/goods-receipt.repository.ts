// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Mal kabul deposu (port + Postgres uygulaması)
//
// Yol haritası maddesi: "Mal kabul → stok girişi"
//
// Bu depo YALNIZCA kabul belgesini tutar. Stok defterine yazma işi burada
// DEĞİL, `DepoServisi.malKabul()` üzerinden `postMovement()` kapısından
// geçer (ADR-001, mimari test). Burada tutulan tek bağ `stockMovementId`:
// hangi kabul satırı deftere hangi hareket olarak düştü.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

export type KabulDurumu = 'DRAFT' | 'POSTED' | 'CANCELLED'

export type KabulSatiri = {
  id: string
  siparisSatirId?: string
  stokKalemiId: string
  stokKalemiAd?: string
  kabulMiktari: number
  redMiktari: number
  redNedeni?: string
  birim: string
  birimFiyat: number
  lotKodu?: string
  sonKullanma?: string
  /** Deftere düşen hareketin kimliği. Boşsa bu satır HENÜZ işlenmemiştir. */
  hareketId?: string
  siraNo: number
}

export type Kabul = {
  id: string
  kabulNo: string
  durum: KabulDurumu
  siparisId?: string
  siparisNo?: string
  tedarikciId: string
  tedarikciAd?: string
  kabulTarihi: string
  irsaliyeNo?: string
  not?: string
  islenmeZamani?: string
  olusturmaTarihi: string
  satirlar: KabulSatiri[]
}

export type YeniKabul = {
  kabulNo: string
  siparisId?: string
  tedarikciId: string
  kabulTarihi?: string
  irsaliyeNo?: string
  not?: string
  satirlar: Array<Omit<KabulSatiri, 'id' | 'siraNo' | 'stokKalemiAd' | 'hareketId'>>
}

export interface MalKabulDeposu {
  hepsi(ctx: TenantCtx): Promise<Kabul[]>
  /** Taslak olarak açar; hareketler henüz yazılmamıştır. */
  taslakAc(ctx: TenantCtx, girdi: YeniKabul): Promise<Kabul>
  /** Bir satırı deftere düşen hareketle eşler. */
  satiraHareketBagla(ctx: TenantCtx, satirId: string, hareketId: string): Promise<void>
  /** Tüm satırlar işlendikten sonra belgeyi kapatır. */
  islendiIsaretle(ctx: TenantCtx, kabulId: string): Promise<Kabul>
  tekil(ctx: TenantCtx, kabulId: string): Promise<Kabul>
}

const metin = (deger: unknown): string | undefined => {
  const s = typeof deger === 'string' ? deger.trim() : ''
  return s === '' ? undefined : s
}

// Postgres `numeric` alanları supabase-js tarafından METİN olarak gelebilir.
// Sayıya çevirmeyi unutmak "12" + 1 = "121" gibi sessiz hatalara yol açar.
const sayi = (deger: unknown): number => {
  const n = Number(deger)
  return Number.isFinite(n) ? n : 0
}

type SatirKaydi = {
  id: string; order_line_id: string | null; stock_item_id: string
  accepted_qty: number | string; rejected_qty: number | string
  reject_reason: string | null; uom: string; unit_price: number | string
  lot_code: string | null; expires_on: string | null
  stock_movement_id: string | null; line_no: number
  stock_item?: { name: string } | null
}

type KabulKaydi = {
  id: string; receipt_no: string; status: string
  order_id: string | null; supplier_id: string
  received_on: string; waybill_no: string | null; note: string | null
  posted_at: string | null; created_at: string
  supplier?: { name: string } | null
  purchase_order?: { order_no: string } | null
  goods_receipt_line: SatirKaydi[] | null
}

const kabuleCevir = (k: KabulKaydi): Kabul => ({
  id: k.id,
  kabulNo: k.receipt_no,
  durum: k.status as KabulDurumu,
  siparisId: metin(k.order_id),
  siparisNo: k.purchase_order?.order_no,
  tedarikciId: k.supplier_id,
  tedarikciAd: k.supplier?.name,
  kabulTarihi: k.received_on,
  irsaliyeNo: metin(k.waybill_no),
  not: metin(k.note),
  islenmeZamani: metin(k.posted_at),
  olusturmaTarihi: k.created_at,
  satirlar: [...(k.goods_receipt_line ?? [])]
    .map(s => ({
      id: s.id,
      siparisSatirId: metin(s.order_line_id),
      stokKalemiId: s.stock_item_id,
      stokKalemiAd: s.stock_item?.name,
      kabulMiktari: sayi(s.accepted_qty),
      redMiktari: sayi(s.rejected_qty),
      redNedeni: metin(s.reject_reason),
      birim: s.uom,
      birimFiyat: sayi(s.unit_price),
      lotKodu: metin(s.lot_code),
      sonKullanma: metin(s.expires_on),
      hareketId: metin(s.stock_movement_id),
      siraNo: s.line_no,
    }))
    .sort((a, b) => a.siraNo - b.siraNo),
})

const SECIM = `
  id, receipt_no, status, order_id, supplier_id, received_on, waybill_no,
  note, posted_at, created_at,
  supplier ( name ),
  purchase_order ( order_no ),
  goods_receipt_line (
    id, order_line_id, stock_item_id, accepted_qty, rejected_qty, reject_reason,
    uom, unit_price, lot_code, expires_on, stock_movement_id, line_no,
    stock_item ( name )
  )
`

export class KabulNoCakismasiError extends Error {
  constructor(no: string) {
    super(`"${no}" kabul numarası zaten kullanılıyor.`)
    this.name = 'KabulNoCakismasiError'
  }
}

/**
 * ⚠️ Kiracı süzmesini BU SINIF yapmaz — RLS yapar (ADR-004).
 */
export class PostgresMalKabulDeposu implements MalKabulDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async hepsi(_ctx: TenantCtx): Promise<Kabul[]> {
    const { data, error } = await this.client
      .from('goods_receipt')
      .select(SECIM)
      .order('created_at', { ascending: false })

    if(error) throw new Error(`Mal kabuller okunamadı: ${error.message}`)
    return ((data as unknown as KabulKaydi[] | null) ?? []).map(kabuleCevir)
  }

  async tekil(_ctx: TenantCtx, kabulId: string): Promise<Kabul> {
    const { data, error } = await this.client
      .from('goods_receipt').select(SECIM).eq('id', kabulId).single()
    if(error) throw new Error(`Mal kabul okunamadı: ${error.message}`)
    return kabuleCevir(data as unknown as KabulKaydi)
  }

  async taslakAc(ctx: TenantCtx, girdi: YeniKabul): Promise<Kabul> {
    const { data, error } = await this.client
      .from('goods_receipt')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        receipt_no: girdi.kabulNo.trim(),
        order_id: girdi.siparisId || null,
        supplier_id: girdi.tedarikciId,
        received_on: girdi.kabulTarihi || new Date().toISOString().slice(0, 10),
        waybill_no: girdi.irsaliyeNo?.trim() || null,
        note: girdi.not?.trim() || null,
        status: 'DRAFT',
        created_by: ctx.userId,
      })
      .select('id')
      .single()

    if(error){
      throw error.code === '23505'
        ? new KabulNoCakismasiError(girdi.kabulNo.trim())
        : new Error(`Mal kabul açılamadı: ${error.message}`)
    }

    const kabulId = (data as { id: string }).id

    const { error: satirHatasi } = await this.client
      .from('goods_receipt_line')
      .insert(girdi.satirlar.map((s, i) => ({
        tenant_id: ctx.tenantId,
        receipt_id: kabulId,
        order_line_id: s.siparisSatirId || null,
        stock_item_id: s.stokKalemiId,
        accepted_qty: s.kabulMiktari,
        rejected_qty: s.redMiktari,
        reject_reason: s.redNedeni?.trim() || null,
        uom: s.birim,
        unit_price: s.birimFiyat,
        lot_code: s.lotKodu?.trim() || null,
        expires_on: s.sonKullanma || null,
        line_no: i + 1,
      })))

    if(satirHatasi){
      // Tarayıcıdan işlem açamıyoruz; başlık yazılıp satırlar düşerse ortada
      // kalemsiz bir belge kalırdı. Elle geri alma bir işlemin yerini tutmaz
      // ama sessiz bozuk kaydı önler.
      await this.client.from('goods_receipt').delete().eq('id', kabulId)
      throw new Error(`Kabul kalemleri kaydedilemedi, belge geri alındı: ${satirHatasi.message}`)
    }

    return this.tekil(ctx, kabulId)
  }

  async satiraHareketBagla(_ctx: TenantCtx, satirId: string, hareketId: string): Promise<void> {
    const { error } = await this.client
      .from('goods_receipt_line')
      .update({ stock_movement_id: hareketId })
      .eq('id', satirId)

    if(error) throw new Error(`Kabul satırı hareketle eşlenemedi: ${error.message}`)
  }

  async islendiIsaretle(ctx: TenantCtx, kabulId: string): Promise<Kabul> {
    const { error } = await this.client
      .from('goods_receipt')
      .update({ status: 'POSTED', posted_at: new Date().toISOString() })
      .eq('id', kabulId)

    if(error) throw new Error(`Mal kabul kapatılamadı: ${error.message}`)
    return this.tekil(ctx, kabulId)
  }
}
