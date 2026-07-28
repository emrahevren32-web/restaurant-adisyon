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
  CAPACITY_PLAN_STATUS_LABELS
} from './capacity-planning.constants'
import type {
  CapacityPlan,
  CapacityStatistics,
  MachineCapacity,
  ProductionCapacity,
  WorkCenterCapacity
} from './capacity-planning.types'

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const toBarRows = (
  rows: Array<{ id: string; label: string; value: number; detail: string }>,
  limit = 8
): BarChartRow[] => rows
  .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
  .slice(0, limit)
  .map(row => ({
    id: row.id,
    label: row.label,
    value: roundKpi(row.value),
    formattedValue: formatPercent(row.value),
    detail: row.detail
  }))

const aggregateProductionRows = (
  capacities: ProductionCapacity[]
) => {
  const map = capacities.reduce<Map<string, { label: string; load: number; available: number; bottleneck: number }>>((rows, capacity) => {
    const previous = rows.get(capacity.productionLineId)
    rows.set(capacity.productionLineId, {
      label: previous?.label || capacity.productionLineName,
      load: roundKpi((previous?.load || 0) + capacity.totalLoadMinutes),
      available: roundKpi((previous?.available || 0) + capacity.availableMinutes),
      bottleneck: (previous?.bottleneck || 0) + (capacity.bottleneck ? 1 : 0)
    })
    return rows
  }, new Map())

  return toBarRows(Array.from(map.entries()).map(([id, row]) => ({
    id,
    label: row.label,
    value: percent(row.load, row.available),
    detail: `${formatNumber(row.bottleneck)} darbogaz / ${formatNumber(row.load)} dk yuk`
  })))
}

const aggregateMachineRows = (
  machines: MachineCapacity[]
) => toBarRows(machines.map(machine => ({
  id: machine.machineId,
  label: machine.machineCode,
  value: machine.utilizationPercent,
  detail: `${machine.machineName} / ${formatNumber(machine.totalLoadMinutes)} dk`
})))

const aggregateWorkCenterRows = (
  capacities: WorkCenterCapacity[]
) => toBarRows(capacities.map(capacity => ({
  id: capacity.workCenterId,
  label: capacity.workCenterName,
  value: capacity.utilizationPercent,
  detail: `${formatNumber(capacity.machineCount)} makine / ${formatNumber(capacity.overloadMinutes)} dk asiri yuk`
})))

const aggregateStatusRows = (
  plans: CapacityPlan[]
) => {
  const rows = plans.reduce<Map<string, number>>((map, plan) => {
    map.set(plan.status, (map.get(plan.status) || 0) + 1)
    return map
  }, new Map())

  return Array.from(rows.entries())
    .map(([status, count]) => ({
      id: status,
      label: CAPACITY_PLAN_STATUS_LABELS[status as CapacityPlan['status']],
      value: count,
      formattedValue: formatNumber(count),
      detail: `${formatNumber(count)} plan`
    }))
    .sort((first, second) => second.value - first.value)
}

export const createCapacityStatistics = (
  plans: CapacityPlan[]
): CapacityStatistics => {
  const todayKey = getTodayKey()
  const activePlans = plans.filter(plan => plan.status !== 'CANCELLED')
  const productionCapacities = activePlans.flatMap(plan => plan.productionCapacities)
  const machineCapacities = activePlans.flatMap(plan => plan.machineCapacities)
  const workCenterCapacities = activePlans.flatMap(plan => plan.workCenterCapacities)
  const totalCapacityMinutes = sumBy(productionCapacities, capacity => capacity.availableMinutes)
  const usedCapacityMinutes = sumBy(productionCapacities, capacity => capacity.totalLoadMinutes)
  const overloadMinutes = sumBy(productionCapacities, capacity => capacity.overloadMinutes)
  const idleCapacityMinutes = sumBy(productionCapacities, capacity => capacity.idleMinutes)

  return {
    todayPlans: activePlans.filter(plan => plan.planDate === todayKey).length,
    totalPlans: activePlans.length,
    analyzedPlans: activePlans.filter(plan => plan.status === 'ANALYZED').length,
    approvedPlans: activePlans.filter(plan => plan.status === 'APPROVED').length,
    revisedPlans: activePlans.filter(plan => plan.status === 'REVISED').length,
    totalLines: new Set(productionCapacities.map(capacity => capacity.productionLineId)).size,
    totalMachines: new Set(machineCapacities.map(machine => machine.machineId)).size,
    totalCapacityMinutes,
    usedCapacityMinutes,
    idleCapacityMinutes,
    overloadMinutes,
    bottleneckCount: productionCapacities.filter(capacity => capacity.bottleneck).length,
    maintenanceClosedLines: productionCapacities.filter(capacity => capacity.maintenanceClosed).length,
    utilizationPercent: percent(usedCapacityMinutes, totalCapacityMinutes),
    lineRows: aggregateProductionRows(productionCapacities),
    machineRows: aggregateMachineRows(machineCapacities),
    workCenterRows: aggregateWorkCenterRows(workCenterCapacities),
    statusRows: aggregateStatusRows(activePlans),
    monthlyTrend: createTrend(
      activePlans,
      'MONTH',
      plan => plan.planDate,
      plan => plan.productionCapacities.reduce((total, capacity) => total + capacity.totalLoadMinutes, 0),
      'Aylik Kapasite Trendi',
      '#0f766e'
    )
  }
}

export const CapacityStatisticsService = {
  create: createCapacityStatistics
}
