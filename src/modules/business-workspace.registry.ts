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
import { LICENSE_MODULE_CODES, SECTOR_TEMPLATE_MODULE_CODES, WORKSPACE_MODULE_CODES } from './module-code.registry'
import { MODULE_SCOPES, WORKSPACE_MODULE_TYPES } from './module-registry.types'
import { SECTOR_CODES, createSectorId } from '../sector/sector.registry'
import type {
  ProvisionManifest,
  ProvisionManifestMenuItem
} from '../workspace-provisioning/provision-manifest.types'

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
const industrialKitchenSectorIds = [createSectorId(SECTOR_CODES.INDUSTRIAL_KITCHEN)]

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
  | 'provisionManifest'
> & Partial<Pick<
  BusinessWorkspaceModule,
  | 'moduleType'
  | 'isIntegrationModule'
  | 'isRequired'
  | 'isAlwaysActive'
  | 'isMarketplaceEligible'
  | 'lifecycle'
  | 'scope'
  | 'provisionManifest'
>> & {
  category: LegacyWorkspaceModuleCategory
}

const cloneProvisionMenuItems = (
  items: BusinessWorkspaceModule['menuItems']
): ProvisionManifestMenuItem[] => (
  items.map(item => ({
    key: item.key,
    label: item.label,
    route: item.route,
    icon: item.icon,
    order: item.order,
    displayOrder: item.displayOrder,
    adminOnly: item.adminOnly,
    children: item.children ? cloneProvisionMenuItems(item.children) : undefined
  }))
)

const createDefaultProvisionManifest = (module: Omit<BusinessWorkspaceModule, 'provisionManifest'>): ProvisionManifest => ({
  moduleId: module.id,
  moduleCode: module.code,
  moduleName: module.name,
  manifestVersion: '1.0.0',
  menuItems: cloneProvisionMenuItems(module.menuItems),
  dashboardWidgets: [...(module.dashboardWidgets || [])],
  roles: [],
  permissions: [...module.permissions],
  settings: [],
  emptyStates: module.menuItems.map(item => ({
    key: `${module.code}.${item.key}.empty`,
    title: `${item.label} için henüz kayıt bulunmuyor.`,
    description: 'İlk kaydınızı oluşturduğunuzda bu alan kullanılabilir verilerle dolacak.',
    icon: item.icon,
    moduleCode: module.code
  })),
  defaultConfig: {}
})

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

  const normalizedModule = {
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
  } satisfies Omit<BusinessWorkspaceModule, 'provisionManifest'>

  return {
    ...normalizedModule,
    provisionManifest: module.provisionManifest || createDefaultProvisionManifest(normalizedModule)
  }
}

const defineModuleRegistry = (modules: BusinessWorkspaceModuleInput[]): BusinessWorkspaceModule[] => {
  return modules.map(normalizeModuleRegistryItem)
}

export const BUSINESS_WORKSPACE_MODULE_REGISTRY: BusinessWorkspaceModule[] = defineModuleRegistry([
  {
    id: 'system-workspace-welcome',
    code: WORKSPACE_MODULE_CODES.WORKSPACE_WELCOME,
    name: 'Çalışma Alanı Karşılama',
    description: 'Yeni işletme çalışma alanı ilk açılış deneyimini ve modül mağazası başlangıç yönlendirmesini gösterir.',
    category: 'system',
    icon: 'WW',
    route: 'workspace-welcome',
    permissions: ['company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 5,
    dependencies: [WORKSPACE_MODULE_CODES.WORKSPACE],
    tags: ['system', 'workspace', 'welcome', 'marketplace'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'workspace-welcome', label: 'Karşılama', route: 'workspace-welcome', icon: 'WW', adminOnly: true, displayOrder: 5 })
    ]
  },
  {
    id: 'system-dashboard',
    code: WORKSPACE_MODULE_CODES.DASHBOARD,
    name: 'Kontrol Paneli',
    description: 'İşletme çalışma alanı genel durum ve günlük operasyon özetini gösterir.',
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
        title: 'Kontrol Paneli Durumu',
        description: 'Kontrol paneli yerleşimi, kullanılabilir widget kaynakları ve kurulu modül bağlantılarını özetler.',
        icon: 'DB',
        category: 'Sistem',
        order: 11,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'dashboard.read',
        renderComponent: 'system.dashboard.workspaceStatus'
      })
    ],
    menuItems: [
      menuItem({ key: 'dashboard', label: 'Kontrol Paneli', route: 'summary', icon: 'DB', adminOnly: true, displayOrder: 10 })
    ]
  },
  {
    id: 'system-workspace',
    code: WORKSPACE_MODULE_CODES.WORKSPACE,
    name: 'İşletme Çalışma Alanı',
    description: 'İşletme çalışma alanı kimliği, temel profil bilgisi ve çalışma alanı bağlamını yönetir.',
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
      menuItem({ key: 'workspace', label: 'Çalışma Alanı', route: 'settings', icon: 'WS', adminOnly: true, displayOrder: 15 })
    ]
  },
  {
    id: 'system-marketplace',
    code: WORKSPACE_MODULE_CODES.MARKETPLACE,
    name: 'Modül Mağazası',
    description: 'İşletme çalışma alanı için iş ve entegrasyon modül kataloğunu gösterir.',
    category: 'system',
    icon: 'MP',
    route: 'marketplace',
    permissions: ['company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 18,
    dependencies: [WORKSPACE_MODULE_CODES.WORKSPACE, WORKSPACE_MODULE_CODES.LICENSE],
    tags: ['system', 'marketplace', 'module-catalog'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'marketplace', label: 'Modül Mağazası', route: 'marketplace', icon: 'MP', adminOnly: true, displayOrder: 18 })
    ]
  },
  {
    id: 'system-integration-center',
    code: WORKSPACE_MODULE_CODES.INTEGRATION_CENTER,
    name: 'Entegrasyon Merkezi',
    description: 'İşletme çalışma alanı ile dış sistemler arasındaki soyut entegrasyon kataloğunu ve bağlantı altyapısını yönetir.',
    category: 'system',
    icon: 'EN',
    route: 'integration-center',
    permissions: ['company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 19,
    dependencies: [WORKSPACE_MODULE_CODES.WORKSPACE, WORKSPACE_MODULE_CODES.MARKETPLACE],
    tags: ['system', 'integration', 'external-systems', 'registry'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'integration-center', label: 'Entegrasyon Merkezi', route: 'integration-center', icon: 'EN', adminOnly: true, displayOrder: 19 })
    ]
  },
  {
    id: 'system-tools',
    code: WORKSPACE_MODULE_CODES.TOOLS,
    name: 'Araclar',
    description: 'Workspace genelinde kullanilan veri aktarimi ve toplu operasyon araclarini toplar.',
    category: 'system',
    icon: 'AR',
    route: 'excel-center',
    permissions: ['company.read'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 21,
    dependencies: [WORKSPACE_MODULE_CODES.WORKSPACE],
    tags: ['system', 'tools', 'excel', 'import', 'export'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({
        key: 'tools',
        label: 'Araclar',
        icon: 'AR',
        adminOnly: true,
        displayOrder: 21,
        children: [
          menuItem({ key: 'excel-center', label: 'Excel Merkezi', route: 'excel-center', icon: 'XL', adminOnly: true, displayOrder: 10 })
        ]
      })
    ]
  },
  {
    id: 'system-executive-center',
    code: WORKSPACE_MODULE_CODES.EXECUTIVE_CENTER,
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
    dependencies: [WORKSPACE_MODULE_CODES.DASHBOARD],
    tags: ['system', 'executive', 'owner'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'business-summary', label: 'Yönetici Merkezi', route: 'business-summary', icon: 'YM', adminOnly: true, displayOrder: 20 })
    ]
  },
  {
    id: 'system-users',
    code: WORKSPACE_MODULE_CODES.USERS,
    name: 'Kullanıcılar',
    description: 'Çalışma alanı kullanıcılarının yönetildiği zorunlu sistem modülü.',
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
    code: WORKSPACE_MODULE_CODES.ROLES,
    name: 'Roller',
    description: 'Rol ve yetki modelinin işletme çalışma alanı içinde yönetilmesini sağlar.',
    category: 'system',
    icon: 'RL',
    route: 'users',
    permissions: ['company.manage'],
    isCoreModule: true,
    isBusinessModule: false,
    isEnabled: true,
    isVisible: true,
    displayOrder: 40,
    dependencies: [WORKSPACE_MODULE_CODES.USERS],
    tags: ['system', 'authorization', 'roles'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'roles', label: 'Roller', route: 'users', icon: 'RL', adminOnly: true, displayOrder: 40 })
    ]
  },
  {
    id: 'system-branches',
    code: WORKSPACE_MODULE_CODES.BRANCHES,
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
    code: WORKSPACE_MODULE_CODES.NOTIFICATIONS,
    name: 'Bildirimler',
    description: 'Çalışma alanı bildirimleri için merkezi sistem modülü.',
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
    code: WORKSPACE_MODULE_CODES.LICENSE,
    name: 'Lisans',
    description: 'Çalışma alanı lisans kapsamını ve modül erişim temelini gösterir.',
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
    code: WORKSPACE_MODULE_CODES.SUBSCRIPTION,
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
    dependencies: [WORKSPACE_MODULE_CODES.LICENSE],
    tags: ['system', 'subscription', 'billing'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    menuItems: [
      menuItem({ key: 'subscription', label: 'Abonelik', route: 'settings', icon: 'AB', adminOnly: true, displayOrder: 80 })
    ]
  },
  {
    id: 'system-audit',
    code: WORKSPACE_MODULE_CODES.AUDIT,
    name: 'Audit',
    description: 'Çalışma alanı içindeki kritik kullanıcı işlemlerinin denetlendiği çekirdek audit kaydı.',
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
    code: WORKSPACE_MODULE_CODES.SETTINGS,
    name: 'Sistem Ayarları',
    description: 'Çalışma alanı profil, görünüm ve veri yönetimi ayarlarını toplar.',
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
    code: WORKSPACE_MODULE_CODES.SUPPORT,
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
    code: WORKSPACE_MODULE_CODES.AI_CENTER,
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
    dependencies: [WORKSPACE_MODULE_CODES.DASHBOARD],
    tags: ['system', 'ai', 'future'],
    pricing: includedPricing,
    marketplace: coreSystemMarketplace,
    dashboardWidgets: [
      dashboardWidget({
        id: 'ai.platform-assistant',
        title: 'Çalışma Alanı Asistanı',
        description: 'AI destekli öneri ve yönlendirme alanı için kontrol paneli başlangıç noktasıdır.',
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
    code: WORKSPACE_MODULE_CODES.ADISYON,
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
    licenseModuleKey: LICENSE_MODULE_CODES.ADISYON,
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
    code: WORKSPACE_MODULE_CODES.QR_MENU,
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
    dependencies: [WORKSPACE_MODULE_CODES.ADISYON],
    tags: ['business', 'qr', 'ordering'],
    licenseModuleKey: LICENSE_MODULE_CODES.QR_MENU,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'digital-requests.summary',
        title: 'Dijital Talepler',
        description: 'Dijital kanallardan gelen taleplerin kontrol panelinde izlenebileceği widget alanı.',
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
    code: WORKSPACE_MODULE_CODES.STOCK,
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
    tags: ['business', 'inventory', 'lot', 'batch', 'traceability', 'goods-receipt', 'receiving'],
    licenseModuleKey: LICENSE_MODULE_CODES.STOCK,
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
        description: 'Son stok hareketlerinin kontrol panelinde özetlenebileceği widget alanı.',
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
        description: 'Depo ve stok alanı görünümü için hazırlanmış kontrol paneli widget alanı.',
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
        description: 'Geçerlilik takibi yapılan kayıtların kontrol panelinde izlenebileceği widget alanı.',
        icon: 'GT',
        category: 'Stok',
        order: 40,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'stock.read',
        renderComponent: 'stock.validity.placeholder'
      }),
      dashboardWidget({
        id: 'stock.goodsReceipts',
        title: 'Mal Kabul',
        description: 'PO, supplier, lot, kalite ve HACCP kaynaklarindan mal kabul read-model ozetini izlemek icin kontrol paneli alani.',
        icon: 'MK',
        category: 'Stok',
        order: 50,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'stock.read',
        renderComponent: 'stock.goodsReceipts.placeholder'
      })
    ],
    menuItems: [
      menuItem({ key: 'stock-cards', label: 'Kartlar', route: 'stock-cards', icon: 'SK', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'stock-movements', label: 'Hareketler', route: 'stock-movements', icon: 'SH', adminOnly: true, displayOrder: 20 }),
      menuItem({ key: 'critical-stock', label: 'Kritik Stok', route: 'stock-cards', icon: 'KS', adminOnly: true, displayOrder: 30 }),
      menuItem({ key: 'expiry-lots', label: 'Geçerlilik Takibi', route: 'stock-cards', icon: 'GT', adminOnly: true, displayOrder: 40 }),
      menuItem({ key: 'inventory-lots', label: 'Lot / Batch Yönetimi', route: 'inventory-lots', icon: 'LB', adminOnly: true, displayOrder: 50 }),
      menuItem({ key: 'goods-receipts', label: 'Mal Kabul', route: 'goods-receipts', icon: 'MK', adminOnly: true, displayOrder: 60 }),
      menuItem({ key: 'waste', label: 'Kayıp Analizi', route: 'stock-movements', icon: 'KA', adminOnly: true, displayOrder: 70 }),
      menuItem({
        key: 'stock-reports',
        label: 'Raporlar',
        icon: 'RP',
        adminOnly: true,
        displayOrder: 80,
        children: [
          menuItem({ key: 'stock-risk-center', label: 'Stok ve Risk', route: 'stock-risk-center', icon: 'SR', adminOnly: true, displayOrder: 10 })
        ]
      })
    ]
  },
  {
    id: 'business-warehouse',
    code: SECTOR_TEMPLATE_MODULE_CODES.WAREHOUSE,
    name: 'Depo',
    description: 'Endüstriyel mutfak depo süreçleri, kimyasal ürün güvenliği ve depo bazlı ürün yönetimi için iş modülü.',
    category: 'business',
    icon: 'DP',
    route: 'chemical-products',
    permissions: ['stock.read', 'stock.write'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 35,
    dependencies: [WORKSPACE_MODULE_CODES.STOCK, WORKSPACE_MODULE_CODES.PURCHASE],
    tags: ['business', 'warehouse', 'chemical-products', 'msds', 'ppe', 'safety', 'industrial-kitchen'],
    supportedSectorIds: industrialKitchenSectorIds,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'warehouse.chemicalProducts',
        title: 'Kimyasal Ürünler',
        description: 'Kimyasal ürün kartları, tehlike sınıfları ve güvenli kullanım bilgileri için kontrol paneli başlangıç alanı.',
        icon: 'KM',
        category: 'Depo',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'stock.read',
        renderComponent: 'warehouse.chemicalProducts.placeholder'
      })
    ],
    menuItems: [
      menuItem({ key: 'chemical-products', label: 'Kimyasal Ürünler', route: 'chemical-products', icon: 'KM', adminOnly: true, displayOrder: 10 })
    ]
  },
  {
    id: 'business-recipe',
    code: WORKSPACE_MODULE_CODES.RECIPE,
    name: 'Reçete Yönetimi',
    description: 'Endüstriyel mutfak standart reçete kartları ve malzeme satırlarını yöneten iş modülü.',
    category: 'business',
    icon: 'RC',
    route: 'recipes',
    permissions: ['operations.read', 'operations.write'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: false,
    displayOrder: 40,
    dependencies: [],
    tags: ['business', 'recipe-management', 'industrial-kitchen'],
    supportedSectorIds: industrialKitchenSectorIds,
    licenseModuleKey: LICENSE_MODULE_CODES.RECIPE,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'recipe.recipeManagement',
        title: 'Reçete Yönetimi',
        description: 'Endüstriyel mutfak reçete yönetimi için kontrol paneli başlangıç alanı.',
        icon: 'RC',
        category: 'Operasyon',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'recipe.recipeManagement.placeholder'
      })
    ],
    menuItems: [
      menuItem({ key: 'recipes', label: 'Reçete Yönetimi', route: 'recipes', icon: 'RC', adminOnly: true, displayOrder: 10 })
    ]
  },
  {
    id: 'business-purchase',
    code: WORKSPACE_MODULE_CODES.PURCHASE,
    name: 'Satın Alma',
    description: 'Endüstriyel mutfak satın alma talepleri, teklif yönetimi, onay süreçleri ve tedarikçi kartlarını yöneten iş modülü.',
    category: 'business',
    icon: 'SA',
    route: 'purchase-requests',
    permissions: ['finance.read', 'finance.write'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 42,
    dependencies: [],
    tags: ['business', 'purchase', 'procurement', 'purchase-request', 'rfq', 'purchase-approval', 'purchase-order', 'goods-receipt', 'supplier-management', 'supplier-performance', 'procurement-analytics', 'industrial-kitchen'],
    supportedSectorIds: industrialKitchenSectorIds,
    licenseModuleKey: LICENSE_MODULE_CODES.PURCHASE,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'purchase.requests',
        title: 'Satın Alma Talepleri',
        description: 'İşletme içi satın alma ihtiyaçlarını takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'ST',
        category: 'Satın Alma',
        order: 5,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'finance.read',
        renderComponent: 'purchase.requests.placeholder'
      }),
      dashboardWidget({
        id: 'purchase.suppliers',
        title: 'Tedarikçiler',
        description: 'Satın alma tedarikçi kartları için kontrol paneli başlangıç alanı.',
        icon: 'TD',
        category: 'Satın Alma',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'finance.read',
        renderComponent: 'purchase.suppliers.placeholder'
      }),
      dashboardWidget({
        id: 'purchase.rfq',
        title: 'Teklif Yönetimi',
        description: 'Satın alma taleplerini tedarikçi tekliflerine dönüştürmek için kontrol paneli başlangıç alanı.',
        icon: 'TK',
        category: 'Satın Alma',
        order: 15,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'finance.read',
        renderComponent: 'purchase.rfq.placeholder'
      }),
      dashboardWidget({
        id: 'purchase.approvals',
        title: 'Satın Alma Onayları',
        description: 'RFQ kazanan tekliflerini satın alma onay sürecinde takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'OA',
        category: 'Satın Alma',
        order: 20,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'finance.read',
        renderComponent: 'purchase.approvals.placeholder'
      }),
      dashboardWidget({
        id: 'purchase.orders',
        title: 'Satın Alma Siparişleri',
        description: 'Onaylanmış satın alma süreçlerinden oluşan Purchase Order kayıtlarını takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'PO',
        category: 'Satın Alma',
        order: 25,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'finance.read',
        renderComponent: 'purchase.orders.placeholder'
      })
    ],
    menuItems: [
      menuItem({ key: 'purchase-requests', label: 'Satın Alma Talepleri', route: 'purchase-requests', icon: 'ST', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'request-for-quotations', label: 'Teklif Yönetimi', route: 'request-for-quotations', icon: 'TK', adminOnly: true, displayOrder: 20 }),
      menuItem({ key: 'purchase-approvals', label: 'Satın Alma Onayları', route: 'purchase-approvals', icon: 'OA', adminOnly: true, displayOrder: 30 }),
      menuItem({ key: 'purchase-orders', label: 'Satın Alma Siparişleri', route: 'purchase-orders', icon: 'PO', adminOnly: true, displayOrder: 40 }),
      menuItem({ key: 'suppliers', label: 'Tedarikçiler', route: 'suppliers', icon: 'TD', adminOnly: true, displayOrder: 50 }),
      menuItem({ key: 'supplier-performances', label: 'Tedarikçi Performansı', route: 'supplier-performances', icon: 'TP', adminOnly: true, displayOrder: 60 }),
      menuItem({ key: 'procurement-analytics', label: 'Procurement Analytics', route: 'procurement-analytics', icon: 'PA', adminOnly: true, displayOrder: 70 })
    ]
  },
  {
    id: 'business-kpi-reporting',
    code: 'kpi-reporting',
    name: 'Raporlama',
    description: 'Industrial Kitchen KPI Dashboard, executive summary ve domain bazli read-model raporlama motoru.',
    category: 'business',
    icon: 'KP',
    route: 'kpi-dashboard',
    permissions: ['dashboard.read', 'operations.read', 'stock.read', 'finance.read'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 43,
    dependencies: [WORKSPACE_MODULE_CODES.DASHBOARD, WORKSPACE_MODULE_CODES.STOCK, WORKSPACE_MODULE_CODES.PURCHASE],
    tags: ['business', 'reporting', 'kpi', 'dashboard', 'executive-dashboard', 'production-kpi', 'inventory-kpi', 'quality-kpi', 'purchasing-kpi', 'shipment-kpi', 'decision-support', 'critical-alerts', 'forecasting', 'recommendation-engine', 'ai-analysis', 'industrial-kitchen'],
    supportedSectorIds: industrialKitchenSectorIds,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'reporting.kpiDashboard',
        title: 'KPI Dashboard',
        description: 'Executive, Production, Inventory, Quality, Purchasing ve Shipment KPI degerlerini tek read-model panelinde izlemek icin kontrol paneli baslangic alani.',
        icon: 'KP',
        category: 'Raporlama',
        order: 10,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'dashboard.read',
        renderComponent: 'reporting.kpiDashboard.placeholder'
      }),
      dashboardWidget({
        id: 'reporting.decisionSupport',
        title: 'Decision Support',
        description: 'ERP read-model verilerinden rule, risk ve recommendation engine ile yonetim onerileri uretmek icin kontrol paneli baslangic alani.',
        icon: 'DS',
        category: 'Raporlama',
        order: 20,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'dashboard.read',
        renderComponent: 'reporting.decisionSupport.placeholder'
      }),
      dashboardWidget({
        id: 'reporting.criticalAlerts',
        title: 'Kritik Alarmlar',
        description: 'Read-model kaynaklardan uretilen kritik stok, kalite, HACCP, kapasite, makine ve sevkiyat alarmlarini izlemek icin kontrol paneli baslangic alani.',
        icon: 'AL',
        category: 'Raporlama',
        order: 25,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'dashboard.read',
        renderComponent: 'reporting.criticalAlerts.placeholder'
      }),
      dashboardWidget({
        id: 'reporting.forecasting',
        title: 'Tahminleme',
        description: 'Gecmis operasyon, stok, kalite, sevkiyat, kapasite ve kritik alarm verilerinden forecast raporlari uretmek icin kontrol paneli baslangic alani.',
        icon: 'FC',
        category: 'Raporlama',
        order: 30,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'dashboard.read',
        renderComponent: 'reporting.forecasting.placeholder'
      }),
      dashboardWidget({
        id: 'reporting.recommendationEngine',
        title: 'Otomatik Oneriler',
        description: 'Forecasting, kritik alarm, planlama, stok, kalite ve KPI verilerinden read-model oneri raporlari uretmek icin kontrol paneli baslangic alani.',
        icon: 'RC',
        category: 'Raporlama',
        order: 35,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'dashboard.read',
        renderComponent: 'reporting.recommendationEngine.placeholder'
      }),
      dashboardWidget({
        id: 'reporting.aiAnalysis',
        title: 'AI Analiz',
        description: 'Decision Support, alarm, forecast, recommendation ve planlama verilerini dis AI servisine gitmeden AI-ready analiz formatina donusturmek icin kontrol paneli baslangic alani.',
        icon: 'AI',
        category: 'Raporlama',
        order: 40,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'dashboard.read',
        renderComponent: 'reporting.aiAnalysis.placeholder'
      })
    ],
    menuItems: [
      menuItem({ key: 'kpi-dashboard', label: 'KPI Dashboard', route: 'kpi-dashboard', icon: 'KP', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'decision-support', label: 'Decision Support', route: 'decision-support', icon: 'DS', adminOnly: true, displayOrder: 20 }),
      menuItem({ key: 'critical-alerts', label: 'Kritik Alarmlar', route: 'critical-alerts', icon: 'AL', adminOnly: true, displayOrder: 30 }),
      menuItem({ key: 'forecasting', label: 'Tahminleme', route: 'forecasting', icon: 'FC', adminOnly: true, displayOrder: 40 }),
      menuItem({ key: 'recommendation-engine', label: 'Otomatik Oneriler', route: 'recommendation-engine', icon: 'RC', adminOnly: true, displayOrder: 50 }),
      menuItem({ key: 'ai-analysis', label: 'AI Analiz', route: 'ai-analysis', icon: 'AI', adminOnly: true, displayOrder: 60 })
    ]
  },
  {
    id: 'business-quality',
    code: SECTOR_TEMPLATE_MODULE_CODES.QUALITY,
    name: 'Kalite ve İzlenebilirlik',
    description: 'Endüstriyel mutfak lot izlenebilirliği, numune, şahit numune ve recall takibi, inventory lot kalite kontrol kararları, checklist şablonları, red sonrası iade süreçleri ve tedarikçi iade sevklerini yöneten iş modülü.',
    category: 'business',
    icon: 'KL',
    route: 'lot-system',
    permissions: ['operations.read', 'operations.write', 'stock.read'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 44,
    dependencies: [WORKSPACE_MODULE_CODES.STOCK, WORKSPACE_MODULE_CODES.PURCHASE],
    tags: ['business', 'quality', 'label-management', 'barcode', 'qr-code', 'operation-checklist', 'operation-checklists', 'operations-checklist', 'lot-system', 'sample-tracking', 'quality-sample', 'witness-sample', 'witness-samples', 'product-recall', 'product-recalls', 'recall-management', 'product-history', 'traceability-timeline', 'haccp', 'critical-control-point', 'quality-control', 'quality-form', 'waste-management', 'fire-management', 'waste', 'fire', 'return-process', 'supplier-return', 'supplier-return-shipment', 'checklist', 'inventory-lot', 'traceability', 'industrial-kitchen'],
    supportedSectorIds: industrialKitchenSectorIds,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'quality.labelManagement',
        title: 'Etiket Yonetimi',
        description: 'Lot, uretim, sample, witness sample, HACCP ve sevkiyat verilerinden QR ve Code-128 etiketleri uretmek icin kontrol paneli alani.',
        icon: 'ET',
        category: 'Kalite',
        order: 4,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.labelManagement.placeholder'
      }),
      dashboardWidget({
        id: 'quality.lotSystem',
        title: 'Lot Sistemi',
        description: 'Production Order kaynaklı Inventory Lot kayıtlarını, SKT takibini ve lot yaşam döngüsünü izlemek için kontrol paneli başlangıç alanı.',
        icon: 'LS',
        category: 'Kalite',
        order: 5,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.lotSystem.placeholder'
      }),
      dashboardWidget({
        id: 'quality.sampleTracking',
        title: 'Numune Takibi',
        description: 'Inventory Lot kaynaklı kalite numunelerini, saklama sürelerini ve numune durumlarını takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'NT',
        category: 'Kalite',
        order: 6,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.sampleTracking.placeholder'
      }),
      dashboardWidget({
        id: 'quality.witnessSamples',
        title: 'Şahit Numune',
        description: 'Quality Sample kaynaklı resmi saklama numunelerini, lokasyonlarını ve saklama bitiş tarihlerini takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'SN',
        category: 'Kalite',
        order: 7,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.witnessSamples.placeholder'
      }),
      dashboardWidget({
        id: 'quality.productRecalls',
        title: 'Recall Management',
        description: 'Inventory Lot kaynaklı ürün geri çağırma kayıtlarını, risk seviyelerini ve ilgili numune zincirini takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'RC',
        category: 'Kalite',
        order: 8,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.productRecalls.placeholder'
      }),
      dashboardWidget({
        id: 'quality.productHistory',
        title: 'Ürün Geçmişi',
        description: 'Production Order, Inventory Lot, Quality Sample, Şahit Numune ve Recall olaylarını tek traceability timeline üzerinde izlemek için kontrol paneli başlangıç alanı.',
        icon: 'UG',
        category: 'Kalite',
        order: 9,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.productHistory.placeholder'
      }),
      dashboardWidget({
        id: 'quality.haccpManagement',
        title: 'HACCP',
        description: 'HACCP plans, critical control points, monitoring records, corrective actions and verification processes for food safety traceability.',
        icon: 'HC',
        category: 'Kalite',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.haccpManagement.placeholder'
      }),
      dashboardWidget({
        id: 'quality.controls',
        title: 'Kalite Kontrol',
        description: 'Inventory Lot kalite kararlarını ve kontrol statülerini takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'KL',
        category: 'Kalite',
        order: 11,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.controls.placeholder'
      }),
      dashboardWidget({
        id: 'quality.wasteManagement',
        title: 'Fire Yonetimi',
        description: 'Uretim, mal kabul, depo, soklama, paketleme, sevkiyat, kalite ve HACCP kaynakli fireleri read-model olarak izlemek icin kontrol paneli alani.',
        icon: 'FY',
        category: 'Kalite',
        order: 12,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.wasteManagement.placeholder'
      }),
      dashboardWidget({
        id: 'quality.operationChecklists',
        title: 'Operasyon Kontrol Listeleri',
        description: 'Gunluk operasyon, vardiya, temizlik, HACCP, depo, uretim, sevkiyat ve bakim kontrollerini versiyonlu checklistlerle izlemek icin kontrol paneli alani.',
        icon: 'OC',
        category: 'Kalite',
        order: 13,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.operationChecklists.placeholder'
      }),
      dashboardWidget({
        id: 'quality.forms',
        title: 'Kalite Kontrol Formları',
        description: 'Quality Control kayıtlarına bağlı checklist form sonuçlarını takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'KF',
        category: 'Kalite',
        order: 20,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.forms.placeholder'
      }),
      dashboardWidget({
        id: 'quality.returns',
        title: 'Red ve İade Süreci',
        description: 'REJECTED kalite kararlarından oluşan tedarikçi iade süreçlerini takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'RI',
        category: 'Kalite',
        order: 30,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.returns.placeholder'
      }),
      dashboardWidget({
        id: 'quality.supplierReturns',
        title: 'Tedarikçi İade Süreci',
        description: 'Return Process kayıtlarının tedarikçiye fiziksel sevk, teslim ve kapanış adımlarını takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'TI',
        category: 'Kalite',
        order: 40,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'quality.supplierReturns.placeholder'
      })
    ],
    menuItems: [
      menuItem({ key: 'label-management', label: 'Etiket Yönetimi', route: 'label-management', icon: 'ET', adminOnly: true, displayOrder: 4 }),
      menuItem({ key: 'lot-system', label: 'Lot Sistemi', route: 'lot-system', icon: 'LS', adminOnly: true, displayOrder: 5 }),
      menuItem({ key: 'sample-tracking', label: 'Numune Takibi', route: 'sample-tracking', icon: 'NT', adminOnly: true, displayOrder: 6 }),
      menuItem({ key: 'witness-samples', label: 'Şahit Numune', route: 'witness-samples', icon: 'SN', adminOnly: true, displayOrder: 7 }),
      menuItem({ key: 'product-recalls', label: 'Recall Management', route: 'product-recalls', icon: 'RC', adminOnly: true, displayOrder: 8 }),
      menuItem({ key: 'product-history', label: 'Ürün Geçmişi', route: 'product-history', icon: 'UG', adminOnly: true, displayOrder: 9 }),
      menuItem({ key: 'haccp-management', label: 'HACCP', route: 'haccp-management', icon: 'HC', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'quality-controls', label: 'Kalite Kontrol', route: 'quality-controls', icon: 'KL', adminOnly: true, displayOrder: 11 }),
      menuItem({ key: 'waste-management', label: 'Fire Yonetimi', route: 'waste-management', icon: 'FY', adminOnly: true, displayOrder: 12 }),
      menuItem({ key: 'operation-checklists', label: 'Operasyon Kontrol Listeleri', route: 'operation-checklists', icon: 'OC', adminOnly: true, displayOrder: 13 }),
      menuItem({ key: 'quality-control-forms', label: 'Kalite Kontrol Formları', route: 'quality-control-forms', icon: 'KF', adminOnly: true, displayOrder: 20 }),
      menuItem({ key: 'return-processes', label: 'Red ve İade Süreci', route: 'return-processes', icon: 'RI', adminOnly: true, displayOrder: 30 }),
      menuItem({ key: 'supplier-returns', label: 'Tedarikçi İade Süreci', route: 'supplier-returns', icon: 'TI', adminOnly: true, displayOrder: 40 })
    ]
  },
  {
    id: 'business-production-work-orders',
    code: SECTOR_TEMPLATE_MODULE_CODES.PRODUCTION,
    name: 'Üretim',
    description: 'Endüstriyel mutfak üretim iş emirleri, üretim hatları, ara ürünler, son ürünler, şoklama, paketleme, etiketleme, sevkiyat ve reçete yönetimi süreçleri için UI, domain modeli ve örnek veri hazırlığı.',
    category: 'business',
    icon: 'UR',
    route: 'production-work-orders',
    permissions: ['operations.read', 'operations.write', 'products.read'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 45,
    dependencies: [],
    tags: ['business', 'production', 'production-planning', 'planning', 'forecast', 'capacity', 'machine-scheduling', 'workforce-planning', 'bottleneck-analysis', 'continuous-improvement', 'operation', 'industrial-kitchen', 'work-order', 'production-line', 'intermediate-product', 'final-product', 'blast-chiller', 'packaging', 'labeling', 'dispatch', 'recipe-management', 'fire-analysis', 'cost-analysis'],
    supportedSectorIds: industrialKitchenSectorIds,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'production.planning',
        title: 'Uretim Planlama',
        description: 'Production Orders, recete, stok, forecast, sube talepleri, fire ve kapasite sinyallerinden read-model uretim plani olusturmak icin kontrol paneli alani.',
        icon: 'PP',
        category: 'Operasyon',
        order: 15,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.planning.placeholder'
      }),
      dashboardWidget({
        id: 'production.capacityPlanning',
        title: 'Kapasite Planlama',
        description: 'Uretim planlari, is emirleri, hatlar, makineler, work center, vardiya ve maintenance sinyallerinden kapasite read-modeli ureten kontrol paneli alani.',
        icon: 'CP',
        category: 'Operasyon',
        order: 18,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.capacityPlanning.placeholder'
      }),
      dashboardWidget({
        id: 'production.machineScheduling',
        title: 'Makine Cizelgeleme',
        description: 'Production Planning ve Capacity Planning verilerinden makine timeline, kuyruk, cakisma ve kullanim read-modeli ureten kontrol paneli alani.',
        icon: 'MS',
        category: 'Operasyon',
        order: 19,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.machineScheduling.placeholder'
      }),
      dashboardWidget({
        id: 'production.workforcePlanning',
        title: 'Personel Planlama',
        description: 'Production Planning, Capacity Planning ve Machine Scheduling yukunu personel, vardiya, departman ve hat bazinda read-model olarak dagitan kontrol paneli alani.',
        icon: 'WP',
        category: 'Operasyon',
        order: 19.5,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.workforcePlanning.placeholder'
      }),
      dashboardWidget({
        id: 'production.bottleneckAnalysis',
        title: 'Darbogaz Analizi',
        description: 'Production Planning, Capacity Planning, Machine Scheduling ve Workforce Planning ciktilarindan makine, hat, personel ve setup darbogazlarini analiz eden read-model paneli.',
        icon: 'BN',
        category: 'Operasyon',
        order: 19.8,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.bottleneckAnalysis.placeholder'
      }),
      dashboardWidget({
        id: 'production.continuousImprovement',
        title: 'Iyilestirme Firsatlari',
        description: 'Planning, scheduling, workforce ve Bottleneck Analysis ciktilarindan read-model iyilestirme onerileri ureten kontrol paneli alani.',
        icon: 'CI',
        category: 'Operasyon',
        order: 19.9,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.continuousImprovement.placeholder'
      }),
      dashboardWidget({
        id: 'production.workOrders',
        title: 'Üretim Emirleri',
        description: 'Endüstriyel mutfak üretim iş emirleri için kontrol paneli başlangıç alanı.',
        icon: 'UE',
        category: 'Operasyon',
        order: 20,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.workOrders.placeholder'
      }),
      dashboardWidget({
        id: 'production.lines',
        title: 'Üretim Hatları',
        description: 'Endüstriyel mutfak üretim hatları için kontrol paneli başlangıç alanı.',
        icon: 'UH',
        category: 'Operasyon',
        order: 25,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.lines.placeholder'
      }),
      dashboardWidget({
        id: 'production.intermediateProducts',
        title: 'Ara Ürünler',
        description: 'Endüstriyel mutfak ara ürünleri için kontrol paneli başlangıç alanı.',
        icon: 'AU',
        category: 'Operasyon',
        order: 30,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.intermediateProducts.placeholder'
      }),
      dashboardWidget({
        id: 'production.finalProducts',
        title: 'Son Ürünler',
        description: 'Endüstriyel mutfak son ürünleri için kontrol paneli başlangıç alanı.',
        icon: 'SU',
        category: 'Operasyon',
        order: 35,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.finalProducts.placeholder'
      }),
      dashboardWidget({
        id: 'production.blastChiller',
        title: 'Şoklama Süreçleri',
        description: 'Endüstriyel mutfak şoklama süreçleri için kontrol paneli başlangıç alanı.',
        icon: 'SS',
        category: 'Operasyon',
        order: 40,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.blastChiller.placeholder'
      }),
      dashboardWidget({
        id: 'production.packaging',
        title: 'Paketleme',
        description: 'Endüstriyel mutfak paketleme süreçleri için kontrol paneli başlangıç alanı.',
        icon: 'PK',
        category: 'Operasyon',
        order: 45,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.packaging.placeholder'
      }),
      dashboardWidget({
        id: 'production.labeling',
        title: 'Etiketleme',
        description: 'Endüstriyel mutfak etiketleme süreçleri için kontrol paneli başlangıç alanı.',
        icon: 'ET',
        category: 'Operasyon',
        order: 50,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.labeling.placeholder'
      }),
      dashboardWidget({
        id: 'production.dispatch',
        title: 'Sevkiyat',
        description: 'Endüstriyel mutfak sevkiyat süreçleri için kontrol paneli başlangıç alanı.',
        icon: 'SV',
        category: 'Operasyon',
        order: 55,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.dispatch.placeholder'
      }),
      dashboardWidget({
        id: 'production.recipeManagement',
        title: 'Reçete Yönetimi',
        description: 'Endüstriyel mutfak reçete yönetimi için kontrol paneli başlangıç alanı.',
        icon: 'RC',
        category: 'Operasyon',
        order: 60,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.recipeManagement.placeholder'
      }),
      dashboardWidget({
        id: 'production.fireImpactAnalysis',
        title: 'Fire Analizi',
        description: 'Fire kayitlarinin stok, maliyet, recete, uretim, KPI ve karar destek etkisini analiz eden read-model paneli.',
        icon: 'FA',
        category: 'Operasyon',
        order: 65,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.fireImpactAnalysis.placeholder'
      }),
      dashboardWidget({
        id: 'production.costEngine',
        title: 'Cost Engine',
        description: 'Recete, hammadde, satin alma, fire, uretim, depolama ve sevkiyat verilerinden maliyet hesaplayan read-model paneli.',
        icon: 'CE',
        category: 'Operasyon',
        order: 70,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'production.costEngine.placeholder'
      })
    ],
    menuItems: [
      menuItem({ key: 'production-planning', label: 'Uretim Planlama', route: 'production-planning', icon: 'PP', adminOnly: true, displayOrder: 5 }),
      menuItem({ key: 'capacity-planning', label: 'Kapasite Planlama', route: 'capacity-planning', icon: 'CP', adminOnly: true, displayOrder: 7 }),
      menuItem({ key: 'machine-scheduling', label: 'Makine Cizelgeleme', route: 'machine-scheduling', icon: 'MS', adminOnly: true, displayOrder: 8 }),
      menuItem({ key: 'workforce-planning', label: 'Personel Planlama', route: 'workforce-planning', icon: 'WP', adminOnly: true, displayOrder: 9 }),
      menuItem({ key: 'bottleneck-analysis', label: 'Darbogaz Analizi', route: 'bottleneck-analysis', icon: 'BN', adminOnly: true, displayOrder: 9.5 }),
      menuItem({ key: 'continuous-improvement', label: 'Iyilestirme Firsatlari', route: 'continuous-improvement', icon: 'CI', adminOnly: true, displayOrder: 9.7 }),
      menuItem({ key: 'production-work-orders', label: 'Üretim Emirleri', route: 'production-work-orders', icon: 'UE', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'production-lines', label: 'Üretim Hatları', route: 'production-lines', icon: 'UH', adminOnly: true, displayOrder: 20 }),
      menuItem({ key: 'intermediate-products', label: 'Ara Ürünler', route: 'intermediate-products', icon: 'AU', adminOnly: true, displayOrder: 30 }),
      menuItem({ key: 'final-products', label: 'Son Ürünler', route: 'final-products', icon: 'SU', adminOnly: true, displayOrder: 40 }),
      menuItem({ key: 'blast-chiller-processes', label: 'Şoklama Süreçleri', route: 'blast-chiller-processes', icon: 'SS', adminOnly: true, displayOrder: 50 }),
      menuItem({ key: 'packaging-processes', label: 'Paketleme', route: 'packaging-processes', icon: 'PK', adminOnly: true, displayOrder: 60 }),
      menuItem({ key: 'labeling-processes', label: 'Etiketleme', route: 'labeling-processes', icon: 'ET', adminOnly: true, displayOrder: 70 }),
      menuItem({ key: 'dispatch-processes', label: 'Sevkiyat', route: 'dispatch-processes', icon: 'SV', adminOnly: true, displayOrder: 80 }),
      menuItem({
        key: 'recipe-cost',
        label: 'Reçete ve Maliyet',
        icon: 'RM',
        adminOnly: true,
        displayOrder: 90,
        children: [
          menuItem({ key: 'recipes', label: 'Reçete Yönetimi', route: 'recipes', icon: 'RC', adminOnly: true, displayOrder: 10 }),
          menuItem({ key: 'fire-analysis', label: 'Fire Analizi', route: 'fire-analysis', icon: 'FA', adminOnly: true, displayOrder: 20 }),
          menuItem({ key: 'cost-engine', label: 'Cost Engine', route: 'cost-engine', icon: 'CE', adminOnly: true, displayOrder: 30 })
        ]
      })
    ]
  },
  {
    id: 'business-logistics',
    code: SECTOR_TEMPLATE_MODULE_CODES.COURIER,
    name: 'Lojistik',
    description: 'Merkez depo, üretim, şube ve depo arası sevkiyat emirlerini lot bazında planlayan iş modülü.',
    category: 'business',
    icon: 'LJ',
    route: 'shipments',
    permissions: ['stock.read', 'operations.read', 'operations.write'],
    isCoreModule: false,
    isBusinessModule: true,
    isEnabled: true,
    isVisible: true,
    displayOrder: 46,
    dependencies: [WORKSPACE_MODULE_CODES.STOCK],
    tags: ['business', 'logistics', 'shipment-work-order', 'shipment-pallet', 'shipment-vehicle', 'vehicle-planning', 'shipment-plan', 'shipment-form', 'shipment-forms', 'delivery-note', 'shipment-return', 'shipment-waybill', 'waybill', 'shipment', 'shipment-execution', 'transfer-receipt', 'warehouse', 'branch', 'inventory-lot', 'industrial-kitchen'],
    supportedSectorIds: industrialKitchenSectorIds,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'logistics.shipmentWorkOrders',
        title: 'İş Emirleri',
        description: 'Şube taleplerini lojistik iş emrine dönüştürmek ve picking başlangıcını takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'IE',
        category: 'Lojistik',
        order: 5,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'logistics.shipmentWorkOrders.placeholder'
      }),
      dashboardWidget({
        id: 'logistics.shipments',
        title: 'Sevkiyatlar',
        description: 'Depo, üretim ve şube arası sevkiyat planlarını takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'SV',
        category: 'Lojistik',
        order: 10,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'logistics.shipments.placeholder'
      }),
      dashboardWidget({
        id: 'logistics.shipmentPallets',
        title: 'Paletleme',
        description: 'Shipment Work Order ürünlerini paletlere dağıtmak ve palet ağırlıklarını izlemek için kontrol paneli başlangıç alanı.',
        icon: 'PL',
        category: 'Lojistik',
        order: 15,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'logistics.shipmentPallets.placeholder'
      }),
      dashboardWidget({
        id: 'logistics.shipmentVehicles',
        title: 'Araç Planlama',
        description: 'READY paletleri sevkiyat araçlarına atamak, kapasite ve doluluk oranını izlemek için kontrol paneli başlangıç alanı.',
        icon: 'AP',
        category: 'Lojistik',
        order: 18,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'logistics.shipmentVehicles.placeholder'
      }),
      dashboardWidget({
        id: 'logistics.shipmentPlans',
        title: 'Sevkiyat Planı',
        description: 'READY araçları teslim duraklarına göre gerçek sevkiyat turuna dönüştürmek için kontrol paneli başlangıç alanı.',
        icon: 'SP',
        category: 'Lojistik',
        order: 19,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'logistics.shipmentPlans.placeholder'
      }),
      dashboardWidget({
        id: 'logistics.shipmentExecutions',
        title: 'Sevkiyat Operasyonu',
        description: 'Picking, packing, shipping ve teslim operasyonlarını takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'SO',
        category: 'Lojistik',
        order: 20,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'logistics.shipmentExecutions.placeholder'
      }),
      dashboardWidget({
        id: 'logistics.deliveryNotes',
        title: 'Irsaliyeler',
        description: 'Sevkiyat planlarindan kurumsal delivery note read modelini, lotlari, arac bilgisini ve cikti surecini takip etmek icin kontrol paneli alani.',
        icon: 'DN',
        category: 'Lojistik',
        order: 24,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'logistics.deliveryNotes.placeholder'
      }),
      dashboardWidget({
        id: 'logistics.shipmentForms',
        title: 'Sevkiyat Formlari',
        description: 'Yukleme, arac kontrolu, soguk zincir, teslim ve iade sureclerini standart operasyon formlariyla izlemek icin kontrol paneli alani.',
        icon: 'SF',
        category: 'Lojistik',
        order: 25,
        defaultVisible: false,
        defaultSize: 'large',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'logistics.shipmentForms.placeholder'
      }),
      dashboardWidget({
        id: 'logistics.transferReceipts',
        title: 'Depoya Kabul',
        description: 'Gelen sevkiyatların depo kabul, hasar, eksik ve red süreçlerini takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'DK',
        category: 'Lojistik',
        order: 30,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'logistics.transferReceipts.placeholder'
      }),
      dashboardWidget({
        id: 'logistics.shipmentReturns',
        title: 'İade Süreci',
        description: 'Teslimatı tamamlanan sevkiyatlarda ürün, palet ve ekipman iadelerini takip etmek için kontrol paneli başlangıç alanı.',
        icon: 'IS',
        category: 'Lojistik',
        order: 40,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'logistics.shipmentReturns.placeholder'
      }),
      dashboardWidget({
        id: 'logistics.shipmentWaybills',
        title: 'İrsaliye Süreci',
        description: 'Tamamlanan sevkiyatların resmi sevk evraklarını delivery ve return referanslarıyla yönetmek için kontrol paneli başlangıç alanı.',
        icon: 'IR',
        category: 'Lojistik',
        order: 50,
        defaultVisible: false,
        defaultSize: 'medium',
        supportedLayouts: ['standard', 'wide'],
        requiredPermission: 'operations.read',
        renderComponent: 'logistics.shipmentWaybills.placeholder'
      })
    ],
    menuItems: [
      menuItem({ key: 'shipment-work-orders', label: 'İş Emirleri', route: 'shipment-work-orders', icon: 'IE', adminOnly: true, displayOrder: 5 }),
      menuItem({ key: 'shipment-pallets', label: 'Paletleme', route: 'shipment-pallets', icon: 'PL', adminOnly: true, displayOrder: 7 }),
      menuItem({ key: 'shipment-vehicles', label: 'Araç Planlama', route: 'shipment-vehicles', icon: 'AP', adminOnly: true, displayOrder: 8 }),
      menuItem({ key: 'shipment-plans', label: 'Sevkiyat Planı', route: 'shipment-plans', icon: 'SP', adminOnly: true, displayOrder: 9 }),
      menuItem({ key: 'shipments', label: 'Sevkiyatlar', route: 'shipments', icon: 'SV', adminOnly: true, displayOrder: 10 }),
      menuItem({ key: 'delivery-notes', label: 'Irsaliyeler', route: 'delivery-notes', icon: 'DN', adminOnly: true, displayOrder: 12 }),
      menuItem({ key: 'shipment-forms', label: 'Sevkiyat Formlari', route: 'shipment-forms', icon: 'SF', adminOnly: true, displayOrder: 14 }),
      menuItem({ key: 'shipment-executions', label: 'Sevkiyat Operasyonu', route: 'shipment-executions', icon: 'SO', adminOnly: true, displayOrder: 20 }),
      menuItem({ key: 'transfer-receipts', label: 'Depoya Kabul', route: 'transfer-receipts', icon: 'DK', adminOnly: true, displayOrder: 30 }),
      menuItem({ key: 'shipment-returns', label: 'İade Süreci', route: 'shipment-returns', icon: 'IS', adminOnly: true, displayOrder: 40 }),
      menuItem({ key: 'shipment-waybills', label: 'İrsaliye Süreci', route: 'shipment-waybills', icon: 'IR', adminOnly: true, displayOrder: 50 })
    ]
  },
  {
    id: 'business-current',
    code: WORKSPACE_MODULE_CODES.CURRENT,
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
    licenseModuleKey: LICENSE_MODULE_CODES.CURRENT,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'current.summary',
        title: 'Cari Özeti',
        description: 'Cari kart ve hareketlerinin kontrol panelinde izlenebileceği özet widget alanı.',
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
        description: 'Riskli cari kayıtları için hazırlanmış kontrol paneli takip widget alanı.',
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
    code: WORKSPACE_MODULE_CODES.CREDIT,
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
    dependencies: [WORKSPACE_MODULE_CODES.CURRENT],
    tags: ['business', 'credit', 'collections'],
    licenseModuleKey: LICENSE_MODULE_CODES.CREDIT,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'credit.collections',
        title: 'Tahsilat Takibi',
        description: 'Tahsilat bekleyen kayıtlar için kontrol paneli widget alanı.',
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
    code: WORKSPACE_MODULE_CODES.FINANCE,
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
    licenseModuleKey: LICENSE_MODULE_CODES.FINANCE,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'finance.cash-status',
        title: 'Kasa Durumu',
        description: 'Kasa hareketleri ve güncel finans görünümü için kontrol paneli widget alanı.',
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
        description: 'Gelir ve gider kayıtlarının kontrol panelinde özetlenebileceği widget alanı.',
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
    code: WORKSPACE_MODULE_CODES.PERSONNEL,
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
    licenseModuleKey: LICENSE_MODULE_CODES.PERSONNEL,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'personnel.total',
        title: 'Toplam Personel',
        description: 'Çalışma alanı personel kayıtları için kontrol paneli özet widget alanı.',
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
        description: 'Günlük izin durumlarını kontrol panelinde izlemek için widget alanı.',
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
        description: 'Vardiya ve puantaj durumları için kontrol paneli widget alanı.',
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
        description: 'Son eklenen personel kayıtları için hazırlanmış kontrol paneli widget alanı.',
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
    code: WORKSPACE_MODULE_CODES.MULTI_BRANCH,
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
    dependencies: [WORKSPACE_MODULE_CODES.BRANCHES],
    tags: ['business', 'branch', 'multi-location'],
    licenseModuleKey: LICENSE_MODULE_CODES.MULTI_BRANCH,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'branches.summary',
        title: 'Şube Özeti',
        description: 'Çoklu lokasyon görünümü ve merkez yönetim özetleri için kontrol paneli widget alanı.',
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
    code: WORKSPACE_MODULE_CODES.MANAGER_ALERTS,
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
    dependencies: [WORKSPACE_MODULE_CODES.DASHBOARD],
    tags: ['business', 'alerts', 'executive'],
    licenseModuleKey: LICENSE_MODULE_CODES.BOSS_DASHBOARD,
    pricing: { model: 'paid', currency: 'TRY' },
    marketplace: marketplaceReady,
    dashboardWidgets: [
      dashboardWidget({
        id: 'manager.alerts',
        title: 'Yönetici Uyarıları',
        description: 'Kritik uyarı ve aksiyon önerilerinin kontrol panelinde izlenebileceği widget alanı.',
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

export const isBusinessWorkspaceModuleAvailableForSector = (
  module: BusinessWorkspaceModule,
  sectorId?: string
) => {
  if(!module.supportedSectorIds || module.supportedSectorIds.length === 0) return true
  return Boolean(sectorId && module.supportedSectorIds.includes(sectorId))
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
