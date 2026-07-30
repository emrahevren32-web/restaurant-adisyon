import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type RecommendationType =
  | 'PRODUCTION'
  | 'PURCHASING'
  | 'STOCK'
  | 'QUALITY'
  | 'MACHINE'
  | 'PERSONNEL'
  | 'MAINTENANCE'
  | 'SHIPMENT'
  | 'ENERGY'
  | 'WASTE'

export type RecommendationPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type RecommendationRisk =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type RecommendationStatus =
  | 'GENERATED'
  | 'REVIEWED'
  | 'ARCHIVED'

export type RecommendationSourceModule =
  | 'DecisionSupport'
  | 'CriticalAlerts'
  | 'Forecasting'
  | 'ProductionPlanning'
  | 'CapacityPlanning'
  | 'MachineScheduling'
  | 'WorkforcePlanning'
  | 'BottleneckAnalysis'
  | 'ContinuousImprovement'
  | 'OperationsChecklists'
  | 'QualityForms'
  | 'ShipmentForms'
  | 'Warehouse'
  | 'Stock'
  | 'Inventory'
  | 'Purchase'
  | 'PurchaseOrders'
  | 'Shipment'
  | 'FireManagement'
  | 'GoodsReceipt'
  | 'Quality'
  | 'HACCP'
  | 'LotManagement'
  | 'Maintenance'
  | 'KPIDashboard'
  | 'ReadModel'

export type RecommendationHistoryAction =
  | 'CREATED'
  | 'CALCULATED'
  | 'REVIEWED'
  | 'ARCHIVED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'

export type RecommendationRule = {
  id: string
  code: string
  type: RecommendationType
  title: string
  description: string
  sourceModule: RecommendationSourceModule
  baseRisk: RecommendationRisk
  priority: RecommendationPriority
  thresholdLabel: string
  enabled: boolean
}

export type RecommendationItem = {
  id: string
  reportId: string
  reportNo: string
  ruleId: string
  recommendationType: RecommendationType
  priority: RecommendationPriority
  risk: RecommendationRisk
  title: string
  description: string
  reason: string
  action: string
  expectedImpact: string
  ownerRole: string
  riskScore: number
  expectedBenefitScore: number
  expectedCostImpact: number
  expectedCapacityGain: number
  expectedTimeGainMinutes: number
  confidenceScore: number
  sourceModule: RecommendationSourceModule
  sourceId: string
  sourceNo: string
  relatedModules: RecommendationSourceModule[]
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityName: string
  productId: string
  productName: string
  stockItemId: string
  stockItemName: string
  branchId: string
  branchName: string
  productionLineId: string
  productionLineName: string
  machineId: string
  machineCode: string
  machineName: string
  employeeId: string
  employeeName: string
  supplierId: string
  supplierName: string
  createdAt: string
}

export type RecommendationHistory = {
  id: string
  reportId: string
  action: RecommendationHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type RecommendationReport = {
  id: string
  reportNo: string
  status: RecommendationStatus
  reportDate: string
  scope: RecommendationType | 'all'
  responsiblePerson: string
  description: string
  items: RecommendationItem[]
  rules: RecommendationRule[]
  history: RecommendationHistory[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type RecommendationStatistics = {
  totalRecommendations: number
  criticalRecommendations: number
  todayRecommendations: number
  expectedTotalGain: number
  averageRiskScore: number
  averageConfidence: number
  typeRows: BarChartRow[]
  branchRows: BarChartRow[]
  lineRows: BarChartRow[]
  machineRows: BarChartRow[]
  personnelRows: BarChartRow[]
  priorityRows: BarChartRow[]
  riskRows: BarChartRow[]
  successRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type RecommendationFilters = {
  recommendationType: RecommendationType | 'all'
  priority: RecommendationPriority | 'all'
  risk: RecommendationRisk | 'all'
  branchId: string
  productionLineId: string
  machineId: string
  employeeId: string
  date: string
  search: string
}

export type RecommendationReportCreateInput = {
  reportDate: string
  scope: RecommendationType | 'all'
  responsiblePerson: string
  description: string
}

export type RecommendationPrintMode = 'A4' | 'PDF'
