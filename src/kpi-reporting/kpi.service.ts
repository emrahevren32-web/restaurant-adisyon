import {
  flattenHACCPCorrectiveActions,
  flattenHACCPMonitoringRecords
} from '../haccp/haccp.mock'
import { CriticalAlertService } from '../critical-alerts/critical-alert.service'
import { ForecastService } from '../forecasting/forecast.service'
import { calculateRecommendationReport } from '../recommendation-engine/recommendation-calculation.service'
import { createRecommendationStatistics } from '../recommendation-engine/recommendation-statistics.service'
import { createInventoryKpiView } from './inventory-kpi.service'
import { createProductionKpiView } from './production-kpi.service'
import { createPurchasingKpiView } from './purchasing-kpi.service'
import { createQualityKpiView } from './quality-kpi.service'
import { createShipmentKpiView } from './shipment-kpi.service'
import type {
  ExecutiveSummary,
  KpiDashboardView,
  KpiFilters,
  KpiReportDefinition,
  KpiSourceData
} from './kpi.types'
import {
  ALL_FILTER,
  KPI_COLORS,
  createCard,
  createPieSlices,
  createTrend,
  formatNumber,
  formatPercent,
  formatQuantity,
  matchesPeriod,
  percent,
  sumBy
} from './kpi.utils'
import { WasteService } from '../waste-management/waste.service'

export const createDefaultKpiFilters = (): KpiFilters => ({
  period: 'MONTH',
  branchId: ALL_FILTER,
  warehouseId: ALL_FILTER,
  productId: ALL_FILTER,
  lotId: ALL_FILTER,
  supplierId: ALL_FILTER,
  operator: ALL_FILTER
})

const KPI_REPORTS: KpiReportDefinition[] = [
  {
    id: 'production-report',
    title: 'Production Report',
    description: 'Uretim miktari, is emri durumu, urun, hat ve operator bazli KPI raporu.',
    owner: 'Production'
  },
  {
    id: 'fire-impact-report',
    title: 'Fire Impact Report',
    description: 'Fire miktari, fire %, maliyet, urun, lot, kategori ve departman etkisi raporu.',
    owner: 'Production'
  },
  {
    id: 'cost-engine-report',
    title: 'Cost Engine Report',
    description: 'Recete, hammadde, satin alma, fire, uretim, depolama ve sevkiyat maliyet raporu.',
    owner: 'Production'
  },
  {
    id: 'inventory-report',
    title: 'Inventory Report',
    description: 'Stok seviyesi, kritik stok, lot, SKT ve depo doluluk raporu.',
    owner: 'Inventory'
  },
  {
    id: 'quality-report',
    title: 'Quality Report',
    description: 'HACCP monitoring, PASS/FAIL, sample, witness sample, recall ve corrective action raporu.',
    owner: 'Quality'
  },
  {
    id: 'purchasing-report',
    title: 'Purchasing Report',
    description: 'Purchase order, supplier performance, teslim suresi ve red orani raporu.',
    owner: 'Purchasing'
  },
  {
    id: 'shipment-report',
    title: 'Shipment Report',
    description: 'Shipment plan, arac doluluk, palet, iade ve teslim durumu raporu.',
    owner: 'Shipment'
  },
  {
    id: 'executive-summary',
    title: 'Executive Summary',
    description: 'Yonetim icin kritik operasyon, kalite, stok, lojistik ve satin alma ozeti.',
    owner: 'Executive'
  },
  {
    id: 'forecasting-report',
    title: 'Forecasting Report',
    description: 'Gecmis read-model verilerinden talep, stok, uretim, sevkiyat ve kalite tahmin raporu.',
    owner: 'Decision Support'
  }
]

const createKpiRecommendationStatistics = (
  sourceData: KpiSourceData
) => createRecommendationStatistics([
  calculateRecommendationReport({
    reportDate: new Date().toLocaleDateString('sv-SE'),
    scope: 'all',
    responsiblePerson: 'KPI Dashboard',
    description: 'KPI Dashboard read-model recommendation ozeti.',
    sourceData,
    decisionSuggestions: [],
    actorName: 'KPI Dashboard',
    getReportNo: () => `RC-${new Date().getFullYear()}-000000`
  })
])

const getCard = (cards: Array<{ id: string; value: string }>, id: string) => (
  cards.find(card => card.id === id)?.value || '-'
)

const getActiveRecallCount = (sourceData: KpiSourceData, filters: KpiFilters) => (
  sourceData.productRecalls.filter(recall => (
    recall.status !== 'COMPLETED'
    && recall.status !== 'CANCELLED'
    && matchesPeriod(recall.reportedDate || recall.createdAt, filters.period)
  )).length
)

const getProductionStatusKey = (status: string) => String(status || '').toLocaleLowerCase('tr-TR')
const isCompletedProductionOrder = (status: string) => getProductionStatusKey(status).includes('tamam')
const isCancelledProductionOrder = (status: string) => getProductionStatusKey(status).includes('iptal')

const getOpenProductionOrderCount = (sourceData: KpiSourceData, filters: KpiFilters) => (
  sourceData.productionOrders.filter(order => (
    !isCompletedProductionOrder(order.status)
    && !isCancelledProductionOrder(order.status)
    && matchesPeriod(order.createdAt || order.deliveryDate, filters.period)
  )).length
)

const getCompletedShipmentWorkOrderCount = (sourceData: KpiSourceData, filters: KpiFilters) => (
  sourceData.shipmentWorkOrders.filter(order => (
    order.status === 'COMPLETED'
    && matchesPeriod(order.updatedAt || order.createdAt, filters.period)
  )).length
)

const getCriticalStockCount = (sourceData: KpiSourceData) => (
  sourceData.stockItems.filter(item => item.currentQty <= item.minQty).length
)

const getOpenCorrectiveActionCount = (sourceData: KpiSourceData) => (
  flattenHACCPCorrectiveActions(sourceData.haccpRecords)
    .filter(action => action.status === 'OPEN' || action.status === 'IN_PROGRESS')
    .length
)

const getHaccpSuccessRate = (sourceData: KpiSourceData, filters: KpiFilters) => {
  const monitoringRecords = flattenHACCPMonitoringRecords(sourceData.haccpRecords)
    .filter(record => matchesPeriod(record.checkedAt, filters.period))
  const passCount = monitoringRecords.filter(record => record.result === 'PASS').length
  return percent(passCount, monitoringRecords.length)
}

const getFireRate = (sourceData: KpiSourceData, filters: KpiFilters) => {
  const wasteQuantity = sumBy(
    WasteService.list(sourceData).filter(record => (
      record.status !== 'CANCELLED'
      && record.status !== 'REJECTED'
      && matchesPeriod(record.date || record.createdAt, filters.period)
    )),
    record => record.quantity
  )
  const productionQuantity = sumBy(
    sourceData.productionOrders.filter(order => matchesPeriod(order.createdAt || order.deliveryDate, filters.period)),
    order => sumBy(order.lines, line => line.quantity)
  )

  return percent(wasteQuantity, productionQuantity)
}

const createExecutiveSummary = (
  sourceData: KpiSourceData,
  filters: KpiFilters,
  dashboard: Omit<KpiDashboardView, 'executive' | 'reports' | 'generatedAt' | 'filters'>
): ExecutiveSummary => {
  const activeRecallCount = getActiveRecallCount(sourceData, filters)
  const openCorrectiveActionCount = getOpenCorrectiveActionCount(sourceData)
  const haccpSuccessRate = getHaccpSuccessRate(sourceData, filters)
  const fireRate = getFireRate(sourceData, filters)
  const alertStatistics = CriticalAlertService.statistics(
    CriticalAlertService.evaluate(sourceData).filter(alert => matchesPeriod(alert.createdAt, filters.period))
  )
  const forecastStatistics = ForecastService.statistics([ForecastService.evaluate(sourceData)])
  const recommendationStatistics = createKpiRecommendationStatistics(sourceData)
  const activeWasteRecords = WasteService.list(sourceData).filter(record => (
    record.status !== 'CANCELLED'
    && record.status !== 'REJECTED'
  ))

  const fireTrend = createTrend(
    activeWasteRecords,
    filters.period,
    record => record.date || record.createdAt,
    record => record.quantity,
    'Fire Trend',
    KPI_COLORS[2]
  )

  const productionDistribution = createPieSlices(
    dashboard.production.productProduction.slice(0, 6).map(row => ({
      id: row.id,
      label: row.label,
      value: row.value
    }))
  )

  return {
    cards: [
      createCard('executive-today-production', 'Bugunku Uretim', getCard(dashboard.production.cards, 'production-daily'), 'Gunluk uretim miktari', 'success'),
      createCard('executive-today-shipment', 'Bugunku Sevkiyat', getCard(dashboard.shipment.cards, 'shipment-today'), 'Bugun planlanan sevkiyat', 'neutral'),
      createCard('executive-open-production', 'Acik Uretim Emirleri', formatNumber(getOpenProductionOrderCount(sourceData, filters)), 'Tamamlanmamis uretim emirleri', 'warning'),
      createCard('executive-completed-work-orders', 'Tamamlanan Is Emirleri', formatNumber(getCompletedShipmentWorkOrderCount(sourceData, filters)), 'Shipment Work Order tamamlananlar', 'success'),
      createCard('executive-total-lots', 'Toplam Lot', formatNumber(sourceData.inventoryLots.length), 'Inventory Lot kayitlari', 'neutral'),
      createCard('executive-cost-engine', 'Cost Engine Maliyeti', getCard(dashboard.production.cards, 'production-cost-total'), 'Read-model urun maliyeti', 'neutral'),
      createCard('executive-active-recall', 'Aktif Recall', formatNumber(activeRecallCount), 'Acik veya devam eden recall', activeRecallCount > 0 ? 'danger' : 'success'),
      createCard('executive-open-action', 'Acik Corrective Action', formatNumber(openCorrectiveActionCount), 'OPEN / IN_PROGRESS faaliyetler', openCorrectiveActionCount > 0 ? 'warning' : 'success'),
      createCard('executive-critical-alerts', 'Kritik Alarm', formatNumber(alertStatistics.criticalAlerts), `${formatNumber(alertStatistics.activeAlerts)} aktif alert`, alertStatistics.criticalAlerts > 0 ? 'danger' : 'success'),
      createCard('executive-active-alerts', 'Aktif Alarm', formatNumber(alertStatistics.activeAlerts), `${formatNumber(alertStatistics.averageRiskScore, 1)} ortalama risk`, alertStatistics.activeAlerts > 0 ? 'warning' : 'success'),
      createCard('executive-forecast-risk', 'Riskli Tahmin', formatNumber(forecastStatistics.riskyForecasts), forecastStatistics.biggestIncreaseLabel, forecastStatistics.riskyForecasts > 0 ? 'warning' : 'success'),
      createCard('executive-forecast-demand', 'Beklenen Talep', formatNumber(forecastStatistics.expectedDemand, 1), `${formatNumber(forecastStatistics.averageConfidence, 1)} confidence`, 'neutral'),
      createCard('executive-recommendation-critical', 'Kritik Oneri', formatNumber(recommendationStatistics.criticalRecommendations), `${formatNumber(recommendationStatistics.totalRecommendations)} toplam oneri`, recommendationStatistics.criticalRecommendations > 0 ? 'danger' : 'success'),
      createCard('executive-recommendation-gain', 'Oneri Kazanci', formatNumber(recommendationStatistics.expectedTotalGain, 1), `${formatNumber(recommendationStatistics.averageConfidence, 1)} confidence`, 'neutral'),
      createCard('executive-critical-stock', 'Kritik Stok', formatNumber(getCriticalStockCount(sourceData)), 'Min seviyenin altindaki stoklar', getCriticalStockCount(sourceData) > 0 ? 'danger' : 'success'),
      createCard('executive-fire-rate', 'Fire Orani', formatPercent(fireRate), 'Fire / uretim miktari', fireRate > 3 ? 'warning' : 'success'),
      createCard('executive-haccp-rate', 'HACCP Basari Orani', formatPercent(haccpSuccessRate), 'PASS / toplam monitoring', haccpSuccessRate >= 90 ? 'success' : 'warning')
    ],
    lineCharts: [
      dashboard.production.productionTrend,
      dashboard.shipment.shipmentTrend,
      fireTrend,
      dashboard.quality.monitoringTrend,
      dashboard.quality.recallTrend,
      dashboard.inventory.inventoryTrend
    ],
    barCharts: {
      topProducts: dashboard.production.productProduction,
      topSuppliers: dashboard.purchasing.topSuppliers,
      topWarehouses: dashboard.inventory.warehouseOccupancy,
      topCcpFailures: dashboard.quality.ccpFailures
    },
    pieCharts: {
      inventoryDistribution: dashboard.inventory.inventoryDistribution,
      productionDistribution,
      shipmentStatus: dashboard.shipment.shipmentStatus,
      qualityStatus: dashboard.quality.qualityStatus
    }
  }
}

export const createKpiDashboardView = (
  sourceData: KpiSourceData,
  filters: KpiFilters
): KpiDashboardView => {
  const production = createProductionKpiView(sourceData, filters)
  const inventory = createInventoryKpiView(sourceData, filters)
  const quality = createQualityKpiView(sourceData, filters)
  const purchasing = createPurchasingKpiView(sourceData, filters)
  const shipment = createShipmentKpiView(sourceData, filters)
  const dashboardWithoutExecutive = {
    production,
    inventory,
    quality,
    purchasing,
    shipment
  }

  return {
    generatedAt: new Date().toISOString(),
    filters,
    executive: createExecutiveSummary(sourceData, filters, dashboardWithoutExecutive),
    ...dashboardWithoutExecutive,
    reports: KPI_REPORTS
  }
}
