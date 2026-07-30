import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type AlertLevel =
  | 'INFO'
  | 'WARNING'
  | 'HIGH'
  | 'CRITICAL'

export type AlertCategory =
  | 'PRODUCTION'
  | 'STOCK'
  | 'QUALITY'
  | 'SHIPMENT'
  | 'MACHINE'
  | 'MAINTENANCE'
  | 'PERSONNEL'
  | 'CAPACITY'
  | 'HACCP'
  | 'LOT'
  | 'GOODS_RECEIPT'

export type AlertStatus =
  | 'ACTIVE'
  | 'ACKNOWLEDGED'
  | 'RESOLVED'
  | 'DISMISSED'

export type AlertPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type AlertSourceModule =
  | 'DecisionSupport'
  | 'ProductionPlanning'
  | 'CapacityPlanning'
  | 'MachineScheduling'
  | 'WorkforcePlanning'
  | 'BottleneckAnalysis'
  | 'ContinuousImprovement'
  | 'Warehouse'
  | 'Stock'
  | 'LotManagement'
  | 'GoodsReceipt'
  | 'QualityForms'
  | 'ShipmentForms'
  | 'OperationsChecklists'
  | 'HACCP'
  | 'Maintenance'
  | 'ReadModel'

export type AlertHistoryAction =
  | 'CREATED'
  | 'EVALUATED'
  | 'ACKNOWLEDGED'
  | 'RESOLVED'
  | 'DISMISSED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'

export type AlertRule = {
  id: string
  code: string
  category: AlertCategory
  level: AlertLevel
  title: string
  description: string
  thresholdLabel: string
  sourceModule: AlertSourceModule
  enabled: boolean
}

export type AlertHistory = {
  id: string
  alertId: string
  action: AlertHistoryAction
  actorName: string
  description: string
  createdAt: string
}

export type CriticalAlert = {
  id: string
  alertNo: string
  ruleId: string
  status: AlertStatus
  level: AlertLevel
  category: AlertCategory
  priority: AlertPriority
  title: string
  description: string
  reason: string
  recommendedAction: string
  expectedImpact: string
  riskScore: number
  impactScore: number
  durationMinutes: number
  repeatCount: number
  sourceModule: AlertSourceModule
  sourceId: string
  sourceNo: string
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
  lotId: string
  lotNo: string
  createdAt: string
  updatedAt: string
  firstDetectedAt: string
  lastDetectedAt: string
  history: AlertHistory[]
}

export type AlertStatistics = {
  totalAlerts: number
  activeAlerts: number
  criticalAlerts: number
  todayAlerts: number
  averageRiskScore: number
  categoryRows: BarChartRow[]
  branchRows: BarChartRow[]
  lineRows: BarChartRow[]
  machineRows: BarChartRow[]
  personnelRows: BarChartRow[]
  levelRows: BarChartRow[]
  monthlyTrend: ChartSeries
}

export type CriticalAlertFilters = {
  category: AlertCategory | 'all'
  level: AlertLevel | 'all'
  status: AlertStatus | 'all'
  branchId: string
  productionLineId: string
  machineId: string
  employeeId: string
  date: string
  search: string
}

export type AlertPrintMode = 'A4' | 'PDF'
