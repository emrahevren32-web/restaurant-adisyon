import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import {
  createTrend,
  formatNumber,
  formatPercent,
  percent
} from '../kpi-reporting/kpi.utils'
import {
  CHECKLIST_STATUS_LABELS,
  CHECKLIST_TYPE_LABELS
} from './checklist-template.service'
import type {
  Checklist,
  ChecklistStatistics
} from './operation-checklist.types'

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const createRows = (
  checklists: Checklist[],
  getKey: (checklist: Checklist) => string,
  getLabel: (checklist: Checklist) => string
): BarChartRow[] => {
  const rows = checklists.reduce<Map<string, { label: string; value: number }>>((map, checklist) => {
    const key = getKey(checklist)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(checklist),
      value: (previous?.value || 0) + 1
    })
    return map
  }, new Map())

  return Array.from(rows.entries())
    .map(([id, row]) => ({
      id,
      label: row.label || id,
      value: row.value,
      formattedValue: formatNumber(row.value),
      detail: `${formatNumber(row.value)} checklist`
    }))
    .sort((first, second) => second.value - first.value)
    .slice(0, 8)
}

export const createChecklistStatistics = (
  checklists: Checklist[]
): ChecklistStatistics => {
  const todayKey = getTodayKey()
  const activeChecklists = checklists.filter(checklist => checklist.status !== 'CANCELLED')
  const completed = activeChecklists.filter(checklist => checklist.status === 'COMPLETED').length
  const fail = activeChecklists.filter(checklist => checklist.items.some(item => item.status === 'FAIL')).length
  const warning = activeChecklists.filter(checklist => checklist.items.some(item => item.status === 'WARNING')).length
  const pending = activeChecklists.filter(checklist => checklist.status === 'DRAFT' || checklist.status === 'IN_PROGRESS').length
  const totalItems = activeChecklists.reduce((total, checklist) => total + checklist.items.length, 0)
  const failItems = activeChecklists.reduce((total, checklist) => (
    total + checklist.items.filter(item => item.status === 'FAIL').length
  ), 0)
  const trend: ChartSeries = createTrend(
    activeChecklists,
    'MONTH',
    checklist => checklist.startAt,
    () => 1,
    'Aylik Checklist Trendi',
    '#0f766e'
  )

  return {
    todayChecklists: activeChecklists.filter(checklist => checklist.startAt.slice(0, 10) === todayKey).length,
    completed,
    pending,
    fail,
    warning,
    totalChecklists: activeChecklists.length,
    completionRate: percent(completed, activeChecklists.length),
    failRate: percent(failItems, totalItems),
    branchRows: createRows(activeChecklists, checklist => checklist.branchId, checklist => checklist.branchName),
    departmentRows: createRows(activeChecklists, checklist => checklist.department, checklist => checklist.department),
    typeRows: createRows(activeChecklists, checklist => checklist.checklistType, checklist => CHECKLIST_TYPE_LABELS[checklist.checklistType]),
    statusRows: createRows(activeChecklists, checklist => checklist.status, checklist => CHECKLIST_STATUS_LABELS[checklist.status]),
    monthlyTrend: {
      ...trend,
      points: trend.points.map(point => ({
        ...point,
        label: point.dateKey.slice(5)
      }))
    }
  }
}

export const ChecklistStatisticsService = {
  create: createChecklistStatistics,
  formatCompletion: formatPercent
}
