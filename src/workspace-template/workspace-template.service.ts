import { createBusinessSetupWizardPlan } from '../onboarding/business-setup-wizard.service'
import {
  DEFAULT_SECTOR_ID,
  SECTOR_ID_PREFIX,
  createSectorId
} from '../sector/sector.registry'
import {
  getCompanyIdForUser,
  loadCompanies
} from '../storage'
import type { User } from '../types'
import { WORKSPACE_TEMPLATE_REGISTRY } from './workspace-template.registry'
import {
  WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS,
  type WorkspaceTemplate,
  type WorkspaceTemplateEmptyState,
  type WorkspaceTemplateEmptyStateKey,
  type WorkspaceTemplateQuickAction,
  type WorkspaceTemplateView,
  type WorkspaceTemplateWidget
} from './workspace-template.types'

const cloneWidget = (widget: WorkspaceTemplateWidget): WorkspaceTemplateWidget => ({ ...widget })
const cloneQuickAction = (action: WorkspaceTemplateQuickAction): WorkspaceTemplateQuickAction => ({ ...action })
const cloneEmptyState = (state: WorkspaceTemplateEmptyState): WorkspaceTemplateEmptyState => ({ ...state })

const cloneTemplate = (template: WorkspaceTemplate): WorkspaceTemplate => ({
  ...template,
  dashboardTemplate: { ...template.dashboardTemplate },
  defaultWidgets: template.defaultWidgets.map(cloneWidget),
  quickActions: template.quickActions.map(cloneQuickAction),
  menuItems: template.menuItems.map(item => ({ ...item })),
  emptyStates: template.emptyStates.map(cloneEmptyState)
})

const normalizeSectorId = (sectorIdOrCode?: string) => {
  const value = String(sectorIdOrCode || '').trim()
  if(!value) return DEFAULT_SECTOR_ID
  return value.startsWith(SECTOR_ID_PREFIX) ? value : createSectorId(value)
}

const getGeneralBusinessTemplate = () => (
  WORKSPACE_TEMPLATE_REGISTRY.find(template => template.sectorId === DEFAULT_SECTOR_ID)
  || WORKSPACE_TEMPLATE_REGISTRY[0]
)

const getCompanyPrimarySectorIdForUser = (user?: User | null) => {
  if(typeof localStorage === 'undefined') return DEFAULT_SECTOR_ID

  const companyId = getCompanyIdForUser(user)
  if(!companyId) return DEFAULT_SECTOR_ID

  const company = loadCompanies({ allTenants: true }).find(item => item.id === companyId)
  return company?.primarySectorId || DEFAULT_SECTOR_ID
}

const sortByOrder = <TItem extends { order: number; id: string }>(items: readonly TItem[]) => (
  [...items].sort((first, second) => first.order - second.order || first.id.localeCompare(second.id, 'tr'))
)

const createModuleCodeSet = (codes: readonly string[]) => new Set(codes)

export const getWorkspaceTemplates = () => WORKSPACE_TEMPLATE_REGISTRY.map(cloneTemplate)

export const getWorkspaceTemplate = (sectorIdOrCode = DEFAULT_SECTOR_ID): WorkspaceTemplate => {
  const sectorId = normalizeSectorId(sectorIdOrCode)
  const template = WORKSPACE_TEMPLATE_REGISTRY.find(item => item.sectorId === sectorId) || getGeneralBusinessTemplate()
  return cloneTemplate(template)
}

export const getWorkspaceTemplateForUser = (user?: User | null) => {
  return getWorkspaceTemplate(getCompanyPrimarySectorIdForUser(user))
}

export const createWorkspaceTemplateView = (sectorIdOrCode = DEFAULT_SECTOR_ID): WorkspaceTemplateView => {
  const template = getWorkspaceTemplate(sectorIdOrCode)
  const setupPlan = createBusinessSetupWizardPlan({ sectorIdOrCode: template.sectorId })
  const resolvedModuleCodes = createModuleCodeSet(
    setupPlan.installationPlan.resolvedModules
      .filter(module => module.isRegistryBacked && !module.isUnsupported)
      .map(module => module.moduleCode)
  )
  const futureModuleCodes = createModuleCodeSet([
    ...setupPlan.futureRecommendedModules.map(module => module.moduleCode),
    ...setupPlan.futureOptionalModules.map(module => module.moduleCode),
    ...setupPlan.installationPlan.futureModules.map(module => module.moduleCode)
  ])
  const unsupportedModuleCodes = createModuleCodeSet([
    ...setupPlan.unsupportedModules.map(module => module.moduleCode),
    ...setupPlan.installationPlan.unsupportedModules.map(module => module.moduleCode)
  ])

  const isVisibleModuleCode = (moduleCode?: string) => !moduleCode || resolvedModuleCodes.has(moduleCode)
  const isFutureModuleCode = (moduleCode?: string) => Boolean(moduleCode && futureModuleCodes.has(moduleCode))
  const isUnsupportedModuleCode = (moduleCode?: string) => Boolean(moduleCode && unsupportedModuleCodes.has(moduleCode))

  return {
    ...template,
    recommendationPlan: setupPlan.recommendationPlan,
    installationPlan: setupPlan.installationPlan,
    visibleWidgets: sortByOrder(template.defaultWidgets.filter(widget => isVisibleModuleCode(widget.moduleCode))),
    hiddenFutureWidgets: sortByOrder(template.defaultWidgets.filter(widget => isFutureModuleCode(widget.moduleCode))),
    hiddenUnsupportedWidgets: sortByOrder(template.defaultWidgets.filter(widget => isUnsupportedModuleCode(widget.moduleCode))),
    visibleQuickActions: sortByOrder(template.quickActions.filter(action => isVisibleModuleCode(action.moduleCode))),
    visibleMenuItems: sortByOrder(template.menuItems.filter(item => isVisibleModuleCode(item.moduleCode)))
  }
}

export const getWorkspaceTemplateViewForUser = (user?: User | null) => {
  return createWorkspaceTemplateView(getCompanyPrimarySectorIdForUser(user))
}

export const getWorkspaceTemplateEmptyState = (
  view: WorkspaceTemplateView | WorkspaceTemplate,
  key: WorkspaceTemplateEmptyStateKey
) => {
  return view.emptyStates.find(state => state.key === key)
}

export const getDashboardEmptyState = (view: WorkspaceTemplateView | WorkspaceTemplate) => (
  getWorkspaceTemplateEmptyState(view, WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS.DASHBOARD)
)

export const getBusinessMenuEmptyState = (view: WorkspaceTemplateView | WorkspaceTemplate) => (
  getWorkspaceTemplateEmptyState(view, WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS.BUSINESS_MENU)
)

export const getWidgetCatalogEmptyState = (view: WorkspaceTemplateView | WorkspaceTemplate) => (
  getWorkspaceTemplateEmptyState(view, WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS.WIDGET_CATALOG)
)
