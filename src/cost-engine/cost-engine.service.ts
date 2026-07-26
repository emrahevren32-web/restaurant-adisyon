import { loadBlastChillerProcesses } from '../blast-chiller/blast-chiller.mock'
import { loadDispatchProcesses } from '../dispatch/dispatch.mock'
import type { KpiFilters, KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  KPI_COLORS,
  createCard,
  createTrend,
  formatCurrency,
  formatNumber,
  formatPercent,
  matchesOptionalFilter,
  matchesPeriod
} from '../kpi-reporting/kpi.utils'
import { loadPackagingProcesses } from '../packaging/packaging.mock'
import { loadStockCategories } from '../storage'
import { calculateCostEngineRecord } from './cost-calculation.service'
import {
  createCategoryCostRows,
  createCostBreakdownDistribution,
  createCostStatistics,
  createFireImpactRows,
  createProductCostRows
} from './cost-statistics.service'
import type { CostEngine, CostEngineFilters, CostEngineView } from './cost-engine.types'

export const createDefaultCostEngineFilters = (): CostEngineFilters => ({
  period: 'MONTH',
  branchId: ALL_FILTER,
  warehouseId: ALL_FILTER,
  productId: ALL_FILTER,
  lotId: ALL_FILTER,
  supplierId: ALL_FILTER,
  operator: ALL_FILTER,
  categoryId: ALL_FILTER,
  recipeId: ALL_FILTER,
  date: ''
})

export const mapKpiFiltersToCostEngineFilters = (
  filters: KpiFilters
): CostEngineFilters => ({
  ...createDefaultCostEngineFilters(),
  ...filters
})

export const createCostEngineRecords = (
  sourceData: KpiSourceData
): CostEngine[] => {
  const stockCategories = loadStockCategories()
  const context = {
    sourceData,
    stockCategories,
    blastChillerProcesses: loadBlastChillerProcesses(),
    packagingProcesses: loadPackagingProcesses(),
    dispatchProcesses: loadDispatchProcesses()
  }

  return sourceData.recipeRecords
    .filter(recipe => recipe.status === 'Aktif')
    .map((recipe, index) => calculateCostEngineRecord(recipe, context, index))
}

export const filterCostEngineRecords = (
  records: CostEngine[],
  filters: CostEngineFilters,
  sourceData: KpiSourceData
) => records.filter(record => {
  const lot = sourceData.inventoryLots.find(item => item.id === record.lotId)

  return (
    matchesPeriod(record.calculationDate, filters.period)
    && (!filters.date || record.calculationDate.slice(0, 10) === filters.date)
    && matchesOptionalFilter(filters.branchId, record.branchId)
    && matchesOptionalFilter(filters.warehouseId, record.warehouseId)
    && (
      filters.productId === ALL_FILTER
      || filters.productId === record.productId
      || filters.productId === record.id
    )
    && matchesOptionalFilter(filters.lotId, record.lotId)
    && matchesOptionalFilter(filters.categoryId, record.categoryId)
    && matchesOptionalFilter(filters.recipeId, record.recipeId)
    && matchesOptionalFilter(filters.supplierId, lot?.supplierId || '')
  )
})

const createCostCards = (
  records: CostEngine[],
  statistics: ReturnType<typeof createCostStatistics>
) => [
  createCard('cost-total-product', 'Toplam Urun', formatNumber(statistics.totalProducts), 'Cost Engine kapsamindaki receteli urunler', 'neutral'),
  createCard('cost-total-cost', 'Toplam Maliyet', formatCurrency(statistics.totalCost), `${formatNumber(records.length)} hesaplama kaydi`, 'neutral'),
  createCard('cost-profitable-product', 'En Karli Urun', statistics.mostProfitableProduct?.productName || '-', statistics.mostProfitableProduct ? `${formatCurrency(statistics.mostProfitableProduct.costPerUnit)} / adet` : 'Kayit yok', 'success'),
  createCard('cost-highest-product', 'En Maliyetli Urun', statistics.highestCostProduct?.productName || '-', statistics.highestCostProduct ? formatCurrency(statistics.highestCostProduct.totalCost) : 'Kayit yok', statistics.highestCostProduct ? 'warning' : 'success'),
  createCard('cost-fire-impact', 'Fire Etkisi', formatCurrency(statistics.fireImpact), formatPercent(statistics.fireImpactPercent), statistics.fireImpactPercent > 7 ? 'danger' : statistics.fireImpactPercent > 3 ? 'warning' : 'success'),
  createCard('cost-purchase-impact', 'Satin Alma Etkisi', formatCurrency(statistics.purchaseImpact), formatPercent(statistics.purchaseImpactPercent), statistics.purchaseImpactPercent > 12 ? 'danger' : statistics.purchaseImpactPercent > 6 ? 'warning' : 'success'),
  createCard('cost-average-kg', 'Maliyet / kg', formatCurrency(statistics.averageCostPerKg), 'Ortalama kg maliyeti', 'neutral'),
  createCard('cost-trend', 'Trend', formatPercent(statistics.trend), 'Onceki periyot karsilastirmasi', statistics.trend > 10 ? 'warning' : statistics.trend < 0 ? 'success' : 'neutral')
]

export const createCostEngineView = (
  sourceData: KpiSourceData,
  filters: CostEngineFilters
): CostEngineView => {
  const records = createCostEngineRecords(sourceData)
  const filteredRecords = filterCostEngineRecords(records, filters, sourceData)
  const statistics = createCostStatistics(filteredRecords)

  return {
    generatedAt: new Date().toISOString(),
    filters,
    records,
    filteredRecords,
    statistics,
    cards: createCostCards(filteredRecords, statistics),
    costTrend: createTrend(
      filteredRecords,
      filters.period,
      record => record.calculationDate,
      record => record.totalCost,
      'Cost Trend',
      KPI_COLORS[1]
    ),
    breakdownDistribution: createCostBreakdownDistribution(filteredRecords),
    categoryCosts: createCategoryCostRows(filteredRecords),
    productCosts: createProductCostRows(filteredRecords),
    fireImpactRows: createFireImpactRows(filteredRecords)
  }
}
