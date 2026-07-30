import { flattenHACCPCorrectiveActions } from '../haccp/haccp.mock'
import { createDefaultKpiFilters } from '../kpi-reporting/kpi.service'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { ALL_FILTER } from '../kpi-reporting/kpi.utils'
import { DECISION_RULES } from './decision-rules'
import { createCostEngineDecisionSuggestions } from './cost-engine-decision.service'
import { createCapacityPlanningDecisionSuggestions } from './capacity-planning-decision.service'
import { createBottleneckAnalysisDecisionSuggestions } from './bottleneck-analysis-decision.service'
import { createInventoryDecisionSuggestions } from './inventory-decision.service'
import { createMachineSchedulingDecisionSuggestions } from './machine-scheduling-decision.service'
import { createOperationChecklistDecisionSuggestions } from './operation-checklist-decision.service'
import { createDecisionSuggestion, dedupeSuggestions } from './recommendation-engine.service'
import { createProductionPlanningDecisionSuggestions } from './production-planning-decision.service'
import { createProductionDecisionSuggestions } from './production-decision.service'
import { createPurchasingDecisionSuggestions } from './purchasing-decision.service'
import { createQualityDecisionSuggestions } from './quality-decision.service'
import { createQualityFormDecisionSuggestions } from './quality-form-decision.service'
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

export const createDefaultDecisionSupportFilters = (): DecisionSupportFilters => ({
  ...createDefaultKpiFilters(),
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

export const createDecisionSuggestions = (
  sourceData: KpiSourceData
) => {
  const baseSuggestions = [
    ...createProductionDecisionSuggestions(sourceData),
    ...createProductionPlanningDecisionSuggestions(sourceData),
    ...createCapacityPlanningDecisionSuggestions(sourceData),
    ...createMachineSchedulingDecisionSuggestions(sourceData),
    ...createWorkforcePlanningDecisionSuggestions(sourceData),
    ...createBottleneckAnalysisDecisionSuggestions(sourceData),
    ...createCostEngineDecisionSuggestions(sourceData),
    ...createInventoryDecisionSuggestions(sourceData),
    ...createQualityDecisionSuggestions(sourceData),
    ...createQualityFormDecisionSuggestions(sourceData),
    ...createOperationChecklistDecisionSuggestions(sourceData),
    ...createPurchasingDecisionSuggestions(sourceData),
    ...createShipmentDecisionSuggestions(sourceData),
    ...createShipmentFormDecisionSuggestions(sourceData),
    ...createWasteDecisionSuggestions(sourceData)
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
    || suggestion.ruleId.startsWith('waste-')
  )).length,
  riskySuppliers: suggestions.filter(suggestion => suggestion.category === 'Purchasing' && (suggestion.risk === 'HIGH' || suggestion.risk === 'CRITICAL')).length,
  riskyCcps: suggestions.filter(suggestion => (
    suggestion.ruleId === 'quality-ccp-failure-risk'
    || suggestion.ruleId.startsWith('quality-form-')
    || suggestion.ruleId.startsWith('operation-checklist-')
  )).length,
  delayedProduction: suggestions.filter(suggestion => (
    suggestion.ruleId === 'production-delay-shift'
    || suggestion.ruleId.startsWith('production-planning-')
    || suggestion.ruleId.startsWith('capacity-planning-')
    || suggestion.ruleId.startsWith('machine-scheduling-')
    || suggestion.ruleId.startsWith('workforce-planning-')
    || suggestion.ruleId.startsWith('bottleneck-analysis-')
  )).length,
  delayedShipments: suggestions.filter(suggestion => (
    suggestion.ruleId === 'shipment-delay-revision'
    || suggestion.ruleId.startsWith('shipment-form-')
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
