import type { StockUnit } from '../types'

export type ProductRecallType =
  | 'PRODUCT'
  | 'LOT'
  | 'RAW_MATERIAL'
  | 'SUPPLIER'
  | 'QUALITY'
  | 'HACCP'
  | 'EXPIRY'
  | 'LABEL'
  | 'ALLERGEN'

export type ProductRecallReason =
  | 'MICROBIOLOGICAL'
  | 'CHEMICAL'
  | 'PHYSICAL'
  | 'ALLERGEN'
  | 'PACKAGING_DEFECT'
  | 'LABEL_ERROR'
  | 'FOREIGN_OBJECT'
  | 'EXPIRY_RISK'
  | 'HACCP_DEVIATION'
  | 'SUPPLIER_NONCONFORMITY'
  | 'OTHER'

export type ProductRecallRiskLevel =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type ProductRecallPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type ProductRecallStatus =
  | 'DRAFT'
  | 'REVIEWING'
  | 'APPROVED'
  | 'IN_OPERATION'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'OPEN'
  | 'UNDER_INVESTIGATION'
  | 'IN_PROGRESS'

export type ProductRecallActionType =
  | 'QUARANTINED'
  | 'SHIPMENT_STOPPED'
  | 'CUSTOMER_NOTIFIED'
  | 'SUPPLIER_NOTIFIED'
  | 'QUALITY_REVIEW_STARTED'
  | 'SAMPLE_TAKEN'
  | 'WITNESS_SAMPLE_REVIEWED'
  | 'DISPOSED'
  | 'REPRODUCTION_REQUIRED'

export type ProductRecallTimelineStage =
  | 'CREATED'
  | 'SENT_FOR_APPROVAL'
  | 'APPROVED'
  | 'OPERATION_STARTED'
  | 'NOTIFICATION_SENT'
  | 'CLOSED'

export type ProductRecallRelationType =
  | 'PRODUCT'
  | 'LOT'
  | 'SUB_LOT'
  | 'RAW_MATERIAL'
  | 'RECIPE'
  | 'PRODUCTION_ORDER'
  | 'PRODUCTION_CENTER'
  | 'BRANCH'
  | 'WAREHOUSE'
  | 'SHIPMENT'
  | 'DELIVERY'
  | 'CUSTOMER'
  | 'SAMPLE'
  | 'WITNESS_SAMPLE'
  | 'QUALITY_FORM'
  | 'HACCP_RECORD'

export type ProductRecallRelatedRecord = {
  id: string
  type: ProductRecallRelationType
  no: string
  name: string
  detail: string
  status: string
}

export type ProductRecallTraceability = {
  products: ProductRecallRelatedRecord[]
  lots: ProductRecallRelatedRecord[]
  subLots: ProductRecallRelatedRecord[]
  rawMaterials: ProductRecallRelatedRecord[]
  recipes: ProductRecallRelatedRecord[]
  productionOrders: ProductRecallRelatedRecord[]
  productionCenters: ProductRecallRelatedRecord[]
  branches: ProductRecallRelatedRecord[]
  warehouses: ProductRecallRelatedRecord[]
  shipments: ProductRecallRelatedRecord[]
  deliveries: ProductRecallRelatedRecord[]
  customers: ProductRecallRelatedRecord[]
  samples: ProductRecallRelatedRecord[]
  witnessSamples: ProductRecallRelatedRecord[]
  qualityForms: ProductRecallRelatedRecord[]
  haccpRecords: ProductRecallRelatedRecord[]
}

export type ProductRecallImpactAnalysis = {
  affectedProductCount: number
  affectedLotCount: number
  affectedCustomerCount: number
  affectedShipmentCount: number
  affectedWarehouseCount: number
  affectedProductionOrderCount: number
  affectedRecipeCount: number
  averageCompletionDays: number
  successRate: number
}

export type ProductRecallActionLog = {
  id: string
  recallId: string
  actionType: ProductRecallActionType
  actorName: string
  actionDate: string
  actionTime: string
  description: string
  isOpen: boolean
  createdAt: string
}

export type ProductRecallTimelineEvent = {
  id: string
  recallId: string
  stage: ProductRecallTimelineStage
  title: string
  description: string
  actorName: string
  occurredAt: string
}

export type ProductRecallDocument = {
  id: string
  documentNo: string
  title: string
  documentType: string
  owner: string
  createdAt: string
}

export type ProductRecall = {
  id: string
  recallNo: string
  recallType: ProductRecallType
  inventoryLotId: string
  reason: ProductRecallReason
  riskLevel: ProductRecallRiskLevel
  priority: ProductRecallPriority
  status: ProductRecallStatus
  affectedQuantity: number
  unit: StockUnit
  reportedDate: string
  startedAt: string
  targetCompletionDate: string
  resolvedDate: string
  description: string
  riskAnalysis: string
  initiatedBy: string
  responsiblePerson: string
  branchId: string
  warehouseId: string
  supplierId: string
  affectedCustomerCount: number
  affectedShipmentCount: number
  traceability: ProductRecallTraceability
  impactAnalysis: ProductRecallImpactAnalysis
  actionLogs: ProductRecallActionLog[]
  timeline: ProductRecallTimelineEvent[]
  documents: ProductRecallDocument[]
  lastActionSummary: string
  createdBy: string
  createdAt: string
  updatedAt: string
}
