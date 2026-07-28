import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import { CapacityPlanningService } from '../capacity-planning/capacity-planning.service'
import type {
  CapacityPlan,
  ProductionCapacity
} from '../capacity-planning/capacity-planning.types'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const activePlans = (
  sourceData: KpiSourceData
) => CapacityPlanningService.list(sourceData).filter(plan => plan.status !== 'CANCELLED')

const getLeadCapacity = (
  plans: CapacityPlan[],
  predicate: (capacity: ProductionCapacity) => boolean
) => plans.flatMap(plan => plan.productionCapacities.map(capacity => ({ plan, capacity })))
  .filter(row => predicate(row.capacity))
  .sort((first, second) => second.capacity.utilizationPercent - first.capacity.utilizationPercent)[0]

const createOverloadSuggestion = (
  plans: CapacityPlan[]
): DecisionSuggestion[] => {
  const lead = getLeadCapacity(plans, capacity => capacity.utilizationPercent >= 100 || capacity.overloadMinutes > 0)
  if(!lead) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${lead.capacity.productionLineName} kapasite ustune cikiyor`,
    description: 'Capacity Planning uretim yuku ve kullanilabilir sureye gore asiri yuk tespit etti.',
    reason: `${lead.capacity.productionLineName} doluluk ${formatPercent(lead.capacity.utilizationPercent)}, asiri yuk ${formatNumber(lead.capacity.overloadMinutes)} dk.`,
    ruleId: 'capacity-planning-line-overload',
    relatedEntityType: 'CapacityPlan',
    relatedEntityId: lead.plan.id,
    branchId: '',
    warehouseId: lead.capacity.productionLineId,
    evidenceScore: Math.min(35, Math.max(18, lead.capacity.utilizationPercent - 80 + lead.capacity.overloadMinutes / 30)),
    createdAt: lead.plan.updatedAt || lead.plan.createdAt,
    recommendationAction: 'Planlanan uretim yukunu alternatif hatta kaydir veya ek vardiya senaryosunu degerlendir.',
    expectedImpact: 'Teslimat gecikmesi ve hat uzeri asiri yuk riskini azaltir.',
    ownerRole: 'Kapasite Planlama'
  })]
}

const createMaintenanceSuggestion = (
  plans: CapacityPlan[]
): DecisionSuggestion[] => {
  const row = plans.flatMap(plan => plan.machineCapacities.map(machine => ({ plan, machine })))
    .filter(item => item.machine.maintenanceClosed)
    .sort((first, second) => second.machine.totalLoadMinutes - first.machine.totalLoadMinutes)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.machine.machineCode} bakim nedeniyle kapasiteyi dusuruyor`,
    description: 'Capacity Planning maintenance sinyalinin kullanilabilir sureyi azalttigini tespit etti.',
    reason: `${row.machine.machineName} icin maintenance ${formatNumber(row.machine.maintenanceMinutes)} dk, kullanilabilir sure ${formatNumber(row.machine.availableMinutes)} dk.`,
    ruleId: 'capacity-planning-maintenance-impact',
    relatedEntityType: 'CapacityPlan',
    relatedEntityId: row.plan.id,
    branchId: '',
    warehouseId: row.machine.productionLineId,
    evidenceScore: Math.min(35, Math.max(16, row.machine.maintenanceMinutes / 20)),
    createdAt: row.plan.updatedAt || row.plan.createdAt,
    recommendationAction: 'Bakim kapanis saatini ve alternatif makine/hat planini kapasite planina isle.',
    expectedImpact: 'Bakim kaynakli uretilebilirlik kaybini gorunur hale getirir.',
    ownerRole: 'Bakim ve Uretim'
  })]
}

const createThirdShiftSuggestion = (
  plans: CapacityPlan[]
): DecisionSuggestion[] => {
  const overloadedPlans = plans.filter(plan => plan.productionCapacities.some(capacity => capacity.overloadMinutes > 0))
  const lead = overloadedPlans[0]
  if(!lead) return []
  const overloadMinutes = lead.productionCapacities.reduce((total, capacity) => total + capacity.overloadMinutes, 0)

  return [createDecisionSuggestion({
    category: 'Production',
    title: 'Ek vardiya kapasite problemini azaltabilir',
    description: 'Capacity Planning toplam asiri yukun vardiya genisletme ile karsilanabilecegini gosterdi.',
    reason: `${lead.capacityPlanNo} icin toplam asiri yuk ${formatNumber(overloadMinutes)} dk.`,
    ruleId: 'capacity-planning-third-shift-needed',
    relatedEntityType: 'CapacityPlan',
    relatedEntityId: lead.id,
    evidenceScore: Math.min(35, Math.max(14, overloadMinutes / 20)),
    createdAt: lead.updatedAt || lead.createdAt,
    recommendationAction: '3. vardiya veya gece vardiyasi senaryosunu manuel olarak degerlendir.',
    expectedImpact: 'Planlanan uretimin mevcut gun icinde tamamlanma olasiligini artirir.',
    ownerRole: 'Operasyon Muduru'
  })]
}

const createLowUtilizationSuggestion = (
  plans: CapacityPlan[]
): DecisionSuggestion[] => {
  const lead = getLeadCapacity(plans, capacity => capacity.totalLoadMinutes > 0 && capacity.utilizationPercent < 45)
  if(!lead) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${lead.capacity.productionLineName} dusuk kapasite ile calisiyor`,
    description: 'Capacity Planning hat bazli dusuk doluluk sinyali uretir.',
    reason: `${lead.capacity.productionLineName} doluluk ${formatPercent(lead.capacity.utilizationPercent)}, bos kapasite ${formatNumber(lead.capacity.idleMinutes)} dk.`,
    ruleId: 'capacity-planning-low-utilization',
    relatedEntityType: 'CapacityPlan',
    relatedEntityId: lead.plan.id,
    branchId: '',
    warehouseId: lead.capacity.productionLineId,
    evidenceScore: Math.min(30, Math.max(10, 45 - lead.capacity.utilizationPercent)),
    createdAt: lead.plan.updatedAt || lead.plan.createdAt,
    recommendationAction: 'Dusuk doluluktaki hatta uygun urun/hazirlik islerini manuel olarak kaydir.',
    expectedImpact: 'Hat verimliligini ve gun ici kapasite dengesini iyilestirir.',
    ownerRole: 'Kapasite Planlama'
  })]
}

export const createCapacityPlanningDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const plans = activePlans(sourceData)
  if(plans.length === 0) return []

  return [
    ...createOverloadSuggestion(plans),
    ...createMaintenanceSuggestion(plans),
    ...createThirdShiftSuggestion(plans),
    ...createLowUtilizationSuggestion(plans)
  ].slice(0, 8)
}
