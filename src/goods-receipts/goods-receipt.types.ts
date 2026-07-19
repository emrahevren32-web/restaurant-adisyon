import type { StockUnit } from '../types'

export type GoodsReceiptStatus =
  | 'DRAFT'
  | 'RECEIVED'
  | 'PARTIALLY_RECEIVED'
  | 'COMPLETED'
  | 'CANCELLED'

export type GoodsReceipt = {
  id: string
  receiptNo: string
  purchaseOrderId: string
  supplierId: string
  warehouseId: string
  receiptDate: string
  receivedBy: string
  status: GoodsReceiptStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export type GoodsReceiptItem = {
  id: string
  receiptId: string
  purchaseOrderItemId: string
  stockItemId: string
  orderedQuantity: number
  receivedQuantity: number
  acceptedQuantity: number
  rejectedQuantity: number
  unit: StockUnit
  notes: string
}

export type GoodsReceiptRecord = GoodsReceipt & {
  items: GoodsReceiptItem[]
}
