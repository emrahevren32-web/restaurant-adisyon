import type { ShipmentExecutionRecord } from '../shipment-executions/shipment-execution.types'
import type {
  TransferReceiptItem,
  TransferReceiptItemStatus,
  TransferReceiptRecord,
  TransferReceiptResult,
  TransferReceiptStatus
} from './transfer-receipt.types'

export const TRANSFER_RECEIPT_STORAGE_KEY = 'ra_transfer_receipts'

export const TRANSFER_RECEIPT_STATUSES: TransferReceiptStatus[] = [
  'PENDING',
  'INSPECTING',
  'COMPLETED',
  'REJECTED',
  'CANCELLED'
]

export const TRANSFER_RECEIPT_STATUS_LABELS: Record<TransferReceiptStatus, string> = {
  PENDING: 'Bekliyor',
  INSPECTING: 'Kontrol Ediliyor',
  COMPLETED: 'Tamamlandı',
  REJECTED: 'Reddedildi',
  CANCELLED: 'İptal'
}

export const TRANSFER_RECEIPT_RESULTS: TransferReceiptResult[] = [
  'SUCCESS',
  'PARTIAL',
  'REJECTED'
]

export const TRANSFER_RECEIPT_RESULT_LABELS: Record<TransferReceiptResult, string> = {
  SUCCESS: 'Başarılı',
  PARTIAL: 'Kısmi',
  REJECTED: 'Reddedildi'
}

export const TRANSFER_RECEIPT_ITEM_STATUSES: TransferReceiptItemStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PARTIAL',
  'MISSING',
  'DAMAGED',
  'REJECTED'
]

export const TRANSFER_RECEIPT_ITEM_STATUS_LABELS: Record<TransferReceiptItemStatus, string> = {
  PENDING: 'Bekliyor',
  ACCEPTED: 'Kabul',
  PARTIAL: 'Kısmi',
  MISSING: 'Eksik',
  DAMAGED: 'Hasarlı',
  REJECTED: 'Red'
}

type RawTransferReceiptRecord = Partial<Record<keyof TransferReceiptRecord, unknown>> & Record<string, unknown>
type RawTransferReceiptItemRecord = Partial<Record<keyof TransferReceiptItem, unknown>> & Record<string, unknown>

const DEFAULT_STATUS: TransferReceiptStatus = 'PENDING'
const DEFAULT_ITEM_STATUS: TransferReceiptItemStatus = 'PENDING'
const RECEIPT_NO_PREFIX = 'TRF'
const RECEIPT_NO_PADDING = 6
const SEED_RECEIPT_COUNT = 15
const QUANTITY_ROUNDING_FACTOR = 1000

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawTransferReceiptRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawTransferReceiptItemRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? roundQuantity(parsed) : 0
}

const normalizeStatus = (value: unknown): TransferReceiptStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return TRANSFER_RECEIPT_STATUSES.includes(normalized as TransferReceiptStatus)
    ? normalized as TransferReceiptStatus
    : DEFAULT_STATUS
}

const normalizeResult = (value: unknown): TransferReceiptResult | '' => {
  const normalized = normalizeText(value).toUpperCase()
  return TRANSFER_RECEIPT_RESULTS.includes(normalized as TransferReceiptResult)
    ? normalized as TransferReceiptResult
    : ''
}

const normalizeItemStatus = (value: unknown): TransferReceiptItemStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return TRANSFER_RECEIPT_ITEM_STATUSES.includes(normalized as TransferReceiptItemStatus)
    ? normalized as TransferReceiptItemStatus
    : DEFAULT_ITEM_STATUS
}

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

export const getNextTransferReceiptNo = (
  records: Pick<TransferReceiptRecord, 'receiptNo'>[],
  offset = 0
) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.receiptNo.match(new RegExp(`${RECEIPT_NO_PREFIX}-(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${RECEIPT_NO_PREFIX}-${String(maxNo + 1 + offset).padStart(RECEIPT_NO_PADDING, '0')}`
}

export const canCreateTransferReceipt = (
  execution: ShipmentExecutionRecord,
  records: Pick<TransferReceiptRecord, 'shipmentExecutionId'>[]
) => (
  execution.items.some(item => item.shippedQuantity > 0 || item.deliveredQuantity > 0)
  && !records.some(record => record.shipmentExecutionId === execution.id)
  && execution.status !== 'CANCELLED'
)

const resolveItemStatus = ({
  expectedQuantity,
  receivedQuantity,
  missingQuantity,
  damagedQuantity,
  acceptedQuantity,
  rejected
}: {
  expectedQuantity: number
  receivedQuantity: number
  missingQuantity: number
  damagedQuantity: number
  acceptedQuantity: number
  rejected: boolean
}): TransferReceiptItemStatus => {
  if(rejected) return 'REJECTED'
  if(damagedQuantity > 0) return acceptedQuantity > 0 ? 'DAMAGED' : 'REJECTED'
  if(missingQuantity > 0) return acceptedQuantity > 0 ? 'PARTIAL' : 'MISSING'
  if(receivedQuantity > expectedQuantity) return 'PARTIAL'
  if(acceptedQuantity >= expectedQuantity && expectedQuantity > 0) return 'ACCEPTED'
  return acceptedQuantity > 0 ? 'PARTIAL' : 'PENDING'
}

const buildItemsFromExecution = (
  execution: ShipmentExecutionRecord,
  receiptId: string,
  status: TransferReceiptStatus = 'PENDING',
  receiptIndex = 0
): TransferReceiptItem[] => (
  execution.items
    .filter(item => item.shippedQuantity > 0 || item.deliveredQuantity > 0)
    .map((executionItem, index) => {
      const expectedQuantity = roundQuantity(executionItem.shippedQuantity || executionItem.deliveredQuantity)
      const rejected = status === 'REJECTED'
      const damagedQuantity = rejected ? 0 : status === 'COMPLETED' && receiptIndex % 5 === 0 && index === 0
        ? roundQuantity(expectedQuantity * 0.1)
        : 0
      const receivedQuantity = rejected ? 0 : status === 'COMPLETED' && receiptIndex % 4 === 0
        ? roundQuantity(expectedQuantity * 0.85)
        : expectedQuantity
      const missingQuantity = roundQuantity(Math.max(0, expectedQuantity - receivedQuantity))
      const extraQuantity = roundQuantity(Math.max(0, receivedQuantity - expectedQuantity))
      const acceptedQuantity = rejected ? 0 : roundQuantity(Math.max(0, receivedQuantity - damagedQuantity))
      const itemStatus = resolveItemStatus({
        expectedQuantity,
        receivedQuantity,
        missingQuantity,
        damagedQuantity,
        acceptedQuantity,
        rejected
      })

      return {
        id: `transfer_receipt_item_${receiptId}_${index + 1}`,
        receiptId,
        executionItemId: executionItem.id,
        expectedQuantity,
        receivedQuantity: status === 'PENDING' || status === 'INSPECTING' ? 0 : receivedQuantity,
        missingQuantity: status === 'PENDING' || status === 'INSPECTING' ? 0 : missingQuantity,
        extraQuantity: status === 'PENDING' || status === 'INSPECTING' ? 0 : extraQuantity,
        damagedQuantity: status === 'PENDING' || status === 'INSPECTING' ? 0 : damagedQuantity,
        acceptedQuantity: status === 'PENDING' || status === 'INSPECTING' ? 0 : acceptedQuantity,
        status: status === 'PENDING' || status === 'INSPECTING' ? 'PENDING' : itemStatus,
        notes: ''
      }
    })
)

export const createTransferReceiptFromExecution = ({
  execution,
  records,
  warehouseId,
  branchId,
  receivedBy
}: {
  execution: ShipmentExecutionRecord
  records: TransferReceiptRecord[]
  warehouseId: string
  branchId: string
  receivedBy: string
}): TransferReceiptRecord => {
  const now = new Date().toISOString()
  const id = `transfer_receipt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  return {
    id,
    receiptNo: getNextTransferReceiptNo(records),
    shipmentExecutionId: execution.id,
    warehouseId,
    branchId,
    receiptDate: getTodayKey(),
    receivedBy,
    status: 'PENDING',
    result: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
    items: buildItemsFromExecution(execution, id)
  }
}

const normalizeReceiptItem = (
  item: RawTransferReceiptItemRecord,
  receiptId: string,
  index: number
): TransferReceiptItem => {
  const expectedQuantity = normalizeNonNegativeNumber(item.expectedQuantity)
  const receivedQuantity = normalizeNonNegativeNumber(item.receivedQuantity)
  const damagedQuantity = normalizeNonNegativeNumber(item.damagedQuantity)
  const missingQuantity = normalizeNonNegativeNumber(item.missingQuantity) || roundQuantity(Math.max(0, expectedQuantity - receivedQuantity))
  const extraQuantity = normalizeNonNegativeNumber(item.extraQuantity) || roundQuantity(Math.max(0, receivedQuantity - expectedQuantity))
  const acceptedQuantity = normalizeNonNegativeNumber(item.acceptedQuantity) || roundQuantity(Math.max(0, receivedQuantity - damagedQuantity))

  return {
    id: normalizeText(item.id) || `transfer_receipt_item_${receiptId}_${index + 1}`,
    receiptId: normalizeText(item.receiptId) || receiptId,
    executionItemId: normalizeText(item.executionItemId),
    expectedQuantity,
    receivedQuantity,
    missingQuantity,
    extraQuantity,
    damagedQuantity,
    acceptedQuantity,
    status: normalizeItemStatus(item.status),
    notes: normalizeText(item.notes)
  }
}

const normalizeReceipt = (
  item: RawTransferReceiptRecord,
  index: number,
  executionMap: Map<string, ShipmentExecutionRecord>
): TransferReceiptRecord => {
  const createdAt = normalizeText(item.createdAt) || new Date().toISOString()
  const id = normalizeText(item.id) || `transfer_receipt_${index + 1}`
  const shipmentExecutionId = normalizeText(item.shipmentExecutionId)
  const rawItems = Array.isArray(item.items) ? item.items.filter(isItemRecord) : []
  const status = normalizeStatus(item.status)
  const items = rawItems.length > 0
    ? rawItems.map((record, itemIndex) => normalizeReceiptItem(record, id, itemIndex))
    : executionMap.get(shipmentExecutionId)
      ? buildItemsFromExecution(executionMap.get(shipmentExecutionId) as ShipmentExecutionRecord, id, status, index)
      : []

  return {
    id,
    receiptNo: normalizeText(item.receiptNo) || `${RECEIPT_NO_PREFIX}-${String(index + 1).padStart(RECEIPT_NO_PADDING, '0')}`,
    shipmentExecutionId,
    warehouseId: normalizeText(item.warehouseId),
    branchId: normalizeText(item.branchId),
    receiptDate: normalizeText(item.receiptDate) || getTodayKey(),
    receivedBy: normalizeText(item.receivedBy),
    status,
    result: normalizeResult(item.result),
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    items
  }
}

export const createTransferReceiptMockData = (
  executions: ShipmentExecutionRecord[]
): TransferReceiptRecord[] => {
  const today = getTodayKey()
  const eligibleExecutions = executions.filter(execution => execution.items.some(item => item.shippedQuantity > 0 || item.deliveredQuantity > 0))
  const statuses: TransferReceiptStatus[] = [
    'PENDING',
    'INSPECTING',
    'COMPLETED',
    'COMPLETED',
    'REJECTED',
    'COMPLETED',
    'PENDING',
    'INSPECTING',
    'COMPLETED',
    'REJECTED',
    'COMPLETED',
    'COMPLETED',
    'PENDING',
    'INSPECTING',
    'COMPLETED'
  ]

  return eligibleExecutions.slice(0, SEED_RECEIPT_COUNT).map((execution, index) => {
    const id = `transfer_receipt_${index + 1}`
    const status = statuses[index % statuses.length]
    const items = buildItemsFromExecution(execution, id, status, index)
    const hasRejected = status === 'REJECTED'
    const hasPartial = items.some(item => item.status === 'PARTIAL' || item.status === 'MISSING' || item.status === 'DAMAGED')
    const result: TransferReceiptResult | '' = hasRejected ? 'REJECTED' : status === 'COMPLETED' ? hasPartial ? 'PARTIAL' : 'SUCCESS' : ''
    const createdAt = `${addDays(today, -index)}T10:30:00.000Z`

    return {
      id,
      receiptNo: `${RECEIPT_NO_PREFIX}-${String(index + 1).padStart(RECEIPT_NO_PADDING, '0')}`,
      shipmentExecutionId: execution.id,
      warehouseId: '',
      branchId: '',
      receiptDate: addDays(today, -index),
      receivedBy: status === 'PENDING' ? '' : 'Depo Kabul Ekibi',
      status,
      result,
      notes: hasRejected ? 'Gelen sevkiyat depo kabulde reddedildi.' : hasPartial ? 'Eksik veya hasarlı kalemler kayıt altına alındı.' : '',
      createdAt,
      updatedAt: createdAt,
      items
    }
  })
}

export const saveTransferReceiptRecords = (records: TransferReceiptRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  const executionMap = new Map<string, ShipmentExecutionRecord>()
  const normalizedRecords = records.map((record, index) => normalizeReceipt(record, index, executionMap))
  localStorage.setItem(TRANSFER_RECEIPT_STORAGE_KEY, JSON.stringify(normalizedRecords))
}

export const loadTransferReceiptRecords = (
  executions: ShipmentExecutionRecord[]
) => {
  const executionMap = new Map(executions.map(execution => [execution.id, execution]))
  const seedRecords = createTransferReceiptMockData(executions)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(TRANSFER_RECEIPT_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveTransferReceiptRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeReceipt(record, index, executionMap))

      saveTransferReceiptRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveTransferReceiptRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveTransferReceiptRecords(seedRecords)
  return seedRecords
}
