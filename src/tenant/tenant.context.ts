import { TenantContextInput, TenantContextModel } from './tenant.types'

export const EMPTY_TENANT_CONTEXT: TenantContextModel = {
  tenantId: null,
  companyId: null,
  companyName: null,
  tenantName: null,
  initialized: false
}

export const createTenantContext = (input: TenantContextInput = {}): TenantContextModel => {
  const tenantId = normalizeOptionalValue(input.tenantId)
  const companyId = normalizeOptionalValue(input.companyId)

  return {
    tenantId,
    companyId,
    companyName: normalizeOptionalValue(input.companyName),
    tenantName: normalizeOptionalValue(input.tenantName),
    initialized: Boolean(tenantId || companyId)
  }
}

export const clearTenantContext = (): TenantContextModel => ({
  ...EMPTY_TENANT_CONTEXT
})

const normalizeOptionalValue = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || null
}
