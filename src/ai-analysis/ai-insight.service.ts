import { BottleneckAnalysisService } from '../bottleneck-analysis/bottleneck-analysis.service'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import { ContinuousImprovementService } from '../continuous-improvement/continuous-improvement.service'
import { CriticalAlertService } from '../critical-alerts/critical-alert.service'
import type { CriticalAlert } from '../critical-alerts/critical-alert.types'
import { createDecisionSuggestions } from '../decision-support/decision-support.service'
import type { DecisionSuggestion } from '../decision-support/decision-support.types'
import { ForecastService } from '../forecasting/forecast.service'
import type { ForecastPrediction } from '../forecasting/forecasting.types'
import type { KpiSourceData, KpiTone } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  averageBy,
  formatNumber,
  formatPercent,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import { MachineSchedulingService } from '../machine-scheduling/machine-scheduling.service'
import { ProductionPlanningService } from '../production-planning/production-planning.service'
import { RecommendationService } from '../recommendation-engine/recommendation.service'
import type { RecommendationItem } from '../recommendation-engine/recommendation-engine.types'
import { WorkforcePlanningService } from '../workforce-planning/workforce-planning.service'
import { AI_ANALYSIS_TITLES, AI_INSIGHT_TYPE_LABELS } from './ai-analysis.constants'
import { createAIHistory } from './ai-history.service'
import {
  calculateAIConfidence,
  calculateAIPriorityScore,
  createAIScore,
  mapAISeverity
} from './ai-score.service'
import type {
  AIAnalysisReport,
  AIAnalysisReportCreateInput,
  AIAnalysisTitle,
  AIFinding,
  AIInsight,
  AIInsightType,
  AIScore,
  AISourceModule
} from './ai-analysis.types'

type AIInsightCalculationInput = AIAnalysisReportCreateInput & {
  sourceData: KpiSourceData
  getReportNo: () => string
  actorName: string
  bottleneckReports?: ReturnType<typeof BottleneckAnalysisService.list>
  capacityPlans?: ReturnType<typeof CapacityPlanningService.list>
  criticalAlerts?: CriticalAlert[]
  decisionSuggestions?: DecisionSuggestion[]
  forecastPredictions?: ForecastPrediction[]
  improvementReports?: ReturnType<typeof ContinuousImprovementService.list>
  machineSchedules?: ReturnType<typeof MachineSchedulingService.list>
  productionPlans?: ReturnType<typeof ProductionPlanningService.list>
  recommendationItems?: RecommendationItem[]
  workforcePlans?: ReturnType<typeof WorkforcePlanningService.list>
}

type AIInsightInput = {
  reportId: string
  reportNo: string
  analysisTitle: AIAnalysisTitle
  insightType: AIInsightType
  title: string
  summary: string
  evidence: string
  expectedImpact: string
  suggestedPromptContext: string
  recommendedAction: string
  sourceModule: AISourceModule
  sourceId: string
  sourceNo: string
  relatedModules?: AISourceModule[]
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityName: string
  branchId?: string
  branchName?: string
  productionLineId?: string
  productionLineName?: string
  machineId?: string
  machineCode?: string
  machineName?: string
  employeeId?: string
  employeeName?: string
  categoryId?: string
  categoryName?: string
  riskScore: number
  impactScore: number
  priorityScore?: number
  trendScore: number
  confidenceScore?: number
  expectedGainScore?: number
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')
const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeKey = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')

const clamp = (
  value: number,
  min = 0,
  max = 100
) => Math.max(min, Math.min(max, value))

const mapDecisionTitle = (
  suggestion: DecisionSuggestion
): AIAnalysisTitle => {
  if(suggestion.category === 'Inventory') return 'STOCK'
  if(suggestion.category === 'Quality') return 'QUALITY'
  if(suggestion.category === 'Purchasing') return 'STOCK'
  if(suggestion.category === 'Shipment') return 'SHIPMENT'
  if(suggestion.ruleId.includes('machine')) return 'MACHINE'
  if(suggestion.ruleId.includes('maintenance') || suggestion.ruleId.includes('bakim')) return 'MAINTENANCE'
  if(suggestion.ruleId.includes('workforce') || suggestion.ruleId.includes('personnel')) return 'PERSONNEL'
  if(suggestion.ruleId.includes('capacity')) return 'CAPACITY'
  if(suggestion.ruleId.includes('waste') || suggestion.ruleId.includes('fire')) return 'WASTE'
  return 'PRODUCTION'
}

const mapForecastTitle = (
  prediction: ForecastPrediction
): AIAnalysisTitle => {
  if(prediction.forecastType === 'STOCK' || prediction.forecastType === 'PURCHASING') return 'STOCK'
  if(prediction.forecastType === 'QUALITY') return 'QUALITY'
  if(prediction.forecastType === 'SHIPMENT') return 'SHIPMENT'
  if(prediction.forecastType === 'PERSONNEL') return 'PERSONNEL'
  if(prediction.forecastType === 'WASTE') return 'WASTE'
  return 'PRODUCTION'
}

const mapRecommendationTitle = (
  item: RecommendationItem
): AIAnalysisTitle => {
  if(item.recommendationType === 'PURCHASING' || item.recommendationType === 'STOCK') return 'STOCK'
  if(item.recommendationType === 'QUALITY') return 'QUALITY'
  if(item.recommendationType === 'MACHINE') return 'MACHINE'
  if(item.recommendationType === 'PERSONNEL') return 'PERSONNEL'
  if(item.recommendationType === 'MAINTENANCE') return 'MAINTENANCE'
  if(item.recommendationType === 'SHIPMENT') return 'SHIPMENT'
  if(item.recommendationType === 'ENERGY') return 'ENERGY'
  if(item.recommendationType === 'WASTE') return 'WASTE'
  return 'PRODUCTION'
}

const mapAlertTitle = (
  alert: CriticalAlert
): AIAnalysisTitle => {
  if(alert.category === 'STOCK' || alert.category === 'GOODS_RECEIPT' || alert.category === 'LOT') return 'STOCK'
  if(alert.category === 'QUALITY' || alert.category === 'HACCP') return 'QUALITY'
  if(alert.category === 'SHIPMENT') return 'SHIPMENT'
  if(alert.category === 'MACHINE') return 'MACHINE'
  if(alert.category === 'MAINTENANCE') return 'MAINTENANCE'
  if(alert.category === 'PERSONNEL') return 'PERSONNEL'
  if(alert.category === 'CAPACITY') return 'CAPACITY'
  return 'PRODUCTION'
}

const createInsight = (
  input: AIInsightInput
): AIInsight => {
  const riskScore = roundKpi(clamp(input.riskScore))
  const impactScore = roundKpi(clamp(input.impactScore))
  const trendScore = roundKpi(clamp(input.trendScore))
  const confidenceScore = roundKpi(clamp(input.confidenceScore ?? calculateAIConfidence((input.relatedModules || []).length + 1, 1)))
  const priorityScore = roundKpi(clamp(input.priorityScore ?? calculateAIPriorityScore(riskScore, impactScore, trendScore, confidenceScore)))
  const id = `ai_insight_${input.reportNo}_${normalizeKey(input.sourceModule)}_${normalizeKey(input.relatedEntityId || input.title)}_${normalizeKey(input.insightType)}`

  return {
    id,
    reportId: input.reportId,
    reportNo: input.reportNo,
    analysisTitle: input.analysisTitle,
    insightType: input.insightType,
    severity: mapAISeverity(riskScore),
    title: input.title,
    summary: input.summary,
    evidence: input.evidence,
    expectedImpact: input.expectedImpact,
    suggestedPromptContext: input.suggestedPromptContext,
    recommendedAction: input.recommendedAction,
    sourceModule: input.sourceModule,
    sourceId: input.sourceId,
    sourceNo: input.sourceNo,
    relatedModules: Array.from(new Set([input.sourceModule, ...(input.relatedModules || [])])),
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    relatedEntityName: input.relatedEntityName,
    branchId: input.branchId || '',
    branchName: input.branchName || '',
    productionLineId: input.productionLineId || '',
    productionLineName: input.productionLineName || '',
    machineId: input.machineId || '',
    machineCode: input.machineCode || '',
    machineName: input.machineName || '',
    employeeId: input.employeeId || '',
    employeeName: input.employeeName || '',
    categoryId: input.categoryId || input.analysisTitle,
    categoryName: input.categoryName || input.analysisTitle,
    confidenceScore,
    riskScore,
    impactScore,
    priorityScore,
    trendScore,
    expectedGainScore: roundKpi(clamp(input.expectedGainScore ?? impactScore * 0.55 + priorityScore * 0.25)),
    createdAt: new Date().toISOString()
  }
}

const createDecisionSupportInsights = (
  input: AIInsightCalculationInput,
  reportId: string,
  reportNo: string
) => (input.decisionSuggestions || createDecisionSuggestions(input.sourceData, {
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
}))
  .filter(suggestion => suggestion.risk === 'HIGH' || suggestion.risk === 'CRITICAL' || suggestion.priority === 'URGENT')
  .slice(0, 10)
  .map(suggestion => createInsight({
    reportId,
    reportNo,
    analysisTitle: mapDecisionTitle(suggestion),
    insightType: suggestion.ruleId.includes('forecasting') ? 'EXPECTED_IMPACT' : 'RISK',
    title: `${suggestion.title} AI analize hazir`,
    summary: suggestion.description,
    evidence: suggestion.reason,
    expectedImpact: suggestion.recommendation.expectedImpact,
    suggestedPromptContext: `Karar destek kuralı=${suggestion.ruleId}; risk=${suggestion.risk}; öncelik=${suggestion.priority}; durum=${suggestion.status}.`,
    recommendedAction: suggestion.recommendation.action,
    sourceModule: 'DecisionSupport',
    sourceId: suggestion.id,
    sourceNo: suggestion.ruleId,
    relatedModules: ['DecisionSupport'],
    relatedEntityType: suggestion.relatedEntityType,
    relatedEntityId: suggestion.relatedEntityId,
    relatedEntityName: suggestion.title,
    branchId: suggestion.branchId,
    productionLineId: suggestion.warehouseId,
    riskScore: suggestion.riskScore,
    impactScore: clamp(suggestion.riskScore * 0.72 + 18),
    trendScore: suggestion.ruleId.includes('forecasting') ? 78 : 58,
    confidenceScore: 76,
    expectedGainScore: suggestion.riskScore * 0.62
  }))

const createCriticalAlertInsights = (
  input: AIInsightCalculationInput,
  reportId: string,
  reportNo: string
) => (input.criticalAlerts || CriticalAlertService.evaluate(input.sourceData))
  .filter(alert => alert.status === 'ACTIVE' || alert.level === 'CRITICAL' || alert.level === 'HIGH' || alert.repeatCount > 1)
  .slice(0, 10)
  .map(alert => createInsight({
    reportId,
    reportNo,
    analysisTitle: mapAlertTitle(alert),
    insightType: alert.repeatCount > 1 ? 'REPEATING_PROBLEM' : 'ANOMALY',
    title: `${alert.title} AI bulgusu`,
    summary: alert.description,
    evidence: `${alert.reason} Tekrar ${formatNumber(alert.repeatCount)}, sure ${formatNumber(alert.durationMinutes)} dk.`,
    expectedImpact: alert.expectedImpact,
    suggestedPromptContext: `Kritik alarm no=${alert.alertNo}; kaynak=${alert.sourceModule}; seviye=${alert.level}; öncelik=${alert.priority}.`,
    recommendedAction: alert.recommendedAction,
    sourceModule: 'CriticalAlerts',
    sourceId: alert.id,
    sourceNo: alert.alertNo,
    relatedModules: ['CriticalAlerts', alert.sourceModule as AISourceModule],
    relatedEntityType: alert.relatedEntityType,
    relatedEntityId: alert.relatedEntityId,
    relatedEntityName: alert.relatedEntityName,
    branchId: alert.branchId,
    branchName: alert.branchName,
    productionLineId: alert.productionLineId,
    productionLineName: alert.productionLineName,
    machineId: alert.machineId,
    machineCode: alert.machineCode,
    machineName: alert.machineName,
    employeeId: alert.employeeId,
    employeeName: alert.employeeName,
    riskScore: alert.riskScore,
    impactScore: alert.impactScore,
    trendScore: clamp(alert.repeatCount * 14 + alert.durationMinutes / 20),
    confidenceScore: 82,
    expectedGainScore: alert.impactScore * 0.55 + alert.riskScore * 0.25
  }))

const createForecastInsights = (
  input: AIInsightCalculationInput,
  reportId: string,
  reportNo: string
) => (input.forecastPredictions || ForecastService.evaluate(input.sourceData).predictions)
  .filter(prediction => prediction.riskLevel === 'HIGH' || prediction.riskLevel === 'CRITICAL' || prediction.growthPercent >= 10 || prediction.daysToCritical <= 4)
  .slice(0, 12)
  .map(prediction => createInsight({
    reportId,
    reportNo,
    analysisTitle: mapForecastTitle(prediction),
    insightType: prediction.daysToCritical <= 4 ? 'RISK' : prediction.growthPercent >= 10 ? 'EXPECTED_IMPACT' : 'ANOMALY',
    title: `${prediction.entityName} tahmin sinyali`,
    summary: prediction.recommendation,
    evidence: `${prediction.evidence} Beklenen ${formatNumber(prediction.expectedValue, 1)} ${prediction.unit}, buyume ${formatPercent(prediction.growthPercent)}.`,
    expectedImpact: prediction.daysToCritical <= 4
      ? 'Kritik seviyeye inis riski AI analiz datasinda onceliklendirilir.'
      : 'Trend degisimi operasyon planina etki edebilir.',
    suggestedPromptContext: `Tahmin türü=${prediction.forecastType}; trend=${prediction.trendDirection}; risk=${prediction.riskLevel}; dönem=${prediction.periodLabel}.`,
    recommendedAction: prediction.recommendation,
    sourceModule: 'Forecasting',
    sourceId: prediction.id,
    sourceNo: prediction.reportNo,
    relatedModules: ['Forecasting'],
    relatedEntityType: prediction.entityType,
    relatedEntityId: prediction.entityId,
    relatedEntityName: prediction.entityName,
    branchId: prediction.branchId,
    branchName: prediction.branchName,
    productionLineId: prediction.productionLineId,
    productionLineName: prediction.productionLineName,
    machineId: prediction.machineId,
    machineCode: prediction.machineCode,
    machineName: prediction.machineName,
    employeeId: prediction.employeeId,
    employeeName: prediction.employeeName,
    categoryId: prediction.categoryId,
    categoryName: prediction.categoryName,
    riskScore: prediction.riskScore,
    impactScore: clamp(Math.abs(prediction.growthPercent) + prediction.riskScore * 0.58 + prediction.seasonalityScore * 0.2),
    trendScore: clamp(Math.abs(prediction.growthPercent) * 1.4 + prediction.seasonalityScore * 0.7),
    confidenceScore: prediction.confidenceScore,
    expectedGainScore: prediction.riskScore * 0.42 + prediction.confidenceScore * 0.22
  }))

const createRecommendationInsights = (
  input: AIInsightCalculationInput,
  reportId: string,
  reportNo: string
) => (input.recommendationItems || RecommendationService.evaluate(input.sourceData).items)
  .filter(item => item.risk === 'HIGH' || item.risk === 'CRITICAL' || item.priority === 'URGENT' || item.expectedBenefitScore >= 70)
  .slice(0, 14)
  .map(item => createInsight({
    reportId,
    reportNo,
    analysisTitle: mapRecommendationTitle(item),
    insightType: item.expectedBenefitScore >= 75 ? 'OPPORTUNITY' : 'RISK',
    title: `${item.title} AI insight`,
    summary: item.description,
    evidence: `${item.reason} Fayda ${formatNumber(item.expectedBenefitScore, 1)}, kapasite ${formatNumber(item.expectedCapacityGain, 1)}, sure ${formatNumber(item.expectedTimeGainMinutes, 1)} dk.`,
    expectedImpact: item.expectedImpact,
    suggestedPromptContext: `Öneri kaynağı=${item.sourceModule}; risk=${item.risk}; öncelik=${item.priority}; güven=${formatNumber(item.confidenceScore, 1)}.`,
    recommendedAction: item.action,
    sourceModule: 'RecommendationEngine',
    sourceId: item.id,
    sourceNo: item.reportNo,
    relatedModules: ['RecommendationEngine', ...item.relatedModules.map(module => module as AISourceModule)],
    relatedEntityType: item.relatedEntityType,
    relatedEntityId: item.relatedEntityId,
    relatedEntityName: item.relatedEntityName,
    branchId: item.branchId,
    branchName: item.branchName,
    productionLineId: item.productionLineId,
    productionLineName: item.productionLineName,
    machineId: item.machineId,
    machineCode: item.machineCode,
    machineName: item.machineName,
    employeeId: item.employeeId,
    employeeName: item.employeeName,
    riskScore: item.riskScore,
    impactScore: item.expectedBenefitScore,
    trendScore: item.expectedCapacityGain * 2 + item.expectedTimeGainMinutes / 10,
    confidenceScore: item.confidenceScore,
    expectedGainScore: item.expectedBenefitScore + item.expectedCapacityGain + item.expectedTimeGainMinutes / 10
  }))

const createCapacityInsights = (
  input: AIInsightCalculationInput,
  reportId: string,
  reportNo: string
) => (input.capacityPlans || CapacityPlanningService.list(input.sourceData))
  .flatMap(plan => plan.machineCapacities.map(capacity => ({ plan, capacity })))
  .filter(row => row.capacity.riskLevel === 'HIGH' || row.capacity.riskLevel === 'CRITICAL' || row.capacity.utilizationPercent >= 90 || row.capacity.overloadMinutes > 0)
  .slice(0, 8)
  .map(row => createInsight({
    reportId,
    reportNo,
    analysisTitle: 'CAPACITY',
    insightType: row.capacity.overloadMinutes > 0 ? 'ANOMALY' : 'RISK',
    title: `${row.capacity.machineCode || row.capacity.machineName} kapasite yuk sinyali`,
    summary: `${row.capacity.machineName} kullanim orani ${formatPercent(row.capacity.utilizationPercent)} seviyesinde.`,
    evidence: `Yuk ${formatNumber(row.capacity.totalLoadMinutes)} dk, bos sure ${formatNumber(row.capacity.idleMinutes)} dk, overload ${formatNumber(row.capacity.overloadMinutes)} dk.`,
    expectedImpact: 'Kapasite daralmasi uretim, sevkiyat ve personel planina etki edebilir.',
    suggestedPromptContext: `Kapasite planı=${row.plan.capacityPlanNo}; vardiya=${row.capacity.shift}; risk=${row.capacity.riskLevel}.`,
    recommendedAction: row.capacity.recommendations[0] || 'Kapasite ve alternatif makine senaryosu manuel incelenmeli.',
    sourceModule: 'CapacityPlanning',
    sourceId: row.capacity.id,
    sourceNo: row.plan.capacityPlanNo,
    relatedModules: ['CapacityPlanning'],
    relatedEntityType: 'MachineCapacity',
    relatedEntityId: row.capacity.machineId,
    relatedEntityName: row.capacity.machineName,
    productionLineId: row.capacity.productionLineId,
    productionLineName: row.capacity.productionLineName,
    machineId: row.capacity.machineId,
    machineCode: row.capacity.machineCode,
    machineName: row.capacity.machineName,
    riskScore: row.capacity.riskLevel === 'CRITICAL' ? 88 : row.capacity.riskLevel === 'HIGH' ? 72 : row.capacity.utilizationPercent * 0.72,
    impactScore: clamp(row.capacity.utilizationPercent * 0.65 + row.capacity.overloadMinutes / 5),
    trendScore: clamp(row.capacity.overloadMinutes / 4 + row.capacity.utilizationPercent * 0.45),
    confidenceScore: 74,
    expectedGainScore: clamp(row.capacity.idleMinutes / 8 + row.capacity.overloadMinutes / 3 + row.capacity.utilizationPercent * 0.25)
  }))

const createBottleneckInsights = (
  input: AIInsightCalculationInput,
  reportId: string,
  reportNo: string
) => (input.bottleneckReports || BottleneckAnalysisService.list(input.sourceData))
  .flatMap(report => report.items.map(item => ({ report, item })))
  .filter(row => row.item.critical || row.item.riskLevel === 'HIGH' || row.item.riskLevel === 'CRITICAL')
  .slice(0, 8)
  .map(row => createInsight({
    reportId,
    reportNo,
    analysisTitle: row.item.bottleneckType === 'PERSONNEL' ? 'PERSONNEL' : row.item.bottleneckType === 'MAINTENANCE' ? 'MAINTENANCE' : row.item.bottleneckType === 'MACHINE' ? 'MACHINE' : 'CAPACITY',
    insightType: 'REPEATING_PROBLEM',
    title: `${row.item.entityName} darbogaz paterni`,
    summary: row.item.recommendation,
    evidence: `Risk ${formatNumber(row.item.riskScore, 1)}, bekleme ${formatNumber(row.item.waitingMinutes)} dk, setup ${formatNumber(row.item.setupMinutes)} dk.`,
    expectedImpact: 'Darbogaz paterni yapay zeka analiz verisinde tekrar eden problem olarak isaretlenir.',
    suggestedPromptContext: `Darboğaz raporu=${row.report.reportNo}; tür=${row.item.bottleneckType}; kaynak=${row.item.sourceType}.`,
    recommendedAction: row.item.recommendation,
    sourceModule: 'BottleneckAnalysis',
    sourceId: row.item.id,
    sourceNo: row.report.reportNo,
    relatedModules: ['BottleneckAnalysis', row.item.sourceType as AISourceModule],
    relatedEntityType: 'BottleneckItem',
    relatedEntityId: row.item.entityId,
    relatedEntityName: row.item.entityName,
    productionLineId: row.item.productionLineId,
    productionLineName: row.item.productionLineName,
    machineId: row.item.machineId,
    machineCode: row.item.machineCode,
    machineName: row.item.machineName,
    employeeId: row.item.employeeId,
    employeeName: row.item.employeeName,
    riskScore: row.item.riskScore,
    impactScore: clamp(row.item.waitingMinutes / 5 + row.item.overloadMinutes / 4 + row.item.utilizationPercent * 0.35),
    trendScore: clamp(row.item.waitingMinutes / 6 + row.item.setupMinutes / 4 + row.item.maintenanceMinutes / 4),
    confidenceScore: 80,
    expectedGainScore: clamp(row.item.waitingMinutes / 4 + row.item.idleMinutes / 8)
  }))

const createImprovementInsights = (
  input: AIInsightCalculationInput,
  reportId: string,
  reportNo: string
) => (input.improvementReports || ContinuousImprovementService.list(input.sourceData))
  .flatMap(report => report.opportunities.map(opportunity => ({ report, opportunity })))
  .filter(row => row.opportunity.priority === 'URGENT' || row.opportunity.riskLevel === 'HIGH' || row.opportunity.riskLevel === 'CRITICAL' || row.opportunity.expectedBenefitScore >= 65)
  .slice(0, 8)
  .map(row => createInsight({
    reportId,
    reportNo,
    analysisTitle: row.opportunity.area === 'ENERGY' ? 'ENERGY' : row.opportunity.area === 'MAINTENANCE' ? 'MAINTENANCE' : row.opportunity.area === 'PERSONNEL' || row.opportunity.area === 'SHIFT' ? 'PERSONNEL' : row.opportunity.area === 'MACHINE' ? 'MACHINE' : 'CAPACITY',
    insightType: 'OPPORTUNITY',
    title: `${row.opportunity.entityName} iyilestirme firsati`,
    summary: row.opportunity.summary,
    evidence: `Beklenen kazanc ${formatNumber(row.opportunity.expectedGainMinutes)} dk, fayda ${formatNumber(row.opportunity.expectedBenefitScore, 1)}.`,
    expectedImpact: `${formatPercent(row.opportunity.expectedGainPercent)} iyilesme potansiyeli yapay zeka analiz veri setine eklendi.`,
    suggestedPromptContext: `Sürekli iyileştirme raporu=${row.report.reportNo}; alan=${row.opportunity.area}; öncelik=${row.opportunity.priority}.`,
    recommendedAction: row.report.recommendations.find(recommendation => recommendation.area === row.opportunity.area)?.action || 'Iyilestirme firsati manuel aksiyon listesine alinmali.',
    sourceModule: 'ContinuousImprovement',
    sourceId: row.opportunity.id,
    sourceNo: row.report.reportNo,
    relatedModules: ['ContinuousImprovement', row.opportunity.sourceType as AISourceModule],
    relatedEntityType: 'ImprovementOpportunity',
    relatedEntityId: row.opportunity.entityId,
    relatedEntityName: row.opportunity.entityName,
    productionLineId: row.opportunity.productionLineId,
    productionLineName: row.opportunity.productionLineName,
    machineId: row.opportunity.machineId,
    machineCode: row.opportunity.machineCode,
    machineName: row.opportunity.machineName,
    employeeId: row.opportunity.employeeId,
    employeeName: row.opportunity.employeeName,
    categoryId: row.opportunity.area,
    categoryName: row.opportunity.department || row.opportunity.area,
    riskScore: row.opportunity.riskLevel === 'CRITICAL' ? 88 : row.opportunity.riskLevel === 'HIGH' ? 72 : 48,
    impactScore: row.opportunity.expectedBenefitScore,
    trendScore: clamp(row.opportunity.expectedGainPercent + row.opportunity.expectedGainMinutes / 10),
    confidenceScore: 78,
    expectedGainScore: row.opportunity.expectedBenefitScore + row.opportunity.expectedGainMinutes / 10
  }))

const createKpiInsights = (
  sourceData: KpiSourceData,
  reportId: string,
  reportNo: string
) => {
  const today = getTodayKey()
  const openProductionOrders = sourceData.productionOrders.filter(order => (
    !String(order.status || '').toLocaleLowerCase('tr-TR').includes('tamam')
    && !String(order.status || '').toLocaleLowerCase('tr-TR').includes('iptal')
  )).length
  const criticalStocks = sourceData.stockItems.filter(item => item.currentQty <= item.minQty).length
  const openRecalls = sourceData.productRecalls.filter(recall => recall.status !== 'COMPLETED' && recall.status !== 'CANCELLED').length
  const delayedShipments = sourceData.shipmentPlans.filter(plan => (
    plan.status !== 'COMPLETED'
    && plan.status !== 'CANCELLED'
    && String(plan.planDate || '').slice(0, 10) < today
  )).length
  const rejectedReceipts = sourceData.goodsReceipts.filter(receipt => receipt.status === 'REJECTED' || receipt.status === 'PARTIAL_ACCEPTED').length
  const cards: Array<{
    area: AIAnalysisTitle
    card: {
      id: string
      label: string
      value: string
      detail: string
      tone: KpiTone
    }
  }> = [
    {
      area: 'PRODUCTION',
      card: {
        id: 'ai-kpi-open-production',
        label: 'Acik Uretim Emirleri',
        value: formatNumber(openProductionOrders),
        detail: 'Tamamlanmamis uretim emirleri',
        tone: openProductionOrders > 0 ? 'warning' : 'success'
      }
    },
    {
      area: 'STOCK',
      card: {
        id: 'ai-kpi-critical-stock',
        label: 'Kritik Stok',
        value: formatNumber(criticalStocks),
        detail: 'Min seviyenin altindaki stoklar',
        tone: criticalStocks > 0 ? 'danger' : 'success'
      }
    },
    {
      area: 'QUALITY',
      card: {
        id: 'ai-kpi-open-recalls',
        label: 'Acik Recall',
        value: formatNumber(openRecalls),
        detail: 'Kapanmamis kalite recall kayitlari',
        tone: openRecalls > 0 ? 'danger' : 'success'
      }
    },
    {
      area: 'SHIPMENT',
      card: {
        id: 'ai-kpi-delayed-shipments',
        label: 'Geciken Sevkiyat',
        value: formatNumber(delayedShipments),
        detail: 'Plan tarihi gecmis tamamlanmamis sevkiyatlar',
        tone: delayedShipments > 0 ? 'warning' : 'success'
      }
    },
    {
      area: 'STOCK',
      card: {
        id: 'ai-kpi-rejected-receipts',
        label: 'Mal Kabul Riski',
        value: formatNumber(rejectedReceipts),
        detail: 'Red veya kismi kabul durumundaki mal kabuller',
        tone: rejectedReceipts > 0 ? 'warning' : 'success'
      }
    }
  ]

  return cards
    .filter(row => row.card.tone === 'danger' || row.card.tone === 'warning')
    .slice(0, 6)
    .map(row => createInsight({
      reportId,
      reportNo,
      analysisTitle: row.area,
      insightType: row.card.tone === 'danger' ? 'RISK' : 'ANOMALY',
      title: `${row.card.label} KPI sinyali`,
      summary: row.card.detail,
      evidence: `${row.card.label}: ${row.card.value}.`,
      expectedImpact: 'KPI sinyali yapay zeka analiz veri setinde baglam olarak kullanilabilir.',
      suggestedPromptContext: `KPI kartı=${row.card.id}; ton=${row.card.tone}; değer=${row.card.value}.`,
      recommendedAction: 'KPI sinyali ilgili kaynak modullerle birlikte manuel incelenmeli.',
      sourceModule: 'KPIDashboard',
      sourceId: row.card.id,
      sourceNo: row.card.label,
      relatedModules: ['KPIDashboard'],
      relatedEntityType: 'KPICard',
      relatedEntityId: row.card.id,
      relatedEntityName: row.card.label,
      riskScore: row.card.tone === 'danger' ? 82 : 62,
      impactScore: row.card.tone === 'danger' ? 78 : 58,
      trendScore: row.card.tone === 'danger' ? 68 : 48,
      confidenceScore: 70,
      expectedGainScore: row.card.tone === 'danger' ? 62 : 42
    }))
}

const createFallbackInsight = (
  reportId: string,
  reportNo: string
) => createInsight({
  reportId,
  reportNo,
  analysisTitle: 'PRODUCTION',
  insightType: 'EXPECTED_IMPACT',
  title: 'AI analiz veri seti hazir',
  summary: 'Read-model kaynaklari AI servislerine gonderilmeden merkezi analiz formatina donusturuldu.',
  evidence: 'Anlamli kritik sinyal bulunmadigi icin dusuk riskli hazirlik insighti uretildi.',
  expectedImpact: 'Ileride eklenecek yapay zeka servisleri icin normalize veri zemini saglar.',
  suggestedPromptContext: 'Dış AI çağrısı kapalı; yalnızca analiz modeli.',
  recommendedAction: 'Operasyon kaydi olusturmadan analiz setini periyodik izlemeye devam et.',
  sourceModule: 'ReadModel',
  sourceId: 'ai-analysis-read-model',
  sourceNo: reportNo,
  relatedModules: ['ReadModel'],
  relatedEntityType: 'AIAnalysis',
  relatedEntityId: reportId,
  relatedEntityName: 'Yapay Zeka Analiz Motoru',
  riskScore: 12,
  impactScore: 24,
  trendScore: 12,
  confidenceScore: 68,
  expectedGainScore: 20
})

const dedupeInsights = (
  insights: AIInsight[]
) => Array.from(new Map(insights.map(insight => [
  [
    insight.analysisTitle,
    insight.insightType,
    insight.sourceModule,
    insight.relatedEntityId || insight.relatedEntityName
  ].join('|'),
  insight
])).values())
  .sort((first, second) => (
    second.priorityScore - first.priorityScore
    || second.riskScore - first.riskScore
    || first.title.localeCompare(second.title, 'tr-TR')
  ))

const filterByScope = (
  insights: AIInsight[],
  scope: AIAnalysisTitle | 'all'
) => scope === ALL_FILTER
  ? insights
  : insights.filter(insight => insight.analysisTitle === scope)

const createFindings = (
  reportId: string,
  reportNo: string,
  insights: AIInsight[]
): AIFinding[] => insights.map((insight, index) => ({
  id: `${insight.id}_finding_${index + 1}`,
  reportId,
  reportNo,
  insightId: insight.id,
  analysisTitle: insight.analysisTitle,
  findingType: insight.insightType,
  severity: insight.severity,
  title: `${AI_INSIGHT_TYPE_LABELS[insight.insightType]} bulgusu: ${insight.relatedEntityName}`,
  description: insight.evidence,
  metricName: 'Öncelik Skoru',
  metricValue: insight.priorityScore,
  benchmarkValue: 65,
  deltaPercent: roundKpi(insight.priorityScore - 65),
  sourceModule: insight.sourceModule,
  sourceId: insight.sourceId,
  sourceNo: insight.sourceNo,
  relatedEntityType: insight.relatedEntityType,
  relatedEntityId: insight.relatedEntityId,
  relatedEntityName: insight.relatedEntityName,
  createdAt: insight.createdAt
}))

const createScores = (
  reportId: string,
  insights: AIInsight[]
): AIScore[] => AI_ANALYSIS_TITLES.map(title => createAIScore(reportId, title, insights))

export const calculateAIAnalysisReport = (
  input: AIInsightCalculationInput
): AIAnalysisReport => {
  const reportNo = input.getReportNo()
  const reportId = `ai_analysis_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
  const productionPlans = input.productionPlans || ProductionPlanningService.list(input.sourceData)
  const capacityPlans = input.capacityPlans || CapacityPlanningService.list(input.sourceData)
  const machineSchedules = input.machineSchedules || MachineSchedulingService.list(input.sourceData)
  const workforcePlans = input.workforcePlans || WorkforcePlanningService.list(input.sourceData, { machineSchedules })
  const bottleneckReports = input.bottleneckReports || BottleneckAnalysisService.list(input.sourceData, {
    capacityPlans,
    machineSchedules,
    workforcePlans
  })
  const improvementReports = input.improvementReports || ContinuousImprovementService.list(input.sourceData, {
    bottleneckReports,
    capacityPlans,
    machineSchedules,
    workforcePlans
  })
  const criticalAlerts = input.criticalAlerts || CriticalAlertService.evaluate(input.sourceData, [], input.actorName, {
    bottleneckReports,
    capacityPlans,
    improvementReports,
    machineSchedules,
    workforcePlans
  })
  const forecastPredictions = input.forecastPredictions || ForecastService.evaluate(input.sourceData, {}, [], input.actorName, {
    bottleneckReports,
    capacityPlans,
    criticalAlerts,
    improvementReports,
    machineSchedules,
    productionPlans,
    workforcePlans
  }).predictions
  const decisionSuggestions = input.decisionSuggestions || createDecisionSuggestions(input.sourceData, {
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
  const recommendationItems = input.recommendationItems || RecommendationService.evaluate(input.sourceData, {}, [], input.actorName, {
    bottleneckReports,
    capacityPlans,
    criticalAlerts,
    decisionSuggestions,
    forecastPredictions,
    improvementReports,
    machineSchedules,
    productionPlans,
    workforcePlans
  }).items
  const context = {
    ...input,
    bottleneckReports,
    capacityPlans,
    criticalAlerts,
    decisionSuggestions,
    forecastPredictions,
    improvementReports,
    machineSchedules,
    productionPlans,
    recommendationItems,
    workforcePlans
  }
  const insights = filterByScope(dedupeInsights([
    ...createDecisionSupportInsights(context, reportId, reportNo),
    ...createCriticalAlertInsights(context, reportId, reportNo),
    ...createForecastInsights(context, reportId, reportNo),
    ...createRecommendationInsights(context, reportId, reportNo),
    ...createCapacityInsights(context, reportId, reportNo),
    ...createBottleneckInsights(context, reportId, reportNo),
    ...createImprovementInsights(context, reportId, reportNo),
    ...createKpiInsights(input.sourceData, reportId, reportNo)
  ]), input.scope)
  const finalInsights = insights.length > 0 ? insights : [createFallbackInsight(reportId, reportNo)]
  const findings = createFindings(reportId, reportNo, finalInsights)
  const scores = createScores(reportId, finalInsights)

  return {
    id: reportId,
    reportNo,
    status: 'GENERATED',
    reportDate: input.reportDate || getTodayKey(),
    scope: input.scope,
    responsiblePerson: input.responsiblePerson,
    description: input.description,
    insights: finalInsights,
    findings,
    scores,
    history: [
      createAIHistory(reportId, 'CREATED', input.actorName, `${reportNo} yapay zeka analizi read-model olarak olusturuldu.`),
      createAIHistory(reportId, 'ANALYZED', input.actorName, `${formatNumber(finalInsights.length)} icgoru ve ${formatNumber(findings.length)} bulgu yapay zeka analiz formatina donusturuldu.`)
    ],
    sourceType: 'ReadModel',
    sourceId: 'ai-analysis-engine',
    revisionNo: 1,
    createdBy: input.actorName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
}

export const AIInsightService = {
  calculate: calculateAIAnalysisReport,
  createScoreSummary: (insights: AIInsight[]) => ({
    confidence: averageBy(insights, insight => insight.confidenceScore),
    risk: averageBy(insights, insight => insight.riskScore),
    impact: averageBy(insights, insight => insight.impactScore)
  })
}
