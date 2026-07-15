import type {
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'
import type {
  DashboardWidgetCategory,
  DashboardWidgetLayout,
  DashboardWidgetSize
} from '../dashboard/dashboard-widget.types'
import type { ModuleCode } from '../modules/module-code.registry'
import type { ModuleInstallationPlan } from '../modules/module-dependency.types'
import type { ModuleRecommendationPlan } from '../modules/module-recommendation.types'

export const WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS = {
  DASHBOARD: 'dashboard-empty',
  WIDGET_CATALOG: 'widget-catalog-empty',
  BUSINESS_MENU: 'business-menu-empty',
  MODULE_EMPTY: 'module-empty'
} as const

export const WORKSPACE_TEMPLATE_ACTION_TYPES = {
  OPEN_WIDGET_DRAWER: 'open-widget-drawer',
  OPEN_MARKETPLACE: 'open-marketplace',
  OPEN_WORKSPACE_SETTINGS: 'open-workspace-settings'
} as const

export type WorkspaceTemplateEmptyStateKey =
  typeof WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS[keyof typeof WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS]

export type WorkspaceTemplateActionType =
  typeof WORKSPACE_TEMPLATE_ACTION_TYPES[keyof typeof WORKSPACE_TEMPLATE_ACTION_TYPES]

export type WorkspaceTemplateSummary = {
  id: string
  sectorId: string
  name: string
  description: string
  defaultRoute: BusinessWorkspaceRoute
  defaultNavKey: BusinessWorkspaceNavKey
}

export type WorkspaceTemplateDashboardTemplate = {
  title: string
  description: string
  icon: string
}

export type WorkspaceTemplateWidget = {
  id: string
  title: string
  description: string
  icon: string
  category: DashboardWidgetCategory
  order: number
  defaultVisible: boolean
  defaultSize: DashboardWidgetSize
  supportedLayouts: DashboardWidgetLayout[]
  renderComponent: string
  emptyTitle: string
  emptyDescription: string
  moduleCode?: ModuleCode
}

export type WorkspaceTemplateQuickAction = {
  id: string
  label: string
  description: string
  icon: string
  actionType: WorkspaceTemplateActionType
  route: BusinessWorkspaceRoute
  navKey: BusinessWorkspaceNavKey
  order: number
  moduleCode?: ModuleCode
}

export type WorkspaceTemplateMenuItem = {
  id: string
  label: string
  icon: string
  route: BusinessWorkspaceRoute
  navKey: BusinessWorkspaceNavKey
  order: number
  moduleCode?: ModuleCode
}

export type WorkspaceTemplateEmptyState = {
  key: WorkspaceTemplateEmptyStateKey
  title: string
  description: string
  icon: string
  actionLabel?: string
  actionType?: WorkspaceTemplateActionType
  route?: BusinessWorkspaceRoute
  navKey?: BusinessWorkspaceNavKey
}

export type WorkspaceTemplate = WorkspaceTemplateSummary & {
  dashboardTemplate: WorkspaceTemplateDashboardTemplate
  defaultWidgets: WorkspaceTemplateWidget[]
  quickActions: WorkspaceTemplateQuickAction[]
  menuItems: WorkspaceTemplateMenuItem[]
  emptyStates: WorkspaceTemplateEmptyState[]
}

export type WorkspaceTemplateView = WorkspaceTemplate & {
  recommendationPlan: ModuleRecommendationPlan
  installationPlan: ModuleInstallationPlan
  visibleWidgets: WorkspaceTemplateWidget[]
  hiddenFutureWidgets: WorkspaceTemplateWidget[]
  hiddenUnsupportedWidgets: WorkspaceTemplateWidget[]
  visibleQuickActions: WorkspaceTemplateQuickAction[]
  visibleMenuItems: WorkspaceTemplateMenuItem[]
}
