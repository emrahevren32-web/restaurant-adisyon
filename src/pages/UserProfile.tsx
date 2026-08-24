import React from 'react'
import { addActionLog, loadUsers, saveUsers } from '../storage'
import { getCompanyForUser, loadCompanyBranches, resolveHeadOfficeId } from '../companies/branch-directory.service'
import { isSameIdentifier } from '../core/identifier'
import type { User } from '../types'

type Props = {
  currentUser: User
  onProfileChange?: (user: User) => void
}

/**
 * Profilim — the signed-in person's own account.
 *
 * Deliberately not merged with the company profile: role, company binding and
 * branch access are authorisation facts, granted elsewhere, so they are shown
 * read-only here. A user editing their own role would be a privilege
 * escalation; that stays with Kullanıcılar / Şube Yetkilendirme.
 */

type ProfileFormValues = {
  fullName: string
  username: string
  phone: string
  profilePhotoUrl: string
}

const toFormValues = (user: User): ProfileFormValues => ({
  fullName: user.fullName || '',
  username: user.username || '',
  phone: user.phone || '',
  profilePhotoUrl: user.profilePhotoUrl || ''
})

const getInitials = (name: string) => (
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('') || 'U'
)

export default function UserProfile({ currentUser, onProfileChange }: Props){
  const [values, setValues] = React.useState<ProfileFormValues>(() => toFormValues(currentUser))
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  React.useEffect(() => {
    setValues(toFormValues(currentUser))
    setError('')
    setNotice('')
  }, [currentUser])

  const company = React.useMemo(() => getCompanyForUser(currentUser), [currentUser])
  const branches = React.useMemo(() => loadCompanyBranches(currentUser), [currentUser])
  const headOfficeId = React.useMemo(() => resolveHeadOfficeId(branches, company), [branches, company])
  const accessibleBranches = branches.filter(branch => branch.isActive)

  const updateField = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setValues(previous => ({ ...previous, [key]: value }))
    setNotice('')
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()

    const fullName = values.fullName.trim()
    const username = values.username.trim()

    if(!fullName){
      setError('Ad soyad zorunludur.')
      return
    }
    if(!username){
      setError('Kullanıcı adı zorunludur.')
      return
    }

    const users = loadUsers()
    // Kullanıcı adı bir tanımlayıcıdır; Türkçe yerel ayarıyla küçültülemez.
    // Bkz. core/identifier.ts — 'IBRAHIM' ile 'ibrahim' aksi halde eşleşmez ve
    // aynı adla ikinci bir hesap açılabilirdi.
    const taken = users.some(user => (
      user.id !== currentUser.id && isSameIdentifier(user.username, username)
    ))
    if(taken){
      setError('Bu kullanıcı adı başka bir hesapta kullanılıyor.')
      return
    }

    const index = users.findIndex(user => user.id === currentUser.id)
    if(index < 0){
      setError('Kullanıcı kaydı bulunamadı.')
      return
    }

    // role, companyId and tenantId are intentionally not written from here
    const updated: User = {
      ...users[index],
      fullName,
      username,
      phone: values.phone.trim(),
      profilePhotoUrl: values.profilePhotoUrl.trim()
    }
    users[index] = updated
    saveUsers(users)

    setError('')
    setNotice('Profil bilgileriniz kaydedildi.')
    onProfileChange?.(updated)
    addActionLog({
      operationType: 'Profil güncellendi',
      user: updated,
      description: `${updated.fullName} kendi profil bilgilerini güncelledi.`
    })
  }

  return (
    <div className="user-profile-page">
      <section className="card">
        <div className="user-profile-identity">
          <span className="user-profile-avatar" aria-hidden="true">
            {values.profilePhotoUrl
              ? <img src={values.profilePhotoUrl} alt="" />
              : getInitials(values.fullName || currentUser.username)}
          </span>
          <div>
            <h3>{currentUser.fullName || currentUser.username}</h3>
            <p className="muted">
              {currentUser.role === 'Admin' ? 'Yönetici' : 'Personel'}
              {company?.companyName ? ` · ${company.companyName}` : ''}
            </p>
          </div>
        </div>
      </section>

      {error && <div className="form-error">{error}</div>}
      {notice && !error && <div className="form-success">{notice}</div>}

      <div className="product-layout">
        <section className="product-main card">
          <div className="section-header compact">
            <div>
              <h3>Hesap Bilgileri</h3>
              <p className="muted">Bu bilgiler yalnızca sizin hesabınıza aittir.</p>
            </div>
          </div>

          <form className="form-grid" onSubmit={submit}>
            <div className="form-field">
              <label>Ad Soyad</label>
              <input value={values.fullName} required
                onChange={event => updateField('fullName', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Kullanıcı Adı / E-posta</label>
              <input value={values.username} required
                onChange={event => updateField('username', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Telefon</label>
              <input value={values.phone}
                onChange={event => updateField('phone', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Profil Fotoğrafı (URL)</label>
              <input value={values.profilePhotoUrl} placeholder="https://"
                onChange={event => updateField('profilePhotoUrl', event.target.value)} />
            </div>
            <div className="form-actions form-field-wide">
              <button className="btn primary" type="submit">Kaydet</button>
              <button className="btn" type="button" onClick={() => { setValues(toFormValues(currentUser)); setError(''); setNotice('') }}>
                Geri Al
              </button>
            </div>
          </form>
        </section>

        <aside className="product-side">
          <section className="card">
            <div className="section-header compact">
              <h3>Yetki ve Erişim</h3>
            </div>
            <p className="muted small-text">
              Bu alanlar yetkilendirme tarafından belirlenir ve buradan değiştirilemez.
            </p>

            <div className="user-profile-facts">
              <div>
                <span>Rol</span>
                <strong>{currentUser.role === 'Admin' ? 'Yönetici' : 'Personel'}</strong>
              </div>
              <div>
                <span>Bağlı Firma</span>
                <strong>{company?.companyName || '-'}</strong>
              </div>
              <div>
                <span>Hesap Durumu</span>
                <strong>{currentUser.active ? 'Aktif' : 'Pasif'}</strong>
              </div>
            </div>

            <div className="section-header compact">
              <h3>Erişebildiğiniz Şubeler</h3>
            </div>
            {accessibleBranches.length === 0 ? (
              <p className="muted small-text">Tanımlı aktif şube bulunmuyor.</p>
            ) : (
              <ul className="user-profile-branch-list">
                {accessibleBranches.map(branch => (
                  <li key={branch.id}>
                    <strong>{branch.name}</strong>
                    {branch.id === headOfficeId && <span className="status-pill success">Merkez</span>}
                    <span className="muted small-text">{[branch.city, branch.district].filter(Boolean).join(' / ')}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
