export type HACCPPlanStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'UNDER_REVIEW'
  | 'ARCHIVED'

export type CriticalControlPointStatus =
  | 'ACTIVE'
  | 'PASSIVE'
  | 'SUSPENDED'

export type HACCPProductionStage =
  | 'RECEIVING'
  | 'STORAGE'
  | 'PREPARATION'
  | 'COOKING'
  | 'BLAST_CHILLING'
  | 'PACKAGING'
  | 'LABELING'
  | 'DISPATCH'

export type HazardType =
  | 'BIOLOGICAL'
  | 'CHEMICAL'
  | 'PHYSICAL'
  | 'ALLERGEN'

export type HACCPRiskLevel =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type HACCPMonitoringResult =
  | 'PASS'
  | 'FAIL'

export type HACCPActionStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type HACCPVerificationResult =
  | 'PASS'
  | 'FAIL'

export type HACCPPlan = {
  id: string
  code: string
  name: string
  description: string
  status: HACCPPlanStatus
  createdAt: string
  updatedAt: string
}

export type CriticalControlPoint = {
  id: string
  planId: string
  name: string
  description: string
  productionStage: HACCPProductionStage
  criticalLimit: string
  monitoringMethod: string
  monitoringFrequency: string
  responsibleRole: string
  status: CriticalControlPointStatus
}

export type Hazard = {
  id: string
  ccpId: string
  type: HazardType
  description: string
  riskLevel: HACCPRiskLevel
  preventiveMeasure: string
}

export type MonitoringRecord = {
  id: string
  ccpId: string
  productionOrderId: string
  inventoryLotId: string
  qualitySampleId: string
  measuredValue: number
  criticalLimit: string
  result: HACCPMonitoringResult
  checkedBy: string
  checkedAt: string
  notes: string
}

export type CorrectiveAction = {
  id: string
  monitoringRecordId: string
  description: string
  assignedTo: string
  status: HACCPActionStatus
  completedAt: string
}

export type VerificationRecord = {
  id: string
  planId: string
  monitoringRecordId: string
  verifiedBy: string
  verifiedAt: string
  result: HACCPVerificationResult
  notes: string
}

export type HACCPPlanRecord = HACCPPlan & {
  criticalControlPoints: CriticalControlPoint[]
  hazards: Hazard[]
  monitoringRecords: MonitoringRecord[]
  correctiveActions: CorrectiveAction[]
  verificationRecords: VerificationRecord[]
}
