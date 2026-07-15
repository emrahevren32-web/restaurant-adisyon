import type { PermissionName } from '../authorization/permission.types'
import type { DashboardWidgetModuleContribution } from '../dashboard/dashboard-widget.types'
import {
  getBusinessWorkspaceModuleByCode,
  type BusinessWorkspaceModule
} from '../modules/business-workspace.registry'
import type { ModuleInstallationPlan } from '../modules/module-dependency.types'
import {
  getCompanyIdForUser,
  loadCompanies,
  loadTenantSettings
} from '../storage'
import type { Company, User } from '../types'
import { createWorkspaceTemplateView } from '../workspace-template/workspace-template.service'
import type {
  WorkspaceTemplateEmptyState,
  WorkspaceTemplateView,
  WorkspaceTemplateWidget
} from '../workspace-template/workspace-template.types'
import type { WorkspaceModuleLifecycleResult } from '../workspace/workspace-module-lifecycle.types'
import {
  WORKSPACE_PROVISION_STEP_STATUSES,
  WORKSPACE_PROVISION_STEP_TYPES,
  WORKSPACE_PROVISIONING_OPERATIONS,
  type ProvisionedDashboardWidget,
  type ProvisionedEmptyState,
  type ProvisionedMenuItem,
  type ProvisionedPermission,
  type ProvisionedRole,
  type ProvisionedSetting,
  type ProvisionedWorkspaceModule,
  type WorkspaceProvisionExecutionResult,
  type WorkspaceProvisionJournalEntry,
  type WorkspaceProvisionJournalStep,
  type WorkspaceProvisionPlan,
  type WorkspaceProvisionPlanStep,
  type WorkspaceProvisionTargetModule,
  type WorkspaceProvisioningOperation,
  type WorkspaceProvisionedState,
  type WorkspaceProvisionStepStatus
} from './workspace-provisioning.types'
import type {
  ProvisionManifestEmptyState,
  ProvisionManifestMenuItem,
  ProvisionManifestRole,
  ProvisionManifestSetting
} from './provision-manifest.types'

type CreateWorkspaceProvisionPlanInput = {
  user: User
  operation: WorkspaceProvisioningOperation
  sectorIdOrCode?: string
  installationPlan?: ModuleInstallationPlan
  moduleCodes?: readonly string[]
}

const STATE_STORAGE_KEY = 'miyop_workspace_provisioned_state'
const JOURNAL_STORAGE_KEY = 'miyop_workspace_installation_journal'
export const WORKSPACE_PROVISIONING_EVENT = 'miyop-workspace-provisioning-updated'

const DEFAULT_WORKSPACE_SETTINGS = {
  theme: 'Varsayılan',
  language: 'tr-TR',
  currency: 'TRY',
  timezone: 'Europe/Istanbul',
  dateFormat: 'DD.MM.YYYY'
} as const

const DEFAULT_WORKSPACE_ROLES: ProvisionManifestRole[] = [
  {
    key: 'workspace-admin',
    name: 'Yönetici',
    description: 'Çalışma alanı, modül, kullanıcı ve işletme ayarlarını yönetir.',
    permissions: [
      'dashboard.read',
      'products.read',
      'products.write',
      'stock.read',
      'stock.write',
      'finance.read',
      'finance.write',
      'personnel.read',
      'personnel.manage',
      'operations.read',
      'operations.write',
      'company.read',
      'company.manage'
    ],
    isSystemRole: true
  },
  {
    key: 'workspace-accounting',
    name: 'Muhasebe',
    description: 'Finans, cari ve raporlama ekranlarını kullanır.',
    permissions: ['dashboard.read', 'finance.read', 'finance.write', 'company.read'],
    isSystemRole: true
  },
  {
    key: 'workspace-operation',
    name: 'Operasyon',
    description: 'Günlük operasyon, ürün/hizmet ve adisyon akışlarını kullanır.',
    permissions: ['dashboard.read', 'operations.read', 'operations.write', 'products.read', 'products.write'],
    isSystemRole: true
  },
  {
    key: 'workspace-stock',
    name: 'Depo',
    description: 'Stok kartları, hareketler ve depo takip alanlarını kullanır.',
    permissions: ['dashboard.read', 'stock.read', 'stock.write'],
    isSystemRole: true
  },
  {
    key: 'workspace-production',
    name: 'Üretim',
    description: 'Üretim tanımları ve stok ilişkili hazırlık alanlarını kullanır.',
    permissions: ['dashboard.read', 'products.read', 'products.write', 'stock.read'],
    isSystemRole: true
  }
]

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const dispatchProvisioningEvent = () => {
  if(!isBrowser()) return
  window.dispatchEvent(new CustomEvent(WORKSPACE_PROVISIONING_EVENT))
}

const readJson = <TValue,>(key: string, fallback: TValue): TValue => {
  if(!isBrowser()) return fallback

  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '')
    return parsed || fallback
  } catch {
    return fallback
  }
}

const writeJson = (key: string, value: unknown) => {
  if(!isBrowser()) return
  localStorage.setItem(key, JSON.stringify(value))
}

const createId = (prefix: string, parts: readonly string[]) => (
  `${prefix}_${parts.join('_')}`.replace(/[^a-z0-9_-]/gi, '_')
)

const sortByOrder = <TItem extends { order: number; id?: string; key?: string }>(items: readonly TItem[]) => (
  [...items].sort((first, second) => (
    first.order - second.order
    || String(first.id || first.key || '').localeCompare(String(second.id || second.key || ''), 'tr')
  ))
)

const uniqueStrings = (items: readonly string[]) => Array.from(new Set(items.filter(Boolean)))

const getCompanyForProvisioning = (user: User) => {
  const companyId = getCompanyIdForUser(user)
  if(!companyId) throw new Error('Provisioning için Business Workspace bulunamadı.')

  const company = loadCompanies({ allTenants: true }).find(item => item.id === companyId)
  if(!company) throw new Error('Provisioning için firma kaydı bulunamadı.')

  return company
}

const resolveTenantSettings = (company: Company) => {
  return loadTenantSettings().find(settings => settings.tenantId === company.tenantId) || null
}

const createProvisionSettings = (company: Company): ProvisionManifestSetting[] => {
  const tenantSettings = resolveTenantSettings(company)

  return [
    {
      key: 'theme',
      label: 'Tema',
      value: tenantSettings?.theme || DEFAULT_WORKSPACE_SETTINGS.theme,
      scope: 'workspace'
    },
    {
      key: 'language',
      label: 'Dil',
      value: tenantSettings?.language || DEFAULT_WORKSPACE_SETTINGS.language,
      scope: 'workspace'
    },
    {
      key: 'currency',
      label: 'Para Birimi',
      value: tenantSettings?.currency || DEFAULT_WORKSPACE_SETTINGS.currency,
      scope: 'workspace'
    },
    {
      key: 'timezone',
      label: 'Saat Dilimi',
      value: tenantSettings?.timezone || DEFAULT_WORKSPACE_SETTINGS.timezone,
      scope: 'workspace'
    },
    {
      key: 'dateFormat',
      label: 'Tarih Formatı',
      value: tenantSettings?.dateFormat || DEFAULT_WORKSPACE_SETTINGS.dateFormat,
      scope: 'workspace'
    }
  ]
}

const flattenMenuItems = (items: readonly ProvisionManifestMenuItem[]): ProvisionManifestMenuItem[] => (
  items.flatMap(item => [
    item,
    ...flattenMenuItems(item.children || [])
  ])
)

const mapModuleCodesToModules = (moduleCodes: readonly string[]) => (
  uniqueStrings(moduleCodes)
    .map(moduleCode => getBusinessWorkspaceModuleByCode(moduleCode))
    .filter(Boolean) as BusinessWorkspaceModule[]
)

const resolveTargetModules = (
  input: CreateWorkspaceProvisionPlanInput,
  templateView: WorkspaceTemplateView
) => {
  if(input.moduleCodes?.length){
    return mapModuleCodesToModules(input.moduleCodes)
  }

  if(input.installationPlan){
    return input.installationPlan.resolvedModules
      .map(item => item.module)
      .filter(Boolean) as BusinessWorkspaceModule[]
  }

  return templateView.installationPlan.resolvedModules
    .map(item => item.module)
    .filter(Boolean) as BusinessWorkspaceModule[]
}

const toTargetModules = (modules: readonly BusinessWorkspaceModule[]): WorkspaceProvisionTargetModule[] => (
  [...modules]
    .sort((first, second) => first.displayOrder - second.displayOrder)
    .map((module, index) => ({
      moduleId: module.id,
      moduleCode: module.code,
      moduleName: module.name,
      moduleIcon: module.icon,
      manifest: module.provisionManifest,
      order: index + 1
    }))
)

const createStep = (
  planId: string,
  type: WorkspaceProvisionPlanStep['type'],
  key: string,
  title: string,
  description: string,
  order: number,
  payload?: unknown,
  moduleCode?: string
): WorkspaceProvisionPlanStep => ({
  id: createId('provision_step', [planId, type, key]),
  key,
  type,
  title,
  description,
  order,
  moduleCode,
  status: WORKSPACE_PROVISION_STEP_STATUSES.PENDING,
  payload
})

const createTemplateWidgetPayload = (
  templateView: WorkspaceTemplateView,
  widget: WorkspaceTemplateWidget,
  now: string
): ProvisionedDashboardWidget => ({
  id: createId('workspace_template_widget', [templateView.id, widget.id]),
  widgetId: widget.id,
  title: widget.title,
  description: widget.description,
  icon: widget.icon,
  category: widget.category,
  order: widget.order,
  defaultVisible: widget.defaultVisible,
  defaultSize: widget.defaultSize,
  supportedLayouts: widget.supportedLayouts,
  renderComponent: widget.renderComponent,
  emptyTitle: widget.emptyTitle,
  emptyDescription: widget.emptyDescription,
  moduleCode: widget.moduleCode,
  source: 'workspace-template',
  provisionedAt: now
})

const createManifestWidgetPayload = (
  module: WorkspaceProvisionTargetModule,
  widget: DashboardWidgetModuleContribution,
  now: string
): ProvisionedDashboardWidget => ({
  id: createId('module_manifest_widget', [String(module.moduleCode), widget.id]),
  widgetId: widget.id,
  title: widget.title,
  description: widget.description,
  icon: widget.icon,
  category: widget.category,
  order: module.order * 100 + widget.order,
  defaultVisible: widget.defaultVisible,
  defaultSize: widget.defaultSize,
  supportedLayouts: widget.supportedLayouts,
  renderComponent: widget.renderComponent,
  emptyTitle: 'Henüz canlı veri yok.',
  emptyDescription: 'Bu widget ilgili modül veri üretmeye başladığında dolacak.',
  moduleCode: String(module.moduleCode),
  source: 'module-manifest',
  provisionedAt: now
})

const createTemplateEmptyStatePayload = (
  state: WorkspaceTemplateEmptyState,
  now: string
): ProvisionedEmptyState => ({
  key: state.key,
  title: state.title,
  description: state.description,
  icon: state.icon,
  provisionedAt: now
})

const createPlanSteps = (
  planId: string,
  company: Company,
  templateView: WorkspaceTemplateView,
  targetModules: WorkspaceProvisionTargetModule[],
  operation: WorkspaceProvisioningOperation,
  now: string
) => {
  const uninstallLike = operation === WORKSPACE_PROVISIONING_OPERATIONS.MODULE_UNINSTALL
    || operation === WORKSPACE_PROVISIONING_OPERATIONS.MODULE_SUSPEND
  const steps: WorkspaceProvisionPlanStep[] = []
  const targetModuleCodes = new Set(targetModules.map(module => String(module.moduleCode)))

  steps.push(createStep(
    planId,
    WORKSPACE_PROVISION_STEP_TYPES.WORKSPACE,
    'workspace-structure',
    'Workspace yapısı',
    'Çalışma alanı temel kimliği ve varsayılan açılış sayfası hazırlanır.',
    10,
    {
      templateId: templateView.id,
      templateName: templateView.name,
      defaultRoute: templateView.defaultRoute,
      defaultNavKey: templateView.defaultNavKey
    }
  ))

  createProvisionSettings(company).forEach((setting, index) => {
    steps.push(createStep(
      planId,
      WORKSPACE_PROVISION_STEP_TYPES.SETTING,
      `workspace-setting:${setting.key}`,
      setting.label,
      `${setting.label} varsayılan workspace ayarı hazırlanır.`,
      20 + index,
      setting
    ))
  })

  steps.push(createStep(
    planId,
    WORKSPACE_PROVISION_STEP_TYPES.DASHBOARD,
    'dashboard-template',
    templateView.dashboardTemplate.title,
    'Sektör dashboard template bilgisi çalışma alanına bağlanır.',
    40,
    {
      templateId: templateView.id,
      title: templateView.dashboardTemplate.title,
      description: templateView.dashboardTemplate.description,
      icon: templateView.dashboardTemplate.icon,
      defaultRoute: templateView.defaultRoute,
      defaultNavKey: templateView.defaultNavKey
    }
  ))

  DEFAULT_WORKSPACE_ROLES.forEach((role, index) => {
    steps.push(createStep(
      planId,
      WORKSPACE_PROVISION_STEP_TYPES.ROLE,
      `workspace-role:${role.key}`,
      role.name,
      role.description,
      60 + index,
      role
    ))
  })

  templateView.emptyStates.forEach((state, index) => {
    steps.push(createStep(
      planId,
      WORKSPACE_PROVISION_STEP_TYPES.EMPTY_STATE,
      `template-empty-state:${state.key}`,
      state.title,
      state.description,
      80 + index,
      createTemplateEmptyStatePayload(state, now)
    ))
  })

  templateView.defaultWidgets
    .filter(widget => !widget.moduleCode || targetModuleCodes.has(widget.moduleCode))
    .forEach((widget, index) => {
      steps.push(createStep(
        planId,
        WORKSPACE_PROVISION_STEP_TYPES.WIDGET,
        `template-widget:${widget.id}`,
        widget.title,
        widget.description,
        100 + index,
        createTemplateWidgetPayload(templateView, widget, now),
        widget.moduleCode
      ))
    })

  targetModules.forEach(module => {
    steps.push(createStep(
      planId,
      WORKSPACE_PROVISION_STEP_TYPES.MODULE,
      `module:${module.moduleCode}`,
      module.moduleName,
      uninstallLike ? `${module.moduleName} workspace katkıları kaldırılır.` : `${module.moduleName} workspace içine provision edilir.`,
      200 + module.order,
      module,
      String(module.moduleCode)
    ))

    flattenMenuItems(module.manifest.menuItems).forEach((item, index) => {
      steps.push(createStep(
        planId,
        WORKSPACE_PROVISION_STEP_TYPES.MENU,
        `menu:${module.moduleCode}:${item.key}`,
        item.label,
        `${module.moduleName} menü katkısı hazırlanır.`,
        300 + module.order * 100 + index,
        item,
        String(module.moduleCode)
      ))
    })

    module.manifest.dashboardWidgets.forEach((widget, index) => {
      steps.push(createStep(
        planId,
        WORKSPACE_PROVISION_STEP_TYPES.WIDGET,
        `manifest-widget:${module.moduleCode}:${widget.id}`,
        widget.title,
        widget.description,
        500 + module.order * 100 + index,
        createManifestWidgetPayload(module, widget, now),
        String(module.moduleCode)
      ))
    })

    module.manifest.permissions.forEach((permission, index) => {
      steps.push(createStep(
        planId,
        WORKSPACE_PROVISION_STEP_TYPES.PERMISSION,
        `permission:${module.moduleCode}:${permission}`,
        permission,
        `${module.moduleName} permission katkısı hazırlanır.`,
        700 + module.order * 100 + index,
        { name: permission, moduleCode: String(module.moduleCode) },
        String(module.moduleCode)
      ))
    })

    module.manifest.roles.forEach((role, index) => {
      steps.push(createStep(
        planId,
        WORKSPACE_PROVISION_STEP_TYPES.ROLE,
        `module-role:${module.moduleCode}:${role.key}`,
        role.name,
        role.description,
        900 + module.order * 100 + index,
        role,
        String(module.moduleCode)
      ))
    })

    module.manifest.settings.forEach((setting, index) => {
      steps.push(createStep(
        planId,
        WORKSPACE_PROVISION_STEP_TYPES.SETTING,
        `module-setting:${module.moduleCode}:${setting.key}`,
        setting.label,
        `${module.moduleName} varsayılan ayarı hazırlanır.`,
        1100 + module.order * 100 + index,
        setting,
        String(module.moduleCode)
      ))
    })

    module.manifest.emptyStates.forEach((state, index) => {
      steps.push(createStep(
        planId,
        WORKSPACE_PROVISION_STEP_TYPES.EMPTY_STATE,
        `module-empty-state:${module.moduleCode}:${state.key}`,
        state.title,
        state.description,
        1300 + module.order * 100 + index,
        { ...state, provisionedAt: now },
        String(module.moduleCode)
      ))
    })
  })

  return sortByOrder(steps)
}

const readProvisionedStates = (): WorkspaceProvisionedState[] => (
  readJson<WorkspaceProvisionedState[]>(STATE_STORAGE_KEY, [])
)

const saveProvisionedStates = (states: WorkspaceProvisionedState[]) => {
  writeJson(STATE_STORAGE_KEY, states)
  dispatchProvisioningEvent()
}

const readJournalEntries = (): WorkspaceProvisionJournalEntry[] => (
  readJson<WorkspaceProvisionJournalEntry[]>(JOURNAL_STORAGE_KEY, [])
)

const saveJournalEntries = (entries: WorkspaceProvisionJournalEntry[]) => {
  writeJson(JOURNAL_STORAGE_KEY, entries)
  dispatchProvisioningEvent()
}

const createInitialState = (
  plan: WorkspaceProvisionPlan
): WorkspaceProvisionedState => ({
  companyId: plan.companyId,
  tenantId: plan.tenantId,
  workspaceId: plan.workspaceId,
  sectorId: plan.sectorId,
  templateId: plan.templateId,
  templateName: plan.templateName,
  dashboard: {
    templateId: plan.templateId,
    title: plan.templateName,
    description: '',
    icon: 'WS',
    defaultRoute: 'summary',
    defaultNavKey: 'dashboard',
    widgets: []
  },
  provisionedModules: [],
  menuItems: [],
  roles: [],
  permissions: [],
  settings: [],
  emptyStates: [],
  futureModules: [...plan.futureModules],
  unsupportedModules: [...plan.unsupportedModules],
  createdAt: plan.createdAt,
  updatedAt: plan.createdAt
})

const upsertByKey = <TItem,>(
  items: TItem[],
  nextItem: TItem,
  getKey: (item: TItem) => string
) => {
  const nextKey = getKey(nextItem)
  const exists = items.some(item => getKey(item) === nextKey)
  return {
    changed: !exists,
    items: exists ? items : [...items, nextItem]
  }
}

const applyInstallStep = (
  state: WorkspaceProvisionedState,
  step: WorkspaceProvisionPlanStep,
  now: string
) => {
  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.WORKSPACE){
    const payload = step.payload as {
      templateId: string
      templateName: string
      defaultRoute: WorkspaceProvisionedState['dashboard']['defaultRoute']
      defaultNavKey: WorkspaceProvisionedState['dashboard']['defaultNavKey']
    }
    const changed = state.templateId !== payload.templateId
      || state.templateName !== payload.templateName
      || state.dashboard.defaultRoute !== payload.defaultRoute
      || state.dashboard.defaultNavKey !== payload.defaultNavKey

    return {
      changed,
      message: changed ? 'Workspace yapısı güncellendi.' : 'Workspace yapısı zaten güncel.',
      state: {
        ...state,
        templateId: payload.templateId,
        templateName: payload.templateName,
        dashboard: {
          ...state.dashboard,
          templateId: payload.templateId,
          defaultRoute: payload.defaultRoute,
          defaultNavKey: payload.defaultNavKey
        },
        updatedAt: changed ? now : state.updatedAt
      }
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.DASHBOARD){
    const payload = step.payload as WorkspaceProvisionedState['dashboard']
    const changed = state.dashboard.templateId !== payload.templateId
      || state.dashboard.title !== payload.title
      || state.dashboard.description !== payload.description

    return {
      changed,
      message: changed ? 'Dashboard template hazırlandı.' : 'Dashboard template zaten hazır.',
      state: {
        ...state,
        dashboard: {
          ...state.dashboard,
          ...payload,
          widgets: state.dashboard.widgets
        },
        updatedAt: changed ? now : state.updatedAt
      }
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.MODULE){
    const payload = step.payload as WorkspaceProvisionTargetModule
    const moduleItem: ProvisionedWorkspaceModule = {
      moduleId: payload.moduleId,
      moduleCode: String(payload.moduleCode),
      moduleName: payload.moduleName,
      manifestVersion: payload.manifest.manifestVersion,
      provisionedAt: now,
      updatedAt: now
    }
    const result = upsertByKey(state.provisionedModules, moduleItem, item => item.moduleCode)

    return {
      changed: result.changed,
      message: result.changed ? `${payload.moduleName} provision edildi.` : `${payload.moduleName} zaten provision edilmiş.`,
      state: {
        ...state,
        provisionedModules: result.items,
        updatedAt: result.changed ? now : state.updatedAt
      }
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.MENU){
    const payload = step.payload as ProvisionManifestMenuItem
    const menuItem: ProvisionedMenuItem = {
      ...payload,
      id: createId('provisioned_menu', [step.moduleCode || 'workspace', String(payload.key)]),
      moduleCode: step.moduleCode,
      provisionedAt: now
    }
    const result = upsertByKey(state.menuItems, menuItem, item => item.id)

    return {
      changed: result.changed,
      message: result.changed ? `${payload.label} menüye eklendi.` : `${payload.label} menüde zaten var.`,
      state: {
        ...state,
        menuItems: sortByOrder(result.items.map(item => ({ ...item, order: item.order || item.displayOrder || 0 }))),
        updatedAt: result.changed ? now : state.updatedAt
      }
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.WIDGET){
    const payload = step.payload as ProvisionedDashboardWidget
    const result = upsertByKey(state.dashboard.widgets, payload, item => item.id)

    return {
      changed: result.changed,
      message: result.changed ? `${payload.title} widget yerleşimi hazırlandı.` : `${payload.title} widget yerleşimi zaten hazır.`,
      state: {
        ...state,
        dashboard: {
          ...state.dashboard,
          widgets: sortByOrder(result.items)
        },
        updatedAt: result.changed ? now : state.updatedAt
      }
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.ROLE){
    const payload = step.payload as ProvisionManifestRole
    const role: ProvisionedRole = { ...payload, provisionedAt: now }
    const result = upsertByKey(state.roles, role, item => item.key)

    return {
      changed: result.changed,
      message: result.changed ? `${payload.name} rolü hazırlandı.` : `${payload.name} rolü zaten hazır.`,
      state: {
        ...state,
        roles: result.items,
        updatedAt: result.changed ? now : state.updatedAt
      }
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.PERMISSION){
    const payload = step.payload as { name: PermissionName; moduleCode?: string }
    const permission: ProvisionedPermission = {
      name: payload.name,
      moduleCode: payload.moduleCode,
      provisionedAt: now
    }
    const result = upsertByKey(state.permissions, permission, item => `${item.moduleCode || 'workspace'}:${item.name}`)

    return {
      changed: result.changed,
      message: result.changed ? `${payload.name} yetkisi hazırlandı.` : `${payload.name} yetkisi zaten hazır.`,
      state: {
        ...state,
        permissions: result.items,
        updatedAt: result.changed ? now : state.updatedAt
      }
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.SETTING){
    const payload = step.payload as ProvisionManifestSetting
    const setting: ProvisionedSetting = { ...payload, provisionedAt: now }
    const existing = state.settings.find(item => item.key === setting.key && item.scope === setting.scope)
    const changed = !existing || existing.value !== setting.value

    return {
      changed,
      message: changed ? `${payload.label} ayarı hazırlandı.` : `${payload.label} ayarı zaten hazır.`,
      state: {
        ...state,
        settings: changed
          ? [setting, ...state.settings.filter(item => !(item.key === setting.key && item.scope === setting.scope))]
          : state.settings,
        updatedAt: changed ? now : state.updatedAt
      }
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.EMPTY_STATE){
    const payload = step.payload as ProvisionedEmptyState
    const result = upsertByKey(state.emptyStates, payload, item => `${item.moduleCode || 'workspace'}:${item.key}`)

    return {
      changed: result.changed,
      message: result.changed ? `${payload.title} boş durum ekranı hazırlandı.` : `${payload.title} boş durum ekranı zaten hazır.`,
      state: {
        ...state,
        emptyStates: result.items,
        updatedAt: result.changed ? now : state.updatedAt
      }
    }
  }

  return {
    changed: false,
    message: 'Adım atlandı.',
    state
  }
}

const applyUninstallStep = (
  state: WorkspaceProvisionedState,
  step: WorkspaceProvisionPlanStep,
  now: string
) => {
  const moduleCode = step.moduleCode
  if(!moduleCode){
    return {
      changed: false,
      message: 'Workspace genel adımı kaldırma işleminde atlandı.',
      state
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.MODULE){
    const nextModules = state.provisionedModules.filter(item => item.moduleCode !== moduleCode)
    const changed = nextModules.length !== state.provisionedModules.length
    return {
      changed,
      message: changed ? `${moduleCode} provision kaydı kaldırıldı.` : `${moduleCode} provision kaydı zaten yok.`,
      state: { ...state, provisionedModules: nextModules, updatedAt: changed ? now : state.updatedAt }
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.MENU){
    const nextItems = state.menuItems.filter(item => item.moduleCode !== moduleCode)
    const changed = nextItems.length !== state.menuItems.length
    return {
      changed,
      message: changed ? `${moduleCode} menü katkıları kaldırıldı.` : `${moduleCode} menü katkısı bulunmadı.`,
      state: { ...state, menuItems: nextItems, updatedAt: changed ? now : state.updatedAt }
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.WIDGET){
    const nextWidgets = state.dashboard.widgets.filter(widget => widget.moduleCode !== moduleCode)
    const changed = nextWidgets.length !== state.dashboard.widgets.length
    return {
      changed,
      message: changed ? `${moduleCode} widget katkıları kaldırıldı.` : `${moduleCode} widget katkısı bulunmadı.`,
      state: {
        ...state,
        dashboard: { ...state.dashboard, widgets: nextWidgets },
        updatedAt: changed ? now : state.updatedAt
      }
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.PERMISSION){
    const nextPermissions = state.permissions.filter(permission => permission.moduleCode !== moduleCode)
    const changed = nextPermissions.length !== state.permissions.length
    return {
      changed,
      message: changed ? `${moduleCode} yetki katkıları kaldırıldı.` : `${moduleCode} yetki katkısı bulunmadı.`,
      state: { ...state, permissions: nextPermissions, updatedAt: changed ? now : state.updatedAt }
    }
  }

  if(step.type === WORKSPACE_PROVISION_STEP_TYPES.EMPTY_STATE){
    const nextEmptyStates = state.emptyStates.filter(emptyState => emptyState.moduleCode !== moduleCode)
    const changed = nextEmptyStates.length !== state.emptyStates.length
    return {
      changed,
      message: changed ? `${moduleCode} boş durum katkıları kaldırıldı.` : `${moduleCode} boş durum katkısı bulunmadı.`,
      state: { ...state, emptyStates: nextEmptyStates, updatedAt: changed ? now : state.updatedAt }
    }
  }

  return {
    changed: false,
    message: 'Adım kaldırma işleminde atlandı.',
    state
  }
}

const createJournalStep = (
  step: WorkspaceProvisionPlanStep,
  status: WorkspaceProvisionStepStatus,
  message: string,
  completedAt: string
): WorkspaceProvisionJournalStep => ({
  ...step,
  status,
  message,
  completedAt
})

export const createWorkspaceProvisionPlanForUser = (
  input: CreateWorkspaceProvisionPlanInput
): WorkspaceProvisionPlan => {
  const company = getCompanyForProvisioning(input.user)
  const sectorId = input.sectorIdOrCode || company.primarySectorId
  const templateView = createWorkspaceTemplateView(sectorId)
  const installationPlan = input.installationPlan || templateView.installationPlan
  const targetModules = toTargetModules(resolveTargetModules(input, templateView))
  const now = new Date().toISOString()
  const planId = createId('workspace_provision_plan', [
    company.id,
    input.operation,
    new Date(now).getTime().toString(36)
  ])

  return {
    id: planId,
    companyId: company.id,
    tenantId: company.tenantId,
    workspaceId: company.workspaceId || company.id,
    sectorId: templateView.sectorId,
    operation: input.operation,
    templateId: templateView.id,
    templateName: templateView.name,
    recommendationPlan: installationPlan.recommendationPlan,
    installationPlan,
    targetModules,
    futureModules: installationPlan.futureModules.map(module => module.moduleCode),
    unsupportedModules: installationPlan.unsupportedModules.map(module => module.moduleCode),
    steps: createPlanSteps(planId, company, templateView, targetModules, input.operation, now),
    createdAt: now,
    createdByUserId: input.user.id
  }
}

export const executeWorkspaceProvisionPlan = (
  user: User,
  plan: WorkspaceProvisionPlan
): WorkspaceProvisionExecutionResult => {
  const startedAt = new Date().toISOString()
  const existingState = readProvisionedStates().find(item => item.companyId === plan.companyId)
  let state = existingState || createInitialState(plan)
  const uninstallLike = plan.operation === WORKSPACE_PROVISIONING_OPERATIONS.MODULE_UNINSTALL
    || plan.operation === WORKSPACE_PROVISIONING_OPERATIONS.MODULE_SUSPEND
  const journalSteps: WorkspaceProvisionJournalStep[] = []

  plan.steps.forEach(step => {
    const completedAt = new Date().toISOString()

    try {
      const result = uninstallLike
        ? applyUninstallStep(state, step, completedAt)
        : applyInstallStep(state, step, completedAt)
      state = result.state
      journalSteps.push(createJournalStep(
        step,
        result.changed ? WORKSPACE_PROVISION_STEP_STATUSES.SUCCESS : WORKSPACE_PROVISION_STEP_STATUSES.SKIPPED,
        result.message,
        completedAt
      ))
    } catch(error) {
      journalSteps.push(createJournalStep(
        step,
        WORKSPACE_PROVISION_STEP_STATUSES.FAILED,
        error instanceof Error ? error.message : 'Provisioning adımı uygulanamadı.',
        completedAt
      ))
    }
  })

  state = {
    ...state,
    futureModules: [...plan.futureModules],
    unsupportedModules: [...plan.unsupportedModules],
    updatedAt: new Date().toISOString()
  }

  const states = [
    state,
    ...readProvisionedStates().filter(item => item.companyId !== plan.companyId)
  ]
  saveProvisionedStates(states)

  const completedAt = new Date().toISOString()
  const hasFailedStep = journalSteps.some(step => step.status === WORKSPACE_PROVISION_STEP_STATUSES.FAILED)
  const hasSuccessStep = journalSteps.some(step => step.status === WORKSPACE_PROVISION_STEP_STATUSES.SUCCESS)
  const journalEntry: WorkspaceProvisionJournalEntry = {
    id: createId('workspace_installation_journal', [plan.id, completedAt]),
    planId: plan.id,
    companyId: plan.companyId,
    operation: plan.operation,
    status: hasFailedStep
      ? WORKSPACE_PROVISION_STEP_STATUSES.FAILED
      : hasSuccessStep
        ? WORKSPACE_PROVISION_STEP_STATUSES.SUCCESS
        : WORKSPACE_PROVISION_STEP_STATUSES.SKIPPED,
    startedAt,
    completedAt,
    createdByUserId: user.id,
    steps: journalSteps
  }

  saveJournalEntries([journalEntry, ...readJournalEntries()])

  return {
    plan,
    state,
    journalEntry
  }
}

export const provisionWorkspaceForInitialSetup = (
  user: User,
  input: {
    sectorIdOrCode: string
    installationPlan: ModuleInstallationPlan
  }
) => {
  return executeWorkspaceProvisionPlan(user, createWorkspaceProvisionPlanForUser({
    user,
    operation: WORKSPACE_PROVISIONING_OPERATIONS.INITIAL_SETUP,
    sectorIdOrCode: input.sectorIdOrCode,
    installationPlan: input.installationPlan
  }))
}

export const provisionWorkspaceForModuleLifecycleResult = (
  user: User,
  result: WorkspaceModuleLifecycleResult
) => {
  const operation = result.action === 'detach-from-workspace'
    ? WORKSPACE_PROVISIONING_OPERATIONS.MODULE_UNINSTALL
    : result.action === 'suspend'
      ? WORKSPACE_PROVISIONING_OPERATIONS.MODULE_SUSPEND
      : WORKSPACE_PROVISIONING_OPERATIONS.MODULE_INSTALL

  return executeWorkspaceProvisionPlan(user, createWorkspaceProvisionPlanForUser({
    user,
    operation,
    moduleCodes: [result.module.code]
  }))
}

export const reconfigureWorkspaceForUser = (user: User) => (
  executeWorkspaceProvisionPlan(user, createWorkspaceProvisionPlanForUser({
    user,
    operation: WORKSPACE_PROVISIONING_OPERATIONS.RECONFIGURE
  }))
)

export const getWorkspaceProvisionedState = (companyId: string) => {
  return readProvisionedStates().find(item => item.companyId === companyId) || null
}

export const getWorkspaceProvisionedStateForUser = (user: User | null | undefined) => {
  const companyId = getCompanyIdForUser(user)
  return companyId ? getWorkspaceProvisionedState(companyId) : null
}

export const getWorkspaceProvisionJournal = (companyId: string) => (
  readJournalEntries()
    .filter(entry => entry.companyId === companyId)
    .sort((first, second) => second.completedAt.localeCompare(first.completedAt))
)

export const getWorkspaceProvisionJournalForUser = (user: User | null | undefined) => {
  const companyId = getCompanyIdForUser(user)
  return companyId ? getWorkspaceProvisionJournal(companyId) : []
}
