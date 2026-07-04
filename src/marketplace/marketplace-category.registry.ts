import type { MarketplaceModule } from './marketplace.types'

export type MarketplaceWorkspaceCategoryKey =
  | 'all'
  | 'operation'
  | 'finance'
  | 'customer'
  | 'personnel'
  | 'inventory'
  | 'production'
  | 'reporting'
  | 'other'

export type MarketplaceWorkspaceCategoryDefinition = {
  key: MarketplaceWorkspaceCategoryKey
  label: string
  description: string
  displayOrder: number
  tags: string[]
}

const MARKETPLACE_WORKSPACE_CATEGORY_REGISTRY: MarketplaceWorkspaceCategoryDefinition[] = [
  {
    key: 'all',
    label: 'Tüm Modüller',
    description: 'Marketplace içindeki bütün iş ve entegrasyon modülleri.',
    displayOrder: 0,
    tags: []
  },
  {
    key: 'operation',
    label: 'Operasyon',
    description: 'Satış, sipariş, masa, QR ve günlük operasyon akışları.',
    displayOrder: 10,
    tags: ['operation', 'sales', 'ordering', 'qr', 'adisyon', 'siparis', 'masa']
  },
  {
    key: 'finance',
    label: 'Finans',
    description: 'Kasa, tahsilat, ödeme, cari ve finans yönetimi.',
    displayOrder: 20,
    tags: ['finance', 'cash', 'credit', 'collections', 'account', 'current', 'cari']
  },
  {
    key: 'customer',
    label: 'Müşteri',
    description: 'Müşteri, CRM, sadakat ve iletişim odaklı modüller.',
    displayOrder: 30,
    tags: ['customer', 'crm', 'communication', 'current', 'account']
  },
  {
    key: 'personnel',
    label: 'Personel',
    description: 'Personel, vardiya, puantaj ve performans modülleri.',
    displayOrder: 40,
    tags: ['personnel', 'hr', 'staff', 'employee']
  },
  {
    key: 'inventory',
    label: 'Stok',
    description: 'Stok, fire, SKT ve envanter yönetimi.',
    displayOrder: 50,
    tags: ['inventory', 'stock', 'waste', 'skt']
  },
  {
    key: 'production',
    label: 'Üretim',
    description: 'Reçete, maliyet, üretim ve tüketim süreçleri.',
    displayOrder: 60,
    tags: ['production', 'recipe', 'cost', 'uretim', 'recete']
  },
  {
    key: 'reporting',
    label: 'Raporlama',
    description: 'Raporlama, analitik ve karar destek modülleri.',
    displayOrder: 70,
    tags: ['reporting', 'analytics', 'alerts', 'executive']
  },
  {
    key: 'other',
    label: 'Diğer',
    description: 'Ana iş kategorilerinin dışında kalan modüller.',
    displayOrder: 90,
    tags: []
  }
]

const normalizeLookup = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()

const getModuleLookupText = (module: MarketplaceModule) => normalizeLookup([
  module.name,
  module.category,
  module.shortDescription,
  module.tags.join(' ')
].join(' '))

export const getMarketplaceWorkspaceCategories = () => {
  return [...MARKETPLACE_WORKSPACE_CATEGORY_REGISTRY]
    .sort((first, second) => first.displayOrder - second.displayOrder)
}

export const resolveMarketplaceWorkspaceCategory = (
  module: MarketplaceModule
): MarketplaceWorkspaceCategoryDefinition => {
  const lookupText = getModuleLookupText(module)
  const category = getMarketplaceWorkspaceCategories()
    .filter(item => item.key !== 'all' && item.key !== 'other')
    .find(item => item.tags.some(tag => lookupText.includes(normalizeLookup(tag))))

  return category || MARKETPLACE_WORKSPACE_CATEGORY_REGISTRY.find(item => item.key === 'other')!
}

export const filterMarketplaceModulesByWorkspaceCategory = (
  modules: MarketplaceModule[],
  categoryKey: MarketplaceWorkspaceCategoryKey
) => {
  if(categoryKey === 'all') return modules
  return modules.filter(module => resolveMarketplaceWorkspaceCategory(module).key === categoryKey)
}

export const countMarketplaceModulesByWorkspaceCategory = (
  modules: MarketplaceModule[],
  categoryKey: MarketplaceWorkspaceCategoryKey
) => filterMarketplaceModulesByWorkspaceCategory(modules, categoryKey).length
