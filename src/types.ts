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
  isGift?: boolean
}

export type PaymentMethod = 'Nakit' | 'Kart' | 'Diğer'

export type PaymentPart = {
  method: PaymentMethod
  amount: number
}

export type DiscountType = 'percent' | 'amount'

export type Discount = {
  type: DiscountType
  value: number
}

export type TableState = {
  id: string
  name: string
  open: boolean
  orders: Order[]
  note?: string
  discount?: Discount
}

export type ClosedBill = {
  id: string
  tableId: string
  tableName: string
  subtotal?: number
  total: number
  timestamp: string
  orders: Order[]
  paymentMethod?: PaymentMethod
  payments?: PaymentPart[]
  splitPayment?: boolean
  splitLabel?: string
  mergeHistory?: boolean
  mergeTargetTableId?: string
  mergeTargetTableName?: string
  closedByUserId?: string
  closedByFullName?: string
  note?: string
  discount?: Discount
  discountTotal?: number
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

export type ActionLogType =
  | 'Masa oluşturuldu'
  | 'Masa silindi'
  | 'Masa adı değiştirildi'
  | 'Masa açıldı'
  | 'Sipariş eklendi'
  | 'Sipariş silindi'
  | 'Ürün adedi artırıldı'
  | 'Ürün adedi azaltıldı'
  | 'İndirim uygulandı'
  | 'İndirim kaldırıldı'
  | 'İkram eklendi'
  | 'Masa taşındı'
  | 'Masa birleştirildi'
  | 'Hesap kapatıldı'
  | 'Ürün oluşturuldu'
  | 'Ürün güncellendi'
  | 'Ürün aktif yapıldı'
  | 'Ürün pasif yapıldı'
  | 'Kategori oluşturuldu'
  | 'Kategori güncellendi'
  | 'Kategori aktif yapıldı'
  | 'Kategori pasif yapıldı'
  | 'Kullanıcı oluşturuldu'
  | 'Kullanıcı güncellendi'
  | 'Kullanıcı aktif yapıldı'
  | 'Kullanıcı pasif yapıldı'

export type ActionLog = {
  id: string
  operationType: ActionLogType
  userId: string
  userName: string
  tableId?: string
  tableName?: string
  date: string
  time: string
  timestamp: string
  description: string
}
