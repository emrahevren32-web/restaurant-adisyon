import type {
  BarChartRow,
  ChartSeries,
  KPICard,
  KpiFilters,
  KpiPeriodFilter,
  KpiTone,
  PieChartSlice,
  TrendPoint
} from './kpi.types'

export const ALL_FILTER = 'all'
const PERCENT_MULTIPLIER = 100
const ROUNDING_FACTOR = 100

export const KPI_COLORS = [
  '#2563eb',
  '#059669',
  '#f97316',
  '#9333ea',
  '#dc2626',
  '#0f766e',
  '#ca8a04',
  '#475569'
]

export const toFiniteNumber = (value: number, fallback = 0) => (
  Number.isFinite(value) ? value : fallback
)

export const roundKpi = (value: number) => {
  const finiteValue = toFiniteNumber(value)
  return Math.round((finiteValue + Number.EPSILON) * ROUNDING_FACTOR) / ROUNDING_FACTOR
}

export const sumBy = <T,>(records: T[], selector: (record: T) => number) => (
  roundKpi(records.reduce((total, record) => total + toFiniteNumber(selector(record)), 0))
)

export const averageBy = <T,>(records: T[], selector: (record: T) => number) => (
  records.length > 0 ? roundKpi(sumBy(records, selector) / records.length) : 0
)

export const percent = (part: number, total: number) => (
  toFiniteNumber(total) > 0 ? roundKpi((toFiniteNumber(part) / toFiniteNumber(total)) * PERCENT_MULTIPLIER) : 0
)

export const formatNumber = (value: number, maximumFractionDigits = 0) => (
  toFiniteNumber(value).toLocaleString('tr-TR', { maximumFractionDigits })
)

export const formatQuantity = (value: number, unit = '') => (
  `${toFiniteNumber(value).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}${unit ? ` ${unit}` : ''}`
)

export const formatPercent = (value: number) => (
  `${toFiniteNumber(value).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
)

export const formatCurrency = (value: number, currency = 'TRY') => (
  toFiniteNumber(value).toLocaleString('tr-TR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0
  })
)

export const createCard = (
  id: string,
  label: string,
  value: string,
  detail: string,
  tone: KpiTone = 'neutral'
): KPICard => ({ id, label, value, detail, tone })

export const getDateKey = (value?: string | Date) => {
  if(!value) return ''
  if(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

export const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

export const getReferenceDate = () => new Date()

export const getPeriodRange = (
  period: KpiPeriodFilter,
  referenceDate = getReferenceDate()
) => {
  const end = new Date(referenceDate)
  const start = new Date(referenceDate)

  if(period === 'TODAY'){
    return { start: getDateKey(start), end: getDateKey(end) }
  }

  if(period === 'WEEK'){
    start.setDate(referenceDate.getDate() - 6)
    return { start: getDateKey(start), end: getDateKey(end) }
  }

  if(period === 'MONTH'){
    start.setDate(referenceDate.getDate() - 29)
    return { start: getDateKey(start), end: getDateKey(end) }
  }

  start.setDate(referenceDate.getDate() - 364)
  return { start: getDateKey(start), end: getDateKey(end) }
}

export const matchesPeriod = (
  value: string,
  period: KpiPeriodFilter,
  referenceDate = getReferenceDate()
) => {
  const dateKey = getDateKey(value)
  if(!dateKey) return false
  const range = getPeriodRange(period, referenceDate)
  return dateKey >= range.start && dateKey <= range.end
}

export const matchesOptionalFilter = (selectedValue: string, candidateValue: string) => (
  selectedValue === ALL_FILTER || selectedValue === '' || selectedValue === candidateValue
)

export const groupBy = <TRecord,>(
  records: TRecord[],
  getKey: (record: TRecord) => string
) => records.reduce((map, record) => {
  const key = getKey(record)
  if(!key) return map
  map.set(key, [...(map.get(key) || []), record])
  return map
}, new Map<string, TRecord[]>())

export const createTrend = <TRecord,>(
  records: TRecord[],
  period: KpiPeriodFilter,
  getDateValue: (record: TRecord) => string,
  getValue: (record: TRecord) => number,
  label: string,
  color = KPI_COLORS[0]
): ChartSeries => {
  const referenceDate = getReferenceDate()
  const dayCount = period === 'TODAY' ? 1 : period === 'WEEK' ? 7 : period === 'MONTH' ? 30 : 12
  const buckets = new Map<string, number>()

  if(period === 'YEAR'){
    Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - (dayCount - 1 - index), 1)
      buckets.set(getDateKey(date).slice(0, 7), 0)
    })
  } else {
    Array.from({ length: dayCount }, (_, index) => {
      const date = addDays(referenceDate, -(dayCount - 1 - index))
      buckets.set(getDateKey(date), 0)
    })
  }

  records.forEach(record => {
    const dateKey = getDateKey(getDateValue(record))
    const bucketKey = period === 'YEAR' ? dateKey.slice(0, 7) : dateKey
    if(!buckets.has(bucketKey)) return
    buckets.set(bucketKey, roundKpi((buckets.get(bucketKey) || 0) + getValue(record)))
  })

  const points: TrendPoint[] = Array.from(buckets.entries()).map(([dateKey, value]) => ({
    dateKey,
    label: period === 'YEAR' ? dateKey.slice(5, 7) : dateKey.slice(5),
    value
  }))

  return {
    id: label.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]+/gi, '-'),
    label,
    color,
    points
  }
}

export const createBarRows = (
  records: Array<{ id: string; label: string; value: number; detail?: string; tone?: KpiTone }>,
  limit = 8,
  unit = ''
): BarChartRow[] => (
  [...records]
    .sort((first, second) => second.value - first.value || first.label.localeCompare(second.label, 'tr-TR'))
    .slice(0, limit)
    .map(record => ({
      id: record.id,
      label: record.label,
      value: roundKpi(record.value),
      formattedValue: formatQuantity(record.value, unit),
      detail: record.detail || '',
      tone: record.tone
    }))
)

export const createPieSlices = (
  records: Array<{ id: string; label: string; value: number }>,
  unit = ''
): PieChartSlice[] => (
  records
    .filter(record => record.value > 0)
    .map((record, index) => ({
      id: record.id,
      label: record.label,
      value: roundKpi(record.value),
      formattedValue: formatQuantity(record.value, unit),
      color: KPI_COLORS[index % KPI_COLORS.length]
    }))
)

export const getFilterLabel = (filters: KpiFilters) => {
  const periodLabel: Record<KpiPeriodFilter, string> = {
    TODAY: 'Bugun',
    WEEK: 'Bu hafta',
    MONTH: 'Bu ay',
    YEAR: 'Bu yil'
  }

  return periodLabel[filters.period]
}
