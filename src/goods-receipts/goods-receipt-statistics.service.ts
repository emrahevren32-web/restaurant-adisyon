import type {
  GoodsReceiptRecord,
  GoodsReceiptStatistics
} from './goods-receipt.types'

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const uniqueProductCount = (records: GoodsReceiptRecord[]) => (
  new Set(records.flatMap(record => record.items.map(item => item.stockItemId))).size
)

export const createGoodsReceiptStatistics = (
  records: GoodsReceiptRecord[]
): GoodsReceiptStatistics => {
  const totalReceipts = records.length
  const acceptedReceipts = records.filter(record => record.status === 'ACCEPTED').length
  const rejectedReceipts = records.filter(record => record.status === 'REJECTED').length
  const partialAcceptedReceipts = records.filter(record => record.status === 'PARTIAL_ACCEPTED').length
  const decisionBase = records.filter(record => record.status !== 'CANCELLED').length

  return {
    todayReceipts: records.filter(record => record.receiptDate === todayKey()).length,
    waitingReceipts: records.filter(record => record.status === 'WAITING' || record.status === 'INSPECTING').length,
    acceptedReceipts,
    rejectedReceipts,
    partialAcceptedReceipts,
    totalReceipts,
    totalProducts: uniqueProductCount(records),
    totalSuppliers: new Set(records.map(record => record.supplierId).filter(Boolean)).size,
    totalQuantity: records.reduce((total, record) => total + record.items.reduce((sum, item) => sum + item.receivedQuantity, 0), 0),
    totalNetWeight: records.reduce((total, record) => total + record.items.reduce((sum, item) => sum + (item.netWeight || 0), 0), 0),
    totalGrossWeight: records.reduce((total, record) => total + record.items.reduce((sum, item) => sum + (item.grossWeight || 0), 0), 0),
    totalCost: records.reduce((total, record) => total + record.items.reduce((sum, item) => sum + (item.totalCost || 0), 0), 0),
    rejectionRate: decisionBase > 0 ? (rejectedReceipts / decisionBase) * 100 : 0,
    acceptanceRate: decisionBase > 0 ? ((acceptedReceipts + partialAcceptedReceipts) / decisionBase) * 100 : 0
  }
}

export const GoodsReceiptStatisticsService = {
  create: createGoodsReceiptStatistics
}
