import { loadGoodsReceiptRecords } from '../goods-receipts/goods-receipt.mock'
import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import { loadInventoryLotRecords } from '../inventory-lots/inventory-lot.mock'
import { loadPurchaseApprovalRecords } from '../purchase-approvals/purchase-approval.mock'
import { loadPurchaseOrderRecords } from '../purchase-orders/purchase-order.mock'
import type { PurchaseOrder } from '../purchase-orders/purchase-order.types'
import { loadPurchaseRequestRecords } from '../purchase-requests/purchase-request.mock'
import type { PurchaseRequestRecord } from '../purchase-requests/purchase-request.types'
import { applyCompletedQualityControlsToInventoryLots, loadQualityControlRecords } from '../quality-controls/quality-control.mock'
import { loadQualityControlFormRecords, loadQualityControlTemplateRecords } from '../quality-controls/quality-control-form.mock'
import type { QualityControl } from '../quality-controls/quality-control.types'
import { loadRequestForQuotationRecords } from '../request-for-quotations/request-for-quotation.mock'
import type { RequestForQuotationRecord } from '../request-for-quotations/request-for-quotation.types'
import { loadReturnProcessRecords } from '../return-processes/return-process.mock'
import type { ReturnProcess } from '../return-processes/return-process.types'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import { calculateSupplierPerformances, SUPPLIER_PERFORMANCE_LEVELS } from '../supplier-performances/supplier-performance.mock'
import type { SupplierPerformance, SupplierPerformancePeriod } from '../supplier-performances/supplier-performance.types'
import { loadSupplierReturnRecords } from '../supplier-returns/supplier-return.mock'
import type { SupplierReturn } from '../supplier-returns/supplier-return.types'
import { loadBranches, loadStockItems } from '../storage'
import type {
  ProcurementAnalyticsFilters,
  ProcurementAnalyticsPeriodFilter,
  ProcurementAnalyticsSourceData,
  ProcurementAnalyticsView,
  SupplierAnalyticsRow
} from './procurement-analytics.types'

const ALL_FILTER_VALUE = 'all'
const TOP_LIST_LIMIT = 10
const PERCENT_MULTIPLIER = 100
const SCORE_ROUNDING_FACTOR = 100
const MIN_SCORE = 0

const roundScore = (value: number) => (
  Math.round((value + Number.EPSILON) * SCORE_ROUNDING_FACTOR) / SCORE_ROUNDING_FACTOR
)

const calculatePercent = (part: number, total: number) => (
  total > 0 ? roundScore((part / total) * PERCENT_MULTIPLIER) : MIN_SCORE
)

const getDateKey = (value: string) => {
  const normalized = String(value || '').trim()
  if(!normalized) return ''
  if(/^\d{4}-\d{2}-\d{2}/.test(normalized)) return normalized.slice(0, 10)

  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const addDays = (date: Date, days: number) => {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

const getReferenceDate = (sourceData: ProcurementAnalyticsSourceData) => {
  const dateKeys = [
    ...sourceData.purchaseOrders.map(record => getDateKey(record.orderDate || record.createdAt)),
    ...sourceData.goodsReceipts.map(record => getDateKey(record.receiptDate || record.createdAt)),
    ...sourceData.qualityControls.map(record => getDateKey(record.inspectionDate || record.createdAt)),
    ...sourceData.returnProcesses.map(record => getDateKey(record.createdAt)),
    ...sourceData.supplierReturns.map(record => getDateKey(record.shipmentDate || record.createdAt))
  ].filter(Boolean).sort()
  const latestDateKey = dateKeys[dateKeys.length - 1] || new Date().toLocaleDateString('sv-SE')
  const referenceDate = new Date(`${latestDateKey}T00:00:00`)

  return Number.isNaN(referenceDate.getTime()) ? new Date() : referenceDate
}

const getPeriodRange = (
  period: Exclude<ProcurementAnalyticsPeriodFilter, 'ALL'>,
  referenceDate: Date
) => {
  if(period === 'MONTHLY'){
    const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
    const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0)
    return { start: start.toLocaleDateString('sv-SE'), end: end.toLocaleDateString('sv-SE') }
  }

  if(period === 'QUARTERLY'){
    const quarterStartMonth = Math.floor(referenceDate.getMonth() / 3) * 3
    const start = new Date(referenceDate.getFullYear(), quarterStartMonth, 1)
    const end = addDays(new Date(referenceDate.getFullYear(), quarterStartMonth + 3, 1), -1)
    return { start: start.toLocaleDateString('sv-SE'), end: end.toLocaleDateString('sv-SE') }
  }

  const start = new Date(referenceDate.getFullYear(), 0, 1)
  const end = new Date(referenceDate.getFullYear(), 11, 31)
  return { start: start.toLocaleDateString('sv-SE'), end: end.toLocaleDateString('sv-SE') }
}

const matchesPeriod = (
  dateValue: string,
  period: ProcurementAnalyticsPeriodFilter,
  referenceDate: Date
) => {
  if(period === 'ALL') return true

  const dateKey = getDateKey(dateValue)
  if(!dateKey) return false

  const { start, end } = getPeriodRange(period, referenceDate)
  return dateKey >= start && dateKey <= end
}

const getPurchaseOrderWarehouseId = (
  purchaseOrder: PurchaseOrder,
  rfqMap: Map<string, RequestForQuotationRecord>,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
) => (
  rfqMap.get(purchaseOrder.rfqId)?.branchId
  || purchaseRequestMap.get(purchaseOrder.purchaseRequestId)?.branchId
  || ''
)

const matchesSupplier = (supplierId: string, selectedSupplierId: string) => (
  selectedSupplierId === ALL_FILTER_VALUE || supplierId === selectedSupplierId
)

const matchesWarehouse = (warehouseId: string, selectedWarehouseId: string) => (
  selectedWarehouseId === ALL_FILTER_VALUE || warehouseId === selectedWarehouseId
)

const isActivePurchaseOrder = (record: PurchaseOrder) => record.status !== 'CANCELLED'
const isActiveGoodsReceipt = (record: GoodsReceiptRecord) => record.status !== 'DRAFT' && record.status !== 'CANCELLED'
const isActiveReturnProcess = (record: ReturnProcess) => record.status !== 'CANCELLED'
const isActiveSupplierReturn = (record: SupplierReturn) => record.status !== 'CANCELLED'

export const loadProcurementAnalyticsSourceData = (): ProcurementAnalyticsSourceData => {
  const branches = loadBranches()
  const stockItems = loadStockItems()
  const purchaseRequests = loadPurchaseRequestRecords(stockItems, branches)
  const suppliers = loadSupplierManagementRecords()
  const supplierProducts = loadSupplierProductRecords(suppliers, stockItems)
  const rfqRecords = loadRequestForQuotationRecords(purchaseRequests, suppliers, supplierProducts, branches)
  const approvalRecords = loadPurchaseApprovalRecords(rfqRecords)
  const purchaseOrders = loadPurchaseOrderRecords(approvalRecords, rfqRecords)
  const goodsReceipts = loadGoodsReceiptRecords(purchaseOrders, rfqRecords, purchaseRequests)
  const inventoryLots = loadInventoryLotRecords(goodsReceipts)
  const qualityControls = loadQualityControlRecords(inventoryLots)
  const qualitySyncedLots = applyCompletedQualityControlsToInventoryLots(inventoryLots, qualityControls)
  const qualityControlTemplates = loadQualityControlTemplateRecords()
  const qualityControlForms = loadQualityControlFormRecords(qualityControls, qualityControlTemplates)
  const returnProcesses = loadReturnProcessRecords(qualityControls, qualitySyncedLots, goodsReceipts)
  const supplierReturns = loadSupplierReturnRecords(returnProcesses)

  return {
    branches,
    stockItems,
    purchaseRequests,
    suppliers,
    supplierProducts,
    rfqRecords,
    approvalRecords,
    purchaseOrders,
    goodsReceipts,
    inventoryLots: qualitySyncedLots,
    qualityControls,
    qualityControlForms,
    returnProcesses,
    supplierReturns
  }
}

const filterSourceData = (
  sourceData: ProcurementAnalyticsSourceData,
  filters: ProcurementAnalyticsFilters
): ProcurementAnalyticsSourceData => {
  const referenceDate = getReferenceDate(sourceData)
  const rfqMap = new Map(sourceData.rfqRecords.map(record => [record.id, record]))
  const purchaseRequestMap = new Map(sourceData.purchaseRequests.map(record => [record.id, record]))
  const purchaseOrders = sourceData.purchaseOrders.filter(record => (
    isActivePurchaseOrder(record)
    && matchesSupplier(record.supplierId, filters.supplierId)
    && matchesWarehouse(getPurchaseOrderWarehouseId(record, rfqMap, purchaseRequestMap), filters.warehouseId)
    && matchesPeriod(record.orderDate || record.createdAt, filters.period, referenceDate)
  ))
  const goodsReceipts = sourceData.goodsReceipts.filter(record => (
    isActiveGoodsReceipt(record)
    && matchesSupplier(record.supplierId, filters.supplierId)
    && matchesWarehouse(record.warehouseId, filters.warehouseId)
    && matchesPeriod(record.receiptDate || record.createdAt, filters.period, referenceDate)
  ))
  const qualityControls = sourceData.qualityControls.filter(record => (
    matchesSupplier(record.supplierId, filters.supplierId)
    && matchesWarehouse(record.warehouseId, filters.warehouseId)
    && matchesPeriod(record.inspectionDate || record.createdAt, filters.period, referenceDate)
  ))
  const qualityControlIds = new Set(qualityControls.map(record => record.id))
  const returnProcesses = sourceData.returnProcesses.filter(record => (
    isActiveReturnProcess(record)
    && matchesSupplier(record.supplierId, filters.supplierId)
    && matchesWarehouse(record.warehouseId, filters.warehouseId)
    && matchesPeriod(record.createdAt, filters.period, referenceDate)
  ))
  const supplierReturns = sourceData.supplierReturns.filter(record => (
    isActiveSupplierReturn(record)
    && matchesSupplier(record.supplierId, filters.supplierId)
    && matchesWarehouse(record.warehouseId, filters.warehouseId)
    && matchesPeriod(record.shipmentDate || record.createdAt, filters.period, referenceDate)
  ))
  const suppliers = filters.supplierId === ALL_FILTER_VALUE
    ? sourceData.suppliers
    : sourceData.suppliers.filter(record => record.id === filters.supplierId)

  return {
    ...sourceData,
    suppliers,
    purchaseOrders,
    goodsReceipts,
    inventoryLots: sourceData.inventoryLots.filter(record => (
      matchesSupplier(record.supplierId, filters.supplierId)
      && matchesWarehouse(record.warehouseId, filters.warehouseId)
    )),
    qualityControls,
    qualityControlForms: sourceData.qualityControlForms.filter(record => qualityControlIds.has(record.qualityControlId)),
    returnProcesses,
    supplierReturns
  }
}

const getAnalyticsPerformancePeriod = (period: ProcurementAnalyticsPeriodFilter): SupplierPerformancePeriod => (
  period === 'ALL' ? 'YEARLY' : period
)

const getAverage = (
  records: SupplierPerformance[],
  selector: (record: SupplierPerformance) => number
) => (
  records.length > 0
    ? roundScore(records.reduce((total, record) => total + selector(record), 0) / records.length)
    : MIN_SCORE
)

const getActivityRecords = (records: SupplierPerformance[]) => {
  const activeRecords = records.filter(record => (
    record.purchaseOrderCount > 0
    || record.goodsReceiptCount > 0
    || record.qualityControlCount > 0
    || record.returnProcessCount > 0
    || record.supplierReturnCount > 0
  ))

  return activeRecords.length > 0 ? activeRecords : records
}

const getSupplierReturnCountMap = (supplierReturns: SupplierReturn[]) => (
  supplierReturns.reduce((map, record) => {
    map.set(record.supplierId, (map.get(record.supplierId) || 0) + 1)
    return map
  }, new Map<string, number>())
)

const createSupplierRow = (
  record: SupplierPerformance,
  returnCountMap: Map<string, number>
): SupplierAnalyticsRow => ({
  supplierId: record.supplierId,
  score: record.overallScore,
  returnCount: returnCountMap.get(record.supplierId) || 0,
  qualityScore: record.averageQualityScore
})

const sortByDateDesc = <T>(
  records: T[],
  getDateValue: (record: T) => string
) => (
  [...records].sort((first, second) => getDateKey(getDateValue(second)).localeCompare(getDateKey(getDateValue(first))))
)

export const createProcurementAnalyticsView = (
  sourceData: ProcurementAnalyticsSourceData,
  filters: ProcurementAnalyticsFilters
): ProcurementAnalyticsView => {
  const filteredData = filterSourceData(sourceData, filters)
  const performancePeriod = getAnalyticsPerformancePeriod(filters.period)
  const performanceRecords = calculateSupplierPerformances(filteredData)
    .filter(record => record.period === performancePeriod)
  const activityRecords = getActivityRecords(performanceRecords)
  const returnCountMap = getSupplierReturnCountMap(filteredData.supplierReturns)
  const supplierRows = activityRecords.map(record => createSupplierRow(record, returnCountMap))
  const completedQualityControls = filteredData.qualityControls.filter(record => record.status === 'COMPLETED')
  const approvedQualityControls = completedQualityControls.filter(record => record.decision === 'APPROVED')
  const purchaseVolume = filteredData.purchaseOrders.reduce((total, record) => total + Math.max(0, record.grandTotal), 0)

  return {
    summary: {
      totalSupplierCount: filteredData.suppliers.length,
      totalPurchaseOrderCount: filteredData.purchaseOrders.length,
      totalGoodsReceiptCount: filteredData.goodsReceipts.length,
      totalQualityControlCount: filteredData.qualityControls.length,
      totalSupplierReturnCount: filteredData.supplierReturns.length,
      averageOverallSupplierScore: getAverage(performanceRecords, record => record.overallScore),
      purchaseVolume,
      averageQualityScore: getAverage(performanceRecords, record => record.averageQualityScore),
      averageDeliveryScore: getAverage(performanceRecords, record => record.deliveryScore),
      averageReturnScore: getAverage(performanceRecords, record => record.returnScore),
      averageOverallScore: getAverage(performanceRecords, record => record.overallScore),
      qualitySuccessRate: calculatePercent(approvedQualityControls.length, completedQualityControls.length),
      returnRate: calculatePercent(filteredData.supplierReturns.length, filteredData.goodsReceipts.length)
    },
    performanceRecords,
    supplierPerformanceDistribution: SUPPLIER_PERFORMANCE_LEVELS.map(level => ({
      level,
      count: performanceRecords.filter(record => record.performanceLevel === level).length
    })),
    topSuppliers: [...supplierRows].sort((first, second) => second.score - first.score).slice(0, TOP_LIST_LIMIT),
    bottomSuppliers: [...supplierRows].sort((first, second) => first.score - second.score).slice(0, TOP_LIST_LIMIT),
    mostReturnedSuppliers: [...supplierRows]
      .sort((first, second) => second.returnCount - first.returnCount || second.score - first.score)
      .slice(0, TOP_LIST_LIMIT),
    highestQualitySuppliers: [...supplierRows]
      .sort((first, second) => second.qualityScore - first.qualityScore)
      .slice(0, TOP_LIST_LIMIT),
    recentPurchaseOrders: sortByDateDesc(filteredData.purchaseOrders, record => record.orderDate || record.createdAt).slice(0, TOP_LIST_LIMIT),
    recentGoodsReceipts: sortByDateDesc(filteredData.goodsReceipts, record => record.receiptDate || record.createdAt).slice(0, TOP_LIST_LIMIT),
    recentSupplierReturns: sortByDateDesc(filteredData.supplierReturns, record => record.shipmentDate || record.createdAt).slice(0, TOP_LIST_LIMIT)
  }
}
