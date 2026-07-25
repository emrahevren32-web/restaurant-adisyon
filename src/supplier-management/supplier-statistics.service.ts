import type { GoodsReceiptRecord } from '../goods-receipts/goods-receipt.types'
import type { PurchaseOrder } from '../purchase-orders/purchase-order.types'
import type { Supplier, SupplierProduct, SupplierStatistics } from './supplier-management.types'

const roundMoney = (value: number) => (
  Math.round((value + Number.EPSILON) * 100) / 100
)

const isActivePurchaseOrder = (order: PurchaseOrder) => (
  order.status !== 'COMPLETED' && order.status !== 'CANCELLED'
)

const isDelayedReceipt = (
  receipt: GoodsReceiptRecord,
  purchaseOrders: PurchaseOrder[]
) => {
  const order = purchaseOrders.find(record => record.id === receipt.purchaseOrderId)
  if(!order?.expectedDeliveryDate || !receipt.receiptDate) return false
  return receipt.receiptDate > order.expectedDeliveryDate
}

export const SupplierStatisticsService = {
  createStatistics: (
    supplier: Supplier,
    purchaseOrders: PurchaseOrder[],
    goodsReceipts: GoodsReceiptRecord[],
    supplierProducts: SupplierProduct[]
  ): SupplierStatistics => {
    const supplierOrders = purchaseOrders.filter(order => order.supplierId === supplier.id)
    const supplierReceipts = goodsReceipts.filter(receipt => receipt.supplierId === supplier.id)
    const totalPurchaseAmount = roundMoney(supplierOrders.reduce((total, order) => total + Math.max(0, order.grandTotal), 0))
    const qualityRejections = supplierReceipts.reduce((total, receipt) => (
      total + receipt.items.reduce((itemTotal, item) => itemTotal + (item.rejectedQuantity > 0 ? 1 : 0), 0)
    ), 0)
    const lastOrderDate = supplierOrders
      .map(order => order.orderDate)
      .filter(Boolean)
      .sort()
      .at(-1) || ''

    return {
      supplierId: supplier.id,
      totalPurchaseOrders: supplierOrders.length,
      totalPurchaseAmount,
      totalDeliveries: supplierReceipts.length,
      delayedDeliveries: supplierReceipts.filter(receipt => isDelayedReceipt(receipt, purchaseOrders)).length,
      qualityRejections,
      activeOrders: supplierOrders.filter(isActivePurchaseOrder).length,
      lastOrderDate,
      suppliedProductCount: supplierProducts.filter(product => product.supplierId === supplier.id).length
    }
  },

  createStatisticsMap: (
    suppliers: Supplier[],
    purchaseOrders: PurchaseOrder[],
    goodsReceipts: GoodsReceiptRecord[],
    supplierProducts: SupplierProduct[]
  ) => new Map(suppliers.map(supplier => [
    supplier.id,
    SupplierStatisticsService.createStatistics(supplier, purchaseOrders, goodsReceipts, supplierProducts)
  ])),

  getMostOrderedSupplier: (
    suppliers: Supplier[],
    statisticsMap: Map<string, SupplierStatistics>
  ) => [...suppliers]
    .sort((first, second) => (
      (statisticsMap.get(second.id)?.totalPurchaseOrders || 0)
      - (statisticsMap.get(first.id)?.totalPurchaseOrders || 0)
    ))[0],

  getHighestPurchaseSupplier: (
    suppliers: Supplier[],
    statisticsMap: Map<string, SupplierStatistics>
  ) => [...suppliers]
    .sort((first, second) => (
      (statisticsMap.get(second.id)?.totalPurchaseAmount || 0)
      - (statisticsMap.get(first.id)?.totalPurchaseAmount || 0)
    ))[0]
}
