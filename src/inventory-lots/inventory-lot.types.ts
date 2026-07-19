import type { StockUnit } from '../types'

export type InventoryLotStatus =
  | 'ACTIVE'
  | 'QUARANTINE'
  | 'BLOCKED'
  | 'EXPIRED'
  | 'CONSUMED'

export type InventoryLot = {
  id: string
  lotNo: string
  stockItemId: string
  goodsReceiptId: string
  supplierId: string
  warehouseId: string
  productionDate: string
  expiryDate: string
  receivedQuantity: number
  remainingQuantity: number
  unit: StockUnit
  status: InventoryLotStatus
  notes: string
  createdAt: string
  updatedAt: string
}
