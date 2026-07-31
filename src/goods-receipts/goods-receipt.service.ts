import { createCostEngineView, createDefaultCostEngineFilters } from '../cost-engine/cost-engine.service'
import type { InventoryLot } from '../inventory-lots/inventory-lot.types'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { resolveReadModelList } from '../read-model/read-model-safety'
import { getGoodsReceiptOrderLines } from './goods-receipt.mock'
import { appendGoodsReceiptHistory, createGoodsReceiptHistory } from './goods-receipt-history.service'
import { GoodsReceiptInspectionService } from './goods-receipt-inspection.service'
import { createGoodsReceiptStatistics } from './goods-receipt-statistics.service'
import { validateGoodsReceipt } from './goods-receipt-validation.service'
import type {
  GoodsReceiptFilters,
  GoodsReceiptHistory,
  GoodsReceiptHistoryAction,
  GoodsReceiptInspection,
  GoodsReceiptItem,
  GoodsReceiptManagementStatus,
  GoodsReceiptRecord
} from './goods-receipt.types'

export const GOODS_RECEIPT_MANAGEMENT_STORAGE_KEY = 'ra_goods_receipt_management'

export const GOODS_RECEIPT_MANAGEMENT_STATUSES: GoodsReceiptManagementStatus[] = [
  'WAITING',
  'INSPECTING',
  'ACCEPTED',
  'PARTIAL_ACCEPTED',
  'REJECTED',
  'CANCELLED'
]

export const GOODS_RECEIPT_MANAGEMENT_STATUS_LABELS: Record<GoodsReceiptManagementStatus, string> = {
  WAITING: 'Bekliyor',
  INSPECTING: 'Kontrol Ediliyor',
  ACCEPTED: 'Kabul Edildi',
  PARTIAL_ACCEPTED: 'Kismi Kabul',
  REJECTED: 'Reddedildi',
  CANCELLED: 'Iptal'
}

const DEFAULT_STATUS: GoodsReceiptManagementStatus = 'WAITING'
const RECEIPT_NO_PREFIX = 'GR'
const RECEIPT_NO_PADDING = 6
const RECEIPT_SEED_COUNT = 10
const QUANTITY_ROUNDING_FACTOR = 1000

type RawGoodsReceipt = Partial<Record<keyof GoodsReceiptRecord, unknown>> & Record<string, unknown>
type RawGoodsReceiptItem = Partial<Record<keyof GoodsReceiptItem, unknown>> & Record<string, unknown>
type RawGoodsReceiptHistory = Partial<Record<keyof GoodsReceiptHistory, unknown>> & Record<string, unknown>

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawGoodsReceipt => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawGoodsReceiptItem => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isHistoryRecord = (value: unknown): value is RawGoodsReceiptHistory => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const roundQuantity = (value: number) => (
  Math.round((value + Number.EPSILON) * QUANTITY_ROUNDING_FACTOR) / QUANTITY_ROUNDING_FACTOR
)

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? roundQuantity(parsed) : 0
}

const normalizeStatus = (value: unknown): GoodsReceiptManagementStatus => {
  const normalized = normalizeText(value).toUpperCase()
  if(GOODS_RECEIPT_MANAGEMENT_STATUSES.includes(normalized as GoodsReceiptManagementStatus)){
    return normalized as GoodsReceiptManagementStatus
  }
  if(normalized === 'COMPLETED' || normalized === 'RECEIVED') return 'ACCEPTED'
  if(normalized === 'PARTIALLY_RECEIVED') return 'PARTIAL_ACCEPTED'
  if(normalized === 'DRAFT') return 'WAITING'
  return DEFAULT_STATUS
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

export const createDefaultGoodsReceiptFilters = (): GoodsReceiptFilters => ({
  status: 'all',
  supplierId: 'all',
  warehouseId: 'all',
  date: '',
  search: ''
})

export const getNextGoodsReceiptManagementNo = (
  records: Pick<GoodsReceiptRecord, 'receiptNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${RECEIPT_NO_PREFIX}-${year}-(\\d{${RECEIPT_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.receiptNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${RECEIPT_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(RECEIPT_NO_PADDING, '0')}`
}

const normalizeReceiptNo = (
  receiptNo: string,
  dateValue: string,
  index: number
) => {
  const normalized = normalizeText(receiptNo)
  if(/^GR-\d{4}-\d{6}$/.test(normalized)) return normalized
  const year = (dateValue || getTodayKey()).slice(0, 4)
  return `GR-${year}-${String(index + 1).padStart(RECEIPT_NO_PADDING, '0')}`
}

const getBranchName = (
  branchId: string,
  sourceData: KpiSourceData
) => sourceData.branches.find(branch => branch.id === branchId)?.name || branchId || '-'

const getSupplierName = (
  supplierId: string,
  sourceData: KpiSourceData
) => sourceData.suppliers.find(supplier => supplier.id === supplierId)?.name || supplierId || '-'

const getStockItem = (
  stockItemId: string,
  sourceData: KpiSourceData
) => sourceData.stockItems.find(item => item.id === stockItemId) || null

const getStockItemName = (
  stockItemId: string,
  sourceData: KpiSourceData
) => getStockItem(stockItemId, sourceData)?.name || stockItemId || '-'

const createMaps = (
  sourceData: KpiSourceData
) => ({
  rfqMap: new Map(sourceData.rfqRecords.map(record => [record.id, record])),
  purchaseRequestMap: new Map(sourceData.purchaseRequests.map(record => [record.id, record]))
})

const getWarehouseIdForOrder = (
  purchaseOrderId: string,
  sourceData: KpiSourceData
) => {
  const purchaseOrder = sourceData.purchaseOrders.find(order => order.id === purchaseOrderId)
  if(!purchaseOrder) return sourceData.branches[0]?.id || ''
  const { rfqMap, purchaseRequestMap } = createMaps(sourceData)
  const rfq = rfqMap.get(purchaseOrder.rfqId)
  const purchaseRequest = purchaseRequestMap.get(purchaseOrder.purchaseRequestId)
  return rfq?.branchId || purchaseRequest?.warehouseId || purchaseRequest?.branchId || sourceData.branches[0]?.id || ''
}

const getCostByKey = (
  sourceData: KpiSourceData
) => {
  const costView = createCostEngineView(sourceData, createDefaultCostEngineFilters())
  const costByKey = new Map<string, number>()

  for(const record of costView.records){
    const unitCost = record.costPerUnit || record.costPerKg || record.averageCost || 0
    const keys = [
      record.id,
      record.productId,
      record.productName,
      record.lotId,
      record.lotNo
    ].filter(Boolean)

    for(const key of keys){
      if(!costByKey.has(key)) costByKey.set(key, unitCost)
      const normalizedKey = normalizeSearchText(key)
      if(normalizedKey && !costByKey.has(normalizedKey)) costByKey.set(normalizedKey, unitCost)
    }
  }

  return costByKey
}

const getUnitCost = (
  stockItemId: string,
  productName: string,
  lot: InventoryLot | null,
  sourceData: KpiSourceData,
  costByKey: Map<string, number>
) => {
  const stockItem = getStockItem(stockItemId, sourceData)
  const keys = [
    stockItemId,
    normalizeSearchText(stockItemId),
    productName,
    normalizeSearchText(productName),
    lot?.id || '',
    lot?.lotNo || '',
    lot?.productId || ''
  ].filter(Boolean)

  for(const key of keys){
    const cost = costByKey.get(key)
    if(cost) return cost
  }

  return stockItem?.averageCost || stockItem?.lastPurchasePrice || stockItem?.unitPurchasePrice || 0
}

const findLotForLine = (
  receiptId: string,
  stockItemId: string,
  supplierId: string,
  sourceData: KpiSourceData
) => sourceData.inventoryLots.find(lot => lot.goodsReceiptId === receiptId && lot.stockItemId === stockItemId)
  || sourceData.inventoryLots.find(lot => lot.stockItemId === stockItemId && lot.supplierId === supplierId)
  || sourceData.inventoryLots.find(lot => lot.stockItemId === stockItemId)
  || null

const getQualitySampleNo = (
  lotId: string,
  sourceData: KpiSourceData
) => sourceData.qualitySamples.find(sample => sample.inventoryLotId === lotId)?.sampleNo || ''

const getHaccpPlanName = (
  lotId: string,
  sourceData: KpiSourceData
) => sourceData.haccpRecords.find(record => (
  record.monitoringRecords.some(item => item.inventoryLotId === lotId)
))?.name || ''

const createVirtualLotNo = (
  receiptDate: string,
  lineIndex: number
) => `LOT-${receiptDate.replace(/-/g, '')}-${String(lineIndex + 1).padStart(4, '0')}`

const quantityToKg = (
  quantity: number,
  unit: string
) => {
  if(unit === 'kg') return quantity
  if(unit === 'gr') return quantity / 1000
  return quantity
}

const normalizeHistory = (
  value: unknown,
  receiptId: string,
  actorName: string
): GoodsReceiptHistory[] => {
  if(!Array.isArray(value) || value.length === 0){
    return [
      createGoodsReceiptHistory(
        receiptId,
        'CREATED',
        actorName,
        'Mal kabul read-model kaydi olusturuldu.'
      )
    ]
  }

  return value.filter(isHistoryRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${receiptId}_history_${String(index + 1).padStart(2, '0')}`,
    receiptId,
    action: normalizeText(history.action).toUpperCase() as GoodsReceiptHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description),
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const createDefaultInspectionForRecord = (
  receiptId: string,
  actorName: string,
  hasRejectedQuantity: boolean,
  sourceHaccpNote: string
): GoodsReceiptInspection => {
  const inspection = GoodsReceiptInspectionService.createDefault(receiptId, actorName)
  const enrichedInspection = {
    ...inspection,
    packagingCheck: hasRejectedQuantity ? 'WARNING' as const : inspection.packagingCheck,
    haccpTemperatureRecord: sourceHaccpNote || inspection.haccpTemperatureRecord,
    correctiveActionNote: hasRejectedQuantity
      ? 'Red miktari icin supplier ve kalite aksiyonu izlenmeli.'
      : inspection.correctiveActionNote
  }

  return {
    ...enrichedInspection,
    result: GoodsReceiptInspectionService.calculateResult(enrichedInspection)
  }
}

const normalizeItem = (
  item: RawGoodsReceiptItem,
  index: number,
  receiptId: string,
  sourceData: KpiSourceData
): GoodsReceiptItem => {
  const stockItemId = normalizeText(item.stockItemId)
  const receivedQuantity = normalizeNonNegativeNumber(item.receivedQuantity)
  const acceptedQuantity = normalizeNonNegativeNumber(item.acceptedQuantity)
  const rejectedQuantity = normalizeNonNegativeNumber(item.rejectedQuantity)
  const unit = normalizeText(item.unit) as GoodsReceiptItem['unit']
  const lotId = normalizeText(item.lotId)
  const lot = lotId ? sourceData.inventoryLots.find(record => record.id === lotId) || null : null
  const productName = normalizeText(item.productName) || normalizeText(item.stockItemName) || getStockItemName(stockItemId, sourceData)
  const netWeight = normalizeNonNegativeNumber(item.netWeight)
  const grossWeight = normalizeNonNegativeNumber(item.grossWeight)
  const unitCost = normalizeNonNegativeNumber(item.unitCost)
  const totalCost = normalizeNonNegativeNumber(item.totalCost)

  return {
    id: normalizeText(item.id) || `${receiptId}_item_${String(index + 1).padStart(2, '0')}`,
    receiptId,
    purchaseOrderItemId: normalizeText(item.purchaseOrderItemId),
    stockItemId,
    orderedQuantity: normalizeNonNegativeNumber(item.orderedQuantity),
    receivedQuantity,
    acceptedQuantity,
    rejectedQuantity,
    unit: unit || 'adet',
    productName,
    stockItemName: normalizeText(item.stockItemName) || productName,
    lotId,
    lotNo: normalizeText(item.lotNo) || lot?.lotNo || '',
    batchNo: normalizeText(item.batchNo) || lot?.lotNo || '',
    packageType: normalizeText(item.packageType) || 'Standart Ambalaj',
    netWeight,
    grossWeight,
    unitCost,
    totalCost,
    qualitySampleNo: normalizeText(item.qualitySampleNo) || getQualitySampleNo(lotId, sourceData),
    haccpPlanName: normalizeText(item.haccpPlanName) || getHaccpPlanName(lotId, sourceData),
    notes: normalizeText(item.notes)
  }
}

const createItemsFromOrder = (
  receiptId: string,
  purchaseOrderId: string,
  supplierId: string,
  receiptDate: string,
  sourceData: KpiSourceData,
  sourceItems: GoodsReceiptItem[] = []
): GoodsReceiptItem[] => {
  const purchaseOrder = sourceData.purchaseOrders.find(order => order.id === purchaseOrderId)
  const { rfqMap, purchaseRequestMap } = createMaps(sourceData)
  const lines = getGoodsReceiptOrderLines(purchaseOrder, rfqMap, purchaseRequestMap)
  const costByKey = getCostByKey(sourceData)
  const lineSources = lines.length > 0
    ? lines
    : sourceItems.map(item => ({
      purchaseOrderItemId: item.purchaseOrderItemId,
      stockItemId: item.stockItemId,
      orderedQuantity: item.orderedQuantity,
      unit: item.unit,
      supplierProductId: ''
    }))

  return lineSources.map((line, index) => {
    const sourceItem = sourceItems.find(item => item.purchaseOrderItemId === line.purchaseOrderItemId || item.stockItemId === line.stockItemId)
    const lot = findLotForLine(receiptId, line.stockItemId, supplierId, sourceData)
    const lotId = lot?.id || `virtual_lot_${purchaseOrderId}_${line.stockItemId}_${index + 1}`
    const lotNo = lot?.lotNo || createVirtualLotNo(receiptDate, index)
    const productName = getStockItemName(line.stockItemId, sourceData)
    const receivedQuantity = normalizeNonNegativeNumber(sourceItem?.receivedQuantity ?? line.orderedQuantity)
    const acceptedQuantity = normalizeNonNegativeNumber(sourceItem?.acceptedQuantity ?? receivedQuantity)
    const rejectedQuantity = normalizeNonNegativeNumber(sourceItem?.rejectedQuantity ?? 0)
    const netWeight = normalizeNonNegativeNumber(sourceItem?.netWeight ?? quantityToKg(acceptedQuantity, line.unit))
    const grossWeight = normalizeNonNegativeNumber(sourceItem?.grossWeight ?? netWeight * 1.03)
    const unitCost = normalizeNonNegativeNumber(sourceItem?.unitCost ?? getUnitCost(line.stockItemId, productName, lot, sourceData, costByKey))

    return {
      id: sourceItem?.id || `${receiptId}_item_${String(index + 1).padStart(2, '0')}`,
      receiptId,
      purchaseOrderItemId: line.purchaseOrderItemId,
      stockItemId: line.stockItemId,
      orderedQuantity: normalizeNonNegativeNumber(sourceItem?.orderedQuantity ?? line.orderedQuantity),
      receivedQuantity,
      acceptedQuantity,
      rejectedQuantity,
      unit: line.unit,
      productName,
      stockItemName: productName,
      lotId,
      lotNo,
      batchNo: sourceItem?.batchNo || lotNo,
      packageType: sourceItem?.packageType || 'Tedarikci Ambalaji',
      netWeight,
      grossWeight,
      unitCost,
      totalCost: roundQuantity(acceptedQuantity * unitCost),
      qualitySampleNo: getQualitySampleNo(lot?.id || '', sourceData),
      haccpPlanName: getHaccpPlanName(lot?.id || '', sourceData),
      notes: sourceItem?.notes || ''
    }
  })
}

const createRecordFromSource = (
  sourceRecord: GoodsReceiptRecord,
  index: number,
  sourceData: KpiSourceData
): GoodsReceiptRecord => {
  const purchaseOrder = sourceData.purchaseOrders.find(order => order.id === sourceRecord.purchaseOrderId)
  const supplierId = sourceRecord.supplierId || purchaseOrder?.supplierId || ''
  const warehouseId = sourceRecord.warehouseId || getWarehouseIdForOrder(sourceRecord.purchaseOrderId, sourceData)
  const receiptDate = sourceRecord.receiptDate || getTodayKey()
  const receiptNo = normalizeReceiptNo(sourceRecord.receiptNo, receiptDate, index)
  const items = createItemsFromOrder(sourceRecord.id, sourceRecord.purchaseOrderId, supplierId, receiptDate, sourceData, sourceRecord.items)
  const hasRejectedQuantity = items.some(item => item.rejectedQuantity > 0)
  const haccpNote = items.map(item => item.haccpPlanName).filter(Boolean)[0] || ''
  const actorName = sourceRecord.receivedBy || 'Mal Kabul'

  return {
    ...sourceRecord,
    receiptNo,
    goodsReceiptNo: receiptNo,
    purchaseOrderNo: purchaseOrder?.orderNo || sourceRecord.purchaseOrderNo || sourceRecord.purchaseOrderId,
    supplierId,
    supplierName: getSupplierName(supplierId, sourceData),
    warehouseId,
    warehouseName: getBranchName(warehouseId, sourceData),
    receiptDate,
    vehiclePlate: sourceRecord.vehiclePlate || `GR-${String(index + 1).padStart(3, '0')}`,
    deliveredBy: sourceRecord.deliveredBy || getSupplierName(supplierId, sourceData),
    receivedBy: sourceRecord.receivedBy || actorName,
    receivedByName: sourceRecord.receivedByName || actorName,
    status: normalizeStatus(sourceRecord.status),
    notes: sourceRecord.notes || 'Purchase Order uzerinden mal kabul read-model kaydi.',
    description: sourceRecord.description || sourceRecord.notes || 'Stok hareketi uretmeden mevcut PO, lot, kalite ve HACCP verisi ile hesaplandi.',
    inspection: sourceRecord.inspection
      ? GoodsReceiptInspectionService.normalize(sourceRecord.inspection, sourceRecord.id, actorName)
      : createDefaultInspectionForRecord(sourceRecord.id, actorName, hasRejectedQuantity, haccpNote),
    history: normalizeHistory(sourceRecord.history, sourceRecord.id, actorName),
    items
  }
}

const createRecordFromPurchaseOrder = (
  purchaseOrderId: string,
  sourceData: KpiSourceData,
  actorName: string,
  existingRecords: GoodsReceiptRecord[],
  offset = 0
): GoodsReceiptRecord => {
  const purchaseOrder = sourceData.purchaseOrders.find(order => order.id === purchaseOrderId)
  if(!purchaseOrder) throw new Error('Purchase Order bulunamadi.')
  if(purchaseOrder.status === 'CANCELLED') throw new Error('Iptal edilmis PO secilemez.')

  const receiptDate = getTodayKey()
  const receiptNo = getNextGoodsReceiptManagementNo(existingRecords, receiptDate, offset)
  const receiptId = createId('goods_receipt_management')
  const supplierId = purchaseOrder.supplierId
  const warehouseId = getWarehouseIdForOrder(purchaseOrder.id, sourceData)
  const items = createItemsFromOrder(receiptId, purchaseOrder.id, supplierId, receiptDate, sourceData)
  const inspection = createDefaultInspectionForRecord(receiptId, actorName, false, items.map(item => item.haccpPlanName).filter(Boolean)[0] || '')
  const createdAt = new Date().toISOString()

  return {
    id: receiptId,
    receiptNo,
    goodsReceiptNo: receiptNo,
    purchaseOrderId: purchaseOrder.id,
    purchaseOrderNo: purchaseOrder.orderNo,
    supplierId,
    supplierName: getSupplierName(supplierId, sourceData),
    warehouseId,
    warehouseName: getBranchName(warehouseId, sourceData),
    receiptDate,
    vehiclePlate: '',
    deliveredBy: getSupplierName(supplierId, sourceData),
    receivedBy: actorName,
    receivedByName: actorName,
    status: DEFAULT_STATUS,
    notes: 'Purchase Order uzerinden mal kabul read-model kaydi.',
    description: 'Bu kayit stok hareketi, muhasebe fisi veya otomatik kalite karari uretmez.',
    inspection,
    history: [
      createGoodsReceiptHistory(
        receiptId,
        'CREATED',
        actorName,
        `${receiptNo} ${purchaseOrder.orderNo} uzerinden olusturuldu.`
      )
    ],
    createdAt,
    updatedAt: createdAt,
    items
  }
}

const createSeedRecords = (
  sourceData: KpiSourceData
) => {
  const sourceReceipts = sourceData.goodsReceipts.length > 0
    ? sourceData.goodsReceipts.slice(0, RECEIPT_SEED_COUNT)
    : sourceData.purchaseOrders
      .filter(order => order.status !== 'CANCELLED')
      .slice(0, RECEIPT_SEED_COUNT)
      .map((order, index) => createRecordFromPurchaseOrder(order.id, sourceData, 'Mal Kabul', [], index))

  return sourceReceipts.map((record, index) => createRecordFromSource(record, index, sourceData))
}

const normalizeGoodsReceipt = (
  record: RawGoodsReceipt,
  index: number,
  sourceData: KpiSourceData
): GoodsReceiptRecord => {
  const now = new Date().toISOString()
  const receiptId = normalizeText(record.id) || `goods_receipt_management_${Date.now()}_${index}`
  const receiptDate = normalizeText(record.receiptDate) || getTodayKey()
  const receiptNo = normalizeReceiptNo(normalizeText(record.receiptNo), receiptDate, index)
  const purchaseOrderId = normalizeText(record.purchaseOrderId)
  const purchaseOrder = sourceData.purchaseOrders.find(order => order.id === purchaseOrderId)
  const supplierId = normalizeText(record.supplierId) || purchaseOrder?.supplierId || ''
  const warehouseId = normalizeText(record.warehouseId) || getWarehouseIdForOrder(purchaseOrderId, sourceData)
  const actorName = normalizeText(record.receivedByName) || normalizeText(record.receivedBy) || 'Mal Kabul'
  const rawItems = Array.isArray(record.items) ? record.items : []
  const items = rawItems
    .filter(isItemRecord)
    .map((item, itemIndex) => normalizeItem(item, itemIndex, receiptId, sourceData))
  const sourceItems = items.length > 0
    ? items
    : createItemsFromOrder(receiptId, purchaseOrderId, supplierId, receiptDate, sourceData)
  const inspection = GoodsReceiptInspectionService.normalize(
    record.inspection as Partial<GoodsReceiptInspection> | undefined,
    receiptId,
    actorName
  )
  const createdAt = normalizeText(record.createdAt) || now

  return {
    id: receiptId,
    receiptNo,
    goodsReceiptNo: normalizeText(record.goodsReceiptNo) || receiptNo,
    purchaseOrderId,
    purchaseOrderNo: normalizeText(record.purchaseOrderNo) || purchaseOrder?.orderNo || purchaseOrderId,
    supplierId,
    supplierName: normalizeText(record.supplierName) || getSupplierName(supplierId, sourceData),
    warehouseId,
    warehouseName: normalizeText(record.warehouseName) || getBranchName(warehouseId, sourceData),
    receiptDate,
    vehiclePlate: normalizeText(record.vehiclePlate),
    deliveredBy: normalizeText(record.deliveredBy) || getSupplierName(supplierId, sourceData),
    receivedBy: normalizeText(record.receivedBy) || actorName,
    receivedByName: actorName,
    status: normalizeStatus(record.status),
    notes: normalizeText(record.notes),
    description: normalizeText(record.description),
    inspection,
    history: normalizeHistory(record.history, receiptId, actorName),
    createdAt,
    updatedAt: normalizeText(record.updatedAt) || createdAt,
    items: sourceItems
  }
}

export const saveGoodsReceiptManagementRecords = (
  records: GoodsReceiptRecord[]
) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(GOODS_RECEIPT_MANAGEMENT_STORAGE_KEY, JSON.stringify(records))
}

export const loadGoodsReceiptManagementRecords = (
  sourceData: KpiSourceData
) => {
  const seedRecords = resolveReadModelList(() => createSeedRecords(sourceData))

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(GOODS_RECEIPT_MANAGEMENT_STORAGE_KEY)
  if(!storedRecords){
    if(seedRecords.length > 0) saveGoodsReceiptManagementRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizeGoodsReceipt(record, index, sourceData))

      saveGoodsReceiptManagementRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveGoodsReceiptManagementRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveGoodsReceiptManagementRecords(seedRecords)
  return seedRecords
}

export const filterGoodsReceiptManagementRecords = (
  records: GoodsReceiptRecord[],
  filters: GoodsReceiptFilters
) => records.filter(record => {
  const search = normalizeSearchText(filters.search)
  const searchTarget = [
    record.receiptNo,
    record.purchaseOrderNo,
    record.supplierName,
    record.warehouseName,
    record.vehiclePlate,
    record.deliveredBy,
    record.receivedByName,
    ...record.items.flatMap(item => [item.productName, item.stockItemName, item.lotNo, item.batchNo])
  ].join(' ')

  return (
    (filters.status === 'all' || record.status === filters.status)
    && (filters.supplierId === 'all' || record.supplierId === filters.supplierId)
    && (filters.warehouseId === 'all' || record.warehouseId === filters.warehouseId)
    && (!filters.date || record.receiptDate === filters.date)
    && (!search || normalizeSearchText(searchTarget).includes(search))
  )
})

export const getReceivablePurchaseOrders = (
  records: GoodsReceiptRecord[],
  sourceData: KpiSourceData
) => {
  const activePurchaseOrderIds = new Set(records
    .filter(record => record.status !== 'CANCELLED')
    .map(record => record.purchaseOrderId))
  const { rfqMap, purchaseRequestMap } = createMaps(sourceData)

  return sourceData.purchaseOrders
    .filter(order => order.status !== 'CANCELLED' && order.status !== 'COMPLETED')
    .filter(order => !activePurchaseOrderIds.has(order.id))
    .filter(order => getGoodsReceiptOrderLines(order, rfqMap, purchaseRequestMap).length > 0)
}

const upsertRecord = (
  records: GoodsReceiptRecord[],
  record: GoodsReceiptRecord
) => records.some(item => item.id === record.id)
  ? records.map(item => item.id === record.id ? record : item)
  : [record, ...records]

export const addGoodsReceiptFromPurchaseOrder = (
  purchaseOrderId: string,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadGoodsReceiptManagementRecords(sourceData)
  const record = createRecordFromPurchaseOrder(purchaseOrderId, sourceData, actorName, records)
  const validation = validateGoodsReceipt(record, sourceData)
  if(!validation.valid) throw new Error(validation.errors.join(' '))
  saveGoodsReceiptManagementRecords(upsertRecord(records, record))
  return record
}

export const updateGoodsReceiptInspection = (
  receiptId: string,
  inspectionInput: Partial<GoodsReceiptInspection>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadGoodsReceiptManagementRecords(sourceData)
  const record = records.find(item => item.id === receiptId)
  if(!record) throw new Error('Mal kabul kaydi bulunamadi.')
  if(record.status === 'CANCELLED') throw new Error('Iptal edilmis mal kabul icin inspection kaydedilemez.')

  const inspection = GoodsReceiptInspectionService.normalize({
    ...record.inspection,
    ...inspectionInput,
    checkedBy: actorName,
    checkedAt: new Date().toISOString()
  }, record.id, actorName)
  const nextRecord = appendGoodsReceiptHistory({
    ...record,
    inspection,
    status: record.status === 'WAITING' ? 'INSPECTING' : record.status
  }, 'INSPECTION_COMPLETED', actorName, `Inspection sonucu ${inspection.result} olarak kaydedildi.`)
  const validation = validateGoodsReceipt(nextRecord, sourceData, record)
  if(!validation.valid) throw new Error(validation.errors.join(' '))

  saveGoodsReceiptManagementRecords(upsertRecord(records, nextRecord))
  return nextRecord
}

export const updateGoodsReceiptStatus = (
  receiptId: string,
  status: GoodsReceiptManagementStatus,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadGoodsReceiptManagementRecords(sourceData)
  const record = records.find(item => item.id === receiptId)
  if(!record) throw new Error('Mal kabul kaydi bulunamadi.')
  if(record.status === 'CANCELLED' && status !== 'CANCELLED') throw new Error('Iptal edilmis mal kabul tekrar acilamaz.')
  if(record.status === status) return record

  const actionByStatus: Record<GoodsReceiptManagementStatus, GoodsReceiptHistoryAction> = {
    WAITING: 'VALIDATION',
    INSPECTING: 'INSPECTION_STARTED',
    ACCEPTED: 'ACCEPTED',
    PARTIAL_ACCEPTED: 'PARTIAL_ACCEPTED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED'
  }
  const nextRecord = appendGoodsReceiptHistory(
    {
      ...record,
      status
    },
    actionByStatus[status],
    actorName,
    `${record.receiptNo} ${GOODS_RECEIPT_MANAGEMENT_STATUS_LABELS[status]} durumuna alindi.`
  )
  const validation = validateGoodsReceipt(nextRecord, sourceData, record)
  if(!validation.valid) throw new Error(validation.errors.join(' '))

  saveGoodsReceiptManagementRecords(upsertRecord(records, nextRecord))
  return nextRecord
}

export const recordGoodsReceiptOutput = (
  receiptId: string,
  action: Extract<GoodsReceiptHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const records = loadGoodsReceiptManagementRecords(sourceData)
  const record = records.find(item => item.id === receiptId)
  if(!record) throw new Error('Mal kabul kaydi bulunamadi.')

  const nextRecord = appendGoodsReceiptHistory(
    record,
    action,
    actorName,
    action === 'EXCEL'
      ? `${record.receiptNo} Excel export edildi.`
      : `${record.receiptNo} cikti penceresi acildi.`
  )

  saveGoodsReceiptManagementRecords(upsertRecord(records, nextRecord))
  return nextRecord
}

export const GoodsReceiptService = {
  createDefaultFilters: createDefaultGoodsReceiptFilters,
  list: loadGoodsReceiptManagementRecords,
  save: saveGoodsReceiptManagementRecords,
  filter: filterGoodsReceiptManagementRecords,
  statistics: createGoodsReceiptStatistics,
  getReceivablePurchaseOrders,
  addFromPurchaseOrder: addGoodsReceiptFromPurchaseOrder,
  updateInspection: updateGoodsReceiptInspection,
  updateStatus: updateGoodsReceiptStatus,
  recordOutput: recordGoodsReceiptOutput,
  validate: validateGoodsReceipt,
  getNextNo: getNextGoodsReceiptManagementNo
}
