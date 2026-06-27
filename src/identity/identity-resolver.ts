import { DEFAULT_IDENTITY_RESULT } from './identity.constants'
import { getCompanyIdForUser, getCurrentUser } from '../storage'
import { resolveTenantIdForCompany } from '../tenant'
import { User } from '../types'
import { IdentityResolverContext, IdentityResult, UserType, USER_TYPES } from './identity.types'

/**
 * Central identity resolver for the legacy localStorage auth payload.
 * It produces the new IdentityResult shape without changing routing, JWT, or
 * UI behavior. Future phases can replace the data source behind this boundary.
 */
export const resolveIdentity = (context: IdentityResolverContext = {}): IdentityResult => {
  const user = getLegacyUser(context)
  if(!user || user.active === false){
    return createPublicIdentityResult()
  }

  const companyId = normalizeOptionalId(getCompanyIdForUser(user))
  const tenantId = resolveTenantId(user, companyId)
  const userType = resolveUserType(user, companyId)

  return {
    authenticated: true,
    userId: user.id,
    companyId,
    tenantId,
    userType,
    role: user.role,
    permissions: createBasePermissions(userType),
    redirectTo: null
  }
}

export const createAnonymousIdentityResult = (): IdentityResult => {
  return createPublicIdentityResult()
}

const getLegacyUser = (context: IdentityResolverContext): User | null => {
  const source = context.legacyUser === undefined ? getCurrentUser() : context.legacyUser
  return isLegacyUser(source) ? source : null
}

const isLegacyUser = (value: unknown): value is User => {
  if(!value || typeof value !== 'object') return false
  const user = value as Partial<User>

  return (
    typeof user.id === 'string'
    && typeof user.username === 'string'
    && typeof user.role === 'string'
  )
}

const normalizeOptionalId = (value: unknown) => {
  const normalized = String(value || '').trim()
  return normalized || null
}

const resolveTenantId = (user: User, companyId: string | null) => {
  const userTenantId = normalizeOptionalId(user.tenantId)
  if(userTenantId) return userTenantId
  if(!companyId) return null

  return normalizeOptionalId(resolveTenantIdForCompany(companyId))
}

const resolveUserType = (user: User, companyId: string | null): UserType => {
  if(user.role === 'Admin' && !companyId) return USER_TYPES.SUPER_ADMIN
  if(user.role === 'Admin') return USER_TYPES.COMPANY_ADMIN
  return USER_TYPES.COMPANY_USER
}

const createBasePermissions = (userType: UserType) => {
  if(userType === USER_TYPES.SUPER_ADMIN) return ['platform.read', 'platform.manage']
  if(userType === USER_TYPES.COMPANY_ADMIN) return ['company.read', 'company.manage', 'dashboard.read']
  if(userType === USER_TYPES.COMPANY_USER) return ['restaurant.read']
  return []
}

const createPublicIdentityResult = (): IdentityResult => ({
  ...DEFAULT_IDENTITY_RESULT,
  permissions: [...DEFAULT_IDENTITY_RESULT.permissions]
})
