export type Product = {
  id: string
  name: string
  price: number
}

export type Order = {
  id: string
  productId: string
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
