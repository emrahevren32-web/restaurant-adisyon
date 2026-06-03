import {
  ActionLog,
  ActionLogType,
  ClosedBill,
  KitchenOrder,
  KitchenOrderStatus,
  Product,
  ProductCategory,
  QRAuditEvent,
  AuditEntityType,
  AuditEventType,
  QRRejectReason,
  QRRequest,
  QRRequestHistory,
  QRRequestItem,
  QRRequestStatus,
  StockCategory,
  StockItem,
  StockMovement,
  StockMovementAuditEvent,
  StockMovementAuditEventType,
  StockMovementReason,
  StockMovementSource,
  StockMovementType,
  StockUnit,
  SystemSettings,
  TableState,
  User,
  WaiterCall,
  WaiterCallHistory,
  WaiterCallStatus
} from './types'

const KEY_PRODUCTS = 'ra_products'
const KEY_CATEGORIES = 'ra_categories'
const KEY_STOCK_ITEMS = 'ra_stock_items'
const KEY_STOCK_CATEGORIES = 'ra_stock_categories'
const KEY_STOCK_MOVEMENTS = 'ra_stock_movements'
const KEY_STOCK_MOVEMENT_AUDIT = 'ra_stock_movement_audit'
const KEY_TABLES = 'ra_tables'
const KEY_CLOSED = 'ra_closed'
const KEY_USERS = 'ra_users'
const KEY_AUTH = 'ra_auth'
const KEY_LOGS = 'ra_logs'
const KEY_KITCHEN = 'ra_kitchen_orders'
const KEY_QR_REQUESTS = 'ra_qr_requests'
const KEY_QR_REQUEST_HISTORY = 'ra_qr_request_history'
const KEY_QR_AUDIT_EVENTS = 'ra_qr_audit_events'
const KEY_SETTINGS = 'ra_settings'
const KEY_WAITER_CALLS = 'ra_waiter_calls'
const KEY_WAITER_CALL_HISTORY = 'ra_waiter_call_history'

const DEFAULT_CATEGORY_ID = 'cat_general'
const DEFAULT_STOCK_CATEGORY_ID = 'stock_cat_general'
const STOCK_UNITS: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
const STOCK_MOVEMENT_TYPES: StockMovementType[] = ['Giriş', 'Çıkış', 'Sayım Düzeltme']
const STOCK_MOVEMENT_SOURCES: StockMovementSource[] = ['Manuel', 'Reçete', 'Adisyon', 'Sayım', 'İade']
const STOCK_MOVEMENT_REASONS: StockMovementReason[] = ['Satın Alma', 'İade', 'Fire', 'Kullanım', 'Sayım Fazlası', 'Sayım Eksiği', 'Ters Hareket', 'Diğer']

export const DEFAULT_SETTINGS: SystemSettings = {
  restaurantName: 'Restaurant Adisyon',
  logoUrl: '',
  vatRate: 10,
  currency: 'TRY'
}

const createDefaultCategory = (): ProductCategory => ({
  id: DEFAULT_CATEGORY_ID,
  name: 'Genel',
  active: true,
  createdAt: new Date().toISOString()
})

const createDefaultStockCategory = (): StockCategory => ({
  id: DEFAULT_STOCK_CATEGORY_ID,
  name: 'Genel',
  active: true,
  createdAt: new Date().toISOString()
})

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

const getAppStorageKeys = () => {
  const keys: string[] = []

  for(let index = 0; index < localStorage.length; index += 1){
    const key = localStorage.key(index)
    if(key?.startsWith('ra_')) keys.push(key)
  }

  return keys
}

const normalizeCategory = (item: Partial<ProductCategory>): ProductCategory => ({
  id: String(item.id || `cat_${Date.now()}`),
  name: String(item.name || 'Genel').trim() || 'Genel',
  active: item.active !== false,
  createdAt: item.createdAt || new Date().toISOString()
})

const normalizeProduct = (item: Partial<Product>, fallbackCategoryId = DEFAULT_CATEGORY_ID): Product => {
  const price = Number(item.price)

  return {
    id: String(item.id || `prd_${Date.now()}`),
    name: String(item.name || 'İsimsiz Ürün').trim() || 'İsimsiz Ürün',
    price: Number.isFinite(price) ? price : 0,
    categoryId: item.categoryId || fallbackCategoryId,
    description: item.description || '',
    active: item.active !== false,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt
  }
}

const normalizeStockUnit = (value: unknown): StockUnit => {
  return STOCK_UNITS.includes(value as StockUnit) ? value as StockUnit : 'adet'
}

const normalizeStockCategory = (item: Partial<StockCategory>): StockCategory => ({
  id: String(item.id || `stock_cat_${Date.now()}`),
  name: String(item.name || 'Genel').trim() || 'Genel',
  active: item.active !== false,
  createdAt: item.createdAt || new Date().toISOString(),
  updatedAt: item.updatedAt
})

const normalizeStockItem = (item: Partial<StockItem>, fallbackCategoryId = DEFAULT_STOCK_CATEGORY_ID): StockItem => {
  const currentQty = Number(item.currentQty)
  const minQty = Number(item.minQty)
  const lastPurchasePrice = Number(item.lastPurchasePrice)

  return {
    id: String(item.id || `stock_${Date.now()}`),
    name: String(item.name || 'İsimsiz Stok Kartı').trim() || 'İsimsiz Stok Kartı',
    categoryId: item.categoryId || fallbackCategoryId,
    unit: normalizeStockUnit(item.unit),
    currentQty: Number.isFinite(currentQty) ? Math.max(0, currentQty) : 0,
    minQty: Number.isFinite(minQty) ? Math.max(0, minQty) : 0,
    sku: item.sku || '',
    barcode: item.barcode || '',
    description: item.description || '',
    active: item.active !== false,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt,
    lastPurchasePrice: Number.isFinite(lastPurchasePrice) && lastPurchasePrice >= 0 ? lastPurchasePrice : undefined,
    lastSupplierName: item.lastSupplierName || ''
  }
}

const normalizeStockMovementType = (value: unknown): StockMovementType => {
  return STOCK_MOVEMENT_TYPES.includes(value as StockMovementType) ? value as StockMovementType : 'Giriş'
}

const normalizeStockMovementSource = (value: unknown): StockMovementSource => {
  return STOCK_MOVEMENT_SOURCES.includes(value as StockMovementSource) ? value as StockMovementSource : 'Manuel'
}

const normalizeStockMovementReason = (value: unknown): StockMovementReason => {
  return STOCK_MOVEMENT_REASONS.includes(value as StockMovementReason) ? value as StockMovementReason : 'Diğer'
}

const normalizeStockMovement = (item: Partial<StockMovement>): StockMovement => {
  const qty = Number(item.qty)
  const previousQty = Number(item.previousQty)
  const nextQty = Number(item.nextQty)
  const purchasePrice = Number(item.purchasePrice)
  const timestamp = item.createdAt || new Date().toISOString()

  return {
    id: String(item.id || `stock_move_${Date.now()}`),
    stockItemId: String(item.stockItemId || ''),
    stockItemName: String(item.stockItemName || 'Stok Kartı'),
    type: normalizeStockMovementType(item.type),
    source: normalizeStockMovementSource(item.source),
    reason: normalizeStockMovementReason(item.reason),
    qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
    unit: normalizeStockUnit(item.unit),
    previousQty: Number.isFinite(previousQty) ? Math.max(0, previousQty) : 0,
    nextQty: Number.isFinite(nextQty) ? Math.max(0, nextQty) : 0,
    purchasePrice: Number.isFinite(purchasePrice) && purchasePrice >= 0 ? purchasePrice : undefined,
    supplierName: item.supplierName || '',
    invoiceNo: item.invoiceNo || '',
    description: item.description || '',
    movementDate: item.movementDate || timestamp,
    createdAt: timestamp,
    createdByUserId: String(item.createdByUserId || ''),
    createdByFullName: String(item.createdByFullName || 'Bilinmeyen Kullanıcı'),
    reversesMovementId: item.reversesMovementId,
    reversedByMovementId: item.reversedByMovementId,
    reversedAt: item.reversedAt
  }
}

const normalizeStockMovementAuditEventType = (value: unknown): StockMovementAuditEventType => {
  return value === 'reversed' ? 'reversed' : 'created'
}

const normalizeStockMovementAuditEvent = (item: Partial<StockMovementAuditEvent>): StockMovementAuditEvent => ({
  id: String(item.id || `stock_audit_${Date.now()}`),
  movementId: String(item.movementId || ''),
  stockItemId: String(item.stockItemId || ''),
  eventType: normalizeStockMovementAuditEventType(item.eventType),
  userId: String(item.userId || ''),
  userName: String(item.userName || 'Bilinmeyen Kullanıcı'),
  timestamp: item.timestamp || new Date().toISOString(),
  before: item.before,
  after: item.after,
  note: item.note || ''
})

const normalizeKitchenStatus = (value: unknown): KitchenOrderStatus => {
  if(value === 'Hazırlanıyor' || value === 'Hazır') return value
  return 'Yeni Sipariş'
}

const normalizeKitchenOrder = (item: Partial<KitchenOrder>): KitchenOrder => {
  const timestamp = item.createdAt || new Date().toISOString()

  return {
    id: String(item.id || `kitchen_${Date.now()}`),
    tableId: String(item.tableId || ''),
    tableName: String(item.tableName || 'Masa'),
    waiterId: String(item.waiterId || ''),
    waiterName: String(item.waiterName || 'Bilinmeyen Garson'),
    status: normalizeKitchenStatus(item.status),
    items: (item.items || []).map(orderItem => ({
      productId: String(orderItem.productId || ''),
      productName: String(orderItem.productName || 'Ürün'),
      qty: Math.max(1, Number(orderItem.qty) || 1),
      isGift: orderItem.isGift
    })).filter(orderItem => orderItem.productId),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeQRRequestStatus = (value: unknown): QRRequestStatus => {
  if(value === 'Onaylandı' || value === 'Reddedildi' || value === 'Garson Onayı Bekliyor') return value
  return 'Garson Onayı Bekliyor'
}

const normalizeQRRequestItem = (orderItem: Partial<QRRequestItem>): QRRequestItem => ({
  productId: String(orderItem.productId || ''),
  productName: String(orderItem.productName || 'Ürün'),
  unitPrice: Math.max(0, Number(orderItem.unitPrice) || 0),
  qty: Math.max(1, Number(orderItem.qty) || 1)
})

const normalizeQRRejectReason = (value: unknown): QRRejectReason | undefined => {
  if(
    value === 'Ürün mevcut değil'
    || value === 'Mutfak kapalı'
    || value === 'Müşteri iptali'
    || value === 'Hatalı masa'
    || value === 'Stok yetersiz'
    || value === 'Diğer'
  ){
    return value
  }

  return undefined
}

const normalizeQRRequest = (item: Partial<QRRequest>): QRRequest => {
  const timestamp = item.createdAt || new Date().toISOString()
  const items = (item.items || []).map(normalizeQRRequestItem).filter(orderItem => orderItem.productId)
  const originalItems = (item.originalItems || items).map(normalizeQRRequestItem).filter(orderItem => orderItem.productId)

  return {
    id: String(item.id || `qr_${Date.now()}`),
    tableId: String(item.tableId || ''),
    tableName: String(item.tableName || 'Masa'),
    items,
    originalItems,
    status: normalizeQRRequestStatus(item.status),
    customerNote: item.customerNote || '',
    staffNote: item.staffNote || '',
    createdAt: timestamp,
    updatedAt: item.updatedAt,
    updatedByUserId: item.updatedByUserId,
    updatedByFullName: item.updatedByFullName,
    editCount: Math.max(0, Number(item.editCount) || 0),
    approvedAt: item.approvedAt,
    approvedByUserId: item.approvedByUserId,
    approvedByFullName: item.approvedByFullName,
    rejectedAt: item.rejectedAt,
    rejectedByUserId: item.rejectedByUserId,
    rejectedByFullName: item.rejectedByFullName,
    rejectReason: normalizeQRRejectReason(item.rejectReason),
    rejectNote: item.rejectNote,
    archivedAt: item.archivedAt
  }
}

const normalizeWaiterCallStatus = (value: unknown): WaiterCallStatus => {
  if(value === 'Sahiplenildi' || value === 'Masaya Gidildi' || value === 'Kapatıldı' || value === 'Bekliyor') return value
  return 'Bekliyor'
}

const normalizeWaiterCall = (item: Partial<WaiterCall>): WaiterCall => {
  return {
    id: String(item.id || `call_${Date.now()}`),
    tableId: String(item.tableId || ''),
    tableName: String(item.tableName || 'Masa'),
    status: normalizeWaiterCallStatus(item.status),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt,
    assignedAt: item.assignedAt,
    assignedByUserId: item.assignedByUserId,
    assignedByFullName: item.assignedByFullName,
    visitedAt: item.visitedAt,
    visitedByUserId: item.visitedByUserId,
    visitedByFullName: item.visitedByFullName,
    closedAt: item.closedAt,
    closedByUserId: item.closedByUserId,
    closedByFullName: item.closedByFullName,
    closeNote: item.closeNote || '',
    archivedAt: item.archivedAt
  }
}

const normalizeQRRequestHistory = (item: Partial<QRRequestHistory>): QRRequestHistory => {
  const request = normalizeQRRequest(item)
  const status = request.status === 'Onaylandı' || request.status === 'Reddedildi' ? request.status : 'Reddedildi'
  const archivedAt = item.archivedAt || request.archivedAt || request.rejectedAt || request.approvedAt || new Date().toISOString()

  return {
    ...request,
    status,
    archivedAt
  }
}

const normalizeWaiterCallHistory = (item: Partial<WaiterCallHistory>): WaiterCallHistory => {
  const call = normalizeWaiterCall(item)

  return {
    ...call,
    status: 'Kapatıldı',
    archivedAt: item.archivedAt || call.archivedAt || call.closedAt || new Date().toISOString()
  }
}

const normalizeAuditEventType = (value: unknown): AuditEventType => {
  if(
    value === 'edited'
    || value === 'approved'
    || value === 'rejected'
    || value === 'assigned'
    || value === 'visited'
    || value === 'closed'
    || value === 'note_updated'
    || value === 'created'
  ){
    return value
  }

  return 'created'
}

const normalizeAuditEntityType = (value: unknown): AuditEntityType => {
  return value === 'WaiterCall' ? 'WaiterCall' : 'QRRequest'
}

const normalizeQRAuditEvent = (item: Partial<QRAuditEvent>): QRAuditEvent => ({
  id: String(item.id || `audit_${Date.now()}`),
  entityType: normalizeAuditEntityType(item.entityType),
  entityId: String(item.entityId || ''),
  eventType: normalizeAuditEventType(item.eventType),
  userId: String(item.userId || ''),
  userName: String(item.userName || 'Bilinmeyen Kullanıcı'),
  tableId: item.tableId,
  tableName: item.tableName,
  timestamp: item.timestamp || new Date().toISOString(),
  before: item.before,
  after: item.after,
  note: item.note || ''
})

const normalizeSettings = (item: Partial<SystemSettings>): SystemSettings => {
  const vatRate = Number(item.vatRate)

  return {
    restaurantName: String(item.restaurantName || DEFAULT_SETTINGS.restaurantName).trim() || DEFAULT_SETTINGS.restaurantName,
    logoUrl: String(item.logoUrl || '').trim(),
    vatRate: Number.isFinite(vatRate) ? Math.min(100, Math.max(0, vatRate)) : DEFAULT_SETTINGS.vatRate,
    currency: String(item.currency || DEFAULT_SETTINGS.currency).trim() || DEFAULT_SETTINGS.currency
  }
}

const normalizeActionLog = (item: Partial<ActionLog>): ActionLog => {
  const timestamp = item.timestamp || new Date().toISOString()
  const date = item.date || new Date(timestamp).toLocaleDateString('sv-SE')
  const time = item.time || new Date(timestamp).toLocaleTimeString('tr-TR', { hour12: false })

  return {
    id: String(item.id || `log_${Date.now()}`),
    operationType: item.operationType || 'Sipariş eklendi',
    userId: String(item.userId || ''),
    userName: String(item.userName || 'Bilinmeyen Kullanıcı'),
    tableId: item.tableId,
    tableName: item.tableName,
    date,
    time,
    timestamp,
    description: String(item.description || '')
  }
}

export const loadProducts = (): Product[] => {
  const categories = loadCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_CATEGORY_ID
  return readJson<Partial<Product>[]>(KEY_PRODUCTS, []).map(item => normalizeProduct(item, fallbackCategoryId))
}

export const saveProducts = (items: Product[]) => {
  const categories = loadCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_CATEGORY_ID
  localStorage.setItem(KEY_PRODUCTS, JSON.stringify(items.map(item => normalizeProduct(item, fallbackCategoryId))))
}

export const loadCategories = (): ProductCategory[] => {
  const stored = readJson<Partial<ProductCategory>[]>(KEY_CATEGORIES, [])
  const categories = stored.map(normalizeCategory)

  if(!categories.find(c => c.id === DEFAULT_CATEGORY_ID)){
    categories.unshift(createDefaultCategory())
  }

  return categories
}

export const saveCategories = (items: ProductCategory[]) => {
  const categories = items.map(normalizeCategory)

  if(!categories.find(c => c.id === DEFAULT_CATEGORY_ID)){
    categories.unshift(createDefaultCategory())
  }

  localStorage.setItem(KEY_CATEGORIES, JSON.stringify(categories))
}

export const loadStockCategories = (): StockCategory[] => {
  const stored = readJson<Partial<StockCategory>[]>(KEY_STOCK_CATEGORIES, [])
  const categories = stored.map(normalizeStockCategory)

  if(!categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)){
    categories.unshift(createDefaultStockCategory())
  }

  return categories
}

export const saveStockCategories = (items: StockCategory[]) => {
  const categories = items.map(normalizeStockCategory)

  if(!categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)){
    categories.unshift(createDefaultStockCategory())
  }

  localStorage.setItem(KEY_STOCK_CATEGORIES, JSON.stringify(categories))
}

export const loadStockItems = (): StockItem[] => {
  const categories = loadStockCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_STOCK_CATEGORY_ID
  return readJson<Partial<StockItem>[]>(KEY_STOCK_ITEMS, []).map(item => normalizeStockItem(item, fallbackCategoryId))
}

export const saveStockItems = (items: StockItem[]) => {
  const categories = loadStockCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_STOCK_CATEGORY_ID
  localStorage.setItem(KEY_STOCK_ITEMS, JSON.stringify(items.map(item => normalizeStockItem(item, fallbackCategoryId))))
}

export const loadStockMovements = (): StockMovement[] => {
  return readJson<Partial<StockMovement>[]>(KEY_STOCK_MOVEMENTS, []).map(normalizeStockMovement)
}

export const saveStockMovements = (items: StockMovement[]) => {
  localStorage.setItem(KEY_STOCK_MOVEMENTS, JSON.stringify(items.map(normalizeStockMovement)))
}

export const loadStockMovementAuditEvents = (): StockMovementAuditEvent[] => {
  return readJson<Partial<StockMovementAuditEvent>[]>(KEY_STOCK_MOVEMENT_AUDIT, []).map(normalizeStockMovementAuditEvent)
}

export const saveStockMovementAuditEvents = (items: StockMovementAuditEvent[]) => {
  localStorage.setItem(KEY_STOCK_MOVEMENT_AUDIT, JSON.stringify(items.map(normalizeStockMovementAuditEvent)))
}

export const addStockMovementAuditEvent = (event: StockMovementAuditEvent) => {
  saveStockMovementAuditEvents([event, ...loadStockMovementAuditEvents()])
}

export const loadTables = (): TableState[] => {
  return readJson<TableState[]>(KEY_TABLES, [])
}

export const saveTables = (items: TableState[]) => {
  localStorage.setItem(KEY_TABLES, JSON.stringify(items))
}

export const loadClosed = (): ClosedBill[] => {
  return readJson<ClosedBill[]>(KEY_CLOSED, [])
}

export const saveClosed = (items: ClosedBill[]) => {
  localStorage.setItem(KEY_CLOSED, JSON.stringify(items))
}

export const loadKitchenOrders = (): KitchenOrder[] => {
  return readJson<Partial<KitchenOrder>[]>(KEY_KITCHEN, []).map(normalizeKitchenOrder)
}

export const saveKitchenOrders = (items: KitchenOrder[]) => {
  localStorage.setItem(KEY_KITCHEN, JSON.stringify(items.map(normalizeKitchenOrder)))
}

export const loadQRRequests = (): QRRequest[] => {
  return readJson<Partial<QRRequest>[]>(KEY_QR_REQUESTS, []).map(normalizeQRRequest)
}

export const saveQRRequests = (items: QRRequest[]) => {
  localStorage.setItem(KEY_QR_REQUESTS, JSON.stringify(items.map(normalizeQRRequest)))
}

export const loadQRRequestHistory = (): QRRequestHistory[] => {
  return readJson<Partial<QRRequestHistory>[]>(KEY_QR_REQUEST_HISTORY, []).map(normalizeQRRequestHistory)
}

export const saveQRRequestHistory = (items: QRRequestHistory[]) => {
  localStorage.setItem(KEY_QR_REQUEST_HISTORY, JSON.stringify(items.map(normalizeQRRequestHistory)))
}

export const addQRRequestHistory = (item: QRRequestHistory) => {
  saveQRRequestHistory([item, ...loadQRRequestHistory()])
}

export const loadQRAuditEvents = (): QRAuditEvent[] => {
  return readJson<Partial<QRAuditEvent>[]>(KEY_QR_AUDIT_EVENTS, []).map(normalizeQRAuditEvent)
}

export const saveQRAuditEvents = (items: QRAuditEvent[]) => {
  localStorage.setItem(KEY_QR_AUDIT_EVENTS, JSON.stringify(items.map(normalizeQRAuditEvent)))
}

export const addQRAuditEvent = ({
  entityType,
  entityId,
  eventType,
  user,
  tableId,
  tableName,
  before,
  after,
  note
}: {
  entityType: AuditEntityType
  entityId: string
  eventType: AuditEventType
  user: User
  tableId?: string
  tableName?: string
  before?: unknown
  after?: unknown
  note?: string
}) => {
  const event: QRAuditEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    entityType,
    entityId,
    eventType,
    userId: user.id,
    userName: user.fullName || user.username,
    tableId,
    tableName,
    timestamp: new Date().toISOString(),
    before,
    after,
    note
  }

  saveQRAuditEvents([event, ...loadQRAuditEvents()])
}

export const loadWaiterCalls = (): WaiterCall[] => {
  return readJson<Partial<WaiterCall>[]>(KEY_WAITER_CALLS, []).map(normalizeWaiterCall).filter(call => call.tableId)
}

export const saveWaiterCalls = (items: WaiterCall[]) => {
  localStorage.setItem(KEY_WAITER_CALLS, JSON.stringify(items.map(normalizeWaiterCall).filter(call => call.tableId)))
}

export const loadWaiterCallHistory = (): WaiterCallHistory[] => {
  return readJson<Partial<WaiterCallHistory>[]>(KEY_WAITER_CALL_HISTORY, []).map(normalizeWaiterCallHistory)
}

export const saveWaiterCallHistory = (items: WaiterCallHistory[]) => {
  localStorage.setItem(KEY_WAITER_CALL_HISTORY, JSON.stringify(items.map(normalizeWaiterCallHistory)))
}

export const addWaiterCallHistory = (item: WaiterCallHistory) => {
  saveWaiterCallHistory([item, ...loadWaiterCallHistory()])
}

export const loadSettings = (): SystemSettings => {
  return normalizeSettings(readJson<Partial<SystemSettings>>(KEY_SETTINGS, DEFAULT_SETTINGS))
}

export const saveSettings = (settings: SystemSettings) => {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(normalizeSettings(settings)))
}

export const loadUsers = (): User[] => {
  return readJson<User[]>(KEY_USERS, [])
}

export const saveUsers = (items: User[]) => {
  localStorage.setItem(KEY_USERS, JSON.stringify(items))
}

export const ensureDefaultAdmin = () => {
  const users = loadUsers()
  if(!users.find(u => u.username === 'admin')){
    const admin: User = { id: 'u_admin', fullName: 'Yönetici', username: 'admin', password: 'admin123', role: 'Admin', active: true }
    saveUsers([admin, ...users])
  }
}

export const setCurrentUser = (user: User | null) => {
  if(user) localStorage.setItem(KEY_AUTH, JSON.stringify(user))
  else localStorage.removeItem(KEY_AUTH)
}

export const getCurrentUser = (): User | null => {
  return readJson<User | null>(KEY_AUTH, null)
}

export const authenticateUser = (username: string, password: string): User | null => {
  const users = loadUsers()
  const u = users.find(x => x.username === username && x.password === password && x.active)
  if(u){
    setCurrentUser(u)
    return u
  }
  return null
}

export const updateUser = (user: User) => {
  const users = loadUsers()
  const next = users.map(u=> u.id===user.id ? user : u)
  saveUsers(next)
}

export const addUser = (user: User) => {
  const users = loadUsers()
  saveUsers([user, ...users])
}

export const deleteUser = (id: string) => {
  const users = loadUsers()
  saveUsers(users.filter(u => u.id !== id))
}

export const loadActionLogs = (): ActionLog[] => {
  return readJson<Partial<ActionLog>[]>(KEY_LOGS, []).map(normalizeActionLog)
}

export const saveActionLogs = (items: ActionLog[]) => {
  localStorage.setItem(KEY_LOGS, JSON.stringify(items.map(normalizeActionLog)))
}

export const addActionLog = ({
  operationType,
  user,
  tableId,
  tableName,
  description
}: {
  operationType: ActionLogType
  user: User
  tableId?: string
  tableName?: string
  description: string
}) => {
  const now = new Date()
  const log: ActionLog = {
    id: `log_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    operationType,
    userId: user.id,
    userName: user.fullName || user.username,
    tableId,
    tableName,
    date: now.toLocaleDateString('sv-SE'),
    time: now.toLocaleTimeString('tr-TR', { hour12: false }),
    timestamp: now.toISOString(),
    description
  }

  saveActionLogs([log, ...loadActionLogs()])
}

const getStockMovementLogType = (movement: StockMovement): ActionLogType => {
  if(movement.reversesMovementId) return 'Stok ters hareketi oluşturuldu'
  if(movement.type === 'Çıkış') return 'Stok çıkışı yapıldı'
  if(movement.type === 'Sayım Düzeltme') return 'Stok sayım düzeltmesi yapıldı'
  return 'Stok girişi yapıldı'
}

const formatStockQty = (value: number, unit: StockUnit) => {
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
}

export const applyStockMovement = ({
  stockItemId,
  type,
  source,
  reason,
  qty,
  purchasePrice,
  supplierName,
  invoiceNo,
  description,
  movementDate,
  user,
  reversesMovementId
}: {
  stockItemId: string
  type: StockMovementType
  source: StockMovementSource
  reason: StockMovementReason
  qty: number
  purchasePrice?: number
  supplierName?: string
  invoiceNo?: string
  description?: string
  movementDate?: string
  user: User
  reversesMovementId?: string
}) => {
  const stockItems = loadStockItems()
  const stockItem = stockItems.find(item => item.id === stockItemId)

  if(!stockItem){
    throw new Error('Stok kartı bulunamadı.')
  }

  const normalizedQty = Number(qty)
  if(!Number.isFinite(normalizedQty) || normalizedQty < 0 || (type !== 'Sayım Düzeltme' && normalizedQty <= 0)){
    throw new Error(type === 'Sayım Düzeltme' ? 'Sayım sonucu 0 veya daha büyük olmalıdır.' : 'Hareket miktarı 0’dan büyük olmalıdır.')
  }

  const previousQty = stockItem.currentQty
  const nextQty = type === 'Giriş'
    ? previousQty + normalizedQty
    : type === 'Çıkış'
      ? previousQty - normalizedQty
      : normalizedQty

  if(nextQty < 0){
    throw new Error('Çıkış hareketi stok miktarını eksiye düşüremez.')
  }

  const normalizedPurchasePrice = Number(purchasePrice)
  const now = new Date().toISOString()
  const movement: StockMovement = {
    id: `stock_move_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    stockItemId: stockItem.id,
    stockItemName: stockItem.name,
    type,
    source,
    reason,
    qty: normalizedQty,
    unit: stockItem.unit,
    previousQty,
    nextQty,
    purchasePrice: Number.isFinite(normalizedPurchasePrice) && normalizedPurchasePrice >= 0 ? normalizedPurchasePrice : undefined,
    supplierName: supplierName?.trim() || '',
    invoiceNo: invoiceNo?.trim() || '',
    description: description?.trim() || '',
    movementDate: movementDate || now,
    createdAt: now,
    createdByUserId: user.id,
    createdByFullName: user.fullName || user.username,
    reversesMovementId
  }
  const nextStockItem: StockItem = {
    ...stockItem,
    currentQty: nextQty,
    updatedAt: now,
    lastPurchasePrice: movement.type === 'Giriş' && movement.purchasePrice !== undefined ? movement.purchasePrice : stockItem.lastPurchasePrice,
    lastSupplierName: movement.type === 'Giriş' && movement.supplierName ? movement.supplierName : stockItem.lastSupplierName
  }
  const nextStockItems = stockItems.map(item => item.id === stockItem.id ? nextStockItem : item)
  const existingMovements = loadStockMovements()
  const nextExistingMovements = reversesMovementId
    ? existingMovements.map(item => item.id === reversesMovementId ? { ...item, reversedByMovementId: movement.id, reversedAt: now } : item)
    : existingMovements

  saveStockItems(nextStockItems)
  saveStockMovements([movement, ...nextExistingMovements])
  addStockMovementAuditEvent({
    id: `stock_audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    movementId: movement.id,
    stockItemId: stockItem.id,
    eventType: 'created',
    userId: user.id,
    userName: user.fullName || user.username,
    timestamp: now,
    before: stockItem,
    after: nextStockItem,
    note: `${movement.stockItemName}: ${movement.type} ${formatStockQty(movement.qty, movement.unit)}. ${formatStockQty(previousQty, movement.unit)} -> ${formatStockQty(nextQty, movement.unit)}.`
  })

  if(reversesMovementId){
    addStockMovementAuditEvent({
      id: `stock_audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      movementId: reversesMovementId,
      stockItemId: stockItem.id,
      eventType: 'reversed',
      userId: user.id,
      userName: user.fullName || user.username,
      timestamp: now,
      before: existingMovements.find(item => item.id === reversesMovementId),
      after: nextExistingMovements.find(item => item.id === reversesMovementId),
      note: `${movement.id} hareketi ile ters hareket oluşturuldu.`
    })
  }

  addActionLog({
    operationType: getStockMovementLogType(movement),
    user,
    description: `${user.fullName || user.username} ${movement.stockItemName} için ${movement.type.toLocaleLowerCase('tr-TR')} hareketi oluşturdu. Kaynak: ${movement.source}. Sebep: ${movement.reason}. Miktar: ${formatStockQty(movement.qty, movement.unit)}. Stok: ${formatStockQty(previousQty, movement.unit)} -> ${formatStockQty(nextQty, movement.unit)}.${movement.invoiceNo ? ` Fatura: ${movement.invoiceNo}.` : ''}${movement.supplierName ? ` Tedarikçi: ${movement.supplierName}.` : ''}${movement.description ? ` Açıklama: ${movement.description}.` : ''}`
  })

  return movement
}

export const reverseStockMovement = (movementId: string, user: User) => {
  const movement = loadStockMovements().find(item => item.id === movementId)

  if(!movement){
    throw new Error('Ters hareket oluşturulacak kayıt bulunamadı.')
  }

  if(movement.reversedByMovementId){
    throw new Error('Bu hareket için daha önce ters hareket oluşturulmuş.')
  }

  const reverseType: StockMovementType = movement.type === 'Giriş'
    ? 'Çıkış'
    : movement.type === 'Çıkış'
      ? 'Giriş'
      : 'Sayım Düzeltme'
  const reverseQty = movement.type === 'Sayım Düzeltme' ? movement.previousQty : movement.qty

  return applyStockMovement({
    stockItemId: movement.stockItemId,
    type: reverseType,
    source: movement.source,
    reason: 'Ters Hareket',
    qty: reverseQty,
    purchasePrice: reverseType === 'Giriş' ? movement.purchasePrice : undefined,
    supplierName: movement.supplierName,
    invoiceNo: movement.invoiceNo,
    description: `${movement.id} numaralı hareketin ters kaydı.${movement.description ? ` Orijinal açıklama: ${movement.description}` : ''}`,
    movementDate: new Date().toISOString(),
    user,
    reversesMovementId: movement.id
  })
}

export const createSystemBackup = () => {
  const data = getAppStorageKeys().reduce<Record<string, unknown>>((backupData, key) => {
    const rawValue = localStorage.getItem(key)
    if(rawValue === null) return backupData

    try {
      backupData[key] = JSON.parse(rawValue)
    } catch {
      backupData[key] = rawValue
    }

    return backupData
  }, {})

  return {
    app: 'restaurant-adisyon',
    version: 1,
    exportedAt: new Date().toISOString(),
    data
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export const restoreSystemBackup = (backup: unknown) => {
  if(!isRecord(backup)){
    throw new Error('Geçersiz yedek dosyası.')
  }

  const data = isRecord(backup.data) ? backup.data : backup
  const entries = Object.entries(data).filter(([key]) => key.startsWith('ra_'))

  if(entries.length === 0){
    throw new Error('Yedek dosyasında sisteme ait veri bulunamadı.')
  }

  getAppStorageKeys().forEach(key => localStorage.removeItem(key))

  entries.forEach(([key, value]) => {
    if(value === undefined) return
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value))
  })

  ensureDefaultAdmin()
  loadCategories()
  loadStockCategories()
  loadSettings()

  return entries.length
}

export const createDemoData = () => {
  const now = new Date().toISOString()
  const categories: ProductCategory[] = [
    { id: 'cat_food', name: 'Yemekler', active: true, createdAt: now },
    { id: 'cat_drinks', name: 'İçecekler', active: true, createdAt: now },
    { id: 'cat_desserts', name: 'Tatlılar', active: true, createdAt: now }
  ]

  const products: Product[] = [
    { id: 'prd_adana', name: 'Adana Kebap', price: 450, categoryId: 'cat_food', description: 'Közlenmiş domates ve biber ile servis edilir.', active: true, createdAt: now, updatedAt: now },
    { id: 'prd_chicken', name: 'Tavuk Şiş', price: 360, categoryId: 'cat_food', description: 'Pilav ve salata ile servis edilir.', active: true, createdAt: now, updatedAt: now },
    { id: 'prd_soup', name: 'Mercimek Çorbası', price: 120, categoryId: 'cat_food', description: 'Günlük sıcak çorba.', active: true, createdAt: now, updatedAt: now },
    { id: 'prd_cola', name: 'Kola', price: 80, categoryId: 'cat_drinks', description: '330 ml kutu içecek.', active: true, createdAt: now, updatedAt: now },
    { id: 'prd_tea', name: 'Çay', price: 35, categoryId: 'cat_drinks', description: 'Taze demlenmiş bardak çay.', active: true, createdAt: now, updatedAt: now },
    { id: 'prd_baklava', name: 'Baklava', price: 180, categoryId: 'cat_desserts', description: 'Antep fıstıklı porsiyon baklava.', active: true, createdAt: now, updatedAt: now }
  ]

  const tables: TableState[] = Array.from({ length: 6 }).map((_, index) => ({
    id: String(index + 1),
    name: `Masa ${index + 1}`,
    open: false,
    orders: []
  }))

  saveCategories(categories)
  saveProducts(products)
  saveTables(tables)
  saveKitchenOrders([])
  saveQRRequests([])
  saveWaiterCalls([])
  ensureDefaultAdmin()

  return { categories: loadCategories(), products: loadProducts(), tables }
}
