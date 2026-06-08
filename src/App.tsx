import React from 'react'
import Products from './pages/Products'
import TableManagement from './pages/TableManagement'
import DailySummary from './pages/DailySummary'
import BillHistory from './pages/BillHistory'
import ActionHistory from './pages/ActionHistory'
import StaffTracking from './pages/StaffTracking'
import Reports from './pages/Reports'
import Kitchen from './pages/Kitchen'
import QRMenu from './pages/QRMenu'
import QROrders from './pages/QROrders'
import QRCodes from './pages/QRCodes'
import StockCards from './pages/StockCards'
import StockMovements from './pages/StockMovements'
import Recipes from './pages/Recipes'
import Login from './pages/Login'
import Users from './pages/Users'
import Settings from './pages/Settings'
import {
  loadProducts,
  ensureDefaultAdmin,
  getCurrentUser,
  setCurrentUser,
  loadSettings,
  loadQRRequests,
  loadWaiterCalls
} from './storage'
import { User } from './types'

type Route =
  | 'tables'
  | 'products'
  | 'stock-cards'
  | 'stock-movements'
  | 'recipes'
  | 'summary'
  | 'history'
  | 'kitchen'
  | 'qr-orders'
  | 'qr-codes'
  | 'actions'
  | 'staff'
  | 'reports'
  | 'users'
  | 'settings'

type NavKey =
  | 'dashboard'
  | 'adisyon'
  | 'history'
  | 'kitchen'
  | 'qr-orders'
  | 'stock-cards'
  | 'stock-movements'
  | 'recipes'
  | 'critical-stock'
  | 'expiry-lots'
  | 'waste'
  | 'reports'
  | 'products'
  | 'qr-codes'
  | 'staff'
  | 'actions'
  | 'users'
  | 'settings'

type NavItem = {
  key: NavKey
  label: string
  route: Route
  icon: string
  adminOnly?: boolean
  badge?: number
}

type NavGroup = {
  title: string
  icon: string
  items: NavItem[]
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

export default function App(){
  const qrRouteMatch = window.location.pathname.match(/^\/qr\/([^/?#]+)/)
  const [route, setRoute] = React.useState<Route>('tables')
  const [activeNavKey, setActiveNavKey] = React.useState<NavKey>('adisyon')
  const [currentUser, setUserState] = React.useState<User | null>(() => getCurrentUser())
  const [settings, setSettings] = React.useState(() => loadSettings())
  const [qrNotificationCount, setQrNotificationCount] = React.useState(0)

  React.useEffect(()=>{ loadProducts(); ensureDefaultAdmin() }, [])
  React.useEffect(() => {
    document.title = settings.restaurantName
  }, [settings.restaurantName])
  React.useEffect(() => {
    if(!currentUser){
      setQrNotificationCount(0)
      return
    }

    const refreshNotifications = () => {
      setQrNotificationCount(loadQRRequests().length + loadWaiterCalls().length)
    }

    refreshNotifications()
    const intervalId = window.setInterval(refreshNotifications, 3000)
    window.addEventListener('storage', refreshNotifications)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('storage', refreshNotifications)
    }
  }, [currentUser])

  const onLogin = (u: User) => setUserState(u)
  const logout = () => {
    setCurrentUser(null)
    setUserState(null)
    setRoute('tables')
    setActiveNavKey('adisyon')
  }
  const refreshSettings = () => setSettings(loadSettings())

  const navGroups: NavGroup[] = [
    {
      title: 'Operasyon',
      icon: 'OP',
      items: [
        { key: 'dashboard', label: 'Dashboard', route: 'summary', icon: 'DB' },
        { key: 'adisyon', label: 'Adisyon', route: 'tables', icon: 'AD' },
        { key: 'history', label: 'Adisyon Geçmişi', route: 'history', icon: 'GH' },
        { key: 'kitchen', label: 'Mutfak Ekranı', route: 'kitchen', icon: 'MF' },
        { key: 'qr-orders', label: 'QR Siparişler', route: 'qr-orders', icon: 'QR', badge: qrNotificationCount }
      ]
    },
    {
      title: 'Stok Yönetimi',
      icon: 'ST',
      items: [
        { key: 'stock-cards', label: 'Stok Kartları', route: 'stock-cards', icon: 'SK', adminOnly: true },
        { key: 'stock-movements', label: 'Stok Hareketleri', route: 'stock-movements', icon: 'SH', adminOnly: true },
        { key: 'recipes', label: 'Reçete Yönetimi', route: 'recipes', icon: 'RC', adminOnly: true },
        { key: 'critical-stock', label: 'Kritik Stok', route: 'stock-cards', icon: 'KS', adminOnly: true },
        { key: 'expiry-lots', label: 'SKT ve Lot Sistemi', route: 'stock-cards', icon: 'LT', adminOnly: true },
        { key: 'waste', label: 'Fire Yönetimi', route: 'stock-movements', icon: 'FR', adminOnly: true }
      ]
    },
    {
      title: 'Raporlama',
      icon: 'RP',
      items: [
        { key: 'reports', label: 'Rapor Merkezi', route: 'reports', icon: 'RM', adminOnly: true }
      ]
    },
    {
      title: 'Sistem',
      icon: 'SY',
      items: [
        { key: 'actions', label: 'İşlem Geçmişi', route: 'actions', icon: 'IG', adminOnly: true },
        { key: 'products', label: 'Ürünler', route: 'products', icon: 'UR' },
        { key: 'qr-codes', label: 'QR Kodlar', route: 'qr-codes', icon: 'QK', adminOnly: true },
        { key: 'staff', label: 'Personel Takibi', route: 'staff', icon: 'PT', adminOnly: true },
        { key: 'users', label: 'Kullanıcılar', route: 'users', icon: 'KY', adminOnly: true },
        { key: 'settings', label: 'Ayarlar', route: 'settings', icon: 'AY', adminOnly: true }
      ]
    }
  ]
  const activeNavLabel = navGroups
    .flatMap(group => group.items)
    .find(item => item.key === activeNavKey)?.label || 'Adisyon'

  const openNavItem = (item: NavItem) => {
    setRoute(item.route)
    setActiveNavKey(item.key)
  }

  if(qrRouteMatch){
    return <QRMenu tableId={qrRouteMatch[1]} />
  }

  return (
    <div className="app-shell">
      {!currentUser ? (
        <>
          <div className="app-brand">
            {settings.logoUrl && <img src={settings.logoUrl} alt={`${settings.restaurantName} logosu`} />}
            <h1>{settings.restaurantName}</h1>
          </div>
          <Login onLogin={onLogin} />
        </>
      ) : (
        <div className="app-layout">
          <aside className="side-nav" aria-label="Ana menü">
            <div className="app-brand side-brand">
              {settings.logoUrl && <img src={settings.logoUrl} alt={`${settings.restaurantName} logosu`} />}
              <h1>{settings.restaurantName}</h1>
            </div>

            <div className="side-nav-groups">
              {navGroups.map(group => {
                const visibleItems = group.items.filter(item => !item.adminOnly || currentUser.role === 'Admin')
                if(visibleItems.length === 0) return null

                return (
                  <section className="side-nav-group" key={group.title}>
                    <span className="side-nav-title">
                      <span className="side-nav-title-icon" aria-hidden="true">{group.icon}</span>
                      <span>{group.title}</span>
                    </span>
                    <div className="side-nav-items">
                      {visibleItems.map(item => (
                        <button
                          key={item.key}
                          type="button"
                          className={`side-nav-item ${activeNavKey === item.key ? 'active' : ''} ${item.badge ? 'nav-alert-btn' : ''}`}
                          onClick={() => openNavItem(item)}
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
                <span className="notification-placeholder" aria-label="Bildirim alanı" title="Bildirim alanı">
                  <span aria-hidden="true">0</span>
                </span>
                <span className="profile-placeholder" aria-label="Profil menüsü" title="Profil menüsü">
                  <span className="profile-avatar">{getUserInitials(currentUser)}</span>
                  <span className="user-meta">
                    <strong>{currentUser.fullName || currentUser.username}</strong>
                    <span>{currentUser.role}</span>
                  </span>
                  <span className="profile-caret" aria-hidden="true">v</span>
                </span>
                <button className="btn topbar-logout" onClick={logout}>Çıkış</button>
              </div>
            </header>

            <main className="app-content">
              {route === 'tables' && <TableManagement currentUser={currentUser} />}
              {route === 'products' && <Products currentUser={currentUser} />}
              {route === 'stock-cards' && currentUser.role === 'Admin' && <StockCards currentUser={currentUser} />}
              {route === 'stock-movements' && currentUser.role === 'Admin' && <StockMovements currentUser={currentUser} />}
              {route === 'recipes' && currentUser.role === 'Admin' && <Recipes currentUser={currentUser} />}
              {route === 'summary' && <DailySummary currentUser={currentUser} />}
              {route === 'history' && <BillHistory />}
              {route === 'kitchen' && <Kitchen currentUser={currentUser} />}
              {route === 'qr-orders' && <QROrders currentUser={currentUser} />}
              {route === 'qr-codes' && currentUser.role === 'Admin' && <QRCodes />}
              {route === 'actions' && currentUser.role === 'Admin' && <ActionHistory />}
              {route === 'staff' && currentUser.role === 'Admin' && <StaffTracking />}
              {route === 'reports' && currentUser.role === 'Admin' && <Reports />}
              {route === 'users' && currentUser.role === 'Admin' && <Users currentUser={currentUser} />}
              {route === 'settings' && currentUser.role === 'Admin' && <Settings currentUser={currentUser} onSettingsChange={refreshSettings} />}
            </main>
          </div>
        </div>
      )}
    </div>
  )
}
