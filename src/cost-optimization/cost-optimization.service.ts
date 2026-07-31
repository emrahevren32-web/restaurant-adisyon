import { AIAnalysisService } from '../ai-analysis/ai-analysis.service'
import { createDecisionSuggestions } from '../decision-support/decision-support.service'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { resolveReadModel } from '../read-model/read-model-safety'
import { calculateRecommendationReport } from '../recommendation-engine/recommendation-calculation.service'
import { calculateCostOptimizationReport, CostAnalysisService } from './cost-analysis.service'
import { CostCalculationService } from './cost-calculation.service'
import {
  COST_OPTIMIZATION_CATEGORIES,
  COST_OPTIMIZATION_CATEGORY_LABELS,
  COST_OPTIMIZATION_PRIORITIES,
  COST_OPTIMIZATION_PRIORITY_LABELS,
  COST_OPTIMIZATION_RISKS,
  COST_OPTIMIZATION_RISK_LABELS,
  COST_OPTIMIZATION_STATUSES,
  COST_OPTIMIZATION_STATUS_LABELS
} from './cost-optimization.constants'
import { appendCostHistory, createCostHistory } from './cost-history.service'
import { createCostOptimizationStatistics } from './cost-statistics.service'
import type {
  CostHistory,
  CostHistoryAction,
  CostOptimizationCategory,
  CostOptimizationFilters,
  CostOptimizationItem,
  CostOptimizationPriority,
  CostOptimizationReport,
  CostOptimizationReportCreateInput,
  CostOptimizationRisk,
  CostOptimizationSourceModule,
  CostOptimizationStatus,
  CostOpportunity
} from './cost-optimization.types'

export {
  COST_OPTIMIZATION_CATEGORIES,
  COST_OPTIMIZATION_CATEGORY_LABELS,
  COST_OPTIMIZATION_PRIORITIES,
  COST_OPTIMIZATION_PRIORITY_LABELS,
  COST_OPTIMIZATION_RISKS,
  COST_OPTIMIZATION_RISK_LABELS,
  COST_OPTIMIZATION_STATUSES,
  COST_OPTIMIZATION_STATUS_LABELS
} from './cost-optimization.constants'

export const COST_OPTIMIZATION_STORAGE_KEY = 'ra_cost_optimization_engine_records'

type RawCostOptimizationReport = Partial<Record<keyof CostOptimizationReport, unknown>> & Record<string, unknown>
type RawCostOptimizationItem = Partial<Record<keyof CostOptimizationItem, unknown>> & Record<string, unknown>
type RawCostOpportunity = Partial<Record<keyof CostOpportunity, unknown>> & Record<string, unknown>

const COST_OPTIMIZATION_NO_PREFIX = 'CO'
const COST_OPTIMIZATION_NO_PADDING = 6

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

const getNextCostOptimizationNo = (
  records: Pick<CostOptimizationReport, 'reportNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${COST_OPTIMIZATION_NO_PREFIX}-${year}-(\\d{${COST_OPTIMIZATION_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.reportNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${COST_OPTIMIZATION_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(COST_OPTIMIZATION_NO_PADDING, '0')}`
}

export const createDefaultCostOptimizationFilters = (): CostOptimizationFilters => ({
  category: ALL_FILTER,
  priority: ALL_FILTER,
  risk: ALL_FILTER,
  branchId: ALL_FILTER,
  productId: ALL_FILTER,
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  supplierId: ALL_FILTER,
  date: '',
  search: ''
})

export const createDefaultCostOptimizationReportInput = (
  responsiblePerson = 'Cost Optimization Engine'
): CostOptimizationReportCreateInput => ({
  reportDate: getTodayKey(),
  scope: 'all',
  responsiblePerson,
  description: ''
})

const mapCategory = (value: unknown): CostOptimizationCategory => {
  const normalized = normalizeText(value).toUpperCase() as CostOptimizationCategory
  return COST_OPTIMIZATION_CATEGORIES.includes(normalized) ? normalized : 'PRODUCTION'
}

const mapStatus = (value: unknown): CostOptimizationStatus => {
  const normalized = normalizeText(value).toUpperCase() as CostOptimizationStatus
  return COST_OPTIMIZATION_STATUSES.includes(normalized) ? normalized : 'GENERATED'
}

const mapPriority = (value: unknown): CostOptimizationPriority => {
  const normalized = normalizeText(value).toUpperCase() as CostOptimizationPriority
  return COST_OPTIMIZATION_PRIORITIES.includes(normalized) ? normalized : 'NORMAL'
}

const mapRisk = (value: unknown): CostOptimizationRisk => {
  const normalized = normalizeText(value).toUpperCase() as CostOptimizationRisk
  return COST_OPTIMIZATION_RISKS.includes(normalized) ? normalized : 'LOW'
}

const normalizeHistory = (
  value: unknown,
  reportId: string,
  actorName: string
): CostHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${reportId}_history_${index + 1}`,
    reportId,
    action: normalizeText(history.action).toUpperCase() as CostHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Cost Optimization raporu guncellendi.',
    revisionNo: normalizeNumber(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeOpportunity = (
  value: RawCostOpportunity,
  itemId: string,
  index: number
): CostOpportunity => ({
  id: normalizeText(value.id) || `${itemId}_opportunity_${index + 1}`,
  itemId,
  category: mapCategory(value.category),
  title: normalizeText(value.title) || 'Maliyet firsati',
  description: normalizeText(value.description),
  expectedSaving: Math.max(0, normalizeNumber(value.expectedSaving)),
  expectedMonthlyGain: Math.max(0, normalizeNumber(value.expectedMonthlyGain)),
  expectedAnnualGain: Math.max(0, normalizeNumber(value.expectedAnnualGain)),
  roiEstimate: Math.max(0, normalizeNumber(value.roiEstimate)),
  confidenceScore: Math.max(0, normalizeNumber(value.confidenceScore)),
  riskScore: Math.max(0, normalizeNumber(value.riskScore)),
  priority: mapPriority(value.priority),
  action: normalizeText(value.action),
  ownerRole: normalizeText(value.ownerRole) || 'Operasyon',
  sourceModule: normalizeText(value.sourceModule) as CostOptimizationSourceModule || 'ReadModel'
})

const normalizeItem = (
  value: RawCostOptimizationItem,
  reportId: string,
  reportNo: string,
  index: number
): CostOptimizationItem => ({
  id: normalizeText(value.id) || `${reportId}_cost_item_${index + 1}`,
  reportId,
  reportNo,
  category: mapCategory(value.category),
  priority: mapPriority(value.priority),
  risk: mapRisk(value.risk),
  title: normalizeText(value.title) || 'Maliyet optimizasyon kalemi',
  description: normalizeText(value.description),
  reason: normalizeText(value.reason),
  action: normalizeText(value.action),
  expectedImpact: normalizeText(value.expectedImpact),
  ownerRole: normalizeText(value.ownerRole) || 'Operasyon',
  unitCost: Math.max(0, normalizeNumber(value.unitCost)),
  totalCost: Math.max(0, normalizeNumber(value.totalCost)),
  baselineCost: Math.max(0, normalizeNumber(value.baselineCost)),
  optimizedCost: Math.max(0, normalizeNumber(value.optimizedCost)),
  savingPotential: Math.max(0, normalizeNumber(value.savingPotential)),
  expectedMonthlyGain: Math.max(0, normalizeNumber(value.expectedMonthlyGain)),
  expectedAnnualGain: Math.max(0, normalizeNumber(value.expectedAnnualGain)),
  roiEstimate: Math.max(0, normalizeNumber(value.roiEstimate)),
  riskScore: Math.max(0, normalizeNumber(value.riskScore)),
  confidenceScore: Math.max(0, normalizeNumber(value.confidenceScore)),
  sourceModule: normalizeText(value.sourceModule) as CostOptimizationSourceModule || 'ReadModel',
  sourceId: normalizeText(value.sourceId),
  sourceNo: normalizeText(value.sourceNo),
  relatedModules: Array.isArray(value.relatedModules)
    ? value.relatedModules.map(module => normalizeText(module) as CostOptimizationSourceModule).filter(Boolean)
    : [],
  relatedEntityType: normalizeText(value.relatedEntityType),
  relatedEntityId: normalizeText(value.relatedEntityId),
  relatedEntityName: normalizeText(value.relatedEntityName) || 'Read Model',
  productId: normalizeText(value.productId),
  productName: normalizeText(value.productName),
  branchId: normalizeText(value.branchId),
  branchName: normalizeText(value.branchName),
  warehouseId: normalizeText(value.warehouseId),
  warehouseName: normalizeText(value.warehouseName),
  productionLineId: normalizeText(value.productionLineId),
  productionLineName: normalizeText(value.productionLineName),
  machineId: normalizeText(value.machineId),
  machineCode: normalizeText(value.machineCode),
  machineName: normalizeText(value.machineName),
  supplierId: normalizeText(value.supplierId),
  supplierName: normalizeText(value.supplierName),
  createdAt: normalizeText(value.createdAt) || new Date().toISOString()
})

const normalizeReport = (
  value: RawCostOptimizationReport,
  index: number
): CostOptimizationReport => {
  const reportDate = normalizeText(value.reportDate) || getTodayKey()
  const reportNo = normalizeText(value.reportNo) || getNextCostOptimizationNo([], reportDate, index)
  const id = normalizeText(value.id) || `cost_optimization_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = normalizeText(value.createdAt) || new Date().toISOString()
  const actorName = 'Cost Optimization Engine'
  const items = Array.isArray(value.items)
    ? value.items.filter(isRecord).map((item, itemIndex) => normalizeItem(item as RawCostOptimizationItem, id, reportNo, itemIndex))
    : []
  const opportunities = Array.isArray(value.opportunities)
    ? value.opportunities.filter(isRecord).map((opportunity, opportunityIndex) => normalizeOpportunity(opportunity as RawCostOpportunity, normalizeText(opportunity.itemId), opportunityIndex))
    : []
  const history = normalizeHistory(value.history, id, actorName)
  const scopeText = normalizeText(value.scope)

  return {
    id,
    reportNo,
    status: mapStatus(value.status),
    reportDate,
    scope: scopeText === ALL_FILTER || scopeText === '' ? 'all' : mapCategory(scopeText),
    responsiblePerson: normalizeText(value.responsiblePerson) || actorName,
    description: normalizeText(value.description),
    items,
    opportunities,
    history: history.length > 0
      ? history
      : [createCostHistory(id, 'CREATED', actorName, `${reportNo} cost optimization read-model olarak olusturuldu.`)],
    sourceType: normalizeText(value.sourceType) === 'ManualReadModel' ? 'ManualReadModel' : 'ReadModel',
    sourceId: normalizeText(value.sourceId) || 'cost-optimization-engine',
    revisionNo: normalizeNumber(value.revisionNo) || 1,
    createdBy: normalizeText(value.createdBy) || actorName,
    createdAt,
    updatedAt: normalizeText(value.updatedAt) || createdAt
  }
}

export const saveCostOptimizationReports = (reports: CostOptimizationReport[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(COST_OPTIMIZATION_STORAGE_KEY, JSON.stringify(reports))
}

const createCostOptimizationFallbackReport = (
  input: CostOptimizationReportCreateInput,
  existingReports: CostOptimizationReport[],
  actorName: string
): CostOptimizationReport => {
  const reportNo = getNextCostOptimizationNo(existingReports, input.reportDate)
  const reportId = `cost_optimization_${reportNo}_fallback`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = new Date().toISOString()

  return {
    id: reportId,
    reportNo,
    status: 'GENERATED',
    reportDate: input.reportDate,
    scope: input.scope,
    responsiblePerson: input.responsiblePerson || actorName,
    description: input.description || 'Read-model kaynak hatasi nedeniyle bos cost optimization raporu olusturuldu.',
    items: [],
    opportunities: [],
    history: [
      createCostHistory(reportId, 'ANALYZED', actorName, 'Read-model kaynak hatasi nedeniyle cost optimization hesaplamasi bos fallback ile tamamlandi.')
    ],
    sourceType: 'ReadModel',
    sourceId: 'cost-optimization-runtime-fallback',
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  }
}

export const evaluateCostOptimizationReport = (
  sourceData: KpiSourceData,
  input: Partial<CostOptimizationReportCreateInput> = {},
  existingReports: CostOptimizationReport[] = [],
  actorName = 'Cost Optimization Engine'
) => {
  const createInput = {
    ...createDefaultCostOptimizationReportInput(actorName),
    ...input
  }

  return resolveReadModel(() => {
    const decisionSuggestions = createDecisionSuggestions(sourceData, {
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
        'cost-optimization',
        'purchase-recommendations'
      ]
    })
      .filter(suggestion => !suggestion.ruleId.startsWith('cost-optimization-'))
    const recommendationReport = calculateRecommendationReport({
      reportDate: createInput.reportDate,
      scope: 'all',
      responsiblePerson: actorName,
      description: 'Cost Optimization recommendation source.',
      sourceData,
      decisionSuggestions,
      actorName,
      getReportNo: () => `RC-${new Date().getFullYear()}-000000`
    })
    const aiAnalysisReport = AIAnalysisService.evaluate(sourceData, {
      reportDate: createInput.reportDate,
      scope: 'all',
      responsiblePerson: actorName,
      description: 'Cost Optimization AI Analysis source.'
    }, [], actorName)

    return calculateCostOptimizationReport({
      ...createInput,
      sourceData,
      actorName,
      decisionSuggestions,
      recommendationReport,
      aiAnalysisReport,
      getReportNo: () => getNextCostOptimizationNo(existingReports, createInput.reportDate)
    })
  }, createCostOptimizationFallbackReport(createInput, existingReports, actorName))
}

export const loadCostOptimizationReports = (
  sourceData: KpiSourceData
) => {
  const defaultReport = evaluateCostOptimizationReport(sourceData)
  if(!isBrowserStorageAvailable()) return [defaultReport]

  const stored = localStorage.getItem(COST_OPTIMIZATION_STORAGE_KEY)
  if(stored === null){
    saveCostOptimizationReports([defaultReport])
    return [defaultReport]
  }

  try {
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)){
      const reports = parsed
        .filter(isRecord)
        .map((record, index) => normalizeReport(record as RawCostOptimizationReport, index))
        .sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))
      return reports.length > 0 ? reports : [defaultReport]
    }
  } catch {
    // Corrupt local cost optimization cache is replaced with a fresh read-model report.
  }

  saveCostOptimizationReports([defaultReport])
  return [defaultReport]
}

const upsertReport = (
  reports: CostOptimizationReport[],
  nextReport: CostOptimizationReport
) => reports.some(report => report.id === nextReport.id)
  ? reports.map(report => report.id === nextReport.id ? nextReport : report)
  : [nextReport, ...reports]

export const addCostOptimizationReport = (
  input: CostOptimizationReportCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadCostOptimizationReports(sourceData)
  const report = evaluateCostOptimizationReport(sourceData, input, reports, actorName)
  const nextReports = upsertReport(reports, report)
  saveCostOptimizationReports(nextReports)
  return report
}

export const filterCostOptimizationReports = (
  reports: CostOptimizationReport[],
  filters: CostOptimizationFilters
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
        item.branchName,
        item.warehouseName,
        item.productionLineName,
        item.machineCode,
        item.machineName,
        item.supplierName,
        item.sourceNo
      ].some(value => normalizeSearchText(value).includes(search))

      return matchesSearch
        && (filters.category === ALL_FILTER || item.category === filters.category)
        && (filters.priority === ALL_FILTER || item.priority === filters.priority)
        && (filters.risk === ALL_FILTER || item.risk === filters.risk)
        && (filters.branchId === ALL_FILTER || item.branchId === filters.branchId)
        && (filters.productId === ALL_FILTER || item.productId === filters.productId)
        && (filters.productionLineId === ALL_FILTER || item.productionLineId === filters.productionLineId)
        && (filters.machineId === ALL_FILTER || item.machineId === filters.machineId)
        && (filters.supplierId === ALL_FILTER || item.supplierId === filters.supplierId)
        && (!filters.date || report.reportDate === filters.date)
    })
    const visibleItemIds = new Set(filteredItems.map(item => item.id))

    return {
      ...report,
      items: filteredItems,
      opportunities: report.opportunities.filter(opportunity => visibleItemIds.has(opportunity.itemId))
    }
  }).filter(report => report.items.length > 0)
}

export const updateCostOptimizationReportStatus = (
  reportId: string,
  status: Extract<CostOptimizationStatus, 'REVIEWED' | 'ARCHIVED'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadCostOptimizationReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Cost Optimization report bulunamadi.')
  const actionByStatus: Record<Extract<CostOptimizationStatus, 'REVIEWED' | 'ARCHIVED'>, CostHistoryAction> = {
    REVIEWED: 'REVIEWED',
    ARCHIVED: 'ARCHIVED'
  }
  const nextReport = appendCostHistory(
    {
      ...report,
      status
    },
    actionByStatus[status],
    actorName,
    `${report.reportNo} ${COST_OPTIMIZATION_STATUS_LABELS[status]} durumuna alindi.`
  )
  saveCostOptimizationReports(upsertReport(reports, nextReport))
  return nextReport
}

export const recordCostOptimizationOutput = (
  reportId: string,
  action: Extract<CostHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadCostOptimizationReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Cost Optimization report bulunamadi.')
  const nextReport = appendCostHistory(
    report,
    action,
    actorName,
    action === 'EXCEL' ? `${report.reportNo} Excel export edildi.` : `${report.reportNo} cikti penceresi acildi.`
  )
  saveCostOptimizationReports(upsertReport(reports, nextReport))
  return nextReport
}

export const CostOptimizationService = {
  createDefaultFilters: createDefaultCostOptimizationFilters,
  createDefaultInput: createDefaultCostOptimizationReportInput,
  getNextNo: getNextCostOptimizationNo,
  save: saveCostOptimizationReports,
  list: loadCostOptimizationReports,
  evaluate: evaluateCostOptimizationReport,
  add: addCostOptimizationReport,
  filter: filterCostOptimizationReports,
  updateStatus: updateCostOptimizationReportStatus,
  recordOutput: recordCostOptimizationOutput,
  statistics: createCostOptimizationStatistics,
  calculation: CostCalculationService,
  analysis: CostAnalysisService
}
