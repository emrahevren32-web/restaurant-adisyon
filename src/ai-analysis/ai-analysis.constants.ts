import type {
  AIAnalysisStatus,
  AIAnalysisTitle,
  AIInsightType,
  AISeverity
} from './ai-analysis.types'

export const AI_ANALYSIS_TITLES: AIAnalysisTitle[] = [
  'PRODUCTION',
  'STOCK',
  'QUALITY',
  'MACHINE',
  'PERSONNEL',
  'MAINTENANCE',
  'SHIPMENT',
  'ENERGY',
  'CAPACITY',
  'WASTE'
]

export const AI_ANALYSIS_TITLE_LABELS: Record<AIAnalysisTitle, string> = {
  PRODUCTION: 'Uretim',
  STOCK: 'Stok',
  QUALITY: 'Kalite',
  MACHINE: 'Makine',
  PERSONNEL: 'Personel',
  MAINTENANCE: 'Bakim',
  SHIPMENT: 'Sevkiyat',
  ENERGY: 'Enerji',
  CAPACITY: 'Kapasite',
  WASTE: 'Fire'
}

export const AI_INSIGHT_TYPES: AIInsightType[] = [
  'RISK',
  'OPPORTUNITY',
  'ANOMALY',
  'REPEATING_PROBLEM',
  'EXPECTED_IMPACT'
]

export const AI_INSIGHT_TYPE_LABELS: Record<AIInsightType, string> = {
  RISK: 'Risk',
  OPPORTUNITY: 'Firsat',
  ANOMALY: 'Anormallik',
  REPEATING_PROBLEM: 'Tekrarlayan Problem',
  EXPECTED_IMPACT: 'Beklenen Etki'
}

export const AI_SEVERITIES: AISeverity[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const AI_SEVERITY_LABELS: Record<AISeverity, string> = {
  LOW: 'Dusuk',
  MEDIUM: 'Orta',
  HIGH: 'Yuksek',
  CRITICAL: 'Kritik'
}

export const AI_ANALYSIS_STATUSES: AIAnalysisStatus[] = [
  'GENERATED',
  'REVIEWED',
  'ARCHIVED'
]

export const AI_ANALYSIS_STATUS_LABELS: Record<AIAnalysisStatus, string> = {
  GENERATED: 'Uretildi',
  REVIEWED: 'Incelendi',
  ARCHIVED: 'Arsivlendi'
}
