import React from 'react'
import { Branch, User } from '../types'

export type ShellNavItem<Route extends string, NavKey extends string> = {
  key: NavKey
  label: string
  route: Route
  icon: string
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
  onActiveBranchChange,
  onLogout,
  children
}: AppShellProps<Route, NavKey, GroupKey>){
  const activeGroupKey = navGroups.find(group => group.items.some(item => item.key === activeNavKey))?.key
  const activeBranches = branches.filter(branch => branch.isActive)
  const selectableBranches = activeBranches.length > 0 ? activeBranches : branches
  const hasSelectableBranch = selectableBranches.length > 0

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
            {navGroups.map(group => {
              const visibleItems = group.items.filter(item => (
                !item.hidden
                && (!item.adminOnly || currentUser.role === 'Admin')
                && (!item.platformAdminOnly || isPlatformAdmin)
              ))
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
                    <span className="side-nav-chevron" aria-hidden="true">{isOpen ? '▼' : '▶'}</span>
                  </button>
                  <div className="side-nav-items" id={groupPanelId} hidden={!isOpen}>
                    {visibleItems.map(item => (
                      <button
                        key={item.key}
                        type="button"
                        className={`side-nav-item ${activeNavKey === item.key ? 'active' : ''} ${item.badge ? 'nav-alert-btn' : ''} ${item.locked ? 'locked' : ''}`}
                        aria-current={activeNavKey === item.key ? 'page' : undefined}
                        aria-disabled={item.locked ? true : undefined}
                        title={item.locked ? item.disabledReason : item.label}
                        onClick={() => onOpenNavItem(item)}
                      >
                        <span className="side-nav-item-main">
                          <span className="side-nav-icon" aria-hidden="true">{item.icon}</span>
                          <span className="side-nav-label">{item.label}</span>
                        </span>
                        {item.locked && <span className="side-nav-lock" aria-hidden="true">K</span>}
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
              <div className="topbar-notification" aria-label="Bildirimler" title="Bildirimler">
                <span className="topbar-bell" aria-hidden="true"></span>
                <span className="notification-dot" aria-hidden="true"></span>
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
