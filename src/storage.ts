import {
  ActionLog,
  ActionLogType,
  CashPaymentMethod,
  CashClosing,
  CashTransfer,
  CashTransaction,
  CashTransactionType,
  ClosedBill,
  CriticalStockEvent,
  CriticalStockEventType,
  CriticalStockTrigger,
  CollectionPaymentMethod,
  CollectionTransaction,
  CreditTransaction,
  CurrentAccount,
  CurrentAccountType,
  IncomeExpense,
  IncomeExpensePaymentMethod,
  IncomeExpenseType,
  KitchenOrder,
  KitchenOrderStatus,
  Product,
  ProductCategory,
  QRAuditEvent,
  AuditEntityType,
  AuditEventType,
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
  SupplierDebt,
  SupplierPayment,
  SupplierPaymentMethod,
  StockWasteReasonCategory,
  StockWasteRecord,
  StockWasteStatus,
  SystemSettings,
  TableState,
  User,
  WaiterCall,
  WaiterCallHistory,
  WaiterCallStatus
} from './types'
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
const KEY_KITCHEN = 'ra_kitchen_orders'
const KEY_QR_REQUESTS = 'ra_qr_requests'
const KEY_QR_REQUEST_HISTORY = 'ra_qr_request_history'
const KEY_QR_AUDIT_EVENTS = 'ra_qr_audit_events'
const KEY_SETTINGS = 'ra_settings'
const KEY_WAITER_CALLS = 'ra_waiter_calls'
const KEY_WAITER_CALL_HISTORY = 'ra_waiter_call_history'

const DEFAULT_CATEGORY_ID = 'cat_general'
const DEFAULT_STOCK_CATEGORY_ID = 'stock_cat_general'
const STOCK_UNITS: StockUnit[] = ['adet', 'kg', 'gr', 'lt', 'ml', 'paket', 'koli']
const STOCK_MOVEMENT_TYPES: StockMovementType[] = ['Giriş', 'Çıkış', 'Sayım Düzeltme']
const STOCK_MOVEMENT_SOURCES: StockMovementSource[] = ['Manuel', 'Reçete', 'Adisyon', 'Sayım', 'İade', 'Fire']
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

export const DEFAULT_SETTINGS: SystemSettings = {
  restaurantName: 'Restaurant Adisyon',
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

const getAppStorageKeys = () => {
  const keys: string[] = []

  for(let index = 0; index < localStorage.length; index += 1){
    const key = localStorage.key(index)
    if(key?.startsWith('ra_')) keys.push(key)
  }

  return keys
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

const normalizeCurrentAccountType = (value: unknown): CurrentAccountType => {
  return CURRENT_ACCOUNT_TYPES.includes(value as CurrentAccountType) ? value as CurrentAccountType : 'Müşteri'
}

const normalizeCurrentAccount = (item: Partial<CurrentAccount>): CurrentAccount => {
  const timestamp = item.createdAt || new Date().toISOString()

  return {
    id: String(item.id || `cari_${Date.now()}`),
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

const createDemoCurrentAccounts = (now = new Date().toISOString()): CurrentAccount[] => [
  {
    id: 'cari_ali_veli',
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
    toUser: 'Kasiyer',
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

const normalizeRecipeItem = (item: Partial<RecipeItem>): RecipeItem => {
  const qty = Number(item.qty)
  const wastePercent = Number(item.wastePercent)

  return {
    id: String(item.id || `recipe_item_${Date.now()}`),
    stockItemId: String(item.stockItemId || ''),
    stockItemName: String(item.stockItemName || 'Stok Kartı'),
    qty: Number.isFinite(qty) ? Math.max(0, qty) : 0,
    unit: normalizeStockUnit(item.unit),
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

const normalizeRecipe = (item: Partial<Recipe>): Recipe => {
  const timestamp = item.createdAt || new Date().toISOString()
  const version = Number(item.version)
  const recipeVersion = Number(item.recipeVersion)

  return {
    id: String(item.id || `recipe_${Date.now()}`),
    productId: String(item.productId || ''),
    productName: String(item.productName || 'Ürün'),
    name: String(item.name || 'Reçete').trim() || 'Reçete',
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
    tableId: String(item.tableId || ''),
    tableName: String(item.tableName || 'Masa'),
    waiterId: String(item.waiterId || ''),
    waiterName: String(item.waiterName || 'Bilinmeyen Garson'),
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
  if(value === 'Onaylandı' || value === 'Reddedildi' || value === 'Garson Onayı Bekliyor') return value
  return 'Garson Onayı Bekliyor'
}

const normalizeQRRequestItem = (orderItem: Partial<QRRequestItem>): QRRequestItem => ({
  productId: String(orderItem.productId || ''),
  productName: String(orderItem.productName || 'Ürün'),
  unitPrice: Math.max(0, Number(orderItem.unitPrice) || 0),
  qty: Math.max(1, Number(orderItem.qty) || 1)
})

const normalizeQRRejectReason = (value: unknown): QRRejectReason | undefined => {
  if(
    value === 'Ürün mevcut değil'
    || value === 'Mutfak kapalı'
    || value === 'Müşteri iptali'
    || value === 'Hatalı masa'
    || value === 'Stok yetersiz'
    || value === 'Diğer'
  ){
    return value
  }

  return undefined
}

const normalizeQRRequest = (item: Partial<QRRequest>): QRRequest => {
  const timestamp = item.createdAt || new Date().toISOString()
  const items = (item.items || []).map(normalizeQRRequestItem).filter(orderItem => orderItem.productId)
  const originalItems = (item.originalItems || items).map(normalizeQRRequestItem).filter(orderItem => orderItem.productId)

  return {
    id: String(item.id || `qr_${Date.now()}`),
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

const normalizeSettings = (item: Partial<SystemSettings>): SystemSettings => {
  const vatRate = Number(item.vatRate)

  return {
    restaurantName: String(item.restaurantName || DEFAULT_SETTINGS.restaurantName).trim() || DEFAULT_SETTINGS.restaurantName,
    logoUrl: String(item.logoUrl || '').trim(),
    vatRate: Number.isFinite(vatRate) ? Math.min(100, Math.max(0, vatRate)) : DEFAULT_SETTINGS.vatRate,
    currency: String(item.currency || DEFAULT_SETTINGS.currency).trim() || DEFAULT_SETTINGS.currency
  }
}

const normalizeActionLog = (item: Partial<ActionLog>): ActionLog => {
  const timestamp = item.timestamp || new Date().toISOString()
  const date = item.date || new Date(timestamp).toLocaleDateString('sv-SE')
  const time = item.time || new Date(timestamp).toLocaleTimeString('tr-TR', { hour12: false })

  return {
    id: String(item.id || `log_${Date.now()}`),
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

export const loadCurrentAccounts = (): CurrentAccount[] => {
  const stored = localStorage.getItem(KEY_CURRENT_ACCOUNTS)
  if(stored === null) return createDemoCurrentAccounts()

  return readJson<Partial<CurrentAccount>[]>(KEY_CURRENT_ACCOUNTS, []).map(normalizeCurrentAccount)
}

export const saveCurrentAccounts = (items: CurrentAccount[]) => {
  localStorage.setItem(KEY_CURRENT_ACCOUNTS, JSON.stringify(items.map(normalizeCurrentAccount)))
}

export const loadCreditTransactions = (): CreditTransaction[] => {
  const stored = localStorage.getItem(KEY_CREDIT_TRANSACTIONS)
  if(stored === null) return createDemoCreditTransactions()

  return readJson<Partial<CreditTransaction>[]>(KEY_CREDIT_TRANSACTIONS, []).map(normalizeCreditTransaction)
}

export const saveCreditTransactions = (items: CreditTransaction[]) => {
  localStorage.setItem(KEY_CREDIT_TRANSACTIONS, JSON.stringify(items.map(normalizeCreditTransaction)))
}

export const loadSupplierDebts = (): SupplierDebt[] => {
  const stored = localStorage.getItem(KEY_SUPPLIER_DEBTS)
  if(stored === null) return createDemoSupplierDebts()

  return readJson<Partial<SupplierDebt>[]>(KEY_SUPPLIER_DEBTS, []).map(normalizeSupplierDebt)
}

export const saveSupplierDebts = (items: SupplierDebt[]) => {
  localStorage.setItem(KEY_SUPPLIER_DEBTS, JSON.stringify(items.map(normalizeSupplierDebt)))
}

export const loadSupplierPayments = (): SupplierPayment[] => {
  const stored = localStorage.getItem(KEY_SUPPLIER_PAYMENTS)
  if(stored === null) return createDemoSupplierPayments()

  return readJson<Partial<SupplierPayment>[]>(KEY_SUPPLIER_PAYMENTS, []).map(normalizeSupplierPayment)
}

export const saveSupplierPayments = (items: SupplierPayment[]) => {
  localStorage.setItem(KEY_SUPPLIER_PAYMENTS, JSON.stringify(items.map(normalizeSupplierPayment)))
}

export const loadCashTransactions = (): CashTransaction[] => {
  return readJson<Partial<CashTransaction>[]>(KEY_CASH_TRANSACTIONS, []).map(normalizeCashTransaction)
}

export const saveCashTransactions = (items: CashTransaction[]) => {
  localStorage.setItem(KEY_CASH_TRANSACTIONS, JSON.stringify(items.map(normalizeCashTransaction)))
}

export const loadIncomeExpenses = (): IncomeExpense[] => {
  const stored = localStorage.getItem(KEY_INCOME_EXPENSES)
  if(stored === null) return createDemoIncomeExpenses()

  return readJson<Partial<IncomeExpense>[]>(KEY_INCOME_EXPENSES, []).map(normalizeIncomeExpense)
}

export const saveIncomeExpenses = (items: IncomeExpense[]) => {
  localStorage.setItem(KEY_INCOME_EXPENSES, JSON.stringify(items.map(normalizeIncomeExpense)))
}

export const loadCashClosings = (): CashClosing[] => {
  return readJson<Partial<CashClosing>[]>(KEY_CASH_CLOSINGS, []).map(normalizeCashClosing)
}

export const saveCashClosings = (items: CashClosing[]) => {
  localStorage.setItem(KEY_CASH_CLOSINGS, JSON.stringify(items.map(normalizeCashClosing)))
}

export const loadCashTransfers = (): CashTransfer[] => {
  const stored = localStorage.getItem(KEY_CASH_TRANSFERS)
  if(stored === null) return createDemoCashTransfers()

  return readJson<Partial<CashTransfer>[]>(KEY_CASH_TRANSFERS, []).map(normalizeCashTransfer)
}

export const saveCashTransfers = (items: CashTransfer[]) => {
  localStorage.setItem(KEY_CASH_TRANSFERS, JSON.stringify(items.map(normalizeCashTransfer)))
}

export const loadCollectionTransactions = (): CollectionTransaction[] => {
  const stored = localStorage.getItem(KEY_COLLECTION_TRANSACTIONS)
  if(stored === null) return createDemoCollectionTransactions()

  return readJson<Partial<CollectionTransaction>[]>(KEY_COLLECTION_TRANSACTIONS, []).map(normalizeCollectionTransaction)
}

export const saveCollectionTransactions = (items: CollectionTransaction[]) => {
  localStorage.setItem(KEY_COLLECTION_TRANSACTIONS, JSON.stringify(items.map(normalizeCollectionTransaction)))
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

export const loadStockCategories = (): StockCategory[] => {
  const stored = readJson<Partial<StockCategory>[]>(KEY_STOCK_CATEGORIES, [])
  const categories = stored.map(normalizeStockCategory)

  if(!categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)){
    categories.unshift(createDefaultStockCategory())
  }

  return categories
}

export const saveStockCategories = (items: StockCategory[]) => {
  const categories = items.map(normalizeStockCategory)

  if(!categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)){
    categories.unshift(createDefaultStockCategory())
  }

  localStorage.setItem(KEY_STOCK_CATEGORIES, JSON.stringify(categories))
}

export const loadStockItems = (): StockItem[] => {
  const categories = loadStockCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_STOCK_CATEGORY_ID
  return readJson<Partial<StockItem>[]>(KEY_STOCK_ITEMS, []).map(item => normalizeStockItem(item, fallbackCategoryId))
}

export const saveStockItems = (items: StockItem[]) => {
  const categories = loadStockCategories()
  const fallbackCategoryId = categories.find(c => c.id === DEFAULT_STOCK_CATEGORY_ID)?.id || categories[0]?.id || DEFAULT_STOCK_CATEGORY_ID
  localStorage.setItem(KEY_STOCK_ITEMS, JSON.stringify(items.map(item => normalizeStockItem(item, fallbackCategoryId))))
}

export const loadStockMovements = (): StockMovement[] => {
  return readJson<Partial<StockMovement>[]>(KEY_STOCK_MOVEMENTS, []).map(normalizeStockMovement)
}

export const saveStockMovements = (items: StockMovement[]) => {
  localStorage.setItem(KEY_STOCK_MOVEMENTS, JSON.stringify(items.map(normalizeStockMovement)))
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
  return readJson<Partial<StockExpiryLot>[]>(KEY_STOCK_EXPIRY_LOTS, []).map(normalizeStockExpiryLot).filter(lot => lot.stockItemId)
}

export const saveStockExpiryLots = (items: StockExpiryLot[]) => {
  localStorage.setItem(KEY_STOCK_EXPIRY_LOTS, JSON.stringify(items.map(normalizeStockExpiryLot).filter(lot => lot.stockItemId)))
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
  return readJson<Partial<StockDeductionBatch>[]>(KEY_STOCK_DEDUCTION_BATCHES, []).map(normalizeStockDeductionBatch)
}

export const saveStockDeductionBatches = (items: StockDeductionBatch[]) => {
  localStorage.setItem(KEY_STOCK_DEDUCTION_BATCHES, JSON.stringify(items.map(normalizeStockDeductionBatch)))
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
  return readJson<Partial<StockWasteRecord>[]>(KEY_STOCK_WASTE_RECORDS, []).map(normalizeStockWasteRecord).filter(record => record.stockItemId && record.stockMovementId)
}

export const saveStockWasteRecords = (items: StockWasteRecord[]) => {
  localStorage.setItem(KEY_STOCK_WASTE_RECORDS, JSON.stringify(items.map(normalizeStockWasteRecord).filter(record => record.stockItemId && record.stockMovementId)))
}

export const addStockWasteRecord = (record: StockWasteRecord) => {
  saveStockWasteRecords([record, ...loadStockWasteRecords()])
}

export const loadRecipes = (): Recipe[] => {
  return readJson<Partial<Recipe>[]>(KEY_RECIPES, []).map(normalizeRecipe)
}

export const saveRecipes = (items: Recipe[]) => {
  localStorage.setItem(KEY_RECIPES, JSON.stringify(items.map(normalizeRecipe)))
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

export const loadKitchenOrders = (): KitchenOrder[] => {
  return readJson<Partial<KitchenOrder>[]>(KEY_KITCHEN, []).map(normalizeKitchenOrder)
}

export const saveKitchenOrders = (items: KitchenOrder[]) => {
  localStorage.setItem(KEY_KITCHEN, JSON.stringify(items.map(normalizeKitchenOrder)))
}

export const loadQRRequests = (): QRRequest[] => {
  return readJson<Partial<QRRequest>[]>(KEY_QR_REQUESTS, []).map(normalizeQRRequest)
}

export const saveQRRequests = (items: QRRequest[]) => {
  localStorage.setItem(KEY_QR_REQUESTS, JSON.stringify(items.map(normalizeQRRequest)))
}

export const loadQRRequestHistory = (): QRRequestHistory[] => {
  return readJson<Partial<QRRequestHistory>[]>(KEY_QR_REQUEST_HISTORY, []).map(normalizeQRRequestHistory)
}

export const saveQRRequestHistory = (items: QRRequestHistory[]) => {
  localStorage.setItem(KEY_QR_REQUEST_HISTORY, JSON.stringify(items.map(normalizeQRRequestHistory)))
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

export const loadActionLogs = (): ActionLog[] => {
  return readJson<Partial<ActionLog>[]>(KEY_LOGS, []).map(normalizeActionLog)
}

export const saveActionLogs = (items: ActionLog[]) => {
  localStorage.setItem(KEY_LOGS, JSON.stringify(items.map(normalizeActionLog)))
}

export const addActionLog = ({
  operationType,
  user,
  tableId,
  tableName,
  description
}: {
  operationType: ActionLogType
  user: User
  tableId?: string
  tableName?: string
  description: string
}) => {
  const now = new Date()
  const log: ActionLog = {
    id: `log_${Date.now()}_${Math.random().toString(16).slice(2)}`,
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
  if(eventType === 'lot_wasted') return 'Fire lottan düşüldü'
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
    operationType: 'Fire kaydı terslendi',
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
    operationType: isExpiryWaste ? 'SKT nedeniyle fire oluşturuldu' : 'Fire kaydı oluşturuldu',
    user,
    description: `${stockItem.name} için fire kaydı oluşturuldu. Neden: ${reasonCategory}. Miktar: ${formatStockQty(normalizedQty, stockItem.unit)}. Sorumlu: ${normalizedResponsibleName || '-'}. Tahmini maliyet: ${formatWasteCost(estimatedTotalCost)}.${movement.expiryAllocations?.length ? ` Lotlar: ${movement.expiryAllocations.map(allocation => `${allocation.lotCode} ${formatStockQty(allocation.qty, allocation.unit)}`).join(' | ')}.` : ''}${movement.expiryWarnings?.length ? ` Uyarı: ${movement.expiryWarnings.join(' | ')}.` : ''}${normalizedReasonNote ? ` Not: ${normalizedReasonNote}.` : ''}`
  })

  return { record, movement }
}

export const reverseStockWasteRecord = (wasteRecordId: string, user: User) => {
  const record = loadStockWasteRecords().find(item => item.id === wasteRecordId)

  if(!record){
    throw new Error('Fire kaydı bulunamadı.')
  }

  if(record.status === 'reversed'){
    throw new Error('Bu fire kaydı daha önce terslenmiş.')
  }

  const movement = loadStockMovements().find(item => item.id === record.stockMovementId)
  if(!movement){
    throw new Error('Fire kaydına bağlı stok hareketi bulunamadı.')
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
    app: 'restaurant-adisyon',
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
    { id: 'prd_adana', name: 'Adana Kebap', price: 450, categoryId: 'cat_food', description: 'Közlenmiş domates ve biber ile servis edilir.', active: true, createdAt: now, updatedAt: now },
    { id: 'prd_chicken', name: 'Tavuk Şiş', price: 360, categoryId: 'cat_food', description: 'Pilav ve salata ile servis edilir.', active: true, createdAt: now, updatedAt: now },
    { id: 'prd_soup', name: 'Mercimek Çorbası', price: 120, categoryId: 'cat_food', description: 'Günlük sıcak çorba.', active: true, createdAt: now, updatedAt: now },
    { id: 'prd_cola', name: 'Kola', price: 80, categoryId: 'cat_drinks', description: '330 ml kutu içecek.', active: true, createdAt: now, updatedAt: now },
    { id: 'prd_tea', name: 'Çay', price: 35, categoryId: 'cat_drinks', description: 'Taze demlenmiş bardak çay.', active: true, createdAt: now, updatedAt: now },
    { id: 'prd_baklava', name: 'Baklava', price: 180, categoryId: 'cat_desserts', description: 'Antep fıstıklı porsiyon baklava.', active: true, createdAt: now, updatedAt: now }
  ]

  const currentAccounts = createDemoCurrentAccounts(now)
  const creditTransactions = createDemoCreditTransactions(now)
  const collectionTransactions = createDemoCollectionTransactions(now)
  const supplierDebts = createDemoSupplierDebts(now)
  const supplierPayments = createDemoSupplierPayments(now)
  const incomeExpenses = createDemoIncomeExpenses(now)
  const cashTransfers = createDemoCashTransfers(now)

  const tables: TableState[] = Array.from({ length: 6 }).map((_, index) => ({
    id: String(index + 1),
    name: `Masa ${index + 1}`,
    open: false,
    orders: []
  }))

  saveCategories(categories)
  saveProducts(products)
  saveCurrentAccounts(currentAccounts)
  saveCreditTransactions(creditTransactions)
  saveCollectionTransactions(collectionTransactions)
  saveSupplierDebts(supplierDebts)
  saveSupplierPayments(supplierPayments)
  saveCashTransactions([])
  saveIncomeExpenses(incomeExpenses)
  saveCashClosings([])
  saveCashTransfers(cashTransfers)
  saveTables(tables)
  saveKitchenOrders([])
  saveQRRequests([])
  saveWaiterCalls([])
  ensureDefaultAdmin()

  return {
    categories: loadCategories(),
    products: loadProducts(),
    tables,
    currentAccounts: loadCurrentAccounts(),
    creditTransactions: loadCreditTransactions(),
    collectionTransactions: loadCollectionTransactions(),
    supplierDebts: loadSupplierDebts(),
    supplierPayments: loadSupplierPayments(),
    cashTransactions: loadCashTransactions(),
    incomeExpenses: loadIncomeExpenses(),
    cashClosings: loadCashClosings(),
    cashTransfers: loadCashTransfers()
  }
}
