import type { Branch, StockCategory, StockItem, StockUnit } from '../types'
import type {
  PurchaseRequestActionLog,
  PurchaseRequestDepartment,
  PurchaseRequestHistoryEvent,
  PurchaseRequestHistoryType,
  PurchaseRequestItem,
  PurchaseRequestPriority,
  PurchaseRequestRecord,
  PurchaseRequestSource,
  PurchaseRequestStatus
} from './purchase-request.types'

export const PURCHASE_REQUEST_STORAGE_KEY = 'ra_purchase_requests'
export const DEFAULT_PURCHASE_REQUEST_CURRENCY = 'TRY'
export const PURCHASE_REQUEST_SEED_COUNT = 50

export const PURCHASE_REQUEST_STATUSES: PurchaseRequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'PURCHASE_ORDER_CREATED'
]

export const PURCHASE_REQUEST_PRIORITIES: PurchaseRequestPriority[] = [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT'
]

export const PURCHASE_REQUEST_SOURCES: PurchaseRequestSource[] = [
  'CRITICAL_STOCK',
  'MINIMUM_STOCK',
  'PRODUCTION_ORDER',
  'MANUAL',
  'WASTE',
  'QUALITY_REJECTION',
  'WAREHOUSE_TRANSFER',
  'PLANNED_PRODUCTION'
]

export const PURCHASE_REQUEST_DEPARTMENTS: PurchaseRequestDepartment[] = [
  'PRODUCTION',
  'WAREHOUSE',
  'QUALITY',
  'PACKAGING',
  'SHIPPING',
  'ADMINISTRATION',
  'PURCHASING'
]

export const PURCHASE_REQUEST_STATUS_LABELS: Record<PurchaseRequestStatus, string> = {
  DRAFT: 'Taslak',
  SUBMITTED: 'Onay Bekliyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  CANCELLED: 'İptal Edildi',
  PURCHASE_ORDER_CREATED: 'Purchase Order Oluşturuldu'
}

export const PURCHASE_REQUEST_PRIORITY_LABELS: Record<PurchaseRequestPriority, string> = {
  LOW: 'Düşük',
  NORMAL: 'Normal',
  HIGH: 'Yüksek',
  URGENT: 'Acil'
}

export const PURCHASE_REQUEST_SOURCE_LABELS: Record<PurchaseRequestSource, string> = {
  CRITICAL_STOCK: 'Kritik Stok',
  MINIMUM_STOCK: 'Minimum Stok',
  PRODUCTION_ORDER: 'Üretim Emri',
  MANUAL: 'Manuel Talep',
  WASTE: 'Fire',
  QUALITY_REJECTION: 'Kalite Reddi',
  WAREHOUSE_TRANSFER: 'Depo Transferi',
  PLANNED_PRODUCTION: 'Planlı Üretim'
}

export const PURCHASE_REQUEST_DEPARTMENT_LABELS: Record<PurchaseRequestDepartment, string> = {
  PRODUCTION: 'Üretim',
  WAREHOUSE: 'Depo',
  QUALITY: 'Kalite',
  PACKAGING: 'Paketleme',
  SHIPPING: 'Sevkiyat',
  ADMINISTRATION: 'Yönetim',
  PURCHASING: 'Satın Alma'
}

type RawPurchaseRequestRecord = Partial<Record<keyof PurchaseRequestRecord, unknown>> & Record<string, unknown>
type RawPurchaseRequestItem = Partial<Record<keyof PurchaseRequestItem, unknown>> & Record<string, unknown>
type RawPurchaseRequestHistory = Partial<Record<keyof PurchaseRequestHistoryEvent, unknown>> & Record<string, unknown>
type RawPurchaseRequestActionLog = Partial<Record<keyof PurchaseRequestActionLog, unknown>> & Record<string, unknown>

type PurchaseRequestBlueprint = {
  title: string
  description: string
  source: PurchaseRequestSource
  department: PurchaseRequestDepartment
  priority: PurchaseRequestPriority
  requester: string
  itemNote: string
}

const DEFAULT_STATUS: PurchaseRequestStatus = 'DRAFT'
const DEFAULT_PRIORITY: PurchaseRequestPriority = 'NORMAL'
const DEFAULT_SOURCE: PurchaseRequestSource = 'MANUAL'
const DEFAULT_DEPARTMENT: PurchaseRequestDepartment = 'PRODUCTION'
const DEFAULT_UNIT: StockUnit = 'adet'
const SEED_BASE_DATE = '2026-07-01'

const requestBlueprints: PurchaseRequestBlueprint[] = [
  {
    title: 'Kritik stok tamamlama',
    description: 'Kritik stok raporundan satın alma departmanına iletilen resmi talep.',
    source: 'CRITICAL_STOCK',
    department: 'WAREHOUSE',
    priority: 'URGENT',
    requester: 'Merkez Depo',
    itemNote: 'Kritik stok uyarısından eklendi.'
  },
  {
    title: 'Minimum stok yenileme',
    description: 'Minimum stok altına düşen ürünlerin planlı satın alma talebi.',
    source: 'MINIMUM_STOCK',
    department: 'WAREHOUSE',
    priority: 'HIGH',
    requester: 'Depo Planlama',
    itemNote: 'Minimum stok seviyesine göre hesaplandı.'
  },
  {
    title: 'Üretim emri hammadde ihtiyacı',
    description: 'Açık üretim emri reçete ihtiyaçları için oluşturulan talep.',
    source: 'PRODUCTION_ORDER',
    department: 'PRODUCTION',
    priority: 'HIGH',
    requester: 'Üretim Planlama',
    itemNote: 'Üretim emri reçete açığından eklendi.'
  },
  {
    title: 'Manuel operasyon talebi',
    description: 'Departman tarafından manuel girilen satın alma ihtiyacı.',
    source: 'MANUAL',
    department: 'PURCHASING',
    priority: 'NORMAL',
    requester: 'Satın Alma',
    itemNote: 'Manuel talep satırı.'
  },
  {
    title: 'Fire sonrası stok tamamlaması',
    description: 'Fire kayıtlarından doğan stok eksiklerinin satın alma talebi.',
    source: 'WASTE',
    department: 'WAREHOUSE',
    priority: 'NORMAL',
    requester: 'Depo Operasyon',
    itemNote: 'Fire kaynaklı eksik.'
  },
  {
    title: 'Kalite reddi yenileme talebi',
    description: 'Kalite reddi nedeniyle kullanılamayan ürünlerin yenileme talebi.',
    source: 'QUALITY_REJECTION',
    department: 'QUALITY',
    priority: 'HIGH',
    requester: 'Kalite Güvence',
    itemNote: 'Kalite reddi sonrası talep edildi.'
  },
  {
    title: 'Depo transferi sonrası tamamlama',
    description: 'Şube/depo transferleri sonrası ana depo stok dengesini tamamlayan talep.',
    source: 'WAREHOUSE_TRANSFER',
    department: 'WAREHOUSE',
    priority: 'NORMAL',
    requester: 'Depo Transfer Ekibi',
    itemNote: 'Depo transferi sonrası tamamlanacak.'
  },
  {
    title: 'Planlı üretim hammadde hazırlığı',
    description: 'Planlı üretim takvimindeki reçete ihtiyaçları için ön talep.',
    source: 'PLANNED_PRODUCTION',
    department: 'PRODUCTION',
    priority: 'NORMAL',
    requester: 'Planlı Üretim',
    itemNote: 'Planlı üretimden hesaplandı.'
  }
]

const statusSequence: PurchaseRequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'PURCHASE_ORDER_CREATED',
  'SUBMITTED',
  'APPROVED',
  'DRAFT',
  'SUBMITTED'
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawPurchaseRequestRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isItemRecord = (value: unknown): value is RawPurchaseRequestItem => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isHistoryRecord = (value: unknown): value is RawPurchaseRequestHistory => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const isActionLogRecord = (value: unknown): value is RawPurchaseRequestActionLog => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const roundQuantity = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const addDays = (dateValue: string, days: number) => {
  const date = new Date(`${dateValue}T00:00:00`)
  if(Number.isNaN(date.getTime())) return dateValue
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const addMinutes = (dateTimeValue: string, minutes: number) => {
  const date = new Date(dateTimeValue)
  if(Number.isNaN(date.getTime())) return dateTimeValue
  date.setMinutes(date.getMinutes() + minutes)
  return date.toISOString()
}

const normalizeStatus = (value: unknown): PurchaseRequestStatus => {
  const normalized = normalizeText(value).toUpperCase()
  if(normalized === 'WAITING_APPROVAL' || normalized === 'PENDING_APPROVAL') return 'SUBMITTED'
  if(normalized === 'PO_CREATED' || normalized === 'ORDER_CREATED') return 'PURCHASE_ORDER_CREATED'
  return PURCHASE_REQUEST_STATUSES.includes(normalized as PurchaseRequestStatus)
    ? normalized as PurchaseRequestStatus
    : DEFAULT_STATUS
}

const normalizePriority = (value: unknown): PurchaseRequestPriority => {
  const normalized = normalizeText(value).toUpperCase()
  return PURCHASE_REQUEST_PRIORITIES.includes(normalized as PurchaseRequestPriority)
    ? normalized as PurchaseRequestPriority
    : DEFAULT_PRIORITY
}

const normalizeSource = (value: unknown): PurchaseRequestSource => {
  const normalized = normalizeText(value).toUpperCase()
  return PURCHASE_REQUEST_SOURCES.includes(normalized as PurchaseRequestSource)
    ? normalized as PurchaseRequestSource
    : DEFAULT_SOURCE
}

const normalizeDepartment = (value: unknown): PurchaseRequestDepartment => {
  const normalized = normalizeText(value).toUpperCase()
  return PURCHASE_REQUEST_DEPARTMENTS.includes(normalized as PurchaseRequestDepartment)
    ? normalized as PurchaseRequestDepartment
    : DEFAULT_DEPARTMENT
}

const normalizeHistoryType = (value: unknown): PurchaseRequestHistoryType => {
  const normalized = normalizeText(value).toUpperCase()
  const historyTypes: PurchaseRequestHistoryType[] = [
    'CREATED',
    'UPDATED',
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'CANCELLED',
    'SUGGESTION_CREATED',
    'NOTE_ADDED',
    'PO_MARKED'
  ]

  return historyTypes.includes(normalized as PurchaseRequestHistoryType)
    ? normalized as PurchaseRequestHistoryType
    : 'UPDATED'
}

const normalizeDate = (value: unknown, fallback: string) => normalizeText(value) || fallback

const normalizeMatchKey = (value: string) => (
  value.trim().toLocaleLowerCase('tr-TR')
)

const getEstimatedUnitPrice = (stockItem: StockItem, index = 0) => (
  roundMoney(stockItem.lastPurchasePrice
    || stockItem.unitPurchasePrice
    || stockItem.averageCost
    || (18 + (index % 11) * 12.5))
)

const getActiveBranch = (branches: Branch[], index: number) => {
  const activeBranches = branches.filter(branch => branch.isActive)
  const sourceBranches = activeBranches.length > 0 ? activeBranches : branches
  return sourceBranches[index % Math.max(sourceBranches.length, 1)]
}

const getStockItem = (stockItems: StockItem[], index: number) => (
  stockItems[index % Math.max(stockItems.length, 1)]
)

const getRequestQuantity = (
  stockItem: StockItem,
  source: PurchaseRequestSource,
  requestIndex: number,
  itemIndex: number
) => {
  if(source === 'CRITICAL_STOCK' || source === 'MINIMUM_STOCK'){
    const targetQty = Math.max(stockItem.minQty * (source === 'CRITICAL_STOCK' ? 2.25 : 1.5), 1)
    return roundQuantity(Math.max(targetQty - stockItem.currentQty, 1 + itemIndex))
  }

  if(source === 'PRODUCTION_ORDER' || source === 'PLANNED_PRODUCTION'){
    return roundQuantity((itemIndex + 1) * (6 + (requestIndex % 5)))
  }

  if(source === 'WASTE' || source === 'QUALITY_REJECTION'){
    return roundQuantity((itemIndex + 1) * (2 + (requestIndex % 4)))
  }

  return roundQuantity((itemIndex + 1) * (4 + (requestIndex % 6)))
}

const createHistoryEvent = (
  requestId: string,
  type: PurchaseRequestHistoryType,
  description: string,
  actorName: string,
  createdAt: string,
  index: number
): PurchaseRequestHistoryEvent => ({
  id: `${requestId}_history_${String(index + 1).padStart(2, '0')}`,
  type,
  description,
  actorName,
  createdAt
})

const createActionLog = (
  requestId: string,
  type: string,
  message: string,
  actorName: string,
  createdAt: string,
  index: number
): PurchaseRequestActionLog => ({
  id: `${requestId}_log_${String(index + 1).padStart(2, '0')}`,
  type,
  message,
  actorName,
  createdAt
})

const createSeedHistory = (
  requestId: string,
  requestNo: string,
  status: PurchaseRequestStatus,
  source: PurchaseRequestSource,
  requester: string,
  createdAt: string
) => {
  const history: PurchaseRequestHistoryEvent[] = [
    createHistoryEvent(requestId, 'CREATED', `${requestNo} ${PURCHASE_REQUEST_SOURCE_LABELS[source]} kaynağından oluşturuldu.`, requester, createdAt, 0)
  ]

  if(status !== 'DRAFT'){
    history.unshift(createHistoryEvent(requestId, 'SUBMITTED', `${requestNo} onaya gönderildi.`, requester, addMinutes(createdAt, 45), history.length))
  }
  if(status === 'APPROVED' || status === 'PURCHASE_ORDER_CREATED'){
    history.unshift(createHistoryEvent(requestId, 'APPROVED', `${requestNo} satın alma yöneticisi tarafından onaylandı.`, 'Satın Alma Müdürü', addMinutes(createdAt, 120), history.length))
  }
  if(status === 'REJECTED'){
    history.unshift(createHistoryEvent(requestId, 'REJECTED', `${requestNo} bütçe revizyonu nedeniyle reddedildi.`, 'Satın Alma Müdürü', addMinutes(createdAt, 110), history.length))
  }
  if(status === 'CANCELLED'){
    history.unshift(createHistoryEvent(requestId, 'CANCELLED', `${requestNo} departman talebi üzerine iptal edildi.`, requester, addMinutes(createdAt, 95), history.length))
  }
  if(status === 'PURCHASE_ORDER_CREATED'){
    history.unshift(createHistoryEvent(requestId, 'PO_MARKED', `${requestNo} için downstream Purchase Order kaydı oluştu olarak işaretlendi.`, 'Satın Alma', addMinutes(createdAt, 190), history.length))
  }

  return history
}

const createSeedActionLogs = (
  requestId: string,
  source: PurchaseRequestSource,
  requester: string,
  createdAt: string
) => [
  createActionLog(requestId, 'READ_MODEL', `${PURCHASE_REQUEST_SOURCE_LABELS[source]} read modelinden ihtiyaç satırları hazırlandı.`, 'Sistem', createdAt, 0),
  createActionLog(requestId, 'VALIDATION', 'Pasif ürün, pasif depo ve pasif supplier kontrolleri çalıştırıldı.', 'Sistem', addMinutes(createdAt, 2), 1),
  createActionLog(requestId, 'CREATE', 'Purchase Request kaydı oluşturuldu.', requester, addMinutes(createdAt, 4), 2)
]

const buildSeedItem = (
  requestId: string,
  stockItem: StockItem,
  source: PurchaseRequestSource,
  quantity: number,
  notes: string,
  index: number
): PurchaseRequestItem => {
  const estimatedUnitPrice = getEstimatedUnitPrice(stockItem, index)

  return {
    id: `${requestId}_item_${String(index + 1).padStart(2, '0')}`,
    requestId,
    stockItemId: stockItem.id,
    categoryId: stockItem.categoryId,
    requestedQuantity: quantity,
    quantity,
    unit: stockItem.unit,
    currentStock: stockItem.currentQty,
    minimumStock: stockItem.minQty,
    estimatedUnitPrice,
    estimatedTotalPrice: roundMoney(quantity * estimatedUnitPrice),
    source,
    notes
  }
}

export const getNextPurchaseRequestNo = (records: PurchaseRequestRecord[]) => {
  const maxNo = records.reduce((max, request) => {
    const match = request.requestNo.match(/PR-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `PR-${String(maxNo + 1).padStart(6, '0')}`
}

export const createPurchaseRequestMockData = (
  stockItems: StockItem[],
  branches: Branch[],
  stockCategories: StockCategory[] = []
): PurchaseRequestRecord[] => {
  if(stockItems.length === 0) return []

  const activeStockItems = stockItems.filter(item => item.active)
  const sourceStockItems = activeStockItems.length > 0 ? activeStockItems : stockItems

  return Array.from({ length: PURCHASE_REQUEST_SEED_COUNT }, (_, requestIndex) => {
    const requestId = `purchase_request_${String(requestIndex + 1).padStart(3, '0')}`
    const requestNo = `PR-${String(requestIndex + 1).padStart(6, '0')}`
    const blueprint = requestBlueprints[requestIndex % requestBlueprints.length]
    const requestDate = addDays(SEED_BASE_DATE, requestIndex % 26)
    const requiredDate = addDays(requestDate, 2 + (requestIndex % 6))
    const branch = getActiveBranch(branches, requestIndex)
    const branchId = branch?.id || sourceStockItems[0]?.branchId || ''
    const itemCount = (requestIndex % 8) + 1
    const createdAt = `${requestDate}T${String(8 + (requestIndex % 9)).padStart(2, '0')}:${String((requestIndex * 7) % 60).padStart(2, '0')}:00.000Z`
    const status = statusSequence[requestIndex % statusSequence.length] || 'DRAFT'
    const firstStockItem = getStockItem(sourceStockItems, requestIndex)
    const category = stockCategories.find(item => item.id === firstStockItem?.categoryId)

    const items = Array.from({ length: itemCount }, (_, itemIndex) => {
      const stockItem = getStockItem(sourceStockItems, requestIndex * 3 + itemIndex)
      const quantity = getRequestQuantity(stockItem, blueprint.source, requestIndex, itemIndex)
      return buildSeedItem(requestId, stockItem, blueprint.source, quantity, blueprint.itemNote, itemIndex)
    })

    return {
      id: requestId,
      requestNo,
      title: `${blueprint.title} ${category ? `- ${category.name}` : ''}`.trim(),
      description: blueprint.description,
      requestDate,
      requiredDate,
      requester: blueprint.requester,
      department: blueprint.department,
      warehouseId: branchId,
      branchId,
      source: blueprint.source,
      priority: requestIndex % 11 === 0 ? 'URGENT' : blueprint.priority,
      status,
      notes: `${PURCHASE_REQUEST_SOURCE_LABELS[blueprint.source]} kaynağı ile örnek veri olarak oluşturuldu.`,
      createdAt,
      updatedAt: createdAt,
      items,
      history: createSeedHistory(requestId, requestNo, status, blueprint.source, blueprint.requester, createdAt),
      actionLogs: createSeedActionLogs(requestId, blueprint.source, blueprint.requester, createdAt)
    }
  })
}

const normalizeHistory = (
  item: RawPurchaseRequestHistory,
  requestId: string,
  index: number,
  fallbackCreatedAt: string
): PurchaseRequestHistoryEvent => ({
  id: normalizeText(item.id) || `${requestId}_history_${String(index + 1).padStart(2, '0')}`,
  type: normalizeHistoryType(item.type),
  description: normalizeText(item.description) || 'Purchase Request güncellendi.',
  actorName: normalizeText(item.actorName) || 'Sistem',
  createdAt: normalizeText(item.createdAt) || fallbackCreatedAt
})

const normalizeActionLog = (
  item: RawPurchaseRequestActionLog,
  requestId: string,
  index: number,
  fallbackCreatedAt: string
): PurchaseRequestActionLog => ({
  id: normalizeText(item.id) || `${requestId}_log_${String(index + 1).padStart(2, '0')}`,
  type: normalizeText(item.type) || 'LOG',
  message: normalizeText(item.message) || 'Purchase Request işlem kaydı.',
  actorName: normalizeText(item.actorName) || 'Sistem',
  createdAt: normalizeText(item.createdAt) || fallbackCreatedAt
})

const normalizeItem = (
  item: RawPurchaseRequestItem,
  requestId: string,
  index: number,
  stockItems: StockItem[],
  fallbackSource: PurchaseRequestSource
): PurchaseRequestItem => {
  const requestedStockItemId = normalizeText(item.stockItemId)
  const fallbackStockItem = stockItems[index % Math.max(stockItems.length, 1)]
  const stockItem = stockItems.find(record => record.id === requestedStockItemId) || fallbackStockItem
  const requestedQuantity = normalizePositiveNumber(item.requestedQuantity ?? item.quantity)
  const estimatedUnitPrice = normalizeNonNegativeNumber(item.estimatedUnitPrice)

  return {
    id: normalizeText(item.id) || `${requestId}_item_${String(index + 1).padStart(2, '0')}`,
    requestId,
    stockItemId: stockItem?.id || requestedStockItemId || '',
    categoryId: normalizeText(item.categoryId) || stockItem?.categoryId || '',
    requestedQuantity,
    quantity: requestedQuantity,
    unit: stockItem?.unit || item.unit as StockUnit || DEFAULT_UNIT,
    currentStock: normalizeText(item.currentStock) ? normalizeNonNegativeNumber(item.currentStock) : stockItem?.currentQty || 0,
    minimumStock: normalizeText(item.minimumStock) ? normalizeNonNegativeNumber(item.minimumStock) : stockItem?.minQty || 0,
    estimatedUnitPrice,
    estimatedTotalPrice: roundMoney(requestedQuantity * estimatedUnitPrice),
    suggestedSupplierId: normalizeText(item.suggestedSupplierId) || undefined,
    source: normalizeSource(item.source || fallbackSource),
    notes: normalizeText(item.notes || item.note)
  }
}

const normalizePurchaseRequest = (
  item: RawPurchaseRequestRecord,
  index: number,
  stockItems: StockItem[],
  branches: Branch[]
): PurchaseRequestRecord => {
  const now = new Date().toISOString()
  const today = now.slice(0, 10)
  const id = normalizeText(item.id) || `purchase_request_${Date.now()}_${index}`
  const activeBranchIds = new Set(branches.filter(branch => branch.isActive).map(branch => branch.id))
  const allBranchIds = new Set(branches.map(branch => branch.id))
  const requestedBranchId = normalizeText(item.branchId)
  const requestedWarehouseId = normalizeText(item.warehouseId)
  const branchId = activeBranchIds.has(requestedBranchId) || allBranchIds.has(requestedBranchId)
    ? requestedBranchId
    : branches[0]?.id || requestedBranchId || ''
  const source = normalizeSource(item.source)
  const rawItems = Array.isArray(item.items)
    ? item.items
    : Array.isArray(item.requestItems)
      ? item.requestItems
      : []
  const createdAt = normalizeText(item.createdAt) || now
  const requestNo = normalizeText(item.requestNo) || `PR-${String(index + 1).padStart(6, '0')}`
  const status = normalizeStatus(item.status)
  const requester = normalizeText(item.requester) || normalizeText(item.createdBy) || 'Talep Eden'
  const history = Array.isArray(item.history)
    ? item.history.filter(isHistoryRecord).map((record, historyIndex) => normalizeHistory(record, id, historyIndex, createdAt))
    : createSeedHistory(id, requestNo, status, source, requester, createdAt)
  const actionLogs = Array.isArray(item.actionLogs)
    ? item.actionLogs.filter(isActionLogRecord).map((record, actionIndex) => normalizeActionLog(record, id, actionIndex, createdAt))
    : createSeedActionLogs(id, source, requester, createdAt)

  return {
    id,
    requestNo,
    title: normalizeText(item.title) || `Satın Alma Talebi ${index + 1}`,
    description: normalizeText(item.description),
    requestDate: normalizeDate(item.requestDate, today),
    requiredDate: normalizeDate(item.requiredDate, today),
    requester,
    department: normalizeDepartment(item.department),
    warehouseId: activeBranchIds.has(requestedWarehouseId) || allBranchIds.has(requestedWarehouseId)
      ? requestedWarehouseId
      : branchId,
    branchId,
    source,
    priority: normalizePriority(item.priority),
    status,
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt,
    items: rawItems
      .filter(isItemRecord)
      .map((record, itemIndex) => normalizeItem(record, id, itemIndex, stockItems, source)),
    history,
    actionLogs
  }
}

const mergeSeedRecords = (
  records: PurchaseRequestRecord[],
  seedRecords: PurchaseRequestRecord[]
) => {
  if(records.length >= PURCHASE_REQUEST_SEED_COUNT) return records

  const existingIds = new Set(records.map(record => record.id))
  const existingRequestNos = new Set(records.map(record => record.requestNo))
  const missingSeedRecords = seedRecords.filter(record => (
    !existingIds.has(record.id)
    && !existingRequestNos.has(record.requestNo)
  ))

  return [...records, ...missingSeedRecords].slice(0, PURCHASE_REQUEST_SEED_COUNT)
}

export const savePurchaseRequestRecords = (records: PurchaseRequestRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(PURCHASE_REQUEST_STORAGE_KEY, JSON.stringify(records))
}

export const loadPurchaseRequestRecords = (
  stockItems: StockItem[],
  branches: Branch[],
  stockCategories: StockCategory[] = []
) => {
  const seedRecords = createPurchaseRequestMockData(stockItems, branches, stockCategories)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(PURCHASE_REQUEST_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) savePurchaseRequestRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((record, index) => normalizePurchaseRequest(record, index, stockItems, branches))
      const mergedRecords = mergeSeedRecords(normalizedRecords, seedRecords)

      savePurchaseRequestRecords(mergedRecords)
      return mergedRecords
    }
  } catch {
    if(seedRecords.length > 0) savePurchaseRequestRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) savePurchaseRequestRecords(seedRecords)
  return seedRecords
}
