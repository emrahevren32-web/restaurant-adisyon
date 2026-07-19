import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import type { PurchaseOrder } from '../purchase-orders/purchase-order.types'
import type { QualityControlFormRecord } from '../quality-controls/quality-control-form.types'
import type { QualityControl } from '../quality-controls/quality-control.types'
import type { ReturnProcess } from '../return-processes/return-process.types'
import type { Supplier } from '../supplier-management/supplier-management.types'
import type { SupplierReturn } from '../supplier-returns/supplier-return.types'
import type {
  SupplierPerformance,
  SupplierPerformanceLevel,
  SupplierPerformancePeriod
} from './supplier-performance.types'

export const SUPPLIER_PERFORMANCE_STORAGE_KEY = 'ra_supplier_performances'

export const SUPPLIER_PERFORMANCE_PERIODS: SupplierPerformancePeriod[] = [
  'MONTHLY',
  'QUARTERLY',
  'YEARLY'
]

export const SUPPLIER_PERFORMANCE_LEVELS: SupplierPerformanceLevel[] = [
  'EXCELLENT',
  'GOOD',
  'AVERAGE',
  'POOR',
  'CRITICAL'
]

export const SUPPLIER_PERFORMANCE_PERIOD_LABELS: Record<SupplierPerformancePeriod, string> = {
  MONTHLY: 'Aylık',
  QUARTERLY: 'Çeyreklik',
  YEARLY: 'Yıllık'
}

export const SUPPLIER_PERFORMANCE_LEVEL_LABELS: Record<SupplierPerformanceLevel, string> = {
  EXCELLENT: 'Mükemmel',
  GOOD: 'İyi',
  AVERAGE: 'Ortalama',
  POOR: 'Zayıf',
  CRITICAL: 'Kritik'
}

export type SupplierPerformanceCalculationContext = {
  suppliers: Supplier[]
  purchaseOrders: PurchaseOrder[]
  goodsReceipts: GoodsReceiptRecord[]
  qualityControls: QualityControl[]
  qualityControlForms: QualityControlFormRecord[]
  returnProcesses: ReturnProcess[]
  supplierReturns: SupplierReturn[]
}

type RawSupplierPerformanceRecord =
  Partial<Record<keyof SupplierPerformance, unknown>>
  & Record<string, unknown>

const SCORE_ROUNDING_FACTOR = 100
const PERCENT_MULTIPLIER = 100
const MAX_SCORE = 100
const MIN_SCORE = 0
const QUALITY_SCORE_WEIGHT = 0.4
const DELIVERY_SCORE_WEIGHT = 0.35
const RETURN_SCORE_WEIGHT = 0.25
const EXCELLENT_SCORE_MIN = 90
const GOOD_SCORE_MIN = 75
const AVERAGE_SCORE_MIN = 60
const POOR_SCORE_MIN = 40

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawSupplierPerformanceRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const normalizeScore = (value: unknown) => (
  clampScore(normalizeNonNegativeNumber(value))
)

const normalizePeriod = (value: unknown): SupplierPerformancePeriod => {
  const normalized = normalizeText(value).toUpperCase()
  return SUPPLIER_PERFORMANCE_PERIODS.includes(normalized as SupplierPerformancePeriod)
    ? normalized as SupplierPerformancePeriod
    : 'MONTHLY'
}

const normalizeLevel = (value: unknown): SupplierPerformanceLevel | '' => {
  const normalized = normalizeText(value).toUpperCase()
  return SUPPLIER_PERFORMANCE_LEVELS.includes(normalized as SupplierPerformanceLevel)
    ? normalized as SupplierPerformanceLevel
    : ''
}

const roundScore = (value: number) => (
  Math.round((value + Number.EPSILON) * SCORE_ROUNDING_FACTOR) / SCORE_ROUNDING_FACTOR
)

const clampScore = (value: number) => (
  Math.min(MAX_SCORE, Math.max(MIN_SCORE, roundScore(value)))
)

const calculateRatioScore = (count: number, total: number) => (
  total > 0 ? clampScore((count / total) * PERCENT_MULTIPLIER) : MIN_SCORE
)

const calculateReturnScore = (supplierReturnCount: number, goodsReceiptCount: number) => (
  goodsReceiptCount > 0
    ? clampScore(MAX_SCORE - ((supplierReturnCount / goodsReceiptCount) * PERCENT_MULTIPLIER))
    : MIN_SCORE
)

export const calculateOverallScore = (
  qualityScore: number,
  deliveryScore: number,
  returnScore: number
) => (
  clampScore(
    (qualityScore * QUALITY_SCORE_WEIGHT)
    + (deliveryScore * DELIVERY_SCORE_WEIGHT)
    + (returnScore * RETURN_SCORE_WEIGHT)
  )
)

export const getSupplierPerformanceLevel = (overallScore: number): SupplierPerformanceLevel => {
  if(overallScore >= EXCELLENT_SCORE_MIN) return 'EXCELLENT'
  if(overallScore >= GOOD_SCORE_MIN) return 'GOOD'
  if(overallScore >= AVERAGE_SCORE_MIN) return 'AVERAGE'
  if(overallScore >= POOR_SCORE_MIN) return 'POOR'
  return 'CRITICAL'
}

export const formatSupplierPerformanceScore = (score: number) => (
  `${score.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`
)

const getDateKey = (value: string) => {
  const normalized = normalizeText(value)
  if(!normalized) return ''
  if(/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.slice(0, 10)

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

const getPeriodRange = (
  period: SupplierPerformancePeriod,
  referenceDate: Date
) => {
  if(period === 'MONTHLY'){
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
    const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0)
    return { start: start.toLocaleDateString('sv-SE'), end: end.toLocaleDateString('sv-SE') }
  }

  if(period === 'QUARTERLY'){
    const quarterStartMonth = Math.floor(referenceDate.getMonth() / 3) * 3
    const start = new Date(referenceDate.getFullYear(), quarterStartMonth, 1)
    const end = addDays(new Date(referenceDate.getFullYear(), quarterStartMonth + 3, 1), -1)
    return { start: start.toLocaleDateString('sv-SE'), end: end.toLocaleDateString('sv-SE') }
  }

  const start = new Date(referenceDate.getFullYear(), 0, 1)
  const end = new Date(referenceDate.getFullYear(), 11, 31)
  return { start: start.toLocaleDateString('sv-SE'), end: end.toLocaleDateString('sv-SE') }
}

const isDateInPeriod = (
  dateValue: string,
  period: SupplierPerformancePeriod,
  referenceDate: Date
) => {
  const dateKey = getDateKey(dateValue)
  if(!dateKey) return false

  const { start, end } = getPeriodRange(period, referenceDate)
  return dateKey >= start && dateKey <= end
}

const getReferenceDate = (context: SupplierPerformanceCalculationContext) => {
  const dateKeys = [
    ...context.purchaseOrders.map(record => getDateKey(record.orderDate || record.createdAt)),
    ...context.goodsReceipts.map(record => getDateKey(record.receiptDate || record.createdAt)),
    ...context.qualityControls.map(record => getDateKey(record.inspectionDate || record.createdAt)),
    ...context.returnProcesses.map(record => getDateKey(record.createdAt)),
    ...context.supplierReturns.map(record => getDateKey(record.shipmentDate || record.createdAt))
  ].filter(Boolean).sort()

  const latestDateKey = dateKeys[dateKeys.length - 1] || new Date().toLocaleDateString('sv-SE')
  const referenceDate = new Date(`${latestDateKey}T00:00:00`)
  return Number.isNaN(referenceDate.getTime()) ? new Date() : referenceDate
}

const getPerformanceNotes = (level: SupplierPerformanceLevel) => {
  if(level === 'EXCELLENT') return 'Yüksek kalite, zamanında teslim ve düşük iade oranı ile güvenilir tedarikçi.'
  if(level === 'GOOD') return 'Genel performans güçlü; izlenmesi gereken küçük operasyonel sapmalar var.'
  if(level === 'AVERAGE') return 'Performans kabul edilebilir seviyede; kalite ve teslimat göstergeleri takip edilmeli.'
  if(level === 'POOR') return 'Performans zayıf; satın alma ve kalite ekipleri tarafından aksiyon planı gerektirir.'
  return 'Kritik performans seviyesi; yeni sipariş kararlarında dikkatli değerlendirilmelidir.'
}

const getQualityControlFormAverage = (
  qualityControls: QualityControl[],
  qualityControlForms: QualityControlFormRecord[],
  fallbackScore: number
) => {
  const qualityControlIds = new Set(qualityControls.map(record => record.id))
  const scores = qualityControlForms
    .filter(form => qualityControlIds.has(form.qualityControlId))
    .map(form => form.overallScore)
    .filter(score => Number.isFinite(score) && score >= MIN_SCORE)

  if(scores.length === 0) return fallbackScore
  return clampScore(scores.reduce((total, score) => total + score, 0) / scores.length)
}

const isActiveGoodsReceipt = (record: GoodsReceiptRecord) => (
  record.status !== 'DRAFT' && record.status !== 'CANCELLED'
)

const isActivePurchaseOrder = (record: PurchaseOrder) => (
  record.status !== 'CANCELLED'
)

const isActiveReturnProcess = (record: ReturnProcess) => (
  record.status !== 'CANCELLED'
)

const isActiveSupplierReturn = (record: SupplierReturn) => (
  record.status !== 'CANCELLED'
)

const createSupplierPeriodPerformance = (
  supplier: Supplier,
  period: SupplierPerformancePeriod,
  context: SupplierPerformanceCalculationContext,
  referenceDate: Date,
  calculatedAt: string
): SupplierPerformance => {
  const purchaseOrders = context.purchaseOrders.filter(record => (
    record.supplierId === supplier.id
    && isActivePurchaseOrder(record)
    && isDateInPeriod(record.orderDate || record.createdAt, period, referenceDate)
  ))
  const purchaseOrderMap = new Map(context.purchaseOrders.map(record => [record.id, record]))
  const goodsReceipts = context.goodsReceipts.filter(record => (
    record.supplierId === supplier.id
    && isActiveGoodsReceipt(record)
    && isDateInPeriod(record.receiptDate || record.createdAt, period, referenceDate)
  ))
  const qualityControls = context.qualityControls.filter(record => (
    record.supplierId === supplier.id
    && isDateInPeriod(record.inspectionDate || record.createdAt, period, referenceDate)
  ))
  const approvedQualityCount = qualityControls.filter(record => (
    record.status === 'COMPLETED' && record.decision === 'APPROVED'
  )).length
  const rejectedQualityCount = qualityControls.filter(record => (
    record.status === 'COMPLETED' && record.decision === 'REJECTED'
  )).length
  const returnProcesses = context.returnProcesses.filter(record => (
    record.supplierId === supplier.id
    && isActiveReturnProcess(record)
    && isDateInPeriod(record.createdAt, period, referenceDate)
  ))
  const supplierReturns = context.supplierReturns.filter(record => (
    record.supplierId === supplier.id
    && isActiveSupplierReturn(record)
    && isDateInPeriod(record.shipmentDate || record.createdAt, period, referenceDate)
  ))
  const onTimeDeliveryCount = goodsReceipts.filter(receipt => {
    const purchaseOrder = purchaseOrderMap.get(receipt.purchaseOrderId)
    if(!purchaseOrder?.expectedDeliveryDate) return false
    return getDateKey(receipt.receiptDate) <= getDateKey(purchaseOrder.expectedDeliveryDate)
  }).length
  const lateDeliveryCount = Math.max(0, goodsReceipts.length - onTimeDeliveryCount)
  const qualityScore = calculateRatioScore(approvedQualityCount, qualityControls.length)
  const deliveryScore = calculateRatioScore(onTimeDeliveryCount, goodsReceipts.length)
  const returnScore = calculateReturnScore(supplierReturns.length, goodsReceipts.length)
  const overallScore = calculateOverallScore(qualityScore, deliveryScore, returnScore)
  const performanceLevel = getSupplierPerformanceLevel(overallScore)

  return {
    id: `supplier_performance_${supplier.id}_${period.toLocaleLowerCase('en-US')}`,
    supplierId: supplier.id,
    period,
    purchaseOrderCount: purchaseOrders.length,
    goodsReceiptCount: goodsReceipts.length,
    qualityControlCount: qualityControls.length,
    approvedQualityCount,
    rejectedQualityCount,
    returnProcessCount: returnProcesses.length,
    supplierReturnCount: supplierReturns.length,
    onTimeDeliveryCount,
    lateDeliveryCount,
    averageQualityScore: getQualityControlFormAverage(qualityControls, context.qualityControlForms, qualityScore),
    deliveryScore,
    qualityScore,
    returnScore,
    overallScore,
    performanceLevel,
    notes: getPerformanceNotes(performanceLevel),
    calculatedAt
  }
}

export const calculateSupplierPerformances = (
  context: SupplierPerformanceCalculationContext
): SupplierPerformance[] => {
  const referenceDate = getReferenceDate(context)
  const calculatedAt = new Date().toISOString()

  return context.suppliers.flatMap(supplier => (
    SUPPLIER_PERFORMANCE_PERIODS.map(period => (
      createSupplierPeriodPerformance(supplier, period, context, referenceDate, calculatedAt)
    ))
  ))
}

const normalizeSupplierPerformance = (
  item: RawSupplierPerformanceRecord,
  index: number
): SupplierPerformance => {
  const period = normalizePeriod(item.period)
  const overallScore = normalizeScore(item.overallScore)
  const performanceLevel = normalizeLevel(item.performanceLevel) || getSupplierPerformanceLevel(overallScore)
  const supplierId = normalizeText(item.supplierId)

  return {
    id: normalizeText(item.id) || `supplier_performance_${supplierId || Date.now()}_${period.toLocaleLowerCase('en-US')}_${index}`,
    supplierId,
    period,
    purchaseOrderCount: normalizeNonNegativeNumber(item.purchaseOrderCount),
    goodsReceiptCount: normalizeNonNegativeNumber(item.goodsReceiptCount),
    qualityControlCount: normalizeNonNegativeNumber(item.qualityControlCount),
    approvedQualityCount: normalizeNonNegativeNumber(item.approvedQualityCount),
    rejectedQualityCount: normalizeNonNegativeNumber(item.rejectedQualityCount),
    returnProcessCount: normalizeNonNegativeNumber(item.returnProcessCount),
    supplierReturnCount: normalizeNonNegativeNumber(item.supplierReturnCount),
    onTimeDeliveryCount: normalizeNonNegativeNumber(item.onTimeDeliveryCount),
    lateDeliveryCount: normalizeNonNegativeNumber(item.lateDeliveryCount),
    averageQualityScore: normalizeScore(item.averageQualityScore),
    deliveryScore: normalizeScore(item.deliveryScore),
    qualityScore: normalizeScore(item.qualityScore),
    returnScore: normalizeScore(item.returnScore),
    overallScore,
    performanceLevel,
    notes: normalizeText(item.notes),
    calculatedAt: normalizeText(item.calculatedAt) || new Date().toISOString()
  }
}

export const saveSupplierPerformanceRecords = (records: SupplierPerformance[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(SUPPLIER_PERFORMANCE_STORAGE_KEY, JSON.stringify(records))
}

export const loadSupplierPerformanceRecords = (
  context: SupplierPerformanceCalculationContext
) => {
  const calculatedRecords = calculateSupplierPerformances(context)

  if(!isBrowserStorageAvailable()) return calculatedRecords

  const storedRecords = localStorage.getItem(SUPPLIER_PERFORMANCE_STORAGE_KEY)
  if(!storedRecords){
    saveSupplierPerformanceRecords(calculatedRecords)
    return calculatedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const storedNotesByKey = new Map(
        parsed
          .filter(isRecord)
          .map(normalizeSupplierPerformance)
          .map(record => [`${record.supplierId}:${record.period}`, record.notes])
      )
      const mergedRecords = calculatedRecords.map(record => ({
        ...record,
        notes: storedNotesByKey.get(`${record.supplierId}:${record.period}`) || record.notes
      }))

      saveSupplierPerformanceRecords(mergedRecords)
      return mergedRecords
    }
  } catch {
    saveSupplierPerformanceRecords(calculatedRecords)
    return calculatedRecords
  }

  saveSupplierPerformanceRecords(calculatedRecords)
  return calculatedRecords
}
