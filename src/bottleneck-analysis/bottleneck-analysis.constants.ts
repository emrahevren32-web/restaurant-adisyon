import type {
  BottleneckReportStatus,
  BottleneckRiskLevel,
  BottleneckType
} from './bottleneck-analysis.types'

export const BOTTLENECK_REPORT_STATUSES: BottleneckReportStatus[] = [
  'DRAFT',
  'ANALYZED',
  'READY',
  'REVISED',
  'CANCELLED'
]

export const BOTTLENECK_REPORT_STATUS_LABELS: Record<BottleneckReportStatus, string> = {
  DRAFT: 'Taslak',
  ANALYZED: 'Analiz Edildi',
  READY: 'Hazir',
  REVISED: 'Revize',
  CANCELLED: 'Iptal'
}

export const BOTTLENECK_TYPES: BottleneckType[] = [
  'MACHINE',
  'LINE',
  'PERSONNEL',
  'WORK_CENTER',
  'WAREHOUSE',
  'MATERIAL',
  'SETUP',
  'CLEANING',
  'MAINTENANCE'
]

export const BOTTLENECK_TYPE_LABELS: Record<BottleneckType, string> = {
  MACHINE: 'Makine',
  LINE: 'Hat',
  PERSONNEL: 'Personel',
  WORK_CENTER: 'Work Center',
  WAREHOUSE: 'Depo',
  MATERIAL: 'Malzeme',
  SETUP: 'Setup',
  CLEANING: 'Temizlik',
  MAINTENANCE: 'Bakim'
}

export const BOTTLENECK_RISK_LEVELS: BottleneckRiskLevel[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const BOTTLENECK_RISK_LABELS: Record<BottleneckRiskLevel, string> = {
  LOW: 'Dusuk',
  MEDIUM: 'Orta',
  HIGH: 'Yuksek',
  CRITICAL: 'Kritik'
}
