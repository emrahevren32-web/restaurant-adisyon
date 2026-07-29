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
  MACHINE_SCHEDULE_STATUS_LABELS
} from './machine-scheduling.constants'
import type {
  MachineQueue,
  MachineSchedule,
  SchedulingStatistics
} from './machine-scheduling.types'

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

const aggregateByMachine = (
  queues: MachineQueue[]
) => toRows(queues.map(queue => ({
  id: queue.machineId,
  label: queue.machineCode,
  value: queue.utilizationPercent,
  detail: `${queue.machineName} / ${formatNumber(queue.itemCount)} is`
})))

const aggregateByLine = (
  queues: MachineQueue[]
) => {
  const rows = queues.reduce<Map<string, { label: string; busy: number; available: number; count: number }>>((map, queue) => {
    const previous = map.get(queue.productionLineId)
    map.set(queue.productionLineId, {
      label: previous?.label || queue.productionLineName,
      busy: roundKpi((previous?.busy || 0) + queue.totalWorkingMinutes),
      available: roundKpi((previous?.available || 0) + queue.totalWorkingMinutes + queue.idleMinutes),
      count: (previous?.count || 0) + queue.itemCount
    })
    return map
  }, new Map())

  return toRows(Array.from(rows.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: percent(row.busy, row.available),
    detail: `${formatNumber(row.count)} is / ${formatNumber(row.busy)} dk`
  })))
}

const aggregateSetupRows = (
  queues: MachineQueue[]
) => toRows(queues.map(queue => ({
  id: queue.machineId,
  label: queue.machineCode,
  value: queue.totalSetupMinutes,
  detail: `${queue.machineName} setup yuku`
})), 'minute')

const aggregateStatusRows = (
  schedules: MachineSchedule[]
) => {
  const rows = schedules.reduce<Map<string, number>>((map, schedule) => {
    map.set(schedule.status, (map.get(schedule.status) || 0) + 1)
    return map
  }, new Map())

  return Array.from(rows.entries())
    .map(([status, count]) => ({
      id: status,
      label: MACHINE_SCHEDULE_STATUS_LABELS[status as MachineSchedule['status']],
      value: count,
      formattedValue: formatNumber(count),
      detail: `${formatNumber(count)} cizelge`
    }))
    .sort((first, second) => second.value - first.value)
}

export const createSchedulingStatistics = (
  schedules: MachineSchedule[]
): SchedulingStatistics => {
  const todayKey = getTodayKey()
  const activeSchedules = schedules.filter(schedule => schedule.status !== 'CANCELLED')
  const queues = activeSchedules.flatMap(schedule => schedule.queues)
  const items = activeSchedules.flatMap(schedule => schedule.items)
  const timelines = activeSchedules.flatMap(schedule => schedule.timelines)
  const totalWorkingMinutes = sumBy(queues, queue => queue.totalWorkingMinutes)
  const availableMinutes = sumBy(timelines, timeline => timeline.availableMinutes)
  const conflictCount = items.filter(item => item.conflict || item.status === 'CONFLICT').length
  const runningMachineIds = new Set(items.filter(item => item.status === 'RUNNING' || item.status === 'READY').map(item => item.machineId))
  const machineIds = new Set(timelines.map(timeline => timeline.machineId))

  return {
    todaySchedules: activeSchedules.filter(schedule => schedule.scheduleDate === todayKey).length,
    totalSchedules: activeSchedules.length,
    plannedSchedules: activeSchedules.filter(schedule => schedule.status === 'PLANNED').length,
    readySchedules: activeSchedules.filter(schedule => schedule.status === 'READY').length,
    runningSchedules: activeSchedules.filter(schedule => schedule.status === 'RUNNING').length,
    completedSchedules: activeSchedules.filter(schedule => schedule.status === 'COMPLETED').length,
    totalMachines: machineIds.size,
    runningMachines: runningMachineIds.size,
    idleMachines: Math.max(0, machineIds.size - runningMachineIds.size),
    pendingJobs: items.filter(item => item.status === 'QUEUED' || item.status === 'SCHEDULED' || item.status === 'CONFLICT').length,
    conflictCount,
    totalSetupMinutes: sumBy(items, item => item.setupMinutes),
    totalCleaningMinutes: sumBy(items, item => item.cleaningMinutes),
    totalWaitingMinutes: sumBy(items, item => item.waitingMinutes),
    totalWorkingMinutes,
    machineUtilizationPercent: percent(totalWorkingMinutes, availableMinutes),
    lineRows: aggregateByLine(queues),
    machineRows: aggregateByMachine(queues),
    statusRows: aggregateStatusRows(activeSchedules),
    setupRows: aggregateSetupRows(queues),
    monthlyTrend: createTrend(
      activeSchedules,
      'MONTH',
      schedule => schedule.scheduleDate,
      schedule => schedule.items.reduce((total, item) => total + item.totalWorkingMinutes, 0),
      'Aylik Makine Cizelge Trendi',
      '#9333ea'
    )
  }
}

export const SchedulingStatisticsService = {
  create: createSchedulingStatistics
}
