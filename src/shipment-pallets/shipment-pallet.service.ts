import type { ShipmentWorkOrderItem, ShipmentWorkOrderRecord } from '../shipment-work-orders/shipment-work-order.types'
import type { StockUnit, User } from '../types'
import type {
  ShipmentPalletItem,
  ShipmentPalletRecord
} from './shipment-pallet.types'

export const SHIPMENT_PALLET_TARE_WEIGHT_KG = 25

const QUANTITY_ROUNDING_FACTOR = 1000

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const getUserName = (user: User) => user.fullName || user.username

export const getShipmentPalletItemWeightKg = (
  quantity: number,
  unit: StockUnit
) => {
  if(unit === 'kg') return roundQuantity(quantity)
  if(unit === 'gr') return roundQuantity(quantity / 1000)
  if(unit === 'lt') return roundQuantity(quantity)
  if(unit === 'ml') return roundQuantity(quantity / 1000)
  if(unit === 'koli') return roundQuantity(quantity * 8)
  if(unit === 'paket') return roundQuantity(quantity)
  return roundQuantity(quantity * 0.5)
}

export const calculateShipmentPalletNetWeight = (
  items: Pick<ShipmentPalletItem, 'quantity' | 'unit'>[]
) => roundQuantity(items.reduce((total, item) => (
  total + getShipmentPalletItemWeightKg(item.quantity, item.unit)
), 0))

export const calculateShipmentPalletGrossWeight = (
  netWeight: number,
  hasItems: boolean
) => roundQuantity(hasItems ? netWeight + SHIPMENT_PALLET_TARE_WEIGHT_KG : 0)

export const resolveShipmentPalletWeights = (
  record: ShipmentPalletRecord
): ShipmentPalletRecord => {
  const netWeight = calculateShipmentPalletNetWeight(record.items)

  return {
    ...record,
    netWeight,
    grossWeight: calculateShipmentPalletGrossWeight(netWeight, record.items.length > 0)
  }
}

export const getWorkOrderItemPalletLimit = (
  item: ShipmentWorkOrderItem
) => (
  item.approvedQuantity > 0
    ? item.approvedQuantity
    : item.requestedQuantity
)

const createWorkOrderMap = (
  workOrders: ShipmentWorkOrderRecord[]
) => new Map(workOrders.map(workOrder => [workOrder.id, workOrder]))

const createWorkOrderItemMap = (
  workOrder: ShipmentWorkOrderRecord | null
) => new Map((workOrder?.items || []).map(item => [item.id, item]))

const getAllocatedQuantityByWorkOrderItem = (
  workOrderItemId: string,
  pallets: ShipmentPalletRecord[],
  ignoredPalletId = ''
) => roundQuantity(pallets.reduce((total, pallet) => {
  if(pallet.id === ignoredPalletId) return total
  return total + pallet.items
    .filter(item => item.workOrderItemId === workOrderItemId)
    .reduce((itemTotal, item) => itemTotal + item.quantity, 0)
}, 0))

const validatePalletItem = ({
  item,
  workOrderItem,
  itemIndex,
  pallets,
  palletId
}: {
  item: ShipmentPalletItem
  workOrderItem: ShipmentWorkOrderItem | undefined
  itemIndex: number
  pallets: ShipmentPalletRecord[]
  palletId: string
}) => {
  const rowLabel = `${itemIndex + 1}. satır`

  if(!item.workOrderItemId) return `${rowLabel} için Work Order Item zorunludur.`
  if(!workOrderItem) return `${rowLabel} için Work Order Item bulunamadı.`
  if(!item.stockItemId) return `${rowLabel} için Stock Item zorunludur.`
  if(!item.inventoryLotId) return `${rowLabel} için Inventory Lot zorunludur.`
  if(!Number.isFinite(item.quantity) || item.quantity <= 0){
    return `${rowLabel} Pallet Item Quantity 0'dan büyük olmalıdır.`
  }
  if(item.stockItemId !== workOrderItem.stockItemId || item.inventoryLotId !== workOrderItem.inventoryLotId){
    return `${rowLabel} Work Order Item ilişkisi Inventory Lot ve Stock Item ile uyumlu olmalıdır.`
  }

  const limit = getWorkOrderItemPalletLimit(workOrderItem)
  if(item.quantity > limit){
    return `${rowLabel} Pallet Item Quantity, Work Order Item miktarını geçemez.`
  }

  const otherAllocatedQuantity = getAllocatedQuantityByWorkOrderItem(item.workOrderItemId, pallets, palletId)
  if(roundQuantity(otherAllocatedQuantity + item.quantity) > limit){
    return `${rowLabel} için toplam paletlenen miktar Work Order Item miktarını geçemez.`
  }

  return ''
}

export const validateShipmentPallet = (
  record: ShipmentPalletRecord,
  workOrders: ShipmentWorkOrderRecord[] = [],
  pallets: ShipmentPalletRecord[] = []
) => {
  if(!record.warehouseId) return 'Warehouse zorunludur.'
  if(!record.workOrderId) return 'Work Order zorunludur.'
  if(record.items.length === 0) return 'En az bir Pallet Item bulunmalıdır.'

  const workOrder = createWorkOrderMap(workOrders).get(record.workOrderId) || null
  if(workOrders.length > 0 && !workOrder) return 'Work Order bulunamadı.'
  if(workOrder && record.warehouseId !== workOrder.sourceWarehouseId){
    return 'Pallet Warehouse, Work Order Source Warehouse ile aynı olmalıdır.'
  }

  const workOrderItemMap = createWorkOrderItemMap(workOrder)

  for(const [index, item] of record.items.entries()){
    const workOrderItem = workOrderItemMap.get(item.workOrderItemId)
    const error = validatePalletItem({
      item,
      workOrderItem,
      itemIndex: index,
      pallets,
      palletId: record.id
    })
    if(error) return error
  }

  const currentQuantityByWorkOrderItem = record.items.reduce((quantityMap, item) => {
    quantityMap.set(item.workOrderItemId, roundQuantity((quantityMap.get(item.workOrderItemId) || 0) + item.quantity))
    return quantityMap
  }, new Map<string, number>())

  for(const [workOrderItemId, quantity] of currentQuantityByWorkOrderItem.entries()){
    const workOrderItem = workOrderItemMap.get(workOrderItemId)
    if(!workOrderItem) continue
    const limit = getWorkOrderItemPalletLimit(workOrderItem)
    const otherAllocatedQuantity = getAllocatedQuantityByWorkOrderItem(workOrderItemId, pallets, record.id)
    if(roundQuantity(otherAllocatedQuantity + quantity) > limit){
      return 'Pallet Item Quantity toplamı, Work Order Item miktarını geçemez.'
    }
  }

  return ''
}

export const markShipmentPalletReady = (
  record: ShipmentPalletRecord,
  workOrders: ShipmentWorkOrderRecord[],
  pallets: ShipmentPalletRecord[]
) => {
  if(record.status === 'LOADED' || record.status === 'SHIPPED' || record.status === 'DELIVERED'){
    throw new Error('Yükleme veya sevkiyat sürecindeki Pallet tekrar READY yapılamaz.')
  }

  const nextRecord = resolveShipmentPalletWeights({
    ...record,
    status: 'READY',
    updatedAt: new Date().toISOString()
  })
  const validationError = validateShipmentPallet(nextRecord, workOrders, pallets)
  if(validationError) throw new Error(validationError)

  return nextRecord
}

export const assertShipmentPalletReadyForVehiclePlanning = (
  record: ShipmentPalletRecord
) => {
  if(record.status !== 'READY'){
    throw new Error('Pallet READY olmadan araç planlamasına gönderilemez.')
  }
}

export const createShipmentPalletAuditNote = (
  user: User
) => `Paletleme operatörü: ${getUserName(user)}`
