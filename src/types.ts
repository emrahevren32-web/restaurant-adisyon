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

export type StockUnit = 'adet' | 'kg' | 'gr' | 'lt' | 'ml' | 'paket' | 'koli'

export type StockCategory = {
  id: string
  name: string
  active: boolean
  createdAt: string
  updatedAt?: string
}

export type StockItem = {
  id: string
  name: string
  categoryId: string
  unit: StockUnit
  currentQty: number
  minQty: number
  sku?: string
  barcode?: string
  description?: string
  active: boolean
  createdAt: string
  updatedAt?: string
  lastPurchasePrice?: number
  lastSupplierName?: string
}

export type StockMovementType = 'Giriş' | 'Çıkış' | 'Sayım Düzeltme'
export type StockMovementSource = 'Manuel' | 'Reçete' | 'Adisyon' | 'Sayım' | 'İade'
export type StockMovementReason =
  | 'Satın Alma'
  | 'İade'
  | 'Fire'
  | 'Kullanım'
  | 'Sayım Fazlası'
  | 'Sayım Eksiği'
  | 'Ters Hareket'
  | 'Diğer'

export type StockMovement = {
  id: string
  stockItemId: string
  stockItemName: string
  type: StockMovementType
  source: StockMovementSource
  reason: StockMovementReason
  qty: number
  unit: StockUnit
  previousQty: number
  nextQty: number
  purchasePrice?: number
  supplierName?: string
  invoiceNo?: string
  description?: string
  movementDate: string
  createdAt: string
  createdByUserId: string
  createdByFullName: string
  reversesMovementId?: string
  reversedByMovementId?: string
  reversedAt?: string
}

export type StockMovementAuditEventType = 'created' | 'reversed'

export type StockMovementAuditEvent = {
  id: string
  movementId: string
  stockItemId: string
  eventType: StockMovementAuditEventType
  userId: string
  userName: string
  timestamp: string
  before?: unknown
  after?: unknown
  note?: string
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

export type QRRequestStatus = 'Garson Onayı Bekliyor' | 'Onaylandı' | 'Reddedildi'

export type QRRejectReason = 'Ürün mevcut değil' | 'Mutfak kapalı' | 'Müşteri iptali' | 'Hatalı masa' | 'Stok yetersiz' | 'Diğer'

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
  originalItems?: QRRequestItem[]
  status: QRRequestStatus
  customerNote?: string
  staffNote?: string
  createdAt: string
  updatedAt?: string
  updatedByUserId?: string
  updatedByFullName?: string
  editCount?: number
  approvedAt?: string
  approvedByUserId?: string
  approvedByFullName?: string
  rejectedAt?: string
  rejectedByUserId?: string
  rejectedByFullName?: string
  rejectReason?: QRRejectReason
  rejectNote?: string
  archivedAt?: string
}

export type QRRequestHistory = QRRequest & {
  status: 'Onaylandı' | 'Reddedildi'
  archivedAt: string
}

export type WaiterCallStatus = 'Bekliyor' | 'Sahiplenildi' | 'Masaya Gidildi' | 'Kapatıldı'

export type WaiterCall = {
  id: string
  tableId: string
  tableName: string
  status: WaiterCallStatus
  createdAt: string
  updatedAt?: string
  assignedAt?: string
  assignedByUserId?: string
  assignedByFullName?: string
  visitedAt?: string
  visitedByUserId?: string
  visitedByFullName?: string
  closedAt?: string
  closedByUserId?: string
  closedByFullName?: string
  closeNote?: string
  archivedAt?: string
}

export type WaiterCallHistory = WaiterCall & {
  status: 'Kapatıldı'
  archivedAt: string
}

export type AuditEntityType = 'QRRequest' | 'WaiterCall'
export type AuditEventType = 'created' | 'edited' | 'approved' | 'rejected' | 'assigned' | 'visited' | 'closed' | 'note_updated'

export type QRAuditEvent = {
  id: string
  entityType: AuditEntityType
  entityId: string
  eventType: AuditEventType
  userId: string
  userName: string
  tableId?: string
  tableName?: string
  timestamp: string
  before?: unknown
  after?: unknown
  note?: string
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
  | 'Garson Çağrısı Sahiplenildi'
  | 'Garson Çağrısı Masaya Gidildi'
  | 'Garson Çağrısı Kapatıldı'
  | 'QR Siparişi Oluşturuldu'
  | 'QR Siparişi Düzenlendi'
  | 'QR Sipariş Notu Güncellendi'
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
  | 'Stok kartı oluşturuldu'
  | 'Stok kartı güncellendi'
  | 'Stok kartı silindi'
  | 'Stok kartı aktif yapıldı'
  | 'Stok kartı pasif yapıldı'
  | 'Stok kategorisi oluşturuldu'
  | 'Stok kategorisi güncellendi'
  | 'Stok kategorisi aktif yapıldı'
  | 'Stok kategorisi pasif yapıldı'
  | 'Stok girişi yapıldı'
  | 'Stok çıkışı yapıldı'
  | 'Stok sayım düzeltmesi yapıldı'
  | 'Stok ters hareketi oluşturuldu'
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
