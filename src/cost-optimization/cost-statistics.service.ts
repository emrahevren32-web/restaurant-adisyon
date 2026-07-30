import type { BarChartRow } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  createTrend,
  formatCurrency,
  formatNumber,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import { COST_OPTIMIZATION_CATEGORY_LABELS } from './cost-optimization.constants'
import type {
  CostOptimizationItem,
  CostOptimizationReport,
  CostStatistics
} from './cost-optimization.types'

const flattenItems = (
  reports: CostOptimizationReport[]
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
    formattedValue: formatCurrency(row.value),
    detail: row.detail
  }))

const aggregateBy = (
  items: CostOptimizationItem[],
  getKey: (item: CostOptimizationItem) => string,
  getLabel: (item: CostOptimizationItem) => string
) => {
  const rows = items.reduce<Map<string, { label: string; saving: number; count: number }>>((map, item) => {
    const key = getKey(item)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(item),
      saving: roundKpi((previous?.saving || 0) + item.savingPotential),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.saving,
    detail: `${formatNumber(row.count)} firsat`
  })))
}

const aggregateCategoryRows = (
  items: CostOptimizationItem[]
) => {
  const rows = items.reduce<Map<string, { saving: number; count: number }>>((map, item) => {
    const previous = map.get(item.category)
    map.set(item.category, {
      saving: roundKpi((previous?.saving || 0) + item.savingPotential),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([category, row]) => ({
    id: category,
    label: COST_OPTIMIZATION_CATEGORY_LABELS[category as CostOptimizationItem['category']],
    value: row.saving,
    detail: `${formatNumber(row.count)} maliyet kalemi`
  })))
}

export const createCostOptimizationStatistics = (
  reports: CostOptimizationReport[]
): CostStatistics => {
  const items = flattenItems(reports)
  const topItem = [...items].sort((first, second) => second.savingPotential - first.savingPotential)[0]

  return {
    totalSaving: roundKpi(sumBy(items, item => item.savingPotential)),
    criticalCosts: items.filter(item => item.risk === 'CRITICAL' || item.priority === 'URGENT').length,
    largestSavingLabel: topItem ? `${topItem.relatedEntityName} / ${formatCurrency(topItem.savingPotential)}` : '-',
    expectedMonthlyGain: roundKpi(sumBy(items, item => item.expectedMonthlyGain)),
    expectedAnnualGain: roundKpi(sumBy(items, item => item.expectedAnnualGain)),
    averageRoi: averageBy(items, item => item.roiEstimate),
    averageConfidence: averageBy(items, item => item.confidenceScore),
    averageRiskScore: averageBy(items, item => item.riskScore),
    categoryRows: aggregateCategoryRows(items),
    branchRows: aggregateBy(items, item => item.branchId, item => item.branchName),
    productRows: aggregateBy(items, item => item.productId, item => item.productName),
    lineRows: aggregateBy(items, item => item.productionLineId, item => item.productionLineName),
    machineRows: aggregateBy(items, item => item.machineId, item => item.machineCode || item.machineName),
    supplierRows: aggregateBy(items, item => item.supplierId, item => item.supplierName),
    monthlyTrend: createTrend(
      reports,
      'YEAR',
      report => report.reportDate,
      report => sumBy(report.items, item => item.savingPotential),
      'Aylik Cost Optimization Trend',
      '#0891b2'
    ),
    yearlyTrend: createTrend(
      reports,
      'YEAR',
      report => report.reportDate,
      report => sumBy(report.items, item => item.expectedAnnualGain),
      'Yillik Tasarruf Trend',
      '#0f766e'
    )
  }
}

export const CostStatisticsService = {
  create: createCostOptimizationStatistics
}
