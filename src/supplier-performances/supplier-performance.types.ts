export type SupplierPerformanceLevel =
  | 'EXCELLENT'
  | 'GOOD'
  | 'AVERAGE'
  | 'POOR'
  | 'CRITICAL'

export type SupplierPerformancePeriod =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'YEARLY'

export type SupplierPerformance = {
  id: string
  supplierId: string
  period: SupplierPerformancePeriod
  purchaseOrderCount: number
  goodsReceiptCount: number
  qualityControlCount: number
  approvedQualityCount: number
  rejectedQualityCount: number
  returnProcessCount: number
  supplierReturnCount: number
  onTimeDeliveryCount: number
  lateDeliveryCount: number
  averageQualityScore: number
  deliveryScore: number
  qualityScore: number
  returnScore: number
  overallScore: number
  performanceLevel: SupplierPerformanceLevel
  notes: string
  calculatedAt: string
}
