import { getCompanyIdForUser } from '../storage'
import type { User } from '../types'
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

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const getWorkspaceKeyForUser = (user?: User | null) => {
  const companyId = getCompanyIdForUser(user)
  return companyId || user?.tenantId || user?.id || 'workspace'
}

const getStorageKey = (user?: User | null) => (
  `${STORAGE_KEY_PREFIX}_${getWorkspaceKeyForUser(user)}`
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

const saveInstances = (user: User | null | undefined, instances: DashboardWidgetInstance[]) => {
  if(!isBrowser()) return
  localStorage.setItem(getStorageKey(user), JSON.stringify(instances))
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
  const availableDefinitions = getDashboardWidgetRegistryForUser(user)
  const instances = readInstances(user, availableDefinitions)
  const widgets = toViewModels(instances, availableDefinitions)
  const visibleWidgets = widgets.filter(widget => widget.visible)
  const hiddenWidgets = widgets.filter(widget => !widget.visible)
  const availableWidgets = toCatalogItems(availableDefinitions, widgets)

  return {
    id: 'business-workspace-dashboard',
    title: 'Dashboard',
    description: "Henüz Dashboard'unuzu oluşturmadınız. Widget ekleyerek çalışma alanınızı kişiselleştirebilirsiniz.",
    widgets,
    visibleWidgets,
    hiddenWidgets,
    groupedWidgets: groupWidgets(visibleWidgets),
    availableWidgets,
    catalogGroups: groupWidgets(availableWidgets),
    widgetSystemReady: true,
    isEmpty: visibleWidgets.length === 0
  }
}

export const getDashboardWidgetContainer = (user?: User | null) => {
  return createDashboardWidgetContainer(user)
}

export const addDashboardWidget = (user: User | null | undefined, widgetId: string) => {
  const definitions = getDashboardWidgetRegistryForUser(user)
  const definition = definitions.find(item => item.id === widgetId)
  if(!definition) throw new Error('Widget kaydı bu Workspace için kullanılabilir değil.')

  const instances = readInstances(user, definitions)
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
  const definitions = getDashboardWidgetRegistryForUser(user)
  const instances = readInstances(user, definitions)
  const nextInstances = instances.filter(instance => (
    instance.id !== widgetOrInstanceId && instance.widgetId !== widgetOrInstanceId
  ))

  saveInstances(user, nextInstances)
  return createDashboardWidgetContainer(user)
}

export const setDashboardWidgetVisibility = (
  user: User | null | undefined,
  widgetOrInstanceId: string,
  visible: boolean
) => {
  const definitions = getDashboardWidgetRegistryForUser(user)
  const instances = readInstances(user, definitions)
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
  const definitions = getDashboardWidgetRegistryForUser(user)
  const instances = readInstances(user, definitions)
  const target = instances.find(instance => instance.id === widgetOrInstanceId || instance.widgetId === widgetOrInstanceId)
  return setDashboardWidgetVisibility(user, widgetOrInstanceId, !(target?.visible ?? true))
}
