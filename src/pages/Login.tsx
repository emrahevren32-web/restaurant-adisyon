import React from 'react'
import { authenticateUser } from '../storage'
import { User } from '../types'

type Props = { onLogin: (u: User) => void }

export default function Login({ onLogin }: Props){
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const u = authenticateUser(username, password)
    if(u) onLogin(u)
    else setError('Geçersiz kullanıcı adı veya şifre ya da kullanıcı pasif.')
  }

  return (
    <div style={{maxWidth:420, margin:'40px auto'}} className="card">
      <h2>Giriş</h2>
      <form onSubmit={submit}>
        <div style={{marginBottom:8}}>
          <input placeholder="Kullanıcı Adı" value={username} onChange={e=>setUsername(e.target.value)} style={{width:'100%', padding:8}} />
        </div>
        <div style={{marginBottom:8}}>
          <input type="password" placeholder="Şifre" value={password} onChange={e=>setPassword(e.target.value)} style={{width:'100%', padding:8}} />
        </div>
        {error && <div style={{color:'red', marginBottom:8}}>{error}</div>}
        <div style={{display:'flex', justifyContent:'space-between'}}>
          <button className="btn" type="submit">Giriş Yap</button>
        </div>
      </form>
    </div>
  )
}
