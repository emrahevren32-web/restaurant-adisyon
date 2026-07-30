import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type AIAnalysisTitle =
  | 'PRODUCTION'
  | 'STOCK'
  | 'QUALITY'
  | 'MACHINE'
  | 'PERSONNEL'
  | 'MAINTENANCE'
  | 'SHIPMENT'
  | 'ENERGY'
  | 'CAPACITY'
  | 'WASTE'

export type AIInsightType =
  | 'RISK'
  | 'OPPORTUNITY'
  | 'ANOMALY'
  | 'REPEATING_PROBLEM'
  | 'EXPECTED_IMPACT'

export type AISeverity =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type AIAnalysisStatus =
  | 'GENERATED'
  | 'REVIEWED'
  | 'ARCHIVED'

export type AISourceModule =
  | 'DecisionSupport'
  | 'CriticalAlerts'
  | 'Forecasting'
  | 'RecommendationEngine'
  | 'ProductionPlanning'
  | 'CapacityPlanning'
  | 'MachineScheduling'
  | 'WorkforcePlanning'
  | 'BottleneckAnalysis'
  | 'ContinuousImprovement'
  | 'QualityForms'
  | 'ShipmentForms'
  | 'OperationsChecklists'
  | 'Warehouse'
  | 'Stock'
  | 'Inventory'
  | 'Purchase'
  | 'PurchaseOrders'
  | 'GoodsReceipt'
  | 'FireManagement'
  | 'HACCP'
  | 'LotManagement'
  | 'Shipment'
  | 'Quality'
  | 'Maintenance'
  | 'KPIDashboard'
  | 'ReadModel'

export type AIHistoryAction =
  | 'CREATED'
  | 'ANALYZED'
  | 'REVIEWED'
  | 'ARCHIVED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'

export type AIScore = {
  id: string
  reportId: string
  analysisTitle: AIAnalysisTitle
  confidenceScore: number
  riskScore: number
  impactScore: number
  priorityScore: number
  trendScore: number
  sampleSize: number
  sourceCount: number
  summary: string
}

export type AIFinding = {
  id: string
  reportId: string
  reportNo: string
  insightId: string
  analysisTitle: AIAnalysisTitle
  findingType: AIInsightType
  severity: AISeverity
  title: string
  description: string
  metricName: string
  metricValue: number
  benchmarkValue: number
  deltaPercent: number
  sourceModule: AISourceModule
  sourceId: string
  sourceNo: string
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityName: string
  createdAt: string
}

export type AIInsight = {
  id: string
  reportId: string
  reportNo: string
  analysisTitle: AIAnalysisTitle
  insightType: AIInsightType
  severity: AISeverity
  title: string
  summary: string
  evidence: string
  expectedImpact: string
  suggestedPromptContext: string
  recommendedAction: string
  sourceModule: AISourceModule
  sourceId: string
  sourceNo: string
  relatedModules: AISourceModule[]
  relatedEntityType: string
  relatedEntityId: string
  relatedEntityName: string
  branchId: string
  branchName: string
  productionLineId: string
  productionLineName: string
  machineId: string
  machineCode: string
  machineName: string
  employeeId: string
  employeeName: string
  categoryId: string
  categoryName: string
  confidenceScore: number
  riskScore: number
  impactScore: number
  priorityScore: number
  trendScore: number
  expectedGainScore: number
  createdAt: string
}

export type AIHistory = {
  id: string
  reportId: string
  action: AIHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type AIAnalysisReport = {
  id: string
  reportNo: string
  status: AIAnalysisStatus
  reportDate: string
  scope: AIAnalysisTitle | 'all'
  responsiblePerson: string
  description: string
  insights: AIInsight[]
  findings: AIFinding[]
  scores: AIScore[]
  history: AIHistory[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type AIStatistics = {
  totalInsights: number
  criticalFindings: number
  topRiskCount: number
  expectedGainScore: number
  averageConfidence: number
  averageRiskScore: number
  titleRows: BarChartRow[]
  insightTypeRows: BarChartRow[]
  severityRows: BarChartRow[]
  branchRows: BarChartRow[]
  lineRows: BarChartRow[]
  machineRows: BarChartRow[]
  personnelRows: BarChartRow[]
  categoryRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type AIAnalysisFilters = {
  analysisTitle: AIAnalysisTitle | 'all'
  insightType: AIInsightType | 'all'
  severity: AISeverity | 'all'
  branchId: string
  productionLineId: string
  machineId: string
  employeeId: string
  date: string
  search: string
}

export type AIAnalysisReportCreateInput = {
  reportDate: string
  scope: AIAnalysisTitle | 'all'
  responsiblePerson: string
  description: string
}

export type AIPrintMode = 'A4' | 'PDF'
