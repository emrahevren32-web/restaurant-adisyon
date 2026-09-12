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

export type WorkspacePermissionResolver = (permission: string | undefined) => boolean

export type CreateWorkspaceNavigationTreeOptions = {
  isModuleEnabled?: WorkspaceModuleActivationResolver
  isCoreModuleVisible?: WorkspaceModuleActivationResolver
  /**
   * Kullanıcının bu izne sahip olup olmadığını söyler. Verilmezse izin
   * kontrolü YAPILMAZ (her öge görünür) — mevcut çağıranların davranışı
   * değişmesin diye. Gerçek kullanımda `App.tsx` bunu geçer.
   *
   * Bkz. `src/authorization/route-permission.ts` — aynı iznin rota
   * tarafındaki ikinci savunma hattı.
   */
  hasPermission?: WorkspacePermissionResolver
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
  item: BusinessWorkspaceModule['menuItems'][number],
  options: CreateWorkspaceNavigationTreeOptions = {}
): WorkspaceNavigationNode => {
  const children = (item.children || [])
    .map(child => createMenuNode(module, item.key, child, options))
    .filter(child => child.visible)
    .sort(compareByOrder)
  const hasChildren = children.length > 0

  const requiredPermission = item.requiredPermission ?? module.permissions[0]

  // Yetki kontrolü — BİRİNCİ savunma hattı (ikincisi rota tarafında,
  // bkz. src/authorization/route-permission.ts). İzni olmayan öge menüde
  // hiç ÜRETİLMEZ; "kilitli göster" değil, yok say.
  //
  // Çocuğu olan bir başlık, izin gerektirse bile çocukları üzerinden
  // değerlendirilir: izinli tek bir alt öge kalmışsa başlık görünür kalmalı,
  // çocukların hepsi süzülmüşse `hasChildren` zaten false olur.
  const permissionAllows = hasChildren
    || !options.hasPermission
    || options.hasPermission(requiredPermission)

  return {
    moduleId: module.id,
    key: item.key,
    title: item.label,
    icon: item.icon,
    route: item.route,
    parent,
    order: item.order ?? item.displayOrder ?? module.displayOrder,
    children: hasChildren ? children : undefined,
    requiredPermission,
    // ADR-002: kapsam dışı menü ögesi üretilmez (modülü core olsa bile).
    // + Aşama 1: izni olmayan öge de üretilmez (varsayılan reddet).
    visible: item.foundationScope !== 'frozen'
      && permissionAllows
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
  parent: BusinessWorkspaceNavKey,
  options: CreateWorkspaceNavigationTreeOptions = {}
) => module.menuItems
  .map(item => createMenuNode(module, parent, item, options))
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
      return module ? createModuleChildren(module, 'system-tree-workspace', options) : []
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
      const children = createModuleChildren(module, key, options)

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
