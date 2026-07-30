import type {
  RecommendationPriority,
  RecommendationRisk,
  RecommendationStatus,
  RecommendationType
} from './recommendation-engine.types'

export const RECOMMENDATION_TYPES: RecommendationType[] = [
  'PRODUCTION',
  'PURCHASING',
  'STOCK',
  'QUALITY',
  'MACHINE',
  'PERSONNEL',
  'MAINTENANCE',
  'SHIPMENT',
  'ENERGY',
  'WASTE'
]

export const RECOMMENDATION_TYPE_LABELS: Record<RecommendationType, string> = {
  PRODUCTION: 'Uretim',
  PURCHASING: 'Satin Alma',
  STOCK: 'Stok',
  QUALITY: 'Kalite',
  MACHINE: 'Makine',
  PERSONNEL: 'Personel',
  MAINTENANCE: 'Bakim',
  SHIPMENT: 'Sevkiyat',
  ENERGY: 'Enerji',
  WASTE: 'Fire'
}

export const RECOMMENDATION_PRIORITIES: RecommendationPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const RECOMMENDATION_PRIORITY_LABELS: Record<RecommendationPriority, string> = {
  LOW: 'Dusuk',
  NORMAL: 'Normal',
  HIGH: 'Yuksek',
  URGENT: 'Acil'
}

export const RECOMMENDATION_RISKS: RecommendationRisk[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const RECOMMENDATION_RISK_LABELS: Record<RecommendationRisk, string> = {
  LOW: 'Dusuk',
  MEDIUM: 'Orta',
  HIGH: 'Yuksek',
  CRITICAL: 'Kritik'
}

export const RECOMMENDATION_STATUSES: RecommendationStatus[] = [
  'GENERATED',
  'REVIEWED',
  'ARCHIVED'
]

export const RECOMMENDATION_STATUS_LABELS: Record<RecommendationStatus, string> = {
  GENERATED: 'Uretildi',
  REVIEWED: 'Incelendi',
  ARCHIVED: 'Arsivlendi'
}
