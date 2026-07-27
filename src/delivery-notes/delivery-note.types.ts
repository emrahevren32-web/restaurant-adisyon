import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import type { ShipmentPlanRecord, ShipmentPlanStop } from '../shipment-plans/shipment-plan.types'
import type { ShipmentVehicleLoad, ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import type { ShipmentWorkOrderRecord } from '../shipment-work-orders/shipment-work-order.types'
import type { ShipmentRecord } from '../shipments/shipment.types'
import type { Branch, StockItem, StockUnit } from '../types'

export type DeliveryNoteStatus =
  | 'DRAFT'
  | 'READY'
  | 'PRINTED'
  | 'LOADED'
  | 'DELIVERED'
  | 'CANCELLED'

export type DeliveryNoteHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'
  | 'LOADED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'VALIDATION'

export type DeliveryNoteHistory = {
  id: string
  deliveryNoteId: string
  action: DeliveryNoteHistoryAction
  actorName: string
  description: string
  createdAt: string
}

export type DeliveryNoteItem = {
  id: string
  deliveryNoteId: string
  productId: string
  productName: string
  stockItemId: string
  stockItemName: string
  lotId: string
  lotNo: string
  productionOrderId: string
  productionOrderNo: string
  shipmentId: string
  shipmentNo: string
  shipmentPlanStopId: string
  palletId: string
  palletNo: string
  quantity: number
  unit: StockUnit
  boxCount: number
  palletCount: number
  netWeight: number
  grossWeight: number
  unitCost: number
  totalCost: number
}

export type DeliveryNote = {
  id: string
  deliveryNoteNo: string
  date: string
  branchId: string
  branchName: string
  warehouseId: string
  warehouseName: string
  customerId: string
  customerName: string
  vehicleId: string
  vehicleNo: string
  vehiclePlate: string
  driverName: string
  shipmentPlanId: string
  shipmentPlanNo: string
  shipmentId: string
  shipmentNo: string
  status: DeliveryNoteStatus
  description: string
  items: DeliveryNoteItem[]
  history: DeliveryNoteHistory[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type DeliveryNoteStatistics = {
  todayNotes: number
  readyNotes: number
  deliveredNotes: number
  cancelledNotes: number
  pendingNotes: number
  totalNotes: number
  totalProducts: number
  totalBoxes: number
  totalPallets: number
  totalNetWeight: number
  totalGrossWeight: number
  totalCost: number
  deliveryRate: number
}

export type DeliveryNoteFilters = {
  status: DeliveryNoteStatus | 'all'
  branchId: string
  warehouseId: string
  customerId: string
  vehicleId: string
  driverName: string
  date: string
  search: string
}

export type DeliveryNoteValidationResult = {
  valid: boolean
  errors: string[]
}

export type DeliveryNotePrintMode = 'A4' | 'PDF'

export type DeliveryNoteLineSource = {
  plan: ShipmentPlanRecord
  stop: ShipmentPlanStop
  vehicle: ShipmentVehicleRecord
  vehicleLoad: ShipmentVehicleLoad
  pallet: ShipmentPalletRecord
  palletItem: ShipmentPalletRecord['items'][number]
  workOrder: ShipmentWorkOrderRecord | null
  shipment: ShipmentRecord | null
  lot: InventoryLot | null
  stockItem: StockItem | null
  branch: Branch | null
}

export type DeliveryNoteReadModelContext = {
  sourceData: KpiSourceData
  costByProductId: Map<string, number>
}
