import { getCompanyIdForUser } from '../storage'
import type { User } from '../types'
import { getWorkspaceProvisionedStateForUser } from '../workspace-provisioning/workspace-provisioning.service'
import type { ProvisionedDashboardWidget } from '../workspace-provisioning/workspace-provisioning.types'
import { getWorkspaceTemplateViewForUser } from '../workspace-template/workspace-template.service'
import type {
  WorkspaceTemplateView,
  WorkspaceTemplateWidget
} from '../workspace-template/workspace-template.types'
import { getDashboardWidgetRegistryForUser } from './dashboard-widget.registry'
import type {
  DashboardWidgetCatalogItem,
  DashboardWidgetContainer,
  DashboardWidgetDefinition,
  DashboardWidgetGroup,
  DashboardWidgetInstance,
  DashboardWidgetLayout,
  DashboardWidgetSize,
  DashboardWidgetViewModel
} from './dashboard-widget.types'

const STORAGE_KEY_PREFIX = 'miyop_dashboard_widget_layout'
export const DASHBOARD_WIDGET_LAYOUT_EVENT = 'miyop-dashboard-widget-layout-updated'
const WORKSPACE_TEMPLATE_WIDGET_MODULE_ID = 'workspace-template'
const WORKSPACE_TEMPLATE_WIDGET_MODULE_TYPE = 'workspace-template'

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const getWorkspaceKeyForUser = (user?: User | null) => {
  const companyId = getCompanyIdForUser(user)
  return companyId || user?.tenantId || user?.id || 'workspace'
}

const getStorageKey = (user?: User | null) => (
  `${STORAGE_KEY_PREFIX}_${getWorkspaceKeyForUser(user)}`
)

const hasStoredLayout = (user?: User | null) => (
  isBrowser() && localStorage.getItem(getStorageKey(user)) !== null
)

const createInstanceId = (widgetId: string, workspaceKey: string) => (
  `dashboard_widget_instance_${workspaceKey}_${widgetId}`.replace(/[^a-z0-9_-]/gi, '_')
)

const dispatchLayoutEvent = () => {
  if(!isBrowser()) return
  window.dispatchEvent(new CustomEvent(DASHBOARD_WIDGET_LAYOUT_EVENT))
}

const normalizeSize = (
  size: unknown,
  fallback: DashboardWidgetSize
): DashboardWidgetSize => (
  size === 'small' || size === 'medium' || size === 'large' ? size : fallback
)

const normalizeLayout = (
  layout: unknown,
  supportedLayouts: DashboardWidgetLayout[]
): DashboardWidgetLayout => {
  if((layout === 'compact' || layout === 'standard' || layout === 'wide') && supportedLayouts.includes(layout)){
    return layout
  }
  return supportedLayouts[0] || 'standard'
}

const normalizeInstances = (
  items: unknown,
  definitions: DashboardWidgetDefinition[],
  user?: User | null
): DashboardWidgetInstance[] => {
  if(!Array.isArray(items)) return []

  const definitionMap = new Map(definitions.map(definition => [definition.id, definition]))
  const workspaceKey = getWorkspaceKeyForUser(user)
  const seen = new Set<string>()

  return items.reduce<DashboardWidgetInstance[]>((instances, item) => {
    if(!item || typeof item !== 'object') return instances

    const candidate = item as Partial<DashboardWidgetInstance>
    const definition = candidate.widgetId ? definitionMap.get(candidate.widgetId) : undefined
    if(!definition || seen.has(definition.id)) return instances

    seen.add(definition.id)
    const now = new Date().toISOString()

    instances.push({
      id: String(candidate.id || createInstanceId(definition.id, workspaceKey)),
      widgetId: definition.id,
      order: Number.isFinite(candidate.order) ? Number(candidate.order) : definition.displayOrder,
      visible: candidate.visible !== false,
      size: normalizeSize(candidate.size, definition.defaultSize),
      layout: normalizeLayout(candidate.layout, definition.supportedLayouts),
      createdAt: String(candidate.createdAt || now),
      updatedAt: String(candidate.updatedAt || candidate.createdAt || now)
    })

    return instances
  }, [])
    .sort((first, second) => first.order - second.order)
}

const readInstances = (
  user: User | null | undefined,
  definitions: DashboardWidgetDefinition[]
) => {
  if(!isBrowser()) return []

  try {
    const parsed = JSON.parse(localStorage.getItem(getStorageKey(user)) || '[]')
    return normalizeInstances(parsed, definitions, user)
  } catch {
    return []
  }
}

const createTemplateWidgetId = (
  template: WorkspaceTemplateView,
  widget: WorkspaceTemplateWidget
) => (
  `workspace-template.${template.id}.${widget.id}`.replace(/[^a-z0-9_.-]/gi, '_')
)

const toTemplateDashboardWidgetDefinition = (
  template: WorkspaceTemplateView,
  widget: WorkspaceTemplateWidget
): DashboardWidgetDefinition => ({
  id: createTemplateWidgetId(template, widget),
  title: widget.title,
  description: widget.description,
  icon: widget.icon,
  category: widget.category,
  order: widget.order,
  defaultVisible: widget.defaultVisible,
  defaultSize: widget.defaultSize,
  supportedLayouts: widget.supportedLayouts,
  renderComponent: widget.renderComponent,
  moduleId: WORKSPACE_TEMPLATE_WIDGET_MODULE_ID,
  moduleCode: widget.moduleCode || template.id,
  moduleName: template.name,
  moduleIcon: template.dashboardTemplate.icon,
  moduleType: WORKSPACE_TEMPLATE_WIDGET_MODULE_TYPE,
  scope: 'BUSINESS',
  state: 'empty',
  source: 'template-provided',
  displayOrder: widget.order,
  emptyTitle: widget.emptyTitle,
  emptyDescription: widget.emptyDescription
})

const toProvisionedDashboardWidgetDefinition = (
  template: WorkspaceTemplateView,
  widget: ProvisionedDashboardWidget
): DashboardWidgetDefinition => ({
  id: widget.id,
  title: widget.title,
  description: widget.description,
  icon: widget.icon,
  category: widget.category,
  order: widget.order,
  defaultVisible: widget.defaultVisible,
  defaultSize: widget.defaultSize,
  supportedLayouts: widget.supportedLayouts,
  renderComponent: widget.renderComponent,
  moduleId: WORKSPACE_TEMPLATE_WIDGET_MODULE_ID,
  moduleCode: widget.moduleCode || template.id,
  moduleName: template.name,
  moduleIcon: template.dashboardTemplate.icon,
  moduleType: WORKSPACE_TEMPLATE_WIDGET_MODULE_TYPE,
  scope: 'BUSINESS',
  state: 'empty',
  source: 'template-provided',
  displayOrder: widget.order,
  emptyTitle: widget.emptyTitle,
  emptyDescription: widget.emptyDescription,
  provisionedAt: widget.provisionedAt
})

const getTemplateDashboardWidgetDefinitions = (
  template: WorkspaceTemplateView
): DashboardWidgetDefinition[] => (
  template.visibleWidgets
    .filter(widget => widget.defaultVisible)
    .map(widget => toTemplateDashboardWidgetDefinition(template, widget))
)

const mergeDefinitions = (definitions: DashboardWidgetDefinition[]): DashboardWidgetDefinition[] => {
  const definitionMap = new Map<string, DashboardWidgetDefinition>()

  definitions.forEach(definition => {
    if(definitionMap.has(definition.id)) return
    definitionMap.set(definition.id, definition)
  })

  return Array.from(definitionMap.values()).sort((first, second) => (
    first.displayOrder - second.displayOrder
    || first.title.localeCompare(second.title, 'tr')
  ))
}

const getDashboardWidgetDefinitionsForUser = (user?: User | null) => {
  const workspaceTemplate = getWorkspaceTemplateViewForUser(user)
  const provisionedState = getWorkspaceProvisionedStateForUser(user)
  const templateDefinitions = provisionedState?.dashboard.widgets.length
    ? provisionedState.dashboard.widgets.map(widget => toProvisionedDashboardWidgetDefinition(workspaceTemplate, widget))
    : getTemplateDashboardWidgetDefinitions(workspaceTemplate)
  const registryDefinitions = provisionedState ? [] : getDashboardWidgetRegistryForUser(user)

  return {
    workspaceTemplate,
    provisionedState,
    definitions: mergeDefinitions([
      ...templateDefinitions,
      ...registryDefinitions
    ])
  }
}

const createTemplateDefaultInstances = (
  user: User | null | undefined,
  definitions: DashboardWidgetDefinition[]
): DashboardWidgetInstance[] => {
  const workspaceKey = getWorkspaceKeyForUser(user)
  const now = new Date().toISOString()

  return definitions
    .filter(definition => definition.source === 'template-provided' && definition.defaultVisible)
    .sort((first, second) => first.displayOrder - second.displayOrder)
    .map(definition => ({
      id: createInstanceId(definition.id, workspaceKey),
      widgetId: definition.id,
      order: definition.displayOrder,
      visible: true,
      size: definition.defaultSize,
      layout: definition.supportedLayouts[0] || 'standard',
      createdAt: now,
      updatedAt: now
    }))
}

const getLatestInstanceUpdateTime = (instances: DashboardWidgetInstance[]) => (
  Math.max(0, ...instances.map(instance => new Date(instance.updatedAt || instance.createdAt).getTime()).filter(Number.isFinite))
)

const mergeNewProvisionedInstances = (
  user: User | null | undefined,
  savedInstances: DashboardWidgetInstance[],
  definitions: DashboardWidgetDefinition[]
) => {
  const workspaceKey = getWorkspaceKeyForUser(user)
  const existingWidgetIds = new Set(savedInstances.map(instance => instance.widgetId))
  const latestLayoutTime = getLatestInstanceUpdateTime(savedInstances)
  const now = new Date().toISOString()
  const newProvisionedInstances = definitions
    .filter(definition => {
      if(definition.source !== 'template-provided' || !definition.defaultVisible || !definition.provisionedAt) return false
      if(existingWidgetIds.has(definition.id)) return false
      return new Date(definition.provisionedAt).getTime() > latestLayoutTime
    })
    .map(definition => ({
      id: createInstanceId(definition.id, workspaceKey),
      widgetId: definition.id,
      order: definition.displayOrder,
      visible: true,
      size: definition.defaultSize,
      layout: definition.supportedLayouts[0] || 'standard',
      createdAt: now,
      updatedAt: now
    }))

  return newProvisionedInstances.length > 0
    ? [...savedInstances, ...newProvisionedInstances].sort((first, second) => first.order - second.order)
    : savedInstances
}

const readDashboardInstances = (
  user: User | null | undefined,
  definitions: DashboardWidgetDefinition[]
) => {
  const savedInstances = readInstances(user, definitions)
  return hasStoredLayout(user)
    ? mergeNewProvisionedInstances(user, savedInstances, definitions)
    : createTemplateDefaultInstances(user, definitions)
}

const saveInstances = (user: User | null | undefined, instances: DashboardWidgetInstance[]) => {
  if(!isBrowser()) return
  localStorage.setItem(getStorageKey(user), JSON.stringify(instances))
  dispatchLayoutEvent()
}

export const clearDashboardWidgetLayoutForUser = (user: User | null | undefined) => {
  if(!isBrowser()) return
  localStorage.removeItem(getStorageKey(user))
  dispatchLayoutEvent()
}

export const clearAllDashboardWidgetLayouts = () => {
  if(!isBrowser()) return
  Object.keys(localStorage)
    .filter(key => key.startsWith(`${STORAGE_KEY_PREFIX}_`))
    .forEach(key => localStorage.removeItem(key))
  dispatchLayoutEvent()
}

const groupWidgets = <TWidget extends { category?: string; definition?: DashboardWidgetDefinition }>(
  widgets: TWidget[]
): Array<DashboardWidgetGroup<TWidget>> => {
  const groupMap = new Map<string, TWidget[]>()

  widgets.forEach(widget => {
    const category = widget.definition?.category || widget.category || 'Kurulu Modüller'
    groupMap.set(category, [...(groupMap.get(category) || []), widget])
  })

  return Array.from(groupMap.entries()).map(([category, groupWidgets]) => ({
    category,
    widgets: groupWidgets
  }))
}

const toViewModels = (
  instances: DashboardWidgetInstance[],
  definitions: DashboardWidgetDefinition[]
): DashboardWidgetViewModel[] => {
  const definitionMap = new Map(definitions.map(definition => [definition.id, definition]))

  return instances
    .map(instance => {
      const definition = definitionMap.get(instance.widgetId)
      return definition ? { ...instance, definition } : null
    })
    .filter(Boolean) as DashboardWidgetViewModel[]
}

const toCatalogItems = (
  definitions: DashboardWidgetDefinition[],
  widgets: DashboardWidgetViewModel[]
): DashboardWidgetCatalogItem[] => {
  const widgetMap = new Map(widgets.map(widget => [widget.widgetId, widget]))

  return definitions.map(definition => {
    const widget = widgetMap.get(definition.id)
    return {
      ...definition,
      added: Boolean(widget),
      instanceId: widget?.id,
      visibleInDashboard: widget?.visible === true
    }
  })
}

export const createDashboardWidgetContainer = (user?: User | null): DashboardWidgetContainer => {
  const { workspaceTemplate, provisionedState, definitions: availableDefinitions } = getDashboardWidgetDefinitionsForUser(user)
  const instances = readDashboardInstances(user, availableDefinitions)
  const widgets = toViewModels(instances, availableDefinitions)
  const visibleWidgets = widgets.filter(widget => widget.visible)
  const hiddenWidgets = widgets.filter(widget => !widget.visible)
  const availableWidgets = toCatalogItems(availableDefinitions, widgets)

  return {
    id: 'business-workspace-dashboard',
    title: provisionedState?.dashboard.title || workspaceTemplate.dashboardTemplate.title,
    description: provisionedState?.dashboard.description || workspaceTemplate.dashboardTemplate.description,
    widgets,
    visibleWidgets,
    hiddenWidgets,
    groupedWidgets: groupWidgets(visibleWidgets),
    availableWidgets,
    catalogGroups: groupWidgets(availableWidgets),
    widgetSystemReady: true,
    isEmpty: visibleWidgets.length === 0,
    workspaceTemplate: {
      id: workspaceTemplate.id,
      sectorId: workspaceTemplate.sectorId,
      name: workspaceTemplate.name,
      description: workspaceTemplate.description,
      defaultRoute: workspaceTemplate.defaultRoute,
      defaultNavKey: workspaceTemplate.defaultNavKey
    },
    quickActions: workspaceTemplate.visibleQuickActions,
    emptyStates: provisionedState?.emptyStates.length
      ? provisionedState.emptyStates.map(emptyState => ({
        key: emptyState.key as typeof workspaceTemplate.emptyStates[number]['key'],
        title: emptyState.title,
        description: emptyState.description,
        icon: emptyState.icon
      }))
      : workspaceTemplate.emptyStates
  }
}

export const getDashboardWidgetContainer = (user?: User | null) => {
  return createDashboardWidgetContainer(user)
}

export const addDashboardWidget = (user: User | null | undefined, widgetId: string) => {
  const { definitions } = getDashboardWidgetDefinitionsForUser(user)
  const definition = definitions.find(item => item.id === widgetId)
  if(!definition) throw new Error('Widget kaydı bu çalışma alanı için kullanılabilir değil.')

  const instances = readDashboardInstances(user, definitions)
  const existingInstance = instances.find(instance => instance.widgetId === widgetId)
  const now = new Date().toISOString()

  const nextInstances = existingInstance
    ? instances.map(instance => instance.widgetId === widgetId
      ? { ...instance, visible: true, updatedAt: now }
      : instance
    )
    : [
      ...instances,
      {
        id: createInstanceId(widgetId, getWorkspaceKeyForUser(user)),
        widgetId,
        order: Math.max(0, ...instances.map(instance => instance.order)) + 10,
        visible: true,
        size: definition.defaultSize,
        layout: definition.supportedLayouts[0] || 'standard',
        createdAt: now,
        updatedAt: now
      }
    ]

  saveInstances(user, nextInstances)
  return createDashboardWidgetContainer(user)
}

export const removeDashboardWidget = (user: User | null | undefined, widgetOrInstanceId: string) => {
  const { definitions } = getDashboardWidgetDefinitionsForUser(user)
  const instances = readDashboardInstances(user, definitions)
  const now = new Date().toISOString()
  const nextInstances = instances.map(instance => (
    instance.id === widgetOrInstanceId || instance.widgetId === widgetOrInstanceId
      ? { ...instance, visible: false, updatedAt: now }
      : instance
  ))

  saveInstances(user, nextInstances)
  return createDashboardWidgetContainer(user)
}

export const setDashboardWidgetVisibility = (
  user: User | null | undefined,
  widgetOrInstanceId: string,
  visible: boolean
) => {
  const { definitions } = getDashboardWidgetDefinitionsForUser(user)
  const instances = readDashboardInstances(user, definitions)
  const now = new Date().toISOString()
  const nextInstances = instances.map(instance => (
    instance.id === widgetOrInstanceId || instance.widgetId === widgetOrInstanceId
      ? { ...instance, visible, updatedAt: now }
      : instance
  ))

  saveInstances(user, nextInstances)
  return createDashboardWidgetContainer(user)
}

export const toggleDashboardWidgetVisibility = (
  user: User | null | undefined,
  widgetOrInstanceId: string
) => {
  const { definitions } = getDashboardWidgetDefinitionsForUser(user)
  const instances = readDashboardInstances(user, definitions)
  const target = instances.find(instance => instance.id === widgetOrInstanceId || instance.widgetId === widgetOrInstanceId)
  return setDashboardWidgetVisibility(user, widgetOrInstanceId, !(target?.visible ?? true))
}
