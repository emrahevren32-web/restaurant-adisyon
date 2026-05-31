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

export type KitchenOrderStatus = 'Yeni Sipariş' | 'Hazırlanıyor' | 'Hazır'

export type KitchenOrderItem = {
  productId: string
  productName: string
  qty: number
  isGift?: boolean
}

export type KitchenOrder = {
  id: string
  tableId: string
  tableName: string
  waiterId: string
  waiterName: string
  status: KitchenOrderStatus
  items: KitchenOrderItem[]
  createdAt: string
  updatedAt: string
}

export type QRRequestStatus = 'Garson Onayı Bekliyor'

export type QRRequestItem = {
  productId: string
  productName: string
  unitPrice: number
  qty: number
}

export type QRRequest = {
  id: string
  tableId: string
  tableName: string
  items: QRRequestItem[]
  status: QRRequestStatus
  createdAt: string
}

export type WaiterCallStatus = 'Bekliyor'

export type WaiterCall = {
  id: string
  tableId: string
  tableName: string
  status: WaiterCallStatus
  createdAt: string
}

export type SystemSettings = {
  restaurantName: string
  logoUrl: string
  vatRate: number
  currency: string
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
  | 'Sipariş Hazırlanıyor'
  | 'Sipariş Hazır'
  | 'Garson çağrıldı'
  | 'QR Siparişi Onaylandı'
  | 'QR Siparişi Reddedildi'
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
