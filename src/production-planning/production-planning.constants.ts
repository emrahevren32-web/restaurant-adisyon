import type {
  ProductionPlanPriority,
  ProductionPlanStatus,
  ProductionPlanType
} from './production-planning.types'

export const PRODUCTION_PLAN_TYPES: ProductionPlanType[] = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'URGENT',
  'BRANCH_BASED'
]

export const PRODUCTION_PLAN_TYPE_LABELS: Record<ProductionPlanType, string> = {
  DAILY: 'Gunluk Plan',
  WEEKLY: 'Haftalik Plan',
  MONTHLY: 'Aylik Plan',
  URGENT: 'Acil Uretim Plani',
  BRANCH_BASED: 'Sube Bazli Plan'
}

export const PRODUCTION_PLAN_STATUSES: ProductionPlanStatus[] = [
  'DRAFT',
  'PREPARING',
  'READY',
  'APPROVED',
  'REVISED',
  'CANCELLED'
]

export const PRODUCTION_PLAN_STATUS_LABELS: Record<ProductionPlanStatus, string> = {
  DRAFT: 'Taslak',
  PREPARING: 'Hazirlaniyor',
  READY: 'Hazir',
  APPROVED: 'Onaylandi',
  REVISED: 'Revize Edildi',
  CANCELLED: 'Iptal'
}

export const PRODUCTION_PLAN_PRIORITIES: ProductionPlanPriority[] = [
  'CRITICAL',
  'HIGH',
  'NORMAL',
  'LOW'
]

export const PRODUCTION_PLAN_PRIORITY_LABELS: Record<ProductionPlanPriority, string> = {
  CRITICAL: 'Kritik',
  HIGH: 'Yuksek',
  NORMAL: 'Normal',
  LOW: 'Dusuk'
}
