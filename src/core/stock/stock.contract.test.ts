// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Dilim 0 / G6.4 — Sözleşme testleri · LocalStorage uygulaması
//
// Testlerin GÖVDESİ burada değil, `stock.contract.suite.ts` içindedir. Bu dosya
// yalnızca o gövdeye LocalStorage zemini sağlar; aynı gövde
// `stock.contract.live.test.ts` üzerinden PostgresStockRepository'ye de koşar.
//
// Yol haritası: "PostgreSQL uygulaması, aynı testler / İki uygulamada da aynı
// suite geçiyor." Testleri kopyalamak yerine tek gövdeden geçirmek, bu iddianın
// bir gün sessizce yanlışlanmasını engeller — biri güncellenip diğeri
// unutulamaz, çünkü tek bir dosya var.
//
// Üç madde bu uygulamada test EDİLEMİYOR ve bu atlanmıyor, açıkça yazılıyor:
//   I5  — yapısal olarak zaten imkânsız (arayüzde update/delete metodu yok);
//         suite bunu yapısal bir kayıt olarak sınıyor.
//   I9  — "RLS kapatılırsa kırmızıya döner" negatif kontrolü yalnızca Postgres'te
//         anlamlı; `tenant-isolation.live.test.ts` içinde yapılıyor.
//   I10 — henüz bir snapshot mekanizması yok (ADR-001 bunu bilerek erteliyor).
// ═══════════════════════════════════════════════════════════════════════════

import { beforeEach } from 'vitest'
import type { TenantCtx } from '../context'
import type { NegativeStockPolicy } from './stock.repository'
import { LocalStorageStockRepository } from './stock.localstorage'
import { InMemoryStockItemLookup } from './stock-item-lookup'
import { FixedTenantPolicyLookup } from './tenant-policy-lookup'
import { sozlesmeTestleriniKos, type ContractZemin } from './stock.contract.suite'

const ctx: TenantCtx = { tenantId: 'tenant-1', branchId: 'branch-1', userId: 'user-1' }

// I9 yalnızca TENANT değişkenini sınamalı. `branchId` de değiştirilseydi, kod
// tenant filtresini tamamen kaybetse bile branch filtresi testi "kurtarır" ve
// yanlış pozitif verirdi (Codex incelemesi, 2026-08-25).
const baskaTenantCtx: TenantCtx = { tenantId: 'tenant-2', branchId: ctx.branchId, userId: 'user-9' }
const baskaSubeCtx: TenantCtx = { tenantId: ctx.tenantId, branchId: 'branch-2', userId: 'user-2' }

const LOTSUZ = 'un-001'
const LOTLU = 'tavuk-001'

beforeEach(() => {
  localStorage.clear()
})

sozlesmeTestleriniKos({
  ad: 'LocalStorage',
  async hazirla(policy?: NegativeStockPolicy): Promise<ContractZemin> {
    // Her test kendi zeminini kurar; `beforeEach` deposu zaten temizledi.
    localStorage.clear()

    const lookup = new InMemoryStockItemLookup([
      { id: LOTSUZ, baseUom: 'kg', tracksLot: false },
      { id: LOTLU, baseUom: 'kg', tracksLot: true },
    ])
    const repo = new LocalStorageStockRepository(
      lookup,
      new FixedTenantPolicyLookup(policy ?? 'block'),
    )

    return {
      repo,
      ctx,
      baskaSubeCtx,
      // LocalStorage'da "başka tenant" aynı repodur, yalnızca bağlam değişir.
      // (Postgres'te ayrı bir OTURUM gerekir — bkz. suite'teki not.)
      baskaTenant: { repo, ctx: baskaTenantCtx },
      lotsuzKalem: LOTSUZ,
      lotluKalem: LOTLU,
      lotId: 'lot-1',
      // LocalStorage her testte sıfırlandığı için anahtarlar çakışmaz;
      // yine de suite'in sözleşmesine uymak için önek veriliyor.
      anahtar: (ek: string) => `test:${ek}`,
    }
  },
})

// ── Yalnızca bu uygulamaya özgü ────────────────────────────────────────────
// Ortak gövdede DEĞİL, çünkü Postgres'te karşılığı yok: orada politika
// `tenant.negative_stock_policy` sütunundan okunur, yapıcı parametresinden değil.
import { describe, it, expect } from 'vitest'
import { NegativeBalanceBlockedError } from './stock.repository'

describe('I12 · LocalStorage varsayılanı [LocalStorage]', () => {
  it('tenantPolicy verilmezse en güvenli tarafa düşer: block', async () => {
    // Bilinçli güvenli varsayılan — bkz. stock.localstorage.ts yapıcı notu.
    // Bu parametreyi bilmeyen eski bir çağıran, sessizce negatif bakiye
    // üretmek yerine reddedilir.
    localStorage.clear()
    const lookup = new InMemoryStockItemLookup([{ id: LOTSUZ, baseUom: 'kg', tracksLot: false }])
    const repo = new LocalStorageStockRepository(lookup) // tenantPolicy hiç verilmedi

    await expect(
      repo.postMovement(
        ctx,
        { stockItemId: LOTSUZ, quantity: -10, uom: 'kg', reason: 'WASTE', sourceType: 'manual' },
        'test:i12:varsayilan',
      ),
    ).rejects.toThrow(NegativeBalanceBlockedError)
  })
})
