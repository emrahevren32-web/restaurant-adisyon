import type {
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from './app-navigation.types'
import type { NavigationRegistryNode } from './navigation-registry.types'
import type { BusinessWorkspaceModule } from '../modules/business-workspace.registry'
import {
  getBusinessWorkspaceModules
} from '../modules/business-workspace.registry'
import {
  MODULE_SCOPES,
  WORKSPACE_MODULE_TYPES,
  type WorkspaceModuleType
} from '../modules/module-registry.types'

export type WorkspaceNavigationNode = NavigationRegistryNode<
  BusinessWorkspaceRoute,
  BusinessWorkspaceNavKey
>

export type WorkspaceModuleActivationResolver = (module: BusinessWorkspaceModule) => boolean

export type CreateWorkspaceNavigationTreeOptions = {
  isModuleEnabled?: WorkspaceModuleActivationResolver
  isCoreModuleVisible?: WorkspaceModuleActivationResolver
}

const CORE_WORKSPACE_MODULE_CODES = [
  'workspace-welcome',
  'dashboard',
  'workspace',
  'marketplace',
  'integration-center',
  'tools'
]

const compareByOrder = <T extends { order: number }>(first: T, second: T) => first.order - second.order

const shouldIncludeModule = (
  module: BusinessWorkspaceModule,
  options: CreateWorkspaceNavigationTreeOptions
) => {
  // ADR-002: Production Foundation kapsamı dışındaki modüller hiç üretilmez.
  // Lisans/marketplace kontrollerinden ÖNCE gelir; bu bir kod kararıdır, tercih değil.
  if(module.foundationScope === 'frozen') return false
  if(module.scope !== MODULE_SCOPES.SYSTEM && module.scope !== MODULE_SCOPES.BUSINESS) return false
  if(module.isCoreModule && options.isCoreModuleVisible && !options.isCoreModuleVisible(module)) return false
  if(module.isCoreModule || module.isAlwaysActive) return true
  return options.isModuleEnabled ? options.isModuleEnabled(module) : true
}

const createMenuNode = (
  module: BusinessWorkspaceModule,
  parent: BusinessWorkspaceNavKey,
  item: BusinessWorkspaceModule['menuItems'][number]
): WorkspaceNavigationNode => {
  const children = (item.children || [])
    .map(child => createMenuNode(module, item.key, child))
    .filter(child => child.visible)
    .sort(compareByOrder)
  const hasChildren = children.length > 0

  return {
    moduleId: module.id,
    key: item.key,
    title: item.label,
    icon: item.icon,
    route: item.route,
    parent,
    order: item.order ?? item.displayOrder ?? module.displayOrder,
    children: hasChildren ? children : undefined,
    requiredPermission: item.requiredPermission ?? module.permissions[0],
    // ADR-002: kapsam dışı menü ögesi üretilmez (modülü core olsa bile).
    visible: item.foundationScope !== 'frozen'
      && item.visible !== false && !item.hidden && (Boolean(item.route) || hasChildren),
    expandedByDefault: item.expandedByDefault ?? false,
    adminOnly: item.adminOnly,
    platformAdminOnly: item.platformAdminOnly,
    badge: item.badge,
    locked: item.locked,
    hidden: item.hidden,
    disabledReason: item.disabledReason
  }
}

const createModuleChildren = (
  module: BusinessWorkspaceModule,
  parent: BusinessWorkspaceNavKey
) => module.menuItems
  .map(item => createMenuNode(module, parent, item))
  .filter(item => item.visible)
  .sort(compareByOrder)

const createCoreSystemNavigation = (
  options: CreateWorkspaceNavigationTreeOptions
): WorkspaceNavigationNode[] => {
  const coreModules = getBusinessWorkspaceModules(WORKSPACE_MODULE_TYPES.CORE_SYSTEM)
    .filter(module => CORE_WORKSPACE_MODULE_CODES.includes(module.code))
    .filter(module => shouldIncludeModule(module, options))
  const coreModuleByCode = new Map(coreModules.map(module => [module.code, module]))

  return CORE_WORKSPACE_MODULE_CODES
    .flatMap(moduleCode => {
      const module = coreModuleByCode.get(moduleCode)
      return module ? createModuleChildren(module, 'system-tree-workspace') : []
    })
    .sort(compareByOrder)
}

const createInstallableModuleNavigation = (
  moduleType: WorkspaceModuleType,
  options: CreateWorkspaceNavigationTreeOptions
): WorkspaceNavigationNode[] => (
  getBusinessWorkspaceModules(moduleType)
    .filter(module => shouldIncludeModule(module, options))
    .map(module => {
      const key = `module-${module.code}` as BusinessWorkspaceNavKey
      const children = createModuleChildren(module, key)

      return {
        moduleId: module.id,
        key,
        title: module.name,
        icon: module.icon,
        order: module.displayOrder,
        children,
        requiredPermission: module.permissions[0],
        visible: children.length > 0,
        expandedByDefault: false
      } satisfies WorkspaceNavigationNode
    })
    .filter(item => item.visible)
    .sort(compareByOrder)
)

export const createWorkspaceNavigationRegistry = (
  options: CreateWorkspaceNavigationTreeOptions = {}
) => ({
  systemModules: createCoreSystemNavigation(options),
  businessModules: createInstallableModuleNavigation(WORKSPACE_MODULE_TYPES.BUSINESS, options),
  integrationModules: createInstallableModuleNavigation(WORKSPACE_MODULE_TYPES.INTEGRATION, options)
})
