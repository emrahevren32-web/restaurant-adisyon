import type { LicenseModuleKey } from '../types'
import type { BusinessWorkspaceModule } from '../modules/business-workspace.registry'

export const WORKSPACE_MODULE_LIFECYCLE_STATES = {
  AVAILABLE: 'AVAILABLE',
  INSTALLED: 'INSTALLED',
  CONFIGURED: 'CONFIGURED',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  UNINSTALLED: 'UNINSTALLED'
} as const

export type WorkspaceModuleLifecycleState =
  typeof WORKSPACE_MODULE_LIFECYCLE_STATES[keyof typeof WORKSPACE_MODULE_LIFECYCLE_STATES]

export type WorkspaceModuleLifecycleSource = 'marketplace-simulation'
export type WorkspaceModuleLicenseState = 'licensed' | 'unlicensed'

export type WorkspaceModuleLifecycleRecord = {
  id: string
  companyId: string
  moduleId: string
  moduleCode: string
  moduleName: string
  moduleType: BusinessWorkspaceModule['moduleType']
  licenseModuleKey?: LicenseModuleKey
  workspaceLicenseKey: string
  licenseState: WorkspaceModuleLicenseState
  lifecycleState: WorkspaceModuleLifecycleState
  installedAt: string
  configuredAt?: string
  activatedAt?: string
  suspendedAt?: string
  uninstalledAt?: string
  updatedAt: string
  installedByUserId: string
  updatedByUserId: string
  source: WorkspaceModuleLifecycleSource
}

export type WorkspaceModuleLifecycleAction =
  | 'install'
  | 'configure'
  | 'activate'
  | 'suspend'
  | 'reactivate'
  | 'manage'
  | 'detach-from-workspace'

export type WorkspaceModuleLifecycleActionVariant =
  | 'primary'
  | 'secondary'
  | 'warning'
  | 'danger'
  | 'disabled'

export type WorkspaceModuleLifecycleActionState =
  | WorkspaceModuleLifecycleState
  | 'DISABLED'
  | 'COMING_SOON'

export type WorkspaceModuleLifecycleActionDefinition = {
  key: WorkspaceModuleLifecycleAction
  label: string
  variant: WorkspaceModuleLifecycleActionVariant
  visibleInStates: WorkspaceModuleLifecycleActionState[]
  disabled?: boolean
  displayOrder: number
}

export type WorkspaceModuleLifecycleResult = {
  module: BusinessWorkspaceModule
  record: WorkspaceModuleLifecycleRecord
  activeModules: BusinessWorkspaceModule[]
  managedModules: BusinessWorkspaceModule[]
  previousState: WorkspaceModuleLifecycleState
  nextState: WorkspaceModuleLifecycleState
  action: WorkspaceModuleLifecycleAction
  isFirstInstall: boolean
  alreadyInstalled: boolean
}
