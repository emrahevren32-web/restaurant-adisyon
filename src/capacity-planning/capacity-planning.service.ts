import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { ProductionPlanningService } from '../production-planning/production-planning.service'
import { resolveReadModelList } from '../read-model/read-model-safety'
import {
  calculateCapacityPlan,
  CapacityCalculationService
} from './capacity-calculation.service'
import { appendCapacityHistory, createCapacityHistory } from './capacity-history.service'
import { createCapacityStatistics } from './capacity-statistics.service'
import { validateCapacityPlan, validateCapacityPlanCreateInput } from './capacity-validation.service'
import {
  CAPACITY_DEFAULT_SHIFT_OPTIONS,
  CAPACITY_PLAN_STATUSES,
  CAPACITY_PLAN_STATUS_LABELS,
  CAPACITY_RISK_LABELS,
  CAPACITY_RISK_LEVELS
} from './capacity-planning.constants'
import type {
  CapacityHistory,
  CapacityHistoryAction,
  CapacityPlan,
  CapacityPlanCreateInput,
  CapacityPlanningFilters,
  CapacityPlanItem,
  CapacityPlanStatus,
  CapacityRiskLevel,
  CapacitySourceType,
  MachineCapacity,
  ProductionCapacity,
  WorkCenterCapacity
} from './capacity-planning.types'

export {
  CAPACITY_DEFAULT_SHIFT_OPTIONS,
  CAPACITY_PLAN_STATUSES,
  CAPACITY_PLAN_STATUS_LABELS,
  CAPACITY_RISK_LABELS,
  CAPACITY_RISK_LEVELS
} from './capacity-planning.constants'

export const CAPACITY_PLANNING_STORAGE_KEY = 'ra_capacity_planning_records'

type RawCapacityPlan = Partial<Record<keyof CapacityPlan, unknown>> & Record<string, unknown>

const PLAN_NO_PREFIX = 'CP'
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

const getNextCapacityPlanNo = (
  records: Pick<CapacityPlan, 'capacityPlanNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${PLAN_NO_PREFIX}-${year}-(\\d{${PLAN_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.capacityPlanNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${PLAN_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(PLAN_NO_PADDING, '0')}`
}

export const createDefaultCapacityPlanningFilters = (): CapacityPlanningFilters => ({
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  workCenterId: ALL_FILTER,
  shift: ALL_FILTER,
  status: ALL_FILTER,
  date: '',
  search: ''
})

const mapStatus = (value: unknown): CapacityPlanStatus => {
  const normalized = normalizeText(value).toUpperCase() as CapacityPlanStatus
  return CAPACITY_PLAN_STATUSES.includes(normalized) ? normalized : 'DRAFT'
}

const mapRisk = (value: unknown): CapacityRiskLevel => {
  const normalized = normalizeText(value).toUpperCase() as CapacityRiskLevel
  return CAPACITY_RISK_LEVELS.includes(normalized) ? normalized : 'NORMAL'
}

const mapSourceType = (value: unknown): CapacitySourceType => {
  const normalized = normalizeText(value) as CapacitySourceType
  return ['ProductionPlanning', 'ProductionOrder', 'ReadModel', 'ManualReadModel'].includes(normalized)
    ? normalized
    : 'ReadModel'
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
  const line = sourceData.productionLines.find(record => CapacityCalculationService.getWorkCenterForLine(record).workCenterId === workCenterId)
  return line ? CapacityCalculationService.getWorkCenterForLine(line).workCenterName : workCenterId
}

const createCapacityPlanFromInput = ({
  actorName,
  capacityPlanNo,
  input,
  planningPlans,
  planId,
  sourceData,
  sourceType,
  status
}: {
  actorName: string
  capacityPlanNo: string
  input: CapacityPlanCreateInput
  planningPlans?: ReturnType<typeof ProductionPlanningService.list>
  planId: string
  sourceData: KpiSourceData
  sourceType: CapacityPlan['sourceType']
  status: CapacityPlanStatus
}) => {
  const calculation = calculateCapacityPlan({
    planId,
    sourceData,
    startDate: input.startDate,
    endDate: input.endDate,
    productionLineId: input.productionLineId,
    workCenterId: input.workCenterId,
    shift: input.shift,
    planningPlans
  })
  const createdAt = new Date().toISOString()
  const plan: CapacityPlan = {
    id: planId,
    capacityPlanNo,
    status,
    planDate: input.planDate,
    startDate: input.startDate,
    endDate: input.endDate,
    productionLineId: input.productionLineId,
    productionLineName: getLineLabel(input.productionLineId, sourceData),
    workCenterId: input.workCenterId,
    workCenterName: getWorkCenterLabel(input.workCenterId, sourceData),
    shift: input.shift,
    responsiblePerson: actorName || input.responsiblePerson,
    description: input.description,
    items: calculation.items,
    productionCapacities: calculation.productionCapacities,
    workCenterCapacities: calculation.workCenterCapacities,
    machineCapacities: calculation.machineCapacities.map(machine => ({ ...machine, shift: input.shift })),
    recommendations: calculation.recommendations,
    history: [
      createCapacityHistory(planId, 'CREATED', actorName, `${capacityPlanNo} kapasite planlama read-model kaydi olusturuldu.`)
    ],
    sourcePlanningPlanIds: calculation.sourcePlanningPlanIds,
    sourceType,
    sourceId: `${input.productionLineId}:${input.workCenterId}:${input.shift}:${input.planDate}`,
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  }

  return plan
}

export const createCapacityPlanningReadModelRecords = (
  sourceData: KpiSourceData
): CapacityPlan[] => {
  const today = getTodayKey()
  const planningPlans = ProductionPlanningService.list(sourceData)
  const firstLine = sourceData.productionLines[0]
  const busiestLine = [...sourceData.productionLines].sort((first, second) => second.estimatedUtilization - first.estimatedUtilization)[0] || firstLine
  const maintenanceLine = sourceData.productionLines.find(line => normalizeSearchText(line.status).includes('bak')) || busiestLine
  const busiestWorkCenter = busiestLine ? CapacityCalculationService.getWorkCenterForLine(busiestLine) : { workCenterId: ALL_FILTER, workCenterName: 'Tum Work Center' }

  const seedInputs: Array<{ input: CapacityPlanCreateInput; status: CapacityPlanStatus; actorName: string }> = [
    {
      actorName: 'Kapasite Planlama',
      status: 'PREPARING',
      input: {
        planDate: today,
        startDate: today,
        endDate: today,
        productionLineId: ALL_FILTER,
        workCenterId: ALL_FILTER,
        shift: 'Sabah',
        responsiblePerson: 'Kapasite Planlama',
        description: 'Gunluk uretim planlari, uretim emirleri, hat, makine, vardiya ve maintenance sinyallerinden kapasite read-modeli.'
      }
    },
    {
      actorName: 'Kapasite Planlama',
      status: 'ANALYZED',
      input: {
        planDate: today,
        startDate: today,
        endDate: addDays(today, 6),
        productionLineId: ALL_FILTER,
        workCenterId: ALL_FILTER,
        shift: 'Haftalik',
        responsiblePerson: 'Kapasite Planlama',
        description: 'Haftalik kapasite, bos kapasite ve darbogaz analizi.'
      }
    },
    {
      actorName: 'Kapasite Planlama',
      status: 'ANALYZED',
      input: {
        planDate: today,
        startDate: today,
        endDate: today,
        productionLineId: busiestLine?.id || ALL_FILTER,
        workCenterId: busiestWorkCenter.workCenterId,
        shift: 'Sabah',
        responsiblePerson: 'Kapasite Planlama',
        description: 'En yogun hat icin makine ve work center kapasite analizi.'
      }
    },
    {
      actorName: 'Bakim',
      status: 'REVISED',
      input: {
        planDate: today,
        startDate: today,
        endDate: today,
        productionLineId: maintenanceLine?.id || ALL_FILTER,
        workCenterId: maintenanceLine ? CapacityCalculationService.getWorkCenterForLine(maintenanceLine).workCenterId : ALL_FILTER,
        shift: 'Sabah',
        responsiblePerson: 'Bakim',
        description: 'Maintenance etkisi nedeniyle kapasite revizyon read-modeli.'
      }
    }
  ]

  return seedInputs.map((row, index) => createCapacityPlanFromInput({
    actorName: row.actorName,
    capacityPlanNo: getNextCapacityPlanNo(seedInputs.slice(0, index).map((_, seedIndex) => ({ capacityPlanNo: getNextCapacityPlanNo([], today, seedIndex) })), today),
    input: row.input,
    planningPlans,
    planId: `capacity_plan_${index + 1}_${row.input.productionLineId}_${row.input.shift}_${today.replace(/-/g, '')}`,
    sourceData,
    sourceType: 'ReadModel',
    status: row.status
  }))
}

const normalizeHistory = (
  value: unknown,
  planId: string,
  actorName: string
): CapacityHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${planId}_history_${index + 1}`,
    planId,
    action: normalizeText(history.action).toUpperCase() as CapacityHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Kapasite plani guncellendi.',
    revisionNo: normalizeNumber(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeItem = (
  value: unknown,
  planId: string,
  index: number
): CapacityPlanItem => {
  const item = isRecord(value) ? value : {}
  return {
    id: normalizeText(item.id) || `${planId}_item_${index + 1}`,
    planId,
    sourceType: mapSourceType(item.sourceType),
    sourceId: normalizeText(item.sourceId),
    sourceNo: normalizeText(item.sourceNo),
    productName: normalizeText(item.productName) || 'Urun',
    recipeId: normalizeText(item.recipeId),
    recipeName: normalizeText(item.recipeName) || 'Recete',
    productionLineId: normalizeText(item.productionLineId),
    productionLineName: normalizeText(item.productionLineName) || 'Uretim Hatti',
    workCenterId: normalizeText(item.workCenterId),
    workCenterName: normalizeText(item.workCenterName) || 'Work Center',
    machineId: normalizeText(item.machineId),
    machineCode: normalizeText(item.machineCode) || 'M-01',
    machineName: normalizeText(item.machineName) || 'Makine',
    shift: normalizeText(item.shift) || 'Sabah',
    plannedQuantity: normalizeNumber(item.plannedQuantity),
    unit: normalizeText(item.unit) || 'kg',
    plannedProductionMinutes: normalizeNumber(item.plannedProductionMinutes),
    recipePreparationMinutes: normalizeNumber(item.recipePreparationMinutes),
    setupMinutes: normalizeNumber(item.setupMinutes),
    cleaningMinutes: normalizeNumber(item.cleaningMinutes),
    warehousePreparationMinutes: normalizeNumber(item.warehousePreparationMinutes),
    maintenanceMinutes: normalizeNumber(item.maintenanceMinutes),
    netProductionMinutes: normalizeNumber(item.netProductionMinutes),
    availableMinutes: normalizeNumber(item.availableMinutes),
    totalLoadMinutes: normalizeNumber(item.totalLoadMinutes),
    idleMinutes: normalizeNumber(item.idleMinutes),
    overloadMinutes: normalizeNumber(item.overloadMinutes),
    utilizationPercent: normalizeNumber(item.utilizationPercent),
    riskLevel: mapRisk(item.riskLevel),
    recommendations: Array.isArray(item.recommendations) ? item.recommendations.map(normalizeText).filter(Boolean) : []
  }
}

const normalizeProductionCapacity = (
  value: unknown,
  planId: string,
  index: number
): ProductionCapacity => {
  const capacity = isRecord(value) ? value : {}
  return {
    id: normalizeText(capacity.id) || `${planId}_line_${index + 1}`,
    planId,
    productionLineId: normalizeText(capacity.productionLineId),
    productionLineCode: normalizeText(capacity.productionLineCode) || `HAT-${index + 1}`,
    productionLineName: normalizeText(capacity.productionLineName) || 'Uretim Hatti',
    workCenterId: normalizeText(capacity.workCenterId),
    workCenterName: normalizeText(capacity.workCenterName) || 'Work Center',
    shift: normalizeText(capacity.shift) || 'Sabah',
    lineStatus: normalizeText(capacity.lineStatus) || 'Aktif',
    machineCount: normalizeNumber(capacity.machineCount),
    workingMinutes: normalizeNumber(capacity.workingMinutes),
    availableMinutes: normalizeNumber(capacity.availableMinutes),
    plannedProductionMinutes: normalizeNumber(capacity.plannedProductionMinutes),
    recipePreparationMinutes: normalizeNumber(capacity.recipePreparationMinutes),
    setupMinutes: normalizeNumber(capacity.setupMinutes),
    cleaningMinutes: normalizeNumber(capacity.cleaningMinutes),
    warehousePreparationMinutes: normalizeNumber(capacity.warehousePreparationMinutes),
    maintenanceMinutes: normalizeNumber(capacity.maintenanceMinutes),
    netProductionMinutes: normalizeNumber(capacity.netProductionMinutes),
    totalLoadMinutes: normalizeNumber(capacity.totalLoadMinutes),
    idleMinutes: normalizeNumber(capacity.idleMinutes),
    overloadMinutes: normalizeNumber(capacity.overloadMinutes),
    utilizationPercent: normalizeNumber(capacity.utilizationPercent),
    bottleneck: capacity.bottleneck === true,
    maintenanceClosed: capacity.maintenanceClosed === true,
    riskLevel: mapRisk(capacity.riskLevel),
    recommendations: Array.isArray(capacity.recommendations) ? capacity.recommendations.map(normalizeText).filter(Boolean) : []
  }
}

const normalizeMachineCapacity = (
  value: unknown,
  planId: string,
  index: number
): MachineCapacity => {
  const machine = isRecord(value) ? value : {}
  return {
    id: normalizeText(machine.id) || `${planId}_machine_${index + 1}`,
    planId,
    machineId: normalizeText(machine.machineId),
    machineCode: normalizeText(machine.machineCode) || `M-${index + 1}`,
    machineName: normalizeText(machine.machineName) || 'Makine',
    productionLineId: normalizeText(machine.productionLineId),
    productionLineName: normalizeText(machine.productionLineName) || 'Uretim Hatti',
    workCenterId: normalizeText(machine.workCenterId),
    workCenterName: normalizeText(machine.workCenterName) || 'Work Center',
    shift: normalizeText(machine.shift) || 'Sabah',
    active: machine.active !== false,
    maintenanceClosed: machine.maintenanceClosed === true,
    workingMinutes: normalizeNumber(machine.workingMinutes),
    availableMinutes: normalizeNumber(machine.availableMinutes),
    plannedProductionMinutes: normalizeNumber(machine.plannedProductionMinutes),
    recipePreparationMinutes: normalizeNumber(machine.recipePreparationMinutes),
    setupMinutes: normalizeNumber(machine.setupMinutes),
    cleaningMinutes: normalizeNumber(machine.cleaningMinutes),
    warehousePreparationMinutes: normalizeNumber(machine.warehousePreparationMinutes),
    maintenanceMinutes: normalizeNumber(machine.maintenanceMinutes),
    netProductionMinutes: normalizeNumber(machine.netProductionMinutes),
    totalLoadMinutes: normalizeNumber(machine.totalLoadMinutes),
    idleMinutes: normalizeNumber(machine.idleMinutes),
    overloadMinutes: normalizeNumber(machine.overloadMinutes),
    utilizationPercent: normalizeNumber(machine.utilizationPercent),
    bottleneck: machine.bottleneck === true,
    riskLevel: mapRisk(machine.riskLevel),
    recommendations: Array.isArray(machine.recommendations) ? machine.recommendations.map(normalizeText).filter(Boolean) : []
  }
}

const normalizeWorkCenterCapacity = (
  value: unknown,
  planId: string,
  index: number
): WorkCenterCapacity => {
  const workCenter = isRecord(value) ? value : {}
  return {
    id: normalizeText(workCenter.id) || `${planId}_work_center_${index + 1}`,
    planId,
    workCenterId: normalizeText(workCenter.workCenterId),
    workCenterName: normalizeText(workCenter.workCenterName) || 'Work Center',
    lineCount: normalizeNumber(workCenter.lineCount),
    machineCount: normalizeNumber(workCenter.machineCount),
    workingMinutes: normalizeNumber(workCenter.workingMinutes),
    availableMinutes: normalizeNumber(workCenter.availableMinutes),
    totalLoadMinutes: normalizeNumber(workCenter.totalLoadMinutes),
    idleMinutes: normalizeNumber(workCenter.idleMinutes),
    overloadMinutes: normalizeNumber(workCenter.overloadMinutes),
    utilizationPercent: normalizeNumber(workCenter.utilizationPercent),
    bottleneckCount: normalizeNumber(workCenter.bottleneckCount),
    riskLevel: mapRisk(workCenter.riskLevel)
  }
}

const normalizePlan = (
  record: RawCapacityPlan,
  sourceData: KpiSourceData,
  index: number
): CapacityPlan => {
  const id = normalizeText(record.id) || `capacity_plan_${index + 1}`
  const createdAt = normalizeText(record.createdAt) || new Date().toISOString()
  const productionLineId = normalizeText(record.productionLineId) || ALL_FILTER
  const workCenterId = normalizeText(record.workCenterId) || ALL_FILTER
  const actorName = normalizeText(record.createdBy) || normalizeText(record.responsiblePerson) || 'Kapasite Planlama'
  const plan: CapacityPlan = {
    id,
    capacityPlanNo: normalizeText(record.capacityPlanNo) || getNextCapacityPlanNo([], normalizeText(record.planDate) || getTodayKey(), index),
    status: mapStatus(record.status),
    planDate: normalizeText(record.planDate) || getTodayKey(),
    startDate: normalizeText(record.startDate) || normalizeText(record.planDate) || getTodayKey(),
    endDate: normalizeText(record.endDate) || normalizeText(record.planDate) || getTodayKey(),
    productionLineId,
    productionLineName: normalizeText(record.productionLineName) || getLineLabel(productionLineId, sourceData),
    workCenterId,
    workCenterName: normalizeText(record.workCenterName) || getWorkCenterLabel(workCenterId, sourceData),
    shift: normalizeText(record.shift) || 'Sabah',
    responsiblePerson: normalizeText(record.responsiblePerson) || actorName,
    description: normalizeText(record.description),
    items: Array.isArray(record.items) ? record.items.map((item, itemIndex) => normalizeItem(item, id, itemIndex)) : [],
    productionCapacities: Array.isArray(record.productionCapacities) ? record.productionCapacities.map((capacity, capacityIndex) => normalizeProductionCapacity(capacity, id, capacityIndex)) : [],
    workCenterCapacities: Array.isArray(record.workCenterCapacities) ? record.workCenterCapacities.map((capacity, capacityIndex) => normalizeWorkCenterCapacity(capacity, id, capacityIndex)) : [],
    machineCapacities: Array.isArray(record.machineCapacities) ? record.machineCapacities.map((machine, machineIndex) => normalizeMachineCapacity(machine, id, machineIndex)) : [],
    recommendations: Array.isArray(record.recommendations) ? record.recommendations.map(normalizeText).filter(Boolean) : [],
    history: normalizeHistory(record.history, id, actorName),
    sourcePlanningPlanIds: Array.isArray(record.sourcePlanningPlanIds) ? record.sourcePlanningPlanIds.map(normalizeText).filter(Boolean) : [],
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
      : [createCapacityHistory(plan.id, 'CREATED', actorName, `${plan.capacityPlanNo} kapasite planlama read-model kaydi olusturuldu.`)]
  }
}

export const saveCapacityPlans = (records: CapacityPlan[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(CAPACITY_PLANNING_STORAGE_KEY, JSON.stringify(records))
}

export const loadCapacityPlans = (
  sourceData: KpiSourceData
) => {
  const seedRecords = resolveReadModelList(() => createCapacityPlanningReadModelRecords(sourceData))
  if(!isBrowserStorageAvailable()) return seedRecords

  const stored = localStorage.getItem(CAPACITY_PLANNING_STORAGE_KEY)
  if(stored === null){
    saveCapacityPlans(seedRecords)
    return seedRecords
  }

  try {
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)){
      const storedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizePlan(record as RawCapacityPlan, sourceData, index))
      const storedIds = new Set(storedRecords.map(record => record.id))
      return [
        ...storedRecords,
        ...seedRecords.filter(record => !storedIds.has(record.id))
      ].sort((first, second) => second.planDate.localeCompare(first.planDate) || first.capacityPlanNo.localeCompare(second.capacityPlanNo))
    }
  } catch {
    // Corrupt local read-model cache is replaced with deterministic seed records.
  }

  saveCapacityPlans(seedRecords)
  return seedRecords
}

export const filterCapacityPlans = (
  records: CapacityPlan[],
  filters: CapacityPlanningFilters
) => {
  const search = normalizeSearchText(filters.search)

  return records.filter(plan => {
    const matchesSearch = !search || [
      plan.capacityPlanNo,
      plan.productionLineName,
      plan.workCenterName,
      plan.shift,
      plan.responsiblePerson,
      ...plan.machineCapacities.map(machine => `${machine.machineCode} ${machine.machineName}`)
    ].some(value => normalizeSearchText(value).includes(search))

    return matchesSearch
      && (filters.productionLineId === ALL_FILTER || plan.productionLineId === filters.productionLineId || plan.productionCapacities.some(capacity => capacity.productionLineId === filters.productionLineId))
      && (filters.workCenterId === ALL_FILTER || plan.workCenterId === filters.workCenterId || plan.workCenterCapacities.some(capacity => capacity.workCenterId === filters.workCenterId))
      && (filters.machineId === ALL_FILTER || plan.machineCapacities.some(machine => machine.machineId === filters.machineId))
      && (filters.shift === ALL_FILTER || plan.shift === filters.shift)
      && (filters.status === ALL_FILTER || plan.status === filters.status)
      && (!filters.date || plan.planDate === filters.date)
  })
}

const upsertPlan = (
  records: CapacityPlan[],
  nextPlan: CapacityPlan
) => records.some(record => record.id === nextPlan.id)
  ? records.map(record => record.id === nextPlan.id ? nextPlan : record)
  : [nextPlan, ...records]

export const addCapacityPlan = (
  input: CapacityPlanCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const validation = validateCapacityPlanCreateInput(input)
  if(!validation.valid) throw new Error(validation.errors.join(' '))

  const records = loadCapacityPlans(sourceData)
  const plan = createCapacityPlanFromInput({
    actorName,
    capacityPlanNo: getNextCapacityPlanNo(records, input.planDate),
    input,
    planId: createId('capacity_plan'),
    sourceData,
    sourceType: 'ManualReadModel',
    status: 'DRAFT'
  })
  const planValidation = validateCapacityPlan(plan)
  if(!planValidation.valid) throw new Error(planValidation.errors.join(' '))
  saveCapacityPlans(upsertPlan(records, plan))
  return plan
}

export const updateCapacityPlanStatus = (
  planId: string,
  status: CapacityPlanStatus,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadCapacityPlans(sourceData)
  const plan = records.find(record => record.id === planId)
  if(!plan) throw new Error('Kapasite plani bulunamadi.')
  if(plan.status === 'CANCELLED') throw new Error('Iptal edilen kapasite plani tekrar duzenlenemez.')

  const actionByStatus: Record<CapacityPlanStatus, CapacityHistoryAction> = {
    DRAFT: 'UPDATED',
    PREPARING: 'PREPARING',
    ANALYZED: 'ANALYZED',
    APPROVED: 'APPROVED',
    REVISED: 'REVISED',
    CANCELLED: 'CANCELLED'
  }
  const nextPlan = appendCapacityHistory(
    {
      ...plan,
      status
    },
    actionByStatus[status],
    actorName,
    `${plan.capacityPlanNo} ${CAPACITY_PLAN_STATUS_LABELS[status]} durumuna alindi.`
  )
  saveCapacityPlans(upsertPlan(records, nextPlan))
  return nextPlan
}

export const recordCapacityPlanOutput = (
  planId: string,
  action: Extract<CapacityHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadCapacityPlans(sourceData)
  const plan = records.find(record => record.id === planId)
  if(!plan) throw new Error('Kapasite plani bulunamadi.')
  const nextPlan = appendCapacityHistory(
    plan,
    action,
    actorName,
    action === 'EXCEL' ? `${plan.capacityPlanNo} Excel export edildi.` : `${plan.capacityPlanNo} cikti penceresi acildi.`
  )
  saveCapacityPlans(upsertPlan(records, nextPlan))
  return nextPlan
}

export const CapacityPlanningService = {
  createDefaultFilters: createDefaultCapacityPlanningFilters,
  getNextNo: getNextCapacityPlanNo,
  createReadModelRecords: createCapacityPlanningReadModelRecords,
  save: saveCapacityPlans,
  list: loadCapacityPlans,
  filter: filterCapacityPlans,
  add: addCapacityPlan,
  updateStatus: updateCapacityPlanStatus,
  recordOutput: recordCapacityPlanOutput,
  statistics: createCapacityStatistics,
  validate: validateCapacityPlan,
  validateCreateInput: validateCapacityPlanCreateInput,
  calculation: CapacityCalculationService
}
