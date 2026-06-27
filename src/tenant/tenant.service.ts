import { IdentityResult, USER_TYPES } from '../identity/identity.types'
import {
  getCurrentTenant,
  getTenantByCompanyId,
  loadTenants,
  resolveTenantIdForCompany
} from '../tenant'
import { createTenantContext, clearTenantContext } from './tenant.context'
import { TenantContextModel } from './tenant.types'

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
  const companyId = identity.companyId || fallbackTenant?.companyId || null

  return createTenantContext({
    tenantId,
    companyId,
    companyName: fallbackTenant?.companyName || null,
    tenantName: fallbackTenant?.tenantCode || fallbackTenant?.companyName || null
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
