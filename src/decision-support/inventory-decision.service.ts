import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { percent, sumBy } from '../kpi-reporting/kpi.utils'
import { createDecisionSuggestion } from './recommendation-engine.service'
import type { DecisionSuggestion } from './decision-support.types'
import {
  getDaysUntil,
  getLotProductId,
  getProductLabel,
  getWarehouseName
} from './decision-support.utils'

const EXPIRY_WARNING_DAYS = 14
const MAX_ENTITY_SUGGESTIONS = 8

const getLotQuantity = (lot: InventoryLot) => lot.remainingQuantity || lot.quantity || lot.receivedQuantity || 0

const createCriticalStockSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => sourceData.stockItems
  .filter(item => item.currentQty <= item.minQty)
  .slice(0, MAX_ENTITY_SUGGESTIONS)
  .map(item => createDecisionSuggestion({
    category: 'Inventory',
    title: `Kritik stok: ${item.name}`,
    description: 'Stok minimum seviyenin altina indi.',
    reason: `Mevcut ${item.currentQty} ${item.unit}, minimum ${item.minQty} ${item.unit}.`,
    ruleId: 'inventory-critical-purchase',
    relatedEntityType: 'StockItem',
    relatedEntityId: item.id,
    relatedProductId: item.id,
    branchId: item.branchId,
    evidenceScore: Math.min(30, Math.max(5, item.minQty - item.currentQty)),
    recommendationAction: 'Satin alma talebi veya tedarikci teklif sureci baslat.',
    expectedImpact: 'Uretim ve sevkiyat kesinti riskini azaltir.',
    ownerRole: 'Depo Sorumlusu'
  }))

const createExpirySuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => sourceData.inventoryLots
  .filter(lot => {
    const daysUntil = getDaysUntil(lot.expiryDate)
    return daysUntil >= 0 && daysUntil <= EXPIRY_WARNING_DAYS && getLotQuantity(lot) > 0
  })
  .slice(0, MAX_ENTITY_SUGGESTIONS)
  .map(lot => {
    const productId = getLotProductId(lot)
    const daysUntil = getDaysUntil(lot.expiryDate)
    return createDecisionSuggestion({
      category: 'Inventory',
      title: `SKT yaklasiyor: ${lot.lotNo}`,
      description: `${getProductLabel(sourceData, productId)} lotu FEFO onceligine alinmali.`,
      reason: `Expiry ${lot.expiryDate}, kalan gun ${daysUntil}, kalan miktar ${getLotQuantity(lot)} ${lot.unit}.`,
      ruleId: 'inventory-expiry-priority',
      relatedEntityType: 'InventoryLot',
      relatedEntityId: lot.id,
      relatedLotId: lot.id,
      relatedProductId: productId,
      relatedSupplierId: lot.supplierId,
      warehouseId: lot.warehouseId,
      evidenceScore: Math.min(30, EXPIRY_WARNING_DAYS - daysUntil + 5),
      createdAt: lot.updatedAt || lot.createdAt,
      recommendationAction: 'Oncelikli uretim, transfer veya sevkiyat planina al.',
      expectedImpact: 'SKT kaynakli fire ve recall riskini azaltir.',
      ownerRole: 'Depo Sorumlusu'
    })
  })

const createWarehouseOverflowSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const buckets = new Map<string, { current: number; capacity: number }>()

  sourceData.inventoryLots.forEach(lot => {
    const current = buckets.get(lot.warehouseId) || { current: 0, capacity: 0 }
    buckets.set(lot.warehouseId, {
      current: current.current + getLotQuantity(lot),
      capacity: current.capacity + (lot.quantity || lot.receivedQuantity || 0)
    })
  })

  return Array.from(buckets.entries())
    .map(([warehouseId, values]) => ({
      warehouseId,
      rate: percent(values.current, values.capacity),
      values
    }))
    .filter(record => record.rate > 90)
    .map(record => createDecisionSuggestion({
      category: 'Inventory',
      title: `Depo doluluk riski: ${getWarehouseName(sourceData, record.warehouseId)}`,
      description: 'Depo doluluk orani %90 uzerinde.',
      reason: `Doluluk ${record.rate.toLocaleString('tr-TR')}%, miktar ${record.values.current.toLocaleString('tr-TR')} / ${record.values.capacity.toLocaleString('tr-TR')}.`,
      ruleId: 'inventory-warehouse-overflow',
      relatedEntityType: 'Warehouse',
      relatedEntityId: record.warehouseId,
      warehouseId: record.warehouseId,
      evidenceScore: Math.min(30, record.rate - 80),
      recommendationAction: 'Alternatif depo, hizli sevkiyat veya transfer planini degerlendir.',
      expectedImpact: 'Depo operasyon sikisikligini ve stok zarar riskini azaltir.',
      ownerRole: 'Depo Sorumlusu'
    }))
}

const createSlowMovingStockSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const outgoingStockIds = new Set(sourceData.stockMovements
    .filter(movement => {
      const text = `${movement.type} ${movement.reason} ${movement.source}`.toLocaleLowerCase('tr-TR')
      return text.includes('cikis') || text.includes('kullan') || text.includes('fire') || text.includes('çık') || text.includes('Ã§Ä±k')
    })
    .map(movement => movement.stockItemId))

  return sourceData.stockItems
    .filter(item => item.currentQty > item.minQty * 2 && !outgoingStockIds.has(item.id))
    .slice(0, 5)
    .map(item => createDecisionSuggestion({
      category: 'Inventory',
      title: `Yavas donen stok: ${item.name}`,
      description: 'Stok seviyesi yuksek ancak cikis hareketi dusuk.',
      reason: `${item.currentQty} ${item.unit} mevcut, son hareketlerde anlamli cikis bulunamadi.`,
      ruleId: 'inventory-slow-moving-campaign',
      relatedEntityType: 'StockItem',
      relatedEntityId: item.id,
      relatedProductId: item.id,
      branchId: item.branchId,
      evidenceScore: Math.min(30, item.currentQty / Math.max(item.minQty || 1, 1)),
      recommendationAction: 'Menu, kampanya, alternatif recete veya uretim tuketim plani olustur.',
      expectedImpact: 'Stok devir hizini artirir ve SKT/fire riskini azaltir.',
      ownerRole: 'Operasyon Muduru'
    }))
}

export const createInventoryDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => [
  ...createCriticalStockSuggestions(sourceData),
  ...createExpirySuggestions(sourceData),
  ...createWarehouseOverflowSuggestions(sourceData),
  ...createSlowMovingStockSuggestions(sourceData)
]
