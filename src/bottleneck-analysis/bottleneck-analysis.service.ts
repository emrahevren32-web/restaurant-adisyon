import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import { MachineSchedulingService } from '../machine-scheduling/machine-scheduling.service'
import { resolveReadModelList } from '../read-model/read-model-safety'
import { loadEmployees } from '../storage'
import { WorkforcePlanningService } from '../workforce-planning/workforce-planning.service'
import { calculateBottleneckAnalysis, BottleneckCalculationService } from './bottleneck-calculation.service'
import { appendBottleneckHistory, createBottleneckHistory } from './bottleneck-history.service'
import { createBottleneckStatistics } from './bottleneck-statistics.service'
import {
  validateBottleneckReport,
  validateBottleneckReportCreateInput
} from './bottleneck-validation.service'
import {
  BOTTLENECK_REPORT_STATUSES,
  BOTTLENECK_REPORT_STATUS_LABELS,
  BOTTLENECK_RISK_LABELS,
  BOTTLENECK_RISK_LEVELS,
  BOTTLENECK_TYPE_LABELS,
  BOTTLENECK_TYPES
} from './bottleneck-analysis.constants'
import type {
  BottleneckAnalysisFilters,
  BottleneckHistory,
  BottleneckHistoryAction,
  BottleneckItem,
  BottleneckReason,
  BottleneckReport,
  BottleneckReportCreateInput,
  BottleneckReportStatus,
  BottleneckRiskLevel,
  BottleneckType,
  ProductionConstraint
} from './bottleneck-analysis.types'

export {
  BOTTLENECK_REPORT_STATUSES,
  BOTTLENECK_REPORT_STATUS_LABELS,
  BOTTLENECK_RISK_LABELS,
  BOTTLENECK_RISK_LEVELS,
  BOTTLENECK_TYPE_LABELS,
  BOTTLENECK_TYPES
} from './bottleneck-analysis.constants'

export const BOTTLENECK_ANALYSIS_STORAGE_KEY = 'ra_bottleneck_analysis_records'

type RawBottleneckReport = Partial<Record<keyof BottleneckReport, unknown>> & Record<string, unknown>
type BottleneckReadModelDependencies = {
  capacityPlans?: ReturnType<typeof CapacityPlanningService.list>
  machineSchedules?: ReturnType<typeof MachineSchedulingService.list>
  workforcePlans?: ReturnType<typeof WorkforcePlanningService.list>
}

const REPORT_NO_PREFIX = 'BN'
const REPORT_NO_PADDING = 6

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

const getNextBottleneckReportNo = (
  records: Pick<BottleneckReport, 'reportNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${REPORT_NO_PREFIX}-${year}-(\\d{${REPORT_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.reportNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${REPORT_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(REPORT_NO_PADDING, '0')}`
}

export const createDefaultBottleneckAnalysisFilters = (): BottleneckAnalysisFilters => ({
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  employeeId: ALL_FILTER,
  workCenterId: ALL_FILTER,
  riskLevel: ALL_FILTER,
  date: '',
  search: ''
})

const mapStatus = (value: unknown): BottleneckReportStatus => {
  const normalized = normalizeText(value).toUpperCase() as BottleneckReportStatus
  return BOTTLENECK_REPORT_STATUSES.includes(normalized) ? normalized : 'DRAFT'
}

const mapRisk = (value: unknown): BottleneckRiskLevel => {
  const normalized = normalizeText(value).toUpperCase() as BottleneckRiskLevel
  return BOTTLENECK_RISK_LEVELS.includes(normalized) ? normalized : 'LOW'
}

const mapType = (value: unknown): BottleneckType => {
  const normalized = normalizeText(value).toUpperCase() as BottleneckType
  return BOTTLENECK_TYPES.includes(normalized) ? normalized : 'MACHINE'
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
  items: BottleneckItem[]
) => {
  if(machineId === ALL_FILTER) return { machineCode: '', machineName: 'Tum Makineler' }
  const item = items.find(record => record.machineId === machineId)
  return {
    machineCode: item?.machineCode || machineId,
    machineName: item?.machineName || machineId
  }
}

const getEmployeeLabel = (
  employeeId: string
) => {
  if(employeeId === ALL_FILTER) return 'Tum Personel'
  return loadEmployees().find(employee => employee.id === employeeId)?.fullName || employeeId
}

const getWorkCenterLabel = (
  workCenterId: string,
  sourceData: KpiSourceData
) => {
  if(workCenterId === ALL_FILTER) return 'Tum Work Center'
  const line = sourceData.productionLines.find(record => CapacityPlanningService.calculation.getWorkCenterForLine(record).workCenterId === workCenterId)
  return line ? CapacityPlanningService.calculation.getWorkCenterForLine(line).workCenterName : workCenterId
}

const createReportFromInput = ({
  actorName,
  capacityPlans,
  input,
  machineSchedules,
  reportId,
  reportNo,
  sourceData,
  sourceType,
  status,
  workforcePlans
}: {
  actorName: string
  capacityPlans?: ReturnType<typeof CapacityPlanningService.list>
  input: BottleneckReportCreateInput
  machineSchedules?: ReturnType<typeof MachineSchedulingService.list>
  reportId: string
  reportNo: string
  sourceData: KpiSourceData
  sourceType: BottleneckReport['sourceType']
  status: BottleneckReportStatus
  workforcePlans?: ReturnType<typeof WorkforcePlanningService.list>
}) => {
  const calculation = calculateBottleneckAnalysis({
    reportId,
    reportNo,
    sourceData,
    startDate: input.startDate,
    endDate: input.endDate,
    productionLineId: input.productionLineId,
    machineId: input.machineId,
    employeeId: input.employeeId,
    workCenterId: input.workCenterId,
    riskLevel: input.riskLevel,
    capacityPlans,
    machineSchedules,
    workforcePlans
  })
  const machineLabel = getMachineLabel(input.machineId, calculation.items)
  const createdAt = new Date().toISOString()

  return {
    id: reportId,
    reportNo,
    status,
    reportDate: input.reportDate,
    startDate: input.startDate,
    endDate: input.endDate,
    productionLineId: input.productionLineId,
    productionLineName: getLineLabel(input.productionLineId, sourceData),
    machineId: input.machineId,
    machineCode: machineLabel.machineCode,
    machineName: machineLabel.machineName,
    employeeId: input.employeeId,
    employeeName: getEmployeeLabel(input.employeeId),
    workCenterId: input.workCenterId,
    workCenterName: getWorkCenterLabel(input.workCenterId, sourceData),
    riskLevel: input.riskLevel,
    responsiblePerson: actorName || input.responsiblePerson,
    description: input.description,
    items: calculation.items,
    constraints: calculation.constraints,
    reasons: calculation.reasons,
    recommendations: calculation.recommendations,
    history: [
      createBottleneckHistory(reportId, 'CREATED', actorName, `${reportNo} bottleneck analysis read-model raporu olusturuldu.`)
    ],
    sourceCapacityPlanIds: calculation.sourceCapacityPlanIds,
    sourceMachineScheduleIds: calculation.sourceMachineScheduleIds,
    sourceWorkforcePlanIds: calculation.sourceWorkforcePlanIds,
    sourceProductionPlanIds: calculation.sourceProductionPlanIds,
    sourceType,
    sourceId: `${input.productionLineId}:${input.machineId}:${input.employeeId}:${input.workCenterId}:${input.riskLevel}:${input.reportDate}`,
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  } satisfies BottleneckReport
}

export const createBottleneckAnalysisReadModelRecords = (
  sourceData: KpiSourceData,
  dependencies: BottleneckReadModelDependencies = {}
): BottleneckReport[] => {
  const today = getTodayKey()
  const capacityPlans = dependencies.capacityPlans || CapacityPlanningService.list(sourceData)
  const machineSchedules = dependencies.machineSchedules || MachineSchedulingService.list(sourceData)
  const workforcePlans = dependencies.workforcePlans || WorkforcePlanningService.list(sourceData, { machineSchedules })
  const busiestLine = [...capacityPlans.flatMap(plan => plan.productionCapacities)]
    .sort((first, second) => second.utilizationPercent - first.utilizationPercent)[0]
  const busiestMachine = [...machineSchedules.flatMap(schedule => schedule.queues)]
    .sort((first, second) => second.utilizationPercent - first.utilizationPercent || second.totalWaitingMinutes - first.totalWaitingMinutes)[0]
  const busiestEmployee = [...workforcePlans.flatMap(plan => plan.employeeAssignments)]
    .sort((first, second) => second.utilizationPercent - first.utilizationPercent)[0]
  const seedInputs: Array<{ input: BottleneckReportCreateInput; status: BottleneckReportStatus; actorName: string }> = [
    {
      actorName: 'Bottleneck Analysis',
      status: 'ANALYZED',
      input: {
        reportDate: today,
        startDate: today,
        endDate: today,
        productionLineId: ALL_FILTER,
        machineId: ALL_FILTER,
        employeeId: ALL_FILTER,
        workCenterId: ALL_FILTER,
        riskLevel: ALL_FILTER,
        responsiblePerson: 'Bottleneck Analysis',
        description: 'Gunluk kapasite, makine cizelgeleme ve workforce planning darbogaz read-model raporu.'
      }
    },
    {
      actorName: 'Bottleneck Analysis',
      status: 'READY',
      input: {
        reportDate: today,
        startDate: today,
        endDate: today,
        productionLineId: busiestLine?.productionLineId || ALL_FILTER,
        machineId: ALL_FILTER,
        employeeId: ALL_FILTER,
        workCenterId: busiestLine?.workCenterId || ALL_FILTER,
        riskLevel: 'HIGH',
        responsiblePerson: 'Bottleneck Analysis',
        description: 'En yogun hat ve work center icin yuksek risk darbogaz analizi.'
      }
    },
    {
      actorName: 'Bottleneck Analysis',
      status: 'ANALYZED',
      input: {
        reportDate: today,
        startDate: today,
        endDate: today,
        productionLineId: busiestMachine?.productionLineId || ALL_FILTER,
        machineId: busiestMachine?.machineId || ALL_FILTER,
        employeeId: ALL_FILTER,
        workCenterId: busiestMachine?.workCenterId || ALL_FILTER,
        riskLevel: ALL_FILTER,
        responsiblePerson: 'Bottleneck Analysis',
        description: 'Makine doluluk, bekleme, setup ve temizlik etkisi analizi.'
      }
    },
    {
      actorName: 'Operasyon',
      status: 'REVISED',
      input: {
        reportDate: today,
        startDate: today,
        endDate: addDays(today, 6),
        productionLineId: ALL_FILTER,
        machineId: ALL_FILTER,
        employeeId: busiestEmployee?.employeeId || ALL_FILTER,
        workCenterId: ALL_FILTER,
        riskLevel: ALL_FILTER,
        responsiblePerson: 'Operasyon',
        description: 'Haftalik personel ve vardiya kaynakli darbogaz analizi.'
      }
    }
  ]

  return seedInputs.map((row, index) => createReportFromInput({
    actorName: row.actorName,
    capacityPlans,
    input: row.input,
    machineSchedules,
    reportId: `bottleneck_report_${index + 1}_${row.input.riskLevel}_${today.replace(/-/g, '')}`,
    reportNo: getNextBottleneckReportNo([], today, index),
    sourceData,
    sourceType: 'ReadModel',
    status: row.status,
    workforcePlans
  }))
}

const normalizeReason = (
  value: unknown,
  itemId: string,
  index: number
): BottleneckReason => {
  const reason = isRecord(value) ? value : {}
  return {
    id: normalizeText(reason.id) || `${itemId}_reason_${index + 1}`,
    itemId,
    type: mapType(reason.type),
    label: normalizeText(reason.label) || 'Neden',
    value: normalizeNumber(reason.value),
    unit: normalizeText(reason.unit),
    impactPercent: normalizeNumber(reason.impactPercent),
    description: normalizeText(reason.description)
  }
}

const normalizeConstraint = (
  value: unknown,
  itemId: string,
  index: number
): ProductionConstraint => {
  const constraint = isRecord(value) ? value : {}
  return {
    id: normalizeText(constraint.id) || `${itemId}_constraint_${index + 1}`,
    itemId,
    entityType: mapType(constraint.entityType),
    entityId: normalizeText(constraint.entityId),
    entityName: normalizeText(constraint.entityName) || 'Varlik',
    constraintType: normalizeText(constraint.constraintType) || 'Constraint',
    riskLevel: mapRisk(constraint.riskLevel),
    utilizationPercent: normalizeNumber(constraint.utilizationPercent),
    waitingMinutes: normalizeNumber(constraint.waitingMinutes),
    setupMinutes: normalizeNumber(constraint.setupMinutes),
    cleaningMinutes: normalizeNumber(constraint.cleaningMinutes),
    workingMinutes: normalizeNumber(constraint.workingMinutes),
    idleMinutes: normalizeNumber(constraint.idleMinutes),
    sourceNo: normalizeText(constraint.sourceNo)
  }
}

const normalizeItem = (
  value: unknown,
  reportId: string,
  reportNo: string,
  index: number
): BottleneckItem => {
  const item = isRecord(value) ? value : {}
  const id = normalizeText(item.id) || `${reportId}_item_${index + 1}`
  const bottleneckType = mapType(item.bottleneckType)
  return {
    id,
    reportId,
    reportNo,
    bottleneckType,
    entityId: normalizeText(item.entityId),
    entityCode: normalizeText(item.entityCode),
    entityName: normalizeText(item.entityName) || 'Varlik',
    productionLineId: normalizeText(item.productionLineId),
    productionLineName: normalizeText(item.productionLineName),
    machineId: normalizeText(item.machineId),
    machineCode: normalizeText(item.machineCode),
    machineName: normalizeText(item.machineName),
    employeeId: normalizeText(item.employeeId),
    employeeName: normalizeText(item.employeeName),
    workCenterId: normalizeText(item.workCenterId),
    workCenterName: normalizeText(item.workCenterName),
    shiftName: normalizeText(item.shiftName),
    utilizationPercent: normalizeNumber(item.utilizationPercent),
    waitingMinutes: normalizeNumber(item.waitingMinutes),
    setupMinutes: normalizeNumber(item.setupMinutes),
    cleaningMinutes: normalizeNumber(item.cleaningMinutes),
    workingMinutes: normalizeNumber(item.workingMinutes),
    idleMinutes: normalizeNumber(item.idleMinutes),
    overloadMinutes: normalizeNumber(item.overloadMinutes),
    maintenanceMinutes: normalizeNumber(item.maintenanceMinutes),
    missingPersonnel: normalizeNumber(item.missingPersonnel),
    riskScore: normalizeNumber(item.riskScore),
    riskLevel: mapRisk(item.riskLevel),
    critical: item.critical === true,
    reasons: Array.isArray(item.reasons) ? item.reasons.map((reason, reasonIndex) => normalizeReason(reason, id, reasonIndex)) : [],
    constraints: Array.isArray(item.constraints) ? item.constraints.map((constraint, constraintIndex) => normalizeConstraint(constraint, id, constraintIndex)) : [],
    recommendation: normalizeText(item.recommendation),
    sourceType: item.sourceType === 'MachineScheduling'
      ? 'MachineScheduling'
      : item.sourceType === 'WorkforcePlanning'
        ? 'WorkforcePlanning'
        : item.sourceType === 'Inventory'
          ? 'Inventory'
          : item.sourceType === 'CapacityPlanning'
            ? 'CapacityPlanning'
            : 'ReadModel',
    sourceId: normalizeText(item.sourceId),
    sourceNo: normalizeText(item.sourceNo),
    detectedAt: normalizeText(item.detectedAt) || new Date().toISOString()
  }
}

const normalizeHistory = (
  value: unknown,
  reportId: string,
  actorName: string
): BottleneckHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${reportId}_history_${index + 1}`,
    reportId,
    action: normalizeText(history.action).toUpperCase() as BottleneckHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Bottleneck report guncellendi.',
    revisionNo: normalizeNumber(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeReport = (
  record: RawBottleneckReport,
  sourceData: KpiSourceData,
  index: number
): BottleneckReport => {
  const id = normalizeText(record.id) || `bottleneck_report_${index + 1}`
  const reportNo = normalizeText(record.reportNo) || getNextBottleneckReportNo([], normalizeText(record.reportDate) || getTodayKey(), index)
  const createdAt = normalizeText(record.createdAt) || new Date().toISOString()
  const actorName = normalizeText(record.createdBy) || normalizeText(record.responsiblePerson) || 'Bottleneck Analysis'
  const productionLineId = normalizeText(record.productionLineId) || ALL_FILTER
  const workCenterId = normalizeText(record.workCenterId) || ALL_FILTER
  const items = Array.isArray(record.items) ? record.items.map((item, itemIndex) => normalizeItem(item, id, reportNo, itemIndex)) : []
  const machineLabel = getMachineLabel(normalizeText(record.machineId) || ALL_FILTER, items)
  const constraints = Array.isArray(record.constraints) ? record.constraints.map((constraint, constraintIndex) => normalizeConstraint(constraint, id, constraintIndex)) : items.flatMap(item => item.constraints)
  const reasons = Array.isArray(record.reasons) ? record.reasons.map((reason, reasonIndex) => normalizeReason(reason, id, reasonIndex)) : items.flatMap(item => item.reasons)
  const report: BottleneckReport = {
    id,
    reportNo,
    status: mapStatus(record.status),
    reportDate: normalizeText(record.reportDate) || getTodayKey(),
    startDate: normalizeText(record.startDate) || normalizeText(record.reportDate) || getTodayKey(),
    endDate: normalizeText(record.endDate) || normalizeText(record.reportDate) || getTodayKey(),
    productionLineId,
    productionLineName: normalizeText(record.productionLineName) || getLineLabel(productionLineId, sourceData),
    machineId: normalizeText(record.machineId) || ALL_FILTER,
    machineCode: normalizeText(record.machineCode) || machineLabel.machineCode,
    machineName: normalizeText(record.machineName) || machineLabel.machineName,
    employeeId: normalizeText(record.employeeId) || ALL_FILTER,
    employeeName: normalizeText(record.employeeName) || getEmployeeLabel(normalizeText(record.employeeId) || ALL_FILTER),
    workCenterId,
    workCenterName: normalizeText(record.workCenterName) || getWorkCenterLabel(workCenterId, sourceData),
    riskLevel: record.riskLevel === ALL_FILTER ? ALL_FILTER : mapRisk(record.riskLevel),
    responsiblePerson: normalizeText(record.responsiblePerson) || actorName,
    description: normalizeText(record.description),
    items,
    constraints,
    reasons,
    recommendations: Array.isArray(record.recommendations) ? record.recommendations.map(normalizeText).filter(Boolean) : [],
    history: normalizeHistory(record.history, id, actorName),
    sourceCapacityPlanIds: Array.isArray(record.sourceCapacityPlanIds) ? record.sourceCapacityPlanIds.map(normalizeText).filter(Boolean) : [],
    sourceMachineScheduleIds: Array.isArray(record.sourceMachineScheduleIds) ? record.sourceMachineScheduleIds.map(normalizeText).filter(Boolean) : [],
    sourceWorkforcePlanIds: Array.isArray(record.sourceWorkforcePlanIds) ? record.sourceWorkforcePlanIds.map(normalizeText).filter(Boolean) : [],
    sourceProductionPlanIds: Array.isArray(record.sourceProductionPlanIds) ? record.sourceProductionPlanIds.map(normalizeText).filter(Boolean) : [],
    sourceType: record.sourceType === 'ManualReadModel' ? 'ManualReadModel' : 'ReadModel',
    sourceId: normalizeText(record.sourceId),
    revisionNo: normalizeNumber(record.revisionNo) || 1,
    createdBy: actorName,
    createdAt,
    updatedAt: normalizeText(record.updatedAt) || createdAt
  }

  return {
    ...report,
    history: report.history.length > 0
      ? report.history
      : [createBottleneckHistory(report.id, 'CREATED', actorName, `${report.reportNo} bottleneck analysis read-model raporu olusturuldu.`)]
  }
}

export const saveBottleneckReports = (records: BottleneckReport[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(BOTTLENECK_ANALYSIS_STORAGE_KEY, JSON.stringify(records))
}

export const loadBottleneckReports = (
  sourceData: KpiSourceData,
  dependencies: BottleneckReadModelDependencies = {}
) => {
  const seedRecords = resolveReadModelList(() => createBottleneckAnalysisReadModelRecords(sourceData, dependencies))
  if(!isBrowserStorageAvailable()) return seedRecords

  const stored = localStorage.getItem(BOTTLENECK_ANALYSIS_STORAGE_KEY)
  if(stored === null){
    saveBottleneckReports(seedRecords)
    return seedRecords
  }

  try {
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)){
      const storedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeReport(record as RawBottleneckReport, sourceData, index))
      const storedIds = new Set(storedRecords.map(record => record.id))
      return [
        ...storedRecords,
        ...seedRecords.filter(record => !storedIds.has(record.id))
      ].sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))
    }
  } catch {
    // Corrupt local read-model cache is replaced with deterministic seed records.
  }

  saveBottleneckReports(seedRecords)
  return seedRecords
}

export const filterBottleneckReports = (
  records: BottleneckReport[],
  filters: BottleneckAnalysisFilters
) => {
  const search = normalizeSearchText(filters.search)

  return records.filter(report => {
    const matchesSearch = !search || [
      report.reportNo,
      report.productionLineName,
      report.machineCode,
      report.machineName,
      report.employeeName,
      report.workCenterName,
      ...report.items.map(item => `${item.entityName} ${item.machineCode} ${item.productionLineName} ${item.employeeName}`)
    ].some(value => normalizeSearchText(value).includes(search))

    return matchesSearch
      && (filters.productionLineId === ALL_FILTER || report.productionLineId === filters.productionLineId || report.items.some(item => item.productionLineId === filters.productionLineId))
      && (filters.machineId === ALL_FILTER || report.machineId === filters.machineId || report.items.some(item => item.machineId === filters.machineId))
      && (filters.employeeId === ALL_FILTER || report.employeeId === filters.employeeId || report.items.some(item => item.employeeId === filters.employeeId))
      && (filters.workCenterId === ALL_FILTER || report.workCenterId === filters.workCenterId || report.items.some(item => item.workCenterId === filters.workCenterId))
      && (filters.riskLevel === ALL_FILTER || report.riskLevel === filters.riskLevel || report.items.some(item => item.riskLevel === filters.riskLevel))
      && (!filters.date || report.reportDate === filters.date)
  })
}

const upsertReport = (
  records: BottleneckReport[],
  nextReport: BottleneckReport
) => records.some(record => record.id === nextReport.id)
  ? records.map(record => record.id === nextReport.id ? nextReport : record)
  : [nextReport, ...records]

export const addBottleneckReport = (
  input: BottleneckReportCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const validation = validateBottleneckReportCreateInput(input)
  if(!validation.valid) throw new Error(validation.errors.join(' '))

  const records = loadBottleneckReports(sourceData)
  const report = createReportFromInput({
    actorName,
    input,
    reportId: createId('bottleneck_report'),
    reportNo: getNextBottleneckReportNo(records, input.reportDate),
    sourceData,
    sourceType: 'ManualReadModel',
    status: 'DRAFT'
  })

  saveBottleneckReports(upsertReport(records, report))
  return report
}

export const updateBottleneckReportStatus = (
  reportId: string,
  status: BottleneckReportStatus,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadBottleneckReports(sourceData)
  const report = records.find(record => record.id === reportId)
  if(!report) throw new Error('Bottleneck report bulunamadi.')
  if(report.status === 'CANCELLED') throw new Error('Iptal edilen rapor tekrar duzenlenemez.')

  const actionByStatus: Record<BottleneckReportStatus, BottleneckHistoryAction> = {
    DRAFT: 'UPDATED',
    ANALYZED: 'ANALYZED',
    READY: 'READY',
    REVISED: 'REVISED',
    CANCELLED: 'CANCELLED'
  }
  const nextReport = appendBottleneckHistory(
    {
      ...report,
      status
    },
    actionByStatus[status],
    actorName,
    `${report.reportNo} ${BOTTLENECK_REPORT_STATUS_LABELS[status]} durumuna alindi.`
  )
  saveBottleneckReports(upsertReport(records, nextReport))
  return nextReport
}

export const recordBottleneckReportOutput = (
  reportId: string,
  action: Extract<BottleneckHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadBottleneckReports(sourceData)
  const report = records.find(record => record.id === reportId)
  if(!report) throw new Error('Bottleneck report bulunamadi.')
  const nextReport = appendBottleneckHistory(
    report,
    action,
    actorName,
    action === 'EXCEL' ? `${report.reportNo} Excel export edildi.` : `${report.reportNo} cikti penceresi acildi.`
  )
  saveBottleneckReports(upsertReport(records, nextReport))
  return nextReport
}

export const BottleneckAnalysisService = {
  createDefaultFilters: createDefaultBottleneckAnalysisFilters,
  getNextNo: getNextBottleneckReportNo,
  createReadModelRecords: createBottleneckAnalysisReadModelRecords,
  save: saveBottleneckReports,
  list: loadBottleneckReports,
  filter: filterBottleneckReports,
  add: addBottleneckReport,
  updateStatus: updateBottleneckReportStatus,
  recordOutput: recordBottleneckReportOutput,
  statistics: createBottleneckStatistics,
  validate: validateBottleneckReport,
  validateCreateInput: validateBottleneckReportCreateInput,
  calculation: BottleneckCalculationService,
  capacityPlanning: CapacityPlanningService,
  machineScheduling: MachineSchedulingService,
  workforcePlanning: WorkforcePlanningService
}
