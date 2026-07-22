import type { StockUnit } from '../types'
import {
  calculateShipmentReturnQuantity,
  createShipmentReturnDeliverySources,
  getShipmentReturnLineKey,
  type ShipmentReturnDeliveryLineSource,
  type ShipmentReturnDeliverySource,
  type ShipmentReturnDeliveryStopSource
} from './shipment-return.service'
import type {
  ShipmentReturnCondition,
  ShipmentReturnItem,
  ShipmentReturnRecord,
  ShipmentReturnStatus,
  ShipmentReturnType
} from './shipment-return.types'
import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'

export const SHIPMENT_RETURN_STORAGE_KEY = 'ra_shipment_returns'

export const SHIPMENT_RETURN_STATUSES: ShipmentReturnStatus[] = [
  'OPEN',
  'COLLECTED',
  'RECEIVED',
  'APPROVED',
  'REJECTED',
  'CLOSED'
]

export const SHIPMENT_RETURN_STATUS_LABELS: Record<ShipmentReturnStatus, string> = {
  OPEN: 'Açık',
  COLLECTED: 'Toplandı',
  RECEIVED: 'Teslim Alındı',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  CLOSED: 'Kapandı'
}

export const SHIPMENT_RETURN_TYPES: ShipmentReturnType[] = [
  'PRODUCT',
  'PALLET',
  'EQUIPMENT',
  'PACKAGE',
  'OTHER'
]

export const SHIPMENT_RETURN_TYPE_LABELS: Record<ShipmentReturnType, string> = {
  PRODUCT: 'Ürün',
  PALLET: 'Palet',
  EQUIPMENT: 'Ekipman',
  PACKAGE: 'Paket',
  OTHER: 'Diğer'
}

export const SHIPMENT_RETURN_CONDITIONS: ShipmentReturnCondition[] = [
  'GOOD',
  'DAMAGED',
  'EXPIRED',
  'BROKEN',
  'UNKNOWN'
]

export const SHIPMENT_RETURN_CONDITION_LABELS: Record<ShipmentReturnCondition, string> = {
  GOOD: 'İyi',
  DAMAGED: 'Hasarlı',
  EXPIRED: 'Süresi Dolmuş',
  BROKEN: 'Kırık',
  UNKNOWN: 'Bilinmiyor'
}

type RawShipmentReturnRecord = Partial<Record<keyof ShipmentReturnRecord, unknown>> & Record<string, unknown>
type RawShipmentReturnItemRecord = Partial<Record<keyof ShipmentReturnItem, unknown>> & Record<string, unknown>

const DEFAULT_STATUS: ShipmentReturnStatus = 'OPEN'
const DEFAULT_TYPE: ShipmentReturnType = 'PRODUCT'
const DEFAULT_CONDITION: ShipmentReturnCondition = 'UNKNOWN'
const DEFAULT_UNIT: StockUnit = 'adet'
const RETURN_NO_PREFIX = 'RTN'
const RETURN_NO_PADDING = 6
const RETURN_SEED_COUNT = 10
const MIN_RETURN_ITEM_COUNT = 2
const MAX_RETURN_ITEM_COUNT = 6
const QUANTITY_ROUNDING_FACTOR = 1000

const RETURN_REASONS = [
  'Şube kullanım fazlası',
  'Hasarlı teslim',
  'Yanlış ürün bildirimi',
  'Palet dönüşü',
  'Ekipman dönüşü',
  'Paketleme sorunu'
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawShipmentReturnRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawShipmentReturnItemRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? roundQuantity(parsed) : fallback
}

const normalizeStatus = (value: unknown): ShipmentReturnStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_RETURN_STATUSES.includes(normalized as ShipmentReturnStatus)
    ? normalized as ShipmentReturnStatus
    : DEFAULT_STATUS
}

const normalizeReturnType = (value: unknown): ShipmentReturnType => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_RETURN_TYPES.includes(normalized as ShipmentReturnType)
    ? normalized as ShipmentReturnType
    : DEFAULT_TYPE
}

const normalizeCondition = (value: unknown): ShipmentReturnCondition => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_RETURN_CONDITIONS.includes(normalized as ShipmentReturnCondition)
    ? normalized as ShipmentReturnCondition
    : DEFAULT_CONDITION
}

const normalizeUnit = (value: unknown, fallback: StockUnit = DEFAULT_UNIT): StockUnit => {
  const normalized = normalizeText(value)
  const units: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
  return units.includes(normalized as StockUnit) ? normalized as StockUnit : fallback
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

const getDeliveryMap = (
  deliveries: ShipmentReturnDeliverySource[]
) => new Map(deliveries.map(delivery => [delivery.id, delivery]))

const getDeliveryStopMap = (
  deliveryStops: ShipmentReturnDeliveryStopSource[]
) => new Map(deliveryStops.map(stop => [stop.id, stop]))

const getDeliveryLineForItem = (
  item: Pick<ShipmentReturnItem, 'deliveryStopId' | 'stockItemId' | 'inventoryLotId'>,
  deliveryLines: ShipmentReturnDeliveryLineSource[]
) => deliveryLines.find(line => (
  line.deliveryStopId === item.deliveryStopId
  && line.stockItemId === item.stockItemId
  && line.inventoryLotId === item.inventoryLotId
))

export const getNextShipmentReturnNo = (
  records: Pick<ShipmentReturnRecord, 'returnNo'>[],
  offset = 0
) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.returnNo.match(new RegExp(`${RETURN_NO_PREFIX}-(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${RETURN_NO_PREFIX}-${String(maxNo + 1 + offset).padStart(RETURN_NO_PADDING, '0')}`
}

const normalizeReturnItem = (
  item: RawShipmentReturnItemRecord,
  returnId: string,
  index: number,
  deliveryLines: ShipmentReturnDeliveryLineSource[]
): ShipmentReturnItem => {
  const candidate = {
    deliveryStopId: normalizeText(item.deliveryStopId),
    stockItemId: normalizeText(item.stockItemId),
    inventoryLotId: normalizeText(item.inventoryLotId)
  }
  const deliveryLine = getDeliveryLineForItem(candidate, deliveryLines)

  return {
    id: normalizeText(item.id) || `shipment_return_item_${returnId}_${index + 1}`,
    returnId: normalizeText(item.returnId) || returnId,
    deliveryStopId: candidate.deliveryStopId,
    stockItemId: candidate.stockItemId,
    inventoryLotId: candidate.inventoryLotId,
    returnType: normalizeReturnType(item.returnType),
    quantity: normalizePositiveNumber(item.quantity),
    unit: normalizeUnit(item.unit, deliveryLine?.unit || DEFAULT_UNIT),
    reason: normalizeText(item.reason),
    condition: normalizeCondition(item.condition),
    notes: normalizeText(item.notes)
  }
}

const createFallbackItems = (
  returnId: string,
  deliveryId: string,
  deliveryStops: ShipmentReturnDeliveryStopSource[],
  deliveryLines: ShipmentReturnDeliveryLineSource[]
) => {
  const stopIds = new Set(deliveryStops.filter(stop => stop.deliveryId === deliveryId).map(stop => stop.id))
  const lines = deliveryLines.filter(line => stopIds.has(line.deliveryStopId))
  const itemCount = Math.min(MIN_RETURN_ITEM_COUNT, lines.length)

  return lines.slice(0, itemCount).map((line, index): ShipmentReturnItem => ({
    id: `shipment_return_item_${returnId}_${index + 1}`,
    returnId,
    deliveryStopId: line.deliveryStopId,
    stockItemId: line.stockItemId,
    inventoryLotId: line.inventoryLotId,
    returnType: DEFAULT_TYPE,
    quantity: roundQuantity(Math.max(0.001, line.deliveredQuantity * 0.02)),
    unit: line.unit,
    reason: RETURN_REASONS[index % RETURN_REASONS.length],
    condition: index % 2 === 0 ? 'GOOD' : 'DAMAGED',
    notes: ''
  }))
}

const normalizeReturn = (
  item: RawShipmentReturnRecord,
  index: number,
  deliveries: ShipmentReturnDeliverySource[],
  deliveryStops: ShipmentReturnDeliveryStopSource[],
  deliveryLines: ShipmentReturnDeliveryLineSource[]
): ShipmentReturnRecord => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const id = normalizeText(item.id) || `shipment_return_${index + 1}`
  const deliveryId = normalizeText(item.deliveryId)
  const delivery = getDeliveryMap(deliveries).get(deliveryId)
  const rawItems = Array.isArray(item.items) ? item.items.filter(isItemRecord) : []
  const items = rawItems.length > 0
    ? rawItems.map((record, itemIndex) => normalizeReturnItem(record, id, itemIndex, deliveryLines))
    : createFallbackItems(id, deliveryId, deliveryStops, deliveryLines)

  return {
    id,
    returnNo: normalizeText(item.returnNo) || `${RETURN_NO_PREFIX}-${String(index + 1).padStart(RETURN_NO_PADDING, '0')}`,
    deliveryId,
    shipmentPlanId: normalizeText(item.shipmentPlanId) || delivery?.shipmentPlanId || '',
    vehicleId: normalizeText(item.vehicleId) || delivery?.vehicleId || '',
    returnDate: normalizeText(item.returnDate) || getTodayKey(),
    status: normalizeStatus(item.status),
    driverName: normalizeText(item.driverName) || delivery?.driverName || '',
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    items
  }
}

const createSeedReturnItem = ({
  returnId,
  line,
  quantity,
  returnIndex,
  itemIndex
}: {
  returnId: string
  line: ShipmentReturnDeliveryLineSource
  quantity: number
  returnIndex: number
  itemIndex: number
}): ShipmentReturnItem => ({
  id: `shipment_return_item_${returnIndex + 1}_${itemIndex + 1}`,
  returnId,
  deliveryStopId: line.deliveryStopId,
  stockItemId: line.stockItemId,
  inventoryLotId: line.inventoryLotId,
  returnType: SHIPMENT_RETURN_TYPES[(returnIndex + itemIndex) % SHIPMENT_RETURN_TYPES.length],
  quantity,
  unit: line.unit,
  reason: RETURN_REASONS[(returnIndex + itemIndex) % RETURN_REASONS.length],
  condition: SHIPMENT_RETURN_CONDITIONS[(returnIndex + itemIndex) % SHIPMENT_RETURN_CONDITIONS.length],
  notes: itemIndex % 3 === 0 ? 'Teslim noktası iade kaydına alındı.' : ''
})

export const createShipmentReturnMockData = (
  deliveries: ShipmentReturnDeliverySource[],
  deliveryStops: ShipmentReturnDeliveryStopSource[],
  deliveryLines: ShipmentReturnDeliveryLineSource[]
): ShipmentReturnRecord[] => {
  if(deliveries.length === 0 || deliveryLines.length === 0) return []

  const statuses: ShipmentReturnStatus[] = [
    'OPEN',
    'COLLECTED',
    'RECEIVED',
    'APPROVED',
    'REJECTED',
    'CLOSED'
  ]
  const returnedByLine = new Map<string, number>()
  const records: ShipmentReturnRecord[] = []
  let attempts = 0

  while(records.length < RETURN_SEED_COUNT && attempts < RETURN_SEED_COUNT * 8){
    const index = records.length
    const delivery = deliveries[attempts % deliveries.length]
    const stopIds = new Set(deliveryStops.filter(stop => stop.deliveryId === delivery.id).map(stop => stop.id))
    const lines = deliveryLines.filter(line => stopIds.has(line.deliveryStopId))
    if(lines.length === 0){
      attempts += 1
      continue
    }

    const itemCount = MIN_RETURN_ITEM_COUNT + (index % (MAX_RETURN_ITEM_COUNT - MIN_RETURN_ITEM_COUNT + 1))
    const returnId = `shipment_return_${index + 1}`
    const items: ShipmentReturnItem[] = []
    let itemAttempts = 0

    while(items.length < itemCount && itemAttempts < itemCount * Math.max(2, lines.length)){
      const line = lines[(index + itemAttempts) % lines.length]
      const lineKey = getShipmentReturnLineKey({
        deliveryStopId: line.deliveryStopId,
        stockItemId: line.stockItemId,
        inventoryLotId: line.inventoryLotId
      })
      const returnedQuantity = returnedByLine.get(lineKey) || 0
      const remainingQuantity = roundQuantity(line.deliveredQuantity - returnedQuantity)

      if(remainingQuantity > 0.001){
        const remainingSlots = itemCount - items.length
        const quantity = roundQuantity(Math.min(
          remainingQuantity,
          Math.max(0.001, remainingQuantity / (remainingSlots + 5))
        ))

        items.push(createSeedReturnItem({
          returnId,
          line,
          quantity,
          returnIndex: index,
          itemIndex: items.length
        }))
        returnedByLine.set(lineKey, roundQuantity(returnedQuantity + quantity))
      }

      itemAttempts += 1
    }

    if(items.length >= MIN_RETURN_ITEM_COUNT){
      const createdAt = new Date(Date.now() - index * 86400000).toISOString()
      records.push({
        id: returnId,
        returnNo: `${RETURN_NO_PREFIX}-${String(index + 1).padStart(RETURN_NO_PADDING, '0')}`,
        deliveryId: delivery.id,
        shipmentPlanId: delivery.shipmentPlanId,
        vehicleId: delivery.vehicleId,
        returnDate: addDays(getTodayKey(), -index),
        status: statuses[index % statuses.length],
        driverName: delivery.driverName,
        notes: index % 4 === 0 ? 'İade gerekçesi teslim noktası bazında kaydedildi.' : '',
        createdAt,
        updatedAt: createdAt,
        items
      })
    }

    attempts += 1
  }

  return records
}

export const saveShipmentReturnRecords = (
  records: ShipmentReturnRecord[],
  deliveries: ShipmentReturnDeliverySource[] = [],
  deliveryStops: ShipmentReturnDeliveryStopSource[] = [],
  deliveryLines: ShipmentReturnDeliveryLineSource[] = []
) => {
  if(!isBrowserStorageAvailable()) return
  const normalizedRecords = records.map((record, index) => normalizeReturn(
    record,
    index,
    deliveries,
    deliveryStops,
    deliveryLines
  ))
  localStorage.setItem(SHIPMENT_RETURN_STORAGE_KEY, JSON.stringify(normalizedRecords))
}

export const loadShipmentReturnRecords = (
  plans: ShipmentPlanRecord[],
  vehicles: ShipmentVehicleRecord[],
  pallets: ShipmentPalletRecord[]
) => {
  const { deliveries, stops, lines } = createShipmentReturnDeliverySources(plans, vehicles, pallets)
  const seedRecords = createShipmentReturnMockData(deliveries, stops, lines)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(SHIPMENT_RETURN_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveShipmentReturnRecords(seedRecords, deliveries, stops, lines)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeReturn(record, index, deliveries, stops, lines))

      saveShipmentReturnRecords(normalizedRecords, deliveries, stops, lines)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveShipmentReturnRecords(seedRecords, deliveries, stops, lines)
    return seedRecords
  }

  if(seedRecords.length > 0) saveShipmentReturnRecords(seedRecords, deliveries, stops, lines)
  return seedRecords
}

export const getShipmentReturnTotalQuantity = (
  record: ShipmentReturnRecord
) => calculateShipmentReturnQuantity(record.items)
