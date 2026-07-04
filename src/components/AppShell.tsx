import React from 'react'
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
  onActiveBranchChange: (branchId: string) => void
  onLogout: () => void
  children: React.ReactNode
}

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
  const activeGroupKey = visibleNavGroups.find(group => (
    flattenNavItems(group.items).some(item => item.key === activeNavKey)
  ))?.key
  const activeBranches = branches.filter(branch => branch.isActive)
  const selectableBranches = activeBranches.length > 0 ? activeBranches : branches
  const hasSelectableBranch = selectableBranches.length > 0
  const [notificationPanelOpen, setNotificationPanelOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState<Evren360Notification[]>([])
  const [openTreeKeys, setOpenTreeKeys] = React.useState<Set<string>>(() => new Set(
    navGroups.flatMap(group => collectDefaultExpandedKeys(group.items))
  ))
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
  }, [activeNavKey])

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
          onClick={() => {
            if(hasChildren){
              toggleTreeItem(item.key)
              return
            }
            onOpenNavItem(item)
          }}
        >
          <span className="side-nav-item-main">
            <span className="side-nav-icon" aria-hidden="true">{item.icon}</span>
            <span className="side-nav-label">{item.label}</span>
          </span>
          <span className="side-nav-item-meta">
            {item.locked && <span className="side-nav-lock" aria-hidden="true">K</span>}
            {Boolean(item.badge) && <span className="nav-badge">{item.badge}</span>}
            {hasChildren && <span className="side-nav-node-chevron" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>}
          </span>
        </button>
        {hasChildren && (
          <div className="side-nav-children" hidden={!isOpen}>
            {renderNavItems(children, depth + 1)}
          </div>
        )}
      </div>
    )
  })

  return (
    <div className="app-shell">
      <div className="app-layout">
        <aside className="side-nav" aria-label="Ana menü">
          <div className="app-brand side-brand">
            {logoUrl && <img src={logoUrl} alt={`${restaurantName} logosu`} />}
            <div className="side-brand-copy">
              <h1>{restaurantName}</h1>
              <span>{isPlatformAdmin ? 'Yönetici Merkezi' : 'Yönetim Paneli'}</span>
            </div>
          </div>

          <div className="side-nav-groups">
            {visibleNavGroups.map(group => {
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
                <section className={`side-nav-group ${isOpen ? 'open' : ''} ${isActiveGroup ? 'active-group' : ''}`} key={group.key}>
                  <button
                    type="button"
                    className="side-nav-title"
                    aria-expanded={isOpen}
                    aria-controls={groupPanelId}
                    onClick={() => onToggleGroup(group.key)}
                  >
                    <span className="side-nav-title-main">
                      <span className="side-nav-title-icon" aria-hidden="true">{group.icon}</span>
                      <span>{group.title}</span>
                    </span>
                    <span className="side-nav-chevron" aria-hidden="true">{isOpen ? '▼' : '▶'}</span>
                  </button>
                  <div className="side-nav-items" id={groupPanelId} hidden={!isOpen}>
                    {renderNavItems(visibleItems)}
                    {hasEmptyState && (
                      <div className="side-nav-empty">
                        {group.emptyTitle && <strong>{group.emptyTitle}</strong>}
                        {group.emptyDescription && <span>{group.emptyDescription}</span>}
                        {visibleEmptyAction && (
                          <button className="side-nav-empty-action" type="button" onClick={() => onOpenNavItem(visibleEmptyAction)}>
                            {visibleEmptyAction.label}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        </aside>

        <div className="app-main">
          <header className="topbar">
            <div className="topbar-title">
              <span className="topbar-eyebrow">Aktif ekran</span>
              <strong>{activeNavLabel}</strong>
            </div>
            <div className="topbar-actions">
              <label className="branch-switcher">
                <span>{isPlatformAdmin ? 'Kapsam' : 'Aktif Şube'}</span>
                {isPlatformAdmin ? (
                  <select value="platform" disabled>
                    <option value="platform">EVREN360 Platform</option>
                  </select>
                ) : (
                  <select value={hasSelectableBranch ? activeBranchId : ''} onChange={event => onActiveBranchChange(event.target.value)} disabled={!hasSelectableBranch}>
                    {!hasSelectableBranch && <option value="">Yetkili şube yok</option>}
                    {selectableBranches.map(branch => (
                      <option key={branch.id} value={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                )}
              </label>
              <div className="topbar-notification-wrap">
                <button
                  className={`topbar-notification ${notificationPanelOpen ? 'active' : ''}`}
                  type="button"
                  aria-label={`Bildirimler${unreadNotificationCount > 0 ? `, ${unreadNotificationCount} okunmamış` : ''}`}
                  aria-expanded={notificationPanelOpen}
                  title="Bildirimler"
                  onClick={() => setNotificationPanelOpen(current => !current)}
                >
                  <span className="topbar-bell" aria-hidden="true"></span>
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
                            {notification.type === 'business_application' ? 'B' : notification.type === 'support_request' ? 'D' : 'L'}
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
              <div className="topbar-user-card" aria-label="Kullanıcı bilgisi" title="Kullanıcı bilgisi">
                <span className="topbar-user-avatar">{getUserInitials(currentUser)}</span>
                <span className="topbar-user-meta">
                  <strong>{currentUser.fullName || currentUser.username}</strong>
                  <span>{currentUser.role}</span>
                </span>
              </div>
              <button className="btn topbar-logout" onClick={onLogout}>Çıkış</button>
            </div>
          </header>

          <main className="app-content">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
