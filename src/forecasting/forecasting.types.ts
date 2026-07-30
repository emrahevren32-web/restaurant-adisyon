import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type ForecastType =
  | 'PRODUCTION'
  | 'STOCK'
  | 'DEMAND'
  | 'WASTE'
  | 'QUALITY'
  | 'SHIPMENT'
  | 'PURCHASING'
  | 'PERSONNEL'

export type ForecastStatus =
  | 'GENERATED'
  | 'REVIEWED'
  | 'ARCHIVED'

export type ForecastRiskLevel =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type ForecastTrendDirection =
  | 'UP'
  | 'DOWN'
  | 'STABLE'
  | 'SEASONAL'

export type ForecastSourceModule =
  | 'ProductionPlanning'
  | 'CapacityPlanning'
  | 'MachineScheduling'
  | 'WorkforcePlanning'
  | 'BottleneckAnalysis'
  | 'ContinuousImprovement'
  | 'CriticalAlerts'
  | 'Warehouse'
  | 'Stock'
  | 'GoodsReceipt'
  | 'ShipmentForms'
  | 'QualityForms'
  | 'FireManagement'
  | 'PurchaseOrders'
  | 'KPIDashboard'
  | 'ReadModel'

export type ForecastHistoryAction =
  | 'CREATED'
  | 'CALCULATED'
  | 'REVIEWED'
  | 'ARCHIVED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'

export type ForecastScenario = {
  id: string
  reportId: string
  name: string
  description: string
  demandMultiplier: number
  wasteMultiplier: number
  qualityRiskMultiplier: number
  capacityMultiplier: number
  expectedImpact: string
  riskLevel: ForecastRiskLevel
}

export type ForecastPrediction = {
  id: string
  reportId: string
  reportNo: string
  forecastType: ForecastType
  entityType: string
  entityId: string
  entityName: string
  productId: string
  productName: string
  stockItemId: string
  stockItemName: string
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
  supplierId: string
  supplierName: string
  sourceModule: ForecastSourceModule
  sourceId: string
  sourceNo: string
  unit: string
  periodLabel: string
  baseline7: number
  baseline30: number
  baseline90: number
  baseline365: number
  baselineValue: number
  expectedValue: number
  minimumValue: number
  maximumValue: number
  growthPercent: number
  seasonalityScore: number
  confidenceScore: number
  riskScore: number
  riskLevel: ForecastRiskLevel
  trendDirection: ForecastTrendDirection
  expectedDemand: number
  expectedProduction: number
  expectedStock: number
  expectedWaste: number
  expectedShipment: number
  expectedCapacityPercent: number
  expectedPersonnelNeed: number
  daysToCritical: number
  recommendation: string
  evidence: string
  createdAt: string
}

export type ForecastHistory = {
  id: string
  reportId: string
  action: ForecastHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type ForecastReport = {
  id: string
  reportNo: string
  status: ForecastStatus
  reportDate: string
  startDate: string
  endDate: string
  horizonDays: number
  analysisWindowDays: number
  scenarioName: string
  responsiblePerson: string
  description: string
  predictions: ForecastPrediction[]
  scenarios: ForecastScenario[]
  history: ForecastHistory[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ForecastStatistics = {
  totalForecasts: number
  riskyForecasts: number
  biggestIncreaseLabel: string
  biggestDecreaseLabel: string
  averageConfidence: number
  expectedDemand: number
  expectedProduction: number
  expectedStock: number
  expectedWaste: number
  expectedShipment: number
  expectedCapacity: number
  expectedPersonnelNeed: number
  typeRows: BarChartRow[]
  productRows: BarChartRow[]
  branchRows: BarChartRow[]
  lineRows: BarChartRow[]
  machineRows: BarChartRow[]
  personnelRows: BarChartRow[]
  categoryRows: BarChartRow[]
  riskRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type ForecastFilters = {
  forecastType: ForecastType | 'all'
  riskLevel: ForecastRiskLevel | 'all'
  branchId: string
  productId: string
  productionLineId: string
  machineId: string
  employeeId: string
  date: string
  search: string
}

export type ForecastReportCreateInput = {
  reportDate: string
  horizonDays: number
  analysisWindowDays: number
  scenarioName: string
  responsiblePerson: string
  description: string
}

export type ForecastPrintMode = 'A4' | 'PDF'
