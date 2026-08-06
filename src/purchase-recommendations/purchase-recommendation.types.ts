import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type PurchaseRecommendationType =
  | 'CRITICAL_STOCK'
  | 'UPCOMING_PRODUCTION'
  | 'POSTPONE_ORDER'
  | 'SPLIT_ORDER'
  | 'STOCKOUT_SOON'
  | 'FORECAST_ORDER'
  | 'BULK_BUY'
  | 'ALTERNATIVE_SUPPLIER'
  | 'LOWER_COST_SUPPLIER'
  | 'STOCK_SUFFICIENT'
  | 'WAIT_UPCOMING_DELIVERY'
  | 'EXPIRY_RISK_NO_PURCHASE'
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
  | 'Recipes'
  | 'GoodsReceipt'
  | 'InventoryLots'
  | 'Quality'
  | 'PurchaseRequests'
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

export type PurchaseRecommendationLinkedEntity = {
  id: string
  no: string
  name: string
  detail: string
}

export type PurchaseRecommendationSupplierOption = {
  supplierId: string
  supplierName: string
  unitCost: number
  leadTimeDays: number
  savingPercent: number
  performanceScore: number
  reason: string
}

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
  recommendationNo: string
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
  maximumStock: number
  dailyUsageEstimate: number
  estimatedCoverageDays: number
  estimatedStockoutDate: string
  expectedCost: number
  expectedSaving: number
  unitCost: number
  leadTimeDays: number
  riskScore: number
  confidenceScore: number
  analysisResult: string
  riskExplanation: string
  expectedGain: string
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
  affectedProductionOrders: PurchaseRecommendationLinkedEntity[]
  affectedRecipes: PurchaseRecommendationLinkedEntity[]
  alternativeSuppliers: PurchaseRecommendationSupplierOption[]
  openRequestNos: string[]
  pendingOrderNos: string[]
  lotRiskSummary: string
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
  expectedSavingRows: BarChartRow[]
  criticalProductRows: BarChartRow[]
  dailyTrend: ChartSeries
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
