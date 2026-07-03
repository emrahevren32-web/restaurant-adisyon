import type {
  BusinessWorkspaceNavGroupKey,
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'
import type { ShellNavGroup, ShellNavItem } from '../components/AppShell'
import type { LicenseModuleKey } from '../types'
import {
  BUSINESS_WORKSPACE_MODULE_REGISTRY,
  getBusinessWorkspaceMenuItems
} from './business-workspace.registry'
import { WORKSPACE_MODULE_TYPES } from './module-registry.types'

export const MODULE_MENU_CONTROL_MODE: 'locked' | 'hidden' = 'locked'

export type BusinessWorkspaceNavItem = ShellNavItem<BusinessWorkspaceRoute, BusinessWorkspaceNavKey>
export type BusinessWorkspaceNavGroup = ShellNavGroup<
  BusinessWorkspaceRoute,
  BusinessWorkspaceNavKey,
  BusinessWorkspaceNavGroupKey
>

const toShellNavItem = (
  item: BusinessWorkspaceNavItem
): BusinessWorkspaceNavItem => ({
  key: item.key,
  label: item.label,
  route: item.route,
  icon: item.icon,
  adminOnly: item.adminOnly,
  platformAdminOnly: item.platformAdminOnly,
  badge: item.badge,
  locked: item.locked,
  hidden: item.hidden,
  disabledReason: item.disabledReason
})

export const createBusinessWorkspaceNavGroups = (): BusinessWorkspaceNavGroup[] => [
  {
    key: 'system-modules',
    title: 'SİSTEM MODÜLLERİ',
    icon: 'SM',
    items: getBusinessWorkspaceMenuItems(WORKSPACE_MODULE_TYPES.CORE_SYSTEM).map(toShellNavItem)
  },
  {
    key: 'business-modules',
    title: 'İŞ MODÜLLERİ',
    icon: 'IM',
    items: getBusinessWorkspaceMenuItems(WORKSPACE_MODULE_TYPES.BUSINESS).map(toShellNavItem)
  },
  {
    key: 'integration-modules',
    title: 'ENTEGRASYON MODÜLLERİ',
    icon: 'EN',
    items: getBusinessWorkspaceMenuItems(WORKSPACE_MODULE_TYPES.INTEGRATION).map(toShellNavItem)
  }
]

export const createLicensedNavModuleMap = () => {
  const licensedNavModules: Partial<Record<BusinessWorkspaceNavKey, LicenseModuleKey>> = {}

  BUSINESS_WORKSPACE_MODULE_REGISTRY.forEach(module => {
    if(!module.licenseModuleKey) return
    if(module.moduleType === WORKSPACE_MODULE_TYPES.CORE_SYSTEM) return
    module.menuItems.forEach(item => {
      licensedNavModules[item.key] = module.licenseModuleKey
    })
  })

  return licensedNavModules
}

export const createLicensedRouteModuleMap = () => {
  const licensedRouteModules: Partial<Record<BusinessWorkspaceRoute, LicenseModuleKey>> = {}

  BUSINESS_WORKSPACE_MODULE_REGISTRY.forEach(module => {
    if(!module.licenseModuleKey) return
    if(module.moduleType === WORKSPACE_MODULE_TYPES.CORE_SYSTEM) return
    licensedRouteModules[module.route] = module.licenseModuleKey
    module.menuItems.forEach(item => {
      licensedRouteModules[item.route] = module.licenseModuleKey
    })
  })

  return licensedRouteModules
}
