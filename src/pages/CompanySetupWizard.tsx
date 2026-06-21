import React from 'react'
import { Branch, BusinessRegistration, BusinessRegistrationPackage, Company, CompanySetup, User } from '../types'
import {
  completeCompanySetupFromRegistration,
  loadBranches,
  loadBusinessRegistrations,
  loadCompanies,
  loadCompanySetups,
  loadUsers
} from '../storage'

type Props = {
  currentUser: User
  onBranchesChange?: () => void
}

type SetupFilter = 'all' | 'pending' | 'completed'
type PackageFilter = BusinessRegistrationPackage | 'all'

type SetupFormValues = {
  adminFullName: string
  adminEmail: string
  username: string
}

const registrationPackages: BusinessRegistrationPackage[] = ['Başlangıç', 'Pro', 'Premium', 'Kurumsal']

const getDateKey = (value: string | Date) => {
  const date = typeof value === 'string' ? new Date(value) : value
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('sv-SE')
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const slugifyUsername = (value: string) => {
  const normalized = value
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')

  return normalized || 'admin'
}

const createSetupFormValues = (registration: BusinessRegistration | null): SetupFormValues => {
  if(!registration){
    return {
      adminFullName: '',
      adminEmail: '',
      username: ''
    }
  }

  const emailPrefix = registration.email.split('@')[0]

  return {
    adminFullName: registration.ownerName,
    adminEmail: registration.email,
    username: slugifyUsername(emailPrefix || registration.businessName)
  }
}

const sortRegistrations = (items: BusinessRegistration[]) => {
  return [...items].sort((first, second) => {
    const dateDiff = second.createdAt.localeCompare(first.createdAt)
    if(dateDiff !== 0) return dateDiff
    return first.businessName.localeCompare(second.businessName, 'tr-TR')
  })
}

const getSetupStatusText = (setup?: CompanySetup) => setup?.setupCompleted ? 'Tamamlandı' : 'Bekliyor'

const getSetupStatusClass = (setup?: CompanySetup) => setup?.setupCompleted ? 'success' : 'warning-pill'

export default function CompanySetupWizard({ currentUser, onBranchesChange }: Props){
  const [registrations, setRegistrations] = React.useState<BusinessRegistration[]>(() => loadBusinessRegistrations())
  const [companies, setCompanies] = React.useState<Company[]>(() => loadCompanies())
  const [setups, setSetups] = React.useState<CompanySetup[]>(() => loadCompanySetups())
  const [branches, setBranches] = React.useState<Branch[]>(() => loadBranches())
  const [users, setUsers] = React.useState<User[]>(() => loadUsers())
  const [selectedRegistration, setSelectedRegistration] = React.useState<BusinessRegistration | null>(null)
  const [setupFilter, setSetupFilter] = React.useState<SetupFilter>('all')
  const [cityFilter, setCityFilter] = React.useState('all')
  const [packageFilter, setPackageFilter] = React.useState<PackageFilter>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [formValues, setFormValues] = React.useState<SetupFormValues>(() => createSetupFormValues(null))
  const [setupMessage, setSetupMessage] = React.useState('')
  const [setupError, setSetupError] = React.useState('')

  const refreshData = React.useCallback(() => {
    setRegistrations(loadBusinessRegistrations())
    setCompanies(loadCompanies())
    setSetups(loadCompanySetups())
    setBranches(loadBranches())
    setUsers(loadUsers())
    onBranchesChange?.()
  }, [onBranchesChange])

  const approvedRegistrations = React.useMemo(() => {
    return registrations.filter(registration => registration.status === 'Onaylandı')
  }, [registrations])

  const setupMap = React.useMemo(() => new Map(setups.map(setup => [setup.registrationId, setup])), [setups])
  const companyMap = React.useMemo(() => new Map(companies.map(company => [company.id, company])), [companies])
  const branchMap = React.useMemo(() => new Map(branches.map(branch => [branch.id, branch])), [branches])
  const userMap = React.useMemo(() => new Map(users.map(user => [user.id, user])), [users])

  const cityOptions = React.useMemo(() => {
    return Array.from(new Set(approvedRegistrations.map(registration => registration.city).filter(Boolean)))
      .sort((first, second) => first.localeCompare(second, 'tr-TR'))
  }, [approvedRegistrations])

  const visibleRegistrations = React.useMemo(() => {
    return sortRegistrations(approvedRegistrations).filter(registration => {
      const setup = setupMap.get(registration.id)
      const dateKey = getDateKey(registration.createdAt)
      const setupCompleted = setup?.setupCompleted === true
      const matchesSetup = setupFilter === 'all'
        || (setupFilter === 'pending' && !setupCompleted)
        || (setupFilter === 'completed' && setupCompleted)
      const matchesCity = cityFilter === 'all' || registration.city === cityFilter
      const matchesPackage = packageFilter === 'all' || registration.requestedPackage === packageFilter
      const matchesStart = !startDate || dateKey >= startDate
      const matchesEnd = !endDate || dateKey <= endDate

      return matchesSetup && matchesCity && matchesPackage && matchesStart && matchesEnd
    })
  }, [approvedRegistrations, cityFilter, endDate, packageFilter, setupFilter, setupMap, startDate])

  React.useEffect(() => {
    if(selectedRegistration && approvedRegistrations.some(registration => registration.id === selectedRegistration.id)) return
    const firstRegistration = visibleRegistrations[0] || approvedRegistrations[0] || null
    setSelectedRegistration(firstRegistration)
    setFormValues(createSetupFormValues(firstRegistration))
  }, [approvedRegistrations, selectedRegistration, visibleRegistrations])

  const selectedSetup = selectedRegistration ? setupMap.get(selectedRegistration.id) : undefined
  const selectedCompany = selectedSetup ? companyMap.get(selectedSetup.companyId) : undefined
  const selectedBranch = selectedSetup ? branchMap.get(selectedSetup.branchId) : undefined
  const selectedAdminUser = selectedSetup ? userMap.get(selectedSetup.adminUserId) : undefined

  const completedSetupCount = approvedRegistrations.filter(registration => setupMap.get(registration.id)?.setupCompleted).length
  const pendingSetupCount = approvedRegistrations.length - completedSetupCount
  const activeCompanyCount = companies.filter(company => company.status === 'Aktif').length

  const startSetup = (registration: BusinessRegistration) => {
    setSelectedRegistration(registration)
    setFormValues(createSetupFormValues(registration))
    setSetupMessage(`${registration.businessName} kurulumu başlatıldı. Admin bilgilerini kontrol edin.`)
    setSetupError('')
  }

  const viewSetup = (registration: BusinessRegistration) => {
    setSelectedRegistration(registration)
    setFormValues(createSetupFormValues(registration))
    setSetupMessage('')
    setSetupError('')
  }

  const completeSetup = (registration: BusinessRegistration, values = formValues) => {
    setSelectedRegistration(registration)
    const normalizedValues = {
      adminFullName: values.adminFullName.trim() || registration.ownerName,
      adminEmail: values.adminEmail.trim() || registration.email,
      username: values.username.trim() || slugifyUsername(registration.email.split('@')[0] || registration.businessName)
    }

    try {
      const result = completeCompanySetupFromRegistration({
        registrationId: registration.id,
        adminFullName: normalizedValues.adminFullName,
        adminEmail: normalizedValues.adminEmail,
        username: normalizedValues.username,
        user: currentUser
      })

      refreshData()
      setSelectedRegistration(registration)
      setFormValues({
        adminFullName: result.adminUser.fullName,
        adminEmail: normalizedValues.adminEmail,
        username: result.adminUser.username
      })
      setSetupMessage(`${registration.businessName} kurulumu tamamlandı. Geçici şifre: ${result.setup.temporaryPassword}`)
      setSetupError('')
    } catch(error){
      setSetupError(error instanceof Error ? error.message : 'Kurulum tamamlanamadı.')
      setSetupMessage('')
    }
  }

  const updateFormField = <K extends keyof SetupFormValues>(key: K, value: SetupFormValues[K]) => {
    setFormValues(prev => ({ ...prev, [key]: value }))
  }

  const stepCards = [
    {
      title: 'Adım 1',
      label: 'Firma Oluştur',
      done: Boolean(selectedCompany),
      detail: selectedCompany?.id || selectedRegistration?.businessName || '-'
    },
    {
      title: 'Adım 2',
      label: 'İlk Şube Oluştur',
      done: Boolean(selectedBranch),
      detail: selectedBranch ? `${selectedBranch.name} / ${selectedBranch.code}` : 'Varsayılan: Merkez Şube'
    },
    {
      title: 'Adım 3',
      label: 'Admin Kullanıcı Oluştur',
      done: Boolean(selectedAdminUser),
      detail: selectedAdminUser?.username || formValues.username || '-'
    },
    {
      title: 'Adım 4',
      label: 'Geçici Şifre Üret',
      done: Boolean(selectedSetup?.temporaryPassword),
      detail: selectedSetup?.temporaryPassword || 'MIYOP-####'
    },
    {
      title: 'Adım 5',
      label: 'Kurulumu Tamamla',
      done: selectedSetup?.setupCompleted === true,
      detail: selectedSetup?.completedAt ? formatDateTime(selectedSetup.completedAt) : 'Bekliyor'
    }
  ]

  return (
    <div className="company-setup-page">
      <div className="page-title">
        <div>
          <h2>Firma Oluşturma Sihirbazı</h2>
          <p className="muted">Onaylanan işletmeleri sistemde çalışan firmalara dönüştürün.</p>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span>Toplam Firma</span>
          <strong>{formatNumber(companies.length)}</strong>
        </div>
        <div className="metric-card">
          <span>Aktif Firma</span>
          <strong>{formatNumber(activeCompanyCount)}</strong>
        </div>
        <div className="metric-card">
          <span>Kurulumu Tamamlanan</span>
          <strong>{formatNumber(completedSetupCount)}</strong>
        </div>
        <div className="metric-card">
          <span>Kurulum Bekleyen</span>
          <strong>{formatNumber(pendingSetupCount)}</strong>
        </div>
      </div>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Kurulum Listesi</h3>
            <p className="muted">{formatNumber(visibleRegistrations.length)} onaylı başvuru gösteriliyor.</p>
          </div>
          <div className="toolbar-controls company-setup-filters">
            <select value={setupFilter} onChange={event => setSetupFilter(event.target.value as SetupFilter)}>
              <option value="all">Tüm kurulumlar</option>
              <option value="pending">Kurulum Bekleyen</option>
              <option value="completed">Kurulumu Tamamlanan</option>
            </select>
            <select value={cityFilter} onChange={event => setCityFilter(event.target.value)}>
              <option value="all">Tüm şehirler</option>
              {cityOptions.map(city => <option key={city} value={city}>{city}</option>)}
            </select>
            <select value={packageFilter} onChange={event => setPackageFilter(event.target.value as PackageFilter)}>
              <option value="all">Tüm paketler</option>
              {registrationPackages.map(packageName => <option key={packageName} value={packageName}>{packageName}</option>)}
            </select>
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table company-setup-table">
            <thead>
              <tr>
                <th>İşletme</th>
                <th>Yetkili</th>
                <th>Paket</th>
                <th>Başvuru Tarihi</th>
                <th>Durum</th>
                <th>Kurulum Durumu</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {visibleRegistrations.length === 0 && (
                <tr><td colSpan={7} className="empty-cell">Kurulum için uygun onaylı başvuru bulunamadı.</td></tr>
              )}
              {visibleRegistrations.map(registration => {
                const setup = setupMap.get(registration.id)
                const isCompleted = setup?.setupCompleted === true
                const rowSelected = selectedRegistration?.id === registration.id

                return (
                  <tr key={registration.id} className={rowSelected ? 'selected-row' : ''}>
                    <td>
                      <strong>{registration.businessName}</strong>
                      <div className="muted small-text">{registration.city} / {registration.district || '-'}</div>
                    </td>
                    <td>
                      <strong>{registration.ownerName}</strong>
                      <div className="muted small-text">{registration.email}</div>
                    </td>
                    <td><span className="status-pill info-pill">{registration.requestedPackage}</span></td>
                    <td>{formatDateTime(registration.createdAt)}</td>
                    <td><span className="status-pill success">Onaylandı</span></td>
                    <td><span className={`status-pill ${getSetupStatusClass(setup)}`}>{getSetupStatusText(setup)}</span></td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => viewSetup(registration)}>Detay</button>
                      {!isCompleted && <button className="btn" type="button" onClick={() => startSetup(registration)}>Kurulumu Başlat</button>}
                      {isCompleted && <button className="btn" type="button" onClick={() => viewSetup(registration)}>Kurulumu Görüntüle</button>}
                      {!isCompleted && (
                        <button className="btn primary" type="button" onClick={() => completeSetup(registration, rowSelected ? formValues : createSetupFormValues(registration))}>
                          Kurulumu Tamamla
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="company-setup-detail-grid">
        <section className="card company-setup-panel">
          <div className="section-header compact">
            <div>
              <h3>Kurulum Adımları</h3>
              <p className="muted">{selectedRegistration ? selectedRegistration.businessName : 'Onaylı başvuru seçin.'}</p>
            </div>
            {selectedSetup && <span className={`status-pill ${getSetupStatusClass(selectedSetup)}`}>{getSetupStatusText(selectedSetup)}</span>}
          </div>

          {setupMessage && <div className="form-success">{setupMessage}</div>}
          {setupError && <div className="form-error">{setupError}</div>}

          <div className="company-setup-step-grid">
            {stepCards.map(step => (
              <div key={step.title}>
                <span>{step.title}</span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
                <em className={`status-pill ${step.done ? 'success' : 'warning-pill'}`}>{step.done ? 'Tamam' : 'Bekliyor'}</em>
              </div>
            ))}
          </div>

          <form className="stacked-form company-setup-form" onSubmit={event => {
            event.preventDefault()
            if(selectedRegistration) completeSetup(selectedRegistration)
          }}>
            <div className="section-header compact">
              <h3>Admin Kullanıcı Oluştur</h3>
            </div>
            <div className="form-field">
              <label>Ad Soyad</label>
              <input
                value={formValues.adminFullName}
                onChange={event => updateFormField('adminFullName', event.target.value)}
                disabled={selectedSetup?.setupCompleted === true}
                required
              />
            </div>
            <div className="form-field">
              <label>E-posta</label>
              <input
                type="email"
                value={formValues.adminEmail}
                onChange={event => updateFormField('adminEmail', event.target.value)}
                disabled={selectedSetup?.setupCompleted === true}
                required
              />
            </div>
            <div className="form-field">
              <label>Kullanıcı Adı</label>
              <input
                value={formValues.username}
                onChange={event => updateFormField('username', event.target.value)}
                disabled={selectedSetup?.setupCompleted === true}
                required
              />
            </div>
            <div className="company-setup-password-preview">
              <span>Geçici Şifre Üret</span>
              <strong>{selectedSetup?.temporaryPassword || 'MIYOP-####'}</strong>
              <small>Kurulum tamamlanırken otomatik oluşturulur.</small>
            </div>
            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={!selectedRegistration || selectedSetup?.setupCompleted === true}>
                Kurulumu Tamamla
              </button>
            </div>
          </form>
        </section>

        <section className="card company-setup-result-card">
          <div className="section-header compact">
            <div>
              <h3>Kurulum Sonucu</h3>
              <p className="muted">{selectedSetup?.setupCompleted ? 'Tamamlanan kurulum bilgileri.' : 'Kurulum tamamlanınca sonuçlar burada görünür.'}</p>
            </div>
          </div>
          {selectedSetup?.setupCompleted ? (
            <div className="financial-summary-values company-setup-result-values">
              <div>
                <span>Firma ID</span>
                <strong>{selectedSetup.companyId}</strong>
              </div>
              <div>
                <span>Firma</span>
                <strong>{selectedCompany?.companyName || '-'}</strong>
              </div>
              <div>
                <span>Şube ID</span>
                <strong>{selectedSetup.branchId}</strong>
              </div>
              <div>
                <span>İlk Şube</span>
                <strong>{selectedBranch ? `${selectedBranch.name} / ${selectedBranch.code}` : '-'}</strong>
              </div>
              <div>
                <span>Admin Kullanıcı</span>
                <strong>{selectedAdminUser?.username || selectedSetup.adminUserId}</strong>
              </div>
              <div>
                <span>Geçici Şifre</span>
                <strong>{selectedSetup.temporaryPassword}</strong>
              </div>
              <div>
                <span>Kurulum Tarihi</span>
                <strong>{formatDateTime(selectedSetup.completedAt)}</strong>
              </div>
            </div>
          ) : (
            <p className="muted">Firma, merkez şube, admin kullanıcı ve geçici şifre üretimi için kurulum adımlarını tamamlayın.</p>
          )}
        </section>
      </div>
    </div>
  )
}
