export type ShipmentExecutionStatus =
  | 'PENDING'
  | 'PICKING'
  | 'PACKING'
  | 'READY_TO_SHIP'
  | 'SHIPPED'
  | 'PARTIALLY_DELIVERED'
  | 'DELIVERED'
  | 'CANCELLED'

export type ShipmentExecutionItemStatus =
  | 'PENDING'
  | 'PICKED'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'PARTIAL'
  | 'CANCELLED'

export type ShipmentDeliveryResult =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'FAILED'
  | 'RETURNED'

export type ShipmentExecution = {
  id: string
  shipmentId: string
  executionNo: string
  status: ShipmentExecutionStatus
  pickedBy: string
  packedBy: string
  shippedBy: string
  deliveredBy: string
  pickedAt: string
  packedAt: string
  shippedAt: string
  deliveredAt: string
  deliveryNotes: string
  deliveryResult: ShipmentDeliveryResult | ''
  createdAt: string
  updatedAt: string
}

export type ShipmentExecutionItem = {
  id: string
  executionId: string
  shipmentItemId: string
  plannedQuantity: number
  pickedQuantity: number
  packedQuantity: number
  shippedQuantity: number
  deliveredQuantity: number
  remainingQuantity: number
  status: ShipmentExecutionItemStatus
  notes: string
}

export type ShipmentExecutionRecord = ShipmentExecution & {
  items: ShipmentExecutionItem[]
}
