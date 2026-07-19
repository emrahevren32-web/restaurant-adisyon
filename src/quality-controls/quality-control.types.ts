export type QualityControlDecision =
  | 'APPROVED'
  | 'REJECTED'
  | 'QUARANTINE'

export type QualityControlStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'

export type QualityControl = {
  id: string
  qcNo: string
  inventoryLotId: string
  goodsReceiptId: string
  stockItemId: string
  supplierId: string
  warehouseId: string
  inspectionDate: string
  inspector: string
  sampleQuantity: number
  decision: QualityControlDecision | ''
  status: QualityControlStatus
  notes: string
  createdAt: string
  updatedAt: string
}
