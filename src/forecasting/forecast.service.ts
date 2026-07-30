import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { calculateForecastReport, ForecastCalculationService } from './forecast-calculation.service'
import { appendForecastHistory, createForecastHistory } from './forecast-history.service'
import { createForecastStatistics } from './forecast-statistics.service'
import {
  FORECAST_ANALYSIS_WINDOW_OPTIONS,
  FORECAST_HORIZON_OPTIONS,
  FORECAST_RISK_LABELS,
  FORECAST_RISK_LEVELS,
  FORECAST_STATUS_LABELS,
  FORECAST_STATUSES,
  FORECAST_TREND_LABELS,
  FORECAST_TRENDS,
  FORECAST_TYPE_LABELS,
  FORECAST_TYPES
} from './forecasting.constants'
import type {
  ForecastFilters,
  ForecastHistory,
  ForecastHistoryAction,
  ForecastPrediction,
  ForecastReport,
  ForecastReportCreateInput,
  ForecastRiskLevel,
  ForecastScenario,
  ForecastStatus,
  ForecastTrendDirection,
  ForecastType
} from './forecasting.types'

export {
  FORECAST_ANALYSIS_WINDOW_OPTIONS,
  FORECAST_HORIZON_OPTIONS,
  FORECAST_RISK_LABELS,
  FORECAST_RISK_LEVELS,
  FORECAST_STATUS_LABELS,
  FORECAST_STATUSES,
  FORECAST_TREND_LABELS,
  FORECAST_TRENDS,
  FORECAST_TYPE_LABELS,
  FORECAST_TYPES
} from './forecasting.constants'

export const FORECAST_STORAGE_KEY = 'ra_forecasting_engine_records'

type RawForecastReport = Partial<Record<keyof ForecastReport, unknown>> & Record<string, unknown>
type RawForecastPrediction = Partial<Record<keyof ForecastPrediction, unknown>> & Record<string, unknown>
type RawForecastScenario = Partial<Record<keyof ForecastScenario, unknown>> & Record<string, unknown>

const FORECAST_NO_PREFIX = 'FC'
const FORECAST_NO_PADDING = 6

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

const getNextForecastNo = (
  records: Pick<ForecastReport, 'reportNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${FORECAST_NO_PREFIX}-${year}-(\\d{${FORECAST_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.reportNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${FORECAST_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(FORECAST_NO_PADDING, '0')}`
}

export const createDefaultForecastFilters = (): ForecastFilters => ({
  forecastType: ALL_FILTER,
  riskLevel: ALL_FILTER,
  branchId: ALL_FILTER,
  productId: ALL_FILTER,
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  employeeId: ALL_FILTER,
  date: '',
  search: ''
})

export const createDefaultForecastReportInput = (
  responsiblePerson = 'Forecasting Engine'
): ForecastReportCreateInput => ({
  reportDate: getTodayKey(),
  horizonDays: 7,
  analysisWindowDays: 30,
  scenarioName: 'Baz Tahmin',
  responsiblePerson,
  description: ''
})

const mapType = (value: unknown): ForecastType => {
  const normalized = normalizeText(value).toUpperCase() as ForecastType
  return FORECAST_TYPES.includes(normalized) ? normalized : 'DEMAND'
}

const mapStatus = (value: unknown): ForecastStatus => {
  const normalized = normalizeText(value).toUpperCase() as ForecastStatus
  return FORECAST_STATUSES.includes(normalized) ? normalized : 'GENERATED'
}

const mapRisk = (value: unknown): ForecastRiskLevel => {
  const normalized = normalizeText(value).toUpperCase() as ForecastRiskLevel
  return FORECAST_RISK_LEVELS.includes(normalized) ? normalized : 'LOW'
}

const mapTrend = (value: unknown): ForecastTrendDirection => {
  const normalized = normalizeText(value).toUpperCase() as ForecastTrendDirection
  return FORECAST_TRENDS.includes(normalized) ? normalized : 'STABLE'
}

const normalizeHistory = (
  value: unknown,
  reportId: string,
  actorName: string
): ForecastHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${reportId}_history_${index + 1}`,
    reportId,
    action: normalizeText(history.action).toUpperCase() as ForecastHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Forecast raporu guncellendi.',
    revisionNo: normalizeNumber(history.revisionNo) || 1,
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeScenario = (
  value: RawForecastScenario,
  reportId: string,
  index: number
): ForecastScenario => ({
  id: normalizeText(value.id) || `${reportId}_scenario_${index + 1}`,
  reportId,
  name: normalizeText(value.name) || 'Forecast Senaryosu',
  description: normalizeText(value.description),
  demandMultiplier: normalizeNumber(value.demandMultiplier) || 1,
  wasteMultiplier: normalizeNumber(value.wasteMultiplier) || 1,
  qualityRiskMultiplier: normalizeNumber(value.qualityRiskMultiplier) || 1,
  capacityMultiplier: normalizeNumber(value.capacityMultiplier) || 1,
  expectedImpact: normalizeText(value.expectedImpact),
  riskLevel: mapRisk(value.riskLevel)
})

const normalizePrediction = (
  value: RawForecastPrediction,
  reportId: string,
  reportNo: string,
  index: number
): ForecastPrediction => ({
  id: normalizeText(value.id) || `${reportId}_prediction_${index + 1}`,
  reportId,
  reportNo,
  forecastType: mapType(value.forecastType),
  entityType: normalizeText(value.entityType),
  entityId: normalizeText(value.entityId),
  entityName: normalizeText(value.entityName) || 'Forecast',
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
  categoryId: normalizeText(value.categoryId),
  categoryName: normalizeText(value.categoryName),
  supplierId: normalizeText(value.supplierId),
  supplierName: normalizeText(value.supplierName),
  sourceModule: normalizeText(value.sourceModule) as ForecastPrediction['sourceModule'] || 'ReadModel',
  sourceId: normalizeText(value.sourceId),
  sourceNo: normalizeText(value.sourceNo),
  unit: normalizeText(value.unit),
  periodLabel: normalizeText(value.periodLabel),
  baseline7: normalizeNumber(value.baseline7),
  baseline30: normalizeNumber(value.baseline30),
  baseline90: normalizeNumber(value.baseline90),
  baseline365: normalizeNumber(value.baseline365),
  baselineValue: normalizeNumber(value.baselineValue),
  expectedValue: normalizeNumber(value.expectedValue),
  minimumValue: normalizeNumber(value.minimumValue),
  maximumValue: normalizeNumber(value.maximumValue),
  growthPercent: Number(value.growthPercent) || 0,
  seasonalityScore: Number(value.seasonalityScore) || 0,
  confidenceScore: normalizeNumber(value.confidenceScore),
  riskScore: normalizeNumber(value.riskScore),
  riskLevel: mapRisk(value.riskLevel),
  trendDirection: mapTrend(value.trendDirection),
  expectedDemand: normalizeNumber(value.expectedDemand),
  expectedProduction: normalizeNumber(value.expectedProduction),
  expectedStock: Number(value.expectedStock) || 0,
  expectedWaste: normalizeNumber(value.expectedWaste),
  expectedShipment: normalizeNumber(value.expectedShipment),
  expectedCapacityPercent: normalizeNumber(value.expectedCapacityPercent),
  expectedPersonnelNeed: normalizeNumber(value.expectedPersonnelNeed),
  daysToCritical: Number(value.daysToCritical) || 999,
  recommendation: normalizeText(value.recommendation),
  evidence: normalizeText(value.evidence),
  createdAt: normalizeText(value.createdAt) || new Date().toISOString()
})

const normalizeReport = (
  value: RawForecastReport,
  index: number
): ForecastReport => {
  const reportDate = normalizeText(value.reportDate) || getTodayKey()
  const reportNo = normalizeText(value.reportNo) || getNextForecastNo([], reportDate, index)
  const id = normalizeText(value.id) || `forecast_report_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const createdAt = normalizeText(value.createdAt) || new Date().toISOString()
  const actorName = 'Forecasting Engine'
  const predictions = Array.isArray(value.predictions)
    ? value.predictions.filter(isRecord).map((prediction, predictionIndex) => normalizePrediction(prediction as RawForecastPrediction, id, reportNo, predictionIndex))
    : []
  const scenarios = Array.isArray(value.scenarios)
    ? value.scenarios.filter(isRecord).map((scenario, scenarioIndex) => normalizeScenario(scenario as RawForecastScenario, id, scenarioIndex))
    : []
  const history = normalizeHistory(value.history, id, actorName)

  return {
    id,
    reportNo,
    status: mapStatus(value.status),
    reportDate,
    startDate: normalizeText(value.startDate) || addDays(reportDate, 1),
    endDate: normalizeText(value.endDate) || addDays(reportDate, normalizeNumber(value.horizonDays) || 7),
    horizonDays: normalizeNumber(value.horizonDays) || 7,
    analysisWindowDays: normalizeNumber(value.analysisWindowDays) || 30,
    scenarioName: normalizeText(value.scenarioName) || 'Baz Tahmin',
    responsiblePerson: normalizeText(value.responsiblePerson) || actorName,
    description: normalizeText(value.description),
    predictions,
    scenarios,
    history: history.length > 0
      ? history
      : [createForecastHistory(id, 'CREATED', actorName, `${reportNo} forecast read-model olarak olusturuldu.`)],
    sourceType: normalizeText(value.sourceType) === 'ManualReadModel' ? 'ManualReadModel' : 'ReadModel',
    sourceId: normalizeText(value.sourceId) || 'forecasting-engine',
    revisionNo: normalizeNumber(value.revisionNo) || 1,
    createdBy: normalizeText(value.createdBy) || actorName,
    createdAt,
    updatedAt: normalizeText(value.updatedAt) || createdAt
  }
}

export const saveForecastReports = (reports: ForecastReport[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(FORECAST_STORAGE_KEY, JSON.stringify(reports))
}

export const evaluateForecastReport = (
  sourceData: KpiSourceData,
  input: Partial<ForecastReportCreateInput> = {},
  existingReports: ForecastReport[] = [],
  actorName = 'Forecasting Engine'
) => {
  const createInput = {
    ...createDefaultForecastReportInput(actorName),
    ...input
  }

  return calculateForecastReport({
    ...createInput,
    sourceData,
    actorName,
    getReportNo: () => getNextForecastNo(existingReports, createInput.reportDate)
  })
}

export const loadForecastReports = (
  sourceData: KpiSourceData
) => {
  const defaultReport = evaluateForecastReport(sourceData)
  if(!isBrowserStorageAvailable()) return [defaultReport]

  const stored = localStorage.getItem(FORECAST_STORAGE_KEY)
  if(stored === null){
    saveForecastReports([defaultReport])
    return [defaultReport]
  }

  try {
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)){
      const reports = parsed
        .filter(isRecord)
        .map((record, index) => normalizeReport(record as RawForecastReport, index))
        .sort((first, second) => second.reportDate.localeCompare(first.reportDate) || first.reportNo.localeCompare(second.reportNo))
      return reports.length > 0 ? reports : [defaultReport]
    }
  } catch {
    // Corrupt local forecast cache is replaced with a fresh read-model forecast.
  }

  saveForecastReports([defaultReport])
  return [defaultReport]
}

const upsertReport = (
  reports: ForecastReport[],
  nextReport: ForecastReport
) => reports.some(report => report.id === nextReport.id)
  ? reports.map(report => report.id === nextReport.id ? nextReport : report)
  : [nextReport, ...reports]

export const addForecastReport = (
  input: ForecastReportCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadForecastReports(sourceData)
  const report = evaluateForecastReport(sourceData, input, reports, actorName)
  const nextReports = upsertReport(reports, report)
  saveForecastReports(nextReports)
  return report
}

export const filterForecastReports = (
  reports: ForecastReport[],
  filters: ForecastFilters
) => {
  const search = normalizeSearchText(filters.search)

  return reports.map(report => {
    const filteredPredictions = report.predictions.filter(prediction => {
      const matchesSearch = !search || [
        report.reportNo,
        prediction.entityName,
        prediction.productName,
        prediction.stockItemName,
        prediction.branchName,
        prediction.productionLineName,
        prediction.machineCode,
        prediction.employeeName,
        prediction.supplierName,
        prediction.recommendation,
        prediction.evidence
      ].some(value => normalizeSearchText(value).includes(search))

      return matchesSearch
        && (filters.forecastType === ALL_FILTER || prediction.forecastType === filters.forecastType)
        && (filters.riskLevel === ALL_FILTER || prediction.riskLevel === filters.riskLevel)
        && (filters.branchId === ALL_FILTER || prediction.branchId === filters.branchId)
        && (filters.productId === ALL_FILTER || prediction.productId === filters.productId || prediction.stockItemId === filters.productId)
        && (filters.productionLineId === ALL_FILTER || prediction.productionLineId === filters.productionLineId)
        && (filters.machineId === ALL_FILTER || prediction.machineId === filters.machineId)
        && (filters.employeeId === ALL_FILTER || prediction.employeeId === filters.employeeId)
        && (!filters.date || report.reportDate === filters.date)
    })

    return {
      ...report,
      predictions: filteredPredictions
    }
  }).filter(report => report.predictions.length > 0)
}

export const updateForecastReportStatus = (
  reportId: string,
  status: Extract<ForecastStatus, 'REVIEWED' | 'ARCHIVED'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadForecastReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Forecast report bulunamadi.')
  const actionByStatus: Record<Extract<ForecastStatus, 'REVIEWED' | 'ARCHIVED'>, ForecastHistoryAction> = {
    REVIEWED: 'REVIEWED',
    ARCHIVED: 'ARCHIVED'
  }
  const nextReport = appendForecastHistory(
    {
      ...report,
      status
    },
    actionByStatus[status],
    actorName,
    `${report.reportNo} ${FORECAST_STATUS_LABELS[status]} durumuna alindi.`
  )
  saveForecastReports(upsertReport(reports, nextReport))
  return nextReport
}

export const recordForecastOutput = (
  reportId: string,
  action: Extract<ForecastHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const reports = loadForecastReports(sourceData)
  const report = reports.find(record => record.id === reportId)
  if(!report) throw new Error('Forecast report bulunamadi.')
  const nextReport = appendForecastHistory(
    report,
    action,
    actorName,
    action === 'EXCEL' ? `${report.reportNo} Excel export edildi.` : `${report.reportNo} cikti penceresi acildi.`
  )
  saveForecastReports(upsertReport(reports, nextReport))
  return nextReport
}

export const ForecastService = {
  createDefaultFilters: createDefaultForecastFilters,
  createDefaultInput: createDefaultForecastReportInput,
  getNextNo: getNextForecastNo,
  save: saveForecastReports,
  list: loadForecastReports,
  evaluate: evaluateForecastReport,
  add: addForecastReport,
  filter: filterForecastReports,
  updateStatus: updateForecastReportStatus,
  recordOutput: recordForecastOutput,
  statistics: createForecastStatistics,
  calculation: ForecastCalculationService
}
