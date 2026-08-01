import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { ProductionWorkOrder } from '../production-work-orders/production-work-order.types'
import type { ShipmentPlanRecord } from '../shipment-plans/shipment-plan.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'

export const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

export const getDateKey = (value: string) => {
  if(!value) return ''
  if(/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

export const getDaysBetween = (startValue: string, endValue: string) => {
  const start = new Date(startValue)
  const end = new Date(endValue)
  if(Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

export const getDaysUntil = (dateValue: string) => getDaysBetween(getTodayKey(), dateValue)

export const getAgeDays = (dateValue: string) => Math.max(0, getDaysBetween(getDateKey(dateValue), getTodayKey()))

const getStatusKey = (status: string) => String(status || '').toLocaleLowerCase('tr-TR')

export const isCompletedProductionOrder = (order: ProductionWorkOrder) => getStatusKey(order.status).includes('tamam')
export const isCancelledProductionOrder = (order: ProductionWorkOrder) => getStatusKey(order.status).includes('iptal')

export const isActiveShipmentPlan = (plan: ShipmentPlanRecord) => (
  plan.status === 'PLANNED'
  || plan.status === 'READY'
  || plan.status === 'DEPARTED'
  || plan.status === 'IN_PROGRESS'
)

export const getLotProductId = (lot: InventoryLot | null) => lot?.productId || lot?.stockItemId || ''

export const getProductLabel = (
  sourceData: KpiSourceData,
  productId: string
) => (
  sourceData.productRefs.find(product => product.id === productId)?.name
  || sourceData.stockItems.find(item => item.id === productId)?.name
  || productId
  || 'Urun'
)

export const getWarehouseName = (
  sourceData: KpiSourceData,
  warehouseId: string
) => sourceData.branches.find(branch => branch.id === warehouseId)?.name || warehouseId || 'Depo'

export const getSupplierName = (
  sourceData: KpiSourceData,
  supplierId: string
) => sourceData.suppliers.find(supplier => supplier.id === supplierId)?.name || supplierId || 'Tedarikçi'
