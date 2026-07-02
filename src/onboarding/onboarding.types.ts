import {
  Branch,
  Company,
  CompanyLicense,
  CompanySetup,
  CompanyUser,
  LicenseModuleKey,
  LicensePackage,
  TenantSettings,
  User
} from '../types'

export type FirstLoginModuleSummary = {
  key: LicenseModuleKey | string
  name: string
  description: string
}

export type FirstLoginOnboardingState = {
  required: boolean
  completed: boolean
  completionKey: string
  currentUser: User
  company: Company | null
  setup: CompanySetup | null
  branch: Branch | null
  companyUser: CompanyUser | null
  license: CompanyLicense | null
  packageItem: LicensePackage | null
  tenantSettings: TenantSettings | null
  systemModules: FirstLoginModuleSummary[]
  businessModules: FirstLoginModuleSummary[]
}

export type FirstLoginPasswordForm = {
  temporaryPassword: string
  newPassword: string
  repeatPassword: string
}

export type FirstLoginWorkspaceForm = {
  workspaceName: string
  logoUrl: string
  currency: string
  language: string
  timezone: string
}

export type FirstLoginBranchForm = {
  name: string
  address: string
  phone: string
  city: string
  district: string
}

export type CompleteFirstLoginOnboardingInput = {
  state: FirstLoginOnboardingState
  password: FirstLoginPasswordForm
  workspace: FirstLoginWorkspaceForm
  branch: FirstLoginBranchForm
}

export type CompleteFirstLoginOnboardingResult = {
  state: FirstLoginOnboardingState
  company: Company
  branch: Branch
  user: User
}
