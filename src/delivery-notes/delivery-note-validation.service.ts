import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import type {
  DeliveryNote,
  DeliveryNoteValidationResult
} from './delivery-note.types'

const roundQuantity = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000

const createResult = (errors: string[]): DeliveryNoteValidationResult => ({
  valid: errors.length === 0,
  errors
})

export const validateDeliveryNote = (
  record: DeliveryNote,
  sourceData: KpiSourceData,
  existingRecord?: DeliveryNote
): DeliveryNoteValidationResult => {
  const errors: string[] = []

  if(existingRecord?.status === 'DELIVERED'){
    errors.push('Teslim edilmis irsaliye tekrar duzenlenemez.')
  }
  if(!record.deliveryNoteNo.trim()) errors.push('Irsaliye No zorunludur.')
  if(!record.date.trim()) errors.push('Tarih zorunludur.')
  if(!record.shipmentPlanId.trim()) errors.push('Sevkiyat Plani zorunludur.')
  if(!record.vehicleId.trim()) errors.push('Arac zorunludur.')
  if(!record.driverName.trim()) errors.push('Sofor zorunludur.')
  if(record.items.length === 0) errors.push('En az bir urun kalemi bulunmalidir.')

  const plan = sourceData.shipmentPlans.find(item => item.id === record.shipmentPlanId)
  if(plan?.status === 'CANCELLED') errors.push('Iptal edilmis sevkiyat plani secilemez.')

  const shipment = record.shipmentId
    ? sourceData.shipments.find(item => item.id === record.shipmentId)
    : null
  if(shipment?.status === 'CANCELLED') errors.push('Iptal edilmis sevkiyat secilemez.')

  const noteShipmentIds = new Set(record.items.map(item => item.shipmentId).filter(Boolean))
  sourceData.shipments
    .filter(item => noteShipmentIds.has(item.id) && item.status === 'CANCELLED')
    .forEach(item => errors.push(`${item.shipmentNo} iptal edilmis sevkiyat oldugu icin irsaliyeye eklenemez.`))

  const quantityByLot = new Map<string, number>()

  for(const [index, item] of record.items.entries()){
    const rowLabel = `${index + 1}. kalem`

    if(!item.lotId.trim()) errors.push(`${rowLabel} icin Lot zorunludur.`)
    if(!item.productName.trim() && !item.stockItemName.trim()) errors.push(`${rowLabel} icin Urun zorunludur.`)
    if(!Number.isFinite(item.quantity) || item.quantity <= 0) errors.push(`${rowLabel} miktari 0'dan buyuk olmalidir.`)
    if(!Number.isFinite(item.boxCount) || item.boxCount < 0) errors.push(`${rowLabel} koli negatif olamaz.`)
    if(!Number.isFinite(item.palletCount) || item.palletCount < 0) errors.push(`${rowLabel} palet negatif olamaz.`)
    if(!Number.isFinite(item.netWeight) || item.netWeight < 0) errors.push(`${rowLabel} net agirlik negatif olamaz.`)
    if(!Number.isFinite(item.grossWeight) || item.grossWeight < 0) errors.push(`${rowLabel} brut agirlik negatif olamaz.`)

    const lot = sourceData.inventoryLots.find(sourceLot => sourceLot.id === item.lotId)
    if(!lot){
      errors.push(`${rowLabel} icin Lot kaydi bulunamadi.`)
      continue
    }

    const nextQuantity = roundQuantity((quantityByLot.get(lot.id) || 0) + item.quantity)
    quantityByLot.set(lot.id, nextQuantity)
    const availableQuantity = Number.isFinite(lot.remainingQuantity) ? lot.remainingQuantity : lot.quantity
    if(nextQuantity > availableQuantity){
      errors.push(`${rowLabel} miktari ${lot.lotNo} kalan stok miktarini asiyor.`)
    }
  }

  return createResult(errors)
}

export const DeliveryNoteValidationService = {
  validate: validateDeliveryNote
}
