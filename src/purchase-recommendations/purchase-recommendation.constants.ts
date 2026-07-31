import type {
  PurchaseRecommendationPriority,
  PurchaseRecommendationRisk,
  PurchaseRecommendationStatus,
  PurchaseRecommendationType
} from './purchase-recommendation.types'

export const PURCHASE_RECOMMENDATION_TYPES: PurchaseRecommendationType[] = [
  'CRITICAL_STOCK',
  'STOCKOUT_SOON',
  'FORECAST_ORDER',
  'BULK_BUY',
  'ALTERNATIVE_SUPPLIER',
  'COST_ADVANTAGE',
  'WASTE_REPLENISHMENT',
  'SEASONAL_PURCHASE'
]

export const PURCHASE_RECOMMENDATION_TYPE_LABELS: Record<PurchaseRecommendationType, string> = {
  CRITICAL_STOCK: 'Kritik Stok',
  STOCKOUT_SOON: 'Yaklasan Stok Tukenmesi',
  FORECAST_ORDER: 'Tahmine Dayali Siparis',
  BULK_BUY: 'Toplu Alim Firsati',
  ALTERNATIVE_SUPPLIER: 'Alternatif Tedarikci',
  COST_ADVANTAGE: 'Maliyet Avantaji',
  WASTE_REPLENISHMENT: 'Fire Kaynakli Yenileme',
  SEASONAL_PURCHASE: 'Sezonluk Satin Alma'
}

export const PURCHASE_RECOMMENDATION_PRIORITIES: PurchaseRecommendationPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const PURCHASE_RECOMMENDATION_PRIORITY_LABELS: Record<PurchaseRecommendationPriority, string> = {
  LOW: 'Dusuk',
  NORMAL: 'Normal',
  HIGH: 'Yuksek',
  URGENT: 'Acil'
}

export const PURCHASE_RECOMMENDATION_RISKS: PurchaseRecommendationRisk[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const PURCHASE_RECOMMENDATION_RISK_LABELS: Record<PurchaseRecommendationRisk, string> = {
  LOW: 'Dusuk',
  MEDIUM: 'Orta',
  HIGH: 'Yuksek',
  CRITICAL: 'Kritik'
}

export const PURCHASE_RECOMMENDATION_STATUSES: PurchaseRecommendationStatus[] = [
  'GENERATED',
  'REVIEWED',
  'ARCHIVED'
]

export const PURCHASE_RECOMMENDATION_STATUS_LABELS: Record<PurchaseRecommendationStatus, string> = {
  GENERATED: 'Uretildi',
  REVIEWED: 'Incelendi',
  ARCHIVED: 'Arsivlendi'
}
