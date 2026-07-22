import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { ShipmentRecord } from '../shipments/shipment.types'
import type { Branch, StockUnit } from '../types'
import type {
  ShipmentWorkOrderItem,
  ShipmentWorkOrderPriority,
  ShipmentWorkOrderRecord,
  ShipmentWorkOrderStatus
} from './shipment-work-order.types'

export const SHIPMENT_WORK_ORDER_STORAGE_KEY = 'ra_shipment_work_orders'

export const SHIPMENT_WORK_ORDER_PRIORITIES: ShipmentWorkOrderPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const SHIPMENT_WORK_ORDER_PRIORITY_LABELS: Record<ShipmentWorkOrderPriority, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  URGENT: 'Acil'
}

export const SHIPMENT_WORK_ORDER_STATUSES: ShipmentWorkOrderStatus[] = [
  'DRAFT',
  'WAITING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'READY_FOR_PICKING',
  'COMPLETED',
  'CANCELLED'
]

export const SHIPMENT_WORK_ORDER_STATUS_LABELS: Record<ShipmentWorkOrderStatus, string> = {
  DRAFT: 'Taslak',
  WAITING_APPROVAL: 'Onay Bekliyor',
  APPROVED: 'Onaylandı',
  IN_PROGRESS: 'İşlemde',
  READY_FOR_PICKING: 'Toplamaya Hazır',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal'
}

type RawShipmentWorkOrderRecord = Partial<Record<keyof ShipmentWorkOrderRecord, unknown>> & Record<string, unknown>
type RawShipmentWorkOrderItemRecord = Partial<Record<keyof ShipmentWorkOrderItem, unknown>> & Record<string, unknown>

const DEFAULT_PRIORITY: ShipmentWorkOrderPriority = 'NORMAL'
const DEFAULT_STATUS: ShipmentWorkOrderStatus = 'DRAFT'
const DEFAULT_UNIT: StockUnit = 'adet'
const WORK_ORDER_NO_PREFIX = 'WO'
const WORK_ORDER_NO_PADDING = 6
const WORK_ORDER_SEED_COUNT = 15
const MIN_WORK_ORDER_ITEM_COUNT = 3
const MAX_WORK_ORDER_ITEM_COUNT = 10
const QUANTITY_ROUNDING_FACTOR = 1000

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawShipmentWorkOrderRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawShipmentWorkOrderItemRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeStringArray = (value: unknown) => (
  Array.isArray(value)
    ? value.map(item => normalizeText(item)).filter(Boolean)
    : []
)

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? roundQuantity(parsed) : 0
}

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? roundQuantity(parsed) : fallback
}

const normalizePriority = (value: unknown): ShipmentWorkOrderPriority => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_WORK_ORDER_PRIORITIES.includes(normalized as ShipmentWorkOrderPriority)
    ? normalized as ShipmentWorkOrderPriority
    : DEFAULT_PRIORITY
}

const normalizeStatus = (value: unknown): ShipmentWorkOrderStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_WORK_ORDER_STATUSES.includes(normalized as ShipmentWorkOrderStatus)
    ? normalized as ShipmentWorkOrderStatus
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

const getLotFallbackUnit = (
  inventoryLotId: string,
  inventoryLotMap: Map<string, InventoryLot>
) => inventoryLotMap.get(inventoryLotId)?.unit || DEFAULT_UNIT

const getLotFallbackStockItemId = (
  inventoryLotId: string,
  inventoryLotMap: Map<string, InventoryLot>
) => inventoryLotMap.get(inventoryLotId)?.stockItemId || ''

export const getNextShipmentWorkOrderNo = (
  records: Pick<ShipmentWorkOrderRecord, 'workOrderNo'>[],
  offset = 0
) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.workOrderNo.match(new RegExp(`${WORK_ORDER_NO_PREFIX}-(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${WORK_ORDER_NO_PREFIX}-${String(maxNo + 1 + offset).padStart(WORK_ORDER_NO_PADDING, '0')}`
}

const normalizeWorkOrderItem = (
  item: RawShipmentWorkOrderItemRecord,
  workOrderId: string,
  index: number,
  inventoryLotMap: Map<string, InventoryLot>
): ShipmentWorkOrderItem => {
  const inventoryLotId = normalizeText(item.inventoryLotId)
  const requestedQuantity = normalizePositiveNumber(item.requestedQuantity)
  const approvedQuantity = Math.min(requestedQuantity, normalizeNonNegativeNumber(item.approvedQuantity))
  const pickedQuantity = Math.min(approvedQuantity, normalizeNonNegativeNumber(item.pickedQuantity))

  return {
    id: normalizeText(item.id) || `shipment_work_order_item_${workOrderId}_${index + 1}`,
    workOrderId: normalizeText(item.workOrderId) || workOrderId,
    stockItemId: normalizeText(item.stockItemId) || getLotFallbackStockItemId(inventoryLotId, inventoryLotMap),
    inventoryLotId,
    requestedQuantity,
    approvedQuantity,
    pickedQuantity,
    unit: normalizeUnit(item.unit, getLotFallbackUnit(inventoryLotId, inventoryLotMap)),
    notes: normalizeText(item.notes)
  }
}

const normalizeWorkOrder = (
  item: RawShipmentWorkOrderRecord,
  index: number,
  inventoryLotMap: Map<string, InventoryLot>
): ShipmentWorkOrderRecord => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const today = getTodayKey()
  const id = normalizeText(item.id) || `shipment_work_order_${index + 1}`
  const rawItems = Array.isArray(item.items) ? item.items.filter(isItemRecord) : []

  return {
    id,
    workOrderNo: normalizeText(item.workOrderNo) || `${WORK_ORDER_NO_PREFIX}-${String(index + 1).padStart(WORK_ORDER_NO_PADDING, '0')}`,
    title: normalizeText(item.title) || `Sevkiyat İş Emri ${index + 1}`,
    description: normalizeText(item.description),
    requestDate: normalizeText(item.requestDate) || today,
    plannedShipmentDate: normalizeText(item.plannedShipmentDate) || addDays(today, 1),
    priority: normalizePriority(item.priority),
    status: normalizeStatus(item.status),
    sourceWarehouseId: normalizeText(item.sourceWarehouseId),
    destinationBranchId: normalizeText(item.destinationBranchId),
    shipmentIds: normalizeStringArray(item.shipmentIds),
    createdBy: normalizeText(item.createdBy) || 'Lojistik Planlama',
    approvedBy: normalizeText(item.approvedBy),
    approvedAt: normalizeText(item.approvedAt),
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    items: rawItems.map((record, itemIndex) => normalizeWorkOrderItem(record, id, itemIndex, inventoryLotMap))
  }
}

const getSeedLots = (inventoryLots: InventoryLot[]) => {
  const activeLots = inventoryLots.filter(lot => lot.remainingQuantity > 0 && lot.status === 'ACTIVE')
  const availableLots = activeLots.length > 0
    ? activeLots
    : inventoryLots.filter(lot => lot.remainingQuantity > 0)

  return availableLots.length > 0 ? availableLots : inventoryLots
}

const getDestinationBranch = (
  branches: Branch[],
  sourceWarehouseId: string,
  seedIndex: number
) => (
  branches.find(branch => branch.id !== sourceWarehouseId && branch.isActive)
  || branches.find(branch => branch.id !== sourceWarehouseId)
  || branches[seedIndex % Math.max(branches.length, 1)]
)

const getLinkedShipmentIds = (
  shipments: ShipmentRecord[],
  sourceWarehouseId: string,
  destinationBranchId: string,
  seedIndex: number,
  status: ShipmentWorkOrderStatus
) => {
  if(status === 'DRAFT' || status === 'WAITING_APPROVAL' || status === 'CANCELLED') return []

  const compatibleShipments = shipments.filter(shipment => (
    shipment.sourceWarehouseId === sourceWarehouseId
    && shipment.destinationBranchId === destinationBranchId
  ))
  if(compatibleShipments.length === 0) return []

  const linkCount = status === 'COMPLETED' || status === 'IN_PROGRESS' ? 2 : 1
  const startIndex = seedIndex % compatibleShipments.length
  const orderedShipments = [
    ...compatibleShipments.slice(startIndex),
    ...compatibleShipments.slice(0, startIndex)
  ]

  return orderedShipments
    .slice(0, linkCount)
    .map(shipment => shipment.id)
}

const createSeedWorkOrderItem = (
  workOrderId: string,
  lot: InventoryLot,
  workOrderIndex: number,
  itemIndex: number,
  status: ShipmentWorkOrderStatus
): ShipmentWorkOrderItem => {
  const baseQuantity = lot.remainingQuantity > 0 ? lot.remainingQuantity : lot.receivedQuantity
  const ratio = 0.04 + ((workOrderIndex + itemIndex) % 6) * 0.03
  const requestedQuantity = roundQuantity(Math.max(Math.min(baseQuantity * ratio, baseQuantity || 1), 0.001))
  const approvedRatio = status === 'DRAFT' ? 0 : status === 'WAITING_APPROVAL' ? 0.9 : itemIndex % 4 === 0 ? 0.75 : 1
  const approvedQuantity = roundQuantity(Math.min(requestedQuantity, requestedQuantity * approvedRatio))
  const pickedQuantity = status === 'COMPLETED'
    ? approvedQuantity
    : status === 'IN_PROGRESS'
      ? roundQuantity(approvedQuantity * (0.35 + (itemIndex % 3) * 0.2))
      : 0

  return {
    id: `shipment_work_order_item_${workOrderIndex + 1}_${itemIndex + 1}`,
    workOrderId,
    stockItemId: lot.stockItemId,
    inventoryLotId: lot.id,
    requestedQuantity,
    approvedQuantity,
    pickedQuantity: Math.min(approvedQuantity, pickedQuantity),
    unit: lot.unit,
    notes: itemIndex % 3 === 0 ? 'Lot FEFO kontrolü ile iş emrine alındı.' : ''
  }
}

export const createShipmentWorkOrderMockData = (
  inventoryLots: InventoryLot[],
  branches: Branch[] = [],
  shipments: ShipmentRecord[] = []
): ShipmentWorkOrderRecord[] => {
  const seedLots = getSeedLots(inventoryLots)
  if(seedLots.length === 0) return []

  const today = getTodayKey()
  const statuses: ShipmentWorkOrderStatus[] = [
    'DRAFT',
    'WAITING_APPROVAL',
    'APPROVED',
    'READY_FOR_PICKING',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'APPROVED',
    'IN_PROGRESS',
    'COMPLETED',
    'WAITING_APPROVAL',
    'READY_FOR_PICKING',
    'DRAFT',
    'COMPLETED',
    'APPROVED'
  ]
  const priorities: ShipmentWorkOrderPriority[] = ['NORMAL', 'HIGH', 'LOW', 'URGENT']

  return Array.from({ length: WORK_ORDER_SEED_COUNT }, (_, index) => {
    const workOrderId = `shipment_work_order_${index + 1}`
    const firstLot = seedLots[index % seedLots.length]
    const sourceWarehouseId = firstLot.warehouseId
    const compatibleShipment = shipments.find(shipment => (
      shipment.sourceWarehouseId === sourceWarehouseId
      && Boolean(shipment.destinationBranchId)
    ))
    const destinationBranch = compatibleShipment
      ? branches.find(branch => branch.id === compatibleShipment.destinationBranchId)
      : getDestinationBranch(branches, sourceWarehouseId, index)
    const destinationBranchId = compatibleShipment?.destinationBranchId || destinationBranch?.id || ''
    const sourceLots = seedLots.filter(lot => lot.warehouseId === sourceWarehouseId)
    const itemSourceLots = sourceLots.length > 0 ? sourceLots : seedLots
    const itemCount = Math.min(
      MAX_WORK_ORDER_ITEM_COUNT,
      MIN_WORK_ORDER_ITEM_COUNT + (index % (MAX_WORK_ORDER_ITEM_COUNT - MIN_WORK_ORDER_ITEM_COUNT + 1))
    )
    const status = statuses[index % statuses.length]
    const createdAtDate = addDays(today, -index - 1)
    const approvedAt = ['APPROVED', 'READY_FOR_PICKING', 'IN_PROGRESS', 'COMPLETED'].includes(status)
      ? `${createdAtDate}T11:30:00.000Z`
      : ''

    return {
      id: workOrderId,
      workOrderNo: `${WORK_ORDER_NO_PREFIX}-${String(index + 1).padStart(WORK_ORDER_NO_PADDING, '0')}`,
      title: `${destinationBranch?.name || 'Şube'} sevkiyat hazırlığı`,
      description: 'Şube talebinin lot bazlı lojistik iş emrine dönüştürülmesi.',
      requestDate: addDays(today, -index),
      plannedShipmentDate: addDays(today, 1 + (index % 6)),
      priority: priorities[index % priorities.length],
      status,
      sourceWarehouseId,
      destinationBranchId,
      shipmentIds: getLinkedShipmentIds(shipments, sourceWarehouseId, destinationBranchId, index, status),
      createdBy: 'Lojistik Planlama',
      approvedBy: approvedAt ? 'Operasyon Müdürü' : '',
      approvedAt,
      notes: status === 'CANCELLED'
        ? 'Şube planı değiştiği için iş emri iptal edildi.'
        : status === 'COMPLETED'
          ? 'Toplama hazırlığı tamamlandı.'
          : '',
      createdAt: `${createdAtDate}T09:00:00.000Z`,
      updatedAt: `${createdAtDate}T12:00:00.000Z`,
      items: Array.from({ length: itemCount }, (_, itemIndex) => {
        const lot = itemSourceLots[(index + itemIndex) % itemSourceLots.length]
        return createSeedWorkOrderItem(workOrderId, lot, index, itemIndex, status)
      })
    }
  })
}

export const saveShipmentWorkOrderRecords = (records: ShipmentWorkOrderRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  const inventoryLotMap = new Map<string, InventoryLot>()
  const normalizedRecords = records.map((record, index) => normalizeWorkOrder(record, index, inventoryLotMap))
  localStorage.setItem(SHIPMENT_WORK_ORDER_STORAGE_KEY, JSON.stringify(normalizedRecords))
}

export const loadShipmentWorkOrderRecords = (
  inventoryLots: InventoryLot[],
  branches: Branch[] = [],
  shipments: ShipmentRecord[] = []
) => {
  const inventoryLotMap = new Map(inventoryLots.map(lot => [lot.id, lot]))
  const seedRecords = createShipmentWorkOrderMockData(inventoryLots, branches, shipments)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(SHIPMENT_WORK_ORDER_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveShipmentWorkOrderRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeWorkOrder(record, index, inventoryLotMap))

      saveShipmentWorkOrderRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveShipmentWorkOrderRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveShipmentWorkOrderRecords(seedRecords)
  return seedRecords
}
