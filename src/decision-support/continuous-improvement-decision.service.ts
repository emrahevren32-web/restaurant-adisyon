import { ContinuousImprovementService } from '../continuous-improvement/continuous-improvement.service'
import type {
  ImprovementOpportunity,
  ImprovementReport
} from '../continuous-improvement/continuous-improvement.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const activeReports = (
  sourceData: KpiSourceData
) => ContinuousImprovementService.list(sourceData).filter(report => report.status !== 'CANCELLED')

const flattenOpportunities = (
  reports: ImprovementReport[]
) => reports.flatMap(report => report.opportunities.map(opportunity => ({ report, opportunity })))

const createSetupReductionSuggestion = (
  reports: ImprovementReport[]
): DecisionSuggestion[] => {
  const row = flattenOpportunities(reports)
    .filter(record => record.opportunity.area === 'SETUP' && record.opportunity.expectedGainPercent >= 12)
    .sort((first, second) => second.opportunity.expectedGainPercent - first.opportunity.expectedGainPercent)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.opportunity.entityName} setup suresi azaltilabilir`,
    description: 'Continuous Improvement setup ve temizlik kayiplarindan iyilestirme firsati uretir.',
    reason: `${row.opportunity.entityName} icin beklenen setup iyilesmesi ${formatPercent(row.opportunity.expectedGainPercent)}, kazanc ${formatNumber(row.opportunity.expectedGainMinutes)} dk.`,
    ruleId: 'continuous-improvement-setup-reduction',
    relatedEntityType: 'ImprovementReport',
    relatedEntityId: row.report.id,
    relatedWorkOrderId: row.opportunity.sourceId,
    warehouseId: row.opportunity.productionLineId,
    evidenceScore: Math.min(30, Math.max(14, row.opportunity.expectedGainPercent)),
    createdAt: row.report.updatedAt || row.report.createdAt,
    recommendationAction: 'Setup sirasi, recete bloklama ve hazirlik adimlarini manuel iyilestirme listesine al.',
    expectedImpact: 'Setup kaynakli bekleme ve kapasite kaybini azaltir.',
    ownerRole: 'Uretim Planlama'
  })]
}

const createMachineUtilizationSuggestion = (
  reports: ImprovementReport[]
): DecisionSuggestion[] => {
  const row = flattenOpportunities(reports)
    .filter(record => record.opportunity.area === 'MACHINE' && record.opportunity.expectedBenefitScore >= 60)
    .sort((first, second) => second.opportunity.expectedBenefitScore - first.opportunity.expectedBenefitScore)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.opportunity.machineCode || row.opportunity.entityCode} daha verimli kullanilabilir`,
    description: 'Continuous Improvement makine doluluk, bos sure ve bekleme sinyallerini analiz eder.',
    reason: `${row.opportunity.entityName} fayda skoru ${formatNumber(row.opportunity.expectedBenefitScore, 1)}, bos sure ${formatNumber(row.opportunity.idleMinutes)} dk.`,
    ruleId: 'continuous-improvement-machine-utilization',
    relatedEntityType: 'ImprovementReport',
    relatedEntityId: row.report.id,
    relatedWorkOrderId: row.opportunity.sourceId,
    warehouseId: row.opportunity.productionLineId,
    evidenceScore: Math.min(30, Math.max(12, row.opportunity.expectedBenefitScore - 55)),
    createdAt: row.report.updatedAt || row.report.createdAt,
    recommendationAction: 'Makine uzerindeki bos sure, bekleme ve is sira etkisini manuel olarak incele.',
    expectedImpact: 'Makine kullanim oranini artirir ve gunluk kapasite kaybini azaltir.',
    ownerRole: 'Makine Cizelgeleme'
  })]
}

const createShiftWaitingSuggestion = (
  reports: ImprovementReport[]
): DecisionSuggestion[] => {
  const row = flattenOpportunities(reports)
    .filter(record => (record.opportunity.area === 'SHIFT' || record.opportunity.area === 'PERSONNEL') && record.opportunity.waitingMinutes >= 60)
    .sort((first, second) => second.opportunity.waitingMinutes - first.opportunity.waitingMinutes)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.opportunity.shiftName || row.opportunity.entityName} vardiya dagilimi iyilestirilebilir`,
    description: 'Continuous Improvement Workforce Planning sinyallerinden vardiya/personel firsati uretir.',
    reason: `Vardiya dagilimi degistirilirse bekleme ${formatPercent(row.opportunity.expectedGainPercent)} azalabilir; bekleme ${formatNumber(row.opportunity.waitingMinutes)} dk.`,
    ruleId: 'continuous-improvement-shift-waiting',
    relatedEntityType: 'ImprovementReport',
    relatedEntityId: row.report.id,
    relatedWorkOrderId: row.opportunity.sourceId,
    warehouseId: row.opportunity.productionLineId,
    evidenceScore: Math.min(30, Math.max(14, row.opportunity.waitingMinutes / 20)),
    createdAt: row.report.updatedAt || row.report.createdAt,
    recommendationAction: 'Vardiya kapsami, personel yetkinligi ve gorev yogunlugunu manuel olarak karsilastir.',
    expectedImpact: 'Personel kaynakli bekleme ve baslama gecikmesini azaltabilir.',
    ownerRole: 'Personel Planlama'
  })]
}

const createMaintenanceCapacitySuggestion = (
  reports: ImprovementReport[]
): DecisionSuggestion[] => {
  const row = flattenOpportunities(reports)
    .filter(record => record.opportunity.area === 'MAINTENANCE' && record.opportunity.maintenanceMinutes > 0)
    .sort((first, second) => second.opportunity.maintenanceMinutes - first.opportunity.maintenanceMinutes)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.opportunity.entityName} bakim plani kapasiteyi etkiliyor`,
    description: 'Continuous Improvement maintenance surelerini capacity ve bottleneck sinyalleriyle yorumlar.',
    reason: `Bakim plani guncellenirse kapasite artabilir; maintenance etkisi ${formatNumber(row.opportunity.maintenanceMinutes)} dk.`,
    ruleId: 'continuous-improvement-maintenance-capacity',
    relatedEntityType: 'ImprovementReport',
    relatedEntityId: row.report.id,
    relatedWorkOrderId: row.opportunity.sourceId,
    warehouseId: row.opportunity.productionLineId,
    evidenceScore: Math.min(30, Math.max(16, row.opportunity.maintenanceMinutes / 20)),
    createdAt: row.report.updatedAt || row.report.createdAt,
    recommendationAction: 'Bakim penceresini uretim yogunlugu ve alternatif makine uygunlugu ile manuel olarak kontrol et.',
    expectedImpact: 'Bakim kaynakli kapasite daralmasini azaltabilir.',
    ownerRole: 'Bakim ve Uretim'
  })]
}

const createUrgentOpportunitySuggestion = (
  reports: ImprovementReport[]
): DecisionSuggestion[] => {
  const row = flattenOpportunities(reports)
    .filter(record => record.opportunity.priority === 'URGENT')
    .sort((first, second) => second.opportunity.expectedBenefitScore - first.opportunity.expectedBenefitScore)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.opportunity.entityName} icin acil iyilestirme firsati`,
    description: 'Continuous Improvement onceliklendirme motoru fayda ve risk skorunu birlikte kullanir.',
    reason: `${row.opportunity.summary} Fayda skoru ${formatNumber(row.opportunity.expectedBenefitScore, 1)}.`,
    ruleId: 'continuous-improvement-urgent-opportunity',
    relatedEntityType: 'ImprovementReport',
    relatedEntityId: row.report.id,
    relatedWorkOrderId: row.opportunity.sourceId,
    warehouseId: row.opportunity.productionLineId,
    evidenceScore: Math.min(30, Math.max(18, row.opportunity.expectedBenefitScore - 65)),
    createdAt: row.report.updatedAt || row.report.createdAt,
    recommendationAction: 'Acil firsati ilgili operasyon sahibiyle manuel aksiyon listesine al.',
    expectedImpact: 'En yuksek fayda/risk kombinasyonunun yonetim gorunurlugunu artirir.',
    ownerRole: 'Operasyon Muduru'
  })]
}

export const createContinuousImprovementDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const reports = activeReports(sourceData)
  if(reports.length === 0) return []

  return [
    ...createSetupReductionSuggestion(reports),
    ...createMachineUtilizationSuggestion(reports),
    ...createShiftWaitingSuggestion(reports),
    ...createMaintenanceCapacitySuggestion(reports),
    ...createUrgentOpportunitySuggestion(reports)
  ].slice(0, 8)
}
