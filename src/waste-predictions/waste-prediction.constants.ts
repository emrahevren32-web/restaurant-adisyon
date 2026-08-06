import type {
  WastePredictionPriority,
  WastePredictionRisk,
  WastePredictionStatus,
  WastePredictionType
} from './waste-prediction.types'

export const WASTE_PREDICTION_TYPES: WastePredictionType[] = [
  'HIGH_WASTE_RISK',
  'USE_OLDER_LOT_FIRST',
  'USE_ALTERNATIVE_RECIPE',
  'PREFER_ALTERNATIVE_SUPPLIER',
  'PRODUCE_AFTER_MAINTENANCE',
  'CHANGE_LINE',
  'CHANGE_PERSONNEL',
  'REDUCE_PRODUCTION_QUANTITY',
  'SPLIT_PRODUCTION_BATCH',
  'PRIORITIZE_NEAR_EXPIRY_RAW_MATERIALS',
  'INCREASE_QUALITY_CONTROL',
  'NO_WASTE_EXPECTED'
]

export const WASTE_PREDICTION_TYPE_LABELS: Record<WastePredictionType, string> = {
  HIGH_WASTE_RISK: 'Fire riski yüksek',
  USE_OLDER_LOT_FIRST: 'Önce eski lot kullanılmalı',
  USE_ALTERNATIVE_RECIPE: 'Alternatif reçete kullanılmalı',
  PREFER_ALTERNATIVE_SUPPLIER: 'Alternatif tedarikçi tercih edilmeli',
  PRODUCE_AFTER_MAINTENANCE: 'Makine bakımından sonra üretim yapılmalı',
  CHANGE_LINE: 'Hat değiştirilmeli',
  CHANGE_PERSONNEL: 'Personel değiştirilmeli',
  REDUCE_PRODUCTION_QUANTITY: 'Üretim miktarı azaltılmalı',
  SPLIT_PRODUCTION_BATCH: 'Üretim iki partiye bölünmeli',
  PRIORITIZE_NEAR_EXPIRY_RAW_MATERIALS: 'SKT yaklaşan hammaddeler öncelikli kullanılmalı',
  INCREASE_QUALITY_CONTROL: 'Kalite kontrol sıklığı artırılmalı',
  NO_WASTE_EXPECTED: 'Fire beklenmiyor'
}

export const WASTE_PREDICTION_PRIORITIES: WastePredictionPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const WASTE_PREDICTION_PRIORITY_LABELS: Record<WastePredictionPriority, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  URGENT: 'Acil'
}

export const WASTE_PREDICTION_RISKS: WastePredictionRisk[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const WASTE_PREDICTION_RISK_LABELS: Record<WastePredictionRisk, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik'
}

export const WASTE_PREDICTION_STATUSES: WastePredictionStatus[] = [
  'GENERATED',
  'REVIEWED',
  'ARCHIVED'
]

export const WASTE_PREDICTION_STATUS_LABELS: Record<WastePredictionStatus, string> = {
  GENERATED: 'Üretildi',
  REVIEWED: 'İncelendi',
  ARCHIVED: 'Arşivlendi'
}
