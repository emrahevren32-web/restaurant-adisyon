import type { BarChartRow } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  createTrend,
  formatNumber,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  IMPROVEMENT_AREA_LABELS,
  IMPROVEMENT_PRIORITY_LABELS
} from './continuous-improvement.constants'
import type {
  ImprovementOpportunity,
  ImprovementReport,
  ImprovementStatistics
} from './continuous-improvement.types'

const toRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string }>,
  maximumFractionDigits = 1
): BarChartRow[] => rows
  .filter(row => row.value > 0)
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, 8)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: formatNumber(row.value, maximumFractionDigits),
    detail: row.detail
  }))

const aggregateBy = (
  opportunities: ImprovementOpportunity[],
  getKey: (opportunity: ImprovementOpportunity) => string,
  getLabel: (opportunity: ImprovementOpportunity) => string
) => {
  const rows = opportunities.reduce<Map<string, { label: string; gain: number; count: number }>>((map, opportunity) => {
    const key = getKey(opportunity)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(opportunity),
      gain: roundKpi((previous?.gain || 0) + opportunity.expectedGainMinutes),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.gain,
    detail: `${formatNumber(row.count)} firsat / ${formatNumber(row.gain)} dk kazanc`
  })))
}

const aggregateAreaRows = (
  opportunities: ImprovementOpportunity[]
) => {
  const rows = opportunities.reduce<Map<string, number>>((map, opportunity) => {
    map.set(opportunity.area, (map.get(opportunity.area) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([area, count]) => ({
    id: area,
    label: IMPROVEMENT_AREA_LABELS[area as ImprovementOpportunity['area']],
    value: count,
    detail: `${formatNumber(count)} kayit`
  })), 0)
}

const aggregatePriorityRows = (
  opportunities: ImprovementOpportunity[]
) => {
  const priorityOrder: ImprovementOpportunity['priority'][] = ['URGENT', 'HIGH', 'NORMAL', 'LOW']
  return priorityOrder.map(priority => {
    const count = opportunities.filter(opportunity => opportunity.priority === priority).length
    return {
      id: priority,
      label: IMPROVEMENT_PRIORITY_LABELS[priority],
      value: count,
      formattedValue: formatNumber(count),
      detail: `${formatNumber(count)} kayit`
    }
  }).filter(row => row.value > 0)
}

export const createImprovementStatistics = (
  reports: ImprovementReport[]
): ImprovementStatistics => {
  const activeReports = reports.filter(report => report.status !== 'CANCELLED')
  const opportunities = activeReports.flatMap(report => report.opportunities)
  const topPriority = [...opportunities].sort((first, second) => (
    second.expectedBenefitScore - first.expectedBenefitScore
    || second.expectedGainMinutes - first.expectedGainMinutes
  ))[0]

  return {
    totalOpportunities: opportunities.length,
    criticalOpportunities: opportunities.filter(opportunity => opportunity.riskLevel === 'CRITICAL').length,
    urgentRecommendations: opportunities.filter(opportunity => opportunity.priority === 'URGENT').length,
    expectedGainMinutes: sumBy(opportunities, opportunity => opportunity.expectedGainMinutes),
    averageBenefitScore: averageBy(opportunities, opportunity => opportunity.expectedBenefitScore),
    topPriorityLabel: topPriority?.summary || '-',
    lineRows: aggregateBy(opportunities, opportunity => opportunity.productionLineId, opportunity => opportunity.productionLineName),
    machineRows: aggregateBy(opportunities, opportunity => opportunity.machineId, opportunity => opportunity.machineCode || opportunity.machineName),
    personnelRows: aggregateBy(opportunities, opportunity => opportunity.employeeId, opportunity => opportunity.employeeName),
    departmentRows: aggregateBy(opportunities, opportunity => opportunity.department, opportunity => opportunity.department),
    areaRows: aggregateAreaRows(opportunities),
    priorityRows: aggregatePriorityRows(opportunities),
    monthlyTrend: createTrend(
      activeReports,
      'MONTH',
      report => report.reportDate,
      report => sumBy(report.opportunities, opportunity => opportunity.expectedGainMinutes),
      'Aylik Improvement Trend',
      '#059669'
    )
  }
}

export const ImprovementStatisticsService = {
  create: createImprovementStatistics
}
