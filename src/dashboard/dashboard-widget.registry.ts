import type { User } from '../types'
import { getBusinessWorkspaceModules } from '../modules/business-workspace.registry'
import type { BusinessWorkspaceModule } from '../modules/business-workspace.registry'
import { WORKSPACE_MODULE_TYPES } from '../modules/module-registry.types'
import {
  getWorkspaceModuleLifecycleStateForUser,
  WORKSPACE_MODULE_LIFECYCLE_STATES
} from '../workspace/workspace-module-lifecycle.service'
import type {
  DashboardWidgetCategory,
  DashboardWidgetDefinition,
  DashboardWidgetModuleContribution,
  DashboardWidgetRegistryItem,
  DashboardWidgetScope
} from './dashboard-widget.types'

export const DASHBOARD_WIDGET_CATEGORIES: DashboardWidgetCategory[] = [
  'Operasyon',
  'Personel',
  'Finans',
  'Stok',
  'Cari',
  'AI',
  'Takvim',
  'Sistem',
  'Kurulu Modüller'
]

const fallbackModuleWidget = (module: BusinessWorkspaceModule): DashboardWidgetModuleContribution => ({
  id: `${module.code}.overview`,
  title: `${module.name} Özeti`,
  description: `${module.name} modülünün Dashboard üzerinde kullanabileceği özet alanı.`,
  icon: module.icon,
  category: 'Kurulu Modüller',
  order: module.displayOrder,
  defaultVisible: false,
  defaultSize: 'medium',
  supportedLayouts: ['standard', 'wide'],
  requiredPermission: module.permissions[0],
  renderComponent: `${module.code}.overview.placeholder`
})

const getModuleWidgetContributions = (module: BusinessWorkspaceModule) => {
  if(module.dashboardWidgets?.length) return module.dashboardWidgets

  return module.moduleType === WORKSPACE_MODULE_TYPES.BUSINESS
    || module.moduleType === WORKSPACE_MODULE_TYPES.INTEGRATION
    ? [fallbackModuleWidget(module)]
    : []
}

const createWidgetRegistryItem = (
  module: BusinessWorkspaceModule,
  widget: DashboardWidgetModuleContribution
): DashboardWidgetRegistryItem => ({
  ...widget,
  id: `${module.id}:${widget.id}`,
  moduleId: module.id,
  moduleCode: module.code,
  moduleName: module.name,
  moduleIcon: module.icon,
  moduleKey: module.licenseModuleKey,
  moduleType: module.moduleType,
  scope: module.scope as DashboardWidgetScope,
  state: 'available',
  source: module.isCoreModule ? 'system-provided' : 'module-provided',
  displayOrder: module.displayOrder * 1000 + widget.order
})

const createDashboardWidgetRegistry = (): DashboardWidgetRegistryItem[] => (
  getBusinessWorkspaceModules()
    .flatMap(module => getModuleWidgetContributions(module)
      .map(widget => createWidgetRegistryItem(module, widget))
    )
)

const getCategoryOrder = (category: DashboardWidgetCategory) => {
  const categoryIndex = DASHBOARD_WIDGET_CATEGORIES.indexOf(category)
  return categoryIndex === -1 ? DASHBOARD_WIDGET_CATEGORIES.length : categoryIndex
}

const compareDashboardWidgets = (
  first: DashboardWidgetDefinition,
  second: DashboardWidgetDefinition
) => {
  const categoryDiff = getCategoryOrder(first.category) - getCategoryOrder(second.category)
  if(categoryDiff !== 0) return categoryDiff
  return first.displayOrder - second.displayOrder
}

const isLifecycleWidgetVisible = (
  user: User | null | undefined,
  module: BusinessWorkspaceModule
) => {
  if(module.moduleType === WORKSPACE_MODULE_TYPES.CORE_SYSTEM) return true

  const state = getWorkspaceModuleLifecycleStateForUser(user, module)
  return state === WORKSPACE_MODULE_LIFECYCLE_STATES.INSTALLED
    || state === WORKSPACE_MODULE_LIFECYCLE_STATES.CONFIGURED
    || state === WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE
}

export const getDashboardWidgetRegistry = () => {
  return createDashboardWidgetRegistry().sort(compareDashboardWidgets)
}

export const getDashboardWidgetRegistryForModule = (module: BusinessWorkspaceModule) => {
  return getDashboardWidgetRegistry()
    .filter(item => item.moduleId === module.id)
}

export const getDashboardWidgetRegistryForUser = (
  user: User | null | undefined,
  scope: DashboardWidgetScope = 'BUSINESS'
): DashboardWidgetDefinition[] => {
  const modulesById = new Map(getBusinessWorkspaceModules().map(module => [module.id, module]))

  return getDashboardWidgetRegistry()
    .filter(item => item.scope === scope)
    .filter(item => {
      const module = modulesById.get(item.moduleId)
      if(scope === 'BUSINESS' && module && !module.isBusinessModule) return false
      return module ? isLifecycleWidgetVisible(user, module) : false
    })
    .map(item => ({ ...item }))
}
