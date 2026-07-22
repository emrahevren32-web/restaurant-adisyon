import type { User } from '../types'
import type {
  ShipmentWorkOrderItem,
  ShipmentWorkOrderRecord
} from './shipment-work-order.types'

const QUANTITY_ROUNDING_FACTOR = 1000

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const getUserName = (user: User) => user.fullName || user.username

const validateWorkOrderItem = (item: ShipmentWorkOrderItem, index: number) => {
  const rowLabel = `${index + 1}. satır`
  const quantities = [
    item.requestedQuantity,
    item.approvedQuantity,
    item.pickedQuantity
  ]

  if(!item.stockItemId) return `${rowLabel} için Stock Item zorunludur.`
  if(!item.inventoryLotId) return `${rowLabel} için Inventory Lot zorunludur.`
  if(quantities.some(value => !Number.isFinite(value) || value < 0)){
    return `${rowLabel} miktarları negatif olamaz.`
  }
  if(item.requestedQuantity <= 0){
    return `${rowLabel} Requested Quantity 0'dan büyük olmalıdır.`
  }
  if(item.approvedQuantity > item.requestedQuantity){
    return `${rowLabel} Approved Quantity, Requested Quantity değerini geçemez.`
  }
  if(item.pickedQuantity > item.approvedQuantity){
    return `${rowLabel} Picked Quantity, Approved Quantity değerini geçemez.`
  }

  return ''
}

export const canEditShipmentWorkOrder = (record: ShipmentWorkOrderRecord) => (
  record.status !== 'COMPLETED'
)

export const validateShipmentWorkOrder = (record: ShipmentWorkOrderRecord) => {
  if(!record.sourceWarehouseId) return 'Source Warehouse zorunludur.'
  if(!record.destinationBranchId) return 'Destination Branch zorunludur.'
  if(record.items.length === 0) return 'En az bir Work Order Item bulunmalıdır.'

  for(const [index, item] of record.items.entries()){
    const error = validateWorkOrderItem(item, index)
    if(error) return error
  }

  return ''
}

export const normalizeShipmentWorkOrderQuantities = (
  record: ShipmentWorkOrderRecord
): ShipmentWorkOrderRecord => ({
  ...record,
  items: record.items.map(item => {
    const requestedQuantity = roundQuantity(item.requestedQuantity)
    const approvedQuantity = roundQuantity(Math.min(item.approvedQuantity, requestedQuantity))
    const pickedQuantity = roundQuantity(Math.min(item.pickedQuantity, approvedQuantity))

    return {
      ...item,
      requestedQuantity,
      approvedQuantity,
      pickedQuantity
    }
  })
})

export const submitShipmentWorkOrderForApproval = (
  record: ShipmentWorkOrderRecord
) => {
  if(record.status !== 'DRAFT'){
    throw new Error('Yalnızca DRAFT Work Order onaya gönderilebilir.')
  }

  const normalizedRecord = normalizeShipmentWorkOrderQuantities(record)
  const validationError = validateShipmentWorkOrder(normalizedRecord)
  if(validationError) throw new Error(validationError)

  return {
    ...normalizedRecord,
    status: 'WAITING_APPROVAL' as const,
    updatedAt: new Date().toISOString()
  }
}

export const approveShipmentWorkOrder = (
  record: ShipmentWorkOrderRecord,
  user: User
) => {
  if(record.status !== 'DRAFT' && record.status !== 'WAITING_APPROVAL'){
    throw new Error('Yalnızca DRAFT veya WAITING_APPROVAL Work Order onaylanabilir.')
  }

  const normalizedRecord = normalizeShipmentWorkOrderQuantities(record)
  const validationError = validateShipmentWorkOrder(normalizedRecord)
  if(validationError) throw new Error(validationError)

  const now = new Date().toISOString()

  return {
    ...normalizedRecord,
    status: 'APPROVED' as const,
    approvedBy: record.approvedBy || getUserName(user),
    approvedAt: record.approvedAt || now,
    updatedAt: now
  }
}

export const markShipmentWorkOrderReadyForPicking = (
  record: ShipmentWorkOrderRecord
) => {
  if(record.status !== 'APPROVED'){
    throw new Error('Picking hazırlığı yalnızca APPROVED Work Order için başlatılabilir.')
  }

  return {
    ...record,
    status: 'READY_FOR_PICKING' as const,
    updatedAt: new Date().toISOString()
  }
}

export const startShipmentWorkOrderPicking = (
  record: ShipmentWorkOrderRecord
) => {
  if(record.status !== 'APPROVED' && record.status !== 'READY_FOR_PICKING'){
    throw new Error('Work Order APPROVED olmadan Picking başlatılamaz.')
  }

  return {
    ...record,
    status: 'IN_PROGRESS' as const,
    updatedAt: new Date().toISOString()
  }
}

export const completeShipmentWorkOrder = (
  record: ShipmentWorkOrderRecord
) => {
  if(record.status !== 'IN_PROGRESS' && record.status !== 'READY_FOR_PICKING'){
    throw new Error('Yalnızca IN_PROGRESS veya READY_FOR_PICKING Work Order tamamlanabilir.')
  }

  const nextRecord = normalizeShipmentWorkOrderQuantities({
    ...record,
    items: record.items.map(item => ({
      ...item,
      pickedQuantity: item.approvedQuantity
    }))
  })

  return {
    ...nextRecord,
    status: 'COMPLETED' as const,
    updatedAt: new Date().toISOString()
  }
}

export const cancelShipmentWorkOrder = (
  record: ShipmentWorkOrderRecord
) => {
  if(record.status === 'COMPLETED'){
    throw new Error('COMPLETED Work Order iptal edilemez.')
  }

  return {
    ...record,
    status: 'CANCELLED' as const,
    updatedAt: new Date().toISOString()
  }
}
