import type {
  WorkforcePlanItemStatus,
  WorkforcePlanStatus
} from './workforce-planning.types'

export const WORKFORCE_PLAN_STATUSES: WorkforcePlanStatus[] = [
  'DRAFT',
  'PREPARING',
  'READY',
  'APPROVED',
  'REVISED',
  'CANCELLED'
]

export const WORKFORCE_PLAN_STATUS_LABELS: Record<WorkforcePlanStatus, string> = {
  DRAFT: 'Taslak',
  PREPARING: 'Hazirlaniyor',
  READY: 'Hazir',
  APPROVED: 'Onaylandi',
  REVISED: 'Revize',
  CANCELLED: 'Iptal'
}

export const WORKFORCE_PLAN_ITEM_STATUSES: WorkforcePlanItemStatus[] = [
  'PLANNED',
  'ASSIGNED',
  'ACTIVE',
  'IDLE',
  'CONFLICT',
  'MISSING',
  'CANCELLED'
]

export const WORKFORCE_PLAN_ITEM_STATUS_LABELS: Record<WorkforcePlanItemStatus, string> = {
  PLANNED: 'Planlandi',
  ASSIGNED: 'Atandi',
  ACTIVE: 'Aktif',
  IDLE: 'Bos',
  CONFLICT: 'Cakisma',
  MISSING: 'Eksik',
  CANCELLED: 'Iptal'
}

export const WORKFORCE_SHIFT_OPTIONS = [
  'Sabah',
  'Aksam',
  'Tam Gun',
  'Gece',
  'Haftalik',
  'Aylik'
]

export const WORKFORCE_DEPARTMENT_OPTIONS = [
  'Uretim',
  'Operasyon',
  'Depo',
  'Bakim',
  'Kalite',
  'Lojistik',
  'Yonetim'
]
