import type { BarChartRow, ChartSeries } from '../kpi-reporting/kpi.types'

export type ShipmentOptimizationType =
  | 'ADVANCE_SHIPMENT'
  | 'POSTPONE_SHIPMENT'
  | 'CHANGE_VEHICLE'
  | 'COMBINE_VEHICLES'
  | 'OPTIMIZE_ROUTE'
  | 'CHANGE_DELIVERY_SEQUENCE'
  | 'INCREASE_VEHICLE_OCCUPANCY'
  | 'PRIORITIZE_COLD_CHAIN'
  | 'GROUP_SAME_REGION'
  | 'SUGGEST_EXTRA_VEHICLE'
  | 'REDUCE_FUEL_COST'
  | 'NO_SHIPMENT_RISK'

export type ShipmentOptimizationRisk =
  | 'LOW'
  | 'MEDIUM'
  | 'HIGH'
  | 'CRITICAL'

export type ShipmentOptimizationPriority =
  | 'LOW'
  | 'NORMAL'
  | 'HIGH'
  | 'URGENT'

export type ShipmentOptimizationStatus =
  | 'GENERATED'
  | 'REVIEWED'
  | 'ARCHIVED'

export type ShipmentOptimizationHistoryAction =
  | 'CREATED'
  | 'CALCULATED'
  | 'REVIEWED'
  | 'ARCHIVED'
  | 'PRINTED'
  | 'PDF'
  | 'EXCEL'

export type ShipmentOptimizationLinkedEntity = {
  id: string
  no: string
  name: string
  detail: string
}

export type ShipmentOptimizationAlternative = {
  id: string
  no: string
  name: string
  detail: string
  expectedUtilizationPercent: number
  expectedTimeGainMinutes: number
  expectedFuelSavingLiters: number
}

export type ShipmentOptimizationItem = {
  id: string
  reportId: string
  reportNo: string
  recommendationNo: string
  recommendationType: ShipmentOptimizationType
  shipmentPlanId: string
  shipmentPlanNo: string
  shipmentId: string
  shipmentNo: string
  vehicleId: string
  vehicleNo: string
  vehiclePlate: string
  vehicleName: string
  vehicleType: string
  driverName: string
  branchId: string
  branchName: string
  deliveryRegion: string
  plannedDepartureAt: string
  plannedArrivalAt: string
  stopCount: number
  currentVehicleUtilizationPercent: number
  targetVehicleUtilizationPercent: number
  trafficDurationMinutes: number
  coldChainRequired: boolean
  fuelSavingScenario: boolean
  vehicleOccupancyScenario: boolean
  coldChainScenario: boolean
  risk: ShipmentOptimizationRisk
  priority: ShipmentOptimizationPriority
  riskScore: number
  confidenceScore: number
  expectedTimeGainMinutes: number
  expectedFuelSavingLiters: number
  expectedCostSaving: number
  expectedSavingSummary: string
  reason: string
  analysisResult: string
  riskExplanation: string
  recommendedAction: string
  affectedShipments: ShipmentOptimizationLinkedEntity[]
  alternativeVehicles: ShipmentOptimizationAlternative[]
  alternativeDeliveryPlan: ShipmentOptimizationAlternative[]
  sourceModules: string[]
  createdAt: string
}

export type ShipmentOptimizationHistory = {
  id: string
  reportId: string
  action: ShipmentOptimizationHistoryAction
  actorName: string
  description: string
  revisionNo: number
  createdAt: string
}

export type ShipmentOptimizationReport = {
  id: string
  reportNo: string
  status: ShipmentOptimizationStatus
  reportDate: string
  scope: ShipmentOptimizationType | 'all'
  responsiblePerson: string
  description: string
  items: ShipmentOptimizationItem[]
  history: ShipmentOptimizationHistory[]
  sourceType: 'ReadModel' | 'ManualReadModel'
  sourceId: string
  revisionNo: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type ShipmentOptimizationStatistics = {
  totalRecommendations: number
  criticalShipmentRisks: number
  expectedFuelSavingLiters: number
  expectedTimeGainMinutes: number
  expectedCostSaving: number
  averageVehicleUtilizationPercent: number
  averageConfidence: number
  regionShipmentRows: BarChartRow[]
  vehicleUtilizationRows: BarChartRow[]
  fuelSavingRows: BarChartRow[]
  deliveryTimeRows: BarChartRow[]
  riskRows: BarChartRow[]
  vehicleTypeRows: BarChartRow[]
  costSavingRows: BarChartRow[]
  dailyTrend: ChartSeries
}

export type ShipmentOptimizationFilters = {
  branchId: string
  vehicleId: string
  driverName: string
  deliveryRegion: string
  risk: ShipmentOptimizationRisk | 'all'
  priority: ShipmentOptimizationPriority | 'all'
  recommendationType: ShipmentOptimizationType | 'all'
  date: string
  search: string
}

export type ShipmentOptimizationReportCreateInput = {
  reportDate: string
  scope: ShipmentOptimizationType | 'all'
  responsiblePerson: string
  description: string
}
