import { AIAnalysisService } from '../ai-analysis/ai-analysis.service'
import { CostOptimizationService } from '../cost-optimization/cost-optimization.service'
import { CriticalAlertService } from '../critical-alerts/critical-alert.service'
import { ForecastService } from '../forecasting/forecast.service'
import { GoodsReceiptService } from '../goods-receipts/goods-receipt.service'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import {
  getDecisionIndexedRecord,
  setDecisionIndexedRecord
} from '../read-model/decision-indexed-storage.service'
import { getDecisionReadModelSnapshot } from '../read-model/decision-read-model-snapshot.service'
import { resolveReadModel } from '../read-model/read-model-safety'
import { RecommendationService } from '../recommendation-engine/recommendation.service'
import { WasteService } from '../waste-management/waste.service'
import {
  PURCHASE_RECOMMENDATION_PRIORITIES,
  PURCHASE_RECOMMENDATION_PRIORITY_LABELS,
  PURCHASE_RECOMMENDATION_RISKS,
  PURCHASE_RECOMMENDATION_RISK_LABELS,
  PURCHASE_RECOMMENDATION_STATUSES,
  PURCHASE_RECOMMENDATION_STATUS_LABELS,
  PURCHASE_RECOMMENDATION_TYPES,
  PURCHASE_RECOMMENDATION_TYPE_LABELS
} from './purchase-recommendation.constants'
import { calculatePurchaseRecommendationReport, PurchaseRecommendationCalculationService } from './purchase-recommendation-calculation.service'
import { appendPurchaseRecommendationHistory, createPurchaseRecommendationHistory } from './purchase-recommendation-history.service'
import { listPurchaseRecommendationRules, PurchaseRecommendationRuleService } from './purchase-recommendation-rule.service'
import { createPurchaseRecommendationStatistics } from './purchase-recommendation-statistics.service'
import type {
  PurchaseRecommendationFilters,
  PurchaseRecommendationHistory,
  PurchaseRecommendationHistoryAction,
  PurchaseRecommendationItem,
  PurchaseRecommendationPriority,
  PurchaseRecommendationReport,
  PurchaseRecommendationReportCreateInput,
  PurchaseRecommendationRisk,
  PurchaseRecommendationRule,
  PurchaseRecommendationSourceModule,
  PurchaseRecommendationStatus,
  PurchaseRecommendationType
} from './purchase-recommendation.types'

export {
  PURCHASE_RECOMMENDATION_PRIORITIES,
  PURCHASE_RECOMMENDATION_PRIORITY_LABELS,
  PURCHASE_RECOMMENDATION_RISKS,
  PURCHASE_RECOMMENDATION_RISK_LABELS,
  PURCHASE_RECOMMENDATION_STATUSES,
  PURCHASE_RECOMMENDATION_STATUS_LABELS,
  PURCHASE_RECOMMENDATION_TYPES,
  PURCHASE_RECOMMENDATION_TYPE_LABELS
} from './purchase-recommendation.constants'

export const PURCHASE_RECOMMENDATION_STORAGE_KEY = 'ra_purchase_recommendation_engine_records'

type RawPurchaseRecommendationReport = Partial<Record<keyof PurchaseRecommendationReport, unknown>> & Record<string, unknown>
type RawPurchaseRecommendationItem = Partial<Record<keyof PurchaseRecommendationItem, unknown>> & Record<string, unknown>
type RawPurchaseRecommendationRule = Partial<Record<keyof PurchaseRecommendationRule, unknown>> & Record<string, unknown>
type PurchaseRecommendationEvaluationDependencies = Partial<Pick<
  Parameters<typeof calculatePurchaseRecommendationReport>[0],
  'forecastReport' | 'costOptimizationReport' | 'recommendationReport' | 'aiAnalysisReport' | 'criticalAlerts' | 'goodsReceipts' | 'wasteRecords' | 'decisionSuggestions'
>>

const PURCHASE_RECOMMENDATION_NO_PREFIX = 'PR-REC'
const PURCHASE_RECOMMENDATION_NO_PADDING = 6

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined'
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

const getNextPurchaseRecommendationNo = (
  records: Pick<PurchaseRecommendationReport, 'reportNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${PURCHASE_RECOMMENDATION_NO_PREFIX}-${year}-(\\d{${PURCHASE_RECOMMENDATION_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.reportNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${PURCHASE_RECOMMENDATION_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(PURCHASE_RECOMMENDATION_NO_PADDING, '0')}`
}

export const createDefaultPurchaseRecommendationFilters = (): PurchaseRecommendationFilters => ({
  recommendationType: ALL_FILTER,
  priority: ALL_FILTER,
  risk: ALL_FILTER,
  branchId: ALL_FILTER,
  warehouseId: ALL_FILTER,
  categoryId: ALL_FILTER,
  productId: ALL_FILTER,
  supplierId: ALL_FILTER,
  date: '',
  search: ''
})

export const createDefaultPurchaseRecommendationReportInput = (
  responsiblePerson = 'Satın Alma Öneri Motoru'
): PurchaseRecommendationReportCreateInput => ({
  reportDate: getTodayKey(),
  scope: 'all',
  responsiblePerson,
  description: ''
})

const mapType = (value: unknown): PurchaseRecommendationType => {
  const normalized = normalizeText(value).toUpperCase() as PurchaseRecommendationType
  return PURCHASE_RECOMMENDATION_TYPES.includes(normalized) ? normalized : 'FORECAST_ORDER'
}

const mapStatus = (value: unknown): PurchaseRecommendationStatus => {
  const normalized = normalizeText(value).toUpperCase() as PurchaseRecommendationStatus
  return PURCHASE_RECOMMENDATION_STATUSES.includes(normalized) ? normalized : 'GENERATED'
}

const mapPriority = (value: unknown): PurchaseRecommendationPriority => {
  const normalized = normalizeText(value).toUpperCase() as PurchaseRecommendationPriority
  return PURCHASE_RECOMMENDATION_PRIORITIES.includes(normalized) ? normalized : 'NORMAL'
}

const mapRisk = (value: unknown): PurchaseRecommendationRisk => {
  const normalized = normalizeText(value).toUpperCase() as PurchaseRecommendationRisk
  return PURCHASE_RECOMMENDATION_RISKS.includes(normalized) ? normalized : 'LOW'
}

const normalizeHistory = (
  value: unknown,
  reportId: string,
  actorName: string
): PurchaseRecommendationHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${reportId}_history_${index + 1}`,
    reportId,
    action: normalizeText(history.action).toUpperCase() as PurchaseRecommendationHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Satın alma öneri raporu güncellendi.',
    revisionNo: normalizeNumber(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeRule = (
  value: RawPurchaseRecommendationRule,
  index: number
): PurchaseRecommendationRule => ({
  id: normalizeText(value.id) || `purchase_recommendation_rule_${index + 1}`,
  code: normalizeText(value.code) || `PR-REC-RULE-${index + 1}`,
  type: mapType(value.type),
  title: normalizeText(value.title) || 'Satın Alma Öneri Kuralı',
  description: normalizeText(value.description),
  sourceModule: normalizeText(value.sourceModule) as PurchaseRecommendationSourceModule || 'ReadModel',
  baseRisk: mapRisk(value.baseRisk),
  priority: mapPriority(value.priority),
  thresholdLabel: normalizeText(value.thresholdLabel),
  enabled: value.enabled !== false
})

const normalizeItem = (
  value: RawPurchaseRecommendationItem,
  reportId: string,
  reportNo: string,
  index: number
): PurchaseRecommendationItem => ({
  id: normalizeText(value.id) || `${reportId}_purchase_item_${index + 1}`,
  reportId,
  reportNo,
  ruleId: normalizeText(value.ruleId),
  recommendationType: mapType(value.recommendationType),
  priority: mapPriority(value.priority),
  risk: mapRisk(value.risk),
  title: normalizeText(value.title) || 'Satın alma önerisi',
  description: normalizeText(value.description),
  reason: normalizeText(value.reason),
  action: normalizeText(value.action),
  expectedImpact: normalizeText(value.expectedImpact),
  ownerRole: normalizeText(value.ownerRole) || 'Satın Alma',
  recommendedOrderQuantity: Math.max(0, normalizeNumber(value.recommendedOrderQuantity)),
  currentStock: Math.max(0, normalizeNumber(value.currentStock)),
  minimumStock: Math.max(0, normalizeNumber(value.minimumStock)),
  dailyUsageEstimate: Math.max(0, normalizeNumber(value.dailyUsageEstimate)),
  estimatedCoverageDays: Math.max(0, normalizeNumber(value.estimatedCoverageDays)),
  estimatedStockoutDate: normalizeText(value.estimatedStockoutDate),
  expectedCost: Math.max(0, normalizeNumber(value.expectedCost)),
  expectedSaving: Math.max(0, normalizeNumber(value.expectedSaving)),
  unitCost: Math.max(0, normalizeNumber(value.unitCost)),
  riskScore: Math.max(0, normalizeNumber(value.riskScore)),
  confidenceScore: Math.max(0, normalizeNumber(value.confidenceScore)),
  sourceModule: normalizeText(value.sourceModule) as PurchaseRecommendationSourceModule || 'ReadModel',
  sourceId: normalizeText(value.sourceId),
  sourceNo: normalizeText(value.sourceNo),
  relatedModules: Array.isArray(value.relatedModules)
    ? value.relatedModules.map(module => normalizeText(module) as PurchaseRecommendationSourceModule).filter(Boolean)
    : [],
  relatedEntityType: normalizeText(value.relatedEntityType),
  relatedEntityId: normalizeText(value.relatedEntityId),
  relatedEntityName: normalizeText(value.relatedEntityName) || 'Analiz Modeli',
  productId: normalizeText(value.productId),
  productName: normalizeText(value.productName),
  stockItemId: normalizeText(value.stockItemId),
  stockItemName: normalizeText(value.stockItemName),
  categoryId: normalizeText(value.categoryId),
  categoryName: normalizeText(value.categoryName),
  branchId: normalizeText(value.branchId),
  branchName: normalizeText(value.branchName),
  warehouseId: normalizeText(value.warehouseId),
  warehouseName: normalizeText(value.warehouseName),
  supplierId: normalizeText(value.supplierId),
  supplierName: normalizeText(value.supplierName),
  alternativeSupplierId: normalizeText(value.alternativeSupplierId),
  alternativeSupplierName: normalizeText(value.alternativeSupplierName),
  createdAt: normalizeText(value.createdAt) || new Date().toISOString()
})

const normalizeReport = (
  value: RawPurchaseRecommendationReport,
  index: number
): PurchaseRecommendationReport => {
  const reportDate = normalizeText(value.reportDate) || getTodayKey()
  const reportNo = normalizeText(value.reportNo) || getNextPurchaseRecommendationNo([], reportDate, index)
  const id = normalizeText(value.id) || `purchase_recommendation_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = normalizeText(value.createdAt) || new Date().toISOString()
  const actorName = 'Satın Alma Öneri Motoru'
  const items = Array.isArray(value.items)
    ? value.items.filter(isRecord).map((item, itemIndex) => normalizeItem(item as RawPurchaseRecommendationItem, id, reportNo, itemIndex))
    : []
  const rules = Array.isArray(value.rules)
    ? value.rules.filter(isRecord).map((rule, ruleIndex) => normalizeRule(rule as RawPurchaseRecommendationRule, ruleIndex))
    : listPurchaseRecommendationRules()
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
      : [createPurchaseRecommendationHistory(id, 'CREATED', actorName, `${reportNo} purchase recommendation read-model olarak olusturuldu.`)],
    sourceType: normalizeText(value.sourceType) === 'ManualReadModel' ? 'ManualReadModel' : 'ReadModel',
    sourceId: normalizeText(value.sourceId) || 'purchase-recommendation-engine',
    revisionNo: normalizeNumber(value.revisionNo) || 1,
    createdBy: normalizeText(value.createdBy) || actorName,
    createdAt,
    updatedAt: normalizeText(value.updatedAt) || createdAt
  }
}

export const savePurchaseRecommendationReports = (reports: PurchaseRecommendationReport[]) => {
  if(!isBrowserStorageAvailable()) return
  setDecisionIndexedRecord(PURCHASE_RECOMMENDATION_STORAGE_KEY, reports)
}

const createPurchaseRecommendationFallbackReport = (
  input: PurchaseRecommendationReportCreateInput,
  existingReports: PurchaseRecommendationReport[],
  actorName: string
): PurchaseRecommendationReport => {
  const reportNo = getNextPurchaseRecommendationNo(existingReports, input.reportDate)
  const reportId = `purchase_recommendation_${reportNo}_fallback`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = new Date().toISOString()

  return {
    id: reportId,
    reportNo,
    status: 'GENERATED',
    reportDate: input.reportDate,
    scope: input.scope,
    responsiblePerson: input.responsiblePerson || actorName,
    description: input.description || 'Analiz modeli kaynak hatası nedeniyle boş satın alma öneri raporu oluşturuldu.',
    items: [],
    rules: listPurchaseRecommendationRules(),
    history: [
      createPurchaseRecommendationHistory(reportId, 'CALCULATED', actorName, 'Analiz modeli kaynak hatası nedeniyle satın alma öneri hesaplaması boş fallback ile tamamlandı.')
    ],
    sourceType: 'ReadModel',
    sourceId: 'purchase-recommendation-runtime-fallback',
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  }
}

export const evaluatePurchaseRecommendationReport = (
  sourceData: KpiSourceData,
  input: Partial<PurchaseRecommendationReportCreateInput> = {},
  existingReports: PurchaseRecommendationReport[] = [],
  actorName = 'Satın Alma Öneri Motoru',
  dependencies: PurchaseRecommendationEvaluationDependencies = {}
) => {
  const createInput = {
    ...createDefaultPurchaseRecommendationReportInput(actorName),
    ...input
  }

  return resolveReadModel(() => {
    const snapshot = getDecisionReadModelSnapshot(sourceData, actorName)
    const forecastReport = dependencies.forecastReport || snapshot.forecastReport || ForecastService.evaluate(sourceData, {
      reportDate: createInput.reportDate,
      horizonDays: 7,
      analysisWindowDays: 30,
      scenarioName: 'Satın Alma Tahmin Kaynağı',
      responsiblePerson: actorName,
      description: 'Satın alma önerileri tahmin kaynağı.'
    })
    const recommendationReport = dependencies.recommendationReport || snapshot.recommendationReport || RecommendationService.evaluate(sourceData, {
      reportDate: createInput.reportDate,
      scope: 'all',
      responsiblePerson: actorName,
      description: 'Satın alma önerileri otomatik öneri kaynağı.'
    }, [], actorName, { forecastPredictions: forecastReport.predictions })
    const aiAnalysisReport = dependencies.aiAnalysisReport || AIAnalysisService.evaluate(sourceData, {
      reportDate: createInput.reportDate,
      scope: 'all',
      responsiblePerson: actorName,
      description: 'Satın alma önerileri yapay zeka analiz kaynağı.'
    }, [], actorName, snapshot)
    const costOptimizationReport = dependencies.costOptimizationReport || CostOptimizationService.evaluate(sourceData, {
      reportDate: createInput.reportDate,
      scope: 'all',
      responsiblePerson: actorName,
      description: 'Satın alma önerileri maliyet kaynağı.'
    })
    const criticalAlerts = dependencies.criticalAlerts || snapshot.criticalAlerts || CriticalAlertService.evaluate(sourceData)
    const goodsReceipts = dependencies.goodsReceipts || GoodsReceiptService.list(sourceData)
    const wasteRecords = dependencies.wasteRecords || WasteService.list(sourceData)

    return calculatePurchaseRecommendationReport({
      ...createInput,
      sourceData,
      actorName,
      forecastReport,
      costOptimizationReport,
      recommendationReport,
      aiAnalysisReport,
      criticalAlerts,
      goodsReceipts,
      wasteRecords,
      decisionSuggestions: dependencies.decisionSuggestions || snapshot.decisionSuggestions,
      getReportNo: () => getNextPurchaseRecommendationNo(existingReports, createInput.reportDate)
    })
  }, createPurchaseRecommendationFallbackReport(createInput, existingReports, actorName))
}

export const loadPurchaseRecommendationReports = (
  sourceData: KpiSourceData
) => {
  if(!isBrowserStorageAvailable()) return [evaluatePurchaseRecommendationReport(sourceData)]

  const stored = getDecisionIndexedRecord<RawPurchaseRecommendationReport[]>(PURCHASE_RECOMMENDATION_STORAGE_KEY)
  if(stored === null){
    const defaultReport = evaluatePurchaseRecommendationReport(sourceData)
    savePurchaseRecommendationReports([defaultReport])
    return [defaultReport]
  }

  try {
    if(Array.isArray(stored)){
      const reports = stored
        .filter(isRecord)
        .map((record, index) => normalizeReport(record as RawPurchaseRecommendationReport, index))
        .sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))
      if(reports.length > 0) return reports
    }
  } catch {
    // Corrupt local purchase recommendation cache is replaced with a fresh read-model report.
  }

  const defaultReport = evaluatePurchaseRecommendationReport(sourceData)
  savePurchaseRecommendationReports([defaultReport])
  return [defaultReport]
}

const upsertReport = (
  reports: PurchaseRecommendationReport[],
  nextReport: PurchaseRecommendationReport
) => reports.some(report => report.id === nextReport.id)
  ? reports.map(report => report.id === nextReport.id ? nextReport : report)
  : [nextReport, ...reports]

export const addPurchaseRecommendationReport = (
  input: PurchaseRecommendationReportCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadPurchaseRecommendationReports(sourceData)
  const report = evaluatePurchaseRecommendationReport(sourceData, input, reports, actorName)
  const nextReports = upsertReport(reports, report)
  savePurchaseRecommendationReports(nextReports)
  return report
}

export const filterPurchaseRecommendationReports = (
  reports: PurchaseRecommendationReport[],
  filters: PurchaseRecommendationFilters
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
        item.categoryName,
        item.branchName,
        item.warehouseName,
        item.supplierName,
        item.alternativeSupplierName,
        item.sourceNo
      ].some(value => normalizeSearchText(value).includes(search))

      return matchesSearch
        && (filters.recommendationType === ALL_FILTER || item.recommendationType === filters.recommendationType)
        && (filters.priority === ALL_FILTER || item.priority === filters.priority)
        && (filters.risk === ALL_FILTER || item.risk === filters.risk)
        && (filters.branchId === ALL_FILTER || item.branchId === filters.branchId)
        && (filters.warehouseId === ALL_FILTER || item.warehouseId === filters.warehouseId)
        && (filters.categoryId === ALL_FILTER || item.categoryId === filters.categoryId)
        && (filters.productId === ALL_FILTER || item.productId === filters.productId || item.stockItemId === filters.productId)
        && (filters.supplierId === ALL_FILTER || item.supplierId === filters.supplierId || item.alternativeSupplierId === filters.supplierId)
        && (!filters.date || report.reportDate === filters.date)
    })

    return {
      ...report,
      items: filteredItems
    }
  }).filter(report => report.items.length > 0)
}

export const updatePurchaseRecommendationReportStatus = (
  reportId: string,
  status: Extract<PurchaseRecommendationStatus, 'REVIEWED' | 'ARCHIVED'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadPurchaseRecommendationReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Satın alma öneri raporu bulunamadı.')
  const actionByStatus: Record<Extract<PurchaseRecommendationStatus, 'REVIEWED' | 'ARCHIVED'>, PurchaseRecommendationHistoryAction> = {
    REVIEWED: 'REVIEWED',
    ARCHIVED: 'ARCHIVED'
  }
  const nextReport = appendPurchaseRecommendationHistory(
    {
      ...report,
      status
    },
    actionByStatus[status],
    actorName,
    `${report.reportNo} ${PURCHASE_RECOMMENDATION_STATUS_LABELS[status]} durumuna alindi.`
  )
  savePurchaseRecommendationReports(upsertReport(reports, nextReport))
  return nextReport
}

export const recordPurchaseRecommendationOutput = (
  reportId: string,
  action: Extract<PurchaseRecommendationHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadPurchaseRecommendationReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Satın alma öneri raporu bulunamadı.')
  const nextReport = appendPurchaseRecommendationHistory(
    report,
    action,
    actorName,
    action === 'EXCEL' ? `${report.reportNo} Excel export edildi.` : `${report.reportNo} cikti penceresi acildi.`
  )
  savePurchaseRecommendationReports(upsertReport(reports, nextReport))
  return nextReport
}

export const PurchaseRecommendationService = {
  createDefaultFilters: createDefaultPurchaseRecommendationFilters,
  createDefaultInput: createDefaultPurchaseRecommendationReportInput,
  getNextNo: getNextPurchaseRecommendationNo,
  save: savePurchaseRecommendationReports,
  list: loadPurchaseRecommendationReports,
  evaluate: evaluatePurchaseRecommendationReport,
  add: addPurchaseRecommendationReport,
  filter: filterPurchaseRecommendationReports,
  updateStatus: updatePurchaseRecommendationReportStatus,
  recordOutput: recordPurchaseRecommendationOutput,
  statistics: createPurchaseRecommendationStatistics,
  calculation: PurchaseRecommendationCalculationService,
  rules: PurchaseRecommendationRuleService
}
