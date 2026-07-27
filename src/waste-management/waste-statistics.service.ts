import {
  KPI_COLORS,
  createBarRows,
  createTrend,
  formatCurrency,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import type { WasteRecord, WasteStatistics } from './waste.types'

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const activeRecords = (
  records: WasteRecord[]
) => records.filter(record => record.status !== 'CANCELLED' && record.status !== 'REJECTED')

const createGroupedRows = (
  records: WasteRecord[],
  getKey: (record: WasteRecord) => string,
  getLabel: (record: WasteRecord) => string,
  useCost = false
) => createBarRows(
  Array.from(records.reduce<Map<string, { label: string; quantity: number; cost: number }>>((map, record) => {
    const key = getKey(record)
    if(!key) return map
    const current = map.get(key) || { label: getLabel(record), quantity: 0, cost: 0 }
    map.set(key, {
      label: current.label,
      quantity: roundKpi(current.quantity + record.quantity),
      cost: roundKpi(current.cost + record.totalCost)
    })
    return map
  }, new Map()).entries())
    .map(([id, row]) => ({
      id,
      label: row.label,
      value: useCost ? row.cost : row.quantity,
      detail: formatCurrency(row.cost)
    })),
  8
)

const getTopLabel = (
  rows: ReturnType<typeof createGroupedRows>
) => rows[0]?.label || '-'

export const createWasteStatistics = (
  records: WasteRecord[],
  productionQuantity: number
): WasteStatistics => {
  const usableRecords = activeRecords(records)
  const totalQuantity = sumBy(usableRecords, record => record.quantity)
  const totalWasteCost = sumBy(usableRecords, record => record.totalCost)
  const productRows = createGroupedRows(usableRecords, record => record.productId || record.stockItemId, record => record.productName || record.stockItemName)
  const warehouseRows = createGroupedRows(usableRecords, record => record.warehouseId, record => record.warehouseName)

  return {
    todayWaste: usableRecords.filter(record => record.date === todayKey()).length,
    totalWaste: usableRecords.length,
    totalWasteCost,
    topProductName: getTopLabel(productRows),
    topWarehouseName: getTopLabel(warehouseRows),
    wasteRate: percent(totalQuantity, productionQuantity),
    totalQuantity,
    productCount: new Set(usableRecords.map(record => record.productId || record.stockItemId).filter(Boolean)).size,
    categoryRows: createGroupedRows(usableRecords, record => record.wasteType, record => record.wasteType),
    productRows,
    warehouseRows,
    branchRows: createGroupedRows(usableRecords, record => record.branchId, record => record.branchName),
    reasonRows: createGroupedRows(usableRecords, record => record.wasteReason, record => record.wasteReason),
    monthlyTrend: createTrend(
      usableRecords,
      'YEAR',
      record => record.date,
      record => record.quantity,
      'Aylik Fire Trend',
      KPI_COLORS[4]
    )
  }
}

export const WasteStatisticsService = {
  create: createWasteStatistics
}
