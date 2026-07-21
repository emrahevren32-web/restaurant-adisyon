import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { Branch, StockUnit } from '../types'
import type {
  ShipmentItem,
  ShipmentPriority,
  ShipmentRecord,
  ShipmentStatus
} from './shipment.types'

export const SHIPMENT_STORAGE_KEY = 'ra_shipments'

export const SHIPMENT_STATUSES: ShipmentStatus[] = [
  'DRAFT',
  'PLANNED',
  'PICKING',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED'
]

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  DRAFT: 'Taslak',
  PLANNED: 'Planlandı',
  PICKING: 'Toplanıyor',
  READY: 'Hazır',
  SHIPPED: 'Sevk Edildi',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'İptal'
}

export const SHIPMENT_PRIORITIES: ShipmentPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const SHIPMENT_PRIORITY_LABELS: Record<ShipmentPriority, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  URGENT: 'Acil'
}

type RawShipmentRecord = Partial<Record<keyof ShipmentRecord, unknown>> & Record<string, unknown>
type RawShipmentItemRecord = Partial<Record<keyof ShipmentItem, unknown>> & Record<string, unknown>

const DEFAULT_STATUS: ShipmentStatus = 'DRAFT'
const DEFAULT_PRIORITY: ShipmentPriority = 'NORMAL'
const DEFAULT_UNIT: StockUnit = 'adet'
const SHIPMENT_NO_PREFIX = 'SHP'
const SHIPMENT_NO_PADDING = 6
const SHIPMENT_SEED_COUNT = 15
const MIN_SHIPMENT_ITEM_COUNT = 2
const MAX_SHIPMENT_ITEM_COUNT = 8
const QUANTITY_ROUNDING_FACTOR = 1000

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawShipmentRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawShipmentItemRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? roundQuantity(parsed) : fallback
}

const normalizeDateText = (value: unknown, fallback: string) => {
  const normalized = normalizeText(value)
  return normalized || fallback
}

const normalizeStatus = (value: unknown): ShipmentStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_STATUSES.includes(normalized as ShipmentStatus)
    ? normalized as ShipmentStatus
    : DEFAULT_STATUS
}

const normalizePriority = (value: unknown): ShipmentPriority => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_PRIORITIES.includes(normalized as ShipmentPriority)
    ? normalized as ShipmentPriority
    : DEFAULT_PRIORITY
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

const getLotFallbackUnit = (
  inventoryLotId: string,
  inventoryLotMap: Map<string, InventoryLot>
) => inventoryLotMap.get(inventoryLotId)?.unit || DEFAULT_UNIT

const getLotFallbackStockItemId = (
  inventoryLotId: string,
  inventoryLotMap: Map<string, InventoryLot>
) => inventoryLotMap.get(inventoryLotId)?.stockItemId || ''

export const getNextShipmentNo = (records: Pick<ShipmentRecord, 'shipmentNo'>[], offset = 0) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.shipmentNo.match(new RegExp(`${SHIPMENT_NO_PREFIX}-(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${SHIPMENT_NO_PREFIX}-${String(maxNo + 1 + offset).padStart(SHIPMENT_NO_PADDING, '0')}`
}

const normalizeShipmentItem = (
  item: RawShipmentItemRecord,
  shipmentId: string,
  index: number,
  inventoryLotMap: Map<string, InventoryLot>
): ShipmentItem => {
  const inventoryLotId = normalizeText(item.inventoryLotId)
  const fallbackUnit = getLotFallbackUnit(inventoryLotId, inventoryLotMap)

  return {
    id: normalizeText(item.id) || `shipment_item_${shipmentId}_${index}`,
    shipmentId: normalizeText(item.shipmentId) || shipmentId,
    inventoryLotId,
    stockItemId: normalizeText(item.stockItemId) || getLotFallbackStockItemId(inventoryLotId, inventoryLotMap),
    quantity: normalizePositiveNumber(item.quantity),
    unit: normalizeUnit(item.unit, fallbackUnit),
    notes: normalizeText(item.notes)
  }
}

const normalizeShipment = (
  item: RawShipmentRecord,
  index: number,
  inventoryLotMap: Map<string, InventoryLot>
): ShipmentRecord => {
  const createdAt = normalizeText(item.createdAt) || new Date().toISOString()
  const today = getTodayKey()
  const id = normalizeText(item.id) || `shipment_${index + 1}`
  const rawItems = Array.isArray(item.items) ? item.items.filter(isItemRecord) : []
  const normalizedItems = rawItems.map((record, itemIndex) => normalizeShipmentItem(record, id, itemIndex, inventoryLotMap))
  const firstItemLot = inventoryLotMap.get(normalizedItems[0]?.inventoryLotId || '')

  return {
    id,
    shipmentNo: normalizeText(item.shipmentNo) || `${SHIPMENT_NO_PREFIX}-${String(index + 1).padStart(SHIPMENT_NO_PADDING, '0')}`,
    shipmentDate: normalizeDateText(item.shipmentDate, today),
    plannedDeliveryDate: normalizeDateText(item.plannedDeliveryDate, addDays(today, 1)),
    sourceWarehouseId: normalizeText(item.sourceWarehouseId) || firstItemLot?.warehouseId || '',
    destinationBranchId: normalizeText(item.destinationBranchId),
    destinationWarehouseId: normalizeText(item.destinationWarehouseId),
    status: normalizeStatus(item.status),
    priority: normalizePriority(item.priority),
    notes: normalizeText(item.notes),
    createdBy: normalizeText(item.createdBy) || 'Lojistik Planlama',
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    items: normalizedItems
  }
}

const getSeedLots = (inventoryLots: InventoryLot[]) => {
  const activeLots = inventoryLots.filter(lot => lot.remainingQuantity > 0 && lot.status === 'ACTIVE')
  const availableLots = activeLots.length > 0
    ? activeLots
    : inventoryLots.filter(lot => lot.remainingQuantity > 0)

  return availableLots.length > 0 ? availableLots : inventoryLots
}

const createSeedShipmentItem = (
  shipmentId: string,
  lot: InventoryLot,
  shipmentIndex: number,
  itemIndex: number
): ShipmentItem => {
  const baseQuantity = lot.remainingQuantity > 0 ? lot.remainingQuantity : lot.receivedQuantity
  const ratio = 0.08 + ((shipmentIndex + itemIndex) % 5) * 0.04
  const quantity = roundQuantity(Math.max(Math.min(baseQuantity * ratio, baseQuantity || 1), 0.001))

  return {
    id: `shipment_item_${shipmentIndex + 1}_${itemIndex + 1}`,
    shipmentId,
    inventoryLotId: lot.id,
    stockItemId: lot.stockItemId,
    quantity,
    unit: lot.unit,
    notes: itemIndex % 3 === 0 ? 'FEFO kontrolü ile sevk planına alındı.' : ''
  }
}

export const createShipmentMockData = (
  inventoryLots: InventoryLot[],
  branches: Branch[] = []
): ShipmentRecord[] => {
  const seedLots = getSeedLots(inventoryLots)
  if(seedLots.length === 0) return []

  const today = getTodayKey()
  const statuses: ShipmentStatus[] = [
    'DRAFT',
    'PLANNED',
    'PICKING',
    'READY',
    'SHIPPED',
    'DELIVERED',
    'PLANNED',
    'READY',
    'SHIPPED',
    'CANCELLED'
  ]
  const priorities: ShipmentPriority[] = ['NORMAL', 'HIGH', 'LOW', 'URGENT']

  return Array.from({ length: SHIPMENT_SEED_COUNT }, (_, index) => {
    const shipmentId = `shipment_${index + 1}`
    const itemCount = Math.min(
      MAX_SHIPMENT_ITEM_COUNT,
      MIN_SHIPMENT_ITEM_COUNT + (index % (MAX_SHIPMENT_ITEM_COUNT - MIN_SHIPMENT_ITEM_COUNT + 1))
    )
    const firstLot = seedLots[index % seedLots.length]
    const sourceWarehouseId = firstLot.warehouseId
    const sourceIndex = branches.findIndex(branch => branch.id === sourceWarehouseId)
    const branchFallbackIndex = sourceIndex >= 0 ? sourceIndex + 1 : index + 1
    const destinationBranch = branches[branchFallbackIndex % Math.max(branches.length, 1)]
    const destinationWarehouse = branches[(branchFallbackIndex + 1) % Math.max(branches.length, 1)]
    const sourceLots = seedLots.filter(lot => lot.warehouseId === sourceWarehouseId)
    const itemSourceLots = sourceLots.length > 0 ? sourceLots : seedLots
    const createdAt = addDays(today, -index - 2)

    return {
      id: shipmentId,
      shipmentNo: `${SHIPMENT_NO_PREFIX}-${String(index + 1).padStart(SHIPMENT_NO_PADDING, '0')}`,
      shipmentDate: addDays(today, -index),
      plannedDeliveryDate: addDays(today, 1 + (index % 5)),
      sourceWarehouseId,
      destinationBranchId: destinationBranch?.id || '',
      destinationWarehouseId: index % 2 === 0 ? destinationWarehouse?.id || '' : '',
      status: statuses[index % statuses.length],
      priority: priorities[index % priorities.length],
      notes: index % 4 === 0 ? 'Merkez üretim çıkışı planlı sevkiyat.' : 'Şube ihtiyaç planına göre oluşturuldu.',
      createdBy: 'Lojistik Planlama',
      createdAt: `${createdAt}T09:00:00.000Z`,
      updatedAt: `${createdAt}T09:00:00.000Z`,
      items: Array.from({ length: itemCount }, (_, itemIndex) => {
        const lot = itemSourceLots[(index + itemIndex) % itemSourceLots.length]
        return createSeedShipmentItem(shipmentId, lot, index, itemIndex)
      })
    }
  })
}

export const saveShipmentRecords = (records: ShipmentRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  const inventoryLotMap = new Map<string, InventoryLot>()
  const normalizedRecords = records.map((record, index) => normalizeShipment(record, index, inventoryLotMap))
  localStorage.setItem(SHIPMENT_STORAGE_KEY, JSON.stringify(normalizedRecords))
}

export const loadShipmentRecords = (
  inventoryLots: InventoryLot[],
  branches: Branch[] = []
) => {
  const inventoryLotMap = new Map(inventoryLots.map(lot => [lot.id, lot]))
  const seedRecords = createShipmentMockData(inventoryLots, branches)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(SHIPMENT_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveShipmentRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeShipment(record, index, inventoryLotMap))

      saveShipmentRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveShipmentRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveShipmentRecords(seedRecords)
  return seedRecords
}
