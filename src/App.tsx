import React from 'react'
import Products from './pages/Products'
import TableManagement from './pages/TableManagement'
import BusinessSummary from './pages/BusinessSummary'
import SalesRevenueAnalysis from './pages/SalesRevenueAnalysis'
import ProductPerformanceAnalysis from './pages/ProductPerformanceAnalysis'
import StockRiskCenter from './pages/StockRiskCenter'
import CurrentFinanceCenter from './pages/CurrentFinanceCenter'
import PersonnelPerformanceCenter from './pages/PersonnelPerformanceCenter'
import ManagerAlertCenter from './pages/ManagerAlertCenter'
import DailySummary from './pages/DailySummary'
import BillHistory from './pages/BillHistory'
import ActionHistory from './pages/ActionHistory'
import SystemUsageLogs from './pages/SystemUsageLogs'
import UserActivityTracking from './pages/UserActivityTracking'
import ModuleUsageAnalysis from './pages/ModuleUsageAnalysis'
import BusinessUsageStats from './pages/BusinessUsageStats'
import UsagePerformanceAnalysis from './pages/UsagePerformanceAnalysis'
import AnalyticsDashboard from './pages/AnalyticsDashboard'
import StaffTracking from './pages/StaffTracking'
import EmployeeCards from './pages/EmployeeCards'
import ShiftManagement from './pages/ShiftManagement'
import AttendanceTracking from './pages/AttendanceTracking'
import EmployeePerformanceTracking from './pages/EmployeePerformanceTracking'
import EmployeeBonusSystem from './pages/EmployeeBonusSystem'
import EmployeeAuditRecords from './pages/EmployeeAuditRecords'
import EmployeeReports from './pages/EmployeeReports'
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
import BranchManagement from './pages/BranchManagement'
import BranchPermissions from './pages/BranchPermissions'
import BranchReporting from './pages/BranchReporting'
import BranchStockTransfers from './pages/BranchStockTransfers'
import HeadOfficeManagement from './pages/HeadOfficeManagement'
import CurrentAccounts from './pages/CurrentAccounts'
import CreditTransactions from './pages/CreditTransactions'
import CollectionTransactions from './pages/CollectionTransactions'
import CurrentAccountMovements from './pages/CurrentAccountMovements'
import SupplierDebts from './pages/SupplierDebts'
import SupplierPayments from './pages/SupplierPayments'
import CashTransactions from './pages/CashTransactions'
import IncomeExpenseManagement from './pages/IncomeExpenseManagement'
import CashClosingPage from './pages/CashClosing'
import FinancialReports from './pages/FinancialReports'
import CashTransfers from './pages/CashTransfers'
import AppShell, { ShellNavGroup, ShellNavItem } from './components/AppShell'
import {
  loadProducts,
  ensureDefaultAdmin,
  getCurrentUser,
  setCurrentUser,
  loadSettings,
  getVisibleBranchesForUser,
  getActiveBranchId,
  setActiveBranchId,
  migrateBranchScopedData
} from './storage'
import { Branch, User } from './types'

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
  | 'cash-closing'
  | 'financial-reports'
  | 'cash-transfers'
  | 'business-summary'
  | 'sales-revenue-analysis'
  | 'product-performance-analysis'
  | 'stock-risk-center'
  | 'current-finance-center'
  | 'personnel-performance-center'
  | 'manager-alert-center'
  | 'summary'
  | 'history'
  | 'kitchen'
  | 'qr-orders'
  | 'qr-codes'
  | 'actions'
  | 'system-usage-logs'
  | 'user-activity-tracking'
  | 'module-usage-analysis'
  | 'business-usage-stats'
  | 'usage-performance-analysis'
  | 'analytics-dashboard'
  | 'employee-cards'
  | 'shift-management'
  | 'attendance-tracking'
  | 'employee-performance'
  | 'employee-bonus'
  | 'employee-audit'
  | 'employee-reports'
  | 'staff'
  | 'reports'
  | 'current-report'
  | 'risky-current'
  | 'users'
  | 'branches'
  | 'branch-permissions'
  | 'branch-reporting'
  | 'branch-stock-transfers'
  | 'head-office-management'
  | 'current-accounts'
  | 'credit-transactions'
  | 'collection-transactions'
  | 'current-account-movements'
  | 'settings'

type NavKey =
  | 'business-summary'
  | 'sales-revenue-analysis'
  | 'product-performance-analysis'
  | 'stock-risk-center'
  | 'current-finance-center'
  | 'personnel-performance-center'
  | 'manager-alert-center'
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
  | 'cash-closing'
  | 'financial-reports'
  | 'cash-transfers'
  | 'reports'
  | 'current-report'
  | 'risky-current'
  | 'bill-history'
  | 'action-history'
  | 'system-usage-logs'
  | 'user-activity-tracking'
  | 'module-usage-analysis'
  | 'business-usage-stats'
  | 'usage-performance-analysis'
  | 'analytics-dashboard'
  | 'employee-cards'
  | 'shift-management'
  | 'attendance-tracking'
  | 'employee-performance'
  | 'employee-bonus'
  | 'employee-audit'
  | 'employee-reports'
  | 'users'
  | 'branches'
  | 'branch-permissions'
  | 'branch-reporting'
  | 'branch-stock-transfers'
  | 'head-office-management'
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
  | 'usage-analytics'
  | 'personnel'
  | 'multi-branch'
  | 'management'

type NavItem = ShellNavItem<Route, NavKey>
type NavGroup = ShellNavGroup<Route, NavKey, NavGroupKey>

const navGroups: NavGroup[] = [
  {
    key: 'dashboard',
    title: 'Patron Dashboard',
    icon: 'PD',
    items: [
      { key: 'business-summary', label: 'Genel İşletme Özeti', route: 'business-summary', icon: 'Gİ', adminOnly: true },
      { key: 'sales-revenue-analysis', label: 'Satış ve Ciro Analizleri', route: 'sales-revenue-analysis', icon: 'SC', adminOnly: true },
      { key: 'product-performance-analysis', label: 'Ürün Performans Analizleri', route: 'product-performance-analysis', icon: 'ÜP', adminOnly: true },
      { key: 'stock-risk-center', label: 'Stok ve Risk Merkezi', route: 'stock-risk-center', icon: 'SR', adminOnly: true },
      { key: 'current-finance-center', label: 'Cari ve Finans Merkezi', route: 'current-finance-center', icon: 'CF', adminOnly: true },
      { key: 'personnel-performance-center', label: 'Personel Performans Merkezi', route: 'personnel-performance-center', icon: 'PP', adminOnly: true },
      { key: 'manager-alert-center', label: 'Yönetici Uyarı Merkezi', route: 'manager-alert-center', icon: 'YU', adminOnly: true },
      { key: 'dashboard', label: 'Günlük Operasyon Özeti', route: 'summary', icon: 'DB', adminOnly: true }
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
      { key: 'income-expense', label: 'Gelir Gider Yönetimi', route: 'income-expense', icon: 'GG', adminOnly: true },
      { key: 'cash-closing', label: 'Gün Sonu Kasa Kapatma', route: 'cash-closing', icon: 'GS', adminOnly: true },
      { key: 'financial-reports', label: 'Finans Raporları', route: 'financial-reports', icon: 'FR', adminOnly: true },
      { key: 'cash-transfers', label: 'Kasa Devir İşlemleri', route: 'cash-transfers', icon: 'KD', adminOnly: true }
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
    key: 'usage-analytics',
    title: 'Kullanım Analitiği',
    icon: 'KA',
    items: [
      { key: 'analytics-dashboard', label: 'Analitik Dashboard', route: 'analytics-dashboard', icon: 'AD', adminOnly: true },
      { key: 'system-usage-logs', label: 'Sistem Kullanım Logları', route: 'system-usage-logs', icon: 'SL', adminOnly: true },
      { key: 'user-activity-tracking', label: 'Kullanıcı Aktivite Takibi', route: 'user-activity-tracking', icon: 'KA', adminOnly: true },
      { key: 'module-usage-analysis', label: 'Modül Kullanım Analizleri', route: 'module-usage-analysis', icon: 'MA', adminOnly: true },
      { key: 'business-usage-stats', label: 'İşletme Kullanım İstatistikleri', route: 'business-usage-stats', icon: 'İK', adminOnly: true },
      { key: 'usage-performance-analysis', label: 'Performans ve Yoğunluk Analizleri', route: 'usage-performance-analysis', icon: 'PY', adminOnly: true }
    ]
  },
  {
    key: 'personnel',
    title: 'Personel & Denetim',
    icon: 'PD',
    items: [
      { key: 'employee-cards', label: 'Personel Kartları', route: 'employee-cards', icon: 'PK', adminOnly: true },
      { key: 'shift-management', label: 'Vardiya Yönetimi', route: 'shift-management', icon: 'VY', adminOnly: true },
      { key: 'attendance-tracking', label: 'Puantaj ve Mesai Takibi', route: 'attendance-tracking', icon: 'PM', adminOnly: true },
      { key: 'employee-performance', label: 'Personel Performans Takibi', route: 'employee-performance', icon: 'PF', adminOnly: true },
      { key: 'employee-bonus', label: 'Prim Sistemi', route: 'employee-bonus', icon: 'PR', adminOnly: true },
      { key: 'employee-audit', label: 'Disiplin ve Denetim Kayıtları', route: 'employee-audit', icon: 'DD', adminOnly: true },
      { key: 'employee-reports', label: 'Personel Raporları', route: 'employee-reports', icon: 'RA', adminOnly: true },
      { key: 'staff', label: 'Personel Takibi', route: 'staff', icon: 'PT', adminOnly: true }
    ]
  },
  {
    key: 'multi-branch',
    title: 'Çoklu Şube Yönetimi',
    icon: 'ÇŞ',
    items: [
      { key: 'branch-reporting', label: 'Şubeler Arası Raporlama', route: 'branch-reporting', icon: 'ŞR', adminOnly: true },
      { key: 'branch-stock-transfers', label: 'Şubeler Arası Stok Transferi', route: 'branch-stock-transfers', icon: 'ST', adminOnly: true },
      { key: 'head-office-management', label: 'Merkez Ofis Yönetimi', route: 'head-office-management', icon: 'MO', adminOnly: true }
    ]
  },
  {
    key: 'management',
    title: 'Yönetim',
    icon: 'YN',
    items: [
      { key: 'branches', label: 'Şube Yönetimi', route: 'branches', icon: 'ŞB', adminOnly: true },
      { key: 'branch-permissions', label: 'Şube Yetkilendirme', route: 'branch-permissions', icon: 'ŞY', adminOnly: true },
      { key: 'users', label: 'Kullanıcı Yönetimi', route: 'users', icon: 'KY', adminOnly: true },
      { key: 'current-accounts', label: 'Cari Kartları', route: 'current-accounts', icon: 'CK', adminOnly: true },
      { key: 'credit-transactions', label: 'Veresiye İşlemleri', route: 'credit-transactions', icon: 'VI', adminOnly: true },
      { key: 'collection-transactions', label: 'Tahsilat İşlemleri', route: 'collection-transactions', icon: 'TI', adminOnly: true },
      { key: 'current-account-movements', label: 'Cari Hareketleri', route: 'current-account-movements', icon: 'CH', adminOnly: true },
      { key: 'qr-codes', label: 'QR Kodlar', route: 'qr-codes', icon: 'QK', adminOnly: true },
      { key: 'settings', label: 'Ayarlar', route: 'settings', icon: 'AY', adminOnly: true }
    ]
  }
]

const getDefaultNavigation = (user: User | null) => {
  if(user?.role === 'Admin'){
    return {
      route: 'business-summary' as Route,
      activeNavKey: 'business-summary' as NavKey,
      openGroupKey: 'dashboard' as NavGroupKey
    }
  }

  return {
    route: 'tables' as Route,
    activeNavKey: 'adisyon' as NavKey,
    openGroupKey: 'operations' as NavGroupKey
  }
}

export default function App(){
  const qrRouteMatch = window.location.pathname.match(/^\/qr\/([^/?#]+)/)
  const initialUser = React.useMemo(() => getCurrentUser(), [])
  const initialNavigation = React.useMemo(() => getDefaultNavigation(initialUser), [initialUser])
  const [route, setRoute] = React.useState<Route>(initialNavigation.route)
  const [activeNavKey, setActiveNavKey] = React.useState<NavKey>(initialNavigation.activeNavKey)
  const [openGroupKey, setOpenGroupKey] = React.useState<NavGroupKey | null>(initialNavigation.openGroupKey)
  const [currentUser, setUserState] = React.useState<User | null>(initialUser)
  const [settings, setSettings] = React.useState(() => loadSettings())
  const [branches, setBranches] = React.useState<Branch[]>(() => getVisibleBranchesForUser(initialUser))
  const [activeBranchId, setActiveBranchState] = React.useState(() => getActiveBranchId())

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

  const onLogin = (u: User) => {
    const defaultNavigation = getDefaultNavigation(u)
    migrateBranchScopedData(u)
    setUserState(u)
    setBranches(getVisibleBranchesForUser(u))
    setActiveBranchState(getActiveBranchId())
    setRoute(defaultNavigation.route)
    setActiveNavKey(defaultNavigation.activeNavKey)
    setOpenGroupKey(defaultNavigation.openGroupKey)
  }
  const logout = () => {
    const defaultNavigation = getDefaultNavigation(null)
    setCurrentUser(null)
    setUserState(null)
    setRoute(defaultNavigation.route)
    setActiveNavKey(defaultNavigation.activeNavKey)
    setOpenGroupKey(defaultNavigation.openGroupKey)
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
  const activeNavLabel = navGroups
    .flatMap(group => group.items)
    .find(item => item.key === activeNavKey)?.label || 'Genel İşletme Özeti'

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
      branches={branches}
      activeBranchId={activeBranchId}
      openGroupKey={openGroupKey}
      onToggleGroup={toggleNavGroup}
      onOpenNavItem={openNavItem}
      onActiveBranchChange={changeActiveBranch}
      onLogout={logout}
    >
      <React.Fragment key={activeBranchId}>
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
      {route === 'cash-closing' && currentUser.role === 'Admin' && <CashClosingPage currentUser={currentUser} />}
      {route === 'financial-reports' && currentUser.role === 'Admin' && <FinancialReports />}
      {route === 'cash-transfers' && currentUser.role === 'Admin' && <CashTransfers currentUser={currentUser} />}
      {route === 'business-summary' && currentUser.role === 'Admin' && <BusinessSummary />}
      {route === 'sales-revenue-analysis' && currentUser.role === 'Admin' && <SalesRevenueAnalysis />}
      {route === 'product-performance-analysis' && currentUser.role === 'Admin' && <ProductPerformanceAnalysis />}
      {route === 'stock-risk-center' && currentUser.role === 'Admin' && <StockRiskCenter />}
      {route === 'current-finance-center' && currentUser.role === 'Admin' && <CurrentFinanceCenter />}
      {route === 'personnel-performance-center' && currentUser.role === 'Admin' && <PersonnelPerformanceCenter />}
      {route === 'manager-alert-center' && currentUser.role === 'Admin' && <ManagerAlertCenter />}
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
      {route === 'analytics-dashboard' && currentUser.role === 'Admin' && <AnalyticsDashboard />}
      {route === 'system-usage-logs' && currentUser.role === 'Admin' && <SystemUsageLogs />}
      {route === 'user-activity-tracking' && currentUser.role === 'Admin' && <UserActivityTracking />}
      {route === 'module-usage-analysis' && currentUser.role === 'Admin' && <ModuleUsageAnalysis />}
      {route === 'business-usage-stats' && currentUser.role === 'Admin' && <BusinessUsageStats />}
      {route === 'usage-performance-analysis' && currentUser.role === 'Admin' && <UsagePerformanceAnalysis />}
      {route === 'employee-cards' && currentUser.role === 'Admin' && <EmployeeCards currentUser={currentUser} />}
      {route === 'shift-management' && currentUser.role === 'Admin' && <ShiftManagement currentUser={currentUser} />}
      {route === 'attendance-tracking' && currentUser.role === 'Admin' && <AttendanceTracking currentUser={currentUser} />}
      {route === 'employee-performance' && currentUser.role === 'Admin' && <EmployeePerformanceTracking currentUser={currentUser} />}
      {route === 'employee-bonus' && currentUser.role === 'Admin' && <EmployeeBonusSystem currentUser={currentUser} />}
      {route === 'employee-audit' && currentUser.role === 'Admin' && <EmployeeAuditRecords currentUser={currentUser} />}
      {route === 'employee-reports' && currentUser.role === 'Admin' && <EmployeeReports />}
      {route === 'staff' && currentUser.role === 'Admin' && <StaffTracking />}
      {route === 'reports' && currentUser.role === 'Admin' && <Reports />}
      {route === 'current-report' && currentUser.role === 'Admin' && <CurrentReport />}
      {route === 'risky-current' && currentUser.role === 'Admin' && <RiskyCurrentAccounts />}
      {route === 'branches' && currentUser.role === 'Admin' && <BranchManagement currentUser={currentUser} onBranchesChange={refreshBranches} />}
      {route === 'branch-permissions' && currentUser.role === 'Admin' && <BranchPermissions currentUser={currentUser} />}
      {route === 'branch-reporting' && currentUser.role === 'Admin' && <BranchReporting />}
      {route === 'branch-stock-transfers' && currentUser.role === 'Admin' && <BranchStockTransfers currentUser={currentUser} />}
      {route === 'head-office-management' && currentUser.role === 'Admin' && <HeadOfficeManagement />}
      {route === 'users' && currentUser.role === 'Admin' && <Users currentUser={currentUser} />}
      {route === 'current-accounts' && currentUser.role === 'Admin' && <CurrentAccounts currentUser={currentUser} />}
      {route === 'credit-transactions' && currentUser.role === 'Admin' && <CreditTransactions currentUser={currentUser} />}
      {route === 'collection-transactions' && currentUser.role === 'Admin' && <CollectionTransactions currentUser={currentUser} />}
      {route === 'current-account-movements' && currentUser.role === 'Admin' && <CurrentAccountMovements />}
      {route === 'settings' && currentUser.role === 'Admin' && <Settings currentUser={currentUser} onSettingsChange={refreshSettings} />}
      </React.Fragment>
    </AppShell>
  )
}
