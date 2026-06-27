export type TenantResolutionSource =
  | 'identity'
  | 'company'
  | 'active-tenant'
  | 'record'
  | 'fallback'

export type TenantResolutionInput = {
  userId?: string | null
  companyId?: string | null
  tenantId?: string | null
  requestedTenantId?: string | null
}

export type TenantResolutionResult = {
  tenantId: string | null
  source: TenantResolutionSource
  isolated: boolean
}

/**
 * Reserved model for the future tenant resolver. The active tenant helper still
 * lives in src/tenant.ts and remains the source of truth in Faz 20.9.1.
 */
export const createUnresolvedTenantResult = (): TenantResolutionResult => ({
  tenantId: null,
  source: 'fallback',
  isolated: false
})
