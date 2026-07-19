import type { StockUnit } from '../types'

export type PurchaseRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'

export type PurchaseRequestPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type PurchaseRequestDepartment =
  | 'PRODUCTION'
  | 'WAREHOUSE'
  | 'QUALITY'
  | 'PACKAGING'
  | 'SHIPPING'
  | 'ADMINISTRATION'

export type PurchaseRequest = {
  id: string
  requestNo: string
  title: string
  description: string
  requestDate: string
  requiredDate: string
  department: PurchaseRequestDepartment
  requester: string
  priority: PurchaseRequestPriority
  status: PurchaseRequestStatus
  branchId: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type PurchaseRequestItem = {
  id: string
  requestId: string
  stockItemId: string
  quantity: number
  unit: StockUnit
  estimatedUnitPrice: number
  estimatedTotalPrice: number
  notes: string
}

export type PurchaseRequestRecord = PurchaseRequest & {
  items: PurchaseRequestItem[]
}
