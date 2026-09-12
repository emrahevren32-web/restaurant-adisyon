// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Dilim 0 / G6.5 — PostgresStockRepository testleri
//
// ⚠️ ÖNEMLİ SINIR: Bunlar canlı bir Postgres'e karşı ÇALIŞMAZ. `SupabaseClient`
// tamamen sahte (fake) bir nesneyle taklit edilir — sorgu zincirinin
// (.from().select().eq()...) doğru kurulduğunu ve Postgres hata kodlarının
// (23505/23502/23514 ve 0011'in özel kodları MI008/MI012) doğru sözleşme
// hatasına çevrildiğini doğrular.
//
// Bunlar RLS'i, tetikleyicileri (lot guard, reversal-once), veya gerçek
// unique index'leri SINAMAZ — o sınama yalnızca canlı bir Supabase projesine
// karşı, JWT tenant_id claim'i kurulduktan sonra yapılabilir (bkz.
// stock.postgres.ts başındaki not ve db/migrations/0009_jwt_tenant_claim.sql).
// Yani bu dosya "sözleşme testi" (I1-I12) DEĞİLDİR — o testler yalnızca
// stock.contract.test.ts'de, LocalStorageStockRepository'ye karşı koşar.
// Buradaki amaç daha dar: bu sınıfın Supabase'i DOĞRU ŞEKİLDE ÇAĞIRDIĞINI ve
// hata kodu çevirisinin doğru olduğunu garanti altına almak.
//
// I12 (negatif bakiye politikası, 2026-08-26 eki) bu dosyada da mock'la
// sınanıyor — `tenant.negative_stock_policy` sorgusunun doğru okunduğu ve
// block/warn/allow davranışının doğru uygulandığı, yine yalnızca sahte
// veriyle. Aynı gerekçe: canlı doğrulama G7'yle birlikte yapılacak.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PostgresStockRepository } from './stock.postgres'
import {
  DuplicateIdempotencyKeyError,
  MovementAlreadyReversedError,
  ZeroQuantityMovementError,
  LotRequiredError,
  UnknownStockItemError,
  MovementNotFoundError,
  NegativeBalanceBlockedError,
  type NewMovement,
} from './stock.repository'
import type { TenantCtx } from '../context'

const ctx: TenantCtx = { tenantId: 'tenant-1', branchId: 'branch-1', userId: 'user-1' }

/**
 * Zincirlenebilir (chainable) sahte sorgu inşacısı. Gerçek supabase-js
 * inşacısı "thenable"dır (`.then` uygular) — `await query` doğrudan
 * çalışır, `.maybeSingle()`/`.single()` çağrılmasa bile. Bu sahte de aynı
 * davranışı taklit eder.
 */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lte: vi.fn(() => builder),
    order: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject),
  }
  return builder
}

/**
 * `.from(table)` her çağrıldığında sıradaki sonucu döndürür. Sıra,
 * PostgresStockRepository'nin metot içinde `.from()`'u çağırma sırasıyla
 * BİREBİR eşleşmeli (ör. postMovement: önce stock_item, sonra stock_movement).
 * Döndürülen `builders` dizisi, hangi tabloyla ve hangi payload'la
 * çağrıldığını doğrulamak için testte incelenebilir.
 */
function createSupabaseMock(queue: Array<{ data: unknown; error: unknown }>) {
  const fromCalls: string[] = []
  const builders: Array<Record<string, unknown>> = []
  let i = 0
  const from = vi.fn((table: string) => {
    fromCalls.push(table)
    const result = queue[i] ?? { data: null, error: null }
    i += 1
    const builder = makeBuilder(result)
    builders.push(builder)
    return builder
  })
  return { supabase: { from } as unknown as SupabaseClient, fromCalls, builders }
}

const itemRow = (overrides: Partial<{ base_uom: string; tracks_lot: boolean }> = {}) => ({
  data: { id: 'item-1', base_uom: 'kg', tracks_lot: false, ...overrides },
  error: null,
})

const movementRow = (overrides: Record<string, unknown> = {}) => ({
  data: {
    id: 'mv-1',
    tenant_id: ctx.tenantId,
    branch_id: ctx.branchId,
    stock_item_id: 'item-1',
    lot_id: null,
    quantity_base: 5,
    quantity_entered: 5,
    uom_entered: 'kg',
    reason: 'PURCHASE_RECEIPT',
    source_type: 'goods_receipt',
    source_id: null,
    unit_cost: null,
    currency: null,
    reverses_movement_id: null,
    idempotency_key: 'key-1',
    occurred_at: '2026-08-26T00:00:00.000Z',
    recorded_at: '2026-08-26T00:00:00.000Z',
    created_by: ctx.userId,
    note: null,
    ...overrides,
  },
  error: null,
})

const newMovement: NewMovement = {
  stockItemId: 'item-1',
  quantity: 5,
  uom: 'kg',
  reason: 'PURCHASE_RECEIPT',
  sourceType: 'goods_receipt',
}

describe('PostgresStockRepository — postMovement', () => {
  it('başarılı yazımda item bakılır, mevcut bakiye okunur, quantity_base doğru dönüştürülür, satır Movement\'a çevrilir', async () => {
    const { supabase, fromCalls, builders } = createSupabaseMock([
      itemRow(),
      { data: [], error: null }, // quantityOf (I12 kontrolü için) — mevcut bakiye 0
      movementRow(),
    ])
    const repo = new PostgresStockRepository(supabase)

    const result = await repo.postMovement(ctx, newMovement, 'key-1')

    expect(fromCalls).toEqual(['stock_item', 'stock_movement', 'stock_movement'])
    expect(result.id).toBe('mv-1')
    expect(result.quantityBase).toBe(5)
    expect(result.tenantId).toBe(ctx.tenantId)
    expect(result.warning).toBeUndefined()

    const insertPayload = (builders[2].insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload).toMatchObject({
      tenant_id: ctx.tenantId,
      branch_id: ctx.branchId,
      stock_item_id: 'item-1',
      quantity_base: 5,
      quantity_entered: 5,
      idempotency_key: 'key-1',
      created_by: ctx.userId,
    })
  })

  it('farklı birimden girildiğinde quantity_base convertUom ile hesaplanır (I7)', async () => {
    const { supabase, builders } = createSupabaseMock([
      itemRow({ base_uom: 'kg' }),
      { data: [], error: null }, // quantityOf — mevcut bakiye 0
      movementRow({ quantity_base: 2000, quantity_entered: 2, uom_entered: 'kg' }),
    ])
    const repo = new PostgresStockRepository(supabase)

    await repo.postMovement(ctx, { ...newMovement, quantity: 2, uom: 'ton' }, 'key-2')

    const insertPayload = (builders[2].insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload.quantity_base).toBe(2000) // 2 ton = 2000 kg
    expect(insertPayload.quantity_entered).toBe(2)
  })

  it('quantity=0 için istemci tarafında ZeroQuantityMovementError fırlatır — Supabase\'e hiç gitmez (I6)', async () => {
    const { supabase, fromCalls } = createSupabaseMock([])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.postMovement(ctx, { ...newMovement, quantity: 0 }, 'key-3')).rejects.toThrow(
      ZeroQuantityMovementError,
    )
    expect(fromCalls).toEqual([])
  })

  it.each([NaN, Infinity, -Infinity])(
    'quantity=%s için istemci tarafında ZeroQuantityMovementError fırlatır (I6)',
    async (bad) => {
      const { supabase } = createSupabaseMock([])
      const repo = new PostgresStockRepository(supabase)
      await expect(repo.postMovement(ctx, { ...newMovement, quantity: bad }, 'key-4')).rejects.toThrow(
        ZeroQuantityMovementError,
      )
    },
  )

  it('bilinmeyen stok kalemi için UnknownStockItemError fırlatır', async () => {
    const { supabase } = createSupabaseMock([{ data: null, error: null }])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.postMovement(ctx, newMovement, 'key-5')).rejects.toThrow(UnknownStockItemError)
  })

  it('lot takipli kalemde lotId verilmezse istemci tarafında LotRequiredError fırlatır (I8)', async () => {
    const { supabase, fromCalls } = createSupabaseMock([itemRow({ tracks_lot: true })])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.postMovement(ctx, newMovement, 'key-6')).rejects.toThrow(LotRequiredError)
    // INSERT'e hiç gidilmedi — yalnızca stock_item okundu.
    expect(fromCalls).toEqual(['stock_item'])
  })

  it('DB 23505 (unique_violation) → DuplicateIdempotencyKeyError (I2)', async () => {
    const { supabase } = createSupabaseMock([
      itemRow(),
      { data: [], error: null }, // quantityOf
      { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "stock_movement_idempotency_unique"' } },
    ])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.postMovement(ctx, newMovement, 'key-7')).rejects.toThrow(DuplicateIdempotencyKeyError)
  })

  it('DB MI008 (lot guard tetikleyicisi, 0011) → LotRequiredError (I8)', async () => {
    // 0011, lot tetikleyicisini genel `23502` yerine kendi koduna (MI008)
    // çekti — bkz. aşağıdaki "yanlış adlandırma" testi.
    const { supabase } = createSupabaseMock([
      itemRow({ tracks_lot: false }),
      { data: [], error: null }, // quantityOf
      { data: null, error: { code: 'MI008', message: 'Bu stok kalemi lot takipli; lot_id olmadan hareket yazılamaz.' } },
    ])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.postMovement(ctx, newMovement, 'key-8')).rejects.toThrow(LotRequiredError)
  })

  it('DB 23502 + "lot" mesajı → LotRequiredError (0011 öncesi kurulumlar için geriye dönük yol)', async () => {
    const { supabase } = createSupabaseMock([
      itemRow({ tracks_lot: false }),
      { data: [], error: null }, // quantityOf
      { data: null, error: { code: '23502', message: 'null value in column "lot_id" violates not-null constraint' } },
    ])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.postMovement(ctx, newMovement, 'key-8b')).rejects.toThrow(LotRequiredError)
  })

  it('DB 23502 ama lotla İLGİSİZ ise LotRequiredError DEĞİL, genel hata olur', async () => {
    // Eski çeviri `23502` gören her hatayı LotRequiredError sayıyordu.
    // `23502` genel bir not-null ihlali kodudur: alakasız bir sütun hatası
    // kullanıcıya "lot zorunlu" diye YANLIŞ gösteriliyordu (Codex, 2026-08-26).
    const { supabase } = createSupabaseMock([
      itemRow(),
      { data: [], error: null }, // quantityOf
      { data: null, error: { code: '23502', message: 'null value in column "source_type" violates not-null constraint' } },
    ])
    const repo = new PostgresStockRepository(supabase)

    // Tek çağrı: mock kuyruğu her çağrıda tükendiği için iki kez çağrılamaz.
    const hata = await repo.postMovement(ctx, newMovement, 'key-8c').catch((e: unknown) => e)
    expect(hata).not.toBeInstanceOf(LotRequiredError)
    expect(String((hata as Error).message)).toMatch(/source_type/)
  })

  it('DB 23514 + quantity_base kısıtı → ZeroQuantityMovementError (I6)', async () => {
    const { supabase } = createSupabaseMock([
      itemRow(),
      { data: [], error: null }, // quantityOf
      { data: null, error: { code: '23514', message: 'new row violates check constraint "stock_movement_quantity_base_check"' } },
    ])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.postMovement(ctx, newMovement, 'key-9')).rejects.toThrow(ZeroQuantityMovementError)
  })

  it('DB 23514 ama BAŞKA bir check kısıtıysa ZeroQuantityMovementError DEĞİL', async () => {
    // Aynı tabloda `reason` check'i de var. Eski çeviri her 23514'ü "miktar
    // sıfır olamaz" diye adlandırıyordu (Codex, 2026-08-26).
    const { supabase } = createSupabaseMock([
      itemRow(),
      { data: [], error: null }, // quantityOf
      { data: null, error: { code: '23514', message: 'new row violates check constraint "stock_movement_reason_check"' } },
    ])
    const repo = new PostgresStockRepository(supabase)

    const hata = await repo.postMovement(ctx, newMovement, 'key-9b').catch((e: unknown) => e)
    expect(hata).not.toBeInstanceOf(ZeroQuantityMovementError)
    expect(String((hata as Error).message)).toMatch(/reason_check/)
  })

  it('DB MI012 (negatif bakiye tetikleyicisi, 0011) → NegativeBalanceBlockedError (I12)', async () => {
    // Yarış senaryosu: istemci tarafındaki kontrol geçiyor (quantityOf 100
    // döndürüyor, sonuç pozitif görünüyor) ama araya giren eşzamanlı bir
    // yazma yüzünden veritabanı tetikleyicisi reddediyor. Son sözü DB söyler
    // ve sözleşme açısından fark olmamalı: aynı hata tipi fırlatılmalı.
    const { supabase } = createSupabaseMock([
      itemRow(),
      { data: [{ quantity_base: 100 }], error: null }, // quantityOf → sonuç pozitif görünüyor
      { data: null, error: { code: 'MI012', message: 'Negatif bakiye engellendi (I12)' } },
    ])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.postMovement(ctx, newMovement, 'key-9c')).rejects.toThrow(NegativeBalanceBlockedError)
  })

  it('bilinmeyen bir DB hata kodu genel Error olarak (mesajıyla) fırlatılır', async () => {
    const { supabase } = createSupabaseMock([
      itemRow(),
      { data: [], error: null }, // quantityOf
      { data: null, error: { code: '55000', message: 'garip bir hata' } },
    ])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.postMovement(ctx, newMovement, 'key-10')).rejects.toThrow(/garip bir hata/)
  })
})

describe('PostgresStockRepository — postMovement · I12 negatif bakiye politikası', () => {
  // newMovement pozitif (quantity 5); bu blokta bakiyeyi negatife düşürecek
  // NEGATİF bir hareket kullanılıyor.
  const negativeMovement: NewMovement = { ...newMovement, quantity: -15 }

  it('block: resultingQty < 0 ise NegativeBalanceBlockedError, INSERT\'e hiç gidilmez', async () => {
    const { supabase, fromCalls } = createSupabaseMock([
      itemRow(),
      { data: [{ quantity_base: 10 }], error: null }, // mevcut bakiye 10
      { data: { negative_stock_policy: 'block' }, error: null }, // tenant politikası
    ])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.postMovement(ctx, negativeMovement, 'key-i12-block')).rejects.toThrow(
      NegativeBalanceBlockedError,
    )
    // stock_item, stock_movement (quantityOf), tenant — insert YOK.
    expect(fromCalls).toEqual(['stock_item', 'stock_movement', 'tenant'])
  })

  it('warn: hareket kabul edilir, dönen Movement.warning doludur', async () => {
    const { supabase } = createSupabaseMock([
      itemRow(),
      { data: [{ quantity_base: 10 }], error: null },
      { data: { negative_stock_policy: 'warn' }, error: null },
      movementRow({ quantity_base: -15, quantity_entered: -15 }),
    ])
    const repo = new PostgresStockRepository(supabase)

    const result = await repo.postMovement(ctx, negativeMovement, 'key-i12-warn')

    expect(result.warning).toBeTruthy()
    expect(result.quantityBase).toBe(-15)
  })

  it('allow: hareket sessizce kabul edilir, warning yok', async () => {
    const { supabase } = createSupabaseMock([
      itemRow(),
      { data: [{ quantity_base: 10 }], error: null },
      { data: { negative_stock_policy: 'allow' }, error: null },
      movementRow({ quantity_base: -15, quantity_entered: -15 }),
    ])
    const repo = new PostgresStockRepository(supabase)

    const result = await repo.postMovement(ctx, negativeMovement, 'key-i12-allow')

    expect(result.warning).toBeUndefined()
  })

  it('tenant satırı bulunamazsa (ör. 0010 henüz çalıştırılmadı) en güvenli tarafa düşer: block', async () => {
    const { supabase } = createSupabaseMock([
      itemRow(),
      { data: [{ quantity_base: 10 }], error: null },
      { data: null, error: null }, // tenant satırı yok / negative_stock_policy null
    ])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.postMovement(ctx, negativeMovement, 'key-i12-fallback')).rejects.toThrow(
      NegativeBalanceBlockedError,
    )
  })

  it('resultingQty >= 0 ise politika hiç sorgulanmaz (gereksiz sorgu yok)', async () => {
    const { supabase, fromCalls } = createSupabaseMock([
      itemRow(),
      { data: [{ quantity_base: 10 }], error: null }, // mevcut bakiye 10, hareket +5 → 15
      movementRow(),
    ])
    const repo = new PostgresStockRepository(supabase)

    await repo.postMovement(ctx, newMovement, 'key-i12-pozitif')

    expect(fromCalls).toEqual(['stock_item', 'stock_movement', 'stock_movement'])
  })
})

describe('PostgresStockRepository — reverseMovement', () => {
  it('başarılı ters kayıtta miktar işareti ters çevrilir, reverses_movement_id ayarlanır (I3)', async () => {
    const { supabase, builders } = createSupabaseMock([
      movementRow({ id: 'mv-1', quantity_base: 5, quantity_entered: 5 }), // find original
      movementRow({ id: 'mv-2', quantity_base: -5, quantity_entered: -5, reason: 'REVERSAL', reverses_movement_id: 'mv-1' }),
    ])
    const repo = new PostgresStockRepository(supabase)

    const result = await repo.reverseMovement(ctx, 'mv-1', 'rev-key-1')

    expect(result.id).toBe('mv-2')
    expect(result.quantityBase).toBe(-5)
    expect(result.reversesMovementId).toBe('mv-1')

    const insertPayload = (builders[1].insert as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertPayload.reverses_movement_id).toBe('mv-1')
    expect(insertPayload.quantity_base).toBe(-5)
    expect(insertPayload.reason).toBe('REVERSAL')
  })

  it('bulunamayan hareket için MovementNotFoundError fırlatır', async () => {
    const { supabase } = createSupabaseMock([{ data: null, error: null }])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.reverseMovement(ctx, 'yok-boyle-bir-id', 'rev-key-2')).rejects.toThrow(
      MovementNotFoundError,
    )
  })

  it('DB 23505 + "reversal_once" mesajı → MovementAlreadyReversedError (I4)', async () => {
    const { supabase } = createSupabaseMock([
      movementRow(),
      { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "stock_movement_reversal_once_idx"' } },
    ])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.reverseMovement(ctx, 'mv-1', 'rev-key-3')).rejects.toThrow(MovementAlreadyReversedError)
  })

  it('DB 23505 ama "reversal_once" değilse → DuplicateIdempotencyKeyError (I2)', async () => {
    const { supabase } = createSupabaseMock([
      movementRow(),
      { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "stock_movement_idempotency_unique"' } },
    ])
    const repo = new PostgresStockRepository(supabase)

    await expect(repo.reverseMovement(ctx, 'mv-1', 'rev-key-4')).rejects.toThrow(DuplicateIdempotencyKeyError)
  })
})

describe('PostgresStockRepository — quantityOf / ledgerOf / lotBalances / lotGenealogy', () => {
  it('quantityOf, quantity_base sütununu toplar (I1)', async () => {
    const { supabase, builders } = createSupabaseMock([
      { data: [{ quantity_base: 5 }, { quantity_base: -2 }, { quantity_base: '3' }], error: null },
    ])
    const repo = new PostgresStockRepository(supabase)

    const total = await repo.quantityOf(ctx, 'item-1')

    expect(total).toBe(6)
    expect(builders[0].eq).toHaveBeenCalledWith('branch_id', ctx.branchId)
  })

  it('quantityOf, `at` verildiğinde .lte ile occurred_at süzer', async () => {
    const { supabase, builders } = createSupabaseMock([{ data: [], error: null }])
    const repo = new PostgresStockRepository(supabase)
    const at = new Date('2026-01-01T00:00:00.000Z')

    await repo.quantityOf(ctx, 'item-1', at)

    expect(builders[0].lte).toHaveBeenCalledWith('occurred_at', at.toISOString())
  })

  it('quantityOf boş sonuçta 0 döndürür', async () => {
    const { supabase } = createSupabaseMock([{ data: null, error: null }])
    const repo = new PostgresStockRepository(supabase)

    expect(await repo.quantityOf(ctx, 'item-1')).toBe(0)
  })

  it('ledgerOf, satırları Movement[] olarak döndürür ve tarih sırasına göre sorgular', async () => {
    const { supabase, builders } = createSupabaseMock([
      { data: [movementRow().data, movementRow({ id: 'mv-2' }).data], error: null },
    ])
    const repo = new PostgresStockRepository(supabase)

    const ledger = await repo.ledgerOf(ctx, 'item-1')

    expect(ledger).toHaveLength(2)
    expect(ledger[0].id).toBe('mv-1')
    expect(ledger[1].id).toBe('mv-2')
    expect(builders[0].order).toHaveBeenCalledWith('occurred_at', { ascending: true })
  })

  it('ledgerOf, range verildiğinde .gte/.lte uygular', async () => {
    const { supabase, builders } = createSupabaseMock([{ data: [], error: null }])
    const repo = new PostgresStockRepository(supabase)
    const range = { from: new Date('2026-01-01T00:00:00.000Z'), to: new Date('2026-02-01T00:00:00.000Z') }

    await repo.ledgerOf(ctx, 'item-1', range)

    expect(builders[0].gte).toHaveBeenCalledWith('occurred_at', range.from.toISOString())
    expect(builders[0].lte).toHaveBeenCalledWith('occurred_at', range.to.toISOString())
  })

  it('lotBalances, stock_lot_balance görünümünden okur ve LotBalance[] döndürür', async () => {
    const { supabase, fromCalls } = createSupabaseMock([
      { data: [{ lot_id: 'lot-1', qty: 3 }, { lot_id: 'lot-2', qty: '0' }], error: null },
    ])
    const repo = new PostgresStockRepository(supabase)

    const balances = await repo.lotBalances(ctx, 'item-1')

    expect(fromCalls).toEqual(['stock_lot_balance'])
    expect(balances).toEqual([
      { stockItemId: 'item-1', lotId: 'lot-1', qty: 3 },
      { stockItemId: 'item-1', lotId: 'lot-2', qty: 0 },
    ])
  })

  it('lotGenealogy, Dilim 5 kapsamına ertelendiği için her zaman boş dizi döndürür ve Supabase\'e gitmez', async () => {
    const { supabase, fromCalls } = createSupabaseMock([])
    const repo = new PostgresStockRepository(supabase)

    expect(await repo.lotGenealogy(ctx, 'herhangi-bir-lot-kodu')).toEqual([])
    expect(fromCalls).toEqual([])
  })
})
