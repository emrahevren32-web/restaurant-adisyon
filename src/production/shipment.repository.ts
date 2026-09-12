// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / İzlenebilirlik — Sevkiyat deposu
//
// ⚠️ Bu dosyada SEVK EDİLEN LOT yok, PLAN var. Hangi partinin gittiği defterde
// durur (`stock_movement.lot_id`, `source_id = shipment.id`). Belgede de
// tutsaydık, FEFO bir çıkışı iki lota böldüğünde satır hangisini yazacağını
// bilemezdi — defter ikisini de yazar.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

export type SevkiyatDurumu = 'DRAFT' | 'SHIPPED' | 'CANCELLED'

export const SEVKIYAT_DURUM_ETIKETLERI: Record<SevkiyatDurumu, string> = {
  DRAFT: 'Hazırlanıyor',
  SHIPPED: 'Sevk edildi',
  CANCELLED: 'İptal',
}

/**
 * Durum geçişleri, kod olarak değil VERİ olarak.
 *
 * Sevk edilmiş bir sevkiyattan taslağa dönüş YOK: defterde çıkış var, geri
 * almak ayrı bir iştir (ters kayıt) ve o iptal yoluyla yapılır.
 */
export const SEVKIYAT_GECISLERI: Readonly<Record<SevkiyatDurumu, readonly SevkiyatDurumu[]>> = {
  DRAFT: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['CANCELLED'],
  CANCELLED: [],
}

export type SevkiyatSatiri = {
  id: string
  stokKalemiId: string
  stokKalemiAd?: string
  stokKalemiKod?: string
  temelBirim?: string
  miktar: number
  birim: string
  not?: string
  siraNo: number
}

export type Sevkiyat = {
  id: string
  sevkiyatNo: string
  durum: SevkiyatDurumu
  musteriAd: string
  musteriTelefon?: string
  adres?: string
  hedefSubeId?: string
  sevkTarihi?: string
  sevkZamani?: string
  not?: string
  olusturmaTarihi: string
  satirlar: SevkiyatSatiri[]
}

export type YeniSevkiyat = {
  sevkiyatNo: string
  musteriAd: string
  musteriTelefon?: string
  adres?: string
  hedefSubeId?: string
  sevkTarihi?: string
  not?: string
  satirlar: Array<Omit<SevkiyatSatiri, 'id' | 'siraNo' | 'stokKalemiAd' | 'stokKalemiKod' | 'temelBirim'>>
}

export interface SevkiyatDeposu {
  hepsi(ctx: TenantCtx): Promise<Sevkiyat[]>
  tekil(ctx: TenantCtx, id: string): Promise<Sevkiyat>
  ekle(ctx: TenantCtx, girdi: YeniSevkiyat): Promise<Sevkiyat>
  guncelle(ctx: TenantCtx, id: string, girdi: YeniSevkiyat): Promise<Sevkiyat>
  durumDegistir(
    ctx: TenantCtx, id: string, durum: SevkiyatDurumu, sevkZamani?: string,
  ): Promise<Sevkiyat>
  /** Geri çağırma için: verilen kimliklerdeki sevkiyatlar. */
  kimliklerden(ctx: TenantCtx, idler: readonly string[]): Promise<Sevkiyat[]>
}

export class SevkiyatNoCakismasiError extends Error {
  constructor(no: string) {
    super(`"${no}" numarası başka bir sevkiyatta kullanılıyor.`)
    this.name = 'SevkiyatNoCakismasiError'
  }
}

const metin = (d: unknown): string | undefined => {
  const s = typeof d === 'string' ? d.trim() : ''
  return s === '' ? undefined : s
}
const sayi = (d: unknown): number => {
  const n = Number(d)
  return Number.isFinite(n) ? n : 0
}

// ═══════════════════════════════════════════════════════════════════════════
// Postgres uygulaması
// ═══════════════════════════════════════════════════════════════════════════

type SatirKaydi = {
  id: string; stock_item_id: string; qty: number | string; uom: string
  note: string | null; line_no: number
  stock_item?: { name: string; code: string; base_uom: string } | null
}

type SevkiyatKaydi = {
  id: string; shipment_no: string; status: string
  customer_name: string; customer_phone: string | null; address: string | null
  destination_branch_id: string | null
  shipped_on: string | null; shipped_at: string | null
  note: string | null; created_at: string
  shipment_line: SatirKaydi[] | null
}

const sevkiyataCevir = (k: SevkiyatKaydi): Sevkiyat => ({
  id: k.id,
  sevkiyatNo: k.shipment_no,
  durum: k.status as SevkiyatDurumu,
  musteriAd: k.customer_name,
  musteriTelefon: metin(k.customer_phone),
  adres: metin(k.address),
  hedefSubeId: k.destination_branch_id ?? undefined,
  sevkTarihi: k.shipped_on ?? undefined,
  sevkZamani: k.shipped_at ?? undefined,
  not: metin(k.note),
  olusturmaTarihi: k.created_at,
  satirlar: [...(k.shipment_line ?? [])]
    .map(s => ({
      id: s.id,
      stokKalemiId: s.stock_item_id,
      stokKalemiAd: s.stock_item?.name,
      stokKalemiKod: s.stock_item?.code,
      temelBirim: s.stock_item?.base_uom,
      miktar: sayi(s.qty),
      birim: s.uom,
      not: metin(s.note),
      siraNo: s.line_no,
    }))
    .sort((a, b) => a.siraNo - b.siraNo),
})

const SECIM = `
  id, shipment_no, status, customer_name, customer_phone, address,
  destination_branch_id, shipped_on, shipped_at, note, created_at,
  shipment_line (
    id, stock_item_id, qty, uom, note, line_no,
    stock_item ( name, code, base_uom )
  )
`

const cakismaVarsaCevir = (hata: { code?: string } | null, no: string) => {
  if(hata?.code === '23505') throw new SevkiyatNoCakismasiError(no)
}

/** ⚠️ Kiracı süzmesini BU SINIF yapmaz — RLS yapar (ADR-004). */
export class PostgresSevkiyatDeposu implements SevkiyatDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async hepsi(_ctx: TenantCtx): Promise<Sevkiyat[]> {
    const { data, error } = await this.client
      .from('shipment').select(SECIM).order('created_at', { ascending: false })
    if(error) throw new Error(error.message)
    return ((data as unknown as SevkiyatKaydi[] | null) ?? []).map(sevkiyataCevir)
  }

  async tekil(_ctx: TenantCtx, id: string): Promise<Sevkiyat> {
    const { data, error } = await this.client
      .from('shipment').select(SECIM).eq('id', id).single()
    if(error) throw new Error(error.message)
    return sevkiyataCevir(data as unknown as SevkiyatKaydi)
  }

  async kimliklerden(_ctx: TenantCtx, idler: readonly string[]): Promise<Sevkiyat[]> {
    if(idler.length === 0) return []
    const { data, error } = await this.client
      .from('shipment').select(SECIM).in('id', [...idler])
      .order('shipped_on', { ascending: false })
    if(error) throw new Error(error.message)
    return ((data as unknown as SevkiyatKaydi[] | null) ?? []).map(sevkiyataCevir)
  }

  async ekle(ctx: TenantCtx, girdi: YeniSevkiyat): Promise<Sevkiyat> {
    const { data, error } = await this.client
      .from('shipment')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        shipment_no: girdi.sevkiyatNo,
        customer_name: girdi.musteriAd,
        customer_phone: girdi.musteriTelefon ?? null,
        address: girdi.adres ?? null,
        destination_branch_id: girdi.hedefSubeId ?? null,
        shipped_on: girdi.sevkTarihi ?? null,
        note: girdi.not ?? null,
      })
      .select('id')
      .single()
    cakismaVarsaCevir(error, girdi.sevkiyatNo)
    if(error) throw new Error(error.message)

    const id = (data as { id: string }).id
    await this.satirlariYaz(ctx, id, girdi, true)
    return this.tekil(ctx, id)
  }

  async guncelle(ctx: TenantCtx, id: string, girdi: YeniSevkiyat): Promise<Sevkiyat> {
    const { error } = await this.client
      .from('shipment')
      .update({
        shipment_no: girdi.sevkiyatNo,
        customer_name: girdi.musteriAd,
        customer_phone: girdi.musteriTelefon ?? null,
        address: girdi.adres ?? null,
        destination_branch_id: girdi.hedefSubeId ?? null,
        shipped_on: girdi.sevkTarihi ?? null,
        note: girdi.not ?? null,
      })
      .eq('id', id)
    cakismaVarsaCevir(error, girdi.sevkiyatNo)
    if(error) throw new Error(error.message)

    await this.satirlariYaz(ctx, id, girdi, false)
    return this.tekil(ctx, id)
  }

  async durumDegistir(
    ctx: TenantCtx, id: string, durum: SevkiyatDurumu, sevkZamani?: string,
  ): Promise<Sevkiyat> {
    const yama: Record<string, unknown> = { status: durum }
    if(sevkZamani) yama.shipped_at = sevkZamani

    const { error } = await this.client.from('shipment').update(yama).eq('id', id)
    if(error) throw new Error(error.message)
    return this.tekil(ctx, id)
  }

  private async satirlariYaz(
    ctx: TenantCtx, sevkiyatId: string, girdi: YeniSevkiyat, yeni: boolean,
  ): Promise<void> {
    const { error: silmeHatasi } = await this.client
      .from('shipment_line').delete().eq('shipment_id', sevkiyatId)
    if(silmeHatasi) throw new Error(silmeHatasi.message)

    if(girdi.satirlar.length === 0) return

    const { error } = await this.client.from('shipment_line').insert(
      girdi.satirlar.map((s, i) => ({
        tenant_id: ctx.tenantId,
        shipment_id: sevkiyatId,
        line_no: i + 1,
        stock_item_id: s.stokKalemiId,
        qty: s.miktar,
        uom: s.birim,
        note: s.not ?? null,
      })),
    )

    if(error){
      // Tarayıcıdan işlem açamıyoruz: yarım bir sevkiyat, hiç olmayandan kötüdür.
      if(yeni) await this.client.from('shipment').delete().eq('id', sevkiyatId)
      throw new Error(error.message)
    }
  }
}
