import type { StockUnit } from '../types'

export type ShipmentStatus =
  | 'DRAFT'
  | 'PLANNED'
  | 'PICKING'
  | 'READY'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'

export type ShipmentPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type Shipment = {
  id: string
  shipmentNo: string
  shipmentDate: string
  plannedDeliveryDate: string
  sourceWarehouseId: string
  destinationBranchId: string
  destinationWarehouseId: string
  status: ShipmentStatus
  priority: ShipmentPriority
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ShipmentItem = {
  id: string
  shipmentId: string
  inventoryLotId: string
  stockItemId: string
  quantity: number
  unit: StockUnit
  notes: string
}

export type ShipmentRecord = Shipment & {
  items: ShipmentItem[]
}
