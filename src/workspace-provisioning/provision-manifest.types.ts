import type { PermissionName } from '../authorization/permission.types'
import type { DashboardWidgetModuleContribution } from '../dashboard/dashboard-widget.types'
import type {
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'

export type ProvisionManifestMenuItem = {
  key: BusinessWorkspaceNavKey
  label: string
  route?: BusinessWorkspaceRoute
  icon: string
  order?: number
  displayOrder?: number
  adminOnly?: boolean
  children?: ProvisionManifestMenuItem[]
}

export type ProvisionManifestRole = {
  key: string
  name: string
  description: string
  permissions: PermissionName[]
  isSystemRole: boolean
}

export type ProvisionManifestSetting = {
  key: string
  label: string
  value: string
  scope: 'workspace' | 'module'
}

export type ProvisionManifestEmptyState = {
  key: string
  title: string
  description: string
  icon: string
  moduleCode?: string
}

export type ProvisionManifest = {
  moduleId: string
  moduleCode: string
  moduleName: string
  manifestVersion: string
  menuItems: ProvisionManifestMenuItem[]
  dashboardWidgets: DashboardWidgetModuleContribution[]
  roles: ProvisionManifestRole[]
  permissions: PermissionName[]
  settings: ProvisionManifestSetting[]
  emptyStates: ProvisionManifestEmptyState[]
  defaultConfig: Record<string, string | number | boolean>
}
