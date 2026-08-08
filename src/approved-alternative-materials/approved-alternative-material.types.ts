import type { SupplierProduct } from '../supplier-management/supplier-management.types'
import type { StockItem } from '../types'

export type ApprovedAlternativeMaterialApprovalStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'

export type ApprovedAlternativeMaterialActiveFilter =
  | 'all'
  | 'active'
  | 'inactive'

export type ApprovedAlternativeMaterial = {
  id: string
  materialId: string
  alternativeMaterialId: string
  approvalStatus: ApprovedAlternativeMaterialApprovalStatus
  qualityApprovedBy: string
  approvalDate: string
  expireDate: string
  reason: string
  notes: string
  priority: number
  preferredSupplierId: string
  isActive: boolean
  materialCode?: string
  materialName?: string
  alternativeMaterialCode?: string
  alternativeMaterialName?: string
  preferredSupplierName?: string
  averagePrice?: number
  lastPrice?: number
  lastPurchaseDate?: string
}

export type ApprovedAlternativeMaterialFilters = {
  materialId: string
  alternativeMaterialId: string
  approvalStatus: ApprovedAlternativeMaterialApprovalStatus | 'all'
  active: ApprovedAlternativeMaterialActiveFilter
  supplierId: string
  search: string
}

export type ApprovedAlternativeMaterialContext = {
  stockItems: StockItem[]
  suppliers: Array<{
    id: string
    name: string
    status?: string
    approvalStatus?: string
    workingStatus?: string
    defaultCurrency?: string
  }>
  supplierProducts?: SupplierProduct[]
}

export type ApprovedAlternativeMaterialView = ApprovedAlternativeMaterial & {
  materialName: string
  materialCode: string
  alternativeMaterialName: string
  alternativeMaterialCode: string
  preferredSupplierName: string
  averagePrice: number
  lastPrice: number
  lastPurchaseDate: string
  currency: string
  expired: boolean
  usable: boolean
  unusableReason: string
  supplierProduct?: SupplierProduct
}
