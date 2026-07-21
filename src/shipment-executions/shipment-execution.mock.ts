import type { ShipmentRecord } from '../shipments/shipment.types'
import type {
  ShipmentDeliveryResult,
  ShipmentExecutionItem,
  ShipmentExecutionItemStatus,
  ShipmentExecutionRecord,
  ShipmentExecutionStatus
} from './shipment-execution.types'

export const SHIPMENT_EXECUTION_STORAGE_KEY = 'ra_shipment_executions'

export const SHIPMENT_EXECUTION_STATUSES: ShipmentExecutionStatus[] = [
  'PENDING',
  'PICKING',
  'PACKING',
  'READY_TO_SHIP',
  'SHIPPED',
  'PARTIALLY_DELIVERED',
  'DELIVERED',
  'CANCELLED'
]

export const SHIPMENT_EXECUTION_STATUS_LABELS: Record<ShipmentExecutionStatus, string> = {
  PENDING: 'Bekliyor',
  PICKING: 'Picking',
  PACKING: 'Packing',
  READY_TO_SHIP: 'Sevke Hazır',
  SHIPPED: 'Sevk Edildi',
  PARTIALLY_DELIVERED: 'Kısmi Teslim',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal'
}

export const SHIPMENT_EXECUTION_ITEM_STATUSES: ShipmentExecutionItemStatus[] = [
  'PENDING',
  'PICKED',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
  'PARTIAL',
  'CANCELLED'
]

export const SHIPMENT_EXECUTION_ITEM_STATUS_LABELS: Record<ShipmentExecutionItemStatus, string> = {
  PENDING: 'Bekliyor',
  PICKED: 'Picked',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  PARTIAL: 'Partial',
  CANCELLED: 'Cancelled'
}

export const SHIPMENT_DELIVERY_RESULTS: ShipmentDeliveryResult[] = [
  'SUCCESS',
  'PARTIAL',
  'FAILED',
  'RETURNED'
]

export const SHIPMENT_DELIVERY_RESULT_LABELS: Record<ShipmentDeliveryResult, string> = {
  SUCCESS: 'Başarılı',
  PARTIAL: 'Kısmi',
  FAILED: 'Başarısız',
  RETURNED: 'Geri Döndü'
}

type RawShipmentExecutionRecord = Partial<Record<keyof ShipmentExecutionRecord, unknown>> & Record<string, unknown>
type RawShipmentExecutionItemRecord = Partial<Record<keyof ShipmentExecutionItem, unknown>> & Record<string, unknown>

const DEFAULT_STATUS: ShipmentExecutionStatus = 'PENDING'
const DEFAULT_ITEM_STATUS: ShipmentExecutionItemStatus = 'PENDING'
const EXECUTION_NO_PREFIX = 'SHE'
const EXECUTION_NO_PADDING = 6
const SEED_EXECUTION_COUNT = 15
const QUANTITY_ROUNDING_FACTOR = 1000

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawShipmentExecutionRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawShipmentExecutionItemRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? roundQuantity(parsed) : 0
}

const normalizeStatus = (value: unknown): ShipmentExecutionStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_EXECUTION_STATUSES.includes(normalized as ShipmentExecutionStatus)
    ? normalized as ShipmentExecutionStatus
    : DEFAULT_STATUS
}

const normalizeItemStatus = (value: unknown): ShipmentExecutionItemStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_EXECUTION_ITEM_STATUSES.includes(normalized as ShipmentExecutionItemStatus)
    ? normalized as ShipmentExecutionItemStatus
    : DEFAULT_ITEM_STATUS
}

const normalizeDeliveryResult = (value: unknown): ShipmentDeliveryResult | '' => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_DELIVERY_RESULTS.includes(normalized as ShipmentDeliveryResult)
    ? normalized as ShipmentDeliveryResult
    : ''
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

export const getNextShipmentExecutionNo = (
  records: Pick<ShipmentExecutionRecord, 'executionNo'>[],
  offset = 0
) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.executionNo.match(new RegExp(`${EXECUTION_NO_PREFIX}-(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${EXECUTION_NO_PREFIX}-${String(maxNo + 1 + offset).padStart(EXECUTION_NO_PADDING, '0')}`
}

export const canCreateShipmentExecution = (
  shipment: ShipmentRecord,
  records: Pick<ShipmentExecutionRecord, 'shipmentId'>[]
) => shipment.items.length > 0 && !records.some(record => record.shipmentId === shipment.id)

const getQuantitySnapshot = (
  plannedQuantity: number,
  status: ShipmentExecutionStatus,
  itemIndex: number
) => {
  if(status === 'CANCELLED'){
    return {
      pickedQuantity: 0,
      packedQuantity: 0,
      shippedQuantity: 0,
      deliveredQuantity: 0,
      itemStatus: 'CANCELLED' as ShipmentExecutionItemStatus
    }
  }

  if(status === 'PENDING' || status === 'PICKING'){
    return {
      pickedQuantity: status === 'PICKING' ? roundQuantity(plannedQuantity * 0.5) : 0,
      packedQuantity: 0,
      shippedQuantity: 0,
      deliveredQuantity: 0,
      itemStatus: status === 'PICKING' ? 'PENDING' as ShipmentExecutionItemStatus : 'PENDING' as ShipmentExecutionItemStatus
    }
  }

  if(status === 'PACKING'){
    return {
      pickedQuantity: plannedQuantity,
      packedQuantity: itemIndex % 2 === 0 ? roundQuantity(plannedQuantity * 0.5) : 0,
      shippedQuantity: 0,
      deliveredQuantity: 0,
      itemStatus: 'PICKED' as ShipmentExecutionItemStatus
    }
  }

  if(status === 'READY_TO_SHIP'){
    return {
      pickedQuantity: plannedQuantity,
      packedQuantity: plannedQuantity,
      shippedQuantity: 0,
      deliveredQuantity: 0,
      itemStatus: 'PACKED' as ShipmentExecutionItemStatus
    }
  }

  if(status === 'SHIPPED'){
    return {
      pickedQuantity: plannedQuantity,
      packedQuantity: plannedQuantity,
      shippedQuantity: plannedQuantity,
      deliveredQuantity: 0,
      itemStatus: 'SHIPPED' as ShipmentExecutionItemStatus
    }
  }

  if(status === 'PARTIALLY_DELIVERED'){
    const deliveredQuantity = roundQuantity(plannedQuantity * (itemIndex % 2 === 0 ? 0.5 : 0.75))
    return {
      pickedQuantity: plannedQuantity,
      packedQuantity: plannedQuantity,
      shippedQuantity: plannedQuantity,
      deliveredQuantity,
      itemStatus: 'PARTIAL' as ShipmentExecutionItemStatus
    }
  }

  return {
    pickedQuantity: plannedQuantity,
    packedQuantity: plannedQuantity,
    shippedQuantity: plannedQuantity,
    deliveredQuantity: plannedQuantity,
    itemStatus: 'DELIVERED' as ShipmentExecutionItemStatus
  }
}

const buildItemsFromShipment = (
  shipment: ShipmentRecord,
  executionId: string,
  status: ShipmentExecutionStatus = 'PENDING'
): ShipmentExecutionItem[] => (
  shipment.items.map((shipmentItem, index) => {
    const plannedQuantity = roundQuantity(shipmentItem.quantity)
    const snapshot = getQuantitySnapshot(plannedQuantity, status, index)

    return {
      id: `shipment_execution_item_${executionId}_${index + 1}`,
      executionId,
      shipmentItemId: shipmentItem.id,
      plannedQuantity,
      pickedQuantity: snapshot.pickedQuantity,
      packedQuantity: snapshot.packedQuantity,
      shippedQuantity: snapshot.shippedQuantity,
      deliveredQuantity: snapshot.deliveredQuantity,
      remainingQuantity: roundQuantity(Math.max(0, plannedQuantity - snapshot.deliveredQuantity)),
      status: snapshot.itemStatus,
      notes: ''
    }
  })
)

export const createShipmentExecutionFromShipment = (
  shipment: ShipmentRecord,
  records: ShipmentExecutionRecord[],
  createdBy = ''
): ShipmentExecutionRecord => {
  const now = new Date().toISOString()
  const id = `shipment_execution_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  return {
    id,
    shipmentId: shipment.id,
    executionNo: getNextShipmentExecutionNo(records),
    status: 'PENDING',
    pickedBy: '',
    packedBy: '',
    shippedBy: '',
    deliveredBy: '',
    pickedAt: '',
    packedAt: '',
    shippedAt: '',
    deliveredAt: '',
    deliveryNotes: createdBy ? `${createdBy} tarafından sevkiyat operasyonu oluşturuldu.` : '',
    deliveryResult: '',
    createdAt: now,
    updatedAt: now,
    items: buildItemsFromShipment(shipment, id)
  }
}

const normalizeExecutionItem = (
  item: RawShipmentExecutionItemRecord,
  executionId: string,
  index: number
): ShipmentExecutionItem => {
  const plannedQuantity = normalizeNonNegativeNumber(item.plannedQuantity)
  const deliveredQuantity = normalizeNonNegativeNumber(item.deliveredQuantity)

  return {
    id: normalizeText(item.id) || `shipment_execution_item_${executionId}_${index + 1}`,
    executionId: normalizeText(item.executionId) || executionId,
    shipmentItemId: normalizeText(item.shipmentItemId),
    plannedQuantity,
    pickedQuantity: normalizeNonNegativeNumber(item.pickedQuantity),
    packedQuantity: normalizeNonNegativeNumber(item.packedQuantity),
    shippedQuantity: normalizeNonNegativeNumber(item.shippedQuantity),
    deliveredQuantity,
    remainingQuantity: normalizeNonNegativeNumber(item.remainingQuantity) || roundQuantity(Math.max(0, plannedQuantity - deliveredQuantity)),
    status: normalizeItemStatus(item.status),
    notes: normalizeText(item.notes)
  }
}

const normalizeExecution = (
  item: RawShipmentExecutionRecord,
  index: number,
  shipmentMap: Map<string, ShipmentRecord>
): ShipmentExecutionRecord => {
  const createdAt = normalizeText(item.createdAt) || new Date().toISOString()
  const id = normalizeText(item.id) || `shipment_execution_${index + 1}`
  const shipmentId = normalizeText(item.shipmentId)
  const rawItems = Array.isArray(item.items) ? item.items.filter(isItemRecord) : []
  const status = normalizeStatus(item.status)
  const normalizedItems = rawItems.length > 0
    ? rawItems.map((record, itemIndex) => normalizeExecutionItem(record, id, itemIndex))
    : shipmentMap.get(shipmentId)
      ? buildItemsFromShipment(shipmentMap.get(shipmentId) as ShipmentRecord, id, status)
      : []

  return {
    id,
    shipmentId,
    executionNo: normalizeText(item.executionNo) || `${EXECUTION_NO_PREFIX}-${String(index + 1).padStart(EXECUTION_NO_PADDING, '0')}`,
    status,
    pickedBy: normalizeText(item.pickedBy),
    packedBy: normalizeText(item.packedBy),
    shippedBy: normalizeText(item.shippedBy),
    deliveredBy: normalizeText(item.deliveredBy),
    pickedAt: normalizeText(item.pickedAt),
    packedAt: normalizeText(item.packedAt),
    shippedAt: normalizeText(item.shippedAt),
    deliveredAt: normalizeText(item.deliveredAt),
    deliveryNotes: normalizeText(item.deliveryNotes),
    deliveryResult: normalizeDeliveryResult(item.deliveryResult),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    items: normalizedItems
  }
}

export const createShipmentExecutionMockData = (
  shipments: ShipmentRecord[]
): ShipmentExecutionRecord[] => {
  const today = getTodayKey()
  const statuses: ShipmentExecutionStatus[] = [
    'PENDING',
    'PICKING',
    'PACKING',
    'READY_TO_SHIP',
    'SHIPPED',
    'PARTIALLY_DELIVERED',
    'DELIVERED',
    'PENDING',
    'READY_TO_SHIP',
    'SHIPPED',
    'PARTIALLY_DELIVERED',
    'DELIVERED',
    'CANCELLED',
    'PACKING',
    'PICKING'
  ]

  return shipments.slice(0, SEED_EXECUTION_COUNT).map((shipment, index) => {
    const id = `shipment_execution_${index + 1}`
    const status = statuses[index % statuses.length]
    const createdAt = `${addDays(today, -index - 1)}T08:30:00.000Z`
    const items = buildItemsFromShipment(shipment, id, status)

    return {
      id,
      shipmentId: shipment.id,
      executionNo: `${EXECUTION_NO_PREFIX}-${String(index + 1).padStart(EXECUTION_NO_PADDING, '0')}`,
      status,
      pickedBy: ['PICKING', 'PACKING', 'READY_TO_SHIP', 'SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED'].includes(status) ? 'Depo Operatörü' : '',
      packedBy: ['PACKING', 'READY_TO_SHIP', 'SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED'].includes(status) ? 'Paketleme Ekibi' : '',
      shippedBy: ['SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED'].includes(status) ? 'Lojistik Ekibi' : '',
      deliveredBy: ['PARTIALLY_DELIVERED', 'DELIVERED'].includes(status) ? 'Teslim Alan' : '',
      pickedAt: ['PICKING', 'PACKING', 'READY_TO_SHIP', 'SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED'].includes(status) ? `${addDays(today, -index)}T09:00:00.000Z` : '',
      packedAt: ['PACKING', 'READY_TO_SHIP', 'SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED'].includes(status) ? `${addDays(today, -index)}T10:00:00.000Z` : '',
      shippedAt: ['SHIPPED', 'PARTIALLY_DELIVERED', 'DELIVERED'].includes(status) ? `${addDays(today, -index)}T12:00:00.000Z` : '',
      deliveredAt: ['PARTIALLY_DELIVERED', 'DELIVERED'].includes(status) ? `${addDays(today, -index)}T16:00:00.000Z` : '',
      deliveryNotes: status === 'PARTIALLY_DELIVERED' ? 'Sevkiyatın bir bölümü teslim edildi, kalan miktar bekliyor.' : '',
      deliveryResult: status === 'DELIVERED' ? 'SUCCESS' : status === 'PARTIALLY_DELIVERED' ? 'PARTIAL' : '',
      createdAt,
      updatedAt: createdAt,
      items
    }
  })
}

export const saveShipmentExecutionRecords = (records: ShipmentExecutionRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  const shipmentMap = new Map<string, ShipmentRecord>()
  const normalizedRecords = records.map((record, index) => normalizeExecution(record, index, shipmentMap))
  localStorage.setItem(SHIPMENT_EXECUTION_STORAGE_KEY, JSON.stringify(normalizedRecords))
}

export const loadShipmentExecutionRecords = (
  shipments: ShipmentRecord[]
) => {
  const shipmentMap = new Map(shipments.map(shipment => [shipment.id, shipment]))
  const seedRecords = createShipmentExecutionMockData(shipments)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(SHIPMENT_EXECUTION_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveShipmentExecutionRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeExecution(record, index, shipmentMap))

      saveShipmentExecutionRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveShipmentExecutionRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveShipmentExecutionRecords(seedRecords)
  return seedRecords
}
