import {
  loadCompanies,
  saveCompanies
} from '../storage'
import type { Company, CompanyStatus, User } from '../types'
import {
  recordCompanyAuditEvent,
  type CompanyAuditEventType
} from './company-audit.service'

export type CompanyCreateInput = {
  companyCode?: string
  companyName: string
  legalName?: string
  taxOffice?: string
  taxNumber: string
  phone?: string
  email?: string
  city?: string
  district?: string
  address?: string
  authorizedPerson?: string
  authorizedPhone?: string
  authorizedEmail?: string
  status?: CompanyStatus
  tenantId?: string
  workspaceId?: string
  defaultBranchId?: string
  subscriptionId?: string
  licenseStart?: string
  licenseEnd?: string
  createdAt?: string
}

export type CompanyUpdateInput = Partial<Omit<CompanyCreateInput, 'createdAt'> & {
  isApproved: boolean
  approvedAt: string
  approvedBy: string
  deletedAt: string
}>

export type CompanyApprovalInput = {
  approvedBy?: string
  tenantId?: string
  workspaceId?: string
  defaultBranchId?: string
  subscriptionId?: string
  licenseStart?: string
  licenseEnd?: string
}

export type CompanyListOptions = {
  includeDeleted?: boolean
  allTenants?: boolean
  status?: CompanyStatus | 'all'
}

type ActorContext = {
  user?: User | null
  actorName?: string
}

const createStorageId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const normalizeCodePart = (value: string) => value
  .toLocaleUpperCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/İ/g, 'I')
  .replace(/[^A-Z0-9]+/g, '')

const createCompanyCode = (companyName: string, companyId: string) => {
  const namePart = normalizeCodePart(companyName).slice(0, 8) || 'COMPANY'
  const idPart = companyId.replace(/[^a-z0-9]/gi, '').slice(-6).toLocaleUpperCase('tr-TR') || Date.now().toString().slice(-6)
  return `CMP-${namePart}-${idPart}`
}

const resolveActor = (context: ActorContext = {}) => ({
  actorUserId: context.user?.id || '',
  actorName: context.actorName || context.user?.fullName || context.user?.username || 'System'
})

const normalizeUniqueValue = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const assertUniqueCompanyFields = (candidate: Company, companies: Company[], currentCompanyId = '') => {
  const uniqueFields: Array<keyof Pick<Company, 'companyCode' | 'taxNumber' | 'workspaceId' | 'tenantId'>> = [
    'companyCode',
    'taxNumber',
    'workspaceId',
    'tenantId'
  ]

  uniqueFields.forEach(field => {
    const value = normalizeUniqueValue(String(candidate[field] || ''))
    if(!value) return

    const duplicate = companies.some(company => (
      company.id !== currentCompanyId
      && !company.deletedAt
      && normalizeUniqueValue(String(company[field] || '')) === value
    ))

    if(duplicate){
      throw new Error(`${field} benzersiz olmalıdır.`)
    }
  })
}

const createCompanyRecord = (input: CompanyCreateInput, now = new Date().toISOString()): Company => {
  const companyId = createStorageId('company')
  const companyName = input.companyName.trim()
  const authorizedPerson = (input.authorizedPerson || companyName).trim()
  const phone = String(input.phone || input.authorizedPhone || '').trim()
  const email = String(input.email || input.authorizedEmail || '').trim()
  const status = input.status || 'Başvuru Bekliyor'
  const isApproved = status === 'Aktif' || status === 'Askıda'

  return {
    id: companyId,
    companyCode: String(input.companyCode || '').trim().toLocaleUpperCase('tr-TR') || createCompanyCode(companyName, companyId),
    companyName,
    legalName: String(input.legalName || companyName).trim() || companyName,
    taxOffice: String(input.taxOffice || '').trim(),
    taxNumber: input.taxNumber.trim(),
    phone,
    email,
    city: String(input.city || '').trim(),
    district: String(input.district || '').trim(),
    address: String(input.address || '').trim(),
    authorizedPerson,
    authorizedPhone: String(input.authorizedPhone || phone).trim(),
    authorizedEmail: String(input.authorizedEmail || email).trim(),
    status,
    isApproved,
    approvedAt: isApproved ? now : '',
    approvedBy: '',
    workspaceId: String(input.workspaceId || `workspace_${companyId}`).trim(),
    defaultBranchId: String(input.defaultBranchId || '').trim(),
    tenantId: String(input.tenantId || '').trim(),
    subscriptionId: String(input.subscriptionId || '').trim(),
    licenseStart: String(input.licenseStart || '').trim(),
    licenseEnd: String(input.licenseEnd || '').trim(),
    createdAt: input.createdAt || now,
    updatedAt: now,
    deletedAt: '',
    ownerName: authorizedPerson,
    logoUrl: ''
  }
}

const saveCompanyRecord = (
  company: Company,
  companies: Company[],
  eventType: CompanyAuditEventType,
  context: ActorContext,
  description: string
) => {
  const nextCompanies = companies.some(item => item.id === company.id)
    ? companies.map(item => item.id === company.id ? company : item)
    : [company, ...companies]
  saveCompanies(nextCompanies)
  recordCompanyAuditEvent({
    company,
    eventType,
    description,
    ...resolveActor(context)
  })
  return company
}

export const listCompanies = (options: CompanyListOptions = {}) => {
  const companies = loadCompanies({
    allTenants: options.allTenants,
    includeDeleted: options.includeDeleted
  })
  return options.status && options.status !== 'all'
    ? companies.filter(company => company.status === options.status)
    : companies
}

export const getCompanyById = (companyId: string, options: Pick<CompanyListOptions, 'includeDeleted' | 'allTenants'> = {}) => {
  return loadCompanies({
    allTenants: options.allTenants ?? true,
    includeDeleted: options.includeDeleted
  }).find(company => company.id === companyId) || null
}

export const getCompanyByCode = (companyCode: string, options: Pick<CompanyListOptions, 'includeDeleted' | 'allTenants'> = {}) => {
  const lookupCode = normalizeUniqueValue(companyCode)
  return loadCompanies({
    allTenants: options.allTenants ?? true,
    includeDeleted: options.includeDeleted
  }).find(company => normalizeUniqueValue(company.companyCode) === lookupCode) || null
}

export const createCompany = (input: CompanyCreateInput, context: ActorContext = {}) => {
  if(!input.companyName.trim()) throw new Error('companyName zorunludur.')
  if(!input.taxNumber.trim()) throw new Error('taxNumber zorunludur.')

  const companies = loadCompanies({ allTenants: true, includeDeleted: true })
  const company = createCompanyRecord(input)
  assertUniqueCompanyFields(company, companies)

  return saveCompanyRecord(
    company,
    companies,
    'COMPANY_CREATED',
    context,
    `${company.companyName} Company kaydı oluşturuldu.`
  )
}

export const updateCompany = (companyId: string, input: CompanyUpdateInput, context: ActorContext = {}) => {
  const companies = loadCompanies({ allTenants: true, includeDeleted: true })
  const existingCompany = companies.find(company => company.id === companyId)
  if(!existingCompany) throw new Error('Company bulunamadı.')
  if(existingCompany.deletedAt) throw new Error('Arşivlenen Company güncellenemez.')

  const now = new Date().toISOString()
  const companyName = String(input.companyName ?? existingCompany.companyName).trim() || existingCompany.companyName
  const phone = String(input.phone ?? existingCompany.phone).trim()
  const email = String(input.email ?? existingCompany.email).trim()
  const authorizedPerson = String(input.authorizedPerson ?? existingCompany.authorizedPerson ?? existingCompany.ownerName).trim()
    || companyName

  const updatedCompany: Company = {
    ...existingCompany,
    companyCode: String(input.companyCode ?? existingCompany.companyCode).trim().toLocaleUpperCase('tr-TR') || existingCompany.companyCode,
    companyName,
    legalName: String(input.legalName ?? existingCompany.legalName).trim() || companyName,
    taxOffice: String(input.taxOffice ?? existingCompany.taxOffice).trim(),
    taxNumber: String(input.taxNumber ?? existingCompany.taxNumber).trim(),
    phone,
    email,
    city: String(input.city ?? existingCompany.city).trim(),
    district: String(input.district ?? existingCompany.district).trim(),
    address: String(input.address ?? existingCompany.address).trim(),
    authorizedPerson,
    authorizedPhone: String(input.authorizedPhone ?? existingCompany.authorizedPhone ?? phone).trim(),
    authorizedEmail: String(input.authorizedEmail ?? existingCompany.authorizedEmail ?? email).trim(),
    status: input.status ?? existingCompany.status,
    isApproved: input.isApproved ?? existingCompany.isApproved,
    approvedAt: String(input.approvedAt ?? existingCompany.approvedAt).trim(),
    approvedBy: String(input.approvedBy ?? existingCompany.approvedBy).trim(),
    workspaceId: String(input.workspaceId ?? existingCompany.workspaceId).trim(),
    defaultBranchId: String(input.defaultBranchId ?? existingCompany.defaultBranchId).trim(),
    tenantId: String(input.tenantId ?? existingCompany.tenantId).trim(),
    subscriptionId: String(input.subscriptionId ?? existingCompany.subscriptionId).trim(),
    licenseStart: String(input.licenseStart ?? existingCompany.licenseStart).trim(),
    licenseEnd: String(input.licenseEnd ?? existingCompany.licenseEnd).trim(),
    deletedAt: String(input.deletedAt ?? existingCompany.deletedAt).trim(),
    ownerName: authorizedPerson,
    updatedAt: now
  }

  assertUniqueCompanyFields(updatedCompany, companies, companyId)
  return saveCompanyRecord(
    updatedCompany,
    companies,
    'COMPANY_UPDATED',
    context,
    `${updatedCompany.companyName} Company bilgileri güncellendi.`
  )
}

export const activateCompany = (companyId: string, context: ActorContext = {}) => {
  const companies = loadCompanies({ allTenants: true, includeDeleted: true })
  const existingCompany = companies.find(company => company.id === companyId)
  if(!existingCompany) throw new Error('Company bulunamadı.')

  const company: Company = {
    ...existingCompany,
    status: 'Aktif',
    deletedAt: '',
    updatedAt: new Date().toISOString()
  }
  assertUniqueCompanyFields(company, companies, companyId)
  return saveCompanyRecord(
    company,
    companies,
    'COMPANY_ACTIVATED',
    context,
    `${company.companyName} Company kaydı aktif edildi.`
  )
}

export const deactivateCompany = (companyId: string, context: ActorContext = {}) => {
  const companies = loadCompanies({ allTenants: true, includeDeleted: true })
  const existingCompany = companies.find(company => company.id === companyId)
  if(!existingCompany) throw new Error('Company bulunamadı.')
  if(existingCompany.deletedAt) throw new Error('Arşivlenen Company pasife alınamaz.')

  const company: Company = {
    ...existingCompany,
    status: 'Pasif',
    updatedAt: new Date().toISOString()
  }
  assertUniqueCompanyFields(company, companies, companyId)
  return saveCompanyRecord(
    company,
    companies,
    'COMPANY_DEACTIVATED',
    context,
    `${company.companyName} Company kaydı pasife alındı.`
  )
}

export const approveCompany = (companyId: string, input: CompanyApprovalInput = {}, context: ActorContext = {}) => {
  const now = new Date().toISOString()
  const companies = loadCompanies({ allTenants: true, includeDeleted: true })
  const existingCompany = companies.find(company => company.id === companyId)
  if(!existingCompany) throw new Error('Company bulunamadı.')
  if(existingCompany.deletedAt) throw new Error('Arşivlenen Company onaylanamaz.')

  const approvedCompany: Company = {
    ...existingCompany,
    status: 'Aktif',
    isApproved: true,
    approvedAt: now,
    approvedBy: input.approvedBy || context.user?.id || '',
    tenantId: input.tenantId ?? existingCompany.tenantId,
    workspaceId: input.workspaceId ?? existingCompany.workspaceId,
    defaultBranchId: input.defaultBranchId ?? existingCompany.defaultBranchId,
    subscriptionId: input.subscriptionId ?? existingCompany.subscriptionId,
    licenseStart: input.licenseStart ?? existingCompany.licenseStart,
    licenseEnd: input.licenseEnd ?? existingCompany.licenseEnd,
    updatedAt: now
  }

  assertUniqueCompanyFields(approvedCompany, companies, companyId)
  return saveCompanyRecord(
    approvedCompany,
    companies,
    'COMPANY_APPROVED',
    context,
    `${approvedCompany.companyName} Company kaydı onaylandı.`
  )
}

export const archiveCompany = (companyId: string, context: ActorContext = {}) => {
  const now = new Date().toISOString()
  const companies = loadCompanies({ allTenants: true, includeDeleted: true })
  const existingCompany = companies.find(company => company.id === companyId)
  if(!existingCompany) throw new Error('Company bulunamadı.')

  const company: Company = {
    ...existingCompany,
    status: 'Arşivlendi',
    deletedAt: now,
    updatedAt: now
  }
  assertUniqueCompanyFields(company, companies, companyId)
  return saveCompanyRecord(
    company,
    companies,
    'COMPANY_ARCHIVED',
    context,
    `${company.companyName} Company kaydı arşivlendi. Fiziksel veri silinmedi.`
  )
}
