import { StockExpiryLot, StockExpiryStatus, StockItem, StockUnit } from './types'

export const DEFAULT_EXPIRY_WARNING_DAYS = 7

const MS_PER_DAY = 24 * 60 * 60 * 1000

export const getLocalDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  if(Number.isNaN(date.getTime())) return ''

  return date.toLocaleDateString('sv-SE')
}

export const normalizeExpiryDateKey = (value?: string) => {
  if(!value) return undefined

  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return undefined

  return date.toLocaleDateString('sv-SE')
}

export const getExpiryWarningDays = (item?: Pick<StockItem, 'expiryWarningDays'>) => {
  const days = Number(item?.expiryWarningDays)
  return Number.isFinite(days) ? Math.max(0, Math.floor(days)) : DEFAULT_EXPIRY_WARNING_DAYS
}

export const isExpiryTracked = (item?: Pick<StockItem, 'tracksExpiry'>) => {
  return item?.tracksExpiry === true
}

export const getDaysUntilExpiry = (expiryDate?: string, today = new Date()) => {
  const expiryKey = normalizeExpiryDateKey(expiryDate)
  if(!expiryKey) return null

  const todayKey = getLocalDateKey(today)
  if(!todayKey) return null

  const expiryTime = new Date(`${expiryKey}T00:00:00`).getTime()
  const todayTime = new Date(`${todayKey}T00:00:00`).getTime()
  return Math.round((expiryTime - todayTime) / MS_PER_DAY)
}

export const getExpiryStatus = (
  lot: Pick<StockExpiryLot, 'remainingQty' | 'expiryDate'>,
  warningDays = DEFAULT_EXPIRY_WARNING_DAYS,
  today = new Date()
): StockExpiryStatus => {
  if(lot.remainingQty <= 0) return 'depleted'

  const daysUntilExpiry = getDaysUntilExpiry(lot.expiryDate, today)
  if(daysUntilExpiry === null) return 'unknown'
  if(daysUntilExpiry < 0) return 'expired'
  if(daysUntilExpiry <= warningDays) return 'near_expiry'

  return 'valid'
}

export const isConsumableExpiryLot = (
  lot: Pick<StockExpiryLot, 'remainingQty' | 'expiryDate'>,
  warningDays = DEFAULT_EXPIRY_WARNING_DAYS,
  today = new Date()
) => {
  const status = getExpiryStatus(lot, warningDays, today)
  return status === 'valid' || status === 'near_expiry' || status === 'unknown'
}

export const sortLotsFefo = <T extends Pick<StockExpiryLot, 'expiryDate' | 'receivedAt' | 'createdAt'>>(lots: T[]) => {
  return [...lots].sort((a, b) => {
    const aExpiry = normalizeExpiryDateKey(a.expiryDate)
    const bExpiry = normalizeExpiryDateKey(b.expiryDate)

    if(aExpiry && bExpiry && aExpiry !== bExpiry) return aExpiry.localeCompare(bExpiry)
    if(aExpiry && !bExpiry) return -1
    if(!aExpiry && bExpiry) return 1

    const aReceived = new Date(a.receivedAt || a.createdAt).getTime()
    const bReceived = new Date(b.receivedAt || b.createdAt).getTime()
    return aReceived - bReceived
  })
}

export const formatExpiryDate = (value?: string) => {
  if(!value) return '-'

  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'

  return date.toLocaleDateString('tr-TR')
}

export const formatExpiryStatusLabel = (status: StockExpiryStatus) => {
  if(status === 'expired') return 'Tarihi geçti'
  if(status === 'near_expiry') return 'Yaklaşıyor'
  if(status === 'depleted') return 'Tükendi'
  if(status === 'unknown') return 'SKT yok'
  return 'Geçerli'
}

export const getExpiryStatusClass = (status: StockExpiryStatus) => {
  if(status === 'expired') return 'danger-pill'
  if(status === 'near_expiry') return 'warning-pill'
  if(status === 'depleted') return 'muted-pill'
  if(status === 'valid') return 'success'
  return ''
}

export const formatExpiryQuantity = (value: number, unit: StockUnit) => {
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
}
