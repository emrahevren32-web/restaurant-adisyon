import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import ApplicationShell from './ApplicationShell'
import NavigationQuickAccess, { type NavigationQuickAccessItem } from './NavigationQuickAccess'
import NotificationToastHost from './NotificationToastHost'
import SidebarLayout from './SidebarLayout'
import TopbarLayout from './TopbarLayout'
import TopbarProfileMenu from './TopbarProfileMenu'
import TopbarWorkspaceControl from './TopbarWorkspaceControl'
import WorkspaceLayout from './WorkspaceLayout'
import { Branch, User } from '../types'
import type { PermissionName } from '../authorization/permission.types'
import {
  Evren360Notification,
  ensureEvren360NotificationPlaceholders,
  loadEvren360Notifications,
  markAllEvren360NotificationsRead,
  markEvren360NotificationRead,
  subscribeEvren360Notifications
} from '../notifications/evren360-notification.service'

export type ShellNavItem<Route extends string, NavKey extends string> = {
  key: NavKey
  label: string
  route?: Route
  icon: string
  moduleId?: string
  parent?: NavKey
  order?: number
  children?: ShellNavItem<Route, NavKey>[]
  requiredPermission?: PermissionName
  visible?: boolean
  expandedByDefault?: boolean
  adminOnly?: boolean
  platformAdminOnly?: boolean
  badge?: number
  locked?: boolean
  hidden?: boolean
  disabledReason?: string
}

export type ShellNavGroup<
  Route extends string,
  NavKey extends string,
  GroupKey extends string
> = {
  key: GroupKey
  title: string
  icon: string
  items: ShellNavItem<Route, NavKey>[]
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: ShellNavItem<Route, NavKey>
}

type AppShellProps<
  Route extends string,
  NavKey extends string,
  GroupKey extends string
> = {
  restaurantName: string
  logoUrl: string
  currentUser: User
  navGroups: ShellNavGroup<Route, NavKey, GroupKey>[]
  activeNavKey: NavKey
  activeNavLabel: string
  branches: Branch[]
  activeBranchId: string
  isPlatformAdmin?: boolean
  openGroupKey: GroupKey | null
  onToggleGroup: (groupKey: GroupKey) => void
  onOpenNavItem: (item: ShellNavItem<Route, NavKey>) => void
  onOpenNotification?: (notification: Evren360Notification) => void
  onStartOnboarding?: () => void
  onActiveBranchChange: (branchId: string) => void
  onLogout: () => void
  children: React.ReactNode
}

type ShellThemeMode = 'light' | 'dark'

const THEME_STORAGE_KEY = 'miyop-theme'

const getInitialThemeMode = (): ShellThemeMode => {
  if(typeof window === 'undefined') return 'light'

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    if(storedTheme === 'light' || storedTheme === 'dark') return storedTheme
  } catch {
    return 'light'
  }

  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const normalizeSearchText = (value: string) => (
  value
    .trim()
    .toLocaleLowerCase('tr-TR')
)

const getUserInitials = (user: User) => {
  const name = user.fullName || user.username
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('') || 'U'
}

const formatNotificationTime = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const isNavItemVisible = <
  Route extends string,
  NavKey extends string
>(
  item: ShellNavItem<Route, NavKey>,
  currentUser: User,
  isPlatformAdmin: boolean
) => (
  item.visible !== false
  && !item.hidden
  && (!item.adminOnly || currentUser.role === 'Admin')
  && (!item.platformAdminOnly || isPlatformAdmin)
)

const filterVisibleNavItems = <
  Route extends string,
  NavKey extends string
>(
  items: ShellNavItem<Route, NavKey>[],
  currentUser: User,
  isPlatformAdmin: boolean
): ShellNavItem<Route, NavKey>[] => (
  items
    .filter(item => isNavItemVisible(item, currentUser, isPlatformAdmin))
    .map(item => ({
      ...item,
      children: item.children
        ? filterVisibleNavItems(item.children, currentUser, isPlatformAdmin)
        : undefined
    }))
    .filter(item => Boolean(item.route || !item.children || item.children.length > 0))
)

const flattenNavItems = <
  Route extends string,
  NavKey extends string
>(
  items: ShellNavItem<Route, NavKey>[]
): ShellNavItem<Route, NavKey>[] => (
  items.flatMap(item => [
    item,
    ...flattenNavItems(item.children || [])
  ])
)

const getOnboardingTargetForNavItem = (key: string) => {
  if(key === 'marketplace') return 'module-store'
  return undefined
}

const getNotificationIconSource = (notification: Evren360Notification) => {
  if(notification.type === 'business_application') return 'company'
  if(notification.type === 'support_request') return 'help'
  return 'finance'
}

const navItemHasActiveDescendant = <
  Route extends string,
  NavKey extends string
>(
  item: ShellNavItem<Route, NavKey>,
  activeNavKey: NavKey
): boolean => Boolean(item.children?.some(child => (
  child.key === activeNavKey || navItemHasActiveDescendant(child, activeNavKey)
)))

const collectDefaultExpandedKeys = <
  Route extends string,
  NavKey extends string
>(
  items: ShellNavItem<Route, NavKey>[]
): string[] => (
  items.flatMap(item => [
    ...(item.expandedByDefault ? [String(item.key)] : []),
    ...collectDefaultExpandedKeys(item.children || [])
  ])
)

const collectActiveAncestorKeys = <
  Route extends string,
  NavKey extends string
>(
  items: ShellNavItem<Route, NavKey>[],
  activeNavKey: NavKey,
  ancestors: string[] = []
): string[] => {
  for(const item of items){
    const childAncestors = [...ancestors, String(item.key)]
    if(item.key === activeNavKey) return ancestors
    const childMatch = collectActiveAncestorKeys(item.children || [], activeNavKey, childAncestors)
    if(childMatch.length > 0) return childMatch
  }
  return []
}

export default function AppShell<
  Route extends string,
  NavKey extends string,
  GroupKey extends string
>({
  restaurantName,
  logoUrl,
  currentUser,
  navGroups,
  activeNavKey,
  activeNavLabel,
  branches,
  activeBranchId,
  isPlatformAdmin = false,
  openGroupKey,
  onToggleGroup,
  onOpenNavItem,
  onOpenNotification,
  onStartOnboarding,
  onActiveBranchChange,
  onLogout,
  children
}: AppShellProps<Route, NavKey, GroupKey>){
  const visibleNavGroups = React.useMemo(() => (
    navGroups.map(group => ({
      ...group,
      items: filterVisibleNavItems(group.items, currentUser, isPlatformAdmin)
    }))
  ), [currentUser, isPlatformAdmin, navGroups])
  const activeGroup = visibleNavGroups.find(group => (
    flattenNavItems(group.items).some(item => item.key === activeNavKey)
  ))
  const activeGroupKey = activeGroup?.key
  const activeBranches = branches.filter(branch => branch.isActive)
  const selectableBranches = activeBranches.length > 0 ? activeBranches : branches
  const hasSelectableBranch = selectableBranches.length > 0
  const [notificationPanelOpen, setNotificationPanelOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState<Evren360Notification[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false)
  const [globalSearch, setGlobalSearch] = React.useState('')
  const [themeMode, setThemeMode] = React.useState<ShellThemeMode>(getInitialThemeMode)
  const [openTreeKeys, setOpenTreeKeys] = React.useState<Set<string>>(() => new Set(
    navGroups.flatMap(group => collectDefaultExpandedKeys(group.items))
  ))
  const activeBranch = selectableBranches.find(branch => branch.id === activeBranchId)
  const searchableNavItems = React.useMemo(() => (
    visibleNavGroups
      .flatMap(group => flattenNavItems(group.items))
      .filter(item => Boolean(item.route) && !item.locked)
  ), [visibleNavGroups])
  const quickAccessNavItems = React.useMemo(() => {
    const activeGroupItems = activeGroup
      ? flattenNavItems(activeGroup.items)
      : []
    const primaryItems = activeGroupItems.filter(item => Boolean(item.route) && !item.locked)
    const fallbackItems = searchableNavItems.filter(item => item.key !== activeNavKey)
    const sourceItems = primaryItems.length > 1 ? primaryItems : fallbackItems

    return sourceItems
      .filter(item => item.key !== activeNavKey)
      .slice(0, 5)
  }, [activeGroup, activeNavKey, searchableNavItems])
  const unreadNotifications = React.useMemo(() => (
    notifications.filter(notification => !notification.readAt)
  ), [notifications])
  const unreadNotificationCount = unreadNotifications.length

  const refreshNotifications = React.useCallback(() => {
    if(!isPlatformAdmin){
      setNotifications([])
      return
    }

    ensureEvren360NotificationPlaceholders()
    setNotifications(loadEvren360Notifications())
  }, [isPlatformAdmin])

  React.useEffect(() => {
    refreshNotifications()
    if(!isPlatformAdmin) return undefined
    return subscribeEvren360Notifications(refreshNotifications)
  }, [isPlatformAdmin, refreshNotifications])

  React.useEffect(() => {
    setNotificationPanelOpen(false)
    setMobileSidebarOpen(false)
  }, [activeNavKey])

  React.useEffect(() => {
    const mobileNavigationQuery = window.matchMedia('(max-width: 980px)')
    const syncMobileNavigationLock = () => {
      document.body.classList.toggle('mobile-navigation-open', mobileSidebarOpen && mobileNavigationQuery.matches)
    }

    const closeMobileNavigation = (event: KeyboardEvent) => {
      if(event.key === 'Escape'){
        setMobileSidebarOpen(false)
      }
    }

    syncMobileNavigationLock()
    mobileNavigationQuery.addEventListener('change', syncMobileNavigationLock)

    if(mobileSidebarOpen){
      document.addEventListener('keydown', closeMobileNavigation)
    }

    return () => {
      document.body.classList.remove('mobile-navigation-open')
      mobileNavigationQuery.removeEventListener('change', syncMobileNavigationLock)
      document.removeEventListener('keydown', closeMobileNavigation)
    }
  }, [mobileSidebarOpen])

  React.useEffect(() => {
    document.documentElement.dataset.theme = themeMode

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
    } catch {
      // Theme remains applied for the current session even if storage is unavailable.
    }
  }, [themeMode])

  React.useEffect(() => {
    const keysToOpen = visibleNavGroups.flatMap(group => [
      ...collectDefaultExpandedKeys(group.items),
      ...collectActiveAncestorKeys(group.items, activeNavKey)
    ])
    if(keysToOpen.length === 0) return

    setOpenTreeKeys(current => {
      const next = new Set(current)
      keysToOpen.forEach(key => next.add(key))
      return next
    })
  }, [activeNavKey, visibleNavGroups])

  const openNotification = (notification: Evren360Notification) => {
    markEvren360NotificationRead(notification.id)
    setNotifications(loadEvren360Notifications())
    onOpenNotification?.(notification)
  }

  const markAllNotificationsRead = () => {
    markAllEvren360NotificationsRead()
    setNotifications(loadEvren360Notifications())
  }

  const openNavItem = (item: ShellNavItem<Route, NavKey>) => {
    onOpenNavItem(item)
    setMobileSidebarOpen(false)
  }

  const handleGlobalSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedSearch = normalizeSearchText(globalSearch)
    if(!normalizedSearch) return

    const matchedItem = searchableNavItems.find(item => (
      normalizeSearchText([
        item.label,
        item.route,
        item.moduleId,
        item.parent
      ].filter(Boolean).join(' ')).includes(normalizedSearch)
    ))

    if(!matchedItem) return
    openNavItem(matchedItem)
    setGlobalSearch('')
  }

  const toggleThemeMode = () => {
    setThemeMode(current => current === 'dark' ? 'light' : 'dark')
  }

  const toggleTreeItem = (key: NavKey) => {
    setOpenTreeKeys(current => {
      const next = new Set(current)
      const normalizedKey = String(key)
      if(next.has(normalizedKey)) next.delete(normalizedKey)
      else next.add(normalizedKey)
      return next
    })
  }

  const renderNavItems = (
    items: ShellNavItem<Route, NavKey>[],
    depth = 0
  ): React.ReactNode => items.map(item => {
    const children = item.children || []
    const hasChildren = children.length > 0
    const isOpen = hasChildren && openTreeKeys.has(String(item.key))
    const isActive = activeNavKey === item.key
    const isActiveBranch = isActive || navItemHasActiveDescendant(item, activeNavKey)
    const onboardingTarget = getOnboardingTargetForNavItem(String(item.key))
    const buttonClassName = [
      'side-nav-item',
      hasChildren ? 'tree-parent' : '',
      isActive ? 'active' : '',
      isActiveBranch && !isActive ? 'active-branch' : '',
      item.badge ? 'nav-alert-btn' : '',
      item.locked ? 'locked' : ''
    ].filter(Boolean).join(' ')

    return (
      <div
        className={`side-nav-tree-node depth-${Math.min(depth, 3)}`}
        style={{ '--nav-depth': depth } as React.CSSProperties}
        key={item.key}
      >
        <button
          type="button"
          className={buttonClassName}
          aria-current={isActive ? 'page' : undefined}
          aria-expanded={hasChildren ? isOpen : undefined}
          aria-disabled={item.locked ? true : undefined}
          title={item.locked ? item.disabledReason : item.label}
          data-active={isActive ? 'true' : undefined}
          data-active-branch={isActiveBranch ? 'true' : undefined}
          data-onboarding-target={onboardingTarget}
          onClick={() => {
            if(hasChildren){
              toggleTreeItem(item.key)
              return
            }
            openNavItem(item)
          }}
        >
          <span className="side-nav-item-main">
            <span className="side-nav-icon" aria-hidden="true">
              <AppIcon
                source={item.icon}
                label={item.label}
                context={`${String(item.key)} ${item.route || ''} ${item.moduleId || ''}`}
                size="SM"
              />
            </span>
            <span className="side-nav-label">{item.label}</span>
          </span>
          <span className="side-nav-item-meta">
            {item.locked && (
              <span className="side-nav-lock" aria-hidden="true">
                <AppIcon name="lock" size="XS" />
              </span>
            )}
            {Boolean(item.badge) && <span className="nav-badge">{item.badge}</span>}
            {hasChildren && (
              <span className="side-nav-node-chevron" aria-hidden="true">
                <AppIcon name={isOpen ? 'chevronDown' : 'chevronRight'} size="XS" />
              </span>
            )}
          </span>
        </button>
        {hasChildren && (
          <div
            className="side-nav-children"
            data-state={isOpen ? 'open' : 'closed'}
            aria-hidden={!isOpen}
          >
            {renderNavItems(children, depth + 1)}
          </div>
        )}
      </div>
    )
  })

  const sidebarBrand = (
    <div className="app-brand side-brand">
      <span className="side-brand-logo" aria-hidden={logoUrl ? undefined : true}>
        {logoUrl ? (
          <img src={logoUrl} alt={`${restaurantName} logosu`} />
        ) : (
          <AppIcon name="company" size="MD" />
        )}
      </span>
      <div className="side-brand-copy">
        <span className="side-brand-kicker">MİYOP Workspace</span>
        <h1>{restaurantName}</h1>
        <span className="side-brand-subtitle">{isPlatformAdmin ? 'Yönetici Merkezi' : 'Yönetim Paneli'}</span>
      </div>
    </div>
  )

  const sidebarFooter = (
    <div className="side-nav-footer-card">
      <span className="side-nav-footer-avatar" aria-hidden="true">{getUserInitials(currentUser)}</span>
      <div className="side-nav-footer-copy">
        <span>{isPlatformAdmin ? 'Platform Workspace' : 'Aktif Workspace'}</span>
        <strong>{isPlatformAdmin ? 'EVREN360' : restaurantName}</strong>
        <small>{currentUser.fullName || currentUser.username}</small>
      </div>
    </div>
  )

  const sidebarContent = visibleNavGroups.map(group => {
    const visibleItems = group.items
    const emptyAction = group.emptyAction
    const visibleEmptyAction = emptyAction
      && isNavItemVisible(emptyAction, currentUser, isPlatformAdmin)
      ? emptyAction
      : null
    const hasEmptyState = visibleItems.length === 0 && Boolean(group.emptyTitle || group.emptyDescription)
    if(visibleItems.length === 0 && !hasEmptyState) return null
    const isOpen = openGroupKey === group.key
    const isActiveGroup = activeGroupKey === group.key
    const groupPanelId = `side-nav-group-${group.key}`

    return (
      <section
        className={`side-nav-group ${isOpen ? 'open' : ''} ${isActiveGroup ? 'active-group' : ''}`}
        data-active={isActiveGroup ? 'true' : undefined}
        key={group.key}
      >
        <button
          type="button"
          className="side-nav-title"
          aria-expanded={isOpen}
          aria-controls={groupPanelId}
          title={group.title}
          onClick={() => onToggleGroup(group.key)}
        >
          <span className="side-nav-title-main">
            <span className="side-nav-title-icon" aria-hidden="true">
              <AppIcon source={group.icon} label={group.title} context={String(group.key)} size="XS" />
            </span>
            <span>{group.title}</span>
          </span>
          <span className="side-nav-chevron" aria-hidden="true">
            <AppIcon name="chevronRight" size="XS" />
          </span>
        </button>
        <div
          className="side-nav-items"
          id={groupPanelId}
          data-state={isOpen ? 'open' : 'closed'}
          aria-hidden={!isOpen}
        >
          {renderNavItems(visibleItems)}
          {hasEmptyState && (
            <div className="side-nav-empty">
              {group.emptyTitle && <strong>{group.emptyTitle}</strong>}
              {group.emptyDescription && <span>{group.emptyDescription}</span>}
              {visibleEmptyAction && (
                <button className="side-nav-empty-action" type="button" onClick={() => openNavItem(visibleEmptyAction)}>
                  {visibleEmptyAction.label}
                </button>
              )}
            </div>
          )}
        </div>
      </section>
    )
  })

  const workspaceLabel = isPlatformAdmin ? 'EVREN360 Platform' : activeBranch?.name || restaurantName
  const workspaceControl = (
    <div className="topbar-workspace-tour-target" data-onboarding-target="workspace-control">
      <TopbarWorkspaceControl
        isPlatformAdmin={isPlatformAdmin}
        workspaceLabel={workspaceLabel}
        branches={selectableBranches}
        activeBranchId={activeBranchId}
        hasSelectableBranch={hasSelectableBranch}
        onActiveBranchChange={onActiveBranchChange}
      />
    </div>
  )

  const notificationCenter = (
    <div className="topbar-notification-wrap" data-onboarding-target="notifications">
      <button
        className={`topbar-notification ${notificationPanelOpen ? 'active' : ''}`}
        type="button"
        aria-label={`Bildirimler${unreadNotificationCount > 0 ? `, ${unreadNotificationCount} okunmamış` : ''}`}
        aria-expanded={notificationPanelOpen}
        title="Bildirimler"
        onClick={() => setNotificationPanelOpen(current => !current)}
      >
        <AppIcon name="notification" size="MD" />
        {unreadNotificationCount > 0 && (
          <span className="notification-badge" aria-hidden="true">{unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}</span>
        )}
      </button>
      {notificationPanelOpen && (
        <section className="notification-panel" aria-label="Bildirimler">
          <div className="notification-panel-header">
            <div>
              <span>EVREN360</span>
              <h3>Bildirim Merkezi</h3>
            </div>
            {unreadNotificationCount > 0 && (
              <button className="btn" type="button" onClick={markAllNotificationsRead}>Tümünü Okundu Yap</button>
            )}
          </div>
          <div className="notification-list">
            {notifications.map(notification => (
              <button
                className={`notification-item ${notification.severity} ${notification.readAt ? 'read' : 'unread'}`}
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
              >
                <span className="notification-item-icon" aria-hidden="true">
                  <AppIcon source={getNotificationIconSource(notification)} label={notification.title} size="SM" />
                </span>
                <span className="notification-item-copy">
                  <strong>{notification.title}</strong>
                  <span>{notification.description}</span>
                  <small>{notification.targetLabel || 'EVREN360'} · {formatNotificationTime(notification.createdAt)}{notification.readAt ? ' · Okundu' : ''}</small>
                </span>
              </button>
            ))}
            {notifications.length === 0 && (
              <div className="notification-empty">
                <strong>Bildirim yok</strong>
                <span>Yeni başvuru, destek talebi ve lisans uyarıları burada görünecek.</span>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )

  const workspaceFooter = (
    <>
      <span>MİYOP Industrial Kitchen ERP</span>
      <strong>{activeNavLabel}</strong>
      <span>{currentUser.role}</span>
    </>
  )
  const quickAccessItems: NavigationQuickAccessItem[] = quickAccessNavItems.map(item => ({
    key: String(item.key),
    label: item.label,
    icon: item.icon,
    onOpen: () => openNavItem(item)
  }))
  const workspaceNavigation = (
    <NavigationQuickAccess
      items={quickAccessItems}
      activeLabel={activeGroup?.title || activeNavLabel}
    />
  )

  return (
    <>
      <NotificationToastHost />
      <ApplicationShell
        sidebarCollapsed={sidebarCollapsed}
        mobileSidebarOpen={mobileSidebarOpen}
        onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
        onCloseMobileSidebar={() => setMobileSidebarOpen(false)}
        sidebar={(
          <SidebarLayout
            brand={sidebarBrand}
            collapsed={sidebarCollapsed}
            mobileOpen={mobileSidebarOpen}
            footer={sidebarFooter}
            onToggleCollapsed={() => setSidebarCollapsed(current => !current)}
            onCloseMobile={() => setMobileSidebarOpen(false)}
          >
            {sidebarContent}
          </SidebarLayout>
        )}
        topbar={(
          <TopbarLayout
            title={activeNavLabel}
            breadcrumbs={[
              { label: isPlatformAdmin ? 'EVREN360' : restaurantName, icon: 'home' },
              ...(activeGroup ? [{ label: activeGroup.title, icon: 'module' as const }] : []),
              { label: activeNavLabel, current: true, icon: 'workspace' }
            ]}
            searchValue={globalSearch}
            brandLabel={restaurantName}
            themeMode={themeMode}
            mobileSidebarOpen={mobileSidebarOpen}
            workspaceControl={workspaceControl}
            onSearchChange={setGlobalSearch}
            onSearchSubmit={handleGlobalSearchSubmit}
            onOpenMobileNav={() => setMobileSidebarOpen(true)}
            onToggleTheme={toggleThemeMode}
          >
            {notificationCenter}
            {onStartOnboarding && (
              <button className="topbar-help topbar-icon-action" type="button" aria-label="Yardım" title="Yardım" onClick={onStartOnboarding}>
                <AppIcon name="help" size="SM" />
              </button>
            )}
            <TopbarProfileMenu
              currentUser={currentUser}
              initials={getUserInitials(currentUser)}
              onStartOnboarding={onStartOnboarding}
              onLogout={onLogout}
            />
          </TopbarLayout>
        )}
      >
        <WorkspaceLayout
          title={activeNavLabel}
          navigationKey={String(activeNavKey)}
          navigation={workspaceNavigation}
          footer={workspaceFooter}
        >
          {children}
        </WorkspaceLayout>
      </ApplicationShell>
    </>
  )
}
