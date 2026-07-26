import type { Branch, StockCategory, StockItem, StockUnit, StockWasteRecord } from '../types'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import type { RecipeManagementRecord } from '../recipe-management/recipe-management.types'
import type { Supplier, SupplierProduct } from '../supplier-management/supplier-management.types'

export type PurchaseRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'PURCHASE_ORDER_CREATED'

export type PurchaseRequestPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type PurchaseRequestSource =
  | 'CRITICAL_STOCK'
  | 'MINIMUM_STOCK'
  | 'PRODUCTION_ORDER'
  | 'MANUAL'
  | 'WASTE'
  | 'QUALITY_REJECTION'
  | 'WAREHOUSE_TRANSFER'
  | 'PLANNED_PRODUCTION'

export type PurchaseRequestDepartment =
  | 'PRODUCTION'
  | 'WAREHOUSE'
  | 'QUALITY'
  | 'PACKAGING'
  | 'SHIPPING'
  | 'ADMINISTRATION'
  | 'PURCHASING'

export type PurchaseRequestHistoryType =
  | 'CREATED'
  | 'UPDATED'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'SUGGESTION_CREATED'
  | 'NOTE_ADDED'
  | 'PO_MARKED'

export type PurchaseRequestHistoryEvent = {
  id: string
  type: PurchaseRequestHistoryType
  description: string
  actorName: string
  createdAt: string
}

export type PurchaseRequestActionLog = {
  id: string
  type: string
  message: string
  actorName: string
  createdAt: string
}

export type PurchaseRequest = {
  id: string
  requestNo: string
  title: string
  description: string
  requestDate: string
  requiredDate: string
  requester: string
  department: PurchaseRequestDepartment
  warehouseId: string
  branchId: string
  source: PurchaseRequestSource
  priority: PurchaseRequestPriority
  status: PurchaseRequestStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export type PurchaseRequestItem = {
  id: string
  requestId: string
  stockItemId: string
  categoryId: string
  requestedQuantity: number
  quantity: number
  unit: StockUnit
  currentStock: number
  minimumStock: number
  estimatedUnitPrice: number
  estimatedTotalPrice: number
  suggestedSupplierId?: string
  source?: PurchaseRequestSource
  notes: string
}

export type PurchaseRequestRecord = PurchaseRequest & {
  items: PurchaseRequestItem[]
  history: PurchaseRequestHistoryEvent[]
  actionLogs: PurchaseRequestActionLog[]
}

export type PurchaseRequestStatistics = {
  totalRequests: number
  waitingRequests: number
  approvalWaitingRequests: number
  approvedRequests: number
  rejectedRequests: number
  urgentRequests: number
  todayRequests: number
  totalLines: number
  totalEstimatedCost: number
  sourceDistribution: Array<{
    source: PurchaseRequestSource
    count: number
    estimatedCost: number
  }>
  statusDistribution: Array<{
    status: PurchaseRequestStatus
    count: number
  }>
  priorityDistribution: Array<{
    priority: PurchaseRequestPriority
    count: number
  }>
  topRequestedProduct: {
    stockItemId: string
    productName: string
    quantity: number
    requestCount: number
  }
  topRequestDepartment: {
    department: PurchaseRequestDepartment
    count: number
  }
}

export type PurchaseRequestSuggestion = {
  id: string
  source: PurchaseRequestSource
  stockItemId: string
  categoryId: string
  requestedQuantity: number
  unit: StockUnit
  currentStock: number
  minimumStock: number
  estimatedUnitPrice: number
  estimatedTotalPrice: number
  priority: PurchaseRequestPriority
  department: PurchaseRequestDepartment
  branchId: string
  warehouseId: string
  reason: string
  sourceReference: string
  suggestedSupplierId?: string
  supplierName?: string
  openRequestNos: string[]
}

export type PurchaseRequestReadModelContext = {
  stockItems: StockItem[]
  stockCategories: StockCategory[]
  branches: Branch[]
  suppliers: Supplier[]
  supplierProducts: SupplierProduct[]
  productionWorkOrders: ProductionWorkOrder[]
  recipes: RecipeManagementRecord[]
  stockWasteRecords: StockWasteRecord[]
}
