import type {
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'
import type { DashboardWidgetLayout } from '../dashboard/dashboard-widget.types'
import type { SectorTemplateAssignableModuleCode } from '../modules/module-code.registry'

export const SECTOR_MANAGEMENT_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PASSIVE: 'passive'
} as const

export type SectorManagementStatus =
  typeof SECTOR_MANAGEMENT_STATUSES[keyof typeof SECTOR_MANAGEMENT_STATUSES]

export type SectorManagementTemplateType =
  | 'dashboard'
  | 'workspace'
  | 'widget'
  | 'menu'
  | 'theme'
  | 'installation'

export type SectorManagementTemplateOption = {
  id: string
  type: SectorManagementTemplateType
  name: string
  description: string
}

export type SectorManagementModuleOption = {
  code: SectorTemplateAssignableModuleCode
  name: string
  description: string
  icon: string
  registered: boolean
}

export type SectorManagementTemplateSelection = {
  dashboardTemplateId: string
  workspaceTemplateId: string
  widgetTemplateId: string
  menuTemplateId: string
  themeTemplateId: string
  installationWizardId: string
}

export type SectorManagementModuleSelection = {
  defaultModuleCodes: SectorTemplateAssignableModuleCode[]
  optionalModuleCodes: SectorTemplateAssignableModuleCode[]
}

export type SectorManagementDashboardConfig = {
  defaultWidgetIds: string[]
  widgetOrder: string[]
  widgetGroups: string[]
  defaultLayout: DashboardWidgetLayout
}

export type SectorManagementWorkspaceConfig = {
  defaultMenuId: string
  defaultLandingPage: BusinessWorkspaceRoute
  pinnedScreens: BusinessWorkspaceNavKey[]
  quickActionIds: string[]
}

export type SectorManagementThemeConfig = {
  primary: string
  secondary: string
  success: string
  warning: string
  danger: string
  background: string
  logo: string
  loginBackground: string
}

export type SectorManagementInstallationConfig = {
  welcomeScreen: string
  businessInfoStep: string
  recommendationStep: string
  optionalModulesStep: string
  summaryStep: string
  onboardingFlow: string
}

export type SectorManagementMetadata = {
  createdBy: string
  createdAt: string
  updatedBy: string
  updatedAt: string
  internalNotes: string
}

export type SectorManagementSector = {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  primaryColor: string
  secondaryColor: string
  status: SectorManagementStatus
  version: string
  visible: boolean
  ordering: number
  templates: SectorManagementTemplateSelection
  modules: SectorManagementModuleSelection
  dashboard: SectorManagementDashboardConfig
  workspace: SectorManagementWorkspaceConfig
  theme: SectorManagementThemeConfig
  installation: SectorManagementInstallationConfig
  metadata: SectorManagementMetadata
}

export type SectorManagementCatalogs = {
  dashboardTemplates: SectorManagementTemplateOption[]
  workspaceTemplates: SectorManagementTemplateOption[]
  widgetTemplates: SectorManagementTemplateOption[]
  menuTemplates: SectorManagementTemplateOption[]
  themeTemplates: SectorManagementTemplateOption[]
  installationWizards: SectorManagementTemplateOption[]
  moduleOptions: SectorManagementModuleOption[]
  widgetOptions: SectorManagementTemplateOption[]
  menuOptions: SectorManagementTemplateOption[]
  quickActionOptions: SectorManagementTemplateOption[]
  installationStepOptions: SectorManagementTemplateOption[]
}
