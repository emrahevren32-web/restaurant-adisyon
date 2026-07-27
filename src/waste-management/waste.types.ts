import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import type { StockUnit } from '../types'

export type WasteStatus =
  | 'DRAFT'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'

export type WasteType =
  | 'PRODUCTION'
  | 'GOODS_RECEIPT'
  | 'BLAST_CHILLING'
  | 'WAREHOUSE'
  | 'PACKAGING'
  | 'SHIPMENT'
  | 'QUALITY_REJECTION'
  | 'SAMPLE_USAGE'
  | 'OTHER'

export type WasteReason =
  | 'PRODUCTION_ERROR'
  | 'TEMPERATURE_ISSUE'
  | 'DAMAGED_PACKAGING'
  | 'EXPIRED'
  | 'TRANSPORT_DAMAGE'
  | 'QUALITY_REJECTION'
  | 'HUMAN_ERROR'
  | 'MACHINE_FAILURE'
  | 'OTHER'

export type WasteHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'
  | 'VALIDATION'

export type WasteCategory = {
  id: WasteType
  label: string
  description: string
}

export type WasteHistory = {
  id: string
  wasteRecordId: string
  action: WasteHistoryAction
  actorName: string
  description: string
  createdAt: string
}

export type WasteItem = {
  id: string
  wasteRecordId: string
  productId: string
  productName: string
  stockItemId: string
  stockItemName: string
  lotId: string
  lotNo: string
  batchNo: string
  quantity: number
  unit: StockUnit
  unitCost: number
  totalCost: number
}

export type WasteRecord = {
  id: string
  wasteNo: string
  wasteType: WasteType
  wasteReason: WasteReason
  status: WasteStatus
  productId: string
  productName: string
  stockItemId: string
  stockItemName: string
  lotId: string
  lotNo: string
  batchNo: string
  quantity: number
  unit: StockUnit
  warehouseId: string
  warehouseName: string
  branchId: string
  branchName: string
  productionOrderId: string
  productionOrderNo: string
  recipeId: string
  recipeName: string
  supplierId: string
  supplierName: string
  date: string
  description: string
  qualityDecision: string
  haccpReference: string
  correctiveAction: string
  photoNote: string
  sourceType: 'StockWasteRecord' | 'GoodsReceipt' | 'ManualReadModel'
  sourceId: string
  unitCost: number
  totalCost: number
  currency: string
  items: WasteItem[]
  history: WasteHistory[]
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type WasteStatistics = {
  todayWaste: number
  totalWaste: number
  totalWasteCost: number
  topProductName: string
  topWarehouseName: string
  wasteRate: number
  totalQuantity: number
  productCount: number
  categoryRows: BarChartRow[]
  productRows: BarChartRow[]
  warehouseRows: BarChartRow[]
  branchRows: BarChartRow[]
  reasonRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type WasteAnalysis = {
  topProducts: BarChartRow[]
  topRecipes: BarChartRow[]
  topSuppliers: BarChartRow[]
  costRows: BarChartRow[]
  trend: ChartSeries
  recommendations: string[]
}

export type WasteFilters = {
  status: WasteStatus | 'all'
  wasteType: WasteType | 'all'
  wasteReason: WasteReason | 'all'
  branchId: string
  warehouseId: string
  productId: string
  lotId: string
  date: string
  search: string
}

export type WasteCreateInput = {
  lotId: string
  wasteType: WasteType
  wasteReason: WasteReason
  quantity: number
  date: string
  description: string
}

export type WasteValidationResult = {
  valid: boolean
  errors: string[]
}

export type WastePrintMode = 'A4' | 'PDF'
