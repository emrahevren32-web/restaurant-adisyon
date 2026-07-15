import {
  getCompanyIdForUser,
  loadBranches,
  loadCompanies,
  loadCompanyLicenses,
  loadCompanySetups,
  loadCompanyUsers,
  loadSettings,
  loadSectors,
  loadTenantSettings,
  loadTenants,
  loadUsers,
  saveBranches,
  saveCompanies,
  saveCompanySetups,
  saveCompanyUsers,
  saveSettings,
  saveTenantSettings,
  saveTenants,
  saveUsers,
  setActiveBranchId,
  setCurrentUser
} from '../storage'
import { Branch, Company, CompanyLicense, CompanySetup, CompanyUser, User } from '../types'
import { getMarketplaceCatalog } from '../marketplace/module-marketplace.service'
import type { MarketplaceContext } from '../marketplace/module-marketplace.service'
import type { MarketplaceModule } from '../marketplace/marketplace.types'
import {
  activateWorkspaceModuleForUser,
  configureWorkspaceModuleForUser,
  getActiveWorkspaceModulesForUser,
  getWorkspaceModuleLifecycleStateForUser,
  installWorkspaceModuleForUser,
  WORKSPACE_MODULE_LIFECYCLE_STATES
} from '../workspace/workspace-module-lifecycle.service'
import {
  getCoreSystemModules,
  type BusinessWorkspaceModule
} from '../modules/business-workspace.registry'
import { WORKSPACE_MODULE_TYPES } from '../modules/module-registry.types'
import { createBusinessSetupWizardPlan } from './business-setup-wizard.service'
import { provisionWorkspaceForInitialSetup } from '../workspace-provisioning/workspace-provisioning.service'
import { clearAllDashboardWidgetLayouts, clearDashboardWidgetLayoutForUser } from '../dashboard/dashboard-widget.service'
import {
  CompleteFirstLoginOnboardingInput,
  CompleteFirstLoginOnboardingResult,
  FirstLoginModuleSummary,
  FirstLoginOnboardingState
} from './onboarding.types'

const KEY_FIRST_LOGIN_ONBOARDING = 'ra_first_login_onboarding_completions'
const APPLICATION_SETUP_PREFIX = 'business_application_'
const DEFAULT_WORKSPACE_TIMEZONE = 'Europe/Istanbul'
const DEFAULT_WORKSPACE_LANGUAGE = 'tr-TR'
const DEFAULT_WORKSPACE_CURRENCY = 'TRY'

type OnboardingCompletion = {
  key: string
  userId: string
  companyId: string
  installationCompleted?: boolean
  completedAt: string
}

const readCompletions = (): OnboardingCompletion[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_FIRST_LOGIN_ONBOARDING) || '[]')
    return Array.isArray(parsed) ? parsed.filter(item => item?.key) : []
  } catch {
    return []
  }
}

const saveCompletions = (items: OnboardingCompletion[]) => {
  localStorage.setItem(KEY_FIRST_LOGIN_ONBOARDING, JSON.stringify(items))
}

const createCompletionKey = (companyId: string, userId: string) => {
  return `${companyId}:${userId}`
}

const isApplicationSetup = (setup: CompanySetup | null) => {
  return Boolean(setup?.registrationId?.startsWith(APPLICATION_SETUP_PREFIX))
}

const findSetupForUser = (setups: CompanySetup[], user: User, companyId: string) => {
  return setups.find(setup => setup.adminUserId === user.id && setup.companyId === companyId)
    || setups.find(setup => setup.adminUserId === user.id)
    || setups.find(setup => setup.companyId === companyId && setup.registrationId.startsWith(APPLICATION_SETUP_PREFIX))
    || null
}

const findPrimaryBranch = (branches: Branch[], setup: CompanySetup | null, companyId: string) => {
  return branches.find(branch => setup?.branchId && branch.id === setup.branchId)
    || branches.find(branch => branch.companyId === companyId && branch.isActive)
    || branches.find(branch => branch.companyId === companyId)
    || null
}

const findCompanyUser = (companyUsers: CompanyUser[], user: User, companyId: string) => {
  return companyUsers.find(item => item.companyId === companyId && item.username === user.username)
    || companyUsers.find(item => item.companyId === companyId && item.fullName === user.fullName)
    || null
}

const findLatestLicense = (licenses: CompanyLicense[], companyId: string) => {
  return licenses
    .filter(license => license.companyId === companyId)
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))[0] || null
}

const getTenantIdForOnboarding = (company: Company | null, setup: CompanySetup | null, user: User) => {
  return company?.tenantId || setup?.tenantId || user.tenantId || ''
}

const createRegistryModuleSummary = (module: BusinessWorkspaceModule): FirstLoginModuleSummary => ({
  key: module.code,
  moduleId: module.id,
  icon: module.icon,
  name: module.name,
  description: module.description,
  category: module.moduleType,
  tags: [...module.tags]
})

const createMarketplaceModuleSummary = (module: MarketplaceModule): FirstLoginModuleSummary => ({
  key: module.id,
  moduleId: module.id,
  icon: module.icon,
  name: module.name,
  description: module.shortDescription,
  category: module.category,
  tags: [...module.tags],
  installState: module.installState,
  version: module.version,
  developer: module.developer
})

const resolveSystemModules = (): FirstLoginModuleSummary[] => {
  return getCoreSystemModules().map(createRegistryModuleSummary)
}

const resolveActiveBusinessModules = (user: User): FirstLoginModuleSummary[] => {
  return getActiveWorkspaceModulesForUser(user)
    .filter(module => module.moduleType === WORKSPACE_MODULE_TYPES.BUSINESS)
    .map(createRegistryModuleSummary)
}

const resolveMarketplaceBusinessModules = (user: User): FirstLoginModuleSummary[] => {
  const marketplaceContext: MarketplaceContext = {
    getLifecycleState: module => getWorkspaceModuleLifecycleStateForUser(user, module)
  }

  return getMarketplaceCatalog({
    moduleType: WORKSPACE_MODULE_TYPES.BUSINESS
  }, marketplaceContext).map(createMarketplaceModuleSummary)
}

const provisionInitialWorkspace = (
  user: User,
  primarySectorId: string,
  selectedRecommendedModuleCodes: readonly string[] | undefined,
  selectedOptionalModuleCodes: readonly string[] | undefined
) => {
  const setupPlan = createBusinessSetupWizardPlan({
    sectorIdOrCode: primarySectorId,
    selectedRecommendedModuleCodes,
    selectedOptionalModuleCodes
  })

  setupPlan.installationPlan.resolvedModules.forEach(planItem => {
    if(!planItem.module || planItem.isFuture || planItem.isUnsupported) return

    let lifecycleState = getWorkspaceModuleLifecycleStateForUser(user, planItem.module)

    if(
      lifecycleState === WORKSPACE_MODULE_LIFECYCLE_STATES.AVAILABLE
      || lifecycleState === WORKSPACE_MODULE_LIFECYCLE_STATES.UNINSTALLED
    ){
      installWorkspaceModuleForUser(user, planItem.module.id)
      lifecycleState = getWorkspaceModuleLifecycleStateForUser(user, planItem.module)
    }

    if(lifecycleState === WORKSPACE_MODULE_LIFECYCLE_STATES.INSTALLED){
      configureWorkspaceModuleForUser(user, planItem.module.id)
      lifecycleState = getWorkspaceModuleLifecycleStateForUser(user, planItem.module)
    }

    if(
      lifecycleState === WORKSPACE_MODULE_LIFECYCLE_STATES.CONFIGURED
      || lifecycleState === WORKSPACE_MODULE_LIFECYCLE_STATES.SUSPENDED
    ){
      activateWorkspaceModuleForUser(user, planItem.module.id)
    }
  })

  return provisionWorkspaceForInitialSetup(user, {
    sectorIdOrCode: primarySectorId,
    installationPlan: setupPlan.installationPlan
  })
}

export const getFirstLoginOnboardingState = (user: User): FirstLoginOnboardingState => {
  const companyId = getCompanyIdForUser(user)
  const completionKey = companyId ? createCompletionKey(companyId, user.id) : ''
  const completions = readCompletions()
  const companies = loadCompanies({ allTenants: true })
  const setups = loadCompanySetups({ allTenants: true })
  const branches = loadBranches()
  const companyUsers = loadCompanyUsers({ allTenants: true })
  const licenses = loadCompanyLicenses({ allTenants: true })
  const company = companies.find(item => item.id === companyId) || null
  const sectors = loadSectors({ includeInactive: true })
  const primarySector = company
    ? sectors.find(sector => sector.id === company.primarySectorId) || null
    : null
  const setup = companyId ? findSetupForUser(setups, user, companyId) : null
  const branch = companyId ? findPrimaryBranch(branches, setup, companyId) : null
  const companyUser = companyId ? findCompanyUser(companyUsers, user, companyId) : null
  const license = companyId ? findLatestLicense(licenses, companyId) : null
  const tenantId = getTenantIdForOnboarding(company, setup, user)
  const tenantSettings = tenantId ? loadTenantSettings().find(settings => settings.tenantId === tenantId) || null : null
  const completed = Boolean(completionKey && completions.some(item => item.key === completionKey))
  const installationCompleted = Boolean(completed || setup?.installationCompleted)
  const required = Boolean(
    company
    && setup
    && setup.adminUserId === user.id
    && isApplicationSetup(setup)
    && !installationCompleted
  )

  return {
    required,
    completed: installationCompleted,
    installationCompleted,
    completionKey,
    currentUser: user,
    company,
    primarySector,
    setup,
    branch,
    companyUser,
    license,
    tenantSettings,
    systemModules: resolveSystemModules(),
    businessModules: resolveActiveBusinessModules(user),
    marketplaceBusinessModules: resolveMarketplaceBusinessModules(user)
  }
}

export const completeFirstLoginOnboarding = ({
  state,
  password,
  businessInfo,
  selectedRecommendedModuleCodes,
  selectedOptionalModuleCodes
}: CompleteFirstLoginOnboardingInput): CompleteFirstLoginOnboardingResult => {
  if(!state.company || !state.completionKey){
    throw new Error('Onboarding için firma kaydı bulunamadı.')
  }

  const newPassword = password.newPassword.trim()
  if(!newPassword){
    throw new Error('Yeni şifre zorunludur.')
  }

  const now = new Date().toISOString()
  const allCompanies = loadCompanies({ allTenants: true })
  const allBranches = loadBranches()
  const allUsers = loadUsers({ allTenants: true })
  const allCompanyUsers = loadCompanyUsers({ allTenants: true })
  const allSetups = loadCompanySetups({ allTenants: true })
  const allTenants = loadTenants()
  const allTenantSettings = loadTenantSettings()
  const companyId = state.company.id
  const tenantId = getTenantIdForOnboarding(state.company, state.setup, state.currentUser)
  const companyName = businessInfo.companyName.trim() || state.company.companyName
  const primarySectorId = businessInfo.primarySectorId.trim() || state.company.primarySectorId
  const city = businessInfo.city.trim() || state.company.city
  const district = businessInfo.district.trim() || state.company.district
  const phone = businessInfo.phone.trim() || state.company.phone
  const address = businessInfo.address.trim() || state.company.address
  const branchName = businessInfo.branchName.trim() || state.branch?.name || 'Merkez Şube'
  const workspaceLogoUrl = ''
  const workspaceCurrency = businessInfo.currency.trim().toLocaleUpperCase('tr-TR') || DEFAULT_WORKSPACE_CURRENCY
  const workspaceLanguage = businessInfo.language.trim() || DEFAULT_WORKSPACE_LANGUAGE
  const workspaceTimezone = businessInfo.timezone.trim() || DEFAULT_WORKSPACE_TIMEZONE

  const baseUpdatedCompany: Company = {
    ...state.company,
    companyName,
    legalName: state.company.legalName || companyName,
    primarySectorId,
    city,
    district,
    phone,
    address,
    logoUrl: workspaceLogoUrl,
    updatedAt: now
  }

  const existingBranch = state.branch
  const updatedBranch: Branch = {
    id: existingBranch?.id || `branch_${Date.now()}`,
    tenantId,
    companyId,
    code: existingBranch?.code || `SUBE-${Date.now().toString().slice(-5)}`,
    name: branchName,
    phone,
    email: existingBranch?.email || baseUpdatedCompany.email,
    address,
    city,
    district,
    managerName: state.currentUser.fullName,
    isActive: true,
    createdAt: existingBranch?.createdAt || now,
    updatedAt: now
  }

  const updatedCompany: Company = {
    ...baseUpdatedCompany,
    defaultBranchId: updatedBranch.id,
    authorizedPerson: baseUpdatedCompany.authorizedPerson || baseUpdatedCompany.ownerName || state.currentUser.fullName,
    authorizedPhone: baseUpdatedCompany.authorizedPhone || updatedBranch.phone,
    authorizedEmail: baseUpdatedCompany.authorizedEmail || baseUpdatedCompany.email,
    ownerName: baseUpdatedCompany.authorizedPerson || baseUpdatedCompany.ownerName || state.currentUser.fullName
  }

  const updatedUser: User = {
    ...state.currentUser,
    tenantId,
    companyId,
    profilePhotoUrl: '',
    password: newPassword
  }

  const updatedCompanyUser: CompanyUser | null = state.companyUser
    ? {
      ...state.companyUser,
      fullName: updatedUser.fullName,
      updatedAt: now
    }
    : null

  saveCompanies(allCompanies.map(item => item.id === companyId ? updatedCompany : item))
  if(tenantId){
    saveTenants(allTenants.map(tenant => tenant.id === tenantId || tenant.ownerCompanyId === companyId || tenant.companyId === companyId
      ? {
          ...tenant,
          tenantName: companyName,
          companyName,
          ownerCompanyId: companyId,
          companyId,
          workspaceIds: Array.from(new Set([...(tenant.workspaceIds || []), updatedCompany.workspaceId].filter(Boolean))),
          updatedAt: now
        }
      : tenant))

    const existingTenantSettings = allTenantSettings.find(settings => settings.tenantId === tenantId)
    const updatedTenantSettings = {
      id: existingTenantSettings?.id || `tenant_settings_${tenantId}`,
      tenantId,
      timezone: workspaceTimezone,
      currency: workspaceCurrency,
      language: workspaceLanguage,
      dateFormat: existingTenantSettings?.dateFormat || 'DD.MM.YYYY',
      theme: existingTenantSettings?.theme || 'Varsayılan',
      createdAt: existingTenantSettings?.createdAt || now,
      updatedAt: now
    }

    saveTenantSettings([
      updatedTenantSettings,
      ...allTenantSettings.filter(settings => settings.tenantId !== tenantId)
    ])
  }

  const currentSettings = loadSettings()
  saveSettings({
    ...currentSettings,
    restaurantName: companyName,
    logoUrl: workspaceLogoUrl,
    currency: workspaceCurrency
  })
  saveBranches(existingBranch
    ? allBranches.map(item => item.id === existingBranch.id ? updatedBranch : item)
    : [updatedBranch, ...allBranches])
  saveUsers(allUsers.some(item => item.id === updatedUser.id)
    ? allUsers.map(item => item.id === updatedUser.id ? updatedUser : item)
    : [updatedUser, ...allUsers])
  if(updatedCompanyUser){
    saveCompanyUsers(allCompanyUsers.map(item => item.id === updatedCompanyUser.id ? updatedCompanyUser : item))
  }
  if(state.setup){
    saveCompanySetups(allSetups.map(item => item.id === state.setup?.id
      ? {
          ...item,
          temporaryPassword: '',
          setupCompleted: true,
          installationCompleted: true,
          completedAt: now,
          updatedAt: now
        }
      : item))
  }
  setActiveBranchId(updatedBranch.id, updatedUser)

  const completions = readCompletions()
  saveCompletions([
    {
      key: state.completionKey,
      userId: updatedUser.id,
      companyId,
      installationCompleted: true,
      completedAt: now
    },
    ...completions.filter(item => item.key !== state.completionKey)
  ])
  clearAllDashboardWidgetLayouts()
  clearDashboardWidgetLayoutForUser(updatedUser)
  provisionInitialWorkspace(
    updatedUser,
    primarySectorId,
    selectedRecommendedModuleCodes,
    selectedOptionalModuleCodes
  )
  setCurrentUser(updatedUser)

  return {
    state: getFirstLoginOnboardingState(updatedUser),
    company: updatedCompany,
    branch: updatedBranch,
    user: updatedUser
  }
}
