import React from 'react'
import { Company, Tenant, TenantSettings, TenantStatus, User } from '../types'
import {
  TenantIsolationTestResult,
  addActionLog,
  loadCompanies,
  loadTenantSettings,
  loadTenants,
  runTenantIsolationTest,
  saveTenantSettings
} from '../storage'
import {
  DEFAULT_TENANT_SETTINGS,
  TENANT_STATUSES,
  createDefaultTenantSettings
} from '../tenant'
import {
  activateTenant,
  archiveTenant,
  createTenant,
  deactivateTenant,
  updateTenant
} from '../tenant/tenant.service'

type Props = {
  currentUser: User
}

type TenantFilter = string | 'all'
type CompanyFilter = string | 'all'
type StatusFilter = TenantStatus | 'all'

type TenantFormValues = {
  id: string
  tenantCode: string
  companyId: string
  companyName: string
  status: TenantStatus
}

type SettingsFormValues = Pick<TenantSettings, 'timezone' | 'currency' | 'language' | 'dateFormat' | 'theme'>

const emptySettings: SettingsFormValues = {
  timezone: DEFAULT_TENANT_SETTINGS.timezone,
  currency: DEFAULT_TENANT_SETTINGS.currency,
  language: DEFAULT_TENANT_SETTINGS.language,
  dateFormat: DEFAULT_TENANT_SETTINGS.dateFormat,
  theme: DEFAULT_TENANT_SETTINGS.theme
}

const todayKey = () => new Date().toLocaleDateString('sv-SE')

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const getDateKey = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('sv-SE')
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}

const getStatusClassName = (status: TenantStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Pasif') return 'muted-pill'
  if(status === 'Askıda') return 'warning-pill'
  if(status === 'Arşivlendi') return 'muted-pill'
  return 'danger-pill'
}

const createTenantCode = (companyName: string, tenants: Tenant[]) => {
  const compact = companyName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLocaleUpperCase('tr-TR')
  const prefix = (compact || 'TNT').slice(0, 3).padEnd(3, 'X')
  let index = 1
  let code = `${prefix}${String(index).padStart(3, '0')}`
  const existingCodes = new Set(tenants.map(tenant => tenant.tenantCode.toLocaleUpperCase('tr-TR')))

  while(existingCodes.has(code)){
    index += 1
    code = `${prefix}${String(index).padStart(3, '0')}`
  }

  return code
}

const createTenantForm = (companies: Company[], tenants: Tenant[], tenant?: Tenant): TenantFormValues => {
  if(tenant){
    return {
      id: tenant.id,
      tenantCode: tenant.tenantCode,
      companyId: tenant.ownerCompanyId || tenant.companyId,
      companyName: tenant.tenantName || tenant.companyName,
      status: tenant.status
    }
  }

  const tenantCompanyIds = new Set(tenants.map(item => item.ownerCompanyId || item.companyId))
  const company = companies.find(item => !tenantCompanyIds.has(item.id)) || companies[0]

  return {
    id: '',
    tenantCode: createTenantCode(company?.companyName || 'Tenant', tenants),
    companyId: company?.id || '',
    companyName: company?.companyName || '',
    status: 'Aktif'
  }
}

const toSettingsForm = (settings?: TenantSettings): SettingsFormValues => ({
  timezone: settings?.timezone || emptySettings.timezone,
  currency: settings?.currency || emptySettings.currency,
  language: settings?.language || emptySettings.language,
  dateFormat: settings?.dateFormat || emptySettings.dateFormat,
  theme: settings?.theme || emptySettings.theme
})

export default function TenantManagement({ currentUser }: Props){
  const initialData = React.useMemo(() => ({
    tenants: loadTenants(),
    tenantSettings: loadTenantSettings(),
    companies: loadCompanies()
  }), [])

  const [tenants, setTenants] = React.useState<Tenant[]>(initialData.tenants)
  const [tenantSettings, setTenantSettings] = React.useState<TenantSettings[]>(initialData.tenantSettings)
  const [companies] = React.useState<Company[]>(initialData.companies)
  const [selectedTenantId, setSelectedTenantId] = React.useState(initialData.tenants[0]?.id || '')
  const [tenantForm, setTenantForm] = React.useState<TenantFormValues>(() => createTenantForm(initialData.companies, initialData.tenants, initialData.tenants[0]))
  const [settingsForm, setSettingsForm] = React.useState<SettingsFormValues>(() => toSettingsForm(initialData.tenantSettings.find(item => item.tenantId === initialData.tenants[0]?.id)))
  const [tenantFilter, setTenantFilter] = React.useState<TenantFilter>('all')
  const [companyFilter, setCompanyFilter] = React.useState<CompanyFilter>('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [testSourceTenantId, setTestSourceTenantId] = React.useState(initialData.tenants[0]?.id || '')
  const [testTargetTenantId, setTestTargetTenantId] = React.useState(initialData.tenants[1]?.id || initialData.tenants[0]?.id || '')
  const [testResult, setTestResult] = React.useState<TenantIsolationTestResult | null>(null)
  const [formError, setFormError] = React.useState('')
  const [formMessage, setFormMessage] = React.useState('')

  const companyMap = React.useMemo(() => new Map(companies.map(company => [company.id, company])), [companies])
  const settingsMap = React.useMemo(() => new Map(tenantSettings.map(settings => [settings.tenantId, settings])), [tenantSettings])
  const selectedTenant = tenants.find(tenant => tenant.id === selectedTenantId)
  const selectedSettings = selectedTenant ? settingsMap.get(selectedTenant.id) : undefined
  const today = todayKey()

  const visibleTenants = React.useMemo(() => {
    return [...tenants]
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      .filter(tenant => {
        const createdDate = getDateKey(tenant.createdAt)
        const matchesTenant = tenantFilter === 'all' || tenant.id === tenantFilter
        const matchesCompany = companyFilter === 'all' || (tenant.ownerCompanyId || tenant.companyId) === companyFilter
        const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter
        const matchesStart = !startDate || createdDate >= startDate
        const matchesEnd = !endDate || createdDate <= endDate
        return matchesTenant && matchesCompany && matchesStatus && matchesStart && matchesEnd
      })
  }, [companyFilter, endDate, startDate, statusFilter, tenantFilter, tenants])

  const tenantCompanyIds = new Set(tenants.filter(tenant => !tenant.deletedAt && tenant.status !== 'Silinmiş').map(tenant => tenant.ownerCompanyId || tenant.companyId))
  const activeTenants = tenants.filter(tenant => tenant.status === 'Aktif')
  const passiveTenants = tenants.filter(tenant => tenant.status === 'Pasif')
  const suspendedTenants = tenants.filter(tenant => tenant.status === 'Askıda')
  const todayTenants = tenants.filter(tenant => getDateKey(tenant.createdAt) === today)
  const tenantIssueCompanies = companies.filter(company => !tenantCompanyIds.has(company.id))
  const missingSettingsCompanies = companies.filter(company => {
    const tenant = tenants.find(item => (item.ownerCompanyId === company.id || item.companyId === company.id) && !item.deletedAt && item.status !== 'Silinmiş')
    return Boolean(tenant && !tenantSettings.some(settings => settings.tenantId === tenant.id))
  })

  const selectTenant = (tenant: Tenant) => {
    setSelectedTenantId(tenant.id)
    setTenantForm(createTenantForm(companies, tenants, tenant))
    setSettingsForm(toSettingsForm(settingsMap.get(tenant.id)))
    setTestSourceTenantId(tenant.id)
    setTestTargetTenantId(tenants.find(item => item.id !== tenant.id)?.id || tenant.id)
    setTestResult(null)
    setFormError('')
    setFormMessage('')
  }

  const startNewTenant = () => {
    const nextForm = createTenantForm(companies, tenants)
    setSelectedTenantId('')
    setTenantForm(nextForm)
    setSettingsForm(emptySettings)
    setTestResult(null)
    setFormError('')
    setFormMessage('Yeni tenant bilgilerini girin.')
  }

  const updateTenantForm = <K extends keyof TenantFormValues>(key: K, value: TenantFormValues[K]) => {
    setTenantForm(prev => {
      if(key === 'companyId'){
        const company = companyMap.get(String(value))
        return {
          ...prev,
          companyId: String(value),
          companyName: company?.companyName || prev.companyName,
          tenantCode: prev.id ? prev.tenantCode : createTenantCode(company?.companyName || prev.companyName, tenants)
        }
      }

      return { ...prev, [key]: value }
    })
  }

  const updateSettingsForm = <K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) => {
    setSettingsForm(prev => ({ ...prev, [key]: value }))
  }

  const saveTenant = () => {
    const tenantCode = tenantForm.tenantCode.trim().toLocaleUpperCase('tr-TR')
    const company = companyMap.get(tenantForm.companyId)

    if(!tenantCode){
      setFormError('Tenant kodu zorunludur.')
      setFormMessage('')
      return
    }

    if(!company){
      setFormError('Firma seçimi zorunludur.')
      setFormMessage('')
      return
    }

    const now = new Date().toISOString()
    const existingTenant = tenants.find(tenant => tenant.id === tenantForm.id)
    let nextTenant: Tenant

    try {
      nextTenant = existingTenant
        ? updateTenant(existingTenant.id, {
            tenantCode,
            tenantName: tenantForm.companyName.trim() || company.companyName,
            ownerCompanyId: company.id,
            status: tenantForm.status
          }, { user: currentUser })
        : createTenant({
            tenantCode,
            tenantName: tenantForm.companyName.trim() || company.companyName,
            ownerCompanyId: company.id,
            status: tenantForm.status,
            createdAt: now
          }, { user: currentUser })
    } catch(error) {
      setFormError(error instanceof Error ? error.message : 'Tenant kaydedilemedi.')
      setFormMessage('')
      return
    }

    const nextTenants = loadTenants()
    const latestTenantSettings = loadTenantSettings()
    const hasSettings = latestTenantSettings.some(settings => settings.tenantId === nextTenant.id)
    const nextSettings = hasSettings
      ? latestTenantSettings
      : [createDefaultTenantSettings(nextTenant.id, now), ...latestTenantSettings]

    setTenants(nextTenants)
    setTenantSettings(nextSettings)
    saveTenantSettings(nextSettings)
    setSelectedTenantId(nextTenant.id)
    setTenantForm(createTenantForm(companies, nextTenants, nextTenant))
    setSettingsForm(toSettingsForm(nextSettings.find(settings => settings.tenantId === nextTenant.id)))
    setFormError('')
    setFormMessage(existingTenant ? `${nextTenant.companyName} tenant bilgileri güncellendi.` : `${nextTenant.companyName} tenant olarak oluşturuldu.`)
    addActionLog({
      operationType: existingTenant ? 'Tenant güncellendi' : 'Tenant oluşturuldu',
      user: currentUser,
      tenantId: nextTenant.id,
      tableId: nextTenant.id,
      tableName: nextTenant.companyName,
      description: `${nextTenant.companyName} için ${nextTenant.tenantCode} tenant kaydı ${existingTenant ? 'güncellendi' : 'oluşturuldu'}.`
    })
  }

  const updateTenantStatus = (tenant: Tenant, status: TenantStatus) => {
    let nextTenant: Tenant

    try {
      nextTenant = status === 'Aktif'
        ? activateTenant(tenant.id, { user: currentUser })
        : status === 'Pasif'
          ? deactivateTenant(tenant.id, { user: currentUser })
          : status === 'Arşivlendi' || status === 'Silinmiş'
            ? archiveTenant(tenant.id, { user: currentUser })
            : updateTenant(tenant.id, { status }, { user: currentUser })
    } catch(error) {
      setFormError(error instanceof Error ? error.message : 'Tenant durumu güncellenemedi.')
      setFormMessage('')
      return
    }

    const nextTenants = loadTenants()
    setTenants(nextTenants)
    if(selectedTenantId === tenant.id) setTenantForm(createTenantForm(companies, nextTenants, nextTenant))
    setFormError('')
    setFormMessage(`${tenant.tenantName || tenant.companyName} tenant durumu ${nextTenant.status} olarak güncellendi.`)
    addActionLog({
      operationType: nextTenant.status === 'Pasif'
        ? 'Tenant pasife alındı'
        : nextTenant.status === 'Aktif'
          ? 'Tenant aktif edildi'
          : nextTenant.status === 'Arşivlendi'
            ? 'Tenant arşivlendi'
            : 'Tenant güncellendi',
      user: currentUser,
      tenantId: tenant.id,
      tableId: tenant.id,
      tableName: tenant.tenantName || tenant.companyName,
      description: `${tenant.tenantName || tenant.companyName} tenant durumu ${tenant.status} -> ${nextTenant.status} olarak güncellendi.`
    })
  }

  const saveSelectedSettings = () => {
    if(!selectedTenant){
      setFormError('Ayar kaydetmek için tenant seçin.')
      setFormMessage('')
      return
    }

    const now = new Date().toISOString()
    const existingSettings = tenantSettings.find(settings => settings.tenantId === selectedTenant.id)
    const nextSettingsItem: TenantSettings = {
      id: existingSettings?.id || `tenant_settings_${selectedTenant.id}`,
      tenantId: selectedTenant.id,
      timezone: settingsForm.timezone.trim() || DEFAULT_TENANT_SETTINGS.timezone,
      currency: settingsForm.currency.trim().toLocaleUpperCase('tr-TR') || DEFAULT_TENANT_SETTINGS.currency,
      language: settingsForm.language.trim() || DEFAULT_TENANT_SETTINGS.language,
      dateFormat: settingsForm.dateFormat.trim() || DEFAULT_TENANT_SETTINGS.dateFormat,
      theme: settingsForm.theme.trim() || DEFAULT_TENANT_SETTINGS.theme,
      createdAt: existingSettings?.createdAt || now,
      updatedAt: now
    }
    const nextSettings = existingSettings
      ? tenantSettings.map(settings => settings.id === existingSettings.id ? nextSettingsItem : settings)
      : [nextSettingsItem, ...tenantSettings]

    setTenantSettings(nextSettings)
    saveTenantSettings(nextSettings)
    setSettingsForm(toSettingsForm(nextSettingsItem))
    setFormError('')
    setFormMessage(`${selectedTenant.tenantName || selectedTenant.companyName} tenant ayarları kaydedildi.`)
    addActionLog({
      operationType: 'Tenant güncellendi',
      user: currentUser,
      tenantId: selectedTenant.id,
      tableId: selectedTenant.id,
      tableName: selectedTenant.tenantName || selectedTenant.companyName,
      description: `${selectedTenant.tenantName || selectedTenant.companyName} tenant ayarları güncellendi. Saat dilimi: ${nextSettingsItem.timezone}, para birimi: ${nextSettingsItem.currency}.`
    })
  }

  const runIsolationForSelection = (sourceTenantId = testSourceTenantId, targetTenantId = testTargetTenantId) => {
    if(!sourceTenantId || !targetTenantId || sourceTenantId === targetTenantId){
      setFormError('İzolasyon testi için iki farklı tenant seçin.')
      setFormMessage('')
      return
    }

    const result = runTenantIsolationTest({ sourceTenantId, targetTenantId, user: currentUser })
    setTestResult(result)
    setFormError('')
    setFormMessage(result.message)
  }

  const kpiCards = [
    { label: 'Toplam Tenant', value: tenants.length },
    { label: 'Aktif Tenant', value: activeTenants.length },
    { label: 'Pasif Tenant', value: passiveTenants.length },
    { label: 'Askıda Tenant', value: suspendedTenants.length },
    { label: 'Bugün Oluşturulan Tenant', value: todayTenants.length },
    { label: 'Toplam Firma', value: companies.length },
    { label: 'Tenant Sorunu Yaşayan Firma', value: tenantIssueCompanies.length },
    { label: 'Tenant Ayarı Eksik Firma', value: missingSettingsCompanies.length }
  ]

  return (
    <div className="tenant-management-page">
      <div className="page-title">
        <div>
          <h2>Tenant Yönetimi</h2>
          <p className="muted">İşletmelerin veri izolasyonunu ve tenant ayarlarını yönetin.</p>
        </div>
        <button className="btn primary" type="button" onClick={startNewTenant}>Tenant Oluştur</button>
      </div>

      <div className="metric-grid">
        {kpiCards.map(card => (
          <div className="metric-card" key={card.label}>
            <span>{card.label}</span>
            <strong>{formatNumber(card.value)}</strong>
          </div>
        ))}
      </div>

      {formMessage && <div className="form-success">{formMessage}</div>}
      {formError && <div className="form-error">{formError}</div>}

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Tenant Listesi</h3>
            <p className="muted">{formatNumber(visibleTenants.length)} tenant gösteriliyor.</p>
          </div>
          <div className="toolbar-controls tenant-management-filters">
            <select value={tenantFilter} onChange={event => setTenantFilter(event.target.value as TenantFilter)}>
              <option value="all">Tüm tenantlar</option>
              {tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.tenantCode}</option>)}
            </select>
            <select value={companyFilter} onChange={event => setCompanyFilter(event.target.value as CompanyFilter)}>
              <option value="all">Tüm firmalar</option>
              {companies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
            </select>
            <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
              <option value="all">Tüm durumlar</option>
              {TENANT_STATUSES.filter(status => status !== 'Silinmiş').map(status => <option key={status} value={status}>{status}</option>)}
            </select>
            <input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} />
            <input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table tenant-management-table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Tenant Kodu</th>
                <th>Durum</th>
                <th>Oluşturulma Tarihi</th>
                <th>Son Güncelleme</th>
                <th>İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {visibleTenants.length === 0 && (
                <tr><td colSpan={6} className="empty-cell">Filtrelere uygun tenant bulunamadı.</td></tr>
              )}
              {visibleTenants.map(tenant => (
                <tr key={tenant.id} className={selectedTenantId === tenant.id ? 'selected-row' : ''}>
                  <td>
                    <strong>{tenant.tenantName || tenant.companyName}</strong>
                    <div className="muted small-text">{companyMap.get(tenant.ownerCompanyId || tenant.companyId)?.city || '-'}</div>
                  </td>
                  <td><span className="license-key">{tenant.tenantCode}</span></td>
                  <td><span className={`status-pill ${getStatusClassName(tenant.status)}`}>{tenant.status}</span></td>
                  <td>{formatDateTime(tenant.createdAt)}</td>
                  <td>{formatDateTime(tenant.updatedAt)}</td>
                  <td className="actions-cell">
                    <button className="btn" type="button" onClick={() => selectTenant(tenant)}>Tenant Düzenle</button>
                    {tenant.status === 'Aktif'
                      ? <button className="btn" type="button" onClick={() => updateTenantStatus(tenant, 'Pasif')}>Tenant Pasife Al</button>
                      : <button className="btn" type="button" onClick={() => updateTenantStatus(tenant, 'Aktif')}>Tenant Aktif Et</button>}
                    <button className="btn" type="button" onClick={() => updateTenantStatus(tenant, 'Arşivlendi')}>Tenant Arşivle</button>
                    <button className="btn" type="button" onClick={() => selectTenant(tenant)}>Tenant Ayarları</button>
                    <button
                      className="btn"
                      type="button"
                      onClick={() => {
                        const targetTenant = tenants.find(item => item.id !== tenant.id)
                        if(targetTenant){
                          setTestSourceTenantId(tenant.id)
                          setTestTargetTenantId(targetTenant.id)
                          runIsolationForSelection(tenant.id, targetTenant.id)
                        }
                      }}
                    >
                      Veri İzolasyonunu Test Et
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="tenant-management-detail-grid">
        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>{tenantForm.id ? 'Tenant Bilgileri' : 'Yeni Tenant'}</h3>
              <p className="muted">{selectedTenant ? selectedTenant.id : 'Yeni kayıt'}</p>
            </div>
          </div>

          <form className="stacked-form" onSubmit={event => {
            event.preventDefault()
            saveTenant()
          }}>
            <div className="tenant-management-form-grid">
              <div className="form-field">
                <label>Firma</label>
                <select value={tenantForm.companyId} onChange={event => updateTenantForm('companyId', event.target.value)}>
                  <option value="">Firma seçin</option>
                  {companies.map(company => <option key={company.id} value={company.id}>{company.companyName}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Tenant Kodu</label>
                <input value={tenantForm.tenantCode} onChange={event => updateTenantForm('tenantCode', event.target.value)} />
              </div>
              <div className="form-field">
                <label>Firma Adı</label>
                <input value={tenantForm.companyName} onChange={event => updateTenantForm('companyName', event.target.value)} />
              </div>
              <div className="form-field">
                <label>Durum</label>
                <select value={tenantForm.status} onChange={event => updateTenantForm('status', event.target.value as TenantStatus)}>
                  {TENANT_STATUSES.filter(status => status !== 'Silinmiş').map(status => <option key={status} value={status}>{status}</option>)}
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn primary" type="submit">Kaydet</button>
              <button className="btn" type="button" onClick={startNewTenant}>Tenant Oluştur</button>
            </div>
          </form>

          {selectedTenant && (
            <div className="financial-summary-values tenant-management-summary">
              <div>
                <span>Tenant ID</span>
                <strong>{selectedTenant.id}</strong>
              </div>
              <div>
                <span>Firma ID</span>
                <strong>{selectedTenant.ownerCompanyId || selectedTenant.companyId}</strong>
              </div>
              <div>
                <span>Durum</span>
                <strong>{selectedTenant.status}</strong>
              </div>
              <div>
                <span>Ayar Kaydı</span>
                <strong>{selectedSettings ? 'Var' : 'Eksik'}</strong>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>Tenant Ayarları</h3>
              <p className="muted">{selectedTenant?.tenantName || selectedTenant?.companyName || 'Tenant seçin'}</p>
            </div>
          </div>

          <form className="stacked-form" onSubmit={event => {
            event.preventDefault()
            saveSelectedSettings()
          }}>
            <div className="tenant-management-settings-grid">
              <div className="form-field">
                <label>Saat Dilimi</label>
                <select value={settingsForm.timezone} onChange={event => updateSettingsForm('timezone', event.target.value)}>
                  <option value="Europe/Istanbul">Europe/Istanbul</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div className="form-field">
                <label>Para Birimi</label>
                <select value={settingsForm.currency} onChange={event => updateSettingsForm('currency', event.target.value)}>
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div className="form-field">
                <label>Dil</label>
                <select value={settingsForm.language} onChange={event => updateSettingsForm('language', event.target.value)}>
                  <option value="tr-TR">tr-TR</option>
                  <option value="en-US">en-US</option>
                  <option value="de-DE">de-DE</option>
                </select>
              </div>
              <div className="form-field">
                <label>Tarih Formatı</label>
                <select value={settingsForm.dateFormat} onChange={event => updateSettingsForm('dateFormat', event.target.value)}>
                  <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                </select>
              </div>
              <div className="form-field">
                <label>Tema</label>
                <select value={settingsForm.theme} onChange={event => updateSettingsForm('theme', event.target.value)}>
                  <option value="Varsayılan">Varsayılan</option>
                  <option value="Açık">Açık</option>
                  <option value="Koyu">Koyu</option>
                  <option value="Kontrast">Kontrast</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button className="btn primary" type="submit" disabled={!selectedTenant}>Ayarları Kaydet</button>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="section-header compact">
            <div>
              <h3>Veri İzolasyonu</h3>
              <p className="muted">Kaynak tenant görünürlüğü ve hedef tenant erişim reddi.</p>
            </div>
          </div>

          <div className="tenant-isolation-form">
            <div className="form-field">
              <label>Kaynak Tenant</label>
              <select value={testSourceTenantId} onChange={event => setTestSourceTenantId(event.target.value)}>
                {tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.tenantCode} - {tenant.tenantName || tenant.companyName}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Hedef Tenant</label>
              <select value={testTargetTenantId} onChange={event => setTestTargetTenantId(event.target.value)}>
                {tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.tenantCode} - {tenant.tenantName || tenant.companyName}</option>)}
              </select>
            </div>
            <button className="btn primary" type="button" onClick={() => runIsolationForSelection()}>Veri İzolasyonunu Test Et</button>
          </div>

          {testResult && (
            <div className={`tenant-isolation-result ${testResult.denied ? 'allowed' : 'denied'}`}>
              <span>{testResult.denied ? 'Doğrulandı' : 'Risk'}</span>
              <strong>{testResult.message}</strong>
              <div className="tenant-isolation-result-grid">
                <div>
                  <span>Görünen Kayıt</span>
                  <strong>{formatNumber(testResult.visibleRecordCount)}</strong>
                </div>
                <div>
                  <span>Engellenen Kayıt</span>
                  <strong>{testResult.blockedRecordType || '-'}</strong>
                </div>
                <div>
                  <span>Kaynak</span>
                  <strong>{testResult.sourceTenantId}</strong>
                </div>
                <div>
                  <span>Hedef</span>
                  <strong>{testResult.targetTenantId}</strong>
                </div>
              </div>
              <p className="muted small-text">{testResult.allowedRecordTypes.join(', ') || 'Kayıt bulunamadı'}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
