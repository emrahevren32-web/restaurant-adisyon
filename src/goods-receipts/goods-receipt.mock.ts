import type { PurchaseOrder, PurchaseOrderStatus } from '../purchase-orders/purchase-order.types'
import { getPurchaseOrderSourceQuotations } from '../purchase-orders/purchase-order.mock'
import type { PurchaseRequestRecord } from '../purchase-requests/purchase-request.types'
import type { RequestForQuotationRecord } from '../request-for-quotations/request-for-quotation.types'
import type { StockItem, StockUnit } from '../types'
import type { GoodsReceiptItem, GoodsReceiptRecord, GoodsReceiptStatus } from './goods-receipt.types'

export const GOODS_RECEIPT_STORAGE_KEY = 'ra_goods_receipts'

export const GOODS_RECEIPT_STATUSES: GoodsReceiptStatus[] = [
  'DRAFT',
  'RECEIVED',
  'PARTIALLY_RECEIVED',
  'COMPLETED',
  'CANCELLED'
]

export const GOODS_RECEIPT_STATUS_LABELS: Record<GoodsReceiptStatus, string> = {
  DRAFT: 'Taslak',
  RECEIVED: 'Teslim Alındı',
  PARTIALLY_RECEIVED: 'Kısmi Teslim',
  COMPLETED: 'Tamamlandı',
  WAITING: 'Bekliyor',
  INSPECTING: 'Kontrol Ediliyor',
  ACCEPTED: 'Kabul Edildi',
  PARTIAL_ACCEPTED: 'Kısmi Kabul',
  REJECTED: 'Reddedildi',
  CANCELLED: 'İptal'
}

export type GoodsReceiptOrderLine = {
  purchaseOrderItemId: string
  stockItemId: string
  orderedQuantity: number
  unit: StockUnit
  supplierProductId: string
}

export type GoodsReceiptLineTotals = {
  receivedQuantity: number
  acceptedQuantity: number
  rejectedQuantity: number
}

type RawGoodsReceiptRecord = Partial<Record<keyof GoodsReceiptRecord, unknown>> & Record<string, unknown>
type RawGoodsReceiptItem = Partial<Record<keyof GoodsReceiptItem, unknown>> & Record<string, unknown>

const DEFAULT_STATUS: GoodsReceiptStatus = 'DRAFT'
const DEFAULT_UNIT: StockUnit = 'adet'
const QUANTITY_ROUNDING_FACTOR = 1000

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawGoodsReceiptRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawGoodsReceiptItem => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const normalizeStatus = (value: unknown): GoodsReceiptStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return GOODS_RECEIPT_STATUSES.includes(normalized as GoodsReceiptStatus)
    ? normalized as GoodsReceiptStatus
    : DEFAULT_STATUS
}

const normalizeUnit = (value: unknown): StockUnit => {
  const normalized = normalizeText(value)
  const units: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
  return units.includes(normalized as StockUnit) ? normalized as StockUnit : DEFAULT_UNIT
}

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

export const getNextGoodsReceiptNo = (records: GoodsReceiptRecord[]) => {
  const maxNo = records.reduce((max, receipt) => {
    const match = receipt.receiptNo.match(/GR-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `GR-${String(maxNo + 1).padStart(6, '0')}`
}

export const getGoodsReceiptOrderLines = (
  purchaseOrder: PurchaseOrder | null | undefined,
  rfqMap: Map<string, RequestForQuotationRecord>,
  purchaseRequestMap: Map<string, PurchaseRequestRecord>
): GoodsReceiptOrderLine[] => {
  if(!purchaseOrder) return []

  const rfq = rfqMap.get(purchaseOrder.rfqId)
  const purchaseRequest = purchaseRequestMap.get(purchaseOrder.purchaseRequestId)
  if(!rfq || !purchaseRequest) return []

  return getPurchaseOrderSourceQuotations(rfq, purchaseOrder.supplierId)
    .map(quotation => {
      const requestItem = purchaseRequest.items.find(item => item.id === quotation.purchaseRequestItemId)
      if(!requestItem) return null

      return {
        purchaseOrderItemId: quotation.id,
        stockItemId: requestItem.stockItemId,
        orderedQuantity: quotation.quantity,
        unit: requestItem.unit,
        supplierProductId: quotation.supplierProductId
      }
    })
    .filter((line): line is GoodsReceiptOrderLine => Boolean(line))
}

export const getGoodsReceiptTotalsByOrderItem = (
  records: GoodsReceiptRecord[],
  purchaseOrderId: string
) => {
  const totals = new Map<string, GoodsReceiptLineTotals>()

  records
    .filter(record => record.purchaseOrderId === purchaseOrderId && record.status !== 'CANCELLED' && record.status !== 'DRAFT')
    .forEach(record => {
      record.items.forEach(item => {
        const current = totals.get(item.purchaseOrderItemId) || {
          receivedQuantity: 0,
          acceptedQuantity: 0,
          rejectedQuantity: 0
        }

        totals.set(item.purchaseOrderItemId, {
          receivedQuantity: roundQuantity(current.receivedQuantity + item.receivedQuantity),
          acceptedQuantity: roundQuantity(current.acceptedQuantity + item.acceptedQuantity),
          rejectedQuantity: roundQuantity(current.rejectedQuantity + item.rejectedQuantity)
        })
      })
    })

  return totals
}

export const calculateGoodsReceiptStatus = (
  lines: GoodsReceiptOrderLine[],
  previousTotals: Map<string, GoodsReceiptLineTotals>,
  currentItems: GoodsReceiptItem[]
): GoodsReceiptStatus => {
  const hasReceivedQuantity = currentItems.some(item => item.receivedQuantity > 0 || item.acceptedQuantity > 0 || item.rejectedQuantity > 0)
  if(!hasReceivedQuantity) return 'DRAFT'

  const currentTotals = new Map(previousTotals)
  currentItems.forEach(item => {
    const previous = currentTotals.get(item.purchaseOrderItemId) || {
      receivedQuantity: 0,
      acceptedQuantity: 0,
      rejectedQuantity: 0
    }

    currentTotals.set(item.purchaseOrderItemId, {
      receivedQuantity: roundQuantity(previous.receivedQuantity + item.receivedQuantity),
      acceptedQuantity: roundQuantity(previous.acceptedQuantity + item.acceptedQuantity),
      rejectedQuantity: roundQuantity(previous.rejectedQuantity + item.rejectedQuantity)
    })
  })

  const isCompleted = lines.length > 0 && lines.every(line => (
    (currentTotals.get(line.purchaseOrderItemId)?.acceptedQuantity || 0) >= line.orderedQuantity
  ))

  return isCompleted ? 'COMPLETED' : 'PARTIALLY_RECEIVED'
}

export const calculatePurchaseOrderStatusAfterReceipt = (
  purchaseOrder: PurchaseOrder,
  lines: GoodsReceiptOrderLine[],
  records: GoodsReceiptRecord[]
): PurchaseOrderStatus => {
  if(purchaseOrder.status === 'CANCELLED') return purchaseOrder.status

  const totals = getGoodsReceiptTotalsByOrderItem(records, purchaseOrder.id)
  const hasReceipt = Array.from(totals.values()).some(total => total.receivedQuantity > 0 || total.acceptedQuantity > 0)
  const isCompleted = lines.length > 0 && lines.every(line => (
    (totals.get(line.purchaseOrderItemId)?.acceptedQuantity || 0) >= line.orderedQuantity
  ))

  if(isCompleted) return 'COMPLETED'
  if(hasReceipt) return 'PARTIALLY_RECEIVED'
  return purchaseOrder.status
}

export const hasOverReceiptQuantity = (
  lines: GoodsReceiptOrderLine[],
  previousTotals: Map<string, GoodsReceiptLineTotals>,
  currentItems: GoodsReceiptItem[]
) => (
  currentItems.some(item => {
    const orderedQuantity = lines.find(line => line.purchaseOrderItemId === item.purchaseOrderItemId)?.orderedQuantity || 0
    const previousReceived = previousTotals.get(item.purchaseOrderItemId)?.receivedQuantity || 0
    return previousReceived + item.receivedQuantity > orderedQuantity
  })
)

export const applyGoodsReceiptStockQuantities = (
  stockItems: StockItem[],
  receiptItems: GoodsReceiptItem[]
): StockItem[] => {
  const acceptedByStockItem = receiptItems.reduce((map, item) => {
    if(item.acceptedQuantity <= 0) return map
    map.set(item.stockItemId, roundQuantity((map.get(item.stockItemId) || 0) + item.acceptedQuantity))
    return map
  }, new Map<string, number>())

  if(acceptedByStockItem.size === 0) return stockItems

  const now = new Date().toISOString()
  return stockItems.map(stockItem => {
    const acceptedQuantity = acceptedByStockItem.get(stockItem.id)
    if(!acceptedQuantity) return stockItem

    return {
      ...stockItem,
      currentQty: roundQuantity(stockItem.currentQty + acceptedQuantity),
      updatedAt: now
    }
  })
}

const normalizeGoodsReceiptItem = (
  item: RawGoodsReceiptItem,
  index: number,
  receiptId: string
): GoodsReceiptItem => {
  const receivedQuantity = normalizeNonNegativeNumber(item.receivedQuantity)
  const acceptedQuantity = Math.min(receivedQuantity, normalizeNonNegativeNumber(item.acceptedQuantity))
  const rejectedQuantity = Math.min(
    Math.max(0, receivedQuantity - acceptedQuantity),
    normalizeNonNegativeNumber(item.rejectedQuantity)
  )

  return {
    id: normalizeText(item.id) || `${receiptId}_item_${String(index + 1).padStart(2, '0')}`,
    receiptId,
    purchaseOrderItemId: normalizeText(item.purchaseOrderItemId),
    stockItemId: normalizeText(item.stockItemId),
    orderedQuantity: normalizePositiveNumber(item.orderedQuantity),
    receivedQuantity,
    acceptedQuantity,
    rejectedQuantity,
    unit: normalizeUnit(item.unit),
    notes: normalizeText(item.notes)
  }
}

const createReceiptItem = (
  receiptId: string,
  line: GoodsReceiptOrderLine,
  index: number,
  previousTotals: Map<string, GoodsReceiptLineTotals>,
  completionRate: number,
  rejectedQuantity: number
): GoodsReceiptItem => {
  const previousAccepted = previousTotals.get(line.purchaseOrderItemId)?.acceptedQuantity || 0
  const remainingQuantity = Math.max(0, line.orderedQuantity - previousAccepted)
  const receivedQuantity = roundQuantity(remainingQuantity * completionRate + rejectedQuantity)
  const acceptedQuantity = roundQuantity(Math.min(remainingQuantity, remainingQuantity * completionRate))

  return {
    id: `${receiptId}_item_${String(index + 1).padStart(2, '0')}`,
    receiptId,
    purchaseOrderItemId: line.purchaseOrderItemId,
    stockItemId: line.stockItemId,
    orderedQuantity: line.orderedQuantity,
    receivedQuantity,
    acceptedQuantity,
    rejectedQuantity,
    unit: line.unit,
    notes: rejectedQuantity > 0 ? 'Red miktarı stoğa alınmadı.' : ''
  }
}

export const createGoodsReceiptMockData = (
  purchaseOrders: PurchaseOrder[],
  rfqRecords: RequestForQuotationRecord[],
  purchaseRequests: PurchaseRequestRecord[]
): GoodsReceiptRecord[] => {
  const rfqMap = new Map(rfqRecords.map(rfq => [rfq.id, rfq]))
  const purchaseRequestMap = new Map(purchaseRequests.map(request => [request.id, request]))
  const sourceOrders = purchaseOrders
    .filter(order => order.status !== 'CANCELLED')
    .slice(0, 10)

  return sourceOrders.map((purchaseOrder, index) => {
    const receiptId = `goods_receipt_${String(index + 1).padStart(3, '0')}`
    const completionRate = index % 3 === 0 ? 1 : index % 3 === 1 ? 0.6 : 0.9
    const lines = getGoodsReceiptOrderLines(purchaseOrder, rfqMap, purchaseRequestMap)
    const emptyTotals = new Map<string, GoodsReceiptLineTotals>()
    const receiptDate = `2026-07-${String(20 + (index % 7)).padStart(2, '0')}`
    const items = lines.map((line, lineIndex) => (
      createReceiptItem(
        receiptId,
        line,
        lineIndex,
        emptyTotals,
        completionRate,
        completionRate === 0.9 && lineIndex === 0 ? roundQuantity(line.orderedQuantity * 0.05) : 0
      )
    ))
    const status = calculateGoodsReceiptStatus(lines, emptyTotals, items)
    const createdAt = `${receiptDate}T12:${String(index * 4).padStart(2, '0')}:00.000Z`

    return {
      id: receiptId,
      receiptNo: `GR-${String(index + 1).padStart(6, '0')}`,
      purchaseOrderId: purchaseOrder.id,
      supplierId: purchaseOrder.supplierId,
      warehouseId: rfqMap.get(purchaseOrder.rfqId)?.branchId || purchaseRequestMap.get(purchaseOrder.purchaseRequestId)?.branchId || '',
      receiptDate,
      receivedBy: index % 2 === 0 ? 'Depo Sorumlusu' : 'Mal Kabul Ekibi',
      status,
      notes: status === 'COMPLETED' ? 'Sipariş tam teslim alındı.' : 'Kısmi teslim kaydı.',
      createdAt,
      updatedAt: createdAt,
      items
    }
  })
}

const normalizeGoodsReceipt = (
  item: RawGoodsReceiptRecord,
  index: number,
  purchaseOrders: PurchaseOrder[]
): GoodsReceiptRecord => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const purchaseOrderId = normalizeText(item.purchaseOrderId)
  const purchaseOrder = purchaseOrders.find(order => order.id === purchaseOrderId)
  const receiptId = normalizeText(item.id) || `goods_receipt_${Date.now()}_${index}`
  const rawItems = Array.isArray(item.items) ? item.items : []

  return {
    id: receiptId,
    receiptNo: normalizeText(item.receiptNo) || `GR-${String(index + 1).padStart(6, '0')}`,
    purchaseOrderId: purchaseOrder?.id || purchaseOrderId,
    supplierId: normalizeText(item.supplierId) || purchaseOrder?.supplierId || '',
    warehouseId: normalizeText(item.warehouseId),
    receiptDate: normalizeText(item.receiptDate) || new Date().toLocaleDateString('sv-SE'),
    receivedBy: normalizeText(item.receivedBy) || 'Mal Kabul',
    status: normalizeStatus(item.status),
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    items: rawItems
      .filter(isItemRecord)
      .map((record, itemIndex) => normalizeGoodsReceiptItem(record, itemIndex, receiptId))
  }
}

export const saveGoodsReceiptRecords = (records: GoodsReceiptRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(GOODS_RECEIPT_STORAGE_KEY, JSON.stringify(records))
}

export const loadGoodsReceiptRecords = (
  purchaseOrders: PurchaseOrder[],
  rfqRecords: RequestForQuotationRecord[],
  purchaseRequests: PurchaseRequestRecord[]
) => {
  const seedRecords = createGoodsReceiptMockData(purchaseOrders, rfqRecords, purchaseRequests)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(GOODS_RECEIPT_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveGoodsReceiptRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeGoodsReceipt(record, index, purchaseOrders))

      saveGoodsReceiptRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveGoodsReceiptRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveGoodsReceiptRecords(seedRecords)
  return seedRecords
}
