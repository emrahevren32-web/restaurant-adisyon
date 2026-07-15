import type { PermissionName } from '../authorization/permission.types'
import type { LicenseModuleKey } from '../types'
import type {
  WorkspaceTemplateEmptyState,
  WorkspaceTemplateQuickAction,
  WorkspaceTemplateSummary
} from '../workspace-template/workspace-template.types'

export type DashboardWidgetCategory =
  | 'Operasyon'
  | 'Personel'
  | 'Finans'
  | 'Stok'
  | 'Cari'
  | 'AI'
  | 'Takvim'
  | 'Sistem'
  | 'Kurulu Modüller'
  | (string & {})

export type DashboardWidgetSize = 'small' | 'medium' | 'large'
export type DashboardWidgetLayout = 'compact' | 'standard' | 'wide'
export type DashboardWidgetState = 'available' | 'empty' | 'disabled'
export type DashboardWidgetSource = 'module-provided' | 'system-provided' | 'template-provided'
export type DashboardWidgetScope = 'SYSTEM' | 'BUSINESS' | 'PLATFORM'

export type DashboardWidgetModuleContribution = {
  id: string
  title: string
  description: string
  icon: string
  category: DashboardWidgetCategory
  order: number
  defaultVisible: boolean
  defaultSize: DashboardWidgetSize
  supportedLayouts: DashboardWidgetLayout[]
  requiredPermission?: PermissionName
  renderComponent: string
}

export type DashboardWidgetRegistryItem = DashboardWidgetModuleContribution & {
  moduleId: string
  moduleCode: string
  moduleName: string
  moduleIcon: string
  moduleKey?: LicenseModuleKey
  moduleType: string
  scope: DashboardWidgetScope
  state: DashboardWidgetState
  source: DashboardWidgetSource
  displayOrder: number
  emptyTitle?: string
  emptyDescription?: string
  provisionedAt?: string
}

export type DashboardWidgetDefinition = DashboardWidgetRegistryItem

export type DashboardWidgetInstance = {
  id: string
  widgetId: string
  order: number
  visible: boolean
  size: DashboardWidgetSize
  layout: DashboardWidgetLayout
  createdAt: string
  updatedAt: string
}

export type DashboardWidgetViewModel = DashboardWidgetInstance & {
  definition: DashboardWidgetDefinition
}

export type DashboardWidgetCatalogItem = DashboardWidgetDefinition & {
  added: boolean
  instanceId?: string
  visibleInDashboard: boolean
}

export type DashboardWidgetGroup<TWidget> = {
  category: DashboardWidgetCategory
  widgets: TWidget[]
}

export type DashboardWidgetContainer = {
  id: string
  title: string
  description: string
  widgets: DashboardWidgetViewModel[]
  visibleWidgets: DashboardWidgetViewModel[]
  hiddenWidgets: DashboardWidgetViewModel[]
  groupedWidgets: Array<DashboardWidgetGroup<DashboardWidgetViewModel>>
  availableWidgets: DashboardWidgetCatalogItem[]
  catalogGroups: Array<DashboardWidgetGroup<DashboardWidgetCatalogItem>>
  widgetSystemReady: boolean
  isEmpty: boolean
  workspaceTemplate?: WorkspaceTemplateSummary
  quickActions: WorkspaceTemplateQuickAction[]
  emptyStates: WorkspaceTemplateEmptyState[]
}
