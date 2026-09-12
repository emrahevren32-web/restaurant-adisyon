// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Dilim 0 / I12 eki (2026-08-26) — Tenant negatif bakiye politikası
//
// `StockRepository` arayüzünün kendisi tenant ayarı okumuyor — ADR-001'in
// "Uygulama arayüzü" bölümünde böyle bir metot yok. Ama I12 ("negatif bakiye
// politikası tenant ayarına göre davranır") `postMovement()`'ın bunu bir
// yerden okumasını gerektiriyor. `StockItemLookup`'ın (bkz. stock-item-lookup.ts)
// aynı deseni: küçük, dar bir port.
//
// `LocalStorageStockRepository` bunu yapıcı parametresi olarak alır (opsiyonel,
// varsayılan `block` — en güvenli taraf). `PostgresStockRepository`'nin ayrı bir
// port'a ihtiyacı yok, `tenant.negative_stock_policy` sütununu doğrudan sorguluyor
// (bkz. `db/migrations/0010_negatif_bakiye_politikasi.sql`).
//
// Bu, ADR-001'in yayımladığı sözleşmenin bir parçası DEĞİLDİR — yalnızca local
// uygulamanın bir detayıdır (StockItemLookup ile aynı gerekçe).
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../context'
import type { NegativeStockPolicy } from './stock.repository'

export interface TenantPolicyLookup {
  negativeStockPolicyOf(ctx: TenantCtx): NegativeStockPolicy
}

/**
 * Sözleşme testleri ve geliştirme için: sabit bir politika döndüren basit bir
 * sahte (fake). Gerçek kullanımda `LocalStorageStockRepository`, bu port'un
 * tenant ayarları deposuna (Dilim 1'de gelecek) bağlanan gerçek bir
 * uygulamasıyla kurulmalı — `InMemoryStockItemLookup`'la aynı sınır.
 */
export class FixedTenantPolicyLookup implements TenantPolicyLookup {
  constructor(private readonly policy: NegativeStockPolicy = 'block') {}

  negativeStockPolicyOf(_ctx: TenantCtx): NegativeStockPolicy {
    return this.policy
  }
}
