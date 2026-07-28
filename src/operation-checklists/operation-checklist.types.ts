import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type ChecklistType =
  | 'OPENING_CONTROL'
  | 'CLOSING_CONTROL'
  | 'CLEANING_CONTROL'
  | 'HACCP_DAILY_CONTROL'
  | 'COLD_ROOM_CONTROL'
  | 'BLAST_CHILLING_CONTROL'
  | 'WAREHOUSE_CONTROL'
  | 'PRODUCTION_LINE_CONTROL'
  | 'SHIPMENT_CONTROL'
  | 'MACHINE_CONTROL'
  | 'MAINTENANCE_CONTROL'
  | 'PERSONNEL_HYGIENE_CONTROL'

export type ChecklistStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'REVISED'
  | 'CANCELLED'

export type ChecklistItemStatus =
  | 'PASS'
  | 'WARNING'
  | 'FAIL'
  | 'NOT_APPLICABLE'

export type ChecklistSourceType =
  | 'Warehouse'
  | 'Production'
  | 'Shipment'
  | 'QualityForm'
  | 'GoodsReceipt'
  | 'HACCP'
  | 'Equipment'
  | 'Maintenance'
  | 'Cleaning'
  | 'ManualReadModel'

export type ChecklistHistoryAction =
  | 'CREATED'
  | 'UPDATED'
  | 'STARTED'
  | 'COMPLETED'
  | 'REVISED'
  | 'CANCELLED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'
  | 'VALIDATION'

export type ChecklistTemplateItem = {
  id: string
  templateId: string
  title: string
  description: string
  required: boolean
  photoFieldReady: boolean
  correctiveActionRequiredOnFail: boolean
  displayOrder: number
}

export type ChecklistTemplate = {
  id: string
  checklistType: ChecklistType
  name: string
  version: string
  description: string
  department: string
  isActive: boolean
  items: ChecklistTemplateItem[]
  createdAt: string
  updatedAt: string
}

export type ChecklistItem = {
  id: string
  checklistId: string
  templateItemId: string
  title: string
  description: string
  status: ChecklistItemStatus
  required: boolean
  note: string
  photoPlaceholder: string
  correctiveAction: string
  completedBy: string
  completedAt: string
}

export type ChecklistHistory = {
  id: string
  checklistId: string
  action: ChecklistHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type ChecklistExecution = {
  id: string
  checklistId: string
  startedAt: string
  completedAt: string
  responsiblePerson: string
  completionRate: number
  failCount: number
  warningCount: number
  passCount: number
}

export type Checklist = {
  id: string
  checklistNo: string
  checklistType: ChecklistType
  status: ChecklistStatus
  templateId: string
  templateName: string
  templateVersion: string
  branchId: string
  branchName: string
  warehouseId: string
  warehouseName: string
  department: string
  shift: string
  responsiblePerson: string
  startAt: string
  endAt: string
  description: string
  sourceType: ChecklistSourceType
  sourceId: string
  sourceNo: string
  haccpReference: string
  qualityFormId: string
  goodsReceiptId: string
  productionOrderId: string
  shipmentId: string
  equipmentId: string
  equipmentName: string
  items: ChecklistItem[]
  execution: ChecklistExecution
  history: ChecklistHistory[]
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ChecklistStatistics = {
  todayChecklists: number
  completed: number
  pending: number
  fail: number
  warning: number
  totalChecklists: number
  completionRate: number
  failRate: number
  branchRows: BarChartRow[]
  departmentRows: BarChartRow[]
  typeRows: BarChartRow[]
  statusRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type ChecklistFilters = {
  checklistType: ChecklistType | 'all'
  department: string
  branchId: string
  status: ChecklistStatus | 'all'
  shift: string
  date: string
  search: string
}

export type ChecklistCreateInput = {
  templateId: string
  branchId: string
  warehouseId: string
  department: string
  shift: string
  responsiblePerson: string
  startAt: string
  endAt: string
  description: string
}

export type ChecklistUpdateInput = {
  itemStatuses: Record<string, ChecklistItemStatus>
  itemNotes: Record<string, string>
  correctiveActions: Record<string, string>
}

export type ChecklistValidationResult = {
  valid: boolean
  errors: string[]
}

export type ChecklistPrintMode = 'A4' | 'PDF'
