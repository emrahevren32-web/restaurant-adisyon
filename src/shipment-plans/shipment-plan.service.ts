import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import type {
  ShipmentPlanRecord,
  ShipmentPlanStatus
} from './shipment-plan.types'

export const SHIPMENT_PLAN_ACTIVE_STATUSES: ShipmentPlanStatus[] = [
  'PLANNED',
  'READY',
  'DEPARTED',
  'IN_PROGRESS'
]

export const isShipmentPlanActive = (
  status: ShipmentPlanStatus
) => SHIPMENT_PLAN_ACTIVE_STATUSES.includes(status)

export const getShipmentPlanActiveVehicleIds = (
  plans: ShipmentPlanRecord[],
  ignoredPlanId = ''
) => new Set(plans
  .filter(plan => plan.id !== ignoredPlanId && isShipmentPlanActive(plan.status))
  .map(plan => plan.vehicleId)
  .filter(Boolean))

export const getShipmentPlanVehicleConflict = (
  record: ShipmentPlanRecord,
  plans: ShipmentPlanRecord[]
) => plans.find(plan => (
  plan.id !== record.id
  && plan.vehicleId === record.vehicleId
  && isShipmentPlanActive(plan.status)
))

const getVehicleLoadIds = (
  vehicle: ShipmentVehicleRecord | null
) => new Set((vehicle?.loads || []).map(load => load.id).filter(Boolean))

export const validateShipmentPlan = (
  record: ShipmentPlanRecord,
  vehicles: ShipmentVehicleRecord[] = [],
  plans: ShipmentPlanRecord[] = []
) => {
  if(!record.vehicleId.trim()) return 'Vehicle zorunludur.'
  if(!record.planDate.trim()) return 'Plan Date zorunludur.'
  if(record.stops.length === 0) return 'En az bir Stop bulunmalıdır.'

  const vehicle = vehicles.find(item => item.id === record.vehicleId) || null
  if(vehicles.length > 0 && !vehicle) return 'Vehicle kaydı bulunamadı.'
  if(vehicle && vehicle.status !== 'READY') return 'READY olmayan Vehicle Shipment Plan içine alınamaz.'

  const orderValues = record.stops.map(stop => stop.stopOrder)
  const uniqueOrderValues = new Set(orderValues)
  if(uniqueOrderValues.size !== orderValues.length) return 'Stop Order tekrar edemez.'

  if(isShipmentPlanActive(record.status) && getShipmentPlanVehicleConflict(record, plans)){
    return 'Bir Vehicle aynı anda yalnızca bir aktif Shipment Plan içinde bulunabilir.'
  }

  const vehicleLoadIds = getVehicleLoadIds(vehicle)

  for(const [index, stop] of record.stops.entries()){
    const rowLabel = `${index + 1}. stop`

    if(!stop.branchId.trim()) return `${rowLabel} için Branch zorunludur.`
    if(!stop.vehicleLoadId.trim()) return `${rowLabel} için Vehicle Load zorunludur.`
    if(!Number.isFinite(stop.stopOrder) || stop.stopOrder <= 0){
      return `${rowLabel} Stop Order geçerli olmalıdır.`
    }
    if(vehicle && !vehicleLoadIds.has(stop.vehicleLoadId)){
      return `${rowLabel} Vehicle Load seçilen araca ait olmalıdır.`
    }
  }

  return ''
}
