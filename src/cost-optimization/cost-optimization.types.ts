import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type CostOptimizationCategory =
  | 'RAW_MATERIAL'
  | 'PERSONNEL'
  | 'ENERGY'
  | 'MAINTENANCE'
  | 'MACHINE'
  | 'PRODUCTION'
  | 'WASTE'
  | 'STORAGE'
  | 'LOGISTICS'
  | 'SHIPMENT'

export type CostOptimizationPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type CostOptimizationRisk =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type CostOptimizationStatus =
  | 'GENERATED'
  | 'REVIEWED'
  | 'ARCHIVED'

export type CostOptimizationSourceModule =
  | 'DecisionSupport'
  | 'Forecasting'
  | 'RecommendationEngine'
  | 'AIAnalysis'
  | 'ProductionPlanning'
  | 'CapacityPlanning'
  | 'MachineScheduling'
  | 'WorkforcePlanning'
  | 'BottleneckAnalysis'
  | 'ContinuousImprovement'
  | 'Warehouse'
  | 'Stock'
  | 'Purchase'
  | 'PurchaseOrders'
  | 'GoodsReceipt'
  | 'RecipeCost'
  | 'CostEngine'
  | 'WasteManagement'
  | 'Maintenance'
  | 'Energy'
  | 'ShipmentForms'
  | 'QualityForms'
  | 'KPIDashboard'
  | 'ReadModel'

export type CostHistoryAction =
  | 'CREATED'
  | 'ANALYZED'
  | 'REVIEWED'
  | 'ARCHIVED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'

export type CostOpportunity = {
  id: string
  itemId: string
  category: CostOptimizationCategory
  title: string
  description: string
  expectedSaving: number
  expectedMonthlyGain: number
  expectedAnnualGain: number
  roiEstimate: number
  confidenceScore: number
  riskScore: number
  priority: CostOptimizationPriority
  action: string
  ownerRole: string
  sourceModule: CostOptimizationSourceModule
}

export type CostOptimizationItem = {
  id: string
  reportId: string
  reportNo: string
  category: CostOptimizationCategory
  priority: CostOptimizationPriority
  risk: CostOptimizationRisk
  title: string
  description: string
  reason: string
  action: string
  expectedImpact: string
  ownerRole: string
  unitCost: number
  totalCost: number
  baselineCost: number
  optimizedCost: number
  savingPotential: number
  expectedMonthlyGain: number
  expectedAnnualGain: number
  roiEstimate: number
  riskScore: number
  confidenceScore: number
  sourceModule: CostOptimizationSourceModule
  sourceId: string
  sourceNo: string
  relatedModules: CostOptimizationSourceModule[]
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityName: string
  productId: string
  productName: string
  branchId: string
  branchName: string
  warehouseId: string
  warehouseName: string
  productionLineId: string
  productionLineName: string
  machineId: string
  machineCode: string
  machineName: string
  supplierId: string
  supplierName: string
  createdAt: string
}

export type CostHistory = {
  id: string
  reportId: string
  action: CostHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type CostOptimizationReport = {
  id: string
  reportNo: string
  status: CostOptimizationStatus
  reportDate: string
  scope: CostOptimizationCategory | 'all'
  responsiblePerson: string
  description: string
  items: CostOptimizationItem[]
  opportunities: CostOpportunity[]
  history: CostHistory[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type CostStatistics = {
  totalSaving: number
  criticalCosts: number
  largestSavingLabel: string
  expectedMonthlyGain: number
  expectedAnnualGain: number
  averageRoi: number
  averageConfidence: number
  averageRiskScore: number
  categoryRows: BarChartRow[]
  branchRows: BarChartRow[]
  productRows: BarChartRow[]
  lineRows: BarChartRow[]
  machineRows: BarChartRow[]
  supplierRows: BarChartRow[]
  monthlyTrend: ChartSeries
  yearlyTrend: ChartSeries
}

export type CostOptimizationFilters = {
  category: CostOptimizationCategory | 'all'
  priority: CostOptimizationPriority | 'all'
  risk: CostOptimizationRisk | 'all'
  branchId: string
  productId: string
  productionLineId: string
  machineId: string
  supplierId: string
  date: string
  search: string
}

export type CostOptimizationReportCreateInput = {
  reportDate: string
  scope: CostOptimizationCategory | 'all'
  responsiblePerson: string
  description: string
}

export type CostPrintMode = 'A4' | 'PDF'
