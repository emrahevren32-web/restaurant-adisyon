import type { StockUnit } from '../types'

export type LabelType =
  | 'PRODUCT'
  | 'LOT'
  | 'BOX'
  | 'PALLET'
  | 'BLAST_CHILLING'
  | 'SAMPLE'
  | 'WITNESS_SAMPLE'
  | 'WAREHOUSE_SHELF'
  | 'SHIPMENT'

export type LabelStatus =
  | 'DRAFT'
  | 'READY'
  | 'PRINTED'
  | 'CANCELLED'

export type LabelTemplateSize =
  | 'A4'
  | 'MM_50_30'
  | 'MM_70_50'
  | 'MM_100_100'
  | 'CUSTOM'

export type LabelBarcodeType =
  | 'CODE_128'
  | 'QR_CODE'
  | 'DATAMATRIX_PREP'

export type LabelHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'PRINTED'
  | 'BULK_PRINTED'
  | 'EXCEL'
  | 'CANCELLED'
  | 'VALIDATION'

export type LabelPrintMode =
  | 'SINGLE'
  | 'BULK'
  | 'LOT'
  | 'PRODUCTION_ORDER'
  | 'PALLET'

export type Label = {
  id: string
  labelNo: string
  labelType: LabelType
  status: LabelStatus
  templateId: string
  templateName: string
  templateSize: LabelTemplateSize
  barcodeType: LabelBarcodeType
  barcodeValue: string
  qrPayload: string
  dataMatrixPayload: string
  productId: string
  productCode: string
  productName: string
  lotId: string
  lotNo: string
  batchNo: string
  productionDate: string
  expiryDate: string
  netWeight: number
  grossWeight: number
  unit: StockUnit
  warehouseId: string
  warehouseName: string
  branchId: string
  branchName: string
  productionOrderId: string
  productionOrderNo: string
  recipeId: string
  recipeCode: string
  recipeName: string
  shipmentId: string
  shipmentNo: string
  customerId: string
  customerName: string
  sampleId: string
  sampleNo: string
  witnessSampleId: string
  witnessNo: string
  haccpPlanId: string
  haccpPlanName: string
  palletId: string
  palletNo: string
  description: string
  createdBy: string
  createdAt: string
  updatedAt: string
  history: LabelHistory[]
}

export type LabelTemplate = {
  id: string
  name: string
  size: LabelTemplateSize
  widthMm: number
  heightMm: number
  columns: number
  rows: number
  description: string
  supportedTypes: LabelType[]
  active: boolean
}

export type LabelHistory = {
  id: string
  labelId: string
  action: LabelHistoryAction
  actorName: string
  quantity: number
  description: string
  createdAt: string
}

export type LabelPrintJob = {
  id: string
  labelIds: string[]
  labelNos: string[]
  templateId: string
  templateName: string
  printMode: LabelPrintMode
  quantity: number
  actorName: string
  printedAt: string
  status: 'SUCCESS' | 'FAILED'
  message: string
}

export type LabelStatistics = {
  todayPrinted: number
  totalPrinted: number
  totalLabels: number
  readyLabels: number
  printedLabels: number
  topPrintedProduct: string
  topPrintedLot: string
  totalTemplates: number
}

export type LabelFilters = {
  branchId: string
  warehouseId: string
  labelType: LabelType | 'all'
  date: string
  search: string
}

export type LabelValidationResult = {
  valid: boolean
  errors: string[]
}

export type LabelCreateInput = {
  lotId: string
  labelType: LabelType
  templateId: string
  quantity: number
  actorName: string
}
