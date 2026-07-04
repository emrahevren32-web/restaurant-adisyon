import { getIntegrationRegistry } from './integration.registry'
import {
  INTEGRATION_STATUSES,
  type IntegrationStatus,
  type IntegrationType,
  type WorkspaceIntegrationCatalogItem,
  type WorkspaceIntegrationFilterOptions,
  type WorkspaceIntegrationQuery
} from './integration-registry.types'

const normalizeLookup = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const createCatalogItem = (item: ReturnType<typeof getIntegrationRegistry>[number]): WorkspaceIntegrationCatalogItem => ({
  ...item,
  connectionReady: item.status !== INTEGRATION_STATUSES.COMING_SOON && item.status !== INTEGRATION_STATUSES.DISABLED,
  authorizationReady: item.authMethods.some(method => method !== 'NONE')
})

const matchesSearch = (item: WorkspaceIntegrationCatalogItem, search?: string) => {
  const normalizedSearch = normalizeLookup(search || '')
  if(!normalizedSearch) return true

  return normalizeLookup([
    item.name,
    item.description,
    item.developer,
    item.category,
    item.status,
    item.tags.join(' ')
  ].join(' ')).includes(normalizedSearch)
}

const matchesQuery = (
  item: WorkspaceIntegrationCatalogItem,
  query: WorkspaceIntegrationQuery
) => {
  const categoryMatches = !query.category || query.category === 'all' || item.category === query.category
  const statusMatches = !query.status || query.status === 'all' || item.status === query.status

  return categoryMatches && statusMatches && matchesSearch(item, query.search)
}

export const getWorkspaceIntegrationCatalog = (
  query: WorkspaceIntegrationQuery = {}
): WorkspaceIntegrationCatalogItem[] => {
  return getIntegrationRegistry()
    .map(createCatalogItem)
    .filter(item => matchesQuery(item, query))
}

export const getWorkspaceIntegrationFilterOptions = (): WorkspaceIntegrationFilterOptions => {
  const catalog = getWorkspaceIntegrationCatalog()

  return {
    categories: Array.from(new Set(catalog.map(item => item.category))).sort((first, second) => first.localeCompare(second, 'tr')) as IntegrationType[],
    statuses: Array.from(new Set(catalog.map(item => item.status))).sort((first, second) => first.localeCompare(second, 'tr')) as IntegrationStatus[]
  }
}

export const getWorkspaceIntegrationFoundation = () => ({
  connectionOperationsReady: false,
  apiKeyVaultReady: false,
  oauthFlowReady: false,
  webhookDispatcherReady: false,
  catalogSource: 'Integration Registry'
})
