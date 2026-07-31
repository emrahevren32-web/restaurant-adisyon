import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import {
  ALL_FILTER,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { MachineSchedulingService } from '../machine-scheduling/machine-scheduling.service'
import { resolveReadModelList } from '../read-model/read-model-safety'
import { loadEmployees } from '../storage'
import { WorkforcePlanningService } from '../workforce-planning/workforce-planning.service'
import { BottleneckAnalysisService } from '../bottleneck-analysis/bottleneck-analysis.service'
import {
  IMPROVEMENT_AREAS,
  IMPROVEMENT_AREA_LABELS,
  IMPROVEMENT_PRIORITIES,
  IMPROVEMENT_PRIORITY_LABELS,
  IMPROVEMENT_REPORT_STATUSES,
  IMPROVEMENT_REPORT_STATUS_LABELS,
  IMPROVEMENT_RISK_LABELS,
  IMPROVEMENT_RISK_LEVELS
} from './continuous-improvement.constants'
import { calculateImprovementOpportunities, ImprovementCalculationService } from './improvement-calculation.service'
import { appendImprovementHistory, createImprovementHistory } from './improvement-history.service'
import { createImprovementStatistics } from './improvement-statistics.service'
import {
  validateImprovementReport,
  validateImprovementReportCreateInput
} from './improvement-validation.service'
import type {
  ContinuousImprovementFilters,
  ImprovementArea,
  ImprovementHistory,
  ImprovementHistoryAction,
  ImprovementOpportunity,
  ImprovementPriority,
  ImprovementRecommendation,
  ImprovementReport,
  ImprovementReportCreateInput,
  ImprovementReportStatus,
  ImprovementRiskLevel
} from './continuous-improvement.types'

export {
  IMPROVEMENT_AREAS,
  IMPROVEMENT_AREA_LABELS,
  IMPROVEMENT_PRIORITIES,
  IMPROVEMENT_PRIORITY_LABELS,
  IMPROVEMENT_REPORT_STATUSES,
  IMPROVEMENT_REPORT_STATUS_LABELS,
  IMPROVEMENT_RISK_LABELS,
  IMPROVEMENT_RISK_LEVELS
} from './continuous-improvement.constants'

export const CONTINUOUS_IMPROVEMENT_STORAGE_KEY = 'ra_continuous_improvement_records'

type RawImprovementReport = Partial<Record<keyof ImprovementReport, unknown>> & Record<string, unknown>
type ImprovementReadModelDependencies = {
  bottleneckReports?: ReturnType<typeof BottleneckAnalysisService.list>
  capacityPlans?: ReturnType<typeof CapacityPlanningService.list>
  machineSchedules?: ReturnType<typeof MachineSchedulingService.list>
  workforcePlans?: ReturnType<typeof WorkforcePlanningService.list>
}

const REPORT_NO_PREFIX = 'CI'
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

const getNextImprovementReportNo = (
  records: Pick<ImprovementReport, 'reportNo'>[],
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

export const createDefaultContinuousImprovementFilters = (): ContinuousImprovementFilters => ({
  area: ALL_FILTER,
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  employeeId: ALL_FILTER,
  priority: ALL_FILTER,
  riskLevel: ALL_FILTER,
  date: '',
  search: ''
})

const mapStatus = (value: unknown): ImprovementReportStatus => {
  const normalized = normalizeText(value).toUpperCase() as ImprovementReportStatus
  return IMPROVEMENT_REPORT_STATUSES.includes(normalized) ? normalized : 'DRAFT'
}

const mapArea = (value: unknown): ImprovementArea => {
  const normalized = normalizeText(value).toUpperCase() as ImprovementArea
  return IMPROVEMENT_AREAS.includes(normalized) ? normalized : 'MACHINE'
}

const mapRisk = (value: unknown): ImprovementRiskLevel => {
  const normalized = normalizeText(value).toUpperCase() as ImprovementRiskLevel
  return IMPROVEMENT_RISK_LEVELS.includes(normalized) ? normalized : 'LOW'
}

const mapPriority = (value: unknown): ImprovementPriority => {
  const normalized = normalizeText(value).toUpperCase() as ImprovementPriority
  return IMPROVEMENT_PRIORITIES.includes(normalized) ? normalized : 'NORMAL'
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
  opportunities: ImprovementOpportunity[]
) => {
  if(machineId === ALL_FILTER) return { machineCode: '', machineName: 'Tum Makineler' }
  const opportunity = opportunities.find(record => record.machineId === machineId)
  return {
    machineCode: opportunity?.machineCode || machineId,
    machineName: opportunity?.machineName || machineId
  }
}

const getEmployeeLabel = (
  employeeId: string
) => {
  if(employeeId === ALL_FILTER) return 'Tum Personel'
  return loadEmployees().find(employee => employee.id === employeeId)?.fullName || employeeId
}

const createReportFromInput = ({
  actorName,
  bottleneckReports,
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
  bottleneckReports?: ReturnType<typeof BottleneckAnalysisService.list>
  capacityPlans?: ReturnType<typeof CapacityPlanningService.list>
  input: ImprovementReportCreateInput
  machineSchedules?: ReturnType<typeof MachineSchedulingService.list>
  reportId: string
  reportNo: string
  sourceData: KpiSourceData
  sourceType: ImprovementReport['sourceType']
  status: ImprovementReportStatus
  workforcePlans?: ReturnType<typeof WorkforcePlanningService.list>
}) => {
  const calculation = calculateImprovementOpportunities({
    reportId,
    reportNo,
    sourceData,
    startDate: input.startDate,
    endDate: input.endDate,
    area: input.area,
    productionLineId: input.productionLineId,
    machineId: input.machineId,
    employeeId: input.employeeId,
    bottleneckReports,
    capacityPlans,
    machineSchedules,
    workforcePlans
  })
  const machineLabel = getMachineLabel(input.machineId, calculation.opportunities)
  const createdAt = new Date().toISOString()

  return {
    id: reportId,
    reportNo,
    status,
    reportDate: input.reportDate,
    startDate: input.startDate,
    endDate: input.endDate,
    area: input.area,
    productionLineId: input.productionLineId,
    productionLineName: getLineLabel(input.productionLineId, sourceData),
    machineId: input.machineId,
    machineCode: machineLabel.machineCode,
    machineName: machineLabel.machineName,
    employeeId: input.employeeId,
    employeeName: getEmployeeLabel(input.employeeId),
    responsiblePerson: actorName || input.responsiblePerson,
    description: input.description,
    opportunities: calculation.opportunities,
    recommendations: calculation.recommendations,
    history: [
      createImprovementHistory(reportId, 'CREATED', actorName, `${reportNo} continuous improvement read-model raporu olusturuldu.`)
    ],
    sourceBottleneckReportIds: calculation.sourceBottleneckReportIds,
    sourceCapacityPlanIds: calculation.sourceCapacityPlanIds,
    sourceMachineScheduleIds: calculation.sourceMachineScheduleIds,
    sourceWorkforcePlanIds: calculation.sourceWorkforcePlanIds,
    sourceProductionPlanIds: calculation.sourceProductionPlanIds,
    sourceType,
    sourceId: `${input.area}:${input.productionLineId}:${input.machineId}:${input.employeeId}:${input.reportDate}`,
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  } satisfies ImprovementReport
}

export const createContinuousImprovementReadModelRecords = (
  sourceData: KpiSourceData,
  dependencies: ImprovementReadModelDependencies = {}
): ImprovementReport[] => {
  const today = getTodayKey()
  const capacityPlans = dependencies.capacityPlans || CapacityPlanningService.list(sourceData)
  const machineSchedules = dependencies.machineSchedules || MachineSchedulingService.list(sourceData)
  const workforcePlans = dependencies.workforcePlans || WorkforcePlanningService.list(sourceData, { machineSchedules })
  const bottleneckReports = dependencies.bottleneckReports || BottleneckAnalysisService.list(sourceData, {
    capacityPlans,
    machineSchedules,
    workforcePlans
  })
  const topBottleneck = [...bottleneckReports.flatMap(report => report.items)]
    .sort((first, second) => second.riskScore - first.riskScore)[0]
  const idleMachine = [...machineSchedules.flatMap(schedule => schedule.timelines)]
    .sort((first, second) => second.idleMinutes - first.idleMinutes)[0]
  const workforceGap = [...workforcePlans.flatMap(plan => plan.shiftAssignments)]
    .sort((first, second) => second.missingEmployeeCount - first.missingEmployeeCount || second.utilizationPercent - first.utilizationPercent)[0]
  const highCapacityLine = [...capacityPlans.flatMap(plan => plan.productionCapacities)]
    .sort((first, second) => second.utilizationPercent - first.utilizationPercent)[0]
  const seedInputs: Array<{ input: ImprovementReportCreateInput; status: ImprovementReportStatus; actorName: string }> = [
    {
      actorName: 'Continuous Improvement',
      status: 'ANALYZED',
      input: {
        reportDate: today,
        startDate: today,
        endDate: today,
        area: ALL_FILTER,
        productionLineId: ALL_FILTER,
        machineId: ALL_FILTER,
        employeeId: ALL_FILTER,
        responsiblePerson: 'Continuous Improvement',
        description: 'Gunluk planning, scheduling, workforce ve bottleneck ciktilarindan iyilestirme firsatlari.'
      }
    },
    {
      actorName: 'Continuous Improvement',
      status: 'READY',
      input: {
        reportDate: today,
        startDate: today,
        endDate: today,
        area: 'SETUP',
        productionLineId: topBottleneck?.productionLineId || highCapacityLine?.productionLineId || ALL_FILTER,
        machineId: topBottleneck?.machineId || ALL_FILTER,
        employeeId: ALL_FILTER,
        responsiblePerson: 'Continuous Improvement',
        description: 'Setup, temizlik ve makine bekleme etkisi icin oncelikli firsat analizi.'
      }
    },
    {
      actorName: 'Operasyon',
      status: 'ANALYZED',
      input: {
        reportDate: today,
        startDate: today,
        endDate: addDays(today, 6),
        area: 'PERSONNEL',
        productionLineId: ALL_FILTER,
        machineId: ALL_FILTER,
        employeeId: ALL_FILTER,
        responsiblePerson: 'Operasyon',
        description: `Vardiya dagilimi ve personel kullanim firsatlari ${workforceGap?.shiftName || 'Tum Vardiyalar'} icin analiz edildi.`
      }
    },
    {
      actorName: 'Enerji',
      status: 'REVISED',
      input: {
        reportDate: today,
        startDate: today,
        endDate: today,
        area: 'ENERGY',
        productionLineId: idleMachine?.productionLineId || ALL_FILTER,
        machineId: idleMachine?.machineId || ALL_FILTER,
        employeeId: ALL_FILTER,
        responsiblePerson: 'Enerji',
        description: 'Bos sure ve enerji kaybi kaynakli iyilestirme firsatlari.'
      }
    }
  ]

  return seedInputs.map((row, index) => createReportFromInput({
    actorName: row.actorName,
    bottleneckReports,
    capacityPlans,
    input: row.input,
    machineSchedules,
    reportId: `improvement_report_${index + 1}_${row.input.area}_${today.replace(/-/g, '')}`,
    reportNo: getNextImprovementReportNo([], today, index),
    sourceData,
    sourceType: 'ReadModel',
    status: row.status,
    workforcePlans
  }))
}

const normalizeOpportunity = (
  value: unknown,
  reportId: string,
  reportNo: string,
  index: number
): ImprovementOpportunity => {
  const opportunity = isRecord(value) ? value : {}
  const area = mapArea(opportunity.area)
  const id = normalizeText(opportunity.id) || `${reportId}_opportunity_${index + 1}`
  return {
    id,
    reportId,
    reportNo,
    area,
    entityId: normalizeText(opportunity.entityId),
    entityCode: normalizeText(opportunity.entityCode),
    entityName: normalizeText(opportunity.entityName) || 'Varlik',
    productionLineId: normalizeText(opportunity.productionLineId),
    productionLineName: normalizeText(opportunity.productionLineName),
    machineId: normalizeText(opportunity.machineId),
    machineCode: normalizeText(opportunity.machineCode),
    machineName: normalizeText(opportunity.machineName),
    employeeId: normalizeText(opportunity.employeeId),
    employeeName: normalizeText(opportunity.employeeName),
    department: normalizeText(opportunity.department),
    shiftName: normalizeText(opportunity.shiftName),
    waitingMinutes: normalizeNumber(opportunity.waitingMinutes),
    idleMinutes: normalizeNumber(opportunity.idleMinutes),
    utilizationPercent: normalizeNumber(opportunity.utilizationPercent),
    setupMinutes: normalizeNumber(opportunity.setupMinutes),
    cleaningMinutes: normalizeNumber(opportunity.cleaningMinutes),
    maintenanceMinutes: normalizeNumber(opportunity.maintenanceMinutes),
    capacityUtilizationPercent: normalizeNumber(opportunity.capacityUtilizationPercent),
    personnelUtilizationPercent: normalizeNumber(opportunity.personnelUtilizationPercent),
    expectedGainMinutes: normalizeNumber(opportunity.expectedGainMinutes),
    expectedGainPercent: normalizeNumber(opportunity.expectedGainPercent),
    expectedBenefitScore: normalizeNumber(opportunity.expectedBenefitScore),
    riskLevel: mapRisk(opportunity.riskLevel),
    priority: mapPriority(opportunity.priority),
    summary: normalizeText(opportunity.summary),
    sourceType: opportunity.sourceType === 'BottleneckAnalysis'
      ? 'BottleneckAnalysis'
      : opportunity.sourceType === 'MachineScheduling'
        ? 'MachineScheduling'
        : opportunity.sourceType === 'WorkforcePlanning'
          ? 'WorkforcePlanning'
          : opportunity.sourceType === 'Inventory'
            ? 'Inventory'
            : opportunity.sourceType === 'CapacityPlanning'
              ? 'CapacityPlanning'
              : 'ReadModel',
    sourceId: normalizeText(opportunity.sourceId),
    sourceNo: normalizeText(opportunity.sourceNo),
    detectedAt: normalizeText(opportunity.detectedAt) || new Date().toISOString()
  }
}

const normalizeRecommendation = (
  value: unknown,
  opportunityId: string,
  index: number
): ImprovementRecommendation => {
  const recommendation = isRecord(value) ? value : {}
  return {
    id: normalizeText(recommendation.id) || `${opportunityId}_recommendation_${index + 1}`,
    opportunityId: normalizeText(recommendation.opportunityId) || opportunityId,
    area: mapArea(recommendation.area),
    title: normalizeText(recommendation.title) || 'Iyilestirme onerisi',
    description: normalizeText(recommendation.description),
    action: normalizeText(recommendation.action) || 'Manuel iyilestirme analizi yap.',
    expectedImpact: normalizeText(recommendation.expectedImpact),
    ownerRole: normalizeText(recommendation.ownerRole) || 'Operasyon',
    priority: mapPriority(recommendation.priority)
  }
}

const normalizeHistory = (
  value: unknown,
  reportId: string,
  actorName: string
): ImprovementHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${reportId}_history_${index + 1}`,
    reportId,
    action: normalizeText(history.action).toUpperCase() as ImprovementHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Continuous improvement report guncellendi.',
    revisionNo: normalizeNumber(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeReport = (
  record: RawImprovementReport,
  sourceData: KpiSourceData,
  index: number
): ImprovementReport => {
  const id = normalizeText(record.id) || `improvement_report_${index + 1}`
  const reportNo = normalizeText(record.reportNo) || getNextImprovementReportNo([], normalizeText(record.reportDate) || getTodayKey(), index)
  const createdAt = normalizeText(record.createdAt) || new Date().toISOString()
  const actorName = normalizeText(record.createdBy) || normalizeText(record.responsiblePerson) || 'Continuous Improvement'
  const productionLineId = normalizeText(record.productionLineId) || ALL_FILTER
  const opportunities = Array.isArray(record.opportunities)
    ? record.opportunities.map((opportunity, opportunityIndex) => normalizeOpportunity(opportunity, id, reportNo, opportunityIndex))
    : []
  const recommendations = Array.isArray(record.recommendations)
    ? record.recommendations.map((recommendation, recommendationIndex) => normalizeRecommendation(recommendation, opportunities[recommendationIndex]?.id || id, recommendationIndex))
    : opportunities.map(opportunity => normalizeRecommendation({}, opportunity.id, 0))
  const machineLabel = getMachineLabel(normalizeText(record.machineId) || ALL_FILTER, opportunities)
  const report: ImprovementReport = {
    id,
    reportNo,
    status: mapStatus(record.status),
    reportDate: normalizeText(record.reportDate) || getTodayKey(),
    startDate: normalizeText(record.startDate) || normalizeText(record.reportDate) || getTodayKey(),
    endDate: normalizeText(record.endDate) || normalizeText(record.reportDate) || getTodayKey(),
    area: record.area === ALL_FILTER ? ALL_FILTER : mapArea(record.area),
    productionLineId,
    productionLineName: normalizeText(record.productionLineName) || getLineLabel(productionLineId, sourceData),
    machineId: normalizeText(record.machineId) || ALL_FILTER,
    machineCode: normalizeText(record.machineCode) || machineLabel.machineCode,
    machineName: normalizeText(record.machineName) || machineLabel.machineName,
    employeeId: normalizeText(record.employeeId) || ALL_FILTER,
    employeeName: normalizeText(record.employeeName) || getEmployeeLabel(normalizeText(record.employeeId) || ALL_FILTER),
    responsiblePerson: normalizeText(record.responsiblePerson) || actorName,
    description: normalizeText(record.description),
    opportunities,
    recommendations,
    history: normalizeHistory(record.history, id, actorName),
    sourceBottleneckReportIds: Array.isArray(record.sourceBottleneckReportIds) ? record.sourceBottleneckReportIds.map(normalizeText).filter(Boolean) : [],
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
      : [createImprovementHistory(report.id, 'CREATED', actorName, `${report.reportNo} continuous improvement read-model raporu olusturuldu.`)]
  }
}

export const saveImprovementReports = (records: ImprovementReport[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(CONTINUOUS_IMPROVEMENT_STORAGE_KEY, JSON.stringify(records))
}

export const loadImprovementReports = (
  sourceData: KpiSourceData,
  dependencies: ImprovementReadModelDependencies = {}
) => {
  const seedRecords = resolveReadModelList(() => createContinuousImprovementReadModelRecords(sourceData, dependencies))
  if(!isBrowserStorageAvailable()) return seedRecords

  const stored = localStorage.getItem(CONTINUOUS_IMPROVEMENT_STORAGE_KEY)
  if(stored === null){
    saveImprovementReports(seedRecords)
    return seedRecords
  }

  try {
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)){
      const storedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeReport(record as RawImprovementReport, sourceData, index))
      const storedIds = new Set(storedRecords.map(record => record.id))
      return [
        ...storedRecords,
        ...seedRecords.filter(record => !storedIds.has(record.id))
      ].sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))
    }
  } catch {
    // Corrupt local read-model cache is replaced with deterministic seed records.
  }

  saveImprovementReports(seedRecords)
  return seedRecords
}

export const filterImprovementReports = (
  records: ImprovementReport[],
  filters: ContinuousImprovementFilters
) => {
  const search = normalizeSearchText(filters.search)

  return records.filter(report => {
    const matchesSearch = !search || [
      report.reportNo,
      report.productionLineName,
      report.machineCode,
      report.machineName,
      report.employeeName,
      report.description,
      ...report.opportunities.map(opportunity => `${opportunity.entityName} ${opportunity.machineCode} ${opportunity.productionLineName} ${opportunity.employeeName} ${opportunity.summary}`)
    ].some(value => normalizeSearchText(value).includes(search))

    return matchesSearch
      && (filters.area === ALL_FILTER || report.area === filters.area || report.opportunities.some(opportunity => opportunity.area === filters.area))
      && (filters.productionLineId === ALL_FILTER || report.productionLineId === filters.productionLineId || report.opportunities.some(opportunity => opportunity.productionLineId === filters.productionLineId))
      && (filters.machineId === ALL_FILTER || report.machineId === filters.machineId || report.opportunities.some(opportunity => opportunity.machineId === filters.machineId))
      && (filters.employeeId === ALL_FILTER || report.employeeId === filters.employeeId || report.opportunities.some(opportunity => opportunity.employeeId === filters.employeeId))
      && (filters.priority === ALL_FILTER || report.opportunities.some(opportunity => opportunity.priority === filters.priority))
      && (filters.riskLevel === ALL_FILTER || report.opportunities.some(opportunity => opportunity.riskLevel === filters.riskLevel))
      && (!filters.date || report.reportDate === filters.date)
  })
}

const upsertReport = (
  records: ImprovementReport[],
  nextReport: ImprovementReport
) => records.some(record => record.id === nextReport.id)
  ? records.map(record => record.id === nextReport.id ? nextReport : record)
  : [nextReport, ...records]

export const addImprovementReport = (
  input: ImprovementReportCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const validation = validateImprovementReportCreateInput(input)
  if(!validation.valid) throw new Error(validation.errors.join(' '))

  const records = loadImprovementReports(sourceData)
  const report = createReportFromInput({
    actorName,
    input,
    reportId: createId('improvement_report'),
    reportNo: getNextImprovementReportNo(records, input.reportDate),
    sourceData,
    sourceType: 'ManualReadModel',
    status: 'DRAFT'
  })

  saveImprovementReports(upsertReport(records, report))
  return report
}

export const updateImprovementReportStatus = (
  reportId: string,
  status: ImprovementReportStatus,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadImprovementReports(sourceData)
  const report = records.find(record => record.id === reportId)
  if(!report) throw new Error('Improvement report bulunamadi.')
  if(report.status === 'CANCELLED') throw new Error('Iptal edilen rapor tekrar duzenlenemez.')

  const actionByStatus: Record<ImprovementReportStatus, ImprovementHistoryAction> = {
    DRAFT: 'UPDATED',
    ANALYZED: 'ANALYZED',
    READY: 'READY',
    REVISED: 'REVISED',
    CANCELLED: 'CANCELLED'
  }
  const nextReport = appendImprovementHistory(
    {
      ...report,
      status
    },
    actionByStatus[status],
    actorName,
    `${report.reportNo} ${IMPROVEMENT_REPORT_STATUS_LABELS[status]} durumuna alindi.`
  )
  saveImprovementReports(upsertReport(records, nextReport))
  return nextReport
}

export const recordImprovementReportOutput = (
  reportId: string,
  action: Extract<ImprovementHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadImprovementReports(sourceData)
  const report = records.find(record => record.id === reportId)
  if(!report) throw new Error('Improvement report bulunamadi.')
  const nextReport = appendImprovementHistory(
    report,
    action,
    actorName,
    action === 'EXCEL' ? `${report.reportNo} Excel export edildi.` : `${report.reportNo} cikti penceresi acildi.`
  )
  saveImprovementReports(upsertReport(records, nextReport))
  return nextReport
}

export const ContinuousImprovementService = {
  createDefaultFilters: createDefaultContinuousImprovementFilters,
  getNextNo: getNextImprovementReportNo,
  createReadModelRecords: createContinuousImprovementReadModelRecords,
  save: saveImprovementReports,
  list: loadImprovementReports,
  filter: filterImprovementReports,
  add: addImprovementReport,
  updateStatus: updateImprovementReportStatus,
  recordOutput: recordImprovementReportOutput,
  statistics: createImprovementStatistics,
  validate: validateImprovementReport,
  validateCreateInput: validateImprovementReportCreateInput,
  calculation: ImprovementCalculationService,
  bottleneckAnalysis: BottleneckAnalysisService,
  capacityPlanning: CapacityPlanningService,
  machineScheduling: MachineSchedulingService,
  workforcePlanning: WorkforcePlanningService
}
