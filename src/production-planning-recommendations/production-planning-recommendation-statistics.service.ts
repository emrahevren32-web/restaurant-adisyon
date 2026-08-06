import type { BarChartRow } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  createTrend,
  formatNumber,
  formatPercent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS,
  PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS
} from './production-planning-recommendation.constants'
import type {
  ProductionPlanningRecommendationItem,
  ProductionPlanningRecommendationReport,
  ProductionPlanningRecommendationStatistics
} from './production-planning-recommendation.types'

const flattenItems = (
  reports: ProductionPlanningRecommendationReport[]
) => reports.flatMap(report => report.items)

const toRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string }>
): BarChartRow[] => rows
  .filter(row => row.id && row.value > 0)
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, 8)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: formatNumber(row.value, 1),
    detail: row.detail
  }))

const aggregateCount = (
  items: ProductionPlanningRecommendationItem[],
  getKey: (item: ProductionPlanningRecommendationItem) => string,
  getLabel: (item: ProductionPlanningRecommendationItem) => string,
  detailSuffix = 'öneri'
) => {
  const rows = items.reduce<Map<string, { label: string; count: number; gain: number }>>((map, item) => {
    const key = getKey(item)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(item),
      count: (previous?.count || 0) + 1,
      gain: roundKpi((previous?.gain || 0) + item.expectedTimeGainMinutes)
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.count,
    detail: `${formatNumber(row.count)} ${detailSuffix} / ${formatNumber(row.gain, 0)} dk`
  })))
}

const aggregateAverage = (
  items: ProductionPlanningRecommendationItem[],
  getKey: (item: ProductionPlanningRecommendationItem) => string,
  getLabel: (item: ProductionPlanningRecommendationItem) => string,
  getValue: (item: ProductionPlanningRecommendationItem) => number,
  format: (value: number) => string,
  detailSuffix: string
) => {
  const rows = items.reduce<Map<string, { label: string; total: number; count: number }>>((map, item) => {
    const key = getKey(item)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(item),
      total: (previous?.total || 0) + getValue(item),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())

  return Array.from(rows.entries())
    .map(([id, row]) => {
      const average = row.count > 0 ? row.total / row.count : 0
      return {
        id,
        label: row.label,
        value: roundKpi(average),
        formattedValue: format(average),
        detail: `${formatNumber(row.count)} kayıt / ${detailSuffix}`
      }
    })
    .filter(row => row.value > 0)
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
    .slice(0, 8)
}

const aggregateSum = (
  items: ProductionPlanningRecommendationItem[],
  getKey: (item: ProductionPlanningRecommendationItem) => string,
  getLabel: (item: ProductionPlanningRecommendationItem) => string,
  getValue: (item: ProductionPlanningRecommendationItem) => number,
  format: (value: number) => string,
  detailSuffix: string
) => {
  const rows = items.reduce<Map<string, { label: string; total: number; count: number }>>((map, item) => {
    const key = getKey(item)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(item),
      total: roundKpi((previous?.total || 0) + getValue(item)),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())

  return Array.from(rows.entries())
    .map(([id, row]) => ({
      id,
      label: row.label,
      value: row.total,
      formattedValue: format(row.total),
      detail: `${formatNumber(row.count)} kayıt / ${detailSuffix}`
    }))
    .filter(row => row.value > 0)
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
    .slice(0, 8)
}

const aggregateTypeRows = (
  items: ProductionPlanningRecommendationItem[]
) => {
  const rows = items.reduce<Map<string, number>>((map, item) => {
    map.set(item.recommendationType, (map.get(item.recommendationType) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([type, count]) => ({
    id: type,
    label: PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS[type as ProductionPlanningRecommendationItem['recommendationType']],
    value: count,
    detail: `${formatNumber(count)} üretim planlama önerisi`
  })))
}

const aggregateRiskRows = (
  items: ProductionPlanningRecommendationItem[]
) => {
  const rows = items.reduce<Map<string, number>>((map, item) => {
    map.set(item.risk, (map.get(item.risk) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([risk, count]) => ({
    id: risk,
    label: PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS[risk as ProductionPlanningRecommendationItem['risk']],
    value: count,
    detail: `${formatNumber(count)} risk sinyali`
  })))
}

const aggregatePriorityRows = (
  items: ProductionPlanningRecommendationItem[]
) => {
  const rows = items.reduce<Map<string, number>>((map, item) => {
    map.set(item.priority, (map.get(item.priority) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([priority, count]) => ({
    id: priority,
    label: PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS[priority as ProductionPlanningRecommendationItem['priority']],
    value: count,
    detail: `${formatNumber(count)} öncelik kaydı`
  })))
}

export const createProductionPlanningRecommendationStatistics = (
  reports: ProductionPlanningRecommendationReport[]
): ProductionPlanningRecommendationStatistics => {
  const items = flattenItems(reports)

  return {
    totalRecommendations: items.length,
    criticalBottlenecks: items.filter(item => item.bottleneck && item.risk === 'CRITICAL').length,
    expectedCapacityGainPercent: averageBy(items, item => item.expectedCapacityGainPercent),
    expectedCapacityGainMinutes: roundKpi(sumBy(items, item => item.expectedCapacityGainMinutes)),
    delayedProductionCount: items.filter(item => item.delayedProduction).length,
    averageLineEfficiency: averageBy(items, item => item.expectedLineUtilizationPercent),
    averageConfidence: averageBy(items, item => item.confidenceScore),
    typeRows: aggregateTypeRows(items),
    riskRows: aggregateRiskRows(items),
    priorityRows: aggregatePriorityRows(items),
    lineOccupancyRows: aggregateAverage(
      items,
      item => item.productionLineId,
      item => item.productionLineName,
      item => item.currentLineUtilizationPercent,
      formatPercent,
      'ortalama hat doluluğu'
    ),
    machineUtilizationRows: aggregateAverage(
      items,
      item => item.machineId,
      item => `${item.machineCode} / ${item.machineName}`.trim(),
      item => item.currentMachineUtilizationPercent,
      formatPercent,
      'makine kullanım oranı'
    ),
    capacityDistributionRows: aggregateCount(items, item => item.productionLineId, item => item.productionLineName, 'kapasite önerisi'),
    bottleneckRows: aggregateCount(items.filter(item => item.bottleneck), item => item.machineId || item.productionLineId, item => item.machineName || item.productionLineName, 'darboğaz'),
    productProductionRows: aggregateSum(
      items,
      item => item.productId || item.productName,
      item => item.productName,
      item => item.plannedQuantity,
      value => formatNumber(value, 1),
      'planlanan üretim'
    ),
    expectedCapacityGainRows: aggregateSum(
      items,
      item => item.productionLineId,
      item => item.productionLineName,
      item => item.expectedCapacityGainMinutes,
      value => `${formatNumber(value, 0)} dk`,
      'beklenen kapasite kazancı'
    ),
    setupGainRows: aggregateSum(
      items.filter(item => item.setupOptimizationScenario || item.setupTimeGainMinutes > 0),
      item => item.recipeId || item.productId,
      item => item.recipeName || item.productName,
      item => item.setupTimeGainMinutes,
      value => `${formatNumber(value, 0)} dk`,
      'setup kazancı'
    ),
    wasteReductionRows: aggregateSum(
      items.filter(item => item.wasteReductionPercent > 0),
      item => item.productId || item.recipeId,
      item => item.productName || item.recipeName,
      item => item.wasteReductionPercent,
      formatPercent,
      'fire azalış tahmini'
    ),
    dailyTrend: createTrend(
      items,
      'MONTH',
      item => item.createdAt,
      () => 1,
      'Günlük Üretim Trendleri',
      '#2563eb'
    )
  }
}

export const ProductionPlanningRecommendationStatisticsService = {
  create: createProductionPlanningRecommendationStatistics
}
