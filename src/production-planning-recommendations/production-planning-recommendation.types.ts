import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type ProductionPlanningRecommendationType =
  | 'ADVANCE_PRODUCTION'
  | 'POSTPONE_PRODUCTION'
  | 'CHANGE_LINE'
  | 'CHANGE_MACHINE'
  | 'CHANGE_SHIFT'
  | 'SPLIT_PRODUCTION'
  | 'GROUP_SAME_PRODUCTS'
  | 'REDUCE_SETUP_TIME'
  | 'BALANCE_CAPACITY'
  | 'REALLOCATE_PERSONNEL'
  | 'ALTERNATIVE_RECIPE'
  | 'ALTERNATIVE_WORK_CENTER'
  | 'STOP_PRODUCTION'
  | 'WAIT_PURCHASE'
  | 'WAIT_SHIPMENT'
  | 'REPLAN_WASTE_RISK'

export type ProductionPlanningRecommendationPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type ProductionPlanningRecommendationRisk =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type ProductionPlanningRecommendationStatus =
  | 'GENERATED'
  | 'REVIEWED'
  | 'ARCHIVED'

export type ProductionPlanningRecommendationSourceModule =
  | 'Warehouse'
  | 'Stock'
  | 'Production'
  | 'ProductionPlanning'
  | 'CapacityPlanning'
  | 'MachineScheduling'
  | 'WorkforcePlanning'
  | 'Recipe'
  | 'Purchasing'
  | 'PurchaseRecommendations'
  | 'Quality'
  | 'KPI'
  | 'Forecasting'
  | 'CostOptimization'
  | 'ShipmentPlanning'
  | 'InventoryLots'
  | 'HACCP'
  | 'ReadModel'

export type ProductionPlanningRecommendationHistoryAction =
  | 'CREATED'
  | 'CALCULATED'
  | 'REVIEWED'
  | 'ARCHIVED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'

export type ProductionPlanningRecommendationLinkedEntity = {
  id: string
  no: string
  name: string
  detail: string
}

export type ProductionPlanningRecommendationAlternative = {
  id: string
  code: string
  name: string
  currentUtilizationPercent: number
  expectedUtilizationPercent: number
  availableMinutes: number
  reason: string
}

export type ProductionPlanningRecommendationRule = {
  id: string
  code: string
  type: ProductionPlanningRecommendationType
  title: string
  description: string
  sourceModule: ProductionPlanningRecommendationSourceModule
  baseRisk: ProductionPlanningRecommendationRisk
  priority: ProductionPlanningRecommendationPriority
  thresholdLabel: string
  enabled: boolean
}

export type ProductionPlanningRecommendationItem = {
  id: string
  reportId: string
  reportNo: string
  recommendationNo: string
  ruleId: string
  recommendationType: ProductionPlanningRecommendationType
  priority: ProductionPlanningRecommendationPriority
  risk: ProductionPlanningRecommendationRisk
  title: string
  description: string
  reason: string
  analysisResult: string
  riskExplanation: string
  action: string
  expectedGain: string
  expectedImpact: string
  ownerRole: string
  workOrderId: string
  workOrderNo: string
  productId: string
  productName: string
  recipeId: string
  recipeName: string
  productionLineId: string
  productionLineName: string
  machineId: string
  machineCode: string
  machineName: string
  branchId: string
  branchName: string
  employeeId: string
  employeeName: string
  plannedStartAt: string
  plannedEndAt: string
  plannedQuantity: number
  unit: string
  currentLineUtilizationPercent: number
  expectedLineUtilizationPercent: number
  currentMachineUtilizationPercent: number
  expectedCapacityGainPercent: number
  expectedCapacityGainMinutes: number
  expectedTimeGainMinutes: number
  setupTimeGainMinutes: number
  wasteReductionPercent: number
  fireRiskPercent: number
  bottleneck: boolean
  lineBalancingScenario: boolean
  setupOptimizationScenario: boolean
  alternativeLineScenario: boolean
  delayedProduction: boolean
  riskScore: number
  confidenceScore: number
  sourceModules: ProductionPlanningRecommendationSourceModule[]
  sourceNo: string
  affectedWorkOrders: ProductionPlanningRecommendationLinkedEntity[]
  affectedMachines: ProductionPlanningRecommendationLinkedEntity[]
  affectedPersonnel: ProductionPlanningRecommendationLinkedEntity[]
  alternativeLines: ProductionPlanningRecommendationAlternative[]
  alternativeMachines: ProductionPlanningRecommendationAlternative[]
  lotSktSummary: string
  haccpCriticalPoint: string
  createdAt: string
}

export type ProductionPlanningRecommendationHistory = {
  id: string
  reportId: string
  action: ProductionPlanningRecommendationHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type ProductionPlanningRecommendationReport = {
  id: string
  reportNo: string
  status: ProductionPlanningRecommendationStatus
  reportDate: string
  scope: ProductionPlanningRecommendationType | 'all'
  responsiblePerson: string
  description: string
  items: ProductionPlanningRecommendationItem[]
  rules: ProductionPlanningRecommendationRule[]
  history: ProductionPlanningRecommendationHistory[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ProductionPlanningRecommendationStatistics = {
  totalRecommendations: number
  criticalBottlenecks: number
  expectedCapacityGainPercent: number
  expectedCapacityGainMinutes: number
  delayedProductionCount: number
  averageLineEfficiency: number
  averageConfidence: number
  typeRows: BarChartRow[]
  riskRows: BarChartRow[]
  priorityRows: BarChartRow[]
  lineOccupancyRows: BarChartRow[]
  machineUtilizationRows: BarChartRow[]
  capacityDistributionRows: BarChartRow[]
  bottleneckRows: BarChartRow[]
  productProductionRows: BarChartRow[]
  expectedCapacityGainRows: BarChartRow[]
  setupGainRows: BarChartRow[]
  wasteReductionRows: BarChartRow[]
  dailyTrend: ChartSeries
}

export type ProductionPlanningRecommendationFilters = {
  branchId: string
  productionLineId: string
  machineId: string
  productId: string
  recipeId: string
  workOrderId: string
  risk: ProductionPlanningRecommendationRisk | 'all'
  priority: ProductionPlanningRecommendationPriority | 'all'
  recommendationType: ProductionPlanningRecommendationType | 'all'
  employeeId: string
  date: string
  search: string
}

export type ProductionPlanningRecommendationReportCreateInput = {
  reportDate: string
  scope: ProductionPlanningRecommendationType | 'all'
  responsiblePerson: string
  description: string
}

export type ProductionPlanningRecommendationPrintMode = 'A4' | 'PDF'
