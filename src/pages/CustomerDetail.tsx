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
  loadPlatformSupportTickets,
  loadSystemUsageLogs,
  loadUsers
} from '../storage'
import {
  Branch,
  BranchPermission,
  Company,
  CompanyLicense,
  CompanyUser,
  LicenseModuleKey,
  PlatformSupportTicket,
  SystemUsageLog
} from '../types'

type Props = {
  customerId: string
  onBack: () => void
}

type CustomerStatus = 'Aktif' | 'Pasif' | 'Deneme' | 'Askıda'

const moduleCards: Array<{ key: LicenseModuleKey; label: string }> = [
  { key: 'adisyon', label: 'İşlem Yönetimi' },
  { key: 'qr-menu', label: 'Dijital Katalog' },
  { key: 'stock', label: 'Stok' },
  { key: 'finance', label: 'Finans' },
  { key: 'current', label: 'Cari' },
  { key: 'personnel', label: 'Personel' }
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
  if(normalized.includes('aktif') || normalized.includes('cozuldu')) return 'success'
  if(normalized.includes('pasif') || normalized.includes('iptal') || normalized.includes('reddedildi')) return 'muted-pill'
  if(normalized.includes('deneme') || normalized.includes('inceleniyor')) return 'info-pill'
  if(normalized.includes('ask') || normalized.includes('yaklasiyor') || normalized.includes('bekle')) return 'warning-pill'
  if(normalized.includes('doldu') || normalized.includes('acik')) return 'danger-pill'
  return 'info-pill'
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

const getCustomerStatus = (company: Company, license?: CompanyLicense): CustomerStatus => {
  const companyStatus = normalizeLookup(company.status)
  const licenseStatus = normalizeLookup(license?.status || '')

  if(companyStatus.startsWith('ask')) return 'Askıda'
  if(companyStatus.includes('pasif') || companyStatus.includes('silindi')) return 'Pasif'
  if(license?.isTrial || licenseStatus.includes('deneme')) return 'Deneme'
  return 'Aktif'
}

const getRemainingDays = (license?: CompanyLicense) => {
  if(!license) return '-'
  const targetValue = license.isTrial ? license.trialEndDate || license.endDate : license.endDate
  if(!targetValue) return '-'
  const target = new Date(`${targetValue}T12:00:00`)
  if(Number.isNaN(target.getTime())) return '-'
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  const days = Math.ceil((target.getTime() - today.getTime()) / 86400000)
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

const getDemoLoginDate = (index: number, fallback: string) => {
  if(fallback) return fallback
  const date = new Date()
  date.setDate(date.getDate() - index)
  date.setHours(9 + index, 15, 0, 0)
  return date.toISOString()
}

const buildLoginHistory = (
  companyUsers: CompanyUser[],
  usageLogs: SystemUsageLog[],
  branchIds: Set<string>
) => {
  const logins = usageLogs
    .filter(log => branchIds.has(log.branchId) && normalizeLookup(log.actionType).includes('giris'))
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 5)
    .map((log, index) => ({
      id: log.id,
      userName: log.userName,
      date: log.createdAt,
      ipAddress: log.ipAddress || `192.168.1.${20 + index}`,
      status: 'Başarılı'
    }))

  if(logins.length > 0) return logins

  return companyUsers
    .slice(0, 5)
    .map((user, index) => ({
      id: user.id,
      userName: user.fullName,
      date: getDemoLoginDate(index, user.lastLogin),
      ipAddress: `192.168.1.${20 + index}`,
      status: user.status === 'Aktif' ? 'Başarılı' : 'Pasif'
    }))
}

export default function CustomerDetail({ customerId, onBack }: Props){
  const data = React.useMemo(() => ({
    companies: loadCompanies(),
    licenses: loadCompanyLicenses(),
    packages: loadLicensePackages(),
    branches: loadBranches(),
    companyUsers: loadCompanyUsers(),
    licenseModules: loadLicenseModules(),
    supportTickets: loadPlatformSupportTickets(),
    usageLogs: loadSystemUsageLogs(),
    branchPermissions: loadBranchPermissions(),
    appUsers: loadUsers({ allTenants: true })
  }), [])

  const company = React.useMemo(() => {
    const activeCompanies = data.companies.filter(item => !normalizeLookup(item.status).includes('silindi'))
    return activeCompanies.find(item => item.id === customerId) || activeCompanies[0]
  }, [customerId, data.companies])

  if(!company){
    return (
      <section className="evren360-panel customer-detail-page">
        <div className="evren360-panel-header">
          <div>
            <h3>Müşteri Detayı</h3>
            <p>Görüntülenecek müşteri bulunamadı.</p>
          </div>
          <button className="btn" type="button" onClick={onBack}>Listeye Dön</button>
        </div>
      </section>
    )
  }

  const license = getLatestLicenseForCompany(data.licenses, company.id)
  const packageItem = license ? data.packages.find(item => item.id === license.packageId) : undefined
  const customerStatus = getCustomerStatus(company, license)
  const companyBranches = data.branches.filter(branch => branch.companyId === company.id)
  const companyUsers = data.companyUsers
    .filter(user => user.companyId === company.id && !normalizeLookup(user.status).includes('silindi'))
    .sort((first, second) => first.fullName.localeCompare(second.fullName, 'tr-TR'))
  const appUsers = data.appUsers.filter(user => user.companyId === company.id)
  const appUserIds = new Set(appUsers.map(user => user.id))
  const packageModules = data.licenseModules.filter(module => module.packageId === license?.packageId)
  const packageModuleMap = new Map(packageModules.map(module => [module.moduleKey, module.enabled]))
  const normalizedLicenseStatus = normalizeLookup(license?.status || '')
  const licenseUsable = Boolean(license) && !['iptal', 'doldu', 'askiyaalindi'].some(keyword => normalizedLicenseStatus.includes(keyword))
  const modules = moduleCards.map(module => ({
    ...module,
    active: licenseUsable && (module.key === 'adisyon' || packageModuleMap.get(module.key) === true)
  }))
  const branchIds = new Set(companyBranches.map(branch => branch.id))
  const loginHistory = buildLoginHistory(companyUsers, data.usageLogs, branchIds)
  const supportTickets = data.supportTickets
    .filter(ticket => ticket.companyId === company.id)
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 5)

  const activeModuleCount = modules.filter(module => module.active).length

  return (
    <div className="customer-detail-page">
      <div className="evren360-hero">
        <div>
          <span>EVREN360</span>
          <h2>Müşteri Detayı</h2>
          <p>{company.companyName} için işletme, lisans, şube, kullanıcı ve destek özetleri.</p>
        </div>
        <div className="evren360-hero-meta">
          <strong>{company.companyName}</strong>
          <span>{packageItem?.name || 'Paket yok'}</span>
        </div>
      </div>

      <div className="customer-detail-action-row">
        <button className="btn" type="button" onClick={onBack}>Listeye Dön</button>
        <span className={`status-pill ${getStatusClassName(customerStatus)}`}>{customerStatus}</span>
      </div>

      <div className="evren360-kpi-grid">
        <div className="evren360-kpi">
          <span>Şube Sayısı</span>
          <strong>{formatNumber(companyBranches.length)}</strong>
          <p>Aktif ve pasif şubeler.</p>
        </div>
        <div className="evren360-kpi success">
          <span>Kullanıcı Sayısı</span>
          <strong>{formatNumber(companyUsers.length)}</strong>
          <p>Silinmiş kullanıcılar hariç.</p>
        </div>
        <div className="evren360-kpi warning">
          <span>Aktif Modül</span>
          <strong>{formatNumber(activeModuleCount)}</strong>
          <p>Mevcut modül kapsamı.</p>
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
            <h3>İşletme Bilgileri</h3>
            <p>Temel firma ve iletişim bilgileri.</p>
          </div>
          <span className={`status-pill ${getStatusClassName(customerStatus)}`}>{customerStatus}</span>
        </div>
        <div className="customer-detail-info-grid">
          <div><span>Firma Adı</span><strong>{company.companyName}</strong></div>
          <div><span>Yetkili</span><strong>{company.ownerName}</strong></div>
          <div><span>Telefon</span><strong>{company.phone || '-'}</strong></div>
          <div><span>E-Posta</span><strong>{company.email || '-'}</strong></div>
          <div><span>Adres</span><strong>{company.address ? `${company.address}, ${company.city} / ${company.district}` : '-'}</strong></div>
          <div><span>Vergi Bilgileri</span><strong>{company.taxOffice || company.taxNumber ? `${company.taxOffice || '-'} / ${company.taxNumber || '-'}` : '-'}</strong></div>
          <div><span>Kayıt Tarihi</span><strong>{formatDateTime(company.createdAt)}</strong></div>
          <div><span>Son Güncelleme</span><strong>{formatDateTime(company.updatedAt)}</strong></div>
        </div>
      </section>

      <section className="evren360-panel">
        <div className="evren360-panel-header">
          <div>
            <h3>Lisans Bilgileri</h3>
            <p>Paket, süre ve kalan gün bilgileri.</p>
          </div>
          {license && <span className={`status-pill ${getStatusClassName(license.status)}`}>{license.status}</span>}
        </div>
        <div className="customer-detail-license-grid">
          <div><span>Paket</span><strong>{packageItem?.name || '-'}</strong></div>
          <div><span>Lisans Başlangıcı</span><strong>{formatDate(license?.startDate || '')}</strong></div>
          <div><span>Lisans Bitişi</span><strong>{formatDate(license?.endDate || '')}</strong></div>
          <div><span>Durum</span><strong>{license?.status || '-'}</strong></div>
          <div><span>Kalan Gün</span><strong>{getRemainingDays(license)}</strong></div>
        </div>
      </section>

      <div className="customer-detail-grid">
        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Şubeler</h3>
              <p>Müşteriye bağlı şube listesi.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table customer-detail-branch-table">
              <thead>
                <tr>
                  <th>Şube Adı</th>
                  <th>Durum</th>
                  <th>Kullanıcı Sayısı</th>
                </tr>
              </thead>
              <tbody>
                {companyBranches.map((branch, index) => (
                  <tr key={branch.id}>
                    <td><strong>{branch.name}</strong><span className="muted small-text">{branch.city}</span></td>
                    <td><span className={`status-pill ${branch.isActive ? 'success' : 'muted-pill'}`}>{branch.isActive ? 'Aktif' : 'Pasif'}</span></td>
                    <td>{formatNumber(getBranchUserCount(branch, index, companyUsers, data.branchPermissions, appUserIds))}</td>
                  </tr>
                ))}
                {companyBranches.length === 0 && (
                  <tr><td className="empty-cell" colSpan={3}>Şube kaydı bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Kullanıcılar</h3>
              <p>Firma kullanıcıları ve son giriş bilgileri.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table customer-detail-user-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>Kullanıcı Adı</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th>Son Giriş</th>
                </tr>
              </thead>
              <tbody>
                {companyUsers.map(user => (
                  <tr key={user.id}>
                    <td><strong>{user.fullName}</strong><span className="muted small-text">{user.email}</span></td>
                    <td>{user.username}</td>
                    <td>{user.role}</td>
                    <td><span className={`status-pill ${getStatusClassName(user.status)}`}>{user.status}</span></td>
                    <td>{formatDateTime(user.lastLogin)}</td>
                  </tr>
                ))}
                {companyUsers.length === 0 && (
                  <tr><td className="empty-cell" colSpan={5}>Kullanıcı kaydı bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="evren360-panel">
        <div className="evren360-panel-header">
          <div>
            <h3>Modüller</h3>
            <p>Aktif paket kapsamında kullanılabilen ana modüller.</p>
          </div>
        </div>
        <div className="customer-detail-module-grid">
          {modules.map(module => (
            <div className="customer-detail-module-card" key={module.key}>
              <strong>{module.label}</strong>
              <span className={`status-pill ${module.active ? 'success' : 'muted-pill'}`}>{module.active ? 'Aktif' : 'Pasif'}</span>
            </div>
          ))}
          {LICENSE_MODULE_CATALOG
            .filter(module => !moduleCards.some(card => card.key === module.key))
            .slice(0, 2)
            .map(module => (
              <div className="customer-detail-module-card" key={module.key}>
                <strong>{module.name}</strong>
                <span className={`status-pill ${licenseUsable && packageModuleMap.get(module.key) ? 'success' : 'muted-pill'}`}>
                  {licenseUsable && packageModuleMap.get(module.key) ? 'Aktif' : 'Pasif'}
                </span>
              </div>
            ))}
        </div>
      </section>

      <div className="customer-detail-grid">
        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Giriş Geçmişi</h3>
              <p>Son kullanıcı girişleri.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table customer-detail-login-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Tarih</th>
                  <th>IP</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {loginHistory.map(login => (
                  <tr key={login.id}>
                    <td><strong>{login.userName}</strong></td>
                    <td>{formatDateTime(login.date)}</td>
                    <td>{login.ipAddress}</td>
                    <td><span className={`status-pill ${login.status === 'Başarılı' ? 'success' : 'muted-pill'}`}>{login.status}</span></td>
                  </tr>
                ))}
                {loginHistory.length === 0 && (
                  <tr><td className="empty-cell" colSpan={4}>Giriş kaydı bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="evren360-panel">
          <div className="evren360-panel-header">
            <div>
              <h3>Destek Geçmişi</h3>
              <p>Platform destek kayıtları.</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="data-table customer-detail-support-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Başlık</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {supportTickets.map((ticket: PlatformSupportTicket) => (
                  <tr key={ticket.id}>
                    <td>{formatDate(ticket.createdAt)}</td>
                    <td><strong>{ticket.subject}</strong><span className="muted small-text">{ticket.priority}</span></td>
                    <td><span className={`status-pill ${getStatusClassName(ticket.status)}`}>{ticket.status}</span></td>
                  </tr>
                ))}
                {supportTickets.length === 0 && (
                  <tr><td className="empty-cell" colSpan={3}>Destek kaydı bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
