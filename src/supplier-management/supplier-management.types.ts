export type SupplierStatus =
  | 'ACTIVE'
  | 'PASSIVE'
  | 'PENDING_APPROVAL'
  | 'SUSPENDED'
  | 'BLACKLISTED'
  | 'BLOCKED'

export type SupplierType =
  | 'RAW_MATERIAL'
  | 'PACKAGING'
  | 'CLEANING'
  | 'CONSUMABLE'
  | 'LOGISTICS'
  | 'MACHINE'
  | 'MAINTENANCE'
  | 'SERVICE'
  | 'OTHER'

export type SupplierWorkingStatus =
  | 'ACTIVE_WORKING'
  | 'LIMITED'
  | 'ON_HOLD'
  | 'STOPPED'

export type SupplierApprovalStatus =
  | 'APPROVED'
  | 'PENDING'
  | 'REJECTED'

export type SupplierCompanyType =
  | 'MANUFACTURER'
  | 'WHOLESALER'
  | 'DISTRIBUTOR'
  | 'LOCAL_SUPPLIER'

export type SupplierProductStatus =
  | 'ACTIVE'
  | 'PASSIVE'

export type SupplierProductUnit =
  | 'gr'
  | 'kg'
  | 'ml'
  | 'lt'
  | 'adet'
  | 'paket'
  | 'koli'
  | 'çuval'
  | 'kasa'

export type SupplierCategory = {
  id: string
  name: string
  type: SupplierType
  description: string
  active: boolean
  sortOrder: number
}

export type SupplierContact = {
  id: string
  supplierId: string
  fullName: string
  title: string
  phone: string
  mobilePhone: string
  email: string
  isPrimary: boolean
  notes: string
}

export type SupplierAddress = {
  id: string
  supplierId: string
  title: string
  address: string
  city: string
  district: string
  postalCode: string
  country: string
  isPrimary: boolean
}

export type SupplierStatistics = {
  supplierId: string
  totalPurchaseOrders: number
  totalPurchaseAmount: number
  totalDeliveries: number
  delayedDeliveries: number
  qualityRejections: number
  activeOrders: number
  lastOrderDate: string
  suppliedProductCount: number
}

export type Supplier = {
  id: string
  supplierCode: string
  code?: string
  name: string
  tradeName: string
  taxOffice: string
  taxNumber: string
  companyType: SupplierCompanyType
  type: SupplierType
  categoryIds: string[]
  status: SupplierStatus
  approvalStatus: SupplierApprovalStatus
  workingStatus: SupplierWorkingStatus
  defaultCurrency: string
  paymentTermDays: number
  leadTimeDays: number
  minimumOrderAmount: number
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
  createdAt: string
  updatedAt: string
}

export type SupplierProduct = {
  id: string
  supplierId: string
  stockItemId: string
  categoryId?: string
  supplierSku: string
  supplierProductName: string
  brand: string
  manufacturer: string
  purchaseUnit: SupplierProductUnit
  packageQuantity: number
  baseUnit: string
  conversionFactor: number
  defaultUnitPrice: number
  currency: string
  minimumOrderQuantity: number
  leadTimeDays: number
  isPreferred: boolean
  status: SupplierProductStatus
  notes: string
  createdAt: string
  updatedAt: string
}
