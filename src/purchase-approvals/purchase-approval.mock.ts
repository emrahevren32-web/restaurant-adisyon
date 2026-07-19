import type { RequestForQuotationRecord } from '../request-for-quotations/request-for-quotation.types'
import type { PurchaseApproval, PurchaseApprovalStatus } from './purchase-approval.types'

export const PURCHASE_APPROVAL_STORAGE_KEY = 'ra_purchase_approvals'

export const PURCHASE_APPROVAL_STATUSES: PurchaseApprovalStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'REVISION_REQUIRED'
]

export const PURCHASE_APPROVAL_STATUS_LABELS: Record<PurchaseApprovalStatus, string> = {
  PENDING: 'Onay Bekliyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  REVISION_REQUIRED: 'Revizyon Gerekli'
}

type RawPurchaseApprovalRecord = Partial<Record<keyof PurchaseApproval, unknown>> & Record<string, unknown>

type ApprovalSeed = {
  status: PurchaseApprovalStatus
  approvalDate: string
  approvedBy: string
  rejectedBy: string
  revisionRequestedBy: string
  approvalNote: string
  rejectionReason: string
  revisionReason: string
}

const DEFAULT_STATUS: PurchaseApprovalStatus = 'PENDING'

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawPurchaseApprovalRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeStatus = (value: unknown): PurchaseApprovalStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return PURCHASE_APPROVAL_STATUSES.includes(normalized as PurchaseApprovalStatus)
    ? normalized as PurchaseApprovalStatus
    : DEFAULT_STATUS
}

const createSeedRecords = (): ApprovalSeed[] => [
  {
    status: 'APPROVED',
    approvalDate: '2026-07-17',
    approvedBy: 'Satın Alma Müdürü',
    rejectedBy: '',
    revisionRequestedBy: '',
    approvalNote: 'Pizza hamuru talebi için kazanan teklifler onaylandı.',
    rejectionReason: '',
    revisionReason: ''
  },
  {
    status: 'APPROVED',
    approvalDate: '2026-07-17',
    approvedBy: 'Operasyon Direktörü',
    rejectedBy: '',
    revisionRequestedBy: '',
    approvalNote: 'Izgara grubu hızlı teslim şartıyla onaylandı.',
    rejectionReason: '',
    revisionReason: ''
  },
  {
    status: 'REVISION_REQUIRED',
    approvalDate: '2026-07-18',
    approvedBy: '',
    rejectedBy: '',
    revisionRequestedBy: 'Finans Kontrol',
    approvalNote: '',
    rejectionReason: '',
    revisionReason: 'Temizlik sarflarında ikinci tedarikçi fiyatı tekrar alınmalı.'
  },
  {
    status: 'PENDING',
    approvalDate: '',
    approvedBy: '',
    rejectedBy: '',
    revisionRequestedBy: '',
    approvalNote: '',
    rejectionReason: '',
    revisionReason: ''
  },
  {
    status: 'APPROVED',
    approvalDate: '2026-07-18',
    approvedBy: 'Satın Alma Müdürü',
    rejectedBy: '',
    revisionRequestedBy: '',
    approvalNote: 'Paketleme kapları bütçe içinde kaldı.',
    rejectionReason: '',
    revisionReason: ''
  },
  {
    status: 'REJECTED',
    approvalDate: '2026-07-18',
    approvedBy: '',
    rejectedBy: 'Genel Müdür',
    revisionRequestedBy: '',
    approvalNote: '',
    rejectionReason: 'Süt ürünleri RFQ taslağı eksik fiyat bilgisi içeriyor.',
    revisionReason: ''
  },
  {
    status: 'REVISION_REQUIRED',
    approvalDate: '2026-07-19',
    approvedBy: '',
    rejectedBy: '',
    revisionRequestedBy: 'Satın Alma Müdürü',
    approvalNote: '',
    rejectionReason: '',
    revisionReason: 'Kalite sarflarında teslim süresi çok uzun.'
  },
  {
    status: 'PENDING',
    approvalDate: '',
    approvedBy: '',
    rejectedBy: '',
    revisionRequestedBy: '',
    approvalNote: '',
    rejectionReason: '',
    revisionReason: ''
  }
]

export const hasWinningQuotation = (rfq: RequestForQuotationRecord) => (
  rfq.quotations.some(quotation => quotation.isWinner)
)

export const hasActivePurchaseApproval = (
  records: PurchaseApproval[],
  rfqId: string,
  excludedApprovalId = ''
) => (
  records.some(record => (
    record.id !== excludedApprovalId
    && record.rfqId === rfqId
    && record.status === 'PENDING'
  ))
)

export const getNextPurchaseApprovalNo = (records: PurchaseApproval[]) => {
  const maxNo = records.reduce((max, approval) => {
    const match = approval.approvalNo.match(/PA-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `PA-${String(maxNo + 1).padStart(6, '0')}`
}

export const createPurchaseApprovalMockData = (
  rfqRecords: RequestForQuotationRecord[]
): PurchaseApproval[] => {
  const eligibleRfqs = rfqRecords.filter(hasWinningQuotation)
  if(eligibleRfqs.length === 0) return []

  return createSeedRecords()
    .slice(0, 8)
    .map((seed, index) => {
      const rfq = eligibleRfqs[index % eligibleRfqs.length]
      const createdAt = `2026-07-${String(17 + Math.floor(index / 3)).padStart(2, '0')}T10:${String(index * 5).padStart(2, '0')}:00.000Z`

      return {
        id: `purchase_approval_${String(index + 1).padStart(3, '0')}`,
        approvalNo: `PA-${String(index + 1).padStart(6, '0')}`,
        rfqId: rfq.id,
        purchaseRequestId: rfq.purchaseRequestId,
        status: seed.status,
        approvalDate: seed.approvalDate,
        approvedBy: seed.approvedBy,
        rejectedBy: seed.rejectedBy,
        revisionRequestedBy: seed.revisionRequestedBy,
        approvalNote: seed.approvalNote,
        rejectionReason: seed.rejectionReason,
        revisionReason: seed.revisionReason,
        createdAt,
        updatedAt: createdAt
      }
    })
}

const normalizePurchaseApproval = (
  item: RawPurchaseApprovalRecord,
  index: number,
  rfqRecords: RequestForQuotationRecord[]
): PurchaseApproval => {
  const now = new Date().toISOString()
  const requestedRfqId = normalizeText(item.rfqId)
  const rfq = rfqRecords.find(record => record.id === requestedRfqId) || rfqRecords[index % Math.max(rfqRecords.length, 1)]
  const createdAt = normalizeText(item.createdAt) || now
  const status = normalizeStatus(item.status)

  return {
    id: normalizeText(item.id) || `purchase_approval_${Date.now()}_${index}`,
    approvalNo: normalizeText(item.approvalNo) || `PA-${String(index + 1).padStart(6, '0')}`,
    rfqId: rfq?.id || requestedRfqId || '',
    purchaseRequestId: rfq?.purchaseRequestId || normalizeText(item.purchaseRequestId),
    status,
    approvalDate: normalizeText(item.approvalDate),
    approvedBy: status === 'APPROVED' ? normalizeText(item.approvedBy) : '',
    rejectedBy: status === 'REJECTED' ? normalizeText(item.rejectedBy) : '',
    revisionRequestedBy: status === 'REVISION_REQUIRED' ? normalizeText(item.revisionRequestedBy) : '',
    approvalNote: normalizeText(item.approvalNote),
    rejectionReason: normalizeText(item.rejectionReason),
    revisionReason: normalizeText(item.revisionReason),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const savePurchaseApprovalRecords = (records: PurchaseApproval[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(PURCHASE_APPROVAL_STORAGE_KEY, JSON.stringify(records))
}

export const loadPurchaseApprovalRecords = (
  rfqRecords: RequestForQuotationRecord[]
) => {
  const seedRecords = createPurchaseApprovalMockData(rfqRecords)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(PURCHASE_APPROVAL_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) savePurchaseApprovalRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizePurchaseApproval(record, index, rfqRecords))

      savePurchaseApprovalRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) savePurchaseApprovalRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) savePurchaseApprovalRecords(seedRecords)
  return seedRecords
}
