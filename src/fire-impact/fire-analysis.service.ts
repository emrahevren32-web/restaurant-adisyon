import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  KPI_COLORS,
  createBarRows,
  createCard,
  createPieSlices,
  createTrend,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatQuantity,
  getDateKey,
  matchesOptionalFilter,
  matchesPeriod,
  percent,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import { createFireImpacts, resolveProductionLine } from './fire-impact.service'
import type {
  FireAnalysisFilters,
  FireAnalysisInsight,
  FireAnalysisView,
  FireImpact,
  FireImpactLeader,
  FireStatistic
} from './fire-impact.types'

export const createDefaultFireAnalysisFilters = (): FireAnalysisFilters => ({
  period: 'MONTH',
  branchId: ALL_FILTER,
  warehouseId: ALL_FILTER,
  productId: ALL_FILTER,
  lotId: ALL_FILTER,
  supplierId: ALL_FILTER,
  operator: ALL_FILTER,
  category: ALL_FILTER,
  department: ALL_FILTER
})

const matchesFireFilters = (
  impact: FireImpact,
  filters: FireAnalysisFilters
) => (
  matchesPeriod(impact.occurredAt, filters.period)
  && matchesOptionalFilter(filters.branchId, impact.branchId)
  && matchesOptionalFilter(filters.warehouseId, impact.warehouseId)
  && (
    filters.productId === ALL_FILTER
    || filters.productId === impact.productId
    || filters.productId === impact.stockItemId
  )
  && matchesOptionalFilter(filters.lotId, impact.lotId)
  && matchesOptionalFilter(filters.operator, impact.operator)
  && matchesOptionalFilter(filters.category, impact.category)
  && matchesOptionalFilter(filters.department, impact.department)
)

const getProductionQuantity = (
  sourceData: KpiSourceData,
  filters: FireAnalysisFilters
) => sumBy(
  sourceData.productionOrders.filter(order => (
    matchesPeriod(order.createdAt || order.deliveryDate, filters.period)
    && (filters.operator === ALL_FILTER || order.requester === filters.operator || order.createdByUserId === filters.operator)
  )),
  order => sumBy(order.lines, line => line.quantity)
)

const createStatistics = (
  impacts: FireImpact[],
  productionQuantity: number
): FireStatistic => {
  const totalQuantity = sumBy(impacts, impact => impact.quantity)
  const totalCost = sumBy(impacts, impact => impact.cost.totalCost)

  return {
    totalQuantity,
    totalCost,
    fireRate: percent(totalQuantity, productionQuantity),
    recordCount: impacts.length,
    productCount: new Set(impacts.map(impact => impact.productId || impact.stockItemId)).size,
    lotCount: new Set(impacts.map(impact => impact.lotId).filter(Boolean)).size,
    averageCost: impacts.length > 0 ? roundKpi(totalCost / impacts.length) : 0,
    highRiskImpactCount: impacts.filter(impact => impact.impactScore >= 65).length
  }
}

const createLeader = (
  id: string,
  label: string,
  value: number,
  detail: string
): FireImpactLeader => ({ id, label, value: roundKpi(value), detail })

const createBucketLeader = (
  impacts: FireImpact[],
  getKey: (impact: FireImpact) => string,
  getLabel: (impact: FireImpact) => string
): FireImpactLeader | undefined => {
  const buckets = new Map<string, { label: string; quantity: number; cost: number; count: number }>()

  impacts.forEach(impact => {
    const key = getKey(impact)
    if(!key) return
    const current = buckets.get(key) || { label: getLabel(impact), quantity: 0, cost: 0, count: 0 }
    buckets.set(key, {
      label: current.label,
      quantity: roundKpi(current.quantity + impact.quantity),
      cost: roundKpi(current.cost + impact.cost.totalCost),
      count: current.count + 1
    })
  })

  const leader = Array.from(buckets.entries())
    .sort((first, second) => second[1].quantity - first[1].quantity || second[1].cost - first[1].cost)
    [0]

  return leader
    ? createLeader(leader[0], leader[1].label, leader[1].quantity, `${formatCurrency(leader[1].cost)} / ${formatNumber(leader[1].count)} kayit`)
    : undefined
}

const createInsights = (
  impacts: FireImpact[],
  sourceData: KpiSourceData
): FireAnalysisInsight => {
  const mostWastedProduct = createBucketLeader(impacts, impact => impact.productId || impact.stockItemId, impact => impact.productName)
  const mostWastedOperator = createBucketLeader(impacts, impact => impact.operator, impact => impact.operator)
  const mostWastedDepartment = createBucketLeader(impacts, impact => impact.department, impact => impact.department)

  const lineBuckets = new Map<string, { label: string; quantity: number; cost: number; count: number }>()
  impacts.forEach(impact => {
    const productionOrder = sourceData.productionOrders.find(order => order.id === impact.productionOrderId)
    const line = resolveProductionLine(productionOrder, sourceData)
    const key = line?.id || impact.department
    const current = lineBuckets.get(key) || { label: line?.name || impact.department, quantity: 0, cost: 0, count: 0 }
    lineBuckets.set(key, {
      label: current.label,
      quantity: roundKpi(current.quantity + impact.quantity),
      cost: roundKpi(current.cost + impact.cost.totalCost),
      count: current.count + 1
    })
  })
  const topLine = Array.from(lineBuckets.entries())
    .sort((first, second) => second[1].quantity - first[1].quantity || second[1].cost - first[1].cost)
    [0]

  return {
    mostWastedProduct,
    mostWastedLine: topLine
      ? createLeader(topLine[0], topLine[1].label, topLine[1].quantity, `${formatCurrency(topLine[1].cost)} / ${formatNumber(topLine[1].count)} kayit`)
      : undefined,
    mostWastedOperator,
    mostWastedDepartment,
    highestCostImpact: [...impacts].sort((first, second) => second.cost.totalCost - first.cost.totalCost)[0]
  }
}

const createPeriodBuckets = (
  impacts: FireImpact[],
  getBucket: (impact: FireImpact) => string,
  limit: number
) => createBarRows(
  Array.from(impacts.reduce<Map<string, number>>((map, impact) => {
    const key = getBucket(impact)
    if(!key) return map
    map.set(key, roundKpi((map.get(key) || 0) + impact.quantity))
    return map
  }, new Map<string, number>()).entries())
    .map(([label, value]) => ({ id: label, label, value })),
  limit
)

const getWeekKey = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return ''
  const firstDay = new Date(date.getFullYear(), 0, 1)
  const dayOffset = Math.floor((date.getTime() - firstDay.getTime()) / 86400000)
  const week = Math.ceil((dayOffset + firstDay.getDay() + 1) / 7)
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`
}

export const createFireAnalysisView = (
  sourceData: KpiSourceData,
  filters: FireAnalysisFilters
): FireAnalysisView => {
  const impacts = createFireImpacts(sourceData)
  const filteredImpacts = impacts.filter(impact => matchesFireFilters(impact, filters))
  const productionQuantity = getProductionQuantity(sourceData, filters)
  const statistics = createStatistics(filteredImpacts, productionQuantity)
  const insights = createInsights(filteredImpacts, sourceData)

  const categoryTotals = Array.from(filteredImpacts.reduce<Map<string, number>>((map, impact) => {
    map.set(impact.category, roundKpi((map.get(impact.category) || 0) + impact.quantity))
    return map
  }, new Map<string, number>()).entries())

  return {
    generatedAt: new Date().toISOString(),
    filters,
    impacts,
    filteredImpacts,
    statistics,
    cards: [
      createCard('fire-total', 'Toplam Fire', formatQuantity(statistics.totalQuantity), `${formatNumber(statistics.recordCount)} aktif fire kaydi`, statistics.totalQuantity > 0 ? 'warning' : 'success'),
      createCard('fire-cost', 'Toplam Fire Maliyeti', formatCurrency(statistics.totalCost), 'Tahmini maliyet etkisi', statistics.totalCost > 0 ? 'warning' : 'success'),
      createCard('fire-rate', 'Fire %', formatPercent(statistics.fireRate), 'Fire / uretim miktari', statistics.fireRate > 3 ? 'danger' : statistics.fireRate > 1 ? 'warning' : 'success'),
      createCard('fire-risk-product', 'En Riskli Urun', insights.mostWastedProduct?.label || '-', insights.mostWastedProduct?.detail || 'Fire kaydi yok', insights.mostWastedProduct ? 'warning' : 'success'),
      createCard('fire-risk-department', 'En Riskli Departman', insights.mostWastedDepartment?.label || '-', insights.mostWastedDepartment?.detail || 'Fire kaydi yok', insights.mostWastedDepartment ? 'warning' : 'success'),
      createCard('fire-high-risk', 'Yuksek Etki', formatNumber(statistics.highRiskImpactCount), 'Impact score >= 65', statistics.highRiskImpactCount > 0 ? 'danger' : 'success')
    ],
    fireTrend: createTrend(filteredImpacts, filters.period, impact => impact.occurredAt, impact => impact.quantity, 'Fire Trend', KPI_COLORS[4]),
    costTrend: createTrend(filteredImpacts, filters.period, impact => impact.occurredAt, impact => impact.cost.totalCost, 'Maliyet Trendi', KPI_COLORS[2]),
    categoryDistribution: createPieSlices(categoryTotals.map(([id, value]) => ({ id, label: id, value }))),
    productFire: createBarRows(
      Array.from(filteredImpacts.reduce<Map<string, { label: string; value: number; cost: number }>>((map, impact) => {
        const key = impact.productId || impact.stockItemId
        const current = map.get(key) || { label: impact.productName, value: 0, cost: 0 }
        map.set(key, {
          label: current.label,
          value: roundKpi(current.value + impact.quantity),
          cost: roundKpi(current.cost + impact.cost.totalCost)
        })
        return map
      }, new Map()).entries())
        .map(([id, row]) => ({ id, label: row.label, value: row.value, detail: formatCurrency(row.cost) })),
      8
    ),
    lotFire: createBarRows(
      Array.from(filteredImpacts.reduce<Map<string, { label: string; value: number; cost: number }>>((map, impact) => {
        const key = impact.lotId || impact.lotNo
        if(!key) return map
        const current = map.get(key) || { label: impact.lotNo || key, value: 0, cost: 0 }
        map.set(key, {
          label: current.label,
          value: roundKpi(current.value + impact.quantity),
          cost: roundKpi(current.cost + impact.cost.totalCost)
        })
        return map
      }, new Map()).entries())
        .map(([id, row]) => ({ id, label: row.label, value: row.value, detail: formatCurrency(row.cost) })),
      8
    ),
    departmentFire: createBarRows(
      Array.from(filteredImpacts.reduce<Map<string, number>>((map, impact) => {
        map.set(impact.department, roundKpi((map.get(impact.department) || 0) + impact.quantity))
        return map
      }, new Map()).entries())
        .map(([label, value]) => ({ id: label, label, value })),
      8
    ),
    dailyFire: createPeriodBuckets(filteredImpacts, impact => getDateKey(impact.occurredAt), 10),
    weeklyFire: createPeriodBuckets(filteredImpacts, impact => getWeekKey(impact.occurredAt), 10),
    monthlyFire: createPeriodBuckets(filteredImpacts, impact => getDateKey(impact.occurredAt).slice(0, 7), 12),
    insights
  }
}
