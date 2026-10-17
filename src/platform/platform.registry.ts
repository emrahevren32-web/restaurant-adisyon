import type { ShellNavGroup, ShellNavItem } from '../components/AppShell'
import type {
  AppNavGroupKey,
  AppNavKey,
  AppRoute,
  PlatformNavGroupKey,
  PlatformNavKey,
  PlatformRoute
} from '../navigation/app-navigation.types'
import { MODULE_SCOPES } from '../modules/module-registry.types'

/**
 * EVREN360 Yönetici Paneli kayıt defteri.
 *
 * ── 2026-10-16 · NEDEN YENİDEN DÜZENLENDİ ────────────────────────────────
 * Panel 19 ögeli DÜZ bir listeydi ve ölçüldüğünde şu çıktı: 19 ekranın
 * yalnız 2'si veritabanını okuyor. Kalan 17'si `storage.ts` (tarayıcının
 * localStorage'ı) ya da bir `.mock` dosyası okuyor. Son 10 menü ögesi
 * aslında TEK bir bileşendi — `SaasManagementCenter`, `view` prop'u
 * değişiyordu. Yani panel "müşterim yok" demiyordu; veritabanına hiç
 * bakmıyordu.
 *
 * Bu dosya artık her ögenin veri kaynağını ADIYLA taşıyor:
 *
 *   veriKaynagi: 'veritabani'   → ekran Supabase'i okuyor, açık
 *   veriKaynagi: 'hazirlaniyor' → ekran henüz gerçek veriye bağlı değil
 *
 * 'hazirlaniyor' olan öge menüde GÖRÜNÜR ama KİLİTLİ. Gizlemek yerine
 * kilitlemek bilinçli bir seçim: panelin sahibi (Emrah) neyin yolda
 * olduğunu görmeli, ama yalan söyleyen bir ekrana girememeli.
 *
 * ⚠️ ÜÇ KAPI AYNI ŞEYİ SÖYLEMEK ZORUNDA:
 *   1. menü      → `createPlatformNavGroups` (locked)
 *   2. tıklama   → `App.tsx` · `openNavItem` (item.locked kontrolü)
 *   3. rota      → `App.tsx` · `platformEkraniHazirDegil`
 * Üçü `PLATFORM_HAZIR_ROTALAR`dan besleniyor.
 * `platform/platform-paneli.arch.test.ts` bunu kaynak dosyaları OKUYARAK
 * doğruluyor — yani burada 'veritabani' yazıp localStorage okumak testi
 * kırar.
 */
export type PlatformVeriKaynagi = 'veritabani' | 'hazirlaniyor'

export type PlatformRegistryItem = {
  id: string
  code: string
  name: string
  description: string
  icon: string
  route: PlatformRoute
  navKey: PlatformNavKey
  groupKey: PlatformNavGroupKey
  scope: typeof MODULE_SCOPES.PLATFORM
  displayOrder: number
  /** Ekranın gerçek veri kaynağı. Testle kaynak dosyaya karşı doğrulanır. */
  veriKaynagi: PlatformVeriKaynagi
  /** Ekranın okuduğu dosya — testin bakacağı yer. */
  kaynakDosya: string
  /** Menüde hiç görünmesin: başka bir ögenin eşi ya da eski rota. */
  hidden?: boolean
  /** `hazirlaniyor` ögelerinde kullanıcıya gösterilecek gerekçe. */
  bekleyenIs?: string
  tags: string[]
}

export const PLATFORM_NAV_GROUPS: Array<{ key: PlatformNavGroupKey; title: string; icon: string }> = [
  { key: 'evren360-musteriler', title: 'EVREN360 · Müşteriler', icon: 'E3' },
  { key: 'evren360-lisans', title: 'EVREN360 · Lisans ve Ödeme', icon: 'LS' },
  { key: 'evren360-sistem', title: 'EVREN360 · Sistem', icon: 'SA' }
]

const HAZIRLANIYOR_MESAJI = 'Bu ekran henüz gerçek veriye bağlı değil.'

export const PLATFORM_MODULE_REGISTRY: PlatformRegistryItem[] = [
  // ── Müşteriler ───────────────────────────────────────────────────────────
  {
    id: 'platform-applications',
    code: 'platform-applications',
    name: 'Onay Bekleyen İşletmeler',
    description: 'Yeni işletme başvurularının platform onay merkezi.',
    icon: 'OB',
    route: 'evren360-pending-applications',
    navKey: 'evren360-pending-applications',
    groupKey: 'evren360-musteriler',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 10,
    veriKaynagi: 'veritabani',
    kaynakDosya: 'pages/PendingApplications.tsx',
    tags: ['platform', 'applications']
  },
  {
    id: 'platform-customers',
    code: 'platform-customers',
    name: 'Müşteri Listesi',
    description: 'Platform müşterilerinin merkezi listesi.',
    icon: 'ML',
    route: 'evren360-customer-list',
    navKey: 'evren360-customer-list',
    groupKey: 'evren360-musteriler',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 20,
    // 0083 · `platform_musteri_listesi`
    veriKaynagi: 'veritabani',
    kaynakDosya: 'pages/CustomerList.tsx',
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
    groupKey: 'evren360-musteriler',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 25,
    // 0083 · `platform_musteri_detayi` + `_kullanicilari` + `_kullanim_saatleri`
    veriKaynagi: 'veritabani',
    kaynakDosya: 'pages/CustomerDetail.tsx',
    // Menüde yok: listeden açılıyor, tek başına anlamı olan bir ekran değil.
    hidden: true,
    tags: ['platform', 'customers']
  },
  {
    id: 'platform-tenant-manager',
    code: 'platform-tenant-manager',
    name: 'Tenant Yönetimi',
    description: 'Tenant izolasyonu, ayarları ve yaşam döngüsü yönetimi.',
    icon: 'TN',
    route: 'tenant-management',
    navKey: 'tenant-management',
    groupKey: 'evren360-musteriler',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 30,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/TenantManagement.tsx',
    bekleyenIs: 'Kiracı yaşam döngüsü (askıya al / sürdür) veritabanına bağlanacak.',
    tags: ['platform', 'tenant']
  },

  // ── Lisans ve Ödeme ──────────────────────────────────────────────────────
  {
    id: 'platform-license-center',
    code: 'platform-license-center',
    name: 'Lisans Yönetimi',
    description: 'Müşteri lisansları, uzatma geçmişi ve ek süre talepleri.',
    icon: 'LS',
    route: 'evren360-license-management',
    navKey: 'evren360-license-management',
    groupKey: 'evren360-lisans',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 40,
    veriKaynagi: 'veritabani',
    kaynakDosya: 'pages/LisansYonetimi.tsx',
    tags: ['platform', 'license']
  },
  {
    id: 'platform-billing',
    code: 'platform-billing',
    name: 'Fatura ve Tahsilat Takibi',
    description: 'Platform faturalandırma ve tahsilat yönetimi.',
    icon: 'FT',
    route: 'evren360-billing-management',
    navKey: 'evren360-billing-management',
    groupKey: 'evren360-lisans',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 50,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/BillingManagement.tsx',
    bekleyenIs: 'Ödeme ve borç tablosu henüz yok; fiyat kararı da verilmedi.',
    tags: ['platform', 'billing']
  },

  // ── Sistem ───────────────────────────────────────────────────────────────
  {
    id: 'platform-dashboard',
    code: 'platform-dashboard',
    name: 'Kontrol Paneli',
    description: 'EVREN360 platform genel durum ekranı.',
    icon: 'DB',
    route: 'evren360-dashboard',
    navKey: 'evren360-dashboard',
    groupKey: 'evren360-sistem',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 60,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/SaasManagementCenter.tsx',
    bekleyenIs: 'Gerçek sayaçlar (kiracı, lisans, başvuru) veritabanından gelecek.',
    tags: ['platform', 'dashboard']
  },
  {
    id: 'platform-sector-management',
    code: 'platform-sector-management',
    name: 'Sektör Yönetimi',
    description: 'Sektör tanımları, şablon bağlantıları ve kurulum ayarları.',
    icon: 'SC',
    route: 'evren360-sector-management',
    navKey: 'evren360-sector-management',
    groupKey: 'evren360-sistem',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 70,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/SectorManagementCenter.tsx',
    bekleyenIs: 'Ekran hâlâ sector-management.mock-repository okuyor.',
    tags: ['platform', 'sector', 'template']
  },
  {
    id: 'platform-notifications',
    code: 'platform-notifications',
    name: 'Sistem Duyuruları',
    description: 'Platform duyuru ve bildirim yönetimi.',
    icon: 'SD',
    route: 'evren360-system-announcements',
    navKey: 'evren360-system-announcements',
    groupKey: 'evren360-sistem',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 80,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/SystemAnnouncements.tsx',
    bekleyenIs: 'Duyuru tablosu veritabanında yok.',
    tags: ['platform', 'notifications']
  },
  {
    id: 'platform-support',
    code: 'platform-support',
    name: 'Destek Talepleri',
    description: 'Platform destek talebi yönetimi.',
    icon: 'DT',
    route: 'evren360-support',
    navKey: 'evren360-support',
    groupKey: 'evren360-sistem',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 90,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/SaasManagementCenter.tsx',
    bekleyenIs: 'Destek talebi tablosu veritabanında yok.',
    tags: ['platform', 'support']
  },
  {
    id: 'platform-settings',
    code: 'platform-settings',
    name: 'Sistem Ayarları',
    description: 'EVREN360 platform ayarları.',
    icon: 'SA',
    route: 'evren360-settings',
    navKey: 'evren360-settings',
    groupKey: 'evren360-sistem',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 100,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/SaasManagementCenter.tsx',
    bekleyenIs: 'Platform ayarları veritabanında tutulmuyor.',
    tags: ['platform', 'settings']
  },

  // ── Menüde görünmeyen rotalar ────────────────────────────────────────────
  // Bunlar ya başka bir ögenin EŞİ (aynı işi yapan ikinci menü) ya da eski
  // rota kayıtları. Rota tanımı duruyor (eski bağlantılar kırılmasın) ama
  // menüde yer kaplamıyorlar. Hepsi `hazirlaniyor` olduğu için rota kapısı
  // da onları açmaz.
  {
    id: 'platform-analytics',
    code: 'platform-analytics',
    name: 'Müşteri İstatistikleri',
    description: 'Kontrol Paneli ile aynı işi yapıyor; oraya birleşecek.',
    icon: 'MI',
    route: 'evren360-customer-statistics',
    navKey: 'evren360-customer-statistics',
    groupKey: 'evren360-sistem',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 200,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/CustomerStatistics.tsx',
    bekleyenIs: 'Kontrol Paneli ile birleşecek.',
    hidden: true,
    tags: ['platform', 'analytics']
  },
  {
    id: 'platform-company-management',
    code: 'platform-company-management',
    name: 'İşletme Yönetimi',
    description: 'Tenant Yönetimi ile aynı işi yapıyor.',
    icon: 'IY',
    route: 'evren360-company-management',
    navKey: 'evren360-company-management',
    groupKey: 'evren360-musteriler',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 201,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/CompanyManagement.tsx',
    bekleyenIs: 'Tenant Yönetimi ile birleşecek.',
    hidden: true,
    tags: ['platform', 'tenant', 'company']
  },
  {
    id: 'platform-monitoring',
    code: 'platform-monitoring',
    name: 'İstatistikler',
    description: 'Kontrol Paneli ile aynı işi yapıyor.',
    icon: 'IS',
    route: 'evren360-stats',
    navKey: 'evren360-stats',
    groupKey: 'evren360-sistem',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 202,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/SaasManagementCenter.tsx',
    bekleyenIs: 'Kontrol Paneli ile birleşecek.',
    hidden: true,
    tags: ['platform', 'monitoring', 'telemetry']
  },
  {
    id: 'platform-saas-applications',
    code: 'platform-saas-applications',
    name: 'Başvurular',
    description: 'Onay Bekleyen İşletmeler ile aynı işi yapıyor.',
    icon: 'BV',
    route: 'evren360-applications',
    navKey: 'evren360-applications',
    groupKey: 'evren360-musteriler',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 203,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/SaasManagementCenter.tsx',
    bekleyenIs: 'Onay Bekleyen İşletmeler ekranı bu işi veritabanıyla yapıyor.',
    hidden: true,
    tags: ['platform', 'saas']
  },
  {
    id: 'platform-saas-companies',
    code: 'platform-saas-companies',
    name: 'Firmalar',
    description: 'Müşteri Listesi ile aynı işi yapıyor.',
    icon: 'FR',
    route: 'evren360-companies',
    navKey: 'evren360-companies',
    groupKey: 'evren360-musteriler',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 204,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/SaasManagementCenter.tsx',
    bekleyenIs: 'Müşteri Listesi ile birleşecek.',
    hidden: true,
    tags: ['platform', 'company']
  },
  {
    id: 'platform-marketplace',
    code: 'platform-marketplace',
    name: 'Modüller',
    description: 'Paket modülleri Lisans Yönetimi içinde görünüyor.',
    icon: 'MD',
    route: 'evren360-modules',
    navKey: 'evren360-modules',
    groupKey: 'evren360-lisans',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 205,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/SaasManagementCenter.tsx',
    bekleyenIs: 'Lisans Yönetimi paket modüllerini zaten gösteriyor.',
    hidden: true,
    tags: ['platform', 'marketplace', 'modules']
  },
  {
    id: 'platform-licenses',
    code: 'platform-licenses',
    name: 'Lisanslar',
    description: 'Lisans Yönetimi ile aynı işi yapıyor.',
    icon: 'LS',
    route: 'evren360-licenses',
    navKey: 'evren360-licenses',
    groupKey: 'evren360-lisans',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 206,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/SaasManagementCenter.tsx',
    bekleyenIs: 'Lisans Yönetimi bu işi veritabanıyla yapıyor.',
    hidden: true,
    tags: ['platform', 'license']
  },
  {
    id: 'platform-subscriptions',
    code: 'platform-subscriptions',
    name: 'Abonelikler',
    description: 'Lisans Yönetimi ile aynı işi yapıyor.',
    icon: 'AB',
    route: 'evren360-subscriptions',
    navKey: 'evren360-subscriptions',
    groupKey: 'evren360-lisans',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 207,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/SaasManagementCenter.tsx',
    bekleyenIs: 'Lisans Yönetimi ile birleşecek.',
    hidden: true,
    tags: ['platform', 'subscription']
  },
  {
    id: 'platform-users',
    code: 'platform-users',
    name: 'Kullanıcılar',
    description: 'Kullanıcı sayısı şirket detay sayfasında görünecek.',
    icon: 'KU',
    route: 'evren360-users',
    navKey: 'evren360-users',
    groupKey: 'evren360-musteriler',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 208,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/SaasManagementCenter.tsx',
    bekleyenIs: 'Şirket detay sayfasının kullanıcı bölümüne taşınacak.',
    hidden: true,
    tags: ['platform', 'users']
  },
  {
    id: 'platform-business-registration',
    code: 'platform-business-registration',
    name: 'İşletme Başvuruları',
    description: 'Eski rota kaydı.',
    icon: 'BV',
    route: 'business-registration-system',
    navKey: 'business-registration-system',
    groupKey: 'evren360-musteriler',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 210,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/BusinessApplicationSystem.tsx',
    bekleyenIs: 'Eski rota; Onay Bekleyen İşletmeler kullanılıyor.',
    hidden: true,
    tags: ['platform', 'applications']
  },
  {
    id: 'platform-company-setup',
    code: 'platform-company-setup',
    name: 'Çalışma Alanı Kurulumu',
    description: 'Eski rota kaydı.',
    icon: 'KW',
    route: 'company-setup-wizard',
    navKey: 'company-setup-wizard',
    groupKey: 'evren360-musteriler',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 211,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/CompanySetupWizard.tsx',
    bekleyenIs: 'Eski rota; başvuru onayı kiracıyı zaten kuruyor.',
    hidden: true,
    tags: ['platform', 'setup']
  },
  {
    id: 'platform-module-activation',
    code: 'platform-module-activation',
    name: 'Modül Aktivasyon Sistemi',
    description: 'Eski rota kaydı.',
    icon: 'MA',
    route: 'module-activation-system',
    navKey: 'module-activation-system',
    groupKey: 'evren360-lisans',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 212,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/ModuleActivationSystem.tsx',
    bekleyenIs: 'Eski rota.',
    hidden: true,
    tags: ['platform', 'modules']
  },
  {
    id: 'platform-package-license-management',
    code: 'platform-package-license-management',
    name: 'Paket Lisans Yönetimi',
    description: 'Eski rota kaydı.',
    icon: 'PL',
    route: 'package-license-management',
    navKey: 'package-license-management',
    groupKey: 'evren360-lisans',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 213,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/PackageLicenseManagement.tsx',
    bekleyenIs: 'Eski rota.',
    hidden: true,
    tags: ['platform', 'license']
  },
  {
    id: 'platform-user-subscription-management',
    code: 'platform-user-subscription-management',
    name: 'Kullanıcı Abonelikleri',
    description: 'Eski rota kaydı.',
    icon: 'UA',
    route: 'user-subscription-management',
    navKey: 'user-subscription-management',
    groupKey: 'evren360-lisans',
    scope: MODULE_SCOPES.PLATFORM,
    displayOrder: 214,
    veriKaynagi: 'hazirlaniyor',
    kaynakDosya: 'pages/UserSubscriptionManagement.tsx',
    bekleyenIs: 'Eski rota.',
    hidden: true,
    tags: ['platform', 'subscription']
  }
]

export const getPlatformRegistry = () => (
  [...PLATFORM_MODULE_REGISTRY].sort((first, second) => first.displayOrder - second.displayOrder)
)

export const getPlatformRoutes = () => new Set<PlatformRoute>(
  getPlatformRegistry().map(item => item.route)
)

/**
 * Gerçekten veritabanını okuyan platform rotaları. ÜÇ KAPININ TEK KAYNAĞI.
 * Bir ekranı buraya sokmanın tek yolu `veriKaynagi: 'veritabani'` yazmak,
 * ve bunu da arch testi kaynak dosyaya bakarak doğruluyor.
 */
export const PLATFORM_HAZIR_ROTALAR = new Set<PlatformRoute>(
  PLATFORM_MODULE_REGISTRY
    .filter(item => item.veriKaynagi === 'veritabani')
    .map(item => item.route)
)

export const platformRotasiHazir = (route: string) => (
  PLATFORM_HAZIR_ROTALAR.has(route as PlatformRoute)
)

/** Panele girince açılacak ilk ekran: hazır olanların ilki. */
export const getIlkHazirPlatformRotasi = (): PlatformRoute => {
  const ilk = getPlatformRegistry().find(item => item.veriKaynagi === 'veritabani' && !item.hidden)
  // Hazır ekran kalmadıysa yine de bir yere gitmek gerekiyor; kilit ekranı
  // gerekçesini gösterir.
  return ilk?.route ?? 'evren360-pending-applications'
}

export const createPlatformNavGroups = (): ShellNavGroup<AppRoute, AppNavKey, AppNavGroupKey>[] => {
  const kayit = getPlatformRegistry()

  return PLATFORM_NAV_GROUPS.map(group => ({
    key: group.key as AppNavGroupKey,
    title: group.title,
    icon: group.icon,
    items: kayit
      .filter(item => item.groupKey === group.key)
      .map<ShellNavItem<AppRoute, AppNavKey>>(item => ({
        key: item.navKey,
        label: item.name,
        route: item.route,
        icon: item.icon,
        adminOnly: true,
        platformAdminOnly: true,
        hidden: item.hidden,
        locked: item.veriKaynagi !== 'veritabani',
        disabledReason: item.veriKaynagi !== 'veritabani'
          ? `${HAZIRLANIYOR_MESAJI} ${item.bekleyenIs ?? ''}`.trim()
          : undefined
      }))
  })).filter(group => group.items.some(item => !item.hidden))
}
