import type { WorkspaceModuleType } from '../modules/module-registry.types'

export type MarketplaceModuleVisibility = 'PUBLIC' | 'PRIVATE' | 'HIDDEN'

export type MarketplaceModuleState =
  | 'AVAILABLE'
  | 'INSTALLED'
  | 'LICENSED'
  | 'DISABLED'
  | 'COMING_SOON'

export type MarketplaceLicenseState =
  | 'UNLICENSED'
  | 'LICENSED'
  | 'NOT_REQUIRED'
  | 'DISABLED'

export type MarketplaceCommercialModel = {
  pricingReady: boolean
  billingProvider?: string
  currency?: string
  monthlyPrice?: number
  yearlyPrice?: number
  trialDays?: number
}

export type MarketplaceWorkspaceConnection = {
  route: string
  menuKeys: string[]
  licenseModuleKey?: string
  autoMenuActivationReady: boolean
}

export type MarketplaceModule = {
  id: string
  icon: string
  name: string
  shortDescription: string
  longDescription: string
  category: string
  tags: string[]
  version: string
  developer: string
  moduleType: WorkspaceModuleType
  visibility: MarketplaceModuleVisibility
  installState: MarketplaceModuleState
  licenseState: MarketplaceLicenseState
  commercial: MarketplaceCommercialModel
  workspaceConnection: MarketplaceWorkspaceConnection
}

export type MarketplaceCatalogQuery = {
  search?: string
  category?: string
  moduleType?: WorkspaceModuleType | 'all'
  state?: MarketplaceModuleState | 'all'
}

export type MarketplaceFilterOptions = {
  categories: string[]
  moduleTypes: WorkspaceModuleType[]
  states: MarketplaceModuleState[]
}
