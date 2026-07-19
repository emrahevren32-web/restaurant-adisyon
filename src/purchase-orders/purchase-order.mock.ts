import type { PurchaseApproval } from '../purchase-approvals/purchase-approval.types'
import type { RequestForQuotationRecord, SupplierQuotation } from '../request-for-quotations/request-for-quotation.types'
import type { PurchaseOrder, PurchaseOrderStatus } from './purchase-order.types'

export const PURCHASE_ORDER_STORAGE_KEY = 'ra_purchase_orders'
export const DEFAULT_PURCHASE_ORDER_CURRENCY = 'TRY'

export const PURCHASE_ORDER_STATUSES: PurchaseOrderStatus[] = [
  'DRAFT',
  'SENT',
  'CONFIRMED',
  'PARTIALLY_RECEIVED',
  'COMPLETED',
  'CANCELLED'
]

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Taslak',
  SENT: 'Gönderildi',
  CONFIRMED: 'Teyit Edildi',
  PARTIALLY_RECEIVED: 'Kısmi Teslim',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal'
}

export const PURCHASE_ORDER_NEXT_STATUS: Partial<Record<PurchaseOrderStatus, PurchaseOrderStatus>> = {
  DRAFT: 'SENT',
  SENT: 'CONFIRMED',
  CONFIRMED: 'PARTIALLY_RECEIVED',
  PARTIALLY_RECEIVED: 'COMPLETED'
}

export const PURCHASE_ORDER_NEXT_STATUS_LABELS: Partial<Record<PurchaseOrderStatus, string>> = {
  DRAFT: 'Gönder',
  SENT: 'Teyit Et',
  CONFIRMED: 'Kısmi Teslim',
  PARTIALLY_RECEIVED: 'Tamamla'
}

type RawPurchaseOrderRecord = Partial<Record<keyof PurchaseOrder, unknown>> & Record<string, unknown>

const MONEY_ROUNDING_FACTOR = 100
const PERCENT_DIVISOR = 100
const DEFAULT_PAYMENT_TERM = '30 gün'
const DEFAULT_STATUS: PurchaseOrderStatus = 'DRAFT'

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawPurchaseOrderRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const normalizeStatus = (value: unknown): PurchaseOrderStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return PURCHASE_ORDER_STATUSES.includes(normalized as PurchaseOrderStatus)
    ? normalized as PurchaseOrderStatus
    : DEFAULT_STATUS
}

const roundMoney = (value: number) => (
  Math.round((value + Number.EPSILON) * MONEY_ROUNDING_FACTOR) / MONEY_ROUNDING_FACTOR
)

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue
  date.setDate(date.getDate() + Math.max(0, days))
  return date.toLocaleDateString('sv-SE')
}

const getQuotationNetTotal = (quotation: Pick<SupplierQuotation, 'unitPrice' | 'quantity' | 'discount'>) => {
  const grossTotal = Math.max(0, quotation.unitPrice) * Math.max(0, quotation.quantity)
  const discountRate = Math.min(PERCENT_DIVISOR, Math.max(0, quotation.discount)) / PERCENT_DIVISOR
  return roundMoney(grossTotal * (1 - discountRate))
}

export const calculatePurchaseOrderLineTotals = (quotation: SupplierQuotation) => {
  const subtotal = getQuotationNetTotal(quotation)
  const grandTotal = roundMoney(quotation.totalPrice)
  const taxTotal = roundMoney(Math.max(0, grandTotal - subtotal))

  return { subtotal, taxTotal, grandTotal }
}

export const getPurchaseOrderSourceQuotations = (
  rfq: RequestForQuotationRecord | null | undefined,
  supplierId: string
) => (
  rfq
    ? rfq.quotations.filter(quotation => quotation.isWinner && quotation.supplierId === supplierId)
    : []
)

export const getWinningSupplierIds = (rfq: RequestForQuotationRecord | null | undefined) => (
  Array.from(new Set((rfq?.quotations || [])
    .filter(quotation => quotation.isWinner)
    .map(quotation => quotation.supplierId)))
)

export const calculatePurchaseOrderTotals = (
  rfq: RequestForQuotationRecord | null | undefined,
  supplierId: string
) => {
  const quotations = getPurchaseOrderSourceQuotations(rfq, supplierId)
  const subtotal = roundMoney(quotations.reduce((total, quotation) => (
    total + calculatePurchaseOrderLineTotals(quotation).subtotal
  ), 0))
  const grandTotal = roundMoney(quotations.reduce((total, quotation) => total + quotation.totalPrice, 0))
  const taxTotal = roundMoney(Math.max(0, grandTotal - subtotal))
  const currency = quotations[0]?.currency || DEFAULT_PURCHASE_ORDER_CURRENCY

  return { subtotal, taxTotal, grandTotal, currency, itemCount: quotations.length }
}

export const hasPurchaseOrderForApproval = (
  records: PurchaseOrder[],
  approvalId: string,
  excludedOrderId = ''
) => (
  records.some(record => (
    record.id !== excludedOrderId
    && record.approvalId === approvalId
  ))
)

export const isPurchaseOrderTerminalStatus = (status: PurchaseOrderStatus) => (
  status === 'COMPLETED' || status === 'CANCELLED'
)

export const getNextPurchaseOrderNo = (records: PurchaseOrder[]) => {
  const maxNo = records.reduce((max, order) => {
    const match = order.orderNo.match(/PO-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `PO-${String(maxNo + 1).padStart(6, '0')}`
}

const getApprovalRfq = (
  approval: PurchaseApproval,
  rfqRecords: RequestForQuotationRecord[]
) => (
  rfqRecords.find(rfq => rfq.id === approval.rfqId) || null
)

const getApprovedApprovalsWithWinner = (
  approvalRecords: PurchaseApproval[],
  rfqRecords: RequestForQuotationRecord[]
) => (
  approvalRecords.filter(approval => {
    const rfq = getApprovalRfq(approval, rfqRecords)
    return approval.status === 'APPROVED' && getWinningSupplierIds(rfq).length > 0
  })
)

export const createPurchaseOrderMockData = (
  approvalRecords: PurchaseApproval[],
  rfqRecords: RequestForQuotationRecord[]
): PurchaseOrder[] => {
  const eligibleApprovals = getApprovedApprovalsWithWinner(approvalRecords, rfqRecords)
  const statuses: PurchaseOrderStatus[] = [
    'DRAFT',
    'SENT',
    'CONFIRMED',
    'PARTIALLY_RECEIVED',
    'COMPLETED',
    'SENT',
    'CONFIRMED',
    'PARTIALLY_RECEIVED',
    'COMPLETED',
    'DRAFT'
  ]

  return eligibleApprovals
    .slice(0, 10)
    .map((approval, index) => {
      const rfq = getApprovalRfq(approval, rfqRecords)
      const supplierId = getWinningSupplierIds(rfq)[0] || ''
      const totals = calculatePurchaseOrderTotals(rfq, supplierId)
      const orderDate = approval.approvalDate || `2026-07-${String(17 + index).padStart(2, '0')}`
      const createdAt = `${orderDate}T11:${String(index * 4).padStart(2, '0')}:00.000Z`

      return {
        id: `purchase_order_${String(index + 1).padStart(3, '0')}`,
        orderNo: `PO-${String(index + 1).padStart(6, '0')}`,
        approvalId: approval.id,
        rfqId: approval.rfqId,
        purchaseRequestId: approval.purchaseRequestId,
        supplierId,
        orderDate,
        expectedDeliveryDate: addDays(orderDate, 3 + (index % 4)),
        status: statuses[index % statuses.length],
        paymentTerm: DEFAULT_PAYMENT_TERM,
        currency: totals.currency,
        subtotal: totals.subtotal,
        taxTotal: totals.taxTotal,
        grandTotal: totals.grandTotal,
        notes: 'Onaylı RFQ kazanan tekliflerinden oluşturulan örnek satın alma siparişi.',
        createdBy: approval.approvedBy || 'Satın Alma',
        createdAt,
        updatedAt: createdAt
      }
    })
}

const normalizePurchaseOrder = (
  item: RawPurchaseOrderRecord,
  index: number,
  approvalRecords: PurchaseApproval[],
  rfqRecords: RequestForQuotationRecord[]
): PurchaseOrder => {
  const now = new Date().toISOString()
  const requestedApprovalId = normalizeText(item.approvalId)
  const approval = approvalRecords.find(record => record.id === requestedApprovalId)
  const requestedRfqId = normalizeText(item.rfqId)
  const rfq = approval
    ? getApprovalRfq(approval, rfqRecords)
    : rfqRecords.find(record => record.id === requestedRfqId) || null
  const supplierId = normalizeText(item.supplierId) || getWinningSupplierIds(rfq)[0] || ''
  const totals = calculatePurchaseOrderTotals(rfq, supplierId)
  const createdAt = normalizeText(item.createdAt) || now

  return {
    id: normalizeText(item.id) || `purchase_order_${Date.now()}_${index}`,
    orderNo: normalizeText(item.orderNo) || `PO-${String(index + 1).padStart(6, '0')}`,
    approvalId: approval?.id || requestedApprovalId,
    rfqId: approval?.rfqId || rfq?.id || requestedRfqId,
    purchaseRequestId: approval?.purchaseRequestId || rfq?.purchaseRequestId || normalizeText(item.purchaseRequestId),
    supplierId,
    orderDate: normalizeText(item.orderDate) || new Date().toLocaleDateString('sv-SE'),
    expectedDeliveryDate: normalizeText(item.expectedDeliveryDate),
    status: normalizeStatus(item.status),
    paymentTerm: normalizeText(item.paymentTerm) || DEFAULT_PAYMENT_TERM,
    currency: normalizeText(item.currency) || totals.currency,
    subtotal: normalizeText(item.subtotal) ? normalizeNonNegativeNumber(item.subtotal) : totals.subtotal,
    taxTotal: normalizeText(item.taxTotal) ? normalizeNonNegativeNumber(item.taxTotal) : totals.taxTotal,
    grandTotal: normalizeText(item.grandTotal) ? normalizeNonNegativeNumber(item.grandTotal) : totals.grandTotal,
    notes: normalizeText(item.notes),
    createdBy: normalizeText(item.createdBy) || 'Satın Alma',
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const savePurchaseOrderRecords = (records: PurchaseOrder[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(PURCHASE_ORDER_STORAGE_KEY, JSON.stringify(records))
}

export const loadPurchaseOrderRecords = (
  approvalRecords: PurchaseApproval[],
  rfqRecords: RequestForQuotationRecord[]
) => {
  const seedRecords = createPurchaseOrderMockData(approvalRecords, rfqRecords)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(PURCHASE_ORDER_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) savePurchaseOrderRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizePurchaseOrder(record, index, approvalRecords, rfqRecords))

      savePurchaseOrderRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) savePurchaseOrderRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) savePurchaseOrderRecords(seedRecords)
  return seedRecords
}
