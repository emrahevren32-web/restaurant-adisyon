import type { StockUnit } from '../types'

export type ShipmentWaybillStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'CANCELLED'

export type ShipmentWaybill = {
  id: string
  waybillNo: string
  shipmentPlanId: string
  deliveryId: string
  vehicleId: string
  issueDate: string
  status: ShipmentWaybillStatus
  driverName: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type ShipmentWaybillItem = {
  id: string
  waybillId: string
  deliveryStopId: string
  returnItemId: string
  stockItemId: string
  inventoryLotId: string
  quantity: number
  unit: StockUnit
  notes: string
}

export type ShipmentWaybillRecord = ShipmentWaybill & {
  items: ShipmentWaybillItem[]
}
