import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type WastePredictionType =
  | 'HIGH_WASTE_RISK'
  | 'USE_OLDER_LOT_FIRST'
  | 'USE_ALTERNATIVE_RECIPE'
  | 'PREFER_ALTERNATIVE_SUPPLIER'
  | 'PRODUCE_AFTER_MAINTENANCE'
  | 'CHANGE_LINE'
  | 'CHANGE_PERSONNEL'
  | 'REDUCE_PRODUCTION_QUANTITY'
  | 'SPLIT_PRODUCTION_BATCH'
  | 'PRIORITIZE_NEAR_EXPIRY_RAW_MATERIALS'
  | 'INCREASE_QUALITY_CONTROL'
  | 'NO_WASTE_EXPECTED'

export type WastePredictionPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type WastePredictionRisk =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type WastePredictionStatus =
  | 'GENERATED'
  | 'REVIEWED'
  | 'ARCHIVED'

export type WastePredictionSourceModule =
  | 'Production'
  | 'ProductionPlanning'
  | 'Recipe'
  | 'Stock'
  | 'InventoryLots'
  | 'WasteManagement'
  | 'Purchasing'
  | 'PurchaseRecommendations'
  | 'SupplierPerformance'
  | 'CapacityPlanning'
  | 'MachineScheduling'
  | 'WorkforcePlanning'
  | 'Quality'
  | 'HACCP'
  | 'ShipmentPlanning'
  | 'Forecasting'
  | 'CostOptimization'
  | 'ProductionPlanningRecommendations'
  | 'KPI'
  | 'ReadModel'

export type WastePredictionHistoryAction =
  | 'CREATED'
  | 'CALCULATED'
  | 'REVIEWED'
  | 'ARCHIVED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'

export type WastePredictionLinkedEntity = {
  id: string
  no: string
  name: string
  detail: string
}

export type WastePredictionAlternative = {
  id: string
  code: string
  name: string
  score: number
  expectedWastePercent: number
  expectedSaving: number
  reason: string
}

export type WastePredictionRule = {
  id: string
  code: string
  type: WastePredictionType
  title: string
  description: string
  sourceModule: WastePredictionSourceModule
  baseRisk: WastePredictionRisk
  priority: WastePredictionPriority
  thresholdLabel: string
  enabled: boolean
}

export type WastePredictionItem = {
  id: string
  reportId: string
  reportNo: string
  predictionNo: string
  ruleId: string
  predictionType: WastePredictionType
  priority: WastePredictionPriority
  risk: WastePredictionRisk
  title: string
  description: string
  forecastReason: string
  analysisResult: string
  riskExplanation: string
  riskReason: string
  action: string
  expectedImpact: string
  ownerRole: string
  productId: string
  productName: string
  stockItemId: string
  stockItemName: string
  recipeId: string
  recipeCode: string
  recipeName: string
  productionLineId: string
  productionLineName: string
  machineId: string
  machineCode: string
  machineName: string
  branchId: string
  branchName: string
  lotId: string
  lotNo: string
  supplierId: string
  supplierName: string
  plannedQuantity: number
  unit: string
  expectedWastePercent: number
  expectedWasteKg: number
  expectedWasteCost: number
  expectedSaving: number
  unitCost: number
  riskScore: number
  confidenceScore: number
  lotExpiryDate: string
  lotDaysToExpiry: number
  haccpCriticalPoint: string
  qualitySignal: string
  supplierPerformanceScore: number
  lineEfficiencyPercent: number
  capacityUtilizationPercent: number
  machineUtilizationPercent: number
  historicalWastePercent: number
  criticalWasteScenario: boolean
  lotRiskScenario: boolean
  alternativeRecipeScenario: boolean
  supplierWasteScenario: boolean
  sourceModules: WastePredictionSourceModule[]
  sourceNo: string
  affectedProductionOrders: WastePredictionLinkedEntity[]
  affectedLots: WastePredictionLinkedEntity[]
  alternativeRecipes: WastePredictionAlternative[]
  alternativeSuppliers: WastePredictionAlternative[]
  createdAt: string
}

export type WastePredictionHistory = {
  id: string
  reportId: string
  action: WastePredictionHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type WastePredictionReport = {
  id: string
  reportNo: string
  status: WastePredictionStatus
  reportDate: string
  scope: WastePredictionType | 'all'
  responsiblePerson: string
  description: string
  items: WastePredictionItem[]
  rules: WastePredictionRule[]
  history: WastePredictionHistory[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type WastePredictionStatistics = {
  totalPredictions: number
  totalExpectedWasteKg: number
  expectedWasteCost: number
  mostRiskyProductName: string
  mostRiskyLineName: string
  averageWastePercent: number
  averageConfidence: number
  criticalScenarioCount: number
  productWasteRows: BarChartRow[]
  lineWasteRows: BarChartRow[]
  machineWasteRows: BarChartRow[]
  costRows: BarChartRow[]
  supplierWasteRows: BarChartRow[]
  lotWasteRows: BarChartRow[]
  reasonRows: BarChartRow[]
  expectedSavingRows: BarChartRow[]
  typeRows: BarChartRow[]
  riskRows: BarChartRow[]
  priorityRows: BarChartRow[]
  wasteTrend: ChartSeries
}

export type WastePredictionFilters = {
  branchId: string
  productId: string
  recipeId: string
  productionLineId: string
  machineId: string
  lotId: string
  supplierId: string
  risk: WastePredictionRisk | 'all'
  priority: WastePredictionPriority | 'all'
  date: string
  search: string
}

export type WastePredictionReportCreateInput = {
  reportDate: string
  scope: WastePredictionType | 'all'
  responsiblePerson: string
  description: string
}

export type WastePredictionPrintMode = 'A4' | 'PDF'
