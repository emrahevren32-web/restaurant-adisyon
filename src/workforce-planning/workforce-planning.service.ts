import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import { MachineSchedulingService } from '../machine-scheduling/machine-scheduling.service'
import { resolveReadModelList } from '../read-model/read-model-safety'
import { loadEmployees } from '../storage'
import { calculateWorkforcePlanning, WorkforceCalculationService } from './workforce-calculation.service'
import { appendWorkforceHistory, createWorkforceHistory } from './workforce-history.service'
import { createWorkforceStatistics } from './workforce-statistics.service'
import {
  validateWorkforcePlan,
  validateWorkforcePlanCreateInput
} from './workforce-validation.service'
import {
  WORKFORCE_DEPARTMENT_OPTIONS,
  WORKFORCE_PLAN_ITEM_STATUSES,
  WORKFORCE_PLAN_ITEM_STATUS_LABELS,
  WORKFORCE_PLAN_STATUSES,
  WORKFORCE_PLAN_STATUS_LABELS,
  WORKFORCE_SHIFT_OPTIONS
} from './workforce-planning.constants'
import type {
  EmployeeAssignment,
  ShiftAssignment,
  WorkforceHistory,
  WorkforceHistoryAction,
  WorkforcePlan,
  WorkforcePlanCreateInput,
  WorkforcePlanItem,
  WorkforcePlanItemStatus,
  WorkforcePlanningFilters,
  WorkforcePlanStatus
} from './workforce-planning.types'

export {
  WORKFORCE_DEPARTMENT_OPTIONS,
  WORKFORCE_PLAN_ITEM_STATUSES,
  WORKFORCE_PLAN_ITEM_STATUS_LABELS,
  WORKFORCE_PLAN_STATUSES,
  WORKFORCE_PLAN_STATUS_LABELS,
  WORKFORCE_SHIFT_OPTIONS
} from './workforce-planning.constants'

export const WORKFORCE_PLANNING_STORAGE_KEY = 'ra_workforce_planning_records'

type RawWorkforcePlan = Partial<Record<keyof WorkforcePlan, unknown>> & Record<string, unknown>
type WorkforceReadModelDependencies = {
  machineSchedules?: ReturnType<typeof MachineSchedulingService.list>
}

const PLAN_NO_PREFIX = 'WP'
const PLAN_NO_PADDING = 6

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')
const normalizeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? roundKpi(parsed) : 0
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (
  dateValue: string,
  days: number
) => {
  const date = new Date(`${dateValue || getTodayKey()}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const getNextWorkforcePlanNo = (
  records: Pick<WorkforcePlan, 'planNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${PLAN_NO_PREFIX}-${year}-(\\d{${PLAN_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.planNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${PLAN_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(PLAN_NO_PADDING, '0')}`
}

export const createDefaultWorkforcePlanningFilters = (): WorkforcePlanningFilters => ({
  employeeId: ALL_FILTER,
  department: ALL_FILTER,
  shiftName: ALL_FILTER,
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  status: ALL_FILTER,
  date: '',
  search: ''
})

const mapStatus = (value: unknown): WorkforcePlanStatus => {
  const normalized = normalizeText(value).toUpperCase() as WorkforcePlanStatus
  return WORKFORCE_PLAN_STATUSES.includes(normalized) ? normalized : 'DRAFT'
}

const mapItemStatus = (value: unknown): WorkforcePlanItemStatus => {
  const normalized = normalizeText(value).toUpperCase() as WorkforcePlanItemStatus
  return WORKFORCE_PLAN_ITEM_STATUSES.includes(normalized) ? normalized : 'ASSIGNED'
}

const getEmployeeLabel = (
  employeeId: string
) => {
  if(employeeId === ALL_FILTER) return 'Tum Personel'
  return loadEmployees().find(employee => employee.id === employeeId)?.fullName || employeeId
}

const getLineLabel = (
  productionLineId: string,
  sourceData: KpiSourceData
) => {
  if(productionLineId === ALL_FILTER) return 'Tum Hatlar'
  const line = sourceData.productionLines.find(record => record.id === productionLineId)
  return line?.name || productionLineId
}

const getMachineLabel = (
  machineId: string,
  items: WorkforcePlanItem[]
) => {
  if(machineId === ALL_FILTER) return { machineCode: '', machineName: 'Tum Makineler' }
  const item = items.find(record => record.machineId === machineId)
  return {
    machineCode: item?.machineCode || machineId,
    machineName: item?.machineName || machineId
  }
}

const createPlanFromInput = ({
  actorName,
  input,
  machineSchedules,
  planId,
  planNo,
  sourceData,
  sourceType,
  status
}: {
  actorName: string
  input: WorkforcePlanCreateInput
  machineSchedules?: ReturnType<typeof MachineSchedulingService.list>
  planId: string
  planNo: string
  sourceData: KpiSourceData
  sourceType: WorkforcePlan['sourceType']
  status: WorkforcePlanStatus
}) => {
  const calculation = calculateWorkforcePlanning({
    planId,
    planNo,
    sourceData,
    startDate: input.startDate,
    endDate: input.endDate,
    employeeId: input.employeeId,
    department: input.department,
    shiftName: input.shiftName,
    productionLineId: input.productionLineId,
    machineId: input.machineId,
    machineSchedules
  })
  const machineLabel = getMachineLabel(input.machineId, calculation.items)
  const createdAt = new Date().toISOString()

  return {
    id: planId,
    planNo,
    status,
    planDate: input.planDate,
    startDate: input.startDate,
    endDate: input.endDate,
    employeeId: input.employeeId,
    employeeName: getEmployeeLabel(input.employeeId),
    department: input.department === ALL_FILTER ? 'Tum Departmanlar' : input.department,
    shiftName: input.shiftName === ALL_FILTER ? 'Tum Vardiyalar' : input.shiftName,
    productionLineId: input.productionLineId,
    productionLineName: getLineLabel(input.productionLineId, sourceData),
    machineId: input.machineId,
    machineCode: machineLabel.machineCode,
    machineName: machineLabel.machineName,
    responsiblePerson: actorName || input.responsiblePerson,
    description: input.description,
    items: calculation.items,
    employeeAssignments: calculation.employeeAssignments,
    shiftAssignments: calculation.shiftAssignments,
    recommendations: calculation.recommendations,
    history: [
      createWorkforceHistory(planId, 'CREATED', actorName, `${planNo} workforce planning read-model kaydi olusturuldu.`)
    ],
    sourceMachineScheduleIds: calculation.sourceMachineScheduleIds,
    sourceCapacityPlanIds: calculation.sourceCapacityPlanIds,
    sourceProductionPlanIds: calculation.sourceProductionPlanIds,
    sourceType,
    sourceId: `${input.employeeId}:${input.department}:${input.shiftName}:${input.productionLineId}:${input.machineId}:${input.planDate}`,
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  } satisfies WorkforcePlan
}

export const createWorkforcePlanningReadModelRecords = (
  sourceData: KpiSourceData,
  dependencies: WorkforceReadModelDependencies = {}
): WorkforcePlan[] => {
  const today = getTodayKey()
  const machineSchedules = dependencies.machineSchedules || MachineSchedulingService.list(sourceData)
  const firstItem = machineSchedules.flatMap(schedule => schedule.items)[0]
  const busiestLine = [...machineSchedules.flatMap(schedule => schedule.items)]
    .sort((first, second) => second.totalWorkingMinutes - first.totalWorkingMinutes)[0] || firstItem
  const seedInputs: Array<{ input: WorkforcePlanCreateInput; status: WorkforcePlanStatus; actorName: string }> = [
    {
      actorName: 'Workforce Planning',
      status: 'PREPARING',
      input: {
        planDate: today,
        startDate: today,
        endDate: today,
        employeeId: ALL_FILTER,
        department: ALL_FILTER,
        shiftName: ALL_FILTER,
        productionLineId: ALL_FILTER,
        machineId: ALL_FILTER,
        responsiblePerson: 'Workforce Planning',
        description: 'Gunluk machine scheduling yukunden personel ve vardiya read-model plani.'
      }
    },
    {
      actorName: 'Workforce Planning',
      status: 'READY',
      input: {
        planDate: today,
        startDate: today,
        endDate: today,
        employeeId: ALL_FILTER,
        department: 'Uretim',
        shiftName: 'Sabah',
        productionLineId: busiestLine?.productionLineId || ALL_FILTER,
        machineId: ALL_FILTER,
        responsiblePerson: 'Workforce Planning',
        description: 'Sabah vardiyasi icin uretim hatti personel dagilimi.'
      }
    },
    {
      actorName: 'Workforce Planning',
      status: 'APPROVED',
      input: {
        planDate: today,
        startDate: today,
        endDate: addDays(today, 6),
        employeeId: ALL_FILTER,
        department: ALL_FILTER,
        shiftName: 'Haftalik',
        productionLineId: ALL_FILTER,
        machineId: ALL_FILTER,
        responsiblePerson: 'Workforce Planning',
        description: 'Haftalik workforce planning read-model gorunumu.'
      }
    },
    {
      actorName: 'Operasyon',
      status: 'REVISED',
      input: {
        planDate: today,
        startDate: today,
        endDate: today,
        employeeId: ALL_FILTER,
        department: 'Operasyon',
        shiftName: 'Aksam',
        productionLineId: ALL_FILTER,
        machineId: busiestLine?.machineId || ALL_FILTER,
        responsiblePerson: 'Operasyon',
        description: 'Aksam vardiyasi personel eksikligi ve gorev cakisma analizi.'
      }
    }
  ]

  return seedInputs.map((row, index) => createPlanFromInput({
    actorName: row.actorName,
    input: row.input,
    machineSchedules,
    planId: `workforce_plan_${index + 1}_${row.input.shiftName}_${today.replace(/-/g, '')}`,
    planNo: getNextWorkforcePlanNo([], today, index),
    sourceData,
    sourceType: 'ReadModel',
    status: row.status
  }))
}

const normalizeHistory = (
  value: unknown,
  planId: string,
  actorName: string
): WorkforceHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${planId}_history_${index + 1}`,
    planId,
    action: normalizeText(history.action).toUpperCase() as WorkforceHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Workforce plan guncellendi.',
    revisionNo: normalizeNumber(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeItem = (
  value: unknown,
  planId: string,
  planNo: string,
  index: number
): WorkforcePlanItem => {
  const item = isRecord(value) ? value : {}
  return {
    id: normalizeText(item.id) || `${planId}_item_${index + 1}`,
    planId,
    planNo,
    sourceMachineScheduleId: normalizeText(item.sourceMachineScheduleId),
    sourceMachineScheduleNo: normalizeText(item.sourceMachineScheduleNo),
    sourceMachineScheduleItemId: normalizeText(item.sourceMachineScheduleItemId),
    employeeId: normalizeText(item.employeeId) || 'missing_employee',
    employeeCode: normalizeText(item.employeeCode) || 'N/A',
    employeeName: normalizeText(item.employeeName) || 'Personel',
    employeeActive: item.employeeActive === true,
    department: normalizeText(item.department) || 'Uretim',
    shiftId: normalizeText(item.shiftId),
    shiftName: normalizeText(item.shiftName) || 'Sabah',
    machineId: normalizeText(item.machineId),
    machineCode: normalizeText(item.machineCode) || 'M-01',
    machineName: normalizeText(item.machineName) || 'Makine',
    productionLineId: normalizeText(item.productionLineId),
    productionLineName: normalizeText(item.productionLineName) || 'Uretim Hatti',
    workCenterId: normalizeText(item.workCenterId),
    workCenterName: normalizeText(item.workCenterName) || 'Work Center',
    taskName: normalizeText(item.taskName) || 'Uretim gorevi',
    productName: normalizeText(item.productName) || 'Urun',
    recipeName: normalizeText(item.recipeName) || 'Recete',
    startAt: normalizeText(item.startAt),
    endAt: normalizeText(item.endAt),
    estimatedMinutes: normalizeNumber(item.estimatedMinutes),
    workingMinutes: normalizeNumber(item.workingMinutes),
    idleMinutes: normalizeNumber(item.idleMinutes),
    conflict: item.conflict === true,
    conflictReason: normalizeText(item.conflictReason),
    status: mapItemStatus(item.status),
    sequenceNo: normalizeNumber(item.sequenceNo) || index + 1,
    recommendations: Array.isArray(item.recommendations) ? item.recommendations.map(normalizeText).filter(Boolean) : []
  }
}

const normalizeEmployeeAssignment = (
  value: unknown,
  planId: string,
  index: number
): EmployeeAssignment => {
  const assignment = isRecord(value) ? value : {}
  return {
    id: normalizeText(assignment.id) || `${planId}_employee_${index + 1}`,
    planId,
    employeeId: normalizeText(assignment.employeeId),
    employeeCode: normalizeText(assignment.employeeCode) || 'N/A',
    employeeName: normalizeText(assignment.employeeName) || 'Personel',
    department: normalizeText(assignment.department) || 'Uretim',
    shiftName: normalizeText(assignment.shiftName) || 'Sabah',
    isActive: assignment.isActive === true,
    assignmentCount: normalizeNumber(assignment.assignmentCount),
    totalWorkingMinutes: normalizeNumber(assignment.totalWorkingMinutes),
    idleMinutes: normalizeNumber(assignment.idleMinutes),
    utilizationPercent: normalizeNumber(assignment.utilizationPercent),
    conflictCount: normalizeNumber(assignment.conflictCount),
    firstStartAt: normalizeText(assignment.firstStartAt),
    lastEndAt: normalizeText(assignment.lastEndAt)
  }
}

const normalizeShiftAssignment = (
  value: unknown,
  planId: string,
  index: number
): ShiftAssignment => {
  const assignment = isRecord(value) ? value : {}
  return {
    id: normalizeText(assignment.id) || `${planId}_shift_${index + 1}`,
    planId,
    shiftName: normalizeText(assignment.shiftName) || 'Sabah',
    workDate: normalizeText(assignment.workDate) || getTodayKey(),
    totalEmployees: normalizeNumber(assignment.totalEmployees),
    activeEmployees: normalizeNumber(assignment.activeEmployees),
    assignedEmployees: normalizeNumber(assignment.assignedEmployees),
    idleEmployees: normalizeNumber(assignment.idleEmployees),
    availableMinutes: normalizeNumber(assignment.availableMinutes),
    totalWorkingMinutes: normalizeNumber(assignment.totalWorkingMinutes),
    utilizationPercent: normalizeNumber(assignment.utilizationPercent),
    missingEmployeeCount: normalizeNumber(assignment.missingEmployeeCount),
    conflictCount: normalizeNumber(assignment.conflictCount)
  }
}

const normalizePlan = (
  record: RawWorkforcePlan,
  sourceData: KpiSourceData,
  index: number
): WorkforcePlan => {
  const id = normalizeText(record.id) || `workforce_plan_${index + 1}`
  const planNo = normalizeText(record.planNo) || getNextWorkforcePlanNo([], normalizeText(record.planDate) || getTodayKey(), index)
  const createdAt = normalizeText(record.createdAt) || new Date().toISOString()
  const actorName = normalizeText(record.createdBy) || normalizeText(record.responsiblePerson) || 'Workforce Planning'
  const productionLineId = normalizeText(record.productionLineId) || ALL_FILTER
  const items = Array.isArray(record.items) ? record.items.map((item, itemIndex) => normalizeItem(item, id, planNo, itemIndex)) : []
  const machineLabel = getMachineLabel(normalizeText(record.machineId) || ALL_FILTER, items)
  const plan: WorkforcePlan = {
    id,
    planNo,
    status: mapStatus(record.status),
    planDate: normalizeText(record.planDate) || getTodayKey(),
    startDate: normalizeText(record.startDate) || normalizeText(record.planDate) || getTodayKey(),
    endDate: normalizeText(record.endDate) || normalizeText(record.planDate) || getTodayKey(),
    employeeId: normalizeText(record.employeeId) || ALL_FILTER,
    employeeName: normalizeText(record.employeeName) || getEmployeeLabel(normalizeText(record.employeeId) || ALL_FILTER),
    department: normalizeText(record.department) || 'Tum Departmanlar',
    shiftName: normalizeText(record.shiftName) || 'Tum Vardiyalar',
    productionLineId,
    productionLineName: normalizeText(record.productionLineName) || getLineLabel(productionLineId, sourceData),
    machineId: normalizeText(record.machineId) || ALL_FILTER,
    machineCode: normalizeText(record.machineCode) || machineLabel.machineCode,
    machineName: normalizeText(record.machineName) || machineLabel.machineName,
    responsiblePerson: normalizeText(record.responsiblePerson) || actorName,
    description: normalizeText(record.description),
    items,
    employeeAssignments: Array.isArray(record.employeeAssignments) ? record.employeeAssignments.map((assignment, assignmentIndex) => normalizeEmployeeAssignment(assignment, id, assignmentIndex)) : [],
    shiftAssignments: Array.isArray(record.shiftAssignments) ? record.shiftAssignments.map((assignment, assignmentIndex) => normalizeShiftAssignment(assignment, id, assignmentIndex)) : [],
    recommendations: Array.isArray(record.recommendations) ? record.recommendations.map(normalizeText).filter(Boolean) : [],
    history: normalizeHistory(record.history, id, actorName),
    sourceMachineScheduleIds: Array.isArray(record.sourceMachineScheduleIds) ? record.sourceMachineScheduleIds.map(normalizeText).filter(Boolean) : [],
    sourceCapacityPlanIds: Array.isArray(record.sourceCapacityPlanIds) ? record.sourceCapacityPlanIds.map(normalizeText).filter(Boolean) : [],
    sourceProductionPlanIds: Array.isArray(record.sourceProductionPlanIds) ? record.sourceProductionPlanIds.map(normalizeText).filter(Boolean) : [],
    sourceType: record.sourceType === 'ManualReadModel' ? 'ManualReadModel' : 'ReadModel',
    sourceId: normalizeText(record.sourceId),
    revisionNo: normalizeNumber(record.revisionNo) || 1,
    createdBy: actorName,
    createdAt,
    updatedAt: normalizeText(record.updatedAt) || createdAt
  }

  return {
    ...plan,
    history: plan.history.length > 0
      ? plan.history
      : [createWorkforceHistory(plan.id, 'CREATED', actorName, `${plan.planNo} workforce planning read-model kaydi olusturuldu.`)]
  }
}

export const saveWorkforcePlans = (records: WorkforcePlan[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(WORKFORCE_PLANNING_STORAGE_KEY, JSON.stringify(records))
}

export const loadWorkforcePlans = (
  sourceData: KpiSourceData,
  dependencies: WorkforceReadModelDependencies = {}
) => {
  const seedRecords = resolveReadModelList(() => createWorkforcePlanningReadModelRecords(sourceData, dependencies))
  if(!isBrowserStorageAvailable()) return seedRecords

  const stored = localStorage.getItem(WORKFORCE_PLANNING_STORAGE_KEY)
  if(stored === null){
    saveWorkforcePlans(seedRecords)
    return seedRecords
  }

  try {
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)){
      const storedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizePlan(record as RawWorkforcePlan, sourceData, index))
      const storedIds = new Set(storedRecords.map(record => record.id))
      return [
        ...storedRecords,
        ...seedRecords.filter(record => !storedIds.has(record.id))
      ].sort((first, second) => second.planDate.localeCompare(first.planDate) || first.planNo.localeCompare(second.planNo))
    }
  } catch {
    // Corrupt local read-model cache is replaced with deterministic seed records.
  }

  saveWorkforcePlans(seedRecords)
  return seedRecords
}

export const filterWorkforcePlans = (
  records: WorkforcePlan[],
  filters: WorkforcePlanningFilters
) => {
  const search = normalizeSearchText(filters.search)

  return records.filter(plan => {
    const matchesSearch = !search || [
      plan.planNo,
      plan.employeeName,
      plan.department,
      plan.shiftName,
      plan.productionLineName,
      plan.machineCode,
      plan.machineName,
      ...plan.items.map(item => `${item.employeeName} ${item.department} ${item.productionLineName} ${item.machineCode}`)
    ].some(value => normalizeSearchText(value).includes(search))

    return matchesSearch
      && (filters.employeeId === ALL_FILTER || plan.employeeId === filters.employeeId || plan.items.some(item => item.employeeId === filters.employeeId))
      && (filters.department === ALL_FILTER || plan.department === filters.department || plan.items.some(item => item.department === filters.department))
      && (filters.shiftName === ALL_FILTER || plan.shiftName === filters.shiftName || plan.items.some(item => item.shiftName === filters.shiftName))
      && (filters.productionLineId === ALL_FILTER || plan.productionLineId === filters.productionLineId || plan.items.some(item => item.productionLineId === filters.productionLineId))
      && (filters.machineId === ALL_FILTER || plan.machineId === filters.machineId || plan.items.some(item => item.machineId === filters.machineId))
      && (filters.status === ALL_FILTER || plan.status === filters.status)
      && (!filters.date || plan.planDate === filters.date)
  })
}

const upsertPlan = (
  records: WorkforcePlan[],
  nextPlan: WorkforcePlan
) => records.some(record => record.id === nextPlan.id)
  ? records.map(record => record.id === nextPlan.id ? nextPlan : record)
  : [nextPlan, ...records]

export const addWorkforcePlan = (
  input: WorkforcePlanCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const validation = validateWorkforcePlanCreateInput(input)
  if(!validation.valid) throw new Error(validation.errors.join(' '))

  const records = loadWorkforcePlans(sourceData)
  const plan = createPlanFromInput({
    actorName,
    input,
    planId: createId('workforce_plan'),
    planNo: getNextWorkforcePlanNo(records, input.planDate),
    sourceData,
    sourceType: 'ManualReadModel',
    status: 'DRAFT'
  })

  saveWorkforcePlans(upsertPlan(records, plan))
  return plan
}

export const updateWorkforcePlanStatus = (
  planId: string,
  status: WorkforcePlanStatus,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadWorkforcePlans(sourceData)
  const plan = records.find(record => record.id === planId)
  if(!plan) throw new Error('Workforce plan bulunamadi.')
  if(plan.status === 'CANCELLED') throw new Error('Iptal edilen plan tekrar duzenlenemez.')

  const actionByStatus: Record<WorkforcePlanStatus, WorkforceHistoryAction> = {
    DRAFT: 'UPDATED',
    PREPARING: 'PREPARING',
    READY: 'READY',
    APPROVED: 'APPROVED',
    REVISED: 'REVISED',
    CANCELLED: 'CANCELLED'
  }
  const nextPlan = appendWorkforceHistory(
    {
      ...plan,
      status
    },
    actionByStatus[status],
    actorName,
    `${plan.planNo} ${WORKFORCE_PLAN_STATUS_LABELS[status]} durumuna alindi.`
  )
  saveWorkforcePlans(upsertPlan(records, nextPlan))
  return nextPlan
}

export const recordWorkforcePlanOutput = (
  planId: string,
  action: Extract<WorkforceHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadWorkforcePlans(sourceData)
  const plan = records.find(record => record.id === planId)
  if(!plan) throw new Error('Workforce plan bulunamadi.')
  const nextPlan = appendWorkforceHistory(
    plan,
    action,
    actorName,
    action === 'EXCEL' ? `${plan.planNo} Excel export edildi.` : `${plan.planNo} cikti penceresi acildi.`
  )
  saveWorkforcePlans(upsertPlan(records, nextPlan))
  return nextPlan
}

export const WorkforcePlanningService = {
  createDefaultFilters: createDefaultWorkforcePlanningFilters,
  getNextNo: getNextWorkforcePlanNo,
  createReadModelRecords: createWorkforcePlanningReadModelRecords,
  save: saveWorkforcePlans,
  list: loadWorkforcePlans,
  filter: filterWorkforcePlans,
  add: addWorkforcePlan,
  updateStatus: updateWorkforcePlanStatus,
  recordOutput: recordWorkforcePlanOutput,
  statistics: createWorkforceStatistics,
  validate: validateWorkforcePlan,
  validateCreateInput: validateWorkforcePlanCreateInput,
  calculation: WorkforceCalculationService,
  capacityPlanning: CapacityPlanningService,
  machineScheduling: MachineSchedulingService
}
