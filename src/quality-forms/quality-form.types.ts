import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'
import type { StockUnit } from '../types'

export type QualityFormStatus =
  | 'DRAFT'
  | 'INSPECTING'
  | 'APPROVED'
  | 'CONDITIONAL_APPROVED'
  | 'REJECTED'
  | 'CANCELLED'

export type QualityFormType =
  | 'GOODS_RECEIPT_CONTROL'
  | 'PRODUCTION_CONTROL'
  | 'INTERMEDIATE_PRODUCT_CONTROL'
  | 'FINAL_PRODUCT_CONTROL'
  | 'MICROBIOLOGICAL_CONTROL'
  | 'CHEMICAL_ANALYSIS'
  | 'PHYSICAL_CONTROL'
  | 'SENSORY_ANALYSIS'
  | 'RELEASE_FORM'
  | 'CAPA_FORM'

export type QualityInspectionResult = 'PASS' | 'CONDITIONAL' | 'FAIL'

export type QualityCriterionStatus =
  | 'PASS'
  | 'WARNING'
  | 'FAIL'
  | 'NOT_APPLICABLE'

export type QualityCriterionKey =
  | 'TEMPERATURE'
  | 'WEIGHT'
  | 'COLOR'
  | 'SMELL'
  | 'TASTE'
  | 'PACKAGING'
  | 'LABEL'
  | 'MOISTURE'
  | 'PH'
  | 'BRIX'
  | 'MICROBIOLOGICAL'
  | 'CHEMICAL'
  | 'VISUAL'

export type QualityDecisionType =
  | 'RELEASE'
  | 'CONDITIONAL_RELEASE'
  | 'REJECT'
  | 'HOLD'
  | 'CAPA_REQUIRED'

export type QualityHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'INSPECTION_STARTED'
  | 'APPROVED'
  | 'CONDITIONAL_APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'REVISED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'
  | 'VALIDATION'

export type QualityFormTemplateCriterion = {
  id: string
  templateId: string
  criterionKey: QualityCriterionKey
  label: string
  limit: string
  required: boolean
  displayOrder: number
}

export type QualityFormTemplate = {
  id: string
  formType: QualityFormType
  name: string
  version: string
  description: string
  isActive: boolean
  criteria: QualityFormTemplateCriterion[]
  createdAt: string
  updatedAt: string
}

export type QualityInspection = {
  id: string
  formId: string
  criterionKey: QualityCriterionKey
  label: string
  value: string
  unit: string
  status: QualityCriterionStatus
  result: QualityInspectionResult
  notes: string
}

export type QualityDecision = {
  id: string
  formId: string
  result: QualityInspectionResult
  decisionType: QualityDecisionType
  summary: string
  decidedBy: string
  decidedAt: string
}

export type QualityHistory = {
  id: string
  formId: string
  action: QualityHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type QualityForm = {
  id: string
  formNo: string
  formType: QualityFormType
  status: QualityFormStatus
  templateId: string
  templateName: string
  templateVersion: string
  productId: string
  productName: string
  stockItemId: string
  stockItemName: string
  lotId: string
  lotNo: string
  batchNo: string
  supplierId: string
  supplierName: string
  warehouseId: string
  warehouseName: string
  branchId: string
  branchName: string
  productionOrderId: string
  productionOrderNo: string
  goodsReceiptId: string
  goodsReceiptNo: string
  recipeId: string
  recipeName: string
  sampleId: string
  sampleNo: string
  witnessSampleId: string
  witnessNo: string
  haccpReference: string
  inspectionDate: string
  inspector: string
  quantity: number
  unit: StockUnit
  description: string
  result: QualityInspectionResult
  score: number
  decision: QualityDecision
  inspections: QualityInspection[]
  history: QualityHistory[]
  sourceType: 'GoodsReceipt' | 'Production' | 'HACCP' | 'Sample' | 'Waste' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type QualityStatistics = {
  todayControls: number
  passed: number
  conditionalApproved: number
  failed: number
  pending: number
  totalForms: number
  passRate: number
  failRate: number
  branchRows: BarChartRow[]
  productRows: BarChartRow[]
  supplierRows: BarChartRow[]
  typeRows: BarChartRow[]
  resultRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type QualityFormFilters = {
  formType: QualityFormType | 'all'
  status: QualityFormStatus | 'all'
  result: QualityInspectionResult | 'all'
  productId: string
  lotId: string
  supplierId: string
  branchId: string
  warehouseId: string
  date: string
  search: string
}

export type QualityFormCreateInput = {
  lotId: string
  formType: QualityFormType
  inspectionDate: string
  inspector: string
  result: QualityInspectionResult
  description: string
  inspectionStatuses: Partial<Record<QualityCriterionKey, QualityCriterionStatus>>
  inspectionNotes: Partial<Record<QualityCriterionKey, string>>
}

export type QualityFormValidationResult = {
  valid: boolean
  errors: string[]
}

export type QualityFormPrintMode = 'A4' | 'PDF'
