export type PrintModuleKey =
  | 'recipes'
  | 'production-orders'
  | 'purchase-requests'
  | 'goods-receipts'
  | 'shipments'
  | 'lots'
  | 'samples'
  | 'waste'

export type PrintOutputType =
  | 'A4'
  | 'A5'
  | 'LABEL'
  | 'BARCODE_LABEL'
  | 'QR_LABEL'

export type PrintOrientation =
  | 'PORTRAIT'
  | 'LANDSCAPE'

export type PrintJobStatus =
  | 'SUCCESS'
  | 'FAILED'

export type PrintField = {
  label: string
  value: string | number | boolean
}

export type PrintTableSection = {
  title: string
  columns: string[]
  rows: Array<Array<string | number | boolean>>
}

export type PrintDocumentInput = {
  moduleKey: PrintModuleKey
  entityId: string
  entityCode: string
  title: string
  subtitle?: string
  fields: PrintField[]
  tables?: PrintTableSection[]
  notes?: string
  barcodeValue?: string
  qrPayload?: string
}

export type PrintTemplate = {
  id: string
  moduleKey: PrintModuleKey
  moduleLabel: string
  outputType: PrintOutputType
  name: string
  description: string
  active: boolean
}

export type PrintPrinter = {
  id: string
  name: string
  outputTypes: PrintOutputType[]
  isDefault: boolean
}

export type PrintRequest = {
  moduleKey: PrintModuleKey
  documents: PrintDocumentInput[]
  userName: string
  templateId?: string
  outputType?: PrintOutputType
  printerId?: string
  copies?: number
  orientation?: PrintOrientation
}

export type PrintValidationResult = {
  valid: boolean
  errors: string[]
}

export type PrintPreviewResult = {
  html: string
  validation: PrintValidationResult
  template: PrintTemplate
  printer: PrintPrinter
}

export type PrintJob = {
  id: string
  status: PrintJobStatus
  moduleKey: PrintModuleKey
  moduleLabel: string
  templateId: string
  templateName: string
  outputType: PrintOutputType
  printerId: string
  printerName: string
  copies: number
  orientation: PrintOrientation
  documentCount: number
  userName: string
  createdAt: string
  message: string
}
