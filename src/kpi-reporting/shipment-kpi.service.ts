import type { ShipmentPalletRecord } from '../shipment-pallets/shipment-pallet.types'
import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
import type { ShipmentVehicleRecord } from '../shipment-vehicles/shipment-vehicle.types'
import type { KpiFilters, KpiSourceData, ShipmentKpiView } from './kpi.types'
import {
  ALL_FILTER,
  KPI_COLORS,
  averageBy,
  createBarRows,
  createCard,
  createPieSlices,
  createTrend,
  formatNumber,
  formatPercent,
  matchesOptionalFilter,
  matchesPeriod,
  percent
} from './kpi.utils'

const ACTIVE_SHIPMENT_PLAN_STATUSES = ['PLANNED', 'READY', 'DEPARTED', 'IN_PROGRESS']
const COMPLETED_SHIPMENT_PLAN_STATUS = 'COMPLETED'

const getPalletForLoad = (
  vehicle: ShipmentVehicleRecord,
  palletMap: Map<string, ShipmentPalletRecord>
) => vehicle.loads.map(load => palletMap.get(load.palletId)).filter(Boolean) as ShipmentPalletRecord[]

const planHasProductOrLot = (
  plan: ShipmentPlanRecord,
  sourceData: KpiSourceData,
  filters: KpiFilters
) => {
  if(filters.productId === ALL_FILTER && filters.lotId === ALL_FILTER && filters.warehouseId === ALL_FILTER) return true

  const vehicle = sourceData.shipmentVehicles.find(record => record.id === plan.vehicleId)
  if(!vehicle) return false
  const palletMap = new Map(sourceData.shipmentPallets.map(record => [record.id, record]))
  const pallets = getPalletForLoad(vehicle, palletMap)

  return pallets.some(pallet => (
    matchesOptionalFilter(filters.warehouseId, pallet.warehouseId)
    && pallet.items.some(item => (
      matchesOptionalFilter(filters.lotId, item.inventoryLotId)
      && (filters.productId === ALL_FILTER || item.stockItemId === filters.productId)
    ))
  ))
}

const matchesShipmentPlanFilters = (
  plan: ShipmentPlanRecord,
  sourceData: KpiSourceData,
  filters: KpiFilters
) => (
  matchesPeriod(plan.planDate || plan.createdAt, filters.period)
  && (filters.branchId === ALL_FILTER || plan.stops.some(stop => stop.branchId === filters.branchId))
  && (filters.operator === ALL_FILTER || plan.driverName === filters.operator)
  && planHasProductOrLot(plan, sourceData, filters)
)

const getVehicleUtilization = (vehicle: ShipmentVehicleRecord) => (
  vehicle.maxWeight > 0 ? percent(vehicle.currentWeight, vehicle.maxWeight) : 0
)

export const createShipmentKpiView = (
  sourceData: KpiSourceData,
  filters: KpiFilters
): ShipmentKpiView => {
  const filteredPlans = sourceData.shipmentPlans.filter(plan => matchesShipmentPlanFilters(plan, sourceData, filters))
  const todayKey = new Date().toLocaleDateString('sv-SE')
  const todayShipments = sourceData.shipmentPlans.filter(plan => plan.planDate === todayKey)
  const pendingShipments = filteredPlans.filter(plan => ACTIVE_SHIPMENT_PLAN_STATUSES.includes(plan.status))
  const completedShipments = filteredPlans.filter(plan => plan.status === COMPLETED_SHIPMENT_PLAN_STATUS)
  const filteredVehicles = sourceData.shipmentVehicles.filter(vehicle => (
    filters.operator === ALL_FILTER || vehicle.driverName === filters.operator
  ))
  const averageVehicleUtilization = averageBy(filteredVehicles, getVehicleUtilization)
  const filteredPallets = sourceData.shipmentPallets.filter(pallet => (
    matchesOptionalFilter(filters.warehouseId, pallet.warehouseId)
    && pallet.items.some(item => (
      matchesOptionalFilter(filters.lotId, item.inventoryLotId)
      && (filters.productId === ALL_FILTER || item.stockItemId === filters.productId)
    ))
  ))
  const filteredReturns = sourceData.shipmentReturns.filter(record => (
    matchesPeriod(record.returnDate || record.createdAt, filters.period)
    && matchesOptionalFilter(filters.operator, record.driverName)
  ))
  const allStops = filteredPlans.flatMap(plan => plan.stops)
  const deliveredStops = allStops.filter(stop => stop.status === 'DELIVERED')
  const onTimeDeliveryRate = percent(deliveredStops.length, allStops.length)
  const statusBuckets = new Map<string, number>()

  filteredPlans.forEach(plan => {
    statusBuckets.set(plan.status, (statusBuckets.get(plan.status) || 0) + 1)
  })

  return {
    cards: [
      createCard('shipment-today', 'Bugunku Sevkiyat', formatNumber(todayShipments.length), 'Plan date bugun olan sevkiyatlar', 'neutral'),
      createCard('shipment-pending', 'Bekleyen Sevkiyat', formatNumber(pendingShipments.length), 'Aktif plan durumlari', pendingShipments.length > 0 ? 'warning' : 'success'),
      createCard('shipment-completed', 'Tamamlanan Sevkiyat', formatNumber(completedShipments.length), 'COMPLETED shipment plan', 'success'),
      createCard('shipment-utilization', 'Arac Doluluk', formatPercent(averageVehicleUtilization), 'Ortalama current/max weight', averageVehicleUtilization > 90 ? 'warning' : 'success'),
      createCard('shipment-pallets', 'Palet Sayisi', formatNumber(filteredPallets.length), 'Shipment Pallet kayitlari', 'neutral'),
      createCard('shipment-returns', 'Iade Sayisi', formatNumber(filteredReturns.length), 'Shipment Return kayitlari', filteredReturns.length > 0 ? 'warning' : 'success'),
      createCard('shipment-on-time', 'Zamaninda Teslim %', formatPercent(onTimeDeliveryRate), 'Delivered stop / total stop', onTimeDeliveryRate >= 85 ? 'success' : 'warning')
    ],
    shipmentTrend: createTrend(
      filteredPlans,
      filters.period,
      plan => plan.planDate || plan.createdAt,
      () => 1,
      'Shipment Trend',
      KPI_COLORS[1]
    ),
    vehicleUtilization: createBarRows(
      filteredVehicles.map(vehicle => ({
        id: vehicle.id,
        label: `${vehicle.vehicleNo} ${vehicle.plateNumber}`,
        value: getVehicleUtilization(vehicle),
        detail: `${formatNumber(vehicle.currentWeight, 1)} / ${formatNumber(vehicle.maxWeight, 1)} kg`,
        tone: getVehicleUtilization(vehicle) > 90 ? 'warning' as const : 'success' as const
      })),
      8,
      '%'
    ),
    shipmentStatus: createPieSlices(
      Array.from(statusBuckets.entries()).map(([label, value]) => ({ id: label, label, value }))
    )
  }
}
