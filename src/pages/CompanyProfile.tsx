import React from 'react'
import { addActionLog, getCompanyIdForUser, loadCompanies } from '../storage'
import {
  getCompanyForUser,
  loadCompanyBranches,
  resolveHeadOfficeId,
  saveCompanyProfile
} from '../companies/branch-directory.service'
import type { Company, User } from '../types'

type Props = {
  currentUser: User
  onCompanyChange?: (company: Company) => void
}

/**
 * Corporate profile — tenant/company level, deliberately separate from both
 * branch records and the signed-in user's own account. A company has one of
 * these; branches have addresses of their own and never carry tax identity.
 */

type ProfileFormValues = {
  companyName: string
  shortName: string
  legalName: string
  taxOffice: string
  taxNumber: string
  phone: string
  email: string
  website: string
  address: string
  city: string
  district: string
  postalCode: string
  logoUrl: string
  authorizedPerson: string
  authorizedTitle: string
  authorizedPhone: string
  authorizedEmail: string
}

const toFormValues = (company: Company | undefined): ProfileFormValues => ({
  companyName: company?.companyName || '',
  shortName: company?.shortName || '',
  legalName: company?.legalName || '',
  taxOffice: company?.taxOffice || '',
  taxNumber: company?.taxNumber || '',
  phone: company?.phone || '',
  email: company?.email || '',
  website: company?.website || '',
  address: company?.address || '',
  city: company?.city || '',
  district: company?.district || '',
  postalCode: company?.postalCode || '',
  logoUrl: company?.logoUrl || '',
  authorizedPerson: company?.authorizedPerson || company?.ownerName || '',
  authorizedTitle: company?.authorizedTitle || '',
  authorizedPhone: company?.authorizedPhone || '',
  authorizedEmail: company?.authorizedEmail || ''
})

const trimAll = (values: ProfileFormValues): ProfileFormValues => (
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, String(value).trim()])
  ) as ProfileFormValues
)

export default function CompanyProfile({ currentUser, onCompanyChange }: Props){
  const canManage = currentUser.role === 'Admin'
  const [company, setCompany] = React.useState<Company | undefined>(() => getCompanyForUser(currentUser))
  const [values, setValues] = React.useState<ProfileFormValues>(() => toFormValues(getCompanyForUser(currentUser)))
  const [error, setError] = React.useState('')
  const [notice, setNotice] = React.useState('')

  React.useEffect(() => {
    const next = getCompanyForUser(currentUser)
    setCompany(next)
    setValues(toFormValues(next))
    setError('')
    setNotice('')
  }, [currentUser])

  const branches = React.useMemo(() => loadCompanyBranches(currentUser), [currentUser, company])
  const headOfficeId = React.useMemo(() => resolveHeadOfficeId(branches, company), [branches, company])
  const headOffice = branches.find(branch => branch.id === headOfficeId)
  const activeBranchCount = branches.filter(branch => branch.isActive).length

  const updateField = <K extends keyof ProfileFormValues>(key: K, value: ProfileFormValues[K]) => {
    setValues(previous => ({ ...previous, [key]: value }))
    setNotice('')
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if(!canManage) return

    const normalized = trimAll(values)

    if(!normalized.companyName){
      setError('Firma adı zorunludur.')
      return
    }

    const companyId = company?.id || getCompanyIdForUser(currentUser)
    if(!companyId){
      setError('Bu kullanıcı bir firmaya bağlı değil. Firma profili güncellenemiyor.')
      return
    }

    const updated = saveCompanyProfile(companyId, normalized)
    if(!updated){
      setError('Firma kaydı bulunamadı.')
      return
    }

    setCompany(updated)
    setValues(toFormValues(updated))
    setError('')
    setNotice('Firma bilgileri kaydedildi.')
    onCompanyChange?.(updated)
    addActionLog({
      operationType: 'Firma profili güncellendi',
      user: currentUser,
      description: `${updated.companyName} firma bilgileri güncellendi.`
    })
  }

  if(!company && loadCompanies().length === 0){
    return (
      <div className="company-profile-page">
        <section className="card">
          <h3>Şirket Profili</h3>
          <p className="muted">Bu workspace'e bağlı bir firma kaydı bulunamadı.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="company-profile-page">
      <div className="metric-grid">
        <div className="metric-card">
          <span>Firma</span>
          <strong>{company?.companyName || '-'}</strong>
        </div>
        <div className="metric-card">
          <span>Merkez Şube</span>
          <strong>{headOffice?.name || '-'}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Şube</span>
          <strong>{activeBranchCount}</strong>
        </div>
        <div className="metric-card">
          <span>Vergi No</span>
          <strong>{company?.taxNumber || '-'}</strong>
        </div>
      </div>

      {!canManage && (
        <div className="form-error">
          Firma bilgilerini yalnızca yönetici rolündeki kullanıcılar güncelleyebilir.
        </div>
      )}
      {error && <div className="form-error">{error}</div>}
      {notice && !error && <div className="form-success">{notice}</div>}

      <form className="company-profile-form" onSubmit={submit}>
        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>Firma Bilgileri</h3>
              <p className="muted">Kurumsal kimlik bilgileri firma seviyesinde tutulur, şubeye bağlı değildir.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Firma / Ticari Unvan</label>
              <input value={values.companyName} disabled={!canManage} required
                onChange={event => updateField('companyName', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Kısa Firma Adı</label>
              <input value={values.shortName} disabled={!canManage}
                onChange={event => updateField('shortName', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Yasal Unvan</label>
              <input value={values.legalName} disabled={!canManage}
                onChange={event => updateField('legalName', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Vergi Dairesi</label>
              <input value={values.taxOffice} disabled={!canManage}
                onChange={event => updateField('taxOffice', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Vergi Numarası</label>
              <input value={values.taxNumber} disabled={!canManage} inputMode="numeric"
                onChange={event => updateField('taxNumber', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Telefon</label>
              <input value={values.phone} disabled={!canManage}
                onChange={event => updateField('phone', event.target.value)} />
            </div>
            <div className="form-field">
              <label>E-posta</label>
              <input type="email" value={values.email} disabled={!canManage}
                onChange={event => updateField('email', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Web Sitesi</label>
              <input value={values.website} disabled={!canManage} placeholder="https://"
                onChange={event => updateField('website', event.target.value)} />
            </div>
            <div className="form-field">
              <label>İl</label>
              <input value={values.city} disabled={!canManage}
                onChange={event => updateField('city', event.target.value)} />
            </div>
            <div className="form-field">
              <label>İlçe</label>
              <input value={values.district} disabled={!canManage}
                onChange={event => updateField('district', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Posta Kodu</label>
              <input value={values.postalCode} disabled={!canManage} inputMode="numeric"
                onChange={event => updateField('postalCode', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Firma Logosu (URL)</label>
              <input value={values.logoUrl} disabled={!canManage} placeholder="https://"
                onChange={event => updateField('logoUrl', event.target.value)} />
            </div>
            <div className="form-field form-field-wide">
              <label>Adres</label>
              <textarea rows={2} value={values.address} disabled={!canManage}
                onChange={event => updateField('address', event.target.value)} />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>Yetkili Bilgileri</h3>
              <p className="muted">Firma adına iletişim kurulacak kişi.</p>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label>Ad Soyad</label>
              <input value={values.authorizedPerson} disabled={!canManage}
                onChange={event => updateField('authorizedPerson', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Görevi / Ünvanı</label>
              <input value={values.authorizedTitle} disabled={!canManage}
                onChange={event => updateField('authorizedTitle', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Telefon</label>
              <input value={values.authorizedPhone} disabled={!canManage}
                onChange={event => updateField('authorizedPhone', event.target.value)} />
            </div>
            <div className="form-field">
              <label>E-posta</label>
              <input type="email" value={values.authorizedEmail} disabled={!canManage}
                onChange={event => updateField('authorizedEmail', event.target.value)} />
            </div>
          </div>

          {canManage && (
            <div className="form-actions">
              <button className="btn primary" type="submit">Kaydet</button>
              <button className="btn" type="button" onClick={() => { setValues(toFormValues(company)); setError(''); setNotice('') }}>
                Değişiklikleri Geri Al
              </button>
            </div>
          )}
        </section>
      </form>
    </div>
  )
}
