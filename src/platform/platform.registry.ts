import type { ShellNavGroup, ShellNavItem } from '../components/AppShell'
import type {
  AppNavGroupKey,
  AppNavKey,
  AppRoute,
  PlatformNavKey,
  PlatformRoute
} from '../navigation/app-navigation.types'
import { MODULE_SCOPES } from '../modules/module-registry.types'

export type PlatformRegistryItem = {
  id: string
  code: string
  name: string
  description: string
  icon: string
  route: PlatformRoute
  navKey: PlatformNavKey
  scope: typeof MODULE_SCOPES.PLATFORM
  displayOrder: number
  hidden?: boolean
  tags: string[]
}

export const PLATFORM_MODULE_REGISTRY: PlatformRegistryItem[] = [
  {
    id: 'platform-dashboard',
    code: 'platform-dashboard',
    name: 'Dashboard',
    description: 'EVREN360 platform genel durum ekranı.',
    icon: 'DB',
    route: 'evren360-dashboard',
    navKey: 'evren360-dashboard',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 10,
    tags: ['platform', 'dashboard']
  },
  {
    id: 'platform-customers',
    code: 'platform-customers',
    name: 'Müşteri Listesi',
    description: 'Platform müşterilerinin merkezi listesi.',
    icon: 'ML',
    route: 'evren360-customer-list',
    navKey: 'evren360-customer-list',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 20,
    tags: ['platform', 'customers']
  },
  {
    id: 'platform-customer-detail',
    code: 'platform-customer-detail',
    name: 'Müşteri Detayı',
    description: 'Seçili platform müşterisinin detay ekranı.',
    icon: 'MD',
    route: 'evren360-customer-detail',
    navKey: 'evren360-customer-detail',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 25,
    hidden: true,
    tags: ['platform', 'customers']
  },
  {
    id: 'platform-applications',
    code: 'platform-applications',
    name: 'Onay Bekleyen İşletmeler',
    description: 'Yeni işletme başvurularının platform onay merkezi.',
    icon: 'OB',
    route: 'evren360-pending-applications',
    navKey: 'evren360-pending-applications',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 30,
    tags: ['platform', 'applications']
  },
  {
    id: 'platform-notifications',
    code: 'platform-notifications',
    name: 'Sistem Duyuruları',
    description: 'Platform duyuru ve bildirim yönetimi.',
    icon: 'SD',
    route: 'evren360-system-announcements',
    navKey: 'evren360-system-announcements',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 40,
    tags: ['platform', 'notifications']
  },
  {
    id: 'platform-analytics',
    code: 'platform-analytics',
    name: 'Müşteri İstatistikleri',
    description: 'Platform müşteri ve kullanım analitiği.',
    icon: 'MI',
    route: 'evren360-customer-statistics',
    navKey: 'evren360-customer-statistics',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 50,
    tags: ['platform', 'analytics']
  },
  {
    id: 'platform-company-management',
    code: 'platform-company-management',
    name: 'İşletme Yönetimi',
    description: 'Platform işletme ve tenant bağlamı yönetimi.',
    icon: 'IY',
    route: 'evren360-company-management',
    navKey: 'evren360-company-management',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 60,
    tags: ['platform', 'tenant', 'company']
  },
  {
    id: 'platform-tenant-manager',
    code: 'platform-tenant-manager',
    name: 'Tenant Yönetimi',
    description: 'Tenant izolasyonu, ayarları ve yaşam döngüsü yönetimi.',
    icon: 'TN',
    route: 'tenant-management',
    navKey: 'tenant-management',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 65,
    tags: ['platform', 'tenant']
  },
  {
    id: 'platform-billing',
    code: 'platform-billing',
    name: 'Fatura ve Tahsilat Takibi',
    description: 'Platform faturalandırma ve tahsilat yönetimi.',
    icon: 'FT',
    route: 'evren360-billing-management',
    navKey: 'evren360-billing-management',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 70,
    tags: ['platform', 'billing']
  },
  {
    id: 'platform-business-registration',
    code: 'platform-business-registration',
    name: 'İşletme Başvuruları',
    description: 'Platform işletme başvuru yönetimi için eski route kaydı.',
    icon: 'BV',
    route: 'business-registration-system',
    navKey: 'business-registration-system',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 75,
    hidden: true,
    tags: ['platform', 'applications']
  },
  {
    id: 'platform-company-setup',
    code: 'platform-company-setup',
    name: 'Workspace Kurulumu',
    description: 'Platform şirket kurulum aracı için eski route kaydı.',
    icon: 'KW',
    route: 'company-setup-wizard',
    navKey: 'company-setup-wizard',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 76,
    hidden: true,
    tags: ['platform', 'setup']
  },
  {
    id: 'platform-saas-applications',
    code: 'platform-saas-applications',
    name: 'Başvurular',
    description: 'EVREN360 SaaS başvuru yönetimi.',
    icon: 'BV',
    route: 'evren360-applications',
    navKey: 'evren360-applications',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 80,
    tags: ['platform', 'saas']
  },
  {
    id: 'platform-saas-companies',
    code: 'platform-saas-companies',
    name: 'Firmalar',
    description: 'EVREN360 firma kayıt yönetimi.',
    icon: 'FR',
    route: 'evren360-companies',
    navKey: 'evren360-companies',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 90,
    tags: ['platform', 'company']
  },
  {
    id: 'platform-marketplace',
    code: 'platform-marketplace',
    name: 'Modüller',
    description: 'Platform modül kataloğu ve lisans yönetim merkezi.',
    icon: 'MD',
    route: 'evren360-modules',
    navKey: 'evren360-modules',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 100,
    tags: ['platform', 'marketplace', 'modules']
  },
  {
    id: 'platform-module-activation',
    code: 'platform-module-activation',
    name: 'Modül Aktivasyon Sistemi',
    description: 'Platform modül aktivasyon aracı için eski route kaydı.',
    icon: 'MA',
    route: 'module-activation-system',
    navKey: 'module-activation-system',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 101,
    hidden: true,
    tags: ['platform', 'modules']
  },
  {
    id: 'platform-licenses',
    code: 'platform-licenses',
    name: 'Lisanslar',
    description: 'Platform lisans kayıtlarının yönetimi.',
    icon: 'LS',
    route: 'evren360-licenses',
    navKey: 'evren360-licenses',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 110,
    tags: ['platform', 'license']
  },
  {
    id: 'platform-package-license-management',
    code: 'platform-package-license-management',
    name: 'Paket Lisans Yönetimi',
    description: 'Platform lisans operasyon aracı için eski route kaydı.',
    icon: 'PL',
    route: 'package-license-management',
    navKey: 'package-license-management',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 111,
    hidden: true,
    tags: ['platform', 'license']
  },
  {
    id: 'platform-subscriptions',
    code: 'platform-subscriptions',
    name: 'Abonelikler',
    description: 'Platform abonelik yönetimi.',
    icon: 'AB',
    route: 'evren360-subscriptions',
    navKey: 'evren360-subscriptions',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 120,
    tags: ['platform', 'subscription']
  },
  {
    id: 'platform-user-subscription-management',
    code: 'platform-user-subscription-management',
    name: 'Kullanıcı Abonelikleri',
    description: 'Platform kullanıcı abonelik aracı için eski route kaydı.',
    icon: 'UA',
    route: 'user-subscription-management',
    navKey: 'user-subscription-management',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 121,
    hidden: true,
    tags: ['platform', 'subscription']
  },
  {
    id: 'platform-users',
    code: 'platform-users',
    name: 'Kullanıcılar',
    description: 'Platform kullanıcı yönetimi.',
    icon: 'KU',
    route: 'evren360-users',
    navKey: 'evren360-users',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 130,
    tags: ['platform', 'users']
  },
  {
    id: 'platform-support',
    code: 'platform-support',
    name: 'Destek Talepleri',
    description: 'Platform destek talebi yönetimi.',
    icon: 'DT',
    route: 'evren360-support',
    navKey: 'evren360-support',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 140,
    tags: ['platform', 'support']
  },
  {
    id: 'platform-monitoring',
    code: 'platform-monitoring',
    name: 'İstatistikler',
    description: 'Platform izleme, telemetri ve kullanım göstergeleri.',
    icon: 'IS',
    route: 'evren360-stats',
    navKey: 'evren360-stats',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 150,
    tags: ['platform', 'monitoring', 'telemetry']
  },
  {
    id: 'platform-settings',
    code: 'platform-settings',
    name: 'Sistem Ayarları',
    description: 'EVREN360 platform ayarları.',
    icon: 'SA',
    route: 'evren360-settings',
    navKey: 'evren360-settings',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 160,
    tags: ['platform', 'settings']
  }
]

export const getPlatformRegistry = () => (
  [...PLATFORM_MODULE_REGISTRY].sort((first, second) => first.displayOrder - second.displayOrder)
)

export const getPlatformRoutes = () => new Set<PlatformRoute>(
  getPlatformRegistry().map(item => item.route)
)

export const createPlatformNavGroups = (): ShellNavGroup<AppRoute, AppNavKey, AppNavGroupKey>[] => ([
  {
    key: 'evren360-admin',
    title: 'EVREN360 Yönetici Paneli',
    icon: 'E3',
    items: getPlatformRegistry().map<ShellNavItem<AppRoute, AppNavKey>>(item => ({
      key: item.navKey,
      label: item.name,
      route: item.route,
      icon: item.icon,
      adminOnly: true,
      platformAdminOnly: true,
      hidden: item.hidden
    }))
  }
])
