import type {
  PurchaseRequestActionLog,
  PurchaseRequestHistoryEvent,
  PurchaseRequestHistoryType,
  PurchaseRequestRecord,
  PurchaseRequestStatus
} from './purchase-request.types'

export const PURCHASE_REQUEST_NEXT_STATUSES: Partial<Record<PurchaseRequestStatus, PurchaseRequestStatus[]>> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CANCELLED', 'PURCHASE_ORDER_CREATED'],
  REJECTED: [],
  CANCELLED: [],
  PURCHASE_ORDER_CREATED: []
}

export const PURCHASE_REQUEST_WORKFLOW_ACTION_LABELS: Partial<Record<PurchaseRequestStatus, string>> = {
  SUBMITTED: 'Onaya Gönder',
  APPROVED: 'Onayla',
  REJECTED: 'Reddet',
  CANCELLED: 'İptal Et',
  PURCHASE_ORDER_CREATED: 'PO Oluşturuldu İşaretle'
}

const statusHistoryTypeMap: Record<PurchaseRequestStatus, PurchaseRequestHistoryType> = {
  DRAFT: 'UPDATED',
  SUBMITTED: 'SUBMITTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  PURCHASE_ORDER_CREATED: 'PO_MARKED'
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const canTransitionPurchaseRequest = (
  currentStatus: PurchaseRequestStatus,
  nextStatus: PurchaseRequestStatus
) => (
  PURCHASE_REQUEST_NEXT_STATUSES[currentStatus]?.includes(nextStatus) || false
)

export const createPurchaseRequestHistoryEvent = (
  type: PurchaseRequestHistoryType,
  description: string,
  actorName: string,
  createdAt = new Date().toISOString()
): PurchaseRequestHistoryEvent => ({
  id: createId('purchase_request_history'),
  type,
  description,
  actorName,
  createdAt
})

export const createPurchaseRequestActionLog = (
  type: string,
  message: string,
  actorName: string,
  createdAt = new Date().toISOString()
): PurchaseRequestActionLog => ({
  id: createId('purchase_request_log'),
  type,
  message,
  actorName,
  createdAt
})

export const transitionPurchaseRequest = (
  record: PurchaseRequestRecord,
  nextStatus: PurchaseRequestStatus,
  actorName: string,
  note = ''
): PurchaseRequestRecord => {
  if(record.status === nextStatus) return record

  if(!canTransitionPurchaseRequest(record.status, nextStatus)){
    throw new Error('Bu Purchase Request için geçersiz workflow geçişi.')
  }

  const now = new Date().toISOString()
  const description = note
    ? `${record.requestNo} durumu ${nextStatus} olarak güncellendi. ${note}`
    : `${record.requestNo} durumu ${nextStatus} olarak güncellendi.`

  return {
    ...record,
    status: nextStatus,
    updatedAt: now,
    history: [
      createPurchaseRequestHistoryEvent(statusHistoryTypeMap[nextStatus], description, actorName, now),
      ...(record.history || [])
    ],
    actionLogs: [
      createPurchaseRequestActionLog('WORKFLOW', description, actorName, now),
      ...(record.actionLogs || [])
    ]
  }
}
