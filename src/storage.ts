import { Product, TableState, ClosedBill } from './types'
import { User } from './types'

const KEY_PRODUCTS = 'ra_products'
const KEY_TABLES = 'ra_tables'
const KEY_CLOSED = 'ra_closed'
const KEY_USERS = 'ra_users'
const KEY_AUTH = 'ra_auth'

export const loadProducts = (): Product[] => {
  try { return JSON.parse(localStorage.getItem(KEY_PRODUCTS) || '[]') }
  catch { return [] }
}

export const saveProducts = (items: Product[]) => {
  localStorage.setItem(KEY_PRODUCTS, JSON.stringify(items))
}

export const loadTables = (): TableState[] => {
  try { return JSON.parse(localStorage.getItem(KEY_TABLES) || '[]') }
  catch { return [] }
}

export const saveTables = (items: TableState[]) => {
  localStorage.setItem(KEY_TABLES, JSON.stringify(items))
}

export const loadClosed = (): ClosedBill[] => {
  try { return JSON.parse(localStorage.getItem(KEY_CLOSED) || '[]') }
  catch { return [] }
}

export const saveClosed = (items: ClosedBill[]) => {
  localStorage.setItem(KEY_CLOSED, JSON.stringify(items))
}

export const loadUsers = (): User[] => {
  try { return JSON.parse(localStorage.getItem(KEY_USERS) || '[]') }
  catch { return [] }
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
  try { return JSON.parse(localStorage.getItem(KEY_AUTH) || 'null') }
  catch { return null }
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
