import { IdentityResult, USER_TYPES } from '../identity/identity.types'
import {
  createDefaultTenantSettings,
  createTenantStorageId,
  getCurrentTenant,
  getTenantByCompanyId,
  loadTenants,
  normalizeTenant,
  resolveTenantIdForCompany,
  saveTenants
} from '../tenant'
import {
  loadCompanies,
  loadCompanyLicenses,
  loadTenantSettings,
  loadUserSubscriptions,
  saveCompanies,
  saveCompanyLicenses,
  saveTenantSettings,
  saveUserSubscriptions
} from '../storage'
import type { Company, Tenant, TenantStatus, User } from '../types'
import { createTenantContext, clearTenantContext } from './tenant.context'
import { TenantContextModel } from './tenant.types'
import {
  recordTenantAuditEvent,
  type TenantAuditEventType
} from './tenant-audit.service'

export const resolveTenantContextFromIdentity = (
  identity: IdentityResult
): TenantContextModel => {
  if(!identity.authenticated || identity.userType === USER_TYPES.SUPER_ADMIN){
    return clearTenantContext()
  }

  if(!identity.tenantId && !identity.companyId){
    return clearTenantContext()
  }

  const tenants = loadTenants()
  const tenant = identity.tenantId
    ? tenants.find(item => item.id === identity.tenantId)
    : undefined
  const companyTenant = !tenant && identity.companyId
    ? getTenantByCompanyId(identity.companyId, tenants)
    : undefined
  const fallbackTenant = tenant || companyTenant || getCurrentTenant({
    companyId: identity.companyId || undefined,
    tenantId: identity.tenantId || undefined
  })
  const tenantId = identity.tenantId
    || fallbackTenant?.id
    || resolveTenantIdForCompany(identity.companyId || undefined, tenants)
    || null
  const companyId = identity.companyId || fallbackTenant?.ownerCompanyId || fallbackTenant?.companyId || null

  return createTenantContext({
    tenantId,
    companyId,
    companyName: fallbackTenant?.companyName || fallbackTenant?.tenantName || null,
    tenantName: fallbackTenant?.tenantName || fallbackTenant?.tenantCode || fallbackTenant?.companyName || null
  })
}

export const createTenantContextFromValues = ({
  tenantId,
  companyId,
  companyName,
  tenantName
}: Partial<TenantContextModel>): TenantContextModel => {
  return createTenantContext({
    tenantId,
    companyId,
    companyName,
    tenantName
  })
}

export const clearActiveTenantContext = (): TenantContextModel => {
  return clearTenantContext()
}

export type TenantCreateInput = {
  tenantCode?: string
  tenantName?: string
  status?: TenantStatus
  ownerCompanyId: string
  workspaceIds?: string[]
  subscriptionIds?: string[]
  createdAt?: string
}

export type TenantUpdateInput = Partial<Omit<TenantCreateInput, 'createdAt'> & {
  deletedAt: string
}>

export type TenantListOptions = {
  includeDeleted?: boolean
  status?: TenantStatus | 'all'
}

type TenantActorContext = {
  user?: User | null
  actorName?: string
}

const uniqueValues = (items: unknown[]) => Array.from(new Set(
  items.map(item => String(item || '').trim()).filter(Boolean)
))

const normalizeTenantLookup = (value: string) => value.trim().toLocaleLowerCase('tr-TR')

const normalizeTenantCodePart = (value: string) => value
  .toLocaleUpperCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/İ/g, 'I')
  .replace(/[^A-Z0-9]+/g, '')

const createTenantCode = (tenantName: string, tenants: Tenant[]) => {
  const prefix = (normalizeTenantCodePart(tenantName) || 'TNT').slice(0, 3).padEnd(3, 'X')
  const existingCodes = new Set(tenants.map(tenant => tenant.tenantCode.toLocaleUpperCase('tr-TR')))
  let index = tenants.length + 1
  let code = `${prefix}${String(index).padStart(3, '0')}`

  while(existingCodes.has(code)){
    index += 1
    code = `${prefix}${String(index).padStart(3, '0')}`
  }

  return code
}

const resolveActor = (context: TenantActorContext = {}) => ({
  actorUserId: context.user?.id || '',
  actorName: context.actorName || context.user?.fullName || context.user?.username || 'System'
})

const getCompany = (companyId: string) => {
  return loadCompanies({ allTenants: true, includeDeleted: true })
    .find(company => company.id === companyId) || null
}

const getSubscriptionIdsForCompany = (companyId: string, company: Company | null, explicitSubscriptionIds: string[] = []) => {
  const licenses = loadCompanyLicenses({ allTenants: true })
    .filter(license => license.companyId === companyId)
  const licenseIds = new Set(licenses.map(license => license.id))
  const subscriptions = loadUserSubscriptions()
    .filter(subscription => licenseIds.has(subscription.companyLicenseId))
    .map(subscription => subscription.id)

  return uniqueValues([
    ...(explicitSubscriptionIds || []),
    company?.subscriptionId,
    ...subscriptions
  ])
}

const resolveWorkspaceIdsForCompany = (company: Company | null, explicitWorkspaceIds: string[] = []) => {
  return uniqueValues([
    ...(explicitWorkspaceIds || []),
    company?.workspaceId
  ])
}

const assertUniqueTenantFields = (candidate: Tenant, tenants: Tenant[], currentTenantId = '') => {
  const tenantCode = normalizeTenantLookup(candidate.tenantCode)
  const ownerCompanyId = normalizeTenantLookup(candidate.ownerCompanyId)

  if(tenantCode && tenants.some(tenant => (
    tenant.id !== currentTenantId
    && !tenant.deletedAt
    && normalizeTenantLookup(tenant.tenantCode) === tenantCode
  ))){
    throw new Error('tenantCode benzersiz olmalıdır.')
  }

  if(ownerCompanyId && tenants.some(tenant => (
    tenant.id !== currentTenantId
    && !tenant.deletedAt
    && normalizeTenantLookup(tenant.ownerCompanyId) === ownerCompanyId
  ))){
    throw new Error('ownerCompanyId benzersiz olmalıdır.')
  }
}

const syncTenantRelations = (tenant: Tenant) => {
  const now = new Date().toISOString()
  const companies = loadCompanies({ allTenants: true, includeDeleted: true })
  const company = companies.find(item => item.id === tenant.ownerCompanyId)

  if(company){
    saveCompanies(companies.map(item => item.id === company.id
      ? {
          ...item,
          tenantId: tenant.id,
          workspaceId: item.workspaceId || tenant.workspaceIds[0] || `workspace_${item.id}`,
          subscriptionId: item.subscriptionId || tenant.subscriptionIds[0] || '',
          updatedAt: now
        }
      : item))
  }

  const licenses = loadCompanyLicenses({ allTenants: true })
  saveCompanyLicenses(licenses.map(license => license.companyId === tenant.ownerCompanyId
    ? { ...license, tenantId: tenant.id, updatedAt: now }
    : license))

  const tenantSubscriptionIds = new Set(tenant.subscriptionIds)
  const subscriptions = loadUserSubscriptions()
  saveUserSubscriptions(subscriptions.map(subscription => tenantSubscriptionIds.has(subscription.id)
    ? { ...subscription, tenantId: tenant.id, updatedAt: now }
    : subscription))

  const settings = loadTenantSettings()
  if(!settings.some(item => item.tenantId === tenant.id)){
    saveTenantSettings([createDefaultTenantSettings(tenant.id, now), ...settings])
  }
}

const saveTenantRecord = (
  tenant: Tenant,
  tenants: Tenant[],
  eventType: TenantAuditEventType,
  context: TenantActorContext,
  description: string
) => {
  const nextTenants = tenants.some(item => item.id === tenant.id)
    ? tenants.map(item => item.id === tenant.id ? tenant : item)
    : [tenant, ...tenants]
  saveTenants(nextTenants)
  syncTenantRelations(tenant)
  recordTenantAuditEvent({
    tenant,
    eventType,
    description,
    ...resolveActor(context)
  })
  return tenant
}

const createTenantRecord = (input: TenantCreateInput, tenants: Tenant[], now = new Date().toISOString()) => {
  const ownerCompanyId = input.ownerCompanyId.trim()
  const company = getCompany(ownerCompanyId)
  const tenantName = String(input.tenantName || company?.companyName || 'İsimsiz Tenant').trim() || 'İsimsiz Tenant'
  const tenantId = createTenantStorageId('tenant')

  return normalizeTenant({
    id: tenantId,
    tenantCode: String(input.tenantCode || '').trim().toLocaleUpperCase('tr-TR') || createTenantCode(tenantName, tenants),
    tenantName,
    status: input.status || (company?.isApproved === false ? 'Pasif' : 'Aktif'),
    ownerCompanyId,
    workspaceIds: resolveWorkspaceIdsForCompany(company, input.workspaceIds || []),
    subscriptionIds: getSubscriptionIdsForCompany(ownerCompanyId, company, input.subscriptionIds || []),
    createdAt: input.createdAt || now,
    updatedAt: now,
    deletedAt: ''
  })
}

export const listTenants = (options: TenantListOptions = {}) => {
  const tenants = loadTenants({ includeDeleted: options.includeDeleted })
  return options.status && options.status !== 'all'
    ? tenants.filter(tenant => tenant.status === options.status)
    : tenants
}

export const getTenantById = (tenantId: string, options: Pick<TenantListOptions, 'includeDeleted'> = {}) => {
  return loadTenants({ includeDeleted: options.includeDeleted })
    .find(tenant => tenant.id === tenantId) || null
}

export const createTenant = (input: TenantCreateInput, context: TenantActorContext = {}) => {
  if(!input.ownerCompanyId.trim()) throw new Error('ownerCompanyId zorunludur.')
  if(!getCompany(input.ownerCompanyId.trim())) throw new Error('Tenant oluşturmak için geçerli Company kaydı zorunludur.')

  const tenants = loadTenants({ includeDeleted: true })
  const tenant = createTenantRecord(input, tenants)
  assertUniqueTenantFields(tenant, tenants)

  return saveTenantRecord(
    tenant,
    tenants,
    'TENANT_CREATED',
    context,
    `${tenant.tenantName} Tenant kaydı oluşturuldu.`
  )
}

export const updateTenant = (tenantId: string, input: TenantUpdateInput, context: TenantActorContext = {}) => {
  const tenants = loadTenants({ includeDeleted: true })
  const existingTenant = tenants.find(tenant => tenant.id === tenantId)
  if(!existingTenant) throw new Error('Tenant bulunamadı.')
  if(existingTenant.deletedAt) throw new Error('Arşivlenen Tenant güncellenemez.')

  const ownerCompanyId = String(input.ownerCompanyId ?? existingTenant.ownerCompanyId).trim()
  const company = getCompany(ownerCompanyId)
  if(!company) throw new Error('Tenant güncellemek için geçerli Company kaydı zorunludur.')
  const tenantName = String(input.tenantName ?? existingTenant.tenantName).trim() || company?.companyName || existingTenant.tenantName
  const updatedTenant = normalizeTenant({
    ...existingTenant,
    tenantCode: String(input.tenantCode ?? existingTenant.tenantCode).trim().toLocaleUpperCase('tr-TR') || existingTenant.tenantCode,
    tenantName,
    status: input.status ?? existingTenant.status,
    ownerCompanyId,
    workspaceIds: resolveWorkspaceIdsForCompany(company, input.workspaceIds ?? existingTenant.workspaceIds),
    subscriptionIds: getSubscriptionIdsForCompany(ownerCompanyId, company, input.subscriptionIds ?? existingTenant.subscriptionIds),
    deletedAt: String(input.deletedAt ?? existingTenant.deletedAt).trim(),
    updatedAt: new Date().toISOString()
  })

  assertUniqueTenantFields(updatedTenant, tenants, tenantId)
  return saveTenantRecord(
    updatedTenant,
    tenants,
    'TENANT_UPDATED',
    context,
    `${updatedTenant.tenantName} Tenant bilgileri güncellendi.`
  )
}

export const activateTenant = (tenantId: string, context: TenantActorContext = {}) => {
  const tenants = loadTenants({ includeDeleted: true })
  const existingTenant = tenants.find(tenant => tenant.id === tenantId)
  if(!existingTenant) throw new Error('Tenant bulunamadı.')

  const tenant = normalizeTenant({
    ...existingTenant,
    status: 'Aktif',
    deletedAt: '',
    updatedAt: new Date().toISOString()
  })
  assertUniqueTenantFields(tenant, tenants, tenantId)
  return saveTenantRecord(
    tenant,
    tenants,
    'TENANT_ACTIVATED',
    context,
    `${tenant.tenantName} Tenant kaydı aktif edildi.`
  )
}

export const deactivateTenant = (tenantId: string, context: TenantActorContext = {}) => {
  const tenants = loadTenants({ includeDeleted: true })
  const existingTenant = tenants.find(tenant => tenant.id === tenantId)
  if(!existingTenant) throw new Error('Tenant bulunamadı.')
  if(existingTenant.deletedAt) throw new Error('Arşivlenen Tenant pasife alınamaz.')

  const tenant = normalizeTenant({
    ...existingTenant,
    status: 'Pasif',
    updatedAt: new Date().toISOString()
  })
  assertUniqueTenantFields(tenant, tenants, tenantId)
  return saveTenantRecord(
    tenant,
    tenants,
    'TENANT_DEACTIVATED',
    context,
    `${tenant.tenantName} Tenant kaydı pasife alındı.`
  )
}

export const archiveTenant = (tenantId: string, context: TenantActorContext = {}) => {
  const tenants = loadTenants({ includeDeleted: true })
  const existingTenant = tenants.find(tenant => tenant.id === tenantId)
  if(!existingTenant) throw new Error('Tenant bulunamadı.')

  const now = new Date().toISOString()
  const tenant = normalizeTenant({
    ...existingTenant,
    status: 'Arşivlendi',
    deletedAt: now,
    updatedAt: now
  })
  assertUniqueTenantFields(tenant, tenants, tenantId)
  return saveTenantRecord(
    tenant,
    tenants,
    'TENANT_ARCHIVED',
    context,
    `${tenant.tenantName} Tenant kaydı arşivlendi. Fiziksel veri silinmedi.`
  )
}
