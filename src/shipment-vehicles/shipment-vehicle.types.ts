export type ShipmentVehicleStatus =
  | 'AVAILABLE'
  | 'LOADING'
  | 'READY'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'MAINTENANCE'

export type ShipmentVehicleType =
  | 'VAN'
  | 'TRUCK'
  | 'REFRIGERATED'
  | 'SEMI_TRAILER'
  | 'OTHER'

export type ShipmentVehicle = {
  id: string
  vehicleNo: string
  plateNumber: string
  vehicleName: string
  vehicleType: ShipmentVehicleType
  maxWeight: number
  currentWeight: number
  status: ShipmentVehicleStatus
  driverName: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type ShipmentVehicleLoad = {
  id: string
  vehicleId: string
  palletId: string
  loadedWeight: number
  loadedAt: string
  notes: string
}

export type ShipmentVehicleRecord = ShipmentVehicle & {
  loads: ShipmentVehicleLoad[]
}
