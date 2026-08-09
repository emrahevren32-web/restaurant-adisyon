import { BarcodeIntegrationService } from '../barcode-engine/barcode-integration.service'
import { getLabelTemplate } from './label-template.service'
import type {
  Label,
  LabelValidationResult
} from './label.types'

const createResult = (errors: string[]): LabelValidationResult => ({
  valid: errors.length === 0,
  errors
})

export const validateLabel = (
  label: Label,
  existingLabels: Label[] = []
): LabelValidationResult => {
  const errors: string[] = []

  if(!label.labelNo.trim()) errors.push('Etiket No zorunludur.')
  if(!label.productName.trim()) errors.push('Urun Adi zorunludur.')
  if(!label.productCode.trim()) errors.push('Urun Kodu zorunludur.')
  if(!label.lotNo.trim() && label.labelType !== 'WAREHOUSE_SHELF') errors.push('Lot No zorunludur.')
  if(!label.batchNo.trim() && label.labelType !== 'WAREHOUSE_SHELF') errors.push('Batch No zorunludur.')
  if(!label.productionDate.trim()) errors.push('Uretim Tarihi zorunludur.')
  if(!label.expiryDate.trim() && label.labelType !== 'WAREHOUSE_SHELF') errors.push('SKT zorunludur.')
  if(label.productionDate && label.expiryDate && label.expiryDate < label.productionDate){
    errors.push('SKT uretim tarihinden once olamaz.')
  }
  if(!label.warehouseId.trim()) errors.push('Depo zorunludur.')
  if(!label.branchId.trim()) errors.push('Sube zorunludur.')
  if(!label.productionOrderNo.trim() && label.labelType !== 'WAREHOUSE_SHELF') errors.push('Uretim Emri zorunludur.')
  if(!label.recipeName.trim() && ['PRODUCT', 'LOT', 'BOX', 'PALLET', 'BLAST_CHILLING'].includes(label.labelType)){
    errors.push('Recete zorunludur.')
  }
  if(!label.templateId.trim()) errors.push('Etiket sablonu zorunludur.')
  if(!getLabelTemplate(label.templateId).supportedTypes.includes(label.labelType)){
    errors.push('Secilen sablon etiket turunu desteklemiyor.')
  }
  if(!label.barcodeValue.trim()) errors.push('Code-128 barkod degeri zorunludur.')
  const barcodeValidation = BarcodeIntegrationService.validateValue(label.barcodeValue, 'CODE128')
  if(label.barcodeValue.trim() && !barcodeValidation.valid) errors.push(...barcodeValidation.errors)
  if(!label.qrPayload.trim()) errors.push('QR payload zorunludur.')
  if(!Number.isFinite(label.netWeight) || label.netWeight < 0) errors.push('Net agirlik negatif olamaz.')
  if(!Number.isFinite(label.grossWeight) || label.grossWeight < 0) errors.push('Brut agirlik negatif olamaz.')
  if(label.grossWeight > 0 && label.netWeight > label.grossWeight){
    errors.push('Net agirlik brut agirligi asamaz.')
  }

  const normalizedLabelNo = label.labelNo.trim().toLocaleLowerCase('tr-TR')
  const normalizedBarcode = label.barcodeValue.trim().toLocaleLowerCase('tr-TR')
  const duplicateLabel = existingLabels.find(item => (
    item.id !== label.id
    && item.labelNo.trim().toLocaleLowerCase('tr-TR') === normalizedLabelNo
  ))
  const duplicateBarcode = existingLabels.find(item => (
    item.id !== label.id
    && item.barcodeValue.trim().toLocaleLowerCase('tr-TR') === normalizedBarcode
  ))

  if(duplicateLabel) errors.push('Bu Etiket No zaten kullaniliyor.')
  if(duplicateBarcode) errors.push('Bu Code-128 barkod degeri zaten kullaniliyor.')

  return createResult(errors)
}

export const validatePrintQuantity = (quantity: number): LabelValidationResult => {
  const errors: string[] = []
  if(!Number.isFinite(quantity) || quantity <= 0) errors.push('Yazdirma adedi 0dan buyuk olmalidir.')
  if(quantity > 500) errors.push('Tek islemde en fazla 500 etiket yazdirilabilir.')
  return createResult(errors)
}

export const LabelValidationService = {
  validate: validateLabel,
  validatePrintQuantity
}
