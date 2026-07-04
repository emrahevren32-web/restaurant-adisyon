import type { LicenseModuleKey } from '../types'

export type DashboardWidgetSize = 'small' | 'medium' | 'large'

export type DashboardWidgetState = 'available' | 'empty' | 'disabled'
export type DashboardWidgetSource = 'module-provided'

export type DashboardWidgetRegistryItem = {
  id: string
  moduleId: string
  moduleCode: string
  moduleName: string
  moduleIcon: string
  title: string
  description: string
  moduleKey?: LicenseModuleKey
  size: DashboardWidgetSize
  state: DashboardWidgetState
  source: DashboardWidgetSource
  renderKey: string
  displayOrder: number
}

export type DashboardWidgetDefinition = {
  id: string
  moduleId: string
  moduleCode: string
  moduleName: string
  moduleIcon: string
  title: string
  description: string
  moduleKey?: LicenseModuleKey
  size: DashboardWidgetSize
  state: DashboardWidgetState
  source: DashboardWidgetSource
  renderKey: string
  displayOrder: number
}

export type DashboardWidgetContainer = {
  id: string
  title: string
  description: string
  widgets: DashboardWidgetDefinition[]
  availableWidgets: DashboardWidgetDefinition[]
  widgetSystemReady: boolean
}
