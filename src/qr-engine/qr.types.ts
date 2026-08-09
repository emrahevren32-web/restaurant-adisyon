export type QRModuleKey =
  | 'lots'
  | 'production-orders'
  | 'samples'
  | 'witness-samples'
  | 'shipments'
  | 'waste'
  | 'recipes'

export type QREntityType =
  | 'LOT'
  | 'PRODUCTION_ORDER'
  | 'QUALITY_SAMPLE'
  | 'WITNESS_SAMPLE'
  | 'SHIPMENT'
  | 'WASTE_RECORD'
  | 'RECIPE'

export type QRPrintMode =
  | 'SINGLE'
  | 'MULTIPLE'
  | 'LABEL'
  | 'A4'

export type QRJobOperation =
  | 'GENERATE'
  | 'VALIDATE'
  | 'DECODE'
  | 'PRINT'

export type QRJobStatus =
  | 'SUCCESS'
  | 'FAILED'

export type QRMetadata = {
  engine: 'IKERP_QR'
  moduleKey: QRModuleKey
  entityType: QREntityType
  entityId: string
  code: string
  lotNo: string
  batch: string
  date: string
  version: string
}

export type QRGenerateInput = {
  moduleKey: QRModuleKey
  entityType: QREntityType
  entityId: string
  code: string
  lotNo?: string
  batch?: string
  date?: string
  version?: string | number
  title?: string
  description?: string
}

export type QRRecord = {
  id: string
  moduleKey: QRModuleKey
  moduleLabel: string
  entityType: QREntityType
  entityLabel: string
  entityId: string
  code: string
  lotNo: string
  batch: string
  date: string
  version: string
  payload: string
  title: string
  description: string
  immutable: true
  createdBy: string
  createdAt: string
}

export type QRValidationResult = {
  valid: boolean
  errors: string[]
}

export type QRDecodeResult = QRValidationResult & {
  metadata: QRMetadata | null
  record: QRRecord | null
  moduleLabel: string
  entityLabel: string
  entityExists: boolean
}

export type QRPreviewResult = {
  record: QRRecord
  imageDataUrl: string
  validation: QRValidationResult
  decode: QRDecodeResult
}

export type QRPrintInput = {
  records: Array<QRRecord | QRGenerateInput>
  mode: QRPrintMode
  quantity: number
  userName: string
}

export type QRJob = {
  id: string
  operation: QRJobOperation
  status: QRJobStatus
  userName: string
  moduleKey: QRModuleKey
  moduleLabel: string
  entityType: QREntityType
  entityId: string
  code: string
  recordCount: number
  createdAt: string
  message: string
}
