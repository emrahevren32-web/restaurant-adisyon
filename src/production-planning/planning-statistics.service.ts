import type { BarChartRow } from '../kpi-reporting/kpi.types'
import {
  createTrend,
  formatNumber,
  formatQuantity,
  percent,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import {
  PRODUCTION_PLAN_STATUS_LABELS,
  PRODUCTION_PLAN_TYPE_LABELS
} from './production-planning.constants'
import type {
  ProductionPlan,
  ProductionPlanningStatistics
} from './production-planning.types'

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const createRows = (
  plans: ProductionPlan[],
  getKey: (plan: ProductionPlan) => string,
  getLabel: (plan: ProductionPlan) => string,
  getValue: (plan: ProductionPlan) => number,
  unit = ''
): BarChartRow[] => {
  const rows = plans.reduce<Map<string, { label: string; value: number; count: number }>>((map, plan) => {
    const key = getKey(plan)
    if(!key) return map
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || getLabel(plan),
      value: roundKpi((previous?.value || 0) + getValue(plan)),
      count: (previous?.count || 0) + 1
    })
    return map
  }, new Map())

  return Array.from(rows.entries())
    .map(([id, row]) => ({
      id,
      label: row.label || id,
      value: row.value,
      formattedValue: unit ? formatQuantity(row.value, unit) : formatNumber(row.value),
      detail: `${formatNumber(row.count)} plan`
    }))
    .sort((first, second) => second.value - first.value)
    .slice(0, 8)
}

const createProductRows = (
  plans: ProductionPlan[]
): BarChartRow[] => {
  const rows = plans.flatMap(plan => plan.items).reduce<Map<string, { label: string; value: number; unit: string }>>((map, item) => {
    const previous = map.get(item.productId)
    map.set(item.productId, {
      label: previous?.label || item.productName,
      value: roundKpi((previous?.value || 0) + item.produceQuantity),
      unit: previous?.unit || item.unit
    })
    return map
  }, new Map())

  return Array.from(rows.entries())
    .map(([id, row]) => ({
      id,
      label: row.label,
      value: row.value,
      formattedValue: formatQuantity(row.value, row.unit),
      detail: `Uretilecek ${formatQuantity(row.value, row.unit)}`
    }))
    .sort((first, second) => second.value - first.value)
    .slice(0, 8)
}

export const createProductionPlanningStatistics = (
  plans: ProductionPlan[]
): ProductionPlanningStatistics => {
  const todayKey = getTodayKey()
  const activePlans = plans.filter(plan => plan.status !== 'CANCELLED')
  const totalProduction = roundKpi(activePlans.reduce((total, plan) => (
    total + plan.items.reduce((itemTotal, item) => itemTotal + item.produceQuantity, 0)
  ), 0))
  const estimatedMinutes = roundKpi(activePlans.reduce((total, plan) => (
    total + plan.items.reduce((itemTotal, item) => itemTotal + item.estimatedMinutes, 0)
  ), 0))
  const averageCapacity = activePlans.length > 0
    ? roundKpi(activePlans.reduce((total, plan) => {
      const planCapacity = plan.items.length > 0
        ? plan.items.reduce((itemTotal, item) => itemTotal + item.capacityUsagePercent, 0) / plan.items.length
        : 0
      return total + planCapacity
    }, 0) / activePlans.length)
    : 0

  return {
    todayPlans: activePlans.filter(plan => plan.planDate === todayKey).length,
    totalPlans: activePlans.length,
    pendingPlans: activePlans.filter(plan => plan.status === 'DRAFT' || plan.status === 'PREPARING').length,
    approvedPlans: activePlans.filter(plan => plan.status === 'APPROVED').length,
    revisedPlans: activePlans.filter(plan => plan.status === 'REVISED').length,
    totalProducts: new Set(activePlans.flatMap(plan => plan.items.map(item => item.productId))).size,
    totalProduction,
    estimatedMinutes,
    capacityUsagePercent: averageCapacity,
    branchRows: createRows(activePlans, plan => plan.branchId, plan => plan.branchName, plan => plan.items.reduce((total, item) => total + item.produceQuantity, 0), ''),
    productRows: createProductRows(activePlans),
    statusRows: createRows(activePlans, plan => plan.status, plan => PRODUCTION_PLAN_STATUS_LABELS[plan.status], () => 1),
    typeRows: createRows(activePlans, plan => plan.planType, plan => PRODUCTION_PLAN_TYPE_LABELS[plan.planType], () => 1),
    monthlyTrend: createTrend(
      activePlans,
      'MONTH',
      plan => plan.planDate,
      plan => plan.items.reduce((total, item) => total + item.produceQuantity, 0),
      'Aylik Uretim Plan Trendi',
      '#2563eb'
    )
  }
}

export const PlanningStatisticsService = {
  create: createProductionPlanningStatistics,
  capacity: percent
}
