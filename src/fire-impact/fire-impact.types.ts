import type { BarChartRow, ChartSeries, KPICard, KpiFilters, PieChartSlice } from '../kpi-reporting/kpi.types'
import type { StockUnit } from '../types'

export type FireCategory =
  | 'Uretim'
  | 'Hazirlik'
  | 'Pisirme'
  | 'Soklama'
  | 'Paketleme'
  | 'Depolama'
  | 'Sevkiyat'
  | 'Iade'
  | 'Kalite'

export type FireReason =
  | 'Yanlis Gramaj'
  | 'Yanlis Recete'
  | 'Operator Hatasi'
  | 'Makine Arizasi'
  | 'Soklama Problemi'
  | 'Ambalaj Problemi'
  | 'Etiket Hatasi'
  | 'SKT'
  | 'Tasima Hasari'
  | 'Kalite Reddi'
  | 'Diger'

export type FireAnalysisFilters = KpiFilters & {
  category: FireCategory | 'all'
  department: string
}

export type FireCost = {
  unitCost: number
  totalCost: number
  currency: string
  source: 'WasteRecord' | 'StockMovement' | 'StockItem' | 'Estimated'
}

export type FireImpact = {
  id: string
  stockWasteRecordId: string
  stockMovementId: string
  stockItemId: string
  stockItemName: string
  productId: string
  productName: string
  lotId: string
  lotNo: string
  branchId: string
  warehouseId: string
  productionOrderId: string
  workOrderNo: string
  category: FireCategory
  reason: FireReason
  department: string
  operator: string
  quantity: number
  unit: StockUnit
  cost: FireCost
  recipeFirePercent: number
  recipeFireCost: number
  recipeVariancePercent: number
  occurredAt: string
  impactScore: number
  stockImpact: string
  productionImpact: string
  recipeImpact: string
  profitabilityImpact: string
  kpiImpact: string
  decisionSupportImpact: string
  notes: string
}

export type FireStatistic = {
  totalQuantity: number
  totalCost: number
  fireRate: number
  recordCount: number
  productCount: number
  lotCount: number
  averageCost: number
  highRiskImpactCount: number
}

export type FireImpactLeader = {
  id: string
  label: string
  value: number
  detail: string
}

export type FireAnalysisInsight = {
  mostWastedProduct?: FireImpactLeader
  mostWastedLine?: FireImpactLeader
  mostWastedOperator?: FireImpactLeader
  mostWastedDepartment?: FireImpactLeader
  highestCostImpact?: FireImpact
}

export type FireAnalysisView = {
  generatedAt: string
  filters: FireAnalysisFilters
  impacts: FireImpact[]
  filteredImpacts: FireImpact[]
  statistics: FireStatistic
  cards: KPICard[]
  fireTrend: ChartSeries
  costTrend: ChartSeries
  categoryDistribution: PieChartSlice[]
  productFire: BarChartRow[]
  lotFire: BarChartRow[]
  departmentFire: BarChartRow[]
  dailyFire: BarChartRow[]
  weeklyFire: BarChartRow[]
  monthlyFire: BarChartRow[]
  insights: FireAnalysisInsight
}
