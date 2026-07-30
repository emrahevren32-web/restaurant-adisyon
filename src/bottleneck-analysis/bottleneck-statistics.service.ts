import type { BarChartRow } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  createTrend,
  formatNumber,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  BOTTLENECK_RISK_LABELS,
  BOTTLENECK_TYPE_LABELS
} from './bottleneck-analysis.constants'
import type {
  BottleneckItem,
  BottleneckReport,
  BottleneckRiskLevel,
  BottleneckStatistics
} from './bottleneck-analysis.types'

const toRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string }>,
  unit: 'score' | 'minute' | 'count' = 'score'
): BarChartRow[] => rows
  .filter(row => row.value > 0)
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, 8)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: unit === 'minute'
      ? `${formatNumber(row.value)} dk`
      : formatNumber(row.value, unit === 'score' ? 1 : 0),
    detail: row.detail
  }))

const aggregateBy = (
  items: BottleneckItem[],
  getKey: (item: BottleneckItem) => string,
  getLabel: (item: BottleneckItem) => string
) => {
  const rows = items.reduce<Map<string, { label: string; score: number; count: number; working: number }>>((map, item) => {
    const key = getKey(item)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(item),
      score: roundKpi((previous?.score || 0) + item.riskScore),
      count: (previous?.count || 0) + 1,
      working: roundKpi((previous?.working || 0) + item.workingMinutes)
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.count > 0 ? row.score / row.count : 0,
    detail: `${formatNumber(row.count)} darbogaz / ${formatNumber(row.working)} dk`
  })))
}

const aggregateRiskRows = (
  items: BottleneckItem[]
) => {
  const riskOrder: BottleneckRiskLevel[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
  return riskOrder.map(risk => {
    const count = items.filter(item => item.riskLevel === risk).length
    return {
      id: risk,
      label: BOTTLENECK_RISK_LABELS[risk],
      value: count,
      formattedValue: formatNumber(count),
      detail: `${formatNumber(count)} kayit`
    }
  }).filter(row => row.value > 0)
}

const aggregateTypeRows = (
  items: BottleneckItem[]
) => {
  const rows = items.reduce<Map<string, number>>((map, item) => {
    map.set(item.bottleneckType, (map.get(item.bottleneckType) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([type, count]) => ({
    id: type,
    label: BOTTLENECK_TYPE_LABELS[type as BottleneckItem['bottleneckType']],
    value: count,
    detail: `${formatNumber(count)} kayit`
  })), 'count')
}

export const createBottleneckStatistics = (
  reports: BottleneckReport[]
): BottleneckStatistics => {
  const activeReports = reports.filter(report => report.status !== 'CANCELLED')
  const items = activeReports.flatMap(report => report.items)
  const criticalItems = items.filter(item => item.riskLevel === 'CRITICAL')
  const highItems = items.filter(item => item.riskLevel === 'HIGH')
  const topLine = aggregateBy(items, item => item.productionLineId, item => item.productionLineName)[0]
  const topMachine = aggregateBy(items, item => item.machineId, item => item.machineCode || item.machineName)[0]

  return {
    totalBottlenecks: items.length,
    criticalBottlenecks: criticalItems.length,
    highRiskBottlenecks: highItems.length,
    topLineName: topLine?.label || '-',
    topMachineName: topMachine?.label || '-',
    averageRiskScore: averageBy(items, item => item.riskScore),
    totalWaitingMinutes: sumBy(items, item => item.waitingMinutes),
    totalSetupMinutes: sumBy(items, item => item.setupMinutes),
    totalCleaningMinutes: sumBy(items, item => item.cleaningMinutes),
    totalWorkingMinutes: sumBy(items, item => item.workingMinutes),
    riskRows: aggregateRiskRows(items),
    machineRows: aggregateBy(items, item => item.machineId, item => item.machineCode || item.machineName),
    lineRows: aggregateBy(items, item => item.productionLineId, item => item.productionLineName),
    personnelRows: aggregateBy(items, item => item.employeeId, item => item.employeeName),
    workCenterRows: aggregateBy(items, item => item.workCenterId, item => item.workCenterName),
    typeRows: aggregateTypeRows(items),
    monthlyTrend: createTrend(
      activeReports,
      'MONTH',
      report => report.reportDate,
      report => report.items.length,
      'Aylik Bottleneck Trend',
      '#dc2626'
    ),
    riskTrend: createTrend(
      activeReports,
      'MONTH',
      report => report.reportDate,
      report => averageBy(report.items, item => item.riskScore),
      'Risk Trend',
      '#f97316'
    )
  }
}

export const BottleneckStatisticsService = {
  create: createBottleneckStatistics
}
