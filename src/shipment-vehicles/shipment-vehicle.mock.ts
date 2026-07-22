import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import {
  resolveShipmentVehicleCapacity
} from './shipment-vehicle.service'
import type {
  ShipmentVehicleLoad,
  ShipmentVehicleRecord,
  ShipmentVehicleStatus,
  ShipmentVehicleType
} from './shipment-vehicle.types'

export const SHIPMENT_VEHICLE_STORAGE_KEY = 'ra_shipment_vehicles'

export const SHIPMENT_VEHICLE_STATUSES: ShipmentVehicleStatus[] = [
  'AVAILABLE',
  'LOADING',
  'READY',
  'IN_TRANSIT',
  'DELIVERED',
  'MAINTENANCE'
]

export const SHIPMENT_VEHICLE_STATUS_LABELS: Record<ShipmentVehicleStatus, string> = {
  AVAILABLE: 'Müsait',
  LOADING: 'Yükleniyor',
  READY: 'Hazır',
  IN_TRANSIT: 'Yolda',
  DELIVERED: 'Teslim Edildi',
  MAINTENANCE: 'Bakımda'
}

export const SHIPMENT_VEHICLE_TYPES: ShipmentVehicleType[] = [
  'VAN',
  'TRUCK',
  'REFRIGERATED',
  'SEMI_TRAILER',
  'OTHER'
]

export const SHIPMENT_VEHICLE_TYPE_LABELS: Record<ShipmentVehicleType, string> = {
  VAN: 'Van',
  TRUCK: 'Kamyon',
  REFRIGERATED: 'Soğutmalı',
  SEMI_TRAILER: 'Yarı Römork',
  OTHER: 'Diğer'
}

type RawShipmentVehicleRecord = Partial<Record<keyof ShipmentVehicleRecord, unknown>> & Record<string, unknown>
type RawShipmentVehicleLoadRecord = Partial<Record<keyof ShipmentVehicleLoad, unknown>> & Record<string, unknown>

const DEFAULT_STATUS: ShipmentVehicleStatus = 'AVAILABLE'
const DEFAULT_TYPE: ShipmentVehicleType = 'TRUCK'
const VEHICLE_NO_PREFIX = 'VH'
const VEHICLE_NO_PADDING = 6
const VEHICLE_SEED_COUNT = 10
const MAX_LOADS_PER_VEHICLE = 8
const QUANTITY_ROUNDING_FACTOR = 1000

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawShipmentVehicleRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isLoadRecord = (value: unknown): value is RawShipmentVehicleLoadRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? roundQuantity(parsed) : 0
}

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? roundQuantity(parsed) : fallback
}

const normalizeStatus = (value: unknown): ShipmentVehicleStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_VEHICLE_STATUSES.includes(normalized as ShipmentVehicleStatus)
    ? normalized as ShipmentVehicleStatus
    : DEFAULT_STATUS
}

const normalizeVehicleType = (value: unknown): ShipmentVehicleType => {
  const normalized = normalizeText(value).toUpperCase()
  return SHIPMENT_VEHICLE_TYPES.includes(normalized as ShipmentVehicleType)
    ? normalized as ShipmentVehicleType
    : DEFAULT_TYPE
}

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const getPalletMap = (
  pallets: ShipmentPalletRecord[]
) => new Map(pallets.map(pallet => [pallet.id, pallet]))

export const getNextShipmentVehicleNo = (
  records: Pick<ShipmentVehicleRecord, 'vehicleNo'>[],
  offset = 0
) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.vehicleNo.match(new RegExp(`${VEHICLE_NO_PREFIX}-(\\d+)$`))
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${VEHICLE_NO_PREFIX}-${String(maxNo + 1 + offset).padStart(VEHICLE_NO_PADDING, '0')}`
}

const normalizeVehicleLoad = (
  item: RawShipmentVehicleLoadRecord,
  vehicleId: string,
  index: number,
  palletMap: ReturnType<typeof getPalletMap>
): ShipmentVehicleLoad => {
  const palletId = normalizeText(item.palletId)
  const pallet = palletMap.get(palletId)

  return {
    id: normalizeText(item.id) || `shipment_vehicle_load_${vehicleId}_${index + 1}`,
    vehicleId: normalizeText(item.vehicleId) || vehicleId,
    palletId,
    loadedWeight: pallet?.grossWeight || normalizeNonNegativeNumber(item.loadedWeight),
    loadedAt: normalizeText(item.loadedAt) || new Date().toISOString(),
    notes: normalizeText(item.notes)
  }
}

const normalizeVehicle = (
  item: RawShipmentVehicleRecord,
  index: number,
  pallets: ShipmentPalletRecord[]
): ShipmentVehicleRecord => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now
  const id = normalizeText(item.id) || `shipment_vehicle_${index + 1}`
  const palletMap = getPalletMap(pallets)
  const rawLoads = Array.isArray(item.loads) ? item.loads.filter(isLoadRecord) : []
  const loads = rawLoads.map((record, loadIndex) => normalizeVehicleLoad(record, id, loadIndex, palletMap))
  const record: ShipmentVehicleRecord = {
    id,
    vehicleNo: normalizeText(item.vehicleNo) || `${VEHICLE_NO_PREFIX}-${String(index + 1).padStart(VEHICLE_NO_PADDING, '0')}`,
    plateNumber: normalizeText(item.plateNumber),
    vehicleName: normalizeText(item.vehicleName),
    vehicleType: normalizeVehicleType(item.vehicleType),
    maxWeight: normalizePositiveNumber(item.maxWeight, 1500),
    currentWeight: normalizeNonNegativeNumber(item.currentWeight),
    status: normalizeStatus(item.status),
    driverName: normalizeText(item.driverName),
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    loads
  }

  return resolveShipmentVehicleCapacity(record, pallets)
}

const createSeedLoad = (
  vehicleId: string,
  pallet: ShipmentPalletRecord,
  vehicleIndex: number,
  loadIndex: number
): ShipmentVehicleLoad => ({
  id: `shipment_vehicle_load_${vehicleIndex + 1}_${loadIndex + 1}`,
  vehicleId,
  palletId: pallet.id,
  loadedWeight: pallet.grossWeight,
  loadedAt: new Date(Date.now() - (vehicleIndex + loadIndex) * 3600000).toISOString(),
  notes: loadIndex % 3 === 0 ? 'READY pallet araç planına alındı.' : ''
})

export const createShipmentVehicleMockData = (
  pallets: ShipmentPalletRecord[]
): ShipmentVehicleRecord[] => {
  const readyPallets = pallets.filter(pallet => pallet.status === 'READY')
  const statuses: ShipmentVehicleStatus[] = [
    'AVAILABLE',
    'LOADING',
    'READY',
    'AVAILABLE',
    'MAINTENANCE',
    'LOADING',
    'READY',
    'IN_TRANSIT',
    'DELIVERED',
    'AVAILABLE'
  ]
  const vehicleTypes: ShipmentVehicleType[] = [
    'VAN',
    'TRUCK',
    'REFRIGERATED',
    'SEMI_TRAILER',
    'TRUCK',
    'REFRIGERATED',
    'VAN',
    'SEMI_TRAILER',
    'TRUCK',
    'OTHER'
  ]
  const maxWeights = [950, 2400, 1800, 8500, 3200, 2200, 1200, 9000, 4000, 1500]
  let palletCursor = 0

  return Array.from({ length: VEHICLE_SEED_COUNT }, (_, index) => {
    const id = `shipment_vehicle_${index + 1}`
    const status = statuses[index % statuses.length]
    const canHaveLoads = status !== 'AVAILABLE' && status !== 'MAINTENANCE'
    const maxWeight = maxWeights[index % maxWeights.length]
    const loads: ShipmentVehicleLoad[] = []

    if(canHaveLoads){
      while(
        palletCursor < readyPallets.length
        && loads.length < Math.min(MAX_LOADS_PER_VEHICLE, 1 + (index % MAX_LOADS_PER_VEHICLE))
      ){
        const pallet = readyPallets[palletCursor]
        const nextWeight = loads.reduce((total, load) => total + load.loadedWeight, 0) + pallet.grossWeight
        if(nextWeight > maxWeight) break
        loads.push(createSeedLoad(id, pallet, index, loads.length))
        palletCursor += 1
      }
    }

    const createdAt = new Date(Date.now() - index * 86400000).toISOString()
    const record: ShipmentVehicleRecord = {
      id,
      vehicleNo: `${VEHICLE_NO_PREFIX}-${String(index + 1).padStart(VEHICLE_NO_PADDING, '0')}`,
      plateNumber: `34 VP ${String(120 + index).padStart(3, '0')}`,
      vehicleName: index % 2 === 0 ? `Soğuk Sevkiyat ${index + 1}` : `Şube Dağıtım ${index + 1}`,
      vehicleType: vehicleTypes[index % vehicleTypes.length],
      maxWeight,
      currentWeight: 0,
      status,
      driverName: ['Mert Kaya', 'Selin Demir', 'Ahmet Arslan', 'Bora Şahin', 'Ece Yılmaz'][index % 5],
      notes: status === 'MAINTENANCE' ? 'Periyodik bakım planında.' : '',
      createdAt,
      updatedAt: createdAt,
      loads
    }

    return resolveShipmentVehicleCapacity(record, pallets)
  })
}

export const saveShipmentVehicleRecords = (
  records: ShipmentVehicleRecord[],
  pallets: ShipmentPalletRecord[] = []
) => {
  if(!isBrowserStorageAvailable()) return
  const normalizedRecords = records.map((record, index) => normalizeVehicle(record, index, pallets))
  localStorage.setItem(SHIPMENT_VEHICLE_STORAGE_KEY, JSON.stringify(normalizedRecords))
}

export const loadShipmentVehicleRecords = (
  pallets: ShipmentPalletRecord[]
) => {
  const seedRecords = createShipmentVehicleMockData(pallets)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(SHIPMENT_VEHICLE_STORAGE_KEY)

  if(!storedRecords){
    saveShipmentVehicleRecords(seedRecords, pallets)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeVehicle(record, index, pallets))

      saveShipmentVehicleRecords(normalizedRecords, pallets)
      return normalizedRecords
    }
  } catch {
    saveShipmentVehicleRecords(seedRecords, pallets)
    return seedRecords
  }

  saveShipmentVehicleRecords(seedRecords, pallets)
  return seedRecords
}
