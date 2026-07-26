import type { StockItem } from '../types'
import type {
  PurchaseRequestDepartment,
  PurchaseRequestPriority,
  PurchaseRequestRecord,
  PurchaseRequestSource,
  PurchaseRequestStatistics,
  PurchaseRequestStatus
} from './purchase-request.types'

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const emptyTopProduct = {
  stockItemId: '',
  productName: '-',
  quantity: 0,
  requestCount: 0
}

export const calculatePurchaseRequestTotal = (
  record: Pick<PurchaseRequestRecord, 'items'>
) => roundMoney(record.items.reduce((total, item) => total + item.estimatedTotalPrice, 0))

export const calculatePurchaseRequestStatistics = (
  records: PurchaseRequestRecord[],
  stockItems: StockItem[],
  todayKey = getTodayKey()
): PurchaseRequestStatistics => {
  const sourceTotals = new Map<PurchaseRequestSource, { count: number; estimatedCost: number }>()
  const statusTotals = new Map<PurchaseRequestStatus, number>()
  const priorityTotals = new Map<PurchaseRequestPriority, number>()
  const departmentTotals = new Map<PurchaseRequestDepartment, number>()
  const productTotals = new Map<string, { quantity: number; requestCount: number }>()
  const stockItemMap = new Map(stockItems.map(item => [item.id, item]))

  records.forEach(record => {
    const estimatedCost = calculatePurchaseRequestTotal(record)
    const sourceTotal = sourceTotals.get(record.source) || { count: 0, estimatedCost: 0 }

    sourceTotals.set(record.source, {
      count: sourceTotal.count + 1,
      estimatedCost: roundMoney(sourceTotal.estimatedCost + estimatedCost)
    })
    statusTotals.set(record.status, (statusTotals.get(record.status) || 0) + 1)
    priorityTotals.set(record.priority, (priorityTotals.get(record.priority) || 0) + 1)
    departmentTotals.set(record.department, (departmentTotals.get(record.department) || 0) + 1)

    const requestItemIds = new Set<string>()
    record.items.forEach(item => {
      const productTotal = productTotals.get(item.stockItemId) || { quantity: 0, requestCount: 0 }
      const requestedQuantity = item.requestedQuantity || item.quantity
      const nextRequestCount = requestItemIds.has(item.stockItemId)
        ? productTotal.requestCount
        : productTotal.requestCount + 1

      requestItemIds.add(item.stockItemId)
      productTotals.set(item.stockItemId, {
        quantity: productTotal.quantity + requestedQuantity,
        requestCount: nextRequestCount
      })
    })
  })

  const topProductEntry = Array.from(productTotals.entries())
    .sort((first, second) => {
      const quantityDiff = second[1].quantity - first[1].quantity
      if(quantityDiff !== 0) return quantityDiff
      return second[1].requestCount - first[1].requestCount
    })[0]

  const topDepartmentEntry = Array.from(departmentTotals.entries())
    .sort((first, second) => second[1] - first[1])[0]

  return {
    totalRequests: records.length,
    waitingRequests: records.filter(record => record.status === 'DRAFT').length,
    approvalWaitingRequests: records.filter(record => record.status === 'SUBMITTED').length,
    approvedRequests: records.filter(record => record.status === 'APPROVED' || record.status === 'PURCHASE_ORDER_CREATED').length,
    rejectedRequests: records.filter(record => record.status === 'REJECTED').length,
    urgentRequests: records.filter(record => record.priority === 'URGENT').length,
    todayRequests: records.filter(record => record.requestDate === todayKey).length,
    totalLines: records.reduce((total, record) => total + record.items.length, 0),
    totalEstimatedCost: roundMoney(records.reduce((total, record) => total + calculatePurchaseRequestTotal(record), 0)),
    sourceDistribution: Array.from(sourceTotals.entries()).map(([source, value]) => ({
      source,
      count: value.count,
      estimatedCost: value.estimatedCost
    })),
    statusDistribution: Array.from(statusTotals.entries()).map(([status, count]) => ({
      status,
      count
    })),
    priorityDistribution: Array.from(priorityTotals.entries()).map(([priority, count]) => ({
      priority,
      count
    })),
    topRequestedProduct: topProductEntry ? {
      stockItemId: topProductEntry[0],
      productName: stockItemMap.get(topProductEntry[0])?.name || 'Stok kartı bulunamadı',
      quantity: topProductEntry[1].quantity,
      requestCount: topProductEntry[1].requestCount
    } : emptyTopProduct,
    topRequestDepartment: topDepartmentEntry ? {
      department: topDepartmentEntry[0],
      count: topDepartmentEntry[1]
    } : {
      department: 'PRODUCTION',
      count: 0
    }
  }
}
