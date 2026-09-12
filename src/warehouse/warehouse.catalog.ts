// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Aşama 2 / Depo çekirdeği — Stok kataloğu
//
// `StockRepository` yalnızca DEFTERİ tutar (hareketler ve onlardan türeyen
// bakiye). Ama bir depo ekranı defterden fazlasına ihtiyaç duyar: hangi
// kalemler var, hangi lotlar var, lotun son kullanma tarihi ne.
//
// Bu iki sorumluluğu bilerek AYRI tutuyoruz. Defterin sözleşmesi (ADR-001,
// I1–I12) kanıtlanmış ve sabit; katalog ise ekranın ihtiyacına göre büyüyecek
// bir okuma/yazma yüzeyidir. İkisini tek arayüze tıkıştırmak, kanıtlanmış
// sözleşmeyi her ekran değişikliğinde açmak demek olurdu.
//
// ── NEDEN BİR "PORT" ─────────────────────────────────────────────────────
// Arayüz (port) sayesinde servis testleri gerçek bir veritabanı olmadan
// koşabiliyor; ekran ise gerçek Postgres uygulamasını kullanıyor. Aynı desen
// `StockItemLookup` için de kullanılmıştı (G6.3).
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../core/context'

/** `stock_item` satırının ekranın ihtiyaç duyduğu alanları. */
export type KatalogKalemi = {
  id: string
  kod: string
  ad: string
  kategori?: string
  /** Defterin birimi. Hareketler bu birime çevrilerek toplanır (ADR-001). */
  temelBirim: string
  lotTakipli: boolean
  sktTakipli: boolean
  minMiktar: number
  aktif: boolean
}

/** `stock_lot` satırı. */
export type KatalogLotu = {
  id: string
  stokKalemiId: string
  kod: string
  /** `expires_on` — SKT. Yoksa lot tarihsizdir (FEFO'da en sona düşer). */
  sonKullanma?: string
  tedarikci?: string
  kaynakTipi: 'RECEIPT' | 'PRODUCTION' | 'OPENING'
}

export type YeniKalem = {
  kod: string
  ad: string
  kategori?: string
  temelBirim: string
  lotTakipli: boolean
  sktTakipli: boolean
  minMiktar?: number
}

export type YeniLot = {
  stokKalemiId: string
  kod: string
  sonKullanma?: string
  tedarikci?: string
  kaynakTipi?: 'RECEIPT' | 'PRODUCTION' | 'OPENING'
}

export type Birim = { kod: string; ad: string; boyut: string }

export interface StokKatalogu {
  kalemler(ctx: TenantCtx): Promise<KatalogKalemi[]>
  kalemEkle(ctx: TenantCtx, girdi: YeniKalem): Promise<KatalogKalemi>
  lotlar(ctx: TenantCtx, stokKalemiId: string): Promise<KatalogLotu[]>
  lotEkle(ctx: TenantCtx, girdi: YeniLot): Promise<KatalogLotu>
  birimler(): Promise<Birim[]>
}

/**
 * Kod alanlarının normalleştirilmiş hâli.
 *
 * Şemadaki tekillik kısıtı `code_key` / `lot_code_key` üzerinden kurulu
 * (0003). Türkçe yerel ayarıyla küçültme YAPILMAZ: `'ISTANBUL'.toLocaleLowerCase('tr-TR')`
 * → `'ıstanbul'` olur ve `'istanbul'` ile eşleşmez. Bu hata G1'de bir kez
 * yaşandı ve `core/identifier.ts` ile düzeltildi; aynı tuzağa burada
 * düşmüyoruz.
 */
const anahtar = (deger: string) => deger.trim().toLowerCase()

const bosaCevir = (deger: unknown): string | undefined => {
  const metin = typeof deger === 'string' ? deger.trim() : ''
  return metin === '' ? undefined : metin
}

type StockItemSatiri = {
  id: string
  code: string
  name: string
  category: string | null
  base_uom: string
  tracks_lot: boolean
  tracks_expiry: boolean
  min_qty: number | string
  is_active: boolean
}

type StockLotSatiri = {
  id: string
  stock_item_id: string
  lot_code: string
  expires_on: string | null
  supplier_name: string | null
  origin_type: string
}

const kalemeCevir = (satir: StockItemSatiri): KatalogKalemi => ({
  id: satir.id,
  kod: satir.code,
  ad: satir.name,
  kategori: bosaCevir(satir.category),
  temelBirim: satir.base_uom,
  lotTakipli: satir.tracks_lot,
  sktTakipli: satir.tracks_expiry,
  // Postgres `numeric` alanlarını supabase-js metin olarak döndürebilir;
  // sayıya çevirmeyi unutmak "120" + 1 = "1201" gibi sessiz hatalara yol açar.
  minMiktar: Number(satir.min_qty),
  aktif: satir.is_active,
})

const lotaCevir = (satir: StockLotSatiri): KatalogLotu => ({
  id: satir.id,
  stokKalemiId: satir.stock_item_id,
  kod: satir.lot_code,
  sonKullanma: bosaCevir(satir.expires_on),
  tedarikci: bosaCevir(satir.supplier_name),
  kaynakTipi: (satir.origin_type as KatalogLotu['kaynakTipi']),
})

/**
 * Postgres uygulaması.
 *
 * ⚠️ Kiracı süzmesini BU SINIF yapmaz — RLS yapar (ADR-004). Sorgulara
 * `tenant_id` eşitliği eklemiyoruz; eklersek "filtre var, demek ki güvenli"
 * yanılsaması doğar ve gerçek koruma olan RLS'in kapalı kalması fark edilmez.
 * `ctx.tenantId` yalnızca YAZARKEN, not-null sütunu doldurmak için kullanılır.
 */
export class PostgresStokKatalogu implements StokKatalogu {
  constructor(private readonly client: SupabaseClient) {}

  async kalemler(_ctx: TenantCtx): Promise<KatalogKalemi[]> {
    const { data, error } = await this.client
      .from('stock_item')
      .select('id, code, name, category, base_uom, tracks_lot, tracks_expiry, min_qty, is_active')
      .order('name', { ascending: true })

    if(error) throw new Error(`Stok kalemleri okunamadı: ${error.message}`)
    return ((data as StockItemSatiri[] | null) ?? []).map(kalemeCevir)
  }

  async kalemEkle(ctx: TenantCtx, girdi: YeniKalem): Promise<KatalogKalemi> {
    const { data, error } = await this.client
      .from('stock_item')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        code: girdi.kod.trim(),
        code_key: anahtar(girdi.kod),
        name: girdi.ad.trim(),
        category: girdi.kategori?.trim() || null,
        base_uom: girdi.temelBirim,
        tracks_lot: girdi.lotTakipli,
        tracks_expiry: girdi.sktTakipli,
        min_qty: girdi.minMiktar ?? 0,
      })
      .select('id, code, name, category, base_uom, tracks_lot, tracks_expiry, min_qty, is_active')
      .single()

    if(error){
      if(error.code === '23505'){
        throw new Error(`"${girdi.kod}" kodlu bir stok kalemi bu şubede zaten var.`)
      }
      throw new Error(`Stok kalemi oluşturulamadı: ${error.message}`)
    }
    return kalemeCevir(data as StockItemSatiri)
  }

  async lotlar(_ctx: TenantCtx, stokKalemiId: string): Promise<KatalogLotu[]> {
    const { data, error } = await this.client
      .from('stock_lot')
      .select('id, stock_item_id, lot_code, expires_on, supplier_name, origin_type')
      .eq('stock_item_id', stokKalemiId)

    if(error) throw new Error(`Lotlar okunamadı: ${error.message}`)
    return ((data as StockLotSatiri[] | null) ?? []).map(lotaCevir)
  }

  async lotEkle(ctx: TenantCtx, girdi: YeniLot): Promise<KatalogLotu> {
    const { data, error } = await this.client
      .from('stock_lot')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        stock_item_id: girdi.stokKalemiId,
        lot_code: girdi.kod.trim(),
        lot_code_key: anahtar(girdi.kod),
        expires_on: girdi.sonKullanma || null,
        supplier_name: girdi.tedarikci?.trim() || null,
        origin_type: girdi.kaynakTipi ?? 'RECEIPT',
      })
      .select('id, stock_item_id, lot_code, expires_on, supplier_name, origin_type')
      .single()

    if(error){
      if(error.code === '23505'){
        throw new Error(`"${girdi.kod}" lot kodu bu kalem için zaten kullanılmış.`)
      }
      throw new Error(`Lot oluşturulamadı: ${error.message}`)
    }
    return lotaCevir(data as StockLotSatiri)
  }

  async birimler(): Promise<Birim[]> {
    const { data, error } = await this.client
      .from('uom')
      .select('code, name, dimension')
      .order('code', { ascending: true })

    if(error) throw new Error(`Birimler okunamadı: ${error.message}`)
    return ((data as Array<{ code: string; name: string; dimension: string }>) ?? [])
      .map(satir => ({ kod: satir.code, ad: satir.name, boyut: satir.dimension }))
  }
}
