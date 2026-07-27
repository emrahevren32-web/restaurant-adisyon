import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import type {
  WasteRecord,
  WasteValidationResult
} from './waste.types'

const createResult = (errors: string[]): WasteValidationResult => ({
  valid: errors.length === 0,
  errors
})

export const validateWasteRecord = (
  record: WasteRecord,
  sourceData: KpiSourceData
): WasteValidationResult => {
  const errors: string[] = []

  if(!record.wasteNo.trim()) errors.push('Fire No zorunludur.')
  if(!record.productId.trim() && !record.stockItemId.trim()) errors.push('Urun zorunludur.')
  if(!record.productName.trim() && !record.stockItemName.trim()) errors.push('Urun adi zorunludur.')
  if(!record.lotId.trim() && !record.lotNo.trim()) errors.push('Lot zorunludur.')
  if(!Number.isFinite(record.quantity) || record.quantity < 0) errors.push('Negatif miktar olamaz.')
  if(!record.date.trim()) errors.push('Tarih zorunludur.')

  const lot = record.lotId
    ? sourceData.inventoryLots.find(item => item.id === record.lotId)
    : null

  if(record.lotId && !record.lotId.startsWith('virtual_waste_lot_') && !lot){
    errors.push('Lot kaydi bulunamadi.')
  }
  if(lot?.status === 'DISPOSED' || lot?.status === 'BLOCKED'){
    errors.push('Iptal edilmis veya blokajdaki Lot secilemez.')
  }

  record.items.forEach((item, index) => {
    const rowLabel = `${index + 1}. kalem`
    if(!item.productId.trim() && !item.stockItemId.trim()) errors.push(`${rowLabel} icin Urun zorunludur.`)
    if(!item.lotId.trim() && !item.lotNo.trim()) errors.push(`${rowLabel} icin Lot zorunludur.`)
    if(!Number.isFinite(item.quantity) || item.quantity < 0) errors.push(`${rowLabel} miktari negatif olamaz.`)
  })

  return createResult(errors)
}

export const WasteValidationService = {
  validate: validateWasteRecord
}
