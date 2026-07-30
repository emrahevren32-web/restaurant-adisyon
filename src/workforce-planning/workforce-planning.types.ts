import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type WorkforcePlanStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'READY'
  | 'APPROVED'
  | 'REVISED'
  | 'CANCELLED'

export type WorkforcePlanItemStatus =
  | 'PLANNED'
  | 'ASSIGNED'
  | 'ACTIVE'
  | 'IDLE'
  | 'CONFLICT'
  | 'MISSING'
  | 'CANCELLED'

export type WorkforceHistoryAction =
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

export type WorkforcePlanItem = {
  id: string
  planId: string
  planNo: string
  sourceMachineScheduleId: string
  sourceMachineScheduleNo: string
  sourceMachineScheduleItemId: string
  employeeId: string
  employeeCode: string
  employeeName: string
  employeeActive: boolean
  department: string
  shiftId: string
  shiftName: string
  machineId: string
  machineCode: string
  machineName: string
  productionLineId: string
  productionLineName: string
  workCenterId: string
  workCenterName: string
  taskName: string
  productName: string
  recipeName: string
  startAt: string
  endAt: string
  estimatedMinutes: number
  workingMinutes: number
  idleMinutes: number
  conflict: boolean
  conflictReason: string
  status: WorkforcePlanItemStatus
  sequenceNo: number
  recommendations: string[]
}

export type EmployeeAssignment = {
  id: string
  planId: string
  employeeId: string
  employeeCode: string
  employeeName: string
  department: string
  shiftName: string
  isActive: boolean
  assignmentCount: number
  totalWorkingMinutes: number
  idleMinutes: number
  utilizationPercent: number
  conflictCount: number
  firstStartAt: string
  lastEndAt: string
}

export type ShiftAssignment = {
  id: string
  planId: string
  shiftName: string
  workDate: string
  totalEmployees: number
  activeEmployees: number
  assignedEmployees: number
  idleEmployees: number
  availableMinutes: number
  totalWorkingMinutes: number
  utilizationPercent: number
  missingEmployeeCount: number
  conflictCount: number
}

export type WorkforceHistory = {
  id: string
  planId: string
  action: WorkforceHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type WorkforcePlan = {
  id: string
  planNo: string
  status: WorkforcePlanStatus
  planDate: string
  startDate: string
  endDate: string
  employeeId: string
  employeeName: string
  department: string
  shiftName: string
  productionLineId: string
  productionLineName: string
  machineId: string
  machineCode: string
  machineName: string
  responsiblePerson: string
  description: string
  items: WorkforcePlanItem[]
  employeeAssignments: EmployeeAssignment[]
  shiftAssignments: ShiftAssignment[]
  recommendations: string[]
  history: WorkforceHistory[]
  sourceMachineScheduleIds: string[]
  sourceCapacityPlanIds: string[]
  sourceProductionPlanIds: string[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type WorkforceStatistics = {
  todayPersonnel: number
  totalPlans: number
  totalPersonnel: number
  activePersonnel: number
  idlePersonnel: number
  missingPersonnel: number
  shiftUtilizationPercent: number
  totalWorkingMinutes: number
  totalIdleMinutes: number
  conflictCount: number
  personnelRows: BarChartRow[]
  shiftRows: BarChartRow[]
  departmentRows: BarChartRow[]
  lineRows: BarChartRow[]
  machineRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type WorkforcePlanningFilters = {
  employeeId: string
  department: string
  shiftName: string
  productionLineId: string
  machineId: string
  status: WorkforcePlanStatus | 'all'
  date: string
  search: string
}

export type WorkforcePlanCreateInput = {
  planDate: string
  startDate: string
  endDate: string
  employeeId: string
  department: string
  shiftName: string
  productionLineId: string
  machineId: string
  responsiblePerson: string
  description: string
}

export type WorkforceValidationResult = {
  valid: boolean
  errors: string[]
}

export type WorkforcePrintMode = 'A4' | 'PDF'
