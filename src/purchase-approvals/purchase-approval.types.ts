export type PurchaseApprovalStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVISION_REQUIRED'

export type PurchaseApproval = {
  id: string
  approvalNo: string
  rfqId: string
  purchaseRequestId: string
  status: PurchaseApprovalStatus
  approvalDate: string
  approvedBy: string
  rejectedBy: string
  revisionRequestedBy: string
  approvalNote: string
  rejectionReason: string
  revisionReason: string
  createdAt: string
  updatedAt: string
}
