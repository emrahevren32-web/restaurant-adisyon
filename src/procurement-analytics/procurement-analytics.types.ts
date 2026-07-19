import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { PurchaseApproval } from '../purchase-approvals/purchase-approval.types'
import type { PurchaseOrder } from '../purchase-orders/purchase-order.types'
import type { PurchaseRequestRecord } from '../purchase-requests/purchase-request.types'
import type { QualityControlFormRecord } from '../quality-controls/quality-control-form.types'
import type { QualityControl } from '../quality-controls/quality-control.types'
import type { RequestForQuotationRecord } from '../request-for-quotations/request-for-quotation.types'
import type { ReturnProcess } from '../return-processes/return-process.types'
import type { Supplier, SupplierProduct } from '../supplier-management/supplier-management.types'
import type { SupplierPerformance, SupplierPerformanceLevel, SupplierPerformancePeriod } from '../supplier-performances/supplier-performance.types'
import type { SupplierReturn } from '../supplier-returns/supplier-return.types'
import type { Branch, StockItem } from '../types'

export type ProcurementAnalyticsPeriodFilter = 'ALL' | SupplierPerformancePeriod

export type ProcurementAnalyticsFilters = {
  supplierId: string
  warehouseId: string
  period: ProcurementAnalyticsPeriodFilter
}

export type ProcurementAnalyticsSourceData = {
  branches: Branch[]
  stockItems: StockItem[]
  purchaseRequests: PurchaseRequestRecord[]
  suppliers: Supplier[]
  supplierProducts: SupplierProduct[]
  rfqRecords: RequestForQuotationRecord[]
  approvalRecords: PurchaseApproval[]
  purchaseOrders: PurchaseOrder[]
  goodsReceipts: GoodsReceiptRecord[]
  inventoryLots: InventoryLot[]
  qualityControls: QualityControl[]
  qualityControlForms: QualityControlFormRecord[]
  returnProcesses: ReturnProcess[]
  supplierReturns: SupplierReturn[]
}

export type ProcurementAnalyticsSummary = {
  totalSupplierCount: number
  totalPurchaseOrderCount: number
  totalGoodsReceiptCount: number
  totalQualityControlCount: number
  totalSupplierReturnCount: number
  averageOverallSupplierScore: number
  purchaseVolume: number
  averageQualityScore: number
  averageDeliveryScore: number
  averageReturnScore: number
  averageOverallScore: number
  qualitySuccessRate: number
  returnRate: number
}

export type SupplierPerformanceDistributionItem = {
  level: SupplierPerformanceLevel
  count: number
}

export type SupplierAnalyticsRow = {
  supplierId: string
  score: number
  returnCount: number
  qualityScore: number
}

export type ProcurementAnalyticsView = {
  summary: ProcurementAnalyticsSummary
  performanceRecords: SupplierPerformance[]
  supplierPerformanceDistribution: SupplierPerformanceDistributionItem[]
  topSuppliers: SupplierAnalyticsRow[]
  bottomSuppliers: SupplierAnalyticsRow[]
  mostReturnedSuppliers: SupplierAnalyticsRow[]
  highestQualitySuppliers: SupplierAnalyticsRow[]
  recentPurchaseOrders: PurchaseOrder[]
  recentGoodsReceipts: GoodsReceiptRecord[]
  recentSupplierReturns: SupplierReturn[]
}
