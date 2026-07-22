import type { StockUnit } from '../types'

export type ShipmentPalletStatus =
  | 'EMPTY'
  | 'BUILDING'
  | 'READY'
  | 'LOADED'
  | 'SHIPPED'
  | 'DELIVERED'

export type ShipmentPallet = {
  id: string
  palletNo: string
  workOrderId: string
  warehouseId: string
  status: ShipmentPalletStatus
  grossWeight: number
  netWeight: number
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ShipmentPalletItem = {
  id: string
  palletId: string
  workOrderItemId: string
  stockItemId: string
  inventoryLotId: string
  quantity: number
  unit: StockUnit
  notes: string
}

export type ShipmentPalletRecord = ShipmentPallet & {
  items: ShipmentPalletItem[]
}
