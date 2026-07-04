import type { PermissionName } from '../authorization/permission.types'

export type NavigationRegistryNode<Route extends string, NavKey extends string> = {
  moduleId: string
  key: NavKey
  title: string
  icon: string
  route?: Route
  parent?: NavKey
  order: number
  children?: NavigationRegistryNode<Route, NavKey>[]
  requiredPermission?: PermissionName
  visible: boolean
  expandedByDefault: boolean
  adminOnly?: boolean
  platformAdminOnly?: boolean
  badge?: number
  locked?: boolean
  hidden?: boolean
  disabledReason?: string
}
