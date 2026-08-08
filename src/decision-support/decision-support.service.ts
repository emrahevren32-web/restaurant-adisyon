import { flattenHACCPCorrectiveActions } from '../haccp/haccp.mock'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { ALL_FILTER } from '../kpi-reporting/kpi.utils'
import { resolveReadModelList } from '../read-model/read-model-safety'
import { DECISION_RULES } from './decision-rules'
import { createCostEngineDecisionSuggestions } from './cost-engine-decision.service'
import { createCapacityPlanningDecisionSuggestions } from './capacity-planning-decision.service'
import { createBottleneckAnalysisDecisionSuggestions } from './bottleneck-analysis-decision.service'
import { createContinuousImprovementDecisionSuggestions } from './continuous-improvement-decision.service'
import { createCostOptimizationDecisionSuggestions } from './cost-optimization-decision.service'
import { createCriticalAlertDecisionSuggestions } from './critical-alert-decision.service'
import { createForecastingDecisionSuggestions } from './forecasting-decision.service'
import { createHistoricalCostDecisionSuggestions } from './historical-cost-decision.service'
import { createInventoryDecisionSuggestions } from './inventory-decision.service'
import { createMachineSchedulingDecisionSuggestions } from './machine-scheduling-decision.service'
import { createOperationChecklistDecisionSuggestions } from './operation-checklist-decision.service'
import { createDecisionSuggestion, dedupeSuggestions } from './recommendation-engine.service'
import { createRecommendationEngineDecisionSuggestions } from './recommendation-engine-decision.service'
import { createPurchaseRecommendationDecisionSuggestions } from './purchase-recommendation-decision.service'
import { createProductionPlanningDecisionSuggestions } from './production-planning-decision.service'
import { createProductionDecisionSuggestions } from './production-decision.service'
import { createPurchasingDecisionSuggestions } from './purchasing-decision.service'
import { createQualityDecisionSuggestions } from './quality-decision.service'
import { createQualityFormDecisionSuggestions } from './quality-form-decision.service'
import { createRecipeCostSimulationDecisionSuggestions } from './recipe-cost-simulation-decision.service'
import { createShipmentDecisionSuggestions } from './shipment-decision.service'
import { createShipmentFormDecisionSuggestions } from './shipment-form-decision.service'
import { createWasteDecisionSuggestions } from './waste-decision.service'
import { createWorkforcePlanningDecisionSuggestions } from './workforce-planning-decision.service'
import type {
  DecisionDashboardSummary,
  DecisionRisk,
  DecisionSuggestion,
  DecisionSupportFilters,
  DecisionSupportView,
  RiskItem
} from './decision-support.types'
import { getDateKey, getTodayKey } from './decision-support.utils'

type DecisionSuggestionSource =
  | 'production'
  | 'production-planning'
  | 'capacity-planning'
  | 'machine-scheduling'
  | 'workforce-planning'
  | 'bottleneck-analysis'
  | 'continuous-improvement'
  | 'critical-alerts'
  | 'forecasting'
  | 'recommendation-engine'
  | 'cost-engine'
  | 'historical-cost-snapshot'
  | 'recipe-cost-simulation'
  | 'cost-optimization'
  | 'purchase-recommendations'
  | 'inventory'
  | 'quality'
  | 'quality-forms'
  | 'operation-checklists'
  | 'purchasing'
  | 'shipment'
  | 'shipment-forms'
  | 'waste'

type DecisionSuggestionOptions = {
  skipSources?: DecisionSuggestionSource[]
}

export const createDefaultDecisionSupportFilters = (): DecisionSupportFilters => ({
  period: 'MONTH',
  branchId: ALL_FILTER,
  warehouseId: ALL_FILTER,
  productId: ALL_FILTER,
  lotId: ALL_FILTER,
  supplierId: ALL_FILTER,
  operator: ALL_FILTER,
  category: ALL_FILTER,
  risk: ALL_FILTER,
  priority: ALL_FILTER,
  date: '',
  workOrderId: ALL_FILTER
})

const createManagementSuggestions = (
  suggestions: DecisionSuggestion[]
): DecisionSuggestion[] => {
  const criticalSuggestions = suggestions.filter(suggestion => suggestion.risk === 'CRITICAL')
  if(criticalSuggestions.length < 3) return []

  return [createDecisionSuggestion({
    category: 'Management',
    title: 'Kritik risk kumesi',
    description: 'Birden fazla kritik risk ayni anda aktif.',
    reason: `${criticalSuggestions.length} kritik DSS onerisi yonetim koordinasyonu gerektiriyor.`,
    ruleId: 'management-critical-cluster',
    relatedEntityType: 'DecisionSuggestion',
    relatedEntityId: criticalSuggestions[0].id,
    evidenceScore: Math.min(30, criticalSuggestions.length * 4),
    recommendationAction: 'Yonetici aksiyon toplantisi planla ve risk sahiplerini tek karar masasinda topla.',
    expectedImpact: 'Departmanlar arasi bagimli risklerin ayni anda kapanmasini hizlandirir.',
    ownerRole: 'Yonetici'
  })]
}

const createSafeDecisionSuggestions = (
  source: DecisionSuggestionSource,
  options: DecisionSuggestionOptions,
  factory: () => DecisionSuggestion[]
) => options.skipSources?.includes(source) ? [] : resolveReadModelList(factory)

export const createDecisionSuggestions = (
  sourceData: KpiSourceData,
  options: DecisionSuggestionOptions = {}
) => {
  const baseSuggestions = [
    ...createSafeDecisionSuggestions('production', options, () => createProductionDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('production-planning', options, () => createProductionPlanningDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('capacity-planning', options, () => createCapacityPlanningDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('machine-scheduling', options, () => createMachineSchedulingDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('workforce-planning', options, () => createWorkforcePlanningDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('bottleneck-analysis', options, () => createBottleneckAnalysisDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('continuous-improvement', options, () => createContinuousImprovementDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('critical-alerts', options, () => createCriticalAlertDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('forecasting', options, () => createForecastingDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('recommendation-engine', options, () => createRecommendationEngineDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('cost-engine', options, () => createCostEngineDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('historical-cost-snapshot', options, () => createHistoricalCostDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('recipe-cost-simulation', options, () => createRecipeCostSimulationDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('cost-optimization', options, () => createCostOptimizationDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('purchase-recommendations', options, () => createPurchaseRecommendationDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('inventory', options, () => createInventoryDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('quality', options, () => createQualityDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('quality-forms', options, () => createQualityFormDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('operation-checklists', options, () => createOperationChecklistDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('purchasing', options, () => createPurchasingDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('shipment', options, () => createShipmentDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('shipment-forms', options, () => createShipmentFormDecisionSuggestions(sourceData)),
    ...createSafeDecisionSuggestions('waste', options, () => createWasteDecisionSuggestions(sourceData))
  ]

  return dedupeSuggestions([
    ...baseSuggestions,
    ...createManagementSuggestions(baseSuggestions)
  ])
}

const matchesFilterValue = (
  selectedValue: string,
  candidateValue: string
) => selectedValue === ALL_FILTER || selectedValue === '' || selectedValue === candidateValue

export const filterDecisionSuggestions = (
  suggestions: DecisionSuggestion[],
  filters: DecisionSupportFilters
) => suggestions.filter(suggestion => (
  matchesFilterValue(filters.category, suggestion.category)
  && matchesFilterValue(filters.risk, suggestion.risk)
  && matchesFilterValue(filters.priority, suggestion.priority)
  && matchesFilterValue(filters.branchId, suggestion.branchId)
  && matchesFilterValue(filters.warehouseId, suggestion.warehouseId)
  && matchesFilterValue(filters.productId, suggestion.relatedProductId)
  && matchesFilterValue(filters.lotId, suggestion.relatedLotId)
  && matchesFilterValue(filters.supplierId, suggestion.relatedSupplierId)
  && matchesFilterValue(filters.workOrderId, suggestion.relatedWorkOrderId)
  && (!filters.date || getDateKey(suggestion.createdAt) === filters.date)
))

const getCriticalStockCount = (sourceData: KpiSourceData) => (
  sourceData.stockItems.filter(item => item.currentQty <= item.minQty).length
)

const getDashboardSummary = (
  suggestions: DecisionSuggestion[],
  sourceData: KpiSourceData
): DecisionDashboardSummary => ({
  todaySuggestions: suggestions.filter(suggestion => getDateKey(suggestion.createdAt) === getTodayKey()).length,
  criticalRisks: suggestions.filter(suggestion => suggestion.risk === 'CRITICAL').length,
  pendingCorrectiveActions: flattenHACCPCorrectiveActions(sourceData.haccpRecords)
    .filter(action => action.status === 'OPEN' || action.status === 'IN_PROGRESS')
    .length,
  criticalStocks: getCriticalStockCount(sourceData),
  highFire: suggestions.filter(suggestion => (
    suggestion.ruleId === 'production-fire-root-cause'
    || suggestion.ruleId === 'cost-engine-fire-cost'
    || suggestion.ruleId === 'cost-optimization-waste'
    || suggestion.ruleId.startsWith('waste-')
    || suggestion.ruleId === 'forecasting-critical-risk'
    || suggestion.ruleId === 'recommendation-engine-urgent'
  )).length,
  riskySuppliers: suggestions.filter(suggestion => (
    suggestion.category === 'Purchasing'
    && (suggestion.risk === 'HIGH' || suggestion.risk === 'CRITICAL')
  )).length,
  riskyCcps: suggestions.filter(suggestion => (
    suggestion.ruleId === 'quality-ccp-failure-risk'
    || suggestion.ruleId.startsWith('quality-form-')
    || suggestion.ruleId.startsWith('operation-checklist-')
    || suggestion.ruleId === 'critical-alert-quality-fail'
    || suggestion.ruleId === 'forecasting-quality-risk'
    || suggestion.ruleId === 'recommendation-engine-quality'
  )).length,
  delayedProduction: suggestions.filter(suggestion => (
    suggestion.ruleId === 'production-delay-shift'
    || suggestion.ruleId.startsWith('production-planning-')
    || suggestion.ruleId.startsWith('capacity-planning-')
    || suggestion.ruleId.startsWith('machine-scheduling-')
    || suggestion.ruleId.startsWith('workforce-planning-')
    || suggestion.ruleId.startsWith('bottleneck-analysis-')
    || suggestion.ruleId.startsWith('continuous-improvement-')
    || suggestion.ruleId === 'critical-alert-maintenance-line'
    || suggestion.ruleId === 'critical-alert-machine-stop-review'
    || suggestion.ruleId === 'forecasting-production-increase'
    || suggestion.ruleId === 'forecasting-critical-risk'
    || suggestion.ruleId === 'recommendation-engine-urgent'
    || suggestion.ruleId === 'recommendation-engine-maintenance'
    || suggestion.ruleId === 'cost-optimization-energy'
    || suggestion.ruleId === 'cost-optimization-maintenance'
  )).length,
  delayedShipments: suggestions.filter(suggestion => (
    suggestion.ruleId === 'shipment-delay-revision'
    || suggestion.ruleId.startsWith('shipment-form-')
    || suggestion.ruleId === 'critical-alert-generic-critical'
    || suggestion.ruleId === 'forecasting-shipment-surge'
    || suggestion.ruleId === 'recommendation-engine-shipment'
  )).length
})

const toRiskItems = (suggestions: DecisionSuggestion[]): RiskItem[] => (
  suggestions.map(suggestion => ({
    risk: suggestion.risk as DecisionRisk,
    score: suggestion.riskScore,
    evidence: suggestion.reason
  }))
)

export const createDecisionSupportView = (
  sourceData: KpiSourceData,
  filters: DecisionSupportFilters
): DecisionSupportView => {
  const suggestions = createDecisionSuggestions(sourceData)
  const filteredSuggestions = filterDecisionSuggestions(suggestions, filters)

  return {
    generatedAt: new Date().toISOString(),
    filters,
    rules: DECISION_RULES,
    suggestions,
    filteredSuggestions,
    risks: toRiskItems(filteredSuggestions),
    dashboard: getDashboardSummary(suggestions, sourceData),
    sourceData
  }
}
