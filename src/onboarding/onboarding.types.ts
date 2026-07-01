import {
  Branch,
  Company,
  CompanyLicense,
  CompanySetup,
  CompanyUser,
  LicensePackage,
  User
} from '../types'

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
}

export type FirstLoginCompanyForm = {
  companyName: string
  phone: string
  email: string
  taxOffice: string
  taxNumber: string
  address: string
  city: string
  district: string
  logoUrl: string
}

export type FirstLoginBranchForm = {
  name: string
  address: string
  phone: string
}

export type FirstLoginProfileForm = {
  fullName: string
  phone: string
  profilePhotoUrl: string
}

export type CompleteFirstLoginOnboardingInput = {
  state: FirstLoginOnboardingState
  company: FirstLoginCompanyForm
  branch: FirstLoginBranchForm
  profile: FirstLoginProfileForm
}

export type CompleteFirstLoginOnboardingResult = {
  state: FirstLoginOnboardingState
  company: Company
  branch: Branch
  user: User
}
