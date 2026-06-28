import {
  BillingCollection,
  BillingCollectionStatus,
  BillingDistributionPoint,
  BillingInvoice,
  BillingInvoiceStatus,
  BillingManagementSnapshot,
  BillingManagementSource,
  BillingPaymentChannel,
  BillingRevenuePoint
} from './billing-foundation.types'
import { Company, CompanyLicense, LicensePackage } from '../types'

export const BILLING_INVOICE_STATUSES: BillingInvoiceStatus[] = ['Bekliyor', 'Ödendi', 'Gecikti', 'İptal']

export const BILLING_COLLECTION_STATUSES: BillingCollectionStatus[] = ['Tahsil Edildi', 'Bekliyor', 'Gecikti']

export const BILLING_FOUNDATION_SERVICES = [
  'Billing Engine',
  'Subscription Engine',
  'Invoice Service',
  'Payment Service',
  'Collection Service'
]

const distributionColors = ['#0891b2', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#475569']
const dayMs = 86400000

const normalizeLookup = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, '')

const formatDateKey = (date: Date) => {
  const copy = new Date(date)
  copy.setHours(12, 0, 0, 0)
  return copy.toLocaleDateString('sv-SE')
}

const parseDateKey = (value: string) => {
  const date = new Date(`${value}T12:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const addMonths = (date: Date, months: number) => {
  const next = new Date(date)
  next.setMonth(next.getMonth() + months)
  return next
}

const getDaysUntil = (value: string, referenceDate: Date) => {
  const target = parseDateKey(value)
  if(!target) return 0
  const reference = new Date(referenceDate)
  reference.setHours(12, 0, 0, 0)
  return Math.ceil((target.getTime() - reference.getTime()) / dayMs)
}

const isCompanyVisible = (company: Company) => !normalizeLookup(company.status).includes('silindi')

const isLicenseBillable = (license: CompanyLicense) => {
  const status = normalizeLookup(license.status)
  return !status.includes('iptal') && !status.includes('doldu')
}

const getLatestLicenseForCompany = (licenses: CompanyLicense[], companyId: string) => {
  return licenses
    .filter(license => license.companyId === companyId && isLicenseBillable(license))
    .sort((first, second) => {
      const firstDate = first.updatedAt || first.createdAt || first.startDate
      const secondDate = second.updatedAt || second.createdAt || second.startDate
      return secondDate.localeCompare(firstDate)
    })[0]
}

const getLicenseDeadline = (license: CompanyLicense) => {
  return license.isTrial ? license.trialEndDate || license.endDate : license.endDate
}

const getMonthlyAmount = (packageItem?: LicensePackage) => {
  if(!packageItem) return 0
  if(packageItem.monthlyPrice > 0) return packageItem.monthlyPrice
  if(packageItem.yearlyPrice > 0) return Math.round(packageItem.yearlyPrice / 12)
  return 0
}

const createInvoiceNumber = (company: Company, date: Date, sequence: string) => {
  const companyPart = normalizeLookup(company.companyName).slice(0, 6).toLocaleUpperCase('tr-TR') || 'FIRMA'
  const period = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`
  return `EVR-${companyPart}-${period}-${sequence}`
}

const getPaymentChannel = (index: number): BillingPaymentChannel => {
  const channels: BillingPaymentChannel[] = ['Kredi Kartı', 'Banka Transferi', 'Manuel Tahsilat', 'Havale/EFT']
  return channels[index % channels.length]
}

const buildCompanyBillingRows = (source: BillingManagementSource) => {
  const packageMap = new Map(source.packages.map(packageItem => [packageItem.id, packageItem]))

  return source.companies
    .filter(isCompanyVisible)
    .map((company, index) => {
      const license = getLatestLicenseForCompany(source.licenses, company.id)
      const packageItem = license ? packageMap.get(license.packageId) : undefined
      return {
        company,
        index,
        license,
        packageItem,
        monthlyAmount: getMonthlyAmount(packageItem)
      }
    })
    .filter(row => Boolean(row.license))
}

const buildInvoices = (source: BillingManagementSource): BillingInvoice[] => {
  const referenceDate = source.referenceDate || new Date()
  const companyRows = buildCompanyBillingRows(source)
  const invoices = companyRows.flatMap(row => {
    const license = row.license as CompanyLicense
    const packageItem = row.packageItem
    const currentIssueDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), Math.min(24, 1 + row.index))
    const previousIssueDate = addMonths(currentIssueDate, -1)
    const amount = row.monthlyAmount
    const sequence = String(row.index + 1).padStart(3, '0')
    const currentStatus: BillingInvoiceStatus = row.index % 3 === 0
      ? 'Bekliyor'
      : row.index % 3 === 1
        ? 'Ödendi'
        : 'Gecikti'
    const currentDueDate = currentStatus === 'Bekliyor'
      ? addDays(referenceDate, 7)
      : currentStatus === 'Gecikti'
        ? addDays(referenceDate, -8)
        : addDays(currentIssueDate, 10)

    const currentInvoice: BillingInvoice = {
      id: `billing_invoice_${license.id}_${formatDateKey(currentIssueDate)}`,
      companyId: row.company.id,
      companyName: row.company.companyName,
      licenseId: license.id,
      packageId: license.packageId,
      packageName: packageItem?.name || '-',
      invoiceNo: createInvoiceNumber(row.company, currentIssueDate, sequence),
      amount,
      issuedAt: currentStatus === 'Gecikti' ? formatDateKey(addDays(referenceDate, -38)) : formatDateKey(currentIssueDate),
      dueDate: formatDateKey(currentDueDate),
      paidAt: currentStatus === 'Ödendi' ? formatDateKey(addDays(referenceDate, -2)) : '',
      status: currentStatus,
      paymentChannel: currentStatus === 'Ödendi' ? getPaymentChannel(row.index) : ''
    }

    const previousInvoice: BillingInvoice = {
      id: `billing_invoice_${license.id}_${formatDateKey(previousIssueDate)}`,
      companyId: row.company.id,
      companyName: row.company.companyName,
      licenseId: license.id,
      packageId: license.packageId,
      packageName: packageItem?.name || '-',
      invoiceNo: createInvoiceNumber(row.company, previousIssueDate, `${sequence}-P`),
      amount,
      issuedAt: formatDateKey(previousIssueDate),
      dueDate: formatDateKey(addDays(previousIssueDate, 10)),
      paidAt: formatDateKey(addDays(previousIssueDate, 7)),
      status: 'Ödendi',
      paymentChannel: getPaymentChannel(row.index + 1)
    }

    return [currentInvoice, previousInvoice]
  })

  const firstRow = companyRows[0]
  if(firstRow?.license){
    const cancelledDate = addMonths(referenceDate, -2)
    invoices.push({
      id: `billing_invoice_${firstRow.license.id}_${formatDateKey(cancelledDate)}_cancelled`,
      companyId: firstRow.company.id,
      companyName: firstRow.company.companyName,
      licenseId: firstRow.license.id,
      packageId: firstRow.license.packageId,
      packageName: firstRow.packageItem?.name || '-',
      invoiceNo: createInvoiceNumber(firstRow.company, cancelledDate, 'IPT'),
      amount: firstRow.monthlyAmount,
      issuedAt: formatDateKey(cancelledDate),
      dueDate: formatDateKey(addDays(cancelledDate, 10)),
      paidAt: '',
      status: 'İptal',
      paymentChannel: ''
    })
  }

  return invoices.sort((first, second) => second.issuedAt.localeCompare(first.issuedAt))
}

const buildCollections = (invoices: BillingInvoice[], source: BillingManagementSource): BillingCollection[] => {
  const companyRows = buildCompanyBillingRows(source)

  return companyRows.map(row => {
    const companyInvoices = invoices.filter(invoice => invoice.companyId === row.company.id)
    const paidInvoices = companyInvoices.filter(invoice => invoice.status === 'Ödendi')
    const openInvoices = companyInvoices.filter(invoice => invoice.status === 'Bekliyor' || invoice.status === 'Gecikti')
    const overdueInvoices = companyInvoices.filter(invoice => invoice.status === 'Gecikti')
    const lastCollectionDate = paidInvoices
      .map(invoice => invoice.paidAt || invoice.issuedAt)
      .sort()
      .at(-1) || ''
    const nextPaymentDate = openInvoices
      .map(invoice => invoice.dueDate)
      .sort()[0] || getLicenseDeadline(row.license as CompanyLicense)

    return {
      companyId: row.company.id,
      companyName: row.company.companyName,
      packageId: row.license?.packageId || '',
      packageName: row.packageItem?.name || '-',
      monthlyAmount: row.monthlyAmount,
      collectedAmount: paidInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      pendingAmount: openInvoices.reduce((sum, invoice) => sum + invoice.amount, 0),
      lastCollectionDate,
      nextPaymentDate,
      status: overdueInvoices.length > 0 ? 'Gecikti' : openInvoices.length > 0 ? 'Bekliyor' : 'Tahsil Edildi'
    }
  })
}

const buildUpcomingLicenseExpiries = (source: BillingManagementSource) => {
  const referenceDate = source.referenceDate || new Date()
  const packageMap = new Map(source.packages.map(packageItem => [packageItem.id, packageItem]))
  const companyMap = new Map(source.companies.map(company => [company.id, company]))

  return source.licenses
    .map(license => {
      const company = companyMap.get(license.companyId)
      const endDate = getLicenseDeadline(license)
      const remainingDays = getDaysUntil(endDate, referenceDate)
      const packageItem = packageMap.get(license.packageId)
      if(!company || !isCompanyVisible(company) || remainingDays < 0 || remainingDays > 30) return null
      return {
        companyId: company.id,
        companyName: company.companyName,
        packageId: license.packageId,
        packageName: packageItem?.name || '-',
        endDate,
        remainingDays
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((first, second) => first.remainingDays - second.remainingDays)
}

const buildRiskCustomers = (invoices: BillingInvoice[], referenceDate: Date) => {
  const grouped = invoices
    .filter(invoice => invoice.status === 'Gecikti')
    .reduce<Record<string, BillingInvoice[]>>((acc, invoice) => {
      acc[invoice.companyId] = acc[invoice.companyId] || []
      acc[invoice.companyId].push(invoice)
      return acc
    }, {})

  return Object.values(grouped)
    .map(companyInvoices => {
      const firstInvoice = companyInvoices[0]
      return {
        companyId: firstInvoice.companyId,
        companyName: firstInvoice.companyName,
        packageId: firstInvoice.packageId,
        packageName: firstInvoice.packageName,
        overdueDays: Math.max(...companyInvoices.map(invoice => Math.max(0, -getDaysUntil(invoice.dueDate, referenceDate)))),
        debt: companyInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
      }
    })
    .sort((first, second) => second.debt - first.debt || second.overdueDays - first.overdueDays)
}

const buildMonthlyRevenue = (mrr: number, referenceDate: Date): BillingRevenuePoint[] => {
  return Array.from({ length: 6 }, (_, index) => {
    const date = addMonths(referenceDate, index - 5)
    const ratio = 0.72 + index * 0.056
    return {
      label: date.toLocaleDateString('tr-TR', { month: 'short' }),
      amount: Math.round(mrr * ratio)
    }
  })
}

const sumDistribution = (
  labels: string[],
  amountForLabel: (label: string) => number
): BillingDistributionPoint[] => labels.map((label, index) => ({
  label,
  amount: amountForLabel(label),
  color: distributionColors[index % distributionColors.length]
}))

export const buildBillingManagementSnapshot = (source: BillingManagementSource): BillingManagementSnapshot => {
  const referenceDate = source.referenceDate || new Date()
  const invoices = buildInvoices(source)
  const collections = buildCollections(invoices, source)
  const upcomingLicenseExpiries = buildUpcomingLicenseExpiries(source)
  const riskCustomers = buildRiskCustomers(invoices, referenceDate)
  const mrr = collections.reduce((sum, collection) => sum + collection.monthlyAmount, 0)
  const packageLabels = Array.from(new Set(collections.map(collection => collection.packageName)))
  const paidThisMonthKey = formatDateKey(referenceDate).slice(0, 7)

  const packageRevenue = sumDistribution(packageLabels, label => (
    collections
      .filter(collection => collection.packageName === label)
      .reduce((sum, collection) => sum + collection.monthlyAmount, 0)
  ))

  const collectionDistribution = sumDistribution(BILLING_INVOICE_STATUSES, label => (
    invoices
      .filter(invoice => invoice.status === label)
      .reduce((sum, invoice) => sum + invoice.amount, 0)
  ))

  const paymentChannelLabels: BillingPaymentChannel[] = ['Kredi Kartı', 'Banka Transferi', 'Manuel Tahsilat', 'Havale/EFT']
  const paymentDistribution = sumDistribution(paymentChannelLabels, label => (
    invoices
      .filter(invoice => invoice.paymentChannel === label)
      .reduce((sum, invoice) => sum + invoice.amount, 0)
  ))

  return {
    invoices,
    collections,
    upcomingLicenseExpiries,
    riskCustomers,
    monthlyRevenue: buildMonthlyRevenue(mrr, referenceDate),
    packageRevenue,
    collectionDistribution,
    paymentDistribution,
    summary: {
      activeSubscriptions: collections.length,
      collectedThisMonth: invoices
        .filter(invoice => invoice.status === 'Ödendi' && invoice.paidAt.slice(0, 7) === paidThisMonthKey)
        .reduce((sum, invoice) => sum + invoice.amount, 0),
      pendingCollection: invoices
        .filter(invoice => invoice.status === 'Bekliyor')
        .reduce((sum, invoice) => sum + invoice.amount, 0),
      overduePaymentAmount: invoices
        .filter(invoice => invoice.status === 'Gecikti')
        .reduce((sum, invoice) => sum + invoice.amount, 0),
      overduePaymentCount: invoices.filter(invoice => invoice.status === 'Gecikti').length,
      upcomingLicenseExpiryCount: upcomingLicenseExpiries.length,
      mrr
    }
  }
}
