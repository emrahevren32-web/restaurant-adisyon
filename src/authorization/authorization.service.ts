import { IdentityResult } from '../identity/identity.types'
import { TenantContextModel } from '../tenant/tenant.types'
import { AuthorizationContext } from './authorization.types'
import {
  hasPermission as hasPermissionValue,
  resolvePermissions
} from './permission.service'
import { PermissionName } from './permission.types'
import {
  hasRole as hasRoleValue,
  resolveRole
} from './role.service'
import { RoleName } from './role.types'

export const resolveAuthorization = (
  identity: IdentityResult,
  tenantContext: TenantContextModel
): AuthorizationContext => {
  const roleResolution = resolveRole(identity.userType)
  const permissionResolution = resolvePermissions(roleResolution.permissions, identity.authenticated ? 'role' : 'public')

  return {
    userId: identity.userId,
    userType: identity.userType,
    role: identity.role,
    tenantId: tenantContext.tenantId,
    companyId: tenantContext.companyId,
    permissions: permissionResolution.permissions,
    roleResolution,
    permissionResolution
  }
}

export const applyAuthorizationToIdentity = (
  identity: IdentityResult,
  authorization: AuthorizationContext
): IdentityResult => ({
  ...identity,
  permissions: [...authorization.permissions]
})

export const getPermissions = (
  authorization: Pick<AuthorizationContext, 'permissions'>
): PermissionName[] => {
  return [...authorization.permissions]
}

export const hasPermission = (
  authorization: Pick<AuthorizationContext, 'permissions'>,
  permission: PermissionName | string
) => {
  return hasPermissionValue(authorization.permissions, permission)
}

export const hasRole = (
  authorization: Pick<AuthorizationContext, 'userType'>,
  roleName: RoleName
) => {
  return hasRoleValue(authorization.userType, roleName)
}
