import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import type {
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'
import type { DashboardWidgetLayout } from '../dashboard/dashboard-widget.types'
import type { SectorTemplateAssignableModuleCode } from '../modules/module-code.registry'
import type { User } from '../types'
import {
  cloneSectorManagementSector,
  createSectorManagementSector,
  getSectorManagementCatalogs,
  loadSectorManagementSectors,
  saveSectorManagementSector,
  updateSectorManagementStatus
} from '../sector-management/sector-management.mock-repository'
import {
  SECTOR_MANAGEMENT_STATUSES,
  type SectorManagementCatalogs,
  type SectorManagementSector,
  type SectorManagementStatus,
  type SectorManagementTemplateOption
} from '../sector-management/sector-management.types'

type Props = {
  currentUser: User
}

type SectorTabKey =
  | 'general'
  | 'templates'
  | 'modules'
  | 'dashboard'
  | 'workspace'
  | 'widgets'
  | 'theme'
  | 'installation'
  | 'metadata'

const sectorTabs: Array<{ key: SectorTabKey; label: string }> = [
  { key: 'general', label: 'General' },
  { key: 'templates', label: 'Templates' },
  { key: 'modules', label: 'Modules' },
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'workspace', label: 'Workspace' },
  { key: 'widgets', label: 'Widgets' },
  { key: 'theme', label: 'Theme' },
  { key: 'installation', label: 'Installation' },
  { key: 'metadata', label: 'Metadata' }
]

const landingPageOptions: Array<{ value: BusinessWorkspaceRoute; label: string }> = [
  { value: 'summary', label: 'Kontrol Paneli' },
  { value: 'settings', label: 'Çalışma Alanı' },
  { value: 'marketplace', label: 'Modül Mağazası' },
  { value: 'products', label: 'Ürünler' },
  { value: 'stock-cards', label: 'Stok Kartları' },
  { value: 'current-accounts', label: 'Cari Hesaplar' }
]

const layoutOptions: DashboardWidgetLayout[] = ['compact', 'standard', 'wide']

const statusLabels: Record<SectorManagementStatus, string> = {
  [SECTOR_MANAGEMENT_STATUSES.DRAFT]: 'Taslak',
  [SECTOR_MANAGEMENT_STATUSES.ACTIVE]: 'Aktif',
  [SECTOR_MANAGEMENT_STATUSES.PASSIVE]: 'Pasif'
}

const getStatusClassName = (status: SectorManagementStatus) => {
  if(status === SECTOR_MANAGEMENT_STATUSES.ACTIVE) return 'success'
  if(status === SECTOR_MANAGEMENT_STATUSES.PASSIVE) return 'muted-pill'
  return 'warning-pill'
}

const formatDateTime = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'
  return `${date.toLocaleDateString('tr-TR')} ${date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}

const formatNumber = (value: number) => value.toLocaleString('tr-TR')

const findTemplateName = (
  options: SectorManagementTemplateOption[],
  id: string
) => options.find(option => option.id === id)?.name || '-'

const splitList = (value: string) => (
  value
    .split('\n')
    .map(item => item.trim())
    .filter(Boolean)
)

const SectorStatusPill = ({ status }: { status: SectorManagementStatus }) => (
  <span className={`status-pill ${getStatusClassName(status)}`}>{statusLabels[status]}</span>
)

const SectorIcon = ({ sector }: { sector: SectorManagementSector }) => (
  <span
    className="sector-management-icon"
    aria-hidden="true"
    style={{
      '--sector-primary': sector.primaryColor,
      '--sector-secondary': sector.secondaryColor
    } as React.CSSProperties}
  >
    <AppIcon source={sector.icon} label={sector.name} context={sector.id} size="SM" />
  </span>
)

const TemplateSelect = ({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: SectorManagementTemplateOption[]
  onChange: (value: string) => void
}) => (
  <div className="form-field">
    <label>{label}</label>
    <select value={value} onChange={event => onChange(event.target.value)}>
      {options.map(option => (
        <option key={option.id} value={option.id}>{option.name}</option>
      ))}
    </select>
    <p className="muted small-text">{options.find(option => option.id === value)?.description || 'Template seçimi yapılmadı.'}</p>
  </div>
)

const TextListEditor = ({
  label,
  value,
  onChange,
  helper
}: {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  helper?: string
}) => (
  <div className="form-field">
    <label>{label}</label>
    <textarea
      rows={4}
      value={value.join('\n')}
      onChange={event => onChange(splitList(event.target.value))}
    />
    {helper && <p className="muted small-text">{helper}</p>}
  </div>
)

const OptionChecklist = <TOption extends { id: string; name: string; description: string }>({
  title,
  options,
  selectedIds,
  onToggle
}: {
  title: string
  options: TOption[]
  selectedIds: string[]
  onToggle: (id: string, selected: boolean) => void
}) => (
  <section className="sector-management-checklist">
    <div className="section-header compact">
      <h3>{title}</h3>
      <span className="status-pill info-pill">{selectedIds.length}</span>
    </div>
    <div className="sector-management-option-grid">
      {options.map(option => {
        const selected = selectedIds.includes(option.id)
        return (
          <label className={`sector-management-option ${selected ? 'selected' : ''}`} key={option.id}>
            <input
              type="checkbox"
              checked={selected}
              onChange={event => onToggle(option.id, event.target.checked)}
            />
            <span>
              <strong>{option.name}</strong>
              <small>{option.description}</small>
            </span>
          </label>
        )
      })}
    </div>
  </section>
)

const ModuleChecklist = ({
  title,
  options,
  selectedCodes,
  onToggle
}: {
  title: string
  options: SectorManagementCatalogs['moduleOptions']
  selectedCodes: SectorTemplateAssignableModuleCode[]
  onToggle: (code: SectorTemplateAssignableModuleCode, selected: boolean) => void
}) => (
  <section className="sector-management-checklist">
    <div className="section-header compact">
      <h3>{title}</h3>
      <span className="status-pill info-pill">{selectedCodes.length}</span>
    </div>
    <div className="sector-management-module-grid">
      {options.map(option => {
        const selected = selectedCodes.includes(option.code)
        return (
          <label className={`sector-management-module-option ${selected ? 'selected' : ''}`} key={option.code}>
            <input
              type="checkbox"
              checked={selected}
              onChange={event => onToggle(option.code, event.target.checked)}
            />
            <span className="sector-management-module-icon" aria-hidden="true">
              <AppIcon source={option.icon} label={option.name} context={option.code} size="SM" />
            </span>
            <span>
              <strong>{option.name}</strong>
              <small>{option.registered ? 'Registry modülü' : 'Future module'} · {option.description}</small>
            </span>
          </label>
        )
      })}
    </div>
  </section>
)

const SectorList = ({
  sectors,
  selectedSectorId,
  catalogs,
  onSelect
}: {
  sectors: SectorManagementSector[]
  selectedSectorId: string
  catalogs: SectorManagementCatalogs
  onSelect: (sectorId: string) => void
}) => (
  <section className="card sector-management-list-card">
    <div className="section-header">
      <div>
        <h3>Sector Listesi</h3>
        <p className="muted">EVREN360 tarafından yönetilen mock sektör konfigürasyonları.</p>
      </div>
      <span className="status-pill info-pill">{formatNumber(sectors.length)} sektör</span>
    </div>

    <div className="table-wrap">
      <table className="data-table sector-management-table">
        <thead>
          <tr>
            <th>Icon</th>
            <th>Sector Name</th>
            <th>Slug</th>
            <th>Status</th>
            <th>Default Module Count</th>
            <th>Optional Module Count</th>
            <th>Dashboard Template</th>
            <th>Workspace Template</th>
            <th>Created Date</th>
            <th>Updated Date</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map(sector => (
            <tr
              key={sector.id}
              aria-selected={sector.id === selectedSectorId}
              onClick={() => onSelect(sector.id)}
            >
              <td><SectorIcon sector={sector} /></td>
              <td><strong>{sector.name}</strong><span className="muted small-text">{sector.description}</span></td>
              <td>{sector.slug}</td>
              <td><SectorStatusPill status={sector.status} /></td>
              <td>{sector.modules.defaultModuleCodes.length}</td>
              <td>{sector.modules.optionalModuleCodes.length}</td>
              <td>{findTemplateName(catalogs.dashboardTemplates, sector.templates.dashboardTemplateId)}</td>
              <td>{findTemplateName(catalogs.workspaceTemplates, sector.templates.workspaceTemplateId)}</td>
              <td>{formatDateTime(sector.metadata.createdAt)}</td>
              <td>{formatDateTime(sector.metadata.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
)

const SectorTabs = ({
  activeTab,
  onChange
}: {
  activeTab: SectorTabKey
  onChange: (tab: SectorTabKey) => void
}) => (
  <div className="sector-management-tabs" role="tablist" aria-label="Sector detail tabs">
    {sectorTabs.map(tab => (
      <button
        key={tab.key}
        className={activeTab === tab.key ? 'active' : ''}
        type="button"
        onClick={() => onChange(tab.key)}
      >
        {tab.label}
      </button>
    ))}
  </div>
)

export default function SectorManagementCenter({ currentUser }: Props){
  const catalogs = React.useMemo(() => getSectorManagementCatalogs(), [])
  const [sectors, setSectors] = React.useState<SectorManagementSector[]>(() => loadSectorManagementSectors())
  const [selectedSectorId, setSelectedSectorId] = React.useState(() => sectors[0]?.id || '')
  const [activeTab, setActiveTab] = React.useState<SectorTabKey>('general')
  const [message, setMessage] = React.useState('')
  const [draft, setDraft] = React.useState<SectorManagementSector | null>(() => (
    sectors[0] ? cloneSectorManagementSector(sectors[0]) : null
  ))

  const selectedSector = sectors.find(sector => sector.id === selectedSectorId) || sectors[0] || null

  React.useEffect(() => {
    if(!selectedSector) return
    setDraft(cloneSectorManagementSector(selectedSector))
    setMessage('')
  }, [selectedSector?.id])

  const refreshSectors = (nextSelectedId?: string) => {
    const nextSectors = loadSectorManagementSectors()
    setSectors(nextSectors)
    if(nextSelectedId) setSelectedSectorId(nextSelectedId)
    else if(!nextSectors.some(sector => sector.id === selectedSectorId)){
      setSelectedSectorId(nextSectors[0]?.id || '')
    }
  }

  const updateDraft = (updater: (sector: SectorManagementSector) => SectorManagementSector) => {
    setDraft(current => current ? updater(cloneSectorManagementSector(current)) : current)
  }

  const createSector = () => {
    const created = createSectorManagementSector(currentUser.fullName || currentUser.username)
    refreshSectors(created.id)
    setActiveTab('general')
    setMessage('Yeni sektör taslağı oluşturuldu.')
  }

  const saveSector = () => {
    if(!draft) return
    const saved = saveSectorManagementSector(draft, currentUser.fullName || currentUser.username)
    refreshSectors(saved.id)
    setDraft(cloneSectorManagementSector(saved))
    setMessage(`${saved.name} kaydedildi.`)
  }

  const changeStatus = (status: SectorManagementStatus) => {
    if(!draft) return
    const saved = updateSectorManagementStatus(draft.id, status, currentUser.fullName || currentUser.username)
    if(!saved) return
    refreshSectors(saved.id)
    setDraft(cloneSectorManagementSector(saved))
    setMessage(`${saved.name} durumu ${statusLabels[saved.status]} olarak güncellendi.`)
  }

  const toggleDefaultModule = (code: SectorTemplateAssignableModuleCode, selected: boolean) => {
    updateDraft(sector => ({
      ...sector,
      modules: {
        defaultModuleCodes: selected
          ? Array.from(new Set([...sector.modules.defaultModuleCodes, code]))
          : sector.modules.defaultModuleCodes.filter(item => item !== code),
        optionalModuleCodes: selected
          ? sector.modules.optionalModuleCodes.filter(item => item !== code)
          : sector.modules.optionalModuleCodes
      }
    }))
  }

  const toggleOptionalModule = (code: SectorTemplateAssignableModuleCode, selected: boolean) => {
    updateDraft(sector => ({
      ...sector,
      modules: {
        defaultModuleCodes: selected
          ? sector.modules.defaultModuleCodes.filter(item => item !== code)
          : sector.modules.defaultModuleCodes,
        optionalModuleCodes: selected
          ? Array.from(new Set([...sector.modules.optionalModuleCodes, code]))
          : sector.modules.optionalModuleCodes.filter(item => item !== code)
      }
    }))
  }

  const summary = React.useMemo(() => ({
    total: sectors.length,
    active: sectors.filter(sector => sector.status === SECTOR_MANAGEMENT_STATUSES.ACTIVE).length,
    visible: sectors.filter(sector => sector.visible).length,
    moduleLinks: sectors.reduce((total, sector) => (
      total + sector.modules.defaultModuleCodes.length + sector.modules.optionalModuleCodes.length
    ), 0)
  }), [sectors])

  if(!draft){
    return (
      <div className="sector-management-page">
        <section className="card">
          <h2>Sector Management Center</h2>
          <p className="muted">Mock repository içinde sektör kaydı bulunamadı.</p>
          <button className="btn primary" type="button" onClick={createSector}>Yeni Sektör Oluştur</button>
        </section>
      </div>
    )
  }

  return (
    <div className="sector-management-page">
      <div className="page-title">
        <div>
          <h2>Sector Management Center</h2>
          <p className="muted">Sektör, template, modül, dashboard, workspace, tema ve kurulum akışlarını EVREN360 üzerinden yönetin.</p>
        </div>
        <button className="btn primary" type="button" onClick={createSector}>Yeni Sektör</button>
      </div>

      {message && <div className="form-success">{message}</div>}

      <div className="metric-grid compact-metric-grid sector-management-kpi-grid">
        <div className="metric-card compact-metric-card"><span>Toplam Sektör</span><strong>{formatNumber(summary.total)}</strong></div>
        <div className="metric-card compact-metric-card"><span>Aktif Sektör</span><strong>{formatNumber(summary.active)}</strong></div>
        <div className="metric-card compact-metric-card"><span>Görünür Sektör</span><strong>{formatNumber(summary.visible)}</strong></div>
        <div className="metric-card compact-metric-card"><span>Modül Bağlantısı</span><strong>{formatNumber(summary.moduleLinks)}</strong></div>
      </div>

      <SectorList
        sectors={sectors}
        selectedSectorId={draft.id}
        catalogs={catalogs}
        onSelect={sectorId => {
          setSelectedSectorId(sectorId)
          setActiveTab('general')
        }}
      />

      <section className="card sector-management-detail-card">
        <div className="section-header">
          <div className="sector-management-detail-title">
            <SectorIcon sector={draft} />
            <div>
              <h3>{draft.name}</h3>
              <p className="muted">{draft.slug} · v{draft.version}</p>
            </div>
          </div>
          <div className="sector-management-actions">
            <SectorStatusPill status={draft.status} />
            <button className="btn" type="button" onClick={saveSector}>Kaydet</button>
            {draft.status !== SECTOR_MANAGEMENT_STATUSES.PASSIVE ? (
              <button className="btn warning" type="button" onClick={() => changeStatus(SECTOR_MANAGEMENT_STATUSES.PASSIVE)}>Pasife Al</button>
            ) : (
              <button className="btn primary" type="button" onClick={() => changeStatus(SECTOR_MANAGEMENT_STATUSES.ACTIVE)}>Aktif Yap</button>
            )}
          </div>
        </div>

        <SectorTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'general' && (
          <div className="sector-management-form-grid">
            <div className="form-field">
              <label>Sector Name</label>
              <input value={draft.name} onChange={event => updateDraft(sector => ({ ...sector, name: event.target.value }))} />
            </div>
            <div className="form-field">
              <label>Slug</label>
              <input value={draft.slug} onChange={event => updateDraft(sector => ({ ...sector, slug: event.target.value }))} />
            </div>
            <div className="form-field sector-management-wide">
              <label>Description</label>
              <textarea rows={3} value={draft.description} onChange={event => updateDraft(sector => ({ ...sector, description: event.target.value }))} />
            </div>
            <div className="form-field">
              <label>Icon</label>
              <input value={draft.icon} maxLength={3} onChange={event => updateDraft(sector => ({ ...sector, icon: event.target.value.toLocaleUpperCase('tr-TR') }))} />
            </div>
            <div className="form-field">
              <label>Primary Color</label>
              <input type="color" value={draft.primaryColor} onChange={event => updateDraft(sector => ({ ...sector, primaryColor: event.target.value }))} />
            </div>
            <div className="form-field">
              <label>Secondary Color</label>
              <input type="color" value={draft.secondaryColor} onChange={event => updateDraft(sector => ({ ...sector, secondaryColor: event.target.value }))} />
            </div>
            <div className="form-field">
              <label>Status</label>
              <select value={draft.status} onChange={event => updateDraft(sector => ({ ...sector, status: event.target.value as SectorManagementStatus }))}>
                {Object.values(SECTOR_MANAGEMENT_STATUSES).map(status => (
                  <option key={status} value={status}>{statusLabels[status]}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Version</label>
              <input value={draft.version} onChange={event => updateDraft(sector => ({ ...sector, version: event.target.value }))} />
            </div>
            <label className="sector-management-toggle">
              <input
                type="checkbox"
                checked={draft.visible}
                onChange={event => updateDraft(sector => ({ ...sector, visible: event.target.checked }))}
              />
              <span>Visible</span>
            </label>
            <div className="form-field">
              <label>Ordering</label>
              <input type="number" value={draft.ordering} onChange={event => updateDraft(sector => ({ ...sector, ordering: Number(event.target.value) }))} />
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="sector-management-form-grid">
            <TemplateSelect label="Dashboard Template" value={draft.templates.dashboardTemplateId} options={catalogs.dashboardTemplates} onChange={value => updateDraft(sector => ({ ...sector, templates: { ...sector.templates, dashboardTemplateId: value } }))} />
            <TemplateSelect label="Workspace Template" value={draft.templates.workspaceTemplateId} options={catalogs.workspaceTemplates} onChange={value => updateDraft(sector => ({ ...sector, templates: { ...sector.templates, workspaceTemplateId: value } }))} />
            <TemplateSelect label="Widget Template" value={draft.templates.widgetTemplateId} options={catalogs.widgetTemplates} onChange={value => updateDraft(sector => ({ ...sector, templates: { ...sector.templates, widgetTemplateId: value } }))} />
            <TemplateSelect label="Menu Template" value={draft.templates.menuTemplateId} options={catalogs.menuTemplates} onChange={value => updateDraft(sector => ({ ...sector, templates: { ...sector.templates, menuTemplateId: value } }))} />
            <TemplateSelect label="Installation Wizard" value={draft.templates.installationWizardId} options={catalogs.installationWizards} onChange={value => updateDraft(sector => ({ ...sector, templates: { ...sector.templates, installationWizardId: value } }))} />
            <TemplateSelect label="Theme Template" value={draft.templates.themeTemplateId} options={catalogs.themeTemplates} onChange={value => updateDraft(sector => ({ ...sector, templates: { ...sector.templates, themeTemplateId: value } }))} />
          </div>
        )}

        {activeTab === 'modules' && (
          <div className="sector-management-two-column">
            <ModuleChecklist
              title="Default Modules"
              options={catalogs.moduleOptions}
              selectedCodes={draft.modules.defaultModuleCodes}
              onToggle={toggleDefaultModule}
            />
            <ModuleChecklist
              title="Optional Modules"
              options={catalogs.moduleOptions}
              selectedCodes={draft.modules.optionalModuleCodes}
              onToggle={toggleOptionalModule}
            />
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="sector-management-two-column">
            <OptionChecklist
              title="Default Widgets"
              options={catalogs.widgetOptions}
              selectedIds={draft.dashboard.defaultWidgetIds}
              onToggle={(id, selected) => updateDraft(sector => ({
                ...sector,
                dashboard: {
                  ...sector.dashboard,
                  defaultWidgetIds: selected
                    ? Array.from(new Set([...sector.dashboard.defaultWidgetIds, id]))
                    : sector.dashboard.defaultWidgetIds.filter(item => item !== id),
                  widgetOrder: selected
                    ? Array.from(new Set([...sector.dashboard.widgetOrder, id]))
                    : sector.dashboard.widgetOrder.filter(item => item !== id)
                }
              }))}
            />
            <div className="sector-management-form-grid single">
              <TextListEditor label="Widget Order" value={draft.dashboard.widgetOrder} onChange={value => updateDraft(sector => ({ ...sector, dashboard: { ...sector.dashboard, widgetOrder: value } }))} helper="Her satır bir widget id olacak şekilde sıralanır." />
              <TextListEditor label="Widget Groups" value={draft.dashboard.widgetGroups} onChange={value => updateDraft(sector => ({ ...sector, dashboard: { ...sector.dashboard, widgetGroups: value } }))} />
              <div className="form-field">
                <label>Default Layout</label>
                <select value={draft.dashboard.defaultLayout} onChange={event => updateDraft(sector => ({ ...sector, dashboard: { ...sector.dashboard, defaultLayout: event.target.value as DashboardWidgetLayout } }))}>
                  {layoutOptions.map(layout => <option key={layout} value={layout}>{layout}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'workspace' && (
          <div className="sector-management-two-column">
            <div className="sector-management-form-grid single">
              <TemplateSelect label="Default Menu" value={draft.workspace.defaultMenuId} options={catalogs.menuTemplates} onChange={value => updateDraft(sector => ({ ...sector, workspace: { ...sector.workspace, defaultMenuId: value } }))} />
              <div className="form-field">
                <label>Default Landing Page</label>
                <select value={draft.workspace.defaultLandingPage} onChange={event => updateDraft(sector => ({ ...sector, workspace: { ...sector.workspace, defaultLandingPage: event.target.value as BusinessWorkspaceRoute } }))}>
                  {landingPageOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <OptionChecklist
                title="Pinned Screens"
                options={catalogs.menuOptions}
                selectedIds={draft.workspace.pinnedScreens}
                onToggle={(id, selected) => updateDraft(sector => ({
                  ...sector,
                  workspace: {
                    ...sector.workspace,
                    pinnedScreens: selected
                      ? Array.from(new Set([...sector.workspace.pinnedScreens, id as BusinessWorkspaceNavKey]))
                      : sector.workspace.pinnedScreens.filter(item => item !== id)
                  }
                }))}
              />
            </div>
            <OptionChecklist
              title="Quick Actions"
              options={catalogs.quickActionOptions}
              selectedIds={draft.workspace.quickActionIds}
              onToggle={(id, selected) => updateDraft(sector => ({
                ...sector,
                workspace: {
                  ...sector.workspace,
                  quickActionIds: selected
                    ? Array.from(new Set([...sector.workspace.quickActionIds, id]))
                    : sector.workspace.quickActionIds.filter(item => item !== id)
                }
              }))}
            />
          </div>
        )}

        {activeTab === 'widgets' && (
          <div className="sector-management-form-grid">
            <TemplateSelect label="Widget Template" value={draft.templates.widgetTemplateId} options={catalogs.widgetTemplates} onChange={value => updateDraft(sector => ({ ...sector, templates: { ...sector.templates, widgetTemplateId: value } }))} />
            <TextListEditor label="Widget Groups" value={draft.dashboard.widgetGroups} onChange={value => updateDraft(sector => ({ ...sector, dashboard: { ...sector.dashboard, widgetGroups: value } }))} />
            <TextListEditor label="Widget Order" value={draft.dashboard.widgetOrder} onChange={value => updateDraft(sector => ({ ...sector, dashboard: { ...sector.dashboard, widgetOrder: value } }))} />
            <div className="sector-management-wide">
              <OptionChecklist
                title="Default Widgets"
                options={catalogs.widgetOptions}
                selectedIds={draft.dashboard.defaultWidgetIds}
                onToggle={(id, selected) => updateDraft(sector => ({
                  ...sector,
                  dashboard: {
                    ...sector.dashboard,
                    defaultWidgetIds: selected
                      ? Array.from(new Set([...sector.dashboard.defaultWidgetIds, id]))
                      : sector.dashboard.defaultWidgetIds.filter(item => item !== id)
                  }
                }))}
              />
            </div>
          </div>
        )}

        {activeTab === 'theme' && (
          <div className="sector-management-form-grid">
            {(['primary', 'secondary', 'success', 'warning', 'danger', 'background'] as const).map(colorKey => (
              <div className="form-field" key={colorKey}>
                <label>{colorKey}</label>
                <input type="color" value={draft.theme[colorKey]} onChange={event => updateDraft(sector => ({ ...sector, theme: { ...sector.theme, [colorKey]: event.target.value } }))} />
              </div>
            ))}
            <div className="form-field">
              <label>Logo</label>
              <input value={draft.theme.logo} placeholder="Mock logo URL" onChange={event => updateDraft(sector => ({ ...sector, theme: { ...sector.theme, logo: event.target.value } }))} />
            </div>
            <div className="form-field">
              <label>Login Background</label>
              <input value={draft.theme.loginBackground} placeholder="Mock background URL" onChange={event => updateDraft(sector => ({ ...sector, theme: { ...sector.theme, loginBackground: event.target.value } }))} />
            </div>
          </div>
        )}

        {activeTab === 'installation' && (
          <div className="sector-management-form-grid">
            {([
              ['welcomeScreen', 'Welcome Screen'],
              ['businessInfoStep', 'Business Info Step'],
              ['recommendationStep', 'Recommendation Step'],
              ['optionalModulesStep', 'Optional Modules Step'],
              ['summaryStep', 'Summary Step'],
              ['onboardingFlow', 'Onboarding Flow']
            ] as const).map(([key, label]) => (
              <TemplateSelect
                key={key}
                label={label}
                value={draft.installation[key]}
                options={catalogs.installationStepOptions}
                onChange={value => updateDraft(sector => ({ ...sector, installation: { ...sector.installation, [key]: value } }))}
              />
            ))}
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="sector-management-form-grid">
            <div className="sector-management-readonly"><span>Created By</span><strong>{draft.metadata.createdBy}</strong></div>
            <div className="sector-management-readonly"><span>Created Date</span><strong>{formatDateTime(draft.metadata.createdAt)}</strong></div>
            <div className="sector-management-readonly"><span>Updated By</span><strong>{draft.metadata.updatedBy}</strong></div>
            <div className="sector-management-readonly"><span>Updated Date</span><strong>{formatDateTime(draft.metadata.updatedAt)}</strong></div>
            <div className="sector-management-readonly"><span>Version</span><strong>{draft.version}</strong></div>
            <div className="form-field sector-management-wide">
              <label>Internal Notes</label>
              <textarea rows={5} value={draft.metadata.internalNotes} onChange={event => updateDraft(sector => ({ ...sector, metadata: { ...sector.metadata, internalNotes: event.target.value } }))} />
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
