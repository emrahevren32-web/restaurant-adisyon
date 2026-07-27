import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import type {
  GoodsReceiptRecord,
  GoodsReceiptValidationResult
} from './goods-receipt.types'

const createResult = (errors: string[]): GoodsReceiptValidationResult => ({
  valid: errors.length === 0,
  errors
})

export const validateGoodsReceipt = (
  record: GoodsReceiptRecord,
  sourceData: KpiSourceData,
  existingRecord?: GoodsReceiptRecord
): GoodsReceiptValidationResult => {
  const errors: string[] = []

  if(!record.receiptNo.trim()) errors.push('Mal Kabul No zorunludur.')
  if(!record.purchaseOrderId.trim()) errors.push('PO zorunludur.')
  if(!record.supplierId.trim()) errors.push('Supplier zorunludur.')
  if(!record.warehouseId.trim()) errors.push('Depo zorunludur.')
  if(record.items.length === 0) errors.push('En az bir urun kalemi bulunmalidir.')
  if(existingRecord?.status === 'CANCELLED') errors.push('Iptal edilmis mal kabul tekrar duzenlenemez.')

  const purchaseOrder = sourceData.purchaseOrders.find(order => order.id === record.purchaseOrderId)
  if(!purchaseOrder) errors.push('Purchase Order kaydi bulunamadi.')
  if(purchaseOrder?.status === 'CANCELLED') errors.push('Iptal edilmis PO secilemez.')

  const supplier = sourceData.suppliers.find(item => item.id === record.supplierId)
  if(!supplier) errors.push('Supplier kaydi bulunamadi.')

  for(const [index, item] of record.items.entries()){
    const rowLabel = `${index + 1}. kalem`
    const lotId = item.lotId || ''
    const lotNo = item.lotNo || ''
    const quantity = Number(item.receivedQuantity)
    const acceptedQuantity = Number(item.acceptedQuantity)
    const rejectedQuantity = Number(item.rejectedQuantity)
    const netWeight = Number(item.netWeight || 0)
    const grossWeight = Number(item.grossWeight || 0)

    if(!item.stockItemId.trim()) errors.push(`${rowLabel} icin Urun zorunludur.`)
    if(!lotId.trim() && !lotNo.trim()) errors.push(`${rowLabel} icin Lot zorunludur.`)
    if(!Number.isFinite(quantity) || quantity < 0) errors.push(`${rowLabel} miktari negatif olamaz.`)
    if(!Number.isFinite(acceptedQuantity) || acceptedQuantity < 0) errors.push(`${rowLabel} kabul miktari negatif olamaz.`)
    if(!Number.isFinite(rejectedQuantity) || rejectedQuantity < 0) errors.push(`${rowLabel} red miktari negatif olamaz.`)
    if(!Number.isFinite(netWeight) || netWeight < 0) errors.push(`${rowLabel} net agirlik negatif olamaz.`)
    if(!Number.isFinite(grossWeight) || grossWeight < 0) errors.push(`${rowLabel} brut agirlik negatif olamaz.`)

    if(lotId && !lotId.startsWith('virtual_lot_') && !sourceData.inventoryLots.some(lot => lot.id === lotId)){
      errors.push(`${rowLabel} icin Lot kaydi bulunamadi.`)
    }
  }

  return createResult(errors)
}

export const GoodsReceiptValidationService = {
  validate: validateGoodsReceipt
}
