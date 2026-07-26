import type { BarChartRow, ChartSeries, KPICard, KpiFilters, PieChartSlice } from '../kpi-reporting/kpi.types'

export type CostComponentType =
  | 'RAW_MATERIAL'
  | 'INTERMEDIATE_PRODUCT'
  | 'FINAL_PRODUCT'
  | 'PURCHASING'
  | 'WASTE'
  | 'BLAST_CHILLING'
  | 'PACKAGING'
  | 'STORAGE'
  | 'SHIPMENT'
  | 'LABOR'
  | 'OTHER'

export type CostCalculationType =
  | 'ACTUAL'
  | 'ESTIMATED'
  | 'STANDARD'
  | 'AVERAGE'
  | 'MINIMUM'
  | 'MAXIMUM'

export type CostScenarioType =
  | 'FIRE_INCREASE'
  | 'PURCHASE_INCREASE'
  | 'RAW_MATERIAL_PRICE_CHANGE'
  | 'RECIPE_CHANGE'
  | 'BLAST_CHILLING_INCREASE'

export type CostComponentSource =
  | 'Recipe'
  | 'StockItem'
  | 'Purchase'
  | 'Waste'
  | 'Production'
  | 'Shipment'
  | 'InventoryLot'
  | 'Estimated'

export type CostComponent = {
  id: string
  type: CostComponentType
  label: string
  amount: number
  percent: number
  source: CostComponentSource
  sourceId: string
  note: string
}

export type CostBreakdown = {
  totalCost: number
  components: CostComponent[]
  rawMaterialPercent: number
  laborPercent: number
  firePercent: number
  packagingPercent: number
  storagePercent: number
  shipmentPercent: number
  purchasePercent: number
  blastChillingPercent: number
  otherPercent: number
}

export type CostScenario = {
  id: string
  type: CostScenarioType
  label: string
  description: string
  changePercent: number
  baseCost: number
  simulatedCost: number
  deltaAmount: number
  deltaPercent: number
  affectedComponentTypes: CostComponentType[]
}

export type CostEngine = {
  id: string
  productId: string
  productName: string
  productType: 'RAW_MATERIAL' | 'INTERMEDIATE_PRODUCT' | 'FINAL_PRODUCT'
  categoryId: string
  categoryName: string
  branchId: string
  branchName: string
  warehouseId: string
  warehouseName: string
  recipeId: string
  recipeCode: string
  recipeName: string
  lotId: string
  lotNo: string
  calculationDate: string
  totalGram: number
  firePercent: number
  fireImpact: number
  purchaseImpact: number
  totalCost: number
  costPerKg: number
  costPerUnit: number
  actualCost: number
  estimatedCost: number
  standardCost: number
  averageCost: number
  minCost: number
  maxCost: number
  currency: string
  breakdown: CostBreakdown
  scenarios: CostScenario[]
  sourceReferences: string[]
}

export type CostStatistics = {
  totalProducts: number
  totalCost: number
  averageCost: number
  averageCostPerKg: number
  mostProfitableProduct?: CostEngine
  highestCostProduct?: CostEngine
  fireImpact: number
  purchaseImpact: number
  fireImpactPercent: number
  purchaseImpactPercent: number
  trend: number
}

export type CostEngineFilters = KpiFilters & {
  categoryId: string
  recipeId: string
  date: string
}

export type CostEngineView = {
  generatedAt: string
  filters: CostEngineFilters
  records: CostEngine[]
  filteredRecords: CostEngine[]
  statistics: CostStatistics
  cards: KPICard[]
  costTrend: ChartSeries
  breakdownDistribution: PieChartSlice[]
  categoryCosts: BarChartRow[]
  productCosts: BarChartRow[]
  fireImpactRows: BarChartRow[]
}
