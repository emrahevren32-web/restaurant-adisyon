// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 3 / İzlenebilirlik — Soyağacı okuma kaynağı (Postgres)
//
// ⚠️ Bu sınıf yalnızca OKUR. Deftere yazan tek kapı `postMovement()`'tır
// (ADR-001, mimari test); burada hiçbir yazma yok.
//
// `stock_movement` tablosuna doğrudan soruyoruz çünkü soyağacının sorduğu
// şeyler kalem bazlı değil: "şu belgenin hareketleri", "şu lota girenler".
// `StockRepository.ledgerOf()` kalem bazlıdır ve bu sorulara cevap veremez.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'
import type {
  SoyagaciHareketi, SoyagaciKaynagi, SoyagaciLotu,
} from './genealogy'

const metin = (d: unknown): string | undefined => {
  const s = typeof d === 'string' ? d.trim() : ''
  return s === '' ? undefined : s
}
const sayi = (d: unknown): number => {
  const n = Number(d)
  return Number.isFinite(n) ? n : 0
}

type LotKaydi = {
  id: string; lot_code: string; stock_item_id: string
  expires_on: string | null; origin_type: string; supplier_name: string | null
  stock_item?: { name: string } | null
}

type HareketKaydi = {
  id: string; stock_item_id: string; lot_id: string | null
  quantity_base: number | string; reason: string
  source_type: string; source_id: string | null; occurred_at: string
}

const lotaCevir = (k: LotKaydi): SoyagaciLotu => ({
  lotId: k.id,
  lotKodu: k.lot_code,
  stokKalemiId: k.stock_item_id,
  stokKalemiAd: k.stock_item?.name ?? k.stock_item_id,
  sonKullanma: k.expires_on ?? undefined,
  kaynakTipi: k.origin_type as SoyagaciLotu['kaynakTipi'],
  tedarikci: metin(k.supplier_name),
})

const harekeceCevir = (k: HareketKaydi): SoyagaciHareketi => ({
  id: k.id,
  stokKalemiId: k.stock_item_id,
  lotId: k.lot_id ?? undefined,
  miktar: sayi(k.quantity_base),
  neden: k.reason,
  kaynakTipi: k.source_type,
  kaynakId: k.source_id ?? undefined,
  tarih: k.occurred_at,
})

const LOT_SECIM = 'id, lot_code, stock_item_id, expires_on, origin_type, supplier_name, stock_item ( name )'
const HAREKET_SECIM = 'id, stock_item_id, lot_id, quantity_base, reason, source_type, source_id, occurred_at'

/** ⚠️ Kiracı süzmesini BU SINIF yapmaz — RLS yapar (ADR-004). */
export class PostgresSoyagaciKaynagi implements SoyagaciKaynagi {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Lot bilgisi önbelleğe alınıyor.
   *
   * Soyağacı özyinelemeli iniyor ve aynı partiyi birden çok dalda sorabiliyor.
   * Önbelleksiz, altı kademelik bir zincirde onlarca gereksiz sorgu olurdu.
   * Önbellek yalnızca BU çıkarım süresince yaşıyor — ekran her açılışta yeni
   * bir kaynak kuruyor, bayat veri riski yok.
   */
  private readonly lotOnbellegi = new Map<string, SoyagaciLotu | null>()

  async lot(_ctx: TenantCtx, lotId: string): Promise<SoyagaciLotu | null> {
    if(this.lotOnbellegi.has(lotId)) return this.lotOnbellegi.get(lotId)!

    const { data, error } = await this.client
      .from('stock_lot').select(LOT_SECIM).eq('id', lotId).maybeSingle()
    if(error) throw new Error(error.message)

    const lot = data ? lotaCevir(data as unknown as LotKaydi) : null
    this.lotOnbellegi.set(lotId, lot)
    return lot
  }

  /**
   * Lot arama.
   *
   * Geri çağırmada elde genellikle tek bir şey olur: ambalajın üstündeki lot
   * numarası. Bu yüzden arama LOT KODUNDAN başlıyor; kalem adı ikincil.
   */
  async lotAra(_ctx: TenantCtx, arama: string): Promise<SoyagaciLotu[]> {
    const temiz = arama.trim()
    const { data, error } = await this.client
      .from('stock_lot').select(LOT_SECIM)
      .ilike('lot_code', `%${temiz}%`)
      .order('created_at', { ascending: false })
      .limit(50)
    if(error) throw new Error(error.message)
    return ((data as unknown as LotKaydi[] | null) ?? []).map(lotaCevir)
  }

  async lotaGirisler(_ctx: TenantCtx, lotId: string): Promise<SoyagaciHareketi[]> {
    const { data, error } = await this.client
      .from('stock_movement').select(HAREKET_SECIM)
      .eq('lot_id', lotId).gt('quantity_base', 0)
      .order('occurred_at', { ascending: true })
    if(error) throw new Error(error.message)
    return ((data as unknown as HareketKaydi[] | null) ?? []).map(harekeceCevir)
  }

  async lottanCikislar(_ctx: TenantCtx, lotId: string): Promise<SoyagaciHareketi[]> {
    const { data, error } = await this.client
      .from('stock_movement').select(HAREKET_SECIM)
      .eq('lot_id', lotId).lt('quantity_base', 0)
      .order('occurred_at', { ascending: true })
    if(error) throw new Error(error.message)
    return ((data as unknown as HareketKaydi[] | null) ?? []).map(harekeceCevir)
  }

  async belgeninHareketleri(_ctx: TenantCtx, kaynakId: string): Promise<SoyagaciHareketi[]> {
    const { data, error } = await this.client
      .from('stock_movement').select(HAREKET_SECIM)
      .eq('source_id', kaynakId)
      .order('occurred_at', { ascending: true })
    if(error) throw new Error(error.message)
    return ((data as unknown as HareketKaydi[] | null) ?? []).map(harekeceCevir)
  }

  private readonly isEmriOnbellegi = new Map<string, string | undefined>()

  async isEmriNo(_ctx: TenantCtx, isEmriId: string): Promise<string | undefined> {
    if(this.isEmriOnbellegi.has(isEmriId)) return this.isEmriOnbellegi.get(isEmriId)

    const { data, error } = await this.client
      .from('work_order').select('order_no').eq('id', isEmriId).maybeSingle()
    // İş emri bulunamaması bir hata DEĞİLDİR: hareket elle girilmiş olabilir.
    const no = error ? undefined : metin((data as { order_no?: string } | null)?.order_no)
    this.isEmriOnbellegi.set(isEmriId, no)
    return no
  }
}
