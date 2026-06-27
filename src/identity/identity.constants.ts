import { IdentityResult, USER_TYPES } from './identity.types'

export const IDENTITY_FOUNDATION_VERSION = '20.9.1'

export const IDENTITY_RESOLVER_STATUS = {
  PREPARED: 'PREPARED',
  INACTIVE: 'INACTIVE'
} as const

export const DEFAULT_IDENTITY_RESULT: IdentityResult = {
  authenticated: false,
  userId: null,
  companyId: null,
  tenantId: null,
  userType: USER_TYPES.PUBLIC,
  role: null,
  permissions: [],
  redirectTo: null
}
