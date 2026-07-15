import type { PermissionName } from '../authorization/permission.types'
import type {
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'
import type { ModuleCode } from '../modules/module-code.registry'
import type { ModuleInstallationPlan } from '../modules/module-dependency.types'
import type { ModuleRecommendationPlan } from '../modules/module-recommendation.types'
import type {
  ProvisionManifest,
  ProvisionManifestEmptyState,
  ProvisionManifestMenuItem,
  ProvisionManifestRole,
  ProvisionManifestSetting
} from './provision-manifest.types'

export const WORKSPACE_PROVISIONING_OPERATIONS = {
  INITIAL_SETUP: 'initial-setup',
  MODULE_INSTALL: 'module-install',
  MODULE_UNINSTALL: 'module-uninstall',
  MODULE_SUSPEND: 'module-suspend',
  RECONFIGURE: 'reconfigure'
} as const

export const WORKSPACE_PROVISION_STEP_TYPES = {
  WORKSPACE: 'workspace',
  MODULE: 'module',
  DASHBOARD: 'dashboard',
  MENU: 'menu',
  WIDGET: 'widget',
  ROLE: 'role',
  PERMISSION: 'permission',
  SETTING: 'setting',
  EMPTY_STATE: 'empty-state'
} as const

export const WORKSPACE_PROVISION_STEP_STATUSES = {
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  SKIPPED: 'skipped'
} as const

export type WorkspaceProvisioningOperation =
  typeof WORKSPACE_PROVISIONING_OPERATIONS[keyof typeof WORKSPACE_PROVISIONING_OPERATIONS]

export type WorkspaceProvisionStepType =
  typeof WORKSPACE_PROVISION_STEP_TYPES[keyof typeof WORKSPACE_PROVISION_STEP_TYPES]

export type WorkspaceProvisionStepStatus =
  typeof WORKSPACE_PROVISION_STEP_STATUSES[keyof typeof WORKSPACE_PROVISION_STEP_STATUSES]

export type WorkspaceProvisionTargetModule = {
  moduleId: string
  moduleCode: ModuleCode | string
  moduleName: string
  moduleIcon: string
  manifest: ProvisionManifest
  order: number
}

export type WorkspaceProvisionPlanStep = {
  id: string
  key: string
  type: WorkspaceProvisionStepType
  title: string
  description: string
  order: number
  moduleCode?: string
  status: WorkspaceProvisionStepStatus
  payload?: unknown
}

export type WorkspaceProvisionPlan = {
  id: string
  companyId: string
  tenantId: string
  workspaceId: string
  sectorId: string
  operation: WorkspaceProvisioningOperation
  templateId: string
  templateName: string
  recommendationPlan?: ModuleRecommendationPlan
  installationPlan?: ModuleInstallationPlan
  targetModules: WorkspaceProvisionTargetModule[]
  futureModules: string[]
  unsupportedModules: string[]
  steps: WorkspaceProvisionPlanStep[]
  createdAt: string
  createdByUserId: string
}

export type ProvisionedWorkspaceModule = {
  moduleId: string
  moduleCode: string
  moduleName: string
  manifestVersion: string
  provisionedAt: string
  updatedAt: string
}

export type ProvisionedDashboardWidget = {
  id: string
  widgetId: string
  title: string
  description: string
  icon: string
  category: string
  order: number
  defaultVisible: boolean
  defaultSize: 'small' | 'medium' | 'large'
  supportedLayouts: Array<'compact' | 'standard' | 'wide'>
  renderComponent: string
  emptyTitle: string
  emptyDescription: string
  moduleCode?: string
  source: 'workspace-template' | 'module-manifest'
  provisionedAt: string
}

export type ProvisionedDashboard = {
  templateId: string
  title: string
  description: string
  icon: string
  defaultRoute: BusinessWorkspaceRoute
  defaultNavKey: BusinessWorkspaceNavKey
  widgets: ProvisionedDashboardWidget[]
}

export type ProvisionedMenuItem = ProvisionManifestMenuItem & {
  id: string
  moduleCode?: string
  provisionedAt: string
}

export type ProvisionedRole = ProvisionManifestRole & {
  provisionedAt: string
}

export type ProvisionedPermission = {
  name: PermissionName
  moduleCode?: string
  provisionedAt: string
}

export type ProvisionedSetting = ProvisionManifestSetting & {
  provisionedAt: string
}

export type ProvisionedEmptyState = ProvisionManifestEmptyState & {
  provisionedAt: string
}

export type WorkspaceProvisionedState = {
  companyId: string
  tenantId: string
  workspaceId: string
  sectorId: string
  templateId: string
  templateName: string
  dashboard: ProvisionedDashboard
  provisionedModules: ProvisionedWorkspaceModule[]
  menuItems: ProvisionedMenuItem[]
  roles: ProvisionedRole[]
  permissions: ProvisionedPermission[]
  settings: ProvisionedSetting[]
  emptyStates: ProvisionedEmptyState[]
  futureModules: string[]
  unsupportedModules: string[]
  createdAt: string
  updatedAt: string
}

export type WorkspaceProvisionJournalStep = WorkspaceProvisionPlanStep & {
  status: WorkspaceProvisionStepStatus
  message: string
  completedAt: string
}

export type WorkspaceProvisionJournalEntry = {
  id: string
  planId: string
  companyId: string
  operation: WorkspaceProvisioningOperation
  status: WorkspaceProvisionStepStatus
  startedAt: string
  completedAt: string
  createdByUserId: string
  steps: WorkspaceProvisionJournalStep[]
}

export type WorkspaceProvisionExecutionResult = {
  plan: WorkspaceProvisionPlan
  state: WorkspaceProvisionedState
  journalEntry: WorkspaceProvisionJournalEntry
}
