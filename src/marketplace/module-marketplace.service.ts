import {
  BUSINESS_WORKSPACE_MODULE_REGISTRY
} from '../modules/business-workspace.registry'
import type { BusinessWorkspaceModule } from '../modules/business-workspace.registry'
import { WORKSPACE_MODULE_TYPES } from '../modules/module-registry.types'
import type {
  MarketplaceCatalogQuery,
  MarketplaceFilterOptions,
  MarketplaceLicenseState,
  MarketplaceModule,
  MarketplaceModuleState,
  MarketplaceModuleVisibility
} from './marketplace.types'

export type MarketplaceContext = {
  isLicensed?: (module: BusinessWorkspaceModule) => boolean
  isInstalled?: (module: BusinessWorkspaceModule) => boolean
}

const MARKETPLACE_DEVELOPER = 'MIYOP'
const MARKETPLACE_VERSION = '1.0.0'

const isMarketplaceModule = (module: BusinessWorkspaceModule) => {
  return (
    module.isMarketplaceEligible
    && (
      module.moduleType === WORKSPACE_MODULE_TYPES.BUSINESS
      || module.moduleType === WORKSPACE_MODULE_TYPES.INTEGRATION
    )
  )
}

const resolveVisibility = (module: BusinessWorkspaceModule): MarketplaceModuleVisibility => {
  if(!module.isVisible) return 'HIDDEN'
  if(module.marketplace?.isMarketplaceReady === false) return 'PRIVATE'
  return 'PUBLIC'
}

const resolveLicenseState = (
  module: BusinessWorkspaceModule,
  context: MarketplaceContext
): MarketplaceLicenseState => {
  if(!module.isEnabled || !module.isVisible) return 'DISABLED'
  if(!module.licenseModuleKey) return 'NOT_REQUIRED'
  return context.isLicensed?.(module) ? 'LICENSED' : 'UNLICENSED'
}

const resolveInstallState = (
  module: BusinessWorkspaceModule,
  licenseState: MarketplaceLicenseState,
  context: MarketplaceContext
): MarketplaceModuleState => {
  if(!module.isEnabled || licenseState === 'DISABLED') return 'DISABLED'
  if(module.marketplace?.isMarketplaceReady === false) return 'COMING_SOON'
  if(licenseState === 'LICENSED') return 'LICENSED'
  if(context.isInstalled?.(module)) return 'INSTALLED'
  return 'AVAILABLE'
}

const resolveCategory = (module: BusinessWorkspaceModule) => {
  if(module.moduleType === WORKSPACE_MODULE_TYPES.INTEGRATION) return 'Entegrasyon'
  return module.tags.find(tag => tag !== 'business') || 'Business'
}

const normalizeLookup = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const createMarketplaceModule = (
  module: BusinessWorkspaceModule,
  context: MarketplaceContext
): MarketplaceModule => {
  const licenseState = resolveLicenseState(module, context)
  const installState = resolveInstallState(module, licenseState, context)

  return {
    id: module.id,
    icon: module.icon,
    name: module.name,
    shortDescription: module.description,
    longDescription: module.description,
    category: resolveCategory(module),
    tags: [...module.tags],
    version: MARKETPLACE_VERSION,
    developer: MARKETPLACE_DEVELOPER,
    moduleType: module.moduleType,
    visibility: resolveVisibility(module),
    installState,
    licenseState,
    commercial: {
      pricingReady: Boolean(module.pricing && module.pricing.model !== 'included'),
      currency: module.pricing?.currency,
      monthlyPrice: module.pricing?.monthlyPrice,
      yearlyPrice: module.pricing?.yearlyPrice,
      trialDays: module.pricing?.trialDays
    },
    workspaceConnection: {
      route: module.route,
      menuKeys: module.menuItems.map(item => item.key),
      licenseModuleKey: module.licenseModuleKey,
      autoMenuActivationReady: Boolean(module.licenseModuleKey || module.isIntegrationModule)
    }
  }
}

const matchesSearch = (module: MarketplaceModule, search?: string) => {
  const normalizedSearch = normalizeLookup(search || '')
  if(!normalizedSearch) return true

  const haystack = normalizeLookup([
    module.name,
    module.shortDescription,
    module.longDescription,
    module.category,
    module.moduleType,
    module.tags.join(' ')
  ].join(' '))

  return haystack.includes(normalizedSearch)
}

const matchesQuery = (module: MarketplaceModule, query: MarketplaceCatalogQuery) => {
  const categoryMatches = !query.category || query.category === 'all' || module.category === query.category
  const moduleTypeMatches = !query.moduleType || query.moduleType === 'all' || module.moduleType === query.moduleType
  const stateMatches = !query.state || query.state === 'all' || module.installState === query.state

  return (
    categoryMatches
    && moduleTypeMatches
    && stateMatches
    && matchesSearch(module, query.search)
  )
}

export const getMarketplaceCatalog = (
  query: MarketplaceCatalogQuery = {},
  context: MarketplaceContext = {}
): MarketplaceModule[] => {
  return BUSINESS_WORKSPACE_MODULE_REGISTRY
    .filter(isMarketplaceModule)
    .map(module => createMarketplaceModule(module, context))
    .filter(module => module.visibility !== 'HIDDEN')
    .filter(module => matchesQuery(module, query))
    .sort((first, second) => first.name.localeCompare(second.name, 'tr'))
}

export const getMarketplaceFilterOptions = (
  context: MarketplaceContext = {}
): MarketplaceFilterOptions => {
  const catalog = getMarketplaceCatalog({}, context)

  return {
    categories: Array.from(new Set(catalog.map(module => module.category))).sort((first, second) => first.localeCompare(second, 'tr')),
    moduleTypes: Array.from(new Set(catalog.map(module => module.moduleType))),
    states: Array.from(new Set(catalog.map(module => module.installState)))
  }
}
