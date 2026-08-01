import {
  ALERT_CATEGORY_LABELS,
  ALERT_LEVEL_LABELS,
  CriticalAlertService
} from '../critical-alerts/critical-alert.service'
import type { CriticalAlert } from '../critical-alerts/critical-alert.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { formatNumber } from '../kpi-reporting/kpi.utils'
import type {
  DecisionCategory,
  DecisionSuggestion
} from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const activeCriticalAlerts = (
  sourceData: KpiSourceData
) => CriticalAlertService.list(sourceData).filter(alert => (
  alert.status === 'ACTIVE'
  && (alert.level === 'CRITICAL' || alert.level === 'HIGH' || alert.riskScore >= 75)
))

const toDecisionCategory = (
  alert: CriticalAlert
): DecisionCategory => {
  if(alert.category === 'STOCK') return 'Inventory'
  if(alert.category === 'QUALITY' || alert.category === 'HACCP' || alert.category === 'LOT') return 'Quality'
  if(alert.category === 'GOODS_RECEIPT') return 'Purchasing'
  if(alert.category === 'SHIPMENT') return 'Shipment'
  return 'Production'
}

const getAlertEvidenceScore = (
  alert: CriticalAlert
) => Math.min(30, Math.max(8, (alert.riskScore - 60) / 1.35 + alert.repeatCount))

const createStockPurchaseSuggestion = (
  alerts: CriticalAlert[]
): DecisionSuggestion[] => {
  const alert = alerts
    .filter(record => record.category === 'STOCK')
    .sort((first, second) => second.riskScore - first.riskScore)[0]
  if(!alert) return []

  return [createDecisionSuggestion({
    category: 'Inventory',
    title: `${alert.relatedEntityName} kritik stok alarmi`,
    description: 'Kritik Alarm Motoru stok analiz modeli sinyallerini Karar Destek için önceliklendirir.',
    reason: `${alert.alertNo}: ${alert.reason} Risk skoru ${formatNumber(alert.riskScore, 1)}.`,
    ruleId: 'critical-alert-stock-purchase',
    relatedEntityType: 'CriticalAlert',
    relatedEntityId: alert.id,
    relatedProductId: alert.relatedEntityId,
    branchId: alert.branchId,
    warehouseId: alert.branchId,
    evidenceScore: getAlertEvidenceScore(alert),
    createdAt: alert.lastDetectedAt,
    recommendationAction: 'Kritik stok nedeniyle satin alma veya depo transfer ihtiyacini manuel olarak baslat.',
    expectedImpact: 'Malzeme yoklugu, uretim durusu ve sevkiyat gecikmesi riskini azaltir.',
    ownerRole: 'Depo ve Satin Alma'
  })]
}

const createMaintenanceLineSuggestion = (
  alerts: CriticalAlert[]
): DecisionSuggestion[] => {
  const alert = alerts
    .filter(record => record.category === 'MAINTENANCE' || record.category === 'CAPACITY' || record.category === 'MACHINE')
    .sort((first, second) => second.impactScore - first.impactScore)[0]
  if(!alert) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${alert.productionLineName || alert.machineCode || alert.relatedEntityName} bakim/kapasite alarmi`,
    description: 'Kritik Alarm Motoru makine, bakım ve kapasite sinyallerini manuel aksiyon önerisine çevirir.',
    reason: `${alert.alertNo}: ${alert.reason} Etki skoru ${formatNumber(alert.impactScore, 1)}.`,
    ruleId: 'critical-alert-maintenance-line',
    relatedEntityType: 'CriticalAlert',
    relatedEntityId: alert.id,
    relatedWorkOrderId: alert.sourceId,
    warehouseId: alert.productionLineId,
    evidenceScore: getAlertEvidenceScore(alert),
    createdAt: alert.lastDetectedAt,
    recommendationAction: 'Hat ve bakim planini uretim yogunlugu, alternatif makine ve vardiya etkisiyle manuel degerlendir.',
    expectedImpact: 'Kapasite kaybi, bekleme ve makine durusu riskini azaltir.',
    ownerRole: 'Bakim ve Uretim Planlama'
  })]
}

const createQualityFailSuggestion = (
  alerts: CriticalAlert[]
): DecisionSuggestion[] => {
  const alert = alerts
    .filter(record => record.category === 'QUALITY' || record.category === 'HACCP' || record.category === 'LOT' || record.category === 'GOODS_RECEIPT')
    .sort((first, second) => second.riskScore - first.riskScore)[0]
  if(!alert) return []

  return [createDecisionSuggestion({
    category: alert.category === 'GOODS_RECEIPT' ? 'Purchasing' : 'Quality',
    title: `${ALERT_CATEGORY_LABELS[alert.category]} başarısızlık kritik alarmı`,
    description: 'Kritik Alarm Motoru kalite, HACCP, lot ve mal kabul başarısızlık sinyallerini Karar Destek ile görünür kılar.',
    reason: `${alert.alertNo}: ${alert.reason} Seviye ${ALERT_LEVEL_LABELS[alert.level]}.`,
    ruleId: 'critical-alert-quality-fail',
    relatedEntityType: 'CriticalAlert',
    relatedEntityId: alert.id,
    relatedLotId: alert.lotId,
    relatedSupplierId: alert.category === 'GOODS_RECEIPT' ? alert.relatedEntityId : '',
    branchId: alert.branchId,
    warehouseId: alert.branchId,
    evidenceScore: getAlertEvidenceScore(alert),
    createdAt: alert.lastDetectedAt,
    recommendationAction: 'Kalite başarısızlığı, HACCP kritik limit veya mal kabul red etkisini manuel izolasyon ve düzeltici faaliyet listesine al.',
    expectedImpact: 'Gıda güvenliği, geri çağırma, sevkiyat ve tedarikçi uygunsuzluk riskini azaltır.',
    ownerRole: 'Kalite ve HACCP'
  })]
}

const createMachineStopReviewSuggestion = (
  alerts: CriticalAlert[]
): DecisionSuggestion[] => {
  const alert = alerts
    .filter(record => record.category === 'MACHINE' && (record.level === 'CRITICAL' || record.riskScore >= 85))
    .sort((first, second) => second.riskScore - first.riskScore)[0]
  if(!alert) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${alert.machineCode || alert.relatedEntityName} uretim uygunlugu incelenmeli`,
    description: 'Kritik Alarm Motoru makine riskini otomatik durdurma yerine manuel karar desteği olarak sunar.',
    reason: `${alert.alertNo}: ${alert.reason} Risk skoru ${formatNumber(alert.riskScore, 1)}.`,
    ruleId: 'critical-alert-machine-stop-review',
    relatedEntityType: 'CriticalAlert',
    relatedEntityId: alert.id,
    relatedWorkOrderId: alert.sourceId,
    warehouseId: alert.productionLineId,
    evidenceScore: getAlertEvidenceScore(alert),
    createdAt: alert.lastDetectedAt,
    recommendationAction: `${alert.machineCode || alert.relatedEntityName} icin uretimden manuel cikarilma veya alternatif makine kullanimi degerlendirilmeli.`,
    expectedImpact: 'Makine kaynakli kalite, gecikme ve is guvenligi riskini azaltir.',
    ownerRole: 'Uretim Sorumlusu'
  })]
}

const createGenericCriticalAlertSuggestions = (
  alerts: CriticalAlert[]
): DecisionSuggestion[] => alerts
  .filter(alert => alert.level === 'CRITICAL')
  .slice(0, 4)
  .map(alert => createDecisionSuggestion({
    category: toDecisionCategory(alert),
    title: `${alert.alertNo} kritik alarm aksiyonu`,
    description: 'Kritik Alarm Motoru kritik seviyedeki analiz modeli alarmını Karar Destek listesine taşır.',
    reason: alert.reason,
    ruleId: 'critical-alert-generic-critical',
    relatedEntityType: 'CriticalAlert',
    relatedEntityId: alert.id,
    relatedLotId: alert.lotId,
    relatedProductId: alert.category === 'STOCK' ? alert.relatedEntityId : '',
    branchId: alert.branchId,
    warehouseId: alert.branchId || alert.productionLineId,
    evidenceScore: getAlertEvidenceScore(alert),
    createdAt: alert.lastDetectedAt,
    recommendationAction: alert.recommendedAction,
    expectedImpact: alert.expectedImpact,
    ownerRole: 'Operasyon Muduru'
  }))

export const createCriticalAlertDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const alerts = activeCriticalAlerts(sourceData)
  if(alerts.length === 0) return []

  return [
    ...createStockPurchaseSuggestion(alerts),
    ...createMaintenanceLineSuggestion(alerts),
    ...createQualityFailSuggestion(alerts),
    ...createMachineStopReviewSuggestion(alerts),
    ...createGenericCriticalAlertSuggestions(alerts)
  ].slice(0, 10)
}
