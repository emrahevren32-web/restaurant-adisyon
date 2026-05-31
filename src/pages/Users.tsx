import React from 'react'
import { User, Role } from '../types'
import { addActionLog, loadUsers, saveUsers } from '../storage'

type Props = { currentUser: User }

export default function Users({ currentUser }: Props){
  const [users, setUsers] = React.useState<User[]>(() => loadUsers())
  const [editing, setEditing] = React.useState<User | null>(null)

  React.useEffect(()=> saveUsers(users), [users])

  const startAdd = () => setEditing({ id: Date.now().toString(), fullName:'', username:'', password:'', role:'Garson', active:true })
  const save = (u: User) => {
    const existingUser = users.find(x=>x.id===u.id)
    if(existingUser){
      setUsers(prev => prev.map(x=> x.id===u.id ? u : x))
      addActionLog({
        operationType: 'Kullanıcı güncellendi',
        user: currentUser,
        description: `${existingUser.fullName || existingUser.username} kullanıcısı güncellendi.`
      })
    } else {
      setUsers(prev => [u, ...prev])
      addActionLog({
        operationType: 'Kullanıcı oluşturuldu',
        user: currentUser,
        description: `${u.fullName || u.username} kullanıcısı oluşturuldu.`
      })
    }
    setEditing(null)
  }

  const remove = (id: string) => {
    if(!confirm('Kullanıcı silinecek. Emin misiniz?')) return
    setUsers(prev => prev.filter(u=>u.id!==id))
  }

  const toggleActive = (id: string) => {
    const user = users.find(item => item.id === id)
    setUsers(prev => prev.map(u=> u.id===id ? {...u, active: !u.active} : u))
    if(user){
      addActionLog({
        operationType: user.active ? 'Kullanıcı pasif yapıldı' : 'Kullanıcı aktif yapıldı',
        user: currentUser,
        description: `${user.fullName || user.username} kullanıcısı ${user.active ? 'pasif' : 'aktif'} yapıldı.`
      })
    }
  }

  return (
    <div>
      <h2>Kullanıcı Yönetimi</h2>
      <div style={{display:'flex', gap:16}}>
        <div style={{flex:1}}>
          <div className="card">
            <button className="btn" onClick={startAdd}>Yeni Kullanıcı Ekle</button>
            <table style={{marginTop:8}}>
              <thead><tr><th>Ad Soyad</th><th>Kullanıcı Adı</th><th>Rol</th><th>Aktif</th><th></th></tr></thead>
              <tbody>
                {users.map(u=> (
                  <tr key={u.id}>
                    <td>{u.fullName}</td>
                    <td>{u.username}</td>
                    <td>{u.role}</td>
                    <td>{u.active ? 'Evet' : 'Hayır'}</td>
                    <td>
                      <button className="btn" onClick={()=>setEditing(u)}>Düzenle</button>
                      <button className="btn" onClick={()=>toggleActive(u.id)}>{u.active ? 'Pasif Yap' : 'Aktif Yap'}</button>
                      <button className="btn" onClick={()=>remove(u.id)}>Sil</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{width:360}}>
          {editing && (
            <div className="card">
              <h3>{users.find(x=>x.id===editing.id) ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı'}</h3>
              <UserForm user={editing} onCancel={()=>setEditing(null)} onSave={save} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function UserForm({ user, onSave, onCancel }: { user: User, onSave: (u: User)=>void, onCancel: ()=>void }){
  const [u, setU] = React.useState<User>(user)
  const roles: Role[] = ['Admin','Garson']

  React.useEffect(()=> setU(user), [user])

  return (
    <form onSubmit={(e)=>{e.preventDefault(); onSave(u)}}>
      <div>
        <label>Ad Soyad</label>
        <input value={u.fullName} onChange={e=>setU({...u, fullName: e.target.value})} style={{width:'100%'}} />
      </div>
      <div>
        <label>Kullanıcı Adı</label>
        <input value={u.username} onChange={e=>setU({...u, username: e.target.value})} style={{width:'100%'}} />
      </div>
      <div>
        <label>Şifre</label>
        <input value={u.password} onChange={e=>setU({...u, password: e.target.value})} style={{width:'100%'}} />
      </div>
      <div>
        <label>Rol</label>
        <select value={u.role} onChange={e=>setU({...u, role: e.target.value as Role})}>
          {roles.map(r=> <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label>
          <input type="checkbox" checked={u.active} onChange={e=>setU({...u, active: e.target.checked})} /> Aktif
        </label>
      </div>
      <div style={{marginTop:8, display:'flex', gap:8}}>
        <button className="btn" type="submit">Kaydet</button>
        <button className="btn" type="button" onClick={onCancel}>İptal</button>
      </div>
    </form>
  )
}
