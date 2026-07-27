import { createCostEngineView, createDefaultCostEngineFilters } from '../cost-engine/cost-engine.service'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import type { ShipmentWorkOrderRecord } from '../shipment-work-orders/shipment-work-order.types'
import type { ShipmentRecord } from '../shipments/shipment.types'
import type { Branch, StockItem, StockUnit } from '../types'
import { createDeliveryNoteHistory, appendDeliveryNoteHistory } from './delivery-note-history.service'
import { createDeliveryNoteStatistics } from './delivery-note-statistics.service'
import { validateDeliveryNote } from './delivery-note-validation.service'
import type {
  DeliveryNote,
  DeliveryNoteFilters,
  DeliveryNoteHistory,
  DeliveryNoteHistoryAction,
  DeliveryNoteItem,
  DeliveryNoteLineSource,
  DeliveryNoteReadModelContext,
  DeliveryNoteStatus
} from './delivery-note.types'

export const DELIVERY_NOTE_STORAGE_KEY = 'ra_delivery_notes'

export const DELIVERY_NOTE_STATUSES: DeliveryNoteStatus[] = [
  'DRAFT',
  'READY',
  'PRINTED',
  'LOADED',
  'DELIVERED',
  'CANCELLED'
]

export const DELIVERY_NOTE_STATUS_LABELS: Record<DeliveryNoteStatus, string> = {
  DRAFT: 'Taslak',
  READY: 'Hazir',
  PRINTED: 'Yazdirildi',
  LOADED: 'Yuklendi',
  DELIVERED: 'Teslim Edildi',
  CANCELLED: 'Iptal'
}

const DEFAULT_STATUS: DeliveryNoteStatus = 'DRAFT'
const DEFAULT_UNIT: StockUnit = 'adet'
const NOTE_NO_PREFIX = 'DN'
const NOTE_NO_PADDING = 6
const NOTE_SEED_COUNT = 8
const QUANTITY_ROUNDING_FACTOR = 1000

type RawDeliveryNote = Partial<Record<keyof DeliveryNote, unknown>> & Record<string, unknown>
type RawDeliveryNoteItem = Partial<Record<keyof DeliveryNoteItem, unknown>> & Record<string, unknown>
type RawDeliveryNoteHistory = Partial<Record<keyof DeliveryNoteHistory, unknown>> & Record<string, unknown>

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawDeliveryNote => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawDeliveryNoteItem => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isHistoryRecord = (value: unknown): value is RawDeliveryNoteHistory => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? roundQuantity(parsed) : 0
}

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? roundQuantity(parsed) : fallback
}

const normalizeStatus = (value: unknown): DeliveryNoteStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return DELIVERY_NOTE_STATUSES.includes(normalized as DeliveryNoteStatus)
    ? normalized as DeliveryNoteStatus
    : DEFAULT_STATUS
}

const normalizeUnit = (value: unknown, fallback: StockUnit = DEFAULT_UNIT): StockUnit => {
  const normalized = normalizeText(value)
  const units: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
  return units.includes(normalized as StockUnit) ? normalized as StockUnit : fallback
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createDefaultDeliveryNoteFilters = (): DeliveryNoteFilters => ({
  status: 'all',
  branchId: 'all',
  warehouseId: 'all',
  customerId: 'all',
  vehicleId: 'all',
  driverName: '',
  date: '',
  search: ''
})

export const getNextDeliveryNoteNo = (
  records: Pick<DeliveryNote, 'deliveryNoteNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${NOTE_NO_PREFIX}-${year}-(\\d{${NOTE_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.deliveryNoteNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${NOTE_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(NOTE_NO_PADDING, '0')}`
}

const createMap = <TRecord extends { id: string }>(records: TRecord[]) => (
  new Map(records.map(record => [record.id, record]))
)

const getBranchName = (
  branchId: string,
  branches: Branch[]
) => branches.find(branch => branch.id === branchId)?.name || branchId || '-'

const getStockItemName = (
  stockItemId: string,
  stockItems: StockItem[]
) => stockItems.find(item => item.id === stockItemId)?.name || stockItemId || '-'

const getProductName = (
  lot: InventoryLot | null,
  stockItem: StockItem | null,
  sourceData: KpiSourceData
) => {
  const productRef = lot
    ? sourceData.productRefs.find(product => product.id === lot.productId || product.stockItemId === lot.stockItemId)
    : null

  return productRef?.name || stockItem?.name || lot?.productId || '-'
}

const getProductionOrderNo = (
  productionOrderId: string,
  sourceData: KpiSourceData
) => sourceData.productionOrders.find(order => order.id === productionOrderId)?.workOrderNo || productionOrderId || ''

const getShipmentForLine = (
  workOrder: ShipmentWorkOrderRecord | null,
  palletItem: ShipmentPalletRecord['items'][number],
  sourceData: KpiSourceData
) => {
  if(!workOrder) return null
  const shipmentIds = new Set(workOrder.shipmentIds)
  const candidates = sourceData.shipments.filter(shipment => shipmentIds.has(shipment.id))
  return candidates.find(shipment => (
    shipment.items.some(item => item.inventoryLotId === palletItem.inventoryLotId || item.stockItemId === palletItem.stockItemId)
  )) || candidates[0] || null
}

export const createDeliveryNoteLineSources = (
  shipmentPlanId: string,
  sourceData: KpiSourceData
): DeliveryNoteLineSource[] => {
  const plan = sourceData.shipmentPlans.find(record => record.id === shipmentPlanId)
  if(!plan) return []

  const vehicle = sourceData.shipmentVehicles.find(record => record.id === plan.vehicleId)
  if(!vehicle) return []

  const palletMap = createMap(sourceData.shipmentPallets)
  const workOrderMap = createMap(sourceData.shipmentWorkOrders)
  const lotMap = createMap(sourceData.inventoryLots)
  const stockItemMap = createMap(sourceData.stockItems)
  const branchMap = createMap(sourceData.branches)
  const lines: DeliveryNoteLineSource[] = []

  for(const stop of [...plan.stops].sort((first, second) => first.stopOrder - second.stopOrder)){
    const vehicleLoad = vehicle.loads.find(load => load.id === stop.vehicleLoadId)
    if(!vehicleLoad) continue
    const pallet = palletMap.get(vehicleLoad.palletId)
    if(!pallet) continue
    const workOrder = workOrderMap.get(pallet.workOrderId) || null
    const branch = branchMap.get(stop.branchId || workOrder?.destinationBranchId || '') || null

    for(const palletItem of pallet.items){
      const lot = lotMap.get(palletItem.inventoryLotId) || null
      const stockItem = stockItemMap.get(palletItem.stockItemId || lot?.stockItemId || '') || null
      lines.push({
        plan,
        stop,
        vehicle,
        vehicleLoad,
        pallet,
        palletItem,
        workOrder,
        shipment: getShipmentForLine(workOrder, palletItem, sourceData),
        lot,
        stockItem,
        branch
      })
    }
  }

  return lines
}

export const createDeliveryNoteContext = (
  sourceData: KpiSourceData
): DeliveryNoteReadModelContext => {
  const costView = createCostEngineView(sourceData, createDefaultCostEngineFilters())
  const costByProductId = new Map<string, number>()

  for(const record of costView.records){
    const unitCost = record.costPerUnit || record.costPerKg || record.averageCost || 0
    if(record.productId && !costByProductId.has(record.productId)) costByProductId.set(record.productId, unitCost)
    if(record.lotId && !costByProductId.has(record.lotId)) costByProductId.set(record.lotId, unitCost)
    if(record.id && !costByProductId.has(record.id)) costByProductId.set(record.id, unitCost)
  }

  return { sourceData, costByProductId }
}

const getFallbackUnitCost = (
  stockItem: StockItem | null
) => stockItem?.averageCost || stockItem?.lastPurchasePrice || stockItem?.unitPurchasePrice || 0

const getUnitCost = (
  line: DeliveryNoteLineSource,
  context: DeliveryNoteReadModelContext
) => {
  const lot = line.lot
  const costFromEngine = context.costByProductId.get(lot?.productId || '')
    || context.costByProductId.get(lot?.id || '')
    || context.costByProductId.get(line.palletItem.stockItemId)
    || 0

  return costFromEngine || getFallbackUnitCost(line.stockItem)
}

const quantityToKg = (
  quantity: number,
  unit: StockUnit
) => {
  if(unit === 'kg') return quantity
  if(unit === 'gr') return quantity / 1000
  return quantity
}

const getBoxCount = (
  quantity: number,
  unit: StockUnit
) => {
  if(unit === 'koli') return quantity
  return Math.max(1, Math.ceil(quantity / 12))
}

const createDeliveryNoteItem = (
  deliveryNoteId: string,
  line: DeliveryNoteLineSource,
  context: DeliveryNoteReadModelContext,
  itemIndex: number
): DeliveryNoteItem => {
  const lot = line.lot
  const stockItem = line.stockItem
  const quantity = roundQuantity(line.palletItem.quantity)
  const unit = normalizeUnit(line.palletItem.unit, lot?.unit || stockItem?.unit || DEFAULT_UNIT)
  const palletItemCount = Math.max(line.pallet.items.length, 1)
  const unitCost = getUnitCost(line, context)
  const netWeight = roundQuantity(quantityToKg(quantity, unit))
  const grossWeight = roundQuantity(netWeight + ((line.pallet.grossWeight - line.pallet.netWeight) / palletItemCount))

  return {
    id: `delivery_note_item_${deliveryNoteId}_${itemIndex + 1}`,
    deliveryNoteId,
    productId: lot?.productId || line.palletItem.stockItemId,
    productName: getProductName(lot, stockItem, context.sourceData),
    stockItemId: line.palletItem.stockItemId || lot?.stockItemId || '',
    stockItemName: stockItem?.name || getStockItemName(line.palletItem.stockItemId, context.sourceData.stockItems),
    lotId: line.palletItem.inventoryLotId,
    lotNo: lot?.lotNo || line.palletItem.inventoryLotId,
    productionOrderId: lot?.productionOrderId || '',
    productionOrderNo: getProductionOrderNo(lot?.productionOrderId || '', context.sourceData),
    shipmentId: line.shipment?.id || '',
    shipmentNo: line.shipment?.shipmentNo || '',
    shipmentPlanStopId: line.stop.id,
    palletId: line.pallet.id,
    palletNo: line.pallet.palletNo,
    quantity,
    unit,
    boxCount: roundQuantity(getBoxCount(quantity, unit)),
    palletCount: roundQuantity(1 / palletItemCount),
    netWeight,
    grossWeight,
    unitCost: roundQuantity(unitCost),
    totalCost: roundQuantity(unitCost * quantity)
  }
}

const getPrimaryShipment = (
  lines: DeliveryNoteLineSource[]
) => lines.find(line => line.shipment)?.shipment || null

const getPrimaryBranch = (
  lines: DeliveryNoteLineSource[],
  sourceData: KpiSourceData
) => {
  const lineBranch = lines.find(line => line.branch)?.branch
  if(lineBranch) return lineBranch
  const shipment = getPrimaryShipment(lines)
  return shipment
    ? sourceData.branches.find(branch => branch.id === shipment.destinationBranchId) || null
    : null
}

const getPrimaryWarehouseId = (
  lines: DeliveryNoteLineSource[]
) => lines.find(line => line.pallet.warehouseId)?.pallet.warehouseId
  || lines.find(line => line.lot?.warehouseId)?.lot?.warehouseId
  || getPrimaryShipment(lines)?.sourceWarehouseId
  || ''

const normalizeHistory = (
  item: RawDeliveryNoteHistory,
  deliveryNoteId: string,
  index: number
): DeliveryNoteHistory => ({
  id: normalizeText(item.id) || `delivery_note_history_${deliveryNoteId}_${index + 1}`,
  deliveryNoteId: normalizeText(item.deliveryNoteId) || deliveryNoteId,
  action: normalizeText(item.action).toUpperCase() as DeliveryNoteHistoryAction || 'UPDATED',
  actorName: normalizeText(item.actorName) || 'System',
  description: normalizeText(item.description),
  createdAt: normalizeText(item.createdAt) || new Date().toISOString()
})

const normalizeItem = (
  item: RawDeliveryNoteItem,
  deliveryNoteId: string,
  index: number,
  sourceData: KpiSourceData
): DeliveryNoteItem => {
  const lotId = normalizeText(item.lotId)
  const lot = sourceData.inventoryLots.find(record => record.id === lotId) || null
  const stockItemId = normalizeText(item.stockItemId) || lot?.stockItemId || ''
  const stockItem = sourceData.stockItems.find(record => record.id === stockItemId) || null
  const quantity = normalizePositiveNumber(item.quantity)
  const unit = normalizeUnit(item.unit, lot?.unit || stockItem?.unit || DEFAULT_UNIT)
  const unitCost = normalizeNonNegativeNumber(item.unitCost) || getFallbackUnitCost(stockItem)

  return {
    id: normalizeText(item.id) || `delivery_note_item_${deliveryNoteId}_${index + 1}`,
    deliveryNoteId: normalizeText(item.deliveryNoteId) || deliveryNoteId,
    productId: normalizeText(item.productId) || lot?.productId || stockItemId,
    productName: normalizeText(item.productName) || getProductName(lot, stockItem, sourceData),
    stockItemId,
    stockItemName: normalizeText(item.stockItemName) || getStockItemName(stockItemId, sourceData.stockItems),
    lotId,
    lotNo: normalizeText(item.lotNo) || lot?.lotNo || lotId,
    productionOrderId: normalizeText(item.productionOrderId) || lot?.productionOrderId || '',
    productionOrderNo: normalizeText(item.productionOrderNo) || getProductionOrderNo(lot?.productionOrderId || '', sourceData),
    shipmentId: normalizeText(item.shipmentId),
    shipmentNo: normalizeText(item.shipmentNo),
    shipmentPlanStopId: normalizeText(item.shipmentPlanStopId),
    palletId: normalizeText(item.palletId),
    palletNo: normalizeText(item.palletNo),
    quantity,
    unit,
    boxCount: normalizeNonNegativeNumber(item.boxCount),
    palletCount: normalizeNonNegativeNumber(item.palletCount),
    netWeight: normalizeNonNegativeNumber(item.netWeight),
    grossWeight: normalizeNonNegativeNumber(item.grossWeight),
    unitCost,
    totalCost: normalizeNonNegativeNumber(item.totalCost) || roundQuantity(unitCost * quantity)
  }
}

const normalizeDeliveryNote = (
  item: RawDeliveryNote,
  index: number,
  sourceData: KpiSourceData
): DeliveryNote => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const id = normalizeText(item.id) || `delivery_note_${index + 1}`
  const rawItems = Array.isArray(item.items) ? item.items.filter(isItemRecord) : []
  const normalizedItems = rawItems.map((record, itemIndex) => normalizeItem(record, id, itemIndex, sourceData))
  const shipmentPlanId = normalizeText(item.shipmentPlanId)
  const plan = sourceData.shipmentPlans.find(record => record.id === shipmentPlanId) || null
  const vehicleId = normalizeText(item.vehicleId) || plan?.vehicleId || ''
  const vehicle = sourceData.shipmentVehicles.find(record => record.id === vehicleId) || null
  const branchId = normalizeText(item.branchId)
  const warehouseId = normalizeText(item.warehouseId)
  const rawHistory = Array.isArray(item.history) ? item.history.filter(isHistoryRecord) : []

  return {
    id,
    deliveryNoteNo: normalizeText(item.deliveryNoteNo) || getNextDeliveryNoteNo([], normalizeText(item.date) || getTodayKey(), index),
    date: normalizeText(item.date) || getTodayKey(),
    branchId,
    branchName: normalizeText(item.branchName) || getBranchName(branchId, sourceData.branches),
    warehouseId,
    warehouseName: normalizeText(item.warehouseName) || getBranchName(warehouseId, sourceData.branches),
    customerId: normalizeText(item.customerId) || branchId,
    customerName: normalizeText(item.customerName) || getBranchName(normalizeText(item.customerId) || branchId, sourceData.branches),
    vehicleId,
    vehicleNo: normalizeText(item.vehicleNo) || vehicle?.vehicleNo || '',
    vehiclePlate: normalizeText(item.vehiclePlate) || vehicle?.plateNumber || '',
    driverName: normalizeText(item.driverName) || plan?.driverName || vehicle?.driverName || '',
    shipmentPlanId,
    shipmentPlanNo: normalizeText(item.shipmentPlanNo) || plan?.shipmentPlanNo || shipmentPlanId,
    shipmentId: normalizeText(item.shipmentId),
    shipmentNo: normalizeText(item.shipmentNo),
    status: normalizeStatus(item.status),
    description: normalizeText(item.description),
    items: normalizedItems,
    history: rawHistory.length > 0
      ? rawHistory.map((record, historyIndex) => normalizeHistory(record, id, historyIndex))
      : [createDeliveryNoteHistory(id, 'CREATED', normalizeText(item.createdBy) || 'System', 'Irsaliye read model kaydi olusturuldu.', createdAt)],
    createdBy: normalizeText(item.createdBy) || 'System',
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const createDeliveryNoteFromShipmentPlan = (
  shipmentPlanId: string,
  sourceData: KpiSourceData,
  actorName: string,
  existingRecords: DeliveryNote[] = loadDeliveryNoteRecords(sourceData)
): DeliveryNote => {
  const context = createDeliveryNoteContext(sourceData)
  const lines = createDeliveryNoteLineSources(shipmentPlanId, sourceData)
  const plan = sourceData.shipmentPlans.find(record => record.id === shipmentPlanId) || null
  const vehicle = plan ? sourceData.shipmentVehicles.find(record => record.id === plan.vehicleId) || null : null

  if(!plan) throw new Error('Sevkiyat plani bulunamadi.')
  if(lines.length === 0) throw new Error('Sevkiyat plani icin irsaliye kalemi bulunamadi.')

  const now = new Date().toISOString()
  const id = createId('delivery_note')
  const branch = getPrimaryBranch(lines, sourceData)
  const warehouseId = getPrimaryWarehouseId(lines)
  const shipment = getPrimaryShipment(lines)
  const items = lines.map((line, index) => createDeliveryNoteItem(id, line, context, index))
  const record: DeliveryNote = {
    id,
    deliveryNoteNo: getNextDeliveryNoteNo(existingRecords, plan.planDate || getTodayKey()),
    date: plan.planDate || getTodayKey(),
    branchId: branch?.id || shipment?.destinationBranchId || '',
    branchName: branch?.name || getBranchName(shipment?.destinationBranchId || '', sourceData.branches),
    warehouseId,
    warehouseName: getBranchName(warehouseId, sourceData.branches),
    customerId: branch?.id || shipment?.destinationBranchId || '',
    customerName: branch?.name || getBranchName(shipment?.destinationBranchId || '', sourceData.branches),
    vehicleId: plan.vehicleId,
    vehicleNo: vehicle?.vehicleNo || '',
    vehiclePlate: vehicle?.plateNumber || '',
    driverName: plan.driverName || vehicle?.driverName || '',
    shipmentPlanId: plan.id,
    shipmentPlanNo: plan.shipmentPlanNo,
    shipmentId: shipment?.id || '',
    shipmentNo: shipment?.shipmentNo || '',
    status: 'DRAFT',
    description: `${plan.shipmentPlanNo} sevkiyat plani icin otomatik doldurulan kurumsal irsaliye read model kaydi.`,
    items,
    history: [createDeliveryNoteHistory(id, 'CREATED', actorName, `${plan.shipmentPlanNo} planindan irsaliye olusturuldu.`, now)],
    createdBy: actorName,
    createdAt: now,
    updatedAt: now
  }

  const validation = validateDeliveryNote(record, sourceData)
  if(!validation.valid) throw new Error(validation.errors[0] || 'Irsaliye dogrulamasi basarisiz.')

  return record
}

const createSeedDeliveryNotes = (
  sourceData: KpiSourceData
): DeliveryNote[] => {
  const eligiblePlans = sourceData.shipmentPlans
    .filter(plan => plan.status !== 'CANCELLED')
    .filter(plan => createDeliveryNoteLineSources(plan.id, sourceData).length > 0)
    .slice(0, NOTE_SEED_COUNT)
  const statuses: DeliveryNoteStatus[] = ['DRAFT', 'READY', 'PRINTED', 'LOADED', 'DELIVERED', 'CANCELLED', 'READY', 'DELIVERED']

  return eligiblePlans.map((plan, index) => {
    const seedDate = addDays(getTodayKey(), index === 0 ? 0 : -index)
    const record = createDeliveryNoteFromShipmentPlan(plan.id, sourceData, 'Lojistik Planlama', [])
    const status = statuses[index % statuses.length]
    const updatedRecord = {
      ...record,
      id: `delivery_note_${index + 1}`,
      deliveryNoteNo: getNextDeliveryNoteNo([], seedDate, index),
      date: seedDate,
      status,
      createdAt: `${seedDate}T08:30:00.000Z`,
      updatedAt: `${seedDate}T09:15:00.000Z`
    }

    return {
      ...updatedRecord,
      items: updatedRecord.items.map((item, itemIndex) => ({
        ...item,
        id: `delivery_note_item_${index + 1}_${itemIndex + 1}`,
        deliveryNoteId: updatedRecord.id
      })),
      history: [
        createDeliveryNoteHistory(updatedRecord.id, 'CREATED', 'Lojistik Planlama', `${plan.shipmentPlanNo} planindan irsaliye olusturuldu.`, `${seedDate}T08:30:00.000Z`),
        ...(status === 'PRINTED' || status === 'LOADED' || status === 'DELIVERED'
          ? [createDeliveryNoteHistory(updatedRecord.id, 'PRINTED', 'Lojistik Planlama', 'A4 irsaliye yazdirildi.', `${seedDate}T08:45:00.000Z`)]
          : []),
        ...(status === 'LOADED' || status === 'DELIVERED'
          ? [createDeliveryNoteHistory(updatedRecord.id, 'LOADED', 'Depo Operasyonu', 'Arac yukleme onayi kaydedildi.', `${seedDate}T09:00:00.000Z`)]
          : []),
        ...(status === 'DELIVERED'
          ? [createDeliveryNoteHistory(updatedRecord.id, 'DELIVERED', 'Sofor', 'Teslim bilgisi read model uzerinde isaretlendi.', `${seedDate}T11:20:00.000Z`)]
          : []),
        ...(status === 'CANCELLED'
          ? [createDeliveryNoteHistory(updatedRecord.id, 'CANCELLED', 'Lojistik Planlama', 'Irsaliye iptal edildi.', `${seedDate}T09:05:00.000Z`)]
          : [])
      ]
    }
  })
}

export const saveDeliveryNoteRecords = (
  records: DeliveryNote[],
  sourceData: KpiSourceData
) => {
  if(!isBrowserStorageAvailable()) return
  const normalizedRecords = records.map((record, index) => normalizeDeliveryNote(record, index, sourceData))
  localStorage.setItem(DELIVERY_NOTE_STORAGE_KEY, JSON.stringify(normalizedRecords))
}

export const loadDeliveryNoteRecords = (
  sourceData: KpiSourceData
) => {
  const seedRecords = createSeedDeliveryNotes(sourceData)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(DELIVERY_NOTE_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveDeliveryNoteRecords(seedRecords, sourceData)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeDeliveryNote(record, index, sourceData))

      saveDeliveryNoteRecords(normalizedRecords, sourceData)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveDeliveryNoteRecords(seedRecords, sourceData)
    return seedRecords
  }

  if(seedRecords.length > 0) saveDeliveryNoteRecords(seedRecords, sourceData)
  return seedRecords
}

const matchesFilter = (
  selectedValue: string,
  candidateValue: string
) => selectedValue === 'all' || !selectedValue || selectedValue === candidateValue

export const filterDeliveryNoteRecords = (
  records: DeliveryNote[],
  filters: DeliveryNoteFilters
) => {
  const search = normalizeSearchText(filters.search)

  return records.filter(record => {
    const searchable = [
      record.deliveryNoteNo,
      record.customerName,
      record.branchName,
      record.vehicleNo,
      record.driverName,
      record.shipmentPlanNo,
      record.shipmentNo,
      ...record.items.flatMap(item => [item.productName, item.stockItemName, item.lotNo, item.palletNo])
    ].map(normalizeSearchText).join(' ')

    return (
      (filters.status === 'all' || record.status === filters.status)
      && matchesFilter(filters.branchId, record.branchId)
      && matchesFilter(filters.warehouseId, record.warehouseId)
      && matchesFilter(filters.customerId, record.customerId)
      && matchesFilter(filters.vehicleId, record.vehicleId)
      && (!filters.driverName.trim() || normalizeSearchText(record.driverName).includes(normalizeSearchText(filters.driverName)))
      && (!filters.date || record.date === filters.date)
      && (!search || searchable.includes(search))
    )
  })
}

export const addDeliveryNoteFromShipmentPlan = (
  shipmentPlanId: string,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadDeliveryNoteRecords(sourceData)
  const duplicate = records.find(record => record.shipmentPlanId === shipmentPlanId && record.status !== 'CANCELLED')
  if(duplicate) throw new Error(`${duplicate.deliveryNoteNo} bu sevkiyat plani icin zaten aktif.`)

  const record = createDeliveryNoteFromShipmentPlan(shipmentPlanId, sourceData, actorName, records)
  const nextRecords = [record, ...records]
  saveDeliveryNoteRecords(nextRecords, sourceData)
  return record
}

const getStatusAction = (
  status: DeliveryNoteStatus
): DeliveryNoteHistoryAction => {
  if(status === 'PRINTED') return 'PRINTED'
  if(status === 'LOADED') return 'LOADED'
  if(status === 'DELIVERED') return 'DELIVERED'
  if(status === 'CANCELLED') return 'CANCELLED'
  return 'UPDATED'
}

export const updateDeliveryNoteStatus = (
  deliveryNoteId: string,
  status: DeliveryNoteStatus,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadDeliveryNoteRecords(sourceData)
  const record = records.find(item => item.id === deliveryNoteId)
  if(!record) throw new Error('Irsaliye bulunamadi.')

  const candidate = appendDeliveryNoteHistory(
    { ...record, status, updatedAt: new Date().toISOString() },
    getStatusAction(status),
    actorName,
    `${record.deliveryNoteNo} durumu ${DELIVERY_NOTE_STATUS_LABELS[status]} olarak guncellendi.`
  )
  const validation = validateDeliveryNote(candidate, sourceData, record)
  if(!validation.valid) throw new Error(validation.errors[0] || 'Irsaliye dogrulamasi basarisiz.')

  const nextRecords = records.map(item => item.id === deliveryNoteId ? candidate : item)
  saveDeliveryNoteRecords(nextRecords, sourceData)
  return candidate
}

export const recordDeliveryNoteOutput = (
  deliveryNoteId: string,
  action: Extract<DeliveryNoteHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadDeliveryNoteRecords(sourceData)
  const record = records.find(item => item.id === deliveryNoteId)
  if(!record) throw new Error('Irsaliye bulunamadi.')

  const status: DeliveryNoteStatus = action === 'EXCEL'
    ? record.status
    : record.status === 'DELIVERED' || record.status === 'CANCELLED'
      ? record.status
      : 'PRINTED'
  const description = action === 'PDF'
    ? `${record.deliveryNoteNo} PDF cikti icin acildi.`
    : action === 'EXCEL'
      ? `${record.deliveryNoteNo} Excel export kapsaminda indirildi.`
      : `${record.deliveryNoteNo} A4 irsaliye yazdirildi.`
  const candidate = appendDeliveryNoteHistory(
    { ...record, status, updatedAt: new Date().toISOString() },
    action,
    actorName,
    description
  )
  const validation = validateDeliveryNote(candidate, sourceData)
  if(!validation.valid) throw new Error(validation.errors[0] || 'Irsaliye dogrulamasi basarisiz.')

  const nextRecords = records.map(item => item.id === deliveryNoteId ? candidate : item)
  saveDeliveryNoteRecords(nextRecords, sourceData)
  return candidate
}

export const DeliveryNoteService = {
  statuses: DELIVERY_NOTE_STATUSES,
  statusLabels: DELIVERY_NOTE_STATUS_LABELS,
  createDefaultFilters: createDefaultDeliveryNoteFilters,
  getNextNo: getNextDeliveryNoteNo,
  createContext: createDeliveryNoteContext,
  createLineSources: createDeliveryNoteLineSources,
  createFromShipmentPlan: createDeliveryNoteFromShipmentPlan,
  addFromShipmentPlan: addDeliveryNoteFromShipmentPlan,
  list: loadDeliveryNoteRecords,
  save: saveDeliveryNoteRecords,
  filter: filterDeliveryNoteRecords,
  statistics: createDeliveryNoteStatistics,
  validate: validateDeliveryNote,
  updateStatus: updateDeliveryNoteStatus,
  recordOutput: recordDeliveryNoteOutput
}
