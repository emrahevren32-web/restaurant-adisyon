import type { ShipmentWorkOrderRecord } from '../shipment-work-orders/shipment-work-order.types'
import type { StockUnit } from '../types'
import {
  calculateShipmentPalletGrossWeight,
  calculateShipmentPalletNetWeight,
  getWorkOrderItemPalletLimit
} from './shipment-pallet.service'
import type {
  ShipmentPalletItem,
  ShipmentPalletRecord,
  ShipmentPalletStatus
} from './shipment-pallet.types'

export const SHIPMENT_PALLET_STORAGE_KEY = 'ra_shipment_pallets'

export const SHIPMENT_PALLET_STATUSES: ShipmentPalletStatus[] = [
  'EMPTY',
  'BUILDING',
  'READY',
  'LOADED',
  'SHIPPED',
  'DELIVERED'
]

export const SHIPMENT_PALLET_STATUS_LABELS: Record<ShipmentPalletStatus, string> = {
  EMPTY: 'Boş',
  BUILDING: 'Hazırlanıyor',
  READY: 'Hazır',
  LOADED: 'Yüklendi',
  SHIPPED: 'Sevk Edildi',
  DELIVERED: 'Teslim Edildi'
}

type RawShipmentPalletRecord = Partial<Record<keyof ShipmentPalletRecord, unknown>> & Record<string, unknown>
type RawShipmentPalletItemRecord = Partial<Record<keyof ShipmentPalletItem, unknown>> & Record<string, unknown>

const DEFAULT_STATUS: ShipmentPalletStatus = 'BUILDING'
const DEFAULT_UNIT: StockUnit = 'adet'
const PALLET_NO_PREFIX = 'PLT'
const PALLET_NO_PADDING = 6
const PALLET_SEED_COUNT = 15
const MIN_PALLET_ITEM_COUNT = 2
const MAX_PALLET_ITEM_COUNT = 8
const QUANTITY_ROUNDING_FACTOR = 1000

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawShipmentPalletRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawShipmentPalletItemRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? roundQuantity(parsed) : fallback
}

const normalizeStatus = (value: unknown): ShipmentPalletStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_PALLET_STATUSES.includes(normalized as ShipmentPalletStatus)
    ? normalized as ShipmentPalletStatus
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

const getWorkOrderItemMap = (
  workOrders: ShipmentWorkOrderRecord[]
) => new Map(workOrders.flatMap(workOrder => (
  workOrder.items.map(item => [item.id, item] as const)
)))

export const getNextShipmentPalletNo = (
  records: Pick<ShipmentPalletRecord, 'palletNo'>[],
  offset = 0
) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.palletNo.match(new RegExp(`${PALLET_NO_PREFIX}-(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${PALLET_NO_PREFIX}-${String(maxNo + 1 + offset).padStart(PALLET_NO_PADDING, '0')}`
}

const normalizePalletItem = (
  item: RawShipmentPalletItemRecord,
  palletId: string,
  index: number,
  workOrderItemMap: ReturnType<typeof getWorkOrderItemMap>
): ShipmentPalletItem => {
  const workOrderItemId = normalizeText(item.workOrderItemId)
  const workOrderItem = workOrderItemMap.get(workOrderItemId)

  return {
    id: normalizeText(item.id) || `shipment_pallet_item_${palletId}_${index + 1}`,
    palletId: normalizeText(item.palletId) || palletId,
    workOrderItemId,
    stockItemId: normalizeText(item.stockItemId) || workOrderItem?.stockItemId || '',
    inventoryLotId: normalizeText(item.inventoryLotId) || workOrderItem?.inventoryLotId || '',
    quantity: normalizePositiveNumber(item.quantity),
    unit: normalizeUnit(item.unit, workOrderItem?.unit || DEFAULT_UNIT),
    notes: normalizeText(item.notes)
  }
}

const normalizePallet = (
  item: RawShipmentPalletRecord,
  index: number,
  workOrders: ShipmentWorkOrderRecord[]
): ShipmentPalletRecord => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const id = normalizeText(item.id) || `shipment_pallet_${index + 1}`
  const workOrderId = normalizeText(item.workOrderId)
  const workOrder = workOrders.find(record => record.id === workOrderId)
  const workOrderItemMap = getWorkOrderItemMap(workOrders)
  const rawItems = Array.isArray(item.items) ? item.items.filter(isItemRecord) : []
  const items = rawItems.map((record, itemIndex) => normalizePalletItem(record, id, itemIndex, workOrderItemMap))
  const netWeight = calculateShipmentPalletNetWeight(items)

  return {
    id,
    palletNo: normalizeText(item.palletNo) || `${PALLET_NO_PREFIX}-${String(index + 1).padStart(PALLET_NO_PADDING, '0')}`,
    workOrderId,
    warehouseId: normalizeText(item.warehouseId) || workOrder?.sourceWarehouseId || '',
    status: normalizeStatus(item.status),
    grossWeight: calculateShipmentPalletGrossWeight(netWeight, items.length > 0),
    netWeight,
    notes: normalizeText(item.notes),
    createdBy: normalizeText(item.createdBy) || 'Paletleme Ekibi',
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    items
  }
}

const getPalletableWorkOrders = (
  workOrders: ShipmentWorkOrderRecord[]
) => workOrders.filter(workOrder => (
  !['DRAFT', 'WAITING_APPROVAL', 'CANCELLED'].includes(workOrder.status)
  && workOrder.items.some(item => getWorkOrderItemPalletLimit(item) > 0)
))

const createSeedPalletItem = ({
  palletId,
  workOrderItem,
  quantity,
  palletIndex,
  itemIndex
}: {
  palletId: string
  workOrderItem: ShipmentWorkOrderRecord['items'][number]
  quantity: number
  palletIndex: number
  itemIndex: number
}): ShipmentPalletItem => ({
  id: `shipment_pallet_item_${palletIndex + 1}_${itemIndex + 1}`,
  palletId,
  workOrderItemId: workOrderItem.id,
  stockItemId: workOrderItem.stockItemId,
  inventoryLotId: workOrderItem.inventoryLotId,
  quantity,
  unit: workOrderItem.unit,
  notes: itemIndex % 3 === 0 ? 'Work Order Item palet dağıtımına alındı.' : ''
})

export const createShipmentPalletMockData = (
  workOrders: ShipmentWorkOrderRecord[]
): ShipmentPalletRecord[] => {
  const palletableWorkOrders = getPalletableWorkOrders(workOrders)
  if(palletableWorkOrders.length === 0) return []

  const statuses: ShipmentPalletStatus[] = [
    'BUILDING',
    'READY',
    'READY',
    'LOADED',
    'SHIPPED',
    'DELIVERED',
    'BUILDING',
    'READY',
    'LOADED',
    'SHIPPED'
  ]
  const allocatedByWorkOrderItem = new Map<string, number>()
  const records: ShipmentPalletRecord[] = []
  let attempts = 0

  while(records.length < PALLET_SEED_COUNT && attempts < PALLET_SEED_COUNT * 6){
    const index = records.length
    const workOrder = palletableWorkOrders[attempts % palletableWorkOrders.length]
    const candidateItems = workOrder.items.filter(item => {
      const limit = getWorkOrderItemPalletLimit(item)
      const allocatedQuantity = allocatedByWorkOrderItem.get(item.id) || 0
      return limit - allocatedQuantity > 0
    })

    if(candidateItems.length >= MIN_PALLET_ITEM_COUNT){
      const palletId = `shipment_pallet_${index + 1}`
      const itemCount = Math.min(
        MAX_PALLET_ITEM_COUNT,
        MIN_PALLET_ITEM_COUNT + (index % (MAX_PALLET_ITEM_COUNT - MIN_PALLET_ITEM_COUNT + 1)),
        candidateItems.length
      )
      const items = candidateItems.slice(0, itemCount).map((workOrderItem, itemIndex) => {
        const limit = getWorkOrderItemPalletLimit(workOrderItem)
        const allocatedQuantity = allocatedByWorkOrderItem.get(workOrderItem.id) || 0
        const remainingQuantity = Math.max(0, limit - allocatedQuantity)
        const ratio = 0.28 + ((index + itemIndex) % 4) * 0.12
        const quantity = roundQuantity(Math.max(Math.min(remainingQuantity, limit * ratio), 0.001))
        allocatedByWorkOrderItem.set(workOrderItem.id, roundQuantity(allocatedQuantity + quantity))
        return createSeedPalletItem({
          palletId,
          workOrderItem,
          quantity,
          palletIndex: index,
          itemIndex
        })
      })
      const netWeight = calculateShipmentPalletNetWeight(items)
      const createdAt = new Date(Date.now() - index * 86400000).toISOString()

      records.push({
        id: palletId,
        palletNo: `${PALLET_NO_PREFIX}-${String(index + 1).padStart(PALLET_NO_PADDING, '0')}`,
        workOrderId: workOrder.id,
        warehouseId: workOrder.sourceWarehouseId,
        status: statuses[index % statuses.length],
        netWeight,
        grossWeight: calculateShipmentPalletGrossWeight(netWeight, items.length > 0),
        notes: index % 4 === 0 ? 'Soğuk zincir sevkiyatına uygun palet düzeni oluşturuldu.' : '',
        createdBy: 'Paletleme Ekibi',
        createdAt,
        updatedAt: createdAt,
        items
      })
    }

    attempts += 1
  }

  return records
}

export const saveShipmentPalletRecords = (records: ShipmentPalletRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  const normalizedRecords = records.map((record, index) => normalizePallet(record, index, []))
  localStorage.setItem(SHIPMENT_PALLET_STORAGE_KEY, JSON.stringify(normalizedRecords))
}

export const loadShipmentPalletRecords = (
  workOrders: ShipmentWorkOrderRecord[]
) => {
  const seedRecords = createShipmentPalletMockData(workOrders)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(SHIPMENT_PALLET_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveShipmentPalletRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizePallet(record, index, workOrders))

      saveShipmentPalletRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveShipmentPalletRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveShipmentPalletRecords(seedRecords)
  return seedRecords
}
