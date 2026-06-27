export type TenantContextModel = {
  tenantId: string | null
  companyId: string | null
  companyName: string | null
  tenantName: string | null
  initialized: boolean
}

export type TenantLifecycleStep =
  | 'login'
  | 'tenant-loaded'
  | 'application'
  | 'tenant-changed'
  | 'logout'
  | 'tenant-cleared'

export const TENANT_LIFECYCLE_STEPS: TenantLifecycleStep[] = [
  'login',
  'tenant-loaded',
  'application',
  'tenant-changed',
  'logout',
  'tenant-cleared'
]

export type TenantContextInput = {
  tenantId?: string | null
  companyId?: string | null
  companyName?: string | null
  tenantName?: string | null
}
