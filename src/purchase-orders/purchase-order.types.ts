export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'SENT'
  | 'CONFIRMED'
  | 'PARTIALLY_RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED'

export type PurchaseOrder = {
  id: string
  orderNo: string
  approvalId: string
  rfqId: string
  purchaseRequestId: string
  supplierId: string
  orderDate: string
  expectedDeliveryDate: string
  status: PurchaseOrderStatus
  paymentTerm: string
  currency: string
  subtotal: number
  taxTotal: number
  grandTotal: number
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
}
