import type {
  BusinessWorkspaceNavGroupKey,
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'
import type { ShellNavGroup, ShellNavItem } from '../components/AppShell'
import type { LicenseModuleKey } from '../types'
import type { BusinessWorkspaceModule } from './business-workspace.registry'
import {
  BUSINESS_WORKSPACE_MODULE_REGISTRY,
  getBusinessWorkspaceModules
} from './business-workspace.registry'
import { WORKSPACE_MODULE_TYPES } from './module-registry.types'

export type BusinessWorkspaceNavItem = ShellNavItem<BusinessWorkspaceRoute, BusinessWorkspaceNavKey>
export type BusinessWorkspaceNavGroup = ShellNavGroup<
  BusinessWorkspaceRoute,
  BusinessWorkspaceNavKey,
  BusinessWorkspaceNavGroupKey
>

export type WorkspaceModuleActivationResolver = (module: BusinessWorkspaceModule) => boolean

type CreateBusinessWorkspaceNavGroupsOptions = {
  isModuleEnabled?: WorkspaceModuleActivationResolver
  isCoreModuleVisible?: WorkspaceModuleActivationResolver
}

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

const getModuleMenuItems = (
  moduleType: BusinessWorkspaceModule['moduleType'],
  isModuleEnabled?: WorkspaceModuleActivationResolver,
  isCoreModuleVisible?: WorkspaceModuleActivationResolver
) => {
  return getBusinessWorkspaceModules(moduleType)
    .filter(module => {
      if(module.isCoreModule && isCoreModuleVisible && !isCoreModuleVisible(module)) return false
      if(module.isCoreModule || module.isAlwaysActive) return true
      return isModuleEnabled ? isModuleEnabled(module) : true
    })
    .flatMap(module => module.menuItems
      .filter(item => !item.hidden)
      .sort((first, second) => (first.displayOrder || 0) - (second.displayOrder || 0))
    )
    .map(toShellNavItem)
}

export const createBusinessWorkspaceNavGroups = ({
  isModuleEnabled,
  isCoreModuleVisible
}: CreateBusinessWorkspaceNavGroupsOptions = {}): BusinessWorkspaceNavGroup[] => [
  {
    key: 'system-modules',
    title: 'SİSTEM MODÜLLERİ',
    icon: 'SM',
    items: getModuleMenuItems(WORKSPACE_MODULE_TYPES.CORE_SYSTEM, isModuleEnabled, isCoreModuleVisible)
  },
  {
    key: 'business-modules',
    title: 'İŞ MODÜLLERİ',
    icon: 'IM',
    emptyTitle: 'Henüz modül yüklenmedi.',
    emptyDescription: "Marketplace'ten ilk modülünüzü kurabilirsiniz.",
    emptyAction: {
      key: 'marketplace',
      label: "Marketplace'e Git",
      route: 'marketplace',
      icon: 'MP',
      adminOnly: true
    },
    items: getModuleMenuItems(WORKSPACE_MODULE_TYPES.BUSINESS, isModuleEnabled, isCoreModuleVisible)
  },
  {
    key: 'integration-modules',
    title: 'ENTEGRASYON MODÜLLERİ',
    icon: 'EN',
    items: getModuleMenuItems(WORKSPACE_MODULE_TYPES.INTEGRATION, isModuleEnabled, isCoreModuleVisible)
  }
]

export const createLicensedNavModuleMap = () => {
  const licensedNavModules: Partial<Record<BusinessWorkspaceNavKey, LicenseModuleKey>> = {}

  BUSINESS_WORKSPACE_MODULE_REGISTRY.forEach(module => {
    if(!module.isEnabled || !module.isVisible) return
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
    if(!module.isEnabled || !module.isVisible) return
    if(!module.licenseModuleKey) return
    if(module.moduleType === WORKSPACE_MODULE_TYPES.CORE_SYSTEM) return
    licensedRouteModules[module.route] = module.licenseModuleKey
    module.menuItems.forEach(item => {
      licensedRouteModules[item.route] = module.licenseModuleKey
    })
  })

  return licensedRouteModules
}
