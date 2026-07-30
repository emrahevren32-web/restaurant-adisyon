import type {
  ImprovementArea,
  ImprovementPriority,
  ImprovementReportStatus,
  ImprovementRiskLevel
} from './continuous-improvement.types'

export const IMPROVEMENT_REPORT_STATUSES: ImprovementReportStatus[] = [
  'DRAFT',
  'ANALYZED',
  'READY',
  'REVISED',
  'CANCELLED'
]

export const IMPROVEMENT_REPORT_STATUS_LABELS: Record<ImprovementReportStatus, string> = {
  DRAFT: 'Taslak',
  ANALYZED: 'Analiz Edildi',
  READY: 'Hazir',
  REVISED: 'Revize',
  CANCELLED: 'Iptal'
}

export const IMPROVEMENT_AREAS: ImprovementArea[] = [
  'MACHINE',
  'LINE',
  'PERSONNEL',
  'SHIFT',
  'SETUP',
  'CLEANING',
  'MAINTENANCE',
  'WAREHOUSE',
  'MATERIAL',
  'ENERGY'
]

export const IMPROVEMENT_AREA_LABELS: Record<ImprovementArea, string> = {
  MACHINE: 'Makine',
  LINE: 'Hat',
  PERSONNEL: 'Personel',
  SHIFT: 'Vardiya',
  SETUP: 'Setup',
  CLEANING: 'Temizlik',
  MAINTENANCE: 'Bakim',
  WAREHOUSE: 'Depo',
  MATERIAL: 'Malzeme',
  ENERGY: 'Enerji'
}

export const IMPROVEMENT_RISK_LEVELS: ImprovementRiskLevel[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const IMPROVEMENT_RISK_LABELS: Record<ImprovementRiskLevel, string> = {
  LOW: 'Dusuk',
  MEDIUM: 'Orta',
  HIGH: 'Yuksek',
  CRITICAL: 'Kritik'
}

export const IMPROVEMENT_PRIORITIES: ImprovementPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const IMPROVEMENT_PRIORITY_LABELS: Record<ImprovementPriority, string> = {
  LOW: 'Dusuk',
  NORMAL: 'Normal',
  HIGH: 'Yuksek',
  URGENT: 'Acil'
}
