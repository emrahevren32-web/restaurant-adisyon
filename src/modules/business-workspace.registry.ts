import type {
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'
import type { DashboardWidgetModuleContribution } from '../dashboard/dashboard-widget.types'
import type { LicenseModuleKey } from '../types'
import type {
  WorkspaceModuleLifecycle,
  WorkspaceModuleMenuItem,
  WorkspaceModuleRegistryItem,
  WorkspaceModuleType
} from './module-registry.types'
import { MODULE_SCOPES, WORKSPACE_MODULE_TYPES } from './module-registry.types'

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

const dashboardWidget = (widget: DashboardWidgetModuleContribution) => widget

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
  | 'scope'
> & Partial<Pick<
  BusinessWorkspaceModule,
  | 'moduleType'
  | 'isIntegrationModule'
  | 'isRequired'
  | 'isAlwaysActive'
  | 'isMarketplaceEligible'
  | 'lifecycle'
  | 'scope'
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
    scope: isCoreSystem ? MODULE_SCOPES.SYSTEM : MODULE_SCOPES.BUSINESS,
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
    dashboardWidgets: [
      dashboardWidget({
        id: 'dashboard.workspace-status',
        title: 'Dashboard Durumu',
        description: 'Workspace Dashboard yerleşimi, kullanılabilir widget kaynakları ve kurulu modül bağlantılarını özetler.',
        icon: 'DB',
        category: 'Sistem',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'dashboard.read',
        renderComponent: 'system.dashboard.workspaceStatus'
      })
    ],
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
    dashboardWidgets: [
      dashboardWidget({
        id: 'ai.platform-assistant',
        title: 'Workspace Asistanı',
        description: 'AI destekli öneri ve yönlendirme alanı için Dashboard başlangıç noktasıdır.',
        icon: 'AI',
        category: 'AI',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'dashboard.read',
        renderComponent: 'system.ai.platformAssistant'
      })
    ],
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
    dashboardWidgets: [
      dashboardWidget({
        id: 'operations.today',
        title: 'Bugünkü İşler',
        description: 'Gün içindeki açık işler ve tamamlanan akışlar için özet widget alanı.',
        icon: 'BI',
        category: 'Operasyon',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['compact', 'standard'],
        requiredPermission: 'operations.read',
        renderComponent: 'operations.today.placeholder'
      }),
      dashboardWidget({
        id: 'operations.pending',
        title: 'Bekleyen İşler',
        description: 'Henüz tamamlanmamış operasyon kayıtları için takip widget alanı.',
        icon: 'BE',
        category: 'Operasyon',
        order: 20,
        defaultVisible: false,
        defaultSize: 'small',
        supportedLayouts: ['compact', 'standard'],
        requiredPermission: 'operations.read',
        renderComponent: 'operations.pending.placeholder'
      })
    ],
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
    dashboardWidgets: [
      dashboardWidget({
        id: 'digital-requests.summary',
        title: 'Dijital Talepler',
        description: 'Dijital kanallardan gelen taleplerin Dashboard üzerinde izlenebileceği widget alanı.',
        icon: 'DT',
        category: 'Operasyon',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'digitalCatalog.requests.placeholder'
      })
    ],
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
    dashboardWidgets: [
      dashboardWidget({
        id: 'stock.critical',
        title: 'Kritik Stok',
        description: 'Kritik seviyeye yaklaşan stok kayıtları için izleme widget alanı.',
        icon: 'KS',
        category: 'Stok',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['compact', 'standard'],
        requiredPermission: 'stock.read',
        renderComponent: 'stock.critical.placeholder'
      }),
      dashboardWidget({
        id: 'stock.movements',
        title: 'Son Hareketler',
        description: 'Son stok hareketlerinin Dashboard üzerinde özetlenebileceği widget alanı.',
        icon: 'SH',
        category: 'Stok',
        order: 20,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'stock.read',
        renderComponent: 'stock.movements.placeholder'
      }),
      dashboardWidget({
        id: 'stock.locations',
        title: 'Depolar',
        description: 'Depo ve stok alanı görünümü için hazırlanmış Dashboard widget alanı.',
        icon: 'DP',
        category: 'Stok',
        order: 30,
        defaultVisible: false,
        defaultSize: 'small',
        supportedLayouts: ['compact', 'standard'],
        requiredPermission: 'stock.read',
        renderComponent: 'stock.locations.placeholder'
      }),
      dashboardWidget({
        id: 'stock.validity',
        title: 'Geçerlilik',
        description: 'Geçerlilik takibi yapılan kayıtların Dashboard üzerinde izlenebileceği widget alanı.',
        icon: 'GT',
        category: 'Stok',
        order: 40,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'stock.read',
        renderComponent: 'stock.validity.placeholder'
      })
    ],
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
    dashboardWidgets: [
      dashboardWidget({
        id: 'production.definitions',
        title: 'Üretim Tanımları',
        description: 'Üretim tanımları ve bağlı stok ilişkileri için Dashboard widget alanı.',
        icon: 'UT',
        category: 'Operasyon',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'products.read',
        renderComponent: 'production.definitions.placeholder'
      })
    ],
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
    dashboardWidgets: [
      dashboardWidget({
        id: 'current.summary',
        title: 'Cari Özeti',
        description: 'Cari kart ve hareketlerinin Dashboard üzerinde izlenebileceği özet widget alanı.',
        icon: 'CK',
        category: 'Cari',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'finance.read',
        renderComponent: 'current.summary.placeholder'
      }),
      dashboardWidget({
        id: 'current.risk',
        title: 'Riskli Cari',
        description: 'Riskli cari kayıtları için hazırlanmış Dashboard takip widget alanı.',
        icon: 'RC',
        category: 'Cari',
        order: 20,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['compact', 'standard'],
        requiredPermission: 'finance.read',
        renderComponent: 'current.risk.placeholder'
      })
    ],
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
    dashboardWidgets: [
      dashboardWidget({
        id: 'credit.collections',
        title: 'Tahsilat Takibi',
        description: 'Tahsilat bekleyen kayıtlar için Dashboard widget alanı.',
        icon: 'TH',
        category: 'Cari',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'finance.read',
        renderComponent: 'credit.collections.placeholder'
      })
    ],
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
    dashboardWidgets: [
      dashboardWidget({
        id: 'finance.cash-status',
        title: 'Kasa Durumu',
        description: 'Kasa hareketleri ve güncel finans görünümü için Dashboard widget alanı.',
        icon: 'KH',
        category: 'Finans',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['compact', 'standard'],
        requiredPermission: 'finance.read',
        renderComponent: 'finance.cashStatus.placeholder'
      }),
      dashboardWidget({
        id: 'finance.income-expense',
        title: 'Gelir Gider Özeti',
        description: 'Gelir ve gider kayıtlarının Dashboard üzerinde özetlenebileceği widget alanı.',
        icon: 'GG',
        category: 'Finans',
        order: 20,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'finance.read',
        renderComponent: 'finance.incomeExpense.placeholder'
      })
    ],
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
    dashboardWidgets: [
      dashboardWidget({
        id: 'personnel.total',
        title: 'Toplam Personel',
        description: 'Workspace personel kayıtları için Dashboard özet widget alanı.',
        icon: 'TP',
        category: 'Personel',
        order: 10,
        defaultVisible: false,
        defaultSize: 'small',
        supportedLayouts: ['compact', 'standard'],
        requiredPermission: 'personnel.read',
        renderComponent: 'personnel.total.placeholder'
      }),
      dashboardWidget({
        id: 'personnel.leave-today',
        title: 'Bugün İzinli',
        description: 'Günlük izin durumlarını Dashboard üzerinde izlemek için widget alanı.',
        icon: 'IZ',
        category: 'Personel',
        order: 20,
        defaultVisible: false,
        defaultSize: 'small',
        supportedLayouts: ['compact', 'standard'],
        requiredPermission: 'personnel.read',
        renderComponent: 'personnel.leaveToday.placeholder'
      }),
      dashboardWidget({
        id: 'personnel.shift-summary',
        title: 'Mesai Özeti',
        description: 'Vardiya ve puantaj durumları için Dashboard widget alanı.',
        icon: 'MO',
        category: 'Personel',
        order: 30,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'personnel.read',
        renderComponent: 'personnel.shiftSummary.placeholder'
      }),
      dashboardWidget({
        id: 'personnel.new-records',
        title: 'Yeni Personeller',
        description: 'Son eklenen personel kayıtları için hazırlanmış Dashboard widget alanı.',
        icon: 'YP',
        category: 'Personel',
        order: 40,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'personnel.read',
        renderComponent: 'personnel.newRecords.placeholder'
      })
    ],
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
    dashboardWidgets: [
      dashboardWidget({
        id: 'branches.summary',
        title: 'Şube Özeti',
        description: 'Çoklu lokasyon görünümü ve merkez yönetim özetleri için Dashboard widget alanı.',
        icon: 'SO',
        category: 'Sistem',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'company.read',
        renderComponent: 'branches.summary.placeholder'
      })
    ],
    menuItems: [
      menuItem({ key: 'branch-permissions', label: 'Şube Yetkilendirme', route: 'branch-permissions', icon: 'SY', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'branch-reporting', label: 'Şubeler Arası Raporlama', route: 'branch-reporting', icon: 'SR', adminOnly: true, displayOrder: 20 }),
      menuItem({ key: 'branch-stock-transfers', label: 'Şubeler Arası Stok Transferi', route: 'branch-stock-transfers', icon: 'ST', adminOnly: true, displayOrder: 30 }),
      menuItem({ key: 'head-office-management', label: 'Merkez Ofis Yönetimi', route: 'head-office-management', icon: 'MO', adminOnly: true, displayOrder: 40 })
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
    dashboardWidgets: [
      dashboardWidget({
        id: 'manager.alerts',
        title: 'Yönetici Uyarıları',
        description: 'Kritik uyarı ve aksiyon önerilerinin Dashboard üzerinde izlenebileceği widget alanı.',
        icon: 'YU',
        category: 'Sistem',
        order: 10,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'dashboard.read',
        renderComponent: 'manager.alerts.placeholder'
      })
    ],
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
