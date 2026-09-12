// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Dilim 0 / G6.5 — PostgresStockRepository
//
// db/migrations/0003_stok_defteri.sql şemasına karşı çalışır. RLS ve
// tetikleyiciler (I5, I8, I9) veritabanı tarafında ZATEN kurulu — burada
// yinelenmez. Bu sınıfın işi üçe iner:
//
//  1. I2/I4'ü veritabanının unique index'lerine YÖNLENDİRMEK: kendi
//     idempotency/tekil-ters-kayıt kontrolünü yapmaz, DB'nin `23505` (unique
//     violation) hatasını yakalayıp doğru sözleşme hatasına çevirir. Tek
//     gerçek kaynak veritabanı olsun diye — LocalStorageStockRepository'nin
//     TOCTOU sınırı (bkz. o dosyadaki not) burada yok.
//  2. I6/I7/I8'i INSERT'ten ÖNCE istemci tarafında da doğrulamak — hızlı
//     başarısızlık ve LocalStorageStockRepository ile birebir aynı hata
//     tipi/mesajı için. DB'nin kendi kısıtları/tetikleyicileri son sözü söyler
//     ve hâlâ ikinci bir savunma hattıdır.
//  3. Satır ↔ Movement dönüşümü.
//
// I12 (negatif bakiye politikası) — 2026-08-26'da DEĞİŞTİ, Codex incelemesi:
//
//   ESKİ HÂLİ: zorlama yalnızca bu sınıftaydı. Bunun iki kusuru vardı ve
//   ikisi de "bilinen sınır" diye yazıldıkları hâlde aslında I12'yi bir
//   invariant olmaktan çıkarıyordu:
//     (a) `0006_yetkiler.sql` her `authenticated` kullanıcıya `stock_movement`
//         üzerinde doğrudan INSERT veriyor. Repository'ye hiç uğramayan bir
//         REST çağrısı kontrolü tamamen atlıyordu.
//     (b) `quantityOf()` okuması ile `insert` arasında TOCTOU yarışı vardı:
//         iki terminal aynı bakiyeyi okuyup ikisi de geçebiliyordu.
//
//   YENİ HÂLİ: asıl zorlama `db/migrations/0011_negatif_bakiye_zorlamasi.sql`
//   içindeki `app.stock_movement_negative_guard()` tetikleyicisindedir.
//   Tetikleyici politikayı tenant satırından okur, yalnızca 'block' için
//   reddeder (yani 'warn'/'allow' esnekliği korunur — 0010'daki "veritabanına
//   konamaz" gerekçesi yanlıştı: bir `check` kısıtı politikayı okuyamaz ama
//   bir tetikleyici okuyabilir) ve `pg_advisory_xact_lock` ile TOCTOU'yu
//   kapatır.
//
//   Bu sınıftaki kontrol KALDI ama artık rolü değişti: bir invariant değil,
//   (1) hızlı başarısızlık, (2) LocalStorage ile birebir aynı hata tipi ve
//   (3) 'warn' politikasındaki `Movement.warning` metnini üretmek için.
//   Son sözü veritabanı söylüyor; yarış nedeniyle bu sınıfın kontrolü geçse
//   bile tetikleyici `MI012` ile reddeder ve o hata da aşağıda aynı
//   `NegativeBalanceBlockedError`'a çevrilir.
//
// ✅ ÖN KOŞUL KAPANDI (2026-08-26): RLS'in `tenant_id = app.current_tenant_id()`
// süzmesi için gereken JWT `tenant_id` claim'i artık üretiliyor —
// `0009_jwt_tenant_claim.sql` çalıştırıldı ve Supabase Dashboard'daki hook
// etkinleştirildi (`0013` ile pasif kullanıcı/askıdaki tenant için de
// sertleştirildi). Bu sınıf canlıda artık gerçek satır görür.
//
// ⚠️ KALAN SINIR: bu sınıf hâlâ CANLI bir Postgres'e karşı sözleşme testinden
// geçmedi — bugüne kadarki tüm testleri mock'lara karşı koştu. G7 ile
// birlikte yapılacak. `src/core/stock/index.ts` varsayılanının hâlâ "local"
// olmasının tek sebebi budur.
// ═══════════════════════════════════════════════════════════════════════════

import type { SupabaseClient } from '@supabase/supabase-js'
import type { TenantCtx } from '../context'
import {
  StockRepository,
  NewMovement,
  Movement,
  LotBalance,
  LotNode,
  DateRange,
  MovementReason,
  SourceType,
  DuplicateIdempotencyKeyError,
  MovementAlreadyReversedError,
  ZeroQuantityMovementError,
  LotRequiredError,
  UnknownStockItemError,
  MovementNotFoundError,
  NegativeBalanceBlockedError,
  NegativeStockPolicy,
} from './stock.repository'
import { convertUom } from './uom'

type StockMovementRow = {
  id: string
  tenant_id: string
  branch_id: string
  stock_item_id: string
  lot_id: string | null
  quantity_base: number | string
  quantity_entered: number | string
  uom_entered: string
  reason: string
  source_type: string
  source_id: string | null
  unit_cost: number | string | null
  currency: string | null
  reverses_movement_id: string | null
  idempotency_key: string
  occurred_at: string
  recorded_at: string
  created_by: string | null
  note: string | null
}

function toMovement(row: StockMovementRow): Movement {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id,
    stockItemId: row.stock_item_id,
    lotId: row.lot_id ?? undefined,
    quantityBase: Number(row.quantity_base),
    quantityEntered: Number(row.quantity_entered),
    uomEntered: row.uom_entered,
    reason: row.reason as MovementReason,
    sourceType: row.source_type as SourceType,
    sourceId: row.source_id ?? undefined,
    unitCost: row.unit_cost === null ? undefined : Number(row.unit_cost),
    currency: row.currency ?? undefined,
    reversesMovementId: row.reverses_movement_id ?? undefined,
    idempotencyKey: row.idempotency_key,
    occurredAt: new Date(row.occurred_at),
    recordedAt: new Date(row.recorded_at),
    createdBy: row.created_by ?? undefined,
    note: row.note ?? undefined,
  }
}

export class PostgresStockRepository implements StockRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  private async lookupItem(ctx: TenantCtx, stockItemId: string): Promise<{ baseUom: string; tracksLot: boolean }> {
    const { data, error } = await this.supabase
      .from('stock_item')
      .select('id, base_uom, tracks_lot')
      .eq('id', stockItemId)
      .eq('branch_id', ctx.branchId)
      .maybeSingle()

    if (error) {
      throw new Error(`stock_item okunamadı: ${error.message}`)
    }
    if (!data) {
      throw new UnknownStockItemError(stockItemId)
    }
    return { baseUom: data.base_uom as string, tracksLot: Boolean(data.tracks_lot) }
  }

  // I12 eki (2026-08-26) — db/migrations/0010_negatif_bakiye_politikasi.sql.
  // Satır bulunamazsa (ör. 0010 henüz çalıştırılmadıysa) en güvenli tarafa
  // düşer: `block`. LocalStorageStockRepository'nin varsayılanıyla aynı karar.
  private async negativeStockPolicyOf(ctx: TenantCtx): Promise<NegativeStockPolicy> {
    const { data, error } = await this.supabase
      .from('tenant')
      .select('negative_stock_policy')
      .eq('id', ctx.tenantId)
      .maybeSingle()

    if (error) {
      throw new Error(`Tenant politikası okunamadı: ${error.message}`)
    }
    return (data?.negative_stock_policy as NegativeStockPolicy | undefined) ?? 'block'
  }

  async postMovement(ctx: TenantCtx, m: NewMovement, idempotencyKey: string): Promise<Movement> {
    // I6 — istemci tarafında hızlı başarısızlık (bkz. dosya başı not 2).
    if (m.quantity === 0 || !Number.isFinite(m.quantity)) {
      throw new ZeroQuantityMovementError()
    }

    const item = await this.lookupItem(ctx, m.stockItemId)

    // I8 — istemci tarafında hızlı başarısızlık; DB tetikleyicisi son sözü söyler.
    if (item.tracksLot && !m.lotId) {
      throw new LotRequiredError(m.stockItemId)
    }

    // I7 — aynı dönüşüm tablosu Local ile paylaşılıyor (uom.ts), iki
    // uygulama farklı sonuç vermesin diye.
    const quantityBase = convertUom(m.quantity, m.uom, item.baseUom)

    // I12 — negatif bakiye politikası. `reverseMovement()` BİLİNÇLİ olarak bu
    // kontrolden muaf — I3 I12'den önceliklidir (bkz. LocalStorageStockRepository'deki
    // aynı not). Politika sorgusu yalnızca gerçekten gerekince (bakiye negatife
    // düşecekse) yapılıyor — sağlıklı yazımlarda ekstra sorgu yok.
    const currentQty = await this.quantityOf(ctx, m.stockItemId)
    const resultingQty = currentQty + quantityBase
    let warning: string | undefined
    if (resultingQty < 0) {
      const policy = await this.negativeStockPolicyOf(ctx)
      if (policy === 'block') {
        throw new NegativeBalanceBlockedError(m.stockItemId, resultingQty)
      }
      if (policy === 'warn') {
        warning = `Bu hareket bakiyeyi negatife düşürdü: ${resultingQty} ${item.baseUom}`
      }
    }

    const now = new Date()

    const { data, error } = await this.supabase
      .from('stock_movement')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: ctx.branchId,
        stock_item_id: m.stockItemId,
        lot_id: m.lotId ?? null,
        quantity_base: quantityBase,
        quantity_entered: m.quantity,
        uom_entered: m.uom,
        reason: m.reason,
        source_type: m.sourceType,
        source_id: m.sourceId ?? null,
        unit_cost: m.unitCost ?? null,
        currency: m.currency ?? null,
        idempotency_key: idempotencyKey,
        occurred_at: (m.occurredAt ?? now).toISOString(),
        created_by: ctx.userId,
        note: m.note ?? null,
      })
      .select()
      .single()

    if (error) {
      // ⚠️ HATA KODU ÇEVİRİSİ — 2026-08-26'da daraltıldı (Codex bulgusu).
      // Eski hâli `23502` gören her hatayı LotRequiredError, `23514` gören
      // her hatayı ZeroQuantityMovementError sayıyordu. İkisi de GENEL
      // PostgreSQL kodları: `23502` şemadaki HERHANGİ bir not-null ihlali,
      // `23514` HERHANGİ bir check ihlali (ör. `reason` listesi dışında bir
      // değer) için de döner. Alakasız bir veritabanı hatası, kullanıcıya
      // "lot zorunlu" ya da "miktar sıfır olamaz" diye YANLIŞ gösteriliyordu.
      // Artık her biri kendi kesin kaynağına bağlı; eşleşmeyen hata genel
      // hata olarak korunuyor.

      // I2 — stock_movement_idempotency_unique (tenant_id, idempotency_key).
      if (error.code === '23505') {
        throw new DuplicateIdempotencyKeyError(idempotencyKey)
      }

      // I8 — app.stock_movement_requires_lot() tetikleyicisi.
      // `MI008` 0011 ile geldi. `23502` + mesaj eşleşmesi, 0011'in henüz
      // çalıştırılmadığı kurulumlar için geriye dönük yol (0003'teki ilk
      // hâli genel `not_null_violation` kullanıyordu).
      if (error.code === 'MI008') {
        throw new LotRequiredError(m.stockItemId)
      }
      if (error.code === '23502' && /lot/i.test(error.message)) {
        throw new LotRequiredError(m.stockItemId)
      }

      // I12 — app.stock_movement_negative_guard() tetikleyicisi (0011).
      // Bu sınıfın kendi kontrolü yukarıda geçmiş olsa bile buraya
      // düşebiliriz: eşzamanlı bir yazma araya girdiyse son sözü veritabanı
      // söyler. Sözleşme açısından fark yok — aynı hata tipi fırlatılır.
      if (error.code === 'MI012') {
        throw new NegativeBalanceBlockedError(m.stockItemId, resultingQty)
      }

      // I6 — stock_movement_quantity_base_check (quantity_base <> 0).
      // Constraint adı hata mesajında geçer; `reason` check'iyle karışmasın diye
      // yalnızca o eşleşirse çevriliyor.
      if (error.code === '23514' && /quantity_base/i.test(error.message)) {
        throw new ZeroQuantityMovementError()
      }

      throw new Error(`Hareket yazılamadı: ${error.message}`)
    }

    const movement = toMovement(data as StockMovementRow)
    // I12 — `warning` şemada yok, yalnızca yazma anında döndürülen nesnede
    // taşınır (bkz. stock.repository.ts Movement.warning notu).
    return warning ? { ...movement, warning } : movement
  }

  async reverseMovement(ctx: TenantCtx, movementId: string, idempotencyKey: string): Promise<Movement> {
    const { data: originalRow, error: findError } = await this.supabase
      .from('stock_movement')
      .select('*')
      .eq('id', movementId)
      .eq('branch_id', ctx.branchId)
      .maybeSingle()

    if (findError) {
      throw new Error(`Hareket okunamadı: ${findError.message}`)
    }
    if (!originalRow) {
      throw new MovementNotFoundError(movementId)
    }

    const original = toMovement(originalRow as StockMovementRow)
    const now = new Date()

    const { data, error } = await this.supabase
      .from('stock_movement')
      .insert({
        tenant_id: ctx.tenantId,
        branch_id: original.branchId,
        stock_item_id: original.stockItemId,
        lot_id: original.lotId ?? null,
        quantity_base: -original.quantityBase,
        quantity_entered: -original.quantityEntered,
        uom_entered: original.uomEntered,
        reason: 'REVERSAL',
        source_type: original.sourceType,
        source_id: original.sourceId ?? null,
        unit_cost: original.unitCost ?? null,
        currency: original.currency ?? null,
        reverses_movement_id: original.id,
        idempotency_key: idempotencyKey,
        occurred_at: now.toISOString(),
        created_by: ctx.userId,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        // I4 — stock_movement_reversal_once (kısmi tekil indeks) mi,
        // yoksa I2 — idempotency_key mi? Constraint adına bakarak ayırıyoruz.
        if (/reversal_once/.test(error.message)) {
          throw new MovementAlreadyReversedError(movementId)
        }
        throw new DuplicateIdempotencyKeyError(idempotencyKey)
      }
      throw new Error(`Ters kayıt yazılamadı: ${error.message}`)
    }

    return toMovement(data as StockMovementRow)
  }

  async quantityOf(ctx: TenantCtx, stockItemId: string, at?: Date): Promise<number> {
    let query = this.supabase
      .from('stock_movement')
      .select('quantity_base')
      .eq('branch_id', ctx.branchId)
      .eq('stock_item_id', stockItemId)

    if (at) {
      query = query.lte('occurred_at', at.toISOString())
    }

    const { data, error } = await query
    if (error) {
      throw new Error(`Bakiye okunamadı: ${error.message}`)
    }
    return (data ?? []).reduce((sum: number, row: { quantity_base: number | string }) => sum + Number(row.quantity_base), 0)
  }

  async ledgerOf(ctx: TenantCtx, stockItemId: string, range?: DateRange): Promise<Movement[]> {
    let query = this.supabase
      .from('stock_movement')
      .select('*')
      .eq('branch_id', ctx.branchId)
      .eq('stock_item_id', stockItemId)
      .order('occurred_at', { ascending: true })

    if (range) {
      query = query.gte('occurred_at', range.from.toISOString()).lte('occurred_at', range.to.toISOString())
    }

    const { data, error } = await query
    if (error) {
      throw new Error(`Defter okunamadı: ${error.message}`)
    }
    return (data ?? []).map((row: StockMovementRow) => toMovement(row))
  }

  async lotBalances(ctx: TenantCtx, stockItemId: string): Promise<LotBalance[]> {
    // stock_lot_balance görünümü zaten security_invoker=on (0006) — RLS
    // sorguyu çağıranın yetkisiyle çalıştırır.
    const { data, error } = await this.supabase
      .from('stock_lot_balance')
      .select('lot_id, qty')
      .eq('branch_id', ctx.branchId)
      .eq('stock_item_id', stockItemId)

    if (error) {
      throw new Error(`Lot bakiyeleri okunamadı: ${error.message}`)
    }
    return (data ?? []).map((row: { lot_id: string; qty: number | string }) => ({
      stockItemId,
      lotId: row.lot_id,
      qty: Number(row.qty),
    }))
  }

  async lotGenealogy(_ctx: TenantCtx, _lotCode: string): Promise<LotNode[]> {
    // Dilim 5 kapsamı — bkz. stock.localstorage.ts'teki aynı not.
    // `lot_genealogy` tablosu şemada var (0003) ama şu an hiçbir yol ona
    // yazmıyor; veri olmadan burada "gerçek" bir özyinelemeli sorgu yazmak
    // erken olur ve test edilemez. I1-I12'nin hiçbiri bunu sınamıyor.
    return []
  }
}
