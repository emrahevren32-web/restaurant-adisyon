import { Branch, Tenant, TenantSettings, TenantStatus, User } from './types'

const KEY_TENANTS = 'ra_tenants'
const KEY_TENANT_SETTINGS = 'ra_tenant_settings'
const KEY_ACTIVE_TENANT = 'ra_active_tenant_id'
const KEY_AUTH = 'ra_auth'
const KEY_COMPANY_SETUPS = 'ra_company_setups'
const KEY_BRANCHES = 'ra_branches'

export const DEFAULT_TENANT_ID = 'tenant_abc_cafe_demo'
export const DEFAULT_TENANT_CODE = 'ABC001'
export const TENANT_ISOLATION_DENIED_MESSAGE = 'Tenant erişimi engellendi.'
export const TENANT_STATUSES: TenantStatus[] = ['Aktif', 'Pasif', 'Askıda', 'Silinmiş']

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

const demoTenantSpecs: Tenant[] = [
  {
    id: DEFAULT_TENANT_ID,
    tenantCode: DEFAULT_TENANT_CODE,
    companyId: 'company_abc_cafe_demo',
    companyName: 'ABC Cafe',
    status: 'Aktif',
    createdAt: '',
    updatedAt: ''
  },
  {
    id: 'tenant_lezzet_restoran_demo',
    tenantCode: 'LZZ001',
    companyId: 'company_lezzet_restoran_demo',
    companyName: 'Lezzet Restoran',
    status: 'Aktif',
    createdAt: '',
    updatedAt: ''
  }
]

const demoBranchTenantIds: Record<string, string> = {
  branch_merkez: DEFAULT_TENANT_ID,
  branch_istanbul: DEFAULT_TENANT_ID,
  branch_ankara: 'tenant_lezzet_restoran_demo',
  branch_lezzet_restoran_merkez_demo: 'tenant_lezzet_restoran_demo'
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

export const normalizeTenant = (item: Partial<Tenant>): Tenant => {
  const timestamp = item.createdAt || new Date().toISOString()
  const tenantCode = String(item.tenantCode || '').trim().toLocaleUpperCase('tr-TR')

  return {
    id: String(item.id || createTenantStorageId('tenant')),
    tenantCode: tenantCode || `TNT${Date.now().toString().slice(-5)}`,
    companyId: String(item.companyId || '').trim(),
    companyName: String(item.companyName || 'İsimsiz Firma').trim() || 'İsimsiz Firma',
    status: normalizeTenantStatus(item.status),
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }
}

export const createDemoTenants = (now = new Date().toISOString()) => {
  return demoTenantSpecs.map(tenant => normalizeTenant({
    ...tenant,
    createdAt: tenant.createdAt || now,
    updatedAt: tenant.updatedAt || now
  }))
}

export const loadTenants = (): Tenant[] => {
  const defaultTenants = createDemoTenants()
  const source = localStorage.getItem(KEY_TENANTS) === null
    ? defaultTenants
    : readJson<Partial<Tenant>[]>(KEY_TENANTS, []).map(normalizeTenant)
  const sourceMap = new Map(source.map(tenant => [tenant.id, tenant]))
  const defaultIds = new Set(defaultTenants.map(tenant => tenant.id))
  const mergedDefaults = defaultTenants.map(tenant => sourceMap.get(tenant.id) || tenant)
  const customTenants = source.filter(tenant => !defaultIds.has(tenant.id))

  return [...mergedDefaults, ...customTenants]
}

export const saveTenants = (items: Tenant[]) => {
  localStorage.setItem(KEY_TENANTS, JSON.stringify(items.map(normalizeTenant)))
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
  return tenants.find(tenant => tenant.companyId === companyId)
}

export const resolveTenantIdForCompany = (companyId?: string, tenants = loadTenants()) => {
  const normalizedCompanyId = String(companyId || '').trim()
  if(!normalizedCompanyId) return DEFAULT_TENANT_ID

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
    || tenants.find(tenant => tenant.id === DEFAULT_TENANT_ID)
    || tenants[0]
}

export const isTenantOwner = (user?: User | null, tenant = getCurrentTenant({ user })) => {
  if(!user || !tenant) return false
  if(isPlatformAdmin(user)) return true

  return getStoredCompanyIdForUser(user) === tenant.companyId
}

const getStoredBranches = (): Array<Pick<Branch, 'id' | 'companyId' | 'tenantId'>> => {
  return readJson<Array<Pick<Branch, 'id' | 'companyId' | 'tenantId'>>>(KEY_BRANCHES, [])
}

const getBranchTenantId = (branchId: string, context: TenantContext) => {
  const branch = (context.branches || getStoredBranches()).find(item => item.id === branchId)
  if(branch?.tenantId) return branch.tenantId
  if(branch?.companyId) return resolveTenantIdForCompany(branch.companyId)
  return demoBranchTenantIds[branchId] || ''
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

  return context.tenantId || DEFAULT_TENANT_ID
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
