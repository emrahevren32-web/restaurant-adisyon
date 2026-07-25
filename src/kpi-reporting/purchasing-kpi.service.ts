import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import type { PurchaseOrder } from '../purchase-orders/purchase-order.types'
import type { RequestForQuotationRecord } from '../request-for-quotations/request-for-quotation.types'
import type { PurchasingKpiView, KpiFilters, KpiSourceData } from './kpi.types'
import {
  ALL_FILTER,
  averageBy,
  createBarRows,
  createCard,
  formatCurrency,
  formatNumber,
  formatPercent,
  matchesOptionalFilter,
  matchesPeriod,
  percent,
  roundKpi,
  sumBy
} from './kpi.utils'

const COMPLETED_PURCHASE_ORDER_STATUS = 'COMPLETED'
const CANCELLED_PURCHASE_ORDER_STATUS = 'CANCELLED'

const getDateDiffDays = (startValue: string, endValue: string) => {
  const start = new Date(startValue)
  const end = new Date(endValue)
  if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000))
}

const getPurchaseOrderWarehouseId = (
  purchaseOrder: PurchaseOrder,
  rfqMap: Map<string, RequestForQuotationRecord>
) => rfqMap.get(purchaseOrder.rfqId)?.branchId || ''

const matchesPurchaseOrderFilters = (
  purchaseOrder: PurchaseOrder,
  rfqMap: Map<string, RequestForQuotationRecord>,
  filters: KpiFilters
) => (
  purchaseOrder.status !== CANCELLED_PURCHASE_ORDER_STATUS
  && matchesPeriod(purchaseOrder.orderDate || purchaseOrder.createdAt, filters.period)
  && matchesOptionalFilter(filters.supplierId, purchaseOrder.supplierId)
  && matchesOptionalFilter(filters.branchId, getPurchaseOrderWarehouseId(purchaseOrder, rfqMap))
)

const matchesGoodsReceiptFilters = (
  receipt: GoodsReceiptRecord,
  filters: KpiFilters
) => (
  receipt.status !== 'CANCELLED'
  && matchesPeriod(receipt.receiptDate || receipt.createdAt, filters.period)
  && matchesOptionalFilter(filters.supplierId, receipt.supplierId)
  && matchesOptionalFilter(filters.warehouseId, receipt.warehouseId)
)

const createSupplierScore = (
  supplierId: string,
  purchaseOrders: PurchaseOrder[],
  goodsReceipts: GoodsReceiptRecord[],
  sourceData: KpiSourceData
) => {
  const supplier = sourceData.suppliers.find(record => record.id === supplierId)
  const supplierOrders = purchaseOrders.filter(record => record.supplierId === supplierId)
  const supplierReceipts = goodsReceipts.filter(record => record.supplierId === supplierId)
  const completedRate = percent(
    supplierOrders.filter(record => record.status === COMPLETED_PURCHASE_ORDER_STATUS).length,
    supplierOrders.length
  )
  const rejectedQuantity = sumBy(supplierReceipts.flatMap(receipt => receipt.items), item => item.rejectedQuantity)
  const receivedQuantity = sumBy(supplierReceipts.flatMap(receipt => receipt.items), item => item.receivedQuantity)
  const rejectionRate = percent(rejectedQuantity, receivedQuantity)
  const averageLeadTime = averageBy(supplierReceipts, receipt => {
    const order = sourceData.purchaseOrders.find(record => record.id === receipt.purchaseOrderId)
    return order ? getDateDiffDays(order.orderDate, receipt.receiptDate) : supplier?.leadTimeDays || 0
  })
  const leadPenalty = Math.max(0, averageLeadTime - (supplier?.leadTimeDays || averageLeadTime)) * 3

  return Math.max(0, roundKpi(completedRate - rejectionRate - leadPenalty))
}

export const createPurchasingKpiView = (
  sourceData: KpiSourceData,
  filters: KpiFilters
): PurchasingKpiView => {
  const rfqMap = new Map(sourceData.rfqRecords.map(record => [record.id, record]))
  const filteredPurchaseOrders = sourceData.purchaseOrders.filter(order => matchesPurchaseOrderFilters(order, rfqMap, filters))
  const filteredGoodsReceipts = sourceData.goodsReceipts.filter(receipt => matchesGoodsReceiptFilters(receipt, filters))
  const pendingOrders = filteredPurchaseOrders.filter(order => (
    order.status !== COMPLETED_PURCHASE_ORDER_STATUS
    && order.status !== CANCELLED_PURCHASE_ORDER_STATUS
  ))
  const completedOrders = filteredPurchaseOrders.filter(order => order.status === COMPLETED_PURCHASE_ORDER_STATUS)
  const deliveryTime = averageBy(filteredGoodsReceipts, receipt => {
    const order = sourceData.purchaseOrders.find(record => record.id === receipt.purchaseOrderId)
    return order ? getDateDiffDays(order.orderDate, receipt.receiptDate) : 0
  })
  const receiptItems = filteredGoodsReceipts.flatMap(receipt => receipt.items)
  const receivedQuantity = sumBy(receiptItems, item => item.receivedQuantity)
  const rejectedQuantity = sumBy(receiptItems, item => item.rejectedQuantity)
  const rejectionRate = percent(rejectedQuantity, receivedQuantity)
  const supplierVolumeMap = new Map<string, number>()

  filteredPurchaseOrders.forEach(order => {
    supplierVolumeMap.set(order.supplierId, (supplierVolumeMap.get(order.supplierId) || 0) + order.grandTotal)
  })

  const supplierScores = sourceData.suppliers
    .filter(supplier => filters.supplierId === ALL_FILTER || supplier.id === filters.supplierId)
    .map(supplier => ({
      id: supplier.id,
      label: supplier.name,
      value: createSupplierScore(supplier.id, filteredPurchaseOrders, filteredGoodsReceipts, sourceData),
      detail: `${formatCurrency(supplierVolumeMap.get(supplier.id) || 0)} alim hacmi`,
      tone: 'success' as const
    }))
  const averageSupplierPerformance = averageBy(supplierScores, supplier => supplier.value)
  const topSupplier = [...supplierVolumeMap.entries()].sort((first, second) => second[1] - first[1])[0]
  const topSupplierName = sourceData.suppliers.find(supplier => supplier.id === topSupplier?.[0])?.name || '-'

  return {
    cards: [
      createCard('purchasing-total-po', 'Toplam Purchase Order', formatNumber(filteredPurchaseOrders.length), formatCurrency(sumBy(filteredPurchaseOrders, order => order.grandTotal)), 'neutral'),
      createCard('purchasing-pending-po', 'Bekleyen Siparis', formatNumber(pendingOrders.length), 'Tamamlanmamis purchase order', pendingOrders.length > 0 ? 'warning' : 'success'),
      createCard('purchasing-completed-po', 'Tamamlanan Siparis', formatNumber(completedOrders.length), 'COMPLETED purchase order', 'success'),
      createCard('purchasing-supplier-score', 'Supplier Performance', formatPercent(averageSupplierPerformance), 'Tedarikci ortalama skoru', averageSupplierPerformance >= 80 ? 'success' : 'warning'),
      createCard('purchasing-delivery-time', 'Teslim Suresi', `${formatNumber(deliveryTime, 1)} gun`, 'PO orderDate -> receiptDate ortalamasi', 'neutral'),
      createCard('purchasing-rejection-rate', 'Red Orani', formatPercent(rejectionRate), `${formatNumber(rejectedQuantity, 2)} red miktar`, rejectionRate > 5 ? 'danger' : 'success'),
      createCard('purchasing-top-supplier', 'En Cok Alim Yapilan Tedarikci', topSupplierName, topSupplier ? formatCurrency(topSupplier[1]) : 'Kayit yok', 'neutral')
    ],
    supplierPerformance: createBarRows(supplierScores, 8, '%'),
    topSuppliers: createBarRows(
      Array.from(supplierVolumeMap.entries()).map(([supplierId, value]) => ({
        id: supplierId,
        label: sourceData.suppliers.find(supplier => supplier.id === supplierId)?.name || supplierId,
        value,
        detail: 'Purchase order hacmi'
      })),
      8,
      'TRY'
    )
  }
}
