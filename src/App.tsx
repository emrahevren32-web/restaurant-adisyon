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
  WORKSPACE_MODULE_LIFECYCLE_STATES
} from './workspace/workspace-module-lifecycle.service'
import type { WorkspaceModuleLifecycleResult } from './workspace/workspace-module-lifecycle.service'
import type { Evren360Notification } from './notifications/evren360-notification.service'
import { hasConnectedWorkspaceIntegrationsForUser } from './integrations/workspace-integration.service'
import { createPlatformNavGroups, getPlatformRoutes } from './platform/platform.registry'
import { getBusinessMenuEmptyState, getWorkspaceTemplateViewForUser } from './workspace-template/workspace-template.service'
import { WORKSPACE_MODULE_CODES } from './modules/module-code.registry'
import {
  getBusinessWorkspaceModuleByLicenseKey,
  isBusinessWorkspaceModuleAvailableForSector
} from './modules/business-workspace.registry'

type NavItem = ShellNavItem<Route, NavKey>
type NavGroup = ShellNavGroup<Route, NavKey, NavGroupKey>

const INSTALLATION_LOCK_MESSAGE = 'Kurulum tamamlanmadan Kontrol Paneli, Çalışma Alanı ve Modül Mağazası kullanılamaz. Lütfen Business Setup Wizard adımlarını tamamlayın.'
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

const businessWorkspaceRouteSet = new Set<Route>(
  allBusinessWorkspaceNavGroups
    .flatMap(group => flattenAppNavItems(group.items))
    .map(item => item.route)
    .filter(Boolean) as Route[]
)

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

const isWorkspaceNavigationBaseModule = (
  moduleCode: string,
  primarySectorId: string
) => (
  moduleCode === WORKSPACE_MODULE_CODES.PURCHASE
  && Boolean(primarySectorId)
)

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
  const setupCompleted = isWorkspaceSetupCompletedForUser(user)
  const primarySectorId = getPrimarySectorIdForUser(user)
  const businessMenuEmptyState = setupCompleted
    ? getBusinessMenuEmptyState(getWorkspaceTemplateViewForUser(user))
    : undefined

  const groups = createBusinessWorkspaceNavGroups({
    isCoreModuleVisible: module => {
      if(module.code === WORKSPACE_MODULE_CODES.WORKSPACE_WELCOME) return !setupCompleted
      if(module.code === WORKSPACE_MODULE_CODES.MARKETPLACE) return true
      if(module.code === WORKSPACE_MODULE_CODES.INTEGRATION_CENTER) return setupCompleted && hasConnectedWorkspaceIntegrationsForUser(user)
      return module.code === WORKSPACE_MODULE_CODES.DASHBOARD || module.code === WORKSPACE_MODULE_CODES.WORKSPACE
    },
    isModuleEnabled: module => {
      if(!isBusinessWorkspaceModuleAvailableForSector(module, primarySectorId)) return false
      if(isWorkspaceNavigationBaseModule(module.code, primarySectorId)) return true
      if(module.isCoreModule || module.isAlwaysActive) return true
      if(module.isBusinessModule){
        return isWorkspaceModuleActiveForUser(user, module)
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

const isPlatformAdminUser = (user?: User | null) => {
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

  React.useEffect(()=>{
    ensureDefaultAdmin()
    if(currentUser) migrateBranchScopedData(currentUser)
    setBranches(getVisibleBranchesForUser(currentUser))
    setActiveBranchState(getActiveBranchId())
  }, [currentUser])
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
  const startOnboardingExperience = () => {
    setOnboardingExperienceStartSignal(current => current + 1)
  }
  const openIntegrationCenterFromWelcome = () => {
    if(!hasConnectedWorkspaceIntegrationsForUser(currentUser)) return
    setLicenseAccessError('')
    setRoute('integration-center')
    setActiveNavKey('integration-center')
    setOpenGroupKey('system-modules')
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
