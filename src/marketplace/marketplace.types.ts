import type { WorkspaceModuleType } from '../modules/module-registry.types'

export type MarketplaceModuleVisibility = 'PUBLIC' | 'PRIVATE' | 'HIDDEN'

export type MarketplaceModuleState =
  | 'AVAILABLE'
  | 'INSTALLED'
  | 'CONFIGURED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'UNINSTALLED'
  | 'DISABLED'
  | 'COMING_SOON'

export type MarketplaceLicenseState =
  | 'UNLICENSED'
  | 'LICENSED'
  | 'NOT_REQUIRED'
  | 'DISABLED'

export type MarketplaceCatalogTab =
  | 'all'
  | 'recommended'
  | 'installed'
  | 'suspended'
  | 'not-installed'
  | 'coming-soon'

export type MarketplaceCatalogTabDefinition = {
  key: MarketplaceCatalogTab
  label: string
  description: string
  displayOrder: number
}

export type MarketplaceModuleBadgeType =
  | 'installed'
  | 'configured'
  | 'active'
  | 'suspended'
  | 'uninstalled'
  | 'recommended'
  | 'coming-soon'
  | 'new'
  | 'disabled'

export type MarketplaceModuleBadge = {
  type: MarketplaceModuleBadgeType
  label: string
}

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
  badges: MarketplaceModuleBadge[]
  commercial: MarketplaceCommercialModel
  workspaceConnection: MarketplaceWorkspaceConnection
}

export type MarketplaceCatalogQuery = {
  search?: string
  category?: string
  moduleType?: WorkspaceModuleType | 'all'
  state?: MarketplaceModuleState | 'all'
  tab?: MarketplaceCatalogTab
}

export type MarketplaceFilterOptions = {
  categories: string[]
  moduleTypes: WorkspaceModuleType[]
  states: MarketplaceModuleState[]
}
