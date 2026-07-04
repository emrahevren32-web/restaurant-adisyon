import type { User } from '../types'
import {
  activateTenant,
  archiveTenant,
  createTenant,
  deactivateTenant,
  getTenantById,
  listTenants,
  updateTenant,
  type TenantCreateInput,
  type TenantListOptions,
  type TenantUpdateInput
} from './tenant.service'

export const TENANT_API_ENDPOINTS = {
  list: 'GET /tenants',
  detail: 'GET /tenants/:id',
  create: 'POST /tenants',
  update: 'PUT /tenants/:id',
  activate: 'PATCH /tenants/:id/activate',
  deactivate: 'PATCH /tenants/:id/deactivate',
  archive: 'DELETE /tenants/:id'
} as const

export type TenantApiRequest =
  | { method: 'GET'; path: '/tenants'; query?: TenantListOptions; user?: User | null }
  | { method: 'GET'; path: `/tenants/${string}`; user?: User | null }
  | { method: 'POST'; path: '/tenants'; body: TenantCreateInput; user?: User | null }
  | { method: 'PUT'; path: `/tenants/${string}`; body: TenantUpdateInput; user?: User | null }
  | { method: 'PATCH'; path: `/tenants/${string}/activate`; user?: User | null }
  | { method: 'PATCH'; path: `/tenants/${string}/deactivate`; user?: User | null }
  | { method: 'DELETE'; path: `/tenants/${string}`; user?: User | null }

const getTenantIdFromPath = (path: string, suffix = '') => {
  const pattern = suffix
    ? new RegExp(`^/tenants/([^/]+)/${suffix}$`)
    : /^\/tenants\/([^/]+)$/
  return path.match(pattern)?.[1] || ''
}

export const handleTenantApiRequest = (request: TenantApiRequest) => {
  if(request.method === 'GET' && request.path === '/tenants'){
    return listTenants(request.query || {})
  }

  if(request.method === 'POST' && request.path === '/tenants'){
    return createTenant(request.body, { user: request.user })
  }

  if(request.method === 'GET'){
    const tenantId = getTenantIdFromPath(request.path)
    const tenant = tenantId ? getTenantById(tenantId) : null
    if(!tenant) throw new Error('Tenant bulunamadı.')
    return tenant
  }

  if(request.method === 'PUT'){
    const tenantId = getTenantIdFromPath(request.path)
    if(!tenantId) throw new Error('Tenant endpoint geçersiz.')
    return updateTenant(tenantId, request.body, { user: request.user })
  }

  if(request.method === 'PATCH'){
    const activateId = getTenantIdFromPath(request.path, 'activate')
    if(activateId) return activateTenant(activateId, { user: request.user })

    const deactivateId = getTenantIdFromPath(request.path, 'deactivate')
    if(deactivateId) return deactivateTenant(deactivateId, { user: request.user })
  }

  if(request.method === 'DELETE'){
    const tenantId = getTenantIdFromPath(request.path)
    if(tenantId) return archiveTenant(tenantId, { user: request.user })
  }

  throw new Error('Tenant endpoint desteklenmiyor.')
}
