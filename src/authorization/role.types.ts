import { UserType } from '../identity/identity.types'
import { PermissionName } from './permission.types'

export type RoleName = UserType

export type RoleModel = {
  roleName: RoleName
  permissions: PermissionName[]
}

export type RoleResolution = {
  roleName: RoleName
  permissions: PermissionName[]
  source: 'user-type' | 'fallback'
}
