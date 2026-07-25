import type { Branch } from '../types'
import type { PurchaseRequestRecord } from '../purchase-requests/purchase-request.types'
import type { Supplier, SupplierProduct } from '../supplier-management/supplier-management.types'
import type {
  RequestForQuotationRecord,
  RequestForQuotationStatus,
  RequestForQuotationSupplier,
  RequestForQuotationSupplierStatus,
  SupplierQuotation
} from './request-for-quotation.types'

export const REQUEST_FOR_QUOTATION_STORAGE_KEY = 'ra_request_for_quotations'
export const DEFAULT_RFQ_CURRENCY = 'TRY'

export const REQUEST_FOR_QUOTATION_STATUSES: RequestForQuotationStatus[] = [
  'DRAFT',
  'SENT',
  'PARTIALLY_RECEIVED',
  'COMPLETED',
  'CANCELLED'
]

export const REQUEST_FOR_QUOTATION_SUPPLIER_STATUSES: RequestForQuotationSupplierStatus[] = [
  'WAITING',
  'RESPONDED',
  'DECLINED'
]

export const REQUEST_FOR_QUOTATION_STATUS_LABELS: Record<RequestForQuotationStatus, string> = {
  DRAFT: 'Taslak',
  SENT: 'Gönderildi',
  PARTIALLY_RECEIVED: 'Kısmi Teklif',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal'
}

export const REQUEST_FOR_QUOTATION_SUPPLIER_STATUS_LABELS: Record<RequestForQuotationSupplierStatus, string> = {
  WAITING: 'Bekliyor',
  RESPONDED: 'Yanıtlandı',
  DECLINED: 'Reddedildi'
}

type RawRequestForQuotationRecord = Partial<Record<keyof RequestForQuotationRecord, unknown>> & Record<string, unknown>
type RawRequestForQuotationSupplier = Partial<Record<keyof RequestForQuotationSupplier, unknown>> & Record<string, unknown>
type RawSupplierQuotation = Partial<Record<keyof SupplierQuotation, unknown>> & Record<string, unknown>

type RfqSeed = {
  status: RequestForQuotationStatus
  issueDate: string
  dueDate: string
  supplierCount: number
  winnerMode: 'none' | 'partial' | 'all'
  notes: string
}

const DEFAULT_RFQ_STATUS: RequestForQuotationStatus = 'DRAFT'
const DEFAULT_SUPPLIER_STATUS: RequestForQuotationSupplierStatus = 'WAITING'

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawRequestForQuotationRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isSupplierRecord = (value: unknown): value is RawRequestForQuotationSupplier => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isQuotationRecord = (value: unknown): value is RawSupplierQuotation => (
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

const normalizeStatus = (value: unknown): RequestForQuotationStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return REQUEST_FOR_QUOTATION_STATUSES.includes(normalized as RequestForQuotationStatus)
    ? normalized as RequestForQuotationStatus
    : DEFAULT_RFQ_STATUS
}

const normalizeSupplierStatus = (value: unknown): RequestForQuotationSupplierStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return REQUEST_FOR_QUOTATION_SUPPLIER_STATUSES.includes(normalized as RequestForQuotationSupplierStatus)
    ? normalized as RequestForQuotationSupplierStatus
    : DEFAULT_SUPPLIER_STATUS
}

const normalizeDate = (value: unknown, fallback: string) => normalizeText(value) || fallback

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

export const calculateSupplierQuotationTotal = ({
  unitPrice,
  quantity,
  discount,
  taxRate
}: Pick<SupplierQuotation, 'unitPrice' | 'quantity' | 'discount' | 'taxRate'>) => {
  const grossTotal = Math.max(0, unitPrice) * Math.max(0, quantity)
  const discountedTotal = grossTotal * (1 - Math.min(100, Math.max(0, discount)) / 100)
  return roundMoney(discountedTotal * (1 + Math.max(0, taxRate) / 100))
}

export const getNextRequestForQuotationNo = (records: RequestForQuotationRecord[]) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.rfqNo.match(/RFQ-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `RFQ-${String(maxNo + 1).padStart(6, '0')}`
}

const createSeedRecords = (): RfqSeed[] => [
  { status: 'COMPLETED', issueDate: '2026-07-13', dueDate: '2026-07-16', supplierCount: 3, winnerMode: 'all', notes: 'Pizza hamuru talebi için kazanan teklifler seçildi.' },
  { status: 'COMPLETED', issueDate: '2026-07-13', dueDate: '2026-07-15', supplierCount: 2, winnerMode: 'all', notes: 'Izgara et grubu için hızlı teslim odaklı teklif.' },
  { status: 'PARTIALLY_RECEIVED', issueDate: '2026-07-14', dueDate: '2026-07-18', supplierCount: 4, winnerMode: 'partial', notes: 'Temizlik sarflarında bir tedarikçi dönüş bekleniyor.' },
  { status: 'SENT', issueDate: '2026-07-14', dueDate: '2026-07-17', supplierCount: 3, winnerMode: 'none', notes: 'Sos üretim ürünleri için teklifler bekleniyor.' },
  { status: 'COMPLETED', issueDate: '2026-07-15', dueDate: '2026-07-20', supplierCount: 3, winnerMode: 'all', notes: 'Paketleme kapları için karşılaştırma tamamlandı.' },
  { status: 'DRAFT', issueDate: '2026-07-15', dueDate: '2026-07-19', supplierCount: 2, winnerMode: 'none', notes: 'Süt ürünleri RFQ taslak aşamasında.' },
  { status: 'PARTIALLY_RECEIVED', issueDate: '2026-07-16', dueDate: '2026-07-22', supplierCount: 4, winnerMode: 'partial', notes: 'Kalite sarfları için kısmi teklif alındı.' },
  { status: 'CANCELLED', issueDate: '2026-07-16', dueDate: '2026-07-19', supplierCount: 2, winnerMode: 'none', notes: 'Sevkiyat kolileme ihtiyacı iptal edildi.' }
]

const getSeedSuppliers = (
  suppliers: Supplier[],
  supplierCount: number,
  seedIndex: number
) => {
  const activeSuppliers = suppliers.filter(supplier => (
    supplier.status !== 'BLOCKED'
    && supplier.status !== 'BLACKLISTED'
    && supplier.status !== 'SUSPENDED'
    && supplier.status !== 'PASSIVE'
  ))
  const sourceSuppliers = activeSuppliers.length > 0 ? activeSuppliers : suppliers

  return Array.from({ length: Math.min(supplierCount, sourceSuppliers.length) }, (_, index) => (
    sourceSuppliers[(seedIndex + index) % sourceSuppliers.length]
  ))
}

const findSupplierProduct = (
  supplierProducts: SupplierProduct[],
  supplierId: string,
  stockItemId: string,
  fallbackIndex: number
) => (
  supplierProducts.find(product => product.supplierId === supplierId && product.stockItemId === stockItemId)
  || supplierProducts.find(product => product.supplierId === supplierId)
  || supplierProducts.find(product => product.stockItemId === stockItemId)
  || supplierProducts[fallbackIndex % supplierProducts.length]
)

const getSupplierStatus = (
  rfqStatus: RequestForQuotationStatus,
  supplierIndex: number
): RequestForQuotationSupplierStatus => {
  if(rfqStatus === 'DRAFT' || rfqStatus === 'SENT') return 'WAITING'
  if(rfqStatus === 'CANCELLED') return supplierIndex === 0 ? 'DECLINED' : 'WAITING'
  if(rfqStatus === 'PARTIALLY_RECEIVED') return supplierIndex === 0 ? 'RESPONDED' : supplierIndex === 1 ? 'DECLINED' : 'WAITING'
  return 'RESPONDED'
}

const shouldMarkWinner = (
  mode: RfqSeed['winnerMode'],
  purchaseRequestItemIndex: number,
  supplierIndex: number
) => {
  if(mode === 'none') return false
  if(mode === 'partial' && purchaseRequestItemIndex > 0) return false
  return supplierIndex === 0
}

export const createRequestForQuotationMockData = (
  purchaseRequests: PurchaseRequestRecord[],
  suppliers: Supplier[],
  supplierProducts: SupplierProduct[],
  branches: Branch[]
): RequestForQuotationRecord[] => {
  if(purchaseRequests.length === 0 || suppliers.length === 0 || supplierProducts.length === 0) return []

  const fallbackBranchId = branches[0]?.id || ''

  return createSeedRecords()
    .slice(0, Math.min(8, purchaseRequests.length))
    .map((seed, seedIndex) => {
      const purchaseRequest = purchaseRequests[seedIndex % purchaseRequests.length]
      const rfqId = `rfq_${String(seedIndex + 1).padStart(3, '0')}`
      const rfqSuppliers = getSeedSuppliers(suppliers, seed.supplierCount, seedIndex)
      const createdAt = `${seed.issueDate}T09:${String(seedIndex * 4).padStart(2, '0')}:00.000Z`
      const supplierLinks: RequestForQuotationSupplier[] = rfqSuppliers.map((supplier, supplierIndex) => {
        const supplierStatus = getSupplierStatus(seed.status, supplierIndex)

        return {
          id: `${rfqId}_supplier_${String(supplierIndex + 1).padStart(2, '0')}`,
          rfqId,
          supplierId: supplier.id,
          status: supplierStatus,
          responseDate: supplierStatus === 'RESPONDED' ? seed.dueDate : '',
          notes: supplierStatus === 'DECLINED' ? 'Bu talep için teklif verilemedi.' : ''
        }
      })

      const quotations: SupplierQuotation[] = rfqSuppliers.flatMap((supplier, supplierIndex) => (
        purchaseRequest.items.map((item, itemIndex) => {
          const supplierProduct = findSupplierProduct(supplierProducts, supplier.id, item.stockItemId, seedIndex + supplierIndex + itemIndex)
          const priceFactor = 1 + (supplierIndex * 0.035) + (seedIndex * 0.01)
          const unitPrice = roundMoney(Math.max(1, item.estimatedUnitPrice * priceFactor))
          const quantity = item.quantity
          const discount = supplierIndex === 0 ? 2 : supplierIndex === 2 ? 1 : 0
          const taxRate = 10

          return {
            id: `${rfqId}_quote_${supplier.id}_${item.id}`,
            rfqId,
            supplierId: supplier.id,
            purchaseRequestItemId: item.id,
            supplierProductId: supplierProduct?.id || '',
            unitPrice,
            quantity,
            discount,
            taxRate,
            totalPrice: calculateSupplierQuotationTotal({ unitPrice, quantity, discount, taxRate }),
            currency: DEFAULT_RFQ_CURRENCY,
            deliveryDays: Math.max(1, supplier.leadTimeDays + supplierIndex),
            isWinner: shouldMarkWinner(seed.winnerMode, itemIndex, supplierIndex),
            notes: supplierProduct?.supplierProductName || ''
          }
        })
      ))

      return {
        id: rfqId,
        rfqNo: `RFQ-${String(seedIndex + 1).padStart(6, '0')}`,
        purchaseRequestId: purchaseRequest.id,
        title: `${purchaseRequest.title} teklif süreci`,
        description: purchaseRequest.description,
        issueDate: seed.issueDate,
        dueDate: seed.dueDate,
        status: seed.status,
        branchId: purchaseRequest.branchId || fallbackBranchId,
        createdBy: purchaseRequest.requester,
        notes: seed.notes,
        createdAt,
        updatedAt: createdAt,
        suppliers: supplierLinks,
        quotations
      }
    })
}

const normalizeSupplier = (
  item: RawRequestForQuotationSupplier,
  rfqId: string,
  index: number,
  suppliers: Supplier[]
): RequestForQuotationSupplier => {
  const requestedSupplierId = normalizeText(item.supplierId)
  const supplier = suppliers.find(record => record.id === requestedSupplierId) || suppliers[index % Math.max(suppliers.length, 1)]

  return {
    id: normalizeText(item.id) || `${rfqId}_supplier_${String(index + 1).padStart(2, '0')}`,
    rfqId,
    supplierId: supplier?.id || requestedSupplierId || '',
    status: normalizeSupplierStatus(item.status),
    responseDate: normalizeText(item.responseDate),
    notes: normalizeText(item.notes)
  }
}

const normalizeQuotation = (
  item: RawSupplierQuotation,
  rfqId: string,
  index: number,
  suppliers: Supplier[],
  supplierProducts: SupplierProduct[],
  purchaseRequests: PurchaseRequestRecord[]
): SupplierQuotation => {
  const requestedSupplierId = normalizeText(item.supplierId)
  const supplier = suppliers.find(record => record.id === requestedSupplierId) || suppliers[index % Math.max(suppliers.length, 1)]
  const requestedPurchaseRequestItemId = normalizeText(item.purchaseRequestItemId)
  const requestItemIds = new Set(purchaseRequests.flatMap(request => request.items.map(requestItem => requestItem.id)))
  const requestedSupplierProductId = normalizeText(item.supplierProductId)
  const supplierProduct = supplierProducts.find(product => product.id === requestedSupplierProductId)
  const unitPrice = normalizeNonNegativeNumber(item.unitPrice)
  const quantity = normalizePositiveNumber(item.quantity)
  const discount = normalizeNonNegativeNumber(item.discount)
  const taxRate = normalizeNonNegativeNumber(item.taxRate)

  return {
    id: normalizeText(item.id) || `${rfqId}_quote_${String(index + 1).padStart(3, '0')}`,
    rfqId,
    supplierId: supplier?.id || requestedSupplierId || '',
    purchaseRequestItemId: requestItemIds.has(requestedPurchaseRequestItemId) ? requestedPurchaseRequestItemId : requestedPurchaseRequestItemId,
    supplierProductId: supplierProduct?.id || requestedSupplierProductId || '',
    unitPrice,
    quantity,
    discount,
    taxRate,
    totalPrice: calculateSupplierQuotationTotal({ unitPrice, quantity, discount, taxRate }),
    currency: normalizeText(item.currency) || DEFAULT_RFQ_CURRENCY,
    deliveryDays: normalizeNonNegativeNumber(item.deliveryDays),
    isWinner: item.isWinner === true,
    notes: normalizeText(item.notes)
  }
}

const normalizeWinners = (quotations: SupplierQuotation[]) => {
  const winnerByItem = new Set<string>()

  return quotations.map(quotation => {
    if(!quotation.isWinner) return quotation
    if(winnerByItem.has(quotation.purchaseRequestItemId)) return { ...quotation, isWinner: false }

    winnerByItem.add(quotation.purchaseRequestItemId)
    return quotation
  })
}

const normalizeRequestForQuotation = (
  item: RawRequestForQuotationRecord,
  index: number,
  purchaseRequests: PurchaseRequestRecord[],
  suppliers: Supplier[],
  supplierProducts: SupplierProduct[],
  branches: Branch[]
): RequestForQuotationRecord => {
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const id = normalizeText(item.id) || `rfq_${Date.now()}_${index}`
  const requestedPurchaseRequestId = normalizeText(item.purchaseRequestId)
  const purchaseRequest = purchaseRequests.find(record => record.id === requestedPurchaseRequestId) || purchaseRequests[index % Math.max(purchaseRequests.length, 1)]
  const requestedBranchId = normalizeText(item.branchId)
  const branch = branches.find(record => record.id === requestedBranchId)
  const rawSuppliers = Array.isArray(item.suppliers)
    ? item.suppliers
    : Array.isArray(item.rfqSuppliers)
      ? item.rfqSuppliers
      : []
  const rawQuotations = Array.isArray(item.quotations)
    ? item.quotations
    : Array.isArray(item.supplierQuotations)
      ? item.supplierQuotations
      : []
  const createdAt = normalizeText(item.createdAt) || now

  return {
    id,
    rfqNo: normalizeText(item.rfqNo) || `RFQ-${String(index + 1).padStart(6, '0')}`,
    purchaseRequestId: purchaseRequest?.id || requestedPurchaseRequestId || '',
    title: normalizeText(item.title) || `${purchaseRequest?.title || 'Satın alma talebi'} teklif süreci`,
    description: normalizeText(item.description),
    issueDate: normalizeDate(item.issueDate, today),
    dueDate: normalizeDate(item.dueDate, today),
    status: normalizeStatus(item.status),
    branchId: branch?.id || purchaseRequest?.branchId || requestedBranchId || branches[0]?.id || '',
    createdBy: normalizeText(item.createdBy) || purchaseRequest?.requester || 'Sistem',
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    suppliers: rawSuppliers
      .filter(isSupplierRecord)
      .map((record, supplierIndex) => normalizeSupplier(record, id, supplierIndex, suppliers)),
    quotations: normalizeWinners(rawQuotations
      .filter(isQuotationRecord)
      .map((record, quotationIndex) => normalizeQuotation(record, id, quotationIndex, suppliers, supplierProducts, purchaseRequests)))
  }
}

export const saveRequestForQuotationRecords = (records: RequestForQuotationRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(REQUEST_FOR_QUOTATION_STORAGE_KEY, JSON.stringify(records))
}

export const loadRequestForQuotationRecords = (
  purchaseRequests: PurchaseRequestRecord[],
  suppliers: Supplier[],
  supplierProducts: SupplierProduct[],
  branches: Branch[]
) => {
  const seedRecords = createRequestForQuotationMockData(purchaseRequests, suppliers, supplierProducts, branches)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(REQUEST_FOR_QUOTATION_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveRequestForQuotationRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeRequestForQuotation(record, index, purchaseRequests, suppliers, supplierProducts, branches))

      saveRequestForQuotationRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveRequestForQuotationRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveRequestForQuotationRecords(seedRecords)
  return seedRecords
}
