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
import QRMenu from './pages/QRMenu'
import Login from './pages/Login'
import AppShell, { ShellNavGroup, ShellNavItem } from './components/AppShell'
import { resolveSecurityTargetForIdentity } from './auth/authentication-pipeline'
import {
  AuthenticationState,
  evaluateAuthenticationStateTarget,
  getInitialAuthenticationState,
  logoutAuthentication
} from './auth/authentication.service'
import { LOGIN_ROUTE_TARGETS, LoginRedirectResult } from './routing/routing.types'
import {
  loadProducts,
  ensureDefaultAdmin,
  loadSettings,
  loadUsers,
  getVisibleBranchesForUser,
  getActiveBranchId,
  setActiveBranchId,
  migrateBranchScopedData,
  LICENSE_MODULE_CATALOG,
  addLicenseAccessFailureLog,
  canUserAccessLicensedModule,
  getCompanyIdForUser,
  LICENSE_ACCESS_DENIED_MESSAGE
} from './storage'
import { getFirstLoginOnboardingState } from './onboarding/onboarding.service'
import { Branch, LicenseModuleKey, User } from './types'
import BusinessWorkspaceRouteHost from './modules/BusinessWorkspaceRouteHost'
import {
  MODULE_MENU_CONTROL_MODE,
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

type NavItem = ShellNavItem<Route, NavKey>
type NavGroup = ShellNavGroup<Route, NavKey, NavGroupKey>

const licensedNavModules: Partial<Record<NavKey, LicenseModuleKey>> = createLicensedNavModuleMap()
const licensedRouteModules: Partial<Record<Route, LicenseModuleKey>> = createLicensedRouteModuleMap()
const businessWorkspaceNavGroups = createBusinessWorkspaceNavGroups() as NavGroup[]

const platformNavGroups: NavGroup[] = [
  {
    key: 'evren360-admin',
    title: 'EVREN360 Yönetici Paneli',
    icon: 'E3',
    items: [
      { key: 'evren360-dashboard', label: 'Dashboard', route: 'evren360-dashboard', icon: 'DB', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-customer-list', label: 'Müşteri Listesi', route: 'evren360-customer-list', icon: 'ML', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-customer-detail', label: 'Müşteri Detayı', route: 'evren360-customer-detail', icon: 'MD', adminOnly: true, platformAdminOnly: true, hidden: true },
      { key: 'evren360-pending-applications', label: 'Onay Bekleyen İşletmeler', route: 'evren360-pending-applications', icon: 'OB', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-system-announcements', label: 'Sistem Duyuruları', route: 'evren360-system-announcements', icon: 'SD', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-customer-statistics', label: 'Müşteri İstatistikleri', route: 'evren360-customer-statistics', icon: 'MI', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-company-management', label: 'İşletme Yönetimi', route: 'evren360-company-management', icon: 'IY', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-billing-management', label: 'Fatura ve Tahsilat Takibi', route: 'evren360-billing-management', icon: 'FT', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-applications', label: 'Başvurular', route: 'evren360-applications', icon: 'BV', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-companies', label: 'Firmalar', route: 'evren360-companies', icon: 'FR', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-packages', label: 'Paketler', route: 'evren360-packages', icon: 'PK', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-modules', label: 'Modüller', route: 'evren360-modules', icon: 'MD', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-licenses', label: 'Lisanslar', route: 'evren360-licenses', icon: 'LS', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-subscriptions', label: 'Abonelikler', route: 'evren360-subscriptions', icon: 'AB', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-users', label: 'Kullanıcılar', route: 'evren360-users', icon: 'KU', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-support', label: 'Destek Talepleri', route: 'evren360-support', icon: 'DT', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-stats', label: 'İstatistikler', route: 'evren360-stats', icon: 'IS', adminOnly: true, platformAdminOnly: true },
      { key: 'evren360-settings', label: 'Sistem Ayarları', route: 'evren360-settings', icon: 'SA', adminOnly: true, platformAdminOnly: true }
    ]
  }
]

const businessWorkspaceRouteSet = new Set<Route>(
  businessWorkspaceNavGroups.flatMap(group => group.items.map(item => item.route))
)

const isBusinessWorkspaceRoute = (nextRoute: Route): nextRoute is BusinessWorkspaceRoute => {
  return businessWorkspaceRouteSet.has(nextRoute)
}

const isPlatformAdminUser = (user?: User | null) => {
  return user?.role === 'Admin' && !getCompanyIdForUser(user)
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
    return {
      route: 'summary' as Route,
      activeNavKey: 'dashboard' as NavKey,
      openGroupKey: 'system-modules' as NavGroupKey
    }
  }

  return {
    route: 'tables' as Route,
    activeNavKey: 'adisyon' as NavKey,
    openGroupKey: 'business-modules' as NavGroupKey
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
  if(
    evren360RouteViews[route]
    || route === 'evren360-customer-list'
    || route === 'evren360-customer-detail'
    || route === 'evren360-pending-applications'
    || route === 'evren360-system-announcements'
    || route === 'evren360-customer-statistics'
    || route === 'evren360-company-management'
    || route === 'evren360-billing-management'
  ) return LOGIN_ROUTE_TARGETS.EVREN360
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
  const [selectedCustomerId, setSelectedCustomerId] = React.useState('')
  const [onboardingRefreshKey, setOnboardingRefreshKey] = React.useState(0)
  const isPlatformAdmin = isPlatformAdminUser(currentUser)
  const evren360View = evren360RouteViews[route]
  const firstLoginOnboardingState = React.useMemo(() => {
    if(!currentUser || isPlatformAdmin) return null
    return getFirstLoginOnboardingState(currentUser)
  }, [currentUser, isPlatformAdmin, onboardingRefreshKey])
  const firstLoginOnboardingRequired = Boolean(firstLoginOnboardingState?.required)

  const updateAuthenticationState = (state: AuthenticationState) => {
    authStateRef.current = state
    return state
  }

  const evaluateCurrentRouteSecurity = (nextRoute: Route) => {
    const currentAuthState = authStateRef.current
    const target = getRouteSecurityTarget(nextRoute, currentAuthState)
    authStateRef.current = evaluateAuthenticationStateTarget(currentAuthState, target)
  }

  React.useEffect(()=>{
    loadProducts()
    ensureDefaultAdmin()
    if(currentUser) migrateBranchScopedData(currentUser)
    setBranches(getVisibleBranchesForUser(currentUser))
    setActiveBranchState(getActiveBranchId())
  }, [currentUser])
  React.useEffect(() => {
    document.title = settings.restaurantName
  }, [settings.restaurantName])
  React.useEffect(() => {
    evaluateCurrentRouteSecurity(route)
  }, [route])

  const onLogin = (nextAuthState: AuthenticationState) => {
    const u = nextAuthState.currentUser
    if(!u) return

    updateAuthenticationState(nextAuthState)
    const defaultNavigation = getDefaultNavigation(u, nextAuthState.pipeline.loginRedirect)
    migrateBranchScopedData(u)
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
  const completeFirstLoginOnboarding = () => {
    const refreshedUser = currentUser
      ? loadUsers({ allTenants: true }).find(user => user.id === currentUser.id) || currentUser
      : currentUser

    setOnboardingRefreshKey(current => current + 1)
    setUserState(refreshedUser)
    setBranches(getVisibleBranchesForUser(refreshedUser))
    setActiveBranchState(getActiveBranchId())
    setRoute('summary')
    setActiveNavKey('dashboard')
    setOpenGroupKey('system-modules')
    setLicenseAccessError('')
  }
  const navGroupsForCurrentUser = React.useMemo<NavGroup[]>(() => {
    const scopedGroups = isPlatformAdmin
      ? platformNavGroups
      : businessWorkspaceNavGroups

    return scopedGroups.map(group => ({
      ...group,
      items: group.items.map(item => {
        if(item.platformAdminOnly && !isPlatformAdmin){
          return { ...item, hidden: true }
        }

        const requiredModule = licensedNavModules[item.key]
        if(!requiredModule) return item

        const allowed = canUserAccessLicensedModule(currentUser, requiredModule)
        if(allowed) return { ...item, locked: false, hidden: false, disabledReason: '' }

        return {
          ...item,
          locked: MODULE_MENU_CONTROL_MODE === 'locked',
          hidden: MODULE_MENU_CONTROL_MODE === 'hidden',
          disabledReason: LICENSE_ACCESS_DENIED_MESSAGE
        }
      })
    }))
  }, [currentUser, isPlatformAdmin])
  const activeNavLabel = navGroupsForCurrentUser
    .flatMap(group => group.items)
    .find(item => item.key === activeNavKey)?.label || 'Dashboard'
  const activeRouteModule = licensedNavModules[activeNavKey] || licensedRouteModules[route]
  const activeRouteLicenseDenied = Boolean(
    currentUser
    && activeRouteModule
    && !canUserAccessLicensedModule(currentUser, activeRouteModule)
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
    if(item.locked){
      setLicenseAccessError(item.disabledReason || LICENSE_ACCESS_DENIED_MESSAGE)
      return
    }

    if(item.platformAdminOnly && !isPlatformAdmin){
      setLicenseAccessError('EVREN360 Yönetici Paneli yalnızca Super Admin kullanıcısı tarafından görüntülenebilir.')
      return
    }

    const requiredModule = licensedNavModules[item.key]
    if(requiredModule && !canUserAccessLicensedModule(currentUser, requiredModule)){
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
    const group = navGroupsForCurrentUser.find(navGroup => navGroup.items.some(groupItem => groupItem.key === item.key))
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
      restaurantName={isPlatformAdmin ? 'EVREN360' : settings.restaurantName}
      logoUrl={isPlatformAdmin ? '' : settings.logoUrl}
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
      onActiveBranchChange={changeActiveBranch}
      onLogout={logout}
    >
      <React.Fragment key={`${activeBranchId}:${onboardingRefreshKey}`}>
      {firstLoginOnboardingRequired && firstLoginOnboardingState ? (
        <FirstLoginWizard
          currentUser={currentUser}
          onboardingState={firstLoginOnboardingState}
          onComplete={completeFirstLoginOnboarding}
        />
      ) : (
        <>
      {licenseAccessError && <div className="form-error license-access-error">{licenseAccessError}</div>}
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
        isPlatformAdmin ? <PendingApplications currentUser={currentUser} /> : <PlatformAccessDenied />
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
      {evren360View && (
        isPlatformAdmin
          ? <SaasManagementCenter currentUser={currentUser} view={evren360View} />
          : <PlatformAccessDenied />
      )}
        </>
      )}
        </>
      )}
      </React.Fragment>
    </AppShell>
  )
}
