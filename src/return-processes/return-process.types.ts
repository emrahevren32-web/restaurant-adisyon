export type ReturnReason =
  | 'QUALITY_FAILURE'
  | 'EXPIRED'
  | 'DAMAGED'
  | 'WRONG_PRODUCT'
  | 'WRONG_QUANTITY'
  | 'PACKAGING_DAMAGE'
  | 'OTHER'

export type ReturnProcessStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'CANCELLED'

export type ReturnProcess = {
  id: string
  returnNo: string
  qualityControlId: string
  inventoryLotId: string
  goodsReceiptId: string
  purchaseOrderId: string
  supplierId: string
  warehouseId: string
  returnReason: ReturnReason
  returnQuantity: number
  status: ReturnProcessStatus
  notes: string
  createdBy: string
  createdAt: string
  updatedAt: string
}
