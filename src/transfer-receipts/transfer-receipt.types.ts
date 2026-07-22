export type TransferReceiptStatus =
  | 'PENDING'
  | 'INSPECTING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'

export type TransferReceiptResult =
  | 'SUCCESS'
  | 'PARTIAL'
  | 'REJECTED'

export type TransferReceiptItemStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'PARTIAL'
  | 'MISSING'
  | 'DAMAGED'
  | 'REJECTED'

export type TransferReceipt = {
  id: string
  receiptNo: string
  shipmentExecutionId: string
  warehouseId: string
  branchId: string
  receiptDate: string
  receivedBy: string
  status: TransferReceiptStatus
  result: TransferReceiptResult | ''
  notes: string
  createdAt: string
  updatedAt: string
}

export type TransferReceiptItem = {
  id: string
  receiptId: string
  executionItemId: string
  expectedQuantity: number
  receivedQuantity: number
  missingQuantity: number
  extraQuantity: number
  damagedQuantity: number
  acceptedQuantity: number
  status: TransferReceiptItemStatus
  notes: string
}

export type TransferReceiptRecord = TransferReceipt & {
  items: TransferReceiptItem[]
}
