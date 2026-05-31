import { ClosedBill, Product, ProductCategory, TableState, User } from './types'

const KEY_PRODUCTS = 'ra_products'
const KEY_CATEGORIES = 'ra_categories'
const KEY_TABLES = 'ra_tables'
const KEY_CLOSED = 'ra_closed'
const KEY_USERS = 'ra_users'
const KEY_AUTH = 'ra_auth'

const DEFAULT_CATEGORY_ID = 'cat_general'

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
