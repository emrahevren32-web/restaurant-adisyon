import type { BarChartRow } from '../kpi-reporting/kpi.types'
import {
  createTrend,
  formatNumber,
  formatPercent,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import {
  WORKFORCE_PLAN_STATUS_LABELS
} from './workforce-planning.constants'
import type {
  WorkforcePlan,
  WorkforceStatistics
} from './workforce-planning.types'

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const toRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string }>,
  unit: 'percent' | 'minute' | 'count' = 'percent'
): BarChartRow[] => rows
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, 8)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: unit === 'percent'
      ? formatPercent(row.value)
      : unit === 'minute'
        ? `${formatNumber(row.value)} dk`
        : formatNumber(row.value),
    detail: row.detail
  }))

const aggregateDepartments = (
  plans: WorkforcePlan[]
) => {
  const rows = plans.flatMap(plan => plan.items).reduce<Map<string, { working: number; count: number }>>((map, item) => {
    const previous = map.get(item.department)
    map.set(item.department, {
      working: roundKpi((previous?.working || 0) + item.workingMinutes),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([department, row]) => ({
    id: department,
    label: department,
    value: row.working,
    detail: `${formatNumber(row.count)} gorev`
  })), 'minute')
}

const aggregateLines = (
  plans: WorkforcePlan[]
) => {
  const rows = plans.flatMap(plan => plan.items).reduce<Map<string, { label: string; working: number; count: number }>>((map, item) => {
    const previous = map.get(item.productionLineId)
    map.set(item.productionLineId, {
      label: previous?.label || item.productionLineName,
      working: roundKpi((previous?.working || 0) + item.workingMinutes),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.working,
    detail: `${formatNumber(row.count)} gorev`
  })), 'minute')
}

const aggregateMachines = (
  plans: WorkforcePlan[]
) => {
  const rows = plans.flatMap(plan => plan.items).reduce<Map<string, { label: string; working: number; count: number }>>((map, item) => {
    const previous = map.get(item.machineId)
    map.set(item.machineId, {
      label: previous?.label || item.machineCode,
      working: roundKpi((previous?.working || 0) + item.workingMinutes),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: row.working,
    detail: `${formatNumber(row.count)} gorev`
  })), 'minute')
}

const aggregatePersonnel = (
  plans: WorkforcePlan[]
) => toRows(plans.flatMap(plan => plan.employeeAssignments).map(assignment => ({
  id: assignment.employeeId,
  label: assignment.employeeName,
  value: assignment.utilizationPercent,
  detail: `${assignment.employeeCode} / ${formatNumber(assignment.assignmentCount)} gorev`
})))

const aggregateShifts = (
  plans: WorkforcePlan[]
) => {
  const rows = plans.flatMap(plan => plan.shiftAssignments)
  return toRows(rows.map(assignment => ({
    id: assignment.id,
    label: `${assignment.shiftName} ${assignment.workDate.slice(5)}`,
    value: assignment.utilizationPercent,
    detail: `${formatNumber(assignment.assignedEmployees)} atanmis / ${formatNumber(assignment.missingEmployeeCount)} eksik`
  })))
}

export const createWorkforceStatistics = (
  plans: WorkforcePlan[]
): WorkforceStatistics => {
  const todayKey = getTodayKey()
  const activePlans = plans.filter(plan => plan.status !== 'CANCELLED')
  const items = activePlans.flatMap(plan => plan.items)
  const employeeAssignments = activePlans.flatMap(plan => plan.employeeAssignments)
  const shiftAssignments = activePlans.flatMap(plan => plan.shiftAssignments)
  const employeeIds = new Set(employeeAssignments.map(assignment => assignment.employeeId))
  const activeEmployeeIds = new Set(employeeAssignments.filter(assignment => assignment.isActive).map(assignment => assignment.employeeId))
  const assignedEmployeeIds = new Set(items.map(item => item.employeeId).filter(id => id !== 'missing_employee'))
  const totalWorkingMinutes = sumBy(items, item => item.workingMinutes)
  const availableMinutes = sumBy(shiftAssignments, assignment => assignment.availableMinutes)

  return {
    todayPersonnel: new Set(items.filter(item => item.startAt.slice(0, 10) === todayKey).map(item => item.employeeId)).size,
    totalPlans: activePlans.length,
    totalPersonnel: employeeIds.size,
    activePersonnel: activeEmployeeIds.size,
    idlePersonnel: Math.max(0, activeEmployeeIds.size - assignedEmployeeIds.size),
    missingPersonnel: sumBy(shiftAssignments, assignment => assignment.missingEmployeeCount),
    shiftUtilizationPercent: percent(totalWorkingMinutes, availableMinutes),
    totalWorkingMinutes,
    totalIdleMinutes: sumBy(employeeAssignments, assignment => assignment.idleMinutes),
    conflictCount: items.filter(item => item.conflict || item.status === 'CONFLICT').length,
    personnelRows: aggregatePersonnel(activePlans),
    shiftRows: aggregateShifts(activePlans),
    departmentRows: aggregateDepartments(activePlans),
    lineRows: aggregateLines(activePlans),
    machineRows: aggregateMachines(activePlans),
    monthlyTrend: createTrend(
      activePlans,
      'MONTH',
      plan => plan.planDate,
      plan => plan.items.reduce((total, item) => total + item.workingMinutes, 0),
      'Aylik Workforce Planning Trendi',
      '#0f766e'
    )
  }
}

export const WorkforceStatisticsService = {
  create: createWorkforceStatistics
}
