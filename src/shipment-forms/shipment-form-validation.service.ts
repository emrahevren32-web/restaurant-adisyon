import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import type {
  ShipmentForm,
  ShipmentFormValidationResult
} from './shipment-form.types'

export const validateShipmentForm = (
  form: ShipmentForm,
  sourceData: KpiSourceData
): ShipmentFormValidationResult => {
  const errors: string[] = []
  const shipment = sourceData.shipments.find(record => record.id === form.shipmentId)
  const deliveryNoteExists = Boolean(form.deliveryNoteId)
  const vehicle = sourceData.shipmentVehicles.find(record => record.id === form.vehicleId)
  const hasLot = form.items.some(item => item.lotId && item.lotNo)

  if(!form.formNo.trim()) errors.push('Form No zorunludur.')
  if(!form.shipmentId.trim()) errors.push('Shipment zorunludur.')
  if(!deliveryNoteExists) errors.push('Delivery Note zorunludur.')
  if(!form.vehicleId.trim() || !vehicle) errors.push('Vehicle zorunludur.')
  if(!form.driverName.trim()) errors.push('Driver zorunludur.')
  if(!hasLot) errors.push('Lot zorunludur.')
  if(shipment?.status === 'CANCELLED') errors.push('Iptal edilmis sevkiyat secilemez.')
  if(form.status !== 'CANCELLED' && form.checklist.some(item => item.required && item.status === 'FAIL')){
    errors.push('Zorunlu checklist kriterlerinde FAIL varken form ilerletilemez.')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

export const ShipmentFormValidationService = {
  validate: validateShipmentForm
}
