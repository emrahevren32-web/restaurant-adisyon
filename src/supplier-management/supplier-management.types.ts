export type SupplierStatus =
  | 'ACTIVE'
  | 'PASSIVE'
  | 'BLOCKED'

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

export type Supplier = {
  id: string
  supplierCode: string
  name: string
  tradeName: string
  taxOffice: string
  taxNumber: string
  companyType: SupplierCompanyType
  status: SupplierStatus
  approvalStatus: SupplierApprovalStatus
  defaultCurrency: string
  paymentTermDays: number
  leadTimeDays: number
  minimumOrderAmount: number
  contactName: string
  contactPhone: string
  contactEmail: string
  website: string
  address: string
  city: string
  country: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type SupplierProduct = {
  id: string
  supplierId: string
  stockItemId: string
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
