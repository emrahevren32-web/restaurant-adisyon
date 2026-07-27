import {
  KPI_COLORS,
  createBarRows,
  createTrend,
  percent
} from '../kpi-reporting/kpi.utils'
import type {
  ShipmentForm,
  ShipmentStatistics
} from './shipment-form.types'

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const activeForms = (
  forms: ShipmentForm[]
) => forms.filter(form => form.status !== 'CANCELLED')

const createGroupedRows = (
  forms: ShipmentForm[],
  getKey: (form: ShipmentForm) => string,
  getLabel: (form: ShipmentForm) => string
) => createBarRows(
  Array.from(forms.reduce<Map<string, { label: string; count: number; returned: number }>>((map, form) => {
    const key = getKey(form)
    if(!key) return map
    const current = map.get(key) || { label: getLabel(form), count: 0, returned: 0 }
    map.set(key, {
      label: current.label,
      count: current.count + 1,
      returned: current.returned + (form.status === 'RETURNED' ? 1 : 0)
    })
    return map
  }, new Map()).entries())
    .map(([id, row]) => ({
      id,
      label: row.label,
      value: row.count,
      detail: `${row.returned} iade / ${percent(row.returned, row.count).toLocaleString('tr-TR')}%`
    })),
  8
)

export const createShipmentFormStatistics = (
  forms: ShipmentForm[]
): ShipmentStatistics => {
  const usableForms = activeForms(forms)
  const delivered = usableForms.filter(form => form.status === 'DELIVERED').length
  const returned = usableForms.filter(form => form.status === 'RETURNED').length
  const loaded = usableForms.filter(form => form.status === 'LOADING' || form.status === 'ON_ROUTE').length
  const pending = usableForms.filter(form => form.status === 'DRAFT' || form.status === 'PREPARING').length

  return {
    todayShipments: usableForms.filter(form => form.loadingDate === todayKey()).length,
    loaded,
    delivered,
    returned,
    pending,
    totalShipments: usableForms.length,
    totalDeliveries: delivered + returned,
    deliverySuccessRate: percent(delivered, delivered + returned),
    returnRate: percent(returned, delivered + returned),
    vehicleRows: createGroupedRows(usableForms, form => form.vehicleId, form => `${form.vehicleNo} ${form.vehiclePlate}`.trim()),
    driverRows: createGroupedRows(usableForms, form => form.driverName, form => form.driverName),
    branchRows: createGroupedRows(usableForms, form => form.branchId, form => form.branchName),
    statusRows: createGroupedRows(usableForms, form => form.status, form => form.status),
    monthlyTrend: createTrend(
      usableForms,
      'YEAR',
      form => form.loadingDate,
      () => 1,
      'Aylik Sevkiyat Form Trendi',
      KPI_COLORS[5]
    )
  }
}

export const ShipmentFormStatisticsService = {
  create: createShipmentFormStatistics
}
