import React from 'react'
import Products from './pages/Products'
import TableManagement from './pages/TableManagement'
import DailySummary from './pages/DailySummary'
import BillHistory from './pages/BillHistory'
import ActionHistory from './pages/ActionHistory'
import StaffTracking from './pages/StaffTracking'
import Reports from './pages/Reports'
import CurrentReport from './pages/CurrentReport'
import RiskyCurrentAccounts from './pages/RiskyCurrentAccounts'
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
import CurrentAccounts from './pages/CurrentAccounts'
import CreditTransactions from './pages/CreditTransactions'
import CollectionTransactions from './pages/CollectionTransactions'
import CurrentAccountMovements from './pages/CurrentAccountMovements'
import SupplierDebts from './pages/SupplierDebts'
import SupplierPayments from './pages/SupplierPayments'
import CashTransactions from './pages/CashTransactions'
import IncomeExpenseManagement from './pages/IncomeExpenseManagement'
import AppShell, { ShellNavGroup, ShellNavItem } from './components/AppShell'
import {
  loadProducts,
  ensureDefaultAdmin,
  getCurrentUser,
  setCurrentUser,
  loadSettings
} from './storage'
import { User } from './types'

type Route =
  | 'tables'
  | 'products'
  | 'stock-cards'
  | 'stock-movements'
  | 'recipes'
  | 'supplier-debts'
  | 'supplier-payments'
  | 'cash-transactions'
  | 'income-expense'
  | 'summary'
  | 'history'
  | 'kitchen'
  | 'qr-orders'
  | 'qr-codes'
  | 'actions'
  | 'staff'
  | 'reports'
  | 'current-report'
  | 'risky-current'
  | 'users'
  | 'current-accounts'
  | 'credit-transactions'
  | 'collection-transactions'
  | 'current-account-movements'
  | 'settings'

type NavKey =
  | 'dashboard'
  | 'adisyon'
  | 'tables-management'
  | 'products'
  | 'kitchen'
  | 'qr-orders'
  | 'waiter-calls'
  | 'stock-cards'
  | 'stock-movements'
  | 'recipes'
  | 'critical-stock'
  | 'expiry-lots'
  | 'waste'
  | 'supplier-debts'
  | 'supplier-payments'
  | 'cash-transactions'
  | 'income-expense'
  | 'reports'
  | 'current-report'
  | 'risky-current'
  | 'bill-history'
  | 'action-history'
  | 'users'
  | 'staff'
  | 'current-accounts'
  | 'credit-transactions'
  | 'collection-transactions'
  | 'current-account-movements'
  | 'qr-codes'
  | 'settings'

type NavGroupKey =
  | 'dashboard'
  | 'operations'
  | 'stock'
  | 'finance'
  | 'reports'
  | 'management'

type NavItem = ShellNavItem<Route, NavKey>
type NavGroup = ShellNavGroup<Route, NavKey, NavGroupKey>

const navGroups: NavGroup[] = [
  {
    key: 'dashboard',
    title: 'Dashboard',
    icon: 'DB',
    items: [
      { key: 'dashboard', label: 'Dashboard', route: 'summary', icon: 'DB' }
    ]
  },
  {
    key: 'operations',
    title: 'Operasyonlar',
    icon: 'OP',
    items: [
      { key: 'adisyon', label: 'Adisyonlar', route: 'tables', icon: 'AD' },
      { key: 'tables-management', label: 'Masalar', route: 'tables', icon: 'MS' },
      { key: 'products', label: 'Ürünler', route: 'products', icon: 'UR' },
      { key: 'kitchen', label: 'Mutfak Ekranı', route: 'kitchen', icon: 'MF' },
      { key: 'qr-orders', label: 'QR Siparişler', route: 'qr-orders', icon: 'QR' },
      { key: 'waiter-calls', label: 'Garson Çağrıları', route: 'qr-orders', icon: 'GC' }
    ]
  },
  {
    key: 'stock',
    title: 'Stok Yönetimi',
    icon: 'ST',
    items: [
      { key: 'stock-cards', label: 'Stok Kartları', route: 'stock-cards', icon: 'SK', adminOnly: true },
      { key: 'stock-movements', label: 'Stok Hareketleri', route: 'stock-movements', icon: 'SH', adminOnly: true },
      { key: 'recipes', label: 'Reçeteler', route: 'recipes', icon: 'RC', adminOnly: true },
      { key: 'critical-stock', label: 'Kritik Stok', route: 'stock-cards', icon: 'KS', adminOnly: true },
      { key: 'expiry-lots', label: 'SKT Yönetimi', route: 'stock-cards', icon: 'SKT', adminOnly: true },
      { key: 'waste', label: 'Fire Yönetimi', route: 'stock-movements', icon: 'FR', adminOnly: true }
    ]
  },
  {
    key: 'finance',
    title: 'Kasa & Finans',
    icon: 'KF',
    items: [
      { key: 'supplier-debts', label: 'Tedarikçi Borçları', route: 'supplier-debts', icon: 'TB', adminOnly: true },
      { key: 'supplier-payments', label: 'Tedarikçi Ödeme İşlemleri', route: 'supplier-payments', icon: 'TO', adminOnly: true },
      { key: 'cash-transactions', label: 'Kasa Hareketleri', route: 'cash-transactions', icon: 'KH', adminOnly: true },
      { key: 'income-expense', label: 'Gelir Gider Yönetimi', route: 'income-expense', icon: 'GG', adminOnly: true }
    ]
  },
  {
    key: 'reports',
    title: 'Raporlama',
    icon: 'RP',
    items: [
      { key: 'action-history', label: 'İşlem Geçmişi', route: 'actions', icon: 'IG', adminOnly: true },
      { key: 'reports', label: 'Rapor Merkezi', route: 'reports', icon: 'RM', adminOnly: true },
      { key: 'current-report', label: 'Cari Raporu', route: 'current-report', icon: 'CR', adminOnly: true },
      { key: 'risky-current', label: 'Riskli Cari', route: 'risky-current', icon: 'RC', adminOnly: true },
      { key: 'bill-history', label: 'Adisyon Geçmişi', route: 'history', icon: 'AG', adminOnly: true }
    ]
  },
  {
    key: 'management',
    title: 'Yönetim',
    icon: 'YN',
    items: [
      { key: 'users', label: 'Kullanıcı Yönetimi', route: 'users', icon: 'KY', adminOnly: true },
      { key: 'staff', label: 'Personel Takibi', route: 'staff', icon: 'PT', adminOnly: true },
      { key: 'current-accounts', label: 'Cari Kartları', route: 'current-accounts', icon: 'CK', adminOnly: true },
      { key: 'credit-transactions', label: 'Veresiye İşlemleri', route: 'credit-transactions', icon: 'VI', adminOnly: true },
      { key: 'collection-transactions', label: 'Tahsilat İşlemleri', route: 'collection-transactions', icon: 'TI', adminOnly: true },
      { key: 'current-account-movements', label: 'Cari Hareketleri', route: 'current-account-movements', icon: 'CH', adminOnly: true },
      { key: 'qr-codes', label: 'QR Kodlar', route: 'qr-codes', icon: 'QK', adminOnly: true },
      { key: 'settings', label: 'Ayarlar', route: 'settings', icon: 'AY', adminOnly: true }
    ]
  }
]

export default function App(){
  const qrRouteMatch = window.location.pathname.match(/^\/qr\/([^/?#]+)/)
  const [route, setRoute] = React.useState<Route>('tables')
  const [activeNavKey, setActiveNavKey] = React.useState<NavKey>('adisyon')
  const [openGroupKey, setOpenGroupKey] = React.useState<NavGroupKey | null>('operations')
  const [currentUser, setUserState] = React.useState<User | null>(() => getCurrentUser())
  const [settings, setSettings] = React.useState(() => loadSettings())

  React.useEffect(()=>{ loadProducts(); ensureDefaultAdmin() }, [])
  React.useEffect(() => {
    document.title = settings.restaurantName
  }, [settings.restaurantName])

  const onLogin = (u: User) => setUserState(u)
  const logout = () => {
    setCurrentUser(null)
    setUserState(null)
    setRoute('tables')
    setActiveNavKey('adisyon')
    setOpenGroupKey('operations')
  }
  const refreshSettings = () => setSettings(loadSettings())
  const activeNavLabel = navGroups
    .flatMap(group => group.items)
    .find(item => item.key === activeNavKey)?.label || 'Adisyonlar'

  const openNavItem = (item: NavItem) => {
    setRoute(item.route)
    setActiveNavKey(item.key)
    const group = navGroups.find(navGroup => navGroup.items.some(groupItem => groupItem.key === item.key))
    if(group) setOpenGroupKey(group.key)
  }

  const toggleNavGroup = (groupKey: NavGroupKey) => {
    setOpenGroupKey(current => current === groupKey ? null : groupKey)
  }

  if(qrRouteMatch){
    return <QRMenu tableId={qrRouteMatch[1]} />
  }

  if(!currentUser){
    return (
      <div className="app-shell auth-shell">
        <div className="app-brand auth-brand">
          {settings.logoUrl && <img src={settings.logoUrl} alt={`${settings.restaurantName} logosu`} />}
          <h1>{settings.restaurantName}</h1>
        </div>
        <Login onLogin={onLogin} />
      </div>
    )
  }

  return (
    <AppShell
      restaurantName={settings.restaurantName}
      logoUrl={settings.logoUrl}
      currentUser={currentUser}
      navGroups={navGroups}
      activeNavKey={activeNavKey}
      activeNavLabel={activeNavLabel}
      openGroupKey={openGroupKey}
      onToggleGroup={toggleNavGroup}
      onOpenNavItem={openNavItem}
      onLogout={logout}
    >
      {route === 'tables' && (
        <TableManagement
          currentUser={currentUser}
          focus={activeNavKey === 'tables-management' ? 'tables' : 'billing'}
        />
      )}
      {route === 'products' && <Products currentUser={currentUser} />}
      {route === 'stock-cards' && currentUser.role === 'Admin' && (
        <StockCards
          currentUser={currentUser}
          focus={activeNavKey === 'critical-stock' ? 'critical' : activeNavKey === 'expiry-lots' ? 'expiry' : 'cards'}
        />
      )}
      {route === 'stock-movements' && currentUser.role === 'Admin' && (
        <StockMovements
          currentUser={currentUser}
          focus={activeNavKey === 'waste' ? 'waste' : 'movements'}
        />
      )}
      {route === 'recipes' && currentUser.role === 'Admin' && <Recipes currentUser={currentUser} />}
      {route === 'supplier-debts' && currentUser.role === 'Admin' && <SupplierDebts currentUser={currentUser} />}
      {route === 'supplier-payments' && currentUser.role === 'Admin' && <SupplierPayments currentUser={currentUser} />}
      {route === 'cash-transactions' && currentUser.role === 'Admin' && <CashTransactions currentUser={currentUser} />}
      {route === 'income-expense' && currentUser.role === 'Admin' && <IncomeExpenseManagement currentUser={currentUser} />}
      {route === 'summary' && <DailySummary currentUser={currentUser} />}
      {route === 'history' && <BillHistory />}
      {route === 'kitchen' && <Kitchen currentUser={currentUser} />}
      {route === 'qr-orders' && (
        <QROrders
          currentUser={currentUser}
          focus={activeNavKey === 'waiter-calls' ? 'calls' : 'orders'}
        />
      )}
      {route === 'qr-codes' && currentUser.role === 'Admin' && <QRCodes />}
      {route === 'actions' && currentUser.role === 'Admin' && <ActionHistory />}
      {route === 'staff' && currentUser.role === 'Admin' && <StaffTracking />}
      {route === 'reports' && currentUser.role === 'Admin' && <Reports />}
      {route === 'current-report' && currentUser.role === 'Admin' && <CurrentReport />}
      {route === 'risky-current' && currentUser.role === 'Admin' && <RiskyCurrentAccounts />}
      {route === 'users' && currentUser.role === 'Admin' && <Users currentUser={currentUser} />}
      {route === 'current-accounts' && currentUser.role === 'Admin' && <CurrentAccounts currentUser={currentUser} />}
      {route === 'credit-transactions' && currentUser.role === 'Admin' && <CreditTransactions currentUser={currentUser} />}
      {route === 'collection-transactions' && currentUser.role === 'Admin' && <CollectionTransactions currentUser={currentUser} />}
      {route === 'current-account-movements' && currentUser.role === 'Admin' && <CurrentAccountMovements />}
      {route === 'settings' && currentUser.role === 'Admin' && <Settings currentUser={currentUser} onSettingsChange={refreshSettings} />}
    </AppShell>
  )
}
