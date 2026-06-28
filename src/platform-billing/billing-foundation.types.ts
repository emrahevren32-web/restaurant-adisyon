import { Company, CompanyLicense, LicensePackage, UserSubscription } from '../types'

export type BillingInvoiceStatus = 'Bekliyor' | 'Ödendi' | 'Gecikti' | 'İptal'

export type BillingCollectionStatus = 'Tahsil Edildi' | 'Bekliyor' | 'Gecikti'

export type BillingPaymentChannel =
  | 'Kredi Kartı'
  | 'Banka Transferi'
  | 'Manuel Tahsilat'
  | 'Havale/EFT'

export type BillingInvoice = {
  id: string
  companyId: string
  companyName: string
  licenseId: string
  packageId: string
  packageName: string
  invoiceNo: string
  amount: number
  issuedAt: string
  dueDate: string
  paidAt: string
  status: BillingInvoiceStatus
  paymentChannel: BillingPaymentChannel | ''
}

export type BillingCollection = {
  companyId: string
  companyName: string
  packageId: string
  packageName: string
  monthlyAmount: number
  collectedAmount: number
  pendingAmount: number
  lastCollectionDate: string
  nextPaymentDate: string
  status: BillingCollectionStatus
}

export type BillingLicenseExpiry = {
  companyId: string
  companyName: string
  packageId: string
  packageName: string
  endDate: string
  remainingDays: number
}

export type BillingRiskCustomer = {
  companyId: string
  companyName: string
  packageId: string
  packageName: string
  overdueDays: number
  debt: number
}

export type BillingRevenuePoint = {
  label: string
  amount: number
}

export type BillingDistributionPoint = {
  label: string
  amount: number
  color: string
}

export type BillingKpiSummary = {
  activeSubscriptions: number
  collectedThisMonth: number
  pendingCollection: number
  overduePaymentAmount: number
  overduePaymentCount: number
  upcomingLicenseExpiryCount: number
  mrr: number
}

export type BillingManagementSnapshot = {
  invoices: BillingInvoice[]
  collections: BillingCollection[]
  upcomingLicenseExpiries: BillingLicenseExpiry[]
  riskCustomers: BillingRiskCustomer[]
  monthlyRevenue: BillingRevenuePoint[]
  packageRevenue: BillingDistributionPoint[]
  collectionDistribution: BillingDistributionPoint[]
  paymentDistribution: BillingDistributionPoint[]
  summary: BillingKpiSummary
}

export type BillingManagementSource = {
  companies: Company[]
  licenses: CompanyLicense[]
  packages: LicensePackage[]
  subscriptions: UserSubscription[]
  referenceDate?: Date
}
