import React from 'react'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
import {
  SUPPLIER_APPROVAL_STATUS_LABELS,
  SUPPLIER_APPROVAL_STATUSES,
  SUPPLIER_COMPANY_TYPE_LABELS,
  SUPPLIER_COMPANY_TYPES,
  SUPPLIER_CURRENCIES,
  SUPPLIER_STATUS_LABELS,
  SUPPLIER_STATUSES,
  SUPPLIER_TYPE_LABELS,
  SUPPLIER_TYPES,
  SUPPLIER_WORKING_STATUS_LABELS,
  SUPPLIER_WORKING_STATUSES
} from '../supplier-management/supplier-management.mock'
import {
  SUPPLIER_PRODUCT_STATUS_LABELS,
  SUPPLIER_PRODUCT_STATUSES,
  SUPPLIER_PRODUCT_UNITS,
  loadSupplierProductRecords,
  saveSupplierProductRecords
} from '../supplier-management/supplier-product-mapping.mock'
import { SupplierAddressService } from '../supplier-management/supplier-address.service'
import { SupplierCategoryService } from '../supplier-management/supplier-category.service'
import { SupplierContactService } from '../supplier-management/supplier-contact.service'
import { SupplierService } from '../supplier-management/supplier.service'
import { SupplierStatisticsService } from '../supplier-management/supplier-statistics.service'
import type {
  Supplier,
  SupplierApprovalStatus,
  SupplierCompanyType,
  SupplierProduct,
  SupplierProductStatus,
  SupplierProductUnit,
  SupplierStatistics,
  SupplierStatus,
  SupplierType,
  SupplierWorkingStatus
} from '../supplier-management/supplier-management.types'
import type { StockItem } from '../types'
import { loadStockItems } from '../storage'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'

type SupplierFilterValue = 'all'
type SupplierStatusFilter = SupplierStatus | SupplierFilterValue
type SupplierApprovalFilter = SupplierApprovalStatus | SupplierFilterValue
type SupplierCompanyTypeFilter = SupplierCompanyType | SupplierFilterValue
type SupplierTypeFilter = SupplierType | SupplierFilterValue
type SupplierWorkingStatusFilter = SupplierWorkingStatus | SupplierFilterValue
type SupplierPanelMode = 'detail' | 'form'
type SupplierManagementView = 'suppliers' | 'supplier-products'
type SupplierProductStatusFilter = SupplierProductStatus | SupplierFilterValue

type SupplierFormState = {
  supplierCode: string
  name: string
  tradeName: string
  taxOffice: string
  taxNumber: string
  companyType: SupplierCompanyType
  type: SupplierType
  categoryId: string
  status: SupplierStatus
  approvalStatus: SupplierApprovalStatus
  workingStatus: SupplierWorkingStatus
  defaultCurrency: string
  paymentTermDays: string
  leadTimeDays: string
  minimumOrderAmount: string
  currentAccountCode: string
  contactName: string
  contactPhone: string
  mobilePhone: string
  contactEmail: string
  website: string
  address: string
  city: string
  district: string
  postalCode: string
  country: string
  notes: string
}

type SupplierFormField = keyof SupplierFormState

type SupplierProductFormState = {
  supplierId: string
  stockItemId: string
  supplierSku: string
  supplierProductName: string
  brand: string
  manufacturer: string
  purchaseUnit: SupplierProductUnit
  packageQuantity: string
  baseUnit: string
  conversionFactor: string
  defaultUnitPrice: string
  currency: string
  minimumOrderQuantity: string
  leadTimeDays: string
  isPreferred: boolean
  status: SupplierProductStatus
  notes: string
}

type SupplierProductFormField = keyof SupplierProductFormState

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DEFAULT_COUNTRY = 'Türkiye'
const DEFAULT_CURRENCY = 'TRY'
const DEFAULT_SUPPLIER_CATEGORY_ID = SupplierCategoryService.listCategories()[0]?.id || ''

const createId = () => SupplierService.createId()

const toSearchText = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const formatDateTime = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatDays = (value: number) => `${value} gün`

const formatCurrency = (value: number, currency: string) => {
  try{
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)
  } catch {
    return `${value.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
  }
}

const formatQuantity = (value: number, unit: string) => (
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 3 })} ${unit}`
)

const getStatusClass = (status: SupplierStatus) => {
  if(status === 'ACTIVE') return 'success'
  if(status === 'BLACKLISTED' || status === 'BLOCKED') return 'danger-pill'
  if(status === 'SUSPENDED' || status === 'PENDING_APPROVAL') return 'warning-pill'
  return 'muted-pill'
}

const getApprovalStatusClass = (status: SupplierApprovalStatus) => {
  if(status === 'APPROVED') return 'success'
  if(status === 'REJECTED') return 'danger-pill'
  return 'warning-pill'
}

const getNextSupplierCode = (records: Supplier[]) => SupplierService.getNextSupplierCode(records)

const createEmptySupplierForm = (records: Supplier[]): SupplierFormState => ({
  supplierCode: getNextSupplierCode(records),
  name: '',
  tradeName: '',
  taxOffice: '',
  taxNumber: '',
  companyType: 'LOCAL_SUPPLIER',
  type: 'RAW_MATERIAL',
  categoryId: DEFAULT_SUPPLIER_CATEGORY_ID,
  status: 'ACTIVE',
  approvalStatus: 'PENDING',
  workingStatus: 'ACTIVE_WORKING',
  defaultCurrency: DEFAULT_CURRENCY,
  paymentTermDays: '0',
  leadTimeDays: '0',
  minimumOrderAmount: '0',
  currentAccountCode: '',
  contactName: '',
  contactPhone: '',
  mobilePhone: '',
  contactEmail: '',
  website: '',
  address: '',
  city: '',
  district: '',
  postalCode: '',
  country: DEFAULT_COUNTRY,
  notes: ''
})

const createSupplierFormFromRecord = (supplier: Supplier): SupplierFormState => ({
  supplierCode: supplier.supplierCode,
  name: supplier.name,
  tradeName: supplier.tradeName,
  taxOffice: supplier.taxOffice,
  taxNumber: supplier.taxNumber,
  companyType: supplier.companyType,
  type: supplier.type,
  categoryId: supplier.categoryIds[0] || SupplierCategoryService.getCategoryByType(supplier.type)?.id || DEFAULT_SUPPLIER_CATEGORY_ID,
  status: supplier.status,
  approvalStatus: supplier.approvalStatus,
  workingStatus: supplier.workingStatus,
  defaultCurrency: supplier.defaultCurrency,
  paymentTermDays: String(supplier.paymentTermDays),
  leadTimeDays: String(supplier.leadTimeDays),
  minimumOrderAmount: String(supplier.minimumOrderAmount),
  currentAccountCode: supplier.currentAccountCode,
  contactName: supplier.contactName,
  contactPhone: supplier.contactPhone,
  mobilePhone: supplier.mobilePhone,
  contactEmail: supplier.contactEmail,
  website: supplier.website,
  address: supplier.address,
  city: supplier.city,
  district: supplier.district,
  postalCode: supplier.postalCode,
  country: supplier.country,
  notes: supplier.notes
})

const normalizeNumberInput = (value: string) => {
  if(value.trim() === '') return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

const createEmptySupplierProductForm = (
  suppliers: Supplier[],
  stockItems: StockItem[]
): SupplierProductFormState => {
  const stockItem = stockItems[0]

  return {
    supplierId: suppliers[0]?.id || '',
    stockItemId: stockItem?.id || '',
    supplierSku: '',
    supplierProductName: '',
    brand: '',
    manufacturer: '',
    purchaseUnit: stockItem?.unit === 'gr' ? 'kg' : stockItem?.unit === 'ml' ? 'lt' : stockItem?.unit || 'kg',
    packageQuantity: '1',
    baseUnit: stockItem?.unit || '',
    conversionFactor: '1',
    defaultUnitPrice: '0',
    currency: DEFAULT_CURRENCY,
    minimumOrderQuantity: '0',
    leadTimeDays: '0',
    isPreferred: false,
    status: 'ACTIVE',
    notes: ''
  }
}

const createSupplierProductFormFromRecord = (record: SupplierProduct): SupplierProductFormState => ({
  supplierId: record.supplierId,
  stockItemId: record.stockItemId,
  supplierSku: record.supplierSku,
  supplierProductName: record.supplierProductName,
  brand: record.brand,
  manufacturer: record.manufacturer,
  purchaseUnit: record.purchaseUnit,
  packageQuantity: String(record.packageQuantity),
  baseUnit: record.baseUnit,
  conversionFactor: String(record.conversionFactor),
  defaultUnitPrice: String(record.defaultUnitPrice),
  currency: record.currency,
  minimumOrderQuantity: String(record.minimumOrderQuantity),
  leadTimeDays: String(record.leadTimeDays),
  isPreferred: record.isPreferred,
  status: record.status,
  notes: record.notes
})

const validateSupplierProductForm = (
  form: SupplierProductFormState,
  suppliers: Supplier[],
  stockItems: StockItem[]
) => {
  const packageQuantity = normalizeNumberInput(form.packageQuantity)
  const conversionFactor = normalizeNumberInput(form.conversionFactor)
  const leadTimeDays = normalizeNumberInput(form.leadTimeDays)
  const defaultUnitPrice = normalizeNumberInput(form.defaultUnitPrice)
  const minimumOrderQuantity = normalizeNumberInput(form.minimumOrderQuantity)

  if(!form.supplierId || !suppliers.some(supplier => supplier.id === form.supplierId)) return 'Tedarikçi zorunludur.'
  if(!form.stockItemId || !stockItems.some(stockItem => stockItem.id === form.stockItemId)) return 'Stok kartı zorunludur.'
  if(!form.supplierProductName.trim()) return 'Tedarikçi ürün adı zorunludur.'
  if(Number.isNaN(conversionFactor) || conversionFactor <= 0) return 'Dönüşüm katsayısı 0’dan büyük olmalıdır.'
  if(Number.isNaN(packageQuantity) || packageQuantity <= 0) return 'Paket miktarı 0’dan büyük olmalıdır.'
  if(Number.isNaN(leadTimeDays) || leadTimeDays < 0) return 'Teslim süresi negatif olamaz.'
  if(Number.isNaN(defaultUnitPrice) || defaultUnitPrice < 0) return 'Varsayılan fiyat negatif olamaz.'
  if(Number.isNaN(minimumOrderQuantity) || minimumOrderQuantity < 0) return 'Minimum sipariş miktarı negatif olamaz.'

  return ''
}

const createSupplierProductPayload = (
  form: SupplierProductFormState,
  stockItems: StockItem[],
  previousRecord?: SupplierProduct
): SupplierProduct => {
  const now = new Date().toISOString()
  const stockItem = stockItems.find(item => item.id === form.stockItemId)

  return {
    id: previousRecord?.id || createId(),
    supplierId: form.supplierId,
    stockItemId: form.stockItemId,
    categoryId: stockItem?.categoryId,
    supplierSku: form.supplierSku.trim(),
    supplierProductName: form.supplierProductName.trim(),
    brand: form.brand.trim(),
    manufacturer: form.manufacturer.trim(),
    purchaseUnit: form.purchaseUnit,
    packageQuantity: normalizeNumberInput(form.packageQuantity),
    baseUnit: stockItem?.unit || form.baseUnit.trim(),
    conversionFactor: normalizeNumberInput(form.conversionFactor),
    defaultUnitPrice: normalizeNumberInput(form.defaultUnitPrice),
    currency: form.currency.trim() || DEFAULT_CURRENCY,
    minimumOrderQuantity: normalizeNumberInput(form.minimumOrderQuantity),
    leadTimeDays: normalizeNumberInput(form.leadTimeDays),
    isPreferred: form.isPreferred,
    status: form.status,
    notes: form.notes.trim(),
    createdAt: previousRecord?.createdAt || now,
    updatedAt: now
  }
}

const validateSupplierForm = (
  form: SupplierFormState,
  suppliers: Supplier[],
  editingSupplierId: string
) => {
  const name = form.name.trim()
  const supplierCode = form.supplierCode.trim()
  const email = form.contactEmail.trim()
  const leadTimeDays = normalizeNumberInput(form.leadTimeDays)
  const paymentTermDays = normalizeNumberInput(form.paymentTermDays)
  const minimumOrderAmount = normalizeNumberInput(form.minimumOrderAmount)

  if(!name) return 'Firma adı zorunludur.'
  if(!supplierCode) return 'Tedarikçi kodu zorunludur.'

  const normalizedCode = supplierCode.toLocaleLowerCase('tr-TR')
  const duplicateCode = suppliers.some(supplier => (
    supplier.id !== editingSupplierId
    && supplier.supplierCode.toLocaleLowerCase('tr-TR') === normalizedCode
  ))
  if(duplicateCode) return 'Bu tedarikçi kodu zaten kullanılıyor.'

  if(email && !EMAIL_PATTERN.test(email)) return 'E-posta formatı geçerli olmalıdır.'
  if(Number.isNaN(leadTimeDays) || leadTimeDays < 0) return 'Teslim süresi negatif olamaz.'
  if(Number.isNaN(paymentTermDays) || paymentTermDays < 0) return 'Vade negatif olamaz.'
  if(Number.isNaN(minimumOrderAmount) || minimumOrderAmount < 0) return 'Minimum sipariş tutarı negatif olamaz.'

  return ''
}

const createSupplierPayload = (
  form: SupplierFormState,
  previousSupplier?: Supplier
): Supplier => {
  const now = new Date().toISOString()

  return {
    id: previousSupplier?.id || createId(),
    supplierCode: form.supplierCode.trim(),
    code: form.supplierCode.trim(),
    name: form.name.trim(),
    tradeName: form.tradeName.trim(),
    taxOffice: form.taxOffice.trim(),
    taxNumber: form.taxNumber.trim(),
    companyType: form.companyType,
    type: form.type,
    categoryIds: [form.categoryId || SupplierCategoryService.getCategoryByType(form.type)?.id || DEFAULT_SUPPLIER_CATEGORY_ID].filter(Boolean),
    status: form.status,
    approvalStatus: form.approvalStatus,
    workingStatus: form.workingStatus,
    defaultCurrency: form.defaultCurrency.trim() || DEFAULT_CURRENCY,
    paymentTermDays: normalizeNumberInput(form.paymentTermDays),
    leadTimeDays: normalizeNumberInput(form.leadTimeDays),
    minimumOrderAmount: normalizeNumberInput(form.minimumOrderAmount),
    currentAccountCode: form.currentAccountCode.trim(),
    contactName: form.contactName.trim(),
    contactPhone: form.contactPhone.trim(),
    mobilePhone: form.mobilePhone.trim(),
    contactEmail: form.contactEmail.trim(),
    website: form.website.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
    district: form.district.trim(),
    postalCode: form.postalCode.trim(),
    country: form.country.trim() || DEFAULT_COUNTRY,
    notes: form.notes.trim(),
    createdAt: previousSupplier?.createdAt || now,
    updatedAt: now
  }
}

export default function SupplierManagement(){
  const [suppliers, setSuppliers] = React.useState<Supplier[]>(() => SupplierService.listSuppliers())
  const [stockItems] = React.useState<StockItem[]>(() => loadStockItems())
  const [sourceData] = React.useState(() => loadKpiSourceData())
  const [supplierProducts, setSupplierProducts] = React.useState<SupplierProduct[]>(() => loadSupplierProductRecords(suppliers, stockItems))
  const [activeView, setActiveView] = React.useState<SupplierManagementView>('suppliers')
  const [selectedSupplierId, setSelectedSupplierId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<SupplierPanelMode>('detail')
  const [editingSupplierId, setEditingSupplierId] = React.useState('')
  const [form, setForm] = React.useState<SupplierFormState>(() => createEmptySupplierForm(SupplierService.listSuppliers()))
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<SupplierStatusFilter>('all')
  const [approvalFilter, setApprovalFilter] = React.useState<SupplierApprovalFilter>('all')
  const [categoryFilter, setCategoryFilter] = React.useState('all')
  const [cityFilter, setCityFilter] = React.useState('all')
  const [districtFilter, setDistrictFilter] = React.useState('all')
  const [companyTypeFilter, setCompanyTypeFilter] = React.useState<SupplierCompanyTypeFilter>('all')
  const [supplierTypeFilter, setSupplierTypeFilter] = React.useState<SupplierTypeFilter>('all')
  const [workingStatusFilter, setWorkingStatusFilter] = React.useState<SupplierWorkingStatusFilter>('all')

  const selectedSupplier = React.useMemo(() => (
    suppliers.find(supplier => supplier.id === selectedSupplierId) || suppliers[0] || null
  ), [selectedSupplierId, suppliers])

  React.useEffect(() => {
    if(selectedSupplierId && suppliers.some(supplier => supplier.id === selectedSupplierId)) return
    setSelectedSupplierId(suppliers[0]?.id || '')
  }, [selectedSupplierId, suppliers])

  const commitSuppliers = React.useCallback((nextSuppliers: Supplier[]) => {
    setSuppliers(nextSuppliers)
    SupplierService.saveSuppliers(nextSuppliers)
  }, [])

  const supplierCategories = React.useMemo(() => SupplierCategoryService.listCategories(), [])

  const statisticsMap = React.useMemo(() => (
    SupplierStatisticsService.createStatisticsMap(
      suppliers,
      sourceData.purchaseOrders,
      sourceData.goodsReceipts,
      supplierProducts
    )
  ), [sourceData.goodsReceipts, sourceData.purchaseOrders, supplierProducts, suppliers])

  const cityOptions = React.useMemo(() => {
    return Array.from(new Set(suppliers.map(supplier => supplier.city).filter(Boolean)))
      .sort((first, second) => first.localeCompare(second, 'tr-TR'))
  }, [suppliers])

  const districtOptions = React.useMemo(() => {
    return Array.from(new Set(suppliers.map(supplier => supplier.district).filter(Boolean)))
      .sort((first, second) => first.localeCompare(second, 'tr-TR'))
  }, [suppliers])

  const visibleSuppliers = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return suppliers.filter(supplier => {
      const searchFields = [
        supplier.supplierCode,
        supplier.name,
        supplier.tradeName,
        supplier.taxNumber,
        supplier.contactName,
        supplier.contactPhone,
        supplier.mobilePhone,
        SupplierCategoryService.getCategoryNames(supplier).join(' '),
        supplier.city,
        supplier.district
      ]

      const matchesSearch = !normalizedSearch
        || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesStatus = statusFilter === 'all' || supplier.status === statusFilter
      const matchesApproval = approvalFilter === 'all' || supplier.approvalStatus === approvalFilter
      const matchesCategory = categoryFilter === 'all' || supplier.categoryIds.includes(categoryFilter)
      const matchesCity = cityFilter === 'all' || supplier.city === cityFilter
      const matchesDistrict = districtFilter === 'all' || supplier.district === districtFilter
      const matchesCompanyType = companyTypeFilter === 'all' || supplier.companyType === companyTypeFilter
      const matchesSupplierType = supplierTypeFilter === 'all' || supplier.type === supplierTypeFilter
      const matchesWorkingStatus = workingStatusFilter === 'all' || supplier.workingStatus === workingStatusFilter

      return matchesSearch && matchesStatus && matchesApproval && matchesCategory && matchesCity && matchesDistrict && matchesCompanyType && matchesSupplierType && matchesWorkingStatus
    })
  }, [approvalFilter, categoryFilter, cityFilter, companyTypeFilter, districtFilter, search, statusFilter, supplierTypeFilter, suppliers, workingStatusFilter])

  const exportVisibleSuppliers = () => {
    ExcelIntegrationService.exportModuleView({
      moduleKey: 'suppliers',
      rows: visibleSuppliers,
      userName: ExcelIntegrationService.defaultUserName,
      fileNamePrefix: 'tedarikci-listesi',
      filterText: search,
      sortLabel: 'Mevcut liste sirasi',
      columns: [
        { key: 'supplierCode', header: 'Kod', value: supplier => supplier.supplierCode },
        { key: 'name', header: 'Firma', value: supplier => supplier.name },
        { key: 'tradeName', header: 'Ticari Unvan', value: supplier => supplier.tradeName || '' },
        { key: 'categoryName', header: 'Kategori', value: supplier => SupplierCategoryService.getCategoryNames(supplier).join(', ') || '-' },
        { key: 'contactName', header: 'Yetkili', value: supplier => supplier.contactName || '-' },
        { key: 'contactPhone', header: 'Telefon', value: supplier => supplier.contactPhone || supplier.mobilePhone || '-' },
        { key: 'city', header: 'Sehir', value: supplier => supplier.city || '-' },
        { key: 'status', header: 'Durum', value: supplier => SUPPLIER_STATUS_LABELS[supplier.status] },
        { key: 'approvalStatus', header: 'Onay', value: supplier => SUPPLIER_APPROVAL_STATUS_LABELS[supplier.approvalStatus] },
        { key: 'leadTimeDays', header: 'Teslim Suresi', type: 'number', value: supplier => supplier.leadTimeDays },
        { key: 'paymentTermDays', header: 'Vade', type: 'number', value: supplier => supplier.paymentTermDays },
        { key: 'lastOrderDate', header: 'Son Siparis', value: supplier => statisticsMap.get(supplier.id)?.lastOrderDate || '-' }
      ]
    })
  }

  const activeCount = suppliers.filter(supplier => supplier.status === 'ACTIVE').length
  const passiveCount = suppliers.filter(supplier => supplier.status === 'PASSIVE').length
  const pendingCount = suppliers.filter(supplier => supplier.status === 'PENDING_APPROVAL' || supplier.approvalStatus === 'PENDING').length
  const blacklistedCount = suppliers.filter(supplier => supplier.status === 'BLACKLISTED' || supplier.status === 'BLOCKED').length
  const approvedCount = suppliers.filter(supplier => supplier.approvalStatus === 'APPROVED').length
  const blockedCount = blacklistedCount
  const mostOrderedSupplier = SupplierStatisticsService.getMostOrderedSupplier(suppliers, statisticsMap)
  const highestPurchaseSupplier = SupplierStatisticsService.getHighestPurchaseSupplier(suppliers, statisticsMap)

  const updateFormField = <K extends SupplierFormField>(field: K, value: SupplierFormState[K]) => {
    setForm(prev => {
      if(field !== 'type') return { ...prev, [field]: value }
      const nextType = value as SupplierType
      return {
        ...prev,
        type: nextType,
        categoryId: SupplierCategoryService.getCategoryByType(nextType)?.id || prev.categoryId
      }
    })
  }

  const startCreate = () => {
    setEditingSupplierId('')
    setForm(createEmptySupplierForm(suppliers))
    setFormError('')
    setPanelMode('form')
  }

  const startEdit = (supplier: Supplier) => {
    setSelectedSupplierId(supplier.id)
    setEditingSupplierId(supplier.id)
    setForm(createSupplierFormFromRecord(supplier))
    setFormError('')
    setPanelMode('form')
  }

  const cancelForm = () => {
    setEditingSupplierId('')
    setForm(createEmptySupplierForm(suppliers))
    setFormError('')
    setPanelMode('detail')
  }

  const selectSupplier = (supplier: Supplier) => {
    setSelectedSupplierId(supplier.id)
    setPanelMode('detail')
    setEditingSupplierId('')
    setFormError('')
  }

  const saveSupplier = (event: React.FormEvent) => {
    event.preventDefault()

    const validationError = validateSupplierForm(form, suppliers, editingSupplierId)
    if(validationError){
      setFormError(validationError)
      return
    }

    const previousSupplier = editingSupplierId
      ? suppliers.find(supplier => supplier.id === editingSupplierId)
      : undefined
    const supplierPayload = createSupplierPayload(form, previousSupplier)
    const nextSuppliers = previousSupplier
      ? suppliers.map(supplier => supplier.id === previousSupplier.id ? supplierPayload : supplier)
      : [supplierPayload, ...suppliers]

    commitSuppliers(nextSuppliers)
    setSelectedSupplierId(supplierPayload.id)
    setEditingSupplierId('')
    setForm(createEmptySupplierForm(nextSuppliers))
    setFormError('')
    setPanelMode('detail')
  }

  const deleteSupplier = (supplier: Supplier) => {
    if(!confirm(`${supplier.name} tedarikçi kartı silinecek. Emin misiniz?`)) return

    const nextSuppliers = suppliers.filter(item => item.id !== supplier.id)
    commitSuppliers(nextSuppliers)
    setSelectedSupplierId(nextSuppliers[0]?.id || '')
    setEditingSupplierId('')
    setForm(createEmptySupplierForm(nextSuppliers))
    setFormError('')
    setPanelMode('detail')
  }

  return (
    <div className="supplier-management-page">
      <div className="page-title">
        <div>
          <h2>Tedarikçi Yönetimi</h2>
          <p className="muted">Satın alma süreçleri için tedarikçi kartlarını yönetin.</p>
        </div>
        {activeView === 'suppliers' && <button className="btn primary" type="button" onClick={startCreate}>Yeni Tedarikçi</button>}
      </div>

      <div className="supplier-view-tabs">
        <button
          className={`btn ${activeView === 'suppliers' ? 'primary' : ''}`}
          type="button"
          onClick={() => setActiveView('suppliers')}
        >
          Tedarikçiler
        </button>
        <button
          className={`btn ${activeView === 'supplier-products' ? 'primary' : ''}`}
          type="button"
          onClick={() => setActiveView('supplier-products')}
        >
          Tedarikçi Ürünleri
        </button>
      </div>

      {activeView === 'suppliers' ? (
        <>
      <div className="metric-grid supplier-dashboard-grid">
        <div className="metric-card">
          <span>Toplam Tedarikçi</span>
          <strong>{suppliers.length}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Tedarikçi</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Onaylı Tedarikçi</span>
          <strong>{approvedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Blokeli Tedarikçi</span>
          <strong>{blockedCount}</strong>
        </div>
        <div className="metric-card">
          <span>Pasif</span>
          <strong>{passiveCount}</strong>
        </div>
        <div className="metric-card">
          <span>Onay Bekleyen</span>
          <strong>{pendingCount}</strong>
        </div>
        <div className="metric-card">
          <span>Kara Liste</span>
          <strong>{blacklistedCount}</strong>
        </div>
        <div className="metric-card">
          <span>En Ã‡ok SipariÅŸ</span>
          <strong>{mostOrderedSupplier?.name || '-'}</strong>
          <small>{mostOrderedSupplier ? `${statisticsMap.get(mostOrderedSupplier.id)?.totalPurchaseOrders || 0} PO` : 'KayÄ±t yok'}</small>
        </div>
        <div className="metric-card">
          <span>En Ã‡ok AlÄ±m</span>
          <strong>{highestPurchaseSupplier?.name || '-'}</strong>
          <small>{highestPurchaseSupplier ? formatCurrency(statisticsMap.get(highestPurchaseSupplier.id)?.totalPurchaseAmount || 0, highestPurchaseSupplier.defaultCurrency) : 'KayÄ±t yok'}</small>
        </div>
      </div>

      <div className="product-layout supplier-management-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Tedarikçi Listesi</h3>
              <p className="muted">{visibleSuppliers.length} kayıt gösteriliyor.</p>
            </div>
            <div className="supplier-toolbar">
              <button className="btn" type="button" onClick={exportVisibleSuppliers}>Excel'e Aktar</button>
              <input
                type="search"
                placeholder="Kod, firma, vergi no, yetkili, telefon veya şehir ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as SupplierStatusFilter)}>
                <option value="all">Tüm Durumlar</option>
                {SUPPLIER_STATUSES.map(status => (
                  <option key={status} value={status}>{SUPPLIER_STATUS_LABELS[status]}</option>
                ))}
              </select>
              <select value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}>
                <option value="all">TÃ¼m Kategoriler</option>
                {supplierCategories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
              <select value={approvalFilter} onChange={event => setApprovalFilter(event.target.value as SupplierApprovalFilter)}>
                <option value="all">Tüm Onaylar</option>
                {SUPPLIER_APPROVAL_STATUSES.map(status => (
                  <option key={status} value={status}>{SUPPLIER_APPROVAL_STATUS_LABELS[status]}</option>
                ))}
              </select>
              <select value={cityFilter} onChange={event => setCityFilter(event.target.value)}>
                <option value="all">Tüm Şehirler</option>
                {cityOptions.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
              <select value={districtFilter} onChange={event => setDistrictFilter(event.target.value)}>
                <option value="all">TÃ¼m Ä°lÃ§eler</option>
                {districtOptions.map(district => <option key={district} value={district}>{district}</option>)}
              </select>
              <select value={companyTypeFilter} onChange={event => setCompanyTypeFilter(event.target.value as SupplierCompanyTypeFilter)}>
                <option value="all">Tüm Firma Tipleri</option>
                {SUPPLIER_COMPANY_TYPES.map(type => (
                  <option key={type} value={type}>{SUPPLIER_COMPANY_TYPE_LABELS[type]}</option>
                ))}
              </select>
              <select value={supplierTypeFilter} onChange={event => setSupplierTypeFilter(event.target.value as SupplierTypeFilter)}>
                <option value="all">TÃ¼m Tedarik Tipleri</option>
                {SUPPLIER_TYPES.map(type => (
                  <option key={type} value={type}>{SUPPLIER_TYPE_LABELS[type]}</option>
                ))}
              </select>
              <select value={workingStatusFilter} onChange={event => setWorkingStatusFilter(event.target.value as SupplierWorkingStatusFilter)}>
                <option value="all">TÃ¼m Ã‡alÄ±ÅŸma DurumlarÄ±</option>
                {SUPPLIER_WORKING_STATUSES.map(status => (
                  <option key={status} value={status}>{SUPPLIER_WORKING_STATUS_LABELS[status]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap supplier-table-wrap">
            <table className="data-table supplier-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Firma</th>
                  <th>Kategori</th>
                  <th>Yetkili</th>
                  <th>Telefon</th>
                  <th>Şehir</th>
                  <th>Durum</th>
                  <th>Onay</th>
                  <th>Teslim Süresi</th>
                  <th>Vade</th>
                  <th>Son SipariÅŸ</th>
                </tr>
              </thead>
              <tbody>
                {visibleSuppliers.length === 0 && (
                  <tr><td colSpan={11} className="empty-cell">Bu filtrelere uygun tedarikçi bulunamadı.</td></tr>
                )}
                {visibleSuppliers.map(supplier => (
                  <tr
                    key={supplier.id}
                    className={selectedSupplier?.id === supplier.id ? 'selected' : ''}
                    tabIndex={0}
                    onClick={() => selectSupplier(supplier)}
                    onKeyDown={event => {
                      if(event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      selectSupplier(supplier)
                    }}
                  >
                    <td data-label="Kod"><strong>{supplier.supplierCode}</strong></td>
                    <td data-label="Firma">
                      <strong>{supplier.name}</strong>
                      <div className="muted small-text">
                        {[supplier.tradeName, supplier.taxNumber && `Vergi No: ${supplier.taxNumber}`].filter(Boolean).join(' · ') || '-'}
                      </div>
                    </td>
                    <td data-label="Kategori">{SupplierCategoryService.getCategoryNames(supplier).join(', ') || '-'}</td>
                    <td data-label="Yetkili">{supplier.contactName || '-'}</td>
                    <td data-label="Telefon">{supplier.contactPhone || supplier.mobilePhone || '-'}</td>
                    <td data-label="Şehir">{supplier.city || '-'}</td>
                    <td data-label="Durum">
                      <span className={`status-pill ${getStatusClass(supplier.status)}`}>
                        {SUPPLIER_STATUS_LABELS[supplier.status]}
                      </span>
                    </td>
                    <td data-label="Onay">
                      <span className={`status-pill ${getApprovalStatusClass(supplier.approvalStatus)}`}>
                        {SUPPLIER_APPROVAL_STATUS_LABELS[supplier.approvalStatus]}
                      </span>
                    </td>
                    <td data-label="Teslim Süresi">{formatDays(supplier.leadTimeDays)}</td>
                    <td data-label="Vade">{formatDays(supplier.paymentTermDays)}</td>
                    <td data-label="Son SipariÅŸ">{statisticsMap.get(supplier.id)?.lastOrderDate || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side supplier-management-side">
          {panelMode === 'form' ? (
            <section className="card">
              <div className="section-header compact">
                <h3>{editingSupplierId ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}</h3>
                {editingSupplierId && <span className="status-pill">Düzenleme</span>}
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <SupplierForm
                form={form}
                onChange={updateFormField}
                onSubmit={saveSupplier}
                onCancel={cancelForm}
              />
            </section>
          ) : (
            <SupplierDetailPanel
              supplier={selectedSupplier}
              supplierProducts={supplierProducts.filter(product => product.supplierId === selectedSupplier?.id)}
              statistics={selectedSupplier ? statisticsMap.get(selectedSupplier.id) || null : null}
              stockItems={stockItems}
              onCreate={startCreate}
              onEdit={startEdit}
              onDelete={deleteSupplier}
            />
          )}
        </aside>
      </div>
        </>
      ) : (
        <SupplierProductManagement suppliers={suppliers} stockItems={stockItems} initialRecords={supplierProducts} onRecordsChange={setSupplierProducts} />
      )}
    </div>
  )
}

function SupplierDetailPanel({
  supplier,
  supplierProducts,
  statistics,
  stockItems,
  onCreate,
  onEdit,
  onDelete
}: {
  supplier: Supplier | null
  supplierProducts: SupplierProduct[]
  statistics: SupplierStatistics | null
  stockItems: StockItem[]
  onCreate: () => void
  onEdit: (supplier: Supplier) => void
  onDelete: (supplier: Supplier) => void
}){
  if(!supplier){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>Tedarikçi Detayı</h3>
        </div>
        <p className="muted">Detayları görmek için bir tedarikçi seçin.</p>
        <button className="btn primary" type="button" onClick={onCreate}>Yeni Tedarikçi</button>
      </section>
    )
  }

  return (
    <>
      <section className="card supplier-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{supplier.name}</h3>
            <p className="muted">{supplier.supplierCode}</p>
          </div>
          <span className={`status-pill ${getStatusClass(supplier.status)}`}>
            {SUPPLIER_STATUS_LABELS[supplier.status]}
          </span>
        </div>
        <div className="supplier-side-actions">
          <button className="btn" type="button" onClick={onCreate}>Yeni</button>
          <button className="btn primary" type="button" onClick={() => onEdit(supplier)}>Düzenle</button>
          <button className="btn" type="button" onClick={() => onDelete(supplier)}>Sil</button>
        </div>
      </section>

      <section className="card supplier-detail-card">
        <h3>Firma Bilgileri</h3>
        <div className="supplier-detail-grid">
          <div><span>Firma</span><strong>{supplier.name}</strong></div>
          <div><span>Ticari Ünvan</span><strong>{supplier.tradeName || '-'}</strong></div>
          <div><span>Tedarikçi Tipi</span><strong>{SUPPLIER_TYPE_LABELS[supplier.type]}</strong></div>
          <div><span>Kategori</span><strong>{SupplierCategoryService.getCategoryNames(supplier).join(', ') || '-'}</strong></div>
          <div><span>Firma Tipi</span><strong>{SUPPLIER_COMPANY_TYPE_LABELS[supplier.companyType]}</strong></div>
          <div><span>Çalışma Durumu</span><strong>{SUPPLIER_WORKING_STATUS_LABELS[supplier.workingStatus]}</strong></div>
          <div><span>Onay</span><strong>{SUPPLIER_APPROVAL_STATUS_LABELS[supplier.approvalStatus]}</strong></div>
          <div><span>Vergi Dairesi</span><strong>{supplier.taxOffice || '-'}</strong></div>
          <div><span>Vergi No</span><strong>{supplier.taxNumber || '-'}</strong></div>
        </div>
      </section>

      <section className="card supplier-detail-card">
        <h3>İletişim</h3>
        <div className="supplier-detail-grid">
          <div><span>Yetkili</span><strong>{supplier.contactName || '-'}</strong></div>
          <div><span>Telefon</span><strong>{supplier.contactPhone || '-'}</strong></div>
          <div><span>Cep Telefonu</span><strong>{supplier.mobilePhone || '-'}</strong></div>
          <div><span>E-posta</span><strong>{supplier.contactEmail || '-'}</strong></div>
          <div><span>Website</span><strong>{supplier.website || '-'}</strong></div>
          <div><span>Şehir</span><strong>{supplier.city || '-'}</strong></div>
          <div><span>İlçe</span><strong>{supplier.district || '-'}</strong></div>
          <div><span>Posta Kodu</span><strong>{supplier.postalCode || '-'}</strong></div>
          <div><span>Ülke</span><strong>{supplier.country || '-'}</strong></div>
        </div>
        <div className="supplier-address-block">
          <span>Adres</span>
          <strong>{SupplierAddressService.getAddressLabel(supplier)}</strong>
        </div>
        <p className="muted small-text">{SupplierContactService.getContactLabel(supplier)}</p>
      </section>

      <section className="card supplier-detail-card">
        <h3>Satın Alma Bilgileri</h3>
        <div className="supplier-detail-grid">
          <div><span>Para Birimi</span><strong>{supplier.defaultCurrency}</strong></div>
          <div><span>Teslim Süresi</span><strong>{formatDays(supplier.leadTimeDays)}</strong></div>
          <div><span>Vade</span><strong>{formatDays(supplier.paymentTermDays)}</strong></div>
          <div><span>Minimum Sipariş</span><strong>{formatCurrency(supplier.minimumOrderAmount, supplier.defaultCurrency)}</strong></div>
          <div><span>Cari Kod</span><strong>{supplier.currentAccountCode || '-'}</strong></div>
          <div><span>Oluşturma</span><strong>{formatDateTime(supplier.createdAt)}</strong></div>
          <div><span>Güncelleme</span><strong>{formatDateTime(supplier.updatedAt)}</strong></div>
        </div>
      </section>

      {statistics && (
        <section className="card supplier-detail-card">
          <h3>İstatistikler</h3>
          <div className="supplier-detail-grid">
            <div><span>Toplam Purchase Order</span><strong>{statistics.totalPurchaseOrders}</strong></div>
            <div><span>Toplam Alım Tutarı</span><strong>{formatCurrency(statistics.totalPurchaseAmount, supplier.defaultCurrency)}</strong></div>
            <div><span>Toplam Teslimat</span><strong>{statistics.totalDeliveries}</strong></div>
            <div><span>Geciken Teslimat</span><strong>{statistics.delayedDeliveries}</strong></div>
            <div><span>Kalite Reddi</span><strong>{statistics.qualityRejections}</strong></div>
            <div><span>Aktif Sipariş</span><strong>{statistics.activeOrders}</strong></div>
            <div><span>Son Sipariş Tarihi</span><strong>{statistics.lastOrderDate || '-'}</strong></div>
            <div><span>Tedarik Ürünü</span><strong>{statistics.suppliedProductCount}</strong></div>
          </div>
        </section>
      )}

      <section className="card supplier-detail-card">
        <h3>Tedarik Ettiği Ürünler</h3>
        <div className="supplier-product-mini-list">
          {supplierProducts.length === 0 && <div className="empty-cell">Tedarikçi ürünü bulunmuyor.</div>}
          {supplierProducts.slice(0, 8).map(product => {
            const stockItem = stockItems.find(item => item.id === product.stockItemId)
            const categoryName = SupplierCategoryService.getCategoryById(product.categoryId || supplier.categoryIds[0])?.name
              || SupplierCategoryService.getCategoryNames(supplier)[0]
              || '-'

            return (
              <div className="supplier-product-mini-row" key={product.id}>
                <strong>{product.supplierProductName}</strong>
                <span>{categoryName} / {stockItem?.name || '-'} / {product.brand || '-'} / {product.isPreferred ? 'Varsayılan' : 'Alternatif'}</span>
              </div>
            )
          })}
        </div>
      </section>

      <section className="card supplier-detail-card">
        <h3>Notlar</h3>
        <p className="muted supplier-notes">{supplier.notes || 'Not bulunmuyor.'}</p>
      </section>
    </>
  )
}

function SupplierForm({
  form,
  onChange,
  onSubmit,
  onCancel
}: {
  form: SupplierFormState
  onChange: <K extends SupplierFormField>(field: K, value: SupplierFormState[K]) => void
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void
}){
  return (
    <form className="stacked-form supplier-form" onSubmit={onSubmit}>
      <div className="supplier-form-section">
        <h4>Firma Bilgileri</h4>
        <div className="supplier-form-grid">
          <div className="form-field">
            <label>Kod</label>
            <input value={form.supplierCode} onChange={event => onChange('supplierCode', event.target.value)} required />
          </div>
          <div className="form-field">
            <label>Firma Adı</label>
            <input value={form.name} onChange={event => onChange('name', event.target.value)} required />
          </div>
          <div className="form-field">
            <label>Ticari Ünvan</label>
            <input value={form.tradeName} onChange={event => onChange('tradeName', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Firma Tipi</label>
            <select value={form.companyType} onChange={event => onChange('companyType', event.target.value as SupplierCompanyType)}>
              {SUPPLIER_COMPANY_TYPES.map(type => (
                <option key={type} value={type}>{SUPPLIER_COMPANY_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>TedarikÃ§i Tipi</label>
            <select value={form.type} onChange={event => onChange('type', event.target.value as SupplierType)}>
              {SUPPLIER_TYPES.map(type => (
                <option key={type} value={type}>{SUPPLIER_TYPE_LABELS[type]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Kategori</label>
            <select value={form.categoryId} onChange={event => onChange('categoryId', event.target.value)}>
              {SupplierCategoryService.listCategories().map(category => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Durum</label>
            <select value={form.status} onChange={event => onChange('status', event.target.value as SupplierStatus)}>
              {SUPPLIER_STATUSES.map(status => (
                <option key={status} value={status}>{SUPPLIER_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Onay Durumu</label>
            <select value={form.approvalStatus} onChange={event => onChange('approvalStatus', event.target.value as SupplierApprovalStatus)}>
              {SUPPLIER_APPROVAL_STATUSES.map(status => (
                <option key={status} value={status}>{SUPPLIER_APPROVAL_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Ã‡alÄ±ÅŸma Durumu</label>
            <select value={form.workingStatus} onChange={event => onChange('workingStatus', event.target.value as SupplierWorkingStatus)}>
              {SUPPLIER_WORKING_STATUSES.map(status => (
                <option key={status} value={status}>{SUPPLIER_WORKING_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="supplier-form-section">
        <h4>Vergi Bilgileri</h4>
        <div className="supplier-form-grid">
          <div className="form-field">
            <label>Vergi Dairesi</label>
            <input value={form.taxOffice} onChange={event => onChange('taxOffice', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Vergi Numarası</label>
            <input value={form.taxNumber} onChange={event => onChange('taxNumber', event.target.value)} />
          </div>
        </div>
      </div>

      <div className="supplier-form-section">
        <h4>İletişim Bilgileri</h4>
        <div className="supplier-form-grid">
          <div className="form-field">
            <label>Yetkili</label>
            <input value={form.contactName} onChange={event => onChange('contactName', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Telefon</label>
            <input value={form.contactPhone} onChange={event => onChange('contactPhone', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Cep Telefonu</label>
            <input value={form.mobilePhone} onChange={event => onChange('mobilePhone', event.target.value)} />
          </div>
          <div className="form-field">
            <label>E-posta</label>
            <input type="email" value={form.contactEmail} onChange={event => onChange('contactEmail', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Website</label>
            <input value={form.website} onChange={event => onChange('website', event.target.value)} />
          </div>
        </div>
      </div>

      <div className="supplier-form-section">
        <h4>Adres Bilgileri</h4>
        <div className="supplier-form-grid">
          <div className="form-field">
            <label>Şehir</label>
            <input value={form.city} onChange={event => onChange('city', event.target.value)} />
          </div>
          <div className="form-field">
            <label>İlçe</label>
            <input value={form.district} onChange={event => onChange('district', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Posta Kodu</label>
            <input value={form.postalCode} onChange={event => onChange('postalCode', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Ülke</label>
            <input value={form.country} onChange={event => onChange('country', event.target.value)} />
          </div>
          <div className="form-field supplier-form-wide">
            <label>Adres</label>
            <textarea rows={3} value={form.address} onChange={event => onChange('address', event.target.value)} />
          </div>
        </div>
      </div>

      <div className="supplier-form-section">
        <h4>Satın Alma Bilgileri</h4>
        <div className="supplier-form-grid">
          <div className="form-field">
            <label>Para Birimi</label>
            <select value={form.defaultCurrency} onChange={event => onChange('defaultCurrency', event.target.value)}>
              {SUPPLIER_CURRENCIES.map(currency => <option key={currency} value={currency}>{currency}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Teslim Süresi</label>
            <input min="0" step="1" type="number" value={form.leadTimeDays} onChange={event => onChange('leadTimeDays', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Vade</label>
            <input min="0" step="1" type="number" value={form.paymentTermDays} onChange={event => onChange('paymentTermDays', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Minimum Sipariş</label>
            <input min="0" step="0.01" type="number" value={form.minimumOrderAmount} onChange={event => onChange('minimumOrderAmount', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Cari Kod</label>
            <input value={form.currentAccountCode} onChange={event => onChange('currentAccountCode', event.target.value)} />
          </div>
        </div>
      </div>

      <div className="supplier-form-section">
        <h4>Notlar</h4>
        <div className="form-field">
          <label>Not</label>
          <textarea rows={4} value={form.notes} onChange={event => onChange('notes', event.target.value)} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}

function SupplierProductManagement({
  initialRecords,
  onRecordsChange,
  suppliers,
  stockItems
}: {
  initialRecords: SupplierProduct[]
  onRecordsChange: (records: SupplierProduct[]) => void
  suppliers: Supplier[]
  stockItems: StockItem[]
}){
  const [records, setRecords] = React.useState<SupplierProduct[]>(initialRecords)
  const [selectedRecordId, setSelectedRecordId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<SupplierPanelMode>('detail')
  const [editingRecordId, setEditingRecordId] = React.useState('')
  const [form, setForm] = React.useState<SupplierProductFormState>(() => createEmptySupplierProductForm(suppliers, stockItems))
  const [formError, setFormError] = React.useState('')
  const [search, setSearch] = React.useState('')
  const [supplierFilter, setSupplierFilter] = React.useState('all')
  const [statusFilter, setStatusFilter] = React.useState<SupplierProductStatusFilter>('all')
  const [brandFilter, setBrandFilter] = React.useState('all')
  const [stockItemFilter, setStockItemFilter] = React.useState('all')

  const supplierMap = React.useMemo(() => new Map(suppliers.map(supplier => [supplier.id, supplier])), [suppliers])
  const stockItemMap = React.useMemo(() => new Map(stockItems.map(stockItem => [stockItem.id, stockItem])), [stockItems])

  const selectedRecord = React.useMemo(() => (
    records.find(record => record.id === selectedRecordId) || records[0] || null
  ), [records, selectedRecordId])

  React.useEffect(() => {
    if(selectedRecordId && records.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(records[0]?.id || '')
  }, [records, selectedRecordId])

  const commitRecords = React.useCallback((nextRecords: SupplierProduct[]) => {
    setRecords(nextRecords)
    onRecordsChange(nextRecords)
    saveSupplierProductRecords(nextRecords)
  }, [onRecordsChange])

  const brandOptions = React.useMemo(() => {
    return Array.from(new Set(records.map(record => record.brand).filter(Boolean)))
      .sort((first, second) => first.localeCompare(second, 'tr-TR'))
  }, [records])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = toSearchText(search)

    return records.filter(record => {
      const supplier = supplierMap.get(record.supplierId)
      const stockItem = stockItemMap.get(record.stockItemId)
      const searchFields = [
        supplier?.name || '',
        record.supplierProductName,
        record.brand,
        record.supplierSku,
        stockItem?.name || ''
      ]

      const matchesSearch = !normalizedSearch
        || searchFields.some(field => toSearchText(field).includes(normalizedSearch))
      const matchesSupplier = supplierFilter === 'all' || record.supplierId === supplierFilter
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesBrand = brandFilter === 'all' || record.brand === brandFilter
      const matchesStockItem = stockItemFilter === 'all' || record.stockItemId === stockItemFilter

      return matchesSearch && matchesSupplier && matchesStatus && matchesBrand && matchesStockItem
    })
  }, [brandFilter, records, search, statusFilter, stockItemFilter, stockItemMap, supplierFilter, supplierMap])

  const activeCount = records.filter(record => record.status === 'ACTIVE').length
  const preferredCount = records.filter(record => record.isPreferred).length
  const mappedStockCount = new Set(records.map(record => record.stockItemId).filter(Boolean)).size

  const updateFormField = <K extends SupplierProductFormField>(field: K, value: SupplierProductFormState[K]) => {
    setForm(prev => {
      if(field !== 'stockItemId') return { ...prev, [field]: value }

      const stockItem = stockItemMap.get(String(value))
      return {
        ...prev,
        stockItemId: String(value),
        baseUnit: stockItem?.unit || prev.baseUnit
      }
    })
  }

  const startCreate = () => {
    setEditingRecordId('')
    setForm(createEmptySupplierProductForm(suppliers, stockItems))
    setFormError('')
    setPanelMode('form')
  }

  const startEdit = (record: SupplierProduct) => {
    setSelectedRecordId(record.id)
    setEditingRecordId(record.id)
    setForm(createSupplierProductFormFromRecord(record))
    setFormError('')
    setPanelMode('form')
  }

  const cancelForm = () => {
    setEditingRecordId('')
    setForm(createEmptySupplierProductForm(suppliers, stockItems))
    setFormError('')
    setPanelMode('detail')
  }

  const selectRecord = (record: SupplierProduct) => {
    setSelectedRecordId(record.id)
    setEditingRecordId('')
    setFormError('')
    setPanelMode('detail')
  }

  const saveRecord = (event: React.FormEvent) => {
    event.preventDefault()

    const validationError = validateSupplierProductForm(form, suppliers, stockItems)
    if(validationError){
      setFormError(validationError)
      return
    }

    const previousRecord = editingRecordId
      ? records.find(record => record.id === editingRecordId)
      : undefined
    const payload = createSupplierProductPayload(form, stockItems, previousRecord)
    const nextRecords = previousRecord
      ? records.map(record => record.id === previousRecord.id ? payload : record)
      : [payload, ...records]

    commitRecords(nextRecords)
    setSelectedRecordId(payload.id)
    setEditingRecordId('')
    setForm(createEmptySupplierProductForm(suppliers, stockItems))
    setFormError('')
    setPanelMode('detail')
  }

  const deleteRecord = (record: SupplierProduct) => {
    if(!confirm(`${record.supplierProductName} tedarikçi ürünü silinecek. Emin misiniz?`)) return

    const nextRecords = records.filter(item => item.id !== record.id)
    commitRecords(nextRecords)
    setSelectedRecordId(nextRecords[0]?.id || '')
    setEditingRecordId('')
    setForm(createEmptySupplierProductForm(suppliers, stockItems))
    setFormError('')
    setPanelMode('detail')
  }

  return (
    <>
      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Ürün</span>
          <strong>{records.length}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Ürün</span>
          <strong>{activeCount}</strong>
        </div>
        <div className="metric-card">
          <span>Tercih Edilen</span>
          <strong>{preferredCount}</strong>
        </div>
        <div className="metric-card">
          <span>Bağlı Stok Kartı</span>
          <strong>{mappedStockCount}</strong>
        </div>
      </div>

      <div className="product-layout supplier-management-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Tedarikçi Ürünleri</h3>
              <p className="muted">{visibleRecords.length} kayıt gösteriliyor.</p>
            </div>
            <button className="btn primary" type="button" onClick={startCreate}>Yeni Ürün</button>
          </div>

          {(suppliers.length === 0 || stockItems.length === 0) && (
            <div className="form-error supplier-product-warning">
              Tedarikçi ürün eşleştirmesi için en az bir tedarikçi ve bir stok kartı gereklidir.
            </div>
          )}

          <div className="supplier-product-toolbar">
            <input
              type="search"
              placeholder="Tedarikçi, ürün, marka, SKU veya stok kartı ara"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)}>
              <option value="all">Tüm Tedarikçiler</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as SupplierProductStatusFilter)}>
              <option value="all">Tüm Durumlar</option>
              {SUPPLIER_PRODUCT_STATUSES.map(status => (
                <option key={status} value={status}>{SUPPLIER_PRODUCT_STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select value={brandFilter} onChange={event => setBrandFilter(event.target.value)}>
              <option value="all">Tüm Markalar</option>
              {brandOptions.map(brand => <option key={brand} value={brand}>{brand}</option>)}
            </select>
            <select value={stockItemFilter} onChange={event => setStockItemFilter(event.target.value)}>
              <option value="all">Tüm Stok Kartları</option>
              {stockItems.map(stockItem => <option key={stockItem.id} value={stockItem.id}>{stockItem.name}</option>)}
            </select>
          </div>

          <div className="table-wrap supplier-product-table-wrap">
            <table className="data-table supplier-product-table">
              <thead>
                <tr>
                  <th>Tedarikçi</th>
                  <th>Ürün</th>
                  <th>Marka</th>
                  <th>Stok Kartı</th>
                  <th>Satın Alma Birimi</th>
                  <th>Paket Miktarı</th>
                  <th>Varsayılan Fiyat</th>
                  <th>Teslim Süresi</th>
                  <th>Tercih Edilen</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {visibleRecords.length === 0 && (
                  <tr><td colSpan={10} className="empty-cell">Bu filtrelere uygun tedarikçi ürünü bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => {
                  const supplier = supplierMap.get(record.supplierId)
                  const stockItem = stockItemMap.get(record.stockItemId)

                  return (
                    <tr
                      key={record.id}
                      className={selectedRecord?.id === record.id ? 'selected' : ''}
                      tabIndex={0}
                      onClick={() => selectRecord(record)}
                      onKeyDown={event => {
                        if(event.key !== 'Enter' && event.key !== ' ') return
                        event.preventDefault()
                        selectRecord(record)
                      }}
                    >
                      <td data-label="Tedarikçi">{supplier?.name || 'Tedarikçi bulunamadı'}</td>
                      <td data-label="Ürün">
                        <strong>{record.supplierProductName}</strong>
                        <div className="muted small-text">{record.supplierSku || '-'}</div>
                      </td>
                      <td data-label="Marka">{record.brand || '-'}</td>
                      <td data-label="Stok Kartı">{stockItem?.name || 'Stok kartı bulunamadı'}</td>
                      <td data-label="Satın Alma Birimi">{record.purchaseUnit}</td>
                      <td data-label="Paket Miktarı">{formatQuantity(record.packageQuantity, record.purchaseUnit)}</td>
                      <td data-label="Varsayılan Fiyat">{formatCurrency(record.defaultUnitPrice, record.currency)}</td>
                      <td data-label="Teslim Süresi">{formatDays(record.leadTimeDays)}</td>
                      <td data-label="Tercih Edilen">{record.isPreferred ? 'Evet' : 'Hayır'}</td>
                      <td data-label="Durum">
                        <span className={`status-pill ${record.status === 'ACTIVE' ? 'success' : 'muted-pill'}`}>
                          {SUPPLIER_PRODUCT_STATUS_LABELS[record.status]}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side supplier-management-side">
          {panelMode === 'form' ? (
            <section className="card">
              <div className="section-header compact">
                <h3>{editingRecordId ? 'Ürün Düzenle' : 'Yeni Tedarikçi Ürünü'}</h3>
                {editingRecordId && <span className="status-pill">Düzenleme</span>}
              </div>
              {formError && <div className="form-error">{formError}</div>}
              <SupplierProductForm
                form={form}
                suppliers={suppliers}
                stockItems={stockItems}
                onChange={updateFormField}
                onSubmit={saveRecord}
                onCancel={cancelForm}
              />
            </section>
          ) : (
            <SupplierProductDetailPanel
              record={selectedRecord}
              supplier={selectedRecord ? supplierMap.get(selectedRecord.supplierId) || null : null}
              stockItem={selectedRecord ? stockItemMap.get(selectedRecord.stockItemId) || null : null}
              onCreate={startCreate}
              onEdit={startEdit}
              onDelete={deleteRecord}
            />
          )}
        </aside>
      </div>
    </>
  )
}

function SupplierProductDetailPanel({
  record,
  supplier,
  stockItem,
  onCreate,
  onEdit,
  onDelete
}: {
  record: SupplierProduct | null
  supplier: Supplier | null
  stockItem: StockItem | null
  onCreate: () => void
  onEdit: (record: SupplierProduct) => void
  onDelete: (record: SupplierProduct) => void
}){
  if(!record){
    return (
      <section className="card">
        <div className="section-header compact">
          <h3>Tedarikçi Ürünü</h3>
        </div>
        <p className="muted">Detayları görmek için bir tedarikçi ürünü seçin.</p>
        <button className="btn primary" type="button" onClick={onCreate}>Yeni Ürün</button>
      </section>
    )
  }

  return (
    <>
      <section className="card supplier-detail-card">
        <div className="section-header compact">
          <div>
            <h3>{record.supplierProductName}</h3>
            <p className="muted">{record.supplierSku || 'SKU yok'}</p>
          </div>
          <span className={`status-pill ${record.status === 'ACTIVE' ? 'success' : 'muted-pill'}`}>
            {SUPPLIER_PRODUCT_STATUS_LABELS[record.status]}
          </span>
        </div>
        <div className="supplier-side-actions">
          <button className="btn" type="button" onClick={onCreate}>Yeni</button>
          <button className="btn primary" type="button" onClick={() => onEdit(record)}>Düzenle</button>
          <button className="btn" type="button" onClick={() => onDelete(record)}>Sil</button>
        </div>
      </section>

      <section className="card supplier-detail-card">
        <h3>Tedarikçi</h3>
        <div className="supplier-detail-grid">
          <div><span>Firma</span><strong>{supplier?.name || 'Tedarikçi bulunamadı'}</strong></div>
          <div><span>Kod</span><strong>{supplier?.supplierCode || '-'}</strong></div>
        </div>
      </section>

      <section className="card supplier-detail-card">
        <h3>Ürün Bilgisi</h3>
        <div className="supplier-detail-grid">
          <div><span>Ürün</span><strong>{record.supplierProductName}</strong></div>
          <div><span>Marka</span><strong>{record.brand || '-'}</strong></div>
          <div><span>Üretici</span><strong>{record.manufacturer || '-'}</strong></div>
          <div><span>Tercih Edilen</span><strong>{record.isPreferred ? 'Evet' : 'Hayır'}</strong></div>
        </div>
      </section>

      <section className="card supplier-detail-card">
        <h3>Stok Kartı</h3>
        <div className="supplier-detail-grid">
          <div><span>Stok Kartı</span><strong>{stockItem?.name || 'Stok kartı bulunamadı'}</strong></div>
          <div><span>Stok Birimi</span><strong>{stockItem?.unit || record.baseUnit || '-'}</strong></div>
        </div>
      </section>

      <section className="card supplier-detail-card">
        <h3>Birim Dönüşümü</h3>
        <div className="supplier-detail-grid">
          <div><span>Satın Alma Birimi</span><strong>{record.purchaseUnit}</strong></div>
          <div><span>Paket Miktarı</span><strong>{formatQuantity(record.packageQuantity, record.purchaseUnit)}</strong></div>
          <div><span>Base Unit</span><strong>{record.baseUnit || '-'}</strong></div>
          <div><span>Dönüşüm Katsayısı</span><strong>{formatQuantity(record.conversionFactor, record.baseUnit)}</strong></div>
        </div>
      </section>

      <section className="card supplier-detail-card">
        <h3>Fiyat</h3>
        <div className="supplier-detail-grid">
          <div><span>Varsayılan Fiyat</span><strong>{formatCurrency(record.defaultUnitPrice, record.currency)}</strong></div>
          <div><span>Minimum Sipariş</span><strong>{record.minimumOrderQuantity.toLocaleString('tr-TR')}</strong></div>
          <div><span>Teslim Süresi</span><strong>{formatDays(record.leadTimeDays)}</strong></div>
          <div><span>Güncelleme</span><strong>{formatDateTime(record.updatedAt)}</strong></div>
        </div>
      </section>

      <section className="card supplier-detail-card">
        <h3>Notlar</h3>
        <p className="muted supplier-notes">{record.notes || 'Not bulunmuyor.'}</p>
      </section>
    </>
  )
}

function SupplierProductForm({
  form,
  suppliers,
  stockItems,
  onChange,
  onSubmit,
  onCancel
}: {
  form: SupplierProductFormState
  suppliers: Supplier[]
  stockItems: StockItem[]
  onChange: <K extends SupplierProductFormField>(field: K, value: SupplierProductFormState[K]) => void
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void
}){
  return (
    <form className="stacked-form supplier-form" onSubmit={onSubmit}>
      <div className="supplier-form-section">
        <h4>Genel Bilgiler</h4>
        <div className="supplier-form-grid">
          <div className="form-field">
            <label>Tedarikçi</label>
            <select value={form.supplierId} onChange={event => onChange('supplierId', event.target.value)} required>
              <option value="">Tedarikçi seçin</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>SKU</label>
            <input value={form.supplierSku} onChange={event => onChange('supplierSku', event.target.value)} />
          </div>
          <div className="form-field supplier-form-wide">
            <label>Tedarikçi Ürün Adı</label>
            <input value={form.supplierProductName} onChange={event => onChange('supplierProductName', event.target.value)} required />
          </div>
          <div className="form-field">
            <label>Marka</label>
            <input value={form.brand} onChange={event => onChange('brand', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Üretici</label>
            <input value={form.manufacturer} onChange={event => onChange('manufacturer', event.target.value)} />
          </div>
        </div>
      </div>

      <div className="supplier-form-section">
        <h4>Stok Eşleştirmesi</h4>
        <div className="supplier-form-grid">
          <div className="form-field supplier-form-wide">
            <label>Stok Kartı</label>
            <select value={form.stockItemId} onChange={event => onChange('stockItemId', event.target.value)} required>
              <option value="">Stok kartı seçin</option>
              {stockItems.map(stockItem => (
                <option key={stockItem.id} value={stockItem.id}>{stockItem.name} · {stockItem.unit}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Base Unit</label>
            <input value={form.baseUnit} readOnly />
          </div>
          <div className="form-field">
            <label>Durum</label>
            <select value={form.status} onChange={event => onChange('status', event.target.value as SupplierProductStatus)}>
              {SUPPLIER_PRODUCT_STATUSES.map(status => (
                <option key={status} value={status}>{SUPPLIER_PRODUCT_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="supplier-form-section">
        <h4>Satın Alma Bilgileri</h4>
        <div className="supplier-form-grid">
          <div className="form-field">
            <label>Satın Alma Birimi</label>
            <select value={form.purchaseUnit} onChange={event => onChange('purchaseUnit', event.target.value as SupplierProductUnit)}>
              {SUPPLIER_PRODUCT_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Paket Miktarı</label>
            <input min="0.000001" step="0.001" type="number" value={form.packageQuantity} onChange={event => onChange('packageQuantity', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Dönüşüm Katsayısı</label>
            <input min="0.000001" step="0.001" type="number" value={form.conversionFactor} onChange={event => onChange('conversionFactor', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Teslim Süresi</label>
            <input min="0" step="1" type="number" value={form.leadTimeDays} onChange={event => onChange('leadTimeDays', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Minimum Sipariş Miktarı</label>
            <input min="0" step="0.001" type="number" value={form.minimumOrderQuantity} onChange={event => onChange('minimumOrderQuantity', event.target.value)} />
          </div>
          <label className="check-row form-check-field">
            <input type="checkbox" checked={form.isPreferred} onChange={event => onChange('isPreferred', event.target.checked)} />
            <span>Tercih edilen ürün</span>
          </label>
        </div>
      </div>

      <div className="supplier-form-section">
        <h4>Fiyat Bilgileri</h4>
        <div className="supplier-form-grid">
          <div className="form-field">
            <label>Varsayılan Fiyat</label>
            <input min="0" step="0.01" type="number" value={form.defaultUnitPrice} onChange={event => onChange('defaultUnitPrice', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Para Birimi</label>
            <input value={form.currency} onChange={event => onChange('currency', event.target.value)} />
          </div>
        </div>
      </div>

      <div className="supplier-form-section">
        <h4>Notlar</h4>
        <div className="form-field">
          <label>Not</label>
          <textarea rows={4} value={form.notes} onChange={event => onChange('notes', event.target.value)} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn primary" type="submit">Kaydet</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}
