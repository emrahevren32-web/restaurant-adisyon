import type { BarChartRow } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  createTrend,
  formatCurrency,
  formatNumber,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  PURCHASE_RECOMMENDATION_PRIORITY_LABELS,
  PURCHASE_RECOMMENDATION_RISK_LABELS,
  PURCHASE_RECOMMENDATION_TYPE_LABELS
} from './purchase-recommendation.constants'
import type {
  PurchaseRecommendationItem,
  PurchaseRecommendationReport,
  PurchaseRecommendationStatistics
} from './purchase-recommendation.types'

const flattenItems = (
  reports: PurchaseRecommendationReport[]
) => reports.flatMap(report => report.items)

const toRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string }>
): BarChartRow[] => rows
  .filter(row => row.value > 0)
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, 8)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: formatNumber(row.value, 0),
    detail: row.detail
  }))

const aggregateBy = (
  items: PurchaseRecommendationItem[],
  getKey: (item: PurchaseRecommendationItem) => string,
  getLabel: (item: PurchaseRecommendationItem) => string
) => {
  const rows = items.reduce<Map<string, { label: string; count: number; saving: number; cost: number }>>((map, item) => {
    const key = getKey(item)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(item),
      count: (previous?.count || 0) + 1,
      saving: roundKpi((previous?.saving || 0) + item.expectedSaving),
      cost: roundKpi((previous?.cost || 0) + item.expectedCost)
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.count,
    detail: `${formatNumber(row.count)} oneri / ${formatCurrency(row.saving)} tasarruf`
  })))
}

const aggregateTypeRows = (
  items: PurchaseRecommendationItem[]
) => {
  const rows = items.reduce<Map<string, number>>((map, item) => {
    map.set(item.recommendationType, (map.get(item.recommendationType) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([type, count]) => ({
    id: type,
    label: PURCHASE_RECOMMENDATION_TYPE_LABELS[type as PurchaseRecommendationItem['recommendationType']],
    value: count,
    detail: `${formatNumber(count)} satin alma onerisi`
  })))
}

const aggregateRiskRows = (
  items: PurchaseRecommendationItem[]
) => {
  const rows = items.reduce<Map<string, number>>((map, item) => {
    map.set(item.risk, (map.get(item.risk) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([risk, count]) => ({
    id: risk,
    label: PURCHASE_RECOMMENDATION_RISK_LABELS[risk as PurchaseRecommendationItem['risk']],
    value: count,
    detail: `${formatNumber(count)} risk sinyali`
  })))
}

const aggregatePriorityRows = (
  items: PurchaseRecommendationItem[]
) => {
  const rows = items.reduce<Map<string, number>>((map, item) => {
    map.set(item.priority, (map.get(item.priority) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([priority, count]) => ({
    id: priority,
    label: PURCHASE_RECOMMENDATION_PRIORITY_LABELS[priority as PurchaseRecommendationItem['priority']],
    value: count,
    detail: `${formatNumber(count)} oncelik`
  })))
}

export const createPurchaseRecommendationStatistics = (
  reports: PurchaseRecommendationReport[]
): PurchaseRecommendationStatistics => {
  const items = flattenItems(reports)

  return {
    totalRecommendations: items.length,
    criticalPurchases: items.filter(item => item.risk === 'CRITICAL' || item.priority === 'URGENT').length,
    expectedSaving: roundKpi(sumBy(items, item => item.expectedSaving)),
    expectedCost: roundKpi(sumBy(items, item => item.expectedCost)),
    alternativeSupplierCount: new Set(items.map(item => item.alternativeSupplierId).filter(Boolean)).size,
    averageRiskScore: averageBy(items, item => item.riskScore),
    averageConfidence: averageBy(items, item => item.confidenceScore),
    typeRows: aggregateTypeRows(items),
    branchRows: aggregateBy(items, item => item.branchId, item => item.branchName),
    warehouseRows: aggregateBy(items, item => item.warehouseId, item => item.warehouseName),
    categoryRows: aggregateBy(items, item => item.categoryId || item.recommendationType, item => item.categoryName || PURCHASE_RECOMMENDATION_TYPE_LABELS[item.recommendationType]),
    productRows: aggregateBy(items, item => item.stockItemId || item.productId, item => item.stockItemName || item.productName || item.relatedEntityName),
    supplierRows: aggregateBy(items, item => item.supplierId || item.alternativeSupplierId, item => item.supplierName || item.alternativeSupplierName),
    riskRows: aggregateRiskRows(items),
    priorityRows: aggregatePriorityRows(items),
    monthlyTrend: createTrend(
      reports,
      'YEAR',
      report => report.reportDate,
      report => report.items.length,
      'Aylik Satin Alma Oneri Trendi',
      '#2563eb'
    )
  }
}

export const PurchaseRecommendationStatisticsService = {
  create: createPurchaseRecommendationStatistics
}
