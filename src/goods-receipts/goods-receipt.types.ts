import type { StockUnit } from '../types'

export type GoodsReceiptLegacyStatus =
  | 'DRAFT'
  | 'RECEIVED'
  | 'PARTIALLY_RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED'

export type GoodsReceiptManagementStatus =
  | 'WAITING'
  | 'INSPECTING'
  | 'ACCEPTED'
  | 'PARTIAL_ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'

export type GoodsReceiptStatus = GoodsReceiptLegacyStatus | GoodsReceiptManagementStatus

export type GoodsReceiptInspectionCriterionStatus = 'PASS' | 'WARNING' | 'FAIL'

export type GoodsReceiptInspectionResult = 'PASS' | 'CONDITIONAL' | 'FAIL'

export type GoodsReceiptHistoryAction =
  | 'CREATED'
  | 'INSPECTION_STARTED'
  | 'INSPECTION_COMPLETED'
  | 'ACCEPTED'
  | 'PARTIAL_ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'
  | 'VALIDATION'

export type GoodsReceiptInspection = {
  id: string
  receiptId: string
  temperatureC: number
  packagingCheck: GoodsReceiptInspectionCriterionStatus
  labelCheck: GoodsReceiptInspectionCriterionStatus
  expiryCheck: GoodsReceiptInspectionCriterionStatus
  lotCheck: GoodsReceiptInspectionCriterionStatus
  visualCheck: GoodsReceiptInspectionCriterionStatus
  hygieneCheck: GoodsReceiptInspectionCriterionStatus
  result: GoodsReceiptInspectionResult
  haccpTemperatureRecord: string
  correctiveActionNote: string
  checkedBy: string
  checkedAt: string
  notes: string
}

export type GoodsReceiptHistory = {
  id: string
  receiptId: string
  action: GoodsReceiptHistoryAction
  actorName: string
  description: string
  createdAt: string
}

export type GoodsReceipt = {
  id: string
  receiptNo: string
  goodsReceiptNo?: string
  purchaseOrderId: string
  purchaseOrderNo?: string
  supplierId: string
  supplierName?: string
  warehouseId: string
  warehouseName?: string
  receiptDate: string
  vehiclePlate?: string
  deliveredBy?: string
  receivedBy: string
  receivedByName?: string
  status: GoodsReceiptStatus
  notes: string
  description?: string
  inspection?: GoodsReceiptInspection
  history?: GoodsReceiptHistory[]
  createdAt: string
  updatedAt: string
}

export type GoodsReceiptItem = {
  id: string
  receiptId: string
  purchaseOrderItemId: string
  stockItemId: string
  orderedQuantity: number
  receivedQuantity: number
  acceptedQuantity: number
  rejectedQuantity: number
  unit: StockUnit
  productName?: string
  stockItemName?: string
  lotId?: string
  lotNo?: string
  batchNo?: string
  packageType?: string
  netWeight?: number
  grossWeight?: number
  unitCost?: number
  totalCost?: number
  qualitySampleNo?: string
  haccpPlanName?: string
  notes: string
}

export type GoodsReceiptRecord = GoodsReceipt & {
  items: GoodsReceiptItem[]
}

export type GoodsReceiptStatistics = {
  todayReceipts: number
  waitingReceipts: number
  acceptedReceipts: number
  rejectedReceipts: number
  partialAcceptedReceipts: number
  totalReceipts: number
  totalProducts: number
  totalSuppliers: number
  totalQuantity: number
  totalNetWeight: number
  totalGrossWeight: number
  totalCost: number
  rejectionRate: number
  acceptanceRate: number
}

export type GoodsReceiptFilters = {
  status: GoodsReceiptManagementStatus | 'all'
  supplierId: string
  warehouseId: string
  date: string
  search: string
}

export type GoodsReceiptValidationResult = {
  valid: boolean
  errors: string[]
}

export type GoodsReceiptPrintMode = 'A4' | 'PDF'
