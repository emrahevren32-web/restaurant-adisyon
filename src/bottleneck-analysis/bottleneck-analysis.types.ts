import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type BottleneckReportStatus =
  | 'DRAFT'
  | 'ANALYZED'
  | 'READY'
  | 'REVISED'
  | 'CANCELLED'

export type BottleneckType =
  | 'MACHINE'
  | 'LINE'
  | 'PERSONNEL'
  | 'WORK_CENTER'
  | 'WAREHOUSE'
  | 'MATERIAL'
  | 'SETUP'
  | 'CLEANING'
  | 'MAINTENANCE'

export type BottleneckRiskLevel =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type BottleneckHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'ANALYZED'
  | 'READY'
  | 'REVISED'
  | 'CANCELLED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'
  | 'VALIDATION'

export type BottleneckReason = {
  id: string
  itemId: string
  type: BottleneckType
  label: string
  value: number
  unit: string
  impactPercent: number
  description: string
}

export type ProductionConstraint = {
  id: string
  itemId: string
  entityType: BottleneckType
  entityId: string
  entityName: string
  constraintType: string
  riskLevel: BottleneckRiskLevel
  utilizationPercent: number
  waitingMinutes: number
  setupMinutes: number
  cleaningMinutes: number
  workingMinutes: number
  idleMinutes: number
  sourceNo: string
}

export type BottleneckItem = {
  id: string
  reportId: string
  reportNo: string
  bottleneckType: BottleneckType
  entityId: string
  entityCode: string
  entityName: string
  productionLineId: string
  productionLineName: string
  machineId: string
  machineCode: string
  machineName: string
  employeeId: string
  employeeName: string
  workCenterId: string
  workCenterName: string
  shiftName: string
  utilizationPercent: number
  waitingMinutes: number
  setupMinutes: number
  cleaningMinutes: number
  workingMinutes: number
  idleMinutes: number
  overloadMinutes: number
  maintenanceMinutes: number
  missingPersonnel: number
  riskScore: number
  riskLevel: BottleneckRiskLevel
  critical: boolean
  reasons: BottleneckReason[]
  constraints: ProductionConstraint[]
  recommendation: string
  sourceType: 'CapacityPlanning' | 'MachineScheduling' | 'WorkforcePlanning' | 'Inventory' | 'ReadModel'
  sourceId: string
  sourceNo: string
  detectedAt: string
}

export type BottleneckHistory = {
  id: string
  reportId: string
  action: BottleneckHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type BottleneckReport = {
  id: string
  reportNo: string
  status: BottleneckReportStatus
  reportDate: string
  startDate: string
  endDate: string
  productionLineId: string
  productionLineName: string
  machineId: string
  machineCode: string
  machineName: string
  employeeId: string
  employeeName: string
  workCenterId: string
  workCenterName: string
  riskLevel: BottleneckRiskLevel | 'all'
  responsiblePerson: string
  description: string
  items: BottleneckItem[]
  constraints: ProductionConstraint[]
  reasons: BottleneckReason[]
  recommendations: string[]
  history: BottleneckHistory[]
  sourceCapacityPlanIds: string[]
  sourceMachineScheduleIds: string[]
  sourceWorkforcePlanIds: string[]
  sourceProductionPlanIds: string[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type BottleneckStatistics = {
  totalBottlenecks: number
  criticalBottlenecks: number
  highRiskBottlenecks: number
  topLineName: string
  topMachineName: string
  averageRiskScore: number
  totalWaitingMinutes: number
  totalSetupMinutes: number
  totalCleaningMinutes: number
  totalWorkingMinutes: number
  riskRows: BarChartRow[]
  machineRows: BarChartRow[]
  lineRows: BarChartRow[]
  personnelRows: BarChartRow[]
  workCenterRows: BarChartRow[]
  typeRows: BarChartRow[]
  monthlyTrend: ChartSeries
  riskTrend: ChartSeries
}

export type BottleneckAnalysisFilters = {
  productionLineId: string
  machineId: string
  employeeId: string
  workCenterId: string
  riskLevel: BottleneckRiskLevel | 'all'
  date: string
  search: string
}

export type BottleneckReportCreateInput = {
  reportDate: string
  startDate: string
  endDate: string
  productionLineId: string
  machineId: string
  employeeId: string
  workCenterId: string
  riskLevel: BottleneckRiskLevel | 'all'
  responsiblePerson: string
  description: string
}

export type BottleneckValidationResult = {
  valid: boolean
  errors: string[]
}

export type BottleneckPrintMode = 'A4' | 'PDF'
