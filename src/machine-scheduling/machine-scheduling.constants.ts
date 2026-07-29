import type {
  MachineScheduleItemStatus,
  MachineScheduleStatus
} from './machine-scheduling.types'

export const MACHINE_SCHEDULE_STATUSES: MachineScheduleStatus[] = [
  'DRAFT',
  'PLANNED',
  'READY',
  'RUNNING',
  'COMPLETED',
  'REVISED',
  'CANCELLED'
]

export const MACHINE_SCHEDULE_STATUS_LABELS: Record<MachineScheduleStatus, string> = {
  DRAFT: 'Taslak',
  PLANNED: 'Planlandi',
  READY: 'Hazir',
  RUNNING: 'Calisiyor',
  COMPLETED: 'Tamamlandi',
  REVISED: 'Revize',
  CANCELLED: 'Iptal'
}

export const MACHINE_SCHEDULE_ITEM_STATUSES: MachineScheduleItemStatus[] = [
  'QUEUED',
  'SCHEDULED',
  'READY',
  'RUNNING',
  'COMPLETED',
  'CONFLICT',
  'CANCELLED'
]

export const MACHINE_SCHEDULE_ITEM_STATUS_LABELS: Record<MachineScheduleItemStatus, string> = {
  QUEUED: 'Kuyrukta',
  SCHEDULED: 'Planlandi',
  READY: 'Hazir',
  RUNNING: 'Calisiyor',
  COMPLETED: 'Tamamlandi',
  CONFLICT: 'Cakisma',
  CANCELLED: 'Iptal'
}

export const SCHEDULING_SHIFT_START_TIMES: Record<string, string> = {
  Sabah: '08:00',
  Aksam: '16:00',
  Gece: '22:00',
  'Tam Gun': '08:00',
  Haftalik: '08:00',
  Aylik: '08:00',
  Acil: '07:00'
}

export const MACHINE_SCHEDULING_SHIFT_OPTIONS = [
  'Sabah',
  'Aksam',
  'Gece',
  'Tam Gun',
  'Haftalik',
  'Aylik',
  'Acil'
]
