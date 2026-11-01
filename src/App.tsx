import React from 'react'
import BusinessApplicationSystem from './pages/BusinessApplicationSystem'
import BusinessApplicationPublicForm from './pages/BusinessApplicationPublicForm'
import Portal from './pages/Portal'
import CompanySetupWizard from './pages/CompanySetupWizard'
import FirstLoginWizard from './pages/FirstLoginWizard'
import PackageLicenseManagement from './pages/PackageLicenseManagement'
import UserSubscriptionManagement from './pages/UserSubscriptionManagement'
import ModuleActivationSystem from './pages/ModuleActivationSystem'
import TenantManagement from './pages/TenantManagement'
import SaasManagementCenter, { SaasManagementView } from './pages/SaasManagementCenter'
import CustomerList from './pages/CustomerList'
import CustomerDetail from './pages/CustomerDetail'
import PendingApplications from './pages/PendingApplications'
import LisansYonetimi from './pages/LisansYonetimi'
import SystemAnnouncements from './pages/SystemAnnouncements'
import CustomerStatistics from './pages/CustomerStatistics'
import CompanyManagement from './pages/CompanyManagement'
import BillingManagement from './pages/BillingManagement'
import SectorManagementCenter from './pages/SectorManagementCenter'
import Login from './pages/Login'
import SifreBelirle from './pages/SifreBelirle'
import VardiyaKilidi from './components/VardiyaKilidi'
import {
  HAREKET_OLAYLARI, kilitlenmeliMi, sonHareketiOku, sonHareketiSil,
  sonHareketiYaz, yazmaZamaniMi,
} from './auth/oturum-kilidi'
import { davetiCozumle, type DavetBilgisi } from './auth/davet'
import AppShell, { ShellNavGroup, ShellNavItem } from './components/AppShell'
import OnboardingExperience from './components/OnboardingExperience'
import RouteErrorBoundary from './components/RouteErrorBoundary'
import { tekerlegiZincirle } from './components/tekerlek-zinciri'
import {
  clearDecisionIndexedRecords,
  isDecisionStorageError
} from './read-model/decision-indexed-storage.service'
import { resolveSecurityTargetForIdentity } from './auth/authentication-pipeline'
import {
  AuthenticationState,
  evaluateAuthenticationStateTarget,
  getInitialAuthenticationState,
  logoutAuthentication
} from './auth/authentication.service'
import { LOGIN_ROUTE_TARGETS, LoginRedirectResult } from './routing/routing.types'
import {
  ensureDefaultAdmin,
  loadCompanies,
  loadSettings,
  loadUsers,
  getVisibleBranchesForUser,
  getActiveBranchId,
  setActiveBranchId,
  migrateBranchScopedData,
  LICENSE_MODULE_CATALOG,
  addLicenseAccessFailureLog,
  getCompanyIdForUser,
  setCurrentUser,
  LICENSE_ACCESS_DENIED_MESSAGE
} from './storage'
import { loadPermissionsForUser } from './authorization/permission.repository'
import { getFirstLoginOnboardingState } from './onboarding/onboarding.service'
import { Branch, LicenseModuleKey, User } from './types'
import BusinessWorkspaceRouteHost from './modules/BusinessWorkspaceRouteHost'
import { cekirdekModulGorunur } from './navigation/core-module-visibility'
import {
  createBusinessWorkspaceNavGroups,
  createLicensedNavModuleMap,
  createLicensedRouteModuleMap
} from './modules/business-workspace.navigation'
import type {
  AppNavGroupKey as NavGroupKey,
  AppNavKey as NavKey,
  AppRoute as Route,
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from './navigation/app-navigation.types'
import {
  getWorkspaceModuleLifecycleStateByLicenseKeyForUser,
  isWorkspaceLicenseModuleActiveForUser,
  isWorkspaceModuleActiveForUser,
  WORKSPACE_MODULE_LIFECYCLE_EVENT,
  WORKSPACE_MODULE_LIFECYCLE_STATES
} from './workspace/workspace-module-lifecycle.service'
import type { WorkspaceModuleLifecycleResult } from './workspace/workspace-module-lifecycle.service'
import { WORKSPACE_PROVISIONING_EVENT } from './workspace-provisioning/workspace-provisioning.service'
import type { Evren360Notification } from './notifications/evren360-notification.service'
import { hasConnectedWorkspaceIntegrationsForUser } from './integrations/workspace-integration.service'
import {
  createPlatformNavGroups,
  getIlkHazirPlatformRotasi,
  getPlatformRegistry,
  getPlatformRoutes,
  platformRotasiHazir
} from './platform/platform.registry'
import { isletmeAyarlariniOku } from './workspace/isletme-ayarlari.repository'
import { paraBirimiAyarla, paraBirimiDegisinceBildir, paraBirimiOturumuTazele } from './billing'
import { syncWorkspaceCompanyFromDatabase } from './companies/company-bridge'
import { getDefaultModules } from './sector/sector-template.service'
import { getBusinessMenuEmptyState, getWorkspaceTemplateViewForUser } from './workspace-template/workspace-template.service'
import { WORKSPACE_MODULE_CODES } from './modules/module-code.registry'
import {
  DECISION_SUPPORT_WORKSPACE_MODULE_CODE,
  KPI_REPORTING_MODULE_CODE,
  MENUSUZ_ROTA_ETIKETLERI,
  getBusinessWorkspaceModuleByCode,
  getBusinessWorkspaceModuleByLicenseKey,
  getCoreWorkspaceRoutes,
  isBusinessWorkspaceModuleAvailableForSector
} from './modules/business-workspace.registry'

type NavItem = ShellNavItem<Route, NavKey>
type NavGroup = ShellNavGroup<Route, NavKey, NavGroupKey>

const INSTALLATION_LOCK_MESSAGE = 'Kurulum tamamlanmadan Kontrol Paneli, Çalışma Alanı ve Modül Mağazası kullanılamaz. Lütfen işletme kurulum sihirbazı adımlarını tamamlayın.'
const INSTALLATION_LOCKED_NAV_KEYS = new Set<NavKey>(['dashboard', 'workspace', 'marketplace'])
const INSTALLATION_LOCKED_ROUTES = new Set<Route>(['summary', 'settings', 'marketplace'])

const flattenAppNavItems = (items: NavItem[]): NavItem[] => (
  items.flatMap(item => [
    item,
    ...flattenAppNavItems((item.children || []) as NavItem[])
  ])
)

const licensedNavModules: Partial<Record<NavKey, LicenseModuleKey>> = createLicensedNavModuleMap()
const licensedRouteModules: Partial<Record<Route, LicenseModuleKey>> = createLicensedRouteModuleMap()
const allBusinessWorkspaceNavGroups = createBusinessWorkspaceNavGroups() as NavGroup[]
const platformRouteSet = getPlatformRoutes() as Set<Route>
const platformNavGroups: NavGroup[] = createPlatformNavGroups() as NavGroup[]

// ADR-002: tek kaynak registry'deki beyaz liste. Dondurulmuş modüllerin ve menü
// ögelerinin rotaları buraya hiç girmez; navigasyon dışından açılan rotalar
// (profil, karşılama vb.) NON_NAV_CORE_ROUTES üzerinden gelir.
const businessWorkspaceRouteSet = getCoreWorkspaceRoutes() as Set<Route>

const isBusinessWorkspaceRoute = (nextRoute: Route): nextRoute is BusinessWorkspaceRoute => {
  return businessWorkspaceRouteSet.has(nextRoute)
}

const isWorkspaceBootstrapRoute = (nextRoute: Route) => {
  return nextRoute === 'workspace-welcome'
}

const isWorkspaceSetupCompletedForUser = (user: User | null) => {
  if(!user) return false

  const onboardingState = getFirstLoginOnboardingState(user)
  return Boolean(onboardingState.installationCompleted || !onboardingState.setup)
}

const getPrimarySectorIdForUser = (user: User | null | undefined) => {
  const companyId = getCompanyIdForUser(user)
  if(!companyId) return ''

  return loadCompanies({ allTenants: true }).find(company => company.id === companyId)?.primarySectorId || ''
}

/**
 * Bu modül, işletmenin sektöründe VARSAYILAN mı?
 *
 * ── ÖNCEKİ HÂLİ VE NEDEN YANLIŞTI ────────────────────────────────────────
 * Eskiden tek bir modül elle sabitlenmişti:
 *
 *     moduleCode === WORKSPACE_MODULE_CODES.PURCHASE && Boolean(primarySectorId)
 *
 * Yani "Satın Alma" her sektörde açıktı, diğer bütün varsayılan modüller ise
 * ayrıca AKTİVE edilmedikçe menüde hiç görünmüyordu. Oysa sektör şablonu
 * (`sector-template.registry.ts`) zaten `defaultModules` / `optionalModules`
 * ayrımını yapıyor ve "varsayılan" kelimesinin anlamı tam olarak budur:
 * işletme o sektörde ise o modül baştan açıktır.
 *
 * Sonuç, Endüstriyel Mutfak'ta şuydu: sektör doğru kurulsa bile Depo, Stok,
 * Reçete, Üretim ve Cari menüde çıkmıyordu — çünkü hiçbiri "PURCHASE" değildi.
 * Kullanıcı boş bir OPERATIONS bölümü görüyor ve sebebini bulamıyordu.
 *
 * Artık kaynak şablonun kendisi. OPSİYONEL modüller değişmedi: onlar hâlâ
 * Modül Mağazası'ndan aktive edilmeyi bekler.
 */
const isWorkspaceNavigationBaseModule = (
  moduleCode: string,
  primarySectorId: string
) => {
  if(!primarySectorId) return false
  return (getDefaultModules(primarySectorId) as readonly string[]).includes(moduleCode)
}

const isDecisionSupportWorkspaceNavigationEnabled = (
  user: User | null,
  moduleCode: string
) => {
  if(moduleCode !== DECISION_SUPPORT_WORKSPACE_MODULE_CODE) return false

  const reportingModule = getBusinessWorkspaceModuleByCode(KPI_REPORTING_MODULE_CODE)
  return Boolean(reportingModule && isWorkspaceModuleActiveForUser(user, reportingModule))
}

const lockInstallationNavItems = (items: NavItem[]): NavItem[] => (
  items.map(item => {
    const children = item.children ? lockInstallationNavItems(item.children as NavItem[]) : undefined
    const locked = INSTALLATION_LOCKED_NAV_KEYS.has(item.key)

    return locked
      ? {
          ...item,
          children,
          locked: true,
          disabledReason: INSTALLATION_LOCK_MESSAGE
        }
      : {
          ...item,
          children
        }
  })
)

const lockWorkspaceNavGroupsUntilInstallation = (groups: NavGroup[], setupCompleted: boolean): NavGroup[] => {
  if(setupCompleted) return groups

  return groups.map(group => ({
    ...group,
    items: lockInstallationNavItems(group.items as NavItem[])
  }))
}

const createWorkspaceNavGroupsForUser = (user: User | null) => {
  // Kapanışta `user`ın null olabileceğini TypeScript daraltamadığı için
  // izin listesi önce yerel bir değişkene alınıyor.
  const userPermissions = user?.permissions
  const setupCompleted = isWorkspaceSetupCompletedForUser(user)
  const primarySectorId = getPrimarySectorIdForUser(user)
  const businessMenuEmptyState = setupCompleted
    ? getBusinessMenuEmptyState(getWorkspaceTemplateViewForUser(user))
    : undefined

  const groups = createBusinessWorkspaceNavGroups({
    // Aşama 1 · "Yetkisiz uç yok": izni olmayan menü ögesi hiç üretilmez.
    // `user.permissions` girişte veritabanından yüklenir (0014 +
    // authorization/permission.repository.ts). `undefined` ise (bu
    // değişiklikten önce açılmış bir oturum) süzme yapılmaz — gerekçe
    // authorization/route-permission.ts dosya başında.
    // İkinci savunma hattı: BusinessWorkspaceRouteHost'taki rota kontrolü.
    hasPermission: userPermissions
      ? permission => !permission || userPermissions.includes(permission)
      : undefined,
    // Kural `src/navigation/core-module-visibility.ts` içinde — hem burası
    // hem `module-route-health.test.ts` aynı işlevi çağırıyor. Kural burada
    // gömülüyken test onu hiç görmüyordu ve "menüde var" diyen test yeşilken
    // Ayarlar ekranda yoktu.
    isCoreModuleVisible: module => cekirdekModulGorunur(module.code, {
      kurulumTamam: setupCompleted,
      entegrasyonVar: hasConnectedWorkspaceIntegrationsForUser(user),
    }),
    isModuleEnabled: module => {
      if(!isBusinessWorkspaceModuleAvailableForSector(module, primarySectorId)) return false
      if(isWorkspaceNavigationBaseModule(module.code, primarySectorId)) return true
      if(module.isCoreModule || module.isAlwaysActive) return true
      if(module.isBusinessModule){
        return isWorkspaceModuleActiveForUser(user, module)
          || isDecisionSupportWorkspaceNavigationEnabled(user, module.code)
      }
      if(module.isIntegrationModule){
        return isWorkspaceModuleActiveForUser(user, module)
      }
      return module.isEnabled && module.isVisible
    },
    showBusinessModuleEmptyAction: setupCompleted,
    businessModuleEmptyState: businessMenuEmptyState ? {
      title: businessMenuEmptyState.title,
      description: businessMenuEmptyState.description,
      actionLabel: businessMenuEmptyState.actionLabel
    } : undefined
  }) as NavGroup[]

  return lockWorkspaceNavGroupsUntilInstallation(groups, setupCompleted)
}

const isInstallationLockedRoute = (
  user: User | null,
  isPlatformAdmin: boolean,
  nextRoute: Route
) => (
  !isPlatformAdmin
  && !isWorkspaceSetupCompletedForUser(user)
  && INSTALLATION_LOCKED_ROUTES.has(nextRoute)
)

const getFirstVisibleWorkspaceNavItem = (user: User | null) => {
  return createWorkspaceNavGroupsForUser(user)
    .flatMap(group => flattenAppNavItems(group.items).map(item => ({ item, groupKey: group.key })))
    .find(({ item }) => item.route && (!item.adminOnly || user?.role === 'Admin'))
}

/**
 * Platform (EVREN360) yöneticisi mi?
 *
 * ── ESKİ ÖLÇÜT VE NEDEN DEĞİŞTİ (2026-08-29) ─────────────────────────────
 * Önceki kural şuydu: `role === 'Admin' && hiçbir firmaya bağlı değil`.
 * Bu, gerçek bir izin sistemi yokken kullanılan bir VEKİLDİ — "firması olmayan
 * admin" demek, "platform admini" demenin dolaylı yoluydu. Tek platform admini
 * de `storage.ts` içindeki `admin/admin123` tohum kaydıydı.
 *
 * G4'te o düz metin parolalı tohum kaldırıldı (PLAN.md §5) ve giriş Supabase
 * Auth'a taşındı. Ama kimse şunu fark etmedi: platform paneline giden TEK yol
 * o tohum hesaptı. `0008` ile oluşturulan gerçek yönetici bir firmaya bağlı
 * olduğu için ölçüt onu platform admini saymıyor — yani panel, kimse karar
 * vermeden sessizce erişilemez hâle geldi. Bu bir regresyondu, tasarım değil.
 *
 * Artık gerçek bir izin kataloğu var (0014/0015): `platform.manage`. Ölçüt
 * dolaylı ipucu yerine doğrudan o izne bakıyor — yetki çerçevesinin
 * (docs/yetki-cercevesi.md) zaten öngördüğü şey buydu.
 *
 * ⚠️ Bu bir GÜVENLİK SINIRI DEĞİLDİR; `route-permission.ts` dosya başındaki
 * gerekçenin aynısı geçerli: liste tarayıcıda duruyor. Gerçek koruma
 * veritabanındadır (RLS + sütun GRANT'leri). Buradaki kontrol, kullanıcıya
 * çalışmayacak kapılar göstermemek içindir.
 */
const isPlatformAdminUser = (user?: User | null) => {
  // İzinler yüklendiyse ölçüt izindir. `[]` ("hiçbir izni yok") da geçerli bir
  // cevaptır ve `false` döner — `undefined` ("henüz yüklenmedi") ile aynı şey değil.
  if(user?.permissions) return user.permissions.includes('platform.manage')

  // İzinler yüklenmemiş (bu değişiklikten önce açılmış oturum): eski ölçüt.
  return user?.role === 'Admin' && !getCompanyIdForUser(user)
}

const canUserAccessWorkspaceModule = (
  user: User | null | undefined,
  moduleKey: LicenseModuleKey
) => {
  const module = getBusinessWorkspaceModuleByLicenseKey(moduleKey)
  const primarySectorId = getPrimarySectorIdForUser(user)

  if(module && isBusinessWorkspaceModuleAvailableForSector(module, primarySectorId) && isWorkspaceNavigationBaseModule(module.code, primarySectorId)){
    return true
  }

  const lifecycleState = getWorkspaceModuleLifecycleStateByLicenseKeyForUser(user, moduleKey)
  return lifecycleState === WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE
    && isWorkspaceLicenseModuleActiveForUser(user, moduleKey)
}

const evren360RouteViews: Partial<Record<Route, SaasManagementView>> = {
  'evren360-dashboard': 'dashboard',
  'evren360-applications': 'applications',
  'evren360-companies': 'companies',
  'evren360-packages': 'packages',
  'evren360-modules': 'modules',
  'evren360-licenses': 'licenses',
  'evren360-subscriptions': 'subscriptions',
  'evren360-users': 'users',
  'evren360-support': 'support',
  'evren360-stats': 'stats',
  'evren360-settings': 'settings'
}

/** Bir platform rotasının hangi menü grubuna ait olduğunu söyler. */
const platformGrupAnahtari = (route: string) => (
  getPlatformRegistry().find(item => item.route === route)?.groupKey
    ?? 'evren360-musteriler'
)

const getDefaultNavigation = (user: User | null, loginRedirect: LoginRedirectResult) => {
  if(loginRedirect.target === LOGIN_ROUTE_TARGETS.EVREN360){
    // ⚠️ Eskiden 'evren360-dashboard' açılıyordu. O ekran localStorage
    // okuyor (bkz. platform.registry.ts başlığı) ve platform sahibine boş
    // sayaçlar gösteriyordu. Panel artık GERÇEKTEN çalışan ilk ekranla
    // açılıyor.
    const ilkRota = getIlkHazirPlatformRotasi()
    return {
      route: ilkRota as Route,
      activeNavKey: ilkRota as NavKey,
      openGroupKey: platformGrupAnahtari(ilkRota) as NavGroupKey
    }
  }

  if(loginRedirect.target === LOGIN_ROUTE_TARGETS.BUSINESS_WORKSPACE_ADMIN && user?.role === 'Admin'){
    if(isWorkspaceSetupCompletedForUser(user)){
      return {
        route: 'summary' as Route,
        activeNavKey: 'dashboard' as NavKey,
        openGroupKey: 'system-modules' as NavGroupKey
      }
    }

    return {
      route: 'workspace-welcome' as Route,
      activeNavKey: 'workspace-welcome' as NavKey,
      openGroupKey: 'system-modules' as NavGroupKey
    }
  }

  const firstWorkspaceItem = getFirstVisibleWorkspaceNavItem(user)
  return {
    route: (firstWorkspaceItem?.item.route || 'workspace-welcome') as Route,
    activeNavKey: (firstWorkspaceItem?.item.key || 'workspace-welcome') as NavKey,
    openGroupKey: (firstWorkspaceItem?.groupKey || 'system-modules') as NavGroupKey
  }
}

const LicenseAccessDenied = ({ moduleKey }: { moduleKey?: LicenseModuleKey }) => {
  const moduleName = moduleKey
    ? LICENSE_MODULE_CATALOG.find(module => module.key === moduleKey)?.name
    : ''

  return (
    <section className="card license-denied-page">
      <span className="status-pill danger-pill">403</span>
      <h2>Erişim Engellendi</h2>
      <p>{LICENSE_ACCESS_DENIED_MESSAGE}</p>
      {moduleName && <small>Modül: {moduleName}</small>}
    </section>
  )
}

const PlatformAccessDenied = () => (
  <section className="card license-denied-page">
    <span className="status-pill danger-pill">403</span>
    <h2>Erişim Engellendi</h2>
    <p>EVREN360 Yönetici Paneli yalnızca Super Admin kullanıcısı tarafından görüntülenebilir.</p>
  </section>
)

/**
 * Platform panelindeki bir ekran henüz gerçek veriye bağlı değilse, eski
 * ekranı GÖSTERMEK yerine bu panel çıkar.
 *
 * Neden: o ekranların 17'si `storage.ts` (tarayıcının localStorage'ı) ya da
 * bir `.mock` dosyası okuyor. Sunucuda localStorage boş olduğu için ekran
 * "0 müşteri" diyordu — platform sahibinin müşterisi varken. Boş sayaç
 * göstermek, "henüz bağlamadık" demekten daha kötü: yanlış bilgi veriyor.
 *
 * Bu, menü kilidinin (locked) ve rota kapısının ÜÇÜNCÜ ayağı.
 * Tek kaynak: `platform.registry.ts` · `PLATFORM_HAZIR_ROTALAR`.
 */
const PlatformEkranHazirDegil = ({ route }: { route: Route }) => {
  const kayit = getPlatformRegistry().find(item => item.route === route)

  return (
    <section className="card license-denied-page">
      <span className="status-pill warning-pill">Hazırlanıyor</span>
      <h2>{kayit?.name || 'Bu ekran'} henüz gerçek veriye bağlı değil</h2>
      <p>
        Bu ekran şu an uygulamanın kendi tarayıcı hafızasını okuyor, veritabanını
        okumuyor. Bu yüzden kapalı: boş ya da yanlış sayı göstermesin.
      </p>
      {kayit?.bekleyenIs && (
        <p><strong>Yapılacak:</strong> {kayit.bekleyenIs}</p>
      )}
      <p className="muted">
        Çalışan ekranlar: Onay Bekleyen İşletmeler ve Lisans Yönetimi.
      </p>
    </section>
  )
}

const getRouteSecurityTarget = (route: Route, authState: AuthenticationState) => {
  if(platformRouteSet.has(route)) return LOGIN_ROUTE_TARGETS.EVREN360
  return resolveSecurityTargetForIdentity(authState.pipeline.identity)
}

/**
 * Davet bağlantısı, adresin `#` kısmında gelir (A4D madde 6).
 *
 * ⚠️ BİR KEZ, MODÜL YÜKLENİRKEN okunuyor. Sebebi: `SifreBelirle` ekranı
 * jetonu oturuma çevirir çevirmez adres çubuğunu TEMİZLİYOR. Sonradan
 * okusaydık, ilk çizimden sonra parça kaybolmuş olurdu ve kullanıcı
 * "davet yok" sayılıp normal giriş ekranına düşerdi.
 */
const ILK_DAVET: DavetBilgisi =
  typeof window === 'undefined' ? { durum: 'yok' } : davetiCozumle(window.location.hash)

export default function App(){
  const [davet, setDavet] = React.useState<DavetBilgisi>(ILK_DAVET)
  // ── 2026-10-21 · PUBLIC QR YOLU KAPATILDI (MIYOP-067) ──────────────────
  // Burada `/qr/<id>` yolunu yakalayan bir eşleşme vardı ve eşleşince
  // `QRMenu` ekranını DOĞRUDAN döndürüyordu — yani `business-qr-menu`
  // modülü `foundationScope: 'frozen'` olmasına rağmen o sayfa açılıyordu.
  // Donmuş rota kapısı `BusinessWorkspaceRouteHost`ta duruyor ama bu dönüş
  // o kapının DIŞINDAYDI (Codex, MIYOP-067).
  // Dahası ekran "Görevli çağrınız iletildi" / "Talebiniz görevli onayına
  // gönderildi" diyordu; yazım yalnız `localStorage`a gidiyordu, sunucuya
  // hiçbir şey iletilmiyordu. Emrah'ın kuralı: *"ortaya koyduğumuz bir şey
  // varsa o şey çalışsın... mış gibi yapmasın."*
  // ⚠️ Yol GERİ AÇILACAKSA önce gerçek servis yazılır (masa/talep/çağrı
  // tabloları + RLS), sonra bu yol açılır. Modülün ne işe yaradığı
  // `docs/kararlar/kaldirilan-moduller.md`ye yazılacak (HEDEFLER 3.8.6).
  const businessApplicationRouteMatch = window.location.pathname.match(/^\/(?:basvuru|apply)\/?$/)
  // Müşteri sipariş portalı (A4C3). Kiracı bu bağlantıyı KENDİ SİTESİNE
  // gömüyor; bağlantı bir sır taşımıyor, kimliği e-posta belirliyor.
  const portalRouteMatch = window.location.pathname.match(/^\/(?:portal|siparis)\/?$/)
  const initialAuthState = React.useMemo(() => getInitialAuthenticationState({
    requestedPath: window.location.pathname
  }), [])
  const initialUser = initialAuthState.currentUser
  const authStateRef = React.useRef(initialAuthState)
  const initialNavigation = React.useMemo(() => {
    return getDefaultNavigation(initialUser, initialAuthState.pipeline.loginRedirect)
  }, [initialAuthState, initialUser])
  const [route, setRoute] = React.useState<Route>(initialNavigation.route)
  const [activeNavKey, setActiveNavKey] = React.useState<NavKey>(initialNavigation.activeNavKey)
  const [openGroupKey, setOpenGroupKey] = React.useState<NavGroupKey | null>(initialNavigation.openGroupKey)
  const [currentUser, setUserState] = React.useState<User | null>(initialUser)
  const [settings, setSettings] = React.useState(() => loadSettings())
  const [branches, setBranches] = React.useState<Branch[]>(() => getVisibleBranchesForUser(initialUser))
  const [activeBranchId, setActiveBranchState] = React.useState(() => getActiveBranchId())
  const [licenseAccessError, setLicenseAccessError] = React.useState('')
  /**
   * ⚠️ İZİN LİSTESİ EKSİKSE EKRAN AÇILMAZ (13.10.2026).
   *
   * Codex denetimi: *"eksik izin listesi 50 rotayı hâlâ geçiriyor."* Sebep,
   * `route-permission.ts` içindeki bilinçli taviz: `permissions === undefined`
   * "henüz yüklenmedi" sayılıyor ve SÜZME YAPILMIYOR. O taviz, tavizin kendisi
   * yüzünden değil, `undefined`in KALICI olabilmesi yüzünden tehlikeliydi —
   * eski bir oturum ya da (12.10'da düzeltilen) `normalizeUser` alan kaybı
   * yetki çerçevesini süresiz devre dışı bırakabiliyordu.
   *
   * Çözüm tavizi kaldırmak DEĞİL (kaldırmak, izin sorgusu düşen gerçek
   * kullanıcıları kapıda bırakırdı): `undefined`i KALICI OLMAKTAN çıkarmak.
   * Aşağıdaki etki, izin listesi eksik bir oturum bulduğunda onu
   * veritabanından yeniden okuyor; okuyamazsa oturumu kapatıyor. Okunana
   * kadar uygulama kabuğu HİÇ render edilmiyor.
   */
  const [izinleriTamamla, setIzinleriTamamla] = React.useState(
    Boolean(initialUser && initialUser.permissions === undefined),
  )
  const [storageRecoveryMessage, setStorageRecoveryMessage] = React.useState('')
  const [selectedCustomerId, setSelectedCustomerId] = React.useState('')
  const [selectedPendingApplicationId, setSelectedPendingApplicationId] = React.useState('')
  const [onboardingRefreshKey, setOnboardingRefreshKey] = React.useState(0)
  const [moduleInstallRefreshKey, setModuleInstallRefreshKey] = React.useState(0)
  const [onboardingExperienceStartSignal, setOnboardingExperienceStartSignal] = React.useState(0)
  const isPlatformAdmin = isPlatformAdminUser(currentUser)
  const evren360View = evren360RouteViews[route]
  const workspaceChrome = React.useMemo(() => {
    if(!currentUser || isPlatformAdmin){
      return {
        name: 'EVREN360',
        logoUrl: ''
      }
    }

    const companyId = getCompanyIdForUser(currentUser)
    const company = companyId
      ? loadCompanies({ allTenants: true }).find(item => item.id === companyId) || null
      : null

    return {
      name: company?.companyName || settings.restaurantName,
      logoUrl: company?.logoUrl || settings.logoUrl
    }
  }, [currentUser, isPlatformAdmin, settings.logoUrl, settings.restaurantName, onboardingRefreshKey])
  const firstLoginOnboardingState = React.useMemo(() => {
    if(!currentUser || isPlatformAdmin) return null
    return getFirstLoginOnboardingState(currentUser)
  }, [currentUser, isPlatformAdmin, onboardingRefreshKey])
  const firstLoginOnboardingRequired = Boolean(firstLoginOnboardingState?.required)
  const workspaceSetupCompleted = React.useMemo(() => (
    !isPlatformAdmin && isWorkspaceSetupCompletedForUser(currentUser)
  ), [currentUser, isPlatformAdmin, onboardingRefreshKey])

  const updateAuthenticationState = (state: AuthenticationState) => {
    authStateRef.current = state
    return state
  }

  const evaluateCurrentRouteSecurity = (nextRoute: Route) => {
    const currentAuthState = authStateRef.current
    const target = getRouteSecurityTarget(nextRoute, currentAuthState)
    authStateRef.current = evaluateAuthenticationStateTarget(currentAuthState, target)
  }

  const runBranchScopedMigration = React.useCallback((user?: User | null) => {
    if(!user) return

    try {
      migrateBranchScopedData(user)
    } catch (error) {
      console.warn('Sube veri migration hatasi atlandi.', error)
    }
  }, [])

  React.useEffect(()=>{
    ensureDefaultAdmin()
    runBranchScopedMigration(currentUser)
    setBranches(getVisibleBranchesForUser(currentUser))
    setActiveBranchState(getActiveBranchId())
  }, [currentUser, runBranchScopedMigration])
  React.useEffect(() => {
    document.title = workspaceChrome.name
  }, [workspaceChrome.name])
  // Geniş tablonun üstünde fare tekerleği sayfayı kaydırsın (Emrah, 10.10).
  // Gerekçe ve ölçüm sonuçları: src/components/tekerlek-zinciri.ts
  React.useEffect(() => tekerlegiZincirle(), [])
  React.useEffect(() => {
    evaluateCurrentRouteSecurity(route)
  }, [route])
  React.useEffect(() => {
    if(!currentUser || isPlatformAdmin || !workspaceSetupCompleted || route !== 'workspace-welcome') return
    setRoute('summary')
    setActiveNavKey('dashboard')
    setOpenGroupKey('system-modules')
  }, [currentUser, isPlatformAdmin, route, workspaceSetupCompleted])
  React.useEffect(() => {
    if(!currentUser || isPlatformAdmin || workspaceSetupCompleted) return
    if(!isBusinessWorkspaceRoute(route) || isWorkspaceBootstrapRoute(route)) return
    setRoute('workspace-welcome')
    setActiveNavKey('workspace-welcome')
    setOpenGroupKey('system-modules')
  }, [currentUser, isPlatformAdmin, route, workspaceSetupCompleted])
  React.useEffect(() => {
    if(!currentUser || isPlatformAdmin || route !== 'integration-center') return
    if(hasConnectedWorkspaceIntegrationsForUser(currentUser)) return
    setRoute(workspaceSetupCompleted ? 'summary' : 'workspace-welcome')
    setActiveNavKey(workspaceSetupCompleted ? 'dashboard' : 'workspace-welcome')
    setOpenGroupKey('system-modules')
  }, [currentUser, isPlatformAdmin, route, workspaceSetupCompleted])
  // Firma köprüsü — AÇILIŞTA da çalışır, yalnızca girişte değil.
  //
  // Köprü ilk hâlinde sadece `authenticateCredentials` içinde çağrılıyordu.
  // Ama bir oturum zaten açıksa (sayfa yenilendi, sekme kapanıp açıldı)
  // giriş akışı hiç koşmaz: `getInitialAuthenticationState()` kullanıcıyı
  // doğrudan localStorage'dan geri yükler. Yani mevcut oturumu olan herkes
  // köprüden hiç geçmiyor, sektörü boş kalıyor ve iş menüleri görünmüyordu —
  // "çıkış yapıp tekrar gir" demek bir çözüm değil, kusuru kullanıcıya
  // yıkmaktır.
  //
  // Köprü yazma yapmadıysa gereksiz yere yeniden çizmiyoruz: `sektor` yalnızca
  // gerçekten bir firma aynalandığında dolu döner.
  // ── PARA BİRİMİ · HEDEFLER 3.4.6 · 01.11.2026 ─────────────────────────
  // `billing.ts` eskiden sabit 'TRY' yazıyordu; bu dosyadan geçen 38 ekran
  // müşteri EUR seçse bile ₺ basıyordu. Değer artık BURADAN besleniyor.
  //
  // ⚠️ `formatCurrency` eşzamanlı ve çizim sırasında çağrılıyor; içine
  // veritabanı okuması konamaz. Bu yüzden okuma BİR KEZ burada yapılıp
  // biçimlendiriciye veriliyor.
  //
  // ⚠️ ÇIKIŞTA SIFIRLANIYOR. Aynı tarayıcıda başka bir işletmeye giriş
  // yapılırsa öncekinin para birimi ekranda kalırdı.
  //
  // ⚠️ OKUMA DÜŞERSE EKRAN BOZULMUYOR: biçimlendirici ₺'de kalır — göç
  // 0103'ün tetiği zaten her kiracıyı 'TRY' ile açıyor, yani en olası
  // doğru cevap o. Sessiz bir yanlış değil, bilinen bir varsayılan.
  //
  // ⚠️ MIYOP-086 · BURADAKİ `iptal` BAYRAĞI YETMİYORDU ve Codex ölçtü:
  // besleme çağrısı okuyucunun İÇİNDE (tek besleme noktası kararı), bayrak
  // ise `then` içindeydi — yan etki bayrağa hiç uğramadan oluyordu. Sonuç:
  // A çıkıp B girdikten sonra A'nın iptal edilmiş okuması dönerse ekranda
  // A'nın para birimi kalıyordu. Çağıranda tutulan bir bayrak, yan etki
  // daha derindeyse koruma sağlamaz.
  // Artık sayaç `billing.ts`te: burada bir kez artırılıyor, uçuştaki bütün
  // okumalar o anda geçersizleşiyor.
  React.useEffect(() => {
    paraBirimiOturumuTazele()
    if(!currentUser){
      paraBirimiAyarla(null)
      return
    }
    void isletmeAyarlariniOku()
      .catch(() => { /* ₺'de kalır; yukarıdaki nota bakın */ })
  }, [currentUser])

  // Para birimi giriş SONRASI geliyor; o ana kadar çizilmiş fiyatlar ₺
  // kalırdı. Bu abonelik, değer gelince ekranı yeniden çizdiriyor.
  const [, paraBirimiTazele] = React.useState(0)
  React.useEffect(() => paraBirimiDegisinceBildir(() => {
    paraBirimiTazele(sayac => sayac + 1)
  }), [])

  React.useEffect(() => {
    if(!currentUser) return
    let iptal = false

    void syncWorkspaceCompanyFromDatabase(currentUser).then(sektor => {
      if(iptal || !sektor) return
      // Menü ağacı `moduleInstallRefreshKey`e bağlı; köprü firmayı yazdıktan
      // sonra yeniden kurulması gerekiyor.
      setModuleInstallRefreshKey(current => current + 1)
    })

    return () => { iptal = true }
  }, [currentUser])

  React.useEffect(() => {
    const refreshWorkspaceModules = () => setModuleInstallRefreshKey(current => current + 1)

    window.addEventListener(WORKSPACE_MODULE_LIFECYCLE_EVENT, refreshWorkspaceModules)
    window.addEventListener(WORKSPACE_PROVISIONING_EVENT, refreshWorkspaceModules)

    return () => {
      window.removeEventListener(WORKSPACE_MODULE_LIFECYCLE_EVENT, refreshWorkspaceModules)
      window.removeEventListener(WORKSPACE_PROVISIONING_EVENT, refreshWorkspaceModules)
    }
  }, [])
  React.useEffect(() => {
    let recoveryTimer: number | undefined
    const recoverDecisionStorage = (error: unknown) => {
      if(!isDecisionStorageError(error)) return
      clearDecisionIndexedRecords()
      setStorageRecoveryMessage('Karar Destek önbelleği temizleniyor.')
      window.clearTimeout(recoveryTimer)
      recoveryTimer = window.setTimeout(() => setStorageRecoveryMessage(''), 4200)
    }
    const onDecisionStorageError = (event: Event) => {
      recoverDecisionStorage((event as CustomEvent).detail?.message || event)
    }
    const onWorkspaceStorageError = (event: Event) => {
      setStorageRecoveryMessage((event as CustomEvent).detail?.message || 'Workspace önbelleği IndexedDB üzerinden yenileniyor.')
      window.clearTimeout(recoveryTimer)
      recoveryTimer = window.setTimeout(() => setStorageRecoveryMessage(''), 4200)
    }
    const onWindowError = (event: ErrorEvent) => {
      recoverDecisionStorage(event.error || event.message)
    }
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      recoverDecisionStorage(event.reason)
    }

    window.addEventListener('decision-storage-error', onDecisionStorageError)
    window.addEventListener('miyop-workspace-storage-error', onWorkspaceStorageError)
    window.addEventListener('error', onWindowError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)

    return () => {
      window.clearTimeout(recoveryTimer)
      window.removeEventListener('decision-storage-error', onDecisionStorageError)
      window.removeEventListener('miyop-workspace-storage-error', onWorkspaceStorageError)
      window.removeEventListener('error', onWindowError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  const onLogin = (nextAuthState: AuthenticationState) => {
    const u = nextAuthState.currentUser
    if(!u) return

    updateAuthenticationState(nextAuthState)
    const defaultNavigation = getDefaultNavigation(u, nextAuthState.pipeline.loginRedirect)
    runBranchScopedMigration(u)
    setUserState(u)
    setBranches(getVisibleBranchesForUser(u))
    setActiveBranchState(getActiveBranchId())
    setRoute(defaultNavigation.route)
    setActiveNavKey(defaultNavigation.activeNavKey)
    setOpenGroupKey(defaultNavigation.openGroupKey)
    setLicenseAccessError('')
  }
  // ── VARDİYA KİLİDİ (15.10.2026) ────────────────────────────────────────
  // Gerekçe ve kural: `src/auth/oturum-kilidi.ts` başında.
  //
  // ⚠️ KARAR ZAMANLAYICIDAN DEĞİL SAATTEN ÇIKIYOR. Tablet uyuduğunda
  // `setInterval` de uyur; üç saat sonra uyandığında hiçbir olay
  // ateşlenmez. Aşağıdaki aralık yalnızca "ara sıra bak" görevi görüyor;
  // kilit kararını her seferinde `şimdi - sonHareket` veriyor.
  const [kilitli, setKilitli] = React.useState(false)
  const sonYazilanRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    if(!currentUser || isPlatformAdmin){
      setKilitli(false)
      return undefined
    }

    // Girişten hemen sonra damga YOKTUR; fail-closed kural onu "kilitle"
    // diye okur. O yüzden oturum başlarken damgayı biz atıyoruz.
    if(sonHareketiOku() === null){
      sonHareketiYaz(Date.now())
      sonYazilanRef.current = Date.now()
    }

    const hareket = () => {
      const simdi = Date.now()
      // Perde açıkken hareket damgayı tazelemez; yoksa kilit ekranına
      // dokunmak kilidi kendiliğinden açardı.
      if(kilitli) return
      if(yazmaZamaniMi(sonYazilanRef.current, simdi)){
        sonHareketiYaz(simdi)
        sonYazilanRef.current = simdi
      }
    }

    const bak = () => {
      if(kilitli) return
      if(kilitlenmeliMi(sonHareketiOku(), Date.now())) setKilitli(true)
    }

    HAREKET_OLAYLARI.forEach(olay =>
      window.addEventListener(olay, hareket, { passive: true }))
    // Sekmeye geri dönüldüğünde HEMEN bak: uyuyan cihaz senaryosu.
    document.addEventListener('visibilitychange', bak)
    const zamanlayici = window.setInterval(bak, 30_000)
    bak()

    return () => {
      HAREKET_OLAYLARI.forEach(olay => window.removeEventListener(olay, hareket))
      document.removeEventListener('visibilitychange', bak)
      window.clearInterval(zamanlayici)
    }
  }, [currentUser, isPlatformAdmin, kilitli])

  const kilidiCoz = () => {
    const simdi = Date.now()
    sonHareketiYaz(simdi)
    sonYazilanRef.current = simdi
    setKilitli(false)
  }

  const logout = () => {
    // Kilit damgası oturumla birlikte gidiyor; yoksa bir sonraki giriş
    // eski damgayı okuyup kendini anında kilitli bulurdu (damga yoksa
    // KİLİT kuralı gereği, tuzak: fail-closed'ın yan etkisi).
    sonHareketiSil()
    setKilitli(false)
    const nextAuthState = updateAuthenticationState(logoutAuthentication({
      requestedPath: window.location.pathname
    }))
    const defaultNavigation = getDefaultNavigation(null, nextAuthState.pipeline.loginRedirect)
    setUserState(null)
    setRoute(defaultNavigation.route)
    setActiveNavKey(defaultNavigation.activeNavKey)
    setOpenGroupKey(defaultNavigation.openGroupKey)
    setLicenseAccessError('')
  }
  const refreshSettings = () => setSettings(loadSettings())
  const refreshBranches = (nextBranches?: Branch[]) => {
    setBranches(getVisibleBranchesForUser(currentUser))
    setActiveBranchState(getActiveBranchId())
  }
  const changeActiveBranch = (branchId: string) => {
    const nextBranchId = setActiveBranchId(branchId, currentUser || undefined)
    setActiveBranchState(nextBranchId)
    setBranches(getVisibleBranchesForUser(currentUser))
  }
  // ⚠️ Gelen kimlik artık KİRACI (tenant) kimliği, firma kimliği değil.
  // EVREN360 müşterisi bir kiracıdır; bir kiracının birden çok firması
  // olabilir. 0083 fonksiyonları kiracı kimliğiyle çalışıyor.
  const openCustomerDetail = (kiraciId: string) => {
    setSelectedCustomerId(kiraciId)
    setLicenseAccessError('')
    setRoute('evren360-customer-detail')
    setActiveNavKey('evren360-customer-detail')
    setOpenGroupKey(platformGrupAnahtari('evren360-customer-detail') as NavGroupKey)
  }
  const returnToCustomerList = () => {
    setRoute('evren360-customer-list')
    setActiveNavKey('evren360-customer-list')
    setOpenGroupKey(platformGrupAnahtari('evren360-customer-list') as NavGroupKey)
  }
  /**
   * Zildeki satıra tıklayınca nereye gidilecek.
   *
   * ⚠️ Eskiden YALNIZ `business_application` ele alınıyordu; `license_expiry`
   * satırları sessizce hiçbir şey yapmıyordu. Emrah "tıklıyorum, bir şey
   * olmuyor" dedi ve haklıydı: zilde görünen satırların çoğu lisans
   * satırıydı. Tıklanabilir görünüp hiçbir şey yapmayan bir satır,
   * "mış gibi yapan" bir şeydir.
   *
   * Lisans satırının `targetId`si kiracı kimliğidir — Müşteri Detayı
   * ekranının tam olarak beklediği şey.
   */
  const openEvren360NotificationTarget = (notification: Evren360Notification) => {
    if(!notification.targetId) return
    setLicenseAccessError('')

    if(notification.type === 'business_application'){
      setSelectedPendingApplicationId(notification.targetId)
      setRoute('evren360-pending-applications')
      setActiveNavKey('evren360-pending-applications')
      setOpenGroupKey(platformGrupAnahtari('evren360-pending-applications') as NavGroupKey)
      return
    }

    if(notification.type === 'license_expiry'){
      // `targetId` = kiracı kimliği. Müşteri Detayı ekranı veritabanından
      // okuyor (göç 0083) ve lisans uzatma düğmesi orada.
      openCustomerDetail(notification.targetId)
      return
    }

    // ⚠️ `support_request` için gidilecek ekran HENÜZ YOK (Destek Talepleri
    // kilitli, HEDEFLER 4.x). Buraya bir rota uydurmuyoruz; olmayan yere
    // götürmek, hiç götürmemekten kötüdür.
  }
  const openMarketplaceFromWelcome = () => {
    if(!isWorkspaceSetupCompletedForUser(currentUser)){
      setLicenseAccessError(INSTALLATION_LOCK_MESSAGE)
      return
    }
    setLicenseAccessError('')
    setRoute('marketplace')
    setActiveNavKey('marketplace')
    setOpenGroupKey('system-modules')
  }
  const openDashboardFromOnboarding = () => {
    if(!isWorkspaceSetupCompletedForUser(currentUser)){
      setLicenseAccessError(INSTALLATION_LOCK_MESSAGE)
      return
    }
    setLicenseAccessError('')
    setRoute('summary')
    setActiveNavKey('dashboard')
    setOpenGroupKey('system-modules')
  }
  const openWorkspaceRouteFromWelcome = (
    nextRoute: BusinessWorkspaceRoute,
    nextNavKey: BusinessWorkspaceNavKey
  ) => {
    if(!isWorkspaceSetupCompletedForUser(currentUser) && nextRoute !== 'settings'){
      setLicenseAccessError(INSTALLATION_LOCK_MESSAGE)
      return
    }

    setLicenseAccessError('')
    setRoute(nextRoute)
    setActiveNavKey(nextNavKey)
    const group = navGroupsForCurrentUser.find(navGroup => (
      flattenAppNavItems(navGroup.items).some(item => item.key === nextNavKey)
    ))
    if(group) setOpenGroupKey(group.key)
  }
  const startOnboardingExperience = () => {
    setOnboardingExperienceStartSignal(current => current + 1)
  }
  const openIntegrationCenterFromWelcome = () => {
    if(!hasConnectedWorkspaceIntegrationsForUser(currentUser)) return
    setLicenseAccessError('')
    setRoute('integration-center')
    setActiveNavKey('integration-center')
    setOpenGroupKey('integration-modules')
  }
  const openWorkspaceSettingsFromWelcome = () => {
    setLicenseAccessError('')
    setRoute('settings')
    setActiveNavKey('workspace')
    setOpenGroupKey('system-modules')
  }
  const handleWorkspaceModuleLifecycleChanged = (result: WorkspaceModuleLifecycleResult) => {
    setModuleInstallRefreshKey(current => current + 1)
    setLicenseAccessError('')
  }
  const completeFirstLoginOnboarding = () => {
    const refreshedUser = currentUser
      ? loadUsers({ allTenants: true }).find(user => user.id === currentUser.id) || currentUser
      : currentUser

    setOnboardingRefreshKey(current => current + 1)
    setModuleInstallRefreshKey(current => current + 1)
    setUserState(refreshedUser)
    setBranches(getVisibleBranchesForUser(refreshedUser))
    setActiveBranchState(getActiveBranchId())
    setRoute('summary')
    setActiveNavKey('dashboard')
    setOpenGroupKey('system-modules')
    setLicenseAccessError('')
  }
  /**
   * Eksik izin listesini veritabanından tamamlar.
   *
   * ⚠️ `null` dönerse OTURUM KAPANIR. `null` "izni yok" değil
   * "OKUNAMADI" demektir; yetkisini bilmediğimiz bir kullanıcıyı içeride
   * tutmak, ona rastgele bir yetki kümesi vermek olur. `authenticateCredentials`
   * girişte aynı kararı veriyor (fail-closed); burada da aynısı.
   */
  React.useEffect(() => {
    if(!izinleriTamamla) return
    if(!currentUser){ setIzinleriTamamla(false); return }
    if(currentUser.permissions !== undefined){ setIzinleriTamamla(false); return }

    let iptal = false
    void (async () => {
      // Rol kodu `normalizeUser` düzeltmesinden sonra korunuyor; yine de
      // eski bir kayıtta boş olabilir — o zaman kaba karşılığa düşüyoruz.
      const rolKodu = currentUser.roleCode
        || (currentUser.role === 'Admin' ? 'admin' : 'personel')
      let izinler: string[] | null = null
      try {
        izinler = await loadPermissionsForUser(currentUser.id, rolKodu)
      } catch {
        izinler = null
      }
      if(iptal) return
      if(izinler === null){
        logout()
        setLicenseAccessError(
          'Yetkileriniz okunamadı, oturum güvenlik gereği kapatıldı. '
          + 'Lütfen yeniden giriş yapın.',
        )
        setIzinleriTamamla(false)
        return
      }
      const tamam: User = { ...currentUser, permissions: izinler }
      setCurrentUser(tamam)
      setUserState(tamam)
      setIzinleriTamamla(false)
    })()
    return () => { iptal = true }
  }, [izinleriTamamla, currentUser])

  /**
   * Profilim ekranı kaydettiğinde uygulama kabuğundaki kullanıcı kopyasını
   * günceller (MIYOP-066).
   *
   * ⚠️ NEDEN GEREKLİ: veritabanına yazmak yetmiyordu. Yan menü, kilit
   * ekranı ve baş harfler `currentUser`dan ve `ra_auth` önbelleğinden
   * okuyor; onlar güncellenmediği için ekran yeni adı, menü ESKİ adı
   * gösteriyordu. Tuzak 103'ün bir örneği daha: katmanda doğru, ekranda
   * yanlış.
   *
   * ⚠️ `taze` YALNIZ ad ve telefon taşır. Rol, izin, kiracı ve kimlik
   * alanları `currentUser`dan geliyor — buraya rol yazılırsa yetki
   * yükseltmesinin arka kapısı olur. Veritabanı tarafı zaten reddeder
   * (göç 0012) ama arayüz de denemeyecek.
   *
   * ⚠️ MIYOP-068 · KİMLİK KAPISI. İlk sürümde `taze.id` ile oturumdaki
   * kullanıcının kimliği KARŞILAŞTIRILMIYORDU. Codex'in gösterdiği sıra
   * şöyleydi: A profilini kaydeder → A'nın geri okuması gecikir →
   * A çıkar, aynı sekmede B giriş yapar → A'nın cevabı gelir → eski geri
   * çağrı B'nin üstüne A'nın adını yazar ve `ra_auth`a kaydeder.
   * B'nin veritabanı kaydı, rolü ve izinleri değişmez; ama kabuk ve yerel
   * kopya YANLIŞ ADI taşır. Geç gelen cevap, ait olduğu kullanıcıya
   * uygulanır — başkasına değil.
   */
  const handleProfileChange = React.useCallback((taze: User) => {
    setUserState(onceki => {
      if(!onceki) return onceki
      // ⚠️ Geç gelen cevap başka hesabın üstüne yazmasın (MIYOP-068).
      if(taze.id !== onceki.id) return onceki

      // ⚠️ DEĞİŞEN YOKSA AYNI NESNEYİ DÖNDÜR. Bu bir "mikro iyileştirme"
      // değil, SONSUZ DÖNGÜ KAPISI: Profilim ekranı artık her başarılı
      // okumada kabuğa haber veriyor; `yukle` de `currentUser`a bağlı.
      // Burada her seferinde YENİ bir nesne üretilirse `currentUser`ın
      // kimliği değişir → `yukle` yeniden kurulur → effect tekrar okur →
      // tekrar haber verir → sonsuz okuma. Eşitlikte `onceki` dönünce
      // zincir ilk turda duruyor (ad gerçekten değiştiyse en fazla iki tur).
      if(onceki.fullName === taze.fullName && onceki.phone === taze.phone){
        return onceki
      }

      const sonraki: User = {
        ...onceki,
        fullName: taze.fullName,
        phone: taze.phone,
      }
      setCurrentUser(sonraki)
      return sonraki
    })
  }, [])

  const navGroupsForCurrentUser = React.useMemo<NavGroup[]>(() => {
    // ── 2026-10-16 · PLATFORM SAHİBİ KİRACI MENÜLERİNİ GÖRMEZ ────────────
    // Eski kural: "platform admini bir firmaya bağlıysa İKİ yüzeyi birden
    // görür" (kurucu durumu). Ölçüt yanlıştı — soru "firmaya bağlı mı"
    // değil, "şu an hangi şapkayı takıyor".
    //
    // Pratikte olan şuydu: Emrah platform sahibi olarak girdiğinde
    // GENEL / OPERASYON / YÖNETİM menüleri de açılıyor, hepsi 0
    // gösteriyordu — çünkü o menüler bir İŞLETMENİN verisini gösterir,
    // platformun değil. Kendi sorusu: "benim bu konuda bir veri'm yok ki."
    //
    // Artık platform sahibi yalnız EVREN360 panelini görür. Bir müşterinin
    // ekranlarını görmesi gerekiyorsa o kiracının kendi kullanıcısıyla
    // girer; kiracı verisine platform hesabından bakmak ayrı bir iştir
    // (çapraz kiracı okuma kapısı) ve ayrıca yapılacaktır.
    const scopedGroups = isPlatformAdmin
      ? platformNavGroups
      : createWorkspaceNavGroupsForUser(currentUser)

    return scopedGroups.map(group => ({
      ...group,
      items: group.items.map(item => {
        if(item.platformAdminOnly && !isPlatformAdmin){
          return { ...item, hidden: true }
        }
        return item
      })
    }))
  }, [currentUser, isPlatformAdmin, moduleInstallRefreshKey, onboardingRefreshKey])
  // ⚠️ Menüde olmayan rota ÖNCE sorulur (tuzak 168). Profil menüsünden
  // açılan ekranlar menü ağacında yok; etiketi `activeNavKey`ten aramak
  // bir ÖNCEKİ ekranın adını verir ve başlık yalan söyler. Bu değer hem
  // üst başlığa hem de `RouteErrorBoundary`nin `routeLabel`ine gidiyor,
  // yani yanlış ad çökme kaydına da yazılır.
  const activeNavLabel = MENUSUZ_ROTA_ETIKETLERI[route]
    || navGroupsForCurrentUser
      .flatMap(group => flattenAppNavItems(group.items))
      .find(item => item.key === activeNavKey)?.label
    || 'Kontrol Paneli'
  const activeRouteModule = licensedNavModules[activeNavKey] || licensedRouteModules[route]
  const activeRouteLicenseDenied = Boolean(
    currentUser
    && activeRouteModule
    && !canUserAccessWorkspaceModule(currentUser, activeRouteModule)
  )
  const lastDeniedRouteLogKey = React.useRef('')

  React.useEffect(() => {
    if(!currentUser || !activeRouteModule || !activeRouteLicenseDenied){
      lastDeniedRouteLogKey.current = ''
      return
    }

    const logKey = `${currentUser.id}:${route}:${activeNavKey}:${activeRouteModule}`
    if(lastDeniedRouteLogKey.current === logKey) return

    lastDeniedRouteLogKey.current = logKey
    addLicenseAccessFailureLog({
      user: currentUser,
      companyId: getCompanyIdForUser(currentUser),
      moduleKey: activeRouteModule,
      description: `${activeNavLabel} ekranı için lisans erişim kontrolü başarısız.`
    })
  }, [activeNavLabel, activeNavKey, activeRouteLicenseDenied, activeRouteModule, currentUser, route])

  // ── Rota kapısı (üç kapıdan üçüncüsü) ────────────────────────────────
  // Menüde kilitli görünen bir ekran, doğrudan rota verilerek de
  // açılamamalı. Ölçüt menüyle AYNI kaynaktan geliyor.
  // ⚠️ `evren360View` da sorulmak zorunda: `evren360-packages` rotası
  // kayıt defterinde yok ama `SaasManagementCenter`'ı açabiliyor.
  const platformEkraniHazirDegil = (
    (platformRouteSet.has(route) || Boolean(evren360View))
    && !platformRotasiHazir(route)
  )

  /**
   * Profil menüsünden açılan, menü ağacında KARŞILIĞI OLMAYAN ekranlar.
   *
   * ⚠️ `setRoute` TEK BAŞINA YETMİYOR (tuzak 168): `activeNavKey` bir önceki
   * ekranda kalıyor ve yan menüde o ekran seçili görünmeye devam ediyor.
   * Buradaki anahtar hiçbir menü ögesiyle eşleşmediği için vurgu kalkar;
   * başlığı `MENUSUZ_ROTA_ETIKETLERI` veriyor.
   */
  const menusuzRotaAc = (hedef: 'my-profile' | 'company-profile') => {
    setLicenseAccessError('')
    setRoute(hedef)
    setActiveNavKey(hedef)
  }

  const openNavItem = (item: NavItem) => {
    if(!item.route) return

    if(isInstallationLockedRoute(currentUser, isPlatformAdmin, item.route)){
      setLicenseAccessError(INSTALLATION_LOCK_MESSAGE)
      return
    }

    if(item.locked){
      setLicenseAccessError(item.disabledReason || LICENSE_ACCESS_DENIED_MESSAGE)
      return
    }

    if(item.platformAdminOnly && !isPlatformAdmin){
      setLicenseAccessError('EVREN360 Yönetici Paneli yalnızca Super Admin kullanıcısı tarafından görüntülenebilir.')
      return
    }

    const requiredModule = licensedNavModules[item.key]
    if(requiredModule && !canUserAccessWorkspaceModule(currentUser, requiredModule)){
      setLicenseAccessError(LICENSE_ACCESS_DENIED_MESSAGE)
      if(currentUser){
        addLicenseAccessFailureLog({
          user: currentUser,
          companyId: getCompanyIdForUser(currentUser),
          moduleKey: requiredModule,
          description: `${item.label} menü erişimi lisans nedeniyle engellendi.`
        })
      }
      return
    }

    setLicenseAccessError('')
    setRoute(item.route)
    setActiveNavKey(item.key)
    const group = navGroupsForCurrentUser.find(navGroup => (
      flattenAppNavItems(navGroup.items).some(groupItem => groupItem.key === item.key)
    ))
    if(group) setOpenGroupKey(group.key)
  }

  const toggleNavGroup = (groupKey: NavGroupKey) => {
    setOpenGroupKey(current => current === groupKey ? null : groupKey)
  }

  if(businessApplicationRouteMatch){
    return <BusinessApplicationPublicForm />
  }

  // ⚠️ GİRİŞ EKRANINDAN VE DAVET KONTROLÜNDEN ÖNCE. Portal müşterisinin
  // uygulamada bir kullanıcı kaydı yok; giriş ekranına düşerse hiçbir şey
  // yapamaz ve neden yapamadığını da anlamaz. Uygulama kabuğu da
  // gösterilmiyor: müşteri bizim iç ekranlarımızı görmez.
  if(portalRouteMatch){
    return <Portal />
  }

  // ⚠️ GİRİŞ EKRANINDAN ÖNCE. Davetli kullanıcının henüz şifresi yok;
  // giriş ekranına düşerse hiçbir şey yapamaz ve neden yapamadığını da
  // anlamaz.
  if(davet.durum === 'var'){
    return (
      <div className="app-shell unified-auth-shell">
        <SifreBelirle
          tur={davet.tur}
          erisimJetonu={davet.erisimJetonu}
          yenilemeJetonu={davet.yenilemeJetonu}
          onTamamlandi={() => setDavet({ durum: 'yok' })}
          onVazgec={() => setDavet({ durum: 'yok' })}
        />
      </div>
    )
  }

  if(davet.durum === 'hata'){
    return (
      <div className="app-shell unified-auth-shell">
        <div className="auth-screen">
          <section className="card auth-card">
            <h2>Bağlantı çalışmadı</h2>
            <p className="form-error">{davet.mesaj}</p>
            <p className="muted">
              Davet bağlantıları güvenlik gereği kısa ömürlüdür. MİYOP ekibinden
              yeni bir davet istemeniz yeterli.
            </p>
            <div className="form-actions">
              <button className="btn" type="button" onClick={() => setDavet({ durum: 'yok' })}>
                Giriş ekranına dön
              </button>
            </div>
          </section>
        </div>
      </div>
    )
  }

  if(!currentUser){
    return (
      <div className="app-shell unified-auth-shell">
        <Login onLogin={onLogin} />
      </div>
    )
  }

  /**
   * ⚠️ İzin listesi tamamlanana kadar UYGULAMA KABUĞU RENDER EDİLMEZ.
   * Yarım yetkili bir ekran göstermek, yetkisi olmayan birine kapı açmaktır.
   */
  if(izinleriTamamla){
    return (
      <div className="app-shell unified-auth-shell">
        <div className="auth-screen">
          <section className="card auth-card">
            <h2>Yetkileriniz yükleniyor…</h2>
            <p className="muted">
              Oturumunuzdaki yetki bilgisi eksik olduğu için yeniden okunuyor.
              Bu bir kez olur.
            </p>
          </section>
        </div>
      </div>
    )
  }

  /**
   * ⚠️ GEÇİCİ ŞİFRE KAPISI (0076/0077) — UYGULAMA KABUĞUNDAN ÖNCE.
   *
   * Yönetici personel hesabını geçici bir şifreyle açtı. O şifre bizim
   * veritabanımıza hiç yazılmadı, hiçbir günlüğe düşmedi — ama YÖNETİCİ onu
   * biliyor. Yani hesap şu an kişinin değil, yöneticisinin elinde.
   *
   * Kapı buraya konuyor, menüye ya da ekranların içine DEĞİL: aradaki fark,
   * kişinin uygulamayı hiç görmemesi ile "biraz görmesi" arasındaki farktır.
   * İçeri alıp ekran ekran engellemeye çalışsaydık, unutulan tek bir ekran
   * kapıyı açık bırakırdı.
   *
   * Şifre belirlenince oturum kapanıyor ve kişi yeni şifresiyle bir kez
   * giriş yapıyor — çalıştığını kendi gözüyle görsün.
   */
  if(currentUser.mustChangePassword){
    return (
      <div className="app-shell unified-auth-shell">
        <SifreBelirle
          tur="zorunlu"
          onTamamlandi={logout}
          onVazgec={logout}
        />
      </div>
    )
  }

  return (
    <>
    <AppShell
      restaurantName={workspaceChrome.name}
      logoUrl={workspaceChrome.logoUrl}
      currentUser={currentUser}
      navGroups={navGroupsForCurrentUser}
      activeNavKey={activeNavKey}
      activeNavLabel={activeNavLabel}
      branches={branches}
      activeBranchId={activeBranchId}
      isPlatformAdmin={isPlatformAdmin}
      openGroupKey={openGroupKey}
      onToggleGroup={toggleNavGroup}
      onOpenNavItem={openNavItem}
      onOpenNotification={openEvren360NotificationTarget}
      onOpenMyProfile={!isPlatformAdmin ? () => menusuzRotaAc('my-profile') : undefined}
      onOpenCompanyProfile={!isPlatformAdmin ? () => menusuzRotaAc('company-profile') : undefined}
      onStartOnboarding={!isPlatformAdmin && workspaceSetupCompleted ? startOnboardingExperience : undefined}
      onActiveBranchChange={changeActiveBranch}
      onLogout={logout}
    >
      <React.Fragment key={`${activeBranchId}:${onboardingRefreshKey}`}>
      <RouteErrorBoundary
        boundaryKey={`${route}:${activeBranchId}:${onboardingRefreshKey}`}
        routeLabel={activeNavLabel}
      >
      {licenseAccessError && <div className="form-error license-access-error">{licenseAccessError}</div>}
      {storageRecoveryMessage && <div className="settings-message warning">{storageRecoveryMessage}</div>}
      {firstLoginOnboardingRequired && firstLoginOnboardingState ? (
        <FirstLoginWizard
          currentUser={currentUser}
          onboardingState={firstLoginOnboardingState}
          onComplete={completeFirstLoginOnboarding}
        />
      ) : (
        <>
      {activeRouteLicenseDenied ? (
        <LicenseAccessDenied moduleKey={activeRouteModule} />
      ) : (
        <>
      {isBusinessWorkspaceRoute(route) && (
        <BusinessWorkspaceRouteHost
          route={route}
          activeNavKey={activeNavKey as BusinessWorkspaceNavKey}
          currentUser={currentUser}
          onBranchesChange={refreshBranches}
          onSettingsChange={refreshSettings}
          onOpenMarketplace={openMarketplaceFromWelcome}
          onOpenIntegrationCenter={openIntegrationCenterFromWelcome}
          onOpenWorkspaceSettings={openWorkspaceSettingsFromWelcome}
          onOpenWorkspaceRoute={openWorkspaceRouteFromWelcome}
          onModuleLifecycleChanged={handleWorkspaceModuleLifecycleChanged}
          onProfileChange={handleProfileChange}
        />
      )}
      {route === 'business-registration-system' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <BusinessApplicationSystem currentUser={currentUser} /> : <PlatformAccessDenied />
      )}
      {route === 'company-setup-wizard' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <CompanySetupWizard currentUser={currentUser} onBranchesChange={refreshBranches} /> : <PlatformAccessDenied />
      )}
      {route === 'package-license-management' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <PackageLicenseManagement currentUser={currentUser} /> : <PlatformAccessDenied />
      )}
      {route === 'user-subscription-management' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <UserSubscriptionManagement currentUser={currentUser} /> : <PlatformAccessDenied />
      )}
      {route === 'module-activation-system' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <ModuleActivationSystem currentUser={currentUser} /> : <PlatformAccessDenied />
      )}
      {route === 'tenant-management' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <TenantManagement currentUser={currentUser} /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-customer-list' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <CustomerList onOpenCustomerDetail={openCustomerDetail} /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-customer-detail' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <CustomerDetail customerId={selectedCustomerId} onBack={returnToCustomerList} /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-pending-applications' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <PendingApplications currentUser={currentUser} initialApplicationId={selectedPendingApplicationId} /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-license-management' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <LisansYonetimi /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-system-announcements' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <SystemAnnouncements currentUserName={currentUser.fullName || currentUser.username} /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-customer-statistics' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <CustomerStatistics /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-company-management' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <CompanyManagement /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-billing-management' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <BillingManagement /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-sector-management' && currentUser.role === 'Admin' && !platformEkraniHazirDegil && (
        isPlatformAdmin ? <SectorManagementCenter currentUser={currentUser} /> : <PlatformAccessDenied />
      )}
      {platformEkraniHazirDegil && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <PlatformEkranHazirDegil route={route} /> : <PlatformAccessDenied />
      )}
      {evren360View && !platformEkraniHazirDegil && (
        isPlatformAdmin
          ? <SaasManagementCenter currentUser={currentUser} view={evren360View} />
          : <PlatformAccessDenied />
      )}
        </>
      )}
        </>
      )}
      </RouteErrorBoundary>
      </React.Fragment>
      {currentUser && !isPlatformAdmin && !firstLoginOnboardingRequired && workspaceSetupCompleted && (
        <OnboardingExperience
          currentUser={currentUser}
          enabled
          startSignal={onboardingExperienceStartSignal}
          onOpenDashboard={openDashboardFromOnboarding}
          onOpenModuleStore={openMarketplaceFromWelcome}
        />
      )}
    </AppShell>
    {/* ⚠️ Perde AppShell'in KARDEŞİ, çocuğu değil: ekranın tamamını
        örtmesi gerekiyor (üst çubuk ve yan menü dâhil). Arkadaki ağaç
        sökülmediği için yarım kalan iş yerinde duruyor. */}
    {kilitli && (
      <VardiyaKilidi
        adSoyad={currentUser.fullName}
        girisAdresi={currentUser.email ?? ''}
        onCozuldu={kilidiCoz}
        onCikis={logout}
      />
    )}
    </>
  )
}
