import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type MachineScheduleStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'READY'
  | 'RUNNING'
  | 'COMPLETED'
  | 'REVISED'
  | 'CANCELLED'

export type MachineScheduleItemStatus =
  | 'QUEUED'
  | 'SCHEDULED'
  | 'READY'
  | 'RUNNING'
  | 'COMPLETED'
  | 'CONFLICT'
  | 'CANCELLED'

export type SchedulingHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'PLANNED'
  | 'READY'
  | 'RUNNING'
  | 'COMPLETED'
  | 'REVISED'
  | 'CANCELLED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'
  | 'VALIDATION'

export type MachineScheduleItem = {
  id: string
  scheduleId: string
  scheduleNo: string
  sourceCapacityPlanId: string
  sourceCapacityPlanNo: string
  sourceItemId: string
  machineId: string
  machineCode: string
  machineName: string
  productionLineId: string
  productionLineName: string
  workCenterId: string
  workCenterName: string
  productName: string
  recipeId: string
  recipeName: string
  plannedQuantity: number
  unit: string
  startAt: string
  endAt: string
  estimatedMinutes: number
  setupMinutes: number
  cleaningMinutes: number
  waitingMinutes: number
  totalWorkingMinutes: number
  idleBeforeMinutes: number
  conflict: boolean
  conflictReason: string
  status: MachineScheduleItemStatus
  sequenceNo: number
  recommendations: string[]
}

export type MachineQueue = {
  id: string
  scheduleId: string
  machineId: string
  machineCode: string
  machineName: string
  productionLineId: string
  productionLineName: string
  workCenterId: string
  workCenterName: string
  itemCount: number
  pendingItemCount: number
  totalWaitingMinutes: number
  totalSetupMinutes: number
  totalCleaningMinutes: number
  totalWorkingMinutes: number
  idleMinutes: number
  utilizationPercent: number
  conflictCount: number
  firstStartAt: string
  lastEndAt: string
}

export type MachineTimelineSegment = {
  id: string
  itemId: string
  label: string
  startAt: string
  endAt: string
  durationMinutes: number
  status: MachineScheduleItemStatus
  conflict: boolean
}

export type MachineTimeline = {
  id: string
  scheduleId: string
  machineId: string
  machineCode: string
  machineName: string
  productionLineId: string
  productionLineName: string
  workCenterId: string
  workCenterName: string
  availableStartAt: string
  availableEndAt: string
  availableMinutes: number
  busyMinutes: number
  idleMinutes: number
  utilizationPercent: number
  segments: MachineTimelineSegment[]
}

export type SchedulingHistory = {
  id: string
  scheduleId: string
  action: SchedulingHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type MachineSchedule = {
  id: string
  scheduleNo: string
  status: MachineScheduleStatus
  scheduleDate: string
  startDate: string
  endDate: string
  machineId: string
  machineCode: string
  machineName: string
  productionLineId: string
  productionLineName: string
  workCenterId: string
  workCenterName: string
  shift: string
  responsiblePerson: string
  description: string
  items: MachineScheduleItem[]
  queues: MachineQueue[]
  timelines: MachineTimeline[]
  recommendations: string[]
  history: SchedulingHistory[]
  sourceCapacityPlanIds: string[]
  sourceProductionPlanIds: string[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type SchedulingStatistics = {
  todaySchedules: number
  totalSchedules: number
  plannedSchedules: number
  readySchedules: number
  runningSchedules: number
  completedSchedules: number
  totalMachines: number
  runningMachines: number
  idleMachines: number
  pendingJobs: number
  conflictCount: number
  totalSetupMinutes: number
  totalCleaningMinutes: number
  totalWaitingMinutes: number
  totalWorkingMinutes: number
  machineUtilizationPercent: number
  lineRows: BarChartRow[]
  machineRows: BarChartRow[]
  statusRows: BarChartRow[]
  setupRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type MachineSchedulingFilters = {
  machineId: string
  productionLineId: string
  workCenterId: string
  status: MachineScheduleStatus | 'all'
  date: string
  search: string
}

export type MachineScheduleCreateInput = {
  scheduleDate: string
  startDate: string
  endDate: string
  machineId: string
  productionLineId: string
  workCenterId: string
  shift: string
  responsiblePerson: string
  description: string
}

export type SchedulingValidationResult = {
  valid: boolean
  errors: string[]
}

export type SchedulingPrintMode = 'A4' | 'PDF'
