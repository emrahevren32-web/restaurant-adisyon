import {
  FORECAST_TYPE_LABELS,
  ForecastService
} from '../forecasting/forecast.service'
import type { ForecastPrediction } from '../forecasting/forecasting.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  formatNumber,
  formatPercent
} from '../kpi-reporting/kpi.utils'
import type { DecisionCategory, DecisionSuggestion } from './decision-support.types'
import { createDecisionSuggestion } from './recommendation-engine.service'

const activePredictions = (
  sourceData: KpiSourceData
) => ForecastService.evaluate(sourceData).predictions
  .filter(prediction => prediction.riskLevel === 'HIGH' || prediction.riskLevel === 'CRITICAL' || prediction.growthPercent >= 10)

const getEvidenceScore = (
  prediction: ForecastPrediction
) => Math.min(30, Math.max(8, prediction.riskScore * 0.22 + Math.max(0, prediction.growthPercent) * 0.08))

const toDecisionCategory = (
  prediction: ForecastPrediction
): DecisionCategory => {
  if(prediction.forecastType === 'STOCK') return 'Inventory'
  if(prediction.forecastType === 'QUALITY') return 'Quality'
  if(prediction.forecastType === 'PURCHASING') return 'Purchasing'
  if(prediction.forecastType === 'SHIPMENT') return 'Shipment'
  return 'Production'
}

const createProductionIncreaseSuggestion = (
  predictions: ForecastPrediction[]
): DecisionSuggestion[] => {
  const prediction = predictions
    .filter(item => (item.forecastType === 'PRODUCTION' || item.forecastType === 'DEMAND') && item.growthPercent >= 10)
    .sort((first, second) => second.growthPercent - first.growthPercent)[0]
  if(!prediction) return []

  return [createDecisionSuggestion({
    category: 'Production',
    title: `${prediction.entityName} uretim/talep tahmini artiyor`,
    description: 'Tahminleme Motoru talep ve üretim trendini Karar Destek için önceliklendirir.',
    reason: `${FORECAST_TYPE_LABELS[prediction.forecastType]} ${formatPercent(prediction.growthPercent)} buyume gosteriyor; beklenen ${formatNumber(prediction.expectedValue, 1)} ${prediction.unit}.`,
    ruleId: 'forecasting-production-increase',
    relatedEntityType: 'ForecastPrediction',
    relatedEntityId: prediction.id,
    relatedProductId: prediction.productId || prediction.stockItemId,
    relatedWorkOrderId: prediction.sourceId,
    branchId: prediction.branchId,
    warehouseId: prediction.productionLineId,
    evidenceScore: getEvidenceScore(prediction),
    createdAt: prediction.createdAt,
    recommendationAction: `${prediction.entityName} icin uretim, kapasite ve malzeme hazirligi manuel olarak artisa gore incelenmeli.`,
    expectedImpact: 'Talep artisi kaynakli gecikme ve stok yetersizligi riskini azaltir.',
    ownerRole: 'Uretim Planlama'
  })]
}

const createStockCriticalSuggestion = (
  predictions: ForecastPrediction[]
): DecisionSuggestion[] => {
  const prediction = predictions
    .filter(item => item.forecastType === 'STOCK' && (item.daysToCritical <= 3 || item.riskLevel === 'CRITICAL'))
    .sort((first, second) => first.daysToCritical - second.daysToCritical)[0]
  if(!prediction) return []

  return [createDecisionSuggestion({
    category: 'Inventory',
    title: `${prediction.entityName} stok kritik seviyeye inebilir`,
    description: 'Tahminleme Motoru stok tüketim trendinden kritik gün tahmini üretir.',
    reason: `${prediction.entityName} icin beklenen stok ${formatNumber(prediction.expectedStock, 1)} ${prediction.unit}; kritik gun ${formatNumber(prediction.daysToCritical, 1)}.`,
    ruleId: 'forecasting-stock-critical',
    relatedEntityType: 'ForecastPrediction',
    relatedEntityId: prediction.id,
    relatedProductId: prediction.stockItemId || prediction.productId,
    branchId: prediction.branchId,
    warehouseId: prediction.branchId,
    evidenceScore: getEvidenceScore(prediction),
    createdAt: prediction.createdAt,
    recommendationAction: 'Stok kritik seviyeye inmeden satin alma veya depo transferi manuel olarak erkene alinmali.',
    expectedImpact: 'Uretim durusu ve malzeme yoklugu riskini azaltir.',
    ownerRole: 'Depo ve Satin Alma'
  })]
}

const createPurchaseEarlySuggestion = (
  predictions: ForecastPrediction[]
): DecisionSuggestion[] => {
  const prediction = predictions
    .filter(item => item.forecastType === 'PURCHASING' && (item.riskLevel === 'HIGH' || item.riskLevel === 'CRITICAL'))
    .sort((first, second) => second.riskScore - first.riskScore)[0]
  if(!prediction) return []

  return [createDecisionSuggestion({
    category: 'Purchasing',
    title: `${prediction.entityName} satin alma takvimi incelenmeli`,
    description: 'Tahminleme Motoru satın alma hacmi ve kritik stok sinyallerini birlikte yorumlar.',
    reason: `${prediction.entityName} beklenen satin alma ${formatNumber(prediction.expectedValue, 1)} ${prediction.unit}; risk skoru ${formatNumber(prediction.riskScore, 1)}.`,
    ruleId: 'forecasting-purchase-early',
    relatedEntityType: 'ForecastPrediction',
    relatedEntityId: prediction.id,
    relatedSupplierId: prediction.supplierId,
    evidenceScore: getEvidenceScore(prediction),
    createdAt: prediction.createdAt,
    recommendationAction: 'Satın alma siparişi, teslim tarihi ve alternatif tedarikçi seçeneği manuel erkene çekme senaryosuna alınmalı.',
    expectedImpact: 'Kritik stok ve tedarik gecikmesi riskini azaltir.',
    ownerRole: 'Satin Alma'
  })]
}

const createShipmentSurgeSuggestion = (
  predictions: ForecastPrediction[]
): DecisionSuggestion[] => {
  const prediction = predictions
    .filter(item => item.forecastType === 'SHIPMENT' && (item.growthPercent >= 10 || item.trendDirection === 'SEASONAL'))
    .sort((first, second) => second.expectedShipment - first.expectedShipment)[0]
  if(!prediction) return []

  return [createDecisionSuggestion({
    category: 'Shipment',
    title: `${prediction.entityName} sevkiyat hacmi artabilir`,
    description: 'Tahminleme Motoru sevkiyat formları ve sevkiyat analiz modeli verilerinden hacim tahmini üretir.',
    reason: `Beklenen sevkiyat ${formatNumber(prediction.expectedShipment, 1)} ${prediction.unit}; trend ${formatPercent(prediction.growthPercent)}.`,
    ruleId: 'forecasting-shipment-surge',
    relatedEntityType: 'ForecastPrediction',
    relatedEntityId: prediction.id,
    branchId: prediction.branchId,
    warehouseId: prediction.branchId,
    evidenceScore: getEvidenceScore(prediction),
    createdAt: prediction.createdAt,
    recommendationAction: 'Arac, palet, yukleme saati ve soguk zincir kapasitesi manuel olarak artan hacme gore incelenmeli.',
    expectedImpact: 'Cuma/tepe gun sevkiyat gecikmesi ve yukleme sikisikligi riskini azaltir.',
    ownerRole: 'Sevkiyat'
  })]
}

const createQualityRiskSuggestion = (
  predictions: ForecastPrediction[]
): DecisionSuggestion[] => {
  const prediction = predictions
    .filter(item => item.forecastType === 'QUALITY' && (item.riskLevel === 'HIGH' || item.riskLevel === 'CRITICAL'))
    .sort((first, second) => second.riskScore - first.riskScore)[0]
  if(!prediction) return []

  return [createDecisionSuggestion({
    category: 'Quality',
    title: `${prediction.entityName} kalite riski tahmini`,
    description: 'Tahminleme Motoru kalite formu başarısız/koşullu sinyallerinden ileri kalite riski üretir.',
    reason: `${prediction.entityName} beklenen kalite risk adedi ${formatNumber(prediction.expectedValue, 1)}; risk skoru ${formatNumber(prediction.riskScore, 1)}.`,
    ruleId: 'forecasting-quality-risk',
    relatedEntityType: 'ForecastPrediction',
    relatedEntityId: prediction.id,
    relatedLotId: prediction.sourceId,
    relatedProductId: prediction.productId || prediction.stockItemId,
    branchId: prediction.branchId,
    warehouseId: prediction.branchId,
    evidenceScore: getEvidenceScore(prediction),
    createdAt: prediction.createdAt,
    recommendationAction: 'Kalite kontrol, numune ve HACCP izleme sikligi manuel olarak artirilma senaryosuna alinmali.',
    expectedImpact: 'Kalite başarısızlığı, geri çağırma ve sevkiyat blokaj riskini azaltır.',
    ownerRole: 'Kalite'
  })]
}

export const createForecastingDecisionSuggestions = (
  sourceData: KpiSourceData
): DecisionSuggestion[] => {
  const predictions = activePredictions(sourceData)
  if(predictions.length === 0) return []

  return [
    ...createProductionIncreaseSuggestion(predictions),
    ...createStockCriticalSuggestion(predictions),
    ...createPurchaseEarlySuggestion(predictions),
    ...createShipmentSurgeSuggestion(predictions),
    ...createQualityRiskSuggestion(predictions),
    ...predictions
      .filter(prediction => prediction.riskLevel === 'CRITICAL')
      .slice(0, 3)
      .map(prediction => createDecisionSuggestion({
        category: toDecisionCategory(prediction),
        title: `${prediction.entityName} kritik tahmin riski`,
        description: 'Tahminleme Motoru kritik tahmini Karar Destek listesine taşır.',
        reason: prediction.evidence,
        ruleId: 'forecasting-critical-risk',
        relatedEntityType: 'ForecastPrediction',
        relatedEntityId: prediction.id,
        relatedProductId: prediction.productId || prediction.stockItemId,
        branchId: prediction.branchId,
        warehouseId: prediction.branchId || prediction.productionLineId,
        evidenceScore: getEvidenceScore(prediction),
        createdAt: prediction.createdAt,
        recommendationAction: prediction.recommendation,
        expectedImpact: 'Kritik tahmin sinyalinin yonetim tarafindan erken incelenmesini saglar.',
        ownerRole: 'Operasyon Muduru'
      }))
  ].slice(0, 10)
}
