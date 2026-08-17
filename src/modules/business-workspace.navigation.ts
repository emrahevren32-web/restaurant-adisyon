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
  showBusinessModuleEmptyAction?: boolean
  businessModuleEmptyState?: {
    title?: string
    description?: string
    actionLabel?: string
  }
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

const flattenModuleMenuItems = (
  items: typeof BUSINESS_WORKSPACE_MODULE_REGISTRY[number]['menuItems']
): typeof BUSINESS_WORKSPACE_MODULE_REGISTRY[number]['menuItems'] => (
  items.flatMap(item => [
    item,
    ...flattenModuleMenuItems(item.children || [])
  ])
)

const OPERATION_MODULE_IDS = new Set([
  'business-adisyon',
  'business-qr-menu',
  'business-recipe',
  'business-purchase',
  'business-quality',
  'business-production-work-orders',
  'business-logistics'
])

const BUSINESS_MODULE_IDS = new Set([
  'business-stock',
  'business-warehouse',
  'business-current',
  'business-credit',
  'business-finance',
  'business-personnel',
  'business-multi-branch'
])

const REPORT_MODULE_IDS = new Set([
  'business-kpi-reporting',
  'business-decision-support-workspace',
  'business-manager-alerts'
])

const getModuleId = (item: BusinessWorkspaceNavItem) => item.moduleId || String(item.key)

const getNavigationSectionItems = (
  items: BusinessWorkspaceNavItem[],
  sectionModuleIds: Set<string>
) => items.filter(item => sectionModuleIds.has(getModuleId(item)))

export const createBusinessWorkspaceNavGroups = (
  options: CreateBusinessWorkspaceNavGroupsOptions = {}
): BusinessWorkspaceNavGroup[] => {
  const registry = createWorkspaceNavigationRegistry(options)
  const businessModules = registry.businessModules.map(toShellNavItem)
  const categorizedModuleIds = new Set([
    ...OPERATION_MODULE_IDS,
    ...BUSINESS_MODULE_IDS,
    ...REPORT_MODULE_IDS
  ])
  const fallbackOperationItems = businessModules.filter(item => !categorizedModuleIds.has(getModuleId(item)))
  const operationItems = [
    ...getNavigationSectionItems(businessModules, OPERATION_MODULE_IDS),
    ...fallbackOperationItems
  ]
  const businessItems = getNavigationSectionItems(businessModules, BUSINESS_MODULE_IDS)
  const reportItems = getNavigationSectionItems(businessModules, REPORT_MODULE_IDS)
  const showBusinessModuleEmptyState = businessModules.length === 0

  return [
    {
      key: 'system-modules',
      title: 'WORKSPACE',
      icon: 'WS',
      items: registry.systemModules.map(toShellNavItem)
    },
    {
      key: 'operations-modules',
      title: 'OPERATIONS',
      icon: 'IM',
      emptyTitle: showBusinessModuleEmptyState
        ? options.businessModuleEmptyState?.title || 'Henuz modul yuklenmedi.'
        : undefined,
      emptyDescription: showBusinessModuleEmptyState
        ? options.businessModuleEmptyState?.description || 'Is modulleri eklendiginde menude burada gorunecek. Ilk modulunuzu Modul Magazasi uzerinden kesfedebilirsiniz.'
        : undefined,
      emptyAction: showBusinessModuleEmptyState && options.showBusinessModuleEmptyAction ? {
        key: 'marketplace',
        label: options.businessModuleEmptyState?.actionLabel || 'Modul Magazasina Git',
        route: 'marketplace',
        icon: 'MP',
        adminOnly: true
      } : undefined,
      items: operationItems
    },
    {
      key: 'business-modules',
      title: 'BUSINESS',
      icon: 'BS',
      items: businessItems
    },
    {
      key: 'report-modules',
      title: 'REPORTS',
      icon: 'RP',
      items: reportItems
    },
    {
      key: 'integration-modules',
      title: 'SYSTEM',
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
    flattenModuleMenuItems(module.menuItems).forEach(item => {
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
    flattenModuleMenuItems(module.menuItems).forEach(item => {
      if(item.route) licensedRouteModules[item.route] = module.licenseModuleKey
    })
  })

  return licensedRouteModules
}
