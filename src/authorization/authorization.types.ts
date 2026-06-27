import { UserType } from '../identity/identity.types'
import { PermissionName, PermissionResolution } from './permission.types'
import { RoleResolution } from './role.types'

export type AccessDecisionReason =
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'ROLE_ALLOWED'
  | 'ROLE_DENIED'
  | 'TENANT_ALLOWED'
  | 'TENANT_DENIED'
  | 'LICENSE_ALLOWED'
  | 'LICENSE_DENIED'
  | 'PERMISSION_ALLOWED'
  | 'PERMISSION_DENIED'

export type AuthorizationSubject = {
  userId: string | null
  userType: UserType
  role: string | null
  permissions: string[]
}

export type AuthorizationContext = {
  userId: string | null
  userType: UserType
  role: string | null
  tenantId: string | null
  companyId: string | null
  permissions: PermissionName[]
  roleResolution: RoleResolution
  permissionResolution: PermissionResolution
}

export type AccessDecision = {
  allowed: boolean
  reason: AccessDecisionReason
  redirectTo: string | null
  message: string | null
}

export const createPendingAccessDecision = (): AccessDecision => ({
  allowed: false,
  reason: 'UNAUTHENTICATED',
  redirectTo: null,
  message: null
})
