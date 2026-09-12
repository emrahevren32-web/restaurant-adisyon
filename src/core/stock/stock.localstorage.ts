// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Dilim 0 / G6.3 — LocalStorageStockRepository
//
// ÖNEMLİ NOT (2026-08-25): dilim-0-gorevler.md'deki G6.3 tanımı "bugünkü
// storage.ts kodunu arayüzün arkasına taşı, davranışı değiştirme" diyordu.
// Bu varsayım incelemede yanlış çıktı: bugünkü `StockMovement`/`StockItem`
// modeli (bkz. `types.ts`) tam olarak ADR-001'in REDDETTİĞİ modeldir —
// `StockItem.currentQty` gerçek kabul edilir, `StockMovement` yalnızca
// `previousQty`/`nextQty` ile sonradan yazılan bir günlüktür. Bugünkü kodda
// idempotency kontrolü, tekil ters kayıt zorunluluğu, append-only zorlaması
// gibi I1-I12'nin gerektirdiği hiçbir şey yok (`stockDeduction.ts` tanımlı
// ama hiçbir yerden çağrılmıyor — ADR-001 "Bağlam" bölümü bunu zaten tespit
// etmişti).
//
// Bu yüzden bu sınıf bir TAŞIMA değil, ADR-001'e göre YENİ, bağımsız bir
// uygulamadır. Legacy `ra_stock_movements`/`ra_stock_items` anahtarlarına HİÇ
// dokunmaz — kendi ayrı anahtarında kendi defterini tutar. Legacy stok
// ekranlarının bu depoya bağlanması Dilim 1'in işidir, G6'nın değil.
//
// Sözleşme testlerinden (G6.4, I1-I12) PostgresStockRepository ile birebir
// aynı sonuçları vermesi beklenir.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../context'
import {
  StockRepository,
  NewMovement,
  Movement,
  LotBalance,
  LotNode,
  DateRange,
  DuplicateIdempotencyKeyError,
  MovementAlreadyReversedError,
  ZeroQuantityMovementError,
  LotRequiredError,
  UnknownStockItemError,
  MovementNotFoundError,
  NegativeBalanceBlockedError,
} from './stock.repository'
import { convertUom } from './uom'
import type { StockItemLookup } from './stock-item-lookup'
import type { TenantPolicyLookup } from './tenant-policy-lookup'
import { FixedTenantPolicyLookup } from './tenant-policy-lookup'

const STORAGE_KEY = 'miyop_core_stock_movements_v1'

// `warning` BİLEREK dışarıda: yazma anına ait bir ekran ipucudur, defterin bir
// parçası değildir (bkz. stock.repository.ts'teki Movement.warning sözleşmesi).
// Saklanırsa `ledgerOf()` onu geri okur ve bu uygulama, Postgres uygulamasından
// farklı davranmış olur — aynı sözleşme testlerinden geçmesi gereken iki
// uygulamada kabul edilemez bir sapma (Codex incelemesi, 2026-08-26).
type StoredMovement = Omit<Movement, 'occurredAt' | 'recordedAt' | 'warning'> & {
  occurredAt: string
  recordedAt: string
}

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function readStore(): StoredMovement[] {
  if (typeof localStorage === 'undefined') {
    return []
  }
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return []
  }
  try {
    return JSON.parse(raw) as StoredMovement[]
  } catch {
    return []
  }
}

function writeStore(rows: StoredMovement[]): void {
  if (typeof localStorage === 'undefined') {
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows))
}

function toMovement(row: StoredMovement): Movement {
  return { ...row, occurredAt: new Date(row.occurredAt), recordedAt: new Date(row.recordedAt) }
}

function toStored(m: Movement): StoredMovement {
  // `warning` yazılmadan önce DÜŞÜRÜLÜR — yukarıdaki StoredMovement notuna bakın.
  const { warning: _warning, ...rest } = m
  return { ...rest, occurredAt: m.occurredAt.toISOString(), recordedAt: m.recordedAt.toISOString() }
}

// KNOWN LİMİT (Codex incelemesi, 2026-08-25): `readStore → kontrol → push →
// writeStore` bu sınıfın içinde atomik DEĞİL. Aynı sekmede/aynı JS
// context'inde await olmadan ardışık çalıştığı için tek sekmede güvenli, ama
// iki sekme/pencere TAM AYNI ANDA aynı idempotency key veya aynı hareketi
// ters çevirmeye çalışırsa (TOCTOU) ikisi de "yok" görüp ikisi de yazabilir.
// localStorage'ın kendi başına atomik compare-and-swap'ı yok. Postgres
// uygulamasında bunu unique index zorluyor (I2/I4); localStorage'da tam
// eşdeğeri yok. Dilim 0'da tek kullanıcı/tek sekme varsayımıyla kabul
// edildi — çok sekmeli kullanım gerçek bir ihtiyaç olursa (BroadcastChannel
// kilidi veya IndexedDB transaction'ı ile) ayrı bir iş olarak ele alınmalı.
export class LocalStorageStockRepository implements StockRepository {
  constructor(
    private readonly items: StockItemLookup,
    // I12 eki (2026-08-26) — verilmezse en güvenli tarafa düşer: `block`.
    // Mevcut çağıranlar (bu parametreyi bilmeyen) davranışı SESSİZCE değişir:
    // artık negatif bakiyeye giden hareketler reddedilir. Bilinçli bir tercih —
    // "sessizce negatif bakiye üretmek" den "varsayılan olarak reddetmek" daha
    // güvenli bir varsayılan hatadır.
    private readonly tenantPolicy: TenantPolicyLookup = new FixedTenantPolicyLookup('block'),
  ) {}

  async postMovement(ctx: TenantCtx, m: NewMovement, idempotencyKey: string): Promise<Movement> {
    const rows = readStore()

    // I2 — aynı (tenant, idempotency key) ikinci kez yazılamaz.
    const duplicate = rows.find(r => r.tenantId === ctx.tenantId && r.idempotencyKey === idempotencyKey)
    if (duplicate) {
      throw new DuplicateIdempotencyKeyError(idempotencyKey)
    }

    // I6 — sıfır VEYA geçersiz (NaN/Infinity) miktarlı hareket yazılamaz.
    // NaN/Infinity JSON.stringify'da sessizce `null`a döner ve deftere anlamsız
    // bir kayıt sızdırabilirdi (Codex incelemesi, 2026-08-25).
    if (m.quantity === 0 || !Number.isFinite(m.quantity)) {
      throw new ZeroQuantityMovementError()
    }

    const item = this.items.get(ctx, m.stockItemId)
    if (!item) {
      throw new UnknownStockItemError(m.stockItemId)
    }

    // I8 — lot izleyen kalem lotsuz hareket alamaz.
    if (item.tracksLot && !m.lotId) {
      throw new LotRequiredError(m.stockItemId)
    }

    // I7 — birim dönüşümü kayıpsız, tanımsızsa hata.
    const quantityBase = convertUom(m.quantity, m.uom, item.baseUom)

    // I12 — negatif bakiye politikası (allow/warn/block), tenant ayarına göre.
    // `reverseMovement()` bu kontrolden BİLİNÇLİ olarak muaf — I3 ("ters kayıt
    // bakiyeyi tam olarak eski değerine döndürür") I12'den önceliklidir; bir
    // ters kaydın reddedilmesi asıl hareketi düzeltilemez bırakırdı.
    const currentQty = rows
      .filter(r => r.tenantId === ctx.tenantId && r.branchId === ctx.branchId && r.stockItemId === m.stockItemId)
      .reduce((sum, r) => sum + r.quantityBase, 0)
    const resultingQty = currentQty + quantityBase
    let warning: string | undefined
    if (resultingQty < 0) {
      const policy = this.tenantPolicy.negativeStockPolicyOf(ctx)
      if (policy === 'block') {
        throw new NegativeBalanceBlockedError(m.stockItemId, resultingQty)
      }
      if (policy === 'warn') {
        warning = `Bu hareket bakiyeyi negatife düşürdü: ${resultingQty} ${item.baseUom}`
      }
      // policy === 'allow' → sessizce devam
    }

    const now = new Date()
    const movement: Movement = {
      id: randomId(),
      tenantId: ctx.tenantId,
      branchId: ctx.branchId,
      stockItemId: m.stockItemId,
      lotId: m.lotId,
      quantityBase,
      quantityEntered: m.quantity,
      uomEntered: m.uom,
      reason: m.reason,
      sourceType: m.sourceType,
      sourceId: m.sourceId,
      unitCost: m.unitCost,
      currency: m.currency,
      idempotencyKey,
      occurredAt: m.occurredAt ?? now, // I11 — occurred_at geçmişe dönük olabilir
      recordedAt: now, // I11 — recorded_at her zaman gerçek yazma anı
      createdBy: ctx.userId,
      note: m.note,
      warning,
    }

    rows.push(toStored(movement))
    writeStore(rows)
    return movement
  }

  async reverseMovement(ctx: TenantCtx, movementId: string, idempotencyKey: string): Promise<Movement> {
    const rows = readStore()

    // Branch filtresi de var: aksi halde aynı tenant içindeki başka bir
    // şubenin hareketi, bu şubenin context'inden ters çevrilebilirdi
    // (Codex incelemesi, 2026-08-25 — quantityOf/ledgerOf zaten branch'e göre
    // filtreliyordu, reverseMovement tutarsız kalmıştı).
    const originalRow = rows.find(
      r => r.tenantId === ctx.tenantId && r.branchId === ctx.branchId && r.id === movementId,
    )
    if (!originalRow) {
      throw new MovementNotFoundError(movementId)
    }

    // I4 — bir hareket yalnızca bir kez ters çevrilebilir.
    const alreadyReversed = rows.some(
      r => r.tenantId === ctx.tenantId && r.branchId === ctx.branchId && r.reversesMovementId === movementId,
    )
    if (alreadyReversed) {
      throw new MovementAlreadyReversedError(movementId)
    }

    // Ters kaydın kendi idempotency key'i de tekil olmalı.
    const duplicate = rows.find(r => r.tenantId === ctx.tenantId && r.idempotencyKey === idempotencyKey)
    if (duplicate) {
      throw new DuplicateIdempotencyKeyError(idempotencyKey)
    }

    const original = toMovement(originalRow)
    const now = new Date()

    // I3 — ters kayıt bakiyeyi tam olarak eski değerine döndürür.
    const reversal: Movement = {
      id: randomId(),
      tenantId: ctx.tenantId,
      branchId: original.branchId,
      stockItemId: original.stockItemId,
      lotId: original.lotId,
      quantityBase: -original.quantityBase,
      quantityEntered: -original.quantityEntered,
      uomEntered: original.uomEntered,
      reason: 'REVERSAL',
      sourceType: original.sourceType,
      sourceId: original.sourceId,
      unitCost: original.unitCost,
      currency: original.currency,
      reversesMovementId: original.id,
      idempotencyKey,
      occurredAt: now,
      recordedAt: now,
      createdBy: ctx.userId,
    }

    rows.push(toStored(reversal))
    writeStore(rows)
    return reversal
  }

  async quantityOf(ctx: TenantCtx, stockItemId: string, at?: Date): Promise<number> {
    return readStore()
      .filter(r => r.tenantId === ctx.tenantId && r.branchId === ctx.branchId && r.stockItemId === stockItemId)
      .filter(r => (at ? new Date(r.occurredAt).getTime() <= at.getTime() : true))
      .reduce((sum, r) => sum + r.quantityBase, 0)
  }

  async ledgerOf(ctx: TenantCtx, stockItemId: string, range?: DateRange): Promise<Movement[]> {
    const rows = readStore()
      .filter(r => r.tenantId === ctx.tenantId && r.branchId === ctx.branchId && r.stockItemId === stockItemId)
      .filter(r => {
        if (!range) {
          return true
        }
        const t = new Date(r.occurredAt).getTime()
        return t >= range.from.getTime() && t <= range.to.getTime()
      })
      .sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime())

    return rows.map(toMovement)
  }

  async lotBalances(ctx: TenantCtx, stockItemId: string): Promise<LotBalance[]> {
    const rows = readStore().filter(
      r => r.tenantId === ctx.tenantId && r.branchId === ctx.branchId && r.stockItemId === stockItemId && r.lotId,
    )

    const byLot = new Map<string, number>()
    for (const r of rows) {
      const lotId = r.lotId as string
      byLot.set(lotId, (byLot.get(lotId) ?? 0) + r.quantityBase)
    }

    return Array.from(byLot.entries()).map(([lotId, qty]) => ({ stockItemId, lotId, qty }))
  }

  async lotGenealogy(_ctx: TenantCtx, _lotCode: string): Promise<LotNode[]> {
    // Dilim 5 kapsamı. `lot_genealogy`'ye yazan hiçbir yol henüz yok (ne bu
    // repository'de ne başka bir yerde) — bu yüzden şimdilik her zaman boş
    // döner. I1-I12'nin hiçbiri lot soyağacını test etmiyor; bu G6'yı
    // bloklamıyor, yalnızca Dilim 5'te gerçek bir veri kaynağıyla dolacak.
    return []
  }
}
