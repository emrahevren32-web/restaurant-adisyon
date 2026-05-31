import React from 'react'
import Products from './pages/Products'
import TableManagement from './pages/TableManagement'
import DailySummary from './pages/DailySummary'
import Login from './pages/Login'
import Users from './pages/Users'
import { loadProducts, ensureDefaultAdmin, getCurrentUser, setCurrentUser } from './storage'
import { User } from './types'

export default function App(){
  const [route, setRoute] = React.useState<'tables'|'products'|'summary'|'users'>('tables')
  const [currentUser, setUserState] = React.useState<User | null>(() => getCurrentUser())

  React.useEffect(()=>{ loadProducts(); ensureDefaultAdmin() }, [])

  const onLogin = (u: User) => setUserState(u)
  const logout = () => { setCurrentUser(null); setUserState(null); setRoute('tables') }

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
              {currentUser.role === 'Admin' && <button className="btn" onClick={()=>setRoute('users')}>Kullanıcılar</button>}
            </div>
            <div>
              <span style={{marginRight:12}}>{currentUser.fullName}</span>
              <button className="btn" onClick={logout}>Çıkış</button>
            </div>
          </div>
          <div>
            {route === 'tables' && <TableManagement />}
            {route === 'products' && <Products currentUser={currentUser} />}
            {route === 'summary' && <DailySummary />}
            {route === 'users' && currentUser.role === 'Admin' && <Users />}
          </div>
        </>
      )}
    </div>
  )
}
