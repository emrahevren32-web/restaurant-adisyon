import { Branch, Company, CompanyLicense, Tenant, TenantSettings, TenantStatus, User, UserSubscription } from './types'

const KEY_TENANTS = 'ra_tenants'
const KEY_TENANT_SETTINGS = 'ra_tenant_settings'
const KEY_ACTIVE_TENANT = 'ra_active_tenant_id'
const KEY_AUTH = 'ra_auth'
const KEY_COMPANY_SETUPS = 'ra_company_setups'
const KEY_BRANCHES = 'ra_branches'
const KEY_COMPANIES = 'ra_companies'
const KEY_COMPANY_LICENSES = 'ra_company_licenses'
const KEY_USER_SUBSCRIPTIONS = 'ra_user_subscriptions'

export const TENANT_ISOLATION_DENIED_MESSAGE = 'Tenant erişimi engellendi.'
export const TENANT_STATUSES: TenantStatus[] = ['Aktif', 'Pasif', 'Askıda', 'Arşivlendi', 'Silinmiş']

export const DEFAULT_TENANT_SETTINGS = {
  timezone: 'Europe/Istanbul',
  currency: 'TRY',
  language: 'tr-TR',
  dateFormat: 'DD.MM.YYYY',
  theme: 'Varsayılan'
}

type TenantAwareRecord = {
  id?: string
  tenantId?: string
  companyId?: string
  branchId?: string
  userId?: string
}

type TenantContext = {
  tenantId?: string
  companyId?: string
  user?: User | null
  branches?: Array<Pick<Branch, 'id' | 'companyId' | 'tenantId'>>
  users?: Array<Pick<User, 'id' | 'companyId' | 'tenantId'>>
  includePlatformAdmin?: boolean
}

type StoredCompanySetup = {
  setupCompleted?: boolean
  adminUserId?: string
  companyId?: string
}

type CompanyMigrationRecord = Partial<Company> & {
  id?: string
  companyName?: string
  workspaceId?: string
  subscriptionId?: string
  tenantId?: string
  createdAt?: string
  updatedAt?: string
  deletedAt?: string
}

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback))
  } catch {
    return fallback
  }
}

const getStoredAuthUser = () => readJson<User | null>(KEY_AUTH, null)

const getStoredCompanyIdForUser = (user?: User | null) => {
  if(!user) return ''
  if(user.companyId) return user.companyId

  return readJson<StoredCompanySetup[]>(KEY_COMPANY_SETUPS, [])
    .find(setup => setup.setupCompleted && setup.adminUserId === user.id)?.companyId || ''
}

const isPlatformAdmin = (user?: User | null) => {
  return user?.role === 'Admin' && !getStoredCompanyIdForUser(user)
}

export const createTenantStorageId = (prefix: string) => {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

export const normalizeTenantStatus = (value: unknown): TenantStatus => {
  return TENANT_STATUSES.includes(value as TenantStatus) ? value as TenantStatus : 'Aktif'
}

const uniqueValues = (items: unknown[]) => Array.from(new Set(
  items.map(item => String(item || '').trim()).filter(Boolean)
))

const normalizeTenantCodePart = (value: string) => value
  .toLocaleUpperCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/İ/g, 'I')
  .replace(/[^A-Z0-9]+/g, '')

const createTenantCodeFromName = (name: string, existingCodes: Set<string>, seed = Date.now()) => {
  const prefix = (normalizeTenantCodePart(name) || 'TNT').slice(0, 3).padEnd(3, 'X')
  let index = Math.max(1, existingCodes.size + 1)
  let code = `${prefix}${String(index).padStart(3, '0')}`

  while(existingCodes.has(code)){
    index += 1
    code = `${prefix}${String(index).padStart(3, '0')}`
  }

  existingCodes.add(code)
  return code || `TNT${String(seed).slice(-5)}`
}

const readCompaniesForTenantMigration = () => {
  return readJson<CompanyMigrationRecord[]>(KEY_COMPANIES, [])
    .filter(company => String(company.id || '').trim())
}

const readCompanyLicensesForTenantMigration = () => {
  return readJson<Partial<CompanyLicense>[]>(KEY_COMPANY_LICENSES, [])
}

const readUserSubscriptionsForTenantMigration = () => {
  return readJson<Partial<UserSubscription>[]>(KEY_USER_SUBSCRIPTIONS, [])
}

const getSubscriptionIdsForCompany = (
  companyId: string,
  company: CompanyMigrationRecord,
  licenses = readCompanyLicensesForTenantMigration(),
  subscriptions = readUserSubscriptionsForTenantMigration()
) => {
  const licenseIds = new Set(licenses
    .filter(license => String(license.companyId || '').trim() === companyId)
    .map(license => String(license.id || '').trim())
    .filter(Boolean))

  return uniqueValues([
    company.subscriptionId,
    ...subscriptions
      .filter(subscription => licenseIds.has(String(subscription.companyLicenseId || '').trim()))
      .map(subscription => subscription.id)
  ])
}

export const normalizeTenant = (item: Partial<Tenant>): Tenant => {
  const timestamp = item.createdAt || new Date().toISOString()
  const tenantCode = String(item.tenantCode || '').trim().toLocaleUpperCase('tr-TR')
  const ownerCompanyId = String(item.ownerCompanyId || item.companyId || '').trim()
  const tenantName = String(item.tenantName || item.companyName || 'İsimsiz Tenant').trim() || 'İsimsiz Tenant'
  const status = normalizeTenantStatus(item.status)
  const deletedAt = String(item.deletedAt || '').trim()
    || (status === 'Silinmiş' || status === 'Arşivlendi' ? timestamp : '')

  return {
    id: String(item.id || createTenantStorageId('tenant')),
    tenantCode: tenantCode || `TNT${Date.now().toString().slice(-5)}`,
    tenantName,
    status,
    ownerCompanyId,
    workspaceIds: uniqueValues(item.workspaceIds || []),
    subscriptionIds: uniqueValues(item.subscriptionIds || []),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp,
    deletedAt,
    companyId: ownerCompanyId,
    companyName: tenantName
  }
}

export const createDemoTenants = (now = new Date().toISOString()) => {
  void now
  return []
}

const createTenantFromCompany = (
  company: CompanyMigrationRecord,
  existingCodes: Set<string>,
  existingTenants: Tenant[],
  now = new Date().toISOString()
) => {
  const companyId = String(company.id || '').trim()
  const tenantId = String(company.tenantId || '').trim() || createTenantStorageId('tenant')
  const tenantName = String(company.companyName || company.legalName || 'İsimsiz Tenant').trim() || 'İsimsiz Tenant'
  const existingTenant = existingTenants.find(tenant => tenant.id === tenantId || tenant.ownerCompanyId === companyId || tenant.companyId === companyId)
  const tenantCode = existingTenant?.tenantCode || createTenantCodeFromName(tenantName, existingCodes)

  return normalizeTenant({
    ...existingTenant,
    id: existingTenant?.id || tenantId,
    tenantCode,
    tenantName,
    ownerCompanyId: companyId,
    workspaceIds: uniqueValues([...(existingTenant?.workspaceIds || []), company.workspaceId]),
    subscriptionIds: uniqueValues([
      ...(existingTenant?.subscriptionIds || []),
      ...getSubscriptionIdsForCompany(companyId, company)
    ]),
    status: existingTenant?.status || (company.deletedAt ? 'Arşivlendi' : company.isApproved === false ? 'Pasif' : 'Aktif'),
    createdAt: existingTenant?.createdAt || company.createdAt || now,
    updatedAt: existingTenant?.updatedAt || company.updatedAt || now,
    deletedAt: existingTenant?.deletedAt || String(company.deletedAt || '').trim()
  })
}

const mergeTenantMigrations = (sourceTenants: Tenant[]) => {
  const existingCodes = new Set(sourceTenants.map(tenant => tenant.tenantCode.toLocaleUpperCase('tr-TR')))
  const tenantByCompany = new Map(sourceTenants
    .filter(tenant => tenant.ownerCompanyId)
    .map(tenant => [tenant.ownerCompanyId, tenant]))
  const companies = readCompaniesForTenantMigration()
  const migratedTenants = companies
    .filter(company => String(company.id || '').trim())
    .map(company => createTenantFromCompany(company, existingCodes, sourceTenants))

  migratedTenants.forEach(tenant => tenantByCompany.set(tenant.ownerCompanyId, tenant))
  sourceTenants.forEach(tenant => {
    if(!tenantByCompany.has(tenant.ownerCompanyId)) tenantByCompany.set(tenant.ownerCompanyId || tenant.id, tenant)
  })

  return Array.from(tenantByCompany.values())
}

export const loadTenants = (options: { includeDeleted?: boolean } = {}): Tenant[] => {
  const storedTenants = localStorage.getItem(KEY_TENANTS)
  const source = storedTenants === null
    ? []
    : readJson<Partial<Tenant>[]>(KEY_TENANTS, []).map(normalizeTenant)
  const tenants = mergeTenantMigrations(source)
  const migratedPayload = JSON.stringify(tenants)

  if(storedTenants !== migratedPayload){
    localStorage.setItem(KEY_TENANTS, migratedPayload)
  }

  return options.includeDeleted ? tenants : tenants.filter(tenant => !tenant.deletedAt)
}

export const saveTenants = (items: Tenant[]) => {
  const normalizedItems = items.map(normalizeTenant)
  const nextIds = new Set(normalizedItems.map(tenant => tenant.id))
  const archivedTenants = readJson<Partial<Tenant>[]>(KEY_TENANTS, [])
    .map(normalizeTenant)
    .filter(tenant => tenant.deletedAt && !nextIds.has(tenant.id))

  localStorage.setItem(KEY_TENANTS, JSON.stringify([...normalizedItems, ...archivedTenants]))
}

export const createDefaultTenantSettings = (tenantId: string, now = new Date().toISOString()): TenantSettings => ({
  id: `tenant_settings_${tenantId}`,
  tenantId,
  ...DEFAULT_TENANT_SETTINGS,
  createdAt: now,
  updatedAt: now
})

export const normalizeTenantSettings = (item: Partial<TenantSettings>): TenantSettings => {
  const timestamp = item.createdAt || new Date().toISOString()
  const tenantId = String(item.tenantId || '').trim()

  return {
    id: String(item.id || `tenant_settings_${tenantId || Date.now()}`),
    tenantId,
    timezone: String(item.timezone || DEFAULT_TENANT_SETTINGS.timezone).trim() || DEFAULT_TENANT_SETTINGS.timezone,
    currency: String(item.currency || DEFAULT_TENANT_SETTINGS.currency).trim().toLocaleUpperCase('tr-TR') || DEFAULT_TENANT_SETTINGS.currency,
    language: String(item.language || DEFAULT_TENANT_SETTINGS.language).trim() || DEFAULT_TENANT_SETTINGS.language,
    dateFormat: String(item.dateFormat || DEFAULT_TENANT_SETTINGS.dateFormat).trim() || DEFAULT_TENANT_SETTINGS.dateFormat,
    theme: String(item.theme || DEFAULT_TENANT_SETTINGS.theme).trim() || DEFAULT_TENANT_SETTINGS.theme,
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

export const loadTenantSettings = (): TenantSettings[] => {
  const tenants = loadTenants()
  const now = new Date().toISOString()
  const source = localStorage.getItem(KEY_TENANT_SETTINGS) === null
    ? tenants.map(tenant => createDefaultTenantSettings(tenant.id, now))
    : readJson<Partial<TenantSettings>[]>(KEY_TENANT_SETTINGS, []).map(normalizeTenantSettings)
  const sourceMap = new Map(source.map(settings => [settings.tenantId, settings]))

  return tenants.map(tenant => sourceMap.get(tenant.id) || createDefaultTenantSettings(tenant.id, now))
}

export const saveTenantSettings = (items: TenantSettings[]) => {
  localStorage.setItem(KEY_TENANT_SETTINGS, JSON.stringify(items.map(normalizeTenantSettings)))
}

export const setCurrentTenant = (tenantId: string) => {
  const tenant = loadTenants().find(item => item.id === tenantId)
  if(tenant) localStorage.setItem(KEY_ACTIVE_TENANT, tenant.id)
  return tenant
}

export const getTenantByCompanyId = (companyId: string, tenants = loadTenants()) => {
  return tenants.find(tenant => tenant.ownerCompanyId === companyId || tenant.companyId === companyId)
}

export const resolveTenantIdForCompany = (companyId?: string, tenants = loadTenants()) => {
  const normalizedCompanyId = String(companyId || '').trim()
  if(!normalizedCompanyId) return ''

  return getTenantByCompanyId(normalizedCompanyId, tenants)?.id || ''
}

export const getCurrentTenant = (context: Pick<TenantContext, 'user' | 'companyId' | 'tenantId'> = {}) => {
  const tenants = loadTenants()
  const requestedTenant = context.tenantId
    ? tenants.find(tenant => tenant.id === context.tenantId)
    : undefined
  if(requestedTenant) return requestedTenant

  const user = context.user === undefined ? getStoredAuthUser() : context.user
  const companyId = context.companyId || getStoredCompanyIdForUser(user)
  const companyTenant = companyId ? getTenantByCompanyId(companyId, tenants) : undefined
  if(companyTenant) return companyTenant

  const storedTenantId = String(localStorage.getItem(KEY_ACTIVE_TENANT) || '').trim()
  return tenants.find(tenant => tenant.id === storedTenantId)
}

export const isTenantOwner = (user?: User | null, tenant = getCurrentTenant({ user })) => {
  if(!user || !tenant) return false
  if(isPlatformAdmin(user)) return true

  return getStoredCompanyIdForUser(user) === tenant.ownerCompanyId
}

const getStoredBranches = (): Array<Pick<Branch, 'id' | 'companyId' | 'tenantId'>> => {
  return readJson<Array<Pick<Branch, 'id' | 'companyId' | 'tenantId'>>>(KEY_BRANCHES, [])
}

const getBranchTenantId = (branchId: string, context: TenantContext) => {
  const branch = (context.branches || getStoredBranches()).find(item => item.id === branchId)
  if(branch?.tenantId) return branch.tenantId
  if(branch?.companyId) return resolveTenantIdForCompany(branch.companyId)
  return ''
}

const getUserTenantId = (userId: string, context: TenantContext) => {
  const user = context.users?.find(item => item.id === userId)
  if(user?.tenantId) return user.tenantId
  if(user?.companyId) return resolveTenantIdForCompany(user.companyId)
  return ''
}

export const resolveTenantIdForRecord = (
  record: TenantAwareRecord,
  context: TenantContext = {}
) => {
  const explicitTenantId = String(record.tenantId || '').trim()
  if(explicitTenantId) return explicitTenantId

  const companyTenantId = resolveTenantIdForCompany(record.companyId)
  if(record.companyId && companyTenantId) return companyTenantId

  const branchId = String(record.branchId || '').trim()
  const branchTenantId = branchId ? getBranchTenantId(branchId, context) : ''
  if(branchTenantId) return branchTenantId

  const userId = String(record.userId || '').trim()
  const userTenantId = userId ? getUserTenantId(userId, context) : ''
  if(userTenantId) return userTenantId

  return context.tenantId || getCurrentTenant({ user: context.user })?.id || ''
}

const getContextTenantId = (context: TenantContext = {}) => {
  if(context.tenantId) return context.tenantId
  if(context.companyId) return resolveTenantIdForCompany(context.companyId)
  return getCurrentTenant({ user: context.user, companyId: context.companyId })?.id || ''
}

export const withTenantId = <T extends TenantAwareRecord>(
  record: T,
  context: TenantContext = {}
): T & { tenantId: string } => {
  return {
    ...record,
    tenantId: resolveTenantIdForRecord(record, context)
  }
}

export const filterByTenant = <T extends TenantAwareRecord>(
  items: T[],
  context: TenantContext = {}
) => {
  const user = context.user === undefined ? getStoredAuthUser() : context.user
  if(isPlatformAdmin(user) && context.includePlatformAdmin !== false && !context.tenantId && !context.companyId){
    return items
  }

  const tenantId = getContextTenantId({ ...context, user })
  if(!tenantId) return []

  return items.filter(item => resolveTenantIdForRecord(item, context) === tenantId)
}

export const recordBelongsToTenant = (
  record: TenantAwareRecord,
  context: TenantContext = {}
) => {
  const tenantId = getContextTenantId(context)
  return Boolean(tenantId && resolveTenantIdForRecord(record, context) === tenantId)
}

export const assertTenantAccess = (
  record: TenantAwareRecord,
  context: TenantContext = {}
) => {
  const user = context.user === undefined ? getStoredAuthUser() : context.user
  if(isPlatformAdmin(user) && context.includePlatformAdmin !== false && !context.tenantId && !context.companyId){
    return true
  }

  if(recordBelongsToTenant(record, { ...context, user })) return true
  throw new Error(TENANT_ISOLATION_DENIED_MESSAGE)
}
