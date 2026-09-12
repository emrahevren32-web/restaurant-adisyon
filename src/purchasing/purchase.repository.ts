// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 — Satın alma deposu (port + Postgres uygulaması)
//
// Depo çekirdeğindeki `StokKatalogu` ve `TedarikciDeposu` ile aynı biçim.
// Ekran arayüze konuşur, testler belleğe konuşur, ikisi de aynı sözleşmeyi
// doğrular (ADR-003).
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'
import type {
  Siparis,
  SiparisDurumu,
  SiparisSatiri,
  Talep,
  TalepDurumu,
  TalepSatiri,
} from './purchase.types'

export type YeniTalep = {
  talepNo: string
  gerekenTarih?: string
  not?: string
  satirlar: Array<Omit<TalepSatiri, 'id' | 'siraNo' | 'stokKalemiAd'>>
}

export type YeniSiparis = {
  siparisNo: string
  tedarikciId: string
  talepId?: string
  paraBirimi?: string
  beklenenTarih?: string
  not?: string
  satirlar: Array<Omit<SiparisSatiri, 'id' | 'siraNo' | 'stokKalemiAd'>>
}

export interface SatinAlmaDeposu {
  talepler(ctx: TenantCtx): Promise<Talep[]>
  talepEkle(ctx: TenantCtx, girdi: YeniTalep): Promise<Talep>
  talepDurumDegistir(
    ctx: TenantCtx, id: string, durum: TalepDurumu, kararNotu?: string,
  ): Promise<Talep>

  siparisler(ctx: TenantCtx): Promise<Siparis[]>
  siparisEkle(ctx: TenantCtx, girdi: YeniSiparis): Promise<Siparis>
  siparisDurumDegistir(ctx: TenantCtx, id: string, durum: SiparisDurumu): Promise<Siparis>
}

const metin = (deger: unknown): string | undefined => {
  const s = typeof deger === 'string' ? deger.trim() : ''
  return s === '' ? undefined : s
}

// Postgres `numeric` alanlarını supabase-js METİN olarak döndürebilir.
// Sayıya çevirmeyi unutmak "120" + 1 = "1201" gibi sessiz hatalara yol açar —
// ve sipariş toplamında bu, yanlış bir para tutarı demektir.
const sayi = (deger: unknown): number => {
  const n = Number(deger)
  return Number.isFinite(n) ? n : 0
}

type TalepSatirSatiri = {
  id: string; stock_item_id: string; qty: number | string
  uom: string; note: string | null; line_no: number
  stock_item?: { name: string } | null
}

type TalepKaydi = {
  id: string; request_no: string; status: string; needed_by: string | null
  note: string | null; decision_note: string | null
  created_by: string | null; decided_by: string | null; decided_at: string | null
  created_at: string
  purchase_request_line: TalepSatirSatiri[] | null
}

type SiparisSatirSatiri = {
  id: string; stock_item_id: string; qty: number | string; uom: string
  unit_price: number | string; note: string | null; line_no: number
  stock_item?: { name: string } | null
}

type SiparisKaydi = {
  id: string; order_no: string; status: string; supplier_id: string
  request_id: string | null; currency: string; expected_date: string | null
  note: string | null; sent_at: string | null; created_at: string
  supplier?: { name: string } | null
  purchase_order_line: SiparisSatirSatiri[] | null
}

/** Satırlar her zaman sıra numarasına göre — ekranda sıra kaymamalı. */
const siraya = <T extends { siraNo: number }>(satirlar: T[]): T[] =>
  [...satirlar].sort((a, b) => a.siraNo - b.siraNo)

const talebeCevir = (k: TalepKaydi): Talep => ({
  id: k.id,
  talepNo: k.request_no,
  durum: k.status as TalepDurumu,
  gerekenTarih: metin(k.needed_by),
  not: metin(k.note),
  kararNotu: metin(k.decision_note),
  olusturanId: metin(k.created_by),
  kararVerenId: metin(k.decided_by),
  kararTarihi: metin(k.decided_at),
  olusturmaTarihi: k.created_at,
  satirlar: siraya((k.purchase_request_line ?? []).map(s => ({
    id: s.id,
    stokKalemiId: s.stock_item_id,
    stokKalemiAd: s.stock_item?.name,
    miktar: sayi(s.qty),
    birim: s.uom,
    not: metin(s.note),
    siraNo: s.line_no,
  }))),
})

const siparisceCevir = (k: SiparisKaydi): Siparis => ({
  id: k.id,
  siparisNo: k.order_no,
  durum: k.status as SiparisDurumu,
  tedarikciId: k.supplier_id,
  tedarikciAd: k.supplier?.name,
  talepId: metin(k.request_id),
  paraBirimi: k.currency,
  beklenenTarih: metin(k.expected_date),
  not: metin(k.note),
  gonderimTarihi: metin(k.sent_at),
  olusturmaTarihi: k.created_at,
  satirlar: siraya((k.purchase_order_line ?? []).map(s => ({
    id: s.id,
    stokKalemiId: s.stock_item_id,
    stokKalemiAd: s.stock_item?.name,
    miktar: sayi(s.qty),
    birim: s.uom,
    birimFiyat: sayi(s.unit_price),
    not: metin(s.note),
    siraNo: s.line_no,
  }))),
})

const TALEP_SECIM = `
  id, request_no, status, needed_by, note, decision_note,
  created_by, decided_by, decided_at, created_at,
  purchase_request_line ( id, stock_item_id, qty, uom, note, line_no, stock_item ( name ) )
`

const SIPARIS_SECIM = `
  id, order_no, status, supplier_id, request_id, currency, expected_date,
  note, sent_at, created_at,
  supplier ( name ),
  purchase_order_line ( id, stock_item_id, qty, uom, unit_price, note, line_no, stock_item ( name ) )
`

const TEKILLIK_IHLALI = '23505'

export class BelgeNoCakismasiError extends Error {
  constructor(no: string) {
    super(`"${no}" numarası zaten kullanılıyor.`)
    this.name = 'BelgeNoCakismasiError'
  }
}

const cakismaVarsaCevir = (hata: { code?: string; message: string }, no: string): Error =>
  hata.code === TEKILLIK_IHLALI
    ? new BelgeNoCakismasiError(no)
    : new Error(`Kaydedilemedi: ${hata.message}`)

/**
 * Postgres uygulaması.
 *
 * ⚠️ Kiracı süzmesini BU SINIF yapmaz — RLS yapar (ADR-004). Sorgulara
 * `tenant_id` eşitliği eklenmiyor; eklersek "filtre var, demek ki güvenli"
 * yanılsaması doğar ve asıl koruma olan RLS'in kapalı kalması fark edilmez.
 * `ctx` yalnızca YAZARKEN not-null sütunları doldurmak için kullanılır.
 */
export class PostgresSatinAlmaDeposu implements SatinAlmaDeposu {
  constructor(private readonly client: SupabaseClient) {}

  async talepler(_ctx: TenantCtx): Promise<Talep[]> {
    const { data, error } = await this.client
      .from('purchase_request')
      .select(TALEP_SECIM)
      .order('created_at', { ascending: false })

    if(error) throw new Error(`Talepler okunamadı: ${error.message}`)
    return ((data as unknown as TalepKaydi[] | null) ?? []).map(talebeCevir)
  }

  async talepEkle(ctx: TenantCtx, girdi: YeniTalep): Promise<Talep> {
    const { data, error } = await this.client
      .from('purchase_request')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        request_no: girdi.talepNo.trim(),
        status: 'DRAFT',
        needed_by: girdi.gerekenTarih || null,
        note: girdi.not?.trim() || null,
        created_by: ctx.userId,
      })
      .select('id')
      .single()

    if(error) throw cakismaVarsaCevir(error, girdi.talepNo)

    const talepId = (data as { id: string }).id
    await this.satirlariYaz('purchase_request_line', ctx, talepId, 'request_id',
      girdi.satirlar.map((s, i) => ({
        stock_item_id: s.stokKalemiId,
        qty: s.miktar,
        uom: s.birim,
        note: s.not?.trim() || null,
        line_no: i + 1,
      })))

    return this.talebiGetir(talepId)
  }

  async talepDurumDegistir(
    _ctx: TenantCtx, id: string, durum: TalepDurumu, kararNotu?: string,
  ): Promise<Talep> {
    // Karar veren ve tarih yalnızca gerçek bir KARARDA yazılır. İptal bir karar
    // değil, geri çekmedir; onay kutusunu iptalle doldurmak "kim onayladı"
    // sorusunu yanlış cevaplardı.
    const karar = durum === 'APPROVED' || durum === 'REJECTED'
    const { error } = await this.client
      .from('purchase_request')
      .update({
        status: durum,
        decision_note: kararNotu?.trim() || null,
        ...(karar ? { decided_by: _ctx.userId, decided_at: new Date().toISOString() } : {}),
      })
      .eq('id', id)

    if(error) throw new Error(`Talep durumu değiştirilemedi: ${error.message}`)
    return this.talebiGetir(id)
  }

  async siparisler(_ctx: TenantCtx): Promise<Siparis[]> {
    const { data, error } = await this.client
      .from('purchase_order')
      .select(SIPARIS_SECIM)
      .order('created_at', { ascending: false })

    if(error) throw new Error(`Siparişler okunamadı: ${error.message}`)
    return ((data as unknown as SiparisKaydi[] | null) ?? []).map(siparisceCevir)
  }

  async siparisEkle(ctx: TenantCtx, girdi: YeniSiparis): Promise<Siparis> {
    const { data, error } = await this.client
      .from('purchase_order')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        order_no: girdi.siparisNo.trim(),
        supplier_id: girdi.tedarikciId,
        request_id: girdi.talepId || null,
        status: 'DRAFT',
        currency: girdi.paraBirimi || 'TRY',
        expected_date: girdi.beklenenTarih || null,
        note: girdi.not?.trim() || null,
        created_by: ctx.userId,
      })
      .select('id')
      .single()

    if(error) throw cakismaVarsaCevir(error, girdi.siparisNo)

    const siparisId = (data as { id: string }).id
    await this.satirlariYaz('purchase_order_line', ctx, siparisId, 'order_id',
      girdi.satirlar.map((s, i) => ({
        stock_item_id: s.stokKalemiId,
        qty: s.miktar,
        uom: s.birim,
        unit_price: s.birimFiyat,
        note: s.not?.trim() || null,
        line_no: i + 1,
      })))

    return this.siparisiGetir(siparisId)
  }

  async siparisDurumDegistir(_ctx: TenantCtx, id: string, durum: SiparisDurumu): Promise<Siparis> {
    const { error } = await this.client
      .from('purchase_order')
      .update({
        status: durum,
        ...(durum === 'SENT' ? { sent_at: new Date().toISOString() } : {}),
      })
      .eq('id', id)

    if(error) throw new Error(`Sipariş durumu değiştirilemedi: ${error.message}`)
    return this.siparisiGetir(id)
  }

  /**
   * Satırları yazar; yazamazsa başlığı GERİ ALIR.
   *
   * Tarayıcıdan işlem (transaction) açamıyoruz: supabase-js tek tek istek
   * gönderir. Bu yüzden başlık yazılıp satırlar düşerse ortada kalemsiz bir
   * talep kalırdı — kullanıcı "kaydettim" der, ekranda boş bir belge durur.
   * Elle geri alma bir işlemin yerini tutmaz ama sessiz bozuk kaydı önler.
   *
   * Kalıcı çözüm bir Postgres fonksiyonudur (tek çağrıda başlık + satırlar);
   * mal kabul maddesinde o yol zaten gerekecek ve ikisi birlikte taşınacak.
   */
  private async satirlariYaz(
    tablo: string,
    ctx: TenantCtx,
    baslikId: string,
    baslikAlani: string,
    satirlar: Array<Record<string, unknown>>,
  ): Promise<void> {
    if(satirlar.length === 0) return

    const { error } = await this.client
      .from(tablo)
      .insert(satirlar.map(s => ({ tenant_id: ctx.tenantId, [baslikAlani]: baslikId, ...s })))

    if(error){
      const baslikTablosu = tablo === 'purchase_request_line' ? 'purchase_request' : 'purchase_order'
      await this.client.from(baslikTablosu).delete().eq('id', baslikId)
      throw new Error(`Kalemler kaydedilemedi, belge geri alındı: ${error.message}`)
    }
  }

  private async talebiGetir(id: string): Promise<Talep> {
    const { data, error } = await this.client
      .from('purchase_request').select(TALEP_SECIM).eq('id', id).single()
    if(error) throw new Error(`Talep okunamadı: ${error.message}`)
    return talebeCevir(data as unknown as TalepKaydi)
  }

  private async siparisiGetir(id: string): Promise<Siparis> {
    const { data, error } = await this.client
      .from('purchase_order').select(SIPARIS_SECIM).eq('id', id).single()
    if(error) throw new Error(`Sipariş okunamadı: ${error.message}`)
    return siparisceCevir(data as unknown as SiparisKaydi)
  }
}
