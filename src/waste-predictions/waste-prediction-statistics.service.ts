import type { BarChartRow } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  createTrend,
  formatCurrency,
  formatNumber,
  formatPercent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  WASTE_PREDICTION_PRIORITY_LABELS,
  WASTE_PREDICTION_RISK_LABELS,
  WASTE_PREDICTION_TYPE_LABELS
} from './waste-prediction.constants'
import type {
  WastePredictionItem,
  WastePredictionReport,
  WastePredictionStatistics
} from './waste-prediction.types'

const flattenItems = (
  reports: WastePredictionReport[]
) => reports.flatMap(report => report.items)

const toRows = (
  rows: Array<{ id: string; label: string; value: number; formattedValue: string; detail: string }>
): BarChartRow[] => rows
  .filter(row => row.id && row.value > 0)
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, 8)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: row.formattedValue,
    detail: row.detail
  }))

const aggregateSum = (
  items: WastePredictionItem[],
  getKey: (item: WastePredictionItem) => string,
  getLabel: (item: WastePredictionItem) => string,
  getValue: (item: WastePredictionItem) => number,
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

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.total,
    formattedValue: format(row.total),
    detail: `${formatNumber(row.count)} tahmin / ${detailSuffix}`
  })))
}

const aggregateAverage = (
  items: WastePredictionItem[],
  getKey: (item: WastePredictionItem) => string,
  getLabel: (item: WastePredictionItem) => string,
  getValue: (item: WastePredictionItem) => number,
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

  return toRows(Array.from(rows.entries()).map(([id, row]) => {
    const average = row.count > 0 ? row.total / row.count : 0
    return {
      id,
      label: row.label,
      value: average,
      formattedValue: format(average),
      detail: `${formatNumber(row.count)} tahmin / ${detailSuffix}`
    }
  }))
}

const aggregateCount = (
  items: WastePredictionItem[],
  getKey: (item: WastePredictionItem) => string,
  getLabel: (item: WastePredictionItem) => string,
  detailSuffix: string
) => {
  const rows = items.reduce<Map<string, { label: string; count: number }>>((map, item) => {
    const key = getKey(item)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(item),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.count,
    formattedValue: formatNumber(row.count),
    detail: `${formatNumber(row.count)} ${detailSuffix}`
  })))
}

const aggregateTypeRows = (
  items: WastePredictionItem[]
) => aggregateCount(
  items,
  item => item.predictionType,
  item => WASTE_PREDICTION_TYPE_LABELS[item.predictionType],
  'öneri'
)

const aggregateRiskRows = (
  items: WastePredictionItem[]
) => aggregateCount(
  items,
  item => item.risk,
  item => WASTE_PREDICTION_RISK_LABELS[item.risk],
  'risk sinyali'
)

const aggregatePriorityRows = (
  items: WastePredictionItem[]
) => aggregateCount(
  items,
  item => item.priority,
  item => WASTE_PREDICTION_PRIORITY_LABELS[item.priority],
  'öncelik kaydı'
)

const getTopLabel = (
  rows: BarChartRow[]
) => rows[0]?.label || '-'

export const createWastePredictionStatistics = (
  reports: WastePredictionReport[]
): WastePredictionStatistics => {
  const items = flattenItems(reports)
  const productWasteRows = aggregateSum(
    items,
    item => item.productId || item.productName,
    item => item.productName,
    item => item.expectedWasteKg,
    value => `${formatNumber(value, 1)} kg`,
    'beklenen fire'
  )
  const lineWasteRows = aggregateSum(
    items,
    item => item.productionLineId || item.productionLineName,
    item => item.productionLineName,
    item => item.expectedWasteKg,
    value => `${formatNumber(value, 1)} kg`,
    'hat bazlı fire'
  )

  return {
    totalPredictions: items.length,
    totalExpectedWasteKg: roundKpi(sumBy(items, item => item.expectedWasteKg)),
    expectedWasteCost: roundKpi(sumBy(items, item => item.expectedWasteCost)),
    mostRiskyProductName: getTopLabel(productWasteRows),
    mostRiskyLineName: getTopLabel(lineWasteRows),
    averageWastePercent: averageBy(items, item => item.expectedWastePercent),
    averageConfidence: averageBy(items, item => item.confidenceScore),
    criticalScenarioCount: items.filter(item => item.criticalWasteScenario || item.risk === 'CRITICAL').length,
    productWasteRows,
    lineWasteRows,
    machineWasteRows: aggregateSum(
      items,
      item => item.machineId || item.machineName,
      item => `${item.machineCode} / ${item.machineName}`.trim(),
      item => item.expectedWasteKg,
      value => `${formatNumber(value, 1)} kg`,
      'makine bazlı fire'
    ),
    costRows: aggregateSum(
      items,
      item => item.productId || item.productName,
      item => item.productName,
      item => item.expectedWasteCost,
      value => formatCurrency(value),
      'fire maliyeti'
    ),
    supplierWasteRows: aggregateSum(
      items,
      item => item.supplierId || item.supplierName,
      item => item.supplierName || 'Tedarikçi yok',
      item => item.expectedWasteKg,
      value => `${formatNumber(value, 1)} kg`,
      'tedarikçi bazlı fire'
    ),
    lotWasteRows: aggregateSum(
      items,
      item => item.lotId || item.lotNo,
      item => item.lotNo || 'Lot yok',
      item => item.expectedWasteKg,
      value => `${formatNumber(value, 1)} kg`,
      'lot bazlı fire'
    ),
    reasonRows: aggregateAverage(
      items,
      item => item.riskReason,
      item => item.riskReason,
      item => item.expectedWastePercent,
      formatPercent,
      'ortalama fire oranı'
    ),
    expectedSavingRows: aggregateSum(
      items,
      item => item.productId || item.recipeId || item.productName,
      item => item.productName || item.recipeName,
      item => item.expectedSaving,
      value => formatCurrency(value),
      'beklenen tasarruf'
    ),
    typeRows: aggregateTypeRows(items),
    riskRows: aggregateRiskRows(items),
    priorityRows: aggregatePriorityRows(items),
    wasteTrend: createTrend(
      items,
      'MONTH',
      item => item.createdAt,
      item => item.expectedWasteKg,
      'Fire Trendi',
      '#dc2626'
    )
  }
}

export const WastePredictionStatisticsService = {
  create: createWastePredictionStatistics
}
