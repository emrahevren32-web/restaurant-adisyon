export type ExcelModuleKey =
  | 'products'
  | 'recipes'
  | 'raw-materials'
  | 'suppliers'
  | 'purchase-requests'
  | 'purchase-orders'
  | 'goods-receipts'
  | 'stock'
  | 'lots'
  | 'waste'
  | 'production-orders'
  | 'quality'
  | 'shipments'
  | 'shipment-forms'
  | 'operation-checklists'
  | 'delivery-notes'
  | 'labels'
  | 'kpi'
  | 'cost-engine'

export type ExcelOperationType = 'IMPORT' | 'EXPORT' | 'TEMPLATE'
export type ExcelJobStatus = 'PENDING' | 'SUCCESS' | 'FAILED'
export type ExcelColumnType = 'string' | 'number' | 'date' | 'boolean'
export type ExcelExportScope = 'ALL' | 'FILTERED' | 'SELECTED'

export type ExcelColumnDefinition = {
  key: string
  header: string
  required: boolean
  type: ExcelColumnType
  example?: string | number | boolean
  allowNegative?: boolean
}

export type ExcelTemplate = {
  id: string
  moduleKey: ExcelModuleKey
  moduleLabel: string
  name: string
  description: string
  columns: ExcelColumnDefinition[]
  importable: boolean
  exportable: boolean
}

export type ExcelRow = Record<string, string | number | boolean>

export type ExcelValidationError = {
  rowNumber: number
  columnKey: string
  columnHeader: string
  message: string
}

export type ExcelJob = {
  id: string
  operationType: ExcelOperationType
  status: ExcelJobStatus
  moduleKeys: ExcelModuleKey[]
  moduleLabel: string
  fileName: string
  userName: string
  recordCount: number
  successCount: number
  failedCount: number
  createdAt: string
  completedAt: string
  message: string
}

export type ExcelHistory = ExcelJob

export type ExcelImportResult = {
  job: ExcelJob
  moduleKey: ExcelModuleKey
  fileName: string
  rows: ExcelRow[]
  validRows: ExcelRow[]
  invalidRows: ExcelRow[]
  errors: ExcelValidationError[]
  createdCount: number
  updatedCount: number
  skippedCount: number
  committed: boolean
}

export type ExcelExportResult = {
  job: ExcelJob
  moduleKeys: ExcelModuleKey[]
  fileName: string
  sheetCount: number
  recordCount: number
}

export type ExcelHistoryFilters = {
  moduleKey: ExcelModuleKey | 'all'
  userName: string
  date: string
  operationType: ExcelOperationType | 'all'
  status: ExcelJobStatus | 'all'
}

export type ExcelDashboardStatistics = {
  todayImports: number
  todayExports: number
  totalJobs: number
  failedJobs: number
  mostExportedModule: string
}

export type ExcelImportPreview = {
  result: ExcelImportResult | null
  selectedFileName: string
  loading: boolean
}

export type ExcelExportOptions = {
  moduleKeys: ExcelModuleKey[]
  scope: ExcelExportScope
  filterText: string
  selectedRecordIds: string[]
  userName: string
}

export type ExcelDataSet = {
  moduleKey: ExcelModuleKey
  moduleLabel: string
  columns: ExcelColumnDefinition[]
  rows: ExcelRow[]
}
