import type {
  GoodsReceiptHistory,
  GoodsReceiptHistoryAction,
  GoodsReceiptRecord
} from './goods-receipt.types'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createGoodsReceiptHistory = (
  receiptId: string,
  action: GoodsReceiptHistoryAction,
  actorName: string,
  description: string,
  createdAt = new Date().toISOString()
): GoodsReceiptHistory => ({
  id: createId('goods_receipt_history'),
  receiptId,
  action,
  actorName: actorName.trim() || 'System',
  description: description.trim(),
  createdAt
})

export const appendGoodsReceiptHistory = (
  record: GoodsReceiptRecord,
  action: GoodsReceiptHistoryAction,
  actorName: string,
  description: string
): GoodsReceiptRecord => ({
  ...record,
  history: [
    ...(record.history || []),
    createGoodsReceiptHistory(record.id, action, actorName, description)
  ],
  updatedAt: new Date().toISOString()
})

export const GoodsReceiptHistoryService = {
  create: createGoodsReceiptHistory,
  append: appendGoodsReceiptHistory
}
