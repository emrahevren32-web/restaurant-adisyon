// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Dilim 0 / G6.1 — TenantCtx
//
// ADR-001 §"Uygulama arayüzü". Her StockRepository metodunun İLK parametresi
// budur. Unutulması derleme hatası olmalıdır — bu yüzden interface'teki her
// metot imzası `ctx: TenantCtx` ile başlar (bkz. stock/stock.repository.ts).
//
// Bu tip yalnızca bir veri taşıyıcıdır, davranış içermez. `tenantId` RLS'in
// veritabanı tarafında zorladığı sınırla birebir aynı değeri taşımalıdır —
// PostgresStockRepository bunu `app.tenant_id` oturum ayarına yazacaktır
// (bkz. db/migrations/0001, `app.current_tenant_id()`).
// ═══════════════════════════════════════════════════════════════════════════

export type TenantCtx = {
  tenantId: string
  branchId: string
  userId: string
}
