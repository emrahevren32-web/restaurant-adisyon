import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { StockItem, StockMovement } from '../types'
import type { InventoryKpiView, KpiFilters, KpiSourceData } from './kpi.types'
import {
  ALL_FILTER,
  KPI_COLORS,
  createBarRows,
  createCard,
  createPieSlices,
  createTrend,
  formatNumber,
  formatPercent,
  formatQuantity,
  matchesOptionalFilter,
  matchesPeriod,
  percent,
  roundKpi,
  sumBy
} from './kpi.utils'

const EXPIRY_WARNING_DAYS = 14

const getLotProductId = (lot: InventoryLot) => lot.productId || lot.stockItemId

const getLotProductLabel = (
  lot: InventoryLot,
  sourceData: KpiSourceData
) => (
  sourceData.productRefs.find(product => product.id === lot.productId)?.name
  || sourceData.stockItems.find(item => item.id === lot.stockItemId)?.name
  || lot.productId
  || lot.stockItemId
  || 'Urun'
)

const matchesInventoryLotFilters = (
  lot: InventoryLot,
  filters: KpiFilters
) => (
  matchesOptionalFilter(filters.warehouseId, lot.warehouseId)
  && matchesOptionalFilter(filters.lotId, lot.id)
  && matchesOptionalFilter(filters.supplierId, lot.supplierId)
  && (filters.productId === ALL_FILTER || getLotProductId(lot) === filters.productId)
)

const matchesStockItemFilters = (
  item: StockItem,
  filters: KpiFilters
) => (
  matchesOptionalFilter(filters.branchId, item.branchId)
  && (filters.productId === ALL_FILTER || item.id === filters.productId)
)

const matchesMovementFilters = (
  movement: StockMovement,
  filters: KpiFilters
) => (
  matchesPeriod(movement.movementDate || movement.createdAt, filters.period)
  && matchesOptionalFilter(filters.branchId, movement.branchId)
  && (filters.productId === ALL_FILTER || movement.stockItemId === filters.productId)
)

const getDaysUntil = (dateValue: string) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((date.getTime() - today.getTime()) / 86400000)
}

const isFrozenOrBlockedLot = (lot: InventoryLot) => (
  lot.status === 'QUARANTINE'
  || lot.status === 'BLOCKED'
  || lot.notes.toLocaleLowerCase('tr-TR').includes('don')
  || lot.notes.toLocaleLowerCase('tr-TR').includes('soguk')
)

const isOutgoingMovement = (movement: StockMovement) => {
  const movementText = `${movement.type} ${movement.reason} ${movement.source}`.toLocaleLowerCase('tr-TR')
  return (
    movementText.includes('cikis')
    || movementText.includes('Ã§Ä±k')
    || movementText.includes('çık')
    || movementText.includes('kullan')
    || movementText.includes('fire')
  )
}

export const createInventoryKpiView = (
  sourceData: KpiSourceData,
  filters: KpiFilters
): InventoryKpiView => {
  const filteredStockItems = sourceData.stockItems.filter(item => matchesStockItemFilters(item, filters))
  const filteredLots = sourceData.inventoryLots.filter(lot => matchesInventoryLotFilters(lot, filters))
  const periodLots = filteredLots.filter(lot => matchesPeriod(lot.productionDate || lot.createdAt, filters.period))
  const filteredMovements = sourceData.stockMovements.filter(movement => matchesMovementFilters(movement, filters))
  const outgoingMovements = filteredMovements.filter(isOutgoingMovement)
  const totalStock = sumBy(filteredStockItems, item => item.currentQty)
  const criticalStockItems = filteredStockItems.filter(item => item.currentQty <= item.minQty)
  const frozenLotQuantity = sumBy(filteredLots.filter(isFrozenOrBlockedLot), lot => lot.remainingQuantity || lot.quantity)
  const consumedQuantity = sumBy(outgoingMovements, movement => movement.qty)
  const stockTurnoverRate = totalStock > 0 ? roundKpi(consumedQuantity / totalStock) : 0
  const totalLotQuantity = sumBy(filteredLots, lot => lot.quantity || lot.receivedQuantity)
  const remainingLotQuantity = sumBy(filteredLots, lot => lot.remainingQuantity || 0)
  const warehouseOccupancyRate = percent(remainingLotQuantity, totalLotQuantity)
  const expiringLots = filteredLots.filter(lot => {
    const daysUntilExpiry = getDaysUntil(lot.expiryDate)
    return daysUntilExpiry >= 0 && daysUntilExpiry <= EXPIRY_WARNING_DAYS
  })

  const warehouseBuckets = new Map<string, { quantity: number; capacity: number }>()
  filteredLots.forEach(lot => {
    const current = warehouseBuckets.get(lot.warehouseId) || { quantity: 0, capacity: 0 }
    warehouseBuckets.set(lot.warehouseId, {
      quantity: current.quantity + (lot.remainingQuantity || 0),
      capacity: current.capacity + (lot.quantity || lot.receivedQuantity || 0)
    })
  })

  const rawMaterialBuckets = new Map<string, number>()
  outgoingMovements.forEach(movement => {
    rawMaterialBuckets.set(movement.stockItemName, (rawMaterialBuckets.get(movement.stockItemName) || 0) + movement.qty)
  })

  const distributionBuckets = new Map<string, number>()
  filteredLots.forEach(lot => {
    const label = lot.status
    distributionBuckets.set(label, (distributionBuckets.get(label) || 0) + (lot.remainingQuantity || lot.quantity))
  })

  return {
    cards: [
      createCard('inventory-total', 'Toplam Stok', formatQuantity(totalStock), `${formatNumber(filteredStockItems.length)} stok karti`, 'neutral'),
      createCard('inventory-critical', 'Kritik Stok', formatNumber(criticalStockItems.length), 'Min seviyenin altindaki stoklar', criticalStockItems.length > 0 ? 'danger' : 'success'),
      createCard('inventory-frozen', 'Donmus / Blokeli Stok', formatQuantity(frozenLotQuantity), 'Karantina, blokeli veya soguk stok', frozenLotQuantity > 0 ? 'warning' : 'neutral'),
      createCard('inventory-turnover', 'Stok Devir Hizi', `${formatNumber(stockTurnoverRate, 2)}x`, 'Cikis miktari / mevcut stok', 'neutral'),
      createCard('inventory-occupancy', 'Depo Doluluk', formatPercent(warehouseOccupancyRate), 'Lot kalan miktari / lot kapasitesi', warehouseOccupancyRate > 85 ? 'warning' : 'success'),
      createCard('inventory-lots', 'Lot Sayisi', formatNumber(filteredLots.length), 'Inventory Lot kayitlari', 'neutral'),
      createCard('inventory-expiry', 'SKT Yaklasan Urunler', formatNumber(expiringLots.length), `${EXPIRY_WARNING_DAYS} gun icinde SKT`, expiringLots.length > 0 ? 'warning' : 'success')
    ],
    inventoryTrend: createTrend(
      periodLots,
      filters.period,
      lot => lot.productionDate || lot.createdAt,
      lot => lot.remainingQuantity || lot.quantity,
      'Inventory Trend',
      KPI_COLORS[5]
    ),
    warehouseOccupancy: createBarRows(
      Array.from(warehouseBuckets.entries()).map(([warehouseId, values]) => {
        const warehouse = sourceData.branches.find(branch => branch.id === warehouseId)
        const rate = percent(values.quantity, values.capacity)
        return {
          id: warehouseId,
          label: warehouse?.name || warehouseId || 'Depo',
          value: rate,
          detail: `${formatQuantity(values.quantity)} / ${formatQuantity(values.capacity)}`,
          tone: rate > 85 ? 'warning' as const : 'success' as const
        }
      }),
      8,
      '%'
    ),
    mostUsedRawMaterials: createBarRows(
      Array.from(rawMaterialBuckets.entries()).map(([label, value]) => ({ id: label, label, value })),
      8
    ),
    inventoryDistribution: createPieSlices(
      Array.from(distributionBuckets.entries()).map(([label, value]) => ({ id: label, label, value }))
    )
  }
}
