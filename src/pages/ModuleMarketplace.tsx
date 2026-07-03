import React from 'react'
import { canUserAccessLicensedModule } from '../storage'
import type { User } from '../types'
import {
  getMarketplaceCatalog,
  getMarketplaceFilterOptions
} from '../marketplace/module-marketplace.service'
import type { MarketplaceContext } from '../marketplace/module-marketplace.service'
import type {
  MarketplaceModuleState
} from '../marketplace/marketplace.types'
import type { WorkspaceModuleType } from '../modules/module-registry.types'

type Props = {
  currentUser: User
}

const stateLabels: Record<MarketplaceModuleState, string> = {
  AVAILABLE: 'Uygun',
  INSTALLED: 'Kurulu',
  LICENSED: 'Lisanslı',
  DISABLED: 'Pasif',
  COMING_SOON: 'Yakında'
}

const moduleTypeLabels: Record<WorkspaceModuleType, string> = {
  'core-system': 'Sistem',
  business: 'İş Modülü',
  integration: 'Entegrasyon'
}

const stateClassNames: Record<MarketplaceModuleState, string> = {
  AVAILABLE: 'info-pill',
  INSTALLED: 'success',
  LICENSED: 'success',
  DISABLED: 'muted-pill',
  COMING_SOON: 'warning-pill'
}

export default function ModuleMarketplace({ currentUser }: Props){
  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState('all')
  const [moduleType, setModuleType] = React.useState<WorkspaceModuleType | 'all'>('all')
  const [state, setState] = React.useState<MarketplaceModuleState | 'all'>('all')

  const marketplaceContext = React.useMemo<MarketplaceContext>(() => ({
    isLicensed: module => Boolean(
      module.licenseModuleKey
      && canUserAccessLicensedModule(currentUser, module.licenseModuleKey)
    )
  }), [currentUser])

  const filterOptions = React.useMemo(() => (
    getMarketplaceFilterOptions(marketplaceContext)
  ), [marketplaceContext])

  const modules = React.useMemo(() => (
    getMarketplaceCatalog({
      search,
      category,
      moduleType,
      state
    }, marketplaceContext)
  ), [category, marketplaceContext, moduleType, search, state])

  const licensedCount = modules.filter(module => module.licenseState === 'LICENSED').length
  const availableCount = modules.filter(module => module.installState === 'AVAILABLE').length
  const comingSoonCount = modules.filter(module => module.installState === 'COMING_SOON').length

  return (
    <div className="module-marketplace-page">
      <div className="page-title">
        <div>
          <h2>Marketplace</h2>
          <p>Business Workspace için lisanslanabilir iş ve entegrasyon modüllerini inceleyin.</p>
        </div>
      </div>

      <div className="metric-grid report-center-kpi-grid">
        <div className="metric-card report-kpi-card">
          <span>Modül Kataloğu</span>
          <strong>{modules.length}</strong>
          <p className="muted">Registry üzerinden gelen görünür modüller</p>
        </div>
        <div className="metric-card report-kpi-card">
          <span>Lisanslanan</span>
          <strong>{licensedCount}</strong>
          <p className="muted">Workspace menüsüne otomatik bağlanabilir</p>
        </div>
        <div className="metric-card report-kpi-card">
          <span>Uygun</span>
          <strong>{availableCount}</strong>
          <p className="muted">Satın alma altyapısı için hazır</p>
        </div>
        <div className="metric-card report-kpi-card">
          <span>Yakında</span>
          <strong>{comingSoonCount}</strong>
          <p className="muted">Katalogda hazırlık aşamasında</p>
        </div>
      </div>

      <div className="report-toolbar marketplace-toolbar">
        <label>
          <span>Arama</span>
          <input
            value={search}
            placeholder="Modül adı, etiket veya açıklama"
            onChange={event => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span>Kategori</span>
          <select value={category} onChange={event => setCategory(event.target.value)}>
            <option value="all">Tüm kategoriler</option>
            {filterOptions.categories.map(item => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Modül Tipi</span>
          <select value={moduleType} onChange={event => setModuleType(event.target.value as WorkspaceModuleType | 'all')}>
            <option value="all">Tüm tipler</option>
            {filterOptions.moduleTypes.map(item => (
              <option key={item} value={item}>{moduleTypeLabels[item]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Durum</span>
          <select value={state} onChange={event => setState(event.target.value as MarketplaceModuleState | 'all')}>
            <option value="all">Tüm durumlar</option>
            {filterOptions.states.map(item => (
              <option key={item} value={item}>{stateLabels[item]}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="marketplace-grid" aria-label="Marketplace modül kataloğu">
        {modules.map(module => (
          <article className="marketplace-card" key={module.id}>
            <div className="marketplace-card-header">
              <span className="marketplace-module-icon" aria-hidden="true">{module.icon}</span>
              <div>
                <h3>{module.name}</h3>
                <p>{module.shortDescription}</p>
              </div>
            </div>
            <div className="marketplace-card-meta">
              <span className={`status-pill ${stateClassNames[module.installState]}`}>{stateLabels[module.installState]}</span>
              <span>{moduleTypeLabels[module.moduleType]}</span>
              <span>v{module.version}</span>
            </div>
            <div className="marketplace-tags">
              {module.tags.slice(0, 5).map(tag => <span key={tag}>{tag}</span>)}
            </div>
            <div className="marketplace-card-footer">
              <span>{module.developer}</span>
              <span>{module.workspaceConnection.autoMenuActivationReady ? 'Workspace bağlantısı hazır' : 'Bağlantı planlanıyor'}</span>
            </div>
          </article>
        ))}
        {modules.length === 0 && (
          <div className="empty-state marketplace-empty">
            <strong>Modül bulunamadı</strong>
            <span>Arama veya filtreleri değiştirerek kataloğu tekrar görüntüleyin.</span>
          </div>
        )}
      </section>
    </div>
  )
}
