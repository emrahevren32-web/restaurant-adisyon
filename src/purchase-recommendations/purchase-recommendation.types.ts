import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type PurchaseRecommendationType =
  | 'CRITICAL_STOCK'
  | 'STOCKOUT_SOON'
  | 'FORECAST_ORDER'
  | 'BULK_BUY'
  | 'ALTERNATIVE_SUPPLIER'
  | 'COST_ADVANTAGE'
  | 'WASTE_REPLENISHMENT'
  | 'SEASONAL_PURCHASE'

export type PurchaseRecommendationPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type PurchaseRecommendationRisk =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type PurchaseRecommendationStatus =
  | 'GENERATED'
  | 'REVIEWED'
  | 'ARCHIVED'

export type PurchaseRecommendationSourceModule =
  | 'Forecasting'
  | 'CostOptimization'
  | 'RecommendationEngine'
  | 'AIAnalysis'
  | 'CriticalAlerts'
  | 'Warehouse'
  | 'Stock'
  | 'GoodsReceipt'
  | 'PurchaseOrders'
  | 'Suppliers'
  | 'RecipeCost'
  | 'CostEngine'
  | 'WasteManagement'
  | 'ProductionPlanning'
  | 'DecisionSupport'
  | 'KPIDashboard'
  | 'ReadModel'

export type PurchaseRecommendationHistoryAction =
  | 'CREATED'
  | 'CALCULATED'
  | 'REVIEWED'
  | 'ARCHIVED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'

export type PurchaseRecommendationRule = {
  id: string
  code: string
  type: PurchaseRecommendationType
  title: string
  description: string
  sourceModule: PurchaseRecommendationSourceModule
  baseRisk: PurchaseRecommendationRisk
  priority: PurchaseRecommendationPriority
  thresholdLabel: string
  enabled: boolean
}

export type PurchaseRecommendationItem = {
  id: string
  reportId: string
  reportNo: string
  ruleId: string
  recommendationType: PurchaseRecommendationType
  priority: PurchaseRecommendationPriority
  risk: PurchaseRecommendationRisk
  title: string
  description: string
  reason: string
  action: string
  expectedImpact: string
  ownerRole: string
  recommendedOrderQuantity: number
  currentStock: number
  minimumStock: number
  dailyUsageEstimate: number
  estimatedCoverageDays: number
  estimatedStockoutDate: string
  expectedCost: number
  expectedSaving: number
  unitCost: number
  riskScore: number
  confidenceScore: number
  sourceModule: PurchaseRecommendationSourceModule
  sourceId: string
  sourceNo: string
  relatedModules: PurchaseRecommendationSourceModule[]
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityName: string
  productId: string
  productName: string
  stockItemId: string
  stockItemName: string
  categoryId: string
  categoryName: string
  branchId: string
  branchName: string
  warehouseId: string
  warehouseName: string
  supplierId: string
  supplierName: string
  alternativeSupplierId: string
  alternativeSupplierName: string
  createdAt: string
}

export type PurchaseRecommendationHistory = {
  id: string
  reportId: string
  action: PurchaseRecommendationHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type PurchaseRecommendationReport = {
  id: string
  reportNo: string
  status: PurchaseRecommendationStatus
  reportDate: string
  scope: PurchaseRecommendationType | 'all'
  responsiblePerson: string
  description: string
  items: PurchaseRecommendationItem[]
  rules: PurchaseRecommendationRule[]
  history: PurchaseRecommendationHistory[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type PurchaseRecommendationStatistics = {
  totalRecommendations: number
  criticalPurchases: number
  expectedSaving: number
  expectedCost: number
  alternativeSupplierCount: number
  averageRiskScore: number
  averageConfidence: number
  typeRows: BarChartRow[]
  branchRows: BarChartRow[]
  warehouseRows: BarChartRow[]
  categoryRows: BarChartRow[]
  productRows: BarChartRow[]
  supplierRows: BarChartRow[]
  riskRows: BarChartRow[]
  priorityRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type PurchaseRecommendationFilters = {
  recommendationType: PurchaseRecommendationType | 'all'
  priority: PurchaseRecommendationPriority | 'all'
  risk: PurchaseRecommendationRisk | 'all'
  branchId: string
  warehouseId: string
  categoryId: string
  productId: string
  supplierId: string
  date: string
  search: string
}

export type PurchaseRecommendationReportCreateInput = {
  reportDate: string
  scope: PurchaseRecommendationType | 'all'
  responsiblePerson: string
  description: string
}

export type PurchaseRecommendationPrintMode = 'A4' | 'PDF'
