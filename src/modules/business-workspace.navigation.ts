import type {
  BusinessWorkspaceNavGroupKey,
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'
import type { ShellNavGroup, ShellNavItem } from '../components/AppShell'
import type { LicenseModuleKey } from '../types'
import {
  createWorkspaceNavigationRegistry,
  type WorkspaceModuleActivationResolver,
  type WorkspaceNavigationNode
} from '../navigation/workspace-navigation.registry'
import {
  BUSINESS_WORKSPACE_MODULE_REGISTRY
} from './business-workspace.registry'
import { WORKSPACE_MODULE_TYPES } from './module-registry.types'

export type BusinessWorkspaceNavItem = ShellNavItem<BusinessWorkspaceRoute, BusinessWorkspaceNavKey>
export type BusinessWorkspaceNavGroup = ShellNavGroup<
  BusinessWorkspaceRoute,
  BusinessWorkspaceNavKey,
  BusinessWorkspaceNavGroupKey
>

type CreateBusinessWorkspaceNavGroupsOptions = {
  isModuleEnabled?: WorkspaceModuleActivationResolver
  isCoreModuleVisible?: WorkspaceModuleActivationResolver
}

const toShellNavItem = (
  item: WorkspaceNavigationNode
): BusinessWorkspaceNavItem => ({
  key: item.key,
  label: item.title,
  route: item.route,
  icon: item.icon,
  moduleId: item.moduleId,
  parent: item.parent,
  order: item.order,
  children: item.children?.map(toShellNavItem),
  requiredPermission: item.requiredPermission,
  visible: item.visible,
  expandedByDefault: item.expandedByDefault,
  adminOnly: item.adminOnly,
  platformAdminOnly: item.platformAdminOnly,
  badge: item.badge,
  locked: item.locked,
  hidden: item.hidden,
  disabledReason: item.disabledReason
})

export const flattenBusinessWorkspaceNavItems = (
  items: BusinessWorkspaceNavItem[]
): BusinessWorkspaceNavItem[] => (
  items.flatMap(item => [
    item,
    ...flattenBusinessWorkspaceNavItems(item.children || [])
  ])
)

export const createBusinessWorkspaceNavGroups = (
  options: CreateBusinessWorkspaceNavGroupsOptions = {}
): BusinessWorkspaceNavGroup[] => {
  const registry = createWorkspaceNavigationRegistry(options)

  return [
    {
      key: 'system-modules',
      title: 'SİSTEM MODÜLLERİ',
      icon: 'SM',
      items: registry.systemModules.map(toShellNavItem)
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
      items: registry.businessModules.map(toShellNavItem)
    },
    {
      key: 'integration-modules',
      title: 'ENTEGRASYON MODÜLLERİ',
      icon: 'EN',
      items: registry.integrationModules.map(toShellNavItem)
    }
  ]
}

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
