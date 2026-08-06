import type {
  ProductionPlanningRecommendationPriority,
  ProductionPlanningRecommendationRisk,
  ProductionPlanningRecommendationStatus,
  ProductionPlanningRecommendationType
} from './production-planning-recommendation.types'

export const PRODUCTION_PLANNING_RECOMMENDATION_TYPES: ProductionPlanningRecommendationType[] = [
  'ADVANCE_PRODUCTION',
  'POSTPONE_PRODUCTION',
  'CHANGE_LINE',
  'CHANGE_MACHINE',
  'CHANGE_SHIFT',
  'SPLIT_PRODUCTION',
  'GROUP_SAME_PRODUCTS',
  'REDUCE_SETUP_TIME',
  'BALANCE_CAPACITY',
  'REALLOCATE_PERSONNEL',
  'ALTERNATIVE_RECIPE',
  'ALTERNATIVE_WORK_CENTER',
  'STOP_PRODUCTION',
  'WAIT_PURCHASE',
  'WAIT_SHIPMENT',
  'REPLAN_WASTE_RISK'
]

export const PRODUCTION_PLANNING_RECOMMENDATION_TYPE_LABELS: Record<ProductionPlanningRecommendationType, string> = {
  ADVANCE_PRODUCTION: 'Üretimi öne al',
  POSTPONE_PRODUCTION: 'Üretimi ertele',
  CHANGE_LINE: 'Hat değiştir',
  CHANGE_MACHINE: 'Makine değiştir',
  CHANGE_SHIFT: 'Vardiya değiştir',
  SPLIT_PRODUCTION: 'Üretimi böl',
  GROUP_SAME_PRODUCTS: 'Aynı ürünleri grupla',
  REDUCE_SETUP_TIME: 'Setup sürelerini azalt',
  BALANCE_CAPACITY: 'Kapasiteyi dengele',
  REALLOCATE_PERSONNEL: 'Personel kaydır',
  ALTERNATIVE_RECIPE: 'Alternatif reçete öner',
  ALTERNATIVE_WORK_CENTER: 'Alternatif üretim merkezi öner',
  STOP_PRODUCTION: 'Üretimi durdur',
  WAIT_PURCHASE: 'Satın alma beklenmeli',
  WAIT_SHIPMENT: 'Sevkiyat beklenmeli',
  REPLAN_WASTE_RISK: 'Fire riski nedeniyle yeniden planla'
}

export const PRODUCTION_PLANNING_RECOMMENDATION_PRIORITIES: ProductionPlanningRecommendationPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const PRODUCTION_PLANNING_RECOMMENDATION_PRIORITY_LABELS: Record<ProductionPlanningRecommendationPriority, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  URGENT: 'Acil'
}

export const PRODUCTION_PLANNING_RECOMMENDATION_RISKS: ProductionPlanningRecommendationRisk[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const PRODUCTION_PLANNING_RECOMMENDATION_RISK_LABELS: Record<ProductionPlanningRecommendationRisk, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik'
}

export const PRODUCTION_PLANNING_RECOMMENDATION_STATUSES: ProductionPlanningRecommendationStatus[] = [
  'GENERATED',
  'REVIEWED',
  'ARCHIVED'
]

export const PRODUCTION_PLANNING_RECOMMENDATION_STATUS_LABELS: Record<ProductionPlanningRecommendationStatus, string> = {
  GENERATED: 'Üretildi',
  REVIEWED: 'İncelendi',
  ARCHIVED: 'Arşivlendi'
}
