import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import type { ShipmentPlanRecord, ShipmentPlanStop } from '../shipment-plans/shipment-plan.types'
import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import type { StockUnit } from '../types'
import type {
  ShipmentReturnItem,
  ShipmentReturnRecord
} from './shipment-return.types'

export type ShipmentReturnDeliverySource = {
  id: string
  deliveryNo: string
  shipmentPlanId: string
  vehicleId: string
  driverName: string
  deliveredAt: string
  stopIds: string[]
}

export type ShipmentReturnDeliveryStopSource = {
  id: string
  deliveryId: string
  shipmentPlanId: string
  shipmentPlanStopId: string
  branchId: string
  vehicleLoadId: string
  stopOrder: number
  deliveredAt: string
}

export type ShipmentReturnDeliveryLineSource = {
  id: string
  deliveryStopId: string
  shipmentPlanId: string
  shipmentPlanStopId: string
  vehicleId: string
  branchId: string
  vehicleLoadId: string
  palletId: string
  palletItemId: string
  stockItemId: string
  inventoryLotId: string
  deliveredQuantity: number
  unit: StockUnit
}

const QUANTITY_ROUNDING_FACTOR = 1000

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

export const getShipmentReturnDeliveryId = (
  shipmentPlanId: string
) => `shipment_delivery_${shipmentPlanId}`

export const getShipmentReturnDeliveryStopId = (
  shipmentPlanStopId: string
) => `shipment_delivery_stop_${shipmentPlanStopId}`

const getDeliveryNo = (
  plan: Pick<ShipmentPlanRecord, 'shipmentPlanNo' | 'id'>
) => {
  const planNumber = plan.shipmentPlanNo.match(/SP-(\d+)$/)?.[1] || plan.id.replace(/\D/g, '')
  return `DLV-${String(planNumber || '1').padStart(6, '0')}`
}

const createVehicleMap = (
  vehicles: ShipmentVehicleRecord[]
) => new Map(vehicles.map(vehicle => [vehicle.id, vehicle]))

const createPalletMap = (
  pallets: ShipmentPalletRecord[]
) => new Map(pallets.map(pallet => [pallet.id, pallet]))

const getVehicleLoad = (
  vehicle: ShipmentVehicleRecord | undefined,
  vehicleLoadId: string
) => vehicle?.loads.find(load => load.id === vehicleLoadId) || null

const isDeliveredPlanStop = (
  plan: ShipmentPlanRecord,
  stop: ShipmentPlanStop
) => plan.status === 'COMPLETED' && stop.status === 'DELIVERED'

export const createShipmentReturnDeliverySources = (
  plans: ShipmentPlanRecord[],
  vehicles: ShipmentVehicleRecord[],
  pallets: ShipmentPalletRecord[]
) => {
  const vehicleMap = createVehicleMap(vehicles)
  const palletMap = createPalletMap(pallets)
  const deliveries: ShipmentReturnDeliverySource[] = []
  const stops: ShipmentReturnDeliveryStopSource[] = []
  const lines: ShipmentReturnDeliveryLineSource[] = []

  for(const plan of plans){
    const deliveredStops = plan.stops
      .filter(stop => isDeliveredPlanStop(plan, stop))
      .sort((first, second) => first.stopOrder - second.stopOrder)

    if(deliveredStops.length === 0) continue

    const vehicle = vehicleMap.get(plan.vehicleId)
    const deliveryId = getShipmentReturnDeliveryId(plan.id)
    const stopIds = deliveredStops.map(stop => getShipmentReturnDeliveryStopId(stop.id))

    deliveries.push({
      id: deliveryId,
      deliveryNo: getDeliveryNo(plan),
      shipmentPlanId: plan.id,
      vehicleId: plan.vehicleId,
      driverName: plan.driverName || vehicle?.driverName || '',
      deliveredAt: plan.planDate,
      stopIds
    })

    for(const stop of deliveredStops){
      const deliveryStopId = getShipmentReturnDeliveryStopId(stop.id)
      const load = getVehicleLoad(vehicle, stop.vehicleLoadId)
      const pallet = load ? palletMap.get(load.palletId) : null

      stops.push({
        id: deliveryStopId,
        deliveryId,
        shipmentPlanId: plan.id,
        shipmentPlanStopId: stop.id,
        branchId: stop.branchId,
        vehicleLoadId: stop.vehicleLoadId,
        stopOrder: stop.stopOrder,
        deliveredAt: plan.planDate
      })

      if(!load || !pallet) continue

      for(const palletItem of pallet.items){
        lines.push({
          id: `shipment_return_delivery_line_${stop.id}_${palletItem.id}`,
          deliveryStopId,
          shipmentPlanId: plan.id,
          shipmentPlanStopId: stop.id,
          vehicleId: plan.vehicleId,
          branchId: stop.branchId,
          vehicleLoadId: stop.vehicleLoadId,
          palletId: pallet.id,
          palletItemId: palletItem.id,
          stockItemId: palletItem.stockItemId,
          inventoryLotId: palletItem.inventoryLotId,
          deliveredQuantity: roundQuantity(palletItem.quantity),
          unit: palletItem.unit
        })
      }
    }
  }

  return { deliveries, stops, lines }
}

export const getShipmentReturnLineKey = (
  item: Pick<ShipmentReturnItem, 'deliveryStopId' | 'stockItemId' | 'inventoryLotId'>
) => `${item.deliveryStopId}::${item.stockItemId}::${item.inventoryLotId}`

export const calculateShipmentReturnQuantity = (
  items: Pick<ShipmentReturnItem, 'quantity'>[]
) => roundQuantity(items.reduce((total, item) => total + item.quantity, 0))

export const getShipmentReturnDeliveredQuantity = (
  item: Pick<ShipmentReturnItem, 'deliveryStopId' | 'stockItemId' | 'inventoryLotId'>,
  deliveryLines: ShipmentReturnDeliveryLineSource[]
) => roundQuantity(deliveryLines
  .filter(line => (
    line.deliveryStopId === item.deliveryStopId
    && line.stockItemId === item.stockItemId
    && line.inventoryLotId === item.inventoryLotId
  ))
  .reduce((total, line) => total + line.deliveredQuantity, 0))

export const getShipmentReturnPriorQuantity = (
  item: Pick<ShipmentReturnItem, 'deliveryStopId' | 'stockItemId' | 'inventoryLotId'>,
  returns: ShipmentReturnRecord[],
  ignoredReturnId = ''
) => roundQuantity(returns
  .filter(record => record.id !== ignoredReturnId)
  .flatMap(record => record.items)
  .filter(returnItem => getShipmentReturnLineKey(returnItem) === getShipmentReturnLineKey(item))
  .reduce((total, returnItem) => total + returnItem.quantity, 0))

export const validateShipmentReturn = (
  record: ShipmentReturnRecord,
  deliveries: ShipmentReturnDeliverySource[] = [],
  deliveryStops: ShipmentReturnDeliveryStopSource[] = [],
  deliveryLines: ShipmentReturnDeliveryLineSource[] = [],
  returns: ShipmentReturnRecord[] = []
) => {
  if(!record.deliveryId.trim()) return 'Delivery zorunludur.'
  if(record.items.length === 0) return 'En az bir Return Item bulunmalıdır.'

  const delivery = deliveries.find(item => item.id === record.deliveryId) || null
  if(deliveries.length > 0 && !delivery) return 'Delivery kaydı bulunamadı.'

  const currentQuantityByLine = new Map<string, number>()

  for(const [index, item] of record.items.entries()){
    const rowLabel = `${index + 1}. return item`

    if(!item.deliveryStopId.trim()) return `${rowLabel} için Delivery Stop zorunludur.`
    if(!item.stockItemId.trim()) return `${rowLabel} için Stock Item zorunludur.`
    if(!item.inventoryLotId.trim()) return `${rowLabel} için Inventory Lot zorunludur.`
    if(!Number.isFinite(item.quantity) || item.quantity <= 0){
      return `${rowLabel} Quantity 0'dan büyük olmalıdır.`
    }
    if(!item.reason.trim()) return `${rowLabel} Reason zorunludur.`

    const deliveryStop = deliveryStops.find(stop => stop.id === item.deliveryStopId) || null
    if(deliveryStops.length > 0 && (!deliveryStop || deliveryStop.deliveryId !== record.deliveryId)){
      return `${rowLabel} Delivery Stop seçilen Delivery kaydına ait olmalıdır.`
    }

    const deliveredQuantity = getShipmentReturnDeliveredQuantity(item, deliveryLines)
    if(deliveryLines.length > 0 && deliveredQuantity <= 0){
      return `${rowLabel} için teslim edilmeyen ürün iade edilemez.`
    }

    const lineKey = getShipmentReturnLineKey(item)
    const currentQuantity = roundQuantity((currentQuantityByLine.get(lineKey) || 0) + item.quantity)
    currentQuantityByLine.set(lineKey, currentQuantity)

    const priorQuantity = getShipmentReturnPriorQuantity(item, returns, record.id)
    if(deliveredQuantity > 0 && roundQuantity(priorQuantity + currentQuantity) > deliveredQuantity){
      return `${rowLabel} iade miktarı teslim edilen miktarı geçemez.`
    }
  }

  return ''
}
