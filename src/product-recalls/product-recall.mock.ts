import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { StockUnit } from '../types'
import type {
  ProductRecall,
  ProductRecallReason,
  ProductRecallRiskLevel,
  ProductRecallStatus
} from './product-recall.types'

export const PRODUCT_RECALL_STORAGE_KEY = 'ra_product_recalls'

export const PRODUCT_RECALL_REASONS: ProductRecallReason[] = [
  'MICROBIOLOGICAL',
  'CHEMICAL',
  'PHYSICAL',
  'ALLERGEN',
  'PACKAGING_DEFECT',
  'LABEL_ERROR',
  'FOREIGN_OBJECT',
  'OTHER'
]

export const PRODUCT_RECALL_RISK_LEVELS: ProductRecallRiskLevel[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL'
]

export const PRODUCT_RECALL_STATUSES: ProductRecallStatus[] = [
  'OPEN',
  'UNDER_INVESTIGATION',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
]

export const PRODUCT_RECALL_REASON_LABELS: Record<ProductRecallReason, string> = {
  MICROBIOLOGICAL: 'Mikrobiyolojik',
  CHEMICAL: 'Kimyasal',
  PHYSICAL: 'Fiziksel',
  ALLERGEN: 'Alerjen',
  PACKAGING_DEFECT: 'Ambalaj Hatası',
  LABEL_ERROR: 'Etiket Hatası',
  FOREIGN_OBJECT: 'Yabancı Madde',
  OTHER: 'Diğer'
}

export const PRODUCT_RECALL_RISK_LEVEL_LABELS: Record<ProductRecallRiskLevel, string> = {
  LOW: 'Düşük',
  MEDIUM: 'Orta',
  HIGH: 'Yüksek',
  CRITICAL: 'Kritik'
}

export const PRODUCT_RECALL_STATUS_LABELS: Record<ProductRecallStatus, string> = {
  OPEN: 'Açık',
  UNDER_INVESTIGATION: 'İncelemede',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal'
}

export type ProductRecallInput = {
  recallNo: string
  inventoryLotId: string
  reason: ProductRecallReason
  riskLevel: ProductRecallRiskLevel
  status: ProductRecallStatus
  affectedQuantity: number
  unit: StockUnit
  reportedDate: string
  resolvedDate: string
  description: string
  createdBy: string
}

type RawProductRecallRecord = Partial<Record<keyof ProductRecall, unknown>> & Record<string, unknown>

const DEFAULT_REASON: ProductRecallReason = 'OTHER'
const DEFAULT_RISK_LEVEL: ProductRecallRiskLevel = 'LOW'
const DEFAULT_STATUS: ProductRecallStatus = 'OPEN'
const DEFAULT_UNIT: StockUnit = 'adet'
const QUANTITY_ROUNDING_FACTOR = 1000

const REASON_ROTATION: ProductRecallReason[] = [
  'MICROBIOLOGICAL',
  'CHEMICAL',
  'PHYSICAL',
  'ALLERGEN',
  'PACKAGING_DEFECT',
  'LABEL_ERROR',
  'FOREIGN_OBJECT',
  'OTHER'
]

const RISK_ROTATION: ProductRecallRiskLevel[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
  'MEDIUM'
]

const STATUS_ROTATION: ProductRecallStatus[] = [
  'OPEN',
  'UNDER_INVESTIGATION',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'IN_PROGRESS'
]

const CREATED_BY_ROTATION = [
  'Kalite Şefi',
  'Gıda Mühendisi',
  'Operasyon Müdürü',
  'Kalite Güvence',
  'Üretim Sorumlusu'
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawProductRecallRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchKey = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const normalizePositiveNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const normalizeReason = (value: unknown): ProductRecallReason => {
  const normalized = normalizeText(value).toUpperCase()
  return PRODUCT_RECALL_REASONS.includes(normalized as ProductRecallReason)
    ? normalized as ProductRecallReason
    : DEFAULT_REASON
}

const normalizeRiskLevel = (value: unknown): ProductRecallRiskLevel => {
  const normalized = normalizeText(value).toUpperCase()
  return PRODUCT_RECALL_RISK_LEVELS.includes(normalized as ProductRecallRiskLevel)
    ? normalized as ProductRecallRiskLevel
    : DEFAULT_RISK_LEVEL
}

const normalizeStatus = (value: unknown): ProductRecallStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return PRODUCT_RECALL_STATUSES.includes(normalized as ProductRecallStatus)
    ? normalized as ProductRecallStatus
    : DEFAULT_STATUS
}

const normalizeUnit = (value: unknown): StockUnit => {
  const normalized = normalizeText(value)
  const units: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
  return units.includes(normalized as StockUnit) ? normalized as StockUnit : DEFAULT_UNIT
}

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue || getTodayKey()
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const getNextProductRecallNo = (records: ProductRecall[], offset = 0) => {
  const maxNo = records.reduce((max, recall) => {
    const match = recall.recallNo.match(/RCL-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `RCL-${String(maxNo + 1 + offset).padStart(6, '0')}`
}

export const validateProductRecallInput = (
  input: ProductRecallInput,
  inventoryLotMap: Map<string, InventoryLot>,
  existingRecalls: ProductRecall[],
  currentRecallId = ''
) => {
  if(!input.inventoryLotId.trim()) return 'Inventory Lot zorunludur.'
  if(!input.reason.trim()) return 'Reason zorunludur.'
  if(!input.riskLevel.trim()) return 'Risk Level zorunludur.'
  if(!input.reportedDate.trim()) return 'Reported Date zorunludur.'
  if(!Number.isFinite(input.affectedQuantity)) return 'Affected Quantity geçerli sayı olmalıdır.'
  if(input.affectedQuantity <= 0) return 'Affected Quantity 0’dan büyük olmalıdır.'
  if(!input.createdBy.trim()) return 'Created By zorunludur.'
  if(!input.recallNo.trim()) return 'Recall No zorunludur.'
  if(!inventoryLotMap.has(input.inventoryLotId)) return 'Inventory Lot bulunamadı.'
  if(input.resolvedDate && input.resolvedDate < input.reportedDate){
    return 'Resolved Date, Reported Date değerinden küçük olamaz.'
  }

  const normalizedRecallNo = normalizeSearchKey(input.recallNo)
  const duplicateRecall = existingRecalls.find(recall => (
    recall.id !== currentRecallId && normalizeSearchKey(recall.recallNo) === normalizedRecallNo
  ))

  return duplicateRecall ? 'Recall No benzersiz olmalıdır.' : ''
}

export const createProductRecallRecord = (
  input: ProductRecallInput,
  existingRecall?: ProductRecall
): ProductRecall => {
  const now = new Date().toISOString()
  const createdAt = existingRecall?.createdAt || now

  return {
    id: existingRecall?.id || createId('product_recall'),
    recallNo: input.recallNo.trim(),
    inventoryLotId: input.inventoryLotId,
    reason: input.reason,
    riskLevel: input.riskLevel,
    status: input.status,
    affectedQuantity: roundQuantity(input.affectedQuantity),
    unit: input.unit,
    reportedDate: input.reportedDate,
    resolvedDate: input.resolvedDate,
    description: input.description.trim(),
    createdBy: input.createdBy.trim(),
    createdAt,
    updatedAt: now
  }
}

export const createProductRecallMockData = (
  inventoryLots: InventoryLot[],
  existingRecalls: ProductRecall[] = []
): ProductRecall[] => {
  const sourceLots = inventoryLots.filter(lot => lot.productionOrderId && lot.productId).slice(0, 20)
  const fallbackLots = sourceLots.length > 0 ? sourceLots : inventoryLots.slice(0, 20)
  const recallNos = new Set(existingRecalls.map(recall => normalizeSearchKey(recall.recallNo)))
  const recallIds = new Set(existingRecalls.map(recall => recall.id))

  return fallbackLots.map((lot, index) => {
    const reason = REASON_ROTATION[index % REASON_ROTATION.length]
    const riskLevel = RISK_ROTATION[index % RISK_ROTATION.length]
    const status = STATUS_ROTATION[index % STATUS_ROTATION.length]
    const reportedDate = addDays(lot.productionDate || getTodayKey(), 3 + (index % 7))
    const resolvedDate = status === 'COMPLETED' || status === 'CANCELLED'
      ? addDays(reportedDate, 2 + (index % 4))
      : ''
    let sequence = index + 1
    let recallNo = `RCL-${String(sequence).padStart(6, '0')}`
    let recallId = `product_recall_${String(index + 1).padStart(3, '0')}`

    while(recallNos.has(normalizeSearchKey(recallNo))){
      sequence += 1
      recallNo = `RCL-${String(sequence).padStart(6, '0')}`
    }
    recallNos.add(normalizeSearchKey(recallNo))

    while(recallIds.has(recallId)){
      sequence += 1
      recallId = `product_recall_${String(sequence).padStart(3, '0')}`
    }
    recallIds.add(recallId)

    const sourceQuantity = lot.remainingQuantity || lot.quantity || lot.receivedQuantity || 1
    const affectedQuantity = roundQuantity(Math.max(0.001, sourceQuantity * (0.12 + (index % 5) * 0.07)))
    const createdAt = `${reportedDate}T${String(9 + (index % 8)).padStart(2, '0')}:${String(index * 2).padStart(2, '0')}:00.000Z`

    return {
      id: recallId,
      recallNo,
      inventoryLotId: lot.id,
      reason,
      riskLevel,
      status,
      affectedQuantity,
      unit: lot.unit,
      reportedDate,
      resolvedDate,
      description: `${PRODUCT_RECALL_REASON_LABELS[reason]} riski nedeniyle lot geri çağırma takibi başlatıldı.`,
      createdBy: CREATED_BY_ROTATION[index % CREATED_BY_ROTATION.length],
      createdAt,
      updatedAt: createdAt
    }
  })
}

const normalizeProductRecall = (item: RawProductRecallRecord, index: number): ProductRecall => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const reportedDate = normalizeText(item.reportedDate) || getTodayKey()
  const rawResolvedDate = normalizeText(item.resolvedDate)
  const resolvedDate = rawResolvedDate && rawResolvedDate < reportedDate ? reportedDate : rawResolvedDate
  const affectedQuantity = roundQuantity(normalizePositiveNumber(item.affectedQuantity) || 1)

  return {
    id: normalizeText(item.id) || `product_recall_${Date.now()}_${index}`,
    recallNo: normalizeText(item.recallNo) || `RCL-${String(index + 1).padStart(6, '0')}`,
    inventoryLotId: normalizeText(item.inventoryLotId),
    reason: normalizeReason(item.reason),
    riskLevel: normalizeRiskLevel(item.riskLevel),
    status: normalizeStatus(item.status),
    affectedQuantity,
    unit: normalizeUnit(item.unit),
    reportedDate,
    resolvedDate,
    description: normalizeText(item.description),
    createdBy: normalizeText(item.createdBy) || 'Kalite Ekibi',
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const saveProductRecallRecords = (records: ProductRecall[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(PRODUCT_RECALL_STORAGE_KEY, JSON.stringify(records.map(normalizeProductRecall)))
}

const ensureProductRecallSeeds = (
  records: ProductRecall[],
  inventoryLots: InventoryLot[]
) => {
  if(records.length >= 20) return records

  const seedRecords = createProductRecallMockData(inventoryLots, records).slice(0, 20 - records.length)
  return seedRecords.length > 0 ? [...seedRecords, ...records] : records
}

export const loadProductRecallRecords = (inventoryLots: InventoryLot[]) => {
  const seedRecords = createProductRecallMockData(inventoryLots)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(PRODUCT_RECALL_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveProductRecallRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map(normalizeProductRecall)
      const migratedRecords = ensureProductRecallSeeds(normalizedRecords, inventoryLots)

      saveProductRecallRecords(migratedRecords)
      return migratedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveProductRecallRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveProductRecallRecords(seedRecords)
  return seedRecords
}
