import type {
  ForecastRiskLevel,
  ForecastStatus,
  ForecastTrendDirection,
  ForecastType
} from './forecasting.types'

export const FORECAST_TYPES: ForecastType[] = [
  'PRODUCTION',
  'STOCK',
  'DEMAND',
  'WASTE',
  'QUALITY',
  'SHIPMENT',
  'PURCHASING',
  'PERSONNEL'
]

export const FORECAST_TYPE_LABELS: Record<ForecastType, string> = {
  PRODUCTION: 'Uretim Tahmini',
  STOCK: 'Stok Tahmini',
  DEMAND: 'Talep Tahmini',
  WASTE: 'Fire Tahmini',
  QUALITY: 'Kalite Tahmini',
  SHIPMENT: 'Sevkiyat Tahmini',
  PURCHASING: 'Satin Alma Tahmini',
  PERSONNEL: 'Personel Tahmini'
}

export const FORECAST_STATUSES: ForecastStatus[] = [
  'GENERATED',
  'REVIEWED',
  'ARCHIVED'
]

export const FORECAST_STATUS_LABELS: Record<ForecastStatus, string> = {
  GENERATED: 'Uretildi',
  REVIEWED: 'Incelendi',
  ARCHIVED: 'Arsivlendi'
}

export const FORECAST_RISK_LEVELS: ForecastRiskLevel[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const FORECAST_RISK_LABELS: Record<ForecastRiskLevel, string> = {
  LOW: 'Dusuk',
  MEDIUM: 'Orta',
  HIGH: 'Yuksek',
  CRITICAL: 'Kritik'
}

export const FORECAST_TRENDS: ForecastTrendDirection[] = [
  'UP',
  'DOWN',
  'STABLE',
  'SEASONAL'
]

export const FORECAST_TREND_LABELS: Record<ForecastTrendDirection, string> = {
  UP: 'Artis',
  DOWN: 'Dusus',
  STABLE: 'Stabil',
  SEASONAL: 'Mevsimsel'
}

export const FORECAST_HORIZON_OPTIONS = [7, 14, 30, 60, 90]
export const FORECAST_ANALYSIS_WINDOW_OPTIONS = [7, 30, 90, 365]
