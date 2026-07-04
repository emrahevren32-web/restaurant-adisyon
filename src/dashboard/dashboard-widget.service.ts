import type { User } from '../types'
import { getDashboardWidgetRegistryForUser } from './dashboard-widget.registry'
import type { DashboardWidgetContainer } from './dashboard-widget.types'

export const createDashboardWidgetContainer = (user?: User | null): DashboardWidgetContainer => {
  const availableWidgets = getDashboardWidgetRegistryForUser(user)

  return {
    id: 'business-workspace-dashboard',
    title: 'Dashboard',
    description: "Henüz Dashboard widget'ı eklenmedi. Kurduğunuz modüller burada kullanışlı özetler sunabilecek.",
    widgets: [],
    availableWidgets,
    widgetSystemReady: true
  }
}

export const getDashboardWidgetContainer = (user?: User | null) => {
  return createDashboardWidgetContainer(user)
}
