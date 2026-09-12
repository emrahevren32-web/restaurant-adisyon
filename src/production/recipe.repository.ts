// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / Üretim — Reçete deposu
//
// Yol haritası maddesi: "Reçete yönetimi gerçek veriye bağlı"
//                       Bitti sayılır ki: "Reçete kalemleri stok kartlarına bağlı"
//
// Depo çekirdeğindeki `TedarikciDeposu` ile aynı biçim: bir PORT ve onun
// Postgres uygulaması (ADR-003). Ekran arayüze konuşur, testler belleğe.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'
import { normalizeIdentifier } from '../core/identifier'

/**
 * Kod anahtarı — tekillik bunun üzerinden kurulu (şemada `code_key`).
 *
 * ⚠️ Türkçe yerel ayarıyla küçültme YAPILMAZ: `'ISTANBUL'.toLocaleLowerCase('tr-TR')`
 * → `'ıstanbul'` olur ve `'istanbul'` ile eşleşmez. Depo çekirdeğiyle aynı kural.
 */
const anahtarla = (kod: string) => normalizeIdentifier(kod)

export type ReceteDurumu = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export const RECETE_DURUM_ETIKETLERI: Record<ReceteDurumu, string> = {
  DRAFT: 'Taslak',
  ACTIVE: 'Yürürlükte',
  ARCHIVED: 'Arşiv',
}

/**
 * Durum geçişleri, kod olarak değil VERİ olarak.
 *
 * Ekrandaki düğmeler bu tablodan üretiliyor; yeni bir geçiş eklemek için
 * ekrana dokunmak gerekmiyor. Arşivden geri dönüş VAR (yanlışlıkla arşivlemek
 * meşru bir hatadır) ama taslağa geri dönüş YOK: yürürlükteki bir reçeteyi
 * taslağa çevirmek, ona bakan iş emirlerinin altını boşaltırdı.
 */
export const RECETE_GECISLERI: Readonly<Record<ReceteDurumu, readonly ReceteDurumu[]>> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['ARCHIVED'],
  ARCHIVED: ['ACTIVE'],
}

export type ReceteSatiri = {
  id: string
  /** ⚠️ Kriterin kendisi: satır bir STOK KARTINA bağlı, serbest metne değil. */
  stokKalemiId: string
  stokKalemiAd?: string
  stokKalemiKod?: string
  /** Kalemin temel birimi — ölçek ve yeterlilik hesabı bunu kullanır. */
  temelBirim?: string
  miktar: number
  birim: string
  /** O malzemeye özgü fire payı (kabuk, sap). Prosesin verimiyle karıştırılmamalı. */
  firePayi: number
  not?: string
  siraNo: number
}

export type Recete = {
  id: string
  kod: string
  ad: string
  durum: ReceteDurumu
  ciktiKalemiId: string
  ciktiKalemiAd?: string
  /** Reçete bu miktar için yazılır; ölçeklemeyi iş emri yapar. */
  ciktiMiktari: number
  ciktiBirimi: string
  /** Prosesin verimi, yüzde. 100 = kayıpsız. */
  verim: number
  not?: string
  olusturmaTarihi: string
  satirlar: ReceteSatiri[]
}

export type ReceteGirdisi = {
  kod: string
  ad: string
  ciktiKalemiId: string
  ciktiMiktari: number
  ciktiBirimi: string
  verim?: number
  not?: string
  satirlar: Array<Omit<ReceteSatiri, 'id' | 'siraNo' | 'stokKalemiAd' | 'stokKalemiKod' | 'temelBirim'>>
}

export interface ReceteDeposu {
  hepsi(ctx: TenantCtx): Promise<Recete[]>
  tekil(ctx: TenantCtx, id: string): Promise<Recete>
  ekle(ctx: TenantCtx, girdi: ReceteGirdisi): Promise<Recete>
  /** Başlık ve satırların tamamı yeniden yazılır. */
  guncelle(ctx: TenantCtx, id: string, girdi: ReceteGirdisi): Promise<Recete>
  durumDegistir(ctx: TenantCtx, id: string, durum: ReceteDurumu): Promise<Recete>
}

export class ReceteKoduCakismasiError extends Error {
  constructor(kod: string) {
    super(`"${kod}" kodu başka bir reçetede kullanılıyor.`)
    this.name = 'ReceteKoduCakismasiError'
  }
}

const metin = (deger: unknown): string | undefined => {
  const s = typeof deger === 'string' ? deger.trim() : ''
  return s === '' ? undefined : s
}

const sayi = (deger: unknown): number => {
  const n = Number(deger)
  return Number.isFinite(n) ? n : 0
}

// ═══════════════════════════════════════════════════════════════════════════
// Postgres uygulaması
// ═══════════════════════════════════════════════════════════════════════════

type SatirKaydi = {
  id: string; stock_item_id: string; qty: number | string; uom: string
  waste_pct: number | string; note: string | null; line_no: number
  stock_item?: { name: string; code: string; base_uom: string } | null
}

type ReceteKaydi = {
  id: string; code: string; name: string; status: string
  output_item_id: string; output_qty: number | string; output_uom: string
  yield_pct: number | string; note: string | null; created_at: string
  stock_item?: { name: string } | null
  recipe_line: SatirKaydi[] | null
}

const receteyeCevir = (k: ReceteKaydi): Recete => ({
  id: k.id,
  kod: k.code,
  ad: k.name,
  durum: k.status as ReceteDurumu,
  ciktiKalemiId: k.output_item_id,
  ciktiKalemiAd: k.stock_item?.name,
  ciktiMiktari: sayi(k.output_qty),
  ciktiBirimi: k.output_uom,
  verim: sayi(k.yield_pct),
  not: metin(k.note),
  olusturmaTarihi: k.created_at,
  satirlar: [...(k.recipe_line ?? [])]
    .map(s => ({
      id: s.id,
      stokKalemiId: s.stock_item_id,
      stokKalemiAd: s.stock_item?.name,
      stokKalemiKod: s.stock_item?.code,
      temelBirim: s.stock_item?.base_uom,
      miktar: sayi(s.qty),
      birim: s.uom,
      firePayi: sayi(s.waste_pct),
      not: metin(s.note),
      siraNo: s.line_no,
    }))
    .sort((a, b) => a.siraNo - b.siraNo),
})

const SECIM = `
  id, code, name, status, output_item_id, output_qty, output_uom,
  yield_pct, note, created_at,
  stock_item ( name ),
  recipe_line (
    id, stock_item_id, qty, uom, waste_pct, note, line_no,
    stock_item ( name, code, base_uom )
  )
`

/** SQLSTATE 23505 = tekillik ihlali. Kod çakışmasını okunur hataya çeviriyoruz. */
const cakismaVarsaCevir = (hata: { code?: string } | null, kod: string) => {
  if(hata?.code === '23505') throw new ReceteKoduCakismasiError(kod)
}

/** ⚠️ Kiracı süzmesini BU SINIF yapmaz — RLS yapar (ADR-004). */
export class PostgresReceteDeposu implements ReceteDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async hepsi(_ctx: TenantCtx): Promise<Recete[]> {
    const { data, error } = await this.client
      .from('recipe').select(SECIM).order('code', { ascending: true })
    if(error) throw new Error(error.message)
    return ((data as unknown as ReceteKaydi[] | null) ?? []).map(receteyeCevir)
  }

  async tekil(_ctx: TenantCtx, id: string): Promise<Recete> {
    const { data, error } = await this.client
      .from('recipe').select(SECIM).eq('id', id).single()
    if(error) throw new Error(error.message)
    return receteyeCevir(data as unknown as ReceteKaydi)
  }

  async ekle(ctx: TenantCtx, girdi: ReceteGirdisi): Promise<Recete> {
    const { data, error } = await this.client
      .from('recipe')
      .insert({
        tenant_id: ctx.tenantId,
        code: girdi.kod,
        code_key: anahtarla(girdi.kod),
        name: girdi.ad,
        output_item_id: girdi.ciktiKalemiId,
        output_qty: girdi.ciktiMiktari,
        output_uom: girdi.ciktiBirimi,
        yield_pct: girdi.verim ?? 100,
        note: girdi.not ?? null,
      })
      .select('id')
      .single()
    cakismaVarsaCevir(error, girdi.kod)
    if(error) throw new Error(error.message)

    await this.satirlariYaz(ctx, (data as { id: string }).id, girdi, true)
    return this.tekil(ctx, (data as { id: string }).id)
  }

  async guncelle(ctx: TenantCtx, id: string, girdi: ReceteGirdisi): Promise<Recete> {
    const { error } = await this.client
      .from('recipe')
      .update({
        code: girdi.kod,
        code_key: anahtarla(girdi.kod),
        name: girdi.ad,
        output_item_id: girdi.ciktiKalemiId,
        output_qty: girdi.ciktiMiktari,
        output_uom: girdi.ciktiBirimi,
        yield_pct: girdi.verim ?? 100,
        note: girdi.not ?? null,
      })
      .eq('id', id)
    cakismaVarsaCevir(error, girdi.kod)
    if(error) throw new Error(error.message)

    await this.satirlariYaz(ctx, id, girdi, false)
    return this.tekil(ctx, id)
  }

  async durumDegistir(ctx: TenantCtx, id: string, durum: ReceteDurumu): Promise<Recete> {
    const { error } = await this.client.from('recipe').update({ status: durum }).eq('id', id)
    if(error) throw new Error(error.message)
    return this.tekil(ctx, id)
  }

  /**
   * Satırları toptan yeniler: önce sil, sonra yaz.
   *
   * Tarayıcıdan işlem (transaction) açamıyoruz. Bu yüzden YENİ reçetede satır
   * yazımı düşerse başlığı da siliyoruz — yarım bir reçete, hiç olmayandan
   * daha kötüdür. Güncellemede silmiyoruz: eski satırlar gitmiş olabilir ama
   * reçetenin kendisi ve ona bakan iş emirleri duruyor; kullanıcı kaydet'e
   * tekrar basar.
   */
  private async satirlariYaz(
    ctx: TenantCtx, receteId: string, girdi: ReceteGirdisi, yeni: boolean,
  ): Promise<void> {
    const { error: silmeHatasi } = await this.client
      .from('recipe_line').delete().eq('recipe_id', receteId)
    if(silmeHatasi) throw new Error(silmeHatasi.message)

    if(girdi.satirlar.length === 0) return

    const { error } = await this.client.from('recipe_line').insert(
      girdi.satirlar.map((s, i) => ({
        tenant_id: ctx.tenantId,
        recipe_id: receteId,
        line_no: i + 1,
        stock_item_id: s.stokKalemiId,
        qty: s.miktar,
        uom: s.birim,
        waste_pct: s.firePayi,
        note: s.not ?? null,
      })),
    )

    if(error){
      if(yeni) await this.client.from('recipe').delete().eq('id', receteId)
      throw new Error(error.message)
    }
  }
}
