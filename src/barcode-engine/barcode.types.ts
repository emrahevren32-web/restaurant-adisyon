export type BarcodeModuleKey =
  | 'raw-materials'
  | 'lots'
  | 'production-orders'
  | 'shipments'
  | 'samples'
  | 'witness-samples'
  | 'waste'

export type BarcodeEntityType =
  | 'RAW_MATERIAL'
  | 'LOT'
  | 'PRODUCTION_ORDER'
  | 'SHIPMENT'
  | 'QUALITY_SAMPLE'
  | 'WITNESS_SAMPLE'
  | 'WASTE_RECORD'

export type BarcodeType =
  | 'CODE128'
  | 'CODE39'
  | 'EAN13'
  | 'QR'

export type BarcodePrintMode =
  | 'SINGLE'
  | 'MULTIPLE'
  | 'BULK'

export type BarcodeJobOperation =
  | 'GENERATE'
  | 'READ'
  | 'VALIDATE'
  | 'PRINT'

export type BarcodeJobStatus =
  | 'SUCCESS'
  | 'FAILED'

export type BarcodeGenerateInput = {
  moduleKey: BarcodeModuleKey
  entityType: BarcodeEntityType
  entityId: string
  code: string
  lot?: string
  date?: string
  barcodeType?: BarcodeType
  title?: string
  description?: string
}

export type BarcodeRecord = {
  id: string
  moduleKey: BarcodeModuleKey
  moduleLabel: string
  entityType: BarcodeEntityType
  entityLabel: string
  entityId: string
  barcodeType: BarcodeType
  barcodeValue: string
  qrReference: string
  code: string
  lot: string
  date: string
  title: string
  description: string
  immutable: true
  createdBy: string
  createdAt: string
}

export type BarcodeValidationResult = {
  valid: boolean
  errors: string[]
}

export type BarcodeReadResult = BarcodeValidationResult & {
  record: BarcodeRecord | null
  parsed: Pick<BarcodeRecord, 'entityType' | 'entityId' | 'code' | 'lot' | 'date'> | null
}

export type BarcodePreviewResult = {
  record: BarcodeRecord
  imageDataUrl: string
  qrDataUrl: string
  validation: BarcodeValidationResult
}

export type BarcodePrintInput = {
  records: Array<BarcodeRecord | BarcodeGenerateInput>
  mode: BarcodePrintMode
  quantity: number
  userName: string
}

export type BarcodeJob = {
  id: string
  operation: BarcodeJobOperation
  status: BarcodeJobStatus
  userName: string
  barcodeType: BarcodeType
  moduleKey: BarcodeModuleKey
  moduleLabel: string
  entityType: BarcodeEntityType
  entityId: string
  barcodeValue: string
  recordCount: number
  createdAt: string
  message: string
}
