export type ShipmentPlanStatus =
  | 'PLANNED'
  | 'READY'
  | 'DEPARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'

export type ShipmentPlanStopStatus =
  | 'WAITING'
  | 'ON_ROUTE'
  | 'ARRIVED'
  | 'DELIVERED'
  | 'SKIPPED'

export type ShipmentPlan = {
  id: string
  shipmentPlanNo: string
  vehicleId: string
  planDate: string
  plannedDepartureTime: string
  plannedArrivalTime: string
  plannedReturnTime: string
  status: ShipmentPlanStatus
  driverName: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type ShipmentPlanStop = {
  id: string
  shipmentPlanId: string
  branchId: string
  vehicleLoadId: string
  stopOrder: number
  estimatedArrival: string
  estimatedDeparture: string
  status: ShipmentPlanStopStatus
  notes: string
}

export type ShipmentPlanRecord = ShipmentPlan & {
  stops: ShipmentPlanStop[]
}
