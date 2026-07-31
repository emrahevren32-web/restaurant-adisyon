import { BottleneckAnalysisService } from '../bottleneck-analysis/bottleneck-analysis.service'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import { ContinuousImprovementService } from '../continuous-improvement/continuous-improvement.service'
import { CriticalAlertService } from '../critical-alerts/critical-alert.service'
import type { CriticalAlert } from '../critical-alerts/critical-alert.types'
import type { DecisionCategory, DecisionPriority, DecisionRisk, DecisionSuggestion } from '../decision-support/decision-support.types'
import { ForecastService } from '../forecasting/forecast.service'
import type { ForecastPrediction } from '../forecasting/forecasting.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  averageBy,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import { MachineSchedulingService } from '../machine-scheduling/machine-scheduling.service'
import { ChecklistService } from '../operation-checklists/checklist.service'
import { ProductionPlanningService } from '../production-planning/production-planning.service'
import { QualityFormService } from '../quality-forms/quality-form.service'
import { ShipmentFormService } from '../shipment-forms/shipment-form.service'
import { WasteService } from '../waste-management/waste.service'
import { WorkforcePlanningService } from '../workforce-planning/workforce-planning.service'
import { createRecommendationHistory } from './recommendation-history.service'
import { getRecommendationRule, listRecommendationRules } from './recommendation-rule.service'
import type {
  RecommendationItem,
  RecommendationPriority,
  RecommendationReport,
  RecommendationReportCreateInput,
  RecommendationRisk,
  RecommendationRule,
  RecommendationSourceModule,
  RecommendationType
} from './recommendation-engine.types'

type RecommendationCalculationInput = RecommendationReportCreateInput & {
  sourceData: KpiSourceData
  decisionSuggestions?: DecisionSuggestion[]
  getReportNo: () => string
  actorName: string
  bottleneckReports?: ReturnType<typeof BottleneckAnalysisService.list>
  capacityPlans?: ReturnType<typeof CapacityPlanningService.list>
  criticalAlerts?: CriticalAlert[]
  forecastPredictions?: ForecastPrediction[]
  improvementReports?: ReturnType<typeof ContinuousImprovementService.list>
  machineSchedules?: ReturnType<typeof MachineSchedulingService.list>
  productionPlans?: ReturnType<typeof ProductionPlanningService.list>
  workforcePlans?: ReturnType<typeof WorkforcePlanningService.list>
}

type RecommendationItemInput = {
  ruleId: string
  reportId: string
  reportNo: string
  title?: string
  description?: string
  reason: string
  action: string
  expectedImpact: string
  ownerRole: string
  riskScore: number
  expectedBenefitScore?: number
  expectedCostImpact?: number
  expectedCapacityGain?: number
  expectedTimeGainMinutes?: number
  confidenceScore?: number
  priority?: RecommendationPriority
  risk?: RecommendationRisk
  sourceModule?: RecommendationSourceModule
  sourceId: string
  sourceNo: string
  relatedModules?: RecommendationSourceModule[]
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityName: string
  productId?: string
  productName?: string
  stockItemId?: string
  stockItemName?: string
  branchId?: string
  branchName?: string
  productionLineId?: string
  productionLineName?: string
  machineId?: string
  machineCode?: string
  machineName?: string
  employeeId?: string
  employeeName?: string
  supplierId?: string
  supplierName?: string
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')
const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeKey = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '')

const clamp = (
  value: number,
  min: number,
  max: number
) => Math.max(min, Math.min(max, value))

const mapRisk = (
  riskScore: number
): RecommendationRisk => {
  if(riskScore >= 85) return 'CRITICAL'
  if(riskScore >= 65) return 'HIGH'
  if(riskScore >= 35) return 'MEDIUM'
  return 'LOW'
}

const mapPriority = (
  risk: RecommendationRisk,
  riskScore: number
): RecommendationPriority => {
  if(risk === 'CRITICAL' || riskScore >= 85) return 'URGENT'
  if(risk === 'HIGH' || riskScore >= 65) return 'HIGH'
  if(risk === 'MEDIUM' || riskScore >= 35) return 'NORMAL'
  return 'LOW'
}

const getRule = (
  ruleId: string
) => {
  const rule = getRecommendationRule(ruleId)
  if(!rule) throw new Error(`Recommendation rule bulunamadi: ${ruleId}`)
  return rule
}

const createRecommendationItem = (
  input: RecommendationItemInput
): RecommendationItem => {
  const rule = getRule(input.ruleId)
  const riskScore = roundKpi(clamp(input.riskScore, 0, 100))
  const risk = input.risk || mapRisk(riskScore)
  const priority = input.priority || mapPriority(risk, riskScore)
  const expectedBenefitScore = roundKpi(clamp(input.expectedBenefitScore ?? riskScore * 0.68 + (input.confidenceScore || 65) * 0.28, 0, 100))
  const id = `recommendation_${input.reportNo}_${rule.code}_${input.relatedEntityId || input.sourceId}`.replace(/[^a-zA-Z0-9_]+/g, '_')

  return {
    id,
    reportId: input.reportId,
    reportNo: input.reportNo,
    ruleId: rule.id,
    recommendationType: rule.type,
    priority,
    risk,
    title: input.title || rule.title,
    description: input.description || rule.description,
    reason: input.reason,
    action: input.action,
    expectedImpact: input.expectedImpact,
    ownerRole: input.ownerRole,
    riskScore,
    expectedBenefitScore,
    expectedCostImpact: roundKpi(Math.max(0, input.expectedCostImpact ?? expectedBenefitScore * 18)),
    expectedCapacityGain: roundKpi(Math.max(0, input.expectedCapacityGain ?? expectedBenefitScore * 0.18)),
    expectedTimeGainMinutes: roundKpi(Math.max(0, input.expectedTimeGainMinutes ?? expectedBenefitScore * 1.4)),
    confidenceScore: roundKpi(clamp(input.confidenceScore ?? 72, 0, 100)),
    sourceModule: input.sourceModule || rule.sourceModule,
    sourceId: input.sourceId,
    sourceNo: input.sourceNo,
    relatedModules: Array.from(new Set([rule.sourceModule, ...(input.relatedModules || [])])),
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    relatedEntityName: input.relatedEntityName,
    productId: input.productId || '',
    productName: input.productName || '',
    stockItemId: input.stockItemId || '',
    stockItemName: input.stockItemName || '',
    branchId: input.branchId || '',
    branchName: input.branchName || '',
    productionLineId: input.productionLineId || '',
    productionLineName: input.productionLineName || '',
    machineId: input.machineId || '',
    machineCode: input.machineCode || '',
    machineName: input.machineName || '',
    employeeId: input.employeeId || '',
    employeeName: input.employeeName || '',
    supplierId: input.supplierId || '',
    supplierName: input.supplierName || '',
    createdAt: new Date().toISOString()
  }
}

const getBranchName = (
  sourceData: KpiSourceData,
  branchId: string
) => sourceData.branches.find(branch => branch.id === branchId)?.name || branchId

const getStockItemName = (
  sourceData: KpiSourceData,
  stockItemId: string
) => sourceData.stockItems.find(item => item.id === stockItemId)?.name || stockItemId

const getProductName = (
  sourceData: KpiSourceData,
  productId: string
) => sourceData.productRefs.find(product => product.id === productId)?.name || getStockItemName(sourceData, productId)

const getRecommendationTypeFromDecision = (
  suggestion: DecisionSuggestion
): RecommendationType => {
  if(suggestion.category === 'Inventory') return suggestion.ruleId.includes('purchase') ? 'PURCHASING' : 'STOCK'
  if(suggestion.category === 'Purchasing') return 'PURCHASING'
  if(suggestion.category === 'Quality') return 'QUALITY'
  if(suggestion.category === 'Shipment') return 'SHIPMENT'
  if(suggestion.ruleId.includes('machine')) return 'MACHINE'
  if(suggestion.ruleId.includes('maintenance') || suggestion.ruleId.includes('bakim')) return 'MAINTENANCE'
  if(suggestion.ruleId.includes('workforce') || suggestion.ruleId.includes('personnel')) return 'PERSONNEL'
  if(suggestion.ruleId.includes('waste') || suggestion.ruleId.includes('fire')) return 'WASTE'
  return 'PRODUCTION'
}

const getRuleIdForType = (
  type: RecommendationType
) => {
  if(type === 'PURCHASING') return 'recommendation-rule-purchase-order-needed'
  if(type === 'STOCK') return 'recommendation-rule-critical-stock-replenish'
  if(type === 'QUALITY') return 'recommendation-rule-quality-control'
  if(type === 'MACHINE') return 'recommendation-rule-line-balance'
  if(type === 'MAINTENANCE') return 'recommendation-rule-machine-maintenance'
  if(type === 'PERSONNEL') return 'recommendation-rule-personnel-distribution'
  if(type === 'SHIPMENT') return 'recommendation-rule-shipment-reschedule'
  if(type === 'WASTE') return 'recommendation-rule-waste-analysis'
  if(type === 'ENERGY') return 'recommendation-rule-energy-idle'
  return 'recommendation-rule-production-increase'
}

const decisionRiskScore = (risk: DecisionRisk) => {
  if(risk === 'CRITICAL') return 92
  if(risk === 'HIGH') return 74
  if(risk === 'MEDIUM') return 48
  return 24
}

const decisionPriority = (priority: DecisionPriority): RecommendationPriority => {
  if(priority === 'URGENT') return 'URGENT'
  if(priority === 'HIGH') return 'HIGH'
  if(priority === 'NORMAL') return 'NORMAL'
  return 'LOW'
}

const createDecisionSupportItems = (
  input: RecommendationCalculationInput,
  reportId: string,
  reportNo: string
) => (input.decisionSuggestions || [])
  .filter(suggestion => !suggestion.ruleId.startsWith('recommendation-engine-'))
  .slice(0, 18)
  .map(suggestion => {
    const type = getRecommendationTypeFromDecision(suggestion)
    return createRecommendationItem({
      ruleId: getRuleIdForType(type),
      reportId,
      reportNo,
      title: suggestion.title,
      description: suggestion.description,
      reason: suggestion.reason,
      action: suggestion.recommendation.action,
      expectedImpact: suggestion.recommendation.expectedImpact,
      ownerRole: suggestion.recommendation.ownerRole,
      riskScore: Math.max(suggestion.riskScore, decisionRiskScore(suggestion.risk)),
      confidenceScore: 78,
      priority: decisionPriority(suggestion.priority),
      sourceModule: 'DecisionSupport',
      sourceId: suggestion.id,
      sourceNo: suggestion.ruleId,
      relatedModules: ['DecisionSupport'],
      relatedEntityType: suggestion.relatedEntityType,
      relatedEntityId: suggestion.relatedEntityId,
      relatedEntityName: suggestion.title,
      productId: suggestion.relatedProductId,
      productName: getProductName(input.sourceData, suggestion.relatedProductId),
      stockItemId: suggestion.relatedProductId,
      stockItemName: getStockItemName(input.sourceData, suggestion.relatedProductId),
      branchId: suggestion.branchId,
      branchName: getBranchName(input.sourceData, suggestion.branchId),
      productionLineId: suggestion.warehouseId,
      productionLineName: suggestion.warehouseId,
      supplierId: suggestion.relatedSupplierId,
      supplierName: suggestion.relatedSupplierId
    })
  })

const getRuleIdForAlert = (
  alert: CriticalAlert
) => {
  if(alert.category === 'STOCK') return 'recommendation-rule-critical-stock-replenish'
  if(alert.category === 'QUALITY' || alert.category === 'HACCP' || alert.category === 'LOT' || alert.category === 'GOODS_RECEIPT') return 'recommendation-rule-quality-control'
  if(alert.category === 'MACHINE') return 'recommendation-rule-line-balance'
  if(alert.category === 'MAINTENANCE') return 'recommendation-rule-machine-maintenance'
  if(alert.category === 'PERSONNEL') return 'recommendation-rule-personnel-distribution'
  if(alert.category === 'SHIPMENT') return 'recommendation-rule-shipment-reschedule'
  if(alert.category === 'CAPACITY') return 'recommendation-rule-line-balance'
  return 'recommendation-rule-production-increase'
}

const createCriticalAlertItems = (
  input: RecommendationCalculationInput,
  reportId: string,
  reportNo: string
) => (input.criticalAlerts || CriticalAlertService.evaluate(input.sourceData))
  .filter(alert => alert.status === 'ACTIVE' && (alert.level === 'CRITICAL' || alert.level === 'HIGH' || alert.riskScore >= 70))
  .slice(0, 16)
  .map(alert => createRecommendationItem({
    ruleId: getRuleIdForAlert(alert),
    reportId,
    reportNo,
    title: alert.title,
    description: alert.description,
    reason: alert.reason,
    action: alert.recommendedAction,
    expectedImpact: alert.expectedImpact,
    ownerRole: 'Operasyon Muduru',
    riskScore: alert.riskScore,
    expectedBenefitScore: alert.impactScore,
    confidenceScore: Math.min(95, 68 + alert.repeatCount * 4),
    sourceModule: 'CriticalAlerts',
    sourceId: alert.id,
    sourceNo: alert.alertNo,
    relatedModules: ['CriticalAlerts', alert.sourceModule],
    relatedEntityType: alert.relatedEntityType,
    relatedEntityId: alert.relatedEntityId,
    relatedEntityName: alert.relatedEntityName,
    productId: alert.relatedEntityId,
    productName: alert.relatedEntityName,
    stockItemId: alert.category === 'STOCK' ? alert.relatedEntityId : '',
    stockItemName: alert.category === 'STOCK' ? alert.relatedEntityName : '',
    branchId: alert.branchId,
    branchName: alert.branchName,
    productionLineId: alert.productionLineId,
    productionLineName: alert.productionLineName,
    machineId: alert.machineId,
    machineCode: alert.machineCode,
    machineName: alert.machineName,
    employeeId: alert.employeeId,
    employeeName: alert.employeeName
  }))

const getRuleIdForForecast = (
  prediction: ForecastPrediction
) => {
  if(prediction.forecastType === 'STOCK') return 'recommendation-rule-critical-stock-replenish'
  if(prediction.forecastType === 'PURCHASING') return 'recommendation-rule-purchase-order-needed'
  if(prediction.forecastType === 'QUALITY') return 'recommendation-rule-quality-control'
  if(prediction.forecastType === 'SHIPMENT') return 'recommendation-rule-shipment-reschedule'
  if(prediction.forecastType === 'WASTE') return 'recommendation-rule-waste-analysis'
  if(prediction.forecastType === 'PERSONNEL') return 'recommendation-rule-personnel-distribution'
  if(prediction.trendDirection === 'DOWN' && prediction.forecastType === 'PRODUCTION') return 'recommendation-rule-production-decrease'
  return 'recommendation-rule-production-increase'
}

const createForecastItems = (
  input: RecommendationCalculationInput,
  reportId: string,
  reportNo: string
) => (input.forecastPredictions || ForecastService.evaluate(input.sourceData).predictions)
  .filter(prediction => (
    prediction.riskLevel === 'HIGH'
    || prediction.riskLevel === 'CRITICAL'
    || Math.abs(prediction.growthPercent) >= 10
    || prediction.daysToCritical <= 4
  ))
  .slice(0, 18)
  .map(prediction => createRecommendationItem({
    ruleId: getRuleIdForForecast(prediction),
    reportId,
    reportNo,
    title: prediction.recommendation,
    description: `${prediction.entityName} forecast sinyali otomatik oneriye cevrildi.`,
    reason: prediction.evidence,
    action: prediction.recommendation,
    expectedImpact: `${prediction.entityName} icin risk ${prediction.riskScore} ve confidence ${prediction.confidenceScore}.`,
    ownerRole: prediction.forecastType === 'STOCK' || prediction.forecastType === 'PURCHASING'
      ? 'Satin Alma ve Depo'
      : prediction.forecastType === 'QUALITY'
        ? 'Kalite'
        : prediction.forecastType === 'SHIPMENT'
          ? 'Sevkiyat'
          : 'Uretim Planlama',
    riskScore: prediction.riskScore,
    confidenceScore: prediction.confidenceScore,
    expectedCostImpact: prediction.expectedWaste * 120 + Math.max(0, -prediction.expectedStock) * 80,
    expectedCapacityGain: prediction.expectedCapacityPercent ? Math.max(0, 100 - prediction.expectedCapacityPercent) : 0,
    expectedTimeGainMinutes: prediction.expectedPersonnelNeed * 45,
    sourceModule: 'Forecasting',
    sourceId: prediction.id,
    sourceNo: prediction.reportNo,
    relatedModules: ['Forecasting', prediction.sourceModule],
    relatedEntityType: prediction.entityType,
    relatedEntityId: prediction.entityId,
    relatedEntityName: prediction.entityName,
    productId: prediction.productId,
    productName: prediction.productName,
    stockItemId: prediction.stockItemId,
    stockItemName: prediction.stockItemName,
    branchId: prediction.branchId,
    branchName: prediction.branchName,
    productionLineId: prediction.productionLineId,
    productionLineName: prediction.productionLineName,
    machineId: prediction.machineId,
    machineCode: prediction.machineCode,
    machineName: prediction.machineName,
    employeeId: prediction.employeeId,
    employeeName: prediction.employeeName,
    supplierId: prediction.supplierId,
    supplierName: prediction.supplierName
  }))

const createProductionPlanningItems = (
  input: RecommendationCalculationInput,
  reportId: string,
  reportNo: string
) => (input.productionPlans || ProductionPlanningService.list(input.sourceData))
  .filter(plan => plan.status !== 'CANCELLED')
  .flatMap(plan => plan.items.map(item => ({ plan, item })))
  .filter(row => row.item.priority === 'CRITICAL' || row.item.priority === 'HIGH' || row.item.capacityUsagePercent >= 90 || row.item.currentStock <= row.item.minimumStock)
  .slice(0, 10)
  .map(({ plan, item }) => createRecommendationItem({
    ruleId: item.currentStock <= item.minimumStock ? 'recommendation-rule-critical-stock-replenish' : item.capacityUsagePercent >= 90 ? 'recommendation-rule-line-balance' : 'recommendation-rule-production-increase',
    reportId,
    reportNo,
    reason: `${item.productName} planinda talep ${item.demandQuantity}, uretilecek ${item.produceQuantity}, kapasite ${item.capacityUsagePercent}%.`,
    action: item.currentStock <= item.minimumStock
      ? 'Kritik stok yenilenmeli ve plan malzeme uygunlugu manuel kontrol edilmeli.'
      : item.capacityUsagePercent >= 90
        ? 'Hat yuku alternatif hat veya vardiya senaryosu ile manuel dengelenmeli.'
        : 'Uretim miktari talep ve forecast etkisine gore manuel artirilabilir.',
    expectedImpact: 'Plan acigi, kapasite baskisi ve stok yetersizligi riskini azaltir.',
    ownerRole: 'Uretim Planlama',
    riskScore: item.priority === 'CRITICAL' ? 88 : item.capacityUsagePercent >= 100 ? 82 : 66,
    expectedCapacityGain: Math.max(0, item.capacityUsagePercent - 85),
    expectedTimeGainMinutes: item.estimatedMinutes * 0.12,
    confidenceScore: 76,
    sourceModule: 'ProductionPlanning',
    sourceId: plan.id,
    sourceNo: plan.planNo,
    relatedModules: ['ProductionPlanning', 'Stock'],
    relatedEntityType: 'ProductionPlanItem',
    relatedEntityId: item.id,
    relatedEntityName: item.productName,
    productId: item.productId,
    productName: item.productName,
    stockItemId: item.productId,
    stockItemName: item.productName,
    branchId: plan.branchId,
    branchName: plan.branchName,
    productionLineId: item.productionLineId,
    productionLineName: item.productionLineName
  }))

const createCapacityAndMachineItems = (
  input: RecommendationCalculationInput,
  reportId: string,
  reportNo: string
) => {
  const capacityItems = (input.capacityPlans || CapacityPlanningService.list(input.sourceData))
    .filter(plan => plan.status !== 'CANCELLED')
    .flatMap(plan => plan.productionCapacities.map(capacity => ({ plan, capacity })))
    .filter(row => row.capacity.utilizationPercent >= 95 || row.capacity.overloadMinutes > 0)
    .slice(0, 8)
    .map(({ plan, capacity }) => createRecommendationItem({
      ruleId: capacity.maintenanceClosed ? 'recommendation-rule-machine-maintenance' : 'recommendation-rule-line-balance',
      reportId,
      reportNo,
      reason: `${capacity.productionLineName} doluluk ${capacity.utilizationPercent}% ve asiri yuk ${capacity.overloadMinutes} dk.`,
      action: 'Hat yuku dengelenmeli; alternatif hat, vardiya veya bakim penceresi manuel incelenmeli.',
      expectedImpact: 'Kapasite asimi, gecikme ve bottleneck riskini azaltir.',
      ownerRole: 'Uretim Planlama',
      riskScore: capacity.utilizationPercent >= 110 ? 88 : 72,
      expectedCapacityGain: Math.max(0, capacity.utilizationPercent - 90),
      expectedTimeGainMinutes: capacity.overloadMinutes,
      confidenceScore: 82,
      sourceModule: 'CapacityPlanning',
      sourceId: plan.id,
      sourceNo: plan.capacityPlanNo,
      relatedModules: ['CapacityPlanning', 'BottleneckAnalysis'],
      relatedEntityType: 'ProductionCapacity',
      relatedEntityId: capacity.id,
      relatedEntityName: capacity.productionLineName,
      productionLineId: capacity.productionLineId,
      productionLineName: capacity.productionLineName
    }))

  const machineItems = (input.machineSchedules || MachineSchedulingService.list(input.sourceData))
    .filter(schedule => schedule.status !== 'CANCELLED')
    .flatMap(schedule => schedule.queues.map(queue => ({ schedule, queue })))
    .filter(row => row.queue.conflictCount > 0 || row.queue.totalWaitingMinutes >= 120 || row.queue.idleMinutes >= 120)
    .slice(0, 10)
    .map(({ schedule, queue }) => createRecommendationItem({
      ruleId: queue.idleMinutes >= 120 && queue.conflictCount === 0 ? 'recommendation-rule-energy-idle' : 'recommendation-rule-line-balance',
      reportId,
      reportNo,
      reason: `${queue.machineCode} bekleme ${queue.totalWaitingMinutes} dk, bos sure ${queue.idleMinutes} dk, cakisma ${queue.conflictCount}.`,
      action: queue.conflictCount > 0
        ? 'Makine cizelgesi manuel yeniden siralanmali.'
        : queue.idleMinutes >= 120
          ? 'Bos sure ve enerji etkisi manuel incelenmeli.'
          : 'Makine kuyrugu ve setup sirasi manuel dengelenmeli.',
      expectedImpact: 'Makine bekleme, enerji kaybi ve plan gecikmesi riskini azaltir.',
      ownerRole: 'Makine Cizelgeleme',
      riskScore: queue.conflictCount > 0 ? 78 : queue.totalWaitingMinutes >= 240 ? 74 : 52,
      expectedTimeGainMinutes: queue.totalWaitingMinutes + queue.idleMinutes * 0.35,
      expectedCapacityGain: Math.max(0, 100 - queue.utilizationPercent),
      confidenceScore: 78,
      sourceModule: 'MachineScheduling',
      sourceId: schedule.id,
      sourceNo: schedule.scheduleNo,
      relatedModules: ['MachineScheduling', 'CapacityPlanning'],
      relatedEntityType: 'MachineQueue',
      relatedEntityId: queue.id,
      relatedEntityName: queue.machineName,
      productionLineId: queue.productionLineId,
      productionLineName: queue.productionLineName,
      machineId: queue.machineId,
      machineCode: queue.machineCode,
      machineName: queue.machineName
    }))

  return [...capacityItems, ...machineItems]
}

const createWorkforceItems = (
  input: RecommendationCalculationInput,
  reportId: string,
  reportNo: string
) => (input.workforcePlans || WorkforcePlanningService.list(input.sourceData))
  .filter(plan => plan.status !== 'CANCELLED')
  .flatMap(plan => plan.shiftAssignments.map(assignment => ({ plan, assignment })))
  .filter(row => row.assignment.missingEmployeeCount > 0 || row.assignment.conflictCount > 0)
  .slice(0, 10)
  .map(({ plan, assignment }) => createRecommendationItem({
    ruleId: 'recommendation-rule-personnel-distribution',
    reportId,
    reportNo,
    reason: `${assignment.shiftName} vardiyasinda ${assignment.missingEmployeeCount} eksik personel ve ${assignment.conflictCount} cakisma var.`,
    action: 'Personel dagilimi, vardiya kapsami ve yetkinlik uygunlugu manuel iyilestirilmeli.',
    expectedImpact: 'Baslama gecikmesi, kapasite kaybi ve vardiya cakismasi riskini azaltir.',
    ownerRole: 'Personel Planlama',
    riskScore: Math.min(95, 65 + assignment.missingEmployeeCount * 9 + assignment.conflictCount * 7),
    expectedTimeGainMinutes: assignment.missingEmployeeCount * 90 + assignment.conflictCount * 45,
    confidenceScore: 80,
    sourceModule: 'WorkforcePlanning',
    sourceId: plan.id,
    sourceNo: plan.planNo,
    relatedModules: ['WorkforcePlanning', 'MachineScheduling'],
    relatedEntityType: 'ShiftAssignment',
    relatedEntityId: assignment.id,
    relatedEntityName: assignment.shiftName,
    productionLineId: plan.productionLineId,
    productionLineName: plan.productionLineName,
    employeeId: plan.employeeId,
    employeeName: plan.employeeName
  }))

const createBottleneckAndImprovementItems = (
  input: RecommendationCalculationInput,
  reportId: string,
  reportNo: string
) => {
  const bottleneckItems = (input.bottleneckReports || BottleneckAnalysisService.list(input.sourceData))
    .filter(report => report.status !== 'CANCELLED')
    .flatMap(report => report.items.map(item => ({ report, item })))
    .filter(row => row.item.riskLevel === 'CRITICAL' || row.item.riskLevel === 'HIGH' || row.item.riskScore >= 70)
    .slice(0, 10)
    .map(({ report, item }) => createRecommendationItem({
      ruleId: item.bottleneckType === 'MAINTENANCE' ? 'recommendation-rule-machine-maintenance' : item.bottleneckType === 'PERSONNEL' ? 'recommendation-rule-personnel-distribution' : 'recommendation-rule-line-balance',
      reportId,
      reportNo,
      reason: `${item.entityName} bottleneck risk skoru ${item.riskScore}, bekleme ${item.waitingMinutes} dk.`,
      action: item.recommendation || 'Bottleneck kaynakli hat ve makine yuku manuel dengelenmeli.',
      expectedImpact: 'Darbogaz, bekleme ve kapasite kaybi riskini azaltir.',
      ownerRole: 'Operasyon Muduru',
      riskScore: item.riskScore,
      expectedCapacityGain: Math.max(0, item.utilizationPercent - 85),
      expectedTimeGainMinutes: item.waitingMinutes + item.setupMinutes + item.overloadMinutes,
      confidenceScore: 82,
      sourceModule: 'BottleneckAnalysis',
      sourceId: report.id,
      sourceNo: report.reportNo,
      relatedModules: ['BottleneckAnalysis', item.sourceType],
      relatedEntityType: 'BottleneckItem',
      relatedEntityId: item.id,
      relatedEntityName: item.entityName,
      productionLineId: item.productionLineId,
      productionLineName: item.productionLineName,
      machineId: item.machineId,
      machineCode: item.machineCode,
      machineName: item.machineName,
      employeeId: item.employeeId,
      employeeName: item.employeeName
    }))

  const improvementItems = (input.improvementReports || ContinuousImprovementService.list(input.sourceData))
    .filter(report => report.status !== 'CANCELLED')
    .flatMap(report => report.opportunities.map(opportunity => ({ report, opportunity })))
    .filter(row => row.opportunity.priority === 'URGENT' || row.opportunity.priority === 'HIGH' || row.opportunity.expectedBenefitScore >= 70)
    .slice(0, 10)
    .map(({ report, opportunity }) => createRecommendationItem({
      ruleId: opportunity.area === 'MAINTENANCE'
        ? 'recommendation-rule-machine-maintenance'
        : opportunity.area === 'PERSONNEL' || opportunity.area === 'SHIFT'
          ? 'recommendation-rule-personnel-distribution'
          : opportunity.area === 'ENERGY'
            ? 'recommendation-rule-energy-idle'
            : 'recommendation-rule-line-balance',
      reportId,
      reportNo,
      reason: opportunity.summary,
      action: 'Continuous Improvement firsati manuel aksiyon listesine alinmali.',
      expectedImpact: `${opportunity.expectedGainMinutes} dk ve ${opportunity.expectedGainPercent}% beklenen kazanc.`,
      ownerRole: 'Operasyon Muduru',
      riskScore: opportunity.riskLevel === 'CRITICAL' ? 88 : opportunity.riskLevel === 'HIGH' ? 72 : 48,
      expectedBenefitScore: opportunity.expectedBenefitScore,
      expectedCapacityGain: opportunity.expectedGainPercent,
      expectedTimeGainMinutes: opportunity.expectedGainMinutes,
      confidenceScore: 84,
      sourceModule: 'ContinuousImprovement',
      sourceId: report.id,
      sourceNo: report.reportNo,
      relatedModules: ['ContinuousImprovement', opportunity.sourceType],
      relatedEntityType: 'ImprovementOpportunity',
      relatedEntityId: opportunity.id,
      relatedEntityName: opportunity.entityName,
      productionLineId: opportunity.productionLineId,
      productionLineName: opportunity.productionLineName,
      machineId: opportunity.machineId,
      machineCode: opportunity.machineCode,
      machineName: opportunity.machineName,
      employeeId: opportunity.employeeId,
      employeeName: opportunity.employeeName
    }))

  return [...bottleneckItems, ...improvementItems]
}

const createQualityShipmentChecklistItems = (
  input: RecommendationCalculationInput,
  reportId: string,
  reportNo: string
) => {
  const qualityItems = QualityFormService.list(input.sourceData)
    .filter(form => form.status !== 'CANCELLED')
    .filter(form => form.result === 'FAIL' || form.inspections.some(inspection => inspection.status === 'FAIL'))
    .slice(0, 8)
    .map(form => createRecommendationItem({
      ruleId: 'recommendation-rule-quality-control',
      reportId,
      reportNo,
      reason: `${form.formNo} kalite formunda FAIL sonucu tespit edildi.`,
      action: 'Kalite kontrol sikligi artirilmali ve lot/supplier etkisi manuel incelenmeli.',
      expectedImpact: 'Kalite FAIL, recall ve sevkiyat blokaj riskini azaltir.',
      ownerRole: 'Kalite',
      riskScore: form.result === 'FAIL' ? 86 : 70,
      confidenceScore: 82,
      sourceModule: 'QualityForms',
      sourceId: form.id,
      sourceNo: form.formNo,
      relatedModules: ['QualityForms', 'KPIDashboard'],
      relatedEntityType: 'QualityForm',
      relatedEntityId: form.id,
      relatedEntityName: form.productName || form.stockItemName || form.formNo,
      productId: form.productId,
      productName: form.productName,
      stockItemId: form.stockItemId,
      stockItemName: form.stockItemName,
      branchId: form.branchId,
      branchName: form.branchName,
      supplierId: form.supplierId,
      supplierName: form.supplierName
    }))

  const shipmentItems = ShipmentFormService.list(input.sourceData)
    .filter(form => form.status !== 'CANCELLED')
    .filter(form => form.checklist.some(item => item.status === 'FAIL') || form.temperatureLogs.some(log => log.result === 'FAIL'))
    .slice(0, 8)
    .map(form => createRecommendationItem({
      ruleId: 'recommendation-rule-shipment-reschedule',
      reportId,
      reportNo,
      reason: `${form.formNo} sevkiyat formunda checklist veya sicaklik FAIL sonucu var.`,
      action: 'Sevkiyat yeniden planlanmali; arac, soguk zincir ve yukleme kontrolu manuel incelenmeli.',
      expectedImpact: 'Teslimat gecikmesi ve sevkiyat kalite riskini azaltir.',
      ownerRole: 'Sevkiyat',
      riskScore: 74,
      confidenceScore: 78,
      sourceModule: 'ShipmentForms',
      sourceId: form.id,
      sourceNo: form.formNo,
      relatedModules: ['ShipmentForms', 'QualityForms'],
      relatedEntityType: 'ShipmentForm',
      relatedEntityId: form.id,
      relatedEntityName: form.shipmentNo || form.deliveryNoteNo || form.formNo,
      branchId: form.branchId,
      branchName: form.branchName
    }))

  const checklistItems = ChecklistService.list(input.sourceData)
    .filter(record => record.status !== 'CANCELLED')
    .filter(record => record.execution.failCount > 0 || record.execution.completionRate < 80)
    .slice(0, 8)
    .map(record => createRecommendationItem({
      ruleId: 'recommendation-rule-quality-control',
      reportId,
      reportNo,
      reason: `${record.checklistNo} operasyon checklist ${record.execution.failCount} FAIL ve ${record.execution.completionRate}% tamamlanma.`,
      action: 'Operasyon checklist uygunsuzluklari kalite ve operasyon sorumlusu tarafindan manuel kapatilmali.',
      expectedImpact: 'Operasyon standardi, HACCP ve kalite riskini azaltir.',
      ownerRole: 'Operasyon ve Kalite',
      riskScore: Math.min(88, 55 + record.execution.failCount * 10 + (100 - record.execution.completionRate) * 0.25),
      confidenceScore: 76,
      sourceModule: 'OperationsChecklists',
      sourceId: record.id,
      sourceNo: record.checklistNo,
      relatedModules: ['OperationsChecklists', 'QualityForms'],
      relatedEntityType: 'OperationChecklist',
      relatedEntityId: record.id,
      relatedEntityName: record.templateName,
      branchId: record.branchId,
      branchName: record.branchName
    }))

  return [...qualityItems, ...shipmentItems, ...checklistItems]
}

const createWasteItems = (
  input: RecommendationCalculationInput,
  reportId: string,
  reportNo: string
) => {
  const wasteRecords = WasteService.list(input.sourceData)
    .filter(record => record.status !== 'CANCELLED' && record.status !== 'REJECTED')
  const productWaste = Array.from(wasteRecords.reduce<Map<string, { label: string; quantity: number; cost: number; recordIds: string[] }>>((map, record) => {
    const key = record.productId || record.stockItemId || normalizeKey(record.productName || record.stockItemName)
    const previous = map.get(key)
    map.set(key, {
      label: previous?.label || record.productName || record.stockItemName,
      quantity: roundKpi((previous?.quantity || 0) + record.quantity),
      cost: roundKpi((previous?.cost || 0) + record.totalCost),
      recordIds: [...(previous?.recordIds || []), record.id]
    })
    return map
  }, new Map()).entries())
    .sort((first, second) => second[1].cost - first[1].cost)
    .slice(0, 5)

  return productWaste
    .filter(([, row]) => row.quantity > 0 || row.cost > 0)
    .map(([id, row]) => createRecommendationItem({
      ruleId: 'recommendation-rule-waste-analysis',
      reportId,
      reportNo,
      reason: `${row.label} fire miktari ${row.quantity}, tahmini maliyet etkisi ${row.cost}.`,
      action: 'Fire analizi yapilmali; kalite, recete, makine ve personel etkisi manuel incelenmeli.',
      expectedImpact: 'Fire maliyeti ve tekrar eden uygunsuzluklari azaltir.',
      ownerRole: 'Uretim ve Kalite',
      riskScore: row.cost >= 1000 ? 76 : 54,
      expectedCostImpact: row.cost,
      expectedBenefitScore: Math.min(90, 45 + row.quantity * 3),
      confidenceScore: 72,
      sourceModule: 'ReadModel',
      sourceId: row.recordIds[0] || id,
      sourceNo: 'WasteAggregation',
      relatedModules: ['ReadModel', 'KPIDashboard'],
      relatedEntityType: 'WasteAggregation',
      relatedEntityId: id,
      relatedEntityName: row.label,
      productId: id,
      productName: row.label
    }))
}

const dedupeItems = (
  items: RecommendationItem[]
) => Array.from(new Map(items.map(item => [
  `${item.ruleId}_${item.relatedEntityId || item.relatedEntityName}_${item.sourceModule}`,
  item
])).values())
  .sort((first, second) => (
    second.priority.localeCompare(first.priority)
    || second.riskScore - first.riskScore
    || second.expectedBenefitScore - first.expectedBenefitScore
    || first.title.localeCompare(second.title, 'tr-TR')
  ))

const filterScope = (
  items: RecommendationItem[],
  scope: RecommendationType | 'all'
) => scope === ALL_FILTER ? items : items.filter(item => item.recommendationType === scope)

export const calculateRecommendationReport = (
  input: RecommendationCalculationInput
): RecommendationReport => {
  const reportNo = input.getReportNo()
  const reportId = `recommendation_report_${reportNo}`.replace(/[^a-zA-Z0-9_]+/g, '_')
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
  const context = {
    ...input,
    bottleneckReports,
    capacityPlans,
    criticalAlerts,
    forecastPredictions,
    improvementReports,
    machineSchedules,
    productionPlans,
    workforcePlans
  }
  const rawItems = [
    ...createDecisionSupportItems(context, reportId, reportNo),
    ...createCriticalAlertItems(context, reportId, reportNo),
    ...createForecastItems(context, reportId, reportNo),
    ...createProductionPlanningItems(context, reportId, reportNo),
    ...createCapacityAndMachineItems(context, reportId, reportNo),
    ...createWorkforceItems(context, reportId, reportNo),
    ...createBottleneckAndImprovementItems(context, reportId, reportNo),
    ...createQualityShipmentChecklistItems(context, reportId, reportNo),
    ...createWasteItems(context, reportId, reportNo)
  ]
  const items = filterScope(dedupeItems(rawItems), input.scope)
  const now = new Date().toISOString()

  return {
    id: reportId,
    reportNo,
    status: 'GENERATED',
    reportDate: input.reportDate || getTodayKey(),
    scope: input.scope || ALL_FILTER,
    responsiblePerson: input.responsiblePerson,
    description: input.description,
    items,
    rules: listRecommendationRules(),
    history: [
      createRecommendationHistory(reportId, 'CREATED', input.actorName, `${reportNo} Recommendation Engine read-model raporu olusturuldu.`),
      createRecommendationHistory(reportId, 'CALCULATED', input.actorName, `${items.length} otomatik oneri hesaplandi.`)
    ],
    sourceType: 'ReadModel',
    sourceId: 'recommendation-engine',
    revisionNo: 1,
    createdBy: input.actorName,
    createdAt: now,
    updatedAt: now
  }
}

export const RecommendationCalculationService = {
  calculate: calculateRecommendationReport,
  summarizeGain: (items: RecommendationItem[]) => roundKpi(sumBy(items, item => item.expectedBenefitScore + item.expectedTimeGainMinutes / 10 + item.expectedCapacityGain)),
  averageConfidence: (items: RecommendationItem[]) => averageBy(items, item => item.confidenceScore)
}
