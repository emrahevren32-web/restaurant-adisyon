import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import type {
  ShipmentVehicleLoad,
  ShipmentVehicleRecord
} from './shipment-vehicle.types'

const QUANTITY_ROUNDING_FACTOR = 1000

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const createPalletMap = (
  pallets: ShipmentPalletRecord[]
) => new Map(pallets.map(pallet => [pallet.id, pallet]))

export const calculateShipmentVehicleCurrentWeight = (
  loads: Pick<ShipmentVehicleLoad, 'loadedWeight'>[]
) => roundQuantity(loads.reduce((total, load) => total + load.loadedWeight, 0))

export const calculateShipmentVehicleUtilization = (
  currentWeight: number,
  maxWeight: number
) => (
  maxWeight > 0
    ? roundQuantity((currentWeight / maxWeight) * 100)
    : 0
)

export const resolveShipmentVehicleLoads = (
  loads: ShipmentVehicleLoad[],
  pallets: ShipmentPalletRecord[]
) => {
  const palletMap = createPalletMap(pallets)

  return loads.map(load => {
    const pallet = palletMap.get(load.palletId)

    return {
      ...load,
      loadedWeight: roundQuantity(pallet?.grossWeight ?? load.loadedWeight)
    }
  })
}

export const resolveShipmentVehicleCapacity = (
  record: ShipmentVehicleRecord,
  pallets: ShipmentPalletRecord[] = []
): ShipmentVehicleRecord => {
  const loads = pallets.length > 0
    ? resolveShipmentVehicleLoads(record.loads, pallets)
    : record.loads

  return {
    ...record,
    loads,
    currentWeight: calculateShipmentVehicleCurrentWeight(loads)
  }
}

export const canEditShipmentVehicle = (
  record: ShipmentVehicleRecord
) => record.status !== 'READY'

const getVehicleLoadPalletIds = (
  record: ShipmentVehicleRecord
) => record.loads.map(load => load.palletId).filter(Boolean)

const getAssignedPalletVehicle = (
  palletId: string,
  vehicles: ShipmentVehicleRecord[],
  ignoredVehicleId = ''
) => vehicles.find(vehicle => (
  vehicle.id !== ignoredVehicleId
  && vehicle.loads.some(load => load.palletId === palletId)
))

export const validateShipmentVehicle = (
  record: ShipmentVehicleRecord,
  pallets: ShipmentPalletRecord[] = [],
  vehicles: ShipmentVehicleRecord[] = []
) => {
  if(!record.plateNumber.trim()) return 'Plate Number zorunludur.'
  if(!record.vehicleType) return 'Vehicle Type zorunludur.'
  if(!Number.isFinite(record.maxWeight) || record.maxWeight <= 0){
    return 'Capacity 0\'dan büyük olmalıdır.'
  }

  const resolvedRecord = resolveShipmentVehicleCapacity(record, pallets)
  if(resolvedRecord.currentWeight > resolvedRecord.maxWeight){
    return 'Current Weight, Capacity değerini geçemez.'
  }

  const loadPalletIds = getVehicleLoadPalletIds(resolvedRecord)
  const uniqueLoadPalletIds = new Set(loadPalletIds)
  if(uniqueLoadPalletIds.size !== loadPalletIds.length){
    return 'Bir Pallet aynı araçta yalnızca bir kez yüklenebilir.'
  }

  const palletMap = createPalletMap(pallets)
  for(const [index, load] of resolvedRecord.loads.entries()){
    const rowLabel = `${index + 1}. satır`

    if(!load.palletId) return `${rowLabel} için Pallet zorunludur.`
    const pallet = palletMap.get(load.palletId)
    if(pallets.length > 0 && !pallet) return `${rowLabel} için Pallet bulunamadı.`
    if(pallet && pallet.status !== 'READY'){
      return `${rowLabel} için yalnızca READY durumundaki Pallet yüklenebilir.`
    }
    if(!Number.isFinite(load.loadedWeight) || load.loadedWeight < 0){
      return `${rowLabel} Loaded Weight geçerli olmalıdır.`
    }
    if(getAssignedPalletVehicle(load.palletId, vehicles, resolvedRecord.id)){
      return `${rowLabel} Pallet zaten başka bir araca atanmış.`
    }
  }

  return ''
}

export const markShipmentVehicleReady = (
  record: ShipmentVehicleRecord,
  pallets: ShipmentPalletRecord[],
  vehicles: ShipmentVehicleRecord[]
) => {
  if(record.status === 'READY'){
    throw new Error('READY durumundaki araç değiştirilemez.')
  }

  const nextRecord = resolveShipmentVehicleCapacity({
    ...record,
    status: 'READY',
    updatedAt: new Date().toISOString()
  }, pallets)
  const validationError = validateShipmentVehicle(nextRecord, pallets, vehicles)
  if(validationError) throw new Error(validationError)

  return nextRecord
}
