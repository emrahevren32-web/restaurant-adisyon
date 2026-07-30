import { BottleneckAnalysisService } from '../bottleneck-analysis/bottleneck-analysis.service'
import type {
  BottleneckItem,
  BottleneckReport
} from '../bottleneck-analysis/bottleneck-analysis.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatNumber,
  formatPercent,
  percent
} from '../kpi-reporting/kpi.utils'
import type { DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const activeReports = (
  sourceData: KpiSourceData
) => BottleneckAnalysisService.list(sourceData).filter(report => report.status !== 'CANCELLED')

const flattenItems = (
  reports: BottleneckReport[]
) => reports.flatMap(report => report.items.map(item => ({ report, item })))

const createLineOver95Suggestion = (
  reports: BottleneckReport[]
): DecisionSuggestion[] => {
  const row = flattenItems(reports)
    .filter(record => record.item.bottleneckType === 'LINE' && record.item.utilizationPercent >= 95)
    .sort((first, second) => second.item.utilizationPercent - first.item.utilizationPercent)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.item.productionLineName || row.item.entityName} kapasitesi surekli yuksek`,
    description: 'Bottleneck Analysis hat dolulugunu Production Planning ve Capacity Planning ciktilari uzerinden izler.',
    reason: `${row.item.productionLineName || row.item.entityName} kapasitesi ${formatPercent(row.item.utilizationPercent)} seviyesinde.`,
    ruleId: 'bottleneck-analysis-line-over-95',
    relatedEntityType: 'BottleneckReport',
    relatedEntityId: row.report.id,
    branchId: '',
    warehouseId: row.item.productionLineId,
    evidenceScore: Math.min(30, Math.max(18, row.item.utilizationPercent - 75 + row.item.overloadMinutes / 30)),
    createdAt: row.report.updatedAt || row.report.createdAt,
    recommendationAction: 'Hat kapasitesini ek vardiya, alternatif hat veya manuel kapasite senaryosu ile degerlendir.',
    expectedImpact: 'Hat uzerindeki bekleme ve gecikme zincirini azaltir.',
    ownerRole: 'Uretim Planlama'
  })]
}

const createMachineTopSuggestion = (
  reports: BottleneckReport[]
): DecisionSuggestion[] => {
  const row = flattenItems(reports)
    .filter(record => (
      (record.item.bottleneckType === 'MACHINE' || record.item.bottleneckType === 'MAINTENANCE')
      && record.item.riskScore >= 75
    ))
    .sort((first, second) => second.item.riskScore - first.item.riskScore || second.item.waitingMinutes - first.item.waitingMinutes)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.item.machineCode || row.item.entityCode} en buyuk makine darbogazi`,
    description: 'Bottleneck Analysis makine kuyrugu, bekleme, setup ve capacity kullanimi sinyallerini birlestirir.',
    reason: `${row.item.machineName || row.item.entityName} risk skoru ${formatNumber(row.item.riskScore, 1)}, bekleme ${formatNumber(row.item.waitingMinutes)} dk.`,
    ruleId: 'bottleneck-analysis-machine-top',
    relatedEntityType: 'BottleneckReport',
    relatedEntityId: row.report.id,
    relatedWorkOrderId: row.item.sourceId,
    warehouseId: row.item.productionLineId,
    evidenceScore: Math.min(30, Math.max(18, row.item.riskScore - 60)),
    createdAt: row.report.updatedAt || row.report.createdAt,
    recommendationAction: 'Makine bazli bekleme, setup ve bakim etkisini manuel olarak ayni rapor uzerinden incele.',
    expectedImpact: 'En yogun makinenin uretim akisi uzerindeki etkisini azaltacak karar noktalarini netlestirir.',
    ownerRole: 'Makine Cizelgeleme'
  })]
}

const getSetupShare = (
  item: BottleneckItem
) => percent(item.setupMinutes + item.cleaningMinutes, item.workingMinutes || item.setupMinutes + item.cleaningMinutes)

const createSetupShareSuggestion = (
  reports: BottleneckReport[]
): DecisionSuggestion[] => {
  const row = flattenItems(reports)
    .map(record => ({ ...record, setupShare: getSetupShare(record.item) }))
    .filter(record => record.setupShare >= 18)
    .sort((first, second) => second.setupShare - first.setupShare)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.item.entityName} setup payi yuksek`,
    description: 'Bottleneck Analysis setup ve temizlik surelerinin toplam calisma icindeki payini hesaplar.',
    reason: `Setup/temizlik payi ${formatPercent(row.setupShare)}, toplam ${formatNumber(row.item.setupMinutes + row.item.cleaningMinutes)} dk.`,
    ruleId: 'bottleneck-analysis-setup-share',
    relatedEntityType: 'BottleneckReport',
    relatedEntityId: row.report.id,
    relatedWorkOrderId: row.item.sourceId,
    warehouseId: row.item.productionLineId,
    evidenceScore: Math.min(30, Math.max(12, row.setupShare - 10)),
    createdAt: row.report.updatedAt || row.report.createdAt,
    recommendationAction: 'Recete bloklama, temizlik sirasi ve setup hazirligini manuel operasyon senaryosu olarak degerlendir.',
    expectedImpact: 'Net uretim zamanini artirir ve makine basina bekleme etkisini dusurur.',
    ownerRole: 'Operasyon Muduru'
  })]
}

const createPersonnelCapacityLossSuggestion = (
  reports: BottleneckReport[]
): DecisionSuggestion[] => {
  const row = flattenItems(reports)
    .map(record => {
      const lostMinutes = record.item.missingPersonnel * 480
      return {
        ...record,
        capacityLossPercent: percent(lostMinutes, record.item.workingMinutes + lostMinutes)
      }
    })
    .filter(record => record.item.bottleneckType === 'PERSONNEL' && record.capacityLossPercent >= 12)
    .sort((first, second) => second.capacityLossPercent - first.capacityLossPercent)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.item.entityName} personel eksigi kapasiteyi dusuruyor`,
    description: 'Bottleneck Analysis Workforce Planning vardiya ve personel atama sinyallerini uretim kapasitesiyle eslestirir.',
    reason: `Personel eksigi gunluk kapasiteyi yaklasik ${formatPercent(row.capacityLossPercent)} dusuruyor; eksik personel ${formatNumber(row.item.missingPersonnel)}.`,
    ruleId: 'bottleneck-analysis-personnel-capacity-loss',
    relatedEntityType: 'BottleneckReport',
    relatedEntityId: row.report.id,
    relatedWorkOrderId: row.item.sourceId,
    warehouseId: row.item.productionLineId,
    evidenceScore: Math.min(30, Math.max(14, row.capacityLossPercent)),
    createdAt: row.report.updatedAt || row.report.createdAt,
    recommendationAction: 'Vardiya sorumlusu ile personel kapsamini manuel olarak kontrol et ve uygun gorev dagilimini degerlendir.',
    expectedImpact: 'Personel kaynakli baslama gecikmelerini ve atama bosluklarini azaltir.',
    ownerRole: 'Personel Planlama'
  })]
}

const createMaintenanceImpactSuggestion = (
  reports: BottleneckReport[]
): DecisionSuggestion[] => {
  const row = flattenItems(reports)
    .filter(record => record.item.maintenanceMinutes > 0 || record.item.bottleneckType === 'MAINTENANCE')
    .sort((first, second) => second.item.maintenanceMinutes - first.item.maintenanceMinutes || second.item.riskScore - first.item.riskScore)[0]
  if(!row) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${row.item.entityName} bakim plani darbogazi artiriyor`,
    description: 'Bottleneck Analysis maintenance etkisini Capacity Planning ve Machine Scheduling sinyalleriyle birlikte yorumlar.',
    reason: `${row.item.entityName} icin bakim etkisi ${formatNumber(row.item.maintenanceMinutes)} dk, risk skoru ${formatNumber(row.item.riskScore, 1)}.`,
    ruleId: 'bottleneck-analysis-maintenance-impact',
    relatedEntityType: 'BottleneckReport',
    relatedEntityId: row.report.id,
    relatedWorkOrderId: row.item.sourceId,
    warehouseId: row.item.productionLineId,
    evidenceScore: Math.min(30, Math.max(16, row.item.maintenanceMinutes / 20 + row.item.riskScore / 12)),
    createdAt: row.report.updatedAt || row.report.createdAt,
    recommendationAction: 'Bakim penceresini uretim yogunlugu ve alternatif makine uygunlugu ile manuel olarak karsilastir.',
    expectedImpact: 'Bakim kaynakli durus ve uretim akisi darbogazini azaltabilir.',
    ownerRole: 'Bakim ve Uretim'
  })]
}

export const createBottleneckAnalysisDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const reports = activeReports(sourceData)
  if(reports.length === 0) return []

  return [
    ...createLineOver95Suggestion(reports),
    ...createMachineTopSuggestion(reports),
    ...createSetupShareSuggestion(reports),
    ...createPersonnelCapacityLossSuggestion(reports),
    ...createMaintenanceImpactSuggestion(reports)
  ].slice(0, 8)
}
