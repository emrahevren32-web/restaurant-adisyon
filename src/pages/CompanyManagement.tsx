import React from 'react'
import {
  LICENSE_MODULE_CATALOG,
  loadBranchPermissions,
  loadBranches,
  loadCompanies,
  loadCompanyLicenses,
  loadCompanyUsers,
  loadLicenseModules,
  loadLicensePackages,
  loadTenants,
  loadUsers
} from '../storage'
import {
  Branch,
  BranchPermission,
  Company,
  CompanyLicense,
  CompanyUser,
  LicenseModule,
  LicenseModuleKey,
  Tenant
} from '../types'

type CompanyRuntimeStatus = 'Aktif' | 'Askıda' | 'Pasif' | 'Deneme'

type ManagedModule = {
  key: LicenseModuleKey
  label: string
  active: boolean
}

const managementModuleKeys: Array<{ key: LicenseModuleKey; label: string }> = [
  { key: 'adisyon', label: 'Adisyon' },
  { key: 'qr-menu', label: 'QR Menü' },
  { key: 'stock', label: 'Stok' },
  { key: 'current', label: 'Cari' },
  { key: 'finance', label: 'Finans' },
  { key: 'personnel', label: 'Personel' }
]

const quickActions = [
  'Lisans Uzat',
  'Modül Ekle',
  'Modül Kaldır',
  'Kullanıcı Oluştur',
  'Şube Oluştur',
  'İşletmeyi Askıya Al'
]

const normalizeLookup = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/Ä±/g, 'i')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, '')

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('tr-TR')
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return formatDate(value)
  return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}

const getStatusClassName = (status: string) => {
  const normalized = normalizeLookup(status)
  if(normalized.includes('aktif')) return 'success'
  if(normalized.includes('deneme')) return 'info-pill'
  if(normalized.includes('ask') || normalized.includes('yaklasiyor')) return 'warning-pill'
  if(normalized.includes('doldu') || normalized.includes('iptal')) return 'danger-pill'
  return 'muted-pill'
}

const getLatestLicenseForCompany = (licenses: CompanyLicense[], companyId: string) => {
  return licenses
    .filter(license => license.companyId === companyId && !normalizeLookup(license.status).includes('iptal'))
    .sort((first, second) => {
      const firstDate = first.updatedAt || first.createdAt || first.startDate
      const secondDate = second.updatedAt || second.createdAt || second.startDate
      return secondDate.localeCompare(firstDate)
    })[0]
}

const getCompanyRuntimeStatus = (company: Company, license?: CompanyLicense): CompanyRuntimeStatus => {
  const companyStatus = normalizeLookup(company.status)
  const licenseStatus = normalizeLookup(license?.status || '')

  if(!company.isApproved || companyStatus.includes('basvurubekliyor')) return 'Pasif'
  if(companyStatus.startsWith('ask')) return 'Askıda'
  if(companyStatus.includes('pasif') || companyStatus.includes('silindi') || companyStatus.includes('arsiv')) return 'Pasif'
  if(license?.isTrial || licenseStatus.includes('deneme')) return 'Deneme'
  return 'Aktif'
}

const getRemainingDays = (license?: CompanyLicense) => {
  if(!license) return '-'
  const targetValue = license.isTrial ? license.trialEndDate || license.endDate : license.endDate
  if(!targetValue) return '-'
  const targetDate = new Date(`${targetValue}T12:00:00`)
  if(Number.isNaN(targetDate.getTime())) return '-'
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const days = Math.ceil((targetDate.getTime() - today.getTime()) / 86400000)
  if(days < 0) return 'Süresi doldu'
  if(days === 0) return 'Bugün'
  return `${formatNumber(days)} gün`
}

const getBranchUserCount = (
  branch: Branch,
  branchIndex: number,
  companyUsers: CompanyUser[],
  permissions: BranchPermission[],
  appUserIds: Set<string>
) => {
  const permittedUsers = new Set(
    permissions
      .filter(permission => permission.branchId === branch.id && permission.canView && appUserIds.has(permission.userId))
      .map(permission => permission.userId)
  )

  if(permittedUsers.size > 0) return permittedUsers.size
  return branchIndex === 0 ? companyUsers.length : 0
}

const getManagedModules = (
  license: CompanyLicense | undefined,
  licenseModules: LicenseModule[]
): ManagedModule[] => {
  const licenseActive = Boolean(license) && !['iptal', 'doldu', 'askiyaalindi'].some(keyword => normalizeLookup(license?.status || '').includes(keyword))
  return managementModuleKeys.map(module => {
    const catalogName = LICENSE_MODULE_CATALOG.find(item => item.key === module.key)?.name || module.label
    const enabled = module.key === 'adisyon'
      ? licenseActive
      : licenseActive && licenseModules.some(item => item.packageId === license?.packageId && item.moduleKey === module.key && item.enabled)

    return {
      ...module,
      label: module.label || catalogName,
      active: enabled
    }
  })
}

export default function CompanyManagement(){
  const data = React.useMemo(() => {
    const companies = loadCompanies().filter(company => company.status !== 'Silindi')
    return {
      companies,
      tenants: loadTenants(),
      branches: loadBranches(),
      branchPermissions: loadBranchPermissions(),
      appUsers: loadUsers({ allTenants: true }),
      companyUsers: loadCompanyUsers(),
      licenses: loadCompanyLicenses(),
      packages: loadLicensePackages(),
      licenseModules: loadLicenseModules()
    }
  }, [])

  const [selectedCompanyId, setSelectedCompanyId] = React.useState(data.companies[0]?.id || '')
  const [message, setMessage] = React.useState('')

  const company = data.companies.find(item => item.id === selectedCompanyId) || data.companies[0]

  const triggerPlaceholder = (label: string) => {
    setMessage(`${label} işlemi sonraki faz için placeholder olarak hazırlandı.`)
  }

  if(!company){
    return (
      <section className="evren360-panel company-management-page">
        <div className="evren360-panel-header">
          <div>
            <h3>İşletme Yönetimi</h3>
            <p>Yönetilecek işletme kaydı bulunamadı.</p>
          </div>
        </div>
      </section>
    )
  }

  const tenant = data.tenants.find(item => item.companyId === company.id || item.id === company.tenantId)
  const license = getLatestLicenseForCompany(data.licenses, company.id)
  const packageItem = license ? data.packages.find(item => item.id === license.packageId) : undefined
  const status = getCompanyRuntimeStatus(company, license)
  const companyBranches = data.branches.filter(branch => branch.companyId === company.id)
  const companyUsers = data.companyUsers
    .filter(user => user.companyId === company.id && user.status !== 'Silindi')
    .sort((first, second) => first.fullName.localeCompare(second.fullName, 'tr-TR'))
  const appUserIds = new Set(data.appUsers.filter(user => user.companyId === company.id).map(user => user.id))
  const managedModules = getManagedModules(license, data.licenseModules)
  const activeModuleCount = managedModules.filter(module => module.active).length

  return (
    <div className="company-management-page">
      <div className="evren360-hero">
        <div>
          <span>EVREN360</span>
          <h2>İşletme Yönetimi</h2>
          <p>İşletme bilgileri, lisans, tenant, modül, şube ve kullanıcı yönetimini tek çalışma ekranında izleyin.</p>
        </div>
        <div className="evren360-hero-meta">
          <strong>{company.companyName}</strong>
          <span>{packageItem?.name || 'Paket yok'}</span>
        </div>
      </div>

      {message && <div className="evren360-feedback">{message}</div>}

      <section className="evren360-panel company-management-selector">
        <div className="evren360-panel-header">
          <div>
            <h3>İşletme Seçimi</h3>
            <p>Operasyon yapılacak firmayı seçin.</p>
          </div>
          <label>
            <span>İşletme</span>
            <select value={company.id} onChange={event => {
              setSelectedCompanyId(event.target.value)
              setMessage('')
            }}>
              {data.companies.map(item => <option key={item.id} value={item.id}>{item.companyName}</option>)}
            </select>
          </label>
        </div>
      </section>

      <div className="company-management-quick-grid">
        {quickActions.map(action => (
          <button className="btn" type="button" key={action} onClick={() => triggerPlaceholder(action)}>{action}</button>
        ))}
      </div>

      <div className="evren360-kpi-grid">
        <div className="evren360-kpi">
          <span>Şube Sayısı</span>
          <strong>{formatNumber(companyBranches.length)}</strong>
          <p>Firma kapsamındaki şubeler.</p>
        </div>
        <div className="evren360-kpi success">
          <span>Kullanıcı Sayısı</span>
          <strong>{formatNumber(companyUsers.length)}</strong>
          <p>Silinmiş kullanıcılar hariç.</p>
        </div>
        <div className="evren360-kpi warning">
          <span>Aktif Modül</span>
          <strong>{formatNumber(activeModuleCount)}</strong>
          <p>Aktif modül kapsamı.</p>
        </div>
        <div className="evren360-kpi muted">
          <span>Lisans Durumu</span>
          <strong>{license?.status || '-'}</strong>
          <p>{getRemainingDays(license)}</p>
        </div>
      </div>

      <section className="evren360-panel">
        <div className="evren360-panel-header">
          <div>
            <h3>İşletme Genel Bilgileri</h3>
            <p>Temel firma ve tenant referansları.</p>
          </div>
          <span className={`status-pill ${getStatusClassName(status)}`}>{status}</span>
        </div>
        <div className="company-management-info-grid">
          <div><span>Firma Adı</span><strong>{company.companyName}</strong></div>
          <div><span>Yetkili</span><strong>{company.ownerName}</strong></div>
          <div><span>Telefon</span><strong>{company.phone || '-'}</strong></div>
          <div><span>E-Posta</span><strong>{company.email || '-'}</strong></div>
          <div><span>Tenant</span><strong>{tenant?.tenantCode || tenant?.id || '-'}</strong></div>
          <div><span>Oluşturulma Tarihi</span><strong>{formatDateTime(company.createdAt)}</strong></div>
          <div><span>Son Güncelleme</span><strong>{formatDateTime(company.updatedAt)}</strong></div>
        </div>
      </section>

      <div className="company-management-grid">
        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Lisans Yönetimi</h3>
              <p>Paket, tarih ve lisans durumu.</p>
            </div>
            {license && <span className={`status-pill ${getStatusClassName(license.status)}`}>{license.status}</span>}
          </div>
          <div className="company-management-license-grid">
            <div><span>Paket</span><strong>{packageItem?.name || '-'}</strong></div>
            <div><span>Başlangıç Tarihi</span><strong>{formatDate(license?.startDate || '')}</strong></div>
            <div><span>Bitiş Tarihi</span><strong>{formatDate(license?.endDate || '')}</strong></div>
            <div><span>Kalan Gün</span><strong>{getRemainingDays(license)}</strong></div>
            <div><span>Durum</span><strong>{license?.status || '-'}</strong></div>
          </div>
          <div className="company-management-action-row">
            <button className="btn" type="button" onClick={() => triggerPlaceholder('Lisans Uzat')}>Lisans Uzat</button>
            <button className="btn" type="button" onClick={() => triggerPlaceholder('Paket Değiştir')}>Paket Değiştir</button>
            <button className="btn" type="button" onClick={() => triggerPlaceholder('Lisansı Askıya Al')}>Lisansı Askıya Al</button>
          </div>
        </section>

        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Tenant Bilgileri</h3>
              <p>Tenant kimliği ve platform durumu.</p>
            </div>
            {tenant && <span className={`status-pill ${getStatusClassName(tenant.status)}`}>{tenant.status}</span>}
          </div>
          <div className="company-management-tenant-grid">
            <div><span>Tenant ID</span><strong>{tenant?.id || '-'}</strong></div>
            <div><span>Oluşturulma Tarihi</span><strong>{formatDateTime(tenant?.createdAt || '')}</strong></div>
            <div><span>Durum</span><strong>{tenant?.status || '-'}</strong></div>
          </div>
        </section>
      </div>

      <section className="evren360-panel">
        <div className="evren360-panel-header">
          <div>
            <h3>Modül Yönetimi</h3>
            <p>Aktivasyon işlemleri bu fazda placeholder olarak hazırlanmıştır.</p>
          </div>
        </div>
        <div className="company-management-module-grid">
          {managedModules.map(module => (
            <div className="company-management-module-card" key={module.key}>
              <div>
                <strong>{module.label}</strong>
                <span className={`status-pill ${module.active ? 'success' : 'muted-pill'}`}>{module.active ? 'Aktif' : 'Pasif'}</span>
              </div>
              <div>
                <button className="btn" type="button" onClick={() => triggerPlaceholder(`${module.label} Aç`)}>Aç</button>
                <button className="btn" type="button" onClick={() => triggerPlaceholder(`${module.label} Kapat`)}>Kapat</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="company-management-grid">
        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Şube Yönetimi</h3>
              <p>İşletmeye ait şube kayıtları.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table company-management-branch-table">
              <thead>
                <tr>
                  <th>Şube Adı</th>
                  <th>Durum</th>
                  <th>Kullanıcı Sayısı</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {companyBranches.map((branch, index) => (
                  <tr key={branch.id}>
                    <td><strong>{branch.name}</strong><span className="muted small-text">{branch.city}</span></td>
                    <td><span className={`status-pill ${branch.isActive ? 'success' : 'muted-pill'}`}>{branch.isActive ? 'Aktif' : 'Pasif'}</span></td>
                    <td>{formatNumber(getBranchUserCount(branch, index, companyUsers, data.branchPermissions, appUserIds))}</td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => triggerPlaceholder('Şube Görüntüle')}>Görüntüle</button>
                      <button className="btn" type="button" onClick={() => triggerPlaceholder('Şube Düzenle')}>Düzenle</button>
                    </td>
                  </tr>
                ))}
                {companyBranches.length === 0 && <tr><td className="empty-cell" colSpan={4}>Şube kaydı bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Kullanıcı Yönetimi</h3>
              <p>Firma kullanıcıları ve operasyon aksiyonları.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table company-management-user-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th>Son Giriş</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {companyUsers.map(user => (
                  <tr key={user.id}>
                    <td><strong>{user.fullName}</strong><span className="muted small-text">{user.username}</span></td>
                    <td>{user.role}</td>
                    <td><span className={`status-pill ${getStatusClassName(user.status)}`}>{user.status}</span></td>
                    <td>{formatDateTime(user.lastLogin)}</td>
                    <td className="actions-cell">
                      <button className="btn" type="button" onClick={() => triggerPlaceholder('Kullanıcı Düzenle')}>Düzenle</button>
                      <button className="btn" type="button" onClick={() => triggerPlaceholder('Kullanıcı Devre Dışı Bırak')}>Devre Dışı Bırak</button>
                      <button className="btn" type="button" onClick={() => triggerPlaceholder('Şifre Sıfırla')}>Şifre Sıfırla</button>
                    </td>
                  </tr>
                ))}
                {companyUsers.length === 0 && <tr><td className="empty-cell" colSpan={5}>Kullanıcı kaydı bulunamadı.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
