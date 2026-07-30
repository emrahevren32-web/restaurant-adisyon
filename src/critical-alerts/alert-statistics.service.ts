import type { BarChartRow } from '../kpi-reporting/kpi.types'
import {
  averageBy,
  createTrend,
  formatNumber,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  ALERT_CATEGORY_LABELS,
  ALERT_LEVEL_LABELS
} from './critical-alert.constants'
import type {
  AlertStatistics,
  CriticalAlert
} from './critical-alert.types'

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

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
  alerts: CriticalAlert[],
  getKey: (alert: CriticalAlert) => string,
  getLabel: (alert: CriticalAlert) => string
) => {
  const rows = alerts.reduce<Map<string, { label: string; count: number; score: number }>>((map, alert) => {
    const key = getKey(alert)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(alert),
      count: (previous?.count || 0) + 1,
      score: roundKpi((previous?.score || 0) + alert.riskScore)
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.count,
    detail: `${formatNumber(row.count)} alarm / ${formatNumber(row.score / Math.max(1, row.count), 1)} risk`
  })))
}

const aggregateCategoryRows = (
  alerts: CriticalAlert[]
) => {
  const rows = alerts.reduce<Map<string, number>>((map, alert) => {
    map.set(alert.category, (map.get(alert.category) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([category, count]) => ({
    id: category,
    label: ALERT_CATEGORY_LABELS[category as CriticalAlert['category']],
    value: count,
    detail: `${formatNumber(count)} alarm`
  })))
}

const aggregateLevelRows = (
  alerts: CriticalAlert[]
) => {
  const rows = alerts.reduce<Map<string, number>>((map, alert) => {
    map.set(alert.level, (map.get(alert.level) || 0) + 1)
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([level, count]) => ({
    id: level,
    label: ALERT_LEVEL_LABELS[level as CriticalAlert['level']],
    value: count,
    detail: `${formatNumber(count)} alarm`
  })))
}

export const createAlertStatistics = (
  alerts: CriticalAlert[]
): AlertStatistics => {
  const activeAlerts = alerts.filter(alert => alert.status === 'ACTIVE' || alert.status === 'ACKNOWLEDGED')

  return {
    totalAlerts: alerts.length,
    activeAlerts: activeAlerts.length,
    criticalAlerts: activeAlerts.filter(alert => alert.level === 'CRITICAL').length,
    todayAlerts: alerts.filter(alert => alert.createdAt.slice(0, 10) === getTodayKey()).length,
    averageRiskScore: averageBy(activeAlerts, alert => alert.riskScore),
    categoryRows: aggregateCategoryRows(activeAlerts),
    branchRows: aggregateBy(activeAlerts, alert => alert.branchId, alert => alert.branchName),
    lineRows: aggregateBy(activeAlerts, alert => alert.productionLineId, alert => alert.productionLineName),
    machineRows: aggregateBy(activeAlerts, alert => alert.machineId, alert => alert.machineCode || alert.machineName),
    personnelRows: aggregateBy(activeAlerts, alert => alert.employeeId, alert => alert.employeeName),
    levelRows: aggregateLevelRows(activeAlerts),
    monthlyTrend: createTrend(
      alerts,
      'MONTH',
      alert => alert.createdAt,
      () => 1,
      'Aylik Alert Trend',
      '#dc2626'
    )
  }
}

export const AlertStatisticsService = {
  create: createAlertStatistics,
  totalRisk: (alerts: CriticalAlert[]) => sumBy(alerts, alert => alert.riskScore)
}
