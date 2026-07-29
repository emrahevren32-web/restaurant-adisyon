import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import { appendSchedulingHistory, createSchedulingHistory } from './scheduling-history.service'
import { calculateMachineScheduling, SchedulingCalculationService } from './scheduling-calculation.service'
import { createSchedulingStatistics } from './scheduling-statistics.service'
import {
  validateMachineSchedule,
  validateMachineScheduleCreateInput
} from './scheduling-validation.service'
import {
  MACHINE_SCHEDULE_ITEM_STATUSES,
  MACHINE_SCHEDULE_ITEM_STATUS_LABELS,
  MACHINE_SCHEDULE_STATUSES,
  MACHINE_SCHEDULE_STATUS_LABELS,
  MACHINE_SCHEDULING_SHIFT_OPTIONS
} from './machine-scheduling.constants'
import type {
  MachineQueue,
  MachineSchedule,
  MachineScheduleCreateInput,
  MachineScheduleItem,
  MachineScheduleItemStatus,
  MachineSchedulingFilters,
  MachineScheduleStatus,
  MachineTimeline,
  MachineTimelineSegment,
  SchedulingHistory,
  SchedulingHistoryAction
} from './machine-scheduling.types'

export {
  MACHINE_SCHEDULE_ITEM_STATUSES,
  MACHINE_SCHEDULE_ITEM_STATUS_LABELS,
  MACHINE_SCHEDULE_STATUSES,
  MACHINE_SCHEDULE_STATUS_LABELS,
  MACHINE_SCHEDULING_SHIFT_OPTIONS
} from './machine-scheduling.constants'

export const MACHINE_SCHEDULING_STORAGE_KEY = 'ra_machine_scheduling_records'

type RawMachineSchedule = Partial<Record<keyof MachineSchedule, unknown>> & Record<string, unknown>

const SCHEDULE_NO_PREFIX = 'MS'
const SCHEDULE_NO_PADDING = 6

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

const getNextMachineScheduleNo = (
  records: Pick<MachineSchedule, 'scheduleNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${SCHEDULE_NO_PREFIX}-${year}-(\\d{${SCHEDULE_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.scheduleNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${SCHEDULE_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(SCHEDULE_NO_PADDING, '0')}`
}

export const createDefaultMachineSchedulingFilters = (): MachineSchedulingFilters => ({
  machineId: ALL_FILTER,
  productionLineId: ALL_FILTER,
  workCenterId: ALL_FILTER,
  status: ALL_FILTER,
  date: '',
  search: ''
})

const mapStatus = (value: unknown): MachineScheduleStatus => {
  const normalized = normalizeText(value).toUpperCase() as MachineScheduleStatus
  return MACHINE_SCHEDULE_STATUSES.includes(normalized) ? normalized : 'DRAFT'
}

const mapItemStatus = (value: unknown): MachineScheduleItemStatus => {
  const normalized = normalizeText(value).toUpperCase() as MachineScheduleItemStatus
  return MACHINE_SCHEDULE_ITEM_STATUSES.includes(normalized) ? normalized : 'SCHEDULED'
}

const getLineLabel = (
  productionLineId: string,
  sourceData: KpiSourceData
) => {
  if(productionLineId === ALL_FILTER) return 'Tum Hatlar'
  const line = sourceData.productionLines.find(record => record.id === productionLineId)
  return line?.name || productionLineId
}

const getWorkCenterLabel = (
  workCenterId: string,
  sourceData: KpiSourceData
) => {
  if(workCenterId === ALL_FILTER) return 'Tum Work Center'
  const line = sourceData.productionLines.find(record => CapacityPlanningService.calculation.getWorkCenterForLine(record).workCenterId === workCenterId)
  return line ? CapacityPlanningService.calculation.getWorkCenterForLine(line).workCenterName : workCenterId
}

const getMachineLabel = (
  machineId: string,
  timelines: MachineTimeline[]
) => {
  if(machineId === ALL_FILTER) return { machineCode: '', machineName: 'Tum Makineler' }
  const timeline = timelines.find(record => record.machineId === machineId)
  return {
    machineCode: timeline?.machineCode || machineId,
    machineName: timeline?.machineName || machineId
  }
}

const createScheduleFromInput = ({
  actorName,
  input,
  scheduleId,
  scheduleNo,
  sourceData,
  sourceType,
  status
}: {
  actorName: string
  input: MachineScheduleCreateInput
  scheduleId: string
  scheduleNo: string
  sourceData: KpiSourceData
  sourceType: MachineSchedule['sourceType']
  status: MachineScheduleStatus
}) => {
  const calculation = calculateMachineScheduling({
    scheduleId,
    scheduleNo,
    sourceData,
    startDate: input.startDate,
    endDate: input.endDate,
    machineId: input.machineId,
    productionLineId: input.productionLineId,
    workCenterId: input.workCenterId,
    shift: input.shift
  })
  const machineLabel = getMachineLabel(input.machineId, calculation.timelines)
  const createdAt = new Date().toISOString()

  return {
    id: scheduleId,
    scheduleNo,
    status,
    scheduleDate: input.scheduleDate,
    startDate: input.startDate,
    endDate: input.endDate,
    machineId: input.machineId,
    machineCode: machineLabel.machineCode,
    machineName: machineLabel.machineName,
    productionLineId: input.productionLineId,
    productionLineName: getLineLabel(input.productionLineId, sourceData),
    workCenterId: input.workCenterId,
    workCenterName: getWorkCenterLabel(input.workCenterId, sourceData),
    shift: input.shift,
    responsiblePerson: actorName || input.responsiblePerson,
    description: input.description,
    items: calculation.items,
    queues: calculation.queues,
    timelines: calculation.timelines,
    recommendations: calculation.recommendations,
    history: [
      createSchedulingHistory(scheduleId, 'CREATED', actorName, `${scheduleNo} makine cizelgeleme read-model kaydi olusturuldu.`)
    ],
    sourceCapacityPlanIds: calculation.sourceCapacityPlanIds,
    sourceProductionPlanIds: calculation.sourceProductionPlanIds,
    sourceType,
    sourceId: `${input.machineId}:${input.productionLineId}:${input.workCenterId}:${input.shift}:${input.scheduleDate}`,
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  } satisfies MachineSchedule
}

export const createMachineSchedulingReadModelRecords = (
  sourceData: KpiSourceData
): MachineSchedule[] => {
  const today = getTodayKey()
  const capacityPlans = CapacityPlanningService.list(sourceData)
  const firstMachine = capacityPlans.flatMap(plan => plan.machineCapacities)[0]
  const busiestMachine = [...capacityPlans.flatMap(plan => plan.machineCapacities)]
    .sort((first, second) => second.utilizationPercent - first.utilizationPercent)[0] || firstMachine
  const busiestLine = busiestMachine?.productionLineId || ALL_FILTER
  const busiestWorkCenter = busiestMachine?.workCenterId || ALL_FILTER
  const maintenanceMachine = capacityPlans.flatMap(plan => plan.machineCapacities).find(machine => machine.maintenanceClosed) || busiestMachine

  const seedInputs: Array<{ input: MachineScheduleCreateInput; status: MachineScheduleStatus; actorName: string }> = [
    {
      actorName: 'Makine Cizelgeleme',
      status: 'PLANNED',
      input: {
        scheduleDate: today,
        startDate: today,
        endDate: today,
        machineId: ALL_FILTER,
        productionLineId: ALL_FILTER,
        workCenterId: ALL_FILTER,
        shift: 'Sabah',
        responsiblePerson: 'Makine Cizelgeleme',
        description: 'Gunluk kapasite planlari ve uretim yuklerinden makine cizelgeleme read-modeli.'
      }
    },
    {
      actorName: 'Makine Cizelgeleme',
      status: 'READY',
      input: {
        scheduleDate: today,
        startDate: today,
        endDate: today,
        machineId: busiestMachine?.machineId || ALL_FILTER,
        productionLineId: busiestLine,
        workCenterId: busiestWorkCenter,
        shift: 'Sabah',
        responsiblePerson: 'Makine Cizelgeleme',
        description: 'En yogun makine icin kuyruk ve timeline analizi.'
      }
    },
    {
      actorName: 'Makine Cizelgeleme',
      status: 'PLANNED',
      input: {
        scheduleDate: today,
        startDate: today,
        endDate: addDays(today, 6),
        machineId: ALL_FILTER,
        productionLineId: ALL_FILTER,
        workCenterId: ALL_FILTER,
        shift: 'Haftalik',
        responsiblePerson: 'Makine Cizelgeleme',
        description: 'Haftalik machine scheduling altyapi read-modeli.'
      }
    },
    {
      actorName: 'Bakim',
      status: 'REVISED',
      input: {
        scheduleDate: today,
        startDate: today,
        endDate: today,
        machineId: maintenanceMachine?.machineId || ALL_FILTER,
        productionLineId: maintenanceMachine?.productionLineId || ALL_FILTER,
        workCenterId: maintenanceMachine?.workCenterId || ALL_FILTER,
        shift: 'Sabah',
        responsiblePerson: 'Bakim',
        description: 'Maintenance etkisi nedeniyle makine cizelge revizyon read-modeli.'
      }
    }
  ]

  return seedInputs.map((row, index) => createScheduleFromInput({
    actorName: row.actorName,
    input: row.input,
    scheduleId: `machine_schedule_${index + 1}_${row.input.machineId}_${row.input.shift}_${today.replace(/-/g, '')}`,
    scheduleNo: getNextMachineScheduleNo([], today, index),
    sourceData,
    sourceType: 'ReadModel',
    status: row.status
  }))
}

const normalizeHistory = (
  value: unknown,
  scheduleId: string,
  actorName: string
): SchedulingHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${scheduleId}_history_${index + 1}`,
    scheduleId,
    action: normalizeText(history.action).toUpperCase() as SchedulingHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Makine cizelgesi guncellendi.',
    revisionNo: normalizeNumber(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeItem = (
  value: unknown,
  scheduleId: string,
  scheduleNo: string,
  index: number
): MachineScheduleItem => {
  const item = isRecord(value) ? value : {}
  return {
    id: normalizeText(item.id) || `${scheduleId}_item_${index + 1}`,
    scheduleId,
    scheduleNo,
    sourceCapacityPlanId: normalizeText(item.sourceCapacityPlanId),
    sourceCapacityPlanNo: normalizeText(item.sourceCapacityPlanNo),
    sourceItemId: normalizeText(item.sourceItemId),
    machineId: normalizeText(item.machineId),
    machineCode: normalizeText(item.machineCode) || 'M-01',
    machineName: normalizeText(item.machineName) || 'Makine',
    productionLineId: normalizeText(item.productionLineId),
    productionLineName: normalizeText(item.productionLineName) || 'Uretim Hatti',
    workCenterId: normalizeText(item.workCenterId),
    workCenterName: normalizeText(item.workCenterName) || 'Work Center',
    productName: normalizeText(item.productName) || 'Urun',
    recipeId: normalizeText(item.recipeId),
    recipeName: normalizeText(item.recipeName) || 'Recete',
    plannedQuantity: normalizeNumber(item.plannedQuantity),
    unit: normalizeText(item.unit) || 'kg',
    startAt: normalizeText(item.startAt),
    endAt: normalizeText(item.endAt),
    estimatedMinutes: normalizeNumber(item.estimatedMinutes),
    setupMinutes: normalizeNumber(item.setupMinutes),
    cleaningMinutes: normalizeNumber(item.cleaningMinutes),
    waitingMinutes: normalizeNumber(item.waitingMinutes),
    totalWorkingMinutes: normalizeNumber(item.totalWorkingMinutes),
    idleBeforeMinutes: normalizeNumber(item.idleBeforeMinutes),
    conflict: item.conflict === true,
    conflictReason: normalizeText(item.conflictReason),
    status: mapItemStatus(item.status),
    sequenceNo: normalizeNumber(item.sequenceNo) || index + 1,
    recommendations: Array.isArray(item.recommendations) ? item.recommendations.map(normalizeText).filter(Boolean) : []
  }
}

const normalizeQueue = (
  value: unknown,
  scheduleId: string,
  index: number
): MachineQueue => {
  const queue = isRecord(value) ? value : {}
  return {
    id: normalizeText(queue.id) || `${scheduleId}_queue_${index + 1}`,
    scheduleId,
    machineId: normalizeText(queue.machineId),
    machineCode: normalizeText(queue.machineCode) || 'M-01',
    machineName: normalizeText(queue.machineName) || 'Makine',
    productionLineId: normalizeText(queue.productionLineId),
    productionLineName: normalizeText(queue.productionLineName) || 'Uretim Hatti',
    workCenterId: normalizeText(queue.workCenterId),
    workCenterName: normalizeText(queue.workCenterName) || 'Work Center',
    itemCount: normalizeNumber(queue.itemCount),
    pendingItemCount: normalizeNumber(queue.pendingItemCount),
    totalWaitingMinutes: normalizeNumber(queue.totalWaitingMinutes),
    totalSetupMinutes: normalizeNumber(queue.totalSetupMinutes),
    totalCleaningMinutes: normalizeNumber(queue.totalCleaningMinutes),
    totalWorkingMinutes: normalizeNumber(queue.totalWorkingMinutes),
    idleMinutes: normalizeNumber(queue.idleMinutes),
    utilizationPercent: normalizeNumber(queue.utilizationPercent),
    conflictCount: normalizeNumber(queue.conflictCount),
    firstStartAt: normalizeText(queue.firstStartAt),
    lastEndAt: normalizeText(queue.lastEndAt)
  }
}

const normalizeTimelineSegment = (
  value: unknown,
  index: number
): MachineTimelineSegment => {
  const segment = isRecord(value) ? value : {}
  return {
    id: normalizeText(segment.id) || `timeline_segment_${index + 1}`,
    itemId: normalizeText(segment.itemId),
    label: normalizeText(segment.label) || 'Gorev',
    startAt: normalizeText(segment.startAt),
    endAt: normalizeText(segment.endAt),
    durationMinutes: normalizeNumber(segment.durationMinutes),
    status: mapItemStatus(segment.status),
    conflict: segment.conflict === true
  }
}

const normalizeTimeline = (
  value: unknown,
  scheduleId: string,
  index: number
): MachineTimeline => {
  const timeline = isRecord(value) ? value : {}
  return {
    id: normalizeText(timeline.id) || `${scheduleId}_timeline_${index + 1}`,
    scheduleId,
    machineId: normalizeText(timeline.machineId),
    machineCode: normalizeText(timeline.machineCode) || 'M-01',
    machineName: normalizeText(timeline.machineName) || 'Makine',
    productionLineId: normalizeText(timeline.productionLineId),
    productionLineName: normalizeText(timeline.productionLineName) || 'Uretim Hatti',
    workCenterId: normalizeText(timeline.workCenterId),
    workCenterName: normalizeText(timeline.workCenterName) || 'Work Center',
    availableStartAt: normalizeText(timeline.availableStartAt),
    availableEndAt: normalizeText(timeline.availableEndAt),
    availableMinutes: normalizeNumber(timeline.availableMinutes),
    busyMinutes: normalizeNumber(timeline.busyMinutes),
    idleMinutes: normalizeNumber(timeline.idleMinutes),
    utilizationPercent: normalizeNumber(timeline.utilizationPercent),
    segments: Array.isArray(timeline.segments) ? timeline.segments.map(normalizeTimelineSegment) : []
  }
}

const normalizeSchedule = (
  record: RawMachineSchedule,
  sourceData: KpiSourceData,
  index: number
): MachineSchedule => {
  const id = normalizeText(record.id) || `machine_schedule_${index + 1}`
  const scheduleNo = normalizeText(record.scheduleNo) || getNextMachineScheduleNo([], normalizeText(record.scheduleDate) || getTodayKey(), index)
  const createdAt = normalizeText(record.createdAt) || new Date().toISOString()
  const actorName = normalizeText(record.createdBy) || normalizeText(record.responsiblePerson) || 'Makine Cizelgeleme'
  const productionLineId = normalizeText(record.productionLineId) || ALL_FILTER
  const workCenterId = normalizeText(record.workCenterId) || ALL_FILTER
  const timelines = Array.isArray(record.timelines) ? record.timelines.map((timeline, timelineIndex) => normalizeTimeline(timeline, id, timelineIndex)) : []
  const machineLabel = getMachineLabel(normalizeText(record.machineId) || ALL_FILTER, timelines)
  const schedule: MachineSchedule = {
    id,
    scheduleNo,
    status: mapStatus(record.status),
    scheduleDate: normalizeText(record.scheduleDate) || getTodayKey(),
    startDate: normalizeText(record.startDate) || normalizeText(record.scheduleDate) || getTodayKey(),
    endDate: normalizeText(record.endDate) || normalizeText(record.scheduleDate) || getTodayKey(),
    machineId: normalizeText(record.machineId) || ALL_FILTER,
    machineCode: normalizeText(record.machineCode) || machineLabel.machineCode,
    machineName: normalizeText(record.machineName) || machineLabel.machineName,
    productionLineId,
    productionLineName: normalizeText(record.productionLineName) || getLineLabel(productionLineId, sourceData),
    workCenterId,
    workCenterName: normalizeText(record.workCenterName) || getWorkCenterLabel(workCenterId, sourceData),
    shift: normalizeText(record.shift) || 'Sabah',
    responsiblePerson: normalizeText(record.responsiblePerson) || actorName,
    description: normalizeText(record.description),
    items: Array.isArray(record.items) ? record.items.map((item, itemIndex) => normalizeItem(item, id, scheduleNo, itemIndex)) : [],
    queues: Array.isArray(record.queues) ? record.queues.map((queue, queueIndex) => normalizeQueue(queue, id, queueIndex)) : [],
    timelines,
    recommendations: Array.isArray(record.recommendations) ? record.recommendations.map(normalizeText).filter(Boolean) : [],
    history: normalizeHistory(record.history, id, actorName),
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
    ...schedule,
    history: schedule.history.length > 0
      ? schedule.history
      : [createSchedulingHistory(schedule.id, 'CREATED', actorName, `${schedule.scheduleNo} makine cizelgeleme read-model kaydi olusturuldu.`)]
  }
}

export const saveMachineSchedules = (records: MachineSchedule[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(MACHINE_SCHEDULING_STORAGE_KEY, JSON.stringify(records))
}

export const loadMachineSchedules = (
  sourceData: KpiSourceData
) => {
  const seedRecords = createMachineSchedulingReadModelRecords(sourceData)
  if(!isBrowserStorageAvailable()) return seedRecords

  const stored = localStorage.getItem(MACHINE_SCHEDULING_STORAGE_KEY)
  if(stored === null){
    saveMachineSchedules(seedRecords)
    return seedRecords
  }

  try {
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)){
      const storedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeSchedule(record as RawMachineSchedule, sourceData, index))
      const storedIds = new Set(storedRecords.map(record => record.id))
      return [
        ...storedRecords,
        ...seedRecords.filter(record => !storedIds.has(record.id))
      ].sort((first, second) => second.scheduleDate.localeCompare(first.scheduleDate) || first.scheduleNo.localeCompare(second.scheduleNo))
    }
  } catch {
    // Corrupt local read-model cache is replaced with deterministic seed records.
  }

  saveMachineSchedules(seedRecords)
  return seedRecords
}

export const filterMachineSchedules = (
  records: MachineSchedule[],
  filters: MachineSchedulingFilters
) => {
  const search = normalizeSearchText(filters.search)

  return records.filter(schedule => {
    const matchesSearch = !search || [
      schedule.scheduleNo,
      schedule.machineCode,
      schedule.machineName,
      schedule.productionLineName,
      schedule.workCenterName,
      schedule.shift,
      ...schedule.items.map(item => `${item.productName} ${item.recipeName} ${item.machineCode}`)
    ].some(value => normalizeSearchText(value).includes(search))

    return matchesSearch
      && (filters.machineId === ALL_FILTER || schedule.machineId === filters.machineId || schedule.items.some(item => item.machineId === filters.machineId))
      && (filters.productionLineId === ALL_FILTER || schedule.productionLineId === filters.productionLineId || schedule.items.some(item => item.productionLineId === filters.productionLineId))
      && (filters.workCenterId === ALL_FILTER || schedule.workCenterId === filters.workCenterId || schedule.items.some(item => item.workCenterId === filters.workCenterId))
      && (filters.status === ALL_FILTER || schedule.status === filters.status)
      && (!filters.date || schedule.scheduleDate === filters.date)
  })
}

const upsertSchedule = (
  records: MachineSchedule[],
  nextSchedule: MachineSchedule
) => records.some(record => record.id === nextSchedule.id)
  ? records.map(record => record.id === nextSchedule.id ? nextSchedule : record)
  : [nextSchedule, ...records]

export const addMachineSchedule = (
  input: MachineScheduleCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const validation = validateMachineScheduleCreateInput(input)
  if(!validation.valid) throw new Error(validation.errors.join(' '))

  const records = loadMachineSchedules(sourceData)
  const schedule = createScheduleFromInput({
    actorName,
    input,
    scheduleId: createId('machine_schedule'),
    scheduleNo: getNextMachineScheduleNo(records, input.scheduleDate),
    sourceData,
    sourceType: 'ManualReadModel',
    status: 'DRAFT'
  })

  saveMachineSchedules(upsertSchedule(records, schedule))
  return schedule
}

export const updateMachineScheduleStatus = (
  scheduleId: string,
  status: MachineScheduleStatus,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadMachineSchedules(sourceData)
  const schedule = records.find(record => record.id === scheduleId)
  if(!schedule) throw new Error('Makine cizelgesi bulunamadi.')
  if(schedule.status === 'CANCELLED') throw new Error('Iptal edilen cizelge tekrar duzenlenemez.')

  const actionByStatus: Record<MachineScheduleStatus, SchedulingHistoryAction> = {
    DRAFT: 'UPDATED',
    PLANNED: 'PLANNED',
    READY: 'READY',
    RUNNING: 'RUNNING',
    COMPLETED: 'COMPLETED',
    REVISED: 'REVISED',
    CANCELLED: 'CANCELLED'
  }
  const nextSchedule = appendSchedulingHistory(
    {
      ...schedule,
      status
    },
    actionByStatus[status],
    actorName,
    `${schedule.scheduleNo} ${MACHINE_SCHEDULE_STATUS_LABELS[status]} durumuna alindi.`
  )
  saveMachineSchedules(upsertSchedule(records, nextSchedule))
  return nextSchedule
}

export const recordMachineScheduleOutput = (
  scheduleId: string,
  action: Extract<SchedulingHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadMachineSchedules(sourceData)
  const schedule = records.find(record => record.id === scheduleId)
  if(!schedule) throw new Error('Makine cizelgesi bulunamadi.')
  const nextSchedule = appendSchedulingHistory(
    schedule,
    action,
    actorName,
    action === 'EXCEL' ? `${schedule.scheduleNo} Excel export edildi.` : `${schedule.scheduleNo} cikti penceresi acildi.`
  )
  saveMachineSchedules(upsertSchedule(records, nextSchedule))
  return nextSchedule
}

export const MachineSchedulingService = {
  createDefaultFilters: createDefaultMachineSchedulingFilters,
  getNextNo: getNextMachineScheduleNo,
  createReadModelRecords: createMachineSchedulingReadModelRecords,
  save: saveMachineSchedules,
  list: loadMachineSchedules,
  filter: filterMachineSchedules,
  add: addMachineSchedule,
  updateStatus: updateMachineScheduleStatus,
  recordOutput: recordMachineScheduleOutput,
  statistics: createSchedulingStatistics,
  validate: validateMachineSchedule,
  validateCreateInput: validateMachineScheduleCreateInput,
  calculation: SchedulingCalculationService
}
