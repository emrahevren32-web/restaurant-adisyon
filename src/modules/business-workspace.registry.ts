import type {
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'
import type { LicenseModuleKey } from '../types'
import type {
  WorkspaceModuleLifecycle,
  WorkspaceModuleMenuItem,
  WorkspaceModuleRegistryItem,
  WorkspaceModuleType
} from './module-registry.types'
import { WORKSPACE_MODULE_TYPES } from './module-registry.types'

const includedPricing = { model: 'included' as const }
const marketplaceReady = {
  isMarketplaceReady: true,
  canBePurchased: false,
  canBeActivated: true
}
const coreSystemMarketplace = {
  isMarketplaceReady: false,
  canBePurchased: false,
  canBeActivated: false
}
const coreSystemLifecycle: WorkspaceModuleLifecycle = {
  availability: 'mandatory',
  activationPolicy: 'always-on',
  canBeDisabled: false,
  canBeDetachedFromWorkspace: false,
  canBePurchased: false,
  canBeActivatedManually: false
}
const businessModuleLifecycle: WorkspaceModuleLifecycle = {
  availability: 'optional',
  activationPolicy: 'license-controlled',
  canBeDisabled: true,
  canBeDetachedFromWorkspace: true,
  canBePurchased: true,
  canBeActivatedManually: true
}
const integrationModuleLifecycle: WorkspaceModuleLifecycle = {
  availability: 'optional',
  activationPolicy: 'external-controlled',
  canBeDisabled: true,
  canBeDetachedFromWorkspace: true,
  canBePurchased: true,
  canBeActivatedManually: true
}

const menuItem = (
  item: WorkspaceModuleMenuItem<BusinessWorkspaceRoute, BusinessWorkspaceNavKey>
) => item

export type BusinessWorkspaceModule = WorkspaceModuleRegistryItem<
  BusinessWorkspaceRoute,
  BusinessWorkspaceNavKey
>

type LegacyWorkspaceModuleCategory = WorkspaceModuleType | 'system'

type BusinessWorkspaceModuleInput = Omit<
  BusinessWorkspaceModule,
  | 'category'
  | 'moduleType'
  | 'isIntegrationModule'
  | 'isRequired'
  | 'isAlwaysActive'
  | 'isMarketplaceEligible'
  | 'lifecycle'
> & Partial<Pick<
  BusinessWorkspaceModule,
  | 'moduleType'
  | 'isIntegrationModule'
  | 'isRequired'
  | 'isAlwaysActive'
  | 'isMarketplaceEligible'
  | 'lifecycle'
>> & {
  category: LegacyWorkspaceModuleCategory
}

const resolveModuleType = (module: BusinessWorkspaceModuleInput): WorkspaceModuleType => {
  if(module.moduleType) return module.moduleType
  if(module.category === WORKSPACE_MODULE_TYPES.CORE_SYSTEM || module.category === 'system'){
    return WORKSPACE_MODULE_TYPES.CORE_SYSTEM
  }
  if(module.category === WORKSPACE_MODULE_TYPES.INTEGRATION){
    return WORKSPACE_MODULE_TYPES.INTEGRATION
  }
  return WORKSPACE_MODULE_TYPES.BUSINESS
}

const normalizeModuleRegistryItem = (module: BusinessWorkspaceModuleInput): BusinessWorkspaceModule => {
  const moduleType = resolveModuleType(module)
  const isCoreSystem = moduleType === WORKSPACE_MODULE_TYPES.CORE_SYSTEM
  const isBusinessModule = moduleType === WORKSPACE_MODULE_TYPES.BUSINESS
  const isIntegrationModule = moduleType === WORKSPACE_MODULE_TYPES.INTEGRATION
  const baseLifecycle = isCoreSystem
    ? coreSystemLifecycle
    : isIntegrationModule
      ? integrationModuleLifecycle
      : businessModuleLifecycle
  const lifecycle = isCoreSystem
    ? coreSystemLifecycle
    : {
      ...baseLifecycle,
      canBePurchased: module.marketplace?.canBePurchased ?? baseLifecycle.canBePurchased,
      canBeActivatedManually: module.marketplace?.canBeActivated ?? baseLifecycle.canBeActivatedManually
    }

  return {
    ...module,
    category: moduleType,
    moduleType,
    isCoreModule: isCoreSystem,
    isBusinessModule,
    isIntegrationModule,
    isRequired: isCoreSystem,
    isAlwaysActive: isCoreSystem,
    isMarketplaceEligible: !isCoreSystem,
    isEnabled: isCoreSystem ? true : module.isEnabled,
    isVisible: isCoreSystem ? true : module.isVisible,
    lifecycle,
    pricing: isCoreSystem ? includedPricing : module.pricing,
    marketplace: isCoreSystem ? coreSystemMarketplace : module.marketplace,
    menuItems: isCoreSystem
      ? module.menuItems.map(item => ({
        ...item,
        locked: false,
        hidden: false,
        disabledReason: ''
      }))
      : module.menuItems
  }
}

const defineModuleRegistry = (modules: BusinessWorkspaceModuleInput[]): BusinessWorkspaceModule[] => {
  return modules.map(normalizeModuleRegistryItem)
}

export const BUSINESS_WORKSPACE_MODULE_REGISTRY: BusinessWorkspaceModule[] = defineModuleRegistry([
  {
    id: 'system-workspace-welcome',
    code: 'workspace-welcome',
    name: 'Workspace Welcome',
    description: 'Yeni Business Workspace ilk açılış deneyimini ve Marketplace başlangıç yönlendirmesini gösterir.',
    category: 'system',
    icon: 'WW',
    route: 'workspace-welcome',
    permissions: ['company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 5,
    dependencies: ['workspace'],
    tags: ['system', 'workspace', 'welcome', 'marketplace'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'workspace-welcome', label: 'Welcome', route: 'workspace-welcome', icon: 'WW', adminOnly: true, displayOrder: 5 })
    ]
  },
  {
    id: 'system-dashboard',
    code: 'dashboard',
    name: 'Dashboard',
    description: 'Business Workspace genel durum ve günlük operasyon özetini gösterir.',
    category: 'system',
    icon: 'DB',
    route: 'summary',
    permissions: ['dashboard.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 10,
    dependencies: [],
    tags: ['system', 'overview', 'workspace'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'dashboard', label: 'Dashboard', route: 'summary', icon: 'DB', adminOnly: true, displayOrder: 10 })
    ]
  },
  {
    id: 'system-workspace',
    code: 'workspace',
    name: 'Workspace',
    description: 'Business Workspace kimliği, temel profil bilgisi ve çalışma alanı bağlamını yönetir.',
    category: 'system',
    icon: 'WS',
    route: 'settings',
    permissions: ['company.read', 'company.manage'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 15,
    dependencies: [],
    tags: ['system', 'workspace', 'tenant', 'profile'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'workspace', label: 'Workspace', route: 'settings', icon: 'WS', adminOnly: true, displayOrder: 15 })
    ]
  },
  {
    id: 'system-marketplace',
    code: 'marketplace',
    name: 'Marketplace',
    description: 'Business Workspace için iş ve entegrasyon modül kataloğunu gösterir.',
    category: 'system',
    icon: 'MP',
    route: 'marketplace',
    permissions: ['company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 18,
    dependencies: ['workspace', 'license'],
    tags: ['system', 'marketplace', 'module-catalog'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'marketplace', label: 'Marketplace', route: 'marketplace', icon: 'MP', adminOnly: true, displayOrder: 18 })
    ]
  },
  {
    id: 'system-integration-center',
    code: 'integration-center',
    name: 'Entegrasyon Merkezi',
    description: 'Business Workspace ile dış sistemler arasındaki soyut entegrasyon kataloğunu ve bağlantı altyapısını yönetir.',
    category: 'system',
    icon: 'EN',
    route: 'integration-center',
    permissions: ['company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 19,
    dependencies: ['workspace', 'marketplace'],
    tags: ['system', 'integration', 'external-systems', 'registry'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'integration-center', label: 'Entegrasyon Merkezi', route: 'integration-center', icon: 'EN', adminOnly: true, displayOrder: 19 })
    ]
  },
  {
    id: 'system-executive-center',
    code: 'executive-center',
    name: 'Yönetici Merkezi',
    description: 'İşletme sahibi için yönetim özeti, uyarılar ve karar destek merkezi.',
    category: 'system',
    icon: 'YM',
    route: 'business-summary',
    permissions: ['dashboard.read', 'company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 20,
    dependencies: ['dashboard'],
    tags: ['system', 'executive', 'owner'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'business-summary', label: 'Yönetici Merkezi', route: 'business-summary', icon: 'YM', adminOnly: true, displayOrder: 20 })
    ]
  },
  {
    id: 'system-users',
    code: 'users',
    name: 'Kullanıcılar',
    description: 'Workspace kullanıcılarının yönetildiği zorunlu sistem modülü.',
    category: 'system',
    icon: 'KU',
    route: 'users',
    permissions: ['company.manage'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 30,
    dependencies: [],
    tags: ['system', 'identity', 'users'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'users', label: 'Kullanıcılar', route: 'users', icon: 'KU', adminOnly: true, displayOrder: 30 })
    ]
  },
  {
    id: 'system-roles',
    code: 'roles',
    name: 'Roller',
    description: 'Rol ve yetki modelinin Business Workspace içinde yönetilmesini sağlar.',
    category: 'system',
    icon: 'RL',
    route: 'users',
    permissions: ['company.manage'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 40,
    dependencies: ['users'],
    tags: ['system', 'authorization', 'roles'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'roles', label: 'Roller', route: 'users', icon: 'RL', adminOnly: true, displayOrder: 40 })
    ]
  },
  {
    id: 'system-branches',
    code: 'branches',
    name: 'Şubeler',
    description: 'Her işletmenin temel şube yapısını yöneten sistem modülü.',
    category: 'system',
    icon: 'SB',
    route: 'branches',
    permissions: ['company.manage'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 50,
    dependencies: [],
    tags: ['system', 'branches', 'workspace'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'branches', label: 'Şubeler', route: 'branches', icon: 'SB', adminOnly: true, displayOrder: 50 })
    ]
  },
  {
    id: 'system-notifications',
    code: 'notifications',
    name: 'Bildirimler',
    description: 'Workspace bildirimleri için merkezi sistem modülü.',
    category: 'system',
    icon: 'BD',
    route: 'settings',
    permissions: ['company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 60,
    dependencies: [],
    tags: ['system', 'notifications'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'notifications', label: 'Bildirimler', route: 'settings', icon: 'BD', adminOnly: true, displayOrder: 60 })
    ]
  },
  {
    id: 'system-license',
    code: 'license',
    name: 'Lisans',
    description: 'Workspace lisans kapsamını ve modül erişim temelini gösterir.',
    category: 'system',
    icon: 'LS',
    route: 'settings',
    permissions: ['company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 70,
    dependencies: [],
    tags: ['system', 'license', 'modules'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'license', label: 'Lisans', route: 'settings', icon: 'LS', adminOnly: true, displayOrder: 70 })
    ]
  },
  {
    id: 'system-subscription',
    code: 'subscription',
    name: 'Abonelik',
    description: 'Abonelik ve kullanım haklarının yönetileceği sistem modülü.',
    category: 'system',
    icon: 'AB',
    route: 'settings',
    permissions: ['company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 80,
    dependencies: ['license'],
    tags: ['system', 'subscription', 'billing'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'subscription', label: 'Abonelik', route: 'settings', icon: 'AB', adminOnly: true, displayOrder: 80 })
    ]
  },
  {
    id: 'system-audit',
    code: 'audit',
    name: 'Audit',
    description: 'Workspace içindeki kritik kullanıcı işlemlerinin denetlendiği çekirdek audit kaydı.',
    category: 'system',
    icon: 'AU',
    route: 'actions',
    permissions: ['company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 90,
    dependencies: [],
    tags: ['system', 'audit', 'history', 'governance'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'action-history', label: 'Audit', route: 'actions', icon: 'AU', adminOnly: true, displayOrder: 90 })
    ]
  },
  {
    id: 'system-settings',
    code: 'settings',
    name: 'Sistem Ayarları',
    description: 'Workspace profil, görünüm ve veri yönetimi ayarlarını toplar.',
    category: 'system',
    icon: 'SA',
    route: 'settings',
    permissions: ['company.manage'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 100,
    dependencies: [],
    tags: ['system', 'settings', 'workspace'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'settings', label: 'Sistem Ayarları', route: 'settings', icon: 'SA', adminOnly: true, displayOrder: 100 })
    ]
  },
  {
    id: 'system-support',
    code: 'support',
    name: 'Destek',
    description: 'Destek taleplerinin workspace içinden yönetileceği sistem modülü.',
    category: 'system',
    icon: 'DT',
    route: 'settings',
    permissions: ['company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 110,
    dependencies: [],
    tags: ['system', 'support'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'support', label: 'Destek', route: 'settings', icon: 'DT', adminOnly: true, displayOrder: 110 })
    ]
  },
  {
    id: 'system-ai-center',
    code: 'ai-center',
    name: 'AI Merkezi',
    description: 'AI destekli sistem önerileri ve otomasyonlar için hazırlanmış modül yuvası.',
    category: 'system',
    icon: 'AI',
    route: 'settings',
    permissions: ['dashboard.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 120,
    dependencies: ['dashboard'],
    tags: ['system', 'ai', 'future'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'ai-center', label: 'AI Merkezi', route: 'settings', icon: 'AI', adminOnly: true, displayOrder: 120 })
    ]
  },
  {
    id: 'business-adisyon',
    code: 'adisyon',
    name: 'İşlem Yönetimi',
    description: 'Alan, ürün/hizmet, hazırlık ve işlem akışlarını yöneten iş modülü.',
    category: 'business',
    icon: 'AD',
    route: 'tables',
    permissions: ['operations.read', 'operations.write'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 10,
    dependencies: [],
    tags: ['business', 'operation', 'sales'],
    licenseModuleKey: 'adisyon',
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    menuItems: [
      menuItem({ key: 'tables-management', label: 'Alanlar', route: 'tables', icon: 'AL', displayOrder: 10 }),
      menuItem({ key: 'adisyon', label: 'İşlemler', route: 'tables', icon: 'IS', displayOrder: 20 }),
      menuItem({ key: 'products', label: 'Ürün / Hizmetler', route: 'products', icon: 'UH', displayOrder: 30 }),
      menuItem({ key: 'kitchen', label: 'Hazırlık Ekranı', route: 'kitchen', icon: 'HZ', displayOrder: 40 }),
      menuItem({ key: 'bill-history', label: 'Geçmiş', route: 'history', icon: 'AG', adminOnly: true, displayOrder: 50 }),
      menuItem({
        key: 'adisyon-reports',
        label: 'Raporlar',
        icon: 'RP',
        adminOnly: true,
        displayOrder: 60,
        children: [
          menuItem({ key: 'sales-revenue-analysis', label: 'Gelir Analizi', route: 'sales-revenue-analysis', icon: 'GA', adminOnly: true, displayOrder: 10 }),
          menuItem({ key: 'product-performance-analysis', label: 'Ürün / Hizmet Analizi', route: 'product-performance-analysis', icon: 'UH', adminOnly: true, displayOrder: 20 })
        ]
      })
    ]
  },
  {
    id: 'business-qr-menu',
    code: 'qr-menu',
    name: 'Dijital Katalog',
    description: 'Dijital katalog, talep ve görevli çağrısı akışlarını yönetir.',
    category: 'business',
    icon: 'QR',
    route: 'qr-orders',
    permissions: ['operations.read', 'operations.write'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 20,
    dependencies: ['adisyon'],
    tags: ['business', 'qr', 'ordering'],
    licenseModuleKey: 'qr-menu',
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    menuItems: [
      menuItem({ key: 'qr-orders', label: 'Dijital Talepler', route: 'qr-orders', icon: 'DT', displayOrder: 10 }),
      menuItem({ key: 'waiter-calls', label: 'Görevli Çağrıları', route: 'qr-orders', icon: 'GC', displayOrder: 20 }),
      menuItem({ key: 'qr-codes', label: 'QR Kodlar', route: 'qr-codes', icon: 'QK', adminOnly: true, displayOrder: 30 })
    ]
  },
  {
    id: 'business-stock',
    code: 'stock',
    name: 'Stok',
    description: 'Stok kartları, hareketleri, kritik stok, geçerlilik ve kayıp yönetimini kapsar.',
    category: 'business',
    icon: 'SK',
    route: 'stock-cards',
    permissions: ['stock.read', 'stock.write'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 30,
    dependencies: [],
    tags: ['business', 'inventory'],
    licenseModuleKey: 'stock',
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    menuItems: [
      menuItem({ key: 'stock-cards', label: 'Kartlar', route: 'stock-cards', icon: 'SK', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'stock-movements', label: 'Hareketler', route: 'stock-movements', icon: 'SH', adminOnly: true, displayOrder: 20 }),
      menuItem({ key: 'critical-stock', label: 'Kritik Stok', route: 'stock-cards', icon: 'KS', adminOnly: true, displayOrder: 30 }),
      menuItem({ key: 'expiry-lots', label: 'Geçerlilik Takibi', route: 'stock-cards', icon: 'GT', adminOnly: true, displayOrder: 40 }),
      menuItem({ key: 'waste', label: 'Kayıp Analizi', route: 'stock-movements', icon: 'KA', adminOnly: true, displayOrder: 50 }),
      menuItem({
        key: 'stock-reports',
        label: 'Raporlar',
        icon: 'RP',
        adminOnly: true,
        displayOrder: 60,
        children: [
          menuItem({ key: 'stock-risk-center', label: 'Stok ve Risk', route: 'stock-risk-center', icon: 'SR', adminOnly: true, displayOrder: 10 })
        ]
      })
    ]
  },
  {
    id: 'business-recipe',
    code: 'recipe',
    name: 'Üretim Tanımları',
    description: 'Ürün/hizmet üretim tanımları ve stok tüketim ilişkisini yöneten iş modülü.',
    category: 'business',
    icon: 'RC',
    route: 'recipes',
    permissions: ['products.read', 'products.write', 'stock.read'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 40,
    dependencies: ['stock', 'adisyon'],
    tags: ['business', 'recipe', 'cost'],
    licenseModuleKey: 'recipe',
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    menuItems: [
      menuItem({ key: 'recipes', label: 'Üretim Tanımları', route: 'recipes', icon: 'UT', adminOnly: true, displayOrder: 10 })
    ]
  },
  {
    id: 'business-current',
    code: 'current',
    name: 'Cari',
    description: 'Cari kart, cari hareket, risk ve cari raporlama süreçlerini yönetir.',
    category: 'business',
    icon: 'CK',
    route: 'current-accounts',
    permissions: ['finance.read', 'finance.write'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 50,
    dependencies: [],
    tags: ['business', 'account', 'current'],
    licenseModuleKey: 'current',
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    menuItems: [
      menuItem({ key: 'current-accounts', label: 'Kartlar', route: 'current-accounts', icon: 'CK', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'current-account-movements', label: 'Hareketler', route: 'current-account-movements', icon: 'CH', adminOnly: true, displayOrder: 20 }),
      menuItem({
        key: 'current-reports',
        label: 'Raporlar',
        icon: 'CR',
        adminOnly: true,
        displayOrder: 30,
        children: [
          menuItem({ key: 'current-report', label: 'Cari Raporu', route: 'current-report', icon: 'CR', adminOnly: true, displayOrder: 10 }),
          menuItem({ key: 'risky-current', label: 'Riskli Cari', route: 'risky-current', icon: 'RC', adminOnly: true, displayOrder: 20 }),
          menuItem({ key: 'current-finance-center', label: 'Cari Finans Merkezi', route: 'current-finance-center', icon: 'CF', adminOnly: true, displayOrder: 30 })
        ]
      })
    ]
  },
  {
    id: 'business-credit',
    code: 'credit',
    name: 'Veresiye',
    description: 'Veresiye işlem ve tahsilat takiplerini Cari modülünün tamamlayıcı parçası olarak sunar.',
    category: 'business',
    icon: 'VI',
    route: 'credit-transactions',
    permissions: ['finance.read', 'finance.write'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 60,
    dependencies: ['current'],
    tags: ['business', 'credit', 'collections'],
    licenseModuleKey: 'credit',
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    menuItems: [
      menuItem({ key: 'credit-transactions', label: 'İşlemler', route: 'credit-transactions', icon: 'VI', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'collection-transactions', label: 'Tahsilat', route: 'collection-transactions', icon: 'TI', adminOnly: true, displayOrder: 20 })
    ]
  },
  {
    id: 'business-finance',
    code: 'finance',
    name: 'Finans',
    description: 'Kasa, tedarikçi, gelir-gider, gün sonu ve finans raporlarını yönetir.',
    category: 'business',
    icon: 'FN',
    route: 'cash-transactions',
    permissions: ['finance.read', 'finance.write'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 70,
    dependencies: [],
    tags: ['business', 'finance', 'cash'],
    licenseModuleKey: 'finance',
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    menuItems: [
      menuItem({ key: 'supplier-debts', label: 'Tedarikçi Borçları', route: 'supplier-debts', icon: 'TB', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'supplier-payments', label: 'Tedarikçi Ödemeleri', route: 'supplier-payments', icon: 'TO', adminOnly: true, displayOrder: 20 }),
      menuItem({ key: 'cash-transactions', label: 'Kasa Hareketleri', route: 'cash-transactions', icon: 'KH', adminOnly: true, displayOrder: 30 }),
      menuItem({ key: 'income-expense', label: 'Gelir Gider', route: 'income-expense', icon: 'GG', adminOnly: true, displayOrder: 40 }),
      menuItem({ key: 'cash-closing', label: 'Gün Sonu', route: 'cash-closing', icon: 'GS', adminOnly: true, displayOrder: 50 }),
      menuItem({ key: 'cash-transfers', label: 'Kasa Devir', route: 'cash-transfers', icon: 'KD', adminOnly: true, displayOrder: 60 }),
      menuItem({
        key: 'finance-reports',
        label: 'Raporlar',
        icon: 'FR',
        adminOnly: true,
        displayOrder: 70,
        children: [
          menuItem({ key: 'financial-reports', label: 'Finans Raporları', route: 'financial-reports', icon: 'FR', adminOnly: true, displayOrder: 10 })
        ]
      })
    ]
  },
  {
    id: 'business-personnel',
    code: 'personnel',
    name: 'Personel',
    description: 'Personel kartları, vardiya, puantaj, performans ve denetim süreçlerini yönetir.',
    category: 'business',
    icon: 'PK',
    route: 'employee-cards',
    permissions: ['personnel.read', 'personnel.manage'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 80,
    dependencies: [],
    tags: ['business', 'personnel', 'hr'],
    licenseModuleKey: 'personnel',
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    menuItems: [
      menuItem({ key: 'employee-cards', label: 'Kartlar', route: 'employee-cards', icon: 'PK', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'shift-management', label: 'Vardiya', route: 'shift-management', icon: 'VY', adminOnly: true, displayOrder: 20 }),
      menuItem({ key: 'attendance-tracking', label: 'Puantaj', route: 'attendance-tracking', icon: 'PM', adminOnly: true, displayOrder: 30 }),
      menuItem({ key: 'employee-performance', label: 'Performans', route: 'employee-performance', icon: 'PF', adminOnly: true, displayOrder: 40 }),
      menuItem({ key: 'employee-bonus', label: 'Prim', route: 'employee-bonus', icon: 'PR', adminOnly: true, displayOrder: 50 }),
      menuItem({ key: 'employee-audit', label: 'Disiplin', route: 'employee-audit', icon: 'DD', adminOnly: true, displayOrder: 60 }),
      menuItem({
        key: 'personnel-reports',
        label: 'Raporlar',
        icon: 'RA',
        adminOnly: true,
        displayOrder: 70,
        children: [
          menuItem({ key: 'employee-reports', label: 'Personel Raporları', route: 'employee-reports', icon: 'RA', adminOnly: true, displayOrder: 10 })
        ]
      }),
      menuItem({ key: 'staff', label: 'Takip', route: 'staff', icon: 'PT', adminOnly: true, displayOrder: 80 })
    ]
  },
  {
    id: 'business-multi-branch',
    code: 'multi-branch',
    name: 'Çoklu Şube',
    description: 'Şube raporlama, şubeler arası stok transferi ve merkez ofis yönetimini kapsar.',
    category: 'business',
    icon: 'CS',
    route: 'branch-reporting',
    permissions: ['company.read', 'company.manage'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 90,
    dependencies: ['branches'],
    tags: ['business', 'branch', 'multi-location'],
    licenseModuleKey: 'multi-branch',
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    menuItems: [
      menuItem({ key: 'branch-permissions', label: 'Şube Yetkilendirme', route: 'branch-permissions', icon: 'SY', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'branch-reporting', label: 'Şubeler Arası Raporlama', route: 'branch-reporting', icon: 'SR', adminOnly: true, displayOrder: 20 }),
      menuItem({ key: 'branch-stock-transfers', label: 'Şubeler Arası Stok Transferi', route: 'branch-stock-transfers', icon: 'ST', adminOnly: true, displayOrder: 30 }),
      menuItem({ key: 'head-office-management', label: 'Merkez Ofis Yönetimi', route: 'head-office-management', icon: 'MO', adminOnly: true, displayOrder: 40 })
    ]
  },
  {
    id: 'business-reporting',
    code: 'reporting-analytics',
    name: 'Raporlama',
    description: 'Rapor merkezi, analitik dashboard ve performans analizlerini tek modül altında toplar.',
    category: 'business',
    icon: 'RP',
    route: 'reports',
    permissions: ['dashboard.read'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: false,
    displayOrder: 100,
    dependencies: ['dashboard'],
    tags: ['business', 'reporting', 'analytics'],
    licenseModuleKey: 'analytics',
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    menuItems: [
      menuItem({ key: 'reports', label: 'Rapor Merkezi', route: 'reports', icon: 'RM', adminOnly: true, hidden: true, displayOrder: 10 }),
      menuItem({ key: 'analytics-dashboard', label: 'Analitik Dashboard', route: 'analytics-dashboard', icon: 'AD', adminOnly: true, hidden: true, displayOrder: 20 }),
      menuItem({ key: 'system-health-telemetry', label: 'Sistem Sağlığı ve Telemetri', route: 'system-health-telemetry', icon: 'ST', adminOnly: true, hidden: true, displayOrder: 60 }),
      menuItem({ key: 'system-usage-logs', label: 'Sistem Kullanım Logları', route: 'system-usage-logs', icon: 'SL', adminOnly: true, hidden: true, displayOrder: 70 }),
      menuItem({ key: 'user-activity-tracking', label: 'Kullanıcı Aktivite Takibi', route: 'user-activity-tracking', icon: 'KA', adminOnly: true, hidden: true, displayOrder: 80 }),
      menuItem({ key: 'module-usage-analysis', label: 'Modül Kullanım Analizleri', route: 'module-usage-analysis', icon: 'MA', adminOnly: true, hidden: true, displayOrder: 90 }),
      menuItem({ key: 'business-usage-stats', label: 'İşletme Kullanım İstatistikleri', route: 'business-usage-stats', icon: 'IK', adminOnly: true, hidden: true, displayOrder: 100 }),
      menuItem({ key: 'usage-performance-analysis', label: 'Performans ve Yoğunluk Analizleri', route: 'usage-performance-analysis', icon: 'PY', adminOnly: true, hidden: true, displayOrder: 110 })
    ]
  },
  {
    id: 'business-manager-alerts',
    code: 'manager-alerts',
    name: 'Yönetici Uyarı Merkezi',
    description: 'İşletme yöneticisi için kritik uyarı ve aksiyon önerilerini gösterir.',
    category: 'business',
    icon: 'YU',
    route: 'manager-alert-center',
    permissions: ['dashboard.read'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 110,
    dependencies: ['dashboard'],
    tags: ['business', 'alerts', 'executive'],
    licenseModuleKey: 'boss-dashboard',
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    menuItems: [
      menuItem({ key: 'manager-alert-center', label: 'Yönetici Uyarı Merkezi', route: 'manager-alert-center', icon: 'YU', adminOnly: true, displayOrder: 10 })
    ]
  }
])

const compareByDisplayOrder = <T extends { displayOrder: number }>(first: T, second: T) => {
  return first.displayOrder - second.displayOrder
}

export const getBusinessWorkspaceModules = (moduleType?: WorkspaceModuleType) => {
  return BUSINESS_WORKSPACE_MODULE_REGISTRY
    .filter(module => module.isEnabled && module.isVisible && (!moduleType || module.moduleType === moduleType))
    .sort(compareByDisplayOrder)
}

export const getCoreSystemModules = () => getBusinessWorkspaceModules(WORKSPACE_MODULE_TYPES.CORE_SYSTEM)
export const getBusinessModules = () => getBusinessWorkspaceModules(WORKSPACE_MODULE_TYPES.BUSINESS)
export const getIntegrationModules = () => getBusinessWorkspaceModules(WORKSPACE_MODULE_TYPES.INTEGRATION)

export const getBusinessWorkspaceModuleByCode = (code: string) => {
  return BUSINESS_WORKSPACE_MODULE_REGISTRY.find(module => module.code === code)
}

export const getBusinessWorkspaceModuleById = (id: string) => {
  return BUSINESS_WORKSPACE_MODULE_REGISTRY.find(module => module.id === id)
}

export const getBusinessWorkspaceModuleByLicenseKey = (moduleKey: LicenseModuleKey) => {
  return BUSINESS_WORKSPACE_MODULE_REGISTRY.find(module => module.licenseModuleKey === moduleKey)
}

const flattenWorkspaceModuleMenuItems = (
  items: WorkspaceModuleMenuItem<BusinessWorkspaceRoute, BusinessWorkspaceNavKey>[]
): WorkspaceModuleMenuItem<BusinessWorkspaceRoute, BusinessWorkspaceNavKey>[] => (
  items.flatMap(item => [
    item,
    ...flattenWorkspaceModuleMenuItems(item.children || [])
  ])
)

export const getBusinessWorkspaceMenuItems = (moduleType: WorkspaceModuleType) => {
  return getBusinessWorkspaceModules(moduleType)
    .flatMap(module => flattenWorkspaceModuleMenuItems(module.menuItems)
      .filter(item => !item.hidden)
      .sort((first, second) => (first.displayOrder || 0) - (second.displayOrder || 0))
    )
}
