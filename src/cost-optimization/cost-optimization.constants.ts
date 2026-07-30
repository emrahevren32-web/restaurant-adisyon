import type {
  CostOptimizationCategory,
  CostOptimizationPriority,
  CostOptimizationRisk,
  CostOptimizationStatus
} from './cost-optimization.types'

export const COST_OPTIMIZATION_CATEGORIES: CostOptimizationCategory[] = [
  'RAW_MATERIAL',
  'PERSONNEL',
  'ENERGY',
  'MAINTENANCE',
  'MACHINE',
  'PRODUCTION',
  'WASTE',
  'STORAGE',
  'LOGISTICS',
  'SHIPMENT'
]

export const COST_OPTIMIZATION_CATEGORY_LABELS: Record<CostOptimizationCategory, string> = {
  RAW_MATERIAL: 'Hammadde',
  PERSONNEL: 'Personel',
  ENERGY: 'Enerji',
  MAINTENANCE: 'Bakim',
  MACHINE: 'Makine',
  PRODUCTION: 'Uretim',
  WASTE: 'Fire',
  STORAGE: 'Depolama',
  LOGISTICS: 'Lojistik',
  SHIPMENT: 'Sevkiyat'
}

export const COST_OPTIMIZATION_PRIORITIES: CostOptimizationPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const COST_OPTIMIZATION_PRIORITY_LABELS: Record<CostOptimizationPriority, string> = {
  LOW: 'Dusuk',
  NORMAL: 'Normal',
  HIGH: 'Yuksek',
  URGENT: 'Acil'
}

export const COST_OPTIMIZATION_RISKS: CostOptimizationRisk[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const COST_OPTIMIZATION_RISK_LABELS: Record<CostOptimizationRisk, string> = {
  LOW: 'Dusuk',
  MEDIUM: 'Orta',
  HIGH: 'Yuksek',
  CRITICAL: 'Kritik'
}

export const COST_OPTIMIZATION_STATUSES: CostOptimizationStatus[] = [
  'GENERATED',
  'REVIEWED',
  'ARCHIVED'
]

export const COST_OPTIMIZATION_STATUS_LABELS: Record<CostOptimizationStatus, string> = {
  GENERATED: 'Uretildi',
  REVIEWED: 'Incelendi',
  ARCHIVED: 'Arsivlendi'
}
