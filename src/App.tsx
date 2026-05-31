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
import Login from './pages/Login'
import Users from './pages/Users'
import { loadProducts, ensureDefaultAdmin, getCurrentUser, setCurrentUser } from './storage'
import { User } from './types'

export default function App(){
  const qrRouteMatch = window.location.pathname.match(/^\/qr\/([^/?#]+)/)
  const [route, setRoute] = React.useState<'tables'|'products'|'summary'|'history'|'kitchen'|'qr-orders'|'actions'|'staff'|'reports'|'users'>('tables')
  const [currentUser, setUserState] = React.useState<User | null>(() => getCurrentUser())

  React.useEffect(()=>{ loadProducts(); ensureDefaultAdmin() }, [])

  const onLogin = (u: User) => setUserState(u)
  const logout = () => { setCurrentUser(null); setUserState(null); setRoute('tables') }

  if(qrRouteMatch){
    return <QRMenu slug={qrRouteMatch[1]} />
  }

  return (
    <div>
      <h1>Restaurant Adisyon</h1>
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
              <button className="btn" onClick={()=>setRoute('qr-orders')}>QR Siparişler</button>
              {currentUser.role === 'Admin' && <button className="btn" onClick={()=>setRoute('reports')}>Raporlama</button>}
              {currentUser.role === 'Admin' && <button className="btn" onClick={()=>setRoute('staff')}>Personel Takibi</button>}
              {currentUser.role === 'Admin' && <button className="btn" onClick={()=>setRoute('actions')}>İşlem Geçmişi</button>}
              {currentUser.role === 'Admin' && <button className="btn" onClick={()=>setRoute('users')}>Kullanıcılar</button>}
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
            {route === 'actions' && currentUser.role === 'Admin' && <ActionHistory />}
            {route === 'staff' && currentUser.role === 'Admin' && <StaffTracking />}
            {route === 'reports' && currentUser.role === 'Admin' && <Reports />}
            {route === 'users' && currentUser.role === 'Admin' && <Users currentUser={currentUser} />}
          </div>
        </>
      )}
    </div>
  )
}
