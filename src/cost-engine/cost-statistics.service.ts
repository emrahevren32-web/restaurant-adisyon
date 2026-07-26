import type { BarChartRow, PieChartSlice } from '../kpi-reporting/kpi.types'
import {
  KPI_COLORS,
  createBarRows,
  createPieSlices,
  formatCurrency,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import type { CostComponentType, CostEngine, CostStatistics } from './cost-engine.types'

const getTrendPercent = (records: CostEngine[]) => {
  if(records.length < 2) return 0
  const sortedRecords = [...records].sort((first, second) => first.calculationDate.localeCompare(second.calculationDate))
  const midpoint = Math.ceil(sortedRecords.length / 2)
  const previousCost = sumBy(sortedRecords.slice(0, midpoint), record => record.totalCost)
  const currentCost = sumBy(sortedRecords.slice(midpoint), record => record.totalCost)

  if(previousCost <= 0) return currentCost > 0 ? 100 : 0
  return roundKpi(((currentCost - previousCost) / previousCost) * 100)
}

export const createCostStatistics = (
  records: CostEngine[]
): CostStatistics => {
  const totalCost = sumBy(records, record => record.totalCost)
  const fireImpact = sumBy(records, record => record.fireImpact)
  const purchaseImpact = sumBy(records, record => record.purchaseImpact)
  const recordsWithCost = records.filter(record => record.totalCost > 0)
  const recordsWithKg = records.filter(record => record.costPerKg > 0)
  const mostProfitableProduct = [...recordsWithCost]
    .sort((first, second) => first.costPerUnit - second.costPerUnit || first.productName.localeCompare(second.productName, 'tr-TR'))
    [0]
  const highestCostProduct = [...recordsWithCost]
    .sort((first, second) => second.totalCost - first.totalCost || first.productName.localeCompare(second.productName, 'tr-TR'))
    [0]

  return {
    totalProducts: new Set(records.map(record => record.productId)).size,
    totalCost,
    averageCost: recordsWithCost.length > 0 ? roundKpi(totalCost / recordsWithCost.length) : 0,
    averageCostPerKg: recordsWithKg.length > 0 ? roundKpi(sumBy(recordsWithKg, record => record.costPerKg) / recordsWithKg.length) : 0,
    mostProfitableProduct,
    highestCostProduct,
    fireImpact,
    purchaseImpact,
    fireImpactPercent: percent(fireImpact, totalCost),
    purchaseImpactPercent: percent(purchaseImpact, totalCost),
    trend: getTrendPercent(records)
  }
}

export const createCostBreakdownDistribution = (
  records: CostEngine[]
): PieChartSlice[] => {
  const buckets = records.reduce<Map<CostComponentType, { label: string; value: number }>>((map, record) => {
    record.breakdown.components.forEach(component => {
      const current = map.get(component.type) || { label: component.label, value: 0 }
      map.set(component.type, {
        label: current.label,
        value: roundKpi(current.value + component.amount)
      })
    })
    return map
  }, new Map())

  return createPieSlices(Array.from(buckets.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.value
  })), ' TL').map((slice, index) => ({
    ...slice,
    color: KPI_COLORS[index % KPI_COLORS.length],
    formattedValue: formatCurrency(slice.value)
  }))
}

export const createCategoryCostRows = (
  records: CostEngine[]
): BarChartRow[] => {
  const buckets = records.reduce<Map<string, { label: string; value: number; count: number }>>((map, record) => {
    const current = map.get(record.categoryId) || { label: record.categoryName, value: 0, count: 0 }
    map.set(record.categoryId, {
      label: current.label,
      value: roundKpi(current.value + record.totalCost),
      count: current.count + 1
    })
    return map
  }, new Map())

  return createBarRows(
    Array.from(buckets.entries()).map(([id, row]) => ({
      id,
      label: row.label,
      value: row.value,
      detail: `${row.count} urun`
    })),
    8,
    ' TL'
  ).map(row => ({ ...row, formattedValue: formatCurrency(row.value) }))
}

export const createProductCostRows = (
  records: CostEngine[]
): BarChartRow[] => createBarRows(
  records.map(record => ({
    id: record.id,
    label: record.productName,
    value: record.totalCost,
    detail: `${formatCurrency(record.costPerKg)} / kg`
  })),
  8,
  ' TL'
).map(row => ({ ...row, formattedValue: formatCurrency(row.value) }))

export const createFireImpactRows = (
  records: CostEngine[]
): BarChartRow[] => createBarRows(
  records
    .filter(record => record.fireImpact > 0)
    .map(record => ({
      id: record.id,
      label: record.productName,
      value: record.fireImpact,
      detail: `${roundKpi(record.firePercent)}% standart fire`
    })),
  8,
  ' TL'
).map(row => ({ ...row, formattedValue: formatCurrency(row.value) }))
