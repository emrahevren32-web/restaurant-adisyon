import { USER_TYPES, UserType } from '../identity/identity.types'
import { PermissionName } from './permission.types'
import { RoleModel, RoleName, RoleResolution } from './role.types'

export const DEFAULT_ROLES: RoleModel[] = [
  {
    roleName: USER_TYPES.SUPER_ADMIN,
    permissions: [
      'platform.read',
      'platform.manage',
      'company.read',
      'company.manage',
      'dashboard.read'
    ]
  },
  {
    roleName: USER_TYPES.COMPANY_ADMIN,
    permissions: [
      'company.read',
      'company.manage',
      'dashboard.read',
      'products.read',
      'products.write',
      'stock.read',
      'stock.write',
      'finance.read',
      'finance.write',
      'personnel.read',
      'personnel.manage',
      'operations.read',
      'operations.write'
    ]
  },
  {
    roleName: USER_TYPES.COMPANY_USER,
    permissions: [
      'operations.read',
      'products.read'
    ]
  },
  {
    roleName: USER_TYPES.PUBLIC,
    permissions: []
  }
]

export const getDefaultRoles = (): RoleModel[] => {
  return DEFAULT_ROLES.map(role => ({
    ...role,
    permissions: [...role.permissions]
  }))
}

export const resolveRole = (userType: UserType): RoleResolution => {
  const role = DEFAULT_ROLES.find(item => item.roleName === userType)
    || DEFAULT_ROLES.find(item => item.roleName === USER_TYPES.PUBLIC)

  return {
    roleName: (role?.roleName || USER_TYPES.PUBLIC) as RoleName,
    permissions: [...(role?.permissions || [])] as PermissionName[],
    source: role ? 'user-type' : 'fallback'
  }
}

export const hasRole = (userType: UserType, roleName: RoleName) => {
  return userType === roleName
}
