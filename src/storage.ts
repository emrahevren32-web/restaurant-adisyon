import {
  ActionLog,
  ActionLogType,
  Attendance,
  AttendanceStatus,
  ApplicationNote,
  ApplicationStatus,
  BusinessApplication,
  BusinessRegistration,
  BusinessRegistrationPackage,
  BusinessRegistrationStatus,
  BusinessUsageSummary,
  CashPaymentMethod,
  CashClosing,
  CashTransfer,
  CashTransaction,
  CashTransactionType,
  ClosedBill,
  Company,
  CompanyLicense,
  CompanySetup,
  CompanyStatus,
  CompanyUser,
  CompanyUserRole,
  CompanyUserStatus,
  CriticalStockEvent,
  CriticalStockEventType,
  CriticalStockTrigger,
  CollectionPaymentMethod,
  CollectionTransaction,
  CreditTransaction,
  CurrentAccount,
  CurrentAccountType,
  Discount,
  Employee,
  EmployeeAudit,
  EmployeeAuditRecordType,
  EmployeeAuditSeverity,
  EmployeeBonus,
  EmployeeBonusStatus,
  EmployeePerformance,
  EmployeePosition,
  IncomeExpense,
  IncomeExpensePaymentMethod,
  IncomeExpenseType,
  KitchenOrder,
  KitchenOrderStatus,
  LicenseModule,
  LicenseModuleKey,
  LicensePackage,
  LicenseStatus,
  ModuleUsageSummary,
  Order,
  PaymentMethod,
  PaymentPart,
  Product,
  ProductCategory,
  QRAuditEvent,
  AuditEntityType,
  AuditEventType,
  Branch,
  BranchPermission,
  BranchStockTransfer,
  BranchStockTransferItem,
  BranchStockTransferStatus,
  QRRejectReason,
  QRRequest,
  QRRequestHistory,
  QRRequestItem,
  QRRequestStatus,
  Recipe,
  RecipeAuditEvent,
  RecipeAuditEventType,
  RecipeCostSnapshot,
  RecipeItem,
  PlatformModuleStatus,
  PlatformSettings,
  PlatformSupportTicket,
  PlatformSupportTicketStatus,
  StockCategory,
  StockDeductionAuditEvent,
  StockDeductionAuditEventType,
  StockDeductionBatch,
  StockDeductionLine,
  StockDeductionSourceType,
  StockDeductionStatus,
  StockExpiryAllocation,
  StockExpiryEvent,
  StockExpiryEventType,
  StockExpiryLot,
  StockExpiryStatus,
  StockExpiryTrigger,
  StockItem,
  StockMovement,
  StockMovementAuditEvent,
  StockMovementAuditEventType,
  StockMovementReason,
  StockMovementSource,
  StockMovementType,
  StockUnit,
  Shift,
  ShiftName,
  ShiftStatus,
  SupplierDebt,
  SupplierPayment,
  SupplierPaymentMethod,
  StockWasteReasonCategory,
  StockWasteRecord,
  StockWasteStatus,
  Sector,
  Tenant,
  TenantSettings,
  SystemHealthMetric,
  SystemHealthMetricStatus,
  SystemSettings,
  SystemUsageActionType,
  SystemUsageLog,
  SystemUsageModuleName,
  TableState,
  UsagePerformanceSummary,
  UserActivitySummary,
  User,
  UserSubscription,
  UserSubscriptionStatus,
  WaiterCall,
  WaiterCallHistory,
  WaiterCallStatus
} from './types'
import { recordBusinessApplicationNotification } from './notifications/evren360-notification.service'
import { recordCompanyAuditEvent } from './companies/company-audit.service'
import { recordTenantAuditEvent } from './tenant/tenant-audit.service'
import {
  normalizeProductAllergens,
  normalizeProductNutrition,
  normalizeServingSize
} from './productNutrition'
import {
  TENANT_ISOLATION_DENIED_MESSAGE,
  assertTenantAccess,
  createDefaultTenantSettings,
  createTenantStorageId,
  filterByTenant,
  loadTenantSettings as loadTenantSettingsFromHelper,
  loadTenants as loadTenantsFromHelper,
  normalizeTenant,
  normalizeTenantSettings,
  resolveTenantIdForCompany,
  resolveTenantIdForRecord,
  saveTenantSettings as saveTenantSettingsFromHelper,
  saveTenants as saveTenantsFromHelper,
  withTenantId
} from './tenant'
import { formatStockQuantity, isCriticalStock } from './criticalStock'
import {
  DEFAULT_EXPIRY_WARNING_DAYS,
  formatExpiryDate,
  formatExpiryQuantity,
  getExpiryStatus,
  getExpiryWarningDays,
  isConsumableExpiryLot,
  isExpiryTracked,
  normalizeExpiryDateKey,
  sortLotsFefo
} from './expiryStock'
import {
  DEFAULT_STOCK_CURRENCY,
  calculateWeightedAverageCost,
  formatStockMoney,
  getStockAverageCost,
  getStockConsumptionUnitCost,
  getStockCurrency,
  normalizeCostValue,
  roundCost
} from './stockCost'
import {
  DEFAULT_SECTOR_CODE,
  DEFAULT_SECTOR_ID,
  FALLBACK_SECTOR_ICON,
  FALLBACK_SECTOR_SORT_ORDER,
  SECTOR_CODES,
  SECTOR_ID_PREFIX,
  createSectorId,
  getDefaultSectors
} from './sector/sector.registry'

const KEY_PRODUCTS = 'ra_products'
const KEY_CATEGORIES = 'ra_categories'
const KEY_STOCK_ITEMS = 'ra_stock_items'
const KEY_STOCK_CATEGORIES = 'ra_stock_categories'
const KEY_STOCK_MOVEMENTS = 'ra_stock_movements'
const KEY_STOCK_MOVEMENT_AUDIT = 'ra_stock_movement_audit'
const KEY_CRITICAL_STOCK_EVENTS = 'ra_critical_stock_events'
const KEY_STOCK_EXPIRY_LOTS = 'ra_stock_expiry_lots'
const KEY_STOCK_EXPIRY_EVENTS = 'ra_stock_expiry_events'
const KEY_STOCK_DEDUCTION_BATCHES = 'ra_stock_deduction_batches'
const KEY_STOCK_DEDUCTION_AUDIT = 'ra_stock_deduction_audit_events'
const KEY_STOCK_WASTE_RECORDS = 'ra_stock_waste_records'
const KEY_RECIPES = 'ra_recipes'
const KEY_RECIPE_AUDIT_EVENTS = 'ra_recipe_audit_events'
const KEY_TABLES = 'ra_tables'
const KEY_CLOSED = 'ra_closed'
const KEY_USERS = 'ra_users'
const KEY_BRANCHES = 'ra_branches'
const KEY_BRANCH_PERMISSIONS = 'ra_branch_permissions'
const KEY_ACTIVE_BRANCH = 'ra_active_branch_id'
const KEY_EMPLOYEES = 'ra_employees'
const KEY_SHIFTS = 'ra_shifts'
const KEY_ATTENDANCES = 'ra_attendances'
const KEY_EMPLOYEE_PERFORMANCES = 'ra_employee_performances'
const KEY_EMPLOYEE_BONUSES = 'ra_employee_bonuses'
const KEY_EMPLOYEE_AUDITS = 'ra_employee_audits'
const KEY_CURRENT_ACCOUNTS = 'ra_current_accounts'
const KEY_CREDIT_TRANSACTIONS = 'ra_credit_transactions'
const KEY_COLLECTION_TRANSACTIONS = 'ra_collection_transactions'
const KEY_SUPPLIER_DEBTS = 'ra_supplier_debts'
const KEY_SUPPLIER_PAYMENTS = 'ra_supplier_payments'
const KEY_CASH_TRANSACTIONS = 'ra_cash_transactions'
const KEY_INCOME_EXPENSES = 'ra_income_expenses'
const KEY_CASH_CLOSINGS = 'ra_cash_closings'
const KEY_CASH_TRANSFERS = 'ra_cash_transfers'
const KEY_AUTH = 'ra_auth'
const KEY_LOGS = 'ra_logs'
const KEY_SYSTEM_USAGE_LOGS = 'ra_system_usage_logs'
const KEY_KITCHEN = 'ra_kitchen_orders'
const KEY_QR_REQUESTS = 'ra_qr_requests'
const KEY_QR_REQUEST_HISTORY = 'ra_qr_request_history'
const KEY_QR_AUDIT_EVENTS = 'ra_qr_audit_events'
const KEY_SETTINGS = 'ra_settings'
const KEY_WAITER_CALLS = 'ra_waiter_calls'
const KEY_WAITER_CALL_HISTORY = 'ra_waiter_call_history'
const KEY_BRANCH_STOCK_TRANSFERS = 'ra_branch_stock_transfers'
const KEY_BUSINESS_APPLICATIONS = 'ra_business_applications'
const KEY_APPLICATION_NOTES = 'ra_application_notes'
const KEY_BUSINESS_REGISTRATIONS = 'ra_business_registrations'
const KEY_COMPANIES = 'ra_companies'
const KEY_COMPANY_SETUPS = 'ra_company_setups'
const KEY_LICENSE_PACKAGES = 'ra_license_packages'
const KEY_LICENSE_MODULES = 'ra_license_modules'
const KEY_COMPANY_LICENSES = 'ra_company_licenses'
const KEY_COMPANY_USERS = 'ra_company_users'
const KEY_USER_SUBSCRIPTIONS = 'ra_user_subscriptions'
const KEY_PLATFORM_MODULES = 'ra_platform_modules'
const KEY_PLATFORM_SUPPORT_TICKETS = 'ra_platform_support_tickets'
const KEY_PLATFORM_SETTINGS = 'ra_platform_settings'
const KEY_SECTORS = 'ra_sectors'

export const DEFAULT_BRANCH_ID = 'branch_merkez'
const DEFAULT_CATEGORY_ID = 'cat_general'
const DEFAULT_STOCK_CATEGORY_ID = 'stock_cat_general'
const STOCK_UNITS: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
const STOCK_MOVEMENT_TYPES: StockMovementType[] = ['Giriş', 'Çıkış', 'Sayım Düzeltme']
const STOCK_MOVEMENT_SOURCES: StockMovementSource[] = ['Manuel', 'Reçete', 'Adisyon', 'Sayım', 'İade', 'Fire', 'Transfer']
const STOCK_MOVEMENT_REASONS: StockMovementReason[] = ['Satın Alma', 'İade', 'Fire', 'Kullanım', 'Sayım Fazlası', 'Sayım Eksiği', 'Ters Hareket', 'Diğer']
export const STOCK_WASTE_REASONS: StockWasteReasonCategory[] = ['Bozulma', 'SKT Geçmesi', 'Dökülme', 'Hazırlık Kaybı', 'Üretim Hatası', 'Yanlış Sipariş', 'Müşteri İadesi', 'Sayım Farkı', 'Diğer']
export const HIGH_COST_FIRE_APPROVAL_THRESHOLD = 1000
const CURRENT_ACCOUNT_TYPES: CurrentAccountType[] = ['Müşteri', 'Firma', 'Personel', 'Tedarikçi']
const COLLECTION_PAYMENT_METHODS: CollectionPaymentMethod[] = ['Nakit', 'Kart', 'Havale/EFT', 'Diğer']
const SUPPLIER_PAYMENT_METHODS: SupplierPaymentMethod[] = ['Nakit', 'Kart', 'Havale/EFT']
const CASH_TRANSACTION_TYPES: CashTransactionType[] = ['Gelir', 'Gider']
const CASH_PAYMENT_METHODS: CashPaymentMethod[] = ['Nakit', 'Kart', 'Havale/EFT']
const INCOME_EXPENSE_TYPES: IncomeExpenseType[] = ['Gelir', 'Gider']
const INCOME_EXPENSE_PAYMENT_METHODS: IncomeExpensePaymentMethod[] = ['Nakit', 'Kart', 'Havale/EFT']
const LEGACY_EMPLOYEE_POSITIONS = ['Garson', 'Kasiyer', 'Aşçı', 'Kurye', 'Mutfak'] as const
const EMPLOYEE_POSITIONS: EmployeePosition[] = []
const SHIFT_NAMES: ShiftName[] = ['Sabah', 'Akşam', 'Tam Gün', 'Gece']
const SHIFT_STATUSES: ShiftStatus[] = ['Planlandı', 'Tamamlandı', 'İptal']
const ATTENDANCE_STATUSES: AttendanceStatus[] = ['Normal', 'Eksik Mesai', 'Fazla Mesai', 'Devamsız']
const EMPLOYEE_BONUS_STATUSES: EmployeeBonusStatus[] = ['Hesaplandı', 'Onaylandı', 'Ödendi', 'İptal']
const EMPLOYEE_AUDIT_RECORD_TYPES: EmployeeAuditRecordType[] = ['Uyarı', 'Tutanak', 'Ödül', 'Denetim Notu', 'Bilgilendirme']
const EMPLOYEE_AUDIT_SEVERITIES: EmployeeAuditSeverity[] = ['Düşük', 'Orta', 'Yüksek', 'Kritik']
const BRANCH_STOCK_TRANSFER_STATUSES: BranchStockTransferStatus[] = ['Bekliyor', 'Onaylandı', 'Tamamlandı', 'İptal Edildi']
const APPLICATION_STATUSES: ApplicationStatus[] = ['Beklemede', 'İnceleniyor', 'Onaylandı', 'Reddedildi']
const BUSINESS_REGISTRATION_STATUSES: BusinessRegistrationStatus[] = ['Başvuru Bekliyor', 'Onaylandı', 'Reddedildi', 'Pasif']
const BUSINESS_REGISTRATION_PACKAGES: BusinessRegistrationPackage[] = ['Başlangıç', 'Pro', 'Premium', 'Kurumsal']
const COMPANY_STATUSES: CompanyStatus[] = ['Başvuru Bekliyor', 'Aktif', 'Pasif', 'Askıda', 'Arşivlendi', 'Silindi']
const LICENSE_STATUSES: LicenseStatus[] = ['Deneme', 'Aktif', 'Süresi Yaklaşıyor', 'Süresi Doldu', 'Askıya Alındı', 'İptal Edildi']
const LEGACY_COMPANY_USER_ROLES = ['Müdür', 'Kasiyer', 'Garson', 'Mutfak', 'Kurye'] as const
const COMPANY_USER_ROLES: CompanyUserRole[] = ['Firma Sahibi', 'Admin', 'Yönetici', 'Personel', 'Operasyon', 'Muhasebe']
const COMPANY_USER_STATUSES: CompanyUserStatus[] = ['Aktif', 'Pasif', 'Askıya Alındı', 'Silindi']
const USER_SUBSCRIPTION_STATUSES: UserSubscriptionStatus[] = ['Aktif', 'Pasif', 'Beklemede', 'Süresi Doldu']
const PLATFORM_SUPPORT_TICKET_STATUSES: PlatformSupportTicketStatus[] = ['Açık', 'İnceleniyor', 'Çözüldü']
export const LICENSE_MODULE_CATALOG: Array<{ key: LicenseModuleKey; name: string }> = [
  { key: 'adisyon', name: 'İşlem Yönetimi' },
  { key: 'qr-menu', name: 'Dijital Katalog' },
  { key: 'stock', name: 'Stok' },
  { key: 'recipe', name: 'Üretim Tanımları' },
  { key: 'purchase', name: 'Satın Alma' },
  { key: 'current', name: 'Cari' },
  { key: 'credit', name: 'Veresiye' },
  { key: 'finance', name: 'Finans' },
  { key: 'personnel', name: 'Personel' },
  { key: 'boss-dashboard', name: 'Yönetici Merkezi' },
  { key: 'multi-branch', name: 'Çoklu Şube' },
  { key: 'analytics', name: 'Analitik' },
  { key: 'ai-consultant', name: 'AI Danışman' },
  { key: 'task-management', name: 'Görev Yönetimi' },
  { key: 'calendar', name: 'Takvim' }
]
const SYSTEM_USAGE_MODULE_NAMES: SystemUsageModuleName[] = ['İşlem Yönetimi', 'Alan Yönetimi', 'Ürün / Hizmet Yönetimi', 'Stok Yönetimi', 'Cari Yönetimi', 'Finans Yönetimi', 'Personel Yönetimi', 'Yönetici Merkezi', 'Çoklu Şube Yönetimi', 'Sistem']
const SYSTEM_USAGE_ACTION_TYPES: SystemUsageActionType[] = ['Görüntüleme', 'Oluşturma', 'Güncelleme', 'Silme', 'Giriş Yapma', 'Çıkış Yapma', 'Onaylama', 'İptal Etme']

export const DEFAULT_SETTINGS: SystemSettings = {
  restaurantName: 'MIYOP İşletme Çalışma Alanı',
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

const createDefaultStockCategory = (): StockCategory => ({
  id: DEFAULT_STOCK_CATEGORY_ID,
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

const compareSectors = (first: Sector, second: Sector) => {
  const orderDiff = first.sortOrder - second.sortOrder
  if(orderDiff !== 0) return orderDiff
  return first.name.localeCompare(second.name, 'tr')
}

const normalizeSectorCode = (value: unknown) => {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
}

const normalizeSector = (item: Partial<Sector>): Sector => {
  const defaultSector = getDefaultSectors().find(sector => sector.id === DEFAULT_SECTOR_ID)
  const code = normalizeSectorCode(item.code || item.id || item.name) || DEFAULT_SECTOR_CODE
  const id = String(item.id || createSectorId(code)).trim() || createSectorId(code)
  const sortOrder = Number(item.sortOrder)

  return {
    id,
    code,
    name: String(item.name || defaultSector?.name || code).trim() || code,
    description: String(item.description || defaultSector?.description || '').trim(),
    icon: String(item.icon || code.slice(0, 2).toLocaleUpperCase('tr-TR')).trim() || FALLBACK_SECTOR_ICON,
    color: String(item.color || defaultSector?.color || '').trim() || defaultSector?.color || '',
    isActive: item.isActive !== false,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : FALLBACK_SECTOR_SORT_ORDER
  }
}

const mergeDefaultSectors = (storedSectors: Sector[]) => {
  const sectorMap = new Map<string, Sector>()

  getDefaultSectors().forEach(sector => {
    sectorMap.set(sector.id, normalizeSector(sector))
  })

  storedSectors.forEach(sector => {
    sectorMap.set(sector.id, normalizeSector(sector))
  })

  return Array.from(sectorMap.values()).sort(compareSectors)
}

export const loadSectors = (options: { includeInactive?: boolean } = {}) => {
  const storedSectors = localStorage.getItem(KEY_SECTORS)
  const sectors = storedSectors === null
    ? getDefaultSectors()
    : mergeDefaultSectors(readJson<Partial<Sector>[]>(KEY_SECTORS, []).map(normalizeSector))
  const normalizedSectors = sectors.map(normalizeSector).sort(compareSectors)
  const payload = JSON.stringify(normalizedSectors)

  if(storedSectors !== payload){
    localStorage.setItem(KEY_SECTORS, payload)
  }

  return options.includeInactive
    ? normalizedSectors
    : normalizedSectors.filter(sector => sector.isActive)
}

export const saveSectors = (items: Sector[]) => {
  localStorage.setItem(KEY_SECTORS, JSON.stringify(mergeDefaultSectors(items.map(normalizeSector))))
}

const normalizePrimarySectorId = (value: unknown) => {
  const sectorId = String(value || '').trim()
  if(!sectorId) return DEFAULT_SECTOR_ID

  const knownSectorIds = new Set(loadSectors({ includeInactive: true }).map(sector => sector.id))
  if(knownSectorIds.has(sectorId)) return sectorId

  const legacySectorId = sectorId.startsWith(SECTOR_ID_PREFIX) ? sectorId : createSectorId(sectorId)
  return knownSectorIds.has(legacySectorId) ? legacySectorId : DEFAULT_SECTOR_ID
}

const getAppStorageKeys = () => {
  const keys: string[] = []

  for(let index = 0; index < localStorage.length; index += 1){
    const key = localStorage.key(index)
    if(key?.startsWith('ra_')) keys.push(key)
  }

  return keys
}

type BranchScopedRecord = {
  id: string
  branchId: string
  tenantId?: string
  companyId?: string
  userId?: string
}

type TenantScopedRecord = {
  id?: string
  tenantId?: string
  branchId?: string
  companyId?: string
  userId?: string
}

const readUsersForTenantContext = () => {
  return readJson<Array<Pick<User, 'id' | 'companyId' | 'tenantId'>>>(KEY_USERS, [])
}

const getTenantStorageContext = (user?: User | null) => ({
  user: user === undefined ? getCurrentUser() : user,
  branches: readBranchesFromStorage(),
  users: readUsersForTenantContext()
})

const addTenantScope = <T extends TenantScopedRecord>(item: T, user?: User | null) => {
  return withTenantId(item, getTenantStorageContext(user))
}

const filterTenantScope = <T extends TenantScopedRecord>(items: T[], user?: User | null) => {
  return filterByTenant(items, getTenantStorageContext(user))
}

const assertTenantScope = (item: TenantScopedRecord, user?: User | null) => {
  return assertTenantAccess(item, getTenantStorageContext(user))
}

export type BranchPermissionAction = 'canView' | 'canCreate' | 'canEdit' | 'canDelete'

const getBranchIdValue = (item: { branchId?: string } | undefined, fallbackBranchId = DEFAULT_BRANCH_ID) => {
  const branchId = String(item?.branchId || '').trim()
  return branchId || fallbackBranchId
}

const withBranchIdFallback = <T extends object>(item: Partial<T>, fallbackBranchId: string): Partial<T> & { branchId: string } => {
  return {
    ...item,
    branchId: getBranchIdValue(item as { branchId?: string }, fallbackBranchId)
  }
}

const readBranchesFromStorage = () => {
  const stored = localStorage.getItem(KEY_BRANCHES)
  if(stored === null) return createDemoBranches()

  return readJson<Partial<Branch>[]>(KEY_BRANCHES, []).map(normalizeBranch)
}

const readBranchPermissionsFromStorage = () => {
  return readJson<Partial<BranchPermission>[]>(KEY_BRANCH_PERMISSIONS, []).map(normalizeBranchPermission)
}

const isAdminUser = (user?: User | null) => user?.role === 'Admin'

const getPermissionUser = (user?: User | null) => user === undefined ? getCurrentUser() : user

const userHasBranchPermissionValue = (
  user: User | null | undefined,
  branchId: string,
  action: BranchPermissionAction = 'canView',
  permissions = readBranchPermissionsFromStorage()
) => {
  if(isAdminUser(user)) return true
  if(!user || !branchId) return false

  return permissions.some(permission => (
    permission.userId === user.id
    && permission.branchId === branchId
    && permission.canView
    && permission[action]
  ))
}

const filterBranchesByPermission = (branches: Branch[], user?: User | null) => {
  const permissionUser = getPermissionUser(user)
  const tenantScopedBranches = filterByTenant(branches, {
    user: permissionUser,
    branches,
    users: readUsersForTenantContext()
  })
  if(isAdminUser(permissionUser)) return tenantScopedBranches

  const permissions = readBranchPermissionsFromStorage()
  return tenantScopedBranches.filter(branch => userHasBranchPermissionValue(permissionUser, branch.id, 'canView', permissions))
}

export const canUseBranch = (
  branchId: string,
  action: BranchPermissionAction = 'canView',
  user?: User | null
) => {
  return userHasBranchPermissionValue(getPermissionUser(user), branchId, action)
}

export const getVisibleBranchesForUser = (user?: User | null) => {
  return filterBranchesByPermission(readBranchesFromStorage(), user)
}

export function getActiveBranchId(){
  const branches = readBranchesFromStorage()
  const currentUser = getCurrentUser()
  const canUseGlobalBranchFallback = isAdminUser(currentUser) && !getCompanyIdForUser(currentUser)
  const visibleBranches = filterBranchesByPermission(branches)
  const storedBranchId = String(localStorage.getItem(KEY_ACTIVE_BRANCH) || '').trim()
  const selectedBranch = visibleBranches.find(branch => branch.id === storedBranchId && branch.isActive)
    || visibleBranches.find(branch => branch.id === DEFAULT_BRANCH_ID && branch.isActive)
    || visibleBranches.find(branch => branch.isActive)
    || visibleBranches[0]
    || (canUseGlobalBranchFallback ? branches.find(branch => branch.id === storedBranchId && branch.isActive) : undefined)
    || (canUseGlobalBranchFallback ? branches.find(branch => branch.id === DEFAULT_BRANCH_ID && branch.isActive) : undefined)
    || (canUseGlobalBranchFallback ? branches.find(branch => branch.isActive) : undefined)
    || (canUseGlobalBranchFallback ? branches[0] : undefined)

  const activeBranchId = selectedBranch?.id || DEFAULT_BRANCH_ID
  localStorage.setItem(KEY_ACTIVE_BRANCH, activeBranchId)
  return activeBranchId
}

export function getActiveBranch(){
  const branches = readBranchesFromStorage()
  const activeBranchId = getActiveBranchId()
  const visibleBranches = filterBranchesByPermission(branches)
  return visibleBranches.find(branch => branch.id === activeBranchId)
    || visibleBranches[0]
    || branches.find(branch => branch.id === activeBranchId && isAdminUser(getCurrentUser()) && !getCompanyIdForUser(getCurrentUser()))
    || undefined
}

export function setActiveBranchId(branchId: string, user?: User){
  const branches = readBranchesFromStorage()
  const visibleBranches = filterBranchesByPermission(branches, user)
  const previousBranchId = getActiveBranchId()
  const previousBranch = branches.find(branch => branch.id === previousBranchId)
  const selectedBranch = visibleBranches.find(branch => branch.id === branchId && branch.isActive)
    || visibleBranches.find(branch => branch.id === DEFAULT_BRANCH_ID && branch.isActive)
    || visibleBranches.find(branch => branch.isActive)
    || visibleBranches[0]

  const nextBranchId = selectedBranch?.id || DEFAULT_BRANCH_ID
  localStorage.setItem(KEY_ACTIVE_BRANCH, nextBranchId)

  if(user && previousBranchId !== nextBranchId){
    addActionLog({
      operationType: 'Şube değiştirildi',
      user,
      description: `Aktif şube ${previousBranch?.name || previousBranchId || 'Bilinmeyen şube'} -> ${selectedBranch?.name || nextBranchId} olarak değiştirildi.`
    })
  }

  return nextBranchId
}

const normalizeBranchScopedItems = <T extends BranchScopedRecord>(
  items: Partial<T>[],
  normalizer: (item: Partial<T>) => T,
  fallbackBranchId: string,
  predicate?: (item: T) => boolean
) => {
  const tenantContext = getTenantStorageContext()
  const normalized = items
    .map(item => normalizer(withBranchIdFallback<T>(item, fallbackBranchId)))
    .map(item => withTenantId(item, tenantContext))
  return predicate ? normalized.filter(predicate) : normalized
}

const loadBranchScopedItems = <T extends BranchScopedRecord>(
  key: string,
  normalizer: (item: Partial<T>) => T,
  predicate?: (item: T) => boolean
) => {
  const activeBranchId = getActiveBranchId()
  if(!canUseBranch(activeBranchId, 'canView')) return []

  return filterTenantScope(normalizeBranchScopedItems(readJson<Partial<T>[]>(key, []), normalizer, DEFAULT_BRANCH_ID, predicate))
    .filter(item => item.branchId === activeBranchId)
}

const loadBranchScopedItemsWithDemo = <T extends BranchScopedRecord>(
  key: string,
  createDemoItems: () => T[],
  normalizer: (item: Partial<T>) => T,
  predicate?: (item: T) => boolean
) => {
  const activeBranchId = getActiveBranchId()
  if(!canUseBranch(activeBranchId, 'canView')) return []

  const sourceItems = localStorage.getItem(key) === null
    ? createDemoItems()
    : readJson<Partial<T>[]>(key, [])

  return filterTenantScope(normalizeBranchScopedItems(sourceItems, normalizer, DEFAULT_BRANCH_ID, predicate))
    .filter(item => item.branchId === activeBranchId)
}

const loadAllBranchScopedItems = <T extends BranchScopedRecord>(
  key: string,
  normalizer: (item: Partial<T>) => T,
  predicate?: (item: T) => boolean
) => {
  return filterTenantScope(normalizeBranchScopedItems(readJson<Partial<T>[]>(key, []), normalizer, DEFAULT_BRANCH_ID, predicate))
}

const loadAllBranchScopedItemsWithDemo = <T extends BranchScopedRecord>(
  key: string,
  createDemoItems: () => T[],
  normalizer: (item: Partial<T>) => T,
  predicate?: (item: T) => boolean
) => {
  const sourceItems = localStorage.getItem(key) === null
    ? createDemoItems()
    : readJson<Partial<T>[]>(key, [])

  return filterTenantScope(normalizeBranchScopedItems(sourceItems, normalizer, DEFAULT_BRANCH_ID, predicate))
}

const saveBranchScopedItems = <T extends BranchScopedRecord>(
  key: string,
  items: T[],
  normalizer: (item: Partial<T>) => T,
  predicate?: (item: T) => boolean
) => {
  const activeBranchId = getActiveBranchId()
  const currentUser = getCurrentUser()

  if(currentUser && !isAdminUser(currentUser) && !(
    canUseBranch(activeBranchId, 'canCreate', currentUser)
    || canUseBranch(activeBranchId, 'canEdit', currentUser)
    || canUseBranch(activeBranchId, 'canDelete', currentUser)
  )){
    throw new Error('Bu şube için işlem yetkiniz yok.')
  }

  const normalizedItems = normalizeBranchScopedItems(items, normalizer, activeBranchId, predicate)
  normalizedItems.forEach(item => assertTenantScope(item, currentUser))
  const touchedBranchIds = new Set(normalizedItems.map(item => item.branchId))

  if(touchedBranchIds.size === 0){
    touchedBranchIds.add(activeBranchId)
  }

  const existingItems = normalizeBranchScopedItems(readJson<Partial<T>[]>(key, []), normalizer, DEFAULT_BRANCH_ID, predicate)
  const preservedItems = existingItems.filter(item => !touchedBranchIds.has(item.branchId))
  localStorage.setItem(key, JSON.stringify([...normalizedItems, ...preservedItems]))
}

const saveAllBranchScopedItems = <T extends BranchScopedRecord>(
  key: string,
  items: T[],
  normalizer: (item: Partial<T>) => T,
  predicate?: (item: T) => boolean
) => {
  const normalizedItems = normalizeBranchScopedItems(items, normalizer, DEFAULT_BRANCH_ID, predicate)
  normalizedItems.forEach(item => assertTenantScope(item))
  localStorage.setItem(key, JSON.stringify(normalizedItems))
}

const normalizeCategory = (item: Partial<ProductCategory>): ProductCategory => ({
  id: String(item.id || `cat_${Date.now()}`),
  tenantId: String(item.tenantId || '').trim() || resolveTenantIdForRecord(item),
  name: String(item.name || 'Genel').trim() || 'Genel',
  active: item.active !== false,
  createdAt: item.createdAt || new Date().toISOString()
})

const normalizeProduct = (item: Partial<Product>, fallbackCategoryId = DEFAULT_CATEGORY_ID): Product => {
  const price = Number(item.price)
  const nutrition = normalizeProductNutrition(item)

  return {
    id: String(item.id || `prd_${Date.now()}`),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForRecord({ ...item, branchId: getBranchIdValue(item) }),
    branchId: getBranchIdValue(item),
    name: String(item.name || 'İsimsiz Ürün').trim() || 'İsimsiz Ürün',
    price: Number.isFinite(price) ? price : 0,
    categoryId: item.categoryId || fallbackCategoryId,
    description: item.description || '',
    ...nutrition,
    servingSize: normalizeServingSize(item.servingSize),
    allergens: normalizeProductAllergens(item.allergens),
    active: item.active !== false,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt
  }
}

const normalizeCurrentAccountType = (value: unknown): CurrentAccountType => {
  return CURRENT_ACCOUNT_TYPES.includes(value as CurrentAccountType) ? value as CurrentAccountType : 'Müşteri'
}

const normalizeEmployeePosition = (value: unknown): EmployeePosition => {
  const position = String(value || '').trim()
  if(!position) return 'Pozisyon'
  return LEGACY_EMPLOYEE_POSITIONS.includes(position as typeof LEGACY_EMPLOYEE_POSITIONS[number])
    ? 'Personel'
    : position
}

const normalizeEmployee = (item: Partial<Employee>): Employee => {
  const timestamp = item.createdAt || new Date().toISOString()
  const salary = Number(item.salary)

  return {
    id: String(item.id || `employee_${Date.now()}`),
    branchId: getBranchIdValue(item),
    code: String(item.code || '').trim(),
    fullName: String(item.fullName || '').trim(),
    position: normalizeEmployeePosition(item.position),
    phone: String(item.phone || '').trim(),
    email: String(item.email || '').trim(),
    startDate: String(item.startDate || new Date().toLocaleDateString('sv-SE')),
    salary: Number.isFinite(salary) ? Math.max(0, roundMoneyValue(salary)) : 0,
    isActive: item.isActive !== false,
    note: String(item.note || '').trim(),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeShiftName = (value: unknown): ShiftName => {
  return SHIFT_NAMES.includes(value as ShiftName) ? value as ShiftName : 'Sabah'
}

const normalizeShiftStatus = (value: unknown): ShiftStatus => {
  return SHIFT_STATUSES.includes(value as ShiftStatus) ? value as ShiftStatus : 'Planlandı'
}

const normalizeTimeValue = (value: unknown, fallback: string) => {
  const text = String(value || '').trim()
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback
}

const normalizeShift = (item: Partial<Shift>): Shift => {
  const timestamp = item.createdAt || new Date().toISOString()

  return {
    id: String(item.id || `shift_${Date.now()}`),
    branchId: getBranchIdValue(item),
    employeeId: String(item.employeeId || ''),
    shiftName: normalizeShiftName(item.shiftName),
    startTime: normalizeTimeValue(item.startTime, '08:00'),
    endTime: normalizeTimeValue(item.endTime, '16:00'),
    workDate: String(item.workDate || new Date().toLocaleDateString('sv-SE')),
    status: normalizeShiftStatus(item.status),
    note: String(item.note || '').trim(),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeAttendanceStatus = (value: unknown): AttendanceStatus => {
  return ATTENDANCE_STATUSES.includes(value as AttendanceStatus) ? value as AttendanceStatus : 'Normal'
}

const normalizeAttendance = (item: Partial<Attendance>): Attendance => {
  const timestamp = item.createdAt || new Date().toISOString()
  const workedMinutes = Number(item.workedMinutes)
  const overtimeMinutes = Number(item.overtimeMinutes)

  return {
    id: String(item.id || `attendance_${Date.now()}`),
    branchId: getBranchIdValue(item),
    employeeId: String(item.employeeId || ''),
    workDate: String(item.workDate || new Date().toLocaleDateString('sv-SE')),
    checkInTime: normalizeTimeValue(item.checkInTime, ''),
    checkOutTime: normalizeTimeValue(item.checkOutTime, ''),
    workedMinutes: Number.isFinite(workedMinutes) ? Math.max(0, Math.round(workedMinutes)) : 0,
    overtimeMinutes: Number.isFinite(overtimeMinutes) ? Math.max(0, Math.round(overtimeMinutes)) : 0,
    status: normalizeAttendanceStatus(item.status),
    note: String(item.note || '').trim(),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeCountValue = (value: unknown) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? Math.max(0, Math.round(numberValue)) : 0
}

const calculatePerformanceScore = ({
  servedTableCount,
  approvedOrderCount,
  qrOrderCount,
  customerCallCount
}: Pick<EmployeePerformance, 'servedTableCount' | 'approvedOrderCount' | 'qrOrderCount' | 'customerCallCount'>) => {
  return servedTableCount + approvedOrderCount + qrOrderCount + customerCallCount
}

const normalizeEmployeePerformance = (item: Partial<EmployeePerformance>): EmployeePerformance => {
  const timestamp = item.createdAt || new Date().toISOString()
  const servedTableCount = normalizeCountValue(item.servedTableCount)
  const approvedOrderCount = normalizeCountValue(item.approvedOrderCount)
  const qrOrderCount = normalizeCountValue(item.qrOrderCount)
  const customerCallCount = normalizeCountValue(item.customerCallCount)

  return {
    id: String(item.id || `employee_performance_${Date.now()}`),
    branchId: getBranchIdValue(item),
    employeeId: String(item.employeeId || ''),
    workDate: String(item.workDate || new Date().toLocaleDateString('sv-SE')),
    servedTableCount,
    approvedOrderCount,
    qrOrderCount,
    customerCallCount,
    performanceScore: calculatePerformanceScore({
      servedTableCount,
      approvedOrderCount,
      qrOrderCount,
      customerCallCount
    }),
    note: String(item.note || '').trim(),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizePeriodValue = (value: unknown) => {
  const text = String(value || '').trim()
  return /^\d{4}-\d{2}$/.test(text) ? text : new Date().toLocaleDateString('sv-SE').slice(0, 7)
}

const normalizeEmployeeBonusStatus = (value: unknown): EmployeeBonusStatus => {
  return EMPLOYEE_BONUS_STATUSES.includes(value as EmployeeBonusStatus) ? value as EmployeeBonusStatus : 'Hesaplandı'
}

const calculateBonusAmount = (performanceScoreValue: unknown, bonusRateValue: unknown) => {
  const performanceScore = Number(performanceScoreValue)
  const bonusRate = Number(bonusRateValue)
  const normalizedPerformanceScore = Number.isFinite(performanceScore) ? Math.max(0, Math.round(performanceScore)) : 0
  const normalizedBonusRate = Number.isFinite(bonusRate) ? Math.max(0, roundMoneyValue(bonusRate)) : 0
  const bonusAmount = roundMoneyValue(normalizedPerformanceScore * normalizedBonusRate)

  return {
    performanceScore: normalizedPerformanceScore,
    bonusRate: normalizedBonusRate,
    bonusAmount
  }
}

const normalizeEmployeeBonus = (item: Partial<EmployeeBonus>): EmployeeBonus => {
  const timestamp = item.createdAt || new Date().toISOString()
  const amounts = calculateBonusAmount(item.performanceScore, item.bonusRate)

  return {
    id: String(item.id || `employee_bonus_${Date.now()}`),
    branchId: getBranchIdValue(item),
    employeeId: String(item.employeeId || ''),
    period: normalizePeriodValue(item.period),
    performanceScore: amounts.performanceScore,
    bonusRate: amounts.bonusRate,
    bonusAmount: amounts.bonusAmount,
    status: normalizeEmployeeBonusStatus(item.status),
    note: String(item.note || '').trim(),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeEmployeeAuditRecordType = (value: unknown): EmployeeAuditRecordType => {
  return EMPLOYEE_AUDIT_RECORD_TYPES.includes(value as EmployeeAuditRecordType)
    ? value as EmployeeAuditRecordType
    : 'Bilgilendirme'
}

const normalizeEmployeeAuditSeverity = (value: unknown): EmployeeAuditSeverity => {
  return EMPLOYEE_AUDIT_SEVERITIES.includes(value as EmployeeAuditSeverity)
    ? value as EmployeeAuditSeverity
    : 'Orta'
}

const normalizeEmployeeAudit = (item: Partial<EmployeeAudit>): EmployeeAudit => {
  const timestamp = item.createdAt || new Date().toISOString()

  return {
    id: String(item.id || `employee_audit_${Date.now()}`),
    branchId: getBranchIdValue(item),
    employeeId: String(item.employeeId || ''),
    date: String(item.date || new Date().toLocaleDateString('sv-SE')),
    recordType: normalizeEmployeeAuditRecordType(item.recordType),
    severity: normalizeEmployeeAuditSeverity(item.severity),
    title: String(item.title || '').trim(),
    description: String(item.description || '').trim(),
    createdBy: String(item.createdBy || 'Yönetici').trim() || 'Yönetici',
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeCurrentAccount = (item: Partial<CurrentAccount>): CurrentAccount => {
  const timestamp = item.createdAt || new Date().toISOString()

  return {
    id: String(item.id || `cari_${Date.now()}`),
    branchId: getBranchIdValue(item),
    code: String(item.code || `CARI-${Date.now()}`).trim() || `CARI-${Date.now()}`,
    name: String(item.name || 'İsimsiz Cari').trim() || 'İsimsiz Cari',
    type: normalizeCurrentAccountType(item.type),
    phone: String(item.phone || ''),
    email: String(item.email || ''),
    taxNumber: String(item.taxNumber || ''),
    authorizedPerson: String(item.authorizedPerson || ''),
    address: String(item.address || ''),
    note: String(item.note || ''),
    isActive: item.isActive !== false,
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const createDemoBranches = (now = new Date().toISOString()): Branch[] => [
  normalizeBranch({
    id: 'branch_merkez',
    companyId: 'company_abc_cafe_demo',
    code: 'SUBE-001',
    name: 'Merkez Şube',
    phone: '0212 000 00 01',
    email: 'merkez@workspace.local',
    city: 'İstanbul',
    address: 'Merkez Mahallesi No: 1',
    managerName: 'Emrah Evren',
    isActive: true,
    createdAt: now,
    updatedAt: now
  }),
  normalizeBranch({
    id: 'branch_istanbul',
    companyId: 'company_abc_cafe_demo',
    code: 'SUBE-002',
    name: 'İstanbul Şubesi',
    phone: '0212 000 00 02',
    email: 'istanbul@workspace.local',
    city: 'İstanbul',
    address: 'Kadıköy Cad. No: 12',
    managerName: 'Ayşe Yılmaz',
    isActive: true,
    createdAt: now,
    updatedAt: now
  }),
  normalizeBranch({
    id: 'branch_ankara',
    companyId: 'company_ornek_isletme_demo',
    code: 'SUBE-003',
    name: 'Ankara Şubesi',
    phone: '0312 000 00 03',
    email: 'ankara@workspace.local',
    city: 'Ankara',
    address: 'Çankaya Sok. No: 8',
    managerName: 'Mehmet Demir',
    isActive: true,
    createdAt: now,
    updatedAt: now
  }),
  normalizeBranch({
    id: 'branch_izmir',
    companyId: 'company_kahve_duragi_demo',
    code: 'SUBE-004',
    name: 'İzmir Şubesi',
    phone: '0232 000 00 04',
    email: 'izmir@workspace.local',
    city: 'İzmir',
    address: 'Alsancak Bulvarı No: 4',
    managerName: 'Selin Arslan',
    isActive: false,
    createdAt: now,
    updatedAt: now
  })
]

const roundMoneyValue = (value: number) => Math.round(value * 100) / 100

const calculateCreditAmounts = (amountValue: unknown, paidValue: unknown) => {
  const amount = Number(amountValue)
  const paidAmount = Number(paidValue)
  const normalizedAmount = Number.isFinite(amount) ? Math.max(0, roundMoneyValue(amount)) : 0
  const normalizedPaidAmount = Number.isFinite(paidAmount)
    ? Math.min(normalizedAmount, Math.max(0, roundMoneyValue(paidAmount)))
    : 0
  const remainingAmount = roundMoneyValue(Math.max(0, normalizedAmount - normalizedPaidAmount))

  return {
    amount: normalizedAmount,
    paidAmount: normalizedPaidAmount,
    remainingAmount,
    status: remainingAmount > 0 ? 'Açık' as const : 'Kapandı' as const
  }
}

const normalizeCreditTransaction = (item: Partial<CreditTransaction>): CreditTransaction => {
  const timestamp = item.createdAt || new Date().toISOString()
  const amounts = calculateCreditAmounts(item.amount, item.paidAmount)

  return {
    id: String(item.id || `veresiye_${Date.now()}`),
    branchId: getBranchIdValue(item),
    currentAccountId: String(item.currentAccountId || ''),
    date: String(item.date || new Date().toLocaleDateString('sv-SE')),
    amount: amounts.amount,
    paidAmount: amounts.paidAmount,
    remainingAmount: amounts.remainingAmount,
    status: amounts.status,
    note: String(item.note || ''),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeSupplierDebt = (item: Partial<SupplierDebt>): SupplierDebt => {
  const timestamp = item.createdAt || new Date().toISOString()
  const amounts = calculateCreditAmounts(item.amount, item.paidAmount)

  return {
    id: String(item.id || `supplier_debt_${Date.now()}`),
    branchId: getBranchIdValue(item),
    currentAccountId: String(item.currentAccountId || ''),
    date: String(item.date || new Date().toLocaleDateString('sv-SE')),
    amount: amounts.amount,
    paidAmount: amounts.paidAmount,
    remainingAmount: amounts.remainingAmount,
    status: amounts.status,
    invoiceNumber: String(item.invoiceNumber || ''),
    note: String(item.note || ''),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeCollectionPaymentMethod = (value: unknown): CollectionPaymentMethod => {
  return COLLECTION_PAYMENT_METHODS.includes(value as CollectionPaymentMethod) ? value as CollectionPaymentMethod : 'Nakit'
}

const normalizeCollectionTransaction = (item: Partial<CollectionTransaction>): CollectionTransaction => {
  const timestamp = item.createdAt || new Date().toISOString()
  const amount = Number(item.amount)

  return {
    id: String(item.id || `tahsilat_${Date.now()}`),
    branchId: getBranchIdValue(item),
    currentAccountId: String(item.currentAccountId || ''),
    date: String(item.date || new Date().toLocaleDateString('sv-SE')),
    amount: Number.isFinite(amount) ? Math.max(0, roundMoneyValue(amount)) : 0,
    paymentMethod: normalizeCollectionPaymentMethod(item.paymentMethod),
    note: String(item.note || ''),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeSupplierPaymentMethod = (value: unknown): SupplierPaymentMethod => {
  return SUPPLIER_PAYMENT_METHODS.includes(value as SupplierPaymentMethod) ? value as SupplierPaymentMethod : 'Nakit'
}

const normalizeSupplierPayment = (item: Partial<SupplierPayment>): SupplierPayment => {
  const amount = Number(item.amount)

  return {
    id: String(item.id || `supplier_payment_${Date.now()}`),
    branchId: getBranchIdValue(item),
    supplierDebtId: String(item.supplierDebtId || ''),
    currentAccountId: String(item.currentAccountId || ''),
    date: String(item.date || new Date().toLocaleDateString('sv-SE')),
    amount: Number.isFinite(amount) ? Math.max(0, roundMoneyValue(amount)) : 0,
    paymentMethod: normalizeSupplierPaymentMethod(item.paymentMethod),
    note: String(item.note || ''),
    createdAt: item.createdAt || new Date().toISOString()
  }
}

const normalizeCashTransactionType = (value: unknown): CashTransactionType => {
  return CASH_TRANSACTION_TYPES.includes(value as CashTransactionType) ? value as CashTransactionType : 'Gelir'
}

const normalizeCashPaymentMethod = (value: unknown): CashPaymentMethod => {
  return CASH_PAYMENT_METHODS.includes(value as CashPaymentMethod) ? value as CashPaymentMethod : 'Nakit'
}

const normalizeCashTransaction = (item: Partial<CashTransaction>): CashTransaction => {
  const amount = Number(item.amount)

  return {
    id: String(item.id || `cash_${Date.now()}`),
    branchId: getBranchIdValue(item),
    date: String(item.date || new Date().toLocaleDateString('sv-SE')),
    type: normalizeCashTransactionType(item.type),
    category: String(item.category || 'Diğer').trim() || 'Diğer',
    amount: Number.isFinite(amount) ? Math.max(0, roundMoneyValue(amount)) : 0,
    paymentMethod: normalizeCashPaymentMethod(item.paymentMethod),
    referenceId: String(item.referenceId || ''),
    description: String(item.description || ''),
    createdAt: item.createdAt || new Date().toISOString()
  }
}

const normalizeIncomeExpenseType = (value: unknown): IncomeExpenseType => {
  return INCOME_EXPENSE_TYPES.includes(value as IncomeExpenseType) ? value as IncomeExpenseType : 'Gelir'
}

const normalizeIncomeExpensePaymentMethod = (value: unknown): IncomeExpensePaymentMethod => {
  return INCOME_EXPENSE_PAYMENT_METHODS.includes(value as IncomeExpensePaymentMethod) ? value as IncomeExpensePaymentMethod : 'Nakit'
}

const normalizeIncomeExpense = (item: Partial<IncomeExpense>): IncomeExpense => {
  const timestamp = item.createdAt || new Date().toISOString()
  const amount = Number(item.amount)

  return {
    id: String(item.id || `income_expense_${Date.now()}`),
    branchId: getBranchIdValue(item),
    date: String(item.date || new Date().toLocaleDateString('sv-SE')),
    type: normalizeIncomeExpenseType(item.type),
    category: String(item.category || 'Diğer').trim() || 'Diğer',
    amount: Number.isFinite(amount) ? Math.max(0, roundMoneyValue(amount)) : 0,
    paymentMethod: normalizeIncomeExpensePaymentMethod(item.paymentMethod),
    description: String(item.description || ''),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeCashClosing = (item: Partial<CashClosing>): CashClosing => {
  const openingBalance = Number(item.openingBalance)
  const totalIncome = Number(item.totalIncome)
  const totalExpense = Number(item.totalExpense)
  const expectedBalance = Number(item.expectedBalance)
  const actualBalance = Number(item.actualBalance)
  const normalizedOpeningBalance = Number.isFinite(openingBalance) ? roundMoneyValue(openingBalance) : 0
  const normalizedTotalIncome = Number.isFinite(totalIncome) ? Math.max(0, roundMoneyValue(totalIncome)) : 0
  const normalizedTotalExpense = Number.isFinite(totalExpense) ? Math.max(0, roundMoneyValue(totalExpense)) : 0
  const normalizedExpectedBalance = Number.isFinite(expectedBalance)
    ? roundMoneyValue(expectedBalance)
    : roundMoneyValue(normalizedOpeningBalance + normalizedTotalIncome - normalizedTotalExpense)
  const normalizedActualBalance = Number.isFinite(actualBalance) ? roundMoneyValue(actualBalance) : 0
  const difference = Number(item.difference)
  const normalizedDifference = Number.isFinite(difference)
    ? roundMoneyValue(difference)
    : roundMoneyValue(normalizedActualBalance - normalizedExpectedBalance)

  return {
    id: String(item.id || `cash_closing_${Date.now()}`),
    branchId: getBranchIdValue(item),
    date: String(item.date || new Date().toLocaleDateString('sv-SE')),
    openingBalance: normalizedOpeningBalance,
    totalIncome: normalizedTotalIncome,
    totalExpense: normalizedTotalExpense,
    expectedBalance: normalizedExpectedBalance,
    actualBalance: normalizedActualBalance,
    difference: normalizedDifference,
    note: String(item.note || ''),
    closedBy: String(item.closedBy || ''),
    createdAt: item.createdAt || new Date().toISOString()
  }
}

const normalizeCashTransfer = (item: Partial<CashTransfer>): CashTransfer => {
  const openingBalance = Number(item.openingBalance)
  const transferredAmount = Number(item.transferredAmount)

  return {
    id: String(item.id || `cash_transfer_${Date.now()}`),
    branchId: getBranchIdValue(item),
    date: String(item.date || new Date().toLocaleDateString('sv-SE')),
    transferNo: String(item.transferNo || ''),
    fromUser: String(item.fromUser || ''),
    toUser: String(item.toUser || ''),
    openingBalance: Number.isFinite(openingBalance) ? Math.max(0, roundMoneyValue(openingBalance)) : 0,
    transferredAmount: Number.isFinite(transferredAmount) ? Math.max(0, roundMoneyValue(transferredAmount)) : 0,
    note: String(item.note || ''),
    createdAt: item.createdAt || new Date().toISOString()
  }
}

const createDemoEmployees = (now = new Date().toISOString()): Employee[] => [
  normalizeEmployee({
    id: 'employee_ahmet_kaya',
    code: 'PER-001',
    fullName: 'Ahmet Kaya',
    position: 'Operasyon Uzmanı',
    phone: '0532 111 22 33',
    email: 'ahmet.kaya@example.com',
    startDate: new Date().toLocaleDateString('sv-SE'),
    salary: 30000,
    isActive: true,
    note: 'Demo operasyon personeli kaydı.',
    createdAt: now,
    updatedAt: now
  }),
  normalizeEmployee({
    id: 'employee_mehmet_demir',
    code: 'PER-002',
    fullName: 'Mehmet Demir',
    position: 'Destek Uzmanı',
    phone: '0532 222 33 44',
    email: 'mehmet.demir@example.com',
    startDate: new Date().toLocaleDateString('sv-SE'),
    salary: 32000,
    isActive: true,
    note: 'Demo destek personeli kaydı.',
    createdAt: now,
    updatedAt: now
  }),
  normalizeEmployee({
    id: 'employee_ayse_yilmaz',
    code: 'PER-003',
    fullName: 'Ayşe Yılmaz',
    position: 'Yönetici',
    phone: '0532 333 44 55',
    email: 'ayse.yilmaz@example.com',
    startDate: new Date().toLocaleDateString('sv-SE'),
    salary: 45000,
    isActive: true,
    note: 'Demo yönetici personel kaydı.',
    createdAt: now,
    updatedAt: now
  })
]

const createDemoShifts = (now = new Date().toISOString()): Shift[] => {
  const today = new Date().toLocaleDateString('sv-SE')

  return [
    normalizeShift({
      id: 'shift_ahmet_kaya_sabah_demo',
      employeeId: 'employee_ahmet_kaya',
      shiftName: 'Sabah',
      workDate: today,
      startTime: '08:00',
      endTime: '16:00',
      status: 'Planlandı',
      note: 'Demo sabah vardiyası.',
      createdAt: now,
      updatedAt: now
    }),
    normalizeShift({
      id: 'shift_mehmet_demir_aksam_demo',
      employeeId: 'employee_mehmet_demir',
      shiftName: 'Akşam',
      workDate: today,
      startTime: '16:00',
      endTime: '00:00',
      status: 'Planlandı',
      note: 'Demo akşam vardiyası.',
      createdAt: now,
      updatedAt: now
    }),
    normalizeShift({
      id: 'shift_ayse_yilmaz_tam_gun_demo',
      employeeId: 'employee_ayse_yilmaz',
      shiftName: 'Tam Gün',
      workDate: today,
      startTime: '09:00',
      endTime: '18:00',
      status: 'Planlandı',
      note: 'Demo tam gün vardiyası.',
      createdAt: now,
      updatedAt: now
    })
  ]
}

const createDemoAttendances = (now = new Date().toISOString()): Attendance[] => {
  const today = new Date().toLocaleDateString('sv-SE')

  return [
    normalizeAttendance({
      id: 'attendance_ahmet_kaya_demo',
      employeeId: 'employee_ahmet_kaya',
      workDate: today,
      checkInTime: '08:00',
      checkOutTime: '17:30',
      workedMinutes: 570,
      overtimeMinutes: 90,
      status: 'Fazla Mesai',
      note: 'Demo fazla mesai kaydı.',
      createdAt: now,
      updatedAt: now
    }),
    normalizeAttendance({
      id: 'attendance_mehmet_demir_demo',
      employeeId: 'employee_mehmet_demir',
      workDate: today,
      checkInTime: '16:00',
      checkOutTime: '00:00',
      workedMinutes: 480,
      overtimeMinutes: 0,
      status: 'Normal',
      note: 'Demo akşam vardiyası puantaj kaydı.',
      createdAt: now,
      updatedAt: now
    }),
    normalizeAttendance({
      id: 'attendance_ayse_yilmaz_demo',
      employeeId: 'employee_ayse_yilmaz',
      workDate: today,
      checkInTime: '09:00',
      checkOutTime: '18:00',
      workedMinutes: 540,
      overtimeMinutes: 0,
      status: 'Normal',
      note: 'Demo tam gün puantaj kaydı.',
      createdAt: now,
      updatedAt: now
    })
  ]
}

const createDemoEmployeePerformances = (now = new Date().toISOString()): EmployeePerformance[] => {
  const today = new Date().toLocaleDateString('sv-SE')

  return [
    normalizeEmployeePerformance({
      id: 'employee_performance_ahmet_kaya_demo',
      employeeId: 'employee_ahmet_kaya',
      workDate: today,
      servedTableCount: 18,
      approvedOrderCount: 42,
      qrOrderCount: 11,
      customerCallCount: 9,
      note: 'Demo yüksek performans kaydı.',
      createdAt: now,
      updatedAt: now
    }),
    normalizeEmployeePerformance({
      id: 'employee_performance_mehmet_demir_demo',
      employeeId: 'employee_mehmet_demir',
      workDate: today,
      servedTableCount: 12,
      approvedOrderCount: 31,
      qrOrderCount: 4,
      customerCallCount: 5,
      note: 'Demo destek performans kaydı.',
      createdAt: now,
      updatedAt: now
    })
  ]
}

const createDemoEmployeeBonuses = (now = new Date().toISOString()): EmployeeBonus[] => {
  const period = new Date().toLocaleDateString('sv-SE').slice(0, 7)

  return [
    normalizeEmployeeBonus({
      id: 'employee_bonus_ahmet_kaya_demo',
      employeeId: 'employee_ahmet_kaya',
      period,
      performanceScore: 80,
      bonusRate: 5,
      status: 'Hesaplandı',
      note: 'Demo prim kaydı.',
      createdAt: now,
      updatedAt: now
    }),
    normalizeEmployeeBonus({
      id: 'employee_bonus_mehmet_demir_demo',
      employeeId: 'employee_mehmet_demir',
      period,
      performanceScore: 52,
      bonusRate: 5,
      status: 'Hesaplandı',
      note: 'Demo prim kaydı.',
      createdAt: now,
      updatedAt: now
    })
  ]
}

const createDemoEmployeeAudits = (now = new Date().toISOString()): EmployeeAudit[] => {
  const today = new Date().toLocaleDateString('sv-SE')

  return [
    normalizeEmployeeAudit({
      id: 'employee_audit_ahmet_kaya_demo',
      employeeId: 'employee_ahmet_kaya',
      date: today,
      recordType: 'Ödül',
      severity: 'Orta',
      title: 'Ayın Personeli',
      description: 'Müşteri memnuniyeti ve servis hızı yüksek olduğu için ödül kaydı oluşturuldu.',
      createdBy: 'Yönetici',
      createdAt: now,
      updatedAt: now
    }),
    normalizeEmployeeAudit({
      id: 'employee_audit_mehmet_demir_demo',
      employeeId: 'employee_mehmet_demir',
      date: today,
      recordType: 'Uyarı',
      severity: 'Düşük',
      title: 'Geç Kalma',
      description: 'Vardiya başlangıcına geç kalma nedeniyle sözlü uyarı kaydı oluşturuldu.',
      createdBy: 'Yönetici',
      createdAt: now,
      updatedAt: now
    }),
    normalizeEmployeeAudit({
      id: 'employee_audit_ayse_yilmaz_demo',
      employeeId: 'employee_ayse_yilmaz',
      date: today,
      recordType: 'Denetim Notu',
      severity: 'Yüksek',
      title: 'Vardiya Yönetimi Başarılı',
      description: 'Vardiya planlama ve ekip koordinasyonu başarılı bulundu.',
      createdBy: 'Yönetici',
      createdAt: now,
      updatedAt: now
    })
  ]
}

const createDemoCurrentAccounts = (now = new Date().toISOString()): CurrentAccount[] => [
  {
    id: 'cari_ali_veli',
    branchId: DEFAULT_BRANCH_ID,
    code: 'CARI-001',
    name: 'Ali Veli',
    type: 'Müşteri',
    phone: '05xx xxx xx xx',
    email: 'ali.veli@example.com',
    taxNumber: '',
    authorizedPerson: 'Ali Veli',
    address: 'Merkez Mahallesi',
    note: 'Demo müşteri cari kartı.',
    isActive: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'cari_abc_gida',
    branchId: DEFAULT_BRANCH_ID,
    code: 'CARI-002',
    name: 'ABC Gıda',
    type: 'Tedarikçi',
    phone: '0212 000 00 00',
    email: 'tedarik@abcgida.com',
    taxNumber: '1234567890',
    authorizedPerson: 'Ayşe Demir',
    address: 'Gıda Toptancılar Sitesi',
    note: 'Demo tedarikçi cari kartı.',
    isActive: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: 'cari_can_ciger',
    branchId: DEFAULT_BRANCH_ID,
    code: 'CARI-003',
    name: 'Can Ciğer Ltd.',
    type: 'Firma',
    phone: '0216 000 00 00',
    email: 'info@canciger.com',
    taxNumber: '9876543210',
    authorizedPerson: 'Can Yılmaz',
    address: 'Sanayi Caddesi No: 12',
    note: 'Demo firma cari kartı.',
    isActive: true,
    createdAt: now,
    updatedAt: now
  }
]

const createDemoCreditTransactions = (now = new Date().toISOString()): CreditTransaction[] => [
  normalizeCreditTransaction({
    id: 'veresiye_ali_veli_demo',
    currentAccountId: 'cari_ali_veli',
    date: new Date().toLocaleDateString('sv-SE'),
    amount: 2500,
    paidAmount: 500,
    note: 'Demo veresiye kaydı.',
    createdAt: now,
    updatedAt: now
  }),
  normalizeCreditTransaction({
    id: 'veresiye_can_ciger_demo',
    currentAccountId: 'cari_can_ciger',
    date: new Date().toLocaleDateString('sv-SE'),
    amount: 12000,
    paidAmount: 0,
    note: 'Demo firma veresiye kaydı.',
    createdAt: now,
    updatedAt: now
  })
]

const createDemoSupplierDebts = (now = new Date().toISOString()): SupplierDebt[] => [
  normalizeSupplierDebt({
    id: 'supplier_debt_abc_gida_demo',
    currentAccountId: 'cari_abc_gida',
    date: new Date().toLocaleDateString('sv-SE'),
    invoiceNumber: 'ABC-2026-001',
    amount: 15000,
    paidAmount: 3000,
    note: 'Demo tedarikçi borcu.',
    createdAt: now,
    updatedAt: now
  })
]

const createDemoSupplierPayments = (now = new Date().toISOString()): SupplierPayment[] => [
  normalizeSupplierPayment({
    id: 'supplier_payment_abc_gida_demo',
    supplierDebtId: 'supplier_debt_abc_gida_demo',
    currentAccountId: 'cari_abc_gida',
    date: new Date().toLocaleDateString('sv-SE'),
    amount: 3000,
    paymentMethod: 'Havale/EFT',
    note: 'Demo tedarikçi ödeme kaydı.',
    createdAt: now
  })
]

const createDemoCollectionTransactions = (now = new Date().toISOString()): CollectionTransaction[] => [
  normalizeCollectionTransaction({
    id: 'tahsilat_ali_veli_demo',
    currentAccountId: 'cari_ali_veli',
    date: new Date().toLocaleDateString('sv-SE'),
    amount: 1000,
    paymentMethod: 'Nakit',
    note: 'Demo tahsilat kaydı.',
    createdAt: now,
    updatedAt: now
  }),
  normalizeCollectionTransaction({
    id: 'tahsilat_can_ciger_demo',
    currentAccountId: 'cari_can_ciger',
    date: new Date().toLocaleDateString('sv-SE'),
    amount: 5000,
    paymentMethod: 'Havale/EFT',
    note: 'Demo firma tahsilatı.',
    createdAt: now,
    updatedAt: now
  }),
  normalizeCollectionTransaction({
    id: 'tahsilat_abc_gida_demo',
    currentAccountId: 'cari_abc_gida',
    date: new Date().toLocaleDateString('sv-SE'),
    amount: 2500,
    paymentMethod: 'Kart',
    note: 'Demo tedarikçi tahsilatı.',
    createdAt: now,
    updatedAt: now
  })
]

const createDemoIncomeExpenses = (now = new Date().toISOString()): IncomeExpense[] => [
  normalizeIncomeExpense({
    id: 'income_expense_urun_satisi_demo',
    date: new Date().toLocaleDateString('sv-SE'),
    type: 'Gelir',
    category: 'Ürün Satışı',
    amount: 12500,
    paymentMethod: 'Kart',
    description: 'Demo ürün satışı geliri.',
    createdAt: now,
    updatedAt: now
  }),
  normalizeIncomeExpense({
    id: 'income_expense_kira_demo',
    date: new Date().toLocaleDateString('sv-SE'),
    type: 'Gider',
    category: 'Kira',
    amount: 5000,
    paymentMethod: 'Havale/EFT',
    description: 'Demo kira gideri.',
    createdAt: now,
    updatedAt: now
  }),
  normalizeIncomeExpense({
    id: 'income_expense_elektrik_demo',
    date: new Date().toLocaleDateString('sv-SE'),
    type: 'Gider',
    category: 'Elektrik',
    amount: 1200,
    paymentMethod: 'Havale/EFT',
    description: 'Demo elektrik gideri.',
    createdAt: now,
    updatedAt: now
  })
]

const createDemoCashTransfers = (now = new Date().toISOString()): CashTransfer[] => [
  normalizeCashTransfer({
    id: 'cash_transfer_devir_0001_demo',
    date: new Date().toLocaleDateString('sv-SE'),
    transferNo: 'DEVIR-0001',
    fromUser: 'Yönetici',
    toUser: 'Finans Sorumlusu',
    openingBalance: 0,
    transferredAmount: 5000,
    note: 'Sabah vardiyası devir işlemi.',
    createdAt: now
  })
]

const normalizeStockUnit = (value: unknown): StockUnit => {
  return STOCK_UNITS.includes(value as StockUnit) ? value as StockUnit : 'adet'
}

const normalizeStockCategory = (item: Partial<StockCategory>): StockCategory => ({
  id: String(item.id || `stock_cat_${Date.now()}`),
  tenantId: String(item.tenantId || '').trim() || resolveTenantIdForRecord(item),
  name: String(item.name || 'Genel').trim() || 'Genel',
  active: item.active !== false,
  createdAt: item.createdAt || new Date().toISOString(),
  updatedAt: item.updatedAt
})

const normalizeStockItem = (item: Partial<StockItem>, fallbackCategoryId = DEFAULT_STOCK_CATEGORY_ID): StockItem => {
  const currentQty = Number(item.currentQty)
  const minQty = Number(item.minQty)
  const unitPurchasePrice = normalizeCostValue(item.unitPurchasePrice)
  const lastPurchasePrice = Number(item.lastPurchasePrice)
  const averageCost = normalizeCostValue(item.averageCost)
  const expiryWarningDays = Number(item.expiryWarningDays)

  return {
    id: String(item.id || `stock_${Date.now()}`),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForRecord({ ...item, branchId: getBranchIdValue(item) }),
    branchId: getBranchIdValue(item),
    name: String(item.name || 'İsimsiz Stok Kartı').trim() || 'İsimsiz Stok Kartı',
    categoryId: item.categoryId || fallbackCategoryId,
    unit: normalizeStockUnit(item.unit),
    currentQty: Number.isFinite(currentQty) ? currentQty : 0,
    minQty: Number.isFinite(minQty) ? Math.max(0, minQty) : 0,
    tracksExpiry: item.tracksExpiry === true,
    expiryWarningDays: Number.isFinite(expiryWarningDays) ? Math.max(0, Math.floor(expiryWarningDays)) : DEFAULT_EXPIRY_WARNING_DAYS,
    sku: item.sku || '',
    barcode: item.barcode || '',
    description: item.description || '',
    active: item.active !== false,
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt,
    unitPurchasePrice,
    currency: String(item.currency || DEFAULT_STOCK_CURRENCY).trim() || DEFAULT_STOCK_CURRENCY,
    lastPurchasePrice: Number.isFinite(lastPurchasePrice) && lastPurchasePrice >= 0 ? lastPurchasePrice : undefined,
    averageCost,
    lastCostUpdatedAt: item.lastCostUpdatedAt,
    lastSupplierName: item.lastSupplierName || ''
  }
}

const normalizeStockMovementType = (value: unknown): StockMovementType => {
  return STOCK_MOVEMENT_TYPES.includes(value as StockMovementType) ? value as StockMovementType : 'Giriş'
}

const normalizeStockMovementSource = (value: unknown): StockMovementSource => {
  return STOCK_MOVEMENT_SOURCES.includes(value as StockMovementSource) ? value as StockMovementSource : 'Manuel'
}

const normalizeStockMovementReason = (value: unknown): StockMovementReason => {
  return STOCK_MOVEMENT_REASONS.includes(value as StockMovementReason) ? value as StockMovementReason : 'Diğer'
}

const isStockEntryMovementType = (value: string) => value.includes('Giri')
const isStockCountMovementType = (value: string) => value.includes('Say')

const normalizeStockExpiryAllocation = (item: Partial<StockExpiryAllocation>): StockExpiryAllocation => {
  const qty = Number(item.qty)

  return {
    lotId: String(item.lotId || ''),
    lotCode: String(item.lotCode || item.lotId || 'LOT'),
    expiryDate: normalizeExpiryDateKey(item.expiryDate),
    qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
    unit: normalizeStockUnit(item.unit)
  }
}

const normalizeStockMovement = (item: Partial<StockMovement>): StockMovement => {
  const qty = Number(item.qty)
  const previousQty = Number(item.previousQty)
  const nextQty = Number(item.nextQty)
  const purchasePrice = Number(item.purchasePrice)
  const unitCost = normalizeCostValue(item.unitCost)
  const totalCost = normalizeCostValue(item.totalCost)
  const previousAverageCost = normalizeCostValue(item.previousAverageCost)
  const nextAverageCost = normalizeCostValue(item.nextAverageCost)
  const previousStockValue = normalizeCostValue(item.previousStockValue)
  const nextStockValue = normalizeCostValue(item.nextStockValue)
  const expiryUnallocatedQty = Number(item.expiryUnallocatedQty)
  const timestamp = item.createdAt || new Date().toISOString()

  return {
    id: String(item.id || `stock_move_${Date.now()}`),
    branchId: getBranchIdValue(item),
    stockItemId: String(item.stockItemId || ''),
    stockItemName: String(item.stockItemName || 'Stok Kartı'),
    type: normalizeStockMovementType(item.type),
    source: normalizeStockMovementSource(item.source),
    reason: normalizeStockMovementReason(item.reason),
    qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
    unit: normalizeStockUnit(item.unit),
    previousQty: Number.isFinite(previousQty) ? previousQty : 0,
    nextQty: Number.isFinite(nextQty) ? nextQty : 0,
    purchasePrice: Number.isFinite(purchasePrice) && purchasePrice >= 0 ? purchasePrice : undefined,
    currency: String(item.currency || DEFAULT_STOCK_CURRENCY).trim() || DEFAULT_STOCK_CURRENCY,
    unitCost,
    totalCost,
    previousAverageCost,
    nextAverageCost,
    previousStockValue,
    nextStockValue,
    supplierName: item.supplierName || '',
    invoiceNo: item.invoiceNo || '',
    expiryDate: normalizeExpiryDateKey(item.expiryDate),
    expiryAllocations: (item.expiryAllocations || []).map(normalizeStockExpiryAllocation).filter(allocation => allocation.lotId && allocation.qty > 0),
    expiryUnallocatedQty: Number.isFinite(expiryUnallocatedQty) ? Math.max(0, expiryUnallocatedQty) : undefined,
    expiryWarnings: item.expiryWarnings || [],
    description: item.description || '',
    movementDate: item.movementDate || timestamp,
    createdAt: timestamp,
    createdByUserId: String(item.createdByUserId || ''),
    createdByFullName: String(item.createdByFullName || 'Bilinmeyen Kullanıcı'),
    reversesMovementId: item.reversesMovementId,
    reversedByMovementId: item.reversedByMovementId,
    reversedAt: item.reversedAt,
    sourceEntityType: item.sourceEntityType,
    sourceEntityId: item.sourceEntityId,
    tableId: item.tableId,
    tableName: item.tableName,
    orderId: item.orderId,
    recipeId: item.recipeId,
    recipeVersion: item.recipeVersion,
    deductionBatchId: item.deductionBatchId,
    reverseOfBatchId: item.reverseOfBatchId,
    reverseMode: item.reverseMode === 'full' || item.reverseMode === 'partial' ? item.reverseMode : undefined,
    wasteRecordId: item.wasteRecordId
  }
}

const normalizeStockMovementAuditEventType = (value: unknown): StockMovementAuditEventType => {
  return value === 'reversed' ? 'reversed' : 'created'
}

const normalizeStockMovementAuditEvent = (item: Partial<StockMovementAuditEvent>): StockMovementAuditEvent => ({
  id: String(item.id || `stock_audit_${Date.now()}`),
  movementId: String(item.movementId || ''),
  stockItemId: String(item.stockItemId || ''),
  eventType: normalizeStockMovementAuditEventType(item.eventType),
  userId: String(item.userId || ''),
  userName: String(item.userName || 'Bilinmeyen Kullanıcı'),
  timestamp: item.timestamp || new Date().toISOString(),
  before: item.before,
  after: item.after,
  note: item.note || ''
})

const normalizeCriticalStockEventType = (value: unknown): CriticalStockEventType => {
  return value === 'resolved' ? 'resolved' : 'entered'
}

const normalizeCriticalStockTrigger = (value: unknown): CriticalStockTrigger => {
  if(
    value === 'Otomatik Stok Düşümü'
    || value === 'Ters Hareket'
    || value === 'Stok Kartı Oluşturma'
    || value === 'Stok Kartı Güncelleme'
    || value === 'Stok Kartı Aktifleştirme'
    || value === 'Stok Kartı Pasifleştirme'
    || value === 'Stok Hareketi'
  ){
    return value
  }

  return 'Stok Hareketi'
}

const normalizeCriticalStockEvent = (item: Partial<CriticalStockEvent>): CriticalStockEvent => {
  const previousQty = Number(item.previousQty)
  const nextQty = Number(item.nextQty)
  const minQty = Number(item.minQty)

  return {
    id: String(item.id || `critical_stock_${Date.now()}`),
    stockItemId: String(item.stockItemId || ''),
    stockItemName: String(item.stockItemName || 'Stok Kartı'),
    eventType: normalizeCriticalStockEventType(item.eventType),
    trigger: normalizeCriticalStockTrigger(item.trigger),
    previousQty: Number.isFinite(previousQty) ? previousQty : 0,
    nextQty: Number.isFinite(nextQty) ? nextQty : 0,
    minQty: Number.isFinite(minQty) ? Math.max(0, minQty) : 0,
    unit: normalizeStockUnit(item.unit),
    userId: String(item.userId || ''),
    userName: String(item.userName || 'Bilinmeyen Kullanıcı'),
    timestamp: item.timestamp || new Date().toISOString(),
    movementId: item.movementId,
    tableId: item.tableId,
    tableName: item.tableName,
    note: item.note || ''
  }
}

const normalizeStockExpiryLot = (item: Partial<StockExpiryLot>): StockExpiryLot => {
  const initialQty = Number(item.initialQty)
  const remainingQty = Number(item.remainingQty)
  const timestamp = item.createdAt || new Date().toISOString()
  const id = String(item.id || `stock_expiry_lot_${Date.now()}`)

  return {
    id,
    branchId: getBranchIdValue(item),
    lotCode: String(item.lotCode || `LOT-${id.slice(-6).toUpperCase()}`),
    stockItemId: String(item.stockItemId || ''),
    stockItemName: String(item.stockItemName || 'Stok Kartı'),
    unit: normalizeStockUnit(item.unit),
    initialQty: Number.isFinite(initialQty) ? Math.max(0, initialQty) : 0,
    remainingQty: Number.isFinite(remainingQty) ? Math.max(0, remainingQty) : 0,
    expiryDate: normalizeExpiryDateKey(item.expiryDate),
    receivedAt: item.receivedAt || timestamp,
    purchaseMovementId: item.purchaseMovementId,
    supplierName: item.supplierName || '',
    invoiceNo: item.invoiceNo || '',
    createdAt: timestamp,
    createdByUserId: String(item.createdByUserId || ''),
    createdByFullName: String(item.createdByFullName || 'Bilinmeyen Kullanıcı'),
    updatedAt: item.updatedAt,
    depletedAt: item.depletedAt
  }
}

const normalizeStockExpiryStatus = (value: unknown): StockExpiryStatus | undefined => {
  if(value === 'valid' || value === 'near_expiry' || value === 'expired' || value === 'depleted' || value === 'unknown'){
    return value
  }

  return undefined
}

const normalizeStockExpiryEventType = (value: unknown): StockExpiryEventType => {
  if(
    value === 'lot_consumed'
    || value === 'lot_wasted'
    || value === 'lot_returned'
    || value === 'lot_adjusted'
    || value === 'near_expiry'
    || value === 'expired'
    || value === 'allocation_missing'
    || value === 'lot_created'
  ){
    return value
  }

  return 'lot_created'
}

const normalizeStockExpiryTrigger = (value: unknown): StockExpiryTrigger => {
  if(
    value === 'Stok Çıkışı'
    || value === 'Otomatik Stok Düşümü'
    || value === 'Ters Hareket'
    || value === 'Sayım Düzeltme'
    || value === 'Fire'
    || value === 'SKT Kontrolü'
    || value === 'Stok Girişi'
  ){
    return value
  }

  return 'Stok Girişi'
}

const normalizeStockExpiryEvent = (item: Partial<StockExpiryEvent>): StockExpiryEvent => {
  const qty = Number(item.qty)

  return {
    id: String(item.id || `stock_expiry_event_${Date.now()}`),
    lotId: item.lotId,
    lotCode: item.lotCode,
    stockItemId: String(item.stockItemId || ''),
    stockItemName: String(item.stockItemName || 'Stok Kartı'),
    eventType: normalizeStockExpiryEventType(item.eventType),
    trigger: normalizeStockExpiryTrigger(item.trigger),
    qty: Number.isFinite(qty) ? Math.max(0, qty) : undefined,
    unit: normalizeStockUnit(item.unit),
    expiryDate: normalizeExpiryDateKey(item.expiryDate),
    previousStatus: normalizeStockExpiryStatus(item.previousStatus),
    nextStatus: normalizeStockExpiryStatus(item.nextStatus),
    movementId: item.movementId,
    tableId: item.tableId,
    tableName: item.tableName,
    userId: String(item.userId || ''),
    userName: String(item.userName || 'Bilinmeyen Kullanıcı'),
    timestamp: item.timestamp || new Date().toISOString(),
    note: item.note || ''
  }
}

const normalizeStockWasteReasonCategory = (value: unknown): StockWasteReasonCategory => {
  return STOCK_WASTE_REASONS.includes(value as StockWasteReasonCategory) ? value as StockWasteReasonCategory : 'Diğer'
}

const normalizeStockWasteStatus = (value: unknown): StockWasteStatus => {
  return value === 'reversed' ? 'reversed' : 'active'
}

const normalizeStockWasteRecord = (item: Partial<StockWasteRecord>): StockWasteRecord => {
  const qty = Number(item.qty)
  const expiryUnallocatedQty = Number(item.expiryUnallocatedQty)
  const estimatedUnitCost = Number(item.estimatedUnitCost)
  const estimatedTotalCost = Number(item.estimatedTotalCost)
  const timestamp = item.createdAt || new Date().toISOString()

  return {
    id: String(item.id || `stock_waste_${Date.now()}`),
    branchId: getBranchIdValue(item),
    stockMovementId: String(item.stockMovementId || ''),
    stockItemId: String(item.stockItemId || ''),
    stockItemName: String(item.stockItemName || 'Stok Kartı'),
    qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
    unit: normalizeStockUnit(item.unit),
    reasonCategory: normalizeStockWasteReasonCategory(item.reasonCategory),
    reasonNote: item.reasonNote || '',
    responsibleUserId: item.responsibleUserId,
    responsibleFullName: item.responsibleFullName || '',
    createdByUserId: String(item.createdByUserId || ''),
    createdByFullName: String(item.createdByFullName || 'Bilinmeyen Kullanıcı'),
    occurredAt: item.occurredAt || timestamp,
    createdAt: timestamp,
    expiryAllocations: (item.expiryAllocations || []).map(normalizeStockExpiryAllocation).filter(allocation => allocation.lotId && allocation.qty > 0),
    expiryUnallocatedQty: Number.isFinite(expiryUnallocatedQty) ? Math.max(0, expiryUnallocatedQty) : undefined,
    expiryWarnings: item.expiryWarnings || [],
    estimatedUnitCost: Number.isFinite(estimatedUnitCost) && estimatedUnitCost >= 0 ? estimatedUnitCost : undefined,
    estimatedTotalCost: Number.isFinite(estimatedTotalCost) && estimatedTotalCost >= 0 ? estimatedTotalCost : undefined,
    status: normalizeStockWasteStatus(item.status),
    reversedByMovementId: item.reversedByMovementId,
    reversedAt: item.reversedAt,
    updatedAt: item.updatedAt
  }
}

const normalizeStockDeductionStatus = (value: unknown): StockDeductionStatus => {
  if(
    value === 'deducted'
    || value === 'warning'
    || value === 'missing_recipe'
    || value === 'failed'
    || value === 'partial_reversed'
    || value === 'reversed'
    || value === 'not_required'
  ){
    return value
  }

  return 'not_required'
}

const normalizeStockDeductionSourceType = (value: unknown): StockDeductionSourceType => {
  if(
    value === 'QR Siparişi'
    || value === 'Adet Artışı'
    || value === 'Adet Azalışı'
    || value === 'Sipariş İptali'
    || value === 'Masa Siparişi'
  ){
    return value
  }

  return 'Masa Siparişi'
}

const normalizeStockDeductionLine = (item: Partial<StockDeductionLine>): StockDeductionLine => {
  const qty = Number(item.qty)
  const recipeQty = Number(item.recipeQty)
  const wastePercent = Number(item.wastePercent)
  const expiryUnallocatedQty = Number(item.expiryUnallocatedQty)

  return {
    id: String(item.id || `stock_deduction_line_${Date.now()}`),
    stockItemId: String(item.stockItemId || ''),
    stockItemName: String(item.stockItemName || 'Stok Kartı'),
    qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
    unit: normalizeStockUnit(item.unit),
    recipeQty: Number.isFinite(recipeQty) ? Math.max(0, recipeQty) : 0,
    recipeUnit: normalizeStockUnit(item.recipeUnit),
    wastePercent: Number.isFinite(wastePercent) ? Math.max(0, wastePercent) : 0,
    movementId: item.movementId,
    reverseMovementIds: item.reverseMovementIds || [],
    expiryAllocations: (item.expiryAllocations || []).map(normalizeStockExpiryAllocation).filter(allocation => allocation.lotId && allocation.qty > 0),
    expiryUnallocatedQty: Number.isFinite(expiryUnallocatedQty) ? Math.max(0, expiryUnallocatedQty) : undefined,
    expiryWarnings: item.expiryWarnings || [],
    warning: item.warning,
    error: item.error
  }
}

const normalizeStockDeductionBatch = (item: Partial<StockDeductionBatch>): StockDeductionBatch => {
  const qty = Number(item.qty)
  const remainingQty = Number(item.remainingQty)

  return {
    id: String(item.id || `stock_deduction_${Date.now()}`),
    branchId: getBranchIdValue(item),
    orderId: String(item.orderId || ''),
    tableId: String(item.tableId || ''),
    tableName: String(item.tableName || 'Masa'),
    productId: String(item.productId || ''),
    productName: String(item.productName || 'Ürün'),
    qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
    remainingQty: Number.isFinite(remainingQty) ? Math.max(0, remainingQty) : 0,
    sourceType: normalizeStockDeductionSourceType(item.sourceType),
    status: normalizeStockDeductionStatus(item.status),
    recipeId: item.recipeId,
    recipeVersion: item.recipeVersion,
    recipeSnapshot: item.recipeSnapshot,
    movementIds: item.movementIds || [],
    lines: (item.lines || []).map(normalizeStockDeductionLine),
    warnings: item.warnings || [],
    errors: item.errors || [],
    createdAt: item.createdAt || new Date().toISOString(),
    createdByUserId: String(item.createdByUserId || ''),
    createdByFullName: String(item.createdByFullName || 'Bilinmeyen Kullanıcı'),
    updatedAt: item.updatedAt
  }
}

const normalizeStockDeductionAuditEventType = (value: unknown): StockDeductionAuditEventType => {
  if(value === 'reversed' || value === 'warning' || value === 'failed' || value === 'skipped' || value === 'deducted'){
    return value
  }

  return 'deducted'
}

const normalizeStockDeductionAuditEvent = (item: Partial<StockDeductionAuditEvent>): StockDeductionAuditEvent => ({
  id: String(item.id || `stock_deduction_audit_${Date.now()}`),
  batchId: item.batchId,
  orderId: item.orderId,
  productId: item.productId,
  eventType: normalizeStockDeductionAuditEventType(item.eventType),
  userId: String(item.userId || ''),
  userName: String(item.userName || 'Bilinmeyen Kullanıcı'),
  tableId: item.tableId,
  tableName: item.tableName,
  timestamp: item.timestamp || new Date().toISOString(),
  before: item.before,
  after: item.after,
  note: item.note || ''
})

const normalizeRecipeItemUnit = (value: unknown): RecipeItem['unit'] => {
  if(value === 'çuval' || value === 'kasa'){
    return value as RecipeItem['unit']
  }

  return normalizeStockUnit(value)
}

const normalizeRecipeItem = (item: Partial<RecipeItem> & Record<string, unknown>): RecipeItem => {
  const qty = Number(item.qty)
  const wastePercent = Number(item.wastePercent)

  return {
    ...item,
    id: String(item.id || `recipe_item_${Date.now()}`),
    stockItemId: String(item.stockItemId || ''),
    stockItemName: String(item.stockItemName || 'Stok Kartı'),
    qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
    unit: normalizeRecipeItemUnit(item.unit),
    wastePercent: Number.isFinite(wastePercent) ? Math.max(0, wastePercent) : 0,
    note: item.note || ''
  }
}

const normalizeRecipeCostSnapshot = (item?: Partial<RecipeCostSnapshot>): RecipeCostSnapshot | undefined => {
  if(!item) return undefined

  const totalCost = Number(item.totalCost)
  const missingCostItemCount = Number(item.missingCostItemCount)

  return {
    totalCost: Number.isFinite(totalCost) ? Math.max(0, totalCost) : 0,
    missingCostItemCount: Number.isFinite(missingCostItemCount) ? Math.max(0, Math.floor(missingCostItemCount)) : 0,
    calculatedAt: item.calculatedAt || new Date().toISOString()
  }
}

const normalizeRecipe = (item: Partial<Recipe> & Record<string, unknown>): Recipe => {
  const timestamp = item.createdAt || new Date().toISOString()
  const version = Number(item.version)
  const recipeVersion = Number(item.recipeVersion)

  return {
    ...item,
    id: String(item.id || `recipe_${Date.now()}`),
    branchId: getBranchIdValue(item),
    productId: String(item.productId || ''),
    productName: String(item.productName || 'Ürün'),
    name: String(item.name || 'Üretim Tanımı').trim() || 'Üretim Tanımı',
    version: Number.isFinite(version) && version > 0 ? Math.floor(version) : 1,
    recipeVersion: Number.isFinite(recipeVersion) && recipeVersion > 0 ? Math.floor(recipeVersion) : (Number.isFinite(version) && version > 0 ? Math.floor(version) : 1),
    active: item.active === true && !item.deletedAt,
    items: (item.items || []).map(normalizeRecipeItem).filter(recipeItem => recipeItem.stockItemId && recipeItem.qty > 0),
    note: item.note || '',
    costSnapshot: normalizeRecipeCostSnapshot(item.costSnapshot),
    createdAt: timestamp,
    updatedAt: item.updatedAt,
    createdByUserId: String(item.createdByUserId || ''),
    createdByFullName: String(item.createdByFullName || 'Bilinmeyen Kullanıcı'),
    updatedByUserId: item.updatedByUserId,
    updatedByFullName: item.updatedByFullName,
    copiedFromRecipeId: item.copiedFromRecipeId,
    deletedAt: item.deletedAt,
    deletedByUserId: item.deletedByUserId,
    deletedByFullName: item.deletedByFullName
  }
}

const normalizeRecipeAuditEventType = (value: unknown): RecipeAuditEventType => {
  if(
    value === 'updated'
    || value === 'deleted'
    || value === 'copied'
    || value === 'activated'
    || value === 'deactivated'
    || value === 'created'
  ){
    return value
  }

  return 'created'
}

const normalizeRecipeAuditEvent = (item: Partial<RecipeAuditEvent>): RecipeAuditEvent => ({
  id: String(item.id || `recipe_audit_${Date.now()}`),
  recipeId: String(item.recipeId || ''),
  eventType: normalizeRecipeAuditEventType(item.eventType),
  userId: String(item.userId || ''),
  userName: String(item.userName || 'Bilinmeyen Kullanıcı'),
  timestamp: item.timestamp || new Date().toISOString(),
  before: item.before,
  after: item.after,
  note: item.note || ''
})

const normalizeKitchenStatus = (value: unknown): KitchenOrderStatus => {
  if(value === 'Hazırlanıyor' || value === 'Hazır') return value
  return 'Yeni Sipariş'
}

const normalizeKitchenOrder = (item: Partial<KitchenOrder>): KitchenOrder => {
  const timestamp = item.createdAt || new Date().toISOString()

  return {
    id: String(item.id || `kitchen_${Date.now()}`),
    branchId: getBranchIdValue(item),
    tableId: String(item.tableId || ''),
    tableName: String(item.tableName || 'Masa'),
    waiterId: String(item.waiterId || ''),
    waiterName: String(item.waiterName || 'Bilinmeyen Personel'),
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
  if(value === 'Onaylandı' || value === 'Reddedildi' || value === 'Görevli Onayı Bekliyor') return value
  if(value === 'Garson Onayı Bekliyor') return 'Görevli Onayı Bekliyor'
  return 'Görevli Onayı Bekliyor'
}

const normalizeQRRequestItem = (orderItem: Partial<QRRequestItem>): QRRequestItem => ({
  productId: String(orderItem.productId || ''),
  productName: String(orderItem.productName || 'Ürün'),
  unitPrice: Math.max(0, Number(orderItem.unitPrice) || 0),
  qty: Math.max(1, Number(orderItem.qty) || 1)
})

const normalizeQRRejectReason = (value: unknown): QRRejectReason | undefined => {
  if(value === 'Ürün mevcut değil' || value === 'Müşteri iptali' || value === 'Stok yetersiz' || value === 'Diğer') return value
  if(value === 'Operasyon kapalı' || value === 'Mutfak kapalı') return 'Operasyon kapalı'
  if(value === 'Hatalı alan' || value === 'Hatalı masa') return 'Hatalı alan'
  return undefined
}

const normalizeQRRequest = (item: Partial<QRRequest>): QRRequest => {
  const timestamp = item.createdAt || new Date().toISOString()
  const items = (item.items || []).map(normalizeQRRequestItem).filter(orderItem => orderItem.productId)
  const originalItems = (item.originalItems || items).map(normalizeQRRequestItem).filter(orderItem => orderItem.productId)

  return {
    id: String(item.id || `qr_${Date.now()}`),
    branchId: getBranchIdValue(item),
    tableId: String(item.tableId || ''),
    tableName: String(item.tableName || 'Masa'),
    items,
    originalItems,
    status: normalizeQRRequestStatus(item.status),
    customerNote: item.customerNote || '',
    staffNote: item.staffNote || '',
    createdAt: timestamp,
    updatedAt: item.updatedAt,
    updatedByUserId: item.updatedByUserId,
    updatedByFullName: item.updatedByFullName,
    editCount: Math.max(0, Number(item.editCount) || 0),
    approvedAt: item.approvedAt,
    approvedByUserId: item.approvedByUserId,
    approvedByFullName: item.approvedByFullName,
    rejectedAt: item.rejectedAt,
    rejectedByUserId: item.rejectedByUserId,
    rejectedByFullName: item.rejectedByFullName,
    rejectReason: normalizeQRRejectReason(item.rejectReason),
    rejectNote: item.rejectNote,
    archivedAt: item.archivedAt
  }
}

const normalizeWaiterCallStatus = (value: unknown): WaiterCallStatus => {
  if(value === 'Sahiplenildi' || value === 'Masaya Gidildi' || value === 'Kapatıldı' || value === 'Bekliyor') return value
  return 'Bekliyor'
}

const normalizeWaiterCall = (item: Partial<WaiterCall>): WaiterCall => {
  return {
    id: String(item.id || `call_${Date.now()}`),
    tableId: String(item.tableId || ''),
    tableName: String(item.tableName || 'Masa'),
    status: normalizeWaiterCallStatus(item.status),
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt,
    assignedAt: item.assignedAt,
    assignedByUserId: item.assignedByUserId,
    assignedByFullName: item.assignedByFullName,
    visitedAt: item.visitedAt,
    visitedByUserId: item.visitedByUserId,
    visitedByFullName: item.visitedByFullName,
    closedAt: item.closedAt,
    closedByUserId: item.closedByUserId,
    closedByFullName: item.closedByFullName,
    closeNote: item.closeNote || '',
    archivedAt: item.archivedAt
  }
}

const normalizeQRRequestHistory = (item: Partial<QRRequestHistory>): QRRequestHistory => {
  const request = normalizeQRRequest(item)
  const status = request.status === 'Onaylandı' || request.status === 'Reddedildi' ? request.status : 'Reddedildi'
  const archivedAt = item.archivedAt || request.archivedAt || request.rejectedAt || request.approvedAt || new Date().toISOString()

  return {
    ...request,
    status,
    archivedAt
  }
}

const normalizeWaiterCallHistory = (item: Partial<WaiterCallHistory>): WaiterCallHistory => {
  const call = normalizeWaiterCall(item)

  return {
    ...call,
    status: 'Kapatıldı',
    archivedAt: item.archivedAt || call.archivedAt || call.closedAt || new Date().toISOString()
  }
}

const normalizeAuditEventType = (value: unknown): AuditEventType => {
  if(
    value === 'edited'
    || value === 'approved'
    || value === 'rejected'
    || value === 'assigned'
    || value === 'visited'
    || value === 'closed'
    || value === 'note_updated'
    || value === 'created'
  ){
    return value
  }

  return 'created'
}

const normalizeAuditEntityType = (value: unknown): AuditEntityType => {
  return value === 'WaiterCall' ? 'WaiterCall' : 'QRRequest'
}

const normalizeQRAuditEvent = (item: Partial<QRAuditEvent>): QRAuditEvent => ({
  id: String(item.id || `audit_${Date.now()}`),
  entityType: normalizeAuditEntityType(item.entityType),
  entityId: String(item.entityId || ''),
  eventType: normalizeAuditEventType(item.eventType),
  userId: String(item.userId || ''),
  userName: String(item.userName || 'Bilinmeyen Kullanıcı'),
  tableId: item.tableId,
  tableName: item.tableName,
  timestamp: item.timestamp || new Date().toISOString(),
  before: item.before,
  after: item.after,
  note: item.note || ''
})

const normalizePaymentMethod = (value: unknown): PaymentMethod => {
  if(value === 'Kart' || value === 'Diğer') return value
  return 'Nakit'
}

const normalizePaymentParts = (items?: Partial<PaymentPart>[]): PaymentPart[] => {
  return (items || [])
    .map(item => {
      const amount = Number(item.amount)

      return {
        method: normalizePaymentMethod(item.method),
        amount: Number.isFinite(amount) ? Math.max(0, roundMoneyValue(amount)) : 0
      }
    })
    .filter(item => item.amount > 0)
}

const normalizeDiscount = (item?: Partial<Discount>): Discount | undefined => {
  if(!item) return undefined

  const value = Number(item.value)
  if(!Number.isFinite(value) || value <= 0) return undefined

  return {
    type: item.type === 'percent' ? 'percent' : 'amount',
    value: item.type === 'percent' ? Math.min(100, value) : value
  }
}

const normalizeOrder = (item: Partial<Order>, fallbackBranchId = DEFAULT_BRANCH_ID): Order => {
  const qty = Number(item.qty)
  const unitPrice = Number(item.unitPrice)
  const stockDeductedQty = Number(item.stockDeductedQty)
  const branchId = getBranchIdValue(item, fallbackBranchId)
  const tenantId = String(item.tenantId || '').trim() || resolveTenantIdForRecord({ ...item, branchId })

  return {
    id: String(item.id || `ord_${Date.now()}`),
    tenantId,
    branchId,
    productId: String(item.productId || ''),
    productName: item.productName,
    unitPrice: Number.isFinite(unitPrice) ? Math.max(0, unitPrice) : undefined,
    qty: Number.isFinite(qty) ? Math.max(0, Math.round(qty)) : 0,
    isGift: item.isGift === true,
    recipeId: item.recipeId,
    recipeVersion: item.recipeVersion,
    recipeSnapshot: item.recipeSnapshot,
    stockDeductionStatus: item.stockDeductionStatus,
    stockDeductionBatchIds: item.stockDeductionBatchIds || [],
    stockDeductedQty: Number.isFinite(stockDeductedQty) ? Math.max(0, stockDeductedQty) : undefined,
    stockDeductionWarnings: item.stockDeductionWarnings || []
  }
}

const normalizeTableState = (item: Partial<TableState>): TableState => {
  const branchId = getBranchIdValue(item)
  const tenantId = String(item.tenantId || '').trim() || resolveTenantIdForRecord({ ...item, branchId })

  return {
    id: String(item.id || `tbl_${Date.now()}`),
    tenantId,
    branchId,
    companyId: String(item.companyId || '').trim() || undefined,
    name: String(item.name || 'Masa').trim() || 'Masa',
    open: item.open === true,
    orders: (item.orders || []).map(order => normalizeOrder({ ...order, tenantId }, branchId)).filter(order => order.productId && order.qty > 0),
    note: item.note || '',
    discount: normalizeDiscount(item.discount)
  }
}

const normalizeClosedBill = (item: Partial<ClosedBill>): ClosedBill => {
  const branchId = getBranchIdValue(item)
  const tenantId = String(item.tenantId || '').trim() || resolveTenantIdForRecord({ ...item, branchId })
  const subtotal = Number(item.subtotal)
  const total = Number(item.total)
  const discountTotal = Number(item.discountTotal)

  return {
    id: String(item.id || `bill_${Date.now()}`),
    tenantId,
    branchId,
    tableId: String(item.tableId || ''),
    tableName: String(item.tableName || 'Masa'),
    subtotal: Number.isFinite(subtotal) ? Math.max(0, roundMoneyValue(subtotal)) : undefined,
    total: Number.isFinite(total) ? Math.max(0, roundMoneyValue(total)) : 0,
    timestamp: item.timestamp || new Date().toISOString(),
    orders: (item.orders || []).map(order => normalizeOrder({ ...order, tenantId }, branchId)).filter(order => order.productId && order.qty > 0),
    paymentMethod: normalizePaymentMethod(item.paymentMethod),
    payments: normalizePaymentParts(item.payments),
    splitPayment: item.splitPayment === true,
    splitLabel: item.splitLabel,
    mergeHistory: item.mergeHistory === true,
    mergeTargetTableId: item.mergeTargetTableId,
    mergeTargetTableName: item.mergeTargetTableName,
    closedByUserId: item.closedByUserId,
    closedByFullName: item.closedByFullName,
    note: item.note || '',
    discount: normalizeDiscount(item.discount),
    discountTotal: Number.isFinite(discountTotal) ? Math.max(0, roundMoneyValue(discountTotal)) : undefined
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

const normalizeBranch = (item: Partial<Branch>): Branch => {
  const timestamp = item.createdAt || new Date().toISOString()
  const companyId = String(item.companyId || '').trim()

  return {
    id: String(item.id || `branch_${Date.now()}`),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForCompany(companyId),
    companyId: companyId || undefined,
    code: String(item.code || `SUBE-${Date.now()}`).trim() || `SUBE-${Date.now()}`,
    name: String(item.name || 'İsimsiz Şube').trim() || 'İsimsiz Şube',
    phone: String(item.phone || '').trim(),
    email: String(item.email || '').trim(),
    address: String(item.address || '').trim(),
    city: String(item.city || '').trim(),
    district: String(item.district || '').trim(),
    managerName: String(item.managerName || '').trim(),
    isActive: item.isActive !== false,
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeBranchPermission = (item: Partial<BranchPermission>): BranchPermission => {
  const timestamp = item.createdAt || new Date().toISOString()
  const branchId = String(item.branchId || DEFAULT_BRANCH_ID)

  return {
    id: String(item.id || `branch_permission_${Date.now()}`),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForRecord({ ...item, branchId }),
    userId: String(item.userId || ''),
    branchId,
    canView: item.canView === true,
    canCreate: item.canCreate === true,
    canEdit: item.canEdit === true,
    canDelete: item.canDelete === true,
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeBranchStockTransferStatus = (value: unknown): BranchStockTransferStatus => {
  return BRANCH_STOCK_TRANSFER_STATUSES.includes(value as BranchStockTransferStatus)
    ? value as BranchStockTransferStatus
    : 'Bekliyor'
}

const normalizeBranchStockTransferItem = (item: Partial<BranchStockTransferItem>): BranchStockTransferItem => {
  const quantity = Number(item.quantity)

  return {
    stockItemId: String(item.stockItemId || ''),
    stockItemName: String(item.stockItemName || 'Stok Kartı').trim() || 'Stok Kartı',
    quantity: Number.isFinite(quantity) ? Math.max(0, Math.round((quantity + Number.EPSILON) * 1000000) / 1000000) : 0,
    unit: normalizeStockUnit(item.unit)
  }
}

const normalizeBranchStockTransfer = (item: Partial<BranchStockTransfer>): BranchStockTransfer => {
  const timestamp = item.createdAt || new Date().toISOString()
  const sourceBranchId = String(item.sourceBranchId || DEFAULT_BRANCH_ID)

  return {
    id: String(item.id || `branch_transfer_${Date.now()}`),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForRecord({ ...item, branchId: sourceBranchId }),
    transferNo: String(item.transferNo || `TRF-${Date.now()}`).trim() || `TRF-${Date.now()}`,
    sourceBranchId,
    targetBranchId: String(item.targetBranchId || DEFAULT_BRANCH_ID),
    transferDate: String(item.transferDate || new Date().toLocaleDateString('sv-SE')),
    status: normalizeBranchStockTransferStatus(item.status),
    note: String(item.note || '').trim(),
    createdBy: String(item.createdBy || 'Yönetici').trim() || 'Yönetici',
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp,
    items: (item.items || []).map(normalizeBranchStockTransferItem).filter(transferItem => transferItem.stockItemId && transferItem.quantity > 0)
  }
}

const normalizeApplicationStatus = (value: unknown): ApplicationStatus => {
  return APPLICATION_STATUSES.includes(value as ApplicationStatus) ? value as ApplicationStatus : 'Beklemede'
}

const normalizeBusinessApplication = (item: Partial<BusinessApplication>): BusinessApplication => {
  const timestamp = item.createdAt || new Date().toISOString()

  return {
    id: String(item.id || createTenantStorageId('business_application')),
    companyId: String(item.companyId || '').trim(),
    primarySectorId: normalizePrimarySectorId(item.primarySectorId),
    companyName: String(item.companyName || 'İsimsiz Firma').trim() || 'İsimsiz Firma',
    ownerName: String(item.ownerName || '').trim(),
    phone: String(item.phone || '').trim(),
    email: String(item.email || '').trim(),
    taxNumber: String(item.taxNumber || '').trim(),
    taxOffice: String(item.taxOffice || '').trim(),
    city: String(item.city || '').trim(),
    district: String(item.district || '').trim(),
    address: String(item.address || '').trim(),
    status: normalizeApplicationStatus(item.status),
    approvalNote: String(item.approvalNote || '').trim(),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeApplicationNote = (item: Partial<ApplicationNote>): ApplicationNote => ({
  id: String(item.id || createTenantStorageId('application_note')),
  applicationId: String(item.applicationId || '').trim(),
  note: String(item.note || '').trim(),
  createdBy: String(item.createdBy || 'Sistem').trim() || 'Sistem',
  createdAt: item.createdAt || new Date().toISOString()
})

const createDemoBusinessApplications = (now = new Date().toISOString()): BusinessApplication[] => {
  const approvedDate = new Date(now)
  approvedDate.setDate(approvedDate.getDate() - 8)
  const rejectedDate = new Date(now)
  rejectedDate.setDate(rejectedDate.getDate() - 2)

  return [
    normalizeBusinessApplication({
      id: 'business_application_abc_cafe_demo',
      primarySectorId: createSectorId(SECTOR_CODES.CAFE),
      companyName: 'ABC Cafe',
      ownerName: 'Ahmet Kaya',
      phone: '0532 000 00 01',
      email: 'basvuru@abccafe.com',
      taxNumber: '1234567890',
      taxOffice: 'Kadıköy',
      city: 'İstanbul',
      district: 'Kadıköy',
      address: 'Caferağa Mahallesi No: 12',
      status: 'Beklemede',
      approvalNote: '',
      createdAt: now,
      updatedAt: now
    }),
    normalizeBusinessApplication({
      id: 'business_application_ornek_isletme_demo',
      primarySectorId: DEFAULT_SECTOR_ID,
      companyName: 'Örnek İşletme',
      ownerName: 'Mehmet Demir',
      phone: '0532 000 00 02',
      email: 'yonetim@ornekisletme.com',
      taxNumber: '2345678901',
      taxOffice: 'Çankaya',
      city: 'Ankara',
      district: 'Çankaya',
      address: 'Kavaklıdere Cad. No: 8',
      status: 'Onaylandı',
      approvalNote: 'Demo onaylı başvuru.',
      createdAt: approvedDate.toISOString(),
      updatedAt: approvedDate.toISOString()
    }),
    normalizeBusinessApplication({
      id: 'business_application_kahve_duragi_demo',
      primarySectorId: createSectorId(SECTOR_CODES.CAFE),
      companyName: 'Kahve Durağı',
      ownerName: 'Ayşe Yılmaz',
      phone: '0532 000 00 03',
      email: 'info@kahveduragi.com',
      taxNumber: '3456789012',
      taxOffice: 'Konak',
      city: 'İzmir',
      district: 'Konak',
      address: 'Alsancak Mahallesi No: 4',
      status: 'Reddedildi',
      approvalNote: 'Vergi bilgileri eksik.',
      createdAt: rejectedDate.toISOString(),
      updatedAt: rejectedDate.toISOString()
    })
  ]
}

const createDemoApplicationNotes = (now = new Date().toISOString()): ApplicationNote[] => [
  normalizeApplicationNote({
    id: 'application_note_abc_demo',
    applicationId: 'business_application_abc_cafe_demo',
    note: 'Demo bekleyen başvuru.',
    createdBy: 'Sistem',
    createdAt: now
  }),
  normalizeApplicationNote({
    id: 'application_note_lezzet_demo',
    applicationId: 'business_application_ornek_isletme_demo',
    note: 'Onay sonrası demo firma kayıtları hazır.',
    createdBy: 'Demo Admin',
    createdAt: now
  }),
  normalizeApplicationNote({
    id: 'application_note_kahve_demo',
    applicationId: 'business_application_kahve_duragi_demo',
    note: 'Red sebebi: Vergi bilgileri eksik.',
    createdBy: 'Demo Admin',
    createdAt: now
  })
]

const normalizeBusinessRegistrationStatus = (value: unknown): BusinessRegistrationStatus => {
  return BUSINESS_REGISTRATION_STATUSES.includes(value as BusinessRegistrationStatus)
    ? value as BusinessRegistrationStatus
    : 'Başvuru Bekliyor'
}

const normalizeBusinessRegistrationPackage = (value: unknown): BusinessRegistrationPackage => {
  return BUSINESS_REGISTRATION_PACKAGES.includes(value as BusinessRegistrationPackage)
    ? value as BusinessRegistrationPackage
    : 'Başlangıç'
}

const normalizeBusinessRegistration = (item: Partial<BusinessRegistration>): BusinessRegistration => {
  const timestamp = item.createdAt || new Date().toISOString()
  const branchCount = Number(item.branchCount)

  return {
    id: String(item.id || `business_registration_${Date.now()}`),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForRecord(item),
    businessName: String(item.businessName || 'İsimsiz İşletme').trim() || 'İsimsiz İşletme',
    ownerName: String(item.ownerName || '').trim(),
    phone: String(item.phone || '').trim(),
    email: String(item.email || '').trim(),
    city: String(item.city || '').trim(),
    district: String(item.district || '').trim(),
    taxNumber: String(item.taxNumber || '').trim(),
    taxOffice: String(item.taxOffice || '').trim(),
    address: String(item.address || '').trim(),
    branchCount: Number.isFinite(branchCount) ? Math.max(1, Math.round(branchCount)) : 1,
    requestedPackage: normalizeBusinessRegistrationPackage(item.requestedPackage),
    status: normalizeBusinessRegistrationStatus(item.status),
    notes: String(item.notes || '').trim(),
    approvedBy: String(item.approvedBy || '').trim(),
    approvedAt: String(item.approvedAt || '').trim(),
    rejectedReason: String(item.rejectedReason || '').trim(),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const createDemoBusinessRegistrations = (now = new Date().toISOString()): BusinessRegistration[] => {
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  return [
    normalizeBusinessRegistration({
      id: 'business_registration_abc_cafe_demo',
      businessName: 'ABC Cafe',
      ownerName: 'Ahmet Kaya',
      phone: '0532 000 00 01',
      email: 'basvuru@abccafe.com',
      city: 'İstanbul',
      district: 'Kadıköy',
      taxNumber: '1234567890',
      taxOffice: 'Kadıköy',
      address: 'Caferağa Mahallesi No: 12',
      branchCount: 1,
      requestedPackage: 'Başlangıç',
      status: 'Onaylandı',
      notes: 'Demo kurulum bekleyen onaylı başvuru.',
      approvedBy: 'Demo Admin',
      approvedAt: yesterday.toISOString(),
      createdAt: yesterday.toISOString(),
      updatedAt: yesterday.toISOString()
    }),
    normalizeBusinessRegistration({
      id: 'business_registration_ornek_isletme_demo',
      businessName: 'Örnek İşletme',
      ownerName: 'Mehmet Demir',
      phone: '0532 000 00 02',
      email: 'yonetim@ornekisletme.com',
      city: 'Ankara',
      district: 'Çankaya',
      taxNumber: '2345678901',
      taxOffice: 'Çankaya',
      address: 'Kavaklıdere Cad. No: 8',
      branchCount: 2,
      requestedPackage: 'Pro',
      status: 'Onaylandı',
      notes: 'Demo onaylı başvuru.',
      approvedBy: 'Demo Admin',
      approvedAt: lastWeek.toISOString(),
      createdAt: lastWeek.toISOString(),
      updatedAt: lastWeek.toISOString()
    }),
    normalizeBusinessRegistration({
      id: 'business_registration_kahve_duragi_demo',
      businessName: 'Kahve Durağı',
      ownerName: 'Ayşe Yılmaz',
      phone: '0532 000 00 03',
      email: 'info@kahveduragi.com',
      city: 'İzmir',
      district: 'Konak',
      taxNumber: '3456789012',
      taxOffice: 'Konak',
      address: 'Alsancak Mahallesi No: 4',
      branchCount: 1,
      requestedPackage: 'Premium',
      status: 'Reddedildi',
      notes: 'Demo reddedilen başvuru.',
      rejectedReason: 'Vergi bilgileri eksik.',
      createdAt: now,
      updatedAt: now
    })
  ]
}

const normalizeCompanyStatus = (value: unknown): CompanyStatus => {
  return COMPANY_STATUSES.includes(value as CompanyStatus)
    ? value as CompanyStatus
    : 'Aktif'
}

const createCompanyCode = (companyName: string, companyId: string) => {
  const cleanName = companyName
    .toLocaleUpperCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/İ/g, 'I')
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 8) || 'COMPANY'
  const cleanId = companyId
    .replace(/[^a-z0-9]/gi, '')
    .slice(-6)
    .toLocaleUpperCase('tr-TR') || Date.now().toString().slice(-6)

  return `CMP-${cleanName}-${cleanId}`
}

const resolveCompanyLicenseDatesForMigration = (companyId: string) => {
  const licenses = readJson<Partial<CompanyLicense>[]>(KEY_COMPANY_LICENSES, [])
    .filter(license => String(license.companyId || '').trim() === companyId)
    .sort((first, second) => String(second.updatedAt || second.createdAt || second.startDate || '')
      .localeCompare(String(first.updatedAt || first.createdAt || first.startDate || '')))
  const license = licenses[0]

  return {
    licenseStart: String(license?.startDate || '').trim(),
    licenseEnd: String(license?.endDate || '').trim()
  }
}

const normalizeCompany = (item: Partial<Company>): Company => {
  const timestamp = item.createdAt || new Date().toISOString()
  const companyId = String(item.id || `company_${Date.now()}`)
  const companyName = String(item.companyName || 'İsimsiz Firma').trim() || 'İsimsiz Firma'
  const ownerName = String(item.ownerName || item.authorizedPerson || '').trim()
  const authorizedPerson = String(item.authorizedPerson || ownerName || companyName).trim() || companyName
  const phone = String(item.phone || item.authorizedPhone || '').trim()
  const email = String(item.email || item.authorizedEmail || '').trim()
  const status = normalizeCompanyStatus(item.status)
  const isApproved = item.isApproved === true || ['Aktif', 'Askıda'].includes(status)
  const deletedAt = String(item.deletedAt || '').trim()
    || (status === 'Silindi' || status === 'Arşivlendi' ? timestamp : '')
  const migratedLicenseDates = resolveCompanyLicenseDatesForMigration(companyId)

  return {
    id: companyId,
    companyCode: String(item.companyCode || '').trim().toLocaleUpperCase('tr-TR') || createCompanyCode(companyName, companyId),
    companyName,
    legalName: String(item.legalName || companyName).trim() || companyName,
    taxOffice: String(item.taxOffice || '').trim(),
    taxNumber: String(item.taxNumber || '').trim(),
    phone,
    email,
    city: String(item.city || '').trim(),
    district: String(item.district || '').trim(),
    address: String(item.address || '').trim(),
    authorizedPerson,
    authorizedPhone: String(item.authorizedPhone || phone).trim(),
    authorizedEmail: String(item.authorizedEmail || email).trim(),
    status,
    isApproved,
    primarySectorId: normalizePrimarySectorId(item.primarySectorId),
    approvedAt: String(item.approvedAt || (isApproved ? timestamp : '')).trim(),
    approvedBy: String(item.approvedBy || (isApproved ? 'migration' : '')).trim(),
    workspaceId: String(item.workspaceId || `workspace_${companyId}`).trim(),
    defaultBranchId: String(item.defaultBranchId || '').trim(),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForCompany(companyId),
    subscriptionId: String(item.subscriptionId || '').trim(),
    licenseStart: String(item.licenseStart || migratedLicenseDates.licenseStart || '').trim(),
    licenseEnd: String(item.licenseEnd || migratedLicenseDates.licenseEnd || '').trim(),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp,
    deletedAt,
    ownerName: ownerName || authorizedPerson,
    logoUrl: String(item.logoUrl || '').trim(),
  }
}

const normalizeCompanySetup = (item: Partial<CompanySetup>): CompanySetup => {
  const timestamp = item.createdAt || new Date().toISOString()
  const companyId = String(item.companyId || '')
  const registrationId = String(item.registrationId || '')
  const setupCompleted = item.setupCompleted === true
  const isFirstLoginApplicationSetup = registrationId.startsWith('business_application_')
  const installationCompleted = item.installationCompleted === true
    || (setupCompleted && !isFirstLoginApplicationSetup)

  return {
    id: String(item.id || `company_setup_${Date.now()}`),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForCompany(companyId),
    registrationId,
    companyId,
    branchId: String(item.branchId || ''),
    adminUserId: String(item.adminUserId || ''),
    temporaryPassword: String(item.temporaryPassword || ''),
    setupCompleted,
    installationCompleted,
    completedAt: String(item.completedAt || ''),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const createDemoCompanies = (now = new Date().toISOString()): Company[] => [
  normalizeCompany({
    id: 'company_abc_cafe_demo',
    primarySectorId: createSectorId(SECTOR_CODES.CAFE),
    companyName: 'ABC Cafe',
    ownerName: 'Ahmet Kaya',
    phone: '0532 000 00 01',
    email: 'yonetim@abccafe.com',
    city: 'İstanbul',
    district: 'Kadıköy',
    taxNumber: '1234567890',
    taxOffice: 'Kadıköy',
    address: 'Caferağa Mahallesi No: 12',
    status: 'Aktif',
    createdAt: now,
    updatedAt: now
  }),
  normalizeCompany({
    id: 'company_ornek_isletme_demo',
    primarySectorId: DEFAULT_SECTOR_ID,
    companyName: 'Örnek İşletme',
    ownerName: 'Mehmet Demir',
    phone: '0532 000 00 02',
    email: 'yonetim@ornekisletme.com',
    city: 'Ankara',
    district: 'Çankaya',
    taxNumber: '2345678901',
    taxOffice: 'Çankaya',
    address: 'Kavaklıdere Cad. No: 8',
    status: 'Aktif',
    createdAt: now,
    updatedAt: now
  }),
  normalizeCompany({
    id: 'company_kahve_duragi_demo',
    primarySectorId: createSectorId(SECTOR_CODES.CAFE),
    companyName: 'Kahve Durağı',
    ownerName: 'Ayşe Yılmaz',
    phone: '0532 000 00 03',
    email: 'yonetim@kahveduragi.com',
    city: 'İzmir',
    district: 'Konak',
    taxNumber: '3456789012',
    taxOffice: 'Konak',
    address: 'Alsancak Mahallesi No: 4',
    status: 'Aktif',
    createdAt: now,
    updatedAt: now
  })
]

const createDemoCompanySetups = (now = new Date().toISOString()): CompanySetup[] => [
  normalizeCompanySetup({
    id: 'company_setup_abc_cafe_demo',
    registrationId: 'business_registration_abc_cafe_demo',
    companyId: 'company_abc_cafe_demo',
    branchId: 'branch_merkez',
    adminUserId: 'user_abc_cafe_admin_demo',
    temporaryPassword: 'MIYOP-1024',
    setupCompleted: true,
    installationCompleted: true,
    completedAt: now,
    createdAt: now,
    updatedAt: now
  }),
  normalizeCompanySetup({
    id: 'company_setup_ornek_isletme_demo',
    registrationId: 'business_registration_ornek_isletme_demo',
    companyId: 'company_ornek_isletme_demo',
    branchId: 'branch_ornek_isletme_merkez_demo',
    adminUserId: 'user_ornek_isletme_admin_demo',
    temporaryPassword: 'MIYOP-4837',
    setupCompleted: true,
    installationCompleted: true,
    completedAt: now,
    createdAt: now,
    updatedAt: now
  }),
  normalizeCompanySetup({
    id: 'company_setup_kahve_duragi_demo',
    registrationId: 'business_registration_kahve_duragi_demo',
    companyId: 'company_kahve_duragi_demo',
    branchId: 'branch_izmir',
    adminUserId: 'user_kahve_duragi_admin_demo',
    temporaryPassword: 'MIYOP-9142',
    setupCompleted: true,
    installationCompleted: true,
    completedAt: now,
    createdAt: now,
    updatedAt: now
  })
]

const normalizeSaasDateKey = (value: unknown, fallbackDate = new Date()) => {
  const raw = String(value || '').trim()
  if(!raw) return ''
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const date = new Date(raw)
  if(Number.isNaN(date.getTime())) return fallbackDate.toLocaleDateString('sv-SE')
  return date.toLocaleDateString('sv-SE')
}

const normalizeCompanyUserRole = (value: unknown): CompanyUserRole => {
  if(COMPANY_USER_ROLES.includes(value as CompanyUserRole)) return value as CompanyUserRole
  if(value === 'Müdür') return 'Yönetici'
  if(LEGACY_COMPANY_USER_ROLES.includes(value as typeof LEGACY_COMPANY_USER_ROLES[number])) return 'Personel'
  return 'Personel'
}

const normalizeCompanyUserStatus = (value: unknown): CompanyUserStatus => {
  return COMPANY_USER_STATUSES.includes(value as CompanyUserStatus) ? value as CompanyUserStatus : 'Aktif'
}

const normalizeCompanyUser = (item: Partial<CompanyUser>): CompanyUser => {
  const timestamp = item.createdAt || new Date().toISOString()
  const companyId = String(item.companyId || '')

  return {
    id: String(item.id || `company_user_${Date.now()}`),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForCompany(companyId),
    companyId,
    fullName: String(item.fullName || 'İsimsiz Kullanıcı').trim() || 'İsimsiz Kullanıcı',
    username: String(item.username || '').trim(),
    email: String(item.email || '').trim(),
    phone: String(item.phone || '').trim(),
    role: normalizeCompanyUserRole(item.role),
    status: normalizeCompanyUserStatus(item.status),
    lastLogin: normalizeSaasDateKey(item.lastLogin, new Date(timestamp)),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeUserSubscriptionStatus = (value: unknown): UserSubscriptionStatus => {
  return USER_SUBSCRIPTION_STATUSES.includes(value as UserSubscriptionStatus) ? value as UserSubscriptionStatus : 'Beklemede'
}

function resolveTenantIdForUserSubscription(item: Partial<UserSubscription>){
  const explicitTenantId = String(item.tenantId || '').trim()
  if(explicitTenantId) return explicitTenantId

  const companyIdByDemoLicense: Record<string, string> = {
    company_license_abc_cafe_demo: 'company_abc_cafe_demo',
    company_license_ornek_isletme_demo: 'company_ornek_isletme_demo',
    company_license_kahve_duragi_demo: 'company_kahve_duragi_demo'
  }
  const companyLicenseId = String(item.companyLicenseId || '')
  const storedLicense = readJson<Partial<CompanyLicense>[]>(KEY_COMPANY_LICENSES, [])
    .find(license => license.id === companyLicenseId)
  const companyId = String(storedLicense?.companyId || companyIdByDemoLicense[companyLicenseId] || '')

  return companyId
    ? resolveTenantIdForCompany(companyId)
    : resolveTenantIdForRecord(item, { users: readUsersForTenantContext() })
}

const normalizeUserSubscription = (item: Partial<UserSubscription>): UserSubscription => {
  const timestamp = item.createdAt || new Date().toISOString()
  const assignedAt = normalizeSaasDateKey(item.assignedAt, new Date(timestamp)) || new Date(timestamp).toLocaleDateString('sv-SE')
  const expiresAt = normalizeSaasDateKey(item.expiresAt, new Date(timestamp))
  const status = normalizeUserSubscriptionStatus(item.status)
  const today = new Date().toLocaleDateString('sv-SE')

  return {
    id: String(item.id || `user_subscription_${Date.now()}`),
    tenantId: resolveTenantIdForUserSubscription(item),
    userId: String(item.userId || ''),
    companyLicenseId: String(item.companyLicenseId || ''),
    status: status === 'Aktif' && expiresAt && expiresAt < today ? 'Süresi Doldu' : status,
    assignedAt,
    expiresAt,
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const createDemoCompanyUsers = (now = new Date().toISOString()): CompanyUser[] => {
  const today = new Date(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const lastWeek = new Date(now)
  lastWeek.setDate(lastWeek.getDate() - 7)
  const lastMonth = new Date(now)
  lastMonth.setDate(lastMonth.getDate() - 31)

  return [
    normalizeCompanyUser({
      id: 'company_user_abc_admin_demo',
      companyId: 'company_abc_cafe_demo',
      fullName: 'ABC Admin',
      username: 'abc.admin',
      email: 'admin@abccafe.com',
      phone: '0532 100 00 01',
      role: 'Admin',
      status: 'Aktif',
      lastLogin: today.toLocaleDateString('sv-SE'),
      createdAt: now,
      updatedAt: now
    }),
    normalizeCompanyUser({
      id: 'company_user_abc_personel_1_demo',
      companyId: 'company_abc_cafe_demo',
      fullName: 'Personel 1',
      username: 'abc.personel1',
      email: 'personel1@abccafe.com',
      phone: '0532 100 00 02',
      role: 'Personel',
      status: 'Aktif',
      lastLogin: yesterday.toLocaleDateString('sv-SE'),
      createdAt: now,
      updatedAt: now
    }),
    normalizeCompanyUser({
      id: 'company_user_abc_personel_2_demo',
      companyId: 'company_abc_cafe_demo',
      fullName: 'Personel 2',
      username: 'abc.personel2',
      email: 'personel2@abccafe.com',
      phone: '0532 100 00 03',
      role: 'Personel',
      status: 'Aktif',
      lastLogin: lastWeek.toLocaleDateString('sv-SE'),
      createdAt: now,
      updatedAt: now
    }),
    normalizeCompanyUser({
      id: 'company_user_abc_operasyon_demo',
      companyId: 'company_abc_cafe_demo',
      fullName: 'Operasyon',
      username: 'abc.operasyon',
      email: 'operasyon@abccafe.com',
      phone: '0532 100 00 04',
      role: 'Operasyon',
      status: 'Aktif',
      lastLogin: '',
      createdAt: now,
      updatedAt: now
    }),
    normalizeCompanyUser({
      id: 'company_user_lezzet_owner_demo',
      companyId: 'company_ornek_isletme_demo',
      fullName: 'Firma Sahibi',
      username: 'lezzet.sahip',
      email: 'sahip@ornekisletme.com',
      phone: '0532 200 00 01',
      role: 'Firma Sahibi',
      status: 'Aktif',
      lastLogin: today.toLocaleDateString('sv-SE'),
      createdAt: now,
      updatedAt: now
    }),
    normalizeCompanyUser({
      id: 'company_user_lezzet_yonetici_demo',
      companyId: 'company_ornek_isletme_demo',
      fullName: 'Yönetici',
      username: 'lezzet.yonetici',
      email: 'yonetici@ornekisletme.com',
      phone: '0532 200 00 02',
      role: 'Yönetici',
      status: 'Aktif',
      lastLogin: yesterday.toLocaleDateString('sv-SE'),
      createdAt: now,
      updatedAt: now
    }),
    normalizeCompanyUser({
      id: 'company_user_lezzet_muhasebe_demo',
      companyId: 'company_ornek_isletme_demo',
      fullName: 'Muhasebe',
      username: 'lezzet.muhasebe',
      email: 'muhasebe@ornekisletme.com',
      phone: '0532 200 00 03',
      role: 'Muhasebe',
      status: 'Aktif',
      lastLogin: lastMonth.toLocaleDateString('sv-SE'),
      createdAt: now,
      updatedAt: now
    })
  ]
}

const normalizeLicenseModuleKey = (value: unknown): LicenseModuleKey => {
  const key = String(value || '').trim() as LicenseModuleKey
  return LICENSE_MODULE_CATALOG.some(module => module.key === key) ? key : 'task-management'
}

const normalizeLicenseStatus = (value: unknown): LicenseStatus => {
  const status = String(value || '').trim()
  if(status === 'Askıda') return 'Askıya Alındı'
  if(status === 'İptal') return 'İptal Edildi'

  return LICENSE_STATUSES.includes(status as LicenseStatus)
    ? status as LicenseStatus
    : 'Deneme'
}

const normalizeLicenseLimit = (value: unknown, fallback = 0) => {
  const limit = Number(value)
  if(!Number.isFinite(limit)) return fallback
  return Math.max(0, Math.round(limit))
}

const normalizeLicensePrice = (value: unknown) => {
  const price = Number(value)
  return Number.isFinite(price) ? Math.max(0, Math.round((price + Number.EPSILON) * 100) / 100) : 0
}

const normalizeLicenseCount = (value: unknown, fallback = 0) => {
  const count = Number(value)
  if(!Number.isFinite(count)) return fallback
  return Math.max(0, Math.round(count))
}

const normalizeLicenseDateKey = (value: unknown, fallbackDate = new Date()) => {
  const raw = String(value || '').trim()
  if(/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const date = raw ? new Date(raw) : fallbackDate
  if(Number.isNaN(date.getTime())) return fallbackDate.toLocaleDateString('sv-SE')
  return date.toLocaleDateString('sv-SE')
}

const addLicenseDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00`)
  if(Number.isNaN(date.getTime())) return normalizeLicenseDateKey(new Date())
  date.setDate(date.getDate() + days)
  return date.toLocaleDateString('sv-SE')
}

const getLicenseDaysUntil = (dateKey: string, referenceDate = new Date()) => {
  const target = new Date(`${dateKey}T12:00:00`)
  const reference = new Date(referenceDate)
  reference.setHours(12, 0, 0, 0)
  if(Number.isNaN(target.getTime()) || Number.isNaN(reference.getTime())) return 0
  return Math.ceil((target.getTime() - reference.getTime()) / 86400000)
}

const createLicenseKey = (companyId: string, packageId: string, seed = Date.now()) => {
  const companyPart = (companyId || 'company').replace(/[^a-z0-9]/gi, '').slice(-6).toLocaleUpperCase('tr-TR') || 'COMP'
  const packagePart = (packageId || 'package').replace(/[^a-z0-9]/gi, '').slice(-4).toLocaleUpperCase('tr-TR') || 'PKG'
  const seedPart = Math.abs(Math.round(Number(seed) || Date.now())).toString(36).toLocaleUpperCase('tr-TR').slice(-6).padStart(6, '0')
  return `RA-${companyPart}-${packagePart}-${seedPart}`
}

const getLicenseModuleName = (moduleKey: LicenseModuleKey) => {
  return LICENSE_MODULE_CATALOG.find(module => module.key === moduleKey)?.name || 'Görev Yönetimi'
}

const normalizeLicensePackage = (item: Partial<LicensePackage>): LicensePackage => {
  const timestamp = item.createdAt || new Date().toISOString()
  const legacyItem = item as Partial<LicensePackage> & {
    priceMonthly?: unknown
    priceYearly?: unknown
  }

  return {
    id: String(item.id || `license_package_${Date.now()}`),
    name: String(item.name || 'Yeni Paket').trim() || 'Yeni Paket',
    description: String(item.description || '').trim(),
    monthlyPrice: normalizeLicensePrice(item.monthlyPrice ?? legacyItem.priceMonthly),
    yearlyPrice: normalizeLicensePrice(item.yearlyPrice ?? legacyItem.priceYearly),
    maxUsers: normalizeLicenseLimit(item.maxUsers),
    maxBranches: normalizeLicenseLimit(item.maxBranches),
    maxTables: normalizeLicenseLimit(item.maxTables),
    maxStorageGB: normalizeLicenseCount(item.maxStorageGB),
    trialDays: normalizeLicenseCount(item.trialDays, 14),
    isActive: item.isActive !== false,
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeLicenseModule = (item: Partial<LicenseModule>): LicenseModule => {
  const timestamp = item.createdAt || new Date().toISOString()
  const moduleKey = normalizeLicenseModuleKey(item.moduleKey)

  return {
    id: String(item.id || `license_module_${Date.now()}_${moduleKey}`),
    packageId: String(item.packageId || ''),
    moduleKey,
    moduleName: String(item.moduleName || getLicenseModuleName(moduleKey)).trim() || getLicenseModuleName(moduleKey),
    enabled: item.enabled === true,
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const normalizeCompanyLicense = (item: Partial<CompanyLicense>): CompanyLicense => {
  const timestamp = item.createdAt || new Date().toISOString()
  const legacyItem = item as Partial<CompanyLicense> & {
    licenseStartDate?: unknown
    licenseEndDate?: unknown
  }
  const startDate = normalizeLicenseDateKey(item.startDate ?? legacyItem.licenseStartDate, new Date(timestamp))
  const trialEndDate = normalizeLicenseDateKey(item.trialEndDate || addLicenseDays(startDate, 14), new Date(`${startDate}T12:00:00`))
  const endDate = normalizeLicenseDateKey(item.endDate ?? legacyItem.licenseEndDate ?? (item.isTrial ? trialEndDate : addLicenseDays(startDate, 365)), new Date(`${startDate}T12:00:00`))
  const isTrial = item.isTrial === true
  const companyId = String(item.companyId || '')
  const packageId = String(item.packageId || '')

  return {
    id: String(item.id || `company_license_${Date.now()}`),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForCompany(companyId),
    companyId,
    packageId,
    licenseKey: String(item.licenseKey || createLicenseKey(companyId, packageId, new Date(timestamp).getTime())).trim(),
    status: normalizeLicenseStatus(item.status || (isTrial ? 'Deneme' : 'Aktif')),
    startDate,
    endDate,
    isTrial,
    trialEndDate: isTrial ? trialEndDate : String(item.trialEndDate || '').trim(),
    lastRenewalDate: String(item.lastRenewalDate || '').trim(),
    nextRenewalDate: String(item.nextRenewalDate || endDate).trim(),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

export const getCompanyLicenseRuntimeStatus = (license: CompanyLicense, referenceDate = new Date()): LicenseStatus => {
  if(license.status === 'Askıya Alındı' || license.status === 'İptal Edildi') return license.status

  const todayKey = referenceDate.toLocaleDateString('sv-SE')
  const trialEndDate = String(license.trialEndDate || '').trim()
  const licenseEndDate = String(license.endDate || '').trim()
  const activeEndDate = license.isTrial ? trialEndDate || licenseEndDate : licenseEndDate

  if(activeEndDate && activeEndDate < todayKey) return 'Süresi Doldu'
  if(license.isTrial || license.status === 'Deneme') return 'Deneme'
  if(license.status === 'Süresi Doldu') return 'Süresi Doldu'
  if(activeEndDate && getLicenseDaysUntil(activeEndDate, referenceDate) <= 30) return 'Süresi Yaklaşıyor'
  return 'Aktif'
}

const normalizeCompanyLicenseWithRuntimeStatus = (item: Partial<CompanyLicense>) => {
  const license = normalizeCompanyLicense(item)
  return {
    ...license,
    status: getCompanyLicenseRuntimeStatus(license)
  }
}

const defaultPackageSpecs: Array<{
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
  enabledModules: LicenseModuleKey[]
}> = [
  {
    id: 'license_package_ucretsiz',
    name: 'Ücretsiz',
    description: 'Tek şube ve temel adisyon kullanımı için ücretsiz başlangıç paketi.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxUsers: 1,
    maxBranches: 1,
    maxTables: 10,
    maxStorageGB: 1,
    trialDays: 0,
    enabledModules: ['adisyon']
  },
  {
    id: 'license_package_baslangic',
    name: 'Başlangıç',
    description: 'Küçük işletmeler için temel adisyon ve QR menü paketi.',
    monthlyPrice: 999,
    yearlyPrice: 9990,
    maxUsers: 3,
    maxBranches: 1,
    maxTables: 25,
    maxStorageGB: 5,
    trialDays: 14,
    enabledModules: ['adisyon', 'qr-menu']
  },
  {
    id: 'license_package_pro',
    name: 'Pro',
    description: 'Stok, cari ve finans takibi bulunan büyüyen işletme paketi.',
    monthlyPrice: 2499,
    yearlyPrice: 24990,
    maxUsers: 10,
    maxBranches: 3,
    maxTables: 100,
    maxStorageGB: 25,
    trialDays: 14,
    enabledModules: ['adisyon', 'qr-menu', 'stock', 'recipe', 'current', 'credit', 'finance', 'personnel']
  },
  {
    id: 'license_package_premium',
    name: 'Premium',
    description: 'Patron dashboard, çoklu şube ve analitik modüllerini içeren kapsamlı paket.',
    monthlyPrice: 4999,
    yearlyPrice: 49990,
    maxUsers: 25,
    maxBranches: 10,
    maxTables: 0,
    maxStorageGB: 100,
    trialDays: 14,
    enabledModules: ['adisyon', 'qr-menu', 'stock', 'recipe', 'current', 'credit', 'finance', 'personnel', 'boss-dashboard', 'multi-branch', 'analytics']
  },
  {
    id: 'license_package_kurumsal',
    name: 'Kurumsal',
    description: 'Sınırsız kullanım ve tüm modüller için kurumsal lisans.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    maxUsers: 0,
    maxBranches: 0,
    maxTables: 0,
    maxStorageGB: 0,
    trialDays: 30,
    enabledModules: LICENSE_MODULE_CATALOG.map(module => module.key)
  }
]

const createDemoLicensePackages = (now = new Date().toISOString()): LicensePackage[] => {
  return defaultPackageSpecs.map(spec => normalizeLicensePackage({
    id: spec.id,
    name: spec.name,
    description: spec.description,
    monthlyPrice: spec.monthlyPrice,
    yearlyPrice: spec.yearlyPrice,
    maxUsers: spec.maxUsers,
    maxBranches: spec.maxBranches,
    maxTables: spec.maxTables,
    maxStorageGB: spec.maxStorageGB,
    trialDays: spec.trialDays,
    isActive: true,
    createdAt: now,
    updatedAt: now
  }))
}

const createDemoLicenseModules = (packages = createDemoLicensePackages(), now = new Date().toISOString()): LicenseModule[] => {
  const specMap = new Map(defaultPackageSpecs.map(spec => [spec.id, spec]))

  return packages.flatMap(packageItem => {
    const spec = specMap.get(packageItem.id)
    const enabledModules = new Set(spec?.enabledModules || [])

    return LICENSE_MODULE_CATALOG.map(module => normalizeLicenseModule({
      id: `license_module_${packageItem.id}_${module.key}`,
      packageId: packageItem.id,
      moduleKey: module.key,
      moduleName: module.name,
      enabled: enabledModules.has(module.key),
      createdAt: now,
      updatedAt: now
    }))
  })
}

const createDemoCompanyLicenses = (now = new Date().toISOString()): CompanyLicense[] => {
  const paidStartDate = new Date(now)
  paidStartDate.setDate(paidStartDate.getDate() - 30)
  const paidEndDate = new Date(paidStartDate)
  paidEndDate.setFullYear(paidEndDate.getFullYear() + 1)
  const trialStartDate = new Date(now)
  trialStartDate.setDate(trialStartDate.getDate() - 3)
  const trialEndDate = new Date(trialStartDate)
  trialEndDate.setDate(trialEndDate.getDate() + 14)

  return [
    normalizeCompanyLicense({
      id: 'company_license_abc_cafe_demo',
      companyId: 'company_abc_cafe_demo',
      packageId: 'license_package_baslangic',
      licenseKey: 'RA-ABCCFE-BASL-DEMO01',
      startDate: paidStartDate.toLocaleDateString('sv-SE'),
      endDate: paidEndDate.toLocaleDateString('sv-SE'),
      status: 'Aktif',
      isTrial: false,
      trialEndDate: '',
      lastRenewalDate: paidStartDate.toLocaleDateString('sv-SE'),
      nextRenewalDate: paidEndDate.toLocaleDateString('sv-SE'),
      createdAt: now,
      updatedAt: now
    }),
    normalizeCompanyLicense({
      id: 'company_license_ornek_isletme_demo',
      companyId: 'company_ornek_isletme_demo',
      packageId: 'license_package_pro',
      licenseKey: 'RA-LEZZET-PRO-DEMO02',
      startDate: paidStartDate.toLocaleDateString('sv-SE'),
      endDate: paidEndDate.toLocaleDateString('sv-SE'),
      status: 'Aktif',
      isTrial: false,
      trialEndDate: '',
      lastRenewalDate: paidStartDate.toLocaleDateString('sv-SE'),
      nextRenewalDate: paidEndDate.toLocaleDateString('sv-SE'),
      createdAt: now,
      updatedAt: now
    }),
    normalizeCompanyLicense({
      id: 'company_license_kahve_duragi_demo',
      companyId: 'company_kahve_duragi_demo',
      packageId: 'license_package_premium',
      licenseKey: 'RA-KAHVE-PREM-DEMO03',
      startDate: trialStartDate.toLocaleDateString('sv-SE'),
      endDate: trialEndDate.toLocaleDateString('sv-SE'),
      status: 'Deneme',
      isTrial: true,
      trialEndDate: trialEndDate.toLocaleDateString('sv-SE'),
      lastRenewalDate: '',
      nextRenewalDate: trialEndDate.toLocaleDateString('sv-SE'),
      createdAt: now,
      updatedAt: now
    })
  ]
}

const createDemoUserSubscriptions = (
  companyLicenses = createDemoCompanyLicenses(),
  now = new Date().toISOString()
): UserSubscription[] => {
  const licenseMap = new Map(companyLicenses.map(license => [license.id, license]))
  const subscriptionRows: Array<Partial<UserSubscription>> = [
    {
      id: 'user_subscription_abc_admin_demo',
      userId: 'company_user_abc_admin_demo',
      companyLicenseId: 'company_license_abc_cafe_demo',
      status: 'Aktif'
    },
    {
      id: 'user_subscription_abc_personel_1_demo',
      userId: 'company_user_abc_personel_1_demo',
      companyLicenseId: 'company_license_abc_cafe_demo',
      status: 'Aktif'
    },
    {
      id: 'user_subscription_abc_personel_2_demo',
      userId: 'company_user_abc_personel_2_demo',
      companyLicenseId: 'company_license_abc_cafe_demo',
      status: 'Aktif'
    },
    {
      id: 'user_subscription_abc_operasyon_demo',
      userId: 'company_user_abc_operasyon_demo',
      companyLicenseId: 'company_license_abc_cafe_demo',
      status: 'Beklemede'
    },
    {
      id: 'user_subscription_lezzet_owner_demo',
      userId: 'company_user_lezzet_owner_demo',
      companyLicenseId: 'company_license_ornek_isletme_demo',
      status: 'Aktif'
    },
    {
      id: 'user_subscription_lezzet_yonetici_demo',
      userId: 'company_user_lezzet_yonetici_demo',
      companyLicenseId: 'company_license_ornek_isletme_demo',
      status: 'Aktif'
    },
    {
      id: 'user_subscription_lezzet_muhasebe_demo',
      userId: 'company_user_lezzet_muhasebe_demo',
      companyLicenseId: 'company_license_ornek_isletme_demo',
      status: 'Aktif'
    }
  ]

  return subscriptionRows.map(row => {
    const license = row.companyLicenseId ? licenseMap.get(row.companyLicenseId) : undefined
    return normalizeUserSubscription({
      ...row,
      assignedAt: license?.startDate || new Date(now).toLocaleDateString('sv-SE'),
      expiresAt: license ? getLicenseDeadline(license) : '',
      createdAt: now,
      updatedAt: now
    })
  })
}

const normalizePlatformModuleStatus = (item: Partial<PlatformModuleStatus>): PlatformModuleStatus => {
  const timestamp = item.createdAt || new Date().toISOString()
  const moduleKey = LICENSE_MODULE_CATALOG.some(module => module.key === item.moduleKey)
    ? item.moduleKey as LicenseModuleKey
    : 'adisyon'
  const catalogItem = LICENSE_MODULE_CATALOG.find(module => module.key === moduleKey)

  return {
    id: String(item.id || `platform_module_${moduleKey}`),
    moduleKey,
    moduleName: String(item.moduleName || catalogItem?.name || 'Adisyon').trim() || catalogItem?.name || 'Adisyon',
    active: item.active !== false,
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const createDefaultPlatformModules = (now = new Date().toISOString()): PlatformModuleStatus[] => {
  return LICENSE_MODULE_CATALOG.map(module => normalizePlatformModuleStatus({
    id: `platform_module_${module.key}`,
    moduleKey: module.key,
    moduleName: module.name,
    active: true,
    createdAt: now,
    updatedAt: now
  }))
}

const normalizePlatformSupportTicketStatus = (value: unknown): PlatformSupportTicketStatus => {
  return PLATFORM_SUPPORT_TICKET_STATUSES.includes(value as PlatformSupportTicketStatus)
    ? value as PlatformSupportTicketStatus
    : 'Açık'
}

const normalizePlatformSupportTicketPriority = (value: unknown): PlatformSupportTicket['priority'] => {
  return value === 'Düşük' || value === 'Yüksek' ? value : 'Orta'
}

const normalizePlatformSupportTicket = (item: Partial<PlatformSupportTicket>): PlatformSupportTicket => {
  const timestamp = item.createdAt || new Date().toISOString()
  const companyId = String(item.companyId || '').trim()

  return {
    id: String(item.id || `platform_support_ticket_${Date.now()}`),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForCompany(companyId),
    companyId,
    subject: String(item.subject || 'Destek talebi').trim() || 'Destek talebi',
    message: String(item.message || '').trim(),
    status: normalizePlatformSupportTicketStatus(item.status),
    priority: normalizePlatformSupportTicketPriority(item.priority),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const createDemoPlatformSupportTickets = (now = new Date().toISOString()): PlatformSupportTicket[] => {
  const firstDate = new Date(now)
  firstDate.setDate(firstDate.getDate() - 2)
  const secondDate = new Date(now)
  secondDate.setDate(secondDate.getDate() - 5)

  return [
    normalizePlatformSupportTicket({
      id: 'platform_support_ticket_abc_demo',
      companyId: 'company_abc_cafe_demo',
      subject: 'QR menü güncelleme kontrolü',
      message: 'ABC Cafe menü görsellerinin mobilde daha hızlı açılması için destek istiyor.',
      status: 'Açık',
      priority: 'Orta',
      createdAt: firstDate.toISOString(),
      updatedAt: firstDate.toISOString()
    }),
    normalizePlatformSupportTicket({
      id: 'platform_support_ticket_lezzet_demo',
      companyId: 'company_ornek_isletme_demo',
      subject: 'Çoklu şube raporu',
      message: 'Örnek İşletme şube raporunda tarih filtresi doğrulaması istedi.',
      status: 'İnceleniyor',
      priority: 'Yüksek',
      createdAt: secondDate.toISOString(),
      updatedAt: secondDate.toISOString()
    })
  ]
}

const normalizePlatformSettings = (item: Partial<PlatformSettings>): PlatformSettings => {
  const timestamp = item.createdAt || new Date().toISOString()

  return {
    id: String(item.id || 'platform_settings_default'),
    defaultCurrency: String(item.defaultCurrency || 'TRY').trim().toLocaleUpperCase('tr-TR') || 'TRY',
    defaultLanguage: String(item.defaultLanguage || 'tr-TR').trim() || 'tr-TR',
    maintenanceMode: item.maintenanceMode === true,
    defaultTheme: String(item.defaultTheme || 'EVREN360').trim() || 'EVREN360',
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

const createDefaultPlatformSettings = (now = new Date().toISOString()): PlatformSettings => normalizePlatformSettings({
  id: 'platform_settings_default',
  defaultCurrency: 'TRY',
  defaultLanguage: 'tr-TR',
  maintenanceMode: false,
  defaultTheme: 'EVREN360',
  createdAt: now,
  updatedAt: now
})

const normalizeActionLog = (item: Partial<ActionLog>): ActionLog => {
  const timestamp = item.timestamp || new Date().toISOString()
  const date = item.date || new Date(timestamp).toLocaleDateString('sv-SE')
  const time = item.time || new Date(timestamp).toLocaleTimeString('tr-TR', { hour12: false })

  return {
    id: String(item.id || `log_${Date.now()}`),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForRecord(item, { users: readUsersForTenantContext() }),
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

const normalizeSystemUsageModuleName = (value: unknown): SystemUsageModuleName => {
  return SYSTEM_USAGE_MODULE_NAMES.includes(value as SystemUsageModuleName)
    ? value as SystemUsageModuleName
    : 'Sistem'
}

const normalizeSystemUsageActionType = (value: unknown): SystemUsageActionType => {
  return SYSTEM_USAGE_ACTION_TYPES.includes(value as SystemUsageActionType)
    ? value as SystemUsageActionType
    : 'Güncelleme'
}

const normalizeSystemUsageLog = (item: Partial<SystemUsageLog>): SystemUsageLog => ({
  id: String(item.id || `system_usage_${Date.now()}`),
  tenantId: String(item.tenantId || '').trim() || resolveTenantIdForRecord(item, { users: readUsersForTenantContext() }),
  userId: String(item.userId || ''),
  userName: String(item.userName || 'Bilinmeyen Kullanıcı'),
  branchId: String(item.branchId || DEFAULT_BRANCH_ID),
  moduleName: normalizeSystemUsageModuleName(item.moduleName),
  actionType: normalizeSystemUsageActionType(item.actionType),
  entityType: String(item.entityType || ''),
  entityId: String(item.entityId || ''),
  description: String(item.description || ''),
  ipAddress: String(item.ipAddress || ''),
  deviceInfo: String(item.deviceInfo || ''),
  createdAt: item.createdAt || new Date().toISOString()
})

const normalizeUsageText = (value: string) => value.toLocaleLowerCase('tr-TR')

const actionTextHas = (text: string, keywords: string[]) => {
  return keywords.some(keyword => text.includes(keyword))
}

const inferSystemUsageModuleName = (operationType: ActionLogType): SystemUsageModuleName => {
  const text = normalizeUsageText(operationType)

  if(actionTextHas(text, ['şube', 'transfer', 'yetkisi', 'şubeye'])) return 'Çoklu Şube Yönetimi'
  if(actionTextHas(text, ['personel', 'vardiya', 'puantaj', 'performans', 'prim', 'denetim'])) return 'Personel Yönetimi'
  if(actionTextHas(text, ['tedarikçi', 'kasa', 'gelir', 'gider'])) return 'Finans Yönetimi'
  if(actionTextHas(text, ['cari', 'veresiye', 'tahsilat'])) return 'Cari Yönetimi'
  if(actionTextHas(text, ['stok', 'skt', 'fire', 'kayıp', 'maliyet', 'alış'])) return 'Stok Yönetimi'
  if(actionTextHas(text, ['üretim tanımı', 'reçete'])) return 'Üretim Tanımı'
  if(actionTextHas(text, ['ürün', 'hizmet', 'kategori'])) return 'Ürün / Hizmet Yönetimi'
  if(text.startsWith('alan ') || (text.startsWith('masa ') && actionTextHas(text, ['oluşturuldu', 'silindi', 'adı değiştirildi', 'taşındı', 'birleştirildi']))) return 'Alan Yönetimi'
  if(actionTextHas(text, ['alan', 'masa', 'sipariş', 'talep', 'hesap', 'ikram', 'indirim', 'qr', 'görevli', 'garson'])) return 'İşlem Yönetimi'
  if(actionTextHas(text, ['modül', 'lisans erişim'])) return 'Sistem'
  if(actionTextHas(text, ['kullanıcı', 'giriş', 'çıkış', 'sistem'])) return 'Sistem'
  return 'Sistem'
}

const inferSystemUsageActionType = (operationType: ActionLogType): SystemUsageActionType => {
  const text = normalizeUsageText(operationType)

  if(actionTextHas(text, ['giriş'])) return 'Giriş Yapma'
  if(actionTextHas(text, ['çıkış'])) return 'Çıkış Yapma'
  if(actionTextHas(text, ['silindi', 'silme'])) return 'Silme'
  if(actionTextHas(text, ['onaylandı', 'onaylama'])) return 'Onaylama'
  if(actionTextHas(text, ['iptal', 'reddedildi'])) return 'İptal Etme'
  if(actionTextHas(text, ['oluşturuldu', 'eklendi', 'girildi', 'açıldı', 'çağrıldı'])) return 'Oluşturma'
  if(actionTextHas(text, ['güncellendi', 'değiştirildi', 'aktif', 'pasif', 'kapatıldı', 'hazır', 'taşındı', 'birleştirildi', 'artırıldı', 'azaltıldı', 'uygulandı', 'kaldırıldı', 'ödendi', 'tamamlandı', 'tüketildi', 'iade', 'terslendi', 'düşüldü'])) return 'Güncelleme'
  return 'Güncelleme'
}

const inferSystemUsageEntityType = (operationType: ActionLogType) => {
  const text = normalizeUsageText(operationType)

  if(actionTextHas(text, ['şube yetkisi'])) return 'Şube Yetkisi'
  if(actionTextHas(text, ['şube', 'transfer'])) return 'Şube'
  if(actionTextHas(text, ['personel'])) return 'Personel'
  if(actionTextHas(text, ['vardiya'])) return 'Vardiya'
  if(actionTextHas(text, ['puantaj'])) return 'Puantaj'
  if(actionTextHas(text, ['performans'])) return 'Performans'
  if(actionTextHas(text, ['prim'])) return 'Prim'
  if(actionTextHas(text, ['denetim'])) return 'Denetim'
  if(actionTextHas(text, ['tedarikçi'])) return 'Tedarikçi'
  if(actionTextHas(text, ['kasa'])) return 'Kasa'
  if(actionTextHas(text, ['gelir', 'gider'])) return 'Gelir/Gider'
  if(actionTextHas(text, ['cari'])) return 'Cari'
  if(actionTextHas(text, ['veresiye'])) return 'Veresiye'
  if(actionTextHas(text, ['tahsilat'])) return 'Tahsilat'
  if(actionTextHas(text, ['stok', 'skt', 'fire'])) return 'Stok'
  if(actionTextHas(text, ['üretim tanımı', 'reçete'])) return 'Üretim Tanımı'
  if(actionTextHas(text, ['ürün'])) return 'Ürün'
  if(actionTextHas(text, ['kategori'])) return 'Kategori'
  if(actionTextHas(text, ['masa'])) return 'Masa'
  if(actionTextHas(text, ['sipariş', 'qr'])) return 'Sipariş'
  if(actionTextHas(text, ['modül'])) return 'Modül'
  if(actionTextHas(text, ['lisans'])) return 'Lisans'
  if(actionTextHas(text, ['kullanıcı'])) return 'Kullanıcı'
  return 'Kayıt'
}

const createSystemUsageLogFromActionLog = (log: ActionLog): SystemUsageLog => normalizeSystemUsageLog({
  id: `usage_${log.id}`,
  userId: log.userId,
  userName: log.userName,
  branchId: DEFAULT_BRANCH_ID,
  moduleName: inferSystemUsageModuleName(log.operationType),
  actionType: inferSystemUsageActionType(log.operationType),
  entityType: inferSystemUsageEntityType(log.operationType),
  entityId: log.tableId || log.id,
  description: log.description || log.operationType,
  ipAddress: '',
  deviceInfo: 'ActionHistory aktarımı',
  createdAt: log.timestamp
})

export const loadProducts = (): Product[] => {
  const categories = loadCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_CATEGORY_ID
  return loadBranchScopedItems(KEY_PRODUCTS, item => normalizeProduct(item, fallbackCategoryId))
}

export const loadProductNutritionAllergenData = () => {
  return loadProducts().map(product => ({
    id: product.id,
    tenantId: product.tenantId,
    branchId: product.branchId,
    name: product.name,
    categoryId: product.categoryId,
    calories: product.calories,
    protein: product.protein,
    carbohydrate: product.carbohydrate,
    fat: product.fat,
    fiber: product.fiber,
    sugar: product.sugar,
    salt: product.salt,
    servingSize: product.servingSize,
    allergens: product.allergens
  }))
}

export const saveProducts = (items: Product[]) => {
  const categories = loadCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_CATEGORY_ID
  saveBranchScopedItems(KEY_PRODUCTS, items, item => normalizeProduct(item, fallbackCategoryId))
}

export const loadCurrentAccounts = (): CurrentAccount[] => {
  return loadBranchScopedItemsWithDemo(KEY_CURRENT_ACCOUNTS, createDemoCurrentAccounts, normalizeCurrentAccount)
}

export const saveCurrentAccounts = (items: CurrentAccount[]) => {
  saveBranchScopedItems(KEY_CURRENT_ACCOUNTS, items, normalizeCurrentAccount)
}

export const loadCreditTransactions = (): CreditTransaction[] => {
  return loadBranchScopedItemsWithDemo(KEY_CREDIT_TRANSACTIONS, createDemoCreditTransactions, normalizeCreditTransaction)
}

export const saveCreditTransactions = (items: CreditTransaction[]) => {
  saveBranchScopedItems(KEY_CREDIT_TRANSACTIONS, items, normalizeCreditTransaction)
}

export const loadSupplierDebts = (): SupplierDebt[] => {
  return loadBranchScopedItemsWithDemo(KEY_SUPPLIER_DEBTS, createDemoSupplierDebts, normalizeSupplierDebt)
}

export const saveSupplierDebts = (items: SupplierDebt[]) => {
  saveBranchScopedItems(KEY_SUPPLIER_DEBTS, items, normalizeSupplierDebt)
}

export const loadSupplierPayments = (): SupplierPayment[] => {
  return loadBranchScopedItemsWithDemo(KEY_SUPPLIER_PAYMENTS, createDemoSupplierPayments, normalizeSupplierPayment)
}

export const saveSupplierPayments = (items: SupplierPayment[]) => {
  saveBranchScopedItems(KEY_SUPPLIER_PAYMENTS, items, normalizeSupplierPayment)
}

export const loadCashTransactions = (): CashTransaction[] => {
  return loadBranchScopedItems(KEY_CASH_TRANSACTIONS, normalizeCashTransaction)
}

export const saveCashTransactions = (items: CashTransaction[]) => {
  saveBranchScopedItems(KEY_CASH_TRANSACTIONS, items, normalizeCashTransaction)
}

export const loadIncomeExpenses = (): IncomeExpense[] => {
  return loadBranchScopedItemsWithDemo(KEY_INCOME_EXPENSES, createDemoIncomeExpenses, normalizeIncomeExpense)
}

export const saveIncomeExpenses = (items: IncomeExpense[]) => {
  saveBranchScopedItems(KEY_INCOME_EXPENSES, items, normalizeIncomeExpense)
}

export const loadCashClosings = (): CashClosing[] => {
  return loadBranchScopedItems(KEY_CASH_CLOSINGS, normalizeCashClosing)
}

export const saveCashClosings = (items: CashClosing[]) => {
  saveBranchScopedItems(KEY_CASH_CLOSINGS, items, normalizeCashClosing)
}

export const loadCashTransfers = (): CashTransfer[] => {
  return loadBranchScopedItemsWithDemo(KEY_CASH_TRANSFERS, createDemoCashTransfers, normalizeCashTransfer)
}

export const saveCashTransfers = (items: CashTransfer[]) => {
  saveBranchScopedItems(KEY_CASH_TRANSFERS, items, normalizeCashTransfer)
}

export const loadCollectionTransactions = (): CollectionTransaction[] => {
  return loadBranchScopedItemsWithDemo(KEY_COLLECTION_TRANSACTIONS, createDemoCollectionTransactions, normalizeCollectionTransaction)
}

export const saveCollectionTransactions = (items: CollectionTransaction[]) => {
  saveBranchScopedItems(KEY_COLLECTION_TRANSACTIONS, items, normalizeCollectionTransaction)
}

export const loadCategories = (): ProductCategory[] => {
  const stored = readJson<Partial<ProductCategory>[]>(KEY_CATEGORIES, [])
  const categories = stored.map(normalizeCategory)
  const currentUser = getCurrentUser()
  const visibleCategories = currentUser ? filterTenantScope(categories, currentUser) : categories

  if(!visibleCategories.find(c => c.id === DEFAULT_CATEGORY_ID)){
    visibleCategories.unshift(addTenantScope(createDefaultCategory(), currentUser))
  }

  return visibleCategories
}

export const saveCategories = (items: ProductCategory[]) => {
  const currentUser = getCurrentUser()
  const categories = items.map(item => addTenantScope(normalizeCategory(item), currentUser))

  if(!categories.find(c => c.id === DEFAULT_CATEGORY_ID)){
    categories.unshift(addTenantScope(createDefaultCategory(), currentUser))
  }

  const tenantIds = new Set(categories.map(category => category.tenantId || ''))
  const preservedCategories = readJson<Partial<ProductCategory>[]>(KEY_CATEGORIES, [])
    .map(normalizeCategory)
    .filter(category => !tenantIds.has(category.tenantId || ''))

  localStorage.setItem(KEY_CATEGORIES, JSON.stringify([...categories, ...preservedCategories]))
}

export const loadStockCategories = (): StockCategory[] => {
  const stored = readJson<Partial<StockCategory>[]>(KEY_STOCK_CATEGORIES, [])
  const categories = stored.map(normalizeStockCategory)
  const currentUser = getCurrentUser()
  const visibleCategories = currentUser ? filterTenantScope(categories, currentUser) : categories

  if(!visibleCategories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)){
    visibleCategories.unshift(addTenantScope(createDefaultStockCategory(), currentUser))
  }

  return visibleCategories
}

export const saveStockCategories = (items: StockCategory[]) => {
  const currentUser = getCurrentUser()
  const categories = items.map(item => addTenantScope(normalizeStockCategory(item), currentUser))

  if(!categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)){
    categories.unshift(addTenantScope(createDefaultStockCategory(), currentUser))
  }

  const tenantIds = new Set(categories.map(category => category.tenantId || ''))
  const preservedCategories = readJson<Partial<StockCategory>[]>(KEY_STOCK_CATEGORIES, [])
    .map(normalizeStockCategory)
    .filter(category => !tenantIds.has(category.tenantId || ''))

  localStorage.setItem(KEY_STOCK_CATEGORIES, JSON.stringify([...categories, ...preservedCategories]))
}

export const loadStockItems = (): StockItem[] => {
  const categories = loadStockCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_STOCK_CATEGORY_ID
  return loadBranchScopedItems(KEY_STOCK_ITEMS, item => normalizeStockItem(item, fallbackCategoryId))
}

export const loadAllStockItems = (): StockItem[] => {
  const categories = loadStockCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_STOCK_CATEGORY_ID
  return loadAllBranchScopedItems<StockItem>(KEY_STOCK_ITEMS, item => normalizeStockItem(item, fallbackCategoryId))
}

export const saveStockItems = (items: StockItem[]) => {
  const categories = loadStockCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_STOCK_CATEGORY_ID
  saveBranchScopedItems(KEY_STOCK_ITEMS, items, item => normalizeStockItem(item, fallbackCategoryId))
}

export const saveAllStockItems = (items: StockItem[]) => {
  const categories = loadStockCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_STOCK_CATEGORY_ID
  saveAllBranchScopedItems(KEY_STOCK_ITEMS, items, item => normalizeStockItem(item, fallbackCategoryId))
}

export const loadStockMovements = (): StockMovement[] => {
  return loadBranchScopedItems(KEY_STOCK_MOVEMENTS, normalizeStockMovement)
}

export const saveStockMovements = (items: StockMovement[]) => {
  saveBranchScopedItems(KEY_STOCK_MOVEMENTS, items, normalizeStockMovement)
}

export const loadAllStockMovements = (): StockMovement[] => {
  return loadAllBranchScopedItems<StockMovement>(KEY_STOCK_MOVEMENTS, normalizeStockMovement)
}

export const saveAllStockMovements = (items: StockMovement[]) => {
  saveAllBranchScopedItems(KEY_STOCK_MOVEMENTS, items, normalizeStockMovement)
}

export const loadStockMovementAuditEvents = (): StockMovementAuditEvent[] => {
  return readJson<Partial<StockMovementAuditEvent>[]>(KEY_STOCK_MOVEMENT_AUDIT, []).map(normalizeStockMovementAuditEvent)
}

export const saveStockMovementAuditEvents = (items: StockMovementAuditEvent[]) => {
  localStorage.setItem(KEY_STOCK_MOVEMENT_AUDIT, JSON.stringify(items.map(normalizeStockMovementAuditEvent)))
}

export const addStockMovementAuditEvent = (event: StockMovementAuditEvent) => {
  saveStockMovementAuditEvents([event, ...loadStockMovementAuditEvents()])
}

export const loadCriticalStockEvents = (): CriticalStockEvent[] => {
  return readJson<Partial<CriticalStockEvent>[]>(KEY_CRITICAL_STOCK_EVENTS, []).map(normalizeCriticalStockEvent)
}

export const saveCriticalStockEvents = (items: CriticalStockEvent[]) => {
  localStorage.setItem(KEY_CRITICAL_STOCK_EVENTS, JSON.stringify(items.map(normalizeCriticalStockEvent)))
}

export const addCriticalStockEvent = (event: CriticalStockEvent) => {
  saveCriticalStockEvents([event, ...loadCriticalStockEvents()])
}

export const loadStockExpiryLots = (): StockExpiryLot[] => {
  return loadBranchScopedItems(KEY_STOCK_EXPIRY_LOTS, normalizeStockExpiryLot, lot => Boolean(lot.stockItemId))
}

export const saveStockExpiryLots = (items: StockExpiryLot[]) => {
  saveBranchScopedItems(KEY_STOCK_EXPIRY_LOTS, items, normalizeStockExpiryLot, lot => Boolean(lot.stockItemId))
}

export const loadStockExpiryEvents = (): StockExpiryEvent[] => {
  return readJson<Partial<StockExpiryEvent>[]>(KEY_STOCK_EXPIRY_EVENTS, []).map(normalizeStockExpiryEvent).filter(event => event.stockItemId)
}

export const saveStockExpiryEvents = (items: StockExpiryEvent[]) => {
  localStorage.setItem(KEY_STOCK_EXPIRY_EVENTS, JSON.stringify(items.map(normalizeStockExpiryEvent).filter(event => event.stockItemId)))
}

export const addStockExpiryEvent = (event: StockExpiryEvent) => {
  saveStockExpiryEvents([event, ...loadStockExpiryEvents()])
}

export const loadStockDeductionBatches = (): StockDeductionBatch[] => {
  return loadBranchScopedItems(KEY_STOCK_DEDUCTION_BATCHES, normalizeStockDeductionBatch)
}

export const saveStockDeductionBatches = (items: StockDeductionBatch[]) => {
  saveBranchScopedItems(KEY_STOCK_DEDUCTION_BATCHES, items, normalizeStockDeductionBatch)
}

export const addStockDeductionBatch = (batch: StockDeductionBatch) => {
  saveStockDeductionBatches([batch, ...loadStockDeductionBatches()])
}

export const loadStockDeductionAuditEvents = (): StockDeductionAuditEvent[] => {
  return readJson<Partial<StockDeductionAuditEvent>[]>(KEY_STOCK_DEDUCTION_AUDIT, []).map(normalizeStockDeductionAuditEvent)
}

export const saveStockDeductionAuditEvents = (items: StockDeductionAuditEvent[]) => {
  localStorage.setItem(KEY_STOCK_DEDUCTION_AUDIT, JSON.stringify(items.map(normalizeStockDeductionAuditEvent)))
}

export const addStockDeductionAuditEvent = (event: StockDeductionAuditEvent) => {
  saveStockDeductionAuditEvents([event, ...loadStockDeductionAuditEvents()])
}

export const loadStockWasteRecords = (): StockWasteRecord[] => {
  return loadBranchScopedItems(KEY_STOCK_WASTE_RECORDS, normalizeStockWasteRecord, record => Boolean(record.stockItemId && record.stockMovementId))
}

export const saveStockWasteRecords = (items: StockWasteRecord[]) => {
  saveBranchScopedItems(KEY_STOCK_WASTE_RECORDS, items, normalizeStockWasteRecord, record => Boolean(record.stockItemId && record.stockMovementId))
}

export const addStockWasteRecord = (record: StockWasteRecord) => {
  saveStockWasteRecords([record, ...loadStockWasteRecords()])
}

export const loadRecipes = (): Recipe[] => {
  return loadBranchScopedItems(KEY_RECIPES, normalizeRecipe)
}

export const saveRecipes = (items: Recipe[]) => {
  saveBranchScopedItems(KEY_RECIPES, items, normalizeRecipe)
}

export const loadRecipeAuditEvents = (): RecipeAuditEvent[] => {
  return readJson<Partial<RecipeAuditEvent>[]>(KEY_RECIPE_AUDIT_EVENTS, []).map(normalizeRecipeAuditEvent)
}

export const saveRecipeAuditEvents = (items: RecipeAuditEvent[]) => {
  localStorage.setItem(KEY_RECIPE_AUDIT_EVENTS, JSON.stringify(items.map(normalizeRecipeAuditEvent)))
}

export const addRecipeAuditEvent = (event: RecipeAuditEvent) => {
  saveRecipeAuditEvents([event, ...loadRecipeAuditEvents()])
}

export const loadTables = (): TableState[] => {
  return loadBranchScopedItems(KEY_TABLES, normalizeTableState)
}

export const saveTables = (items: TableState[]) => {
  saveBranchScopedItems(KEY_TABLES, items, normalizeTableState)
}

export const loadClosed = (): ClosedBill[] => {
  return loadBranchScopedItems(KEY_CLOSED, normalizeClosedBill)
}

export const saveClosed = (items: ClosedBill[]) => {
  saveBranchScopedItems(KEY_CLOSED, items, normalizeClosedBill)
}

export const loadKitchenOrders = (): KitchenOrder[] => {
  return loadBranchScopedItems(KEY_KITCHEN, normalizeKitchenOrder)
}

export const saveKitchenOrders = (items: KitchenOrder[]) => {
  saveBranchScopedItems(KEY_KITCHEN, items, normalizeKitchenOrder)
}

export const loadQRRequests = (): QRRequest[] => {
  return loadBranchScopedItems(KEY_QR_REQUESTS, normalizeQRRequest)
}

export const saveQRRequests = (items: QRRequest[]) => {
  saveBranchScopedItems(KEY_QR_REQUESTS, items, normalizeQRRequest)
}

export const loadQRRequestHistory = (): QRRequestHistory[] => {
  return loadBranchScopedItems(KEY_QR_REQUEST_HISTORY, normalizeQRRequestHistory)
}

export const saveQRRequestHistory = (items: QRRequestHistory[]) => {
  saveBranchScopedItems(KEY_QR_REQUEST_HISTORY, items, normalizeQRRequestHistory)
}

export const addQRRequestHistory = (item: QRRequestHistory) => {
  saveQRRequestHistory([item, ...loadQRRequestHistory()])
}

export const loadQRAuditEvents = (): QRAuditEvent[] => {
  return readJson<Partial<QRAuditEvent>[]>(KEY_QR_AUDIT_EVENTS, []).map(normalizeQRAuditEvent)
}

export const saveQRAuditEvents = (items: QRAuditEvent[]) => {
  localStorage.setItem(KEY_QR_AUDIT_EVENTS, JSON.stringify(items.map(normalizeQRAuditEvent)))
}

export const addQRAuditEvent = ({
  entityType,
  entityId,
  eventType,
  user,
  tableId,
  tableName,
  before,
  after,
  note
}: {
  entityType: AuditEntityType
  entityId: string
  eventType: AuditEventType
  user: User
  tableId?: string
  tableName?: string
  before?: unknown
  after?: unknown
  note?: string
}) => {
  const event: QRAuditEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    entityType,
    entityId,
    eventType,
    userId: user.id,
    userName: user.fullName || user.username,
    tableId,
    tableName,
    timestamp: new Date().toISOString(),
    before,
    after,
    note
  }

  saveQRAuditEvents([event, ...loadQRAuditEvents()])
}

export const loadWaiterCalls = (): WaiterCall[] => {
  return readJson<Partial<WaiterCall>[]>(KEY_WAITER_CALLS, []).map(normalizeWaiterCall).filter(call => call.tableId)
}

export const saveWaiterCalls = (items: WaiterCall[]) => {
  localStorage.setItem(KEY_WAITER_CALLS, JSON.stringify(items.map(normalizeWaiterCall).filter(call => call.tableId)))
}

export const loadWaiterCallHistory = (): WaiterCallHistory[] => {
  return readJson<Partial<WaiterCallHistory>[]>(KEY_WAITER_CALL_HISTORY, []).map(normalizeWaiterCallHistory)
}

export const saveWaiterCallHistory = (items: WaiterCallHistory[]) => {
  localStorage.setItem(KEY_WAITER_CALL_HISTORY, JSON.stringify(items.map(normalizeWaiterCallHistory)))
}

export const addWaiterCallHistory = (item: WaiterCallHistory) => {
  saveWaiterCallHistory([item, ...loadWaiterCallHistory()])
}

export const loadSettings = (): SystemSettings => {
  return normalizeSettings(readJson<Partial<SystemSettings>>(KEY_SETTINGS, DEFAULT_SETTINGS))
}

export const saveSettings = (settings: SystemSettings) => {
  localStorage.setItem(KEY_SETTINGS, JSON.stringify(normalizeSettings(settings)))
}

const normalizeUser = (item: Partial<User>): User => {
  const companyId = String(item.companyId || '').trim()
  const role = String(item.role || '').trim()

  return {
    id: String(item.id || `user_${Date.now()}`),
    tenantId: String(item.tenantId || '').trim() || resolveTenantIdForCompany(companyId),
    companyId: companyId || undefined,
    fullName: String(item.fullName || item.username || 'KullanÄ±cÄ±').trim() || 'KullanÄ±cÄ±',
    phone: String(item.phone || '').trim(),
    profilePhotoUrl: String(item.profilePhotoUrl || '').trim(),
    username: String(item.username || '').trim(),
    password: String(item.password || ''),
    role: role === 'Personel' || role === 'Garson' ? 'Personel' : 'Admin',
    active: item.active !== false
  }
}

export const loadUsers = (options: { allTenants?: boolean } = {}): User[] => {
  const users = readJson<Partial<User>[]>(KEY_USERS, []).map(normalizeUser)
  if(options.allTenants) return users

  const currentUser = getCurrentUser()
  return currentUser ? filterTenantScope(users, currentUser) : users
}

export const saveUsers = (items: User[]) => {
  localStorage.setItem(KEY_USERS, JSON.stringify(items.map(normalizeUser)))
}

export const loadBranches = (): Branch[] => {
  return readBranchesFromStorage()
}

export const saveBranches = (items: Branch[]) => {
  localStorage.setItem(KEY_BRANCHES, JSON.stringify(items.map(normalizeBranch)))
}

export const loadBranchPermissions = (): BranchPermission[] => {
  return readBranchPermissionsFromStorage()
}

export const saveBranchPermissions = (items: BranchPermission[]) => {
  localStorage.setItem(KEY_BRANCH_PERMISSIONS, JSON.stringify(items.map(normalizeBranchPermission)))
}

export const loadBranchStockTransfers = (): BranchStockTransfer[] => {
  return filterTenantScope(readJson<Partial<BranchStockTransfer>[]>(KEY_BRANCH_STOCK_TRANSFERS, []).map(normalizeBranchStockTransfer))
}

export const saveBranchStockTransfers = (items: BranchStockTransfer[]) => {
  const normalizedItems = items.map(normalizeBranchStockTransfer)
  normalizedItems.forEach(item => assertTenantScope(item))
  localStorage.setItem(KEY_BRANCH_STOCK_TRANSFERS, JSON.stringify(normalizedItems))
}

export const loadBusinessApplications = (): BusinessApplication[] => {
  const storedApplications = localStorage.getItem(KEY_BUSINESS_APPLICATIONS)
  const applications = storedApplications === null
    ? createDemoBusinessApplications()
    : readJson<Partial<BusinessApplication>[]>(KEY_BUSINESS_APPLICATIONS, []).map(normalizeBusinessApplication)

  if(storedApplications !== null){
    const migratedPayload = JSON.stringify(applications)
    if(storedApplications !== migratedPayload){
      localStorage.setItem(KEY_BUSINESS_APPLICATIONS, migratedPayload)
    }
  }

  return applications
}

export const saveBusinessApplications = (items: BusinessApplication[]) => {
  localStorage.setItem(KEY_BUSINESS_APPLICATIONS, JSON.stringify(items.map(normalizeBusinessApplication)))
}

export const loadApplicationNotes = (): ApplicationNote[] => {
  return localStorage.getItem(KEY_APPLICATION_NOTES) === null
    ? createDemoApplicationNotes()
    : readJson<Partial<ApplicationNote>[]>(KEY_APPLICATION_NOTES, []).map(normalizeApplicationNote).filter(note => note.applicationId)
}

export const saveApplicationNotes = (items: ApplicationNote[]) => {
  localStorage.setItem(KEY_APPLICATION_NOTES, JSON.stringify(items.map(normalizeApplicationNote).filter(note => note.applicationId)))
}

export const loadBusinessRegistrations = (): BusinessRegistration[] => {
  const registrations = localStorage.getItem(KEY_BUSINESS_REGISTRATIONS) === null
    ? createDemoBusinessRegistrations()
    : readJson<Partial<BusinessRegistration>[]>(KEY_BUSINESS_REGISTRATIONS, []).map(normalizeBusinessRegistration)
  const currentUser = getCurrentUser()
  return currentUser ? filterTenantScope(registrations, currentUser) : registrations
}

export const saveBusinessRegistrations = (items: BusinessRegistration[]) => {
  localStorage.setItem(KEY_BUSINESS_REGISTRATIONS, JSON.stringify(items.map(normalizeBusinessRegistration)))
}

export const loadCompanies = (options: { allTenants?: boolean; includeDeleted?: boolean } = {}): Company[] => {
  const storedCompanies = localStorage.getItem(KEY_COMPANIES)
  const companies = storedCompanies === null
    ? createDemoCompanies()
    : readJson<Partial<Company>[]>(KEY_COMPANIES, []).map(normalizeCompany)

  if(storedCompanies !== null){
    const migratedPayload = JSON.stringify(companies)
    if(storedCompanies !== migratedPayload){
      localStorage.setItem(KEY_COMPANIES, migratedPayload)
    }
  }

  const visibleCompanies = options.includeDeleted
    ? companies
    : companies.filter(company => !company.deletedAt)
  if(options.allTenants) return visibleCompanies

  const currentUser = getCurrentUser()
  return currentUser ? filterTenantScope(visibleCompanies, currentUser) : visibleCompanies
}

export const saveCompanies = (items: Company[]) => {
  const normalizedItems = items.map(normalizeCompany)
  const nextIds = new Set(normalizedItems.map(company => company.id))
  const archivedCompanies = readJson<Partial<Company>[]>(KEY_COMPANIES, [])
    .map(normalizeCompany)
    .filter(company => company.deletedAt && !nextIds.has(company.id))
  localStorage.setItem(KEY_COMPANIES, JSON.stringify([...normalizedItems, ...archivedCompanies]))
}

export const loadCompanySetups = (options: { allTenants?: boolean } = {}): CompanySetup[] => {
  const setups = localStorage.getItem(KEY_COMPANY_SETUPS) === null
    ? createDemoCompanySetups()
    : readJson<Partial<CompanySetup>[]>(KEY_COMPANY_SETUPS, []).map(normalizeCompanySetup)
  if(options.allTenants) return setups

  const currentUser = getCurrentUser()
  return currentUser ? filterTenantScope(setups, currentUser) : setups
}

export const saveCompanySetups = (items: CompanySetup[]) => {
  localStorage.setItem(KEY_COMPANY_SETUPS, JSON.stringify(items.map(normalizeCompanySetup)))
}

export const loadTenants = (options: { includeDeleted?: boolean } = {}): Tenant[] => {
  return loadTenantsFromHelper(options)
}

export const saveTenants = (items: Tenant[]) => {
  saveTenantsFromHelper(items.map(normalizeTenant))
}

export const loadTenantSettings = (): TenantSettings[] => {
  return loadTenantSettingsFromHelper()
}

export const saveTenantSettings = (items: TenantSettings[]) => {
  saveTenantSettingsFromHelper(items.map(normalizeTenantSettings))
}

export const loadLicensePackages = (): LicensePackage[] => {
  const defaultPackages = createDemoLicensePackages()
  const sourceItems = localStorage.getItem(KEY_LICENSE_PACKAGES) === null
    ? defaultPackages
    : readJson<Partial<LicensePackage>[]>(KEY_LICENSE_PACKAGES, []).map(normalizeLicensePackage)

  const existingById = new Map(sourceItems.map(packageItem => [packageItem.id, packageItem]))
  const defaultIds = new Set(defaultPackages.map(packageItem => packageItem.id))
  const mergedDefaults = defaultPackages.map(packageItem => existingById.get(packageItem.id) || packageItem)
  const customPackages = sourceItems.filter(packageItem => !defaultIds.has(packageItem.id))

  return [...mergedDefaults, ...customPackages]
}

export const saveLicensePackages = (items: LicensePackage[]) => {
  localStorage.setItem(KEY_LICENSE_PACKAGES, JSON.stringify(items.map(normalizeLicensePackage)))
}

export const loadLicenseModules = (): LicenseModule[] => {
  const packages = loadLicensePackages()
  const sourceModules = localStorage.getItem(KEY_LICENSE_MODULES) === null
    ? createDemoLicenseModules(packages)
    : readJson<Partial<LicenseModule>[]>(KEY_LICENSE_MODULES, []).map(normalizeLicenseModule)
  const moduleMap = new Map(sourceModules.map(module => [`${module.packageId}:${module.moduleKey}`, module]))
  const specMap = new Map(defaultPackageSpecs.map(spec => [spec.id, spec]))
  const now = new Date().toISOString()

  return packages.flatMap(packageItem => {
    const specModules = new Set(specMap.get(packageItem.id)?.enabledModules || [])

    return LICENSE_MODULE_CATALOG.map(module => {
      const key = `${packageItem.id}:${module.key}`
      const existingModule = moduleMap.get(key)
      if(existingModule) return existingModule

      return normalizeLicenseModule({
        id: `license_module_${packageItem.id}_${module.key}`,
        packageId: packageItem.id,
        moduleKey: module.key,
        moduleName: module.name,
        enabled: specModules.has(module.key),
        createdAt: now,
        updatedAt: now
      })
    })
  })
}

export const saveLicenseModules = (items: LicenseModule[]) => {
  localStorage.setItem(KEY_LICENSE_MODULES, JSON.stringify(items.map(normalizeLicenseModule)))
}

export const loadCompanyLicenses = (options: { allTenants?: boolean } = {}): CompanyLicense[] => {
  const licenses = localStorage.getItem(KEY_COMPANY_LICENSES) === null
    ? createDemoCompanyLicenses().map(normalizeCompanyLicenseWithRuntimeStatus)
    : readJson<Partial<CompanyLicense>[]>(KEY_COMPANY_LICENSES, []).map(normalizeCompanyLicenseWithRuntimeStatus)
  if(options.allTenants) return licenses

  const currentUser = getCurrentUser()
  return currentUser ? filterTenantScope(licenses, currentUser) : licenses
}

export const saveCompanyLicenses = (items: CompanyLicense[]) => {
  localStorage.setItem(KEY_COMPANY_LICENSES, JSON.stringify(items.map(normalizeCompanyLicenseWithRuntimeStatus)))
}

export const loadCompanyUsers = (options: { allTenants?: boolean } = {}): CompanyUser[] => {
  const users = localStorage.getItem(KEY_COMPANY_USERS) === null
    ? createDemoCompanyUsers()
    : readJson<Partial<CompanyUser>[]>(KEY_COMPANY_USERS, []).map(normalizeCompanyUser)
  if(options.allTenants) return users

  const currentUser = getCurrentUser()
  return currentUser ? filterTenantScope(users, currentUser) : users
}

export const saveCompanyUsers = (items: CompanyUser[]) => {
  localStorage.setItem(KEY_COMPANY_USERS, JSON.stringify(items.map(normalizeCompanyUser)))
}

export const loadUserSubscriptions = (): UserSubscription[] => {
  const subscriptions = localStorage.getItem(KEY_USER_SUBSCRIPTIONS) === null
    ? createDemoUserSubscriptions(loadCompanyLicenses())
    : readJson<Partial<UserSubscription>[]>(KEY_USER_SUBSCRIPTIONS, []).map(normalizeUserSubscription)
  const currentUser = getCurrentUser()
  return currentUser ? filterTenantScope(subscriptions, currentUser) : subscriptions
}

export const saveUserSubscriptions = (items: UserSubscription[]) => {
  localStorage.setItem(KEY_USER_SUBSCRIPTIONS, JSON.stringify(items.map(normalizeUserSubscription)))
}

export const loadPlatformModules = (): PlatformModuleStatus[] => {
  const defaults = createDefaultPlatformModules()
  const sourceModules = localStorage.getItem(KEY_PLATFORM_MODULES) === null
    ? defaults
    : readJson<Partial<PlatformModuleStatus>[]>(KEY_PLATFORM_MODULES, []).map(normalizePlatformModuleStatus)
  const moduleMap = new Map(sourceModules.map(module => [module.moduleKey, module]))

  return LICENSE_MODULE_CATALOG.map(module => moduleMap.get(module.key) || normalizePlatformModuleStatus({
    id: `platform_module_${module.key}`,
    moduleKey: module.key,
    moduleName: module.name,
    active: true
  }))
}

export const savePlatformModules = (items: PlatformModuleStatus[]) => {
  localStorage.setItem(KEY_PLATFORM_MODULES, JSON.stringify(items.map(normalizePlatformModuleStatus)))
}

export const loadPlatformSupportTickets = (): PlatformSupportTicket[] => {
  const tickets = localStorage.getItem(KEY_PLATFORM_SUPPORT_TICKETS) === null
    ? createDemoPlatformSupportTickets()
    : readJson<Partial<PlatformSupportTicket>[]>(KEY_PLATFORM_SUPPORT_TICKETS, []).map(normalizePlatformSupportTicket)
  const currentUser = getCurrentUser()
  return currentUser ? filterTenantScope(tickets, currentUser) : tickets
}

export const savePlatformSupportTickets = (items: PlatformSupportTicket[]) => {
  localStorage.setItem(KEY_PLATFORM_SUPPORT_TICKETS, JSON.stringify(items.map(normalizePlatformSupportTicket)))
}

export const loadPlatformSettings = (): PlatformSettings => {
  const settings = localStorage.getItem(KEY_PLATFORM_SETTINGS) === null
    ? createDefaultPlatformSettings()
    : normalizePlatformSettings(readJson<Partial<PlatformSettings>>(KEY_PLATFORM_SETTINGS, {}))
  return settings
}

export const savePlatformSettings = (settings: PlatformSettings) => {
  localStorage.setItem(KEY_PLATFORM_SETTINGS, JSON.stringify(normalizePlatformSettings(settings)))
}

export type ModuleAccessMode = 'enabled' | 'readonly' | 'disabled'
export type LicensedModuleActionKey = 'create' | 'edit' | 'delete' | 'import' | 'export'

export type ModuleAccessResult = {
  allowed: boolean
  companyId: string
  moduleKey: LicenseModuleKey
  moduleName: string
  mode: ModuleAccessMode
  packageId: string
  packageName: string
  licenseId: string
  licenseStatus: LicenseStatus | ''
  daysRemaining: number
  message: string
  actions: Record<LicensedModuleActionKey, boolean>
  readonlyInfrastructureReady: boolean
}

const createModuleActionPermissions = (mode: ModuleAccessMode): Record<LicensedModuleActionKey, boolean> => {
  const canWrite = mode === 'enabled'
  return {
    create: canWrite,
    edit: canWrite,
    delete: canWrite,
    import: canWrite,
    export: canWrite
  }
}

const createModuleAccessResult = ({
  allowed,
  companyId,
  moduleKey,
  mode,
  packageId = '',
  packageName = '',
  licenseId = '',
  licenseStatus = '',
  daysRemaining = 0,
  message = ''
}: {
  allowed: boolean
  companyId: string
  moduleKey: LicenseModuleKey
  mode: ModuleAccessMode
  packageId?: string
  packageName?: string
  licenseId?: string
  licenseStatus?: LicenseStatus | ''
  daysRemaining?: number
  message?: string
}): ModuleAccessResult => ({
  allowed,
  companyId,
  moduleKey,
  moduleName: getLicenseModuleName(moduleKey),
  mode,
  packageId,
  packageName,
  licenseId,
  licenseStatus,
  daysRemaining,
  message,
  actions: createModuleActionPermissions(mode),
  readonlyInfrastructureReady: true
})

export const getActiveCompanyLicense = (companyId: string, referenceDate = new Date()) => {
  return loadCompanyLicenses()
    .filter(license => license.companyId === companyId)
    .map(license => ({ ...license, status: getCompanyLicenseRuntimeStatus(license, referenceDate) }))
    .filter(license => license.status === 'Aktif' || license.status === 'Deneme' || license.status === 'Süresi Yaklaşıyor')
    .sort((first, second) => second.startDate.localeCompare(first.startDate))[0]
}

export const canAccessModule = (companyId: string, moduleKey: LicenseModuleKey, referenceDate = new Date()): ModuleAccessResult => {
  if(!companyId){
    return createModuleAccessResult({
      allowed: true,
      companyId: '',
      moduleKey,
      mode: 'enabled',
      packageName: 'Sistem yöneticisi'
    })
  }

  const activeLicense = getActiveCompanyLicense(companyId, referenceDate)
  if(!activeLicense){
    return createModuleAccessResult({
      allowed: false,
      companyId,
      moduleKey,
      mode: 'disabled',
      message: 'Aktif lisans bulunamadığı için modül erişimi engellendi.'
    })
  }

  const packageItem = loadLicensePackages().find(item => item.id === activeLicense.packageId)
  const deadline = getLicenseDeadline(activeLicense)
  const daysRemaining = deadline ? getLicenseDaysUntil(deadline, referenceDate) : 0

  if(!packageItem || packageItem.isActive === false){
    return createModuleAccessResult({
      allowed: false,
      companyId,
      moduleKey,
      mode: 'disabled',
      packageId: activeLicense.packageId,
      packageName: packageItem?.name || '',
      licenseId: activeLicense.id,
      licenseStatus: activeLicense.status,
      daysRemaining,
      message: LICENSE_ACCESS_DENIED_MESSAGE
    })
  }

  const packageModule = loadLicenseModules().find(module => (
    module.packageId === activeLicense.packageId
    && module.moduleKey === moduleKey
  ))

  if(!packageModule?.enabled){
    return createModuleAccessResult({
      allowed: false,
      companyId,
      moduleKey,
      mode: 'disabled',
      packageId: activeLicense.packageId,
      packageName: packageItem.name,
      licenseId: activeLicense.id,
      licenseStatus: activeLicense.status,
      daysRemaining,
      message: LICENSE_ACCESS_DENIED_MESSAGE
    })
  }

  return createModuleAccessResult({
    allowed: true,
    companyId,
    moduleKey,
    mode: 'enabled',
    packageId: activeLicense.packageId,
    packageName: packageItem.name,
    licenseId: activeLicense.id,
    licenseStatus: activeLicense.status,
    daysRemaining,
    message: ''
  })
}

export const getModuleActionPermissions = (companyId: string, moduleKey: LicenseModuleKey, referenceDate = new Date()) => {
  return canAccessModule(companyId, moduleKey, referenceDate).actions
}

export const hasCompanyModuleAccess = (companyId: string, moduleKey: LicenseModuleKey, referenceDate = new Date()) => {
  return canAccessModule(companyId, moduleKey, referenceDate).allowed
}

export const getCompanyIdForUser = (user?: User | null) => {
  if(!user) return ''
  return user.companyId || loadCompanySetups().find(setup => setup.setupCompleted && setup.adminUserId === user.id)?.companyId || ''
}

export const canUserAccessLicensedModule = (user: User | null | undefined, moduleKey: LicenseModuleKey, referenceDate = new Date()) => {
  const companyId = getCompanyIdForUser(user)
  return canAccessModule(companyId, moduleKey, referenceDate).allowed
}

export const LICENSE_ACCESS_DENIED_MESSAGE = 'Bu modül aktif modüllerinizde bulunmamaktadır.'

export type LicenseLimitResource = 'users' | 'branches' | 'tables'

export type LicenseLimitCheck = {
  allowed: boolean
  companyId: string
  packageName: string
  limit: number
  used: number
  nextUsage: number
  message: string
}

export type LicenseWarning = {
  id: string
  licenseId: string
  companyId: string
  companyName: string
  packageName: string
  threshold: '30 gün' | '7 gün' | '1 gün' | 'Süresi doldu'
  daysRemaining: number
  message: string
}

const getLicenseDeadline = (license: CompanyLicense) => {
  return license.isTrial ? license.trialEndDate || license.endDate : license.endDate
}

export const getCompanyIdForBranch = (branchId: string) => {
  const branch = loadBranches().find(item => item.id === branchId)
  if(branch?.companyId) return branch.companyId

  return loadCompanySetups().find(setup => setup.setupCompleted && setup.branchId === branchId)?.companyId || ''
}

const getCompanyBranchIds = (companyId: string) => {
  const setupBranchIds = new Set(loadCompanySetups()
    .filter(setup => setup.setupCompleted && setup.companyId === companyId && setup.branchId)
    .map(setup => setup.branchId))

  return new Set(loadBranches()
    .filter(branch => branch.companyId === companyId || setupBranchIds.has(branch.id))
    .map(branch => branch.id)
    .concat(Array.from(setupBranchIds)))
}

const getCompanyUserIds = (companyId: string) => {
  const setupUserIds = new Set(loadCompanySetups()
    .filter(setup => setup.setupCompleted && setup.companyId === companyId && setup.adminUserId)
    .map(setup => setup.adminUserId))

  return new Set(loadUsers({ allTenants: true })
    .filter(user => user.companyId === companyId || setupUserIds.has(user.id))
    .map(user => user.id)
    .concat(Array.from(setupUserIds)))
}

export const getCompanyLicenseUsage = (companyId: string) => {
  const branchIds = getCompanyBranchIds(companyId)
  const userIds = getCompanyUserIds(companyId)
  const allTables = loadAllBranchScopedItems<TableState>(KEY_TABLES, normalizeTableState)
  const companyUserCount = loadCompanyUsers().filter(user => user.companyId === companyId && user.status !== 'Silindi').length
  const authUserCount = loadUsers({ allTenants: true }).filter(user => user.active !== false && (user.companyId === companyId || userIds.has(user.id))).length

  return {
    users: companyUserCount > 0 ? companyUserCount : authUserCount,
    branches: loadBranches().filter(branch => branch.isActive && (branch.companyId === companyId || branchIds.has(branch.id))).length,
    tables: allTables.filter(table => table.companyId === companyId || branchIds.has(table.branchId)).length
  }
}

const getLimitValueForResource = (packageItem: LicensePackage, resource: LicenseLimitResource) => {
  if(resource === 'users') return packageItem.maxUsers
  if(resource === 'branches') return packageItem.maxBranches
  return packageItem.maxTables
}

const getUsageValueForResource = (usage: ReturnType<typeof getCompanyLicenseUsage>, resource: LicenseLimitResource) => {
  if(resource === 'users') return usage.users
  if(resource === 'branches') return usage.branches
  return usage.tables
}

const getLicenseLimitLabel = (resource: LicenseLimitResource) => {
  if(resource === 'users') return 'kullanıcı'
  if(resource === 'branches') return 'şube'
  return 'masa'
}

export const checkCompanyLicenseLimit = (
  companyId: string,
  resource: LicenseLimitResource,
  nextUsage?: number,
  referenceDate = new Date()
): LicenseLimitCheck => {
  if(!companyId){
    return { allowed: true, companyId: '', packageName: '', limit: 0, used: 0, nextUsage: 0, message: '' }
  }

  const activeLicense = getActiveCompanyLicense(companyId, referenceDate)
  const packageItem = activeLicense ? loadLicensePackages().find(item => item.id === activeLicense.packageId) : undefined

  if(!activeLicense || !packageItem){
    return {
      allowed: false,
      companyId,
      packageName: '',
      limit: 0,
      used: 0,
      nextUsage: nextUsage || 1,
      message: 'Aktif lisans bulunamadığı için işlem yapılamaz.'
    }
  }

  const usage = getCompanyLicenseUsage(companyId)
  const used = getUsageValueForResource(usage, resource)
  const limit = getLimitValueForResource(packageItem, resource)
  const normalizedNextUsage = nextUsage === undefined ? used + 1 : nextUsage

  if(limit <= 0 || normalizedNextUsage <= limit){
    return {
      allowed: true,
      companyId,
      packageName: packageItem.name,
      limit,
      used,
      nextUsage: normalizedNextUsage,
      message: ''
    }
  }

  const label = getLicenseLimitLabel(resource)
  return {
    allowed: false,
    companyId,
    packageName: packageItem.name,
    limit,
    used,
    nextUsage: normalizedNextUsage,
    message: `${packageItem.name} paketinde ${label} limiti ${limit}. Mevcut kullanım ${used}, işlem sonrası ${normalizedNextUsage} olur.`
  }
}

export const checkUserLicenseLimit = (
  user: User | null | undefined,
  resource: LicenseLimitResource,
  nextUsage?: number,
  referenceDate = new Date()
) => {
  const companyId = getCompanyIdForUser(user)
  return checkCompanyLicenseLimit(companyId, resource, nextUsage, referenceDate)
}

export const checkCompanyUserLicenseLimit = (companyId: string, nextUsage?: number, referenceDate = new Date()) => {
  const check = checkCompanyLicenseLimit(companyId, 'users', nextUsage, referenceDate)
  return check.allowed ? check : {
    ...check,
    message: 'Aktif lisans kullanıcı limitine ulaştınız.'
  }
}

export const getCompanyLicenseWarnings = (referenceDate = new Date()): LicenseWarning[] => {
  const companies = new Map(loadCompanies().map(company => [company.id, company]))
  const packages = new Map(loadLicensePackages().map(packageItem => [packageItem.id, packageItem]))

  return loadCompanyLicenses().flatMap(license => {
    if(license.status === 'Askıya Alındı' || license.status === 'İptal Edildi') return []

    const deadline = getLicenseDeadline(license)
    if(!deadline) return []

    const runtimeStatus = getCompanyLicenseRuntimeStatus(license, referenceDate)
    const daysRemaining = getLicenseDaysUntil(deadline, referenceDate)
    const threshold = daysRemaining < 0 || runtimeStatus === 'Süresi Doldu'
      ? 'Süresi doldu'
      : daysRemaining <= 1
        ? '1 gün'
        : daysRemaining <= 7
          ? '7 gün'
          : daysRemaining <= 30
            ? '30 gün'
            : ''

    if(!threshold) return []

    const company = companies.get(license.companyId)
    const packageItem = packages.get(license.packageId)
    const message = threshold === 'Süresi doldu'
      ? `${company?.companyName || 'Firma'} lisansının süresi doldu.`
      : `${company?.companyName || 'Firma'} lisansı ${threshold} eşiğinde yenileme bekliyor.`

    return [{
      id: `license_warning_${license.id}_${threshold.replace(/\s+/g, '_')}`,
      licenseId: license.id,
      companyId: license.companyId,
      companyName: company?.companyName || '-',
      packageName: packageItem?.name || '-',
      threshold,
      daysRemaining,
      message
    }]
  })
}

export const loadEmployees = (): Employee[] => {
  return loadBranchScopedItemsWithDemo(KEY_EMPLOYEES, createDemoEmployees, normalizeEmployee)
}

export const saveEmployees = (items: Employee[]) => {
  saveBranchScopedItems(KEY_EMPLOYEES, items, normalizeEmployee)
}

export const loadShifts = (): Shift[] => {
  return loadBranchScopedItemsWithDemo(KEY_SHIFTS, createDemoShifts, normalizeShift)
}

export const saveShifts = (items: Shift[]) => {
  saveBranchScopedItems(KEY_SHIFTS, items, normalizeShift)
}

export const loadAttendances = (): Attendance[] => {
  return loadBranchScopedItemsWithDemo(KEY_ATTENDANCES, createDemoAttendances, normalizeAttendance)
}

export const saveAttendances = (items: Attendance[]) => {
  saveBranchScopedItems(KEY_ATTENDANCES, items, normalizeAttendance)
}

export const loadEmployeePerformances = (): EmployeePerformance[] => {
  return loadBranchScopedItemsWithDemo(KEY_EMPLOYEE_PERFORMANCES, createDemoEmployeePerformances, normalizeEmployeePerformance)
}

export const saveEmployeePerformances = (items: EmployeePerformance[]) => {
  saveBranchScopedItems(KEY_EMPLOYEE_PERFORMANCES, items, normalizeEmployeePerformance)
}

export const loadEmployeeBonuses = (): EmployeeBonus[] => {
  return loadBranchScopedItemsWithDemo(KEY_EMPLOYEE_BONUSES, createDemoEmployeeBonuses, normalizeEmployeeBonus)
}

export const saveEmployeeBonuses = (items: EmployeeBonus[]) => {
  saveBranchScopedItems(KEY_EMPLOYEE_BONUSES, items, normalizeEmployeeBonus)
}

export const loadEmployeeAudits = (): EmployeeAudit[] => {
  return loadBranchScopedItemsWithDemo(KEY_EMPLOYEE_AUDITS, createDemoEmployeeAudits, normalizeEmployeeAudit)
}

export const saveEmployeeAudits = (items: EmployeeAudit[]) => {
  saveBranchScopedItems(KEY_EMPLOYEE_AUDITS, items, normalizeEmployeeAudit)
}

export const loadBranchReportingData = () => {
  const productCategories = loadCategories()
  const fallbackCategoryId = productCategories.find(category => category.id === DEFAULT_CATEGORY_ID)?.id
    || productCategories[0]?.id
    || DEFAULT_CATEGORY_ID
  const stockCategories = loadStockCategories()
  const fallbackStockCategoryId = stockCategories.find(category => category.id === DEFAULT_STOCK_CATEGORY_ID)?.id
    || stockCategories[0]?.id
    || DEFAULT_STOCK_CATEGORY_ID

  return {
    branches: loadBranches(),
    tables: loadAllBranchScopedItems<TableState>(KEY_TABLES, normalizeTableState),
    closedBills: loadAllBranchScopedItems<ClosedBill>(KEY_CLOSED, normalizeClosedBill),
    kitchenOrders: loadAllBranchScopedItems<KitchenOrder>(KEY_KITCHEN, normalizeKitchenOrder),
    products: loadAllBranchScopedItems<Product>(KEY_PRODUCTS, item => normalizeProduct(item, fallbackCategoryId)),
    stockItems: loadAllBranchScopedItems<StockItem>(KEY_STOCK_ITEMS, item => normalizeStockItem(item, fallbackStockCategoryId)),
    stockExpiryLots: loadAllBranchScopedItems<StockExpiryLot>(KEY_STOCK_EXPIRY_LOTS, normalizeStockExpiryLot, lot => Boolean(lot.stockItemId)),
    stockWasteRecords: loadAllBranchScopedItems<StockWasteRecord>(KEY_STOCK_WASTE_RECORDS, normalizeStockWasteRecord, record => Boolean(record.stockItemId && record.stockMovementId)),
    currentAccounts: loadAllBranchScopedItemsWithDemo<CurrentAccount>(KEY_CURRENT_ACCOUNTS, createDemoCurrentAccounts, normalizeCurrentAccount),
    creditTransactions: loadAllBranchScopedItemsWithDemo<CreditTransaction>(KEY_CREDIT_TRANSACTIONS, createDemoCreditTransactions, normalizeCreditTransaction),
    collectionTransactions: loadAllBranchScopedItemsWithDemo<CollectionTransaction>(KEY_COLLECTION_TRANSACTIONS, createDemoCollectionTransactions, normalizeCollectionTransaction),
    supplierDebts: loadAllBranchScopedItemsWithDemo<SupplierDebt>(KEY_SUPPLIER_DEBTS, createDemoSupplierDebts, normalizeSupplierDebt),
    supplierPayments: loadAllBranchScopedItemsWithDemo<SupplierPayment>(KEY_SUPPLIER_PAYMENTS, createDemoSupplierPayments, normalizeSupplierPayment),
    cashTransactions: loadAllBranchScopedItems<CashTransaction>(KEY_CASH_TRANSACTIONS, normalizeCashTransaction),
    cashClosings: loadAllBranchScopedItems<CashClosing>(KEY_CASH_CLOSINGS, normalizeCashClosing),
    employees: loadAllBranchScopedItemsWithDemo<Employee>(KEY_EMPLOYEES, createDemoEmployees, normalizeEmployee),
    attendances: loadAllBranchScopedItemsWithDemo<Attendance>(KEY_ATTENDANCES, createDemoAttendances, normalizeAttendance),
    employeePerformances: loadAllBranchScopedItemsWithDemo<EmployeePerformance>(KEY_EMPLOYEE_PERFORMANCES, createDemoEmployeePerformances, normalizeEmployeePerformance),
    employeeBonuses: loadAllBranchScopedItemsWithDemo<EmployeeBonus>(KEY_EMPLOYEE_BONUSES, createDemoEmployeeBonuses, normalizeEmployeeBonus),
    employeeAudits: loadAllBranchScopedItemsWithDemo<EmployeeAudit>(KEY_EMPLOYEE_AUDITS, createDemoEmployeeAudits, normalizeEmployeeAudit),
    branchStockTransfers: loadBranchStockTransfers(),
    branchPermissions: loadBranchPermissions()
  }
}

export type TenantIsolationTestResult = {
  sourceTenantId: string
  targetTenantId: string
  visibleRecordCount: number
  blockedRecordId: string
  blockedRecordType: string
  allowedRecordTypes: string[]
  denied: boolean
  message: string
}

export const runTenantIsolationTest = ({
  sourceTenantId,
  targetTenantId,
  user
}: {
  sourceTenantId: string
  targetTenantId: string
  user: User
}): TenantIsolationTestResult => {
  const categories = loadCategories()
  const fallbackCategoryId = categories.find(category => category.id === DEFAULT_CATEGORY_ID)?.id
    || categories[0]?.id
    || DEFAULT_CATEGORY_ID
  const stockCategories = loadStockCategories()
  const fallbackStockCategoryId = stockCategories.find(category => category.id === DEFAULT_STOCK_CATEGORY_ID)?.id
    || stockCategories[0]?.id
    || DEFAULT_STOCK_CATEGORY_ID
  const branches = readBranchesFromStorage()
  const users = loadUsers({ allTenants: true })
  const context = { branches, users, includePlatformAdmin: false }
  const recordGroups: Array<{ type: string; records: TenantScopedRecord[] }> = [
    { type: 'Users', records: users },
    { type: 'Branches', records: branches },
    { type: 'Tables', records: loadAllBranchScopedItems<TableState>(KEY_TABLES, normalizeTableState) },
    { type: 'Products', records: loadAllBranchScopedItems<Product>(KEY_PRODUCTS, item => normalizeProduct(item, fallbackCategoryId)) },
    { type: 'Categories', records: categories },
    { type: 'Stocks', records: loadAllBranchScopedItems<StockItem>(KEY_STOCK_ITEMS, item => normalizeStockItem(item, fallbackStockCategoryId)) },
    { type: 'Recipes', records: loadAllBranchScopedItems<Recipe>(KEY_RECIPES, normalizeRecipe) },
    { type: 'Customers', records: loadAllBranchScopedItemsWithDemo<CurrentAccount>(KEY_CURRENT_ACCOUNTS, createDemoCurrentAccounts, normalizeCurrentAccount) },
    { type: 'CashMovements', records: loadAllBranchScopedItems<CashTransaction>(KEY_CASH_TRANSACTIONS, normalizeCashTransaction) },
    { type: 'ActionHistory', records: loadActionLogs() }
  ]
  const visibleRecords = recordGroups.flatMap(group => (
    filterByTenant(group.records, { ...context, tenantId: sourceTenantId })
      .map(record => ({ type: group.type, record }))
  ))
  const blockedRecord = recordGroups
    .flatMap(group => group.records.map(record => ({ type: group.type, record })))
    .find(item => resolveTenantIdForRecord(item.record, context) === targetTenantId)
  let denied = false

  if(blockedRecord){
    try {
      assertTenantAccess(blockedRecord.record, {
        ...context,
        tenantId: sourceTenantId,
        user,
        includePlatformAdmin: false
      })
    } catch {
      denied = true
    }
  } else {
    denied = true
  }

  if(denied){
    addActionLog({
      operationType: 'Tenant erişimi engellendi',
      user,
      tenantId: sourceTenantId,
      tableId: blockedRecord?.record.id,
      tableName: blockedRecord?.type || 'Tenant',
      description: `${sourceTenantId} tenant kapsamından ${targetTenantId} tenant kaydına erişim reddedildi.`
    })
  }

  addActionLog({
    operationType: 'Veri izolasyonu doğrulandı',
    user,
    tenantId: sourceTenantId,
    tableId: sourceTenantId,
    tableName: 'Tenant İzolasyonu',
    description: `${sourceTenantId} için ${visibleRecords.length} görünür kayıt kontrol edildi. Hedef tenant: ${targetTenantId}. Sonuç: ${denied ? 'başarılı' : 'riskli'}.`
  })

  return {
    sourceTenantId,
    targetTenantId,
    visibleRecordCount: visibleRecords.length,
    blockedRecordId: blockedRecord?.record.id || '',
    blockedRecordType: blockedRecord?.type || '',
    allowedRecordTypes: Array.from(new Set(visibleRecords.map(item => item.type))),
    denied,
    message: denied
      ? 'Başka tenant kaydına erişim reddedildi; izolasyon doğrulandı.'
      : 'Hedef tenant kaydına erişim engellenemedi; izolasyon riski var.'
  }
}

export const ensureDefaultAdmin = () => {
  loadSectors({ includeInactive: true })
  const users = loadUsers({ allTenants: true })
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
  const users = loadUsers({ allTenants: true })
  const u = users.find(x => x.username === username && x.password === password && x.active)
  if(u){
    setCurrentUser(u)
    return u
  }
  return null
}

export const updateUser = (user: User) => {
  const users = loadUsers({ allTenants: true })
  const next = users.map(u=> u.id===user.id ? user : u)
  saveUsers(next)
}

export const addUser = (user: User) => {
  const users = loadUsers({ allTenants: true })
  saveUsers([user, ...users])
}

export const deleteUser = (id: string) => {
  const users = loadUsers({ allTenants: true })
  saveUsers(users.filter(u => u.id !== id))
}

export const loadActionLogs = (): ActionLog[] => {
  const logs = readJson<Partial<ActionLog>[]>(KEY_LOGS, []).map(normalizeActionLog)
  const currentUser = getCurrentUser()
  return currentUser ? filterTenantScope(logs, currentUser) : logs
}

export const saveActionLogs = (items: ActionLog[]) => {
  localStorage.setItem(KEY_LOGS, JSON.stringify(items.map(normalizeActionLog)))
}

const loadStoredSystemUsageLogs = (): SystemUsageLog[] => {
  return readJson<Partial<SystemUsageLog>[]>(KEY_SYSTEM_USAGE_LOGS, []).map(normalizeSystemUsageLog)
}

export const loadSystemUsageLogs = (): SystemUsageLog[] => {
  const usageLogs = loadStoredSystemUsageLogs()
  const actionHistoryLogs = loadActionLogs().map(createSystemUsageLogFromActionLog)
  const seen = new Set<string>()

  return [...usageLogs, ...actionHistoryLogs]
    .filter(log => {
      if(seen.has(log.id)) return false
      seen.add(log.id)
      return true
    })
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}

export const saveSystemUsageLogs = (items: SystemUsageLog[]) => {
  localStorage.setItem(KEY_SYSTEM_USAGE_LOGS, JSON.stringify(items.map(normalizeSystemUsageLog)))
}

export const addSystemUsageLog = ({
  user,
  branchId,
  moduleName,
  actionType,
  entityType,
  entityId,
  description,
  ipAddress,
  deviceInfo
}: {
  user?: User | null
  branchId?: string
  moduleName: SystemUsageModuleName
  actionType: SystemUsageActionType
  entityType?: string
  entityId?: string
  description: string
  ipAddress?: string
  deviceInfo?: string
}) => {
  const currentUser = user || getCurrentUser()
  const log = normalizeSystemUsageLog({
    id: `system_usage_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    userId: currentUser?.id || '',
    userName: currentUser ? currentUser.fullName || currentUser.username : 'Bilinmeyen Kullanıcı',
    branchId: branchId || getActiveBranchId(),
    moduleName,
    actionType,
    entityType: entityType || '',
    entityId: entityId || '',
    description,
    ipAddress: ipAddress || '',
    deviceInfo: deviceInfo || (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    createdAt: new Date().toISOString()
  })

  saveSystemUsageLogs([log, ...loadStoredSystemUsageLogs()])
  return log
}

const getUsageTimestampValue = (createdAt: string) => {
  const timestamp = new Date(createdAt).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const getUsageDateKey = (createdAt: string) => {
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const getMostUsedModuleName = (logs: SystemUsageLog[]) => {
  const moduleCounts = new Map<string, number>()
  logs.forEach(log => {
    if(!log.moduleName) return
    moduleCounts.set(log.moduleName, (moduleCounts.get(log.moduleName) || 0) + 1)
  })

  return Array.from(moduleCounts.entries()).sort((first, second) => {
    const countDiff = second[1] - first[1]
    if(countDiff !== 0) return countDiff
    return first[0].localeCompare(second[0], 'tr-TR')
  })[0]?.[0] || ''
}

export const calculateUserActivitySummaries = (
  logs: SystemUsageLog[],
  users: User[] = loadUsers()
): UserActivitySummary[] => {
  const now = new Date().toISOString()
  const userMap = new Map<string, { userId: string; userName: string }>()

  users.forEach(user => {
    userMap.set(user.id, {
      userId: user.id,
      userName: user.fullName || user.username
    })
  })

  logs.forEach(log => {
    const key = log.userId || `unknown_${log.userName || 'user'}`
    if(!userMap.has(key)){
      userMap.set(key, {
        userId: key,
        userName: log.userName || 'Bilinmeyen Kullanıcı'
      })
    }
  })

  return Array.from(userMap.values()).map(user => {
    const userLogs = logs.filter(log => {
      const key = log.userId || `unknown_${log.userName || 'user'}`
      return key === user.userId
    })
    const sortedLogs = [...userLogs].sort((first, second) => getUsageTimestampValue(second.createdAt) - getUsageTimestampValue(first.createdAt))
    const firstActivity = [...userLogs].sort((first, second) => getUsageTimestampValue(first.createdAt) - getUsageTimestampValue(second.createdAt))[0]
    const lastActivity = sortedLogs[0]
    const lastLogin = sortedLogs.find(log => log.actionType === 'Giriş Yapma')
    const activeDays = new Set(userLogs.map(log => getUsageDateKey(log.createdAt)).filter(Boolean)).size
    const totalActions = userLogs.length
    const averageDailyActions = activeDays > 0
      ? Math.round((totalActions / activeDays + Number.EPSILON) * 10) / 10
      : 0

    return {
      id: `activity_${user.userId}`,
      userId: user.userId,
      userName: user.userName,
      branchId: lastActivity?.branchId || DEFAULT_BRANCH_ID,
      lastLoginAt: lastLogin?.createdAt || '',
      lastActivityAt: lastActivity?.createdAt || '',
      totalLogins: userLogs.filter(log => log.actionType === 'Giriş Yapma').length,
      activeDays,
      totalActions,
      averageDailyActions,
      mostUsedModule: getMostUsedModuleName(userLogs),
      createdAt: firstActivity?.createdAt || now,
      updatedAt: lastActivity?.createdAt || now
    }
  }).sort((first, second) => {
    const actionDiff = second.totalActions - first.totalActions
    if(actionDiff !== 0) return actionDiff
    return first.userName.localeCompare(second.userName, 'tr-TR')
  })
}

export const loadUserActivitySummaries = () => {
  return calculateUserActivitySummaries(loadSystemUsageLogs(), loadUsers())
}

const getMostActiveModuleUser = (logs: SystemUsageLog[]) => {
  const userCounts = new Map<string, { userName: string; count: number }>()
  logs.forEach(log => {
    const key = log.userId || log.userName
    if(!key) return
    const current = userCounts.get(key)
    userCounts.set(key, {
      userName: log.userName || key,
      count: (current?.count || 0) + 1
    })
  })

  return Array.from(userCounts.values()).sort((first, second) => {
    const countDiff = second.count - first.count
    if(countDiff !== 0) return countDiff
    return first.userName.localeCompare(second.userName, 'tr-TR')
  })[0]?.userName || ''
}

export const calculateModuleUsageSummaries = (logs: SystemUsageLog[]): ModuleUsageSummary[] => {
  const now = new Date().toISOString()

  return SYSTEM_USAGE_MODULE_NAMES.map(moduleName => {
    const moduleLogs = logs.filter(log => log.moduleName === moduleName)
    const sortedLogs = [...moduleLogs].sort((first, second) => getUsageTimestampValue(second.createdAt) - getUsageTimestampValue(first.createdAt))
    const firstUsage = [...moduleLogs].sort((first, second) => getUsageTimestampValue(first.createdAt) - getUsageTimestampValue(second.createdAt))[0]
    const activeDayCount = new Set(moduleLogs.map(log => getUsageDateKey(log.createdAt)).filter(Boolean)).size
    const totalUsageCount = moduleLogs.length
    const averageDailyUsage = activeDayCount > 0
      ? Math.round((totalUsageCount / activeDayCount + Number.EPSILON) * 10) / 10
      : 0
    const uniqueUserCount = new Set(moduleLogs.map(log => log.userId || log.userName).filter(Boolean)).size

    return {
      id: `module_usage_${moduleName}`,
      moduleName,
      totalUsageCount,
      uniqueUserCount,
      activeDayCount,
      averageDailyUsage,
      lastUsedAt: sortedLogs[0]?.createdAt || '',
      mostActiveUser: getMostActiveModuleUser(moduleLogs),
      createdAt: firstUsage?.createdAt || now,
      updatedAt: sortedLogs[0]?.createdAt || now
    }
  }).sort((first, second) => {
    const usageDiff = second.totalUsageCount - first.totalUsageCount
    if(usageDiff !== 0) return usageDiff
    return first.moduleName.localeCompare(second.moduleName, 'tr-TR')
  })
}

export const loadModuleUsageSummaries = () => {
  return calculateModuleUsageSummaries(loadSystemUsageLogs())
}

const calculateBusinessUsageScore = ({
  activeUserCount,
  totalActions,
  activeDays,
  averageDailyActions
}: {
  activeUserCount: number
  totalActions: number
  activeDays: number
  averageDailyActions: number
}) => {
  const activeUserScore = Math.min(25, activeUserCount * 5)
  const actionScore = Math.min(30, totalActions * 0.6)
  const activeDayScore = Math.min(25, activeDays * 3)
  const averageScore = Math.min(20, averageDailyActions * 2)
  return Math.min(100, Math.round(activeUserScore + actionScore + activeDayScore + averageScore))
}

export const calculateBusinessUsageSummaries = (
  logs: SystemUsageLog[],
  branches: Branch[] = loadBranches()
): BusinessUsageSummary[] => {
  const now = new Date().toISOString()
  const branchMap = new Map<string, { branchId: string; branchName: string }>()

  branches.forEach(branch => {
    branchMap.set(branch.id, {
      branchId: branch.id,
      branchName: branch.name
    })
  })

  logs.forEach(log => {
    const branchId = log.branchId || DEFAULT_BRANCH_ID
    if(!branchMap.has(branchId)){
      branchMap.set(branchId, {
        branchId,
        branchName: branchId === DEFAULT_BRANCH_ID ? 'Merkez Şube' : branchId
      })
    }
  })

  return Array.from(branchMap.values()).map(branch => {
    const branchLogs = logs.filter(log => (log.branchId || DEFAULT_BRANCH_ID) === branch.branchId)
    const sortedLogs = [...branchLogs].sort((first, second) => getUsageTimestampValue(second.createdAt) - getUsageTimestampValue(first.createdAt))
    const firstActivity = [...branchLogs].sort((first, second) => getUsageTimestampValue(first.createdAt) - getUsageTimestampValue(second.createdAt))[0]
    const activeDays = new Set(branchLogs.map(log => getUsageDateKey(log.createdAt)).filter(Boolean)).size
    const totalActions = branchLogs.length
    const averageDailyActions = activeDays > 0
      ? Math.round((totalActions / activeDays + Number.EPSILON) * 10) / 10
      : 0
    const activeUserCount = new Set(branchLogs.map(log => log.userId || log.userName).filter(Boolean)).size
    const usageScore = calculateBusinessUsageScore({
      activeUserCount,
      totalActions,
      activeDays,
      averageDailyActions
    })

    return {
      id: `business_usage_${branch.branchId}`,
      branchId: branch.branchId,
      branchName: branch.branchName,
      lastActivityAt: sortedLogs[0]?.createdAt || '',
      activeUserCount,
      totalLogins: branchLogs.filter(log => log.actionType === 'Giriş Yapma').length,
      totalActions,
      activeDays,
      averageDailyActions,
      mostUsedModule: getMostUsedModuleName(branchLogs),
      usageScore,
      createdAt: firstActivity?.createdAt || now,
      updatedAt: sortedLogs[0]?.createdAt || now
    }
  }).sort((first, second) => {
    const scoreDiff = second.usageScore - first.usageScore
    if(scoreDiff !== 0) return scoreDiff
    const actionDiff = second.totalActions - first.totalActions
    if(actionDiff !== 0) return actionDiff
    return first.branchName.localeCompare(second.branchName, 'tr-TR')
  })
}

export const loadBusinessUsageSummaries = () => {
  return calculateBusinessUsageSummaries(loadSystemUsageLogs(), loadBranches())
}

const getUsageHourValue = (createdAt: string) => {
  const date = new Date(createdAt)
  return Number.isNaN(date.getTime()) ? -1 : date.getHours()
}

const calculatePeakUsageScore = ({
  totalActions,
  activeUsers,
  activeBranches
}: {
  totalActions: number
  activeUsers: number
  activeBranches: number
}) => {
  const actionScore = Math.min(55, totalActions * 2)
  const userScore = Math.min(25, activeUsers * 5)
  const branchScore = Math.min(20, activeBranches * 10)
  return Math.min(100, Math.round(actionScore + userScore + branchScore))
}

export const calculateUsagePerformanceSummaries = (logs: SystemUsageLog[]): UsagePerformanceSummary[] => {
  const now = new Date().toISOString()
  const groupedLogs = new Map<string, SystemUsageLog[]>()

  logs.forEach(log => {
    const date = getUsageDateKey(log.createdAt)
    const hour = getUsageHourValue(log.createdAt)
    if(!date || hour < 0) return
    const key = `${date}_${hour}`
    groupedLogs.set(key, [...(groupedLogs.get(key) || []), log])
  })

  return Array.from(groupedLogs.entries()).map(([key, groupLogs]) => {
    const [date, hourValue] = key.split('_')
    const hour = Number(hourValue)
    const sortedLogs = [...groupLogs].sort((first, second) => getUsageTimestampValue(second.createdAt) - getUsageTimestampValue(first.createdAt))
    const firstUsage = [...groupLogs].sort((first, second) => getUsageTimestampValue(first.createdAt) - getUsageTimestampValue(second.createdAt))[0]
    const activeUsers = new Set(groupLogs.map(log => log.userId || log.userName).filter(Boolean)).size
    const activeBranches = new Set(groupLogs.map(log => log.branchId || DEFAULT_BRANCH_ID).filter(Boolean)).size
    const totalActions = groupLogs.length
    const averageActionsPerUser = activeUsers > 0
      ? Math.round((totalActions / activeUsers + Number.EPSILON) * 10) / 10
      : 0
    const peakUsageScore = calculatePeakUsageScore({ totalActions, activeUsers, activeBranches })

    return {
      id: `usage_performance_${date}_${hour}`,
      date,
      hour,
      totalActions,
      activeUsers,
      activeBranches,
      averageActionsPerUser,
      peakUsageScore,
      createdAt: firstUsage?.createdAt || now,
      updatedAt: sortedLogs[0]?.createdAt || now
    }
  }).sort((first, second) => {
    const dateDiff = second.date.localeCompare(first.date)
    if(dateDiff !== 0) return dateDiff
    return first.hour - second.hour
  })
}

export const loadUsagePerformanceSummaries = () => {
  return calculateUsagePerformanceSummaries(loadSystemUsageLogs())
}

const getHealthDayDiff = (createdAt: string, today = new Date()) => {
  if(!createdAt) return Number.POSITIVE_INFINITY
  const date = new Date(createdAt)
  if(Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const end = new Date(today)
  end.setHours(0, 0, 0, 0)
  return Math.floor((end.getTime() - start.getTime()) / 86400000)
}

const getHealthMetricStatus = (value: number): SystemHealthMetricStatus => {
  if(value >= 80) return 'Sağlıklı'
  if(value >= 50) return 'Uyarı'
  return 'Kritik'
}

const getDataMetricStatus = (warningCount: number): SystemHealthMetricStatus => {
  if(warningCount === 0) return 'Sağlıklı'
  if(warningCount < 5) return 'Uyarı'
  return 'Kritik'
}

const clampHealthScore = (value: number) => Math.min(100, Math.max(0, Math.round(value)))

export const calculateSystemHealthMetrics = (
  logs: SystemUsageLog[],
  users: User[] = loadUsers(),
  branches: Branch[] = loadBranches(),
  actionLogs: ActionLog[] = loadActionLogs()
): SystemHealthMetric[] => {
  const now = new Date().toISOString()
  const userIds = new Set(users.map(user => user.id))
  const branchIds = new Set(branches.map(branch => branch.id))
  const userSummaries = calculateUserActivitySummaries(logs, users)
  const moduleSummaries = calculateModuleUsageSummaries(logs)
  const businessSummaries = calculateBusinessUsageSummaries(logs, branches)
  const performanceSummaries = calculateUsagePerformanceSummaries(logs)
  const activeUsers = userSummaries.filter(summary => userIds.has(summary.userId) && summary.totalActions > 0 && getHealthDayDiff(summary.lastActivityAt) <= 7).length
  const activeBusinesses = businessSummaries.filter(summary => branchIds.has(summary.branchId) && summary.totalActions > 0 && getHealthDayDiff(summary.lastActivityAt) <= 7).length
  const activeModules = moduleSummaries.filter(summary => summary.totalUsageCount > 0 && getHealthDayDiff(summary.lastUsedAt) <= 7).length
  const activeUserRatio = users.length > 0 ? clampHealthScore((activeUsers / users.length) * 100) : 0
  const activeBusinessRatio = branches.length > 0 ? clampHealthScore((activeBusinesses / branches.length) * 100) : 0
  const moduleUsageRatio = moduleSummaries.length > 0 ? clampHealthScore((activeModules / moduleSummaries.length) * 100) : 0
  const activeDays = new Set(logs.map(log => getUsageDateKey(log.createdAt)).filter(Boolean)).size
  const averageDailyActions = activeDays > 0 ? logs.length / activeDays : 0
  const maxPeakScore = Math.max(0, ...performanceSummaries.map(summary => summary.peakUsageScore))
  const usageDensityScore = clampHealthScore((Math.min(50, averageDailyActions) / 50) * 50 + maxPeakScore * 0.5)
  const orphanActionRecords = actionLogs.filter(log => log.userId && !userIds.has(log.userId)).length
  const missingUserLinks = logs.filter(log => !log.userId || (log.userId && !userIds.has(log.userId))).length
  const missingBranchLinks = logs.filter(log => !log.branchId || (log.branchId && !branchIds.has(log.branchId))).length
  const emptyLogRecords = logs.filter(log => !log.moduleName || !log.actionType || !log.createdAt || !log.description).length
  const inconsistentUsageRecords = logs.filter(log => {
    const timestamp = new Date(log.createdAt).getTime()
    return Number.isNaN(timestamp)
      || !SYSTEM_USAGE_MODULE_NAMES.includes(log.moduleName)
      || !SYSTEM_USAGE_ACTION_TYPES.includes(log.actionType)
  }).length
  const dataWarningCount = orphanActionRecords + missingUserLinks + missingBranchLinks + emptyLogRecords + inconsistentUsageRecords
  const dataIntegrityScore = clampHealthScore(100 - dataWarningCount * 10)
  const systemHealthScore = clampHealthScore((activeUserRatio + activeBusinessRatio + moduleUsageRatio + usageDensityScore + dataIntegrityScore) / 5)

  const metric = (
    metricName: string,
    metricCategory: string,
    metricValue: number,
    status: SystemHealthMetricStatus,
    description: string
  ): SystemHealthMetric => ({
    id: `health_${metricCategory}_${metricName}`.toLocaleLowerCase('tr-TR').replace(/\s+/g, '_'),
    metricName,
    metricCategory,
    metricValue,
    status,
    description,
    measuredAt: now,
    createdAt: now,
    updatedAt: now
  })

  return [
    metric('Sistem Sağlık Skoru', 'Genel', systemHealthScore, getHealthMetricStatus(systemHealthScore), 'Aktiflik, yoğunluk ve veri bütünlüğü bileşik skoru.'),
    metric('Aktif Kullanıcı Oranı', 'Kullanıcı', activeUserRatio, getHealthMetricStatus(activeUserRatio), `${activeUsers} aktif kullanıcı / ${users.length} toplam kullanıcı.`),
    metric('Aktif İşletme Oranı', 'İşletme', activeBusinessRatio, getHealthMetricStatus(activeBusinessRatio), `${activeBusinesses} aktif işletme / ${branches.length} toplam işletme.`),
    metric('Modül Kullanım Oranı', 'Modül', moduleUsageRatio, getHealthMetricStatus(moduleUsageRatio), `${activeModules} aktif modül / ${moduleSummaries.length} izlenen modül.`),
    metric('Kullanım Yoğunluğu', 'Performans', usageDensityScore, getHealthMetricStatus(usageDensityScore), `${Math.round(averageDailyActions)} ortalama günlük işlem, ${maxPeakScore} maksimum yoğunluk skoru.`),
    metric('Veri Bütünlüğü', 'Veri', dataIntegrityScore, getHealthMetricStatus(dataIntegrityScore), `${dataWarningCount} veri uyarısı tespit edildi.`),
    metric('Yetim Kayıtlar', 'Veri', orphanActionRecords, getDataMetricStatus(orphanActionRecords), 'Kullanıcı eşleşmesi bulunmayan ActionHistory kayıtları.'),
    metric('Eksik Kullanıcı Bağlantıları', 'Veri', missingUserLinks, getDataMetricStatus(missingUserLinks), 'Kullanıcı bağlantısı eksik veya kullanıcı listesinde olmayan log kayıtları.'),
    metric('Eksik Şube Bağlantıları', 'Veri', missingBranchLinks, getDataMetricStatus(missingBranchLinks), 'Şube bağlantısı eksik veya şube listesinde olmayan log kayıtları.'),
    metric('Boş Log Kayıtları', 'Veri', emptyLogRecords, getDataMetricStatus(emptyLogRecords), 'Zorunlu alanları boş olan kullanım logları.'),
    metric('Tutarsız Kullanım Kayıtları', 'Veri', inconsistentUsageRecords, getDataMetricStatus(inconsistentUsageRecords), 'Geçersiz tarih, modül veya işlem türü taşıyan kullanım kayıtları.')
  ]
}

export const loadSystemHealthMetrics = () => {
  return calculateSystemHealthMetrics(loadSystemUsageLogs(), loadUsers(), loadBranches(), loadActionLogs())
}

export const addActionLog = ({
  operationType,
  user,
  tenantId,
  tableId,
  tableName,
  description
}: {
  operationType: ActionLogType
  user: User
  tenantId?: string
  tableId?: string
  tableName?: string
  description: string
}) => {
  const now = new Date()
  const log: ActionLog = {
    id: `log_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    tenantId: tenantId || resolveTenantIdForRecord({
      tenantId: user.tenantId,
      companyId: user.companyId,
      userId: user.id
    }, { user, users: readUsersForTenantContext() }),
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

export const addLicenseAccessFailureLog = ({
  user,
  companyId,
  moduleKey,
  description
}: {
  user: User
  companyId?: string
  moduleKey: LicenseModuleKey
  description?: string
}) => {
  addActionLog({
    operationType: 'Lisans erişim kontrolü başarısız',
    user,
    tableId: companyId,
    tableName: getLicenseModuleName(moduleKey),
    description: description || `${getLicenseModuleName(moduleKey)} modülü için lisans erişim kontrolü başarısız.`
  })
}

const slugifySetupValue = (value: string) => {
  const normalized = value
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')

  return normalized || 'firma'
}

const createUniqueCompanyAdminUsername = (baseValue: string, users: User[]) => {
  const base = slugifySetupValue(baseValue)
  const existingUsernames = new Set(users.map(user => user.username.toLocaleLowerCase('tr-TR')))
  let username = base
  let index = 2

  while(existingUsernames.has(username.toLocaleLowerCase('tr-TR'))){
    username = `${base}${index}`
    index += 1
  }

  return username
}

const createBusinessApplicationOwnerUsername = (email: string) => {
  const username = email.trim().toLowerCase()
  if(!username) throw createBusinessApplicationError('Firma sahibi e-postası zorunludur.')
  return username
}

export const generateTemporaryCompanyPassword = () => {
  return `MIYOP-${Math.floor(1000 + Math.random() * 9000)}`
}

const createCompanySetupStorageId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const createNextBranchCode = (branches: Branch[]) => {
  const maxCode = branches.reduce((max, branch) => {
    const match = branch.code.match(/^SUBE-(\d+)$/i)
    if(!match) return max

    const value = Number(match[1])
    return Number.isFinite(value) ? Math.max(max, value) : max
  }, 0)

  return `SUBE-${String(maxCode + 1).padStart(3, '0')}`
}

export type CompleteCompanySetupInput = {
  registrationId: string
  adminFullName: string
  adminEmail: string
  username: string
  user: User
}

export type CompleteCompanySetupResult = {
  company: Company
  branch: Branch
  adminUser: User
  setup: CompanySetup
}

export const completeCompanySetupFromRegistration = ({
  registrationId,
  adminFullName,
  adminEmail,
  username,
  user
}: CompleteCompanySetupInput): CompleteCompanySetupResult => {
  const registrations = loadBusinessRegistrations()
  const registration = registrations.find(item => item.id === registrationId)

  if(!registration) throw new Error('Başvuru bulunamadı.')
  if(registration.status !== 'Onaylandı') throw new Error('Sadece onaylanan başvurular kuruluma alınabilir.')

  const existingSetups = loadCompanySetups()
  if(existingSetups.some(setup => setup.registrationId === registration.id && setup.setupCompleted)){
    throw new Error('Bu başvuru için kurulum zaten tamamlanmış.')
  }

  const companies = loadCompanies()
  const tenants = loadTenants({ includeDeleted: true })
  const branches = loadBranches()
  const users = loadUsers({ allTenants: true })
  const now = new Date().toISOString()
  const temporaryPassword = generateTemporaryCompanyPassword()
  const companyId = createCompanySetupStorageId('company')
  const tenantId = createTenantStorageId('tenant')
  const branchId = createCompanySetupStorageId('branch')
  const adminUserId = createCompanySetupStorageId('user')
  const adminName = adminFullName.trim() || registration.ownerName
  const adminUsername = createUniqueCompanyAdminUsername(username.trim() || adminEmail.split('@')[0] || registration.businessName, users)
  const workspaceId = `workspace_${companyId}`

  const company: Company = normalizeCompany({
    id: companyId,
    tenantId,
    companyName: registration.businessName,
    legalName: registration.businessName,
    ownerName: registration.ownerName,
    authorizedPerson: registration.ownerName,
    authorizedPhone: registration.phone,
    authorizedEmail: registration.email,
    phone: registration.phone,
    email: registration.email,
    city: registration.city,
    district: registration.district,
    taxNumber: registration.taxNumber,
    taxOffice: registration.taxOffice,
    address: registration.address,
    status: 'Aktif',
    isApproved: true,
    approvedAt: now,
    approvedBy: user.id,
    workspaceId,
    defaultBranchId: branchId,
    createdAt: now,
    updatedAt: now
  })
  const tenant = normalizeTenant({
    id: tenantId,
    tenantCode: createTenantCodeForApplication(registration.businessName, tenants),
    tenantName: registration.businessName,
    ownerCompanyId: company.id,
    workspaceIds: [workspaceId],
    subscriptionIds: [],
    status: 'Aktif',
    createdAt: now,
    updatedAt: now,
    deletedAt: ''
  })

  const branch: Branch = normalizeBranch({
    id: branchId,
    tenantId,
    companyId: company.id,
    code: createNextBranchCode(branches),
    name: 'Merkez Şube',
    phone: registration.phone,
    email: registration.email,
    address: registration.address,
    city: registration.city,
    managerName: adminName,
    isActive: true,
    createdAt: now,
    updatedAt: now
  })

  const adminUser: User = {
    id: adminUserId,
    tenantId,
    companyId: company.id,
    fullName: adminName,
    username: adminUsername,
    password: temporaryPassword,
    role: 'Admin',
    active: true
  }

  const setup: CompanySetup = normalizeCompanySetup({
    id: createCompanySetupStorageId('company_setup'),
    tenantId,
    registrationId: registration.id,
    companyId: company.id,
    branchId: branch.id,
    adminUserId: adminUser.id,
    temporaryPassword,
    setupCompleted: true,
    installationCompleted: true,
    completedAt: now,
    createdAt: now,
    updatedAt: now
  })

  saveTenants([tenant, ...tenants])
  saveTenantSettings([createDefaultTenantSettings(tenant.id, now), ...loadTenantSettings().filter(settings => settings.tenantId !== tenant.id)])
  saveCompanies([company, ...companies])
  saveBranches([branch, ...branches])
  saveUsers([adminUser, ...users])
  saveCompanySetups([setup, ...existingSetups.filter(item => item.registrationId !== registration.id)])
  recordCompanyAuditEvent({
    company,
    eventType: 'COMPANY_CREATED',
    actorUserId: user.id,
    actorName: user.fullName || user.username,
    description: `${company.companyName} Company kaydı legacy kurulum sihirbazı ile oluşturuldu.`
  })
  recordTenantAuditEvent({
    tenant,
    eventType: 'TENANT_CREATED',
    actorUserId: user.id,
    actorName: user.fullName || user.username,
    description: `${tenant.tenantName} Tenant kaydı legacy kurulum sihirbazı ile oluşturuldu.`
  })

  addActionLog({
    operationType: 'Firma oluşturuldu',
    user,
    description: `${company.companyName} firması oluşturuldu. Firma ID: ${company.id}.`
  })
  addActionLog({
    operationType: 'Şube oluşturuldu',
    user,
    description: `${company.companyName} için ${branch.name} oluşturuldu. Şube ID: ${branch.id}.`
  })
  addActionLog({
    operationType: 'Admin kullanıcı oluşturuldu',
    user,
    description: `${company.companyName} için ${adminUser.username} admin kullanıcısı oluşturuldu.`
  })
  addActionLog({
    operationType: 'Kurulum tamamlandı',
    user,
    description: `${company.companyName} kurulumu tamamlandı. Geçici şifre üretildi.`
  })

  return {
    company,
    branch,
    adminUser,
    setup
  }
}

export type BusinessApplicationFormInput = {
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
  note?: string
}

export type BusinessApplicationApprovalResult = {
  application: BusinessApplication
  company: Company
  tenant: Tenant
  branch: Branch
  ownerUser: User
  companyUser: CompanyUser
  license: CompanyLicense
  subscription: UserSubscription
  setup: CompanySetup
  temporaryPassword: string
  firstLoginCredentials: FirstLoginCredentialDelivery
}

export type FirstLoginCredentialDelivery = {
  username: string
  temporaryPassword: string
  recipientEmail: string
  recipientName: string
  deliveryChannel: 'screen'
  emailDeliveryReady: boolean
  emailSubject: string
  emailBodyPreview: string
}

const publicApplicationUser: User = {
  id: 'public_business_application',
  fullName: 'İşletme Başvuru Formu',
  username: 'public_application',
  password: '',
  role: 'Admin',
  active: true
}

const normalizeApplicationInput = (input: BusinessApplicationFormInput): BusinessApplicationFormInput => ({
  primarySectorId: normalizePrimarySectorId(input.primarySectorId),
  companyName: input.companyName.trim(),
  ownerName: input.ownerName.trim(),
  phone: input.phone.trim(),
  email: input.email.trim(),
  taxNumber: input.taxNumber.trim(),
  taxOffice: input.taxOffice.trim(),
  city: input.city.trim(),
  district: input.district.trim(),
  address: input.address.trim(),
  note: String(input.note || '').trim()
})

const createBusinessApplicationError = (message: string) => new Error(message)

const validateBusinessApplicationInput = (input: BusinessApplicationFormInput) => {
  if(!input.companyName) throw createBusinessApplicationError('Firma adı zorunludur.')
  if(!input.ownerName) throw createBusinessApplicationError('Yetkili ad soyad zorunludur.')
  if(!input.phone) throw createBusinessApplicationError('Telefon zorunludur.')
  if(!input.email) throw createBusinessApplicationError('E-posta zorunludur.')
  if(!input.taxOffice) throw createBusinessApplicationError('Vergi dairesi zorunludur.')
  if(!input.taxNumber) throw createBusinessApplicationError('Vergi numarası zorunludur.')
  if(!input.city) throw createBusinessApplicationError('Şehir zorunludur.')
  if(!input.district) throw createBusinessApplicationError('İlçe zorunludur.')
  if(!input.address) throw createBusinessApplicationError('Adres zorunludur.')
}

const createTenantCodeForApplication = (companyName: string, tenants: Tenant[]) => {
  const clean = slugifySetupValue(companyName).replace(/\./g, '').toLocaleUpperCase('tr-TR')
  const prefix = (clean || 'TNT').slice(0, 3).padEnd(3, 'X')
  const existingCodes = new Set(tenants.map(tenant => tenant.tenantCode.toLocaleUpperCase('tr-TR')))
  let index = tenants.length + 1
  let code = `${prefix}${String(index).padStart(3, '0')}`

  while(existingCodes.has(code)){
    index += 1
    code = `${prefix}${String(index).padStart(3, '0')}`
  }

  return code
}

const upsertApplication = (application: BusinessApplication) => {
  const applications = loadBusinessApplications()
  const nextApplications = applications.some(item => item.id === application.id)
    ? applications.map(item => item.id === application.id ? application : item)
    : [application, ...applications]
  saveBusinessApplications(nextApplications)
  return nextApplications
}

const findPendingCompanyForApplication = (application: BusinessApplication, companies = loadCompanies({ allTenants: true, includeDeleted: true })) => {
  if(application.companyId){
    const company = companies.find(item => item.id === application.companyId)
    if(company) return company
  }

  const taxNumber = application.taxNumber.trim()
  if(!taxNumber) return undefined

  return companies.find(company => (
    !company.deletedAt
    && !company.isApproved
    && company.taxNumber === taxNumber
  ))
}

const assertUniqueCompanyTaxNumberForApplication = (taxNumber: string, companies = loadCompanies({ allTenants: true, includeDeleted: true })) => {
  const normalizedTaxNumber = taxNumber.trim()
  if(!normalizedTaxNumber) return

  if(companies.some(company => !company.deletedAt && company.taxNumber === normalizedTaxNumber)){
    throw createBusinessApplicationError('Bu vergi numarası ile kayıtlı bir işletme zaten mevcut.')
  }
}

const createPendingCompanyFromApplication = (
  application: BusinessApplication,
  now: string,
  companies = loadCompanies({ allTenants: true, includeDeleted: true })
) => {
  assertUniqueCompanyTaxNumberForApplication(application.taxNumber, companies)

  const companyId = application.companyId || createCompanySetupStorageId('company')
  return normalizeCompany({
    id: companyId,
    primarySectorId: application.primarySectorId,
    companyName: application.companyName,
    legalName: application.companyName,
    ownerName: application.ownerName,
    authorizedPerson: application.ownerName,
    authorizedPhone: application.phone,
    authorizedEmail: application.email,
    phone: application.phone,
    email: application.email,
    city: application.city,
    district: application.district,
    taxNumber: application.taxNumber,
    taxOffice: application.taxOffice,
    address: application.address,
    status: 'Başvuru Bekliyor',
    isApproved: false,
    approvedAt: '',
    approvedBy: '',
    workspaceId: `workspace_${companyId}`,
    defaultBranchId: '',
    tenantId: '',
    subscriptionId: '',
    licenseStart: '',
    licenseEnd: '',
    createdAt: now,
    updatedAt: now,
    deletedAt: ''
  })
}

export const submitBusinessApplication = (input: BusinessApplicationFormInput) => {
  const normalized = normalizeApplicationInput(input)
  validateBusinessApplicationInput(normalized)

  const now = new Date().toISOString()
  const companies = loadCompanies({ allTenants: true, includeDeleted: true })
  const companyId = createCompanySetupStorageId('company')
  const application = normalizeBusinessApplication({
    id: createTenantStorageId('business_application'),
    companyId,
    ...normalized,
    status: 'Beklemede',
    approvalNote: '',
    createdAt: now,
    updatedAt: now
  })
  const company = createPendingCompanyFromApplication(application, now, companies)

  saveCompanies([company, ...companies])
  saveBusinessApplications([application, ...loadBusinessApplications()])
  recordCompanyAuditEvent({
    company,
    eventType: 'COMPANY_CREATED',
    actorUserId: publicApplicationUser.id,
    actorName: publicApplicationUser.fullName,
    description: `${company.companyName} Company kaydı işletme başvurusu ile oluşturuldu.`
  })

  if(normalized.note){
    saveApplicationNotes([
      normalizeApplicationNote({
        id: createTenantStorageId('application_note'),
        applicationId: application.id,
        note: normalized.note,
        createdBy: normalized.ownerName || normalized.companyName,
        createdAt: now
      }),
      ...loadApplicationNotes()
    ])
  }

  addActionLog({
    operationType: 'Başvuru oluşturuldu',
    user: publicApplicationUser,
    tableId: application.id,
    tableName: application.companyName,
    description: `${application.companyName} işletme başvurusu dış form üzerinden oluşturuldu. Başlangıç kapsamı: çekirdek sistem modülleri.`
  })
  recordBusinessApplicationNotification({
    id: application.id,
    companyName: application.companyName,
    ownerName: application.ownerName
  })

  return application
}

export const addApplicationNote = (applicationId: string, note: string, user: User) => {
  const normalizedNote = note.trim()
  if(!normalizedNote) throw createBusinessApplicationError('Not zorunludur.')

  const application = loadBusinessApplications().find(item => item.id === applicationId)
  if(!application) throw createBusinessApplicationError('Başvuru bulunamadı.')

  const createdNote = normalizeApplicationNote({
    id: createTenantStorageId('application_note'),
    applicationId,
    note: normalizedNote,
    createdBy: user.fullName || user.username,
    createdAt: new Date().toISOString()
  })
  saveApplicationNotes([createdNote, ...loadApplicationNotes()])
  return createdNote
}

export const markBusinessApplicationInReview = (applicationId: string, user: User) => {
  const application = loadBusinessApplications().find(item => item.id === applicationId)
  if(!application) throw createBusinessApplicationError('Başvuru bulunamadı.')
  if(application.status === 'Onaylandı' || application.status === 'Reddedildi') return application

  const updatedApplication = normalizeBusinessApplication({
    ...application,
    status: 'İnceleniyor',
    updatedAt: new Date().toISOString()
  })
  upsertApplication(updatedApplication)
  addActionLog({
    operationType: 'Başvuru incelendi',
    user,
    tableId: updatedApplication.id,
    tableName: updatedApplication.companyName,
    description: `${updatedApplication.companyName} başvurusu incelemeye alındı.`
  })
  return updatedApplication
}

export const rejectBusinessApplication = (applicationId: string, reason: string, user: User) => {
  const rejectionReason = reason.trim()
  if(!rejectionReason) throw createBusinessApplicationError('Red sebebi zorunludur.')

  const application = loadBusinessApplications().find(item => item.id === applicationId)
  if(!application) throw createBusinessApplicationError('Başvuru bulunamadı.')
  if(application.status === 'Onaylandı') throw createBusinessApplicationError('Onaylanan başvuru reddedilemez.')

  const updatedApplication = normalizeBusinessApplication({
    ...application,
    status: 'Reddedildi',
    approvalNote: rejectionReason,
    updatedAt: new Date().toISOString()
  })
  upsertApplication(updatedApplication)
  addApplicationNote(applicationId, `Red sebebi: ${rejectionReason}`, user)
  addActionLog({
    operationType: 'Başvuru reddedildi',
    user,
    tableId: updatedApplication.id,
    tableName: updatedApplication.companyName,
    description: `${updatedApplication.companyName} başvurusu reddedildi. Red sebebi: ${rejectionReason}.`
  })
  return updatedApplication
}

export const approveBusinessApplication = (applicationId: string, approvalNote: string, user: User): BusinessApplicationApprovalResult => {
  const applications = loadBusinessApplications()
  const application = applications.find(item => item.id === applicationId)
  if(!application) throw createBusinessApplicationError('Başvuru bulunamadı.')
  if(application.status === 'Onaylandı') throw createBusinessApplicationError('Başvuru zaten onaylanmış.')
  if(application.status === 'Reddedildi') throw createBusinessApplicationError('Reddedilen başvuru onaylanamaz.')

  const now = new Date().toISOString()
  const companies = loadCompanies({ allTenants: true, includeDeleted: true })
  const existingCompany = findPendingCompanyForApplication(application, companies)
  if(!existingCompany){
    assertUniqueCompanyTaxNumberForApplication(application.taxNumber, companies)
  }
  const companyId = existingCompany?.id || createCompanySetupStorageId('company')
  const tenants = loadTenants({ includeDeleted: true })
  const existingTenant = tenants.find(tenant => !tenant.deletedAt && (tenant.ownerCompanyId === companyId || tenant.companyId === companyId))
  const tenantId = existingTenant?.id || createTenantStorageId('tenant')
  const branchId = createCompanySetupStorageId('branch')
  const authUserId = createCompanySetupStorageId('user')
  const companyUserId = createCompanySetupStorageId('company_user')
  const licenseId = createCompanySetupStorageId('company_license')
  const subscriptionId = createCompanySetupStorageId('user_subscription')
  const temporaryPassword = generateTemporaryCompanyPassword()
  const ownerUsername = createBusinessApplicationOwnerUsername(application.email)
  const allUsers = loadUsers({ allTenants: true })
  if(allUsers.some(item => item.username.toLowerCase() === ownerUsername)){
    throw createBusinessApplicationError('Bu e-posta ile kullanıcı zaten mevcut.')
  }
  const startDate = new Date(now).toLocaleDateString('sv-SE')
  const trialEndDate = ''
  const endDate = addLicenseDays(startDate, 365)
  const ownerName = application.ownerName || application.companyName
  const tenantCode = existingTenant?.tenantCode || createTenantCodeForApplication(application.companyName, tenants)
  const workspaceId = existingCompany?.workspaceId || `workspace_${companyId}`

  const company = normalizeCompany({
    ...existingCompany,
    id: companyId,
    tenantId,
    primarySectorId: application.primarySectorId,
    companyName: application.companyName,
    legalName: existingCompany?.legalName || application.companyName,
    ownerName,
    authorizedPerson: ownerName,
    authorizedPhone: application.phone,
    authorizedEmail: application.email,
    phone: application.phone,
    email: application.email,
    city: application.city,
    district: application.district,
    taxNumber: application.taxNumber,
    taxOffice: application.taxOffice,
    address: application.address,
    status: 'Aktif',
    isApproved: true,
    approvedAt: now,
    approvedBy: user.id,
    workspaceId,
    defaultBranchId: branchId,
    subscriptionId,
    licenseStart: startDate,
    licenseEnd: endDate,
    deletedAt: '',
    createdAt: existingCompany?.createdAt || now,
    updatedAt: now
  })
  const tenant = normalizeTenant({
    ...existingTenant,
    id: tenantId,
    tenantCode,
    tenantName: application.companyName,
    ownerCompanyId: companyId,
    workspaceIds: [workspaceId],
    subscriptionIds: [subscriptionId],
    status: 'Aktif',
    deletedAt: '',
    createdAt: existingTenant?.createdAt || now,
    updatedAt: now
  })
  const branch = normalizeBranch({
    id: branchId,
    tenantId,
    companyId,
    code: createNextBranchCode(loadBranches()),
    name: 'Merkez Şube',
    phone: application.phone,
    email: application.email,
    address: application.address,
    city: application.city,
    district: application.district,
    managerName: ownerName,
    isActive: true,
    createdAt: now,
    updatedAt: now
  })
  const ownerUser: User = normalizeUser({
    id: authUserId,
    tenantId,
    companyId,
    fullName: ownerName,
    username: ownerUsername,
    password: temporaryPassword,
    role: 'Admin',
    active: true
  })
  const companyUser = normalizeCompanyUser({
    id: companyUserId,
    tenantId,
    companyId,
    fullName: ownerName,
    username: ownerUser.username,
    email: application.email,
    phone: application.phone,
    role: 'Firma Sahibi',
    status: 'Aktif',
    lastLogin: '',
    createdAt: now,
    updatedAt: now
  })
  const license = normalizeCompanyLicense({
    id: licenseId,
    tenantId,
    companyId,
    packageId: 'core_workspace',
    status: 'Aktif',
    startDate,
    endDate,
    isTrial: false,
    trialEndDate,
    lastRenewalDate: '',
    nextRenewalDate: endDate,
    createdAt: now,
    updatedAt: now
  })
  const subscription = normalizeUserSubscription({
    id: subscriptionId,
    tenantId,
    userId: companyUser.id,
    companyLicenseId: license.id,
    status: 'Aktif',
    assignedAt: startDate,
    expiresAt: endDate,
    createdAt: now,
    updatedAt: now
  })
  const setup = normalizeCompanySetup({
    id: createCompanySetupStorageId('company_setup'),
    tenantId,
    registrationId: application.id,
    companyId,
    branchId,
    adminUserId: ownerUser.id,
    temporaryPassword,
    setupCompleted: true,
    installationCompleted: false,
    completedAt: now,
    createdAt: now,
    updatedAt: now
  })
  const approvedApplication = normalizeBusinessApplication({
    ...application,
    companyId,
    status: 'Onaylandı',
    approvalNote: approvalNote.trim(),
    updatedAt: now
  })

  const firstLoginCredentials: FirstLoginCredentialDelivery = {
    username: ownerUser.username,
    temporaryPassword,
    recipientEmail: application.email,
    recipientName: ownerName,
    deliveryChannel: 'screen',
    emailDeliveryReady: false,
    emailSubject: 'MIYOP İşletme Çalışma Alanı ilk giriş bilgileriniz',
    emailBodyPreview: `${ownerName} için MIYOP ilk giriş bilgileri hazır. Kullanıcı adı: ${ownerUser.username}. Geçici şifre: ${temporaryPassword}.`
  }

  saveTenants(existingTenant
    ? tenants.map(item => item.id === existingTenant.id ? tenant : item)
    : [tenant, ...tenants])
  recordTenantAuditEvent({
    tenant,
    eventType: existingTenant ? 'TENANT_UPDATED' : 'TENANT_CREATED',
    actorUserId: user.id,
    actorName: user.fullName || user.username,
    description: existingTenant
      ? `${tenant.tenantName} Tenant kaydı başvuru onayı sırasında güncellendi.`
      : `${tenant.tenantName} Tenant kaydı başvuru onayı sırasında oluşturuldu.`
  })
  saveTenantSettings([createDefaultTenantSettings(tenant.id, now), ...loadTenantSettings().filter(settings => settings.tenantId !== tenant.id)])
  saveCompanies(existingCompany
    ? companies.map(item => item.id === existingCompany.id ? company : item)
    : [company, ...companies])
  saveBranches([branch, ...loadBranches()])
  saveUsers([ownerUser, ...allUsers])
  saveCompanyUsers([companyUser, ...loadCompanyUsers()])
  saveCompanyLicenses([license, ...loadCompanyLicenses()])
  saveUserSubscriptions([subscription, ...loadUserSubscriptions()])
  saveCompanySetups([setup, ...loadCompanySetups().filter(item => item.registrationId !== application.id)])
  upsertApplication(approvedApplication)
  if(approvalNote.trim()) addApplicationNote(application.id, approvalNote.trim(), user)

  addActionLog({
    operationType: 'Başvuru onaylandı',
    user,
    tenantId,
    tableId: approvedApplication.id,
    tableName: approvedApplication.companyName,
    description: `${approvedApplication.companyName} başvurusu onaylandı. Çalışma alanı çekirdek sistem modülleri ile oluşturuldu.`
  })
  addActionLog({
    operationType: 'Firma otomatik oluşturuldu',
    user,
    tenantId,
    tableId: company.id,
    tableName: company.companyName,
    description: `${company.companyName} firması başvuru onayıyla otomatik oluşturuldu.`
  })
  if(!existingCompany){
    recordCompanyAuditEvent({
      company,
      eventType: 'COMPANY_CREATED',
      actorUserId: user.id,
      actorName: user.fullName || user.username,
      description: `${company.companyName} Company kaydı eski başvuru onayı sırasında oluşturuldu.`
    })
  }
  recordCompanyAuditEvent({
    company,
    eventType: 'COMPANY_APPROVED',
    actorUserId: user.id,
    actorName: user.fullName || user.username,
    description: `${company.companyName} Company kaydı onaylandı ve tenant/workspace bağlantıları oluşturuldu.`
  })
  addActionLog({
    operationType: 'Tenant otomatik oluşturuldu',
    user,
    tenantId,
    tableId: tenant.id,
    tableName: tenant.tenantName,
    description: `${tenant.tenantName} için ${tenant.tenantCode} tenant kaydı otomatik oluşturuldu.`
  })
  addActionLog({
    operationType: 'Lisans otomatik oluşturuldu',
    user,
    tenantId,
    tableId: license.id,
    tableName: company.companyName,
    description: `${company.companyName} için çekirdek işletme çalışma alanı lisansı otomatik oluşturuldu. İş modülü otomatik lisanslanmadı.`
  })

  return {
    application: approvedApplication,
    company,
    tenant,
    branch,
    ownerUser,
    companyUser,
    license,
    subscription,
    setup,
    temporaryPassword,
    firstLoginCredentials
  }
}

export type BranchMigrationResult = {
  label: string
  count: number
}

const migrateBranchScopedKey = <T extends BranchScopedRecord>(
  key: string,
  label: string,
  normalizer: (item: Partial<T>) => T,
  predicate?: (item: T) => boolean
): BranchMigrationResult | null => {
  if(localStorage.getItem(key) === null) return null

  const rawItems = readJson<Partial<T>[]>(key, [])
  const normalizedItems = normalizeBranchScopedItems(rawItems, normalizer, DEFAULT_BRANCH_ID, predicate)
  const before = JSON.stringify(rawItems)
  const after = JSON.stringify(normalizedItems)

  if(before === after) return null

  localStorage.setItem(key, after)
  return {
    label,
    count: normalizedItems.length
  }
}

export const migrateBranchScopedData = (user?: User): BranchMigrationResult[] => {
  const categories = loadCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_CATEGORY_ID
  const stockCategories = loadStockCategories()
  const fallbackStockCategoryId = stockCategories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)?.id || stockCategories[0]?.id || DEFAULT_STOCK_CATEGORY_ID

  const results = [
    migrateBranchScopedKey(KEY_PRODUCTS, 'Products', item => normalizeProduct(item, fallbackCategoryId)),
    migrateBranchScopedKey(KEY_STOCK_ITEMS, 'StockItems', item => normalizeStockItem(item, fallbackStockCategoryId)),
    migrateBranchScopedKey(KEY_STOCK_MOVEMENTS, 'StockMovements', normalizeStockMovement),
    migrateBranchScopedKey(KEY_STOCK_EXPIRY_LOTS, 'StockExpiryLots', normalizeStockExpiryLot, lot => Boolean(lot.stockItemId)),
    migrateBranchScopedKey(KEY_STOCK_WASTE_RECORDS, 'WasteRecords', normalizeStockWasteRecord, record => Boolean(record.stockItemId && record.stockMovementId)),
    migrateBranchScopedKey(KEY_RECIPES, 'Recipes', normalizeRecipe),
    migrateBranchScopedKey(KEY_STOCK_DEDUCTION_BATCHES, 'StockDeductionBatches', normalizeStockDeductionBatch),
    migrateBranchScopedKey(KEY_TABLES, 'Tables', normalizeTableState),
    migrateBranchScopedKey(KEY_CLOSED, 'ClosedBills', normalizeClosedBill),
    migrateBranchScopedKey(KEY_KITCHEN, 'Orders', normalizeKitchenOrder),
    migrateBranchScopedKey(KEY_QR_REQUESTS, 'QRRequests', normalizeQRRequest),
    migrateBranchScopedKey(KEY_QR_REQUEST_HISTORY, 'QRRequestHistory', normalizeQRRequestHistory),
    migrateBranchScopedKey(KEY_EMPLOYEES, 'Employees', normalizeEmployee),
    migrateBranchScopedKey(KEY_SHIFTS, 'Shifts', normalizeShift),
    migrateBranchScopedKey(KEY_ATTENDANCES, 'Attendance', normalizeAttendance),
    migrateBranchScopedKey(KEY_EMPLOYEE_PERFORMANCES, 'EmployeePerformance', normalizeEmployeePerformance),
    migrateBranchScopedKey(KEY_EMPLOYEE_BONUSES, 'EmployeeBonus', normalizeEmployeeBonus),
    migrateBranchScopedKey(KEY_EMPLOYEE_AUDITS, 'EmployeeAudit', normalizeEmployeeAudit),
    migrateBranchScopedKey(KEY_CURRENT_ACCOUNTS, 'CurrentAccounts', normalizeCurrentAccount),
    migrateBranchScopedKey(KEY_CREDIT_TRANSACTIONS, 'CreditTransactions', normalizeCreditTransaction),
    migrateBranchScopedKey(KEY_COLLECTION_TRANSACTIONS, 'CollectionTransactions', normalizeCollectionTransaction),
    migrateBranchScopedKey(KEY_SUPPLIER_DEBTS, 'SupplierDebts', normalizeSupplierDebt),
    migrateBranchScopedKey(KEY_SUPPLIER_PAYMENTS, 'SupplierPayments', normalizeSupplierPayment),
    migrateBranchScopedKey(KEY_CASH_TRANSACTIONS, 'CashTransactions', normalizeCashTransaction),
    migrateBranchScopedKey(KEY_CASH_CLOSINGS, 'CashClosings', normalizeCashClosing),
    migrateBranchScopedKey(KEY_INCOME_EXPENSES, 'IncomeExpenseRecords', normalizeIncomeExpense),
    migrateBranchScopedKey(KEY_CASH_TRANSFERS, 'CashTransfers', normalizeCashTransfer)
  ].filter((item): item is BranchMigrationResult => Boolean(item))

  if(results.length > 0 && user){
    const totalCount = results.reduce((sum, item) => sum + item.count, 0)

    addActionLog({
      operationType: 'Veri şubeye bağlandı',
      user,
      description: `${results.length} veri grubu ve ${totalCount} kayıt Merkez Şube ile ilişkilendirildi: ${results.map(item => `${item.label} (${item.count})`).join(', ')}.`
    })
  }

  return results
}

const getLatestCriticalStockEvent = (stockItemId: string) => {
  return loadCriticalStockEvents()
    .filter(event => event.stockItemId === stockItemId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
}

const buildCriticalStockActionDescription = (event: CriticalStockEvent) => {
  const stockChange = `${formatStockQuantity(event.previousQty, event.unit)} -> ${formatStockQuantity(event.nextQty, event.unit)}`
  const level = formatStockQuantity(event.minQty, event.unit)

  if(event.eventType === 'entered'){
    return `${event.stockItemName} kritik stok seviyesine düştü. Stok: ${stockChange}. Kritik seviye: ${level}. Kaynak: ${event.trigger}.${event.note ? ` ${event.note}` : ''}`
  }

  return `${event.stockItemName} kritik stoktan çıktı. Stok: ${stockChange}. Kritik seviye: ${level}. Kaynak: ${event.trigger}.${event.note ? ` ${event.note}` : ''}`
}

export const recordCriticalStockTransition = ({
  before,
  after,
  user,
  trigger,
  movementId,
  tableId,
  tableName,
  note
}: {
  before?: StockItem
  after: StockItem
  user: User
  trigger: CriticalStockTrigger
  movementId?: string
  tableId?: string
  tableName?: string
  note?: string
}) => {
  const beforeCritical = before ? isCriticalStock(before) : false
  const afterCritical = isCriticalStock(after)

  if(beforeCritical === afterCritical) return undefined

  const eventType: CriticalStockEventType = afterCritical ? 'entered' : 'resolved'
  const latestEvent = getLatestCriticalStockEvent(after.id)

  if(latestEvent?.eventType === eventType) return undefined

  const timestamp = new Date().toISOString()
  const event: CriticalStockEvent = {
    id: `critical_stock_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    stockItemId: after.id,
    stockItemName: after.name,
    eventType,
    trigger,
    previousQty: before?.currentQty ?? after.currentQty,
    nextQty: after.currentQty,
    minQty: after.minQty,
    unit: after.unit,
    userId: user.id,
    userName: user.fullName || user.username,
    timestamp,
    movementId,
    tableId,
    tableName,
    note: note?.trim() || ''
  }

  addCriticalStockEvent(event)
  addActionLog({
    operationType: eventType === 'entered' ? 'Kritik stok uyarısı oluştu' : 'Kritik stoktan çıkıldı',
    user,
    tableId,
    tableName,
    description: buildCriticalStockActionDescription(event)
  })

  return event
}

const getStockMovementLogType = (movement: StockMovement): ActionLogType => {
  if(movement.reversesMovementId) return 'Stok ters hareketi oluşturuldu'
  if(movement.type === 'Çıkış') return 'Stok çıkışı yapıldı'
  if(movement.type === 'Sayım Düzeltme') return 'Stok sayım düzeltmesi yapıldı'
  return 'Stok girişi yapıldı'
}

const getCriticalStockTriggerFromMovement = (movement: StockMovement): CriticalStockTrigger => {
  if(movement.reversesMovementId || movement.reverseOfBatchId || movement.reason === 'Ters Hareket') return 'Ters Hareket'
  if(movement.source === 'Adisyon' && movement.deductionBatchId) return 'Otomatik Stok Düşümü'
  return 'Stok Hareketi'
}

const formatStockQty = (value: number, unit: StockUnit) => {
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
}

const roundStockQty = (value: number) => {
  return Math.round((value + Number.EPSILON) * 1000000) / 1000000
}

type ExpiryConsumptionMode = 'fefo' | 'expired_only'

const createStorageId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const getBranchNameById = (branchId: string, branches = loadBranches()) => {
  return branches.find(branch => branch.id === branchId)?.name || branchId
}

const normalizeMatchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const findTargetTransferStockItem = (items: StockItem[], sourceItem: StockItem, targetBranchId: string) => {
  const targetItems = items.filter(item => item.branchId === targetBranchId && item.active)
  const sourceSku = normalizeMatchText(sourceItem.sku || '')
  const sourceBarcode = normalizeMatchText(sourceItem.barcode || '')
  const sourceName = normalizeMatchText(sourceItem.name)

  return targetItems.find(item => sourceSku && normalizeMatchText(item.sku || '') === sourceSku)
    || targetItems.find(item => sourceBarcode && normalizeMatchText(item.barcode || '') === sourceBarcode)
    || targetItems.find(item => (
      normalizeMatchText(item.name) === sourceName
      && item.unit === sourceItem.unit
      && item.categoryId === sourceItem.categoryId
    ))
}

const createTargetTransferStockItem = (sourceItem: StockItem, targetBranchId: string, now: string): StockItem => ({
  ...sourceItem,
  id: createStorageId('stock_transfer_target'),
  branchId: targetBranchId,
  currentQty: 0,
  active: true,
  createdAt: now,
  updatedAt: now,
  lastCostUpdatedAt: sourceItem.lastCostUpdatedAt || now
})

const buildTransferStockMovement = ({
  stockItem,
  type,
  qty,
  previousQty,
  nextQty,
  transfer,
  counterBranchName,
  user,
  now
}: {
  stockItem: StockItem
  type: StockMovementType
  qty: number
  previousQty: number
  nextQty: number
  transfer: BranchStockTransfer
  counterBranchName: string
  user: User
  now: string
}) => {
  const unitCost = getStockAverageCost(stockItem)

  const movement: StockMovement = {
    id: createStorageId('stock_move'),
    branchId: stockItem.branchId,
    stockItemId: stockItem.id,
    stockItemName: stockItem.name,
    type,
    source: 'Transfer',
    reason: 'Diğer',
    qty,
    unit: stockItem.unit,
    previousQty,
    nextQty,
    currency: getStockCurrency(stockItem),
    unitCost: roundCost(unitCost),
    totalCost: roundCost(qty * unitCost),
    previousAverageCost: roundCost(unitCost),
    nextAverageCost: roundCost(unitCost),
    previousStockValue: roundCost(Math.max(0, previousQty) * unitCost),
    nextStockValue: roundCost(Math.max(0, nextQty) * unitCost),
    supplierName: '',
    invoiceNo: transfer.transferNo,
    description: `${transfer.transferNo} şubeler arası stok transferi. Karşı şube: ${counterBranchName}.`,
    movementDate: `${transfer.transferDate}T00:00:00.000Z`,
    createdAt: now,
    createdByUserId: user.id,
    createdByFullName: user.fullName || user.username,
    sourceEntityType: 'BranchStockTransfer',
    sourceEntityId: transfer.id
  }

  return normalizeStockMovement(movement)
}

const recordTransferStockMovementAudit = (movement: StockMovement, before: StockItem, after: StockItem, user: User, now: string) => {
  addStockMovementAuditEvent({
    id: createStorageId('stock_audit'),
    movementId: movement.id,
    stockItemId: movement.stockItemId,
    eventType: 'created',
    userId: user.id,
    userName: user.fullName || user.username,
    timestamp: now,
    before,
    after,
    note: `${movement.stockItemName}: Transfer kaynaklı ${movement.type} ${formatStockQty(movement.qty, movement.unit)}. ${formatStockQty(before.currentQty, movement.unit)} -> ${formatStockQty(after.currentQty, movement.unit)}.`
  })
}

const updateBranchStockTransferStatus = (
  transferId: string,
  status: BranchStockTransferStatus,
  user: User,
  description: (transfer: BranchStockTransfer, branches: Branch[]) => string,
  allowedStatuses: BranchStockTransferStatus[]
) => {
  const transfers = loadBranchStockTransfers()
  const transfer = transfers.find(item => item.id === transferId)

  if(!transfer) throw new Error('Transfer kaydı bulunamadı.')
  if(!allowedStatuses.includes(transfer.status)){
    throw new Error(`Bu transfer ${transfer.status} durumundayken işlem yapılamaz.`)
  }

  const now = new Date().toISOString()
  const updatedTransfer: BranchStockTransfer = {
    ...transfer,
    status,
    updatedAt: now
  }

  saveBranchStockTransfers(transfers.map(item => item.id === transfer.id ? updatedTransfer : item))
  const operationType: ActionLogType = status === 'Onaylandı'
    ? 'Transfer onaylandı'
    : 'Transfer iptal edildi'
  const branches = loadBranches()

  addActionLog({
    operationType,
    user,
    description: description(updatedTransfer, branches)
  })

  return updatedTransfer
}

export const approveBranchStockTransfer = (transferId: string, user: User) => {
  return updateBranchStockTransferStatus(
    transferId,
    'Onaylandı',
    user,
    (transfer, branches) => `${transfer.transferNo} transferi onaylandı. Gönderen: ${getBranchNameById(transfer.sourceBranchId, branches)}. Alan: ${getBranchNameById(transfer.targetBranchId, branches)}.`,
    ['Bekliyor']
  )
}

export const cancelBranchStockTransfer = (transferId: string, user: User) => {
  return updateBranchStockTransferStatus(
    transferId,
    'İptal Edildi',
    user,
    (transfer, branches) => `${transfer.transferNo} transferi iptal edildi. Gönderen: ${getBranchNameById(transfer.sourceBranchId, branches)}. Alan: ${getBranchNameById(transfer.targetBranchId, branches)}.`,
    ['Bekliyor', 'Onaylandı']
  )
}

export const completeBranchStockTransfer = (transferId: string, user: User) => {
  const transfers = loadBranchStockTransfers()
  const transfer = transfers.find(item => item.id === transferId)

  if(!transfer) throw new Error('Transfer kaydı bulunamadı.')
  if(transfer.status !== 'Onaylandı') throw new Error('Transfer tamamlanmadan önce onaylanmalıdır.')
  if(transfer.sourceBranchId === transfer.targetBranchId) throw new Error('Gönderen ve alan şube aynı olamaz.')
  if(transfer.items.length === 0) throw new Error('Transferde ürün bulunmuyor.')

  const branches = loadBranches()
  const sourceBranchName = getBranchNameById(transfer.sourceBranchId, branches)
  const targetBranchName = getBranchNameById(transfer.targetBranchId, branches)
  const now = new Date().toISOString()
  let nextStockItems = loadAllStockItems()
  const movements: StockMovement[] = []
  const createdTargetItems: StockItem[] = []

  transfer.items.forEach(transferItem => {
    const quantity = roundStockQty(transferItem.quantity)
    const sourceItem = nextStockItems.find(item => item.id === transferItem.stockItemId && item.branchId === transfer.sourceBranchId)

    if(!sourceItem) throw new Error(`${transferItem.stockItemName} stok kartı gönderen şubede bulunamadı.`)
    if(quantity <= 0) throw new Error(`${sourceItem.name} için transfer miktarı sıfırdan büyük olmalıdır.`)
    if(sourceItem.currentQty < quantity){
      throw new Error(`${sourceItem.name} için mevcut stok yetersiz. Mevcut: ${formatStockQty(sourceItem.currentQty, sourceItem.unit)}, transfer: ${formatStockQty(quantity, sourceItem.unit)}.`)
    }

    const sourcePreviousQty = sourceItem.currentQty
    const sourceAfter: StockItem = {
      ...sourceItem,
      currentQty: roundStockQty(sourceItem.currentQty - quantity),
      updatedAt: now
    }
    const sourceMovement = buildTransferStockMovement({
      stockItem: sourceItem,
      type: 'Çıkış',
      qty: quantity,
      previousQty: sourcePreviousQty,
      nextQty: sourceAfter.currentQty,
      transfer,
      counterBranchName: targetBranchName,
      user,
      now
    })

    nextStockItems = nextStockItems.map(item => item.id === sourceItem.id ? sourceAfter : item)
    recordTransferStockMovementAudit(sourceMovement, sourceItem, sourceAfter, user, now)
    recordCriticalStockTransition({
      before: sourceItem,
      after: sourceAfter,
      user,
      trigger: 'Stok Hareketi',
      movementId: sourceMovement.id,
      note: `${transfer.transferNo} şubeler arası transfer çıkışı.`
    })
    movements.push(sourceMovement)

    const latestSourceItem = sourceAfter
    const matchedTargetItem = findTargetTransferStockItem(nextStockItems, latestSourceItem, transfer.targetBranchId)
    const targetItem = matchedTargetItem || createTargetTransferStockItem(latestSourceItem, transfer.targetBranchId, now)
    if(!matchedTargetItem) createdTargetItems.push(targetItem)

    const targetPreviousQty = targetItem.currentQty
    const incomingUnitCost = getStockAverageCost(latestSourceItem)
    const targetPreviousAverageCost = getStockAverageCost(targetItem)
    const nextAverageCost = calculateWeightedAverageCost({
      previousQty: targetPreviousQty,
      previousAverageCost: targetPreviousAverageCost,
      incomingQty: quantity,
      incomingUnitCost
    })
    const targetAfter: StockItem = {
      ...targetItem,
      currentQty: roundStockQty(targetItem.currentQty + quantity),
      averageCost: roundCost(nextAverageCost),
      currency: getStockCurrency(targetItem) || getStockCurrency(latestSourceItem),
      unitPurchasePrice: targetItem.unitPurchasePrice ?? latestSourceItem.unitPurchasePrice,
      lastPurchasePrice: targetItem.lastPurchasePrice ?? latestSourceItem.lastPurchasePrice,
      lastCostUpdatedAt: now,
      updatedAt: now
    }
    const targetMovement = buildTransferStockMovement({
      stockItem: targetItem,
      type: 'Giriş',
      qty: quantity,
      previousQty: targetPreviousQty,
      nextQty: targetAfter.currentQty,
      transfer,
      counterBranchName: sourceBranchName,
      user,
      now
    })

    nextStockItems = matchedTargetItem
      ? nextStockItems.map(item => item.id === targetItem.id ? targetAfter : item)
      : [targetAfter, ...nextStockItems]
    recordTransferStockMovementAudit(targetMovement, targetItem, targetAfter, user, now)
    recordCriticalStockTransition({
      before: targetItem,
      after: targetAfter,
      user,
      trigger: 'Stok Hareketi',
      movementId: targetMovement.id,
      note: `${transfer.transferNo} şubeler arası transfer girişi.`
    })
    movements.push(targetMovement)
  })

  const updatedTransfer: BranchStockTransfer = {
    ...transfer,
    status: 'Tamamlandı',
    updatedAt: now
  }

  saveAllStockItems(nextStockItems)
  saveAllStockMovements([...movements, ...loadAllStockMovements()])
  saveBranchStockTransfers(transfers.map(item => item.id === transfer.id ? updatedTransfer : item))
  addActionLog({
    operationType: 'Transfer tamamlandı',
    user,
    description: `${transfer.transferNo} transferi tamamlandı. ${sourceBranchName} -> ${targetBranchName}. Ürün sayısı: ${transfer.items.length}.`
  })

  return { transfer: updatedTransfer, movements, createdTargetItems }
}

const buildLotCode = (stockItem: StockItem, expiryDate?: string) => {
  const stockCode = (stockItem.sku || stockItem.name || 'LOT')
    .toLocaleUpperCase('tr-TR')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) || 'LOT'
  const dateCode = expiryDate ? expiryDate.replace(/-/g, '') : 'NOSKT'
  const suffix = Date.now().toString(36).toLocaleUpperCase('tr-TR').slice(-5)

  return `${stockCode}-${dateCode}-${suffix}`
}

const getExpiryTriggerFromMovement = (movement: StockMovement): StockExpiryTrigger => {
  if(movement.reversesMovementId || movement.reverseOfBatchId || movement.reason === 'Ters Hareket') return 'Ters Hareket'
  if(movement.source === 'Fire' || movement.reason === 'Fire') return 'Fire'
  if(movement.source === 'Adisyon' && movement.deductionBatchId) return 'Otomatik Stok Düşümü'
  if(movement.type === 'Sayım Düzeltme') return 'Sayım Düzeltme'
  if(movement.type === 'Çıkış') return 'Stok Çıkışı'
  return 'Stok Girişi'
}

const getExpiryActionLogType = (eventType: StockExpiryEventType): ActionLogType => {
  if(eventType === 'lot_consumed') return 'SKT lotu tüketildi'
  if(eventType === 'lot_wasted') return 'Kayıp lottan düşüldü'
  if(eventType === 'lot_returned') return 'SKT lotu iade edildi'
  if(eventType === 'lot_adjusted') return 'SKT lotu güncellendi'
  if(eventType === 'near_expiry') return 'SKT yaklaşan uyarısı oluştu'
  if(eventType === 'expired') return 'SKT tarihi geçti'
  if(eventType === 'allocation_missing') return 'SKT lot eşleşmesi yapılamadı'
  return 'SKT lotu oluşturuldu'
}

const buildStockExpiryActionDescription = (event: StockExpiryEvent) => {
  const lotText = event.lotCode ? `Lot: ${event.lotCode}.` : ''
  const expiryText = event.expiryDate ? ` SKT: ${formatExpiryDate(event.expiryDate)}.` : ' SKT yok.'
  const qtyText = event.qty !== undefined ? ` Miktar: ${formatExpiryQuantity(event.qty, event.unit)}.` : ''
  const sourceText = ` Kaynak: ${event.trigger}.`

  if(event.eventType === 'lot_created'){
    return `${event.stockItemName} için SKT lotu oluşturuldu. ${lotText}${expiryText}${qtyText}${sourceText}${event.note ? ` ${event.note}` : ''}`
  }

  if(event.eventType === 'lot_consumed'){
    return `${event.stockItemName} SKT lotundan tüketim yapıldı. ${lotText}${expiryText}${qtyText}${sourceText}${event.note ? ` ${event.note}` : ''}`
  }

  if(event.eventType === 'lot_wasted'){
    return `${event.stockItemName} SKT lotundan fire düşüldü. ${lotText}${expiryText}${qtyText}${sourceText}${event.note ? ` ${event.note}` : ''}`
  }

  if(event.eventType === 'lot_returned'){
    return `${event.stockItemName} SKT lotuna ters hareketle iade yapıldı. ${lotText}${expiryText}${qtyText}${sourceText}${event.note ? ` ${event.note}` : ''}`
  }

  if(event.eventType === 'near_expiry'){
    return `${event.stockItemName} SKT yaklaşan ürün uyarısı oluştu. ${lotText}${expiryText}${qtyText}${sourceText}${event.note ? ` ${event.note}` : ''}`
  }

  if(event.eventType === 'expired'){
    return `${event.stockItemName} için tarihi geçmiş ürün uyarısı oluştu. ${lotText}${expiryText}${qtyText}${sourceText}${event.note ? ` ${event.note}` : ''}`
  }

  if(event.eventType === 'allocation_missing'){
    return `${event.stockItemName} için SKT lot eşleşmesi yapılamadı.${qtyText}${sourceText}${event.note ? ` ${event.note}` : ''}`
  }

  return `${event.stockItemName} SKT lotu güncellendi. ${lotText}${expiryText}${qtyText}${sourceText}${event.note ? ` ${event.note}` : ''}`
}

const recordStockExpiryEvent = ({
  stockItem,
  lot,
  eventType,
  trigger,
  user,
  qty,
  movementId,
  tableId,
  tableName,
  previousStatus,
  nextStatus,
  note
}: {
  stockItem: StockItem
  lot?: StockExpiryLot
  eventType: StockExpiryEventType
  trigger: StockExpiryTrigger
  user: User
  qty?: number
  movementId?: string
  tableId?: string
  tableName?: string
  previousStatus?: StockExpiryStatus
  nextStatus?: StockExpiryStatus
  note?: string
}) => {
  const event: StockExpiryEvent = {
    id: createStorageId('stock_expiry_event'),
    lotId: lot?.id,
    lotCode: lot?.lotCode,
    stockItemId: stockItem.id,
    stockItemName: stockItem.name,
    eventType,
    trigger,
    qty,
    unit: stockItem.unit,
    expiryDate: lot?.expiryDate,
    previousStatus,
    nextStatus,
    movementId,
    tableId,
    tableName,
    userId: user.id,
    userName: user.fullName || user.username,
    timestamp: new Date().toISOString(),
    note: note?.trim() || ''
  }

  addStockExpiryEvent(event)
  addActionLog({
    operationType: getExpiryActionLogType(eventType),
    user,
    tableId,
    tableName,
    description: buildStockExpiryActionDescription(event)
  })

  return event
}

const getLatestExpiryStatusEvent = (lotId: string) => {
  return loadStockExpiryEvents()
    .filter(event => event.lotId === lotId && (event.eventType === 'near_expiry' || event.eventType === 'expired'))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
}

const recordStockExpiryStatusIfNeeded = ({
  stockItem,
  lot,
  user,
  trigger,
  movementId,
  tableId,
  tableName
}: {
  stockItem: StockItem
  lot: StockExpiryLot
  user: User
  trigger: StockExpiryTrigger
  movementId?: string
  tableId?: string
  tableName?: string
}) => {
  if(lot.remainingQty <= 0) return undefined

  const nextStatus = getExpiryStatus(lot, getExpiryWarningDays(stockItem))
  if(nextStatus !== 'near_expiry' && nextStatus !== 'expired') return undefined

  const latestStatusEvent = getLatestExpiryStatusEvent(lot.id)
  if(latestStatusEvent?.nextStatus === nextStatus) return undefined

  return recordStockExpiryEvent({
    stockItem,
    lot,
    eventType: nextStatus === 'expired' ? 'expired' : 'near_expiry',
    trigger,
    user,
    qty: lot.remainingQty,
    movementId,
    tableId,
    tableName,
    previousStatus: latestStatusEvent?.nextStatus,
    nextStatus,
    note: nextStatus === 'expired' ? 'Lot tarihi geçti.' : 'Lot uyarı günü eşiğine girdi.'
  })
}

export const syncStockExpiryStatusEvents = (user: User) => {
  const stockItems = loadStockItems()
  const lots = loadStockExpiryLots()
  let createdCount = 0

  lots.forEach(lot => {
    const stockItem = stockItems.find(item => item.id === lot.stockItemId)
    if(!stockItem || !isExpiryTracked(stockItem)) return

    const event = recordStockExpiryStatusIfNeeded({
      stockItem,
      lot,
      user,
      trigger: 'SKT Kontrolü'
    })
    if(event) createdCount += 1
  })

  return createdCount
}

const addExpiryAllocation = (
  allocations: StockExpiryAllocation[],
  lot: StockExpiryLot,
  qty: number
) => {
  const existing = allocations.find(item => item.lotId === lot.id)
  if(existing){
    existing.qty = roundStockQty(existing.qty + qty)
    return
  }

  allocations.push({
    lotId: lot.id,
    lotCode: lot.lotCode,
    expiryDate: lot.expiryDate,
    qty: roundStockQty(qty),
    unit: lot.unit
  })
}

const createExpiryLotForMovement = ({
  lots,
  stockItem,
  movement,
  qty,
  expiryDate,
  now,
  warnings
}: {
  lots: StockExpiryLot[]
  stockItem: StockItem
  movement: StockMovement
  qty: number
  expiryDate?: string
  now: string
  warnings: string[]
}) => {
  const normalizedExpiryDate = normalizeExpiryDateKey(expiryDate)
  if(!normalizedExpiryDate){
    warnings.push(`${stockItem.name} SKT takipli; giriş hareketinde son kullanma tarihi girilmedi. Lot SKT'siz açıldı.`)
  }

  const lot: StockExpiryLot = {
    id: createStorageId('stock_expiry_lot'),
    branchId: stockItem.branchId,
    lotCode: buildLotCode(stockItem, normalizedExpiryDate),
    stockItemId: stockItem.id,
    stockItemName: stockItem.name,
    unit: stockItem.unit,
    initialQty: roundStockQty(qty),
    remainingQty: roundStockQty(qty),
    expiryDate: normalizedExpiryDate,
    receivedAt: movement.movementDate || now,
    purchaseMovementId: movement.id,
    supplierName: movement.supplierName,
    invoiceNo: movement.invoiceNo,
    createdAt: now,
    createdByUserId: movement.createdByUserId,
    createdByFullName: movement.createdByFullName
  }

  return {
    lots: [lot, ...lots],
    lot
  }
}

const consumeExpiryLots = ({
  lots,
  stockItem,
  qty,
  now,
  preferredPurchaseMovementId,
  mode = 'fefo'
}: {
  lots: StockExpiryLot[]
  stockItem: StockItem
  qty: number
  now: string
  preferredPurchaseMovementId?: string
  mode?: ExpiryConsumptionMode
}) => {
  let remainingQty = roundStockQty(qty)
  let nextLots = [...lots]
  const allocations: StockExpiryAllocation[] = []
  const changedLots: { before: StockExpiryLot; after: StockExpiryLot; qty: number }[] = []
  const warnings: string[] = []
  const warningDays = getExpiryWarningDays(stockItem)
  const candidateLots = sortLotsFefo(nextLots.filter(lot => {
    if(lot.stockItemId !== stockItem.id || lot.remainingQty <= 0) return false
    if(preferredPurchaseMovementId) return lot.purchaseMovementId === preferredPurchaseMovementId
    if(mode === 'expired_only') return getExpiryStatus(lot, warningDays) === 'expired'
    return isConsumableExpiryLot(lot, warningDays)
  }))

  candidateLots.forEach(lot => {
    if(remainingQty <= 0) return

    const allocationQty = roundStockQty(Math.min(lot.remainingQty, remainingQty))
    if(allocationQty <= 0) return

    const nextRemainingQty = roundStockQty(Math.max(0, lot.remainingQty - allocationQty))
    const updatedLot: StockExpiryLot = {
      ...lot,
      remainingQty: nextRemainingQty,
      updatedAt: now,
      depletedAt: nextRemainingQty <= 0 ? now : lot.depletedAt
    }

    nextLots = nextLots.map(item => item.id === lot.id ? updatedLot : item)
    addExpiryAllocation(allocations, lot, allocationQty)
    changedLots.push({ before: lot, after: updatedLot, qty: allocationQty })
    remainingQty = roundStockQty(remainingQty - allocationQty)
  })

  if(remainingQty > 0){
    const message = preferredPurchaseMovementId
      ? `${stockItem.name} için terslenen giriş lotunda ${formatStockQty(remainingQty, stockItem.unit)} karşılanamadı.`
      : mode === 'expired_only'
        ? `${stockItem.name} için tarihi geçmiş SKT lotu bulunamadı veya yetersiz: ${formatStockQty(remainingQty, stockItem.unit)} lot eşleşmedi.`
      : `${stockItem.name} için tüketilebilir SKT lotu bulunamadı veya yetersiz: ${formatStockQty(remainingQty, stockItem.unit)} lot eşleşmedi.`
    warnings.push(message)
  }

  return {
    lots: nextLots,
    allocations,
    unallocatedQty: remainingQty > 0 ? remainingQty : undefined,
    warnings,
    changedLots
  }
}

const restoreExpiryAllocations = ({
  lots,
  stockItem,
  allocations,
  now
}: {
  lots: StockExpiryLot[]
  stockItem: StockItem
  allocations: StockExpiryAllocation[]
  now: string
}) => {
  let nextLots = [...lots]
  const restoredAllocations: StockExpiryAllocation[] = []
  const changedLots: { before: StockExpiryLot; after: StockExpiryLot; qty: number }[] = []
  const warnings: string[] = []
  let unallocatedQty = 0

  allocations.forEach(allocation => {
    const requestedQty = roundStockQty(allocation.qty)
    if(requestedQty <= 0) return

    const lot = nextLots.find(item => item.id === allocation.lotId)
    if(!lot){
      unallocatedQty = roundStockQty(unallocatedQty + requestedQty)
      warnings.push(`${stockItem.name} için ${allocation.lotCode || allocation.lotId} lotu bulunamadı; ${formatStockQty(requestedQty, stockItem.unit)} SKT iadesi eşleşmedi.`)
      return
    }

    const restorableQty = roundStockQty(Math.min(requestedQty, Math.max(0, lot.initialQty - lot.remainingQty)))
    if(restorableQty <= 0){
      unallocatedQty = roundStockQty(unallocatedQty + requestedQty)
      warnings.push(`${stockItem.name} için ${lot.lotCode} lotu zaten tam görünüyor; ${formatStockQty(requestedQty, stockItem.unit)} SKT iadesi eşleşmedi.`)
      return
    }

    if(restorableQty < requestedQty){
      const missingQty = roundStockQty(requestedQty - restorableQty)
      unallocatedQty = roundStockQty(unallocatedQty + missingQty)
      warnings.push(`${stockItem.name} için ${lot.lotCode} lotuna yalnızca ${formatStockQty(restorableQty, stockItem.unit)} iade edilebildi.`)
    }

    const updatedLot: StockExpiryLot = {
      ...lot,
      remainingQty: roundStockQty(lot.remainingQty + restorableQty),
      updatedAt: now,
      depletedAt: undefined
    }

    nextLots = nextLots.map(item => item.id === lot.id ? updatedLot : item)
    addExpiryAllocation(restoredAllocations, updatedLot, restorableQty)
    changedLots.push({ before: lot, after: updatedLot, qty: restorableQty })
  })

  return {
    lots: nextLots,
    allocations: restoredAllocations,
    unallocatedQty: unallocatedQty > 0 ? unallocatedQty : undefined,
    warnings,
    changedLots
  }
}

export const applyStockMovement = ({
  stockItemId,
  type,
  source,
  reason,
  qty,
  purchasePrice,
  supplierName,
  invoiceNo,
  expiryDate,
  expiryReturnAllocations,
  expiryConsumptionMode = 'fefo',
  description,
  movementDate,
  user,
  reversesMovementId,
  allowNegativeStock = false,
  sourceEntityType,
  sourceEntityId,
  tableId,
  tableName,
  orderId,
  recipeId,
  recipeVersion,
  deductionBatchId,
  reverseOfBatchId,
  reverseMode,
  wasteRecordId,
  criticalBeforeItem,
  criticalStockTrigger,
  skipCriticalStockCheck = false
}: {
  stockItemId: string
  type: StockMovementType
  source: StockMovementSource
  reason: StockMovementReason
  qty: number
  purchasePrice?: number
  supplierName?: string
  invoiceNo?: string
  expiryDate?: string
  expiryReturnAllocations?: StockExpiryAllocation[]
  expiryConsumptionMode?: ExpiryConsumptionMode
  description?: string
  movementDate?: string
  user: User
  reversesMovementId?: string
  allowNegativeStock?: boolean
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
  criticalBeforeItem?: StockItem
  criticalStockTrigger?: CriticalStockTrigger
  skipCriticalStockCheck?: boolean
}) => {
  const stockItems = loadStockItems()
  const stockItem = stockItems.find(item => item.id === stockItemId)

  if(!stockItem){
    throw new Error('Stok kartı bulunamadı.')
  }

  const normalizedQty = Number(qty)
  const isEntryMovement = isStockEntryMovementType(type)
  const isCountMovement = isStockCountMovementType(type)
  const isExitMovement = !isEntryMovement && !isCountMovement

  if(!Number.isFinite(normalizedQty) || normalizedQty < 0 || (!isCountMovement && normalizedQty <= 0)){
    throw new Error(isCountMovement ? 'Sayım sonucu 0 veya daha büyük olmalıdır.' : 'Hareket miktarı 0’dan büyük olmalıdır.')
  }

  const previousQty = stockItem.currentQty
  const nextQty = isEntryMovement
    ? previousQty + normalizedQty
    : isExitMovement
      ? previousQty - normalizedQty
      : normalizedQty

  if(nextQty < 0 && !allowNegativeStock){
    throw new Error('Çıkış hareketi stok miktarını eksiye düşüremez.')
  }

  const normalizedPurchasePrice = Number(purchasePrice)
  const validPurchasePrice = Number.isFinite(normalizedPurchasePrice) && normalizedPurchasePrice >= 0 ? normalizedPurchasePrice : undefined
  const previousAverageCost = getStockAverageCost(stockItem)
  const previousStockValue = roundCost(Math.max(0, previousQty) * previousAverageCost)
  const stockQtyDelta = roundStockQty(nextQty - previousQty)
  const incomingCostQty = Math.max(0, stockQtyDelta)
  const shouldUpdateCost = incomingCostQty > 0 && validPurchasePrice !== undefined
  const nextAverageCost = shouldUpdateCost
    ? calculateWeightedAverageCost({
      previousQty,
      previousAverageCost,
      incomingQty: incomingCostQty,
      incomingUnitCost: validPurchasePrice
    })
    : previousAverageCost
  const movementCostQty = Math.abs(stockQtyDelta)
  const movementUnitCost = validPurchasePrice !== undefined ? validPurchasePrice : previousAverageCost
  const averageCostChanged = shouldUpdateCost && Math.abs(nextAverageCost - previousAverageCost) > 0.0001
  const nextStockValue = roundCost(Math.max(0, nextQty) * nextAverageCost)
  const normalizedExpiryDate = normalizeExpiryDateKey(expiryDate)
  const now = new Date().toISOString()
  const movement: StockMovement = {
    id: `stock_move_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    branchId: stockItem.branchId,
    stockItemId: stockItem.id,
    stockItemName: stockItem.name,
    type,
    source,
    reason,
    qty: normalizedQty,
    unit: stockItem.unit,
    previousQty,
    nextQty,
    purchasePrice: validPurchasePrice,
    currency: getStockCurrency(stockItem),
    unitCost: roundCost(movementUnitCost),
    totalCost: roundCost(movementCostQty * movementUnitCost),
    previousAverageCost: roundCost(previousAverageCost),
    nextAverageCost: roundCost(nextAverageCost),
    previousStockValue,
    nextStockValue,
    supplierName: supplierName?.trim() || '',
    invoiceNo: invoiceNo?.trim() || '',
    expiryDate: normalizedExpiryDate,
    description: description?.trim() || '',
    movementDate: movementDate || now,
    createdAt: now,
    createdByUserId: user.id,
    createdByFullName: user.fullName || user.username,
    reversesMovementId,
    sourceEntityType,
    sourceEntityId,
    tableId,
    tableName,
    orderId,
    recipeId,
    recipeVersion,
    deductionBatchId,
    reverseOfBatchId,
    reverseMode,
    wasteRecordId
  }
  const existingMovements = loadStockMovements()
  const originalMovement = reversesMovementId ? existingMovements.find(item => item.id === reversesMovementId) : undefined
  const expiryTrigger = getExpiryTriggerFromMovement(movement)
  const expiryWarnings: string[] = []
  const createdExpiryLots: { lot: StockExpiryLot; qty: number }[] = []
  const consumedExpiryLots: { lot: StockExpiryLot; qty: number }[] = []
  const returnedExpiryLots: { lot: StockExpiryLot; qty: number }[] = []
  const statusCheckLots: StockExpiryLot[] = []
  let expiryLots = loadStockExpiryLots()
  let expiryAllocations: StockExpiryAllocation[] = []
  let expiryUnallocatedQty: number | undefined
  let expiryTouched = false

  if(isExpiryTracked(stockItem)){
    const normalizedReturnAllocations = (expiryReturnAllocations || []).map(normalizeStockExpiryAllocation).filter(allocation => allocation.lotId && allocation.qty > 0)

    if(type === 'Giriş'){
      const allocationsToReturn = normalizedReturnAllocations.length > 0
        ? normalizedReturnAllocations
        : originalMovement?.type === 'Çıkış'
          ? (originalMovement.expiryAllocations || [])
          : []

      if(allocationsToReturn.length > 0){
        const restored = restoreExpiryAllocations({
          lots: expiryLots,
          stockItem,
          allocations: allocationsToReturn,
          now
        })

        expiryLots = restored.lots
        expiryAllocations = restored.allocations
        expiryUnallocatedQty = restored.unallocatedQty
        expiryWarnings.push(...restored.warnings)
        returnedExpiryLots.push(...restored.changedLots.map(item => ({ lot: item.after, qty: item.qty })))
        statusCheckLots.push(...restored.changedLots.map(item => item.after))
        expiryTouched = restored.changedLots.length > 0
      } else {
        if(!normalizedExpiryDate){
          throw new Error('SKT takipli stok girişlerinde son kullanma tarihi zorunludur.')
        }

        const created = createExpiryLotForMovement({
          lots: expiryLots,
          stockItem,
          movement,
          qty: normalizedQty,
          expiryDate: normalizedExpiryDate,
          now,
          warnings: expiryWarnings
        })

        expiryLots = created.lots
        createdExpiryLots.push({ lot: created.lot, qty: normalizedQty })
        statusCheckLots.push(created.lot)
        expiryTouched = true
      }
    } else if(type === 'Çıkış'){
      const consumed = consumeExpiryLots({
        lots: expiryLots,
        stockItem,
        qty: normalizedQty,
        now,
        preferredPurchaseMovementId: originalMovement?.type === 'Giriş' ? originalMovement.id : undefined,
        mode: expiryConsumptionMode
      })

      expiryLots = consumed.lots
      expiryAllocations = consumed.allocations
      expiryUnallocatedQty = consumed.unallocatedQty
      expiryWarnings.push(...consumed.warnings)
      consumedExpiryLots.push(...consumed.changedLots.map(item => ({ lot: item.after, qty: item.qty })))
      statusCheckLots.push(...consumed.changedLots.map(item => item.after))
      expiryTouched = consumed.changedLots.length > 0
    } else {
      const correctionQty = roundStockQty(nextQty - previousQty)

      if(correctionQty > 0){
        if(!normalizedExpiryDate){
          throw new Error('SKT takipli sayım fazlası girişlerinde son kullanma tarihi zorunludur.')
        }

        const created = createExpiryLotForMovement({
          lots: expiryLots,
          stockItem,
          movement,
          qty: correctionQty,
          expiryDate: normalizedExpiryDate,
          now,
          warnings: expiryWarnings
        })

        expiryLots = created.lots
        createdExpiryLots.push({ lot: created.lot, qty: correctionQty })
        statusCheckLots.push(created.lot)
        expiryTouched = true
      } else if(correctionQty < 0){
        const consumed = consumeExpiryLots({
          lots: expiryLots,
          stockItem,
          qty: Math.abs(correctionQty),
          now
        })

        expiryLots = consumed.lots
        expiryAllocations = consumed.allocations
        expiryUnallocatedQty = consumed.unallocatedQty
        expiryWarnings.push(...consumed.warnings)
        consumedExpiryLots.push(...consumed.changedLots.map(item => ({ lot: item.after, qty: item.qty })))
        statusCheckLots.push(...consumed.changedLots.map(item => item.after))
        expiryTouched = consumed.changedLots.length > 0
      }
    }

    if(expiryAllocations.length > 0) movement.expiryAllocations = expiryAllocations
    if(expiryUnallocatedQty !== undefined && expiryUnallocatedQty > 0) movement.expiryUnallocatedQty = expiryUnallocatedQty
    if(expiryWarnings.length > 0) movement.expiryWarnings = expiryWarnings
  }

  const nextStockItem: StockItem = {
    ...stockItem,
    currentQty: nextQty,
    updatedAt: now,
    unitPurchasePrice: shouldUpdateCost ? validPurchasePrice : stockItem.unitPurchasePrice,
    currency: getStockCurrency(stockItem),
    lastPurchasePrice: shouldUpdateCost ? validPurchasePrice : stockItem.lastPurchasePrice,
    averageCost: shouldUpdateCost ? roundCost(nextAverageCost) : stockItem.averageCost,
    lastCostUpdatedAt: shouldUpdateCost ? now : stockItem.lastCostUpdatedAt,
    lastSupplierName: incomingCostQty > 0 && movement.supplierName ? movement.supplierName : stockItem.lastSupplierName
  }
  const nextStockItems = stockItems.map(item => item.id === stockItem.id ? nextStockItem : item)
  const nextExistingMovements = reversesMovementId
    ? existingMovements.map(item => item.id === reversesMovementId ? { ...item, reversedByMovementId: movement.id, reversedAt: now } : item)
    : existingMovements

  saveStockItems(nextStockItems)
  if(expiryTouched) saveStockExpiryLots(expiryLots)
  saveStockMovements([movement, ...nextExistingMovements])
  addStockMovementAuditEvent({
    id: `stock_audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    movementId: movement.id,
    stockItemId: stockItem.id,
    eventType: 'created',
    userId: user.id,
    userName: user.fullName || user.username,
    timestamp: now,
    before: stockItem,
    after: nextStockItem,
    note: `${movement.stockItemName}: ${movement.type} ${formatStockQty(movement.qty, movement.unit)}. ${formatStockQty(previousQty, movement.unit)} -> ${formatStockQty(nextQty, movement.unit)}.`
  })

  if(reversesMovementId){
    addStockMovementAuditEvent({
      id: `stock_audit_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      movementId: reversesMovementId,
      stockItemId: stockItem.id,
      eventType: 'reversed',
      userId: user.id,
      userName: user.fullName || user.username,
      timestamp: now,
      before: existingMovements.find(item => item.id === reversesMovementId),
      after: nextExistingMovements.find(item => item.id === reversesMovementId),
      note: `${movement.id} hareketi ile ters hareket oluşturuldu.`
    })
  }

  addActionLog({
    operationType: getStockMovementLogType(movement),
    user,
    description: `${user.fullName || user.username} ${movement.stockItemName} için ${movement.type.toLocaleLowerCase('tr-TR')} hareketi oluşturdu. Kaynak: ${movement.source}. Sebep: ${movement.reason}. Miktar: ${formatStockQty(movement.qty, movement.unit)}. Stok: ${formatStockQty(previousQty, movement.unit)} -> ${formatStockQty(nextQty, movement.unit)}.${movement.invoiceNo ? ` Fatura: ${movement.invoiceNo}.` : ''}${movement.supplierName ? ` Tedarikçi: ${movement.supplierName}.` : ''}${movement.description ? ` Açıklama: ${movement.description}.` : ''}${movement.expiryWarnings?.length ? ` SKT uyarısı: ${movement.expiryWarnings.join(' | ')}.` : ''}`
  })

  if(shouldUpdateCost && validPurchasePrice !== undefined){
    addActionLog({
      operationType: 'Yeni alış fiyatı girildi',
      user,
      description: `${movement.stockItemName} için yeni birim alış fiyatı girildi: ${formatStockMoney(validPurchasePrice, movement.currency)}. Hareket: ${movement.id}.`
    })

    addActionLog({
      operationType: 'Maliyet güncellendi',
      user,
      description: `${movement.stockItemName} maliyeti güncellendi. Son alış: ${formatStockMoney(validPurchasePrice, movement.currency)}. Stok değeri: ${formatStockMoney(previousStockValue, movement.currency)} -> ${formatStockMoney(nextStockValue, movement.currency)}.`
    })
  }

  if(averageCostChanged){
    addActionLog({
      operationType: 'Ortalama maliyet değişti',
      user,
      description: `${movement.stockItemName} ortalama maliyeti ${formatStockMoney(previousAverageCost, movement.currency)} -> ${formatStockMoney(nextAverageCost, movement.currency)} olarak değişti.`
    })
  }

  createdExpiryLots.forEach(item => {
    recordStockExpiryEvent({
      stockItem: nextStockItem,
      lot: item.lot,
      eventType: 'lot_created',
      trigger: expiryTrigger,
      user,
      qty: item.qty,
      movementId: movement.id,
      tableId,
      tableName,
      note: movement.description
    })
  })

  consumedExpiryLots.forEach(item => {
    recordStockExpiryEvent({
      stockItem: nextStockItem,
      lot: item.lot,
      eventType: movement.source === 'Fire' || movement.reason === 'Fire' ? 'lot_wasted' : 'lot_consumed',
      trigger: expiryTrigger,
      user,
      qty: item.qty,
      movementId: movement.id,
      tableId,
      tableName,
      note: movement.description
    })
  })

  returnedExpiryLots.forEach(item => {
    recordStockExpiryEvent({
      stockItem: nextStockItem,
      lot: item.lot,
      eventType: 'lot_returned',
      trigger: expiryTrigger,
      user,
      qty: item.qty,
      movementId: movement.id,
      tableId,
      tableName,
      note: movement.description
    })
  })

  if(movement.expiryUnallocatedQty && movement.expiryUnallocatedQty > 0){
    recordStockExpiryEvent({
      stockItem: nextStockItem,
      eventType: 'allocation_missing',
      trigger: expiryTrigger,
      user,
      qty: movement.expiryUnallocatedQty,
      movementId: movement.id,
      tableId,
      tableName,
      note: movement.expiryWarnings?.join(' | ') || movement.description
    })
  }

  statusCheckLots.forEach(lot => {
    recordStockExpiryStatusIfNeeded({
      stockItem: nextStockItem,
      lot,
      user,
      trigger: expiryTrigger,
      movementId: movement.id,
      tableId,
      tableName
    })
  })

  const criticalStockEvent = skipCriticalStockCheck ? undefined : recordCriticalStockTransition({
    before: criticalBeforeItem || stockItem,
    after: nextStockItem,
    user,
    trigger: criticalStockTrigger || getCriticalStockTriggerFromMovement(movement),
    movementId: movement.id,
    tableId,
    tableName,
    note: movement.description
  })

  return { ...movement, criticalStockEvent }
}

const formatWasteCost = (value?: number) => {
  if(value === undefined) return '-'
  return value.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 })
}

const getWasteRecordByMovement = (movement: StockMovement) => {
  const records = loadStockWasteRecords()
  return records.find(record => record.id === movement.wasteRecordId)
    || records.find(record => record.id === movement.sourceEntityId && movement.sourceEntityType === 'Fire')
    || records.find(record => record.stockMovementId === movement.id)
}

const markLinkedStockWasteRecordReversed = (movement: StockMovement, reversedMovement: StockMovement, user: User) => {
  const records = loadStockWasteRecords()
  const record = records.find(item => item.id === movement.wasteRecordId)
    || records.find(item => item.id === movement.sourceEntityId && movement.sourceEntityType === 'Fire')
    || records.find(item => item.stockMovementId === movement.id)

  if(!record || record.status === 'reversed') return undefined

  const now = new Date().toISOString()
  const nextRecord: StockWasteRecord = {
    ...record,
    status: 'reversed',
    reversedByMovementId: reversedMovement.id,
    reversedAt: now,
    updatedAt: now
  }

  saveStockWasteRecords(records.map(item => item.id === record.id ? nextRecord : item))
  addActionLog({
    operationType: 'Kayıp kaydı terslendi',
    user,
    description: `${record.stockItemName} fire kaydı terslendi. Neden: ${record.reasonCategory}. Miktar: ${formatStockQty(record.qty, record.unit)}. Ters hareket: ${reversedMovement.id}.`
  })

  return nextRecord
}

export const reverseStockMovement = (movementId: string, user: User) => {
  const movement = loadStockMovements().find(item => item.id === movementId)

  if(!movement){
    throw new Error('Ters hareket oluşturulacak kayıt bulunamadı.')
  }

  if(movement.reversedByMovementId){
    throw new Error('Bu hareket için daha önce ters hareket oluşturulmuş.')
  }

  const reverseType: StockMovementType = movement.type === 'Giriş'
    ? 'Çıkış'
    : movement.type === 'Çıkış'
      ? 'Giriş'
      : 'Sayım Düzeltme'
  const reverseQty = movement.type === 'Sayım Düzeltme' ? movement.previousQty : movement.qty

  const reversedMovement = applyStockMovement({
    stockItemId: movement.stockItemId,
    type: reverseType,
    source: movement.source,
    reason: 'Ters Hareket',
    qty: reverseQty,
    purchasePrice: reverseType === 'Giriş' ? movement.purchasePrice : undefined,
    supplierName: movement.supplierName,
    invoiceNo: movement.invoiceNo,
    description: `${movement.id} numaralı hareketin ters kaydı.${movement.description ? ` Orijinal açıklama: ${movement.description}` : ''}`,
    movementDate: new Date().toISOString(),
    user,
    reversesMovementId: movement.id
  })

  markLinkedStockWasteRecordReversed(movement, reversedMovement, user)
  return reversedMovement
}

export type StockWasteFormInput = {
  stockItemId: string
  qty: number
  reasonCategory: StockWasteReasonCategory
  reasonNote?: string
  responsibleUserId?: string
  responsibleFullName?: string
  occurredAt?: string
}

export const createStockWasteRecord = ({
  stockItemId,
  qty,
  reasonCategory,
  reasonNote,
  responsibleUserId,
  responsibleFullName,
  occurredAt,
  user
}: StockWasteFormInput & { user: User }) => {
  const stockItem = loadStockItems().find(item => item.id === stockItemId)

  if(!stockItem){
    throw new Error('Stok kartı bulunamadı.')
  }

  if(!stockItem.active){
    throw new Error('Pasif stok kartı için fire kaydı oluşturulamaz.')
  }

  const normalizedQty = Number(qty)
  if(!Number.isFinite(normalizedQty) || normalizedQty <= 0){
    throw new Error('Fire miktarı 0’dan büyük olmalıdır.')
  }

  if(stockItem.currentQty < normalizedQty){
    throw new Error('Fire hareketi stok miktarını eksiye düşüremez.')
  }

  const isExpiryWaste = reasonCategory === 'SKT Geçmesi'
  if(isExpiryTracked(stockItem) && isExpiryWaste){
    const expiredLotQty = loadStockExpiryLots()
      .filter(lot => lot.stockItemId === stockItem.id && lot.remainingQty > 0 && getExpiryStatus(lot, getExpiryWarningDays(stockItem)) === 'expired')
      .reduce((sum, lot) => sum + lot.remainingQty, 0)

    if(expiredLotQty < normalizedQty){
      throw new Error(`${stockItem.name} için tarihi geçmiş lot miktarı yetersiz. Uygun miktar: ${formatStockQty(expiredLotQty, stockItem.unit)}.`)
    }
  }

  const now = new Date().toISOString()
  const recordId = createStorageId('stock_waste')
  const estimatedUnitCost = getStockConsumptionUnitCost(stockItem)
  const estimatedTotalCost = roundCost(estimatedUnitCost * normalizedQty)
  const normalizedReasonNote = reasonNote?.trim() || ''
  const normalizedResponsibleName = responsibleFullName?.trim() || ''
  const movementDescription = [
    `${reasonCategory} fire kaydı.`,
    normalizedResponsibleName ? `Sorumlu: ${normalizedResponsibleName}.` : '',
    normalizedReasonNote ? `Not: ${normalizedReasonNote}.` : ''
  ].filter(Boolean).join(' ')

  const movement = applyStockMovement({
    stockItemId: stockItem.id,
    type: 'Çıkış',
    source: 'Fire',
    reason: 'Fire',
    qty: normalizedQty,
    description: movementDescription,
    movementDate: occurredAt || now,
    user,
    sourceEntityType: 'Fire',
    sourceEntityId: recordId,
    wasteRecordId: recordId,
    expiryConsumptionMode: isExpiryWaste ? 'expired_only' : 'fefo'
  })

  const record: StockWasteRecord = {
    id: recordId,
    branchId: stockItem.branchId,
    stockMovementId: movement.id,
    stockItemId: stockItem.id,
    stockItemName: stockItem.name,
    qty: normalizedQty,
    unit: stockItem.unit,
    reasonCategory,
    reasonNote: normalizedReasonNote,
    responsibleUserId,
    responsibleFullName: normalizedResponsibleName,
    createdByUserId: user.id,
    createdByFullName: user.fullName || user.username,
    occurredAt: occurredAt || now,
    createdAt: now,
    expiryAllocations: movement.expiryAllocations || [],
    expiryUnallocatedQty: movement.expiryUnallocatedQty,
    expiryWarnings: movement.expiryWarnings || [],
    estimatedUnitCost,
    estimatedTotalCost,
    status: 'active'
  }

  addStockWasteRecord(record)
  addActionLog({
    operationType: isExpiryWaste ? 'Geçerlilik nedeniyle kayıp oluşturuldu' : 'Kayıp kaydı oluşturuldu',
    user,
    description: `${stockItem.name} için fire kaydı oluşturuldu. Neden: ${reasonCategory}. Miktar: ${formatStockQty(normalizedQty, stockItem.unit)}. Sorumlu: ${normalizedResponsibleName || '-'}. Tahmini maliyet: ${formatWasteCost(estimatedTotalCost)}.${movement.expiryAllocations?.length ? ` Lotlar: ${movement.expiryAllocations.map(allocation => `${allocation.lotCode} ${formatStockQty(allocation.qty, allocation.unit)}`).join(' | ')}.` : ''}${movement.expiryWarnings?.length ? ` Uyarı: ${movement.expiryWarnings.join(' | ')}.` : ''}${normalizedReasonNote ? ` Not: ${normalizedReasonNote}.` : ''}`
  })

  return { record, movement }
}

export const reverseStockWasteRecord = (wasteRecordId: string, user: User) => {
  const record = loadStockWasteRecords().find(item => item.id === wasteRecordId)

  if(!record){
    throw new Error('Kayıp kaydı bulunamadı.')
  }

  if(record.status === 'reversed'){
    throw new Error('Bu fire kaydı daha önce terslenmiş.')
  }

  const movement = loadStockMovements().find(item => item.id === record.stockMovementId)
  if(!movement){
    throw new Error('Kayıp kaydına bağlı stok hareketi bulunamadı.')
  }

  const reversedMovement = reverseStockMovement(movement.id, user)
  const nextRecord = getWasteRecordByMovement(movement)

  return { record: nextRecord || record, movement: reversedMovement }
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
    app: 'miyop-business-workspace',
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
  loadStockCategories()
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
    { id: 'prd_adana', branchId: DEFAULT_BRANCH_ID, name: 'Adana Kebap', price: 450, categoryId: 'cat_food', description: 'Közlenmiş domates ve biber ile servis edilir.', calories: 620, protein: 38, carbohydrate: 18, fat: 43, fiber: 4, sugar: 6, salt: 2.1, servingSize: '1 porsiyon', allergens: [], active: true, createdAt: now, updatedAt: now },
    { id: 'prd_chicken', branchId: DEFAULT_BRANCH_ID, name: 'Tavuk Şiş', price: 360, categoryId: 'cat_food', description: 'Pilav ve salata ile servis edilir.', calories: 540, protein: 42, carbohydrate: 34, fat: 22, fiber: 3, sugar: 4, salt: 1.7, servingSize: '1 porsiyon', allergens: [], active: true, createdAt: now, updatedAt: now },
    { id: 'prd_soup', branchId: DEFAULT_BRANCH_ID, name: 'Mercimek Çorbası', price: 120, categoryId: 'cat_food', description: 'Günlük sıcak çorba.', calories: 180, protein: 9, carbohydrate: 24, fat: 5, fiber: 7, sugar: 3, salt: 1.2, servingSize: '1 kase', allergens: ['Gluten'], active: true, createdAt: now, updatedAt: now },
    { id: 'prd_cola', branchId: DEFAULT_BRANCH_ID, name: 'Kola', price: 80, categoryId: 'cat_drinks', description: '330 ml kutu içecek.', calories: 139, protein: 0, carbohydrate: 35, fat: 0, fiber: 0, sugar: 35, salt: 0.03, servingSize: '330 ml', allergens: [], active: true, createdAt: now, updatedAt: now },
    { id: 'prd_tea', branchId: DEFAULT_BRANCH_ID, name: 'Çay', price: 35, categoryId: 'cat_drinks', description: 'Taze demlenmiş bardak çay.', calories: 2, protein: 0, carbohydrate: 0, fat: 0, fiber: 0, sugar: 0, salt: 0, servingSize: '1 bardak', allergens: [], active: true, createdAt: now, updatedAt: now },
    { id: 'prd_baklava', branchId: DEFAULT_BRANCH_ID, name: 'Baklava', price: 180, categoryId: 'cat_desserts', description: 'Antep fıstıklı porsiyon baklava.', calories: 420, protein: 7, carbohydrate: 48, fat: 23, fiber: 3, sugar: 32, salt: 0.35, servingSize: '2 dilim', allergens: ['Gluten', 'Süt', 'Yumurta', 'Fındık'], active: true, createdAt: now, updatedAt: now }
  ]

  const branches = createDemoBranches(now)
  const employees = createDemoEmployees(now)
  const shifts = createDemoShifts(now)
  const attendances = createDemoAttendances(now)
  const employeePerformances = createDemoEmployeePerformances(now)
  const employeeBonuses = createDemoEmployeeBonuses(now)
  const employeeAudits = createDemoEmployeeAudits(now)
  const currentAccounts = createDemoCurrentAccounts(now)
  const creditTransactions = createDemoCreditTransactions(now)
  const collectionTransactions = createDemoCollectionTransactions(now)
  const supplierDebts = createDemoSupplierDebts(now)
  const supplierPayments = createDemoSupplierPayments(now)
  const incomeExpenses = createDemoIncomeExpenses(now)
  const cashTransfers = createDemoCashTransfers(now)
  const businessRegistrations = createDemoBusinessRegistrations(now)
  const businessApplications = createDemoBusinessApplications(now)
  const applicationNotes = createDemoApplicationNotes(now)
  const companies = createDemoCompanies(now)
  const companySetups = createDemoCompanySetups(now)
  const licensePackages = createDemoLicensePackages(now)
  const licenseModules = createDemoLicenseModules(licensePackages, now)
  const companyLicenses = createDemoCompanyLicenses(now)
  const companyUsers = createDemoCompanyUsers(now)
  const userSubscriptions = createDemoUserSubscriptions(companyLicenses, now)

  const tables: TableState[] = Array.from({ length: 6 }).map((_, index) => ({
    id: String(index + 1),
    branchId: DEFAULT_BRANCH_ID,
    name: `Masa ${index + 1}`,
    open: false,
    orders: []
  }))

  saveCategories(categories)
  saveProducts(products)
  saveBranches(branches)
  saveEmployees(employees)
  saveShifts(shifts)
  saveAttendances(attendances)
  saveEmployeePerformances(employeePerformances)
  saveEmployeeBonuses(employeeBonuses)
  saveEmployeeAudits(employeeAudits)
  saveCurrentAccounts(currentAccounts)
  saveCreditTransactions(creditTransactions)
  saveCollectionTransactions(collectionTransactions)
  saveSupplierDebts(supplierDebts)
  saveSupplierPayments(supplierPayments)
  saveCashTransactions([])
  saveIncomeExpenses(incomeExpenses)
  saveCashClosings([])
  saveCashTransfers(cashTransfers)
  saveBusinessRegistrations(businessRegistrations)
  saveBusinessApplications(businessApplications)
  saveApplicationNotes(applicationNotes)
  saveCompanies(companies)
  saveCompanySetups(companySetups)
  saveLicensePackages(licensePackages)
  saveLicenseModules(licenseModules)
  saveCompanyLicenses(companyLicenses)
  saveCompanyUsers(companyUsers)
  saveUserSubscriptions(userSubscriptions)
  loadTenants({ includeDeleted: true })
  saveTables(tables)
  saveKitchenOrders([])
  saveQRRequests([])
  saveWaiterCalls([])
  ensureDefaultAdmin()

  return {
    categories: loadCategories(),
    products: loadProducts(),
    tables,
    branches: loadBranches(),
    employees: loadEmployees(),
    shifts: loadShifts(),
    attendances: loadAttendances(),
    employeePerformances: loadEmployeePerformances(),
    employeeBonuses: loadEmployeeBonuses(),
    employeeAudits: loadEmployeeAudits(),
    currentAccounts: loadCurrentAccounts(),
    creditTransactions: loadCreditTransactions(),
    collectionTransactions: loadCollectionTransactions(),
    supplierDebts: loadSupplierDebts(),
    supplierPayments: loadSupplierPayments(),
    cashTransactions: loadCashTransactions(),
    incomeExpenses: loadIncomeExpenses(),
    cashClosings: loadCashClosings(),
    cashTransfers: loadCashTransfers(),
    businessRegistrations: loadBusinessRegistrations(),
    businessApplications: loadBusinessApplications(),
    applicationNotes: loadApplicationNotes(),
    companies: loadCompanies(),
    companySetups: loadCompanySetups(),
    licensePackages: loadLicensePackages(),
    licenseModules: loadLicenseModules(),
    companyLicenses: loadCompanyLicenses(),
    companyUsers: loadCompanyUsers(),
    userSubscriptions: loadUserSubscriptions()
  }
}
