import React from 'react'
import { User } from '../types'

export type ShellNavItem<Route extends string, NavKey extends string> = {
  key: NavKey
  label: string
  route: Route
  icon: string
  adminOnly?: boolean
  badge?: number
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
  openGroupKey: GroupKey | null
  onToggleGroup: (groupKey: GroupKey) => void
  onOpenNavItem: (item: ShellNavItem<Route, NavKey>) => void
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
  openGroupKey,
  onToggleGroup,
  onOpenNavItem,
  onLogout,
  children
}: AppShellProps<Route, NavKey, GroupKey>){
  const activeGroupKey = navGroups.find(group => group.items.some(item => item.key === activeNavKey))?.key

  return (
    <div className="app-shell">
      <div className="app-layout">
        <aside className="side-nav" aria-label="Ana menü">
          <div className="app-brand side-brand">
            {logoUrl && <img src={logoUrl} alt={`${restaurantName} logosu`} />}
            <div className="side-brand-copy">
              <h1>{restaurantName}</h1>
              <span>Yönetim Paneli</span>
            </div>
          </div>

          <div className="side-nav-groups">
            {navGroups.map(group => {
              const visibleItems = group.items.filter(item => !item.adminOnly || currentUser.role === 'Admin')
              if(visibleItems.length === 0) return null
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
                    <span className="side-nav-chevron" aria-hidden="true">v</span>
                  </button>
                  <div className="side-nav-items" id={groupPanelId} hidden={!isOpen}>
                    {visibleItems.map(item => (
                      <button
                        key={item.key}
                        type="button"
                        className={`side-nav-item ${activeNavKey === item.key ? 'active' : ''} ${item.badge ? 'nav-alert-btn' : ''}`}
                        aria-current={activeNavKey === item.key ? 'page' : undefined}
                        onClick={() => onOpenNavItem(item)}
                      >
                        <span className="side-nav-item-main">
                          <span className="side-nav-icon" aria-hidden="true">{item.icon}</span>
                          <span className="side-nav-label">{item.label}</span>
                        </span>
                        {Boolean(item.badge) && <span className="nav-badge">{item.badge}</span>}
                      </button>
                    ))}
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
              <div className="notification-placeholder" aria-label="Bildirim alanı" title="Bildirim alanı">
                <span className="notification-dot" aria-hidden="true"></span>
                <span className="notification-count">0</span>
              </div>
              <div className="profile-placeholder" aria-label="Kullanıcı bilgisi" title="Kullanıcı bilgisi">
                <span className="profile-avatar">{getUserInitials(currentUser)}</span>
                <span className="user-meta">
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
