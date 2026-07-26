import type { Branch, StockItem } from '../types'
import type { Supplier } from '../supplier-management/supplier-management.types'
import type {
  PurchaseRequestPriority,
  PurchaseRequestRecord,
  PurchaseRequestSource,
  PurchaseRequestStatus
} from './purchase-request.types'

export type PurchaseRequestValidationItem = {
  stockItemId: string
  requestedQuantity: number
  estimatedUnitPrice: number
  suggestedSupplierId?: string
}

export type PurchaseRequestValidationPayload = {
  title: string
  requester: string
  department: string
  branchId: string
  warehouseId: string
  source: PurchaseRequestSource
  priority: PurchaseRequestPriority
  items: PurchaseRequestValidationItem[]
}

export type PurchaseRequestValidationResult = {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export const OPEN_PURCHASE_REQUEST_STATUSES: PurchaseRequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED'
]

const normalizeText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const isSupplierActiveForSuggestion = (supplier: Supplier) => (
  supplier.status === 'ACTIVE'
  && supplier.approvalStatus === 'APPROVED'
  && supplier.workingStatus !== 'STOPPED'
  && supplier.workingStatus !== 'ON_HOLD'
)

export const isOpenPurchaseRequestStatus = (status: PurchaseRequestStatus) => (
  OPEN_PURCHASE_REQUEST_STATUSES.includes(status)
)

export const getOpenRequestNosForStockItem = (
  records: PurchaseRequestRecord[],
  stockItemId: string,
  excludedRequestId = ''
) => records
  .filter(record => (
    record.id !== excludedRequestId
    && isOpenPurchaseRequestStatus(record.status)
    && record.items.some(item => item.stockItemId === stockItemId)
  ))
  .map(record => record.requestNo)

export const validatePurchaseRequestPayload = (
  payload: PurchaseRequestValidationPayload,
  records: PurchaseRequestRecord[],
  stockItems: StockItem[],
  branches: Branch[],
  suppliers: Supplier[],
  excludedRequestId = ''
): PurchaseRequestValidationResult => {
  const errors: string[] = []
  const warnings: string[] = []
  const activeBranchIds = new Set(branches.filter(branch => branch.isActive).map(branch => branch.id))
  const stockItemMap = new Map(stockItems.map(item => [item.id, item]))
  const supplierMap = new Map(suppliers.map(supplier => [supplier.id, supplier]))

  if(!payload.title.trim()) errors.push('Talep başlığı zorunludur.')
  if(!payload.requester.trim()) errors.push('Talebi oluşturan zorunludur.')
  if(!payload.department) errors.push('Departman zorunludur.')
  if(!payload.source) errors.push('Talep kaynağı zorunludur.')
  if(!payload.priority) errors.push('Öncelik zorunludur.')
  if(!payload.branchId || !activeBranchIds.has(payload.branchId)){
    errors.push('Pasif veya geçersiz şube seçilemez.')
  }
  if(!payload.warehouseId || !activeBranchIds.has(payload.warehouseId)){
    errors.push('Pasif veya geçersiz depo seçilemez.')
  }
  if(payload.items.length === 0) errors.push('En az 1 talep kalemi bulunmalıdır.')

  payload.items.forEach((item, index) => {
    const rowNo = index + 1
    const stockItem = stockItemMap.get(item.stockItemId)
    const supplier = item.suggestedSupplierId ? supplierMap.get(item.suggestedSupplierId) : undefined

    if(!stockItem){
      errors.push(`${rowNo}. kalemde ürün seçimi zorunludur.`)
      return
    }

    if(!stockItem.active){
      errors.push(`${rowNo}. kalemde pasif ürün seçilemez.`)
    }

    if(!Number.isFinite(item.requestedQuantity) || item.requestedQuantity <= 0){
      errors.push(`${rowNo}. kalemde istenen miktar 0'dan büyük olmalıdır.`)
    }

    if(!Number.isFinite(item.estimatedUnitPrice) || item.estimatedUnitPrice < 0){
      errors.push(`${rowNo}. kalemde tahmini birim fiyat negatif olamaz.`)
    }

    if(supplier && !isSupplierActiveForSuggestion(supplier)){
      errors.push(`${rowNo}. kalemde pasif veya onaysız supplier önerilemez.`)
    }

    const openRequestNos = getOpenRequestNosForStockItem(records, item.stockItemId, excludedRequestId)
    if(openRequestNos.length > 0){
      warnings.push(`${stockItem.name} için açık Purchase Request var: ${openRequestNos.join(', ')}.`)
    }
  })

  const duplicateStockNames = payload.items.reduce<Record<string, number>>((acc, item) => {
    const stockItem = stockItemMap.get(item.stockItemId)
    if(!stockItem) return acc
    const key = normalizeText(stockItem.name)
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  Object.entries(duplicateStockNames).forEach(([name, count]) => {
    if(count > 1) warnings.push(`Aynı ürün bu talep içinde ${count} kez eklendi: ${name}.`)
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}
