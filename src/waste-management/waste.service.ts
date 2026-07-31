import { createFireImpacts } from '../fire-impact/fire-impact.service'
import type { FireCategory, FireReason } from '../fire-impact/fire-impact.types'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  roundKpi,
  sumBy
} from '../kpi-reporting/kpi.utils'
import { resolveReadModelList } from '../read-model/read-model-safety'
import type { RecipeManagementRecord } from '../recipe-management/recipe-management.types'
import type { StockItem, StockUnit } from '../types'
import { createWasteAnalysis } from './waste-analysis.service'
import { appendWasteHistory, createWasteHistory } from './waste-history.service'
import { createWasteStatistics } from './waste-statistics.service'
import { validateWasteRecord } from './waste-validation.service'
import type {
  WasteCategory,
  WasteCreateInput,
  WasteFilters,
  WasteHistory,
  WasteHistoryAction,
  WasteItem,
  WasteReason,
  WasteRecord,
  WasteStatus,
  WasteType
} from './waste.types'

export const WASTE_STORAGE_KEY = 'ra_waste_management_records'

export const WASTE_STATUSES: WasteStatus[] = [
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
]

export const WASTE_STATUS_LABELS: Record<WasteStatus, string> = {
  DRAFT: 'Taslak',
  UNDER_REVIEW: 'Incelemede',
  APPROVED: 'Onaylandi',
  REJECTED: 'Reddedildi',
  CANCELLED: 'Iptal'
}

export const WASTE_TYPES: WasteType[] = [
  'PRODUCTION',
  'GOODS_RECEIPT',
  'BLAST_CHILLING',
  'WAREHOUSE',
  'PACKAGING',
  'SHIPMENT',
  'QUALITY_REJECTION',
  'SAMPLE_USAGE',
  'OTHER'
]

export const WASTE_TYPE_LABELS: Record<WasteType, string> = {
  PRODUCTION: 'Uretim Firesi',
  GOODS_RECEIPT: 'Mal Kabul Firesi',
  BLAST_CHILLING: 'Soklama Firesi',
  WAREHOUSE: 'Depo Firesi',
  PACKAGING: 'Paketleme Firesi',
  SHIPMENT: 'Sevkiyat Firesi',
  QUALITY_REJECTION: 'Kalite Reddi',
  SAMPLE_USAGE: 'Numune Kullanimi',
  OTHER: 'Diger'
}

export const WASTE_REASONS: WasteReason[] = [
  'PRODUCTION_ERROR',
  'TEMPERATURE_ISSUE',
  'DAMAGED_PACKAGING',
  'EXPIRED',
  'TRANSPORT_DAMAGE',
  'QUALITY_REJECTION',
  'HUMAN_ERROR',
  'MACHINE_FAILURE',
  'OTHER'
]

export const WASTE_REASON_LABELS: Record<WasteReason, string> = {
  PRODUCTION_ERROR: 'Uretim Hatasi',
  TEMPERATURE_ISSUE: 'Sicaklik Sorunu',
  DAMAGED_PACKAGING: 'Bozuk Ambalaj',
  EXPIRED: 'SKT Gecmesi',
  TRANSPORT_DAMAGE: 'Tasima Hasari',
  QUALITY_REJECTION: 'Kalite Reddi',
  HUMAN_ERROR: 'Insan Hatasi',
  MACHINE_FAILURE: 'Makine Arizasi',
  OTHER: 'Diger'
}

export const WASTE_CATEGORIES: WasteCategory[] = WASTE_TYPES.map(type => ({
  id: type,
  label: WASTE_TYPE_LABELS[type],
  description: `${WASTE_TYPE_LABELS[type]} icin kurumsal fire siniflandirmasi.`
}))

const WASTE_NO_PREFIX = 'WS'
const WASTE_NO_PADDING = 6
const QUANTITY_ROUNDING_FACTOR = 1000

type RawWasteRecord = Partial<Record<keyof WasteRecord, unknown>> & Record<string, unknown>
type RawWasteItem = Partial<Record<keyof WasteItem, unknown>> & Record<string, unknown>
type RawWasteHistory = Partial<Record<keyof WasteHistory, unknown>> & Record<string, unknown>

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawWasteRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawWasteItem => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isHistoryRecord = (value: unknown): value is RawWasteHistory => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.round((parsed + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
    : 0
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createDefaultWasteFilters = (): WasteFilters => ({
  status: ALL_FILTER,
  wasteType: ALL_FILTER,
  wasteReason: ALL_FILTER,
  branchId: ALL_FILTER,
  warehouseId: ALL_FILTER,
  productId: ALL_FILTER,
  lotId: ALL_FILTER,
  date: '',
  search: ''
})

export const getNextWasteNo = (
  records: Pick<WasteRecord, 'wasteNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${WASTE_NO_PREFIX}-${year}-(\\d{${WASTE_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.wasteNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${WASTE_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(WASTE_NO_PADDING, '0')}`
}

const createMap = <TRecord extends { id: string }>(records: TRecord[]) => (
  new Map(records.map(record => [record.id, record]))
)

const getBranchName = (
  branchId: string,
  sourceData: KpiSourceData
) => sourceData.branches.find(branch => branch.id === branchId)?.name || branchId || '-'

const getStockItem = (
  stockItemId: string,
  sourceData: KpiSourceData
) => sourceData.stockItems.find(item => item.id === stockItemId) || null

const getProductName = (
  productId: string,
  stockItem: StockItem | null,
  sourceData: KpiSourceData
) => sourceData.productRefs.find(product => product.id === productId || product.stockItemId === stockItem?.id)?.name
  || stockItem?.name
  || productId
  || '-'

const getRecipe = (
  productName: string,
  stockItemName: string,
  sourceData: KpiSourceData
): RecipeManagementRecord | null => {
  const productKey = normalizeSearchText(productName)
  const stockKey = normalizeSearchText(stockItemName)

  return sourceData.recipeRecords.find(recipe => (
    normalizeSearchText(recipe.productName) === productKey
    || normalizeSearchText(recipe.recipeName).includes(productKey)
    || recipe.ingredients.some(ingredient => normalizeSearchText(ingredient.materialName) === stockKey)
  )) || null
}

const getHaccpReference = (
  lotId: string,
  productionOrderId: string,
  sourceData: KpiSourceData
) => {
  const plan = sourceData.haccpRecords.find(record => (
    record.monitoringRecords.some(item => item.inventoryLotId === lotId || item.productionOrderId === productionOrderId)
  ))
  if(!plan) return ''
  const monitoring = plan.monitoringRecords.find(item => item.inventoryLotId === lotId || item.productionOrderId === productionOrderId)
  return `${plan.name}${monitoring ? ` / ${monitoring.result}` : ''}`
}

const getSupplierName = (
  supplierId: string,
  sourceData: KpiSourceData
) => sourceData.suppliers.find(supplier => supplier.id === supplierId)?.name || supplierId || ''

const quantityToKg = (
  quantity: number,
  unit: StockUnit
) => {
  if(unit === 'kg') return quantity
  if(unit === 'gr') return quantity / 1000
  return quantity
}

const getUnitCost = (
  stockItem: StockItem | null,
  fallback = 0
) => stockItem?.averageCost || stockItem?.lastPurchasePrice || stockItem?.unitPurchasePrice || fallback

const getProductionOrderNo = (
  productionOrderId: string,
  sourceData: KpiSourceData
) => sourceData.productionOrders.find(order => order.id === productionOrderId)?.workOrderNo || productionOrderId || ''

const mapFireCategoryToWasteType = (
  category: FireCategory
): WasteType => {
  if(category === 'Soklama') return 'BLAST_CHILLING'
  if(category === 'Paketleme') return 'PACKAGING'
  if(category === 'Depolama') return 'WAREHOUSE'
  if(category === 'Sevkiyat' || category === 'Iade') return 'SHIPMENT'
  if(category === 'Kalite') return 'QUALITY_REJECTION'
  return 'PRODUCTION'
}

const mapFireReasonToWasteReason = (
  reason: FireReason
): WasteReason => {
  if(reason === 'Soklama Problemi') return 'TEMPERATURE_ISSUE'
  if(reason === 'Ambalaj Problemi' || reason === 'Etiket Hatasi') return 'DAMAGED_PACKAGING'
  if(reason === 'SKT') return 'EXPIRED'
  if(reason === 'Tasima Hasari') return 'TRANSPORT_DAMAGE'
  if(reason === 'Kalite Reddi') return 'QUALITY_REJECTION'
  if(reason === 'Operator Hatasi' || reason === 'Yanlis Gramaj' || reason === 'Yanlis Recete') return 'HUMAN_ERROR'
  if(reason === 'Makine Arizasi') return 'MACHINE_FAILURE'
  return 'OTHER'
}

const createVirtualLot = (
  stockItemId: string,
  dateValue: string,
  sourceId: string
) => ({
  id: `virtual_waste_lot_${stockItemId}_${sourceId}`,
  lotNo: `LOT-${dateValue.replace(/-/g, '')}-${sourceId.slice(-4).toUpperCase()}`
})

const createItem = (
  recordId: string,
  itemId: string,
  source: {
    productId: string
    productName: string
    stockItemId: string
    stockItemName: string
    lotId: string
    lotNo: string
    batchNo: string
    quantity: number
    unit: StockUnit
    unitCost: number
  }
): WasteItem => ({
  id: itemId,
  wasteRecordId: recordId,
  productId: source.productId,
  productName: source.productName,
  stockItemId: source.stockItemId,
  stockItemName: source.stockItemName,
  lotId: source.lotId,
  lotNo: source.lotNo,
  batchNo: source.batchNo,
  quantity: source.quantity,
  unit: source.unit,
  unitCost: source.unitCost,
  totalCost: roundKpi(source.quantity * source.unitCost)
})

export const createWasteReadModelRecords = (
  sourceData: KpiSourceData
): WasteRecord[] => {
  const lotMap = createMap(sourceData.inventoryLots)
  const recordsFromFireImpact = createFireImpacts(sourceData).map((impact, index) => {
    const date = (impact.occurredAt || getTodayKey()).slice(0, 10)
    const lot = lotMap.get(impact.lotId) || null
    const virtualLot = lot ? null : createVirtualLot(impact.stockItemId, date, impact.stockWasteRecordId)
    const stockItem = getStockItem(impact.stockItemId, sourceData)
    const productId = impact.productId || stockItem?.id || impact.stockItemId
    const productName = impact.productName || getProductName(productId, stockItem, sourceData)
    const recipe = getRecipe(productName, impact.stockItemName, sourceData)
    const supplierId = lot?.supplierId || ''
    const branchId = impact.branchId || stockItem?.branchId || sourceData.branches[0]?.id || ''
    const warehouseId = impact.warehouseId || lot?.warehouseId || branchId
    const recordId = `waste_record_${impact.stockWasteRecordId}`
    const unitCost = impact.cost.unitCost || getUnitCost(stockItem)
    const item = createItem(recordId, `${recordId}_item_01`, {
      productId,
      productName,
      stockItemId: impact.stockItemId,
      stockItemName: impact.stockItemName,
      lotId: lot?.id || virtualLot?.id || '',
      lotNo: lot?.lotNo || impact.lotNo || virtualLot?.lotNo || '',
      batchNo: lot?.lotNo || impact.lotNo || virtualLot?.lotNo || '',
      quantity: impact.quantity,
      unit: impact.unit,
      unitCost
    })

    return {
      id: recordId,
      wasteNo: getNextWasteNo([], date, index),
      wasteType: mapFireCategoryToWasteType(impact.category),
      wasteReason: mapFireReasonToWasteReason(impact.reason),
      status: impact.impactScore >= 65 ? 'UNDER_REVIEW' as const : 'APPROVED' as const,
      productId,
      productName,
      stockItemId: impact.stockItemId,
      stockItemName: impact.stockItemName,
      lotId: item.lotId,
      lotNo: item.lotNo,
      batchNo: item.batchNo,
      quantity: impact.quantity,
      unit: impact.unit,
      warehouseId,
      warehouseName: getBranchName(warehouseId, sourceData),
      branchId,
      branchName: getBranchName(branchId, sourceData),
      productionOrderId: impact.productionOrderId,
      productionOrderNo: impact.workOrderNo,
      recipeId: recipe?.id || '',
      recipeName: recipe?.recipeName || '',
      supplierId,
      supplierName: getSupplierName(supplierId, sourceData),
      date,
      description: impact.notes || impact.stockImpact,
      qualityDecision: impact.reason === 'Kalite Reddi' ? 'REJECTED' : '',
      haccpReference: getHaccpReference(item.lotId, impact.productionOrderId, sourceData),
      correctiveAction: impact.impactScore >= 65 ? 'Kok neden analizi acilmali.' : '',
      photoNote: 'Fotograf notu icin hazirlik alani.',
      sourceType: 'StockWasteRecord' as const,
      sourceId: impact.stockWasteRecordId,
      unitCost,
      totalCost: item.totalCost || impact.cost.totalCost,
      currency: impact.cost.currency,
      items: [item],
      history: [
        createWasteHistory(recordId, 'CREATED', impact.operator || 'System', 'Stock waste kaydindan fire read-model olusturuldu.')
      ],
      createdBy: impact.operator || 'System',
      createdAt: impact.occurredAt,
      updatedAt: impact.occurredAt
    }
  })

  const recordsFromGoodsReceipt = sourceData.goodsReceipts.flatMap((receipt, receiptIndex) => (
    receipt.items
      .filter(item => item.rejectedQuantity > 0)
      .map((item, itemIndex) => {
        const date = (receipt.receiptDate || getTodayKey()).slice(0, 10)
        const stockItem = getStockItem(item.stockItemId, sourceData)
        const lot = sourceData.inventoryLots.find(sourceLot => (
          sourceLot.id === item.lotId
          || sourceLot.lotNo === item.lotNo
          || sourceLot.goodsReceiptId === receipt.id
          || sourceLot.stockItemId === item.stockItemId
        )) || null
        const virtualLot = lot ? null : createVirtualLot(item.stockItemId, date, item.id)
        const productId = lot?.productId || stockItem?.id || item.stockItemId
        const productName = item.productName || item.stockItemName || getProductName(productId, stockItem, sourceData)
        const recipe = getRecipe(productName, stockItem?.name || productName, sourceData)
        const supplierId = receipt.supplierId || lot?.supplierId || ''
        const branchId = receipt.warehouseId || stockItem?.branchId || sourceData.branches[0]?.id || ''
        const warehouseId = receipt.warehouseId || lot?.warehouseId || branchId
        const unitCost = item.unitCost || getUnitCost(stockItem)
        const recordId = `waste_record_goods_receipt_${receipt.id}_${item.id}`
        const wasteItem = createItem(recordId, `${recordId}_item_01`, {
          productId,
          productName,
          stockItemId: item.stockItemId,
          stockItemName: item.stockItemName || stockItem?.name || productName,
          lotId: lot?.id || item.lotId || virtualLot?.id || '',
          lotNo: lot?.lotNo || item.lotNo || virtualLot?.lotNo || '',
          batchNo: item.batchNo || lot?.lotNo || virtualLot?.lotNo || '',
          quantity: item.rejectedQuantity,
          unit: item.unit,
          unitCost
        })

        return {
          id: recordId,
          wasteNo: getNextWasteNo(recordsFromFireImpact, date, receiptIndex + itemIndex),
          wasteType: 'GOODS_RECEIPT' as const,
          wasteReason: 'QUALITY_REJECTION' as const,
          status: 'UNDER_REVIEW' as const,
          productId,
          productName,
          stockItemId: item.stockItemId,
          stockItemName: wasteItem.stockItemName,
          lotId: wasteItem.lotId,
          lotNo: wasteItem.lotNo,
          batchNo: wasteItem.batchNo,
          quantity: item.rejectedQuantity,
          unit: item.unit,
          warehouseId,
          warehouseName: receipt.warehouseName || getBranchName(warehouseId, sourceData),
          branchId,
          branchName: getBranchName(branchId, sourceData),
          productionOrderId: lot?.productionOrderId || '',
          productionOrderNo: getProductionOrderNo(lot?.productionOrderId || '', sourceData),
          recipeId: recipe?.id || '',
          recipeName: recipe?.recipeName || '',
          supplierId,
          supplierName: receipt.supplierName || getSupplierName(supplierId, sourceData),
          date,
          description: `Mal kabul red miktari: ${receipt.receiptNo}.`,
          qualityDecision: 'REJECTED',
          haccpReference: getHaccpReference(wasteItem.lotId, lot?.productionOrderId || '', sourceData),
          correctiveAction: 'Supplier ve kalite ekibi tarafindan incelenmeli.',
          photoNote: 'Fotograf notu icin hazirlik alani.',
          sourceType: 'GoodsReceipt' as const,
          sourceId: receipt.id,
          unitCost,
          totalCost: wasteItem.totalCost,
          currency: 'TRY',
          items: [wasteItem],
          history: [
            createWasteHistory(recordId, 'CREATED', receipt.receivedBy || 'Mal Kabul', 'Goods Receipt red miktarindan fire read-model olusturuldu.')
          ],
          createdBy: receipt.receivedBy || 'Mal Kabul',
          createdAt: receipt.createdAt,
          updatedAt: receipt.updatedAt
        }
      })
  ))

  return [...recordsFromFireImpact, ...recordsFromGoodsReceipt]
}

const normalizeStatus = (value: unknown): WasteStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return WASTE_STATUSES.includes(normalized as WasteStatus)
    ? normalized as WasteStatus
    : 'DRAFT'
}

const normalizeWasteType = (value: unknown): WasteType => {
  const normalized = normalizeText(value).toUpperCase()
  return WASTE_TYPES.includes(normalized as WasteType)
    ? normalized as WasteType
    : 'OTHER'
}

const normalizeWasteReason = (value: unknown): WasteReason => {
  const normalized = normalizeText(value).toUpperCase()
  return WASTE_REASONS.includes(normalized as WasteReason)
    ? normalized as WasteReason
    : 'OTHER'
}

const normalizeUnit = (value: unknown): StockUnit => {
  const normalized = normalizeText(value)
  const units: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
  return units.includes(normalized as StockUnit) ? normalized as StockUnit : 'adet'
}

const normalizeHistory = (
  value: unknown,
  recordId: string,
  actorName: string
): WasteHistory[] => {
  if(!Array.isArray(value) || value.length === 0){
    return [createWasteHistory(recordId, 'CREATED', actorName, 'Fire read-model kaydi olusturuldu.')]
  }

  return value.filter(isHistoryRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${recordId}_history_${String(index + 1).padStart(2, '0')}`,
    wasteRecordId: recordId,
    action: normalizeText(history.action).toUpperCase() as WasteHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description),
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeItem = (
  item: RawWasteItem,
  index: number,
  recordId: string,
  fallbackUnit: StockUnit
): WasteItem => {
  const quantity = normalizeNonNegativeNumber(item.quantity)
  const unitCost = normalizeNonNegativeNumber(item.unitCost)

  return {
    id: normalizeText(item.id) || `${recordId}_item_${String(index + 1).padStart(2, '0')}`,
    wasteRecordId: recordId,
    productId: normalizeText(item.productId),
    productName: normalizeText(item.productName),
    stockItemId: normalizeText(item.stockItemId),
    stockItemName: normalizeText(item.stockItemName),
    lotId: normalizeText(item.lotId),
    lotNo: normalizeText(item.lotNo),
    batchNo: normalizeText(item.batchNo),
    quantity,
    unit: normalizeUnit(item.unit || fallbackUnit),
    unitCost,
    totalCost: normalizeText(item.totalCost) ? normalizeNonNegativeNumber(item.totalCost) : roundKpi(quantity * unitCost)
  }
}

const normalizeWasteRecord = (
  record: RawWasteRecord,
  index: number,
  sourceData: KpiSourceData
): WasteRecord => {
  const now = new Date().toISOString()
  const recordId = normalizeText(record.id) || `waste_record_${Date.now()}_${index}`
  const date = normalizeText(record.date) || getTodayKey()
  const stockItemId = normalizeText(record.stockItemId)
  const stockItem = getStockItem(stockItemId, sourceData)
  const lotId = normalizeText(record.lotId)
  const lot = lotId ? sourceData.inventoryLots.find(item => item.id === lotId) || null : null
  const unit = normalizeUnit(record.unit || stockItem?.unit)
  const quantity = normalizeNonNegativeNumber(record.quantity)
  const unitCost = normalizeText(record.unitCost) ? normalizeNonNegativeNumber(record.unitCost) : getUnitCost(stockItem)
  const actorName = normalizeText(record.createdBy) || 'Waste Management'
  const rawItems = Array.isArray(record.items) ? record.items : []
  const items = rawItems.filter(isItemRecord).map((item, itemIndex) => normalizeItem(item, itemIndex, recordId, unit))
  const primaryItem = items[0]

  return {
    id: recordId,
    wasteNo: normalizeText(record.wasteNo) || getNextWasteNo([], date, index),
    wasteType: normalizeWasteType(record.wasteType),
    wasteReason: normalizeWasteReason(record.wasteReason),
    status: normalizeStatus(record.status),
    productId: normalizeText(record.productId) || primaryItem?.productId || lot?.productId || stockItem?.id || '',
    productName: normalizeText(record.productName) || primaryItem?.productName || getProductName(lot?.productId || stockItem?.id || '', stockItem, sourceData),
    stockItemId: stockItemId || primaryItem?.stockItemId || lot?.stockItemId || '',
    stockItemName: normalizeText(record.stockItemName) || primaryItem?.stockItemName || stockItem?.name || '',
    lotId: lotId || primaryItem?.lotId || '',
    lotNo: normalizeText(record.lotNo) || primaryItem?.lotNo || lot?.lotNo || '',
    batchNo: normalizeText(record.batchNo) || primaryItem?.batchNo || lot?.lotNo || '',
    quantity,
    unit,
    warehouseId: normalizeText(record.warehouseId) || lot?.warehouseId || stockItem?.branchId || '',
    warehouseName: normalizeText(record.warehouseName) || getBranchName(normalizeText(record.warehouseId) || lot?.warehouseId || stockItem?.branchId || '', sourceData),
    branchId: normalizeText(record.branchId) || stockItem?.branchId || lot?.warehouseId || '',
    branchName: normalizeText(record.branchName) || getBranchName(normalizeText(record.branchId) || stockItem?.branchId || lot?.warehouseId || '', sourceData),
    productionOrderId: normalizeText(record.productionOrderId) || lot?.productionOrderId || '',
    productionOrderNo: normalizeText(record.productionOrderNo) || getProductionOrderNo(normalizeText(record.productionOrderId) || lot?.productionOrderId || '', sourceData),
    recipeId: normalizeText(record.recipeId),
    recipeName: normalizeText(record.recipeName),
    supplierId: normalizeText(record.supplierId) || lot?.supplierId || '',
    supplierName: normalizeText(record.supplierName) || getSupplierName(normalizeText(record.supplierId) || lot?.supplierId || '', sourceData),
    date,
    description: normalizeText(record.description),
    qualityDecision: normalizeText(record.qualityDecision),
    haccpReference: normalizeText(record.haccpReference),
    correctiveAction: normalizeText(record.correctiveAction),
    photoNote: normalizeText(record.photoNote),
    sourceType: record.sourceType === 'GoodsReceipt' || record.sourceType === 'ManualReadModel' ? record.sourceType : 'StockWasteRecord',
    sourceId: normalizeText(record.sourceId),
    unitCost,
    totalCost: normalizeText(record.totalCost) ? normalizeNonNegativeNumber(record.totalCost) : roundKpi(quantity * unitCost),
    currency: normalizeText(record.currency) || 'TRY',
    items: items.length > 0 ? items : [],
    history: normalizeHistory(record.history, recordId, actorName),
    createdBy: actorName,
    createdAt: normalizeText(record.createdAt) || now,
    updatedAt: normalizeText(record.updatedAt) || now
  }
}

export const saveWasteRecords = (
  records: WasteRecord[]
) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(WASTE_STORAGE_KEY, JSON.stringify(records))
}

export const loadWasteRecords = (
  sourceData: KpiSourceData
) => {
  const seedRecords = resolveReadModelList(() => createWasteReadModelRecords(sourceData))

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(WASTE_STORAGE_KEY)
  if(!storedRecords){
    if(seedRecords.length > 0) saveWasteRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeWasteRecord(record, index, sourceData))
      const storedIds = new Set(normalizedRecords.map(record => record.id))
      const nextRecords = [
        ...normalizedRecords,
        ...seedRecords.filter(record => !storedIds.has(record.id))
      ]

      saveWasteRecords(nextRecords)
      return nextRecords
    }
  } catch {
    if(seedRecords.length > 0) saveWasteRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveWasteRecords(seedRecords)
  return seedRecords
}

export const filterWasteRecords = (
  records: WasteRecord[],
  filters: WasteFilters
) => records.filter(record => {
  const search = normalizeSearchText(filters.search)
  const searchTarget = [
    record.wasteNo,
    record.productName,
    record.stockItemName,
    record.lotNo,
    record.batchNo,
    record.recipeName,
    record.supplierName,
    record.description
  ].join(' ')

  return (
    (filters.status === ALL_FILTER || record.status === filters.status)
    && (filters.wasteType === ALL_FILTER || record.wasteType === filters.wasteType)
    && (filters.wasteReason === ALL_FILTER || record.wasteReason === filters.wasteReason)
    && (filters.branchId === ALL_FILTER || record.branchId === filters.branchId)
    && (filters.warehouseId === ALL_FILTER || record.warehouseId === filters.warehouseId)
    && (filters.productId === ALL_FILTER || record.productId === filters.productId || record.stockItemId === filters.productId)
    && (filters.lotId === ALL_FILTER || record.lotId === filters.lotId)
    && (!filters.date || record.date === filters.date)
    && (!search || normalizeSearchText(searchTarget).includes(search))
  )
})

const getProductionQuantity = (
  sourceData: KpiSourceData
) => sumBy(sourceData.productionOrders, order => sumBy(order.lines, line => line.quantity))

export const addWasteFromLot = (
  input: WasteCreateInput,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadWasteRecords(sourceData)
  const lot = sourceData.inventoryLots.find(item => item.id === input.lotId)
  if(!lot) throw new Error('Lot kaydi bulunamadi.')
  const stockItem = getStockItem(lot.stockItemId, sourceData)
  const productId = lot.productId || stockItem?.id || lot.stockItemId
  const productName = getProductName(productId, stockItem, sourceData)
  const recipe = getRecipe(productName, stockItem?.name || productName, sourceData)
  const quantity = normalizeNonNegativeNumber(input.quantity)
  const unit = lot.unit || stockItem?.unit || 'adet'
  const unitCost = getUnitCost(stockItem)
  const date = input.date || getTodayKey()
  const recordId = createId('waste_record_manual')
  const item = createItem(recordId, `${recordId}_item_01`, {
    productId,
    productName,
    stockItemId: lot.stockItemId,
    stockItemName: stockItem?.name || productName,
    lotId: lot.id,
    lotNo: lot.lotNo,
    batchNo: lot.lotNo,
    quantity,
    unit,
    unitCost
  })
  const record: WasteRecord = {
    id: recordId,
    wasteNo: getNextWasteNo(records, date),
    wasteType: input.wasteType,
    wasteReason: input.wasteReason,
    status: 'DRAFT',
    productId,
    productName,
    stockItemId: lot.stockItemId,
    stockItemName: stockItem?.name || productName,
    lotId: lot.id,
    lotNo: lot.lotNo,
    batchNo: lot.lotNo,
    quantity,
    unit,
    warehouseId: lot.warehouseId || stockItem?.branchId || '',
    warehouseName: getBranchName(lot.warehouseId || stockItem?.branchId || '', sourceData),
    branchId: stockItem?.branchId || lot.warehouseId || '',
    branchName: getBranchName(stockItem?.branchId || lot.warehouseId || '', sourceData),
    productionOrderId: lot.productionOrderId,
    productionOrderNo: getProductionOrderNo(lot.productionOrderId, sourceData),
    recipeId: recipe?.id || '',
    recipeName: recipe?.recipeName || '',
    supplierId: lot.supplierId,
    supplierName: getSupplierName(lot.supplierId, sourceData),
    date,
    description: input.description || 'Manuel read-model fire kaydi.',
    qualityDecision: input.wasteType === 'QUALITY_REJECTION' ? 'REJECTED' : '',
    haccpReference: getHaccpReference(lot.id, lot.productionOrderId, sourceData),
    correctiveAction: '',
    photoNote: 'Fotograf notu icin hazirlik alani.',
    sourceType: 'ManualReadModel',
    sourceId: lot.id,
    unitCost,
    totalCost: item.totalCost,
    currency: 'TRY',
    items: [item],
    history: [createWasteHistory(recordId, 'CREATED', actorName, `${lot.lotNo} icin fire kaydi olusturuldu.`)],
    createdBy: actorName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  const validation = validateWasteRecord(record, sourceData)
  if(!validation.valid) throw new Error(validation.errors.join(' '))
  saveWasteRecords([record, ...records])
  return record
}

const upsertRecord = (
  records: WasteRecord[],
  record: WasteRecord
) => records.some(item => item.id === record.id)
  ? records.map(item => item.id === record.id ? record : item)
  : [record, ...records]

export const updateWasteStatus = (
  wasteRecordId: string,
  status: WasteStatus,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadWasteRecords(sourceData)
  const record = records.find(item => item.id === wasteRecordId)
  if(!record) throw new Error('Fire kaydi bulunamadi.')
  if(record.status === 'CANCELLED' && status !== 'CANCELLED') throw new Error('Iptal edilmis fire kaydi tekrar acilamaz.')
  if(record.status === status) return record

  const actionByStatus: Record<WasteStatus, WasteHistoryAction> = {
    DRAFT: 'UPDATED',
    UNDER_REVIEW: 'UNDER_REVIEW',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED'
  }
  const nextRecord = appendWasteHistory(
    { ...record, status },
    actionByStatus[status],
    actorName,
    `${record.wasteNo} ${WASTE_STATUS_LABELS[status]} durumuna alindi.`
  )
  const validation = validateWasteRecord(nextRecord, sourceData)
  if(!validation.valid) throw new Error(validation.errors.join(' '))
  saveWasteRecords(upsertRecord(records, nextRecord))
  return nextRecord
}

export const recordWasteOutput = (
  wasteRecordId: string,
  action: Extract<WasteHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadWasteRecords(sourceData)
  const record = records.find(item => item.id === wasteRecordId)
  if(!record) throw new Error('Fire kaydi bulunamadi.')
  const nextRecord = appendWasteHistory(
    record,
    action,
    actorName,
    action === 'EXCEL' ? `${record.wasteNo} Excel export edildi.` : `${record.wasteNo} cikti penceresi acildi.`
  )
  saveWasteRecords(upsertRecord(records, nextRecord))
  return nextRecord
}

export const WasteService = {
  createDefaultFilters: createDefaultWasteFilters,
  list: loadWasteRecords,
  save: saveWasteRecords,
  filter: filterWasteRecords,
  statistics: (records: WasteRecord[], sourceData: KpiSourceData) => createWasteStatistics(records, getProductionQuantity(sourceData)),
  analysis: (records: WasteRecord[], sourceData: KpiSourceData) => createWasteAnalysis(records, getProductionQuantity(sourceData)),
  addFromLot: addWasteFromLot,
  updateStatus: updateWasteStatus,
  recordOutput: recordWasteOutput,
  validate: validateWasteRecord,
  getNextNo: getNextWasteNo,
  createReadModelRecords: createWasteReadModelRecords
}
