import { createDecisionSuggestions } from '../decision-support/decision-support.service'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { resolveReadModel, resolveReadModelList } from '../read-model/read-model-safety'
import { calculateRecommendationReport, RecommendationCalculationService } from './recommendation-calculation.service'
import { appendRecommendationHistory, createRecommendationHistory } from './recommendation-history.service'
import { createRecommendationStatistics } from './recommendation-statistics.service'
import {
  RECOMMENDATION_PRIORITIES,
  RECOMMENDATION_PRIORITY_LABELS,
  RECOMMENDATION_RISKS,
  RECOMMENDATION_RISK_LABELS,
  RECOMMENDATION_STATUSES,
  RECOMMENDATION_STATUS_LABELS,
  RECOMMENDATION_TYPES,
  RECOMMENDATION_TYPE_LABELS
} from './recommendation-engine.constants'
import { listRecommendationRules, RecommendationRuleService } from './recommendation-rule.service'
import type {
  RecommendationFilters,
  RecommendationHistory,
  RecommendationHistoryAction,
  RecommendationItem,
  RecommendationPriority,
  RecommendationReport,
  RecommendationReportCreateInput,
  RecommendationRisk,
  RecommendationRule,
  RecommendationSourceModule,
  RecommendationStatus,
  RecommendationType
} from './recommendation-engine.types'

export {
  RECOMMENDATION_PRIORITIES,
  RECOMMENDATION_PRIORITY_LABELS,
  RECOMMENDATION_RISKS,
  RECOMMENDATION_RISK_LABELS,
  RECOMMENDATION_STATUSES,
  RECOMMENDATION_STATUS_LABELS,
  RECOMMENDATION_TYPES,
  RECOMMENDATION_TYPE_LABELS
} from './recommendation-engine.constants'

export const RECOMMENDATION_STORAGE_KEY = 'ra_recommendation_engine_records'

type RawRecommendationReport = Partial<Record<keyof RecommendationReport, unknown>> & Record<string, unknown>
type RawRecommendationItem = Partial<Record<keyof RecommendationItem, unknown>> & Record<string, unknown>
type RecommendationEvaluationDependencies = Partial<Parameters<typeof calculateRecommendationReport>[0]>
type RawRecommendationRule = Partial<Record<keyof RecommendationRule, unknown>> & Record<string, unknown>

const RECOMMENDATION_NO_PREFIX = 'RC'
const RECOMMENDATION_NO_PADDING = 6

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
  return Number.isFinite(parsed) ? roundKpi(parsed) : 0
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const getNextRecommendationNo = (
  records: Pick<RecommendationReport, 'reportNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${RECOMMENDATION_NO_PREFIX}-${year}-(\\d{${RECOMMENDATION_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.reportNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${RECOMMENDATION_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(RECOMMENDATION_NO_PADDING, '0')}`
}

export const createDefaultRecommendationFilters = (): RecommendationFilters => ({
  recommendationType: ALL_FILTER,
  priority: ALL_FILTER,
  risk: ALL_FILTER,
  branchId: ALL_FILTER,
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  employeeId: ALL_FILTER,
  date: '',
  search: ''
})

export const createDefaultRecommendationReportInput = (
  responsiblePerson = 'Recommendation Engine'
): RecommendationReportCreateInput => ({
  reportDate: getTodayKey(),
  scope: 'all',
  responsiblePerson,
  description: ''
})

const mapType = (value: unknown): RecommendationType => {
  const normalized = normalizeText(value).toUpperCase() as RecommendationType
  return RECOMMENDATION_TYPES.includes(normalized) ? normalized : 'PRODUCTION'
}

const mapStatus = (value: unknown): RecommendationStatus => {
  const normalized = normalizeText(value).toUpperCase() as RecommendationStatus
  return RECOMMENDATION_STATUSES.includes(normalized) ? normalized : 'GENERATED'
}

const mapPriority = (value: unknown): RecommendationPriority => {
  const normalized = normalizeText(value).toUpperCase() as RecommendationPriority
  return RECOMMENDATION_PRIORITIES.includes(normalized) ? normalized : 'NORMAL'
}

const mapRisk = (value: unknown): RecommendationRisk => {
  const normalized = normalizeText(value).toUpperCase() as RecommendationRisk
  return RECOMMENDATION_RISKS.includes(normalized) ? normalized : 'LOW'
}

const normalizeHistory = (
  value: unknown,
  reportId: string,
  actorName: string
): RecommendationHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${reportId}_history_${index + 1}`,
    reportId,
    action: normalizeText(history.action).toUpperCase() as RecommendationHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Recommendation raporu guncellendi.',
    revisionNo: normalizeNumber(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeRule = (
  value: RawRecommendationRule,
  index: number
): RecommendationRule => ({
  id: normalizeText(value.id) || `recommendation_rule_${index + 1}`,
  code: normalizeText(value.code) || `RC-RULE-${index + 1}`,
  type: mapType(value.type),
  title: normalizeText(value.title) || 'Recommendation Rule',
  description: normalizeText(value.description),
  sourceModule: normalizeText(value.sourceModule) as RecommendationSourceModule || 'ReadModel',
  baseRisk: mapRisk(value.baseRisk),
  priority: mapPriority(value.priority),
  thresholdLabel: normalizeText(value.thresholdLabel),
  enabled: value.enabled !== false
})

const normalizeItem = (
  value: RawRecommendationItem,
  reportId: string,
  reportNo: string,
  index: number
): RecommendationItem => ({
  id: normalizeText(value.id) || `${reportId}_recommendation_${index + 1}`,
  reportId,
  reportNo,
  ruleId: normalizeText(value.ruleId),
  recommendationType: mapType(value.recommendationType),
  priority: mapPriority(value.priority),
  risk: mapRisk(value.risk),
  title: normalizeText(value.title) || 'Otomatik oneri',
  description: normalizeText(value.description),
  reason: normalizeText(value.reason),
  action: normalizeText(value.action),
  expectedImpact: normalizeText(value.expectedImpact),
  ownerRole: normalizeText(value.ownerRole) || 'Operasyon',
  riskScore: Math.max(0, normalizeNumber(value.riskScore)),
  expectedBenefitScore: Math.max(0, normalizeNumber(value.expectedBenefitScore)),
  expectedCostImpact: Math.max(0, normalizeNumber(value.expectedCostImpact)),
  expectedCapacityGain: Math.max(0, normalizeNumber(value.expectedCapacityGain)),
  expectedTimeGainMinutes: Math.max(0, normalizeNumber(value.expectedTimeGainMinutes)),
  confidenceScore: Math.max(0, normalizeNumber(value.confidenceScore)),
  sourceModule: normalizeText(value.sourceModule) as RecommendationSourceModule || 'ReadModel',
  sourceId: normalizeText(value.sourceId),
  sourceNo: normalizeText(value.sourceNo),
  relatedModules: Array.isArray(value.relatedModules)
    ? value.relatedModules.map(module => normalizeText(module) as RecommendationSourceModule).filter(Boolean)
    : [],
  relatedEntityType: normalizeText(value.relatedEntityType),
  relatedEntityId: normalizeText(value.relatedEntityId),
  relatedEntityName: normalizeText(value.relatedEntityName) || 'Read Model',
  productId: normalizeText(value.productId),
  productName: normalizeText(value.productName),
  stockItemId: normalizeText(value.stockItemId),
  stockItemName: normalizeText(value.stockItemName),
  branchId: normalizeText(value.branchId),
  branchName: normalizeText(value.branchName),
  productionLineId: normalizeText(value.productionLineId),
  productionLineName: normalizeText(value.productionLineName),
  machineId: normalizeText(value.machineId),
  machineCode: normalizeText(value.machineCode),
  machineName: normalizeText(value.machineName),
  employeeId: normalizeText(value.employeeId),
  employeeName: normalizeText(value.employeeName),
  supplierId: normalizeText(value.supplierId),
  supplierName: normalizeText(value.supplierName),
  createdAt: normalizeText(value.createdAt) || new Date().toISOString()
})

const normalizeReport = (
  value: RawRecommendationReport,
  index: number
): RecommendationReport => {
  const reportDate = normalizeText(value.reportDate) || getTodayKey()
  const reportNo = normalizeText(value.reportNo) || getNextRecommendationNo([], reportDate, index)
  const id = normalizeText(value.id) || `recommendation_report_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = normalizeText(value.createdAt) || new Date().toISOString()
  const actorName = 'Recommendation Engine'
  const items = Array.isArray(value.items)
    ? value.items.filter(isRecord).map((item, itemIndex) => normalizeItem(item as RawRecommendationItem, id, reportNo, itemIndex))
    : []
  const rules = Array.isArray(value.rules)
    ? value.rules.filter(isRecord).map((rule, ruleIndex) => normalizeRule(rule as RawRecommendationRule, ruleIndex))
    : listRecommendationRules()
  const history = normalizeHistory(value.history, id, actorName)
  const scopeText = normalizeText(value.scope)

  return {
    id,
    reportNo,
    status: mapStatus(value.status),
    reportDate,
    scope: scopeText === ALL_FILTER || scopeText === '' ? 'all' : mapType(scopeText),
    responsiblePerson: normalizeText(value.responsiblePerson) || actorName,
    description: normalizeText(value.description),
    items,
    rules,
    history: history.length > 0
      ? history
      : [createRecommendationHistory(id, 'CREATED', actorName, `${reportNo} recommendation read-model olarak olusturuldu.`)],
    sourceType: normalizeText(value.sourceType) === 'ManualReadModel' ? 'ManualReadModel' : 'ReadModel',
    sourceId: normalizeText(value.sourceId) || 'recommendation-engine',
    revisionNo: normalizeNumber(value.revisionNo) || 1,
    createdBy: normalizeText(value.createdBy) || actorName,
    createdAt,
    updatedAt: normalizeText(value.updatedAt) || createdAt
  }
}

export const saveRecommendationReports = (reports: RecommendationReport[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(RECOMMENDATION_STORAGE_KEY, JSON.stringify(reports))
}

const createRecommendationFallbackReport = (
  input: RecommendationReportCreateInput,
  existingReports: RecommendationReport[],
  actorName: string
): RecommendationReport => {
  const reportNo = getNextRecommendationNo(existingReports, input.reportDate)
  const reportId = `recommendation_report_${reportNo}_fallback`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = new Date().toISOString()

  return {
    id: reportId,
    reportNo,
    status: 'GENERATED',
    reportDate: input.reportDate,
    scope: input.scope,
    responsiblePerson: input.responsiblePerson || actorName,
    description: input.description || 'Read-model kaynak hatasi nedeniyle bos recommendation raporu olusturuldu.',
    items: [],
    rules: resolveReadModelList(() => listRecommendationRules()),
    history: [
      createRecommendationHistory(reportId, 'CALCULATED', actorName, 'Read-model kaynak hatasi nedeniyle recommendation hesaplamasi bos fallback ile tamamlandi.')
    ],
    sourceType: 'ReadModel',
    sourceId: 'recommendation-runtime-fallback',
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  }
}

export const evaluateRecommendationReport = (
  sourceData: KpiSourceData,
  input: Partial<RecommendationReportCreateInput> = {},
  existingReports: RecommendationReport[] = [],
  actorName = 'Recommendation Engine',
  dependencies: RecommendationEvaluationDependencies = {}
) => {
  const createInput = {
    ...createDefaultRecommendationReportInput(actorName),
    ...input
  }
  const decisionSuggestions = resolveReadModelList(() => createDecisionSuggestions(sourceData, {
    skipSources: [
      'production-planning',
      'capacity-planning',
      'machine-scheduling',
      'workforce-planning',
      'bottleneck-analysis',
      'continuous-improvement',
      'critical-alerts',
      'forecasting',
      'recommendation-engine',
      'cost-optimization'
    ]
  }))
    .filter(suggestion => !suggestion.ruleId.startsWith('recommendation-engine-'))

  return resolveReadModel(() => calculateRecommendationReport({
    ...createInput,
    ...dependencies,
    sourceData,
    actorName,
    decisionSuggestions,
    getReportNo: () => getNextRecommendationNo(existingReports, createInput.reportDate)
  }), createRecommendationFallbackReport(createInput, existingReports, actorName))
}

export const loadRecommendationReports = (
  sourceData: KpiSourceData
) => {
  const defaultReport = evaluateRecommendationReport(sourceData)
  if(!isBrowserStorageAvailable()) return [defaultReport]

  const stored = localStorage.getItem(RECOMMENDATION_STORAGE_KEY)
  if(stored === null){
    saveRecommendationReports([defaultReport])
    return [defaultReport]
  }

  try {
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)){
      const reports = parsed
        .filter(isRecord)
        .map((record, index) => normalizeReport(record as RawRecommendationReport, index))
        .sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))
      return reports.length > 0 ? reports : [defaultReport]
    }
  } catch {
    // Corrupt local recommendation cache is replaced with a fresh read-model report.
  }

  saveRecommendationReports([defaultReport])
  return [defaultReport]
}

const upsertReport = (
  reports: RecommendationReport[],
  nextReport: RecommendationReport
) => reports.some(report => report.id === nextReport.id)
  ? reports.map(report => report.id === nextReport.id ? nextReport : report)
  : [nextReport, ...reports]

export const addRecommendationReport = (
  input: RecommendationReportCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadRecommendationReports(sourceData)
  const report = evaluateRecommendationReport(sourceData, input, reports, actorName)
  const nextReports = upsertReport(reports, report)
  saveRecommendationReports(nextReports)
  return report
}

export const filterRecommendationReports = (
  reports: RecommendationReport[],
  filters: RecommendationFilters
) => {
  const search = normalizeSearchText(filters.search)

  return reports.map(report => {
    const filteredItems = report.items.filter(item => {
      const matchesSearch = !search || [
        report.reportNo,
        item.title,
        item.description,
        item.reason,
        item.action,
        item.expectedImpact,
        item.relatedEntityName,
        item.productName,
        item.stockItemName,
        item.branchName,
        item.productionLineName,
        item.machineCode,
        item.machineName,
        item.employeeName,
        item.supplierName,
        item.sourceNo
      ].some(value => normalizeSearchText(value).includes(search))

      return matchesSearch
        && (filters.recommendationType === ALL_FILTER || item.recommendationType === filters.recommendationType)
        && (filters.priority === ALL_FILTER || item.priority === filters.priority)
        && (filters.risk === ALL_FILTER || item.risk === filters.risk)
        && (filters.branchId === ALL_FILTER || item.branchId === filters.branchId)
        && (filters.productionLineId === ALL_FILTER || item.productionLineId === filters.productionLineId)
        && (filters.machineId === ALL_FILTER || item.machineId === filters.machineId)
        && (filters.employeeId === ALL_FILTER || item.employeeId === filters.employeeId)
        && (!filters.date || report.reportDate === filters.date)
    })

    return {
      ...report,
      items: filteredItems
    }
  }).filter(report => report.items.length > 0)
}

export const updateRecommendationReportStatus = (
  reportId: string,
  status: Extract<RecommendationStatus, 'REVIEWED' | 'ARCHIVED'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadRecommendationReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Recommendation report bulunamadi.')
  const actionByStatus: Record<Extract<RecommendationStatus, 'REVIEWED' | 'ARCHIVED'>, RecommendationHistoryAction> = {
    REVIEWED: 'REVIEWED',
    ARCHIVED: 'ARCHIVED'
  }
  const nextReport = appendRecommendationHistory(
    {
      ...report,
      status
    },
    actionByStatus[status],
    actorName,
    `${report.reportNo} ${RECOMMENDATION_STATUS_LABELS[status]} durumuna alindi.`
  )
  saveRecommendationReports(upsertReport(reports, nextReport))
  return nextReport
}

export const recordRecommendationOutput = (
  reportId: string,
  action: Extract<RecommendationHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadRecommendationReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Recommendation report bulunamadi.')
  const nextReport = appendRecommendationHistory(
    report,
    action,
    actorName,
    action === 'EXCEL' ? `${report.reportNo} Excel export edildi.` : `${report.reportNo} cikti penceresi acildi.`
  )
  saveRecommendationReports(upsertReport(reports, nextReport))
  return nextReport
}

export const RecommendationService = {
  createDefaultFilters: createDefaultRecommendationFilters,
  createDefaultInput: createDefaultRecommendationReportInput,
  getNextNo: getNextRecommendationNo,
  save: saveRecommendationReports,
  list: loadRecommendationReports,
  evaluate: evaluateRecommendationReport,
  add: addRecommendationReport,
  filter: filterRecommendationReports,
  updateStatus: updateRecommendationReportStatus,
  recordOutput: recordRecommendationOutput,
  statistics: createRecommendationStatistics,
  calculation: RecommendationCalculationService,
  rules: RecommendationRuleService
}
