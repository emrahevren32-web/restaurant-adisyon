import { BottleneckAnalysisService } from '../bottleneck-analysis/bottleneck-analysis.service'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import { ContinuousImprovementService } from '../continuous-improvement/continuous-improvement.service'
import { CriticalAlertService } from '../critical-alerts/critical-alert.service'
import { createDecisionSuggestions } from '../decision-support/decision-support.service'
import { calculateForecastReport } from '../forecasting/forecast-calculation.service'
import type { ForecastPrediction, ForecastReport } from '../forecasting/forecasting.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { MachineSchedulingService } from '../machine-scheduling/machine-scheduling.service'
import { ProductionPlanningService } from '../production-planning/production-planning.service'
import { calculateRecommendationReport } from '../recommendation-engine/recommendation-calculation.service'
import type { RecommendationItem, RecommendationReport } from '../recommendation-engine/recommendation-engine.types'
import { WorkforcePlanningService } from '../workforce-planning/workforce-planning.service'
import { resolveReadModel } from './read-model-safety'

type DecisionSuggestionOptions = NonNullable<Parameters<typeof createDecisionSuggestions>[1]>

export type DecisionReadModelSnapshot = {
  cacheKey: string
  createdAt: string
  productionPlans: ReturnType<typeof ProductionPlanningService.list>
  capacityPlans: ReturnType<typeof CapacityPlanningService.list>
  machineSchedules: ReturnType<typeof MachineSchedulingService.list>
  workforcePlans: ReturnType<typeof WorkforcePlanningService.list>
  bottleneckReports: ReturnType<typeof BottleneckAnalysisService.list>
  improvementReports: ReturnType<typeof ContinuousImprovementService.list>
  criticalAlerts: ReturnType<typeof CriticalAlertService.evaluate>
  decisionSuggestions: ReturnType<typeof createDecisionSuggestions>
  forecastReport: ForecastReport
  forecastPredictions: ForecastPrediction[]
  recommendationReport: RecommendationReport
  recommendationItems: RecommendationItem[]
}

const SNAPSHOT_TTL_MS = 120000
const snapshotCache = new Map<string, { expiresAt: number; snapshot: DecisionReadModelSnapshot }>()

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const baseDecisionOptions: DecisionSuggestionOptions = {
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
}

const getRecordStamp = (value: unknown) => {
  if(!value || typeof value !== 'object' || Array.isArray(value)) return ''
  const record = value as Record<string, unknown>
  return String(
    record.updatedAt
    || record.createdAt
    || record.date
    || record.reportDate
    || record.id
    || record.code
    || ''
  )
}

const getArrayStamp = (items: unknown[]) => {
  const latestStamp = items.reduce<string>((latest, item) => {
    const stamp = getRecordStamp(item)
    return stamp > latest ? stamp : latest
  }, '')

  return `${items.length}:${getRecordStamp(items[0])}:${getRecordStamp(items[items.length - 1])}:${latestStamp}`
}

const createSourceFingerprint = (sourceData: KpiSourceData) => (
  Object.entries(sourceData as Record<string, unknown>)
    .sort(([first], [second]) => first.localeCompare(second, 'tr-TR'))
    .map(([key, value]) => Array.isArray(value)
      ? `${key}=${getArrayStamp(value)}`
      : `${key}=${typeof value}`)
    .join('|')
)

const createEmptySnapshot = (
  cacheKey: string,
  actorName: string
): DecisionReadModelSnapshot => {
  const today = getTodayKey()
  const now = new Date().toISOString()
  const forecastReport: ForecastReport = {
    id: `forecast_snapshot_fallback_${today}`,
    reportNo: `FC-SNAPSHOT-${today}`,
    status: 'GENERATED',
    reportDate: today,
    startDate: today,
    endDate: today,
    horizonDays: 7,
    analysisWindowDays: 30,
    scenarioName: 'Snapshot Tahmin',
    responsiblePerson: actorName,
    description: 'Read-model snapshot fallback tahmin raporu.',
    predictions: [],
    scenarios: [],
    history: [],
    sourceType: 'ReadModel',
    sourceId: 'decision-read-model-snapshot-fallback',
    revisionNo: 1,
    createdBy: actorName,
    createdAt: now,
    updatedAt: now
  }
  const recommendationReport: RecommendationReport = {
    id: `recommendation_snapshot_fallback_${today}`,
    reportNo: `RC-SNAPSHOT-${today}`,
    status: 'GENERATED',
    reportDate: today,
    scope: 'all',
    responsiblePerson: actorName,
    description: 'Read-model snapshot fallback oneri raporu.',
    items: [],
    rules: [],
    history: [],
    sourceType: 'ReadModel',
    sourceId: 'decision-read-model-snapshot-fallback',
    revisionNo: 1,
    createdBy: actorName,
    createdAt: now,
    updatedAt: now
  }

  return {
    cacheKey,
    createdAt: now,
    productionPlans: [],
    capacityPlans: [],
    machineSchedules: [],
    workforcePlans: [],
    bottleneckReports: [],
    improvementReports: [],
    criticalAlerts: [],
    decisionSuggestions: [],
    forecastReport,
    forecastPredictions: [],
    recommendationReport,
    recommendationItems: []
  }
}

const createSnapshot = (
  sourceData: KpiSourceData,
  cacheKey: string,
  actorName: string
): DecisionReadModelSnapshot => {
  const today = getTodayKey()
  const createdAt = new Date().toISOString()
  const productionPlans = ProductionPlanningService.list(sourceData)
  const capacityPlans = CapacityPlanningService.list(sourceData)
  const machineSchedules = MachineSchedulingService.list(sourceData)
  const workforcePlans = WorkforcePlanningService.list(sourceData, { machineSchedules })
  const bottleneckReports = BottleneckAnalysisService.list(sourceData, {
    capacityPlans,
    machineSchedules,
    workforcePlans
  })
  const improvementReports = ContinuousImprovementService.list(sourceData, {
    bottleneckReports,
    capacityPlans,
    machineSchedules,
    workforcePlans
  })
  const criticalAlerts = CriticalAlertService.evaluate(sourceData, [], actorName, {
    bottleneckReports,
    capacityPlans,
    improvementReports,
    machineSchedules,
    workforcePlans
  })
  const decisionSuggestions = createDecisionSuggestions(sourceData, baseDecisionOptions)
  const forecastReport = calculateForecastReport({
    reportDate: today,
    horizonDays: 7,
    analysisWindowDays: 30,
    scenarioName: 'Snapshot Tahmin',
    responsiblePerson: actorName,
    description: 'Read-model snapshot cache tahmin raporu.',
    sourceData,
    bottleneckReports,
    capacityPlans,
    criticalAlerts,
    improvementReports,
    machineSchedules,
    productionPlans,
    workforcePlans,
    actorName,
    getReportNo: () => `FC-SNAPSHOT-${today}`
  })
  const recommendationReport = calculateRecommendationReport({
    reportDate: today,
    scope: 'all',
    responsiblePerson: actorName,
    description: 'Read-model snapshot cache oneri raporu.',
    sourceData,
    bottleneckReports,
    capacityPlans,
    criticalAlerts,
    decisionSuggestions,
    forecastPredictions: forecastReport.predictions,
    improvementReports,
    machineSchedules,
    productionPlans,
    workforcePlans,
    actorName,
    getReportNo: () => `RC-SNAPSHOT-${today}`
  })

  return {
    cacheKey,
    createdAt,
    productionPlans,
    capacityPlans,
    machineSchedules,
    workforcePlans,
    bottleneckReports,
    improvementReports,
    criticalAlerts,
    decisionSuggestions,
    forecastReport,
    forecastPredictions: forecastReport.predictions,
    recommendationReport,
    recommendationItems: recommendationReport.items
  }
}

export const getDecisionReadModelSnapshot = (
  sourceData: KpiSourceData,
  actorName = 'Read Model Snapshot Cache'
) => {
  const fingerprint = createSourceFingerprint(sourceData)
  const cacheKey = `${actorName}|${fingerprint}`
  const now = Date.now()
  const cached = snapshotCache.get(cacheKey)

  if(cached && cached.expiresAt > now) return cached.snapshot

  const snapshot = resolveReadModel(
    () => createSnapshot(sourceData, cacheKey, actorName),
    createEmptySnapshot(cacheKey, actorName)
  )
  snapshotCache.set(cacheKey, {
    expiresAt: now + SNAPSHOT_TTL_MS,
    snapshot
  })

  return snapshot
}

export const clearDecisionReadModelSnapshotCache = () => {
  snapshotCache.clear()
}

export const DecisionReadModelSnapshotService = {
  get: getDecisionReadModelSnapshot,
  clear: clearDecisionReadModelSnapshotCache
}
