export type TenantStatus = 'Aktif' | 'Pasif' | 'Askıda' | 'Arşivlendi' | 'Silinmiş'

export type Tenant = {
  id: string
  tenantCode: string
  tenantName: string
  status: TenantStatus
  ownerCompanyId: string
  workspaceIds: string[]
  subscriptionIds: string[]
  createdAt: string
  updatedAt: string
  deletedAt: string
  /** @deprecated Use ownerCompanyId instead. */
  companyId: string
  /** @deprecated Use tenantName instead. */
  companyName: string
}

export type TenantSettings = {
  id: string
  tenantId: string
  timezone: string
  currency: string
  language: string
  dateFormat: string
  theme: string
  createdAt: string
  updatedAt: string
}

export type Sector = {
  id: string
  code: string
  name: string
  description: string
  icon: string
  color: string
  isActive: boolean
  sortOrder: number
}

export type ProductCategory = {
  id: string
  tenantId?: string
  name: string
  active: boolean
  createdAt: string
}

export type ProductAllergen =
  | 'Gluten'
  | 'Süt'
  | 'Yumurta'
  | 'Yer Fıstığı'
  | 'Fındık'
  | 'Ceviz'
  | 'Soya'
  | 'Susam'
  | 'Balık'
  | 'Kabuklu Deniz Ürünleri'
  | 'Hardal'
  | 'Kereviz'
  | 'Lupin'
  | 'Sülfit'
  | 'Yumuşakçalar'

export type Product = {
  id: string
  tenantId?: string
  branchId: string
  name: string
  price: number
  categoryId: string
  description?: string
  calories: number
  protein: number
  carbohydrate: number
  fat: number
  fiber: number
  sugar: number
  salt: number
  servingSize: string
  allergens: ProductAllergen[]
  active: boolean
  createdAt: string
  updatedAt?: string
}

export type StockUnit = 'adet' | 'kg' | 'gr' | 'lt' | 'ml' | 'paket' | 'koli'

export type StockCategory = {
  id: string
  tenantId?: string
  name: string
  active: boolean
  createdAt: string
  updatedAt?: string
}

export type StockItem = {
  id: string
  tenantId?: string
  branchId: string
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
export type StockMovementSource = 'Manuel' | 'Reçete' | 'Adisyon' | 'Sayım' | 'İade' | 'Fire' | 'Transfer'
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
  tenantId?: string
  branchId: string
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
  tenantId?: string
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
  tenantId?: string
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
  tenantId?: string
  branchId: string
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
  tenantId?: string
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
  tenantId?: string
  branchId: string
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
  tenantId?: string
  branchId: string
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
  tenantId?: string
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
  tenantId?: string
  branchId: string
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
  tenantId?: string
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
  tenantId?: string
  branchId: string
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
  tenantId?: string
  branchId: string
  companyId?: string
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
  tenantId?: string
  branchId: string
  tableId: string
  tableName: string
  waiterId: string
  waiterName: string
  status: KitchenOrderStatus
  items: KitchenOrderItem[]
  createdAt: string
  updatedAt: string
}

export type QRRequestStatus = 'Görevli Onayı Bekliyor' | 'Onaylandı' | 'Reddedildi'

export type QRRejectReason = 'Ürün mevcut değil' | 'Operasyon kapalı' | 'Müşteri iptali' | 'Hatalı alan' | 'Stok yetersiz' | 'Diğer'

export type QRRequestItem = {
  productId: string
  productName: string
  unitPrice: number
  qty: number
}

export type QRRequest = {
  id: string
  tenantId?: string
  branchId: string
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
  tenantId?: string
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
  tenantId?: string
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
  tenantId?: string
  branchId: string
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

export type Role = 'Admin' | 'Personel'

export type User = {
  id: string
  tenantId?: string
  companyId?: string
  fullName: string
  phone?: string
  profilePhotoUrl?: string
  username: string
  password: string
  role: Role
  active: boolean
}

export type BusinessRegistrationStatus = 'Başvuru Bekliyor' | 'Onaylandı' | 'Reddedildi' | 'Pasif'
export type BusinessRegistrationPackage = 'Başlangıç' | 'Pro' | 'Premium' | 'Kurumsal'

export type BusinessRegistration = {
  id: string
  tenantId?: string
  businessName: string
  ownerName: string
  phone: string
  email: string
  city: string
  district: string
  taxNumber: string
  taxOffice: string
  address: string
  branchCount: number
  requestedPackage: BusinessRegistrationPackage
  status: BusinessRegistrationStatus
  notes: string
  approvedBy: string
  approvedAt: string
  rejectedReason: string
  createdAt: string
  updatedAt: string
}

export type ApplicationStatus = 'Beklemede' | 'İnceleniyor' | 'Onaylandı' | 'Reddedildi'

export type BusinessApplication = {
  id: string
  companyId: string
  primarySectorId: string
  companyName: string
  ownerName: string
  phone: string
  email: string
  taxNumber: string
  taxOffice: string
  city: string
  district: string
  address: string
  status: ApplicationStatus
  approvalNote: string
  createdAt: string
  updatedAt: string
}

export type ApplicationNote = {
  id: string
  applicationId: string
  note: string
  createdBy: string
  createdAt: string
}

export type CompanyStatus = 'Başvuru Bekliyor' | 'Aktif' | 'Pasif' | 'Askıda' | 'Arşivlendi' | 'Silindi'

export type Company = {
  id: string
  companyCode: string
  companyName: string
  legalName: string
  taxOffice: string
  taxNumber: string
  phone: string
  email: string
  city: string
  district: string
  address: string
  authorizedPerson: string
  authorizedPhone: string
  authorizedEmail: string
  status: CompanyStatus
  isApproved: boolean
  primarySectorId: string
  approvedAt: string
  approvedBy: string
  workspaceId: string
  defaultBranchId: string
  tenantId: string
  subscriptionId: string
  licenseStart: string
  licenseEnd: string
  createdAt: string
  updatedAt: string
  deletedAt: string
  /** @deprecated Use authorizedPerson instead. */
  ownerName: string
  /** @deprecated Workspace branding will move under workspace settings. */
  logoUrl?: string
}

export type CompanySetup = {
  id: string
  tenantId?: string
  registrationId: string
  companyId: string
  branchId: string
  adminUserId: string
  temporaryPassword: string
  setupCompleted: boolean
  completedAt: string
  createdAt: string
  updatedAt: string
}

export type LicenseModuleKey =
  | 'adisyon'
  | 'qr-menu'
  | 'stock'
  | 'recipe'
  | 'current'
  | 'credit'
  | 'finance'
  | 'personnel'
  | 'boss-dashboard'
  | 'multi-branch'
  | 'analytics'
  | 'ai-consultant'
  | 'task-management'
  | 'calendar'

export type LicenseStatus =
  | 'Deneme'
  | 'Aktif'
  | 'Süresi Yaklaşıyor'
  | 'Süresi Doldu'
  | 'Askıya Alındı'
  | 'İptal Edildi'

export type LicensePackage = {
  id: string
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  maxUsers: number
  maxBranches: number
  maxTables: number
  maxStorageGB: number
  trialDays: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type PackageModule = {
  id: string
  packageId: string
  moduleKey: LicenseModuleKey
  moduleName: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export type LicenseModule = PackageModule

export type CompanyLicense = {
  id: string
  tenantId?: string
  companyId: string
  packageId: string
  licenseKey: string
  status: LicenseStatus
  startDate: string
  endDate: string
  isTrial: boolean
  trialEndDate: string
  lastRenewalDate: string
  nextRenewalDate: string
  createdAt: string
  updatedAt: string
}

export type CompanyUserRole =
  | 'Firma Sahibi'
  | 'Admin'
  | 'Yönetici'
  | 'Personel'
  | 'Operasyon'
  | 'Muhasebe'

export type CompanyUserStatus = 'Aktif' | 'Pasif' | 'Askıya Alındı' | 'Silindi'

export type CompanyUser = {
  id: string
  tenantId?: string
  companyId: string
  fullName: string
  username: string
  email: string
  phone: string
  role: CompanyUserRole
  status: CompanyUserStatus
  lastLogin: string
  createdAt: string
  updatedAt: string
}

export type UserSubscriptionStatus = 'Aktif' | 'Pasif' | 'Beklemede' | 'Süresi Doldu'

export type UserSubscription = {
  id: string
  tenantId?: string
  userId: string
  companyLicenseId: string
  status: UserSubscriptionStatus
  assignedAt: string
  expiresAt: string
  createdAt: string
  updatedAt: string
}

export type PlatformModuleStatus = {
  id: string
  moduleKey: LicenseModuleKey
  moduleName: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type PlatformSupportTicketStatus = 'Açık' | 'İnceleniyor' | 'Çözüldü'

export type PlatformSupportTicket = {
  id: string
  tenantId?: string
  companyId: string
  subject: string
  message: string
  status: PlatformSupportTicketStatus
  priority: 'Düşük' | 'Orta' | 'Yüksek'
  createdAt: string
  updatedAt: string
}

export type PlatformSettings = {
  id: string
  defaultCurrency: string
  defaultLanguage: string
  maintenanceMode: boolean
  defaultTheme: string
  createdAt: string
  updatedAt: string
}

export type Branch = {
  id: string
  tenantId?: string
  companyId?: string
  code: string
  name: string
  phone: string
  email: string
  address: string
  city: string
  district?: string
  managerName: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type BranchPermission = {
  id: string
  tenantId?: string
  userId: string
  branchId: string
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  createdAt: string
  updatedAt: string
}

export type BranchStockTransferStatus = 'Bekliyor' | 'Onaylandı' | 'Tamamlandı' | 'İptal Edildi'

export type BranchStockTransferItem = {
  stockItemId: string
  stockItemName: string
  quantity: number
  unit: StockUnit
}

export type BranchStockTransfer = {
  id: string
  tenantId?: string
  transferNo: string
  sourceBranchId: string
  targetBranchId: string
  transferDate: string
  status: BranchStockTransferStatus
  note: string
  createdBy: string
  createdAt: string
  updatedAt: string
  items: BranchStockTransferItem[]
}

export type EmployeePosition = string

export type Employee = {
  id: string
  tenantId?: string
  branchId: string
  code: string
  fullName: string
  position: EmployeePosition
  phone: string
  email: string
  startDate: string
  salary: number
  isActive: boolean
  note: string
  createdAt: string
  updatedAt: string
}

export type ShiftName = 'Sabah' | 'Akşam' | 'Tam Gün' | 'Gece'
export type ShiftStatus = 'Planlandı' | 'Tamamlandı' | 'İptal'

export type Shift = {
  id: string
  tenantId?: string
  branchId: string
  employeeId: string
  shiftName: ShiftName
  startTime: string
  endTime: string
  workDate: string
  status: ShiftStatus
  note: string
  createdAt: string
  updatedAt: string
}

export type AttendanceStatus = 'Normal' | 'Eksik Mesai' | 'Fazla Mesai' | 'Devamsız'

export type Attendance = {
  id: string
  tenantId?: string
  branchId: string
  employeeId: string
  workDate: string
  checkInTime: string
  checkOutTime: string
  workedMinutes: number
  overtimeMinutes: number
  status: AttendanceStatus
  note: string
  createdAt: string
  updatedAt: string
}

export type EmployeePerformance = {
  id: string
  tenantId?: string
  branchId: string
  employeeId: string
  workDate: string
  servedTableCount: number
  approvedOrderCount: number
  qrOrderCount: number
  customerCallCount: number
  performanceScore: number
  note: string
  createdAt: string
  updatedAt: string
}

export type EmployeeBonusStatus = 'Hesaplandı' | 'Onaylandı' | 'Ödendi' | 'İptal'

export type EmployeeBonus = {
  id: string
  tenantId?: string
  branchId: string
  employeeId: string
  period: string
  performanceScore: number
  bonusRate: number
  bonusAmount: number
  status: EmployeeBonusStatus
  note: string
  createdAt: string
  updatedAt: string
}

export type EmployeeAuditRecordType = 'Uyarı' | 'Tutanak' | 'Ödül' | 'Denetim Notu' | 'Bilgilendirme'
export type EmployeeAuditSeverity = 'Düşük' | 'Orta' | 'Yüksek' | 'Kritik'

export type EmployeeAudit = {
  id: string
  tenantId?: string
  branchId: string
  employeeId: string
  date: string
  recordType: EmployeeAuditRecordType
  severity: EmployeeAuditSeverity
  title: string
  description: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type CurrentAccountType = 'Müşteri' | 'Firma' | 'Personel' | 'Tedarikçi'

export type CurrentAccount = {
  id: string
  tenantId?: string
  branchId: string
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

export type CreditTransactionStatus = 'Açık' | 'Kapandı'

export type CreditTransaction = {
  id: string
  tenantId?: string
  branchId: string
  currentAccountId: string
  date: string
  amount: number
  paidAmount: number
  remainingAmount: number
  status: CreditTransactionStatus
  note: string
  createdAt: string
  updatedAt: string
}

export type SupplierDebtStatus = 'Açık' | 'Kapandı'

export type SupplierDebt = {
  id: string
  tenantId?: string
  branchId: string
  currentAccountId: string
  date: string
  amount: number
  paidAmount: number
  remainingAmount: number
  status: SupplierDebtStatus
  invoiceNumber: string
  note: string
  createdAt: string
  updatedAt: string
}

export type SupplierPaymentMethod = 'Nakit' | 'Kart' | 'Havale/EFT'

export type SupplierPayment = {
  id: string
  tenantId?: string
  branchId: string
  supplierDebtId: string
  currentAccountId: string
  date: string
  amount: number
  paymentMethod: SupplierPaymentMethod
  note: string
  createdAt: string
}

export type CashTransactionType = 'Gelir' | 'Gider'
export type CashPaymentMethod = 'Nakit' | 'Kart' | 'Havale/EFT'

export type CashTransaction = {
  id: string
  tenantId?: string
  branchId: string
  date: string
  type: CashTransactionType
  category: string
  amount: number
  paymentMethod: CashPaymentMethod
  referenceId: string
  description: string
  createdAt: string
}

export type IncomeExpenseType = 'Gelir' | 'Gider'
export type IncomeExpensePaymentMethod = 'Nakit' | 'Kart' | 'Havale/EFT'

export type IncomeExpense = {
  id: string
  tenantId?: string
  branchId: string
  date: string
  type: IncomeExpenseType
  category: string
  amount: number
  paymentMethod: IncomeExpensePaymentMethod
  description: string
  createdAt: string
  updatedAt: string
}

export type CashClosing = {
  id: string
  tenantId?: string
  branchId: string
  date: string
  openingBalance: number
  totalIncome: number
  totalExpense: number
  expectedBalance: number
  actualBalance: number
  difference: number
  note: string
  closedBy: string
  createdAt: string
}

export type CashTransfer = {
  id: string
  tenantId?: string
  branchId: string
  date: string
  transferNo: string
  fromUser: string
  toUser: string
  openingBalance: number
  transferredAmount: number
  note: string
  createdAt: string
}

export type CollectionPaymentMethod = 'Nakit' | 'Kart' | 'Havale/EFT' | 'Diğer'

export type CollectionTransaction = {
  id: string
  tenantId?: string
  branchId: string
  currentAccountId: string
  date: string
  amount: number
  paymentMethod: CollectionPaymentMethod
  note: string
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
  | 'Görevli çağrıldı'
  | 'Görevli Çağrısı Sahiplenildi'
  | 'Görevli Çağrısı Masaya Gidildi'
  | 'Görevli Çağrısı Kapatıldı'
  | 'Dijital Talep Oluşturuldu'
  | 'Dijital Talep Düzenlendi'
  | 'Dijital Talep Notu Güncellendi'
  | 'Dijital Talep Onaylandı'
  | 'Dijital Talep Reddedildi'
  | 'Hesap kapatıldı'
  | 'Ürün oluşturuldu'
  | 'Ürün güncellendi'
  | 'Ürün besin bilgisi güncellendi'
  | 'Ürün alerjen bilgisi güncellendi'
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
  | 'Kayıp kaydı oluşturuldu'
  | 'Kayıp kaydı terslendi'
  | 'Kayıp lottan düşüldü'
  | 'Geçerlilik nedeniyle kayıp oluşturuldu'
  | 'Üretim Tanımı oluşturuldu'
  | 'Üretim Tanımı güncellendi'
  | 'Üretim Tanımı silindi'
  | 'Üretim Tanımı kopyalandı'
  | 'Üretim Tanımı aktif yapıldı'
  | 'Üretim Tanımı pasif yapıldı'
  | 'Otomatik stok düşümü yapıldı'
  | 'Otomatik stok düşümü terslendi'
  | 'Otomatik stok düşümü uyarısı'
  | 'Otomatik stok düşümü başarısız'
  | 'Kullanıcı oluşturuldu'
  | 'Kullanıcı güncellendi'
  | 'Kullanıcı aktif yapıldı'
  | 'Kullanıcı pasif yapıldı'
  | 'Kullanıcı pasife alındı'
  | 'Kullanıcı silindi'
  | 'Şifre sıfırlandı'
  | 'Lisans kullanıcıya atandı'
  | 'Şube oluşturuldu'
  | 'Şube güncellendi'
  | 'Şube silindi'
  | 'Şube aktif yapıldı'
  | 'Şube pasif yapıldı'
  | 'Şube değiştirildi'
  | 'Veri şubeye bağlandı'
  | 'Transfer oluşturuldu'
  | 'Transfer onaylandı'
  | 'Transfer tamamlandı'
  | 'Transfer iptal edildi'
  | 'Şube yetkisi oluşturuldu'
  | 'Şube yetkisi güncellendi'
  | 'Şube yetkisi silindi'
  | 'Cari oluşturuldu'
  | 'Cari güncellendi'
  | 'Cari aktif yapıldı'
  | 'Cari pasif yapıldı'
  | 'Cari silindi'
  | 'Veresiye oluşturuldu'
  | 'Veresiye güncellendi'
  | 'Tahsilat girildi'
  | 'Veresiye kapatıldı'
  | 'Veresiye silindi'
  | 'Tahsilat oluşturuldu'
  | 'Tahsilat güncellendi'
  | 'Tahsilat silindi'
  | 'Tedarikçi borcu oluşturuldu'
  | 'Tedarikçi borcu güncellendi'
  | 'Tedarikçi ödemesi girildi'
  | 'Tedarikçi borcu kapatıldı'
  | 'Tedarikçi borcu silindi'
  | 'Tedarikçi ödemesi oluşturuldu'
  | 'Tedarikçi ödemesi silindi'
  | 'Kasa hareketi oluşturuldu'
  | 'Kasa hareketi silindi'
  | 'Gelir kaydı oluşturuldu'
  | 'Gelir kaydı güncellendi'
  | 'Gelir kaydı silindi'
  | 'Gider kaydı oluşturuldu'
  | 'Gider kaydı güncellendi'
  | 'Gider kaydı silindi'
  | 'Gün sonu kasa kapatıldı'
  | 'Kasa devri oluşturuldu'
  | 'Kasa devri silindi'
  | 'Personel oluşturuldu'
  | 'Personel güncellendi'
  | 'Personel pasif yapıldı'
  | 'Personel silindi'
  | 'Vardiya oluşturuldu'
  | 'Vardiya güncellendi'
  | 'Vardiya tamamlandı'
  | 'Vardiya iptal edildi'
  | 'Vardiya silindi'
  | 'Puantaj oluşturuldu'
  | 'Puantaj güncellendi'
  | 'Puantaj silindi'
  | 'Performans kaydı oluşturuldu'
  | 'Performans kaydı güncellendi'
  | 'Performans kaydı silindi'
  | 'Prim oluşturuldu'
  | 'Prim güncellendi'
  | 'Prim onaylandı'
  | 'Prim ödendi'
  | 'Prim iptal edildi'
  | 'Prim silindi'
  | 'Denetim kaydı oluşturuldu'
  | 'Denetim kaydı güncellendi'
  | 'Denetim kaydı silindi'
  | 'İşletme başvurusu oluşturuldu'
  | 'İşletme başvurusu onaylandı'
  | 'İşletme başvurusu reddedildi'
  | 'İşletme başvurusu güncellendi'
  | 'Başvuru oluşturuldu'
  | 'Başvuru incelendi'
  | 'Başvuru onaylandı'
  | 'Başvuru reddedildi'
  | 'Firma otomatik oluşturuldu'
  | 'Tenant otomatik oluşturuldu'
  | 'Lisans otomatik oluşturuldu'
  | 'Firma oluşturuldu'
  | 'Admin kullanıcı oluşturuldu'
  | 'Kurulum tamamlandı'
  | 'Paket oluşturuldu'
  | 'Paket güncellendi'
  | 'Paket pasife alındı'
  | 'Lisans atandı'
  | 'Lisans yenilendi'
  | 'Lisans askıya alındı'
  | 'Lisans iptal edildi'
  | 'Modül aktif edildi'
  | 'Modül pasif edildi'
  | 'Firma modülü güncellendi'
  | 'Lisans erişim kontrolü başarısız'
  | 'EVREN360 firma güncellendi'
  | 'EVREN360 firma pasife alındı'
  | 'EVREN360 firma askıya alındı'
  | 'EVREN360 firma arşivlendi'
  | 'EVREN360 firma silindi'
  | 'EVREN360 başvuru notu eklendi'
  | 'EVREN360 paket silindi'
  | 'EVREN360 modül durumu güncellendi'
  | 'EVREN360 abonelik güncellendi'
  | 'EVREN360 destek talebi güncellendi'
  | 'EVREN360 sistem ayarı güncellendi'

  | 'Tenant oluşturuldu'
  | 'Tenant güncellendi'
  | 'Tenant pasife alındı'
  | 'Tenant aktif edildi'
  | 'Tenant arşivlendi'
  | 'Tenant erişimi engellendi'
  | 'Veri izolasyonu doğrulandı'

export type ActionLog = {
  id: string
  tenantId?: string
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

export type SystemUsageModuleName =
  | 'İşlem Yönetimi'
  | 'Alan Yönetimi'
  | 'Ürün / Hizmet Yönetimi'
  | 'Stok Yönetimi'
  | 'Cari Yönetimi'
  | 'Finans Yönetimi'
  | 'Personel Yönetimi'
  | 'Yönetici Merkezi'
  | 'Çoklu Şube Yönetimi'
  | 'Üretim Tanımı'
  | 'Sistem'

export type SystemUsageActionType =
  | 'Görüntüleme'
  | 'Oluşturma'
  | 'Güncelleme'
  | 'Silme'
  | 'Giriş Yapma'
  | 'Çıkış Yapma'
  | 'Onaylama'
  | 'İptal Etme'

export type SystemUsageLog = {
  id: string
  tenantId?: string
  userId: string
  userName: string
  branchId: string
  moduleName: SystemUsageModuleName
  actionType: SystemUsageActionType
  entityType: string
  entityId: string
  description: string
  ipAddress: string
  deviceInfo: string
  createdAt: string
}

export type UserActivitySummary = {
  id: string
  tenantId?: string
  userId: string
  userName: string
  branchId: string
  lastLoginAt: string
  lastActivityAt: string
  totalLogins: number
  activeDays: number
  totalActions: number
  averageDailyActions: number
  mostUsedModule: string
  createdAt: string
  updatedAt: string
}

export type ModuleUsageSummary = {
  id: string
  moduleName: SystemUsageModuleName
  totalUsageCount: number
  uniqueUserCount: number
  activeDayCount: number
  averageDailyUsage: number
  lastUsedAt: string
  mostActiveUser: string
  createdAt: string
  updatedAt: string
}

export type BusinessUsageSummary = {
  id: string
  tenantId?: string
  branchId: string
  branchName: string
  lastActivityAt: string
  activeUserCount: number
  totalLogins: number
  totalActions: number
  activeDays: number
  averageDailyActions: number
  mostUsedModule: string
  usageScore: number
  createdAt: string
  updatedAt: string
}

export type UsagePerformanceSummary = {
  id: string
  date: string
  hour: number
  totalActions: number
  activeUsers: number
  activeBranches: number
  averageActionsPerUser: number
  peakUsageScore: number
  createdAt: string
  updatedAt: string
}

export type SystemHealthMetricStatus = 'Sağlıklı' | 'Uyarı' | 'Kritik'

export type SystemHealthMetric = {
  id: string
  metricName: string
  metricCategory: string
  metricValue: number
  status: SystemHealthMetricStatus
  description: string
  measuredAt: string
  createdAt: string
  updatedAt: string
}
