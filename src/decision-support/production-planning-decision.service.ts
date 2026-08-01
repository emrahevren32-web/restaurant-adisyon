import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatNumber,
  formatPercent,
  formatQuantity,
  percent
} from '../kpi-reporting/kpi.utils'
import { ProductionPlanningService } from '../production-planning/production-planning.service'
import type {
  ProductionPlan,
  ProductionPlanItem
} from '../production-planning/production-planning.types'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const activePlans = (
  sourceData: KpiSourceData
) => ProductionPlanningService.list(sourceData).filter(plan => plan.status !== 'CANCELLED')

const getLeadPlan = (
  plans: ProductionPlan[],
  predicate: (item: ProductionPlanItem) => boolean
) => plans.find(plan => plan.items.some(predicate)) || plans[0]

const createCriticalStockSuggestions = (
  plans: ProductionPlan[]
): DecisionSuggestion[] => {
  const criticalItems = plans.flatMap(plan => plan.items.map(item => ({ plan, item })))
    .filter(row => row.item.currentStock <= row.item.minimumStock || row.item.priority === 'CRITICAL')
    .sort((first, second) => second.item.produceQuantity - first.item.produceQuantity)

  if(criticalItems.length === 0) return []
  const lead = criticalItems[0]

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${lead.item.productName} stogu kritik seviyeye dusecek`,
    description: 'Üretim Planlama stok ve minimum stok analizinden kritik üretim ihtiyacı çıkardı.',
    reason: `${lead.item.productName} mevcut stok ${formatQuantity(lead.item.currentStock, lead.item.unit)}, minimum ${formatQuantity(lead.item.minimumStock, lead.item.unit)}; uretilecek miktar ${formatQuantity(lead.item.produceQuantity, lead.item.unit)}.`,
    ruleId: 'production-planning-critical-stock',
    relatedEntityType: 'ProductionPlan',
    relatedEntityId: lead.plan.id,
    relatedProductId: lead.item.productId,
    branchId: lead.plan.branchId,
    warehouseId: lead.plan.facilityId,
    evidenceScore: Math.min(35, Math.max(15, lead.item.produceQuantity)),
    createdAt: lead.plan.updatedAt || lead.plan.createdAt,
    recommendationAction: `${lead.item.productName} satirini ilk vardiyaya al ve stok minimumunu plan tamamlanana kadar izle.`,
    expectedImpact: 'Kritik stok kaynakli sevkiyat ve uretim aksamasini azaltir.',
    ownerRole: 'Uretim Planlama'
  })]
}

const createQuantityIncreaseSuggestions = (
  plans: ProductionPlan[]
): DecisionSuggestion[] => {
  const rows = plans.flatMap(plan => plan.items.map(item => ({ plan, item })))
    .filter(row => row.item.forecastQuantity > 0 && row.item.produceQuantity > 0)
    .map(row => ({
      ...row,
      increaseNeed: percent(Math.max(0, row.item.demandQuantity - row.item.produceQuantity - row.item.currentStock), Math.max(1, row.item.produceQuantity))
    }))
    .filter(row => row.increaseNeed >= 15)
    .sort((first, second) => second.increaseNeed - first.increaseNeed)

  if(rows.length === 0) return []
  const lead = rows[0]

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${lead.item.productName} icin uretim miktari artirilmali`,
    description: 'Üretim Planlama talep ve tahmin farkında %15 üzeri artış ihtiyacı buldu.',
    reason: `Talep ${formatQuantity(lead.item.demandQuantity, lead.item.unit)}, planlanan uretim ${formatQuantity(lead.item.produceQuantity, lead.item.unit)}; artis ihtiyaci ${formatPercent(lead.increaseNeed)}.`,
    ruleId: 'production-planning-quantity-increase',
    relatedEntityType: 'ProductionPlan',
    relatedEntityId: lead.plan.id,
    relatedProductId: lead.item.productId,
    branchId: lead.plan.branchId,
    warehouseId: lead.plan.facilityId,
    evidenceScore: Math.min(35, lead.increaseNeed),
    createdAt: lead.plan.updatedAt || lead.plan.createdAt,
    recommendationAction: 'Plan satiri uretim miktarini revize et ve ilgili recete/hat kapasitesini kontrol et.',
    expectedImpact: 'Sube ve musteri talebinin eksik karsilanma riskini azaltir.',
    ownerRole: 'Uretim Planlama'
  })]
}

const createWasteRevisionSuggestions = (
  plans: ProductionPlan[]
): DecisionSuggestion[] => {
  const rows = plans.flatMap(plan => plan.items.map(item => ({ plan, item })))
    .filter(row => row.item.wastePercent >= 7)
    .sort((first, second) => second.item.wastePercent - first.item.wastePercent)

  if(rows.length === 0) return []
  const lead = rows[0]

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${lead.item.productName} fire orani nedeniyle plan revizyonu gerektiriyor`,
    description: 'Üretim Planlama fire etkisini plan miktarı ve reçete üzerinde kritik buldu.',
    reason: `${lead.item.productName} fire orani ${formatPercent(lead.item.wastePercent)}; plan uretimi ${formatQuantity(lead.item.produceQuantity, lead.item.unit)}.`,
    ruleId: 'production-planning-waste-revision',
    relatedEntityType: 'ProductionPlan',
    relatedEntityId: lead.plan.id,
    relatedProductId: lead.item.productId,
    branchId: lead.plan.branchId,
    warehouseId: lead.plan.facilityId,
    evidenceScore: Math.min(35, lead.item.wastePercent * 2),
    createdAt: lead.plan.updatedAt || lead.plan.createdAt,
    recommendationAction: 'Fire payini ve recete toleranslarini kontrol ederek planlanan uretimi revize et.',
    expectedImpact: 'Planlanan uretimin gercek teslim miktarina daha yakin olmasini saglar.',
    ownerRole: 'Uretim ve Kalite'
  })]
}

const createBranchDemandGapSuggestions = (
  plans: ProductionPlan[]
): DecisionSuggestion[] => {
  const branchPlans = plans.filter(plan => plan.planType === 'BRANCH_BASED')
  const leadPlan = getLeadPlan(branchPlans.length > 0 ? branchPlans : plans, item => item.branchDemandQuantity + item.customerOrderQuantity > item.produceQuantity + item.currentStock)
  const leadItem = leadPlan?.items.find(item => item.branchDemandQuantity + item.customerOrderQuantity > item.produceQuantity + item.currentStock)
  if(!leadPlan || !leadItem) return []

  const gap = Math.max(0, leadItem.branchDemandQuantity + leadItem.customerOrderQuantity - leadItem.produceQuantity - leadItem.currentStock)

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${leadPlan.branchName} talebi mevcut plana gore karsilanamiyor`,
    description: 'Üretim Planlama şube ve müşteri talebinde planlanan üretime göre açık tespit etti.',
    reason: `${leadItem.productName} icin talep acigi ${formatQuantity(gap, leadItem.unit)}; sube/musteri talebi ${formatQuantity(leadItem.branchDemandQuantity + leadItem.customerOrderQuantity, leadItem.unit)}.`,
    ruleId: 'production-planning-branch-demand-gap',
    relatedEntityType: 'ProductionPlan',
    relatedEntityId: leadPlan.id,
    relatedProductId: leadItem.productId,
    branchId: leadPlan.branchId,
    warehouseId: leadPlan.facilityId,
    evidenceScore: Math.min(35, gap),
    createdAt: leadPlan.updatedAt || leadPlan.createdAt,
    recommendationAction: 'Sube bazli plan satirini artir veya sevkiyat onceligini yeniden sirala.',
    expectedImpact: 'Sube talep karsilama oranini ve musteri teslim guvenilirligini artirir.',
    ownerRole: 'Uretim Planlama'
  })]
}

export const createProductionPlanningDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const plans = activePlans(sourceData)
  if(plans.length === 0) return []

  return [
    ...createCriticalStockSuggestions(plans),
    ...createQuantityIncreaseSuggestions(plans),
    ...createWasteRevisionSuggestions(plans),
    ...createBranchDemandGapSuggestions(plans)
  ].slice(0, 8)
}
