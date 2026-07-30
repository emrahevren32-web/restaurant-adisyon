import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type ImprovementReportStatus =
  | 'DRAFT'
  | 'ANALYZED'
  | 'READY'
  | 'REVISED'
  | 'CANCELLED'

export type ImprovementArea =
  | 'MACHINE'
  | 'LINE'
  | 'PERSONNEL'
  | 'SHIFT'
  | 'SETUP'
  | 'CLEANING'
  | 'MAINTENANCE'
  | 'WAREHOUSE'
  | 'MATERIAL'
  | 'ENERGY'

export type ImprovementRiskLevel =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type ImprovementPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type ImprovementHistoryAction =
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

export type ImprovementSourceType =
  | 'ProductionPlanning'
  | 'CapacityPlanning'
  | 'MachineScheduling'
  | 'WorkforcePlanning'
  | 'BottleneckAnalysis'
  | 'Inventory'
  | 'ReadModel'

export type ImprovementRecommendation = {
  id: string
  opportunityId: string
  area: ImprovementArea
  title: string
  description: string
  action: string
  expectedImpact: string
  ownerRole: string
  priority: ImprovementPriority
}

export type ImprovementOpportunity = {
  id: string
  reportId: string
  reportNo: string
  area: ImprovementArea
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
  department: string
  shiftName: string
  waitingMinutes: number
  idleMinutes: number
  utilizationPercent: number
  setupMinutes: number
  cleaningMinutes: number
  maintenanceMinutes: number
  capacityUtilizationPercent: number
  personnelUtilizationPercent: number
  expectedGainMinutes: number
  expectedGainPercent: number
  expectedBenefitScore: number
  riskLevel: ImprovementRiskLevel
  priority: ImprovementPriority
  summary: string
  sourceType: ImprovementSourceType
  sourceId: string
  sourceNo: string
  detectedAt: string
}

export type ImprovementHistory = {
  id: string
  reportId: string
  action: ImprovementHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type ImprovementReport = {
  id: string
  reportNo: string
  status: ImprovementReportStatus
  reportDate: string
  startDate: string
  endDate: string
  area: ImprovementArea | 'all'
  productionLineId: string
  productionLineName: string
  machineId: string
  machineCode: string
  machineName: string
  employeeId: string
  employeeName: string
  responsiblePerson: string
  description: string
  opportunities: ImprovementOpportunity[]
  recommendations: ImprovementRecommendation[]
  history: ImprovementHistory[]
  sourceBottleneckReportIds: string[]
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

export type ImprovementStatistics = {
  totalOpportunities: number
  criticalOpportunities: number
  urgentRecommendations: number
  expectedGainMinutes: number
  averageBenefitScore: number
  topPriorityLabel: string
  lineRows: BarChartRow[]
  machineRows: BarChartRow[]
  personnelRows: BarChartRow[]
  departmentRows: BarChartRow[]
  areaRows: BarChartRow[]
  priorityRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type ContinuousImprovementFilters = {
  area: ImprovementArea | 'all'
  productionLineId: string
  machineId: string
  employeeId: string
  priority: ImprovementPriority | 'all'
  riskLevel: ImprovementRiskLevel | 'all'
  date: string
  search: string
}

export type ImprovementReportCreateInput = {
  reportDate: string
  startDate: string
  endDate: string
  area: ImprovementArea | 'all'
  productionLineId: string
  machineId: string
  employeeId: string
  responsiblePerson: string
  description: string
}

export type ImprovementValidationResult = {
  valid: boolean
  errors: string[]
}

export type ImprovementPrintMode = 'A4' | 'PDF'
