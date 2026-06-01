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

export default function App(){
  const qrRouteMatch = window.location.pathname.match(/^\/qr\/([^/?#]+)/)
  const [route, setRoute] = React.useState<Route>('tables')
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
  const logout = () => { setCurrentUser(null); setUserState(null); setRoute('tables') }
  const refreshSettings = () => setSettings(loadSettings())

  if(qrRouteMatch){
    return <QRMenu tableId={qrRouteMatch[1]} />
  }

  return (
    <div>
      <div className="app-brand">
        {settings.logoUrl && <img src={settings.logoUrl} alt={`${settings.restaurantName} logosu`} />}
        <h1>{settings.restaurantName}</h1>
      </div>
      {!currentUser ? (
        <Login onLogin={onLogin} />
      ) : (
        <>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div className="nav">
              <button className="btn" onClick={()=>setRoute('tables')}>Masalar</button>
              <button className="btn" onClick={()=>setRoute('products')}>Ürünler</button>
              <button className="btn" onClick={()=>setRoute('summary')}>Günlük Satış</button>
              <button className="btn" onClick={()=>setRoute('history')}>Adisyon Geçmişi</button>
              <button className="btn" onClick={()=>setRoute('kitchen')}>Mutfak Ekranı</button>
              <button className="btn nav-alert-btn" onClick={()=>setRoute('qr-orders')}>
                QR Siparişler
                {qrNotificationCount > 0 && <span className="nav-badge">{qrNotificationCount}</span>}
              </button>
              {currentUser.role === 'Admin' && <button className="btn" onClick={()=>setRoute('qr-codes')}>QR Kodlar</button>}
              {currentUser.role === 'Admin' && <button className="btn" onClick={()=>setRoute('reports')}>Raporlama</button>}
              {currentUser.role === 'Admin' && <button className="btn" onClick={()=>setRoute('staff')}>Personel Takibi</button>}
              {currentUser.role === 'Admin' && <button className="btn" onClick={()=>setRoute('actions')}>İşlem Geçmişi</button>}
              {currentUser.role === 'Admin' && <button className="btn" onClick={()=>setRoute('users')}>Kullanıcılar</button>}
              {currentUser.role === 'Admin' && <button className="btn" onClick={()=>setRoute('settings')}>Ayarlar</button>}
            </div>
            <div>
              <span style={{marginRight:12}}>{currentUser.fullName}</span>
              <button className="btn" onClick={logout}>Çıkış</button>
            </div>
          </div>
          <div>
            {route === 'tables' && <TableManagement currentUser={currentUser} />}
            {route === 'products' && <Products currentUser={currentUser} />}
            {route === 'summary' && <DailySummary />}
            {route === 'history' && <BillHistory />}
            {route === 'kitchen' && <Kitchen currentUser={currentUser} />}
            {route === 'qr-orders' && <QROrders currentUser={currentUser} />}
            {route === 'qr-codes' && currentUser.role === 'Admin' && <QRCodes />}
            {route === 'actions' && currentUser.role === 'Admin' && <ActionHistory />}
            {route === 'staff' && currentUser.role === 'Admin' && <StaffTracking />}
            {route === 'reports' && currentUser.role === 'Admin' && <Reports />}
            {route === 'users' && currentUser.role === 'Admin' && <Users currentUser={currentUser} />}
            {route === 'settings' && currentUser.role === 'Admin' && <Settings currentUser={currentUser} onSettingsChange={refreshSettings} />}
          </div>
        </>
      )}
    </div>
  )
}
