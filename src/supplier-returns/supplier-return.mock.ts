import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { ReturnProcess } from '../return-processes/return-process.types'
import type {
  SupplierReturn,
  SupplierReturnStatus,
  SupplierReturnTransportMethod
} from './supplier-return.types'

export const SUPPLIER_RETURN_STORAGE_KEY = 'ra_supplier_returns'

export const SUPPLIER_RETURN_TRANSPORT_METHODS: SupplierReturnTransportMethod[] = [
  'COMPANY_VEHICLE',
  'SUPPLIER_PICKUP',
  'CARGO',
  'THIRD_PARTY',
  'OTHER'
]

export const SUPPLIER_RETURN_STATUSES: SupplierReturnStatus[] = [
  'PREPARING',
  'SHIPPED',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED'
]

export const SUPPLIER_RETURN_TRANSPORT_METHOD_LABELS: Record<SupplierReturnTransportMethod, string> = {
  COMPANY_VEHICLE: 'Firma Aracı',
  SUPPLIER_PICKUP: 'Tedarikçi Teslim Alacak',
  CARGO: 'Kargo',
  THIRD_PARTY: 'Üçüncü Parti',
  OTHER: 'Diğer'
}

export const SUPPLIER_RETURN_STATUS_LABELS: Record<SupplierReturnStatus, string> = {
  PREPARING: 'Hazırlanıyor',
  SHIPPED: 'Sevk Edildi',
  DELIVERED: 'Teslim Edildi',
  COMPLETED: 'Tamamlandı',
  CANCELLED: 'İptal'
}

type RawSupplierReturnRecord = Partial<Record<keyof SupplierReturn, unknown>> & Record<string, unknown>

const DEFAULT_TRANSPORT_METHOD: SupplierReturnTransportMethod = 'COMPANY_VEHICLE'
const DEFAULT_STATUS: SupplierReturnStatus = 'PREPARING'
const DUMMY_SUPPLIER_RETURN_COUNT = 10
const QUANTITY_ROUNDING_FACTOR = 1000

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawSupplierReturnRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeTransportMethod = (value: unknown): SupplierReturnTransportMethod => {
  const normalized = normalizeText(value).toUpperCase()
  return SUPPLIER_RETURN_TRANSPORT_METHODS.includes(normalized as SupplierReturnTransportMethod)
    ? normalized as SupplierReturnTransportMethod
    : DEFAULT_TRANSPORT_METHOD
}

const normalizeStatus = (value: unknown): SupplierReturnStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SUPPLIER_RETURN_STATUSES.includes(normalized as SupplierReturnStatus)
    ? normalized as SupplierReturnStatus
    : DEFAULT_STATUS
}

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

export const getNextSupplierReturnNo = (records: SupplierReturn[]) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.supplierReturnNo.match(/SRET-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `SRET-${String(maxNo + 1).padStart(6, '0')}`
}

export const canCreateSupplierReturnFromProcess = (record: ReturnProcess) => (
  record.status === 'APPROVED' || record.status === 'COMPLETED'
)

export const hasSupplierReturnForProcess = (
  records: SupplierReturn[],
  returnProcessId: string,
  excludedSupplierReturnId = ''
) => (
  records.some(record => (
    record.id !== excludedSupplierReturnId
    && record.returnProcessId === returnProcessId
    && record.status !== 'CANCELLED'
  ))
)

export const applyCompletedSupplierReturnsToInventoryLots = (
  inventoryLots: InventoryLot[],
  returnProcesses: ReturnProcess[],
  supplierReturns: SupplierReturn[]
) => {
  const returnProcessMap = new Map(returnProcesses.map(record => [record.id, record]))
  const completedQuantityByLot = new Map<string, number>()

  supplierReturns.forEach(supplierReturn => {
    if(supplierReturn.status !== 'COMPLETED') return

    const returnProcess = returnProcessMap.get(supplierReturn.returnProcessId)
    if(!returnProcess) return

    const currentQuantity = completedQuantityByLot.get(returnProcess.inventoryLotId) || 0
    completedQuantityByLot.set(
      returnProcess.inventoryLotId,
      roundQuantity(currentQuantity + returnProcess.returnQuantity)
    )
  })

  return inventoryLots.map(lot => {
    const completedQuantity = completedQuantityByLot.get(lot.id) || 0
    if(completedQuantity <= 0) return lot

    const nextRemainingQuantity = roundQuantity(Math.max(0, lot.receivedQuantity - completedQuantity))
    const nextStatus: InventoryLot['status'] = nextRemainingQuantity <= 0
      ? 'RETURNED'
      : lot.status === 'RETURNED'
        ? 'ACTIVE'
        : lot.status
    const hasChanged = nextRemainingQuantity !== lot.remainingQuantity || nextStatus !== lot.status

    return hasChanged
      ? {
        ...lot,
        remainingQuantity: nextRemainingQuantity,
        status: nextStatus,
        updatedAt: new Date().toISOString()
      }
      : lot
  })
}

export const applyCompletedSupplierReturnsToReturnProcesses = (
  returnProcesses: ReturnProcess[],
  supplierReturns: SupplierReturn[]
) => {
  const completedReturnProcessIds = new Set(
    supplierReturns
      .filter(record => record.status === 'COMPLETED')
      .map(record => record.returnProcessId)
  )

  return returnProcesses.map(returnProcess => {
    if(!completedReturnProcessIds.has(returnProcess.id) || returnProcess.status === 'COMPLETED') return returnProcess

    return {
      ...returnProcess,
      status: 'COMPLETED' as const,
      updatedAt: new Date().toISOString()
    }
  })
}

export const createSupplierReturnMockData = (
  returnProcesses: ReturnProcess[]
): SupplierReturn[] => {
  const eligibleReturnProcesses = returnProcesses
    .filter(canCreateSupplierReturnFromProcess)
    .slice(0, DUMMY_SUPPLIER_RETURN_COUNT)

  const statuses: SupplierReturnStatus[] = [
    'PREPARING',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'SHIPPED',
    'DELIVERED',
    'COMPLETED',
    'PREPARING',
    'SHIPPED',
    'COMPLETED'
  ]
  const transportMethods: SupplierReturnTransportMethod[] = [
    'COMPANY_VEHICLE',
    'SUPPLIER_PICKUP',
    'CARGO',
    'THIRD_PARTY',
    'COMPANY_VEHICLE',
    'CARGO',
    'SUPPLIER_PICKUP',
    'OTHER',
    'THIRD_PARTY',
    'CARGO'
  ]

  return eligibleReturnProcesses.map((returnProcess, index) => {
    const shipmentDate = `2026-07-${String(20 + (index % 4)).padStart(2, '0')}`
    const status = statuses[index % statuses.length]
    const deliveryDate = status === 'DELIVERED' || status === 'COMPLETED'
      ? addDays(shipmentDate, 1 + (index % 2))
      : ''
    const createdAt = `${shipmentDate}T12:${String(index * 4).padStart(2, '0')}:00.000Z`

    return {
      id: `supplier_return_${String(index + 1).padStart(3, '0')}`,
      supplierReturnNo: `SRET-${String(index + 1).padStart(6, '0')}`,
      returnProcessId: returnProcess.id,
      supplierId: returnProcess.supplierId,
      warehouseId: returnProcess.warehouseId,
      shipmentDate,
      deliveryDate,
      trackingNumber: index % 3 === 0 ? `TRK-${String(9000 + index)}` : '',
      transportMethod: transportMethods[index % transportMethods.length],
      receiverName: status === 'DELIVERED' || status === 'COMPLETED' ? 'Tedarikçi Depo Yetkilisi' : '',
      status,
      notes: 'Return Process üzerinden oluşturulan örnek tedarikçi iade sevki.',
      createdBy: 'Kalite Kontrol',
      createdAt,
      updatedAt: createdAt
    }
  })
}

const normalizeSupplierReturn = (item: RawSupplierReturnRecord, index: number): SupplierReturn => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now

  return {
    id: normalizeText(item.id) || `supplier_return_${Date.now()}_${index}`,
    supplierReturnNo: normalizeText(item.supplierReturnNo) || `SRET-${String(index + 1).padStart(6, '0')}`,
    returnProcessId: normalizeText(item.returnProcessId),
    supplierId: normalizeText(item.supplierId),
    warehouseId: normalizeText(item.warehouseId),
    shipmentDate: normalizeText(item.shipmentDate),
    deliveryDate: normalizeText(item.deliveryDate),
    trackingNumber: normalizeText(item.trackingNumber),
    transportMethod: normalizeTransportMethod(item.transportMethod),
    receiverName: normalizeText(item.receiverName),
    status: normalizeStatus(item.status),
    notes: normalizeText(item.notes),
    createdBy: normalizeText(item.createdBy) || 'Kalite Kontrol',
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const saveSupplierReturnRecords = (records: SupplierReturn[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(SUPPLIER_RETURN_STORAGE_KEY, JSON.stringify(records))
}

export const loadSupplierReturnRecords = (
  returnProcesses: ReturnProcess[]
) => {
  const seedRecords = createSupplierReturnMockData(returnProcesses)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(SUPPLIER_RETURN_STORAGE_KEY)
  if(!storedRecords){
    if(seedRecords.length > 0) saveSupplierReturnRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map(normalizeSupplierReturn)

      saveSupplierReturnRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveSupplierReturnRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveSupplierReturnRecords(seedRecords)
  return seedRecords
}
