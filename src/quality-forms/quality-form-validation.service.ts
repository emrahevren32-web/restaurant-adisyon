import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import type {
  QualityForm,
  QualityFormValidationResult
} from './quality-form.types'

const isCancelledSourceRecord = (
  form: QualityForm,
  sourceData: KpiSourceData
) => {
  if(form.goodsReceiptId){
    const receipt = sourceData.goodsReceipts.find(record => record.id === form.goodsReceiptId)
    if(receipt?.status === 'CANCELLED') return true
  }

  if(form.productionOrderId){
    const order = sourceData.productionOrders.find(record => record.id === form.productionOrderId)
    if(String(order?.status || '').toLocaleLowerCase('tr-TR').includes('iptal')) return true
  }

  return false
}

export const validateQualityForm = (
  form: QualityForm,
  sourceData: KpiSourceData
): QualityFormValidationResult => {
  const errors: string[] = []
  const lot = sourceData.inventoryLots.find(record => record.id === form.lotId)

  if(!form.formNo.trim()) errors.push('Form No zorunludur.')
  if(!form.lotId.trim()) errors.push('Lot zorunludur.')
  if(!lot) errors.push('Gecersiz Lot secilemez.')
  if(!form.productId.trim() && !form.stockItemId.trim()) errors.push('Urun zorunludur.')
  if(!form.productName.trim() && !form.stockItemName.trim()) errors.push('Urun adi zorunludur.')
  if(!form.inspector.trim()) errors.push('Kontrol personeli zorunludur.')
  if(!form.inspectionDate.trim()) errors.push('Kontrol tarihi zorunludur.')
  if(lot?.status === 'DISPOSED' || lot?.status === 'RETURNED') errors.push('Kapanmis veya iade edilmis lot secilemez.')
  if(isCancelledSourceRecord(form, sourceData)) errors.push('Iptal edilmis kaynak kayit secilemez.')

  const requiredInspections = form.inspections.filter(inspection => inspection.status !== 'NOT_APPLICABLE')
  if(requiredInspections.length === 0) errors.push('En az bir kontrol kriteri doldurulmalidir.')

  return {
    valid: errors.length === 0,
    errors
  }
}

export const QualityFormValidationService = {
  validate: validateQualityForm
}
