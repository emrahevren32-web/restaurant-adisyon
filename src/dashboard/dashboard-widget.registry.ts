import type { User } from '../types'
import { getBusinessWorkspaceModules } from '../modules/business-workspace.registry'
import type { BusinessWorkspaceModule } from '../modules/business-workspace.registry'
import { WORKSPACE_MODULE_TYPES } from '../modules/module-registry.types'
import { getInstalledWorkspaceModulesForUser } from '../workspace/workspace-module-installation.service'
import type {
  DashboardWidgetDefinition,
  DashboardWidgetRegistryItem
} from './dashboard-widget.types'

const createModuleWidgetCandidate = (module: BusinessWorkspaceModule): DashboardWidgetRegistryItem => ({
  id: `dashboard_widget_${module.id}_overview`,
  moduleId: module.id,
  moduleCode: module.code,
  moduleName: module.name,
  moduleIcon: module.icon,
  title: `${module.name} Özeti`,
  description: `${module.name} modülünden Dashboard'a eklenebilecek özet alanı. Canlı veri gösterimi sonraki fazda bağlanacak.`,
  moduleKey: module.licenseModuleKey,
  size: 'medium',
  state: 'available',
  source: 'module-provided',
  renderKey: `${module.code}.overview.placeholder`,
  displayOrder: module.displayOrder
})

const DASHBOARD_WIDGET_REGISTRY: DashboardWidgetRegistryItem[] = [
  ...getBusinessWorkspaceModules(WORKSPACE_MODULE_TYPES.BUSINESS).map(createModuleWidgetCandidate),
  ...getBusinessWorkspaceModules(WORKSPACE_MODULE_TYPES.INTEGRATION).map(createModuleWidgetCandidate)
]

export const getDashboardWidgetRegistry = () => {
  return [...DASHBOARD_WIDGET_REGISTRY]
    .sort((first, second) => first.displayOrder - second.displayOrder)
}

export const getDashboardWidgetRegistryForModule = (module: BusinessWorkspaceModule) => {
  return getDashboardWidgetRegistry()
    .filter(item => item.moduleId === module.id)
}

export const getDashboardWidgetRegistryForUser = (user: User | null | undefined): DashboardWidgetDefinition[] => {
  const activeModuleIds = new Set(getInstalledWorkspaceModulesForUser(user).map(module => module.id))

  return getDashboardWidgetRegistry()
    .filter(item => activeModuleIds.has(item.moduleId))
    .map(item => ({ ...item }))
}
