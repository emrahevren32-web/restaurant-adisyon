import {
  getCompanyIdForUser,
  LICENSE_MODULE_CATALOG,
  loadBranches,
  loadCompanies,
  loadCompanyLicenses,
  loadCompanySetups,
  loadCompanyUsers,
  loadLicenseModules,
  loadLicensePackages,
  loadSettings,
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
  setCurrentUser
} from '../storage'
import { Branch, Company, CompanyLicense, CompanySetup, CompanyUser, LicenseModuleKey, User } from '../types'
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

const SYSTEM_MODULES: FirstLoginModuleSummary[] = [
  { key: 'user-management', name: 'Kullanıcı Yönetimi', description: 'Firma kullanıcıları ve erişim kayıtları için temel sistem alanı.' },
  { key: 'roles', name: 'Roller', description: 'Firma sahibi, admin ve operasyon rollerinin yönetim temeli.' },
  { key: 'notifications', name: 'Bildirimler', description: 'Duyuru ve sistem bilgilendirme akışları için hazır kanal.' },
  { key: 'license', name: 'Lisans', description: 'Modül erişimi, kullanım limiti ve abonelik görünürlüğü.' },
  { key: 'branches', name: 'Şubeler', description: 'Aktif şube, şube yetkileri ve çoklu şube temeli.' },
  { key: 'system-settings', name: 'Sistem Ayarları', description: 'Dil, para birimi, saat dilimi ve workspace tercihleri.' }
]

const BUSINESS_MODULE_DESCRIPTIONS: Partial<Record<LicenseModuleKey, string>> = {
  adisyon: 'Masa, sipariş ve ödeme operasyonlarının başlangıç modülü.',
  'qr-menu': 'QR menü, QR sipariş ve misafir çağrı akışları.',
  stock: 'Stok kartları, hareketler, kritik stok ve SKT takibi.',
  recipe: 'Reçete, maliyet ve tüketim temeli.',
  current: 'Cari kartlar, hesap hareketleri ve müşteri borç takibi.',
  credit: 'Veresiye ve tahsilat operasyonları.',
  finance: 'Kasa, gelir-gider, finans raporları ve kapanış işlemleri.',
  personnel: 'Personel, vardiya, puantaj ve performans modülleri.',
  'boss-dashboard': 'Patron dashboard ve yönetici uyarı merkezleri.',
  'multi-branch': 'Şube raporlama, merkez ofis ve şubeler arası işlemler.',
  analytics: 'Kullanım, performans ve sistem sağlığı analizleri.',
  'ai-consultant': 'AI danışman özellikleri için paket hazırlığı.',
  'task-management': 'Görev yönetimi özellikleri için paket hazırlığı.',
  calendar: 'Takvim özellikleri için paket hazırlığı.'
}

const FALLBACK_BUSINESS_MODULES: LicenseModuleKey[] = [
  'adisyon',
  'qr-menu',
  'stock',
  'recipe',
  'current',
  'finance',
  'personnel'
]

type OnboardingCompletion = {
  key: string
  userId: string
  companyId: string
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

const createModuleSummary = (moduleKey: LicenseModuleKey): FirstLoginModuleSummary => {
  const catalogItem = LICENSE_MODULE_CATALOG.find(module => module.key === moduleKey)
  return {
    key: moduleKey,
    name: catalogItem?.name || moduleKey,
    description: BUSINESS_MODULE_DESCRIPTIONS[moduleKey] || 'Workspace içinde aktif olan iş modülü.'
  }
}

const resolveBusinessModules = (packageId?: string): FirstLoginModuleSummary[] => {
  const enabledModuleKeys = packageId
    ? loadLicenseModules()
      .filter(module => module.packageId === packageId && module.enabled)
      .map(module => module.moduleKey)
    : []

  const visibleModuleKeys = enabledModuleKeys.length > 0 ? enabledModuleKeys : FALLBACK_BUSINESS_MODULES
  return visibleModuleKeys.map(createModuleSummary)
}

export const getFirstLoginOnboardingState = (user: User): FirstLoginOnboardingState => {
  const companyId = getCompanyIdForUser(user)
  const completionKey = companyId ? createCompletionKey(companyId, user.id) : ''
  const completions = readCompletions()
  const completed = Boolean(completionKey && completions.some(item => item.key === completionKey))
  const companies = loadCompanies({ allTenants: true })
  const setups = loadCompanySetups({ allTenants: true })
  const branches = loadBranches()
  const companyUsers = loadCompanyUsers({ allTenants: true })
  const licenses = loadCompanyLicenses({ allTenants: true })
  const packages = loadLicensePackages()
  const company = companies.find(item => item.id === companyId) || null
  const setup = companyId ? findSetupForUser(setups, user, companyId) : null
  const branch = companyId ? findPrimaryBranch(branches, setup, companyId) : null
  const companyUser = companyId ? findCompanyUser(companyUsers, user, companyId) : null
  const license = companyId ? findLatestLicense(licenses, companyId) : null
  const packageItem = license ? packages.find(item => item.id === license.packageId) || null : null
  const tenantId = getTenantIdForOnboarding(company, setup, user)
  const tenantSettings = tenantId ? loadTenantSettings().find(settings => settings.tenantId === tenantId) || null : null
  const required = Boolean(company && setup && setup.adminUserId === user.id && isApplicationSetup(setup) && !completed)

  return {
    required,
    completed,
    completionKey,
    currentUser: user,
    company,
    setup,
    branch,
    companyUser,
    license,
    packageItem,
    tenantSettings,
    systemModules: SYSTEM_MODULES,
    businessModules: resolveBusinessModules(packageItem?.id)
  }
}

export const completeFirstLoginOnboarding = ({
  state,
  password,
  workspace,
  branch: branchForm
}: CompleteFirstLoginOnboardingInput): CompleteFirstLoginOnboardingResult => {
  if(!state.company || !state.completionKey){
    throw new Error('Onboarding için firma kaydı bulunamadı.')
  }

  // Placeholder: password fields prepare the future password-change service.
  // This phase deliberately does not persist password changes.
  void password

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
  const workspaceName = workspace.workspaceName.trim() || state.company.companyName
  const workspaceLogoUrl = workspace.logoUrl.trim()
  const workspaceCurrency = workspace.currency.trim().toLocaleUpperCase('tr-TR') || DEFAULT_WORKSPACE_CURRENCY
  const workspaceLanguage = workspace.language.trim() || DEFAULT_WORKSPACE_LANGUAGE
  const workspaceTimezone = workspace.timezone.trim() || DEFAULT_WORKSPACE_TIMEZONE

  const updatedCompany: Company = {
    ...state.company,
    companyName: workspaceName,
    logoUrl: workspaceLogoUrl,
    updatedAt: now
  }

  const existingBranch = state.branch
  const updatedBranch: Branch = {
    id: existingBranch?.id || `branch_${Date.now()}`,
    tenantId,
    companyId,
    code: existingBranch?.code || `SUBE-${Date.now().toString().slice(-5)}`,
    name: branchForm.name.trim() || existingBranch?.name || 'Merkez Şube',
    phone: branchForm.phone.trim(),
    email: existingBranch?.email || updatedCompany.email,
    address: branchForm.address.trim(),
    city: branchForm.city.trim() || updatedCompany.city,
    district: branchForm.district.trim() || updatedCompany.district,
    managerName: state.currentUser.fullName,
    isActive: true,
    createdAt: existingBranch?.createdAt || now,
    updatedAt: now
  }

  const updatedUser: User = {
    ...state.currentUser,
    tenantId,
    companyId
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
    saveTenants(allTenants.map(tenant => tenant.id === tenantId || tenant.companyId === companyId
      ? { ...tenant, companyName: workspaceName, updatedAt: now }
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
    restaurantName: workspaceName,
    logoUrl: workspaceLogoUrl,
    currency: workspaceCurrency
  })
  saveBranches(existingBranch
    ? allBranches.map(item => item.id === existingBranch.id ? updatedBranch : item)
    : [updatedBranch, ...allBranches])
  saveUsers(allUsers.map(item => item.id === updatedUser.id ? updatedUser : item))
  if(updatedCompanyUser){
    saveCompanyUsers(allCompanyUsers.map(item => item.id === updatedCompanyUser.id ? updatedCompanyUser : item))
  }
  if(state.setup){
    saveCompanySetups(allSetups.map(item => item.id === state.setup?.id
      ? { ...item, setupCompleted: true, completedAt: now, updatedAt: now }
      : item))
  }

  const completions = readCompletions()
  saveCompletions([
    {
      key: state.completionKey,
      userId: updatedUser.id,
      companyId,
      completedAt: now
    },
    ...completions.filter(item => item.key !== state.completionKey)
  ])
  setCurrentUser(updatedUser)

  return {
    state: getFirstLoginOnboardingState(updatedUser),
    company: updatedCompany,
    branch: updatedBranch,
    user: updatedUser
  }
}
