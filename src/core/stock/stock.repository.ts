// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Dilim 0 / G6.2 — StockRepository arayüzü
//
// ADR-001 §"Uygulama arayüzü" ve §"Değişmezler (invariants)" bölümlerinin
// TypeScript karşılığıdır. Buradaki her tip ve her metot imzası ADR-001'e
// BİREBİR karşılık gelir — burada bir değişiklik yapmak istiyorsan önce
// ADR-001'i güncelle, sonra buraya dön.
//
// Bu dosya davranış içermez, yalnızca sözleşmedir. İki uygulaması olacak:
//   - LocalStorageStockRepository  (G6.3 — bkz. stock.localstorage.ts başındaki not:
//     bu bir "taşıma" değil, ADR-001'e göre yeni bir uygulamadır)
//   - PostgresStockRepository      (G6.5 — db/migrations/0003 şemasına karşı)
//
// İkisi de aynı sözleşme testlerinden (G6.4, I1-I12) geçmek zorundadır.
// Sözleşme testi geçmeyen bir uygulama, uygulama değildir.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../context'

// ── Sözleşme hataları ────────────────────────────────────────────────────
// Her iki uygulama da (Local, Postgres) aynı kod yolunda AYNI hata tipini
// fırlatmalı — sözleşme testleri (G6.4) I2/I4/I6/I8'i bunlarla doğrular.
export class DuplicateIdempotencyKeyError extends Error {
  constructor(idempotencyKey: string) {
    super(`Bu idempotency key ile bir hareket zaten var: ${idempotencyKey}`)
    this.name = 'DuplicateIdempotencyKeyError'
  }
}

export class MovementAlreadyReversedError extends Error {
  constructor(movementId: string) {
    super(`Hareket zaten ters çevrilmiş, ikinci kez ters çevrilemez: ${movementId}`)
    this.name = 'MovementAlreadyReversedError'
  }
}

export class ZeroQuantityMovementError extends Error {
  constructor() {
    super('quantity_base sıfır olamaz')
    this.name = 'ZeroQuantityMovementError'
  }
}

export class LotRequiredError extends Error {
  constructor(stockItemId: string) {
    super(`Bu stok kalemi lot takipli; lot_id olmadan hareket yazılamaz: ${stockItemId}`)
    this.name = 'LotRequiredError'
  }
}

export class UnknownStockItemError extends Error {
  constructor(stockItemId: string) {
    super(`Bilinmeyen stok kalemi: ${stockItemId}`)
    this.name = 'UnknownStockItemError'
  }
}

export class MovementNotFoundError extends Error {
  constructor(movementId: string) {
    super(`Hareket bulunamadı: ${movementId}`)
    this.name = 'MovementNotFoundError'
  }
}

// 2026-08-26 eki — I12 (negatif bakiye politikası). `block` politikasında,
// bir hareket bakiyeyi negatife düşürecekse `postMovement()` bunu fırlatır.
// `reverseMovement()` bu hatayı HİÇBİR ZAMAN fırlatmaz — bkz. NegativeStockPolicy
// altındaki not: I3 burada I12'den önceliklidir.
export class NegativeBalanceBlockedError extends Error {
  constructor(stockItemId: string, resultingBalance: number) {
    super(
      `Bu hareket "${stockItemId}" kalemi için bakiyeyi negatife düşürür (${resultingBalance}) `
      + 've tenant politikası (block) bunu engelliyor',
    )
    this.name = 'NegativeBalanceBlockedError'
  }
}

// ── Kapalı listeler ───────────────────────────────────────────────────────
// db/migrations/0003_stok_defteri.sql'deki `check (reason in (...))` ile
// birebir aynı olmalı. Yeni bir değer gerekiyorsa önce ADR-001'e, sonra
// migration'a, sonra buraya eklenir — bu sıra dışında eklenmez.
export type MovementReason =
  | 'PURCHASE_RECEIPT'
  | 'PURCHASE_RETURN'
  | 'PRODUCTION_CONSUME'
  | 'PRODUCTION_OUTPUT'
  | 'PRODUCTION_WASTE'
  | 'SHIPMENT_OUT'
  | 'SHIPMENT_RETURN'
  | 'COUNT_SURPLUS'
  | 'COUNT_SHORTAGE'
  | 'EXPIRY_WRITE_OFF'
  | 'WASTE'
  // 0025 · zayi. Fire (WASTE) ile aynı şey değil: fire işlenirken oluşan
  // kayıp, zayi ise malın kaybolması/kırılması/çalınması. Ayrı kod olmasa
  // "fire oranımız yükseldi mi" sorusu cevaplanamazdı.
  | 'LOSS'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'OPENING_BALANCE'
  | 'REVERSAL'

// `source_type` şemada serbest metindir (kontrol kısıtı yok — bkz. 0003).
// Bilinen değerler ADR-001'den; yeni bir kaynak modülü eklenince buraya da
// eklenir ama veritabanı bunu zorlamaz, yalnızca dokümantasyon amaçlıdır.
export type SourceType =
  | 'goods_receipt'
  | 'work_order'
  | 'shipment'
  | 'count'
  | 'manual'

export type DateRange = {
  from: Date
  to: Date
}

// 2026-08-26 eki — I12. `db/migrations/0010_negatif_bakiye_politikasi.sql`
// ile `tenant.negative_stock_policy` sütununa birebir karşılık gelir.
// `allow` — sessizce izin ver · `warn` — izin ver, `Movement.warning`'i doldur
// · `block` — reddet (`NegativeBalanceBlockedError`, varsayılan).
export type NegativeStockPolicy = 'allow' | 'warn' | 'block'

// ── Yazma isteği ───────────────────────────────────────────────────────────
// `idempotencyKey` ÇAĞIRAN tarafından üretilir, repository tarafından değil.
// Örn. mal kabul satırı için: `receipt:{receiptId}:line:{lineId}`.
//
// `note` alanı ADR-001'in "Uygulama arayüzü" kod bloğunda YOKTU; 2026-08-25'te
// eklendi çünkü `stock_movement.note` sütunu zaten şemada var (`0003_stok_defteri.sql`)
// ve karşılığı olmayan bir sütun bırakmak istemedik. ADR-001'e de aynı tarihli
// not düşüldü (Codex incelemesi).
export type NewMovement = {
  stockItemId: string
  lotId?: string
  quantity: number // işaretli, kullanıcı biriminde (+ giriş, − çıkış)
  uom: string
  reason: MovementReason
  sourceType: SourceType
  sourceId?: string
  unitCost?: number
  currency?: string
  occurredAt?: Date // verilmezse now()
  note?: string
}

// ── Okuma modelleri ─────────────────────────────────────────────────────────
export type Movement = {
  id: string
  tenantId: string
  branchId: string
  stockItemId: string
  lotId?: string
  quantityBase: number // defter birimi, işaretli — I1'in kaynağı
  quantityEntered: number
  uomEntered: string
  reason: MovementReason
  sourceType: SourceType
  sourceId?: string
  unitCost?: number
  currency?: string
  reversesMovementId?: string
  idempotencyKey: string
  occurredAt: Date
  recordedAt: Date
  createdBy?: string
  note?: string
  // 2026-08-26 eki — I12. Yalnızca YAZMA anında, politika `warn` ise dolar.
  // `stock_movement` şemasında karşılığı olan bir sütun DEĞİLDİR; yalnızca
  // ekrana "bu hareket bakiyeyi negatife düşürdü" uyarısını göstermek için
  // `postMovement()`'ın döndürdüğü nesnede taşınır.
  //
  // SÖZLEŞME (2026-08-26'da netleştirildi, Codex bulgusu): bu alan HİÇBİR
  // uygulamada KALICI DEĞİLDİR. `postMovement()` doldurabilir; `ledgerOf()`
  // her iki uygulamada da bu alanı BOŞ döndürür.
  //
  // Önceki hâlinde bu bir "küçük fark" olarak yazılmıştı: Postgres saklamıyor
  // ama LocalStorage tüm nesneyi olduğu gibi sakladığı için onda kalıcı
  // oluyordu. Bu, iki uygulamanın aynı sözleşme testlerinden geçmesi gereken
  // bir sistemde kabul edilebilir bir fark değil — `Movement` tipinin bir
  // alanının uygulamaya göre farklı davranması, sözleşmenin kendisini
  // belirsizleştirir. LocalStorage artık yazarken bu alanı düşürüyor
  // (bkz. stock.localstorage.ts, `toStored`).
  warning?: string
}

export type LotBalance = {
  stockItemId: string
  lotId: string
  qty: number
}

export type LotNode = {
  lotCode: string
  lotId: string
  // Geri çağırma sorgusunun (ADR-001 §"Geri çağırma sorgusu") döndürdüğü
  // etkilenen lot'un ulaştığı sevkiyat kimlikleri.
  affectedShipmentIds: string[]
}

// ── Arayüz ───────────────────────────────────────────────────────────────
// Her metodun ilk parametresi `ctx: TenantCtx`. Unutulması derleme hatasıdır.
export interface StockRepository {
  /**
   * Yeni bir defter kaydı yazar. Aynı `(tenant, idempotencyKey)` ile ikinci
   * çağrı ikinci bir kayıt YAZMAZ — `DuplicateIdempotencyKeyError` fırlatır
   * (I2; bkz. `db/migrations/0004`'teki I2 testi: ikinci gönderim sessizce
   * yutulmaz, reddedilir). `quantity` sıfırsa `ZeroQuantityMovementError`
   * (I6). Kalem lot takipliyse ve `lotId` verilmemişse `LotRequiredError` (I8).
   */
  postMovement(ctx: TenantCtx, m: NewMovement, idempotencyKey: string): Promise<Movement>

  /**
   * Bir hareketi ters çevirir (I3). Bir hareket yalnızca BİR kez ters
   * çevrilebilir (I4) — ikinci çağrı hata fırlatır, sessizce yok saymaz.
   */
  reverseMovement(ctx: TenantCtx, movementId: string, idempotencyKey: string): Promise<Movement>

  /**
   * Bir kalemin miktarını döndürür. `at` verilmezse şu anki bakiye; verilirse
   * o ana kadarki hareketlerin toplamı (I1 — miktar defterden türetilir,
   * hiçbir yerde saklanmaz).
   */
  quantityOf(ctx: TenantCtx, stockItemId: string, at?: Date): Promise<number>

  /** Bir kalemin hareket dökümü, isteğe bağlı tarih aralığıyla süzülmüş. */
  ledgerOf(ctx: TenantCtx, stockItemId: string, range?: DateRange): Promise<Movement[]>

  /**
   * Bir kalemin lot bazında bakiyeleri — hareketi olan her lot için toplam
   * (bakiye tam tüketilmişse 0 olabilir; `stock_lot_balance` görünümüyle
   * aynı davranış, sıfır bakiye filtrelenmez).
   */
  lotBalances(ctx: TenantCtx, stockItemId: string): Promise<LotBalance[]>

  /**
   * Geri çağırma sorgusu (ADR-001 §"Geri çağırma sorgusu"). Verilen lot
   * kodundan türeyen TÜM alt lotları ve bunların ulaştığı sevkiyatları
   * özyinelemeli olarak bulur.
   */
  lotGenealogy(ctx: TenantCtx, lotCode: string): Promise<LotNode[]>
}
