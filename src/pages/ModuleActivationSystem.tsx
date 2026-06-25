import React from 'react'
import {
  Company,
  CompanyLicense,
  LicenseModuleKey,
  LicensePackage,
  LicenseStatus,
  PackageModule,
  User
} from '../types'
import {
  LICENSE_ACCESS_DENIED_MESSAGE,
  LICENSE_MODULE_CATALOG,
  addActionLog,
  addLicenseAccessFailureLog,
  canAccessModule,
  getCompanyLicenseRuntimeStatus,
  loadCompanies,
  loadCompanyLicenses,
  loadLicenseModules,
  loadLicensePackages,
  saveLicenseModules
} from '../storage'

type Props = {
  currentUser: User
}

type CompanyFilter = string | 'all'
type PackageFilter = string | 'all'
type ModuleFilter = LicenseModuleKey | 'all'
type ModuleStatusFilter = 'all' | 'enabled' | 'disabled'

type CompanyModuleRow = {
  company: Company
  license?: CompanyLicense
  packageItem?: LicensePackage
  activeModuleCount: number
  passiveModuleCount: number
  enabledModuleKeys: LicenseModuleKey[]
}

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const getLicenseDeadline = (license?: CompanyLicense) => {
  if(!license) return ''
  return license.isTrial ? license.trialEndDate || license.endDate : license.endDate
}

const getDaysRemaining = (dateKey: string) => {
  if(!dateKey) return 0
  const target = new Date(`${dateKey}T12:00:00`)
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  if(Number.isNaN(target.getTime())) return 0
  return Math.ceil((target.getTime() - today.getTime()) / 86400000)
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const getLicenseStatusClassName = (status?: LicenseStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Deneme') return 'info-pill'
  if(status === 'Süresi Yaklaşıyor') return 'warning-pill'
  if(status === 'Süresi Doldu') return 'danger-pill'
  if(status === 'Askıya Alındı') return 'warning-pill'
  return 'muted-pill'
}

const getModuleLabel = (moduleKey: LicenseModuleKey) => {
  return LICENSE_MODULE_CATALOG.find(module => module.key === moduleKey)?.name || moduleKey
}

const getPackageModule = (modules: PackageModule[], packageId: string, moduleKey: LicenseModuleKey) => {
  return modules.find(module => module.packageId === packageId && module.moduleKey === moduleKey)
}

const getActiveLicenseForCompany = (licenses: CompanyLicense[], companyId: string) => {
  return licenses
    .filter(license => license.companyId === companyId)
    .map(license => ({ ...license, status: getCompanyLicenseRuntimeStatus(license) }))
    .filter(license => license.status === 'Aktif' || license.status === 'Deneme' || license.status === 'Süresi Yaklaşıyor')
    .sort((first, second) => second.startDate.localeCompare(first.startDate))[0]
}

const buildCompanyRows = (
  companies: Company[],
  licenses: CompanyLicense[],
  packages: LicensePackage[],
  modules: PackageModule[]
): CompanyModuleRow[] => {
  const packageMap = new Map(packages.map(packageItem => [packageItem.id, packageItem]))

  return companies.map(company => {
    const license = getActiveLicenseForCompany(licenses, company.id)
    const packageItem = license ? packageMap.get(license.packageId) : undefined
    const packageModules = packageItem
      ? modules.filter(module => module.packageId === packageItem.id)
      : []
    const enabledModuleKeys = packageModules
      .filter(module => module.enabled)
      .map(module => module.moduleKey)
    const activeModuleCount = enabledModuleKeys.length
    const passiveModuleCount = Math.max(0, LICENSE_MODULE_CATALOG.length - activeModuleCount)

    return {
      company,
      license,
      packageItem,
      activeModuleCount,
      passiveModuleCount,
      enabledModuleKeys
    }
  })
}

export default function ModuleActivationSystem({ currentUser }: Props){
  const initialData = React.useMemo(() => {
    return {
      companies: loadCompanies(),
      packages: loadLicensePackages(),
      modules: loadLicenseModules(),
      licenses: loadCompanyLicenses()
    }
  }, [])

  const [companies] = React.useState<Company[]>(initialData.companies)
  const [packages] = React.useState<LicensePackage[]>(initialData.packages)
  const [licenses] = React.useState<CompanyLicense[]>(initialData.licenses)
  const [modules, setModules] = React.useState<PackageModule[]>(initialData.modules)
  const [selectedPackageId, setSelectedPackageId] = React.useState(initialData.packages.find(packageItem => packageItem.isActive)?.id || initialData.packages[0]?.id || '')
  const [selectedCompanyId, setSelectedCompanyId] = React.useState(initialData.companies[0]?.id || '')
  const [companyFilter, setCompanyFilter] = React.useState<CompanyFilter>('all')
  const [packageFilter, setPackageFilter] = React.useState<PackageFilter>('all')
  const [moduleFilter, setModuleFilter] = React.useState<ModuleFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<ModuleStatusFilter>('all')
  const [testCompanyId, setTestCompanyId] = React.useState(initialData.companies[0]?.id || '')
  const [testModuleKey, setTestModuleKey] = React.useState<LicenseModuleKey>('adisyon')
  const [testResult, setTestResult] = React.useState<ReturnType<typeof canAccessModule> | null>(null)

  const packageMap = React.useMemo(() => new Map(packages.map(packageItem => [packageItem.id, packageItem])), [packages])
  const companyRows = React.useMemo(
    () => buildCompanyRows(companies, licenses, packages, modules),
    [companies, licenses, packages, modules]
  )

  React.useEffect(() => {
    if(!selectedCompanyId && companyRows[0]) setSelectedCompanyId(companyRows[0].company.id)
  }, [companyRows, selectedCompanyId])

  const selectedCompanyRow = companyRows.find(row => row.company.id === selectedCompanyId) || companyRows[0]
  const selectedPackage = packageMap.get(selectedPackageId)

  const filteredCompanyRows = companyRows.filter(row => {
    const matchesCompany = companyFilter === 'all' || row.company.id === companyFilter
    const matchesPackage = packageFilter === 'all' || row.packageItem?.id === packageFilter
    const selectedModuleEnabled = moduleFilter === 'all'
      ? row.activeModuleCount > 0
      : row.enabledModuleKeys.includes(moduleFilter)
    const matchesModule = moduleFilter === 'all' || selectedModuleEnabled || statusFilter === 'disabled'
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'enabled' && selectedModuleEnabled)
      || (statusFilter === 'disabled' && !selectedModuleEnabled)

    return matchesCompany && matchesPackage && matchesModule && matchesStatus
  })

  const moduleUsageRows = LICENSE_MODULE_CATALOG.map(module => {
    const usageCount = companyRows.filter(row => row.enabledModuleKeys.includes(module.key)).length
    return {
      ...module,
      usageCount
    }
  })
  const mostUsedModule = [...moduleUsageRows].sort((first, second) => second.usageCount - first.usageCount)[0]
  const leastUsedModule = [...moduleUsageRows].sort((first, second) => first.usageCount - second.usageCount)[0]
  const activeModules = modules.filter(module => module.enabled).length
  const passiveModules = Math.max(0, modules.length - activeModules)
  const limitedCompanies = companyRows.filter(row => row.license && row.activeModuleCount < LICENSE_MODULE_CATALOG.length).length

  const kpiCards = [
    { label: 'Toplam Modül', value: formatNumber(LICENSE_MODULE_CATALOG.length), detail: 'Katalog modülleri' },
    { label: 'Aktif Modül', value: formatNumber(activeModules), detail: 'Paketlerde açık' },
    { label: 'Pasif Modül', value: formatNumber(passiveModules), detail: 'Paketlerde kapalı' },
    { label: 'Aktif Firma', value: formatNumber(companies.filter(company => company.status === 'Aktif').length), detail: 'SaaS firması' },
    { label: 'En Çok Kullanılan Modül', value: mostUsedModule?.name || '-', detail: mostUsedModule ? `${formatNumber(mostUsedModule.usageCount)} firma` : 'Veri yok' },
    { label: 'En Az Kullanılan Modül', value: leastUsedModule?.name || '-', detail: leastUsedModule ? `${formatNumber(leastUsedModule.usageCount)} firma` : 'Veri yok' },
    { label: 'Modülü Kısıtlı Firma', value: formatNumber(limitedCompanies), detail: 'Tüm modüllere sahip değil' },
    { label: 'Aktif Paket Sayısı', value: formatNumber(packages.filter(packageItem => packageItem.isActive).length), detail: 'Satışa açık paket' }
  ]

  const updatePackageModule = (moduleKey: LicenseModuleKey, enabled: boolean) => {
    if(!selectedPackage) return

    const now = new Date().toISOString()
    const existingModule = getPackageModule(modules, selectedPackage.id, moduleKey)
    const nextModule: PackageModule = {
      id: existingModule?.id || createId('license_module'),
      packageId: selectedPackage.id,
      moduleKey,
      moduleName: getModuleLabel(moduleKey),
      enabled,
      createdAt: existingModule?.createdAt || now,
      updatedAt: now
    }
    const nextModules = existingModule
      ? modules.map(module => module.id === existingModule.id ? nextModule : module)
      : [nextModule, ...modules]

    setModules(nextModules)
    saveLicenseModules(nextModules)

    const affectedCompanies = companyRows.filter(row => row.packageItem?.id === selectedPackage.id).length
    addActionLog({
      operationType: enabled ? 'Modül aktif edildi' : 'Modül pasif edildi',
      user: currentUser,
      tableId: selectedPackage.id,
      tableName: selectedPackage.name,
      description: `${getModuleLabel(moduleKey)} modülü ${selectedPackage.name} paketinde ${enabled ? 'aktif edildi' : 'pasif edildi'}.`
    })
    addActionLog({
      operationType: 'Firma modülü güncellendi',
      user: currentUser,
      tableId: selectedPackage.id,
      tableName: selectedPackage.name,
      description: `${selectedPackage.name} paketindeki ${getModuleLabel(moduleKey)} değişikliği ${formatNumber(affectedCompanies)} firmaya yansıtıldı.`
    })
  }

  const runAccessTest = () => {
    const result = canAccessModule(testCompanyId, testModuleKey)
    const company = companies.find(item => item.id === testCompanyId)
    setTestResult(result)

    if(!result.allowed){
      addLicenseAccessFailureLog({
        user: currentUser,
        companyId: testCompanyId,
        moduleKey: testModuleKey,
        description: `${company?.companyName || 'Firma'} için ${getModuleLabel(testModuleKey)} erişimi reddedildi: ${result.message || LICENSE_ACCESS_DENIED_MESSAGE}`
      })
    }
  }

  return (
    <div className="module-activation-page">
      <div className="page-title">
        <div>
          <h2>Modül Aktivasyon Sistemi</h2>
          <p>Paket bazlı modül erişimlerini yönetin.</p>
        </div>
      </div>

      <div className="metric-grid report-center-kpi-grid">
        {kpiCards.map(card => (
          <div className="metric-card report-kpi-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <p className="muted">{card.detail}</p>
          </div>
        ))}
      </div>

      <section className="card">
        <div className="section-title">
          <div>
            <h3>Firma Listesi</h3>
            <p className="muted">Firmaların paketleri ve aktif modül kapsamı.</p>
          </div>
        </div>

        <div className="filter-grid module-activation-filters">
          <label>
            <span>Firma</span>
            <select value={companyFilter} onChange={event => setCompanyFilter(event.target.value as CompanyFilter)}>
              <option value="all">Tüm firmalar</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
            </select>
          </label>
          <label>
            <span>Paket</span>
            <select value={packageFilter} onChange={event => setPackageFilter(event.target.value as PackageFilter)}>
              <option value="all">Tüm paketler</option>
              {packages.map(packageItem => <option key={packageItem.id} value={packageItem.id}>{packageItem.name}</option>)}
            </select>
          </label>
          <label>
            <span>Modül</span>
            <select value={moduleFilter} onChange={event => setModuleFilter(event.target.value as ModuleFilter)}>
              <option value="all">Tüm modüller</option>
              {LICENSE_MODULE_CATALOG.map(module => <option key={module.key} value={module.key}>{module.name}</option>)}
            </select>
          </label>
          <label>
            <span>Durum</span>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as ModuleStatusFilter)}>
              <option value="all">Tümü</option>
              <option value="enabled">Açık</option>
              <option value="disabled">Kapalı</option>
            </select>
          </label>
        </div>

        <div className="table-wrap">
          <table className="data-table module-activation-company-table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Paket</th>
                <th>Aktif Modül Sayısı</th>
                <th>Pasif Modül Sayısı</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanyRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="empty-cell">Filtrelere uygun firma bulunamadı.</td>
                </tr>
              )}
              {filteredCompanyRows.map(row => (
                <tr
                  key={row.company.id}
                  className={selectedCompanyId === row.company.id ? 'selected-row' : ''}
                  onClick={() => setSelectedCompanyId(row.company.id)}
                >
                  <td>
                    <strong>{row.company.companyName}</strong>
                    <small>{row.company.city}</small>
                  </td>
                  <td>{row.packageItem?.name || '-'}</td>
                  <td>{formatNumber(row.activeModuleCount)}</td>
                  <td>{formatNumber(row.passiveModuleCount)}</td>
                  <td><span className={`status-pill ${getLicenseStatusClassName(row.license?.status)}`}>{row.license?.status || 'Lisans Yok'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="module-activation-detail-grid">
        <section className="card">
          <div className="section-title">
            <div>
              <h3>Paket Modülleri</h3>
              <p className="muted">Her modül için açık, kapalı ve salt-okunur altyapısı.</p>
            </div>
            <select value={selectedPackageId} onChange={event => setSelectedPackageId(event.target.value)}>
              {packages.map(packageItem => <option key={packageItem.id} value={packageItem.id}>{packageItem.name}</option>)}
            </select>
          </div>

          <div className="module-activation-module-list">
            {LICENSE_MODULE_CATALOG.map(module => {
              const packageModule = selectedPackage ? getPackageModule(modules, selectedPackage.id, module.key) : undefined
              const enabled = packageModule?.enabled === true

              return (
                <div className="module-activation-module-row" key={module.key}>
                  <div>
                    <strong>{module.name}</strong>
                    <span>{module.key}</span>
                  </div>
                  <div className="module-activation-mode-buttons" role="group" aria-label={`${module.name} durumu`}>
                    <button className={enabled ? 'active success' : ''} type="button" onClick={() => updatePackageModule(module.key, true)}>Açık</button>
                    <button className={!enabled ? 'active danger' : ''} type="button" onClick={() => updatePackageModule(module.key, false)}>Kapalı</button>
                    <button type="button" disabled title="Salt okunur yetki altyapısı hazır">Salt Okunur</button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="card">
          <div className="section-title">
            <div>
              <h3>Firma Detayı</h3>
              <p className="muted">{selectedCompanyRow?.company.companyName || 'Firma seçin'}</p>
            </div>
          </div>

          <div className="financial-summary-values module-activation-summary">
            <div>
              <span>Kullandığı Paket</span>
              <strong>{selectedCompanyRow?.packageItem?.name || '-'}</strong>
            </div>
            <div>
              <span>Lisans Durumu</span>
              <strong>{selectedCompanyRow?.license?.status || '-'}</strong>
            </div>
            <div>
              <span>Kalan Gün</span>
              <strong>{selectedCompanyRow?.license ? formatNumber(Math.max(0, getDaysRemaining(getLicenseDeadline(selectedCompanyRow.license)))) : '-'}</strong>
            </div>
            <div>
              <span>Aktif / Kapalı</span>
              <strong>{formatNumber(selectedCompanyRow?.activeModuleCount || 0)} / {formatNumber(selectedCompanyRow?.passiveModuleCount || 0)}</strong>
            </div>
          </div>

          <div className="module-activation-access-columns">
            <div>
              <h4>Aktif Modüller</h4>
              {LICENSE_MODULE_CATALOG
                .filter(module => selectedCompanyRow?.enabledModuleKeys.includes(module.key))
                .map(module => <span className="status-pill success" key={module.key}>{module.name}</span>)}
              {selectedCompanyRow && selectedCompanyRow.activeModuleCount === 0 && <p className="muted">Aktif modül yok.</p>}
            </div>
            <div>
              <h4>Kapalı Modüller</h4>
              {LICENSE_MODULE_CATALOG
                .filter(module => !selectedCompanyRow?.enabledModuleKeys.includes(module.key))
                .map(module => <span className="status-pill muted-pill" key={module.key}>{module.name}</span>)}
            </div>
          </div>
        </section>

        <section className="card">
          <div className="section-title">
            <div>
              <h3>Modül Erişim Testi</h3>
              <p className="muted">Merkezi helper sonucu ve işlem kilitleri.</p>
            </div>
          </div>

          <div className="module-activation-test-form">
            <label>
              <span>Firma</span>
              <select value={testCompanyId} onChange={event => setTestCompanyId(event.target.value)}>
                {companies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
              </select>
            </label>
            <label>
              <span>Modül</span>
              <select value={testModuleKey} onChange={event => setTestModuleKey(event.target.value as LicenseModuleKey)}>
                {LICENSE_MODULE_CATALOG.map(module => <option key={module.key} value={module.key}>{module.name}</option>)}
              </select>
            </label>
            <button className="btn primary" type="button" onClick={runAccessTest}>Erişimi Test Et</button>
          </div>

          {testResult && (
            <div className={`module-activation-test-result ${testResult.allowed ? 'allowed' : 'denied'}`}>
              <span>{testResult.allowed ? 'Erişim açık' : 'Erişim engellendi'}</span>
              <strong>{testResult.message || `${testResult.packageName || 'Paket'} içinde ${testResult.moduleName} modülü kullanılabilir.`}</strong>
              <div className="module-activation-operation-list">
                <span>Yeni Kayıt: {testResult.actions.create ? 'Açık' : 'Kapalı'}</span>
                <span>Düzenle: {testResult.actions.edit ? 'Açık' : 'Kapalı'}</span>
                <span>Sil: {testResult.actions.delete ? 'Açık' : 'Kapalı'}</span>
                <span>İçe Aktar: {testResult.actions.import ? 'Açık' : 'Kapalı'}</span>
                <span>Dışa Aktar: {testResult.actions.export ? 'Açık' : 'Kapalı'}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
