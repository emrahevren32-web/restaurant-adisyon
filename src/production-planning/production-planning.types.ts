import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import type { StockUnit } from '../types'

export type ProductionPlanType =
  | 'DAILY'
  | 'WEEKLY'
  | 'MONTHLY'
  | 'URGENT'
  | 'BRANCH_BASED'

export type ProductionPlanStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'READY'
  | 'APPROVED'
  | 'REVISED'
  | 'CANCELLED'

export type ProductionPlanPriority =
  | 'CRITICAL'
  | 'HIGH'
  | 'NORMAL'
  | 'LOW'

export type ProductionPlanningHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'PREPARING'
  | 'READY'
  | 'APPROVED'
  | 'REVISED'
  | 'CANCELLED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'
  | 'VALIDATION'

export type ProductionDemand = {
  id: string
  planId: string
  productId: string
  productName: string
  productCode: string
  branchId: string
  branchName: string
  pendingProductionQuantity: number
  pendingOrderQuantity: number
  branchDemandQuantity: number
  customerOrderQuantity: number
  forecastQuantity: number
  minimumStockQuantity: number
  safetyStockQuantity: number
  wasteAllowanceQuantity: number
  totalDemand: number
  unit: StockUnit
  sourceSummary: string
}

export type ProductionSupply = {
  id: string
  planId: string
  productId: string
  productName: string
  currentStock: number
  pendingProduction: number
  goodsReceiptSupply: number
  availableSupply: number
  minimumStock: number
  safetyStock: number
  shortageQuantity: number
  surplusRiskQuantity: number
  unit: StockUnit
}

export type ProductionPlanItem = {
  id: string
  planId: string
  productId: string
  productName: string
  productCode: string
  recipeId: string
  recipeName: string
  demandQuantity: number
  currentStock: number
  minimumStock: number
  safetyStock: number
  pendingProduction: number
  pendingOrderQuantity: number
  branchDemandQuantity: number
  customerOrderQuantity: number
  forecastQuantity: number
  wastePercent: number
  produceQuantity: number
  unit: StockUnit
  priority: ProductionPlanPriority
  estimatedMinutes: number
  productionLineId: string
  productionLineName: string
  shift: string
  capacityUsagePercent: number
  recommendations: string[]
}

export type ProductionPlanningHistory = {
  id: string
  planId: string
  action: ProductionPlanningHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type ProductionPlan = {
  id: string
  planNo: string
  planType: ProductionPlanType
  status: ProductionPlanStatus
  planDate: string
  startDate: string
  endDate: string
  branchId: string
  branchName: string
  facilityId: string
  facilityName: string
  shift: string
  responsiblePerson: string
  description: string
  items: ProductionPlanItem[]
  demands: ProductionDemand[]
  supplies: ProductionSupply[]
  recommendations: string[]
  history: ProductionPlanningHistory[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ProductionPlanningStatistics = {
  todayPlans: number
  totalPlans: number
  pendingPlans: number
  approvedPlans: number
  revisedPlans: number
  totalProducts: number
  totalProduction: number
  estimatedMinutes: number
  capacityUsagePercent: number
  branchRows: BarChartRow[]
  productRows: BarChartRow[]
  statusRows: BarChartRow[]
  typeRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type ProductionPlanningFilters = {
  planType: ProductionPlanType | 'all'
  branchId: string
  shift: string
  status: ProductionPlanStatus | 'all'
  date: string
  search: string
}

export type ProductionPlanCreateInput = {
  planType: ProductionPlanType
  planDate: string
  startDate: string
  endDate: string
  branchId: string
  facilityId: string
  shift: string
  responsiblePerson: string
  description: string
}

export type ProductionPlanningValidationResult = {
  valid: boolean
  errors: string[]
}

export type ProductionPlanningPrintMode = 'A4' | 'PDF'
