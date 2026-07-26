import type { StockItem, User } from '../types'
import {
  loadBranches,
  loadStockCategories,
  loadStockItems,
  loadStockWasteRecords
} from '../storage'
import { loadProductionWorkOrders } from '../production-work-orders/production-work-order.mock'
import { loadRecipeManagementRecords } from '../recipe-management/recipe-management.mock'
import { loadSupplierManagementRecords } from '../supplier-management/supplier-management.mock'
import { loadSupplierProductRecords } from '../supplier-management/supplier-product-mapping.mock'
import {
  getNextPurchaseRequestNo,
  loadPurchaseRequestRecords,
  savePurchaseRequestRecords
} from './purchase-request.mock'
import type {
  PurchaseRequestActionLog,
  PurchaseRequestHistoryEvent,
  PurchaseRequestItem,
  PurchaseRequestPriority,
  PurchaseRequestReadModelContext,
  PurchaseRequestRecord,
  PurchaseRequestSource,
  PurchaseRequestStatus,
  PurchaseRequestSuggestion
} from './purchase-request.types'
import {
  createPurchaseRequestActionLog,
  createPurchaseRequestHistoryEvent
} from './purchase-request-workflow.service'
import {
  validatePurchaseRequestPayload,
  type PurchaseRequestValidationResult
} from './purchase-request-validation.service'

export type PurchaseRequestInputItem = {
  id?: string
  stockItemId: string
  requestedQuantity: number
  estimatedUnitPrice: number
  suggestedSupplierId?: string
  source?: PurchaseRequestSource
  notes: string
}

export type PurchaseRequestInput = {
  id?: string
  requestNo?: string
  title: string
  description: string
  requestDate: string
  requiredDate: string
  requester: string
  department: PurchaseRequestRecord['department']
  warehouseId: string
  branchId: string
  source: PurchaseRequestSource
  priority: PurchaseRequestPriority
  status?: PurchaseRequestStatus
  notes: string
  items: PurchaseRequestInputItem[]
}

export type PurchaseRequestSaveResult = {
  record: PurchaseRequestRecord
  validation: PurchaseRequestValidationResult
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const getUserName = (user: User) => user.fullName || user.username

const getStockItem = (
  stockItemId: string,
  stockItems: StockItem[]
) => stockItems.find(item => item.id === stockItemId)

export const getPurchaseRequestReadModelContext = (): PurchaseRequestReadModelContext => {
  const stockItems = loadStockItems()
  const stockCategories = loadStockCategories()
  const branches = loadBranches()
  const suppliers = loadSupplierManagementRecords()
  const supplierProducts = loadSupplierProductRecords(suppliers, stockItems)

  return {
    stockItems,
    stockCategories,
    branches,
    suppliers,
    supplierProducts,
    productionWorkOrders: loadProductionWorkOrders(),
    recipes: loadRecipeManagementRecords(),
    stockWasteRecords: loadStockWasteRecords()
  }
}

export const loadPurchaseRequestServiceData = () => {
  const context = getPurchaseRequestReadModelContext()
  const records = loadPurchaseRequestRecords(context.stockItems, context.branches, context.stockCategories)

  return { context, records }
}

const createRecordItem = (
  input: PurchaseRequestInputItem,
  requestId: string,
  index: number,
  source: PurchaseRequestSource,
  stockItems: StockItem[]
): PurchaseRequestItem => {
  const stockItem = getStockItem(input.stockItemId, stockItems)
  const requestedQuantity = Number(input.requestedQuantity)
  const estimatedUnitPrice = Number(input.estimatedUnitPrice)
  const quantity = Number.isFinite(requestedQuantity) ? requestedQuantity : 0
  const unitPrice = Number.isFinite(estimatedUnitPrice) ? estimatedUnitPrice : 0

  return {
    id: input.id || `${requestId}_item_${String(index + 1).padStart(2, '0')}`,
    requestId,
    stockItemId: input.stockItemId,
    categoryId: stockItem?.categoryId || '',
    requestedQuantity: quantity,
    quantity,
    unit: stockItem?.unit || 'adet',
    currentStock: stockItem?.currentQty || 0,
    minimumStock: stockItem?.minQty || 0,
    estimatedUnitPrice: unitPrice,
    estimatedTotalPrice: roundMoney(quantity * unitPrice),
    suggestedSupplierId: input.suggestedSupplierId || undefined,
    source: input.source || source,
    notes: input.notes.trim()
  }
}

const createBaseHistory = (
  previousRecord: PurchaseRequestRecord | undefined,
  actorName: string,
  now: string
): PurchaseRequestHistoryEvent[] => {
  if(previousRecord){
    return [
      createPurchaseRequestHistoryEvent('UPDATED', `${previousRecord.requestNo} güncellendi.`, actorName, now),
      ...(previousRecord.history || [])
    ]
  }

  return [
    createPurchaseRequestHistoryEvent('CREATED', 'Purchase Request kaydı oluşturuldu.', actorName, now)
  ]
}

const createBaseActionLogs = (
  previousRecord: PurchaseRequestRecord | undefined,
  actorName: string,
  now: string
): PurchaseRequestActionLog[] => {
  if(previousRecord){
    return [
      createPurchaseRequestActionLog('UPDATE', `${previousRecord.requestNo} güncellendi.`, actorName, now),
      ...(previousRecord.actionLogs || [])
    ]
  }

  return [
    createPurchaseRequestActionLog('CREATE', 'Purchase Request kaydı oluşturuldu.', actorName, now),
    createPurchaseRequestActionLog('VALIDATION', 'Pasif ürün, pasif depo ve pasif supplier kontrolleri çalıştırıldı.', 'Sistem', now)
  ]
}

export const createPurchaseRequestRecordFromInput = (
  input: PurchaseRequestInput,
  records: PurchaseRequestRecord[],
  context: PurchaseRequestReadModelContext,
  actorName: string,
  previousRecord?: PurchaseRequestRecord
): PurchaseRequestSaveResult => {
  const validation = validatePurchaseRequestPayload({
    title: input.title,
    requester: input.requester,
    department: input.department,
    branchId: input.branchId,
    warehouseId: input.warehouseId,
    source: input.source,
    priority: input.priority,
    items: input.items.map(item => ({
      stockItemId: item.stockItemId,
      requestedQuantity: item.requestedQuantity,
      estimatedUnitPrice: item.estimatedUnitPrice,
      suggestedSupplierId: item.suggestedSupplierId
    }))
  }, records, context.stockItems, context.branches, context.suppliers, previousRecord?.id)

  if(!validation.valid){
    throw new Error(validation.errors.join('\n'))
  }

  const now = new Date().toISOString()
  const requestId = previousRecord?.id || input.id || createId('purchase_request')
  const record: PurchaseRequestRecord = {
    id: requestId,
    requestNo: input.requestNo?.trim() || previousRecord?.requestNo || getNextPurchaseRequestNo(records),
    title: input.title.trim(),
    description: input.description.trim(),
    requestDate: input.requestDate || getTodayKey(),
    requiredDate: input.requiredDate || input.requestDate || getTodayKey(),
    requester: input.requester.trim(),
    department: input.department,
    warehouseId: input.warehouseId,
    branchId: input.branchId,
    source: input.source,
    priority: input.priority,
    status: input.status || previousRecord?.status || 'DRAFT',
    notes: input.notes.trim(),
    createdAt: previousRecord?.createdAt || now,
    updatedAt: now,
    items: input.items.map((item, index) => createRecordItem(item, requestId, index, input.source, context.stockItems)),
    history: createBaseHistory(previousRecord, actorName, now),
    actionLogs: createBaseActionLogs(previousRecord, actorName, now)
  }

  return { record, validation }
}

export const upsertPurchaseRequestRecord = (
  records: PurchaseRequestRecord[],
  record: PurchaseRequestRecord
) => (
  records.some(item => item.id === record.id)
    ? records.map(item => item.id === record.id ? record : item)
    : [record, ...records]
)

export const createPurchaseRequestInputFromSuggestion = (
  suggestion: PurchaseRequestSuggestion,
  records: PurchaseRequestRecord[],
  user: User
): PurchaseRequestInput => {
  const today = getTodayKey()

  return {
    requestNo: getNextPurchaseRequestNo(records),
    title: `${suggestion.reason}`,
    description: suggestion.sourceReference,
    requestDate: today,
    requiredDate: today,
    requester: getUserName(user),
    department: suggestion.department,
    warehouseId: suggestion.warehouseId,
    branchId: suggestion.branchId,
    source: suggestion.source,
    priority: suggestion.priority,
    status: 'DRAFT',
    notes: suggestion.openRequestNos.length > 0
      ? `Açık talep uyarısı: ${suggestion.openRequestNos.join(', ')}`
      : '',
    items: [{
      stockItemId: suggestion.stockItemId,
      requestedQuantity: suggestion.requestedQuantity,
      estimatedUnitPrice: suggestion.estimatedUnitPrice,
      suggestedSupplierId: suggestion.suggestedSupplierId,
      source: suggestion.source,
      notes: suggestion.reason
    }]
  }
}

export const persistPurchaseRequestRecords = (records: PurchaseRequestRecord[]) => {
  savePurchaseRequestRecords(records)
}
