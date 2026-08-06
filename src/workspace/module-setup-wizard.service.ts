import { getCompanyIdForUser } from '../storage'
import type { User } from '../types'
import type { BusinessWorkspaceModule } from '../modules/business-workspace.registry'
import type { WorkspaceModuleInstallResult } from './workspace-module-installation.service'
import { getModuleSetupWizardDefinition } from './module-setup-wizard.registry'
import type { ModuleSetupWizardSession } from './module-setup-wizard.types'
import { recordWorkspaceAuditEvent } from './workspace-audit.service'
import { WorkspaceIndexedStorageService } from './workspace-indexed-storage.service'
import {
  configureWorkspaceModuleForUser,
  type WorkspaceModuleLifecycleResult
} from './workspace-module-lifecycle.service'

const STORAGE_KEY = 'miyop_workspace_module_setup_sessions'
export const WORKSPACE_MODULE_SETUP_EVENT = 'miyop-workspace-module-setup-updated'

const readSessions = (): ModuleSetupWizardSession[] => {
  const sessions = WorkspaceIndexedStorageService.get<ModuleSetupWizardSession[]>(
    STORAGE_KEY,
    [],
    [WORKSPACE_MODULE_SETUP_EVENT]
  )
  return Array.isArray(sessions) ? sessions : []
}

const saveSessions = (sessions: ModuleSetupWizardSession[]) => {
  WorkspaceIndexedStorageService.set(STORAGE_KEY, sessions, [WORKSPACE_MODULE_SETUP_EVENT])
}

const createSetupSessionId = (companyId: string, moduleId: string, startedAt: string) => {
  const companyPart = companyId.replace(/[^a-z0-9]/gi, '').slice(-8) || 'workspace'
  const timePart = new Date(startedAt).getTime().toString(36)
  return `module_setup_${companyPart}_${moduleId}_${timePart}`
}

export const startModuleSetupWizardForModule = (
  user: User,
  module: BusinessWorkspaceModule
): ModuleSetupWizardSession => {
  const companyId = getCompanyIdForUser(user)
  if(!companyId) throw new Error('Modül başlangıç sihirbazı için çalışma alanı bulunamadı.')

  const startedAt = new Date().toISOString()
  const session: ModuleSetupWizardSession = {
    id: createSetupSessionId(companyId, module.id, startedAt),
    companyId,
    module,
    definition: getModuleSetupWizardDefinition(module),
    status: 'active',
    startedAt,
    startedByUserId: user.id
  }

  saveSessions([session, ...readSessions().filter(item => item.id !== session.id)])
  recordWorkspaceAuditEvent({
    user,
    eventType: 'MODULE_SETUP_STARTED',
    title: `${module.name} başlangıç sihirbazı açıldı.`,
    description: `${module.name} modülü için kurulum sonrası başlangıç sihirbazı başlatıldı.`,
    moduleId: module.id,
    moduleCode: module.code,
    moduleName: module.name
  })

  return session
}

export const startModuleSetupWizardForInstallResult = (
  user: User,
  result: WorkspaceModuleInstallResult
): ModuleSetupWizardSession => startModuleSetupWizardForModule(user, result.module)

export type ModuleSetupWizardCompletion = {
  session: ModuleSetupWizardSession
  lifecycleResult: WorkspaceModuleLifecycleResult
}

export const completeModuleSetupWizardSession = (
  user: User,
  session: ModuleSetupWizardSession
): ModuleSetupWizardCompletion => {
  const completedAt = new Date().toISOString()
  const completedSession: ModuleSetupWizardSession = {
    ...session,
    status: 'completed',
    completedAt
  }

  saveSessions([
    completedSession,
    ...readSessions().filter(item => item.id !== session.id)
  ])
  recordWorkspaceAuditEvent({
    user,
    eventType: 'MODULE_SETUP_COMPLETED',
    title: `${session.module.name} başlangıç sihirbazı tamamlandı.`,
    description: `${session.module.name} modülü için kurulum sonrası başlangıç sihirbazı tamamlandı.`,
    moduleId: session.module.id,
    moduleCode: session.module.code,
    moduleName: session.module.name
  })

  const lifecycleResult = configureWorkspaceModuleForUser(user, session.module.id)

  return {
    session: completedSession,
    lifecycleResult
  }
}
