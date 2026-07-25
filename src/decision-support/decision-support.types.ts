import type { KpiFilters, KpiSourceData } from '../kpi-reporting/kpi.types'

export type DecisionCategory =
  | 'Production'
  | 'Inventory'
  | 'Quality'
  | 'Purchasing'
  | 'Shipment'
  | 'Management'

export type DecisionPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type DecisionRisk =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type DecisionStatus =
  | 'OPEN'
  | 'REVIEW'
  | 'ACKNOWLEDGED'

export type DecisionRule = {
  id: string
  category: DecisionCategory
  title: string
  description: string
  baseRisk: DecisionRisk
  priority: DecisionPriority
  thresholdLabel: string
}

export type RiskItem = {
  risk: DecisionRisk
  score: number
  evidence: string
}

export type Recommendation = {
  id: string
  action: string
  expectedImpact: string
  ownerRole: string
}

export type DecisionSuggestion = {
  id: string
  category: DecisionCategory
  title: string
  description: string
  reason: string
  risk: DecisionRisk
  riskScore: number
  priority: DecisionPriority
  relatedEntityType: string
  relatedEntityId: string
  relatedLotId: string
  relatedProductId: string
  relatedSupplierId: string
  relatedWorkOrderId: string
  branchId: string
  warehouseId: string
  status: DecisionStatus
  createdAt: string
  ruleId: string
  recommendation: Recommendation
}

export type DecisionSuggestionInput = {
  category: DecisionCategory
  title: string
  description: string
  reason: string
  ruleId: string
  relatedEntityType: string
  relatedEntityId: string
  relatedLotId?: string
  relatedProductId?: string
  relatedSupplierId?: string
  relatedWorkOrderId?: string
  branchId?: string
  warehouseId?: string
  evidenceScore: number
  createdAt?: string
  recommendationAction: string
  expectedImpact: string
  ownerRole: string
}

export type DecisionSupportFilters = KpiFilters & {
  category: DecisionCategory | 'all'
  risk: DecisionRisk | 'all'
  priority: DecisionPriority | 'all'
  date: string
  workOrderId: string
}

export type DecisionDashboardSummary = {
  todaySuggestions: number
  criticalRisks: number
  pendingCorrectiveActions: number
  criticalStocks: number
  highFire: number
  riskySuppliers: number
  riskyCcps: number
  delayedProduction: number
  delayedShipments: number
}

export type DecisionSupportView = {
  generatedAt: string
  filters: DecisionSupportFilters
  rules: DecisionRule[]
  suggestions: DecisionSuggestion[]
  filteredSuggestions: DecisionSuggestion[]
  risks: RiskItem[]
  dashboard: DecisionDashboardSummary
  sourceData: KpiSourceData
}
