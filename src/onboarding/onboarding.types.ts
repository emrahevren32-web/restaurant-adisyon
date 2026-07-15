import {
  Branch,
  Company,
  CompanyLicense,
  CompanySetup,
  CompanyUser,
  Sector,
  TenantSettings,
  User
} from '../types'
import type { MarketplaceModuleState } from '../marketplace/marketplace.types'

export type FirstLoginModuleSummary = {
  key: string
  moduleId?: string
  icon?: string
  name: string
  description: string
  category?: string
  tags?: string[]
  installState?: MarketplaceModuleState
  version?: string
  developer?: string
}

export type FirstLoginOnboardingState = {
  required: boolean
  completed: boolean
  installationCompleted: boolean
  completionKey: string
  currentUser: User
  company: Company | null
  primarySector: Sector | null
  setup: CompanySetup | null
  branch: Branch | null
  companyUser: CompanyUser | null
  license: CompanyLicense | null
  tenantSettings: TenantSettings | null
  systemModules: FirstLoginModuleSummary[]
  businessModules: FirstLoginModuleSummary[]
  marketplaceBusinessModules: FirstLoginModuleSummary[]
}

export type FirstLoginPasswordForm = {
  temporaryPassword: string
  newPassword: string
  repeatPassword: string
}

export type FirstLoginBusinessInfoForm = {
  companyName: string
  primarySectorId: string
  city: string
  district: string
  branchName: string
  phone: string
  address: string
  currency: string
  language: string
  timezone: string
}

export type CompleteFirstLoginOnboardingInput = {
  state: FirstLoginOnboardingState
  password: FirstLoginPasswordForm
  businessInfo: FirstLoginBusinessInfoForm
  selectedRecommendedModuleCodes?: string[]
  selectedOptionalModuleCodes?: string[]
}

export type CompleteFirstLoginOnboardingResult = {
  state: FirstLoginOnboardingState
  company: Company
  branch: Branch
  user: User
}
