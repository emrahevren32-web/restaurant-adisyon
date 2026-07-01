import {
  getCompanyIdForUser,
  loadBranches,
  loadCompanies,
  loadCompanyLicenses,
  loadCompanySetups,
  loadCompanyUsers,
  loadLicensePackages,
  loadUsers,
  saveBranches,
  saveCompanies,
  saveCompanySetups,
  saveCompanyUsers,
  saveUsers,
  setCurrentUser
} from '../storage'
import { Branch, Company, CompanyLicense, CompanySetup, CompanyUser, User } from '../types'
import {
  CompleteFirstLoginOnboardingInput,
  CompleteFirstLoginOnboardingResult,
  FirstLoginOnboardingState
} from './onboarding.types'

const KEY_FIRST_LOGIN_ONBOARDING = 'ra_first_login_onboarding_completions'
const APPLICATION_SETUP_PREFIX = 'business_application_'

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
    packageItem
  }
}

export const completeFirstLoginOnboarding = ({
  state,
  company: companyForm,
  branch: branchForm,
  profile
}: CompleteFirstLoginOnboardingInput): CompleteFirstLoginOnboardingResult => {
  if(!state.company || !state.completionKey){
    throw new Error('Onboarding için firma kaydı bulunamadı.')
  }

  const now = new Date().toISOString()
  const allCompanies = loadCompanies({ allTenants: true })
  const allBranches = loadBranches()
  const allUsers = loadUsers({ allTenants: true })
  const allCompanyUsers = loadCompanyUsers({ allTenants: true })
  const allSetups = loadCompanySetups({ allTenants: true })
  const companyId = state.company.id
  const tenantId = state.company.tenantId || state.currentUser.tenantId

  const updatedCompany: Company = {
    ...state.company,
    companyName: companyForm.companyName.trim() || state.company.companyName,
    phone: companyForm.phone.trim(),
    email: companyForm.email.trim(),
    taxOffice: companyForm.taxOffice.trim(),
    taxNumber: companyForm.taxNumber.trim(),
    address: companyForm.address.trim(),
    city: companyForm.city.trim(),
    district: companyForm.district.trim(),
    logoUrl: companyForm.logoUrl.trim(),
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
    city: updatedCompany.city,
    managerName: profile.fullName.trim() || state.currentUser.fullName,
    isActive: true,
    createdAt: existingBranch?.createdAt || now,
    updatedAt: now
  }

  const updatedUser: User = {
    ...state.currentUser,
    tenantId,
    companyId,
    fullName: profile.fullName.trim() || state.currentUser.fullName,
    phone: profile.phone.trim(),
    profilePhotoUrl: profile.profilePhotoUrl.trim()
  }

  const existingCompanyUser = state.companyUser
  const updatedCompanyUser: CompanyUser | null = existingCompanyUser
    ? {
      ...existingCompanyUser,
      fullName: updatedUser.fullName,
      phone: profile.phone.trim() || existingCompanyUser.phone,
      updatedAt: now
    }
    : null

  saveCompanies(allCompanies.map(item => item.id === companyId ? updatedCompany : item))
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
