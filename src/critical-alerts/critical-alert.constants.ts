import type {
  AlertCategory,
  AlertLevel,
  AlertPriority,
  AlertStatus
} from './critical-alert.types'

export const ALERT_LEVELS: AlertLevel[] = [
  'INFO',
  'WARNING',
  'HIGH',
  'CRITICAL'
]

export const ALERT_LEVEL_LABELS: Record<AlertLevel, string> = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
}

export const ALERT_CATEGORIES: AlertCategory[] = [
  'PRODUCTION',
  'STOCK',
  'QUALITY',
  'SHIPMENT',
  'MACHINE',
  'MAINTENANCE',
  'PERSONNEL',
  'CAPACITY',
  'HACCP',
  'LOT',
  'GOODS_RECEIPT'
]

export const ALERT_CATEGORY_LABELS: Record<AlertCategory, string> = {
  PRODUCTION: 'Uretim',
  STOCK: 'Stok',
  QUALITY: 'Kalite',
  SHIPMENT: 'Sevkiyat',
  MACHINE: 'Makine',
  MAINTENANCE: 'Bakim',
  PERSONNEL: 'Personel',
  CAPACITY: 'Kapasite',
  HACCP: 'HACCP',
  LOT: 'Lot',
  GOODS_RECEIPT: 'Mal Kabul'
}

export const ALERT_STATUSES: AlertStatus[] = [
  'ACTIVE',
  'ACKNOWLEDGED',
  'RESOLVED',
  'DISMISSED'
]

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  ACTIVE: 'Aktif',
  ACKNOWLEDGED: 'Goruldu',
  RESOLVED: 'Kapandi',
  DISMISSED: 'Yok Sayildi'
}

export const ALERT_PRIORITIES: AlertPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const ALERT_PRIORITY_LABELS: Record<AlertPriority, string> = {
  LOW: 'Dusuk',
  NORMAL: 'Normal',
  HIGH: 'Yuksek',
  URGENT: 'Acil'
}
