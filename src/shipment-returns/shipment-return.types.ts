import type { StockUnit } from '../types'

export type ShipmentReturnStatus =
  | 'OPEN'
  | 'COLLECTED'
  | 'RECEIVED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CLOSED'

export type ShipmentReturnType =
  | 'PRODUCT'
  | 'PALLET'
  | 'EQUIPMENT'
  | 'PACKAGE'
  | 'OTHER'

export type ShipmentReturnCondition =
  | 'GOOD'
  | 'DAMAGED'
  | 'EXPIRED'
  | 'BROKEN'
  | 'UNKNOWN'

export type ShipmentReturn = {
  id: string
  returnNo: string
  deliveryId: string
  shipmentPlanId: string
  vehicleId: string
  returnDate: string
  status: ShipmentReturnStatus
  driverName: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type ShipmentReturnItem = {
  id: string
  returnId: string
  deliveryStopId: string
  stockItemId: string
  inventoryLotId: string
  returnType: ShipmentReturnType
  quantity: number
  unit: StockUnit
  reason: string
  condition: ShipmentReturnCondition
  notes: string
}

export type ShipmentReturnRecord = ShipmentReturn & {
  items: ShipmentReturnItem[]
}
