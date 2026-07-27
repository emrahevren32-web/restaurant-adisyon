import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import type { StockUnit } from '../types'

export type ShipmentFormType =
  | 'VEHICLE_CONTROL'
  | 'LOADING_CONTROL'
  | 'COLD_CHAIN'
  | 'VEHICLE_TEMPERATURE'
  | 'DELIVERY'
  | 'DRIVER_HANDOVER'
  | 'SHIPMENT_APPROVAL'
  | 'RETURN_DELIVERY'

export type ShipmentFormStatus =
  | 'DRAFT'
  | 'PREPARING'
  | 'LOADING'
  | 'ON_ROUTE'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED'

export type ShipmentChecklistKey =
  | 'VEHICLE_CLEANING'
  | 'VEHICLE_DOCUMENTS'
  | 'FUEL_CHECK'
  | 'COOLING_SYSTEM'
  | 'DOOR_LOCK'
  | 'PRODUCT_PLACEMENT'
  | 'PALLET_FIXING'
  | 'LABEL_VERIFICATION'
  | 'LOT_VERIFICATION'
  | 'DELIVERY_NOTE_VERIFICATION'
  | 'DELIVERY_SIGNATURE'

export type ShipmentChecklistStatus =
  | 'PASS'
  | 'WARNING'
  | 'FAIL'
  | 'NOT_APPLICABLE'

export type ShipmentTemperatureStage =
  | 'START'
  | 'AFTER_LOADING'
  | 'DEPARTURE'
  | 'DELIVERY'

export type ShipmentHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'PREPARING'
  | 'LOADING'
  | 'ON_ROUTE'
  | 'DELIVERED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'
  | 'VALIDATION'

export type ShipmentFormTemplateChecklist = {
  id: string
  templateId: string
  checklistKey: ShipmentChecklistKey
  label: string
  description: string
  required: boolean
  displayOrder: number
}

export type ShipmentFormTemplate = {
  id: string
  formType: ShipmentFormType
  name: string
  version: string
  description: string
  isActive: boolean
  checklist: ShipmentFormTemplateChecklist[]
  createdAt: string
  updatedAt: string
}

export type ShipmentChecklist = {
  id: string
  formId: string
  checklistKey: ShipmentChecklistKey
  label: string
  description: string
  status: ShipmentChecklistStatus
  notes: string
  required: boolean
}

export type ShipmentTemperatureLog = {
  id: string
  formId: string
  stage: ShipmentTemperatureStage
  label: string
  temperatureC: number
  loggedAt: string
  result: ShipmentChecklistStatus
  notes: string
}

export type ShipmentFormItem = {
  id: string
  formId: string
  productId: string
  productName: string
  stockItemId: string
  stockItemName: string
  lotId: string
  lotNo: string
  batchNo: string
  labelId: string
  labelNo: string
  quantity: number
  unit: StockUnit
  boxCount: number
  palletCount: number
}

export type ShipmentHistory = {
  id: string
  formId: string
  action: ShipmentHistoryAction
  actorName: string
  description: string
  createdAt: string
}

export type ShipmentForm = {
  id: string
  formNo: string
  formType: ShipmentFormType
  status: ShipmentFormStatus
  templateId: string
  templateName: string
  templateVersion: string
  shipmentId: string
  shipmentNo: string
  deliveryNoteId: string
  deliveryNoteNo: string
  shipmentPlanId: string
  shipmentPlanNo: string
  vehicleId: string
  vehicleNo: string
  vehiclePlate: string
  driverName: string
  warehouseId: string
  warehouseName: string
  branchId: string
  branchName: string
  customerId: string
  customerName: string
  loadingDate: string
  deliveryDate: string
  description: string
  items: ShipmentFormItem[]
  checklist: ShipmentChecklist[]
  temperatureLogs: ShipmentTemperatureLog[]
  history: ShipmentHistory[]
  sourceType: 'DeliveryNote' | 'Shipment' | 'Return' | 'ManualReadModel'
  sourceId: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ShipmentStatistics = {
  todayShipments: number
  loaded: number
  delivered: number
  returned: number
  pending: number
  totalShipments: number
  totalDeliveries: number
  deliverySuccessRate: number
  returnRate: number
  vehicleRows: BarChartRow[]
  driverRows: BarChartRow[]
  branchRows: BarChartRow[]
  statusRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type ShipmentFormFilters = {
  status: ShipmentFormStatus | 'all'
  formType: ShipmentFormType | 'all'
  vehicleId: string
  driverName: string
  branchId: string
  customerId: string
  warehouseId: string
  date: string
  search: string
}

export type ShipmentFormCreateInput = {
  deliveryNoteId: string
  formType: ShipmentFormType
  loadingDate: string
  deliveryDate: string
  description: string
}

export type ShipmentFormValidationResult = {
  valid: boolean
  errors: string[]
}

export type ShipmentFormPrintMode = 'A4' | 'PDF'
