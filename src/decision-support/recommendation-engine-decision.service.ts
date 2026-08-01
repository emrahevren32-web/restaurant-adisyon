import { calculateRecommendationReport } from '../recommendation-engine/recommendation-calculation.service'
import type { RecommendationItem } from '../recommendation-engine/recommendation-engine.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { formatNumber } from '../kpi-reporting/kpi.utils'
import type { DecisionCategory, DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const activeRecommendationItems = (
  sourceData: KpiSourceData
) => calculateRecommendationReport({
  reportDate: getTodayKey(),
  scope: 'all',
  responsiblePerson: 'Karar Destek Merkezi',
  description: 'Karar Destek analiz modeli öneri özeti.',
  sourceData,
  decisionSuggestions: [],
  actorName: 'Karar Destek Merkezi',
  getReportNo: () => `RC-${new Date().getFullYear()}-000000`
}).items
  .filter(item => item.risk === 'CRITICAL' || item.risk === 'HIGH' || item.priority === 'URGENT')
  .sort((first, second) => second.riskScore - first.riskScore || second.expectedBenefitScore - first.expectedBenefitScore)

const getEvidenceScore = (
  item: RecommendationItem
) => Math.min(30, Math.max(10, item.riskScore * 0.2 + item.expectedBenefitScore * 0.08 + item.confidenceScore * 0.04))

const toDecisionCategory = (
  item: RecommendationItem
): DecisionCategory => {
  if(item.recommendationType === 'STOCK') return 'Inventory'
  if(item.recommendationType === 'QUALITY') return 'Quality'
  if(item.recommendationType === 'PURCHASING') return 'Purchasing'
  if(item.recommendationType === 'SHIPMENT') return 'Shipment'
  return 'Production'
}

const createRecommendationSuggestion = (
  item: RecommendationItem,
  ruleId: string,
  category: DecisionCategory,
  title: string,
  description: string
) => createDecisionSuggestion({
  category,
  title,
  description,
  reason: `${item.reason} Risk ${formatNumber(item.riskScore, 1)}, fayda ${formatNumber(item.expectedBenefitScore, 1)}, güven skoru ${formatNumber(item.confidenceScore, 1)}.`,
  ruleId,
  relatedEntityType: 'RecommendationItem',
  relatedEntityId: item.id,
  relatedProductId: item.productId || item.stockItemId,
  relatedSupplierId: item.supplierId,
  relatedWorkOrderId: item.sourceId,
  branchId: item.branchId,
  warehouseId: item.productionLineId || item.branchId,
  evidenceScore: getEvidenceScore(item),
  createdAt: item.createdAt,
  recommendationAction: item.action,
  expectedImpact: item.expectedImpact,
  ownerRole: item.ownerRole
})

const createUrgentSuggestion = (
  items: RecommendationItem[]
): DecisionSuggestion[] => {
  const item = items.find(record => record.priority === 'URGENT' || record.risk === 'CRITICAL')
  if(!item) return []

  return [createRecommendationSuggestion(
    item,
    'recommendation-engine-urgent',
    toDecisionCategory(item),
    `${item.relatedEntityName} icin acil otomatik oneri`,
    'Öneri Motoru kritik risk, fayda ve güven skorunu Karar Destek için önceliklendirir.'
  )]
}

const createCriticalStockSuggestion = (
  items: RecommendationItem[]
): DecisionSuggestion[] => {
  const item = items.find(record => record.recommendationType === 'STOCK' && (record.risk === 'CRITICAL' || record.risk === 'HIGH'))
  if(!item) return []

  return [createRecommendationSuggestion(
    item,
    'recommendation-engine-critical-stock',
    'Inventory',
    `${item.relatedEntityName} kritik stok onerisi`,
    'Öneri Motoru stok, tahmin ve kritik alarm sinyallerini birleştirerek stok aksiyonunu görünür kılar.'
  )]
}

const createMaintenanceSuggestion = (
  items: RecommendationItem[]
): DecisionSuggestion[] => {
  const item = items.find(record => record.recommendationType === 'MAINTENANCE' || record.recommendationType === 'MACHINE')
  if(!item) return []

  return [createRecommendationSuggestion(
    item,
    'recommendation-engine-maintenance',
    'Production',
    `${item.machineCode || item.relatedEntityName} bakim/makine onceligi`,
    'Öneri Motoru makine, bakım, kapasite ve darboğaz sinyallerini manuel inceleme önerisine dönüştürür.'
  )]
}

const createQualitySuggestion = (
  items: RecommendationItem[]
): DecisionSuggestion[] => {
  const item = items.find(record => record.recommendationType === 'QUALITY')
  if(!item) return []

  return [createRecommendationSuggestion(
    item,
    'recommendation-engine-quality',
    'Quality',
    `${item.relatedEntityName} kalite kontrol sikligi`,
    'Öneri Motoru kalite, HACCP, form ve alarm sinyallerinden kontrol sıklığı önerisi üretir.'
  )]
}

const createShipmentSuggestion = (
  items: RecommendationItem[]
): DecisionSuggestion[] => {
  const item = items.find(record => record.recommendationType === 'SHIPMENT')
  if(!item) return []

  return [createRecommendationSuggestion(
    item,
    'recommendation-engine-shipment',
    'Shipment',
    `${item.relatedEntityName} sevkiyat takvimi incelenmeli`,
    'Öneri Motoru sevkiyat, planlama ve tahmin sinyallerinden manuel sevkiyat önerisi üretir.'
  )]
}

export const createRecommendationEngineDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const items = activeRecommendationItems(sourceData)
  if(items.length === 0) return []

  return [
    ...createUrgentSuggestion(items),
    ...createCriticalStockSuggestion(items),
    ...createMaintenanceSuggestion(items),
    ...createQualitySuggestion(items),
    ...createShipmentSuggestion(items)
  ].slice(0, 8)
}
