import { getCompanyIdForUser, loadCompanies } from '../storage'
import type { LicenseModuleKey, User } from '../types'
import {
  BUSINESS_WORKSPACE_MODULE_REGISTRY,
  getBusinessWorkspaceModuleById,
  getBusinessWorkspaceModuleByLicenseKey,
  isBusinessWorkspaceModuleAvailableForSector
} from '../modules/business-workspace.registry'
import type { BusinessWorkspaceModule } from '../modules/business-workspace.registry'
import { WORKSPACE_MODULE_TYPES } from '../modules/module-registry.types'
import { getModuleDependencyRule } from '../modules/module-dependency.registry'
import type { ModuleCode } from '../modules/module-code.registry'
import { recordWorkspaceAuditEvent } from './workspace-audit.service'
import {
  WORKSPACE_MODULE_LIFECYCLE_STATES,
  type WorkspaceModuleLifecycleAction,
  type WorkspaceModuleLifecycleActionDefinition,
  type WorkspaceModuleLifecycleActionState,
  type WorkspaceModuleLifecycleRecord,
  type WorkspaceModuleLifecycleResult,
  type WorkspaceModuleLifecycleState
} from './workspace-module-lifecycle.types'

export type {
  WorkspaceModuleLifecycleAction,
  WorkspaceModuleLifecycleActionDefinition,
  WorkspaceModuleLifecycleActionState,
  WorkspaceModuleLifecycleRecord,
  WorkspaceModuleLifecycleResult,
  WorkspaceModuleLifecycleState,
  WorkspaceModuleLicenseState
} from './workspace-module-lifecycle.types'
export { WORKSPACE_MODULE_LIFECYCLE_STATES } from './workspace-module-lifecycle.types'

const STORAGE_KEY = 'miyop_workspace_module_installations'
export const WORKSPACE_MODULE_LIFECYCLE_EVENT = 'miyop-workspace-module-lifecycle-updated'
export const WORKSPACE_MODULE_INSTALLATION_EVENT = 'miyop-workspace-module-installations-updated'

const WORKSPACE_MODULE_LIFECYCLE_ACTION_REGISTRY: WorkspaceModuleLifecycleActionDefinition[] = [
  {
    key: 'install',
    label: 'Kur',
    variant: 'primary',
    visibleInStates: [WORKSPACE_MODULE_LIFECYCLE_STATES.AVAILABLE, WORKSPACE_MODULE_LIFECYCLE_STATES.UNINSTALLED],
    displayOrder: 10
  },
  {
    key: 'configure',
    label: 'Yapılandır',
    variant: 'primary',
    visibleInStates: [WORKSPACE_MODULE_LIFECYCLE_STATES.INSTALLED],
    displayOrder: 20
  },
  {
    key: 'activate',
    label: 'Aktifleştir',
    variant: 'primary',
    visibleInStates: [WORKSPACE_MODULE_LIFECYCLE_STATES.CONFIGURED],
    displayOrder: 30
  },
  {
    key: 'suspend',
    label: 'Pasife Al',
    variant: 'warning',
    visibleInStates: [WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE],
    displayOrder: 40
  },
  {
    key: 'reactivate',
    label: 'Yeniden Aktifleştir',
    variant: 'primary',
    visibleInStates: [WORKSPACE_MODULE_LIFECYCLE_STATES.SUSPENDED],
    displayOrder: 50
  },
  {
    key: 'detach-from-workspace',
    label: "Workspace'ten Kaldır",
    variant: 'danger',
    visibleInStates: [
      WORKSPACE_MODULE_LIFECYCLE_STATES.INSTALLED,
      WORKSPACE_MODULE_LIFECYCLE_STATES.CONFIGURED,
      WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE,
      WORKSPACE_MODULE_LIFECYCLE_STATES.SUSPENDED
    ],
    displayOrder: 60
  },
  {
    key: 'install',
    label: 'Yakında',
    variant: 'disabled',
    visibleInStates: ['COMING_SOON'],
    disabled: true,
    displayOrder: 70
  },
  {
    key: 'install',
    label: 'Desteklenmiyor',
    variant: 'disabled',
    visibleInStates: ['DISABLED'],
    disabled: true,
    displayOrder: 80
  }
]

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const isLifecycleState = (value: unknown): value is WorkspaceModuleLifecycleState => {
  return Object.values(WORKSPACE_MODULE_LIFECYCLE_STATES).includes(value as WorkspaceModuleLifecycleState)
}

export const getWorkspaceModuleLifecycleActions = (
  state: WorkspaceModuleLifecycleActionState
) => {
  return WORKSPACE_MODULE_LIFECYCLE_ACTION_REGISTRY
    .filter(action => action.visibleInStates.includes(state))
    .sort((first, second) => first.displayOrder - second.displayOrder)
}

const createWorkspaceLicenseKey = (companyId: string, module: BusinessWorkspaceModule, seed = Date.now()) => {
  const companyPart = (companyId || 'workspace').replace(/[^a-z0-9]/gi, '').slice(-6).toLocaleUpperCase('tr-TR') || 'WS'
  const modulePart = module.code.replace(/[^a-z0-9]/gi, '').slice(0, 6).toLocaleUpperCase('tr-TR') || 'MODULE'
  const seedPart = Math.abs(Math.round(seed)).toString(36).toLocaleUpperCase('tr-TR').slice(-6).padStart(6, '0')
  return `WSL-${companyPart}-${modulePart}-${seedPart}`
}

const isLifecycleManagedState = (state: WorkspaceModuleLifecycleState) => {
  return state !== WORKSPACE_MODULE_LIFECYCLE_STATES.AVAILABLE
    && state !== WORKSPACE_MODULE_LIFECYCLE_STATES.UNINSTALLED
}

const isLifecycleActiveState = (state: WorkspaceModuleLifecycleState) => {
  return state === WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE
}

const resolveRecordState = (item: Partial<WorkspaceModuleLifecycleRecord>) => {
  if(isLifecycleState(item.lifecycleState)) return item.lifecycleState
  return WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE
}

const normalizeLifecycleRecord = (
  item: Partial<WorkspaceModuleLifecycleRecord>
): WorkspaceModuleLifecycleRecord | null => {
  const module = item.moduleId ? getBusinessWorkspaceModuleById(String(item.moduleId)) : undefined
  if(!module) return null

  const companyId = String(item.companyId || '').trim()
  if(!companyId) return null

  const installedAt = String(item.installedAt || item.updatedAt || new Date().toISOString())
  const lifecycleState = resolveRecordState(item)
  const updatedAt = String(item.updatedAt || installedAt)

  return {
    id: String(item.id || `workspace_module_lifecycle_${companyId}_${module.id}`),
    companyId,
    moduleId: module.id,
    moduleCode: module.code,
    moduleName: module.name,
    moduleType: module.moduleType,
    licenseModuleKey: module.licenseModuleKey,
    workspaceLicenseKey: String(item.workspaceLicenseKey || createWorkspaceLicenseKey(companyId, module, new Date(installedAt).getTime())),
    licenseState: lifecycleState === WORKSPACE_MODULE_LIFECYCLE_STATES.UNINSTALLED ? 'unlicensed' : 'licensed',
    lifecycleState,
    installedAt,
    configuredAt: item.configuredAt,
    activatedAt: item.activatedAt || (lifecycleState === WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE ? updatedAt : undefined),
    suspendedAt: item.suspendedAt,
    uninstalledAt: item.uninstalledAt,
    updatedAt,
    installedByUserId: String(item.installedByUserId || item.updatedByUserId || ''),
    updatedByUserId: String(item.updatedByUserId || item.installedByUserId || ''),
    source: 'marketplace-simulation'
  }
}

const readLifecycleRecords = (): WorkspaceModuleLifecycleRecord[] => {
  if(!isBrowser()) return []

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed)
      ? parsed.map(normalizeLifecycleRecord).filter(Boolean) as WorkspaceModuleLifecycleRecord[]
      : []
  } catch {
    return []
  }
}

const saveLifecycleRecords = (records: WorkspaceModuleLifecycleRecord[]) => {
  if(!isBrowser()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records.map(normalizeLifecycleRecord).filter(Boolean)))
  window.dispatchEvent(new CustomEvent(WORKSPACE_MODULE_LIFECYCLE_EVENT))
  window.dispatchEvent(new CustomEvent(WORKSPACE_MODULE_INSTALLATION_EVENT))
}

const isInstallableMarketplaceModule = (module: BusinessWorkspaceModule) => {
  return (
    module.isMarketplaceEligible
    && module.isEnabled
    && module.isVisible
    && module.marketplace?.isMarketplaceReady !== false
    && (
      module.moduleType === WORKSPACE_MODULE_TYPES.BUSINESS
      || module.moduleType === WORKSPACE_MODULE_TYPES.INTEGRATION
    )
  )
}

const getLifecycleRecord = (companyId: string, moduleId: string) => {
  if(!companyId) return null
  return readLifecycleRecords().find(item => item.companyId === companyId && item.moduleId === moduleId) || null
}

const createLifecycleRecord = (
  user: User,
  companyId: string,
  module: BusinessWorkspaceModule,
  now: string
) => normalizeLifecycleRecord({
  id: `workspace_module_lifecycle_${companyId}_${module.id}`,
  companyId,
  moduleId: module.id,
  lifecycleState: WORKSPACE_MODULE_LIFECYCLE_STATES.INSTALLED,
  installedAt: now,
  updatedAt: now,
  installedByUserId: user.id,
  updatedByUserId: user.id,
  workspaceLicenseKey: createWorkspaceLicenseKey(companyId, module, new Date(now).getTime())
}) as WorkspaceModuleLifecycleRecord

const updateLifecycleRecord = (
  record: WorkspaceModuleLifecycleRecord,
  user: User,
  nextState: WorkspaceModuleLifecycleState
): WorkspaceModuleLifecycleRecord => {
  const now = new Date().toISOString()
  const timestamps: Partial<WorkspaceModuleLifecycleRecord> = {}

  if(nextState === WORKSPACE_MODULE_LIFECYCLE_STATES.CONFIGURED) timestamps.configuredAt = now
  if(nextState === WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE) timestamps.activatedAt = now
  if(nextState === WORKSPACE_MODULE_LIFECYCLE_STATES.SUSPENDED) timestamps.suspendedAt = now
  if(nextState === WORKSPACE_MODULE_LIFECYCLE_STATES.UNINSTALLED) timestamps.uninstalledAt = now

  return normalizeLifecycleRecord({
    ...record,
    ...timestamps,
    lifecycleState: nextState,
    licenseState: nextState === WORKSPACE_MODULE_LIFECYCLE_STATES.UNINSTALLED ? 'unlicensed' : 'licensed',
    updatedAt: now,
    updatedByUserId: user.id
  }) as WorkspaceModuleLifecycleRecord
}

const saveRecord = (record: WorkspaceModuleLifecycleRecord) => {
  const others = readLifecycleRecords().filter(item => !(item.companyId === record.companyId && item.moduleId === record.moduleId))
  saveLifecycleRecords([record, ...others])
}

const getModulesByState = (
  companyId: string,
  predicate: (state: WorkspaceModuleLifecycleState) => boolean
) => {
  const recordMap = new Map(
    readLifecycleRecords()
      .filter(item => item.companyId === companyId && predicate(item.lifecycleState))
      .map(item => [item.moduleId, item])
  )

  return BUSINESS_WORKSPACE_MODULE_REGISTRY
    .filter(module => recordMap.has(module.id))
    .filter(module => module.moduleType === WORKSPACE_MODULE_TYPES.BUSINESS || module.moduleType === WORKSPACE_MODULE_TYPES.INTEGRATION)
    .sort((first, second) => first.displayOrder - second.displayOrder)
}

const createResult = (
  user: User,
  module: BusinessWorkspaceModule,
  record: WorkspaceModuleLifecycleRecord,
  previousState: WorkspaceModuleLifecycleState,
  action: WorkspaceModuleLifecycleAction,
  isFirstInstall = false,
  alreadyInstalled = false
): WorkspaceModuleLifecycleResult => ({
  module,
  record,
  activeModules: getActiveWorkspaceModules(record.companyId),
  managedModules: getManagedWorkspaceModules(record.companyId),
  previousState,
  nextState: record.lifecycleState,
  action,
  isFirstInstall,
  alreadyInstalled
})

const assertCompanyId = (user: User) => {
  const companyId = getCompanyIdForUser(user)
  if(!companyId) throw new Error('Modül yaşam döngüsü için Business Workspace bulunamadı.')
  return companyId
}

const assertModule = (moduleId: string) => {
  const module = getBusinessWorkspaceModuleById(moduleId)
  if(!module) throw new Error('Modül kaydı bulunamadı.')
  if(!isInstallableMarketplaceModule(module)) throw new Error('Bu modül şu anda Workspace yaşam döngüsüne uygun değil.')
  return module
}

const assertModuleAvailableForCompanySector = (companyId: string, module: BusinessWorkspaceModule) => {
  const sectorId = loadCompanies({ allTenants: true }).find(company => company.id === companyId)?.primarySectorId || ''
  if(isBusinessWorkspaceModuleAvailableForSector(module, sectorId)) return

  throw new Error('Bu modül yalnızca Endüstriyel Mutfak sektöründeki çalışma alanlarında kullanılabilir.')
}

const assertExistingRecord = (
  user: User,
  moduleId: string
) => {
  const companyId = assertCompanyId(user)
  const module = assertModule(moduleId)
  const record = getLifecycleRecord(companyId, module.id)
  if(!record || record.lifecycleState === WORKSPACE_MODULE_LIFECYCLE_STATES.UNINSTALLED){
    throw new Error('Bu modül Business Workspace içinde kurulu değil.')
  }
  return { companyId, module, record }
}

const assertModuleCanBeDetached = (
  companyId: string,
  module: BusinessWorkspaceModule
) => {
  const dependentModules = getActiveWorkspaceModules(companyId)
    .filter(activeModule => activeModule.id !== module.id)
    .filter(activeModule => {
      const rule = getModuleDependencyRule(activeModule.code as ModuleCode)
      return Boolean(rule?.requires.includes(module.code as ModuleCode))
    })

  if(dependentModules.length === 0) return

  throw new Error(`${module.name} kaldırılamaz. ${dependentModules.map(item => item.name).join(', ')} bu modüle bağlı çalışıyor.`)
}

export const getWorkspaceModuleLifecycleRecords = (companyId: string) => {
  return readLifecycleRecords()
    .filter(item => item.companyId === companyId)
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
}

export const getWorkspaceModuleLifecycleState = (
  companyId: string,
  module: BusinessWorkspaceModule
) => {
  return getLifecycleRecord(companyId, module.id)?.lifecycleState || WORKSPACE_MODULE_LIFECYCLE_STATES.AVAILABLE
}

export const getWorkspaceModuleLifecycleStateForUser = (
  user: User | null | undefined,
  module: BusinessWorkspaceModule
) => {
  const companyId = getCompanyIdForUser(user)
  return companyId ? getWorkspaceModuleLifecycleState(companyId, module) : WORKSPACE_MODULE_LIFECYCLE_STATES.AVAILABLE
}

export const getWorkspaceModuleLifecycleStateByLicenseKeyForUser = (
  user: User | null | undefined,
  moduleKey: LicenseModuleKey
) => {
  const module = getBusinessWorkspaceModuleByLicenseKey(moduleKey)
  if(!module) return WORKSPACE_MODULE_LIFECYCLE_STATES.AVAILABLE
  return getWorkspaceModuleLifecycleStateForUser(user, module)
}

export const getManagedWorkspaceModules = (companyId: string) => {
  return getModulesByState(companyId, isLifecycleManagedState)
}

export const getActiveWorkspaceModules = (companyId: string) => {
  return getModulesByState(companyId, isLifecycleActiveState)
}

export const getManagedWorkspaceModulesForUser = (user: User | null | undefined) => {
  const companyId = getCompanyIdForUser(user)
  return companyId ? getManagedWorkspaceModules(companyId) : []
}

export const getActiveWorkspaceModulesForUser = (user: User | null | undefined) => {
  const companyId = getCompanyIdForUser(user)
  return companyId ? getActiveWorkspaceModules(companyId) : []
}

export const hasManagedWorkspaceModulesForUser = (user: User | null | undefined) => {
  return getManagedWorkspaceModulesForUser(user).length > 0
}

export const isWorkspaceModuleActive = (companyId: string, module: BusinessWorkspaceModule) => {
  return getWorkspaceModuleLifecycleState(companyId, module) === WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE
}

export const isWorkspaceModuleActiveForUser = (
  user: User | null | undefined,
  module: BusinessWorkspaceModule
) => {
  const companyId = getCompanyIdForUser(user)
  return companyId ? isWorkspaceModuleActive(companyId, module) : false
}

export const isWorkspaceModuleManagedForUser = (
  user: User | null | undefined,
  module: BusinessWorkspaceModule
) => {
  return isLifecycleManagedState(getWorkspaceModuleLifecycleStateForUser(user, module))
}

export const isWorkspaceLicenseModuleActiveForUser = (
  user: User | null | undefined,
  moduleKey: LicenseModuleKey
) => {
  const module = getBusinessWorkspaceModuleByLicenseKey(moduleKey)
  return module ? isWorkspaceModuleActiveForUser(user, module) : false
}

export const installWorkspaceModuleForUser = (
  user: User,
  moduleId: string
): WorkspaceModuleLifecycleResult => {
  const companyId = assertCompanyId(user)
  const module = assertModule(moduleId)
  assertModuleAvailableForCompanySector(companyId, module)
  const records = readLifecycleRecords()
  const companyManagedRecords = records.filter(item => item.companyId === companyId && isLifecycleManagedState(item.lifecycleState))
  const existingRecord = records.find(item => item.companyId === companyId && item.moduleId === module.id)
  const previousState = existingRecord?.lifecycleState || WORKSPACE_MODULE_LIFECYCLE_STATES.AVAILABLE
  const isFirstInstall = companyManagedRecords.length === 0

  if(existingRecord && isLifecycleManagedState(existingRecord.lifecycleState)){
    return createResult(user, module, existingRecord, previousState, 'install', false, true)
  }

  const record = existingRecord
    ? updateLifecycleRecord(existingRecord, user, WORKSPACE_MODULE_LIFECYCLE_STATES.INSTALLED)
    : createLifecycleRecord(user, companyId, module, new Date().toISOString())

  saveRecord(record)
  recordWorkspaceAuditEvent({
    user,
    eventType: 'MODULE_INSTALLED',
    title: `${module.name} modülü kuruldu.`,
    description: `${module.name} modülü Marketplace üzerinden Business Workspace içine kuruldu.`,
    moduleId: module.id,
    moduleCode: module.code,
    moduleName: module.name
  })

  return createResult(user, module, record, previousState, 'install', isFirstInstall, false)
}

export const configureWorkspaceModuleForUser = (
  user: User,
  moduleId: string
) => {
  const { companyId, module, record } = assertExistingRecord(user, moduleId)
  assertModuleAvailableForCompanySector(companyId, module)
  const previousState = record.lifecycleState
  const nextRecord = updateLifecycleRecord(record, user, WORKSPACE_MODULE_LIFECYCLE_STATES.CONFIGURED)

  saveRecord(nextRecord)
  recordWorkspaceAuditEvent({
    user,
    eventType: 'MODULE_CONFIGURED',
    title: `${module.name} modülü yapılandırıldı.`,
    description: `${module.name} modülünün başlangıç yapılandırması tamamlandı.`,
    moduleId: module.id,
    moduleCode: module.code,
    moduleName: module.name
  })

  return createResult(user, module, nextRecord, previousState, 'configure')
}

export const activateWorkspaceModuleForUser = (
  user: User,
  moduleId: string
) => {
  const { companyId, module, record } = assertExistingRecord(user, moduleId)
  assertModuleAvailableForCompanySector(companyId, module)
  const previousState = record.lifecycleState
  const nextRecord = updateLifecycleRecord(record, user, WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE)

  saveRecord(nextRecord)
  recordWorkspaceAuditEvent({
    user,
    eventType: previousState === WORKSPACE_MODULE_LIFECYCLE_STATES.SUSPENDED ? 'MODULE_REACTIVATED' : 'MODULE_ACTIVATED',
    title: previousState === WORKSPACE_MODULE_LIFECYCLE_STATES.SUSPENDED
      ? `${module.name} modülü yeniden aktifleştirildi.`
      : `${module.name} modülü aktif edildi.`,
    description: `${module.name} modülü Business Workspace kullanımına açıldı.`,
    moduleId: module.id,
    moduleCode: module.code,
    moduleName: module.name
  })

  return createResult(
    user,
    module,
    nextRecord,
    previousState,
    previousState === WORKSPACE_MODULE_LIFECYCLE_STATES.SUSPENDED ? 'reactivate' : 'activate'
  )
}

export const suspendWorkspaceModuleForUser = (
  user: User,
  moduleId: string
) => {
  const { module, record } = assertExistingRecord(user, moduleId)
  const previousState = record.lifecycleState
  const nextRecord = updateLifecycleRecord(record, user, WORKSPACE_MODULE_LIFECYCLE_STATES.SUSPENDED)

  saveRecord(nextRecord)
  recordWorkspaceAuditEvent({
    user,
    eventType: 'MODULE_SUSPENDED',
    title: `${module.name} modülü pasife alındı.`,
    description: `${module.name} modülü verileri korunarak Business Workspace kullanımından geçici olarak pasife alındı.`,
    moduleId: module.id,
    moduleCode: module.code,
    moduleName: module.name
  })

  return createResult(user, module, nextRecord, previousState, 'suspend')
}

export const detachWorkspaceModuleFromWorkspaceForUser = (
  user: User,
  moduleId: string
) => {
  const { companyId, module, record } = assertExistingRecord(user, moduleId)
  assertModuleCanBeDetached(companyId, module)
  const previousState = record.lifecycleState
  const nextRecord = updateLifecycleRecord(record, user, WORKSPACE_MODULE_LIFECYCLE_STATES.UNINSTALLED)

  saveRecord(nextRecord)
  recordWorkspaceAuditEvent({
    user,
    eventType: 'MODULE_DETACHED_FROM_WORKSPACE',
    title: `${module.name} modülü Workspace'ten kaldırıldı.`,
    description: `${module.name} modülü verileri silinmeden Business Workspace kullanımından kaldırıldı.`,
    moduleId: module.id,
    moduleCode: module.code,
    moduleName: module.name
  })

  return createResult(user, module, nextRecord, previousState, 'detach-from-workspace')
}
