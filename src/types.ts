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
  tracksExpiry?: boolean
  expiryWarningDays?: number
  sku?: string
  barcode?: string
  description?: string
  active: boolean
  createdAt: string
  updatedAt?: string
  unitPurchasePrice?: number
  currency?: string
  lastPurchasePrice?: number
  averageCost?: number
  lastCostUpdatedAt?: string
  lastSupplierName?: string
}

export type StockMovementType = 'Giriş' | 'Çıkış' | 'Sayım Düzeltme'
export type StockMovementSource = 'Manuel' | 'Reçete' | 'Adisyon' | 'Sayım' | 'İade' | 'Fire'
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
  currency?: string
  unitCost?: number
  totalCost?: number
  previousAverageCost?: number
  nextAverageCost?: number
  previousStockValue?: number
  nextStockValue?: number
  supplierName?: string
  invoiceNo?: string
  expiryDate?: string
  expiryAllocations?: StockExpiryAllocation[]
  expiryUnallocatedQty?: number
  expiryWarnings?: string[]
  description?: string
  movementDate: string
  createdAt: string
  createdByUserId: string
  createdByFullName: string
  reversesMovementId?: string
  reversedByMovementId?: string
  reversedAt?: string
  sourceEntityType?: string
  sourceEntityId?: string
  tableId?: string
  tableName?: string
  orderId?: string
  recipeId?: string
  recipeVersion?: number
  deductionBatchId?: string
  reverseOfBatchId?: string
  reverseMode?: 'full' | 'partial'
  wasteRecordId?: string
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

export type CriticalStockEventType = 'entered' | 'resolved'

export type CriticalStockTrigger =
  | 'Stok Hareketi'
  | 'Otomatik Stok Düşümü'
  | 'Ters Hareket'
  | 'Stok Kartı Oluşturma'
  | 'Stok Kartı Güncelleme'
  | 'Stok Kartı Aktifleştirme'
  | 'Stok Kartı Pasifleştirme'

export type CriticalStockEvent = {
  id: string
  stockItemId: string
  stockItemName: string
  eventType: CriticalStockEventType
  trigger: CriticalStockTrigger
  previousQty: number
  nextQty: number
  minQty: number
  unit: StockUnit
  userId: string
  userName: string
  timestamp: string
  movementId?: string
  tableId?: string
  tableName?: string
  note?: string
}

export type StockExpiryStatus = 'valid' | 'near_expiry' | 'expired' | 'depleted' | 'unknown'

export type StockExpiryEventType =
  | 'lot_created'
  | 'lot_consumed'
  | 'lot_wasted'
  | 'lot_returned'
  | 'lot_adjusted'
  | 'near_expiry'
  | 'expired'
  | 'allocation_missing'

export type StockExpiryTrigger =
  | 'Stok Girişi'
  | 'Stok Çıkışı'
  | 'Otomatik Stok Düşümü'
  | 'Ters Hareket'
  | 'Sayım Düzeltme'
  | 'Fire'
  | 'SKT Kontrolü'

export type StockExpiryAllocation = {
  lotId: string
  lotCode: string
  expiryDate?: string
  qty: number
  unit: StockUnit
}

export type StockExpiryLot = {
  id: string
  lotCode: string
  stockItemId: string
  stockItemName: string
  unit: StockUnit
  initialQty: number
  remainingQty: number
  expiryDate?: string
  receivedAt: string
  purchaseMovementId?: string
  supplierName?: string
  invoiceNo?: string
  createdAt: string
  createdByUserId: string
  createdByFullName: string
  updatedAt?: string
  depletedAt?: string
}

export type StockExpiryEvent = {
  id: string
  lotId?: string
  lotCode?: string
  stockItemId: string
  stockItemName: string
  eventType: StockExpiryEventType
  trigger: StockExpiryTrigger
  qty?: number
  unit: StockUnit
  expiryDate?: string
  previousStatus?: StockExpiryStatus
  nextStatus?: StockExpiryStatus
  movementId?: string
  tableId?: string
  tableName?: string
  userId: string
  userName: string
  timestamp: string
  note?: string
}

export type StockWasteReasonCategory =
  | 'Bozulma'
  | 'SKT Geçmesi'
  | 'Dökülme'
  | 'Hazırlık Kaybı'
  | 'Üretim Hatası'
  | 'Yanlış Sipariş'
  | 'Müşteri İadesi'
  | 'Sayım Farkı'
  | 'Diğer'

export type StockWasteStatus = 'active' | 'reversed'

export type StockWasteRecord = {
  id: string
  stockMovementId: string
  stockItemId: string
  stockItemName: string
  qty: number
  unit: StockUnit
  reasonCategory: StockWasteReasonCategory
  reasonNote?: string
  responsibleUserId?: string
  responsibleFullName?: string
  createdByUserId: string
  createdByFullName: string
  occurredAt: string
  createdAt: string
  expiryAllocations?: StockExpiryAllocation[]
  expiryUnallocatedQty?: number
  expiryWarnings?: string[]
  estimatedUnitCost?: number
  estimatedTotalCost?: number
  status: StockWasteStatus
  reversedByMovementId?: string
  reversedAt?: string
  updatedAt?: string
}

export type RecipeItem = {
  id: string
  stockItemId: string
  stockItemName: string
  qty: number
  unit: StockUnit
  wastePercent: number
  note?: string
}

export type RecipeCostSnapshot = {
  totalCost: number
  missingCostItemCount: number
  calculatedAt: string
}

export type Recipe = {
  id: string
  productId: string
  productName: string
  name: string
  version: number
  recipeVersion: number
  active: boolean
  items: RecipeItem[]
  note?: string
  costSnapshot?: RecipeCostSnapshot
  createdAt: string
  updatedAt?: string
  createdByUserId: string
  createdByFullName: string
  updatedByUserId?: string
  updatedByFullName?: string
  copiedFromRecipeId?: string
  deletedAt?: string
  deletedByUserId?: string
  deletedByFullName?: string
}

export type RecipeAuditEventType = 'created' | 'updated' | 'deleted' | 'copied' | 'activated' | 'deactivated'

export type RecipeAuditEvent = {
  id: string
  recipeId: string
  eventType: RecipeAuditEventType
  userId: string
  userName: string
  timestamp: string
  before?: unknown
  after?: unknown
  note?: string
}

export type OrderRecipeSnapshot = {
  recipeId: string
  recipeName: string
  recipeVersion: number
  productId: string
  productName: string
  items: RecipeItem[]
  capturedAt: string
}

export type StockDeductionStatus =
  | 'not_required'
  | 'deducted'
  | 'warning'
  | 'missing_recipe'
  | 'failed'
  | 'partial_reversed'
  | 'reversed'

export type StockDeductionSourceType =
  | 'Masa Siparişi'
  | 'QR Siparişi'
  | 'Adet Artışı'
  | 'Adet Azalışı'
  | 'Sipariş İptali'

export type StockDeductionLine = {
  id: string
  stockItemId: string
  stockItemName: string
  qty: number
  unit: StockUnit
  recipeQty: number
  recipeUnit: StockUnit
  wastePercent: number
  movementId?: string
  reverseMovementIds?: string[]
  expiryAllocations?: StockExpiryAllocation[]
  expiryUnallocatedQty?: number
  expiryWarnings?: string[]
  warning?: string
  error?: string
}

export type StockDeductionBatch = {
  id: string
  orderId: string
  tableId: string
  tableName: string
  productId: string
  productName: string
  qty: number
  remainingQty: number
  sourceType: StockDeductionSourceType
  status: StockDeductionStatus
  recipeId?: string
  recipeVersion?: number
  recipeSnapshot?: OrderRecipeSnapshot
  movementIds: string[]
  lines: StockDeductionLine[]
  warnings: string[]
  errors: string[]
  createdAt: string
  createdByUserId: string
  createdByFullName: string
  updatedAt?: string
}

export type StockDeductionAuditEventType = 'deducted' | 'reversed' | 'warning' | 'failed' | 'skipped'

export type StockDeductionAuditEvent = {
  id: string
  batchId?: string
  orderId?: string
  productId?: string
  eventType: StockDeductionAuditEventType
  userId: string
  userName: string
  tableId?: string
  tableName?: string
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
  recipeId?: string
  recipeVersion?: number
  recipeSnapshot?: OrderRecipeSnapshot
  stockDeductionStatus?: StockDeductionStatus
  stockDeductionBatchIds?: string[]
  stockDeductedQty?: number
  stockDeductionWarnings?: string[]
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

export type CurrentAccountType = 'Müşteri' | 'Firma' | 'Personel' | 'Tedarikçi'

export type CurrentAccount = {
  id: string
  code: string
  name: string
  type: CurrentAccountType
  phone: string
  email: string
  taxNumber: string
  authorizedPerson: string
  address: string
  note: string
  isActive: boolean
  createdAt: string
  updatedAt: string
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
  | 'Maliyet güncellendi'
  | 'Ortalama maliyet değişti'
  | 'Yeni alış fiyatı girildi'
  | 'Kritik stok uyarısı oluştu'
  | 'Kritik stoktan çıkıldı'
  | 'SKT lotu oluşturuldu'
  | 'SKT lotu tüketildi'
  | 'SKT lotu iade edildi'
  | 'SKT lotu güncellendi'
  | 'SKT yaklaşan uyarısı oluştu'
  | 'SKT tarihi geçti'
  | 'SKT lot eşleşmesi yapılamadı'
  | 'Fire kaydı oluşturuldu'
  | 'Fire kaydı terslendi'
  | 'Fire lottan düşüldü'
  | 'SKT nedeniyle fire oluşturuldu'
  | 'Reçete oluşturuldu'
  | 'Reçete güncellendi'
  | 'Reçete silindi'
  | 'Reçete kopyalandı'
  | 'Reçete aktif yapıldı'
  | 'Reçete pasif yapıldı'
  | 'Otomatik stok düşümü yapıldı'
  | 'Otomatik stok düşümü terslendi'
  | 'Otomatik stok düşümü uyarısı'
  | 'Otomatik stok düşümü başarısız'
  | 'Kullanıcı oluşturuldu'
  | 'Kullanıcı güncellendi'
  | 'Kullanıcı aktif yapıldı'
  | 'Kullanıcı pasif yapıldı'
  | 'Cari oluşturuldu'
  | 'Cari güncellendi'
  | 'Cari aktif yapıldı'
  | 'Cari pasif yapıldı'
  | 'Cari silindi'

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
