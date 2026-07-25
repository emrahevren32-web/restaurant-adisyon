import type { StockUnit } from '../types'

export type ProductRecallReason =
  | 'MICROBIOLOGICAL'
  | 'CHEMICAL'
  | 'PHYSICAL'
  | 'ALLERGEN'
  | 'PACKAGING_DEFECT'
  | 'LABEL_ERROR'
  | 'FOREIGN_OBJECT'
  | 'OTHER'

export type ProductRecallRiskLevel =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type ProductRecallStatus =
  | 'OPEN'
  | 'UNDER_INVESTIGATION'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type ProductRecall = {
  id: string
  recallNo: string
  inventoryLotId: string
  reason: ProductRecallReason
  riskLevel: ProductRecallRiskLevel
  status: ProductRecallStatus
  affectedQuantity: number
  unit: StockUnit
  reportedDate: string
  resolvedDate: string
  description: string
  createdBy: string
  createdAt: string
  updatedAt: string
}
