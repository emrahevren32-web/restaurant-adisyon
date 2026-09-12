// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Dilim 0 / G6.3 — Stok kalemi bakış noktası (port)
//
// StockRepository'nin kendisi stok kartı yönetmiyor — ADR-001'in arayüzünde
// (`stock.repository.ts`) böyle bir metot yok. Ama I7 (birim dönüşümü) için
// kalemin `base_uom`'una, I8 (lot zorunluluğu) için `tracks_lot`'una ihtiyaç
// var. Bu küçük port o bilgiyi dışarıdan enjekte etmek için var.
//
// LocalStorageStockRepository bunu yapıcı parametresi olarak alır.
// PostgresStockRepository'nin buna ihtiyacı YOK — aynı kontrolü veritabanı
// tetikleyicisi zaten yapıyor (db/migrations/0003, `stock_movement_requires_lot()`
// ve `app.convert_uom()` doğrudan `stock_item`/`uom_conversion` tablolarına bakıyor).
//
// Bu, ADR-001'in yayımladığı sözleşmenin bir parçası DEĞİLDİR — yalnızca
// LocalStorageStockRepository'nin bir uygulama detayıdır.
// ═══════════════════════════════════════════════════════════════════════════

import type { TenantCtx } from '../context'

export type StockItemMeta = {
  id: string
  baseUom: string
  tracksLot: boolean
}

export interface StockItemLookup {
  get(ctx: TenantCtx, stockItemId: string): StockItemMeta | undefined
}

/**
 * Sözleşme testleri ve geliştirme için: sabit bir listeden okuyan basit bir
 * sahte (fake). **Üretime taşınmaz.** Gerçek kullanımda `LocalStorageStockRepository`
 * bu port'un stok kartı deposuna (Dilim 1'de gelecek) bağlanan gerçek bir
 * uygulamasıyla kurulmalı. (Codex incelemesi, 2026-08-25 — bu sınıf `ctx`'i
 * de yok sayıyor, çok kiracılı bir ortamda kullanılmamalı.)
 */
export class InMemoryStockItemLookup implements StockItemLookup {
  private readonly items = new Map<string, StockItemMeta>()

  constructor(items: StockItemMeta[] = []) {
    for (const item of items) {
      this.items.set(item.id, item)
    }
  }

  get(_ctx: TenantCtx, stockItemId: string): StockItemMeta | undefined {
    return this.items.get(stockItemId)
  }
}
