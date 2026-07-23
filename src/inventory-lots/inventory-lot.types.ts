import type { StockUnit } from '../types'

export type InventoryLotStatus =
  | 'PLANNED'
  | 'ACTIVE'
  | 'QUARANTINE'
  | 'RELEASED'
  | 'CONSUMED'
  | 'EXPIRED'
  | 'DISPOSED'
  | 'BLOCKED'
  | 'RETURNED'

export type InventoryLot = {
  id: string
  lotNo: string
  productionOrderId: string
  productId: string
  warehouseId: string
  productionDate: string
  expiryDate: string
  quantity: number
  unit: StockUnit
  status: InventoryLotStatus
  notes: string
  createdAt: string
  updatedAt: string
  stockItemId: string
  goodsReceiptId: string
  supplierId: string
  receivedQuantity: number
  remainingQuantity: number
}
