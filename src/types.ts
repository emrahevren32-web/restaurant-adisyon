export type ProductCategory = {
  id: string
  name: string
  active: boolean
  createdAt: string
}

export type Product = {
  id: string
  name: string
  price: number
  categoryId: string
  description?: string
  active: boolean
  createdAt: string
  updatedAt?: string
}

export type Order = {
  id: string
  productId: string
  productName?: string
  unitPrice?: number
  qty: number
}

export type TableState = {
  id: string
  name: string
  open: boolean
  orders: Order[]
}

export type ClosedBill = {
  id: string
  tableId: string
  tableName: string
  total: number
  timestamp: string
  orders: Order[]
}

export type Role = 'Admin' | 'Garson'

export type User = {
  id: string
  fullName: string
  username: string
  password: string
  role: Role
  active: boolean
}
