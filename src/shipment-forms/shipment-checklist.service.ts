import type {
  ShipmentChecklist,
  ShipmentChecklistKey,
  ShipmentChecklistStatus,
  ShipmentFormTemplate,
  ShipmentTemperatureLog,
  ShipmentTemperatureStage
} from './shipment-form.types'

export const SHIPMENT_CHECKLIST_LABELS: Record<ShipmentChecklistKey, string> = {
  VEHICLE_CLEANING: 'Arac Temizligi',
  VEHICLE_DOCUMENTS: 'Arac Evraklari',
  FUEL_CHECK: 'Yakit Kontrolu',
  COOLING_SYSTEM: 'Sogutucu Sistemi',
  DOOR_LOCK: 'Kapi Kilidi',
  PRODUCT_PLACEMENT: 'Urun Yerlesimi',
  PALLET_FIXING: 'Palet Sabitleme',
  LABEL_VERIFICATION: 'Etiket Dogrulama',
  LOT_VERIFICATION: 'Lot Dogrulama',
  DELIVERY_NOTE_VERIFICATION: 'Irsaliye Dogrulama',
  DELIVERY_SIGNATURE: 'Teslim Imzasi'
}

export const SHIPMENT_TEMPERATURE_STAGE_LABELS: Record<ShipmentTemperatureStage, string> = {
  START: 'Baslangic',
  AFTER_LOADING: 'Yukleme Sonrasi',
  DEPARTURE: 'Yol Cikisi',
  DELIVERY: 'Teslim Ani'
}

export const createShipmentChecklist = (
  formId: string,
  template: ShipmentFormTemplate,
  status: ShipmentChecklistStatus = 'PASS'
): ShipmentChecklist[] => template.checklist.map(item => ({
  id: `${formId}_checklist_${item.checklistKey.toLocaleLowerCase('tr-TR')}`,
  formId,
  checklistKey: item.checklistKey,
  label: item.label,
  description: item.description,
  status,
  notes: '',
  required: item.required
}))

export const createShipmentTemperatureLogs = (
  formId: string,
  baseDate: string,
  seed = 0,
  refrigerated = true
): ShipmentTemperatureLog[] => {
  const baseHour = 7 + (seed % 4)
  const stages: ShipmentTemperatureStage[] = ['START', 'AFTER_LOADING', 'DEPARTURE', 'DELIVERY']
  const baseTemperature = refrigerated ? 3.2 + (seed % 3) * 0.4 : 18 + (seed % 5)

  return stages.map((stage, index) => {
    const temperatureC = Math.round((baseTemperature + index * (refrigerated ? 0.35 : 0.9) + Number.EPSILON) * 10) / 10
    const result: ShipmentChecklistStatus = refrigerated && temperatureC > 6
      ? 'WARNING'
      : 'PASS'

    return {
      id: `${formId}_temperature_${stage.toLocaleLowerCase('tr-TR')}`,
      formId,
      stage,
      label: SHIPMENT_TEMPERATURE_STAGE_LABELS[stage],
      temperatureC,
      loggedAt: `${baseDate}T${String(baseHour + index).padStart(2, '0')}:00:00.000Z`,
      result,
      notes: result === 'WARNING' ? 'Sicaklik sapmasi takip edilmeli.' : 'Limit ici.'
    }
  })
}

export const ShipmentChecklistService = {
  createChecklist: createShipmentChecklist,
  createTemperatureLogs: createShipmentTemperatureLogs
}
