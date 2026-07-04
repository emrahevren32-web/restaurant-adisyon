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

type CoreSystemNavigationSection = {
  key: BusinessWorkspaceNavKey
  moduleId: string
  title: string
  icon: string
  order: number
  moduleCodes: string[]
  expandedByDefault: boolean
}

const CORE_SYSTEM_NAVIGATION_SECTIONS: CoreSystemNavigationSection[] = [
  {
    key: 'system-tree-workspace',
    moduleId: 'core-navigation-workspace',
    title: 'Workspace',
    icon: 'WS',
    order: 10,
    moduleCodes: ['workspace-welcome', 'dashboard', 'workspace', 'marketplace', 'integration-center'],
    expandedByDefault: true
  },
  {
    key: 'system-tree-management',
    moduleId: 'core-navigation-management',
    title: 'Yönetim',
    icon: 'YN',
    order: 20,
    moduleCodes: ['executive-center', 'users', 'roles', 'branches', 'license', 'subscription'],
    expandedByDefault: true
  },
  {
    key: 'system-tree-system',
    moduleId: 'core-navigation-system',
    title: 'Sistem',
    icon: 'SY',
    order: 30,
    moduleCodes: ['notifications', 'audit', 'settings'],
    expandedByDefault: false
  },
  {
    key: 'system-tree-ai',
    moduleId: 'core-navigation-ai',
    title: 'AI',
    icon: 'AI',
    order: 40,
    moduleCodes: ['ai-center'],
    expandedByDefault: false
  },
  {
    key: 'system-tree-support',
    moduleId: 'core-navigation-support',
    title: 'Destek',
    icon: 'DT',
    order: 50,
    moduleCodes: ['support'],
    expandedByDefault: false
  }
]

const compareByOrder = <T extends { order: number }>(first: T, second: T) => first.order - second.order

const shouldIncludeModule = (
  module: BusinessWorkspaceModule,
  options: CreateWorkspaceNavigationTreeOptions
) => {
  if(module.isCoreModule && options.isCoreModuleVisible && !options.isCoreModuleVisible(module)) return false
  if(module.isCoreModule || module.isAlwaysActive) return true
  return options.isModuleEnabled ? options.isModuleEnabled(module) : true
}

const createMenuNode = (
  module: BusinessWorkspaceModule,
  parent: BusinessWorkspaceNavKey,
  item: BusinessWorkspaceModule['menuItems'][number]
): WorkspaceNavigationNode => ({
  moduleId: module.id,
  key: item.key,
  title: item.label,
  icon: item.icon,
  route: item.route,
  parent,
  order: item.displayOrder ?? module.displayOrder,
  requiredPermission: module.permissions[0],
  visible: !item.hidden,
  expandedByDefault: item.expandedByDefault ?? false,
  adminOnly: item.adminOnly,
  platformAdminOnly: item.platformAdminOnly,
  badge: item.badge,
  locked: item.locked,
  hidden: item.hidden,
  disabledReason: item.disabledReason
})

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
    .filter(module => shouldIncludeModule(module, options))
  const coreModuleByCode = new Map(coreModules.map(module => [module.code, module]))

  return CORE_SYSTEM_NAVIGATION_SECTIONS
    .map(section => {
      const children = section.moduleCodes
        .flatMap(moduleCode => {
          const module = coreModuleByCode.get(moduleCode)
          return module ? createModuleChildren(module, section.key) : []
        })
        .sort(compareByOrder)

      return {
        moduleId: section.moduleId,
        key: section.key,
        title: section.title,
        icon: section.icon,
        order: section.order,
        children,
        visible: children.length > 0,
        expandedByDefault: section.expandedByDefault
      } satisfies WorkspaceNavigationNode
    })
    .filter(item => item.visible)
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
