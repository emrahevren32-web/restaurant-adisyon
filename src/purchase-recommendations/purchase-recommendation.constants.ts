import type {
  PurchaseRecommendationPriority,
  PurchaseRecommendationRisk,
  PurchaseRecommendationStatus,
  PurchaseRecommendationType
} from './purchase-recommendation.types'

export const PURCHASE_RECOMMENDATION_TYPES: PurchaseRecommendationType[] = [
  'CRITICAL_STOCK',
  'UPCOMING_PRODUCTION',
  'POSTPONE_ORDER',
  'SPLIT_ORDER',
  'STOCKOUT_SOON',
  'FORECAST_ORDER',
  'BULK_BUY',
  'ALTERNATIVE_SUPPLIER',
  'LOWER_COST_SUPPLIER',
  'STOCK_SUFFICIENT',
  'WAIT_UPCOMING_DELIVERY',
  'EXPIRY_RISK_NO_PURCHASE',
  'COST_ADVANTAGE',
  'WASTE_REPLENISHMENT',
  'SEASONAL_PURCHASE'
]

export const PURCHASE_RECOMMENDATION_TYPE_LABELS: Record<PurchaseRecommendationType, string> = {
  CRITICAL_STOCK: 'Kritik stok nedeniyle satın al',
  UPCOMING_PRODUCTION: 'Yaklaşan üretim için satın al',
  POSTPONE_ORDER: 'Siparişi ertele',
  SPLIT_ORDER: 'Siparişi böl',
  STOCKOUT_SOON: 'Yaklaşan stok tükenmesi için satın al',
  FORECAST_ORDER: 'Tahmine dayalı satın al',
  BULK_BUY: 'Toplu satın alma öner',
  ALTERNATIVE_SUPPLIER: 'Alternatif tedarikçi öner',
  LOWER_COST_SUPPLIER: 'Daha düşük maliyetli tedarikçi öner',
  STOCK_SUFFICIENT: 'Mevcut stok yeterli',
  WAIT_UPCOMING_DELIVERY: 'Yaklaşan teslimatı bekle',
  EXPIRY_RISK_NO_PURCHASE: 'SKT riski nedeniyle satın alma',
  COST_ADVANTAGE: 'Maliyet avantajı',
  WASTE_REPLENISHMENT: 'Fire kaynaklı yenileme',
  SEASONAL_PURCHASE: 'Sezonluk satın alma'
}

export const PURCHASE_RECOMMENDATION_PRIORITIES: PurchaseRecommendationPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const PURCHASE_RECOMMENDATION_PRIORITY_LABELS: Record<PurchaseRecommendationPriority, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  URGENT: 'Acil'
}

export const PURCHASE_RECOMMENDATION_RISKS: PurchaseRecommendationRisk[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const PURCHASE_RECOMMENDATION_RISK_LABELS: Record<PurchaseRecommendationRisk, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik'
}

export const PURCHASE_RECOMMENDATION_STATUSES: PurchaseRecommendationStatus[] = [
  'GENERATED',
  'REVIEWED',
  'ARCHIVED'
]

export const PURCHASE_RECOMMENDATION_STATUS_LABELS: Record<PurchaseRecommendationStatus, string> = {
  GENERATED: 'Üretildi',
  REVIEWED: 'İncelendi',
  ARCHIVED: 'Arşivlendi'
}
