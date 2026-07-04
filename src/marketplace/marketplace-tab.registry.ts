import type { MarketplaceCatalogTabDefinition } from './marketplace.types'

const MARKETPLACE_CATALOG_TAB_REGISTRY: MarketplaceCatalogTabDefinition[] = [
  {
    key: 'recommended',
    label: 'Önerilen',
    description: 'Workspace kurulumuna başlamak için önerilen modüller.',
    displayOrder: 10
  },
  {
    key: 'installed',
    label: 'Kurulu',
    description: 'Kurulu, yapılandırılmış, aktif veya pasif modüller.',
    displayOrder: 20
  },
  {
    key: 'not-installed',
    label: 'Kurulu Değil',
    description: 'Henüz kurulmamış veya Workspace kullanımından kaldırılmış modüller.',
    displayOrder: 30
  },
  {
    key: 'coming-soon',
    label: 'Yakında',
    description: 'Katalogda görünen ancak henüz kuruluma açılmayan modüller.',
    displayOrder: 40
  }
]

export const getMarketplaceCatalogTabs = () => {
  return [...MARKETPLACE_CATALOG_TAB_REGISTRY]
    .sort((first, second) => first.displayOrder - second.displayOrder)
}
