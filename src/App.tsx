import React from 'react'
import BusinessApplicationSystem from './pages/BusinessApplicationSystem'
import BusinessApplicationPublicForm from './pages/BusinessApplicationPublicForm'
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
import SystemAnnouncements from './pages/SystemAnnouncements'
import CustomerStatistics from './pages/CustomerStatistics'
import CompanyManagement from './pages/CompanyManagement'
import BillingManagement from './pages/BillingManagement'
import SectorManagementCenter from './pages/SectorManagementCenter'
import QRMenu from './pages/QRMenu'
import Login from './pages/Login'
import AppShell, { ShellNavGroup, ShellNavItem } from './components/AppShell'
import OnboardingExperience from './components/OnboardingExperience'
import RouteErrorBoundary from './components/RouteErrorBoundary'
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
  LICENSE_ACCESS_DENIED_MESSAGE
} from './storage'
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
import { createPlatformNavGroups, getPlatformRoutes } from './platform/platform.registry'
import { syncWorkspaceCompanyFromDatabase } from './companies/company-bridge'
import { getDefaultModules } from './sector/sector-template.service'
import { getBusinessMenuEmptyState, getWorkspaceTemplateViewForUser } from './workspace-template/workspace-template.service'
import { WORKSPACE_MODULE_CODES } from './modules/module-code.registry'
import {
  DECISION_SUPPORT_WORKSPACE_MODULE_CODE,
  KPI_REPORTING_MODULE_CODE,
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

const getDefaultNavigation = (user: User | null, loginRedirect: LoginRedirectResult) => {
  if(loginRedirect.target === LOGIN_ROUTE_TARGETS.EVREN360){
    return {
      route: 'evren360-dashboard' as Route,
      activeNavKey: 'evren360-dashboard' as NavKey,
      openGroupKey: 'evren360-admin' as NavGroupKey
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

const getRouteSecurityTarget = (route: Route, authState: AuthenticationState) => {
  if(platformRouteSet.has(route)) return LOGIN_ROUTE_TARGETS.EVREN360
  return resolveSecurityTargetForIdentity(authState.pipeline.identity)
}

export default function App(){
  const qrRouteMatch = window.location.pathname.match(/^\/qr\/([^/?#]+)/)
  const businessApplicationRouteMatch = window.location.pathname.match(/^\/(?:basvuru|apply)\/?$/)
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
  const logout = () => {
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
  const openCustomerDetail = (companyId: string) => {
    setSelectedCustomerId(companyId)
    setLicenseAccessError('')
    setRoute('evren360-customer-detail')
    setActiveNavKey('evren360-customer-detail')
    setOpenGroupKey('evren360-admin')
  }
  const returnToCustomerList = () => {
    setRoute('evren360-customer-list')
    setActiveNavKey('evren360-customer-list')
    setOpenGroupKey('evren360-admin')
  }
  const openEvren360NotificationTarget = (notification: Evren360Notification) => {
    if(notification.type !== 'business_application' || !notification.targetId) return

    setSelectedPendingApplicationId(notification.targetId)
    setLicenseAccessError('')
    setRoute('evren360-pending-applications')
    setActiveNavKey('evren360-pending-applications')
    setOpenGroupKey('evren360-admin')
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
  const navGroupsForCurrentUser = React.useMemo<NavGroup[]>(() => {
    // Platform admini AYNI ZAMANDA bir firmanın yöneticisi olabilir — kurucu
    // durumu tam olarak budur. Eskiden ikisi birbirini dışlıyordu: platform
    // admini olan kullanıcı kendi işletme menüsünü hiç göremiyordu.
    // Artık firması olan bir platform admini İKİ yüzeyi birden görür;
    // firması olmayan (saf platform yöneticisi) yalnızca paneli görür.
    const scopedGroups = isPlatformAdmin
      ? (getCompanyIdForUser(currentUser)
        ? [...createWorkspaceNavGroupsForUser(currentUser), ...platformNavGroups]
        : platformNavGroups)
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
  const activeNavLabel = navGroupsForCurrentUser
    .flatMap(group => flattenAppNavItems(group.items))
    .find(item => item.key === activeNavKey)?.label || 'Kontrol Paneli'
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

  if(qrRouteMatch){
    return <QRMenu tableId={qrRouteMatch[1]} />
  }

  if(businessApplicationRouteMatch){
    return <BusinessApplicationPublicForm />
  }

  if(!currentUser){
    return (
      <div className="app-shell unified-auth-shell">
        <Login onLogin={onLogin} />
      </div>
    )
  }

  return (
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
      onOpenMyProfile={!isPlatformAdmin ? () => setRoute('my-profile') : undefined}
      onOpenCompanyProfile={!isPlatformAdmin ? () => setRoute('company-profile') : undefined}
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
        />
      )}
      {route === 'business-registration-system' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <BusinessApplicationSystem currentUser={currentUser} /> : <PlatformAccessDenied />
      )}
      {route === 'company-setup-wizard' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <CompanySetupWizard currentUser={currentUser} onBranchesChange={refreshBranches} /> : <PlatformAccessDenied />
      )}
      {route === 'package-license-management' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <PackageLicenseManagement currentUser={currentUser} /> : <PlatformAccessDenied />
      )}
      {route === 'user-subscription-management' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <UserSubscriptionManagement currentUser={currentUser} /> : <PlatformAccessDenied />
      )}
      {route === 'module-activation-system' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <ModuleActivationSystem currentUser={currentUser} /> : <PlatformAccessDenied />
      )}
      {route === 'tenant-management' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <TenantManagement currentUser={currentUser} /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-customer-list' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <CustomerList onOpenCustomerDetail={openCustomerDetail} /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-customer-detail' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <CustomerDetail customerId={selectedCustomerId} onBack={returnToCustomerList} /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-pending-applications' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <PendingApplications currentUser={currentUser} initialApplicationId={selectedPendingApplicationId} /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-system-announcements' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <SystemAnnouncements currentUserName={currentUser.fullName || currentUser.username} /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-customer-statistics' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <CustomerStatistics /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-company-management' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <CompanyManagement /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-billing-management' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <BillingManagement /> : <PlatformAccessDenied />
      )}
      {route === 'evren360-sector-management' && currentUser.role === 'Admin' && (
        isPlatformAdmin ? <SectorManagementCenter currentUser={currentUser} /> : <PlatformAccessDenied />
      )}
      {evren360View && (
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
  )
}
