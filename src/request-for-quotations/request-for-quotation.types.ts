export type RequestForQuotationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'PARTIALLY_RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED'

export type RequestForQuotationSupplierStatus =
  | 'WAITING'
  | 'RESPONDED'
  | 'DECLINED'

export type RequestForQuotation = {
  id: string
  rfqNo: string
  purchaseRequestId: string
  title: string
  description: string
  issueDate: string
  dueDate: string
  status: RequestForQuotationStatus
  branchId: string
  createdBy: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type RequestForQuotationSupplier = {
  id: string
  rfqId: string
  supplierId: string
  status: RequestForQuotationSupplierStatus
  responseDate: string
  notes: string
}

export type SupplierQuotation = {
  id: string
  rfqId: string
  supplierId: string
  purchaseRequestItemId: string
  supplierProductId: string
  unitPrice: number
  quantity: number
  discount: number
  taxRate: number
  totalPrice: number
  currency: string
  deliveryDays: number
  isWinner: boolean
  notes: string
}

export type RequestForQuotationRecord = RequestForQuotation & {
  suppliers: RequestForQuotationSupplier[]
  quotations: SupplierQuotation[]
}
