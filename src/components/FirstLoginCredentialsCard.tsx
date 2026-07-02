import React from 'react'
import type { FirstLoginCredentialDelivery } from '../storage'

type Props = {
  credentials: FirstLoginCredentialDelivery
}

type CopyField = 'username' | 'temporaryPassword'

const copyText = async (value: string) => {
  if(navigator.clipboard?.writeText){
    await navigator.clipboard.writeText(value)
    return
  }

  const input = document.createElement('textarea')
  input.value = value
  input.setAttribute('readonly', 'true')
  input.style.position = 'fixed'
  input.style.opacity = '0'
  document.body.appendChild(input)
  input.select()
  document.execCommand('copy')
  document.body.removeChild(input)
}

export default function FirstLoginCredentialsCard({ credentials }: Props){
  const [copiedField, setCopiedField] = React.useState<CopyField | ''>('')

  const copyCredential = async (field: CopyField, value: string) => {
    await copyText(value)
    setCopiedField(field)
    window.setTimeout(() => {
      setCopiedField(current => current === field ? '' : current)
    }, 1800)
  }

  return (
    <section className="first-login-credential-card" aria-label="İlk giriş bilgileri">
      <div className="first-login-credential-copy">
        <span className="status-pill success">İlk Giriş Bilgileri</span>
        <h3>İlk Giriş Bilgileri</h3>
        <p>İşletme başarıyla oluşturuldu.</p>
        <small>Bu bilgiler ileride otomatik olarak e-posta ile gönderilecektir.</small>
      </div>
      <div className="first-login-credential-grid">
        <div className="first-login-credential-field">
          <span>Kullanıcı Adı</span>
          <strong>{credentials.username}</strong>
          <button className="btn" type="button" onClick={() => copyCredential('username', credentials.username)}>
            {copiedField === 'username' ? 'Kopyalandı' : 'Kopyala'}
          </button>
        </div>
        <div className="first-login-credential-field">
          <span>Geçici Şifre</span>
          <strong>{credentials.temporaryPassword}</strong>
          <button className="btn" type="button" onClick={() => copyCredential('temporaryPassword', credentials.temporaryPassword)}>
            {copiedField === 'temporaryPassword' ? 'Kopyalandı' : 'Kopyala'}
          </button>
        </div>
      </div>
    </section>
  )
}
