import {
  resolveInventoryLotStatus
} from '../inventory-lots/inventory-lot.mock'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { ShipmentExecutionRecord } from '../shipment-executions/shipment-execution.types'
import type { ShipmentRecord } from '../shipments/shipment.types'
import type { User } from '../types'
import type {
  TransferReceiptItem,
  TransferReceiptItemStatus,
  TransferReceiptRecord,
  TransferReceiptResult
} from './transfer-receipt.types'

export type TransferReceiptQuantityPatch = Record<string, {
  receivedQuantity: number
  missingQuantity: number
  extraQuantity: number
  damagedQuantity: number
  notes: string
}>

type ReceiptInventoryResult = {
  receipt: TransferReceiptRecord
  execution: ShipmentExecutionRecord
  inventoryLots: InventoryLot[]
  createdInventoryLots: InventoryLot[]
}

const QUANTITY_ROUNDING_FACTOR = 1000

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const getUserName = (user: User) => user.fullName || user.username

const getDestinationWarehouseId = (shipment: ShipmentRecord) => (
  shipment.destinationWarehouseId || shipment.destinationBranchId
)

const getShipmentItemMap = (shipment: ShipmentRecord) => (
  new Map(shipment.items.map(item => [item.id, item]))
)

const getExecutionItemMap = (execution: ShipmentExecutionRecord) => (
  new Map(execution.items.map(item => [item.id, item]))
)

const resolveItemStatus = (item: TransferReceiptItem, rejected = false): TransferReceiptItemStatus => {
  if(rejected) return 'REJECTED'
  if(item.damagedQuantity > 0) return item.acceptedQuantity > 0 ? 'DAMAGED' : 'DAMAGED'
  if(item.missingQuantity > 0) return item.acceptedQuantity > 0 ? 'PARTIAL' : 'MISSING'
  if(item.extraQuantity > 0) return 'PARTIAL'
  if(item.acceptedQuantity >= item.expectedQuantity && item.expectedQuantity > 0) return 'ACCEPTED'
  return item.acceptedQuantity > 0 ? 'PARTIAL' : 'PENDING'
}

const validateItem = (item: TransferReceiptItem) => {
  const values = [
    item.expectedQuantity,
    item.receivedQuantity,
    item.missingQuantity,
    item.extraQuantity,
    item.damagedQuantity,
    item.acceptedQuantity
  ]

  if(values.some(value => !Number.isFinite(value) || value < 0)){
    throw new Error('Transfer Receipt miktarları negatif olamaz.')
  }
  if(item.receivedQuantity > item.expectedQuantity + item.extraQuantity){
    throw new Error('Received Quantity, Shipped Quantity + Extra Quantity değerini geçemez.')
  }
  if(item.acceptedQuantity !== roundQuantity(item.receivedQuantity - item.damagedQuantity)){
    throw new Error('Accepted Quantity, Received - Damaged formülüne eşit olmalıdır.')
  }
  if(item.acceptedQuantity < 0){
    throw new Error('Accepted Quantity negatif olamaz.')
  }
}

const buildInspectedItems = (
  receipt: TransferReceiptRecord,
  quantities: TransferReceiptQuantityPatch,
  rejected = false
) => (
  receipt.items.map(item => {
    const patch = quantities[item.id]
    const receivedQuantity = rejected ? 0 : roundQuantity(patch?.receivedQuantity ?? item.receivedQuantity)
    const extraQuantity = rejected ? 0 : roundQuantity(Math.max(patch?.extraQuantity ?? item.extraQuantity, Math.max(0, receivedQuantity - item.expectedQuantity)))
    const missingQuantity = rejected ? item.expectedQuantity : roundQuantity(Math.max(patch?.missingQuantity ?? item.missingQuantity, Math.max(0, item.expectedQuantity - receivedQuantity)))
    const damagedQuantity = rejected ? 0 : roundQuantity(patch?.damagedQuantity ?? item.damagedQuantity)
    const acceptedQuantity = rejected ? 0 : roundQuantity(receivedQuantity - damagedQuantity)
    const nextItem: TransferReceiptItem = {
      ...item,
      receivedQuantity,
      missingQuantity,
      extraQuantity,
      damagedQuantity,
      acceptedQuantity,
      status: 'PENDING',
      notes: patch?.notes.trim() ?? item.notes
    }

    nextItem.status = resolveItemStatus(nextItem, rejected)
    validateItem(nextItem)
    return nextItem
  })
)

const resolveReceiptResult = (items: TransferReceiptItem[]): TransferReceiptResult => {
  if(items.every(item => item.acceptedQuantity <= 0)) return 'REJECTED'
  if(items.some(item => (
    item.missingQuantity > 0
    || item.extraQuantity > 0
    || item.damagedQuantity > 0
    || item.acceptedQuantity < item.expectedQuantity
  ))) return 'PARTIAL'
  return 'SUCCESS'
}

const createAcceptedInventoryLot = ({
  receipt,
  sourceLot,
  warehouseId,
  quantity,
  stockItemId,
  index,
  now
}: {
  receipt: TransferReceiptRecord
  sourceLot: InventoryLot
  warehouseId: string
  quantity: number
  stockItemId: string
  index: number
  now: string
}): InventoryLot => ({
  id: createId('transfer_receipt_lot'),
  lotNo: `${receipt.receiptNo}-LOT-${String(index + 1).padStart(2, '0')}`,
  stockItemId,
  goodsReceiptId: '',
  supplierId: sourceLot.supplierId,
  warehouseId,
  productionDate: sourceLot.productionDate,
  expiryDate: sourceLot.expiryDate,
  receivedQuantity: quantity,
  remainingQuantity: quantity,
  unit: sourceLot.unit,
  status: resolveInventoryLotStatus('ACTIVE', quantity, sourceLot.expiryDate),
  notes: `Transfer Receipt: ${receipt.receiptNo}. Source Lot: ${sourceLot.lotNo}.`,
  createdAt: now,
  updatedAt: now
})

const applyAcceptedInventoryLots = ({
  receipt,
  execution,
  shipment,
  inventoryLots
}: {
  receipt: TransferReceiptRecord
  execution: ShipmentExecutionRecord
  shipment: ShipmentRecord
  inventoryLots: InventoryLot[]
}) => {
  const executionItemMap = getExecutionItemMap(execution)
  const shipmentItemMap = getShipmentItemMap(shipment)
  const warehouseId = receipt.warehouseId || getDestinationWarehouseId(shipment)
  const now = new Date().toISOString()
  const createdInventoryLots: InventoryLot[] = []
  let nextInventoryLots = [...inventoryLots]

  receipt.items.forEach((receiptItem, index) => {
    if(receiptItem.acceptedQuantity <= 0) return

    const executionItem = executionItemMap.get(receiptItem.executionItemId)
    const shipmentItem = executionItem ? shipmentItemMap.get(executionItem.shipmentItemId) : null
    const sourceLot = shipmentItem ? inventoryLots.find(lot => lot.id === shipmentItem.inventoryLotId) : null

    if(!executionItem || !shipmentItem || !sourceLot){
      throw new Error('Transfer Receipt item ilişkisi çözümlenemedi.')
    }

    const existingLot = nextInventoryLots.find(lot => (
      lot.lotNo.startsWith(`${receipt.receiptNo}-LOT-`)
      && lot.notes.includes(`Transfer Receipt: ${receipt.receiptNo}`)
      && lot.notes.includes(`Source Lot: ${sourceLot.lotNo}`)
    ))

    if(existingLot){
      const updatedLot: InventoryLot = {
        ...existingLot,
        receivedQuantity: receiptItem.acceptedQuantity,
        remainingQuantity: receiptItem.acceptedQuantity,
        status: resolveInventoryLotStatus(existingLot.status, receiptItem.acceptedQuantity, existingLot.expiryDate),
        updatedAt: now
      }
      nextInventoryLots = nextInventoryLots.map(lot => lot.id === existingLot.id ? updatedLot : lot)
      return
    }

    const nextLot = createAcceptedInventoryLot({
      receipt,
      sourceLot,
      warehouseId,
      quantity: receiptItem.acceptedQuantity,
      stockItemId: shipmentItem.stockItemId,
      index,
      now
    })

    createdInventoryLots.push(nextLot)
    nextInventoryLots = [nextLot, ...nextInventoryLots]
  })

  return {
    inventoryLots: nextInventoryLots,
    createdInventoryLots
  }
}

export const startTransferReceiptInspection = (
  receipt: TransferReceiptRecord,
  user: User
): TransferReceiptRecord => {
  if(receipt.status !== 'PENDING') throw new Error('Kontrol yalnızca PENDING receipt için başlatılabilir.')

  return {
    ...receipt,
    status: 'INSPECTING',
    receivedBy: receipt.receivedBy || getUserName(user),
    updatedAt: new Date().toISOString()
  }
}

export const completeTransferReceipt = ({
  receipt,
  execution,
  shipment,
  inventoryLots,
  quantities,
  notes,
  user
}: {
  receipt: TransferReceiptRecord
  execution: ShipmentExecutionRecord
  shipment: ShipmentRecord
  inventoryLots: InventoryLot[]
  quantities: TransferReceiptQuantityPatch
  notes: string
  user: User
}): ReceiptInventoryResult => {
  if(receipt.status !== 'PENDING' && receipt.status !== 'INSPECTING'){
    throw new Error('Tamamlanmış Transfer Receipt tekrar işlenemez.')
  }

  const items = buildInspectedItems(receipt, quantities)
  const result = resolveReceiptResult(items)
  const now = new Date().toISOString()
  const nextReceipt: TransferReceiptRecord = {
    ...receipt,
    status: result === 'REJECTED' ? 'REJECTED' : 'COMPLETED',
    result,
    receivedBy: receipt.receivedBy || getUserName(user),
    notes: notes.trim(),
    updatedAt: now,
    items
  }
  const inventoryResult = result === 'REJECTED'
    ? { inventoryLots, createdInventoryLots: [] }
    : applyAcceptedInventoryLots({
      receipt: nextReceipt,
      execution,
      shipment,
      inventoryLots
    })
  const nextExecution: ShipmentExecutionRecord = {
    ...execution,
    status: result === 'SUCCESS' ? 'DELIVERED' : result === 'PARTIAL' ? 'PARTIALLY_DELIVERED' : 'CANCELLED',
    deliveredBy: execution.deliveredBy || getUserName(user),
    deliveredAt: execution.deliveredAt || now,
    deliveryResult: result === 'SUCCESS' ? 'SUCCESS' : result === 'PARTIAL' ? 'PARTIAL' : 'FAILED',
    deliveryNotes: notes.trim(),
    updatedAt: now
  }

  return {
    receipt: nextReceipt,
    execution: nextExecution,
    inventoryLots: inventoryResult.inventoryLots,
    createdInventoryLots: inventoryResult.createdInventoryLots
  }
}

export const rejectTransferReceipt = ({
  receipt,
  execution,
  quantities,
  notes,
  user
}: {
  receipt: TransferReceiptRecord
  execution: ShipmentExecutionRecord
  quantities: TransferReceiptQuantityPatch
  notes: string
  user: User
}) => {
  if(receipt.status !== 'PENDING' && receipt.status !== 'INSPECTING'){
    throw new Error('Tamamlanmış Transfer Receipt reddedilemez.')
  }

  const now = new Date().toISOString()
  const nextReceipt: TransferReceiptRecord = {
    ...receipt,
    status: 'REJECTED',
    result: 'REJECTED',
    receivedBy: receipt.receivedBy || getUserName(user),
    notes: notes.trim(),
    updatedAt: now,
    items: buildInspectedItems(receipt, quantities, true)
  }
  const nextExecution: ShipmentExecutionRecord = {
    ...execution,
    status: 'CANCELLED',
    deliveredBy: execution.deliveredBy || getUserName(user),
    deliveredAt: execution.deliveredAt || now,
    deliveryResult: 'FAILED',
    deliveryNotes: notes.trim(),
    updatedAt: now
  }

  return {
    receipt: nextReceipt,
    execution: nextExecution
  }
}

export const cancelTransferReceipt = (
  receipt: TransferReceiptRecord,
  user: User
): TransferReceiptRecord => {
  if(receipt.status === 'COMPLETED' || receipt.status === 'REJECTED'){
    throw new Error('Tamamlanmış veya reddedilmiş Transfer Receipt iptal edilemez.')
  }

  return {
    ...receipt,
    status: 'CANCELLED',
    receivedBy: receipt.receivedBy || getUserName(user),
    updatedAt: new Date().toISOString()
  }
}
