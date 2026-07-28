import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import { createCostEngineView, mapKpiFiltersToCostEngineFilters } from '../cost-engine/cost-engine.service'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import { createFireAnalysisView } from '../fire-impact/fire-analysis.service'
import { ProductionPlanningService } from '../production-planning/production-planning.service'
import type { KpiFilters, KpiSourceData, ProductionKpiView } from './kpi.types'
import {
  ALL_FILTER,
  KPI_COLORS,
  averageBy,
  createBarRows,
  createCard,
  createTrend,
  formatCurrency,
  formatNumber,
  formatPercent,
  formatQuantity,
  matchesPeriod,
  sumBy
} from './kpi.utils'

const getOrderQuantity = (order: ProductionWorkOrder) => (
  sumBy(order.lines, line => line.quantity)
)

const getStatusKey = (status: ProductionWorkOrder['status']) => (
  String(status || '').toLocaleLowerCase('tr-TR')
)

const isCompletedOrder = (order: ProductionWorkOrder) => getStatusKey(order.status).includes('tamam')
const isCancelledOrder = (order: ProductionWorkOrder) => getStatusKey(order.status).includes('iptal')

const getBranchName = (sourceData: KpiSourceData, branchId: string) => (
  sourceData.branches.find(branch => branch.id === branchId)?.name || branchId
)

const getProductFilterName = (sourceData: KpiSourceData, productId: string) => {
  if(productId === ALL_FILTER) return ''
  return sourceData.productRefs.find(product => product.id === productId)?.name
    || sourceData.stockItems.find(item => item.id === productId)?.name
    || productId
}

const matchesProductionFilters = (
  order: ProductionWorkOrder,
  sourceData: KpiSourceData,
  filters: KpiFilters
) => {
  const branchName = getBranchName(sourceData, filters.branchId)
  const productName = getProductFilterName(sourceData, filters.productId).toLocaleLowerCase('tr-TR')
  const matchesProduct = !productName || order.lines.some(line => (
    line.productName.toLocaleLowerCase('tr-TR').includes(productName)
  ))

  return (
    matchesPeriod(order.createdAt || order.deliveryDate, filters.period)
    && (filters.branchId === ALL_FILTER || order.branch === branchName || order.branch === filters.branchId)
    && matchesProduct
    && (filters.operator === ALL_FILTER || order.requester === filters.operator || order.createdByUserId === filters.operator)
  )
}

const getLineNameForOrder = (
  order: ProductionWorkOrder,
  sourceData: KpiSourceData,
  index: number
) => {
  const linkedLine = sourceData.productionLines.find(line => (
    line.linkedWorkOrders.includes(order.workOrderNo) || line.linkedWorkOrders.includes(order.id)
  ))

  return linkedLine?.name || sourceData.productionLines[index % Math.max(sourceData.productionLines.length, 1)]?.name || 'Genel Uretim'
}

const getOperatorNameForOrder = (
  order: ProductionWorkOrder,
  sourceData: KpiSourceData,
  index: number
) => order.requester || sourceData.productionLines[index % Math.max(sourceData.productionLines.length, 1)]?.activeOperator || 'Operator'

export const createProductionKpiView = (
  sourceData: KpiSourceData,
  filters: KpiFilters
): ProductionKpiView => {
  const filteredOrders = sourceData.productionOrders.filter(order => matchesProductionFilters(order, sourceData, filters))
  const activeOrders = filteredOrders.filter(order => !isCancelledOrder(order))
  const completedOrders = activeOrders.filter(isCompletedOrder)
  const pendingOrders = activeOrders.filter(order => !isCompletedOrder(order))
  const totalProduction = sumBy(activeOrders, getOrderQuantity)
  const dailyProduction = sumBy(
    sourceData.productionOrders.filter(order => matchesProductionFilters(order, sourceData, { ...filters, period: 'TODAY' })),
    getOrderQuantity
  )
  const weeklyProduction = sumBy(
    sourceData.productionOrders.filter(order => matchesProductionFilters(order, sourceData, { ...filters, period: 'WEEK' })),
    getOrderQuantity
  )
  const monthlyProduction = sumBy(
    sourceData.productionOrders.filter(order => matchesProductionFilters(order, sourceData, { ...filters, period: 'MONTH' })),
    getOrderQuantity
  )
  const averageProductionMinutes = averageBy(completedOrders.length > 0 ? completedOrders : activeOrders, order => order.estimatedMinutes)
  const fireView = createFireAnalysisView(sourceData, { ...filters, category: ALL_FILTER, department: ALL_FILTER })
  const costView = createCostEngineView(sourceData, mapKpiFiltersToCostEngineFilters(filters))
  const planningRecords = ProductionPlanningService.list(sourceData).filter(plan => (
    matchesPeriod(plan.planDate, filters.period)
    && (filters.branchId === ALL_FILTER || plan.branchId === filters.branchId)
  ))
  const planningStatistics = ProductionPlanningService.statistics(planningRecords)
  const capacityRecords = CapacityPlanningService.list(sourceData).filter(plan => (
    matchesPeriod(plan.planDate, filters.period)
  ))
  const capacityStatistics = CapacityPlanningService.statistics(capacityRecords)

  const productBuckets = new Map<string, number>()
  activeOrders.forEach(order => {
    order.lines.forEach(line => {
      productBuckets.set(line.productName, (productBuckets.get(line.productName) || 0) + line.quantity)
    })
  })

  const lineBuckets = new Map<string, number>()
  activeOrders.forEach((order, index) => {
    const lineName = getLineNameForOrder(order, sourceData, index)
    lineBuckets.set(lineName, (lineBuckets.get(lineName) || 0) + getOrderQuantity(order))
  })

  const operatorBuckets = new Map<string, number>()
  activeOrders.forEach((order, index) => {
    const operatorName = getOperatorNameForOrder(order, sourceData, index)
    operatorBuckets.set(operatorName, (operatorBuckets.get(operatorName) || 0) + getOrderQuantity(order))
  })

  return {
    cards: [
      createCard('production-total', 'Toplam Uretim', formatQuantity(totalProduction), `${formatNumber(activeOrders.length)} aktif uretim emri`, 'neutral'),
      createCard('production-daily', 'Gunluk Uretim', formatQuantity(dailyProduction), 'Bugun uretilen toplam miktar', 'success'),
      createCard('production-weekly', 'Haftalik Uretim', formatQuantity(weeklyProduction), 'Son 7 gunluk uretim', 'neutral'),
      createCard('production-monthly', 'Aylik Uretim', formatQuantity(monthlyProduction), 'Son 30 gunluk uretim', 'neutral'),
      createCard('production-completed', 'Tamamlanan Is Emirleri', formatNumber(completedOrders.length), 'Tamamlandi durumundaki emirler', 'success'),
      createCard('production-pending', 'Bekleyen Is Emirleri', formatNumber(pendingOrders.length), 'Acik veya devam eden emirler', pendingOrders.length > 0 ? 'warning' : 'success'),
      createCard('production-average-duration', 'Ortalama Uretim Suresi', `${formatNumber(averageProductionMinutes)} dk`, 'Estimated minutes ortalamasi', 'neutral'),
      createCard('production-cost-total', 'Cost Engine Maliyeti', formatCurrency(costView.statistics.totalCost), 'Recete ve maliyet read-model toplam maliyet', 'neutral'),
      createCard('production-cost-average-kg', 'Ortalama Maliyet / kg', formatCurrency(costView.statistics.averageCostPerKg), 'Cost Engine kg maliyeti', 'neutral'),
      createCard('production-cost-fire-impact', 'Cost Fire Etkisi', formatCurrency(costView.statistics.fireImpact), formatPercent(costView.statistics.fireImpactPercent), costView.statistics.fireImpactPercent > 7 ? 'danger' : costView.statistics.fireImpactPercent > 3 ? 'warning' : 'success'),
      createCard('production-cost-purchase-impact', 'Cost Satin Alma Etkisi', formatCurrency(costView.statistics.purchaseImpact), formatPercent(costView.statistics.purchaseImpactPercent), costView.statistics.purchaseImpactPercent > 12 ? 'danger' : costView.statistics.purchaseImpactPercent > 6 ? 'warning' : 'success'),
      createCard('production-planning-total', 'Uretim Planlari', formatNumber(planningStatistics.totalPlans), `${formatNumber(planningStatistics.totalProducts)} planlanan urun`, 'neutral'),
      createCard('production-planning-pending', 'Bekleyen Plan', formatNumber(planningStatistics.pendingPlans), 'Production Planning read-model', planningStatistics.pendingPlans > 0 ? 'warning' : 'success'),
      createCard('production-planning-quantity', 'Planlanan Uretim', formatQuantity(planningStatistics.totalProduction), `${formatNumber(planningStatistics.estimatedMinutes)} dk tahmini sure`, 'neutral'),
      createCard('capacity-planning-utilization', 'Kapasite Doluluk', formatPercent(capacityStatistics.utilizationPercent), `${formatNumber(capacityStatistics.totalMachines)} makine / ${formatNumber(capacityStatistics.totalLines)} hat`, capacityStatistics.utilizationPercent > 100 ? 'danger' : capacityStatistics.utilizationPercent > 85 ? 'warning' : 'success'),
      createCard('capacity-planning-bottleneck', 'Kapasite Darbogaz', formatNumber(capacityStatistics.bottleneckCount), `${formatNumber(capacityStatistics.overloadMinutes)} dk asiri yuk`, capacityStatistics.bottleneckCount > 0 ? 'warning' : 'success'),
      createCard('capacity-planning-idle', 'Bos Kapasite', `${formatNumber(capacityStatistics.idleCapacityMinutes)} dk`, 'Capacity Planning read-model', 'neutral'),
      createCard('production-fire-total', 'Toplam Fire', formatQuantity(fireView.statistics.totalQuantity), 'Fire Impact Analysis read-model', fireView.statistics.totalQuantity > 0 ? 'warning' : 'success'),
      createCard('production-fire-cost', 'Fire Maliyeti', formatCurrency(fireView.statistics.totalCost), 'Tahmini maliyet etkisi', fireView.statistics.totalCost > 0 ? 'warning' : 'success'),
      createCard('production-fire-rate', 'Fire Orani', formatPercent(fireView.statistics.fireRate), 'Fire / uretim miktari', fireView.statistics.fireRate > 3 ? 'danger' : fireView.statistics.fireRate > 1 ? 'warning' : 'success')
    ],
    productionTrend: createTrend(
      activeOrders,
      filters.period,
      order => order.createdAt || order.deliveryDate,
      getOrderQuantity,
      'Production Trend',
      KPI_COLORS[0]
    ),
    productProduction: createBarRows(
      Array.from(productBuckets.entries()).map(([label, value]) => ({ id: label, label, value })),
      8
    ),
    lineProduction: createBarRows(
      Array.from(lineBuckets.entries()).map(([label, value]) => ({ id: label, label, value })),
      8
    ),
    operatorProduction: createBarRows(
      Array.from(operatorBuckets.entries()).map(([label, value]) => ({ id: label, label, value })),
      8
    )
  }
}
