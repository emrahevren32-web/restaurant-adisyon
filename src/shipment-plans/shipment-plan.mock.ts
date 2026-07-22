import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import type { ShipmentVehicleLoad, ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import type { ShipmentWorkOrderRecord } from '../shipment-work-orders/shipment-work-order.types'
import { isShipmentPlanActive } from './shipment-plan.service'
import type {
  ShipmentPlanRecord,
  ShipmentPlanStatus,
  ShipmentPlanStop,
  ShipmentPlanStopStatus
} from './shipment-plan.types'

export const SHIPMENT_PLAN_STORAGE_KEY = 'ra_shipment_plans'

export const SHIPMENT_PLAN_STATUSES: ShipmentPlanStatus[] = [
  'PLANNED',
  'READY',
  'DEPARTED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED'
]

export const SHIPMENT_PLAN_STATUS_LABELS: Record<ShipmentPlanStatus, string> = {
  PLANNED: 'Planlandı',
  READY: 'Hazır',
  DEPARTED: 'Çıkış Yaptı',
  IN_PROGRESS: 'Devam Ediyor',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal'
}

export const SHIPMENT_PLAN_STOP_STATUSES: ShipmentPlanStopStatus[] = [
  'WAITING',
  'ON_ROUTE',
  'ARRIVED',
  'DELIVERED',
  'SKIPPED'
]

export const SHIPMENT_PLAN_STOP_STATUS_LABELS: Record<ShipmentPlanStopStatus, string> = {
  WAITING: 'Bekliyor',
  ON_ROUTE: 'Yolda',
  ARRIVED: 'Ulaştı',
  DELIVERED: 'Teslim Edildi',
  SKIPPED: 'Atlandı'
}

type RawShipmentPlanRecord = Partial<Record<keyof ShipmentPlanRecord, unknown>> & Record<string, unknown>
type RawShipmentPlanStopRecord = Partial<Record<keyof ShipmentPlanStop, unknown>> & Record<string, unknown>

const DEFAULT_STATUS: ShipmentPlanStatus = 'PLANNED'
const DEFAULT_STOP_STATUS: ShipmentPlanStopStatus = 'WAITING'
const PLAN_NO_PREFIX = 'SP'
const PLAN_NO_PADDING = 6
const PLAN_SEED_COUNT = 10
const MIN_STOP_COUNT = 2
const MAX_STOP_COUNT = 6

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawShipmentPlanRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isStopRecord = (value: unknown): value is RawShipmentPlanStopRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizePositiveInteger = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback
}

const normalizeStatus = (value: unknown): ShipmentPlanStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_PLAN_STATUSES.includes(normalized as ShipmentPlanStatus)
    ? normalized as ShipmentPlanStatus
    : DEFAULT_STATUS
}

const normalizeStopStatus = (value: unknown): ShipmentPlanStopStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_PLAN_STOP_STATUSES.includes(normalized as ShipmentPlanStopStatus)
    ? normalized as ShipmentPlanStopStatus
    : DEFAULT_STOP_STATUS
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const addHoursToTime = (timeValue: string, hours: number) => {
  const [hourValue, minuteValue] = timeValue.split(':')
  const hour = Number(hourValue)
  const minute = Number(minuteValue)
  if(!Number.isFinite(hour) || !Number.isFinite(minute)) return timeValue
  const nextHour = (hour + hours + 24) % 24
  return `${String(nextHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const getPalletMap = (
  pallets: ShipmentPalletRecord[]
) => new Map(pallets.map(pallet => [pallet.id, pallet]))

const getWorkOrderMap = (
  workOrders: ShipmentWorkOrderRecord[]
) => new Map(workOrders.map(workOrder => [workOrder.id, workOrder]))

const getVehicleLoadBranchId = (
  load: ShipmentVehicleLoad | null,
  palletMap: ReturnType<typeof getPalletMap>,
  workOrderMap: ReturnType<typeof getWorkOrderMap>
) => {
  if(!load) return ''
  const pallet = palletMap.get(load.palletId)
  const workOrder = pallet ? workOrderMap.get(pallet.workOrderId) : null
  return workOrder?.destinationBranchId || ''
}

export const getNextShipmentPlanNo = (
  records: Pick<ShipmentPlanRecord, 'shipmentPlanNo'>[],
  offset = 0
) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.shipmentPlanNo.match(new RegExp(`${PLAN_NO_PREFIX}-(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${PLAN_NO_PREFIX}-${String(maxNo + 1 + offset).padStart(PLAN_NO_PADDING, '0')}`
}

const normalizePlanStop = (
  item: RawShipmentPlanStopRecord,
  planId: string,
  index: number
): ShipmentPlanStop => ({
  id: normalizeText(item.id) || `shipment_plan_stop_${planId}_${index + 1}`,
  shipmentPlanId: normalizeText(item.shipmentPlanId) || planId,
  branchId: normalizeText(item.branchId),
  vehicleLoadId: normalizeText(item.vehicleLoadId),
  stopOrder: normalizePositiveInteger(item.stopOrder, index + 1),
  estimatedArrival: normalizeText(item.estimatedArrival),
  estimatedDeparture: normalizeText(item.estimatedDeparture),
  status: normalizeStopStatus(item.status),
  notes: normalizeText(item.notes)
})

const createFallbackStops = (
  planId: string,
  vehicle: ShipmentVehicleRecord | null,
  palletMap: ReturnType<typeof getPalletMap>,
  workOrderMap: ReturnType<typeof getWorkOrderMap>
) => {
  const loads = vehicle?.loads || []
  if(loads.length === 0) return []

  return Array.from({ length: Math.min(MIN_STOP_COUNT, Math.max(MIN_STOP_COUNT, loads.length)) }, (_, index): ShipmentPlanStop => {
    const load = loads[index % loads.length]
    return {
      id: `shipment_plan_stop_${planId}_${index + 1}`,
      shipmentPlanId: planId,
      branchId: getVehicleLoadBranchId(load, palletMap, workOrderMap),
      vehicleLoadId: load.id,
      stopOrder: index + 1,
      estimatedArrival: addHoursToTime('09:00', index + 1),
      estimatedDeparture: addHoursToTime('09:20', index + 1),
      status: DEFAULT_STOP_STATUS,
      notes: ''
    }
  })
}

const normalizePlan = (
  item: RawShipmentPlanRecord,
  index: number,
  vehicles: ShipmentVehicleRecord[],
  pallets: ShipmentPalletRecord[],
  workOrders: ShipmentWorkOrderRecord[]
): ShipmentPlanRecord => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const id = normalizeText(item.id) || `shipment_plan_${index + 1}`
  const vehicleId = normalizeText(item.vehicleId)
  const vehicle = vehicles.find(record => record.id === vehicleId) || null
  const palletMap = getPalletMap(pallets)
  const workOrderMap = getWorkOrderMap(workOrders)
  const rawStops = Array.isArray(item.stops) ? item.stops.filter(isStopRecord) : []
  const stops = rawStops.length > 0
    ? rawStops.map((record, stopIndex) => normalizePlanStop(record, id, stopIndex))
    : createFallbackStops(id, vehicle, palletMap, workOrderMap)

  return {
    id,
    shipmentPlanNo: normalizeText(item.shipmentPlanNo) || `${PLAN_NO_PREFIX}-${String(index + 1).padStart(PLAN_NO_PADDING, '0')}`,
    vehicleId,
    planDate: normalizeText(item.planDate) || getTodayKey(),
    plannedDepartureTime: normalizeText(item.plannedDepartureTime) || '08:30',
    plannedArrivalTime: normalizeText(item.plannedArrivalTime) || '11:30',
    plannedReturnTime: normalizeText(item.plannedReturnTime) || '15:30',
    status: normalizeStatus(item.status),
    driverName: normalizeText(item.driverName) || vehicle?.driverName || '',
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    stops
  }
}

const getStopStatusForPlan = (
  planStatus: ShipmentPlanStatus,
  stopIndex: number
): ShipmentPlanStopStatus => {
  if(planStatus === 'COMPLETED') return 'DELIVERED'
  if(planStatus === 'CANCELLED') return 'SKIPPED'
  if(planStatus === 'DEPARTED') return stopIndex === 0 ? 'ON_ROUTE' : 'WAITING'
  if(planStatus === 'IN_PROGRESS') return stopIndex === 0 ? 'ARRIVED' : stopIndex === 1 ? 'ON_ROUTE' : 'WAITING'
  return 'WAITING'
}

const createSeedStop = ({
  planId,
  planStatus,
  load,
  stopIndex,
  palletMap,
  workOrderMap
}: {
  planId: string
  planStatus: ShipmentPlanStatus
  load: ShipmentVehicleLoad
  stopIndex: number
  palletMap: ReturnType<typeof getPalletMap>
  workOrderMap: ReturnType<typeof getWorkOrderMap>
}): ShipmentPlanStop => ({
  id: `shipment_plan_stop_${planId}_${stopIndex + 1}`,
  shipmentPlanId: planId,
  branchId: getVehicleLoadBranchId(load, palletMap, workOrderMap),
  vehicleLoadId: load.id,
  stopOrder: stopIndex + 1,
  estimatedArrival: addHoursToTime('09:00', stopIndex + 1),
  estimatedDeparture: addHoursToTime('09:20', stopIndex + 1),
  status: getStopStatusForPlan(planStatus, stopIndex),
  notes: stopIndex % 3 === 0 ? 'Teslim noktası sırası planlandı.' : ''
})

export const createShipmentPlanMockData = (
  vehicles: ShipmentVehicleRecord[],
  pallets: ShipmentPalletRecord[],
  workOrders: ShipmentWorkOrderRecord[]
): ShipmentPlanRecord[] => {
  const candidateVehicles = vehicles.filter(vehicle => vehicle.status === 'READY' && vehicle.loads.length > 0)
  if(candidateVehicles.length === 0) return []

  const today = getTodayKey()
  const palletMap = getPalletMap(pallets)
  const workOrderMap = getWorkOrderMap(workOrders)
  const preferredStatuses: ShipmentPlanStatus[] = [
    'PLANNED',
    'READY',
    'DEPARTED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED',
    'COMPLETED',
    'READY',
    'COMPLETED',
    'CANCELLED'
  ]
  const activeVehicleIds = new Set<string>()
  const activeVehicleLimit = Math.max(0, candidateVehicles.length - 1)

  return Array.from({ length: PLAN_SEED_COUNT }, (_, index) => {
    const vehicle = candidateVehicles[index % candidateVehicles.length]
    let status = preferredStatuses[index % preferredStatuses.length]
    if(isShipmentPlanActive(status) && (activeVehicleIds.has(vehicle.id) || activeVehicleIds.size >= activeVehicleLimit)){
      status = index % 2 === 0 ? 'COMPLETED' : 'CANCELLED'
    }
    if(isShipmentPlanActive(status)) activeVehicleIds.add(vehicle.id)

    const planId = `shipment_plan_${index + 1}`
    const departureTime = `${String(8 + (index % 4)).padStart(2, '0')}:30`
    const stopCount = Math.min(
      MAX_STOP_COUNT,
      MIN_STOP_COUNT + (index % (MAX_STOP_COUNT - MIN_STOP_COUNT + 1))
    )
    const stops = Array.from({ length: stopCount }, (_, stopIndex) => {
      const load = vehicle.loads[stopIndex % vehicle.loads.length]
      return createSeedStop({
        planId,
        planStatus: status,
        load,
        stopIndex,
        palletMap,
        workOrderMap
      })
    })
    const createdAt = new Date(Date.now() - index * 86400000).toISOString()

    return {
      id: planId,
      shipmentPlanNo: `${PLAN_NO_PREFIX}-${String(index + 1).padStart(PLAN_NO_PADDING, '0')}`,
      vehicleId: vehicle.id,
      planDate: addDays(today, index - 3),
      plannedDepartureTime: departureTime,
      plannedArrivalTime: addHoursToTime(departureTime, 3),
      plannedReturnTime: addHoursToTime(departureTime, 7),
      status,
      driverName: vehicle.driverName,
      notes: index % 4 === 0 ? 'Şube teslim sırası Vehicle Load bazında oluşturuldu.' : '',
      createdAt,
      updatedAt: createdAt,
      stops
    }
  })
}

export const saveShipmentPlanRecords = (
  records: ShipmentPlanRecord[],
  vehicles: ShipmentVehicleRecord[] = [],
  pallets: ShipmentPalletRecord[] = [],
  workOrders: ShipmentWorkOrderRecord[] = []
) => {
  if(!isBrowserStorageAvailable()) return
  const normalizedRecords = records.map((record, index) => normalizePlan(record, index, vehicles, pallets, workOrders))
  localStorage.setItem(SHIPMENT_PLAN_STORAGE_KEY, JSON.stringify(normalizedRecords))
}

export const loadShipmentPlanRecords = (
  vehicles: ShipmentVehicleRecord[],
  pallets: ShipmentPalletRecord[],
  workOrders: ShipmentWorkOrderRecord[]
) => {
  const seedRecords = createShipmentPlanMockData(vehicles, pallets, workOrders)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(SHIPMENT_PLAN_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveShipmentPlanRecords(seedRecords, vehicles, pallets, workOrders)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizePlan(record, index, vehicles, pallets, workOrders))

      saveShipmentPlanRecords(normalizedRecords, vehicles, pallets, workOrders)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveShipmentPlanRecords(seedRecords, vehicles, pallets, workOrders)
    return seedRecords
  }

  if(seedRecords.length > 0) saveShipmentPlanRecords(seedRecords, vehicles, pallets, workOrders)
  return seedRecords
}
