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
import {
  AI_ANALYSIS_STATUSES,
  AI_ANALYSIS_STATUS_LABELS,
  AI_ANALYSIS_TITLE_LABELS,
  AI_ANALYSIS_TITLES,
  AI_INSIGHT_TYPE_LABELS,
  AI_INSIGHT_TYPES,
  AI_SEVERITIES,
  AI_SEVERITY_LABELS
} from './ai-analysis.constants'
import { appendAIHistory, createAIHistory } from './ai-history.service'
import { calculateAIAnalysisReport, AIInsightService } from './ai-insight.service'
import { createAIStatistics } from './ai-statistics.service'
import { AIScoreService } from './ai-score.service'
import type {
  AIAnalysisFilters,
  AIAnalysisReport,
  AIAnalysisReportCreateInput,
  AIAnalysisStatus,
  AIAnalysisTitle,
  AIFinding,
  AIHistory,
  AIHistoryAction,
  AIInsight,
  AIInsightType,
  AIScore,
  AISourceModule,
  AISeverity
} from './ai-analysis.types'

export {
  AI_ANALYSIS_STATUSES,
  AI_ANALYSIS_STATUS_LABELS,
  AI_ANALYSIS_TITLE_LABELS,
  AI_ANALYSIS_TITLES,
  AI_INSIGHT_TYPE_LABELS,
  AI_INSIGHT_TYPES,
  AI_SEVERITIES,
  AI_SEVERITY_LABELS
} from './ai-analysis.constants'

export const AI_ANALYSIS_STORAGE_KEY = 'ra_ai_analysis_engine_records'

type RawAIAnalysisReport = Partial<Record<keyof AIAnalysisReport, unknown>> & Record<string, unknown>
type RawAIInsight = Partial<Record<keyof AIInsight, unknown>> & Record<string, unknown>
type RawAIFinding = Partial<Record<keyof AIFinding, unknown>> & Record<string, unknown>
type RawAIScore = Partial<Record<keyof AIScore, unknown>> & Record<string, unknown>
type AIAnalysisEvaluationDependencies = Partial<Parameters<typeof calculateAIAnalysisReport>[0]>

const AI_REPORT_NO_PREFIX = 'AI'
const AI_REPORT_NO_PADDING = 6

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

const getNextAIAnalysisNo = (
  records: Pick<AIAnalysisReport, 'reportNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${AI_REPORT_NO_PREFIX}-${year}-(\\d{${AI_REPORT_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.reportNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${AI_REPORT_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(AI_REPORT_NO_PADDING, '0')}`
}

export const createDefaultAIAnalysisFilters = (): AIAnalysisFilters => ({
  analysisTitle: ALL_FILTER,
  insightType: ALL_FILTER,
  severity: ALL_FILTER,
  branchId: ALL_FILTER,
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  employeeId: ALL_FILTER,
  date: '',
  search: ''
})

export const createDefaultAIAnalysisReportInput = (
  responsiblePerson = 'Yapay Zeka Analiz Motoru'
): AIAnalysisReportCreateInput => ({
  reportDate: getTodayKey(),
  scope: 'all',
  responsiblePerson,
  description: ''
})

const mapTitle = (value: unknown): AIAnalysisTitle => {
  const normalized = normalizeText(value).toUpperCase() as AIAnalysisTitle
  return AI_ANALYSIS_TITLES.includes(normalized) ? normalized : 'PRODUCTION'
}

const mapInsightType = (value: unknown): AIInsightType => {
  const normalized = normalizeText(value).toUpperCase() as AIInsightType
  return AI_INSIGHT_TYPES.includes(normalized) ? normalized : 'RISK'
}

const mapSeverity = (value: unknown): AISeverity => {
  const normalized = normalizeText(value).toUpperCase() as AISeverity
  return AI_SEVERITIES.includes(normalized) ? normalized : 'LOW'
}

const mapStatus = (value: unknown): AIAnalysisStatus => {
  const normalized = normalizeText(value).toUpperCase() as AIAnalysisStatus
  return AI_ANALYSIS_STATUSES.includes(normalized) ? normalized : 'GENERATED'
}

const normalizeHistory = (
  value: unknown,
  reportId: string,
  actorName: string
): AIHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${reportId}_history_${index + 1}`,
    reportId,
    action: normalizeText(history.action).toUpperCase() as AIHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Yapay zeka analiz raporu guncellendi.',
    revisionNo: normalizeNumber(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeInsight = (
  value: RawAIInsight,
  reportId: string,
  reportNo: string,
  index: number
): AIInsight => ({
  id: normalizeText(value.id) || `${reportId}_insight_${index + 1}`,
  reportId,
  reportNo,
  analysisTitle: mapTitle(value.analysisTitle),
  insightType: mapInsightType(value.insightType),
  severity: mapSeverity(value.severity),
  title: normalizeText(value.title) || 'Yapay zeka bulgusu',
  summary: normalizeText(value.summary),
  evidence: normalizeText(value.evidence),
  expectedImpact: normalizeText(value.expectedImpact),
  suggestedPromptContext: normalizeText(value.suggestedPromptContext),
  recommendedAction: normalizeText(value.recommendedAction),
  sourceModule: normalizeText(value.sourceModule) as AISourceModule || 'ReadModel',
  sourceId: normalizeText(value.sourceId),
  sourceNo: normalizeText(value.sourceNo),
  relatedModules: Array.isArray(value.relatedModules)
    ? value.relatedModules.map(module => normalizeText(module) as AISourceModule).filter(Boolean)
    : [],
  relatedEntityType: normalizeText(value.relatedEntityType),
  relatedEntityId: normalizeText(value.relatedEntityId),
  relatedEntityName: normalizeText(value.relatedEntityName) || 'Analiz Modeli',
  branchId: normalizeText(value.branchId),
  branchName: normalizeText(value.branchName),
  productionLineId: normalizeText(value.productionLineId),
  productionLineName: normalizeText(value.productionLineName),
  machineId: normalizeText(value.machineId),
  machineCode: normalizeText(value.machineCode),
  machineName: normalizeText(value.machineName),
  employeeId: normalizeText(value.employeeId),
  employeeName: normalizeText(value.employeeName),
  categoryId: normalizeText(value.categoryId),
  categoryName: normalizeText(value.categoryName),
  confidenceScore: Math.max(0, normalizeNumber(value.confidenceScore)),
  riskScore: Math.max(0, normalizeNumber(value.riskScore)),
  impactScore: Math.max(0, normalizeNumber(value.impactScore)),
  priorityScore: Math.max(0, normalizeNumber(value.priorityScore)),
  trendScore: Math.max(0, normalizeNumber(value.trendScore)),
  expectedGainScore: Math.max(0, normalizeNumber(value.expectedGainScore)),
  createdAt: normalizeText(value.createdAt) || new Date().toISOString()
})

const normalizeFinding = (
  value: RawAIFinding,
  reportId: string,
  reportNo: string,
  index: number
): AIFinding => ({
  id: normalizeText(value.id) || `${reportId}_finding_${index + 1}`,
  reportId,
  reportNo,
  insightId: normalizeText(value.insightId),
  analysisTitle: mapTitle(value.analysisTitle),
  findingType: mapInsightType(value.findingType),
  severity: mapSeverity(value.severity),
  title: normalizeText(value.title) || 'Yapay zeka bulgusu',
  description: normalizeText(value.description),
  metricName: normalizeText(value.metricName),
  metricValue: normalizeNumber(value.metricValue),
  benchmarkValue: normalizeNumber(value.benchmarkValue),
  deltaPercent: normalizeNumber(value.deltaPercent),
  sourceModule: normalizeText(value.sourceModule) as AISourceModule || 'ReadModel',
  sourceId: normalizeText(value.sourceId),
  sourceNo: normalizeText(value.sourceNo),
  relatedEntityType: normalizeText(value.relatedEntityType),
  relatedEntityId: normalizeText(value.relatedEntityId),
  relatedEntityName: normalizeText(value.relatedEntityName) || 'Analiz Modeli',
  createdAt: normalizeText(value.createdAt) || new Date().toISOString()
})

const normalizeScore = (
  value: RawAIScore,
  reportId: string,
  index: number
): AIScore => ({
  id: normalizeText(value.id) || `${reportId}_score_${index + 1}`,
  reportId,
  analysisTitle: mapTitle(value.analysisTitle),
  confidenceScore: Math.max(0, normalizeNumber(value.confidenceScore)),
  riskScore: Math.max(0, normalizeNumber(value.riskScore)),
  impactScore: Math.max(0, normalizeNumber(value.impactScore)),
  priorityScore: Math.max(0, normalizeNumber(value.priorityScore)),
  trendScore: Math.max(0, normalizeNumber(value.trendScore)),
  sampleSize: Math.max(0, normalizeNumber(value.sampleSize)),
  sourceCount: Math.max(0, normalizeNumber(value.sourceCount)),
  summary: normalizeText(value.summary)
})

const normalizeReport = (
  value: RawAIAnalysisReport,
  index: number
): AIAnalysisReport => {
  const reportDate = normalizeText(value.reportDate) || getTodayKey()
  const reportNo = normalizeText(value.reportNo) || getNextAIAnalysisNo([], reportDate, index)
  const id = normalizeText(value.id) || `ai_analysis_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = normalizeText(value.createdAt) || new Date().toISOString()
  const actorName = 'Yapay Zeka Analiz Motoru'
  const insights = Array.isArray(value.insights)
    ? value.insights.filter(isRecord).map((insight, insightIndex) => normalizeInsight(insight as RawAIInsight, id, reportNo, insightIndex))
    : []
  const findings = Array.isArray(value.findings)
    ? value.findings.filter(isRecord).map((finding, findingIndex) => normalizeFinding(finding as RawAIFinding, id, reportNo, findingIndex))
    : []
  const scores = Array.isArray(value.scores)
    ? value.scores.filter(isRecord).map((score, scoreIndex) => normalizeScore(score as RawAIScore, id, scoreIndex))
    : []
  const history = normalizeHistory(value.history, id, actorName)
  const scopeText = normalizeText(value.scope)

  return {
    id,
    reportNo,
    status: mapStatus(value.status),
    reportDate,
    scope: scopeText === ALL_FILTER || scopeText === '' ? 'all' : mapTitle(scopeText),
    responsiblePerson: normalizeText(value.responsiblePerson) || actorName,
    description: normalizeText(value.description),
    insights,
    findings,
    scores,
    history: history.length > 0
      ? history
      : [createAIHistory(id, 'CREATED', actorName, `${reportNo} yapay zeka analizi read-model olarak olusturuldu.`)],
    sourceType: normalizeText(value.sourceType) === 'ManualReadModel' ? 'ManualReadModel' : 'ReadModel',
    sourceId: normalizeText(value.sourceId) || 'ai-analysis-engine',
    revisionNo: normalizeNumber(value.revisionNo) || 1,
    createdBy: normalizeText(value.createdBy) || actorName,
    createdAt,
    updatedAt: normalizeText(value.updatedAt) || createdAt
  }
}

export const saveAIAnalysisReports = (reports: AIAnalysisReport[]) => {
  if(!isBrowserStorageAvailable()) return
  setDecisionIndexedRecord(AI_ANALYSIS_STORAGE_KEY, reports)
}

const createAIAnalysisFallbackReport = (
  input: AIAnalysisReportCreateInput,
  existingReports: AIAnalysisReport[],
  actorName: string
): AIAnalysisReport => {
  const reportNo = getNextAIAnalysisNo(existingReports, input.reportDate)
  const reportId = `ai_analysis_${reportNo}_fallback`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = new Date().toISOString()

  return {
    id: reportId,
    reportNo,
    status: 'GENERATED',
    reportDate: input.reportDate,
    scope: input.scope,
    responsiblePerson: input.responsiblePerson || actorName,
    description: input.description || 'Read-model kaynak hatasi nedeniyle bos yapay zeka analiz raporu olusturuldu.',
    insights: [],
    findings: [],
    scores: [],
    history: [
      createAIHistory(reportId, 'ANALYZED', actorName, 'Read-model kaynak hatasi nedeniyle yapay zeka analizi bos fallback ile tamamlandi.')
    ],
    sourceType: 'ReadModel',
    sourceId: 'ai-analysis-runtime-fallback',
    revisionNo: 1,
    createdBy: actorName,
    createdAt,
    updatedAt: createdAt
  }
}

export const evaluateAIAnalysisReport = (
  sourceData: KpiSourceData,
  input: Partial<AIAnalysisReportCreateInput> = {},
  existingReports: AIAnalysisReport[] = [],
  actorName = 'Yapay Zeka Analiz Motoru',
  dependencies: AIAnalysisEvaluationDependencies = {}
) => {
  const createInput = {
    ...createDefaultAIAnalysisReportInput(actorName),
    ...input
  }

  const snapshot = dependencies.forecastPredictions
    || dependencies.recommendationItems
    || dependencies.decisionSuggestions
    || dependencies.criticalAlerts
    ? dependencies
    : getDecisionReadModelSnapshot(sourceData, actorName)

  return resolveReadModel(() => calculateAIAnalysisReport({
    ...createInput,
    ...snapshot,
    ...dependencies,
    sourceData,
    actorName,
    getReportNo: () => getNextAIAnalysisNo(existingReports, createInput.reportDate)
  }), createAIAnalysisFallbackReport(createInput, existingReports, actorName))
}

export const loadAIAnalysisReports = (
  sourceData: KpiSourceData
) => {
  if(!isBrowserStorageAvailable()) return [evaluateAIAnalysisReport(sourceData)]

  const stored = getDecisionIndexedRecord<RawAIAnalysisReport[]>(AI_ANALYSIS_STORAGE_KEY)
  if(stored === null){
    const defaultReport = evaluateAIAnalysisReport(sourceData)
    saveAIAnalysisReports([defaultReport])
    return [defaultReport]
  }

  try {
    if(Array.isArray(stored)){
      const reports = stored
        .filter(isRecord)
        .map((record, index) => normalizeReport(record as RawAIAnalysisReport, index))
        .sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))
      if(reports.length > 0) return reports
    }
  } catch {
    // Bozuk yerel yapay zeka analiz cache kaydi taze read-model raporuyla degistirilir.
  }

  const defaultReport = evaluateAIAnalysisReport(sourceData)
  saveAIAnalysisReports([defaultReport])
  return [defaultReport]
}

const upsertReport = (
  reports: AIAnalysisReport[],
  nextReport: AIAnalysisReport
) => reports.some(report => report.id === nextReport.id)
  ? reports.map(report => report.id === nextReport.id ? nextReport : report)
  : [nextReport, ...reports]

export const addAIAnalysisReport = (
  input: AIAnalysisReportCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadAIAnalysisReports(sourceData)
  const report = evaluateAIAnalysisReport(sourceData, input, reports, actorName)
  const nextReports = upsertReport(reports, report)
  saveAIAnalysisReports(nextReports)
  return report
}

export const filterAIAnalysisReports = (
  reports: AIAnalysisReport[],
  filters: AIAnalysisFilters
) => {
  const search = normalizeSearchText(filters.search)

  return reports.map(report => {
    const filteredInsights = report.insights.filter(insight => {
      const matchesSearch = !search || [
        report.reportNo,
        insight.title,
        insight.summary,
        insight.evidence,
        insight.expectedImpact,
        insight.recommendedAction,
        insight.suggestedPromptContext,
        insight.sourceNo,
        insight.relatedEntityName,
        insight.branchName,
        insight.productionLineName,
        insight.machineCode,
        insight.machineName,
        insight.employeeName,
        insight.categoryName
      ].some(value => normalizeSearchText(value).includes(search))

      return matchesSearch
        && (filters.analysisTitle === ALL_FILTER || insight.analysisTitle === filters.analysisTitle)
        && (filters.insightType === ALL_FILTER || insight.insightType === filters.insightType)
        && (filters.severity === ALL_FILTER || insight.severity === filters.severity)
        && (filters.branchId === ALL_FILTER || insight.branchId === filters.branchId)
        && (filters.productionLineId === ALL_FILTER || insight.productionLineId === filters.productionLineId)
        && (filters.machineId === ALL_FILTER || insight.machineId === filters.machineId)
        && (filters.employeeId === ALL_FILTER || insight.employeeId === filters.employeeId)
        && (!filters.date || report.reportDate === filters.date)
    })
    const visibleInsightIds = new Set(filteredInsights.map(insight => insight.id))

    return {
      ...report,
      insights: filteredInsights,
      findings: report.findings.filter(finding => visibleInsightIds.has(finding.insightId))
    }
  }).filter(report => report.insights.length > 0)
}

export const updateAIAnalysisReportStatus = (
  reportId: string,
  status: Extract<AIAnalysisStatus, 'REVIEWED' | 'ARCHIVED'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadAIAnalysisReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Yapay zeka analiz raporu bulunamadi.')
  const actionByStatus: Record<Extract<AIAnalysisStatus, 'REVIEWED' | 'ARCHIVED'>, AIHistoryAction> = {
    REVIEWED: 'REVIEWED',
    ARCHIVED: 'ARCHIVED'
  }
  const nextReport = appendAIHistory(
    {
      ...report,
      status
    },
    actionByStatus[status],
    actorName,
    `${report.reportNo} ${AI_ANALYSIS_STATUS_LABELS[status]} durumuna alindi.`
  )
  saveAIAnalysisReports(upsertReport(reports, nextReport))
  return nextReport
}

export const recordAIAnalysisOutput = (
  reportId: string,
  action: Extract<AIHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadAIAnalysisReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Yapay zeka analiz raporu bulunamadi.')
  const nextReport = appendAIHistory(
    report,
    action,
    actorName,
    action === 'EXCEL' ? `${report.reportNo} Excel export edildi.` : `${report.reportNo} cikti penceresi acildi.`
  )
  saveAIAnalysisReports(upsertReport(reports, nextReport))
  return nextReport
}

export const AIAnalysisService = {
  createDefaultFilters: createDefaultAIAnalysisFilters,
  createDefaultInput: createDefaultAIAnalysisReportInput,
  getNextNo: getNextAIAnalysisNo,
  save: saveAIAnalysisReports,
  list: loadAIAnalysisReports,
  evaluate: evaluateAIAnalysisReport,
  add: addAIAnalysisReport,
  filter: filterAIAnalysisReports,
  updateStatus: updateAIAnalysisReportStatus,
  recordOutput: recordAIAnalysisOutput,
  statistics: createAIStatistics,
  insight: AIInsightService,
  score: AIScoreService
}
