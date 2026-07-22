import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
import type {
  ShipmentReturnDeliveryLineSource,
  ShipmentReturnDeliverySource,
  ShipmentReturnDeliveryStopSource
} from '../shipment-returns/shipment-return.service'
import type { ShipmentReturnItem, ShipmentReturnRecord } from '../shipment-returns/shipment-return.types'
import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import type {
  ShipmentWaybillItem,
  ShipmentWaybillRecord
} from './shipment-waybill.types'

const QUANTITY_ROUNDING_FACTOR = 1000

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

export const calculateShipmentWaybillQuantity = (
  items: Pick<ShipmentWaybillItem, 'quantity'>[]
) => roundQuantity(items.reduce((total, item) => total + item.quantity, 0))

export const getShipmentWaybillLineKey = (
  item: Pick<ShipmentWaybillItem, 'deliveryStopId' | 'stockItemId' | 'inventoryLotId'>
) => `${item.deliveryStopId}::${item.stockItemId}::${item.inventoryLotId}`

export const getShipmentWaybillReturnItemMap = (
  returns: ShipmentReturnRecord[]
) => new Map(returns.flatMap(record => (
  record.items.map(item => [item.id, item] as const)
)))

export const getShipmentWaybillDeliveryLine = (
  item: Pick<ShipmentWaybillItem, 'deliveryStopId' | 'stockItemId' | 'inventoryLotId'>,
  deliveryLines: ShipmentReturnDeliveryLineSource[]
) => deliveryLines.find(line => (
  line.deliveryStopId === item.deliveryStopId
  && line.stockItemId === item.stockItemId
  && line.inventoryLotId === item.inventoryLotId
)) || null

const getPlan = (
  shipmentPlanId: string,
  plans: ShipmentPlanRecord[]
) => plans.find(plan => plan.id === shipmentPlanId) || null

const getVehicle = (
  vehicleId: string,
  vehicles: ShipmentVehicleRecord[]
) => vehicles.find(vehicle => vehicle.id === vehicleId) || null

const getDelivery = (
  deliveryId: string,
  deliveries: ShipmentReturnDeliverySource[]
) => deliveries.find(delivery => delivery.id === deliveryId) || null

const getDeliveryStop = (
  deliveryStopId: string,
  deliveryStops: ShipmentReturnDeliveryStopSource[]
) => deliveryStops.find(stop => stop.id === deliveryStopId) || null

const validateReturnItemLink = (
  item: ShipmentWaybillItem,
  returnItem: ShipmentReturnItem | undefined,
  rowLabel: string
) => {
  if(!item.returnItemId) return ''
  if(!returnItem) return `${rowLabel} Return Item bulunamadı.`
  if(returnItem.deliveryStopId !== item.deliveryStopId){
    return `${rowLabel} Return Item seçilen Delivery Stop ile uyumlu olmalıdır.`
  }
  if(returnItem.stockItemId !== item.stockItemId || returnItem.inventoryLotId !== item.inventoryLotId){
    return `${rowLabel} Return Item seçilen Stock Item ve Inventory Lot ile uyumlu olmalıdır.`
  }
  if(item.quantity > returnItem.quantity){
    return `${rowLabel} Quantity, Return Item miktarını geçemez.`
  }

  return ''
}

export const validateShipmentWaybill = (
  record: ShipmentWaybillRecord,
  plans: ShipmentPlanRecord[] = [],
  vehicles: ShipmentVehicleRecord[] = [],
  deliveries: ShipmentReturnDeliverySource[] = [],
  deliveryStops: ShipmentReturnDeliveryStopSource[] = [],
  deliveryLines: ShipmentReturnDeliveryLineSource[] = [],
  returns: ShipmentReturnRecord[] = [],
  existingRecord?: ShipmentWaybillRecord
) => {
  if(!record.shipmentPlanId.trim()) return 'Shipment Plan zorunludur.'
  if(!record.vehicleId.trim()) return 'Vehicle zorunludur.'
  if(record.items.length === 0) return 'En az bir Waybill Item bulunmalıdır.'

  if(existingRecord && existingRecord.shipmentPlanId !== record.shipmentPlanId){
    return 'İrsaliye oluşturulduktan sonra Shipment Plan değiştirilemez.'
  }

  const plan = getPlan(record.shipmentPlanId, plans)
  if(plans.length > 0 && !plan) return 'Shipment Plan kaydı bulunamadı.'

  const vehicle = getVehicle(record.vehicleId, vehicles)
  if(vehicles.length > 0 && !vehicle) return 'Vehicle kaydı bulunamadı.'

  if(plan && record.vehicleId !== plan.vehicleId){
    return 'Vehicle seçilen Shipment Plan ile uyumlu olmalıdır.'
  }

  const delivery = record.deliveryId ? getDelivery(record.deliveryId, deliveries) : null
  if(record.deliveryId && deliveries.length > 0 && !delivery) return 'Delivery kaydı bulunamadı.'
  if(delivery && delivery.shipmentPlanId !== record.shipmentPlanId){
    return 'Delivery seçilen Shipment Plan ile uyumlu olmalıdır.'
  }
  if(delivery && delivery.vehicleId !== record.vehicleId){
    return 'Delivery seçilen Vehicle ile uyumlu olmalıdır.'
  }

  const returnItemMap = getShipmentWaybillReturnItemMap(returns)

  for(const [index, item] of record.items.entries()){
    const rowLabel = `${index + 1}. waybill item`

    if(!item.deliveryStopId.trim()) return `${rowLabel} için Delivery Stop zorunludur.`
    if(!item.stockItemId.trim()) return `${rowLabel} için Stock Item zorunludur.`
    if(!item.inventoryLotId.trim()) return `${rowLabel} için Inventory Lot zorunludur.`
    if(!Number.isFinite(item.quantity) || item.quantity <= 0){
      return `${rowLabel} Quantity 0'dan büyük olmalıdır.`
    }

    const deliveryStop = getDeliveryStop(item.deliveryStopId, deliveryStops)
    if(deliveryStops.length > 0 && !deliveryStop) return `${rowLabel} Delivery Stop bulunamadı.`
    if(deliveryStop && deliveryStop.shipmentPlanId !== record.shipmentPlanId){
      return `${rowLabel} Delivery Stop seçilen Shipment Plan ile uyumlu olmalıdır.`
    }
    if(record.deliveryId && deliveryStop && deliveryStop.deliveryId !== record.deliveryId){
      return `${rowLabel} Delivery Stop seçilen Delivery kaydına ait olmalıdır.`
    }

    const deliveryLine = getShipmentWaybillDeliveryLine(item, deliveryLines)
    if(deliveryLines.length > 0 && !deliveryLine){
      return `${rowLabel} teslim edilmiş Stock Item ve Inventory Lot satırına bağlanmalıdır.`
    }
    if(deliveryLine && item.quantity > deliveryLine.deliveredQuantity){
      return `${rowLabel} Quantity teslim edilen miktarı geçemez.`
    }

    const returnValidationError = validateReturnItemLink(item, returnItemMap.get(item.returnItemId), rowLabel)
    if(returnValidationError) return returnValidationError
  }

  return ''
}
