import {
  BUSINESS_WORKSPACE_MODULE_REGISTRY,
  isBusinessWorkspaceModuleAvailableForSector
} from '../modules/business-workspace.registry'
import type { BusinessWorkspaceModule } from '../modules/business-workspace.registry'
import { WORKSPACE_MODULE_TYPES } from '../modules/module-registry.types'
import {
  WORKSPACE_MODULE_LIFECYCLE_STATES,
  type WorkspaceModuleLifecycleState
} from '../workspace/workspace-module-lifecycle.types'
import type {
  MarketplaceCatalogQuery,
  MarketplaceCatalogTab,
  MarketplaceFilterOptions,
  MarketplaceLicenseState,
  MarketplaceModule,
  MarketplaceModuleBadge,
  MarketplaceModuleState,
  MarketplaceModuleVisibility
} from './marketplace.types'

export type MarketplaceContext = {
  getLifecycleState?: (module: BusinessWorkspaceModule) => WorkspaceModuleLifecycleState
  isLicensed?: (module: BusinessWorkspaceModule) => boolean
  sectorId?: string
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

const resolveLifecycleState = (
  module: BusinessWorkspaceModule,
  context: MarketplaceContext
): WorkspaceModuleLifecycleState => {
  return context.getLifecycleState?.(module) || WORKSPACE_MODULE_LIFECYCLE_STATES.AVAILABLE
}

const resolveLicenseState = (
  module: BusinessWorkspaceModule,
  lifecycleState: WorkspaceModuleLifecycleState
): MarketplaceLicenseState => {
  if(!module.isEnabled || !module.isVisible) return 'DISABLED'
  if(lifecycleState === WORKSPACE_MODULE_LIFECYCLE_STATES.AVAILABLE) return 'UNLICENSED'
  if(lifecycleState === WORKSPACE_MODULE_LIFECYCLE_STATES.UNINSTALLED) return 'UNLICENSED'
  return 'LICENSED'
}

const resolveInstallState = (
  module: BusinessWorkspaceModule,
  lifecycleState: WorkspaceModuleLifecycleState,
  licenseState: MarketplaceLicenseState
): MarketplaceModuleState => {
  if(!module.isEnabled || licenseState === 'DISABLED') return 'DISABLED'
  if(module.marketplace?.isMarketplaceReady === false) return 'COMING_SOON'
  return lifecycleState
}

const resolveCategory = (module: BusinessWorkspaceModule) => {
  if(module.moduleType === WORKSPACE_MODULE_TYPES.INTEGRATION) return 'Entegrasyon'
  return module.tags.find(tag => tag !== 'business') || 'Business'
}

const resolveBadges = (
  module: BusinessWorkspaceModule,
  installState: MarketplaceModuleState
): MarketplaceModuleBadge[] => {
  const badges: MarketplaceModuleBadge[] = []

  if(installState === 'ACTIVE'){
    badges.push({ type: 'active', label: 'Aktif' })
  }

  if(installState === 'CONFIGURED'){
    badges.push({ type: 'configured', label: 'Yapılandırıldı' })
  }

  if(installState === 'INSTALLED'){
    badges.push({ type: 'installed', label: 'Kurulu' })
  }

  if(installState === 'SUSPENDED'){
    badges.push({ type: 'suspended', label: 'Pasif' })
  }

  if(installState === 'UNINSTALLED'){
    badges.push({ type: 'uninstalled', label: 'Çalışma Alanından Kaldırıldı' })
  }

  if(installState === 'AVAILABLE'){
    badges.push({ type: 'recommended', label: 'Önerilen' })
  }

  if(installState === 'COMING_SOON'){
    badges.push({ type: 'coming-soon', label: 'Yakında' })
  }

  if(installState === 'DISABLED'){
    badges.push({ type: 'disabled', label: 'Desteklenmiyor' })
  }

  if(module.tags.includes('new')){
    badges.push({ type: 'new', label: 'Yeni' })
  }

  return badges
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
  const lifecycleState = resolveLifecycleState(module, context)
  const licenseState = resolveLicenseState(module, lifecycleState)
  const installState = resolveInstallState(module, lifecycleState, licenseState)

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
    badges: resolveBadges(module, installState),
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

const isInstalledTabState = (state: MarketplaceModuleState) => {
  return state === 'INSTALLED' || state === 'CONFIGURED' || state === 'ACTIVE' || state === 'SUSPENDED'
}

const matchesTab = (module: MarketplaceModule, tab?: MarketplaceCatalogTab) => {
  if(!tab || tab === 'all') return true
  if(tab === 'recommended') return module.installState === 'AVAILABLE'
  if(tab === 'installed') return isInstalledTabState(module.installState)
  if(tab === 'suspended') return module.installState === 'SUSPENDED'
  if(tab === 'not-installed') return module.installState === 'AVAILABLE' || module.installState === 'UNINSTALLED'
  if(tab === 'coming-soon') return module.installState === 'COMING_SOON'
  return true
}

const matchesQuery = (module: MarketplaceModule, query: MarketplaceCatalogQuery) => {
  const categoryMatches = !query.category || query.category === 'all' || module.category === query.category
  const moduleTypeMatches = !query.moduleType || query.moduleType === 'all' || module.moduleType === query.moduleType
  const stateMatches = !query.state || query.state === 'all' || module.installState === query.state

  return (
    categoryMatches
    && moduleTypeMatches
    && stateMatches
    && matchesTab(module, query.tab)
    && matchesSearch(module, query.search)
  )
}

export const getMarketplaceCatalog = (
  query: MarketplaceCatalogQuery = {},
  context: MarketplaceContext = {}
): MarketplaceModule[] => {
  return BUSINESS_WORKSPACE_MODULE_REGISTRY
    .filter(isMarketplaceModule)
    .filter(module => isBusinessWorkspaceModuleAvailableForSector(module, context.sectorId))
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
