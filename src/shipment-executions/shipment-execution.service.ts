import {
  resolveInventoryLotStatus
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { ShipmentRecord } from '../shipments/shipment.types'
import {
  addActionLog,
  addStockMovementAuditEvent,
  loadAllStockItems,
  loadAllStockMovements,
  saveAllStockItems,
  saveAllStockMovements
} from '../storage'
import type {
  StockItem,
  StockMovement,
  StockUnit,
  User
} from '../types'
import type {
  ShipmentDeliveryResult,
  ShipmentExecutionItem,
  ShipmentExecutionItemStatus,
  ShipmentExecutionRecord,
  ShipmentExecutionStatus
} from './shipment-execution.types'

type QuantityPatch = Record<string, number>

type StockEffectResult = {
  execution: ShipmentExecutionRecord
  inventoryLots: InventoryLot[]
  movements: StockMovement[]
  createdInventoryLots: InventoryLot[]
}

const QUANTITY_ROUNDING_FACTOR = 1000
const COST_ROUNDING_FACTOR = 100

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const roundMoney = (value: number) => (
  Math.round((value + Number.EPSILON) * COST_ROUNDING_FACTOR) / COST_ROUNDING_FACTOR
)

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const getUserName = (user: User) => user.fullName || user.username

const getStockUnitCost = (item: StockItem) => {
  const cost = Number(item.averageCost ?? item.unitPurchasePrice ?? item.lastPurchasePrice ?? 0)
  return Number.isFinite(cost) && cost >= 0 ? cost : 0
}

const getStockCurrency = (item: StockItem) => item.currency || 'TRY'

const buildStockMovement = ({
  stockItem,
  type,
  quantity,
  previousQuantity,
  nextQuantity,
  branchId,
  execution,
  counterpartyName,
  user,
  now
}: {
  stockItem: StockItem
  type: 'Giriş' | 'Çıkış'
  quantity: number
  previousQuantity: number
  nextQuantity: number
  branchId: string
  execution: ShipmentExecutionRecord
  counterpartyName: string
  user: User
  now: string
}): StockMovement => {
  const unitCost = getStockUnitCost(stockItem)

  return {
    id: createId('stock_move'),
    branchId,
    stockItemId: stockItem.id,
    stockItemName: stockItem.name,
    type,
    source: 'Transfer',
    reason: 'Diğer',
    qty: quantity,
    unit: stockItem.unit,
    previousQty: previousQuantity,
    nextQty: nextQuantity,
    currency: getStockCurrency(stockItem),
    unitCost: roundMoney(unitCost),
    totalCost: roundMoney(quantity * unitCost),
    previousAverageCost: roundMoney(unitCost),
    nextAverageCost: roundMoney(unitCost),
    previousStockValue: roundMoney(Math.max(0, previousQuantity) * unitCost),
    nextStockValue: roundMoney(Math.max(0, nextQuantity) * unitCost),
    supplierName: '',
    invoiceNo: execution.executionNo,
    description: `${execution.executionNo} sevkiyat operasyonu. Karşı taraf: ${counterpartyName}.`,
    movementDate: now,
    createdAt: now,
    createdByUserId: user.id,
    createdByFullName: getUserName(user),
    sourceEntityType: 'ShipmentExecution',
    sourceEntityId: execution.id
  }
}

const recordMovementAudit = (
  movement: StockMovement,
  before: StockItem,
  after: StockItem,
  user: User,
  now: string
) => {
  addStockMovementAuditEvent({
    id: createId('stock_audit'),
    movementId: movement.id,
    stockItemId: movement.stockItemId,
    eventType: 'created',
    userId: user.id,
    userName: getUserName(user),
    timestamp: now,
    before,
    after,
    note: `${movement.stockItemName}: Shipment Execution kaynaklı ${movement.type} ${movement.qty} ${movement.unit}. ${before.currentQty} -> ${after.currentQty}.`
  })
}

const findTargetStockItem = (
  stockItems: StockItem[],
  sourceItem: StockItem,
  targetBranchId: string
) => stockItems.find(item => (
  item.branchId === targetBranchId
  && item.name.trim().toLocaleLowerCase('tr-TR') === sourceItem.name.trim().toLocaleLowerCase('tr-TR')
  && item.unit === sourceItem.unit
))

const createTargetStockItem = (
  sourceItem: StockItem,
  targetBranchId: string,
  now: string
): StockItem => ({
  ...sourceItem,
  id: createId('shipment_target_stock'),
  branchId: targetBranchId,
  currentQty: 0,
  active: true,
  createdAt: now,
  updatedAt: now
})

const getDestinationWarehouseId = (shipment: ShipmentRecord) => (
  shipment.destinationWarehouseId || shipment.destinationBranchId
)

const getShipmentItemMap = (shipment: ShipmentRecord) => (
  new Map(shipment.items.map(item => [item.id, item]))
)

const updateExecutionStatus = (
  execution: ShipmentExecutionRecord,
  patch: Partial<ShipmentExecutionRecord>
): ShipmentExecutionRecord => ({
  ...execution,
  ...patch,
  updatedAt: new Date().toISOString()
})

const validateQuantityChain = (item: ShipmentExecutionItem) => {
  if(item.pickedQuantity > item.plannedQuantity){
    throw new Error('Picked Quantity, Planned Quantity değerini geçemez.')
  }
  if(item.packedQuantity > item.pickedQuantity){
    throw new Error('Packed Quantity, Picked Quantity değerini geçemez.')
  }
  if(item.shippedQuantity > item.packedQuantity){
    throw new Error('Shipped Quantity, Packed Quantity değerini geçemez.')
  }
  if(item.deliveredQuantity > item.shippedQuantity){
    throw new Error('Delivered Quantity, Shipped Quantity değerini geçemez.')
  }
}

const getItemDeliveryStatus = (item: ShipmentExecutionItem): ShipmentExecutionItemStatus => {
  if(item.status === 'CANCELLED') return 'CANCELLED'
  if(item.deliveredQuantity > 0 && item.deliveredQuantity < item.shippedQuantity) return 'PARTIAL'
  if(item.shippedQuantity > 0 && item.deliveredQuantity >= item.shippedQuantity) return 'DELIVERED'
  if(item.shippedQuantity > 0) return 'SHIPPED'
  if(item.packedQuantity > 0) return 'PACKED'
  if(item.pickedQuantity > 0) return 'PICKED'
  return 'PENDING'
}

const normalizeExecutionItems = (items: ShipmentExecutionItem[]) => (
  items.map(item => {
    const nextItem = {
      ...item,
      plannedQuantity: roundQuantity(item.plannedQuantity),
      pickedQuantity: roundQuantity(item.pickedQuantity),
      packedQuantity: roundQuantity(item.packedQuantity),
      shippedQuantity: roundQuantity(item.shippedQuantity),
      deliveredQuantity: roundQuantity(item.deliveredQuantity),
      remainingQuantity: roundQuantity(Math.max(0, item.plannedQuantity - item.deliveredQuantity)),
      status: getItemDeliveryStatus(item)
    }

    validateQuantityChain(nextItem)
    return nextItem
  })
)

export const startShipmentPicking = (
  execution: ShipmentExecutionRecord,
  user: User
): ShipmentExecutionRecord => {
  if(execution.status !== 'PENDING') throw new Error('Picking yalnızca PENDING durumunda başlatılabilir.')
  const now = new Date().toISOString()

  return updateExecutionStatus(execution, {
    status: 'PICKING',
    pickedBy: getUserName(user),
    pickedAt: now
  })
}

export const completeShipmentPicking = (
  execution: ShipmentExecutionRecord,
  user: User,
  pickedQuantities: QuantityPatch = {}
): ShipmentExecutionRecord => {
  if(execution.status !== 'PICKING') throw new Error('Picking tamamlama yalnızca PICKING durumunda yapılabilir.')
  const now = new Date().toISOString()
  const items = normalizeExecutionItems(execution.items.map(item => {
    const nextPickedQuantity = pickedQuantities[item.id] ?? item.plannedQuantity

    return {
      ...item,
      pickedQuantity: roundQuantity(Math.min(nextPickedQuantity, item.plannedQuantity)),
      status: 'PICKED' as ShipmentExecutionItemStatus
    }
  }))

  return updateExecutionStatus(execution, {
    status: 'PICKING',
    pickedBy: getUserName(user),
    pickedAt: execution.pickedAt || now,
    items
  })
}

export const startShipmentPacking = (
  execution: ShipmentExecutionRecord,
  user: User
): ShipmentExecutionRecord => {
  if(execution.status !== 'PICKING' && execution.status !== 'PACKING'){
    throw new Error('Packing yalnızca PICKING veya PACKING durumunda başlatılabilir.')
  }
  if(execution.status === 'PICKING' && execution.items.some(item => item.pickedQuantity <= 0)){
    throw new Error('Packing başlatmadan önce picking tamamlanmalıdır.')
  }
  const now = new Date().toISOString()

  return updateExecutionStatus(execution, {
    status: 'PACKING',
    packedBy: getUserName(user),
    packedAt: execution.packedAt || now
  })
}

export const completeShipmentPacking = (
  execution: ShipmentExecutionRecord,
  user: User,
  packedQuantities: QuantityPatch = {}
): ShipmentExecutionRecord => {
  if(execution.status !== 'PACKING') throw new Error('Packing tamamlama yalnızca PACKING durumunda yapılabilir.')
  const now = new Date().toISOString()
  const items = normalizeExecutionItems(execution.items.map(item => {
    const nextPackedQuantity = packedQuantities[item.id] ?? item.pickedQuantity

    return {
      ...item,
      packedQuantity: roundQuantity(Math.min(nextPackedQuantity, item.pickedQuantity)),
      status: 'PACKED' as ShipmentExecutionItemStatus
    }
  }))

  return updateExecutionStatus(execution, {
    status: 'READY_TO_SHIP',
    packedBy: getUserName(user),
    packedAt: execution.packedAt || now,
    items
  })
}

export const cancelShipmentExecution = (
  execution: ShipmentExecutionRecord,
  user: User
): ShipmentExecutionRecord => {
  if(execution.status === 'SHIPPED' || execution.status === 'PARTIALLY_DELIVERED' || execution.status === 'DELIVERED'){
    throw new Error('Stok hareketi oluşmuş execution iptal edilemez.')
  }

  const items = execution.items.map(item => ({
    ...item,
    status: 'CANCELLED' as ShipmentExecutionItemStatus
  }))

  return updateExecutionStatus(execution, {
    status: 'CANCELLED',
    deliveryResult: 'FAILED',
    deliveredBy: getUserName(user),
    deliveredAt: new Date().toISOString(),
    items
  })
}

export const shipShipmentExecution = ({
  execution,
  shipment,
  inventoryLots,
  user,
  warehouseLabel
}: {
  execution: ShipmentExecutionRecord
  shipment: ShipmentRecord
  inventoryLots: InventoryLot[]
  user: User
  warehouseLabel: (warehouseId: string) => string
}): StockEffectResult => {
  if(execution.status !== 'READY_TO_SHIP'){
    throw new Error('Sevkiyat yalnızca READY_TO_SHIP durumunda başlatılabilir.')
  }

  const now = new Date().toISOString()
  const shipmentItemMap = getShipmentItemMap(shipment)
  let nextInventoryLots = [...inventoryLots]
  let nextStockItems = loadAllStockItems()
  const movements: StockMovement[] = []

  const items = normalizeExecutionItems(execution.items.map(item => {
    const shipmentItem = shipmentItemMap.get(item.shipmentItemId)
    if(!shipmentItem) throw new Error('Shipment Item bulunamadı.')

    const sourceLot = nextInventoryLots.find(lot => lot.id === shipmentItem.inventoryLotId)
    if(!sourceLot) throw new Error('Kaynak Inventory Lot bulunamadı.')

    const targetShippedQuantity = roundQuantity(item.packedQuantity)
    const delta = roundQuantity(targetShippedQuantity - item.shippedQuantity)

    if(delta < 0) throw new Error('Shipped Quantity azaltılamaz.')
    if(delta > sourceLot.remainingQuantity){
      throw new Error(`${sourceLot.lotNo} için negative stock oluşamaz.`)
    }

    if(delta > 0){
      const sourceItem = nextStockItems.find(stockItem => stockItem.id === shipmentItem.stockItemId)
      if(!sourceItem) throw new Error('Kaynak Stock Item bulunamadı.')
      if(sourceItem.currentQty < delta){
        throw new Error(`${sourceItem.name} için stok kartı negative stock oluşturamaz.`)
      }

      const sourceAfter: StockItem = {
        ...sourceItem,
        currentQty: roundQuantity(sourceItem.currentQty - delta),
        updatedAt: now
      }
      const updatedLot: InventoryLot = {
        ...sourceLot,
        remainingQuantity: roundQuantity(sourceLot.remainingQuantity - delta),
        status: resolveInventoryLotStatus(sourceLot.status, roundQuantity(sourceLot.remainingQuantity - delta), sourceLot.expiryDate),
        updatedAt: now
      }
      const movement = buildStockMovement({
        stockItem: sourceItem,
        type: 'Çıkış',
        quantity: delta,
        previousQuantity: sourceItem.currentQty,
        nextQuantity: sourceAfter.currentQty,
        branchId: sourceLot.warehouseId,
        execution,
        counterpartyName: warehouseLabel(getDestinationWarehouseId(shipment)),
        user,
        now
      })

      nextStockItems = nextStockItems.map(stockItem => stockItem.id === sourceItem.id ? sourceAfter : stockItem)
      nextInventoryLots = nextInventoryLots.map(lot => lot.id === sourceLot.id ? updatedLot : lot)
      recordMovementAudit(movement, sourceItem, sourceAfter, user, now)
      movements.push(movement)
    }

    return {
      ...item,
      shippedQuantity: targetShippedQuantity,
      status: 'SHIPPED' as ShipmentExecutionItemStatus
    }
  }))

  const nextExecution = updateExecutionStatus(execution, {
    status: 'SHIPPED',
    shippedBy: getUserName(user),
    shippedAt: execution.shippedAt || now,
    items
  })

  if(movements.length > 0){
    saveAllStockItems(nextStockItems)
    saveAllStockMovements([...movements, ...loadAllStockMovements()])
    addActionLog({
      operationType: 'Transfer tamamlandı',
      user,
      description: `${execution.executionNo} sevkiyat çıkışı oluşturuldu. Shipment: ${shipment.shipmentNo}. Kalem: ${movements.length}.`
    })
  }

  return {
    execution: nextExecution,
    inventoryLots: nextInventoryLots,
    movements,
    createdInventoryLots: []
  }
}

const createDeliveredInventoryLot = ({
  sourceLot,
  targetStockItem,
  destinationWarehouseId,
  execution,
  quantity,
  unit,
  now,
  index
}: {
  sourceLot: InventoryLot
  targetStockItem: StockItem
  destinationWarehouseId: string
  execution: ShipmentExecutionRecord
  quantity: number
  unit: StockUnit
  now: string
  index: number
}): InventoryLot => ({
  id: createId('shipment_inventory_lot'),
  lotNo: `${execution.executionNo}-LOT-${String(index + 1).padStart(2, '0')}`,
  stockItemId: targetStockItem.id,
  goodsReceiptId: '',
  supplierId: sourceLot.supplierId,
  warehouseId: destinationWarehouseId,
  productionDate: sourceLot.productionDate,
  expiryDate: sourceLot.expiryDate,
  receivedQuantity: quantity,
  remainingQuantity: quantity,
  unit,
  status: resolveInventoryLotStatus('ACTIVE', quantity, sourceLot.expiryDate),
  notes: `${execution.executionNo} sevkiyat tesliminden oluştu. Kaynak lot: ${sourceLot.lotNo}.`,
  createdAt: now,
  updatedAt: now
})

export const deliverShipmentExecution = ({
  execution,
  shipment,
  inventoryLots,
  deliveredQuantities,
  deliveryResult,
  deliveryNotes,
  user,
  warehouseLabel
}: {
  execution: ShipmentExecutionRecord
  shipment: ShipmentRecord
  inventoryLots: InventoryLot[]
  deliveredQuantities: QuantityPatch
  deliveryResult: ShipmentDeliveryResult
  deliveryNotes: string
  user: User
  warehouseLabel: (warehouseId: string) => string
}): StockEffectResult => {
  if(execution.status !== 'SHIPPED' && execution.status !== 'PARTIALLY_DELIVERED'){
    throw new Error('Teslim işlemi yalnızca SHIPPED veya PARTIALLY_DELIVERED durumunda yapılabilir.')
  }

  const destinationWarehouseId = getDestinationWarehouseId(shipment)
  if(!destinationWarehouseId) throw new Error('Hedef Warehouse veya Branch bulunamadı.')

  const now = new Date().toISOString()
  const shipmentItemMap = getShipmentItemMap(shipment)
  let nextStockItems = loadAllStockItems()
  const movements: StockMovement[] = []
  const createdInventoryLots: InventoryLot[] = []

  const items = normalizeExecutionItems(execution.items.map((item, index) => {
    const shipmentItem = shipmentItemMap.get(item.shipmentItemId)
    if(!shipmentItem) throw new Error('Shipment Item bulunamadı.')

    const sourceLot = inventoryLots.find(lot => lot.id === shipmentItem.inventoryLotId)
    if(!sourceLot) throw new Error('Kaynak Inventory Lot bulunamadı.')

    const targetDeliveredQuantity = roundQuantity(deliveredQuantities[item.id] ?? item.shippedQuantity)
    if(targetDeliveredQuantity < item.deliveredQuantity) throw new Error('Delivered Quantity azaltılamaz.')
    if(targetDeliveredQuantity > item.shippedQuantity){
      throw new Error('Delivered Quantity, Shipped Quantity değerini geçemez.')
    }

    const delta = roundQuantity(targetDeliveredQuantity - item.deliveredQuantity)
    if(delta > 0){
      const sourceItem = nextStockItems.find(stockItem => stockItem.id === shipmentItem.stockItemId)
      if(!sourceItem) throw new Error('Kaynak Stock Item bulunamadı.')

      const matchedTargetItem = findTargetStockItem(nextStockItems, sourceItem, destinationWarehouseId)
      const targetItem = matchedTargetItem || createTargetStockItem(sourceItem, destinationWarehouseId, now)
      const targetAfter: StockItem = {
        ...targetItem,
        currentQty: roundQuantity(targetItem.currentQty + delta),
        updatedAt: now
      }
      const movement = buildStockMovement({
        stockItem: targetItem,
        type: 'Giriş',
        quantity: delta,
        previousQuantity: targetItem.currentQty,
        nextQuantity: targetAfter.currentQty,
        branchId: destinationWarehouseId,
        execution,
        counterpartyName: warehouseLabel(shipment.sourceWarehouseId),
        user,
        now
      })
      const deliveredLot = createDeliveredInventoryLot({
        sourceLot,
        targetStockItem: targetAfter,
        destinationWarehouseId,
        execution,
        quantity: delta,
        unit: shipmentItem.unit,
        now,
        index
      })

      nextStockItems = matchedTargetItem
        ? nextStockItems.map(stockItem => stockItem.id === targetItem.id ? targetAfter : stockItem)
        : [targetAfter, ...nextStockItems]
      recordMovementAudit(movement, targetItem, targetAfter, user, now)
      movements.push(movement)
      createdInventoryLots.push(deliveredLot)
    }

    return {
      ...item,
      deliveredQuantity: targetDeliveredQuantity,
      remainingQuantity: roundQuantity(Math.max(0, item.plannedQuantity - targetDeliveredQuantity))
    }
  }))

  const isFullyDelivered = items.every(item => item.shippedQuantity > 0 && item.deliveredQuantity >= item.shippedQuantity)
  const nextStatus: ShipmentExecutionStatus = isFullyDelivered ? 'DELIVERED' : 'PARTIALLY_DELIVERED'
  const nextDeliveryResult: ShipmentDeliveryResult = isFullyDelivered ? 'SUCCESS' : deliveryResult
  const nextExecution = updateExecutionStatus(execution, {
    status: nextStatus,
    deliveredBy: getUserName(user),
    deliveredAt: now,
    deliveryResult: nextDeliveryResult,
    deliveryNotes: deliveryNotes.trim(),
    items
  })

  if(movements.length > 0){
    saveAllStockItems(nextStockItems)
    saveAllStockMovements([...movements, ...loadAllStockMovements()])
    addActionLog({
      operationType: 'Transfer tamamlandı',
      user,
      description: `${execution.executionNo} sevkiyat teslim girişi oluşturuldu. Shipment: ${shipment.shipmentNo}. Kalem: ${movements.length}.`
    })
  }

  return {
    execution: nextExecution,
    inventoryLots: [...createdInventoryLots, ...inventoryLots],
    movements,
    createdInventoryLots
  }
}
