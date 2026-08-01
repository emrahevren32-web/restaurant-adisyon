import type { BarChartRow } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  createTrend,
  formatNumber,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  RECOMMENDATION_PRIORITY_LABELS,
  RECOMMENDATION_RISK_LABELS,
  RECOMMENDATION_TYPE_LABELS
} from './recommendation-engine.constants'
import type {
  RecommendationItem,
  RecommendationReport,
  RecommendationStatistics
} from './recommendation-engine.types'

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const flattenItems = (
  reports: RecommendationReport[]
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
  items: RecommendationItem[],
  getKey: (item: RecommendationItem) => string,
  getLabel: (item: RecommendationItem) => string
) => {
  const rows = items.reduce<Map<string, { label: string; count: number; gain: number; risk: number }>>((map, item) => {
    const key = getKey(item)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(item),
      count: (previous?.count || 0) + 1,
      gain: roundKpi((previous?.gain || 0) + item.expectedBenefitScore),
      risk: roundKpi((previous?.risk || 0) + item.riskScore)
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.count,
    detail: `${formatNumber(row.count)} oneri / ${formatNumber(row.gain, 1)} fayda`
  })))
}

const aggregateTypeRows = (
  items: RecommendationItem[]
) => {
  const rows = items.reduce<Map<string, number>>((map, item) => {
    map.set(item.recommendationType, (map.get(item.recommendationType) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([type, count]) => ({
    id: type,
    label: RECOMMENDATION_TYPE_LABELS[type as RecommendationItem['recommendationType']],
    value: count,
    detail: `${formatNumber(count)} oneri`
  })))
}

const aggregateRiskRows = (
  items: RecommendationItem[]
) => {
  const rows = items.reduce<Map<string, number>>((map, item) => {
    map.set(item.risk, (map.get(item.risk) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([risk, count]) => ({
    id: risk,
    label: RECOMMENDATION_RISK_LABELS[risk as RecommendationItem['risk']],
    value: count,
    detail: `${formatNumber(count)} oneri`
  })))
}

const aggregatePriorityRows = (
  items: RecommendationItem[]
) => {
  const rows = items.reduce<Map<string, number>>((map, item) => {
    map.set(item.priority, (map.get(item.priority) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([priority, count]) => ({
    id: priority,
    label: RECOMMENDATION_PRIORITY_LABELS[priority as RecommendationItem['priority']],
    value: count,
    detail: `${formatNumber(count)} oncelik`
  })))
}

const aggregateSuccessRows = (
  items: RecommendationItem[]
) => {
  const rows = [
    {
      id: 'high-confidence',
      label: 'Yuksek Guven',
      value: items.filter(item => item.confidenceScore >= 80).length,
      detail: 'Güven skoru >= 80'
    },
    {
      id: 'medium-confidence',
      label: 'Orta Guven',
      value: items.filter(item => item.confidenceScore >= 60 && item.confidenceScore < 80).length,
      detail: 'Güven skoru 60-79'
    },
    {
      id: 'low-confidence',
      label: 'Izleme',
      value: items.filter(item => item.confidenceScore < 60).length,
      detail: 'Güven skoru < 60'
    }
  ]

  return toRows(rows)
}

export const createRecommendationStatistics = (
  reports: RecommendationReport[]
): RecommendationStatistics => {
  const items = flattenItems(reports)

  return {
    totalRecommendations: items.length,
    criticalRecommendations: items.filter(item => item.risk === 'CRITICAL' || item.priority === 'URGENT').length,
    todayRecommendations: items.filter(item => item.createdAt.slice(0, 10) === getTodayKey()).length,
    expectedTotalGain: roundKpi(sumBy(items, item => item.expectedBenefitScore + item.expectedCapacityGain + item.expectedTimeGainMinutes / 10)),
    averageRiskScore: averageBy(items, item => item.riskScore),
    averageConfidence: averageBy(items, item => item.confidenceScore),
    typeRows: aggregateTypeRows(items),
    branchRows: aggregateBy(items, item => item.branchId, item => item.branchName),
    lineRows: aggregateBy(items, item => item.productionLineId, item => item.productionLineName),
    machineRows: aggregateBy(items, item => item.machineId, item => item.machineCode || item.machineName),
    personnelRows: aggregateBy(items, item => item.employeeId, item => item.employeeName),
    priorityRows: aggregatePriorityRows(items),
    riskRows: aggregateRiskRows(items),
    successRows: aggregateSuccessRows(items),
    monthlyTrend: createTrend(
      reports,
      'YEAR',
      report => report.reportDate,
      report => report.items.length,
      'Aylik Recommendation Trend',
      '#059669'
    )
  }
}

export const RecommendationStatisticsService = {
  create: createRecommendationStatistics
}
