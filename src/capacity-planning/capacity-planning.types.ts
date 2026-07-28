import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type CapacityPlanStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'ANALYZED'
  | 'APPROVED'
  | 'REVISED'
  | 'CANCELLED'

export type CapacityHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'PREPARING'
  | 'ANALYZED'
  | 'APPROVED'
  | 'REVISED'
  | 'CANCELLED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'
  | 'VALIDATION'

export type CapacityRiskLevel =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'CRITICAL'

export type CapacitySourceType =
  | 'ProductionPlanning'
  | 'ProductionOrder'
  | 'ReadModel'
  | 'ManualReadModel'

export type MachineCapacity = {
  id: string
  planId: string
  machineId: string
  machineCode: string
  machineName: string
  productionLineId: string
  productionLineName: string
  workCenterId: string
  workCenterName: string
  shift: string
  active: boolean
  maintenanceClosed: boolean
  workingMinutes: number
  availableMinutes: number
  plannedProductionMinutes: number
  recipePreparationMinutes: number
  setupMinutes: number
  cleaningMinutes: number
  warehousePreparationMinutes: number
  maintenanceMinutes: number
  netProductionMinutes: number
  totalLoadMinutes: number
  idleMinutes: number
  overloadMinutes: number
  utilizationPercent: number
  bottleneck: boolean
  riskLevel: CapacityRiskLevel
  recommendations: string[]
}

export type WorkCenterCapacity = {
  id: string
  planId: string
  workCenterId: string
  workCenterName: string
  lineCount: number
  machineCount: number
  workingMinutes: number
  availableMinutes: number
  totalLoadMinutes: number
  idleMinutes: number
  overloadMinutes: number
  utilizationPercent: number
  bottleneckCount: number
  riskLevel: CapacityRiskLevel
}

export type ProductionCapacity = {
  id: string
  planId: string
  productionLineId: string
  productionLineCode: string
  productionLineName: string
  workCenterId: string
  workCenterName: string
  shift: string
  lineStatus: string
  machineCount: number
  workingMinutes: number
  availableMinutes: number
  plannedProductionMinutes: number
  recipePreparationMinutes: number
  setupMinutes: number
  cleaningMinutes: number
  warehousePreparationMinutes: number
  maintenanceMinutes: number
  netProductionMinutes: number
  totalLoadMinutes: number
  idleMinutes: number
  overloadMinutes: number
  utilizationPercent: number
  bottleneck: boolean
  maintenanceClosed: boolean
  riskLevel: CapacityRiskLevel
  recommendations: string[]
}

export type CapacityPlanItem = {
  id: string
  planId: string
  sourceType: CapacitySourceType
  sourceId: string
  sourceNo: string
  productName: string
  recipeId: string
  recipeName: string
  productionLineId: string
  productionLineName: string
  workCenterId: string
  workCenterName: string
  machineId: string
  machineCode: string
  machineName: string
  shift: string
  plannedQuantity: number
  unit: string
  plannedProductionMinutes: number
  recipePreparationMinutes: number
  setupMinutes: number
  cleaningMinutes: number
  warehousePreparationMinutes: number
  maintenanceMinutes: number
  netProductionMinutes: number
  availableMinutes: number
  totalLoadMinutes: number
  idleMinutes: number
  overloadMinutes: number
  utilizationPercent: number
  riskLevel: CapacityRiskLevel
  recommendations: string[]
}

export type CapacityHistory = {
  id: string
  planId: string
  action: CapacityHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type CapacityPlan = {
  id: string
  capacityPlanNo: string
  status: CapacityPlanStatus
  planDate: string
  startDate: string
  endDate: string
  productionLineId: string
  productionLineName: string
  workCenterId: string
  workCenterName: string
  shift: string
  responsiblePerson: string
  description: string
  items: CapacityPlanItem[]
  productionCapacities: ProductionCapacity[]
  workCenterCapacities: WorkCenterCapacity[]
  machineCapacities: MachineCapacity[]
  recommendations: string[]
  history: CapacityHistory[]
  sourcePlanningPlanIds: string[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type CapacityStatistics = {
  todayPlans: number
  totalPlans: number
  analyzedPlans: number
  approvedPlans: number
  revisedPlans: number
  totalLines: number
  totalMachines: number
  totalCapacityMinutes: number
  usedCapacityMinutes: number
  idleCapacityMinutes: number
  overloadMinutes: number
  bottleneckCount: number
  maintenanceClosedLines: number
  utilizationPercent: number
  lineRows: BarChartRow[]
  machineRows: BarChartRow[]
  workCenterRows: BarChartRow[]
  statusRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type CapacityPlanningFilters = {
  productionLineId: string
  machineId: string
  workCenterId: string
  shift: string
  status: CapacityPlanStatus | 'all'
  date: string
  search: string
}

export type CapacityPlanCreateInput = {
  planDate: string
  startDate: string
  endDate: string
  productionLineId: string
  workCenterId: string
  shift: string
  responsiblePerson: string
  description: string
}

export type CapacityValidationResult = {
  valid: boolean
  errors: string[]
}

export type CapacityPrintMode = 'A4' | 'PDF'
