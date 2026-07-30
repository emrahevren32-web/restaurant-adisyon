import type { BarChartRow } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  createTrend,
  formatNumber,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  FORECAST_RISK_LABELS,
  FORECAST_TYPE_LABELS
} from './forecasting.constants'
import type {
  ForecastPrediction,
  ForecastReport,
  ForecastStatistics
} from './forecasting.types'

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

const flattenPredictions = (
  reports: ForecastReport[]
) => reports.flatMap(report => report.predictions)

const aggregateBy = (
  predictions: ForecastPrediction[],
  getKey: (prediction: ForecastPrediction) => string,
  getLabel: (prediction: ForecastPrediction) => string
) => {
  const rows = predictions.reduce<Map<string, { label: string; count: number; value: number; risk: number }>>((map, prediction) => {
    const key = getKey(prediction)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(prediction),
      count: (previous?.count || 0) + 1,
      value: roundKpi((previous?.value || 0) + prediction.expectedValue),
      risk: roundKpi((previous?.risk || 0) + prediction.riskScore)
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.value,
    detail: `${formatNumber(row.count)} tahmin / ${formatNumber(row.risk / Math.max(1, row.count), 1)} risk`
  })))
}

const aggregateTypeRows = (
  predictions: ForecastPrediction[]
) => {
  const rows = predictions.reduce<Map<string, number>>((map, prediction) => {
    map.set(prediction.forecastType, (map.get(prediction.forecastType) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([type, count]) => ({
    id: type,
    label: FORECAST_TYPE_LABELS[type as ForecastPrediction['forecastType']],
    value: count,
    detail: `${formatNumber(count)} tahmin`
  })))
}

const aggregateRiskRows = (
  predictions: ForecastPrediction[]
) => {
  const rows = predictions.reduce<Map<string, number>>((map, prediction) => {
    map.set(prediction.riskLevel, (map.get(prediction.riskLevel) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([risk, count]) => ({
    id: risk,
    label: FORECAST_RISK_LABELS[risk as ForecastPrediction['riskLevel']],
    value: count,
    detail: `${formatNumber(count)} tahmin`
  })))
}

export const createForecastStatistics = (
  reports: ForecastReport[]
): ForecastStatistics => {
  const predictions = flattenPredictions(reports)
  const biggestIncrease = [...predictions].sort((first, second) => second.growthPercent - first.growthPercent)[0]
  const biggestDecrease = [...predictions].sort((first, second) => first.growthPercent - second.growthPercent)[0]

  return {
    totalForecasts: predictions.length,
    riskyForecasts: predictions.filter(prediction => prediction.riskLevel === 'HIGH' || prediction.riskLevel === 'CRITICAL').length,
    biggestIncreaseLabel: biggestIncrease ? `${biggestIncrease.entityName} ${formatNumber(biggestIncrease.growthPercent, 1)}%` : '-',
    biggestDecreaseLabel: biggestDecrease ? `${biggestDecrease.entityName} ${formatNumber(biggestDecrease.growthPercent, 1)}%` : '-',
    averageConfidence: averageBy(predictions, prediction => prediction.confidenceScore),
    expectedDemand: sumBy(predictions, prediction => prediction.expectedDemand),
    expectedProduction: sumBy(predictions, prediction => prediction.expectedProduction),
    expectedStock: sumBy(predictions.filter(prediction => prediction.forecastType === 'STOCK'), prediction => prediction.expectedStock),
    expectedWaste: sumBy(predictions, prediction => prediction.expectedWaste),
    expectedShipment: sumBy(predictions, prediction => prediction.expectedShipment),
    expectedCapacity: averageBy(predictions.filter(prediction => prediction.expectedCapacityPercent > 0), prediction => prediction.expectedCapacityPercent),
    expectedPersonnelNeed: sumBy(predictions, prediction => prediction.expectedPersonnelNeed),
    typeRows: aggregateTypeRows(predictions),
    productRows: aggregateBy(predictions, prediction => prediction.productId || prediction.stockItemId, prediction => prediction.productName || prediction.stockItemName),
    branchRows: aggregateBy(predictions, prediction => prediction.branchId, prediction => prediction.branchName),
    lineRows: aggregateBy(predictions, prediction => prediction.productionLineId, prediction => prediction.productionLineName),
    machineRows: aggregateBy(predictions, prediction => prediction.machineId, prediction => prediction.machineCode || prediction.machineName),
    personnelRows: aggregateBy(predictions, prediction => prediction.employeeId, prediction => prediction.employeeName),
    categoryRows: aggregateBy(predictions, prediction => prediction.categoryId, prediction => prediction.categoryName),
    riskRows: aggregateRiskRows(predictions),
    monthlyTrend: createTrend(
      reports,
      'YEAR',
      report => report.reportDate,
      report => report.predictions.length,
      'Aylik Forecast Trend',
      '#2563eb'
    )
  }
}

export const ForecastStatisticsService = {
  create: createForecastStatistics
}
