import {
  ActionLog,
  ActionLogType,
  ClosedBill,
  KitchenOrder,
  KitchenOrderStatus,
  Product,
  ProductCategory,
  QRRequest,
  QRRequestStatus,
  SystemSettings,
  TableState,
  User,
  WaiterCall,
  WaiterCallStatus
} from './types'

const KEY_PRODUCTS = 'ra_products'
const KEY_CATEGORIES = 'ra_categories'
const KEY_TABLES = 'ra_tables'
const KEY_CLOSED = 'ra_closed'
const KEY_USERS = 'ra_users'
const KEY_AUTH = 'ra_auth'
const KEY_LOGS = 'ra_logs'
const KEY_KITCHEN = 'ra_kitchen_orders'
const KEY_QR_REQUESTS = 'ra_qr_requests'
const KEY_SETTINGS = 'ra_settings'
const KEY_WAITER_CALLS = 'ra_waiter_calls'

const DEFAULT_CATEGORY_ID = 'cat_general'

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
  if(value === 'Garson Onayı Bekliyor') return value
  return 'Garson Onayı Bekliyor'
}

const normalizeQRRequest = (item: Partial<QRRequest>): QRRequest => {
  const timestamp = item.createdAt || new Date().toISOString()

  return {
    id: String(item.id || `qr_${Date.now()}`),
    tableId: String(item.tableId || ''),
    tableName: String(item.tableName || 'Masa'),
    items: (item.items || []).map(orderItem => ({
      productId: String(orderItem.productId || ''),
      productName: String(orderItem.productName || 'Ürün'),
      unitPrice: Math.max(0, Number(orderItem.unitPrice) || 0),
      qty: Math.max(1, Number(orderItem.qty) || 1)
    })).filter(orderItem => orderItem.productId),
    status: normalizeQRRequestStatus(item.status),
    createdAt: timestamp
  }
}

const normalizeWaiterCallStatus = (value: unknown): WaiterCallStatus => {
  if(value === 'Bekliyor') return value
  return 'Bekliyor'
}

const normalizeWaiterCall = (item: Partial<WaiterCall>): WaiterCall => {
  return {
    id: String(item.id || `call_${Date.now()}`),
    tableId: String(item.tableId || ''),
    tableName: String(item.tableName || 'Masa'),
    status: normalizeWaiterCallStatus(item.status),
    createdAt: item.createdAt || new Date().toISOString()
  }
}

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

export const loadWaiterCalls = (): WaiterCall[] => {
  return readJson<Partial<WaiterCall>[]>(KEY_WAITER_CALLS, []).map(normalizeWaiterCall).filter(call => call.tableId)
}

export const saveWaiterCalls = (items: WaiterCall[]) => {
  localStorage.setItem(KEY_WAITER_CALLS, JSON.stringify(items.map(normalizeWaiterCall).filter(call => call.tableId)))
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
