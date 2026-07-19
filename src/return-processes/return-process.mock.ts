import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { QualityControl } from '../quality-controls/quality-control.types'
import type {
  ReturnProcess,
  ReturnProcessStatus,
  ReturnReason
} from './return-process.types'

export const RETURN_PROCESS_STORAGE_KEY = 'ra_return_processes'

export const RETURN_REASONS: ReturnReason[] = [
  'QUALITY_FAILURE',
  'EXPIRED',
  'DAMAGED',
  'WRONG_PRODUCT',
  'WRONG_QUANTITY',
  'PACKAGING_DAMAGE',
  'OTHER'
]

export const RETURN_PROCESS_STATUSES: ReturnProcessStatus[] = [
  'DRAFT',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED'
]

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  QUALITY_FAILURE: 'Kalite Uygunsuzluğu',
  EXPIRED: 'Son Kullanma Tarihi',
  DAMAGED: 'Hasarlı Ürün',
  WRONG_PRODUCT: 'Yanlış Ürün',
  WRONG_QUANTITY: 'Yanlış Miktar',
  PACKAGING_DAMAGE: 'Ambalaj Hasarı',
  OTHER: 'Diğer'
}

export const RETURN_PROCESS_STATUS_LABELS: Record<ReturnProcessStatus, string> = {
  DRAFT: 'Taslak',
  PENDING: 'Bekliyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal'
}

type RawReturnProcessRecord = Partial<Record<keyof ReturnProcess, unknown>> & Record<string, unknown>

const DEFAULT_REASON: ReturnReason = 'QUALITY_FAILURE'
const DEFAULT_STATUS: ReturnProcessStatus = 'DRAFT'
const QUANTITY_ROUNDING_FACTOR = 1000
const DUMMY_RETURN_COUNT = 14

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawReturnProcessRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizePositiveNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const normalizeReason = (value: unknown): ReturnReason => {
  const normalized = normalizeText(value).toUpperCase()
  return RETURN_REASONS.includes(normalized as ReturnReason)
    ? normalized as ReturnReason
    : DEFAULT_REASON
}

const normalizeStatus = (value: unknown): ReturnProcessStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return RETURN_PROCESS_STATUSES.includes(normalized as ReturnProcessStatus)
    ? normalized as ReturnProcessStatus
    : DEFAULT_STATUS
}

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

export const getNextReturnProcessNo = (records: ReturnProcess[]) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.returnNo.match(/RET-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `RET-${String(maxNo + 1).padStart(6, '0')}`
}

export const isReturnProcessQuantityBlockingStatus = (status: ReturnProcessStatus) => (
  status !== 'CANCELLED' && status !== 'REJECTED'
)

export const getReturnedQuantityForLot = (
  records: ReturnProcess[],
  inventoryLotId: string,
  excludedReturnProcessId = ''
) => (
  roundQuantity(records
    .filter(record => (
      record.id !== excludedReturnProcessId
      && record.inventoryLotId === inventoryLotId
      && isReturnProcessQuantityBlockingStatus(record.status)
    ))
    .reduce((total, record) => total + record.returnQuantity, 0))
)

export const getReturnableQuantityForLot = (
  records: ReturnProcess[],
  lot: Pick<InventoryLot, 'id' | 'remainingQuantity'>,
  excludedReturnProcessId = ''
) => (
  roundQuantity(Math.max(0, lot.remainingQuantity - getReturnedQuantityForLot(records, lot.id, excludedReturnProcessId)))
)

export const createReturnProcessMockData = (
  qualityControls: QualityControl[],
  inventoryLots: InventoryLot[],
  goodsReceipts: GoodsReceiptRecord[]
): ReturnProcess[] => {
  const lotMap = new Map(inventoryLots.map(lot => [lot.id, lot]))
  const receiptMap = new Map(goodsReceipts.map(receipt => [receipt.id, receipt]))
  const rejectedQualityControls = qualityControls
    .filter(record => record.decision === 'REJECTED')
    .filter(record => {
      const lot = lotMap.get(record.inventoryLotId)
      return Boolean(lot && lot.remainingQuantity > 0 && receiptMap.has(record.goodsReceiptId))
    })

  if(rejectedQualityControls.length === 0) return []

  const selectedQualityControls = Array.from({ length: DUMMY_RETURN_COUNT }, (_, index) => (
    rejectedQualityControls[index % rejectedQualityControls.length]
  ))
  const countByQualityControl = selectedQualityControls.reduce((map, record) => {
    map.set(record.id, (map.get(record.id) || 0) + 1)
    return map
  }, new Map<string, number>())
  const usedQuantityByLot = new Map<string, number>()
  const statuses: ReturnProcessStatus[] = [
    'APPROVED',
    'COMPLETED',
    'APPROVED',
    'APPROVED',
    'COMPLETED',
    'APPROVED',
    'COMPLETED',
    'APPROVED',
    'APPROVED',
    'COMPLETED',
    'APPROVED',
    'PENDING',
    'DRAFT',
    'PENDING',
    'APPROVED'
  ]
  const reasons: ReturnReason[] = [
    'QUALITY_FAILURE',
    'DAMAGED',
    'PACKAGING_DAMAGE',
    'EXPIRED',
    'WRONG_PRODUCT',
    'WRONG_QUANTITY',
    'QUALITY_FAILURE',
    'OTHER',
    'DAMAGED',
    'PACKAGING_DAMAGE'
  ]

  return selectedQualityControls.flatMap((qualityControl, index) => {
    const lot = lotMap.get(qualityControl.inventoryLotId)
    const receipt = receiptMap.get(qualityControl.goodsReceiptId)
    if(!lot || !receipt) return []

    const currentUsedQuantity = usedQuantityByLot.get(lot.id) || 0
    const maxRemainingForLot = Math.max(0, lot.remainingQuantity - currentUsedQuantity)
    const qualityControlReturnCount = countByQualityControl.get(qualityControl.id) || 1
    const plannedQuantity = roundQuantity(Math.max(0.001, lot.remainingQuantity / (qualityControlReturnCount + 1)))
    const returnQuantity = roundQuantity(Math.min(maxRemainingForLot, plannedQuantity))
    if(returnQuantity <= 0) return []

    usedQuantityByLot.set(lot.id, roundQuantity(currentUsedQuantity + returnQuantity))

    const createdAt = `2026-07-${String(18 + (index % 3)).padStart(2, '0')}T11:${String(index * 4).padStart(2, '0')}:00.000Z`

    return [{
      id: `return_process_${String(index + 1).padStart(3, '0')}`,
      returnNo: `RET-${String(index + 1).padStart(6, '0')}`,
      qualityControlId: qualityControl.id,
      inventoryLotId: lot.id,
      goodsReceiptId: receipt.id,
      purchaseOrderId: receipt.purchaseOrderId,
      supplierId: lot.supplierId,
      warehouseId: lot.warehouseId,
      returnReason: reasons[index % reasons.length],
      returnQuantity,
      status: statuses[index % statuses.length],
      notes: 'Quality Control red kararı sonrası oluşturulan örnek iade süreci.',
      createdBy: 'Kalite Kontrol',
      createdAt,
      updatedAt: createdAt
    }]
  })
}

const normalizeReturnProcess = (item: RawReturnProcessRecord, index: number): ReturnProcess => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now

  return {
    id: normalizeText(item.id) || `return_process_${Date.now()}_${index}`,
    returnNo: normalizeText(item.returnNo) || `RET-${String(index + 1).padStart(6, '0')}`,
    qualityControlId: normalizeText(item.qualityControlId),
    inventoryLotId: normalizeText(item.inventoryLotId),
    goodsReceiptId: normalizeText(item.goodsReceiptId),
    purchaseOrderId: normalizeText(item.purchaseOrderId),
    supplierId: normalizeText(item.supplierId),
    warehouseId: normalizeText(item.warehouseId),
    returnReason: normalizeReason(item.returnReason),
    returnQuantity: normalizePositiveNumber(item.returnQuantity),
    status: normalizeStatus(item.status),
    notes: normalizeText(item.notes),
    createdBy: normalizeText(item.createdBy) || 'Kalite Kontrol',
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const saveReturnProcessRecords = (records: ReturnProcess[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(RETURN_PROCESS_STORAGE_KEY, JSON.stringify(records))
}

export const loadReturnProcessRecords = (
  qualityControls: QualityControl[],
  inventoryLots: InventoryLot[],
  goodsReceipts: GoodsReceiptRecord[]
) => {
  const seedRecords = createReturnProcessMockData(qualityControls, inventoryLots, goodsReceipts)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(RETURN_PROCESS_STORAGE_KEY)
  if(!storedRecords){
    if(seedRecords.length > 0) saveReturnProcessRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map(normalizeReturnProcess)

      saveReturnProcessRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveReturnProcessRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveReturnProcessRecords(seedRecords)
  return seedRecords
}
