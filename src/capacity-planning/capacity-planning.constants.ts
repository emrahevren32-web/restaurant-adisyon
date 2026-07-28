import type {
  CapacityPlanStatus,
  CapacityRiskLevel
} from './capacity-planning.types'

export const CAPACITY_PLAN_STATUSES: CapacityPlanStatus[] = [
  'DRAFT',
  'PREPARING',
  'ANALYZED',
  'APPROVED',
  'REVISED',
  'CANCELLED'
]

export const CAPACITY_PLAN_STATUS_LABELS: Record<CapacityPlanStatus, string> = {
  DRAFT: 'Taslak',
  PREPARING: 'Hazirlaniyor',
  ANALYZED: 'Analiz Edildi',
  APPROVED: 'Onaylandi',
  REVISED: 'Revize Edildi',
  CANCELLED: 'Iptal'
}

export const CAPACITY_RISK_LEVELS: CapacityRiskLevel[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL'
]

export const CAPACITY_RISK_LABELS: Record<CapacityRiskLevel, string> = {
  LOW: 'Dusuk',
  NORMAL: 'Normal',
  HIGH: 'Yuksek',
  CRITICAL: 'Kritik'
}

export const CAPACITY_SHIFT_MINUTES: Record<string, number> = {
  Sabah: 480,
  Aksam: 420,
  AksamVardiyasi: 420,
  Gece: 360,
  'Tam Gun': 600,
  Haftalik: 2400,
  Aylik: 10560,
  Acil: 240
}

export const CAPACITY_DEFAULT_SHIFT_OPTIONS = [
  'Sabah',
  'Aksam',
  'Gece',
  'Tam Gun',
  'Haftalik',
  'Aylik',
  'Acil'
]
