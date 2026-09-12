// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / Üretim — İş emri deposu
//
// ⚠️ Bu dosyada MİKTAR yok, PLAN var. Ne kadar tüketildiği defterde durur
// (`stock_movement.source_id = work_order.id`), burada değil. İkisini de
// saklasaydık biri sessizce eskirdi — ADR-001'in tam olarak reddettiği şey.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

export type IsEmriDurumu = 'DRAFT' | 'STARTED' | 'COMPLETED' | 'CANCELLED'

export const IS_EMRI_DURUM_ETIKETLERI: Record<IsEmriDurumu, string> = {
  DRAFT: 'Taslak',
  STARTED: 'Üretimde',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal',
}

/**
 * Durum geçişleri, kod olarak değil VERİ olarak.
 *
 * Tamamlanmış iş emrinden çıkış YOK: defterde hem tüketim hem mamul girişi
 * var; geri almak ayrı bir iş (ters kayıt) ve o iptal yoluyla yapılır.
 * İptalden de dönüş yok — iptal, ters kayıtların yazıldığı andır.
 */
export const IS_EMRI_GECISLERI: Readonly<Record<IsEmriDurumu, readonly IsEmriDurumu[]>> = {
  DRAFT: ['STARTED', 'CANCELLED'],
  STARTED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['CANCELLED'],
  CANCELLED: [],
}

export type IsEmriSatiri = {
  id: string
  stokKalemiId: string
  stokKalemiAd?: string
  stokKalemiKod?: string
  temelBirim?: string
  /** Fire ve verim DAHİL, depodan çekilecek miktar. Reçeteden kopyalandı. */
  planlananMiktar: number
  birim: string
  not?: string
  siraNo: number
}

export type IsEmri = {
  id: string
  isEmriNo: string
  durum: IsEmriDurumu
  receteId?: string
  receteAd?: string
  ciktiKalemiId: string
  ciktiKalemiAd?: string
  planlananMiktar: number
  ciktiBirimi: string
  verim: number
  planlananTarih?: string
  baslamaZamani?: string
  bitisZamani?: string
  not?: string
  olusturmaTarihi: string
  satirlar: IsEmriSatiri[]
}

export type YeniIsEmri = {
  isEmriNo: string
  receteId?: string
  ciktiKalemiId: string
  planlananMiktar: number
  ciktiBirimi: string
  verim?: number
  planlananTarih?: string
  not?: string
  satirlar: Array<Omit<IsEmriSatiri, 'id' | 'siraNo' | 'stokKalemiAd' | 'stokKalemiKod' | 'temelBirim'>>
}

export interface IsEmriDeposu {
  hepsi(ctx: TenantCtx): Promise<IsEmri[]>
  tekil(ctx: TenantCtx, id: string): Promise<IsEmri>
  ekle(ctx: TenantCtx, girdi: YeniIsEmri): Promise<IsEmri>
  /** Yalnızca taslak hâldeyken; başlık ve satırların tamamı yeniden yazılır. */
  guncelle(ctx: TenantCtx, id: string, girdi: YeniIsEmri): Promise<IsEmri>
  durumDegistir(
    ctx: TenantCtx, id: string, durum: IsEmriDurumu,
    zaman?: { baslama?: string; bitis?: string },
  ): Promise<IsEmri>
}

export class IsEmriNoCakismasiError extends Error {
  constructor(no: string) {
    super(`"${no}" numarası başka bir iş emrinde kullanılıyor.`)
    this.name = 'IsEmriNoCakismasiError'
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
  id: string; stock_item_id: string; planned_qty: number | string; uom: string
  note: string | null; line_no: number
  stock_item?: { name: string; code: string; base_uom: string } | null
}

type IsEmriKaydi = {
  id: string; order_no: string; status: string
  recipe_id: string | null; output_item_id: string
  planned_qty: number | string; output_uom: string; yield_pct: number | string
  planned_on: string | null; started_at: string | null; completed_at: string | null
  note: string | null; created_at: string
  recipe?: { name: string } | null
  stock_item?: { name: string } | null
  work_order_line: SatirKaydi[] | null
}

const isEmrineCevir = (k: IsEmriKaydi): IsEmri => ({
  id: k.id,
  isEmriNo: k.order_no,
  durum: k.status as IsEmriDurumu,
  receteId: k.recipe_id ?? undefined,
  receteAd: k.recipe?.name,
  ciktiKalemiId: k.output_item_id,
  ciktiKalemiAd: k.stock_item?.name,
  planlananMiktar: sayi(k.planned_qty),
  ciktiBirimi: k.output_uom,
  verim: sayi(k.yield_pct),
  planlananTarih: k.planned_on ?? undefined,
  baslamaZamani: k.started_at ?? undefined,
  bitisZamani: k.completed_at ?? undefined,
  not: metin(k.note),
  olusturmaTarihi: k.created_at,
  satirlar: [...(k.work_order_line ?? [])]
    .map(s => ({
      id: s.id,
      stokKalemiId: s.stock_item_id,
      stokKalemiAd: s.stock_item?.name,
      stokKalemiKod: s.stock_item?.code,
      temelBirim: s.stock_item?.base_uom,
      planlananMiktar: sayi(s.planned_qty),
      birim: s.uom,
      not: metin(s.note),
      siraNo: s.line_no,
    }))
    .sort((a, b) => a.siraNo - b.siraNo),
})

const SECIM = `
  id, order_no, status, recipe_id, output_item_id, planned_qty, output_uom,
  yield_pct, planned_on, started_at, completed_at, note, created_at,
  recipe ( name ),
  stock_item ( name ),
  work_order_line (
    id, stock_item_id, planned_qty, uom, note, line_no,
    stock_item ( name, code, base_uom )
  )
`

const cakismaVarsaCevir = (hata: { code?: string } | null, no: string) => {
  if(hata?.code === '23505') throw new IsEmriNoCakismasiError(no)
}

/** ⚠️ Kiracı süzmesini BU SINIF yapmaz — RLS yapar (ADR-004). */
export class PostgresIsEmriDeposu implements IsEmriDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async hepsi(_ctx: TenantCtx): Promise<IsEmri[]> {
    const { data, error } = await this.client
      .from('work_order').select(SECIM).order('created_at', { ascending: false })
    if(error) throw new Error(error.message)
    return ((data as unknown as IsEmriKaydi[] | null) ?? []).map(isEmrineCevir)
  }

  async tekil(_ctx: TenantCtx, id: string): Promise<IsEmri> {
    const { data, error } = await this.client
      .from('work_order').select(SECIM).eq('id', id).single()
    if(error) throw new Error(error.message)
    return isEmrineCevir(data as unknown as IsEmriKaydi)
  }

  async ekle(ctx: TenantCtx, girdi: YeniIsEmri): Promise<IsEmri> {
    const { data, error } = await this.client
      .from('work_order')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        order_no: girdi.isEmriNo,
        recipe_id: girdi.receteId ?? null,
        output_item_id: girdi.ciktiKalemiId,
        planned_qty: girdi.planlananMiktar,
        output_uom: girdi.ciktiBirimi,
        yield_pct: girdi.verim ?? 100,
        planned_on: girdi.planlananTarih ?? null,
        note: girdi.not ?? null,
      })
      .select('id')
      .single()
    cakismaVarsaCevir(error, girdi.isEmriNo)
    if(error) throw new Error(error.message)

    const id = (data as { id: string }).id
    await this.satirlariYaz(ctx, id, girdi, true)
    return this.tekil(ctx, id)
  }

  async guncelle(ctx: TenantCtx, id: string, girdi: YeniIsEmri): Promise<IsEmri> {
    const { error } = await this.client
      .from('work_order')
      .update({
        order_no: girdi.isEmriNo,
        recipe_id: girdi.receteId ?? null,
        output_item_id: girdi.ciktiKalemiId,
        planned_qty: girdi.planlananMiktar,
        output_uom: girdi.ciktiBirimi,
        yield_pct: girdi.verim ?? 100,
        planned_on: girdi.planlananTarih ?? null,
        note: girdi.not ?? null,
      })
      .eq('id', id)
    cakismaVarsaCevir(error, girdi.isEmriNo)
    if(error) throw new Error(error.message)

    await this.satirlariYaz(ctx, id, girdi, false)
    return this.tekil(ctx, id)
  }

  async durumDegistir(
    ctx: TenantCtx, id: string, durum: IsEmriDurumu,
    zaman?: { baslama?: string; bitis?: string },
  ): Promise<IsEmri> {
    const yama: Record<string, unknown> = { status: durum }
    if(zaman?.baslama) yama.started_at = zaman.baslama
    if(zaman?.bitis) yama.completed_at = zaman.bitis

    const { error } = await this.client.from('work_order').update(yama).eq('id', id)
    if(error) throw new Error(error.message)
    return this.tekil(ctx, id)
  }

  private async satirlariYaz(
    ctx: TenantCtx, isEmriId: string, girdi: YeniIsEmri, yeni: boolean,
  ): Promise<void> {
    const { error: silmeHatasi } = await this.client
      .from('work_order_line').delete().eq('work_order_id', isEmriId)
    if(silmeHatasi) throw new Error(silmeHatasi.message)

    if(girdi.satirlar.length === 0) return

    const { error } = await this.client.from('work_order_line').insert(
      girdi.satirlar.map((s, i) => ({
        tenant_id: ctx.tenantId,
        work_order_id: isEmriId,
        line_no: i + 1,
        stock_item_id: s.stokKalemiId,
        planned_qty: s.planlananMiktar,
        uom: s.birim,
        note: s.not ?? null,
      })),
    )

    if(error){
      // Tarayıcıdan işlem açamıyoruz: yarım bir iş emri, hiç olmayandan kötüdür.
      if(yeni) await this.client.from('work_order').delete().eq('id', isEmriId)
      throw new Error(error.message)
    }
  }
}
