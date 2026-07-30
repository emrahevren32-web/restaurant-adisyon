import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import { WorkforcePlanningService } from '../workforce-planning/workforce-planning.service'
import type { WorkforcePlan } from '../workforce-planning/workforce-planning.types'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const activePlans = (
  sourceData: KpiSourceData
) => WorkforcePlanningService.list(sourceData).filter(plan => plan.status !== 'CANCELLED')

const createShiftMissingSuggestion = (
  plans: WorkforcePlan[]
): DecisionSuggestion[] => {
  const row = plans.flatMap(plan => plan.shiftAssignments.map(assignment => ({ plan, assignment })))
    .filter(record => record.assignment.missingEmployeeCount > 0)
    .sort((first, second) => second.assignment.missingEmployeeCount - first.assignment.missingEmployeeCount)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.assignment.shiftName} vardiyasinda personel eksik`,
    description: 'Workforce Planning vardiya bazli atanan personel ve uretim yukunu karsilastirir.',
    reason: `${row.assignment.shiftName} vardiyasinda ${formatNumber(row.assignment.missingEmployeeCount)} personel eksik, doluluk ${formatPercent(row.assignment.utilizationPercent)}.`,
    ruleId: 'workforce-planning-shift-missing',
    relatedEntityType: 'WorkforcePlan',
    relatedEntityId: row.plan.id,
    evidenceScore: Math.min(30, Math.max(16, row.assignment.missingEmployeeCount * 8)),
    createdAt: row.plan.updatedAt || row.plan.createdAt,
    recommendationAction: 'Vardiya personel sayisini manuel olarak kontrol et ve uygun personel kaydirma senaryosunu degerlendir.',
    expectedImpact: 'Vardiya kaynakli uretim gecikmesini azaltir.',
    ownerRole: 'Uretim Planlama'
  })]
}

const createLineOperatorSuggestion = (
  plans: WorkforcePlan[]
): DecisionSuggestion[] => {
  const row = plans.flatMap(plan => plan.items.map(item => ({ plan, item })))
    .filter(record => record.item.status === 'MISSING')
    .sort((first, second) => second.item.workingMinutes - first.item.workingMinutes)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.item.productionLineName} icin operator sayisi yetersiz`,
    description: 'Workforce Planning hat bazli personel atama eksiklerini belirler.',
    reason: `${row.item.productionLineName} / ${row.item.machineCode} gorevi icin aktif personel bulunamadi.`,
    ruleId: 'workforce-planning-line-operator-gap',
    relatedEntityType: 'WorkforcePlan',
    relatedEntityId: row.plan.id,
    relatedWorkOrderId: row.item.sourceMachineScheduleItemId,
    warehouseId: row.item.productionLineId,
    evidenceScore: Math.min(30, Math.max(18, row.item.workingMinutes / 20)),
    createdAt: row.plan.updatedAt || row.plan.createdAt,
    recommendationAction: 'Hat operator ihtiyacini vardiya listesi ve departman personeli ile manuel olarak eslestir.',
    expectedImpact: 'Hat uzerindeki is bekleme ve gecikme riskini azaltir.',
    ownerRole: 'Operasyon Muduru'
  })]
}

const createMachineCoverageSuggestion = (
  plans: WorkforcePlan[]
): DecisionSuggestion[] => {
  const row = plans.flatMap(plan => plan.items.map(item => ({ plan, item })))
    .filter(record => record.item.conflictReason.includes('vardiya'))
    .sort((first, second) => second.item.workingMinutes - first.item.workingMinutes)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.item.machineCode} icin vardiya kapsami bulunamadi`,
    description: 'Workforce Planning makine gorev saatlerini mevcut vardiya kayitlariyla karsilastirir.',
    reason: `${row.item.machineName} icin ${row.item.shiftName} vardiyasi gorev saatini kapsamiyor.`,
    ruleId: 'workforce-planning-machine-operator-missing',
    relatedEntityType: 'WorkforcePlan',
    relatedEntityId: row.plan.id,
    relatedWorkOrderId: row.item.sourceMachineScheduleItemId,
    warehouseId: row.item.productionLineId,
    evidenceScore: Math.min(30, Math.max(14, row.item.workingMinutes / 30)),
    createdAt: row.plan.updatedAt || row.plan.createdAt,
    recommendationAction: 'Makine gorevi icin yetkili operator vardiyasini veya gorev saatini manuel olarak kontrol et.',
    expectedImpact: 'Makine baslama saatindeki personel hazirlik riskini azaltir.',
    ownerRole: 'Makine Cizelgeleme'
  })]
}

const createOverlapSuggestion = (
  plans: WorkforcePlan[]
): DecisionSuggestion[] => {
  const row = plans.flatMap(plan => plan.items.map(item => ({ plan, item })))
    .filter(record => record.item.conflictReason.includes('cakisan'))
    .sort((first, second) => second.item.workingMinutes - first.item.workingMinutes)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.item.employeeName} icin cakisan gorev atanmis`,
    description: 'Workforce Planning ayni personele ayni zaman araliginda binen gorevleri isaretler.',
    reason: `${row.item.employeeName} icin ${row.item.machineCode} gorevi baska gorevle cakisiyor.`,
    ruleId: 'workforce-planning-employee-overlap',
    relatedEntityType: 'WorkforcePlan',
    relatedEntityId: row.plan.id,
    relatedWorkOrderId: row.item.sourceMachineScheduleItemId,
    evidenceScore: Math.min(30, Math.max(18, row.item.workingMinutes / 20)),
    createdAt: row.plan.updatedAt || row.plan.createdAt,
    recommendationAction: 'Ayni personele ait gorevleri zaman penceresi acisindan manuel olarak ayir.',
    expectedImpact: 'Personel planinda uygulanamaz gorev cakismasini azaltir.',
    ownerRole: 'Personel Planlama'
  })]
}

export const createWorkforcePlanningDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const plans = activePlans(sourceData)
  if(plans.length === 0) return []

  return [
    ...createShiftMissingSuggestion(plans),
    ...createLineOperatorSuggestion(plans),
    ...createMachineCoverageSuggestion(plans),
    ...createOverlapSuggestion(plans)
  ].slice(0, 8)
}
