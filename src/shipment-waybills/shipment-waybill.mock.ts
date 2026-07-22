import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
import {
  createShipmentReturnDeliverySources,
  type ShipmentReturnDeliveryLineSource,
  type ShipmentReturnDeliverySource,
  type ShipmentReturnDeliveryStopSource
} from '../shipment-returns/shipment-return.service'
import type { ShipmentReturnItem, ShipmentReturnRecord } from '../shipment-returns/shipment-return.types'
import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import type { StockUnit } from '../types'
import {
  calculateShipmentWaybillQuantity,
  getShipmentWaybillDeliveryLine,
  getShipmentWaybillReturnItemMap
} from './shipment-waybill.service'
import type {
  ShipmentWaybillItem,
  ShipmentWaybillRecord,
  ShipmentWaybillStatus
} from './shipment-waybill.types'

export const SHIPMENT_WAYBILL_STORAGE_KEY = 'ra_shipment_waybills'

export const SHIPMENT_WAYBILL_STATUSES: ShipmentWaybillStatus[] = [
  'DRAFT',
  'ISSUED',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED'
]

export const SHIPMENT_WAYBILL_STATUS_LABELS: Record<ShipmentWaybillStatus, string> = {
  DRAFT: 'Taslak',
  ISSUED: 'Düzenlendi',
  IN_TRANSIT: 'Yolda',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal'
}

type RawShipmentWaybillRecord = Partial<Record<keyof ShipmentWaybillRecord, unknown>> & Record<string, unknown>
type RawShipmentWaybillItemRecord = Partial<Record<keyof ShipmentWaybillItem, unknown>> & Record<string, unknown>

const DEFAULT_STATUS: ShipmentWaybillStatus = 'DRAFT'
const DEFAULT_UNIT: StockUnit = 'adet'
const WAYBILL_NO_PREFIX = 'IRS'
const WAYBILL_NO_PADDING = 6
const WAYBILL_SEED_COUNT = 10
const MIN_WAYBILL_ITEM_COUNT = 3
const MAX_WAYBILL_ITEM_COUNT = 10
const QUANTITY_ROUNDING_FACTOR = 1000

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawShipmentWaybillRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawShipmentWaybillItemRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? roundQuantity(parsed) : fallback
}

const normalizeStatus = (value: unknown): ShipmentWaybillStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_WAYBILL_STATUSES.includes(normalized as ShipmentWaybillStatus)
    ? normalized as ShipmentWaybillStatus
    : DEFAULT_STATUS
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

const getPlanMap = (
  plans: ShipmentPlanRecord[]
) => new Map(plans.map(plan => [plan.id, plan]))

const getDeliveryMap = (
  deliveries: ShipmentReturnDeliverySource[]
) => new Map(deliveries.map(delivery => [delivery.id, delivery]))

const getReturnItemDeliveryId = (
  item: ShipmentReturnItem,
  deliveryStops: ShipmentReturnDeliveryStopSource[]
) => deliveryStops.find(stop => stop.id === item.deliveryStopId)?.deliveryId || ''

const getReturnItemsForDelivery = (
  deliveryId: string,
  returns: ShipmentReturnRecord[],
  deliveryStops: ShipmentReturnDeliveryStopSource[]
) => returns
  .filter(record => record.deliveryId === deliveryId)
  .flatMap(record => record.items)
  .filter(item => getReturnItemDeliveryId(item, deliveryStops) === deliveryId)

export const getNextShipmentWaybillNo = (
  records: Pick<ShipmentWaybillRecord, 'waybillNo'>[],
  offset = 0
) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.waybillNo.match(new RegExp(`${WAYBILL_NO_PREFIX}-(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${WAYBILL_NO_PREFIX}-${String(maxNo + 1 + offset).padStart(WAYBILL_NO_PADDING, '0')}`
}

const normalizeWaybillItem = (
  item: RawShipmentWaybillItemRecord,
  waybillId: string,
  index: number,
  deliveryLines: ShipmentReturnDeliveryLineSource[],
  returnItemMap: Map<string, ShipmentReturnItem>
): ShipmentWaybillItem => {
  const returnItemId = normalizeText(item.returnItemId)
  const returnItem = returnItemMap.get(returnItemId)
  const candidate = {
    deliveryStopId: normalizeText(item.deliveryStopId) || returnItem?.deliveryStopId || '',
    stockItemId: normalizeText(item.stockItemId) || returnItem?.stockItemId || '',
    inventoryLotId: normalizeText(item.inventoryLotId) || returnItem?.inventoryLotId || ''
  }
  const deliveryLine = getShipmentWaybillDeliveryLine(candidate, deliveryLines)

  return {
    id: normalizeText(item.id) || `shipment_waybill_item_${waybillId}_${index + 1}`,
    waybillId: normalizeText(item.waybillId) || waybillId,
    deliveryStopId: candidate.deliveryStopId,
    returnItemId,
    stockItemId: candidate.stockItemId,
    inventoryLotId: candidate.inventoryLotId,
    quantity: normalizePositiveNumber(item.quantity, returnItem?.quantity || deliveryLine?.deliveredQuantity || 1),
    unit: normalizeUnit(item.unit, returnItem?.unit || deliveryLine?.unit || DEFAULT_UNIT),
    notes: normalizeText(item.notes)
  }
}

const createFallbackItems = (
  waybillId: string,
  deliveryId: string,
  deliveryStops: ShipmentReturnDeliveryStopSource[],
  deliveryLines: ShipmentReturnDeliveryLineSource[],
  returns: ShipmentReturnRecord[]
) => {
  const stopIds = new Set(deliveryStops.filter(stop => stop.deliveryId === deliveryId).map(stop => stop.id))
  const lines = deliveryLines.filter(line => stopIds.has(line.deliveryStopId))
  const returnItems = getReturnItemsForDelivery(deliveryId, returns, deliveryStops)
  const itemCount = Math.min(MIN_WAYBILL_ITEM_COUNT, lines.length)

  return lines.slice(0, itemCount).map((line, index): ShipmentWaybillItem => {
    const returnItem = returnItems.find(item => (
      item.deliveryStopId === line.deliveryStopId
      && item.stockItemId === line.stockItemId
      && item.inventoryLotId === line.inventoryLotId
    ))

    return {
      id: `shipment_waybill_item_${waybillId}_${index + 1}`,
      waybillId,
      deliveryStopId: line.deliveryStopId,
      returnItemId: index % 3 === 0 ? returnItem?.id || '' : '',
      stockItemId: line.stockItemId,
      inventoryLotId: line.inventoryLotId,
      quantity: roundQuantity(Math.max(0.001, Math.min(line.deliveredQuantity, returnItem?.quantity || line.deliveredQuantity))),
      unit: line.unit,
      notes: returnItem ? 'Return Item referansı eklendi.' : ''
    }
  })
}

const normalizeWaybill = (
  item: RawShipmentWaybillRecord,
  index: number,
  plans: ShipmentPlanRecord[],
  deliveries: ShipmentReturnDeliverySource[],
  deliveryStops: ShipmentReturnDeliveryStopSource[],
  deliveryLines: ShipmentReturnDeliveryLineSource[],
  returns: ShipmentReturnRecord[]
): ShipmentWaybillRecord => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const id = normalizeText(item.id) || `shipment_waybill_${index + 1}`
  const shipmentPlanId = normalizeText(item.shipmentPlanId)
  const plan = getPlanMap(plans).get(shipmentPlanId)
  const delivery = normalizeText(item.deliveryId)
    ? getDeliveryMap(deliveries).get(normalizeText(item.deliveryId))
    : deliveries.find(record => record.shipmentPlanId === shipmentPlanId)
  const rawItems = Array.isArray(item.items) ? item.items.filter(isItemRecord) : []
  const returnItemMap = getShipmentWaybillReturnItemMap(returns)
  const items = rawItems.length > 0
    ? rawItems.map((record, itemIndex) => normalizeWaybillItem(record, id, itemIndex, deliveryLines, returnItemMap))
    : createFallbackItems(id, delivery?.id || '', deliveryStops, deliveryLines, returns)

  return {
    id,
    waybillNo: normalizeText(item.waybillNo) || `${WAYBILL_NO_PREFIX}-${String(index + 1).padStart(WAYBILL_NO_PADDING, '0')}`,
    shipmentPlanId,
    deliveryId: normalizeText(item.deliveryId) || delivery?.id || '',
    vehicleId: normalizeText(item.vehicleId) || delivery?.vehicleId || plan?.vehicleId || '',
    issueDate: normalizeText(item.issueDate) || getTodayKey(),
    status: normalizeStatus(item.status),
    driverName: normalizeText(item.driverName) || delivery?.driverName || plan?.driverName || '',
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    items
  }
}

const createSeedWaybillItem = ({
  waybillId,
  deliveryId,
  line,
  returnItems,
  index,
  itemIndex
}: {
  waybillId: string
  deliveryId: string
  line: ShipmentReturnDeliveryLineSource
  returnItems: ShipmentReturnItem[]
  index: number
  itemIndex: number
}): ShipmentWaybillItem => {
  const returnItem = itemIndex % 4 === 0
    ? returnItems.find(item => (
      item.deliveryStopId === line.deliveryStopId
      && item.stockItemId === line.stockItemId
      && item.inventoryLotId === line.inventoryLotId
    ))
    : null
  const quantity = returnItem
    ? returnItem.quantity
    : roundQuantity(Math.max(0.001, line.deliveredQuantity * (0.45 + ((index + itemIndex) % 5) * 0.08)))

  return {
    id: `shipment_waybill_item_${index + 1}_${itemIndex + 1}`,
    waybillId,
    deliveryStopId: line.deliveryStopId,
    returnItemId: returnItem?.id || '',
    stockItemId: line.stockItemId,
    inventoryLotId: line.inventoryLotId,
    quantity: roundQuantity(Math.min(quantity, line.deliveredQuantity)),
    unit: line.unit,
    notes: returnItem ? `Return bağlantısı ${deliveryId} üzerinden kuruldu.` : ''
  }
}

export const createShipmentWaybillMockData = (
  deliveries: ShipmentReturnDeliverySource[],
  deliveryStops: ShipmentReturnDeliveryStopSource[],
  deliveryLines: ShipmentReturnDeliveryLineSource[],
  returns: ShipmentReturnRecord[]
): ShipmentWaybillRecord[] => {
  const eligibleDeliveries = deliveries.filter(delivery => {
    const stopIds = new Set(deliveryStops.filter(stop => stop.deliveryId === delivery.id).map(stop => stop.id))
    return deliveryLines.some(line => stopIds.has(line.deliveryStopId))
  })

  if(eligibleDeliveries.length === 0 || deliveryLines.length === 0) return []

  const statuses: ShipmentWaybillStatus[] = [
    'DRAFT',
    'ISSUED',
    'IN_TRANSIT',
    'DELIVERED',
    'CANCELLED'
  ]

  return Array.from({ length: WAYBILL_SEED_COUNT }, (_, index) => {
    const delivery = eligibleDeliveries[index % eligibleDeliveries.length]
    const stopIds = new Set(deliveryStops.filter(stop => stop.deliveryId === delivery.id).map(stop => stop.id))
    const lines = deliveryLines.filter(line => stopIds.has(line.deliveryStopId))
    const returnItems = getReturnItemsForDelivery(delivery.id, returns, deliveryStops)
    const itemCount = MIN_WAYBILL_ITEM_COUNT + (index % (MAX_WAYBILL_ITEM_COUNT - MIN_WAYBILL_ITEM_COUNT + 1))
    const waybillId = `shipment_waybill_${index + 1}`
    const items = Array.from({ length: itemCount }, (_, itemIndex) => (
      createSeedWaybillItem({
        waybillId,
        deliveryId: delivery.id,
        line: lines[itemIndex % lines.length],
        returnItems,
        index,
        itemIndex
      })
    ))
    const createdAt = new Date(Date.now() - index * 86400000).toISOString()

    return {
      id: waybillId,
      waybillNo: `${WAYBILL_NO_PREFIX}-${String(index + 1).padStart(WAYBILL_NO_PADDING, '0')}`,
      shipmentPlanId: delivery.shipmentPlanId,
      deliveryId: delivery.id,
      vehicleId: delivery.vehicleId,
      issueDate: addDays(getTodayKey(), -index),
      status: statuses[index % statuses.length],
      driverName: delivery.driverName,
      notes: index % 4 === 0 ? 'Teslim ve return referansları resmi irsaliye satırlarına bağlandı.' : '',
      createdAt,
      updatedAt: createdAt,
      items
    }
  })
}

export const saveShipmentWaybillRecords = (
  records: ShipmentWaybillRecord[],
  plans: ShipmentPlanRecord[] = [],
  deliveries: ShipmentReturnDeliverySource[] = [],
  deliveryStops: ShipmentReturnDeliveryStopSource[] = [],
  deliveryLines: ShipmentReturnDeliveryLineSource[] = [],
  returns: ShipmentReturnRecord[] = []
) => {
  if(!isBrowserStorageAvailable()) return
  const normalizedRecords = records.map((record, index) => normalizeWaybill(
    record,
    index,
    plans,
    deliveries,
    deliveryStops,
    deliveryLines,
    returns
  ))
  localStorage.setItem(SHIPMENT_WAYBILL_STORAGE_KEY, JSON.stringify(normalizedRecords))
}

export const loadShipmentWaybillRecords = (
  plans: ShipmentPlanRecord[],
  vehicles: ShipmentVehicleRecord[],
  pallets: ShipmentPalletRecord[],
  returns: ShipmentReturnRecord[]
) => {
  const { deliveries, stops, lines } = createShipmentReturnDeliverySources(plans, vehicles, pallets)
  const seedRecords = createShipmentWaybillMockData(deliveries, stops, lines, returns)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(SHIPMENT_WAYBILL_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveShipmentWaybillRecords(seedRecords, plans, deliveries, stops, lines, returns)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeWaybill(record, index, plans, deliveries, stops, lines, returns))

      saveShipmentWaybillRecords(normalizedRecords, plans, deliveries, stops, lines, returns)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveShipmentWaybillRecords(seedRecords, plans, deliveries, stops, lines, returns)
    return seedRecords
  }

  if(seedRecords.length > 0) saveShipmentWaybillRecords(seedRecords, plans, deliveries, stops, lines, returns)
  return seedRecords
}

export const getShipmentWaybillTotalQuantity = (
  record: ShipmentWaybillRecord
) => calculateShipmentWaybillQuantity(record.items)
