import type { LicenseModuleKey, User } from '../types'
import type { BusinessWorkspaceModule } from '../modules/business-workspace.registry'
import {
  getActiveWorkspaceModules,
  getActiveWorkspaceModulesForUser,
  getManagedWorkspaceModules,
  getManagedWorkspaceModulesForUser,
  getWorkspaceModuleLifecycleRecords,
  hasManagedWorkspaceModulesForUser,
  installWorkspaceModuleForUser,
  isWorkspaceLicenseModuleActiveForUser,
  isWorkspaceModuleActive,
  isWorkspaceModuleActiveForUser
} from './workspace-module-lifecycle.service'
import type {
  WorkspaceModuleLifecycleRecord,
  WorkspaceModuleLifecycleResult,
  WorkspaceModuleLicenseState
} from './workspace-module-lifecycle.types'
import { WORKSPACE_MODULE_INSTALLATION_EVENT } from './workspace-module-lifecycle.service'

export type WorkspaceModuleInstallSource = 'marketplace-simulation'
export type { WorkspaceModuleLicenseState }
export type WorkspaceModuleInstallation = WorkspaceModuleLifecycleRecord
export type WorkspaceModuleInstallResult = WorkspaceModuleLifecycleResult
export { WORKSPACE_MODULE_INSTALLATION_EVENT }

export const getWorkspaceModuleInstallations = (companyId: string) => {
  return getWorkspaceModuleLifecycleRecords(companyId)
}

export const getInstalledWorkspaceModules = (companyId: string) => {
  return getActiveWorkspaceModules(companyId)
}

export const getInstalledWorkspaceModulesForUser = (user: User | null | undefined) => {
  return getActiveWorkspaceModulesForUser(user)
}

export const hasInstalledWorkspaceModulesForUser = (user: User | null | undefined) => {
  return hasManagedWorkspaceModulesForUser(user)
}

export const getManagedWorkspaceInstallationsForUser = (user: User | null | undefined) => {
  return getManagedWorkspaceModulesForUser(user)
}

export const isWorkspaceModuleInstalled = (
  companyId: string,
  module: BusinessWorkspaceModule
) => {
  return isWorkspaceModuleActive(companyId, module)
}

export const isWorkspaceModuleInstalledForUser = (
  user: User | null | undefined,
  module: BusinessWorkspaceModule
) => {
  return isWorkspaceModuleActiveForUser(user, module)
}

export const isWorkspaceLicenseModuleInstalledForUser = (
  user: User | null | undefined,
  moduleKey: LicenseModuleKey
) => {
  return isWorkspaceLicenseModuleActiveForUser(user, moduleKey)
}

export { installWorkspaceModuleForUser }
