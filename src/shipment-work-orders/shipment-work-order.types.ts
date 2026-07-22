import type { StockUnit } from '../types'

export type ShipmentWorkOrderPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type ShipmentWorkOrderStatus =
  | 'DRAFT'
  | 'WAITING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'READY_FOR_PICKING'
  | 'COMPLETED'
  | 'CANCELLED'

export type ShipmentWorkOrder = {
  id: string
  workOrderNo: string
  title: string
  description: string
  requestDate: string
  plannedShipmentDate: string
  priority: ShipmentWorkOrderPriority
  status: ShipmentWorkOrderStatus
  sourceWarehouseId: string
  destinationBranchId: string
  shipmentIds: string[]
  createdBy: string
  approvedBy: string
  approvedAt: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type ShipmentWorkOrderItem = {
  id: string
  workOrderId: string
  stockItemId: string
  inventoryLotId: string
  requestedQuantity: number
  approvedQuantity: number
  pickedQuantity: number
  unit: StockUnit
  notes: string
}

export type ShipmentWorkOrderRecord = ShipmentWorkOrder & {
  items: ShipmentWorkOrderItem[]
}
