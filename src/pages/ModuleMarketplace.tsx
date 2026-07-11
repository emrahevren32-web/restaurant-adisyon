import React from 'react'
import ModuleSetupWizard from '../components/ModuleSetupWizard'
import {
  getMarketplaceCatalog,
  getMarketplaceFilterOptions
} from '../marketplace/module-marketplace.service'
import { getMarketplaceCatalogTabs } from '../marketplace/marketplace-tab.registry'
import {
  countMarketplaceModulesByWorkspaceCategory,
  filterMarketplaceModulesByWorkspaceCategory,
  getMarketplaceWorkspaceCategories,
  resolveMarketplaceWorkspaceCategory,
  type MarketplaceWorkspaceCategoryKey
} from '../marketplace/marketplace-category.registry'
import {
  getMarketplaceModuleActions,
  type MarketplaceModuleActionDefinition
} from '../marketplace/marketplace-module-actions.service'
import type { MarketplaceContext } from '../marketplace/module-marketplace.service'
import type {
  MarketplaceCatalogTab,
  MarketplaceModule,
  MarketplaceModuleState
} from '../marketplace/marketplace.types'
import { getBusinessWorkspaceModuleById } from '../modules/business-workspace.registry'
import type { WorkspaceModuleType } from '../modules/module-registry.types'
import type { User } from '../types'
import {
  activateWorkspaceModuleForUser,
  detachWorkspaceModuleFromWorkspaceForUser,
  getWorkspaceModuleLifecycleStateForUser,
  installWorkspaceModuleForUser,
  suspendWorkspaceModuleForUser,
  type WorkspaceModuleLifecycleResult
} from '../workspace/workspace-module-lifecycle.service'
import {
  completeModuleSetupWizardSession,
  startModuleSetupWizardForInstallResult,
  startModuleSetupWizardForModule
} from '../workspace/module-setup-wizard.service'
import type { ModuleSetupWizardSession } from '../workspace/module-setup-wizard.types'

type Props = {
  currentUser: User
  onModuleLifecycleChanged: (result: WorkspaceModuleLifecycleResult) => void
}

const stateLabels: Record<MarketplaceModuleState, string> = {
  AVAILABLE: 'Kur',
  INSTALLED: 'Kurulu',
  CONFIGURED: 'Kurulu',
  ACTIVE: 'Kurulu',
  SUSPENDED: 'Kurulu',
  UNINSTALLED: 'Kurulu Değil',
  DISABLED: 'Desteklenmiyor',
  COMING_SOON: 'Yakında'
}

const moduleTypeLabels: Record<WorkspaceModuleType, string> = {
  'core-system': 'Sistem',
  business: 'İş Modülü',
  integration: 'Entegrasyon'
}

const getCardDisplayState = (module: MarketplaceModule) => {
  if(module.installState === 'COMING_SOON') return { label: 'Yakında', className: 'warning-pill' }
  if(module.installState === 'DISABLED') return { label: 'Desteklenmiyor', className: 'muted-pill' }
  if(module.installState === 'AVAILABLE' || module.installState === 'UNINSTALLED') return { label: 'Kur', className: 'info-pill' }
  return { label: 'Kurulu', className: 'success' }
}

const getTabCount = (tab: MarketplaceCatalogTab, modules: MarketplaceModule[]) => {
  if(tab === 'all') return modules.length
  if(tab === 'recommended') return modules.filter(module => module.installState === 'AVAILABLE').length
  if(tab === 'installed') return modules.filter(module => (
    module.installState === 'INSTALLED'
    || module.installState === 'CONFIGURED'
    || module.installState === 'ACTIVE'
    || module.installState === 'SUSPENDED'
  )).length
  if(tab === 'suspended') return modules.filter(module => module.installState === 'SUSPENDED').length
  if(tab === 'not-installed') return modules.filter(module => (
    module.installState === 'AVAILABLE'
    || module.installState === 'UNINSTALLED'
  )).length
  return modules.filter(module => module.installState === 'COMING_SOON').length
}

const getBadgeClassName = (type: MarketplaceModule['badges'][number]['type']) => {
  if(type === 'installed' || type === 'configured' || type === 'active') return 'success'
  if(type === 'recommended') return 'info-pill'
  if(type === 'coming-soon' || type === 'suspended') return 'warning-pill'
  if(type === 'disabled' || type === 'uninstalled') return 'muted-pill'
  return 'new'
}

const getActionButtonClassName = (action: MarketplaceModuleActionDefinition) => {
  if(action.variant === 'primary') return 'primary'
  if(action.variant === 'warning') return 'warning'
  if(action.variant === 'danger') return 'danger'
  return ''
}

export default function ModuleMarketplace({ currentUser, onModuleLifecycleChanged }: Props){
  const [search, setSearch] = React.useState('')
  const [workspaceCategory, setWorkspaceCategory] = React.useState<MarketplaceWorkspaceCategoryKey>('all')
  const [moduleType, setModuleType] = React.useState<WorkspaceModuleType | 'all'>('all')
  const [state, setState] = React.useState<MarketplaceModuleState | 'all'>('all')
  const [activeTab, setActiveTab] = React.useState<MarketplaceCatalogTab>('recommended')
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [message, setMessage] = React.useState('')
  const [error, setError] = React.useState('')
  const [activeSetupSession, setActiveSetupSession] = React.useState<ModuleSetupWizardSession | null>(null)
  const [managedModule, setManagedModule] = React.useState<MarketplaceModule | null>(null)

  const marketplaceContext = React.useMemo<MarketplaceContext>(() => ({
    getLifecycleState: module => getWorkspaceModuleLifecycleStateForUser(currentUser, module)
  }), [currentUser, refreshKey])

  const allModules = React.useMemo(() => (
    getMarketplaceCatalog({}, marketplaceContext)
  ), [marketplaceContext])

  const filterOptions = React.useMemo(() => (
    getMarketplaceFilterOptions(marketplaceContext)
  ), [marketplaceContext])

  const catalogTabs = React.useMemo(() => getMarketplaceCatalogTabs(), [])
  const workspaceCategories = React.useMemo(() => getMarketplaceWorkspaceCategories(), [])

  const catalogModules = React.useMemo(() => (
    getMarketplaceCatalog({
      search,
      moduleType,
      state,
      tab: activeTab
    }, marketplaceContext)
  ), [activeTab, marketplaceContext, moduleType, search, state])

  const modules = React.useMemo(() => (
    filterMarketplaceModulesByWorkspaceCategory(catalogModules, workspaceCategory)
  ), [catalogModules, workspaceCategory])

  const activeWorkspaceCategory = workspaceCategories.find(item => item.key === workspaceCategory) || workspaceCategories[0]

  const installedCount = allModules.filter(module => (
    module.installState === 'INSTALLED'
    || module.installState === 'CONFIGURED'
    || module.installState === 'ACTIVE'
  )).length
  const suspendedCount = allModules.filter(module => module.installState === 'SUSPENDED').length
  const availableCount = allModules.filter(module => module.installState === 'AVAILABLE' || module.installState === 'UNINSTALLED').length
  const comingSoonCount = allModules.filter(module => module.installState === 'COMING_SOON').length

  const refreshLifecycle = (result: WorkspaceModuleLifecycleResult, nextMessage: string) => {
    setRefreshKey(current => current + 1)
    setMessage(nextMessage)
    setError('')
    onModuleLifecycleChanged(result)
  }

  const startConfiguration = (module: MarketplaceModule) => {
    const moduleDefinition = getBusinessWorkspaceModuleById(module.id)
    if(!moduleDefinition){
      setError('Modül kaydı bulunamadı.')
      return
    }

    setMessage(`${module.name} başlangıç sihirbazı açıldı.`)
    setError('')
    setActiveSetupSession(startModuleSetupWizardForModule(currentUser, moduleDefinition))
  }

  const performLifecycleAction = (
    module: MarketplaceModule,
    action: MarketplaceModuleActionDefinition
  ) => {
    if(action.disabled) return

    setMessage('')
    setError('')

    try {
      if(action.key === 'install'){
        const installResult = installWorkspaceModuleForUser(currentUser, module.id)
        if(installResult.alreadyInstalled){
          refreshLifecycle(installResult, `${module.name} zaten kurulu.`)
          return
        }

        completeModuleSetupWizardSession(currentUser, startModuleSetupWizardForInstallResult(currentUser, installResult))
        const activationResult = activateWorkspaceModuleForUser(currentUser, module.id)
        refreshLifecycle(activationResult, `${module.name} kuruldu ve çalışma alanına eklendi.`)
        setManagedModule({ ...module, installState: 'ACTIVE' })
        return
      }

      if(action.key === 'configure'){
        startConfiguration(module)
        return
      }

      if(action.key === 'manage'){
        setManagedModule(module)
        setMessage(`${module.name} yönetim bilgileri açıldı.`)
        return
      }

      if(action.key === 'activate' || action.key === 'reactivate'){
        const result = activateWorkspaceModuleForUser(currentUser, module.id)
        refreshLifecycle(result, action.key === 'reactivate'
          ? `${module.name} yeniden aktifleştirildi. Menü ve kontrol paneli widget kataloğu güncellendi.`
          : `${module.name} aktifleştirildi. Menü ve kontrol paneli widget kataloğu güncellendi.`
        )
        setManagedModule(current => current?.id === module.id ? { ...current, installState: 'ACTIVE' } : current)
        return
      }

      if(action.key === 'suspend'){
        const result = suspendWorkspaceModuleForUser(currentUser, module.id)
        refreshLifecycle(result, `${module.name} pasife alındı. Menüden ve kontrol paneli seçeneklerinden kaldırıldı.`)
        setManagedModule(current => current?.id === module.id ? { ...current, installState: 'SUSPENDED' } : current)
        return
      }

      if(action.key === 'detach-from-workspace'){
        const result = detachWorkspaceModuleFromWorkspaceForUser(currentUser, module.id)
        setActiveSetupSession(current => current?.module.id === module.id ? null : current)
        setManagedModule(current => current?.id === module.id ? null : current)
        refreshLifecycle(result, `${module.name} verileri silinmeden bu çalışma alanından kaldırıldı.`)
      }
    } catch(lifecycleError) {
      setError(lifecycleError instanceof Error ? lifecycleError.message : 'Modül yaşam döngüsü güncellenemedi.')
    }
  }

  const completeSetupWizard = () => {
    if(!activeSetupSession) return

    completeModuleSetupWizardSession(currentUser, activeSetupSession)
    const activationResult = activateWorkspaceModuleForUser(currentUser, activeSetupSession.module.id)
    setActiveSetupSession(null)
    refreshLifecycle(
      activationResult,
      `${activeSetupSession.module.name} yapılandırıldı ve çalışma alanı menüsüne eklendi.`
    )
  }

  return (
    <div className="module-marketplace-page">
      <section className="marketplace-hero">
        <div>
          <span className="status-pill info-pill">MIYOP Modül Mağazası</span>
          <h2>İşletme çalışma alanı yönetim merkezi</h2>
          <p>İhtiyacınız olan modülleri keşfedin, kurun ve çalışma alanı içinde yönetin.</p>
        </div>
        <div className="marketplace-hero-stats">
          <span>{allModules.length} modül</span>
          <strong>{installedCount + suspendedCount} yönetilen</strong>
        </div>
      </section>

      {message && <div className="form-success">{message}</div>}
      {error && <div className="form-error">{error}</div>}

      {activeSetupSession && (
        <ModuleSetupWizard session={activeSetupSession} onComplete={completeSetupWizard} />
      )}

      {managedModule && (
        <section className="module-setup-wizard" aria-label={`${managedModule.name} yönetimi`}>
          <div className="module-setup-wizard-header">
            <span className="marketplace-module-icon" aria-hidden="true">{managedModule.icon}</span>
            <div>
              <span className="status-pill success">Kurulu</span>
              <h3>{managedModule.name} Yönetimi</h3>
              <p>{managedModule.name} bu çalışma alanına bağlı. Modülü pasife alabilir, tekrar aktif edebilir veya çalışma alanından kaldırabilirsiniz.</p>
            </div>
          </div>
          <div className="marketplace-card-meta">
            <span>{managedModule.category}</span>
            <span>{managedModule.developer}</span>
            <span>v{managedModule.version}</span>
          </div>
          <div className="module-setup-placeholder">
            <strong>Yönetim ekranı hazır</strong>
            <span>Detaylı modül ayarları sonraki fazlarda bu alana bağlanacak.</span>
          </div>
        </section>
      )}

      {installedCount === 0 && suspendedCount === 0 && (
        <section className="marketplace-first-install">
          <div>
            <span className="status-pill warning-pill">İlk Kurulum</span>
            <h3>Henüz hiçbir modül kurulu değil.</h3>
            <p>Platformu kullanmaya başlamak için ilk modülünüzü kurabilirsiniz.</p>
          </div>
        </section>
      )}

      <section className="marketplace-category-section" aria-label="Modül mağazası kategorileri">
        <div className="marketplace-section-heading">
          <div>
            <h3>Kategori Seçimi</h3>
            <p className="muted">Önce iş alanını seçin, ardından sekme, arama ve durum filtreleriyle modülleri daraltın.</p>
          </div>
          <span className="status-pill muted-pill">{activeWorkspaceCategory.label}</span>
        </div>
        <div className="marketplace-category-grid">
          {workspaceCategories.map(item => (
            <button
              key={item.key}
              type="button"
              className={`marketplace-category-card ${workspaceCategory === item.key ? 'active' : ''}`}
              onClick={() => setWorkspaceCategory(item.key)}
            >
              <strong>{item.label}</strong>
              <span>{item.description}</span>
              <em>{countMarketplaceModulesByWorkspaceCategory(allModules, item.key)}</em>
            </button>
          ))}
        </div>
      </section>

      <div className="metric-grid report-center-kpi-grid marketplace-kpi-grid">
        <div className="metric-card report-kpi-card">
          <span>Kurulu</span>
          <strong>{installedCount}</strong>
          <p className="muted">Kurulu, yapılandırılmış veya aktif modüller</p>
        </div>
        <div className="metric-card report-kpi-card">
          <span>Pasif</span>
          <strong>{suspendedCount}</strong>
          <p className="muted">Verileri korunarak geçici kapatılan modüller</p>
        </div>
        <div className="metric-card report-kpi-card">
          <span>Kurulu Değil</span>
          <strong>{availableCount}</strong>
          <p className="muted">Kurulabilir veya tekrar kurulabilir modüller</p>
        </div>
        <div className="metric-card report-kpi-card">
          <span>Yakında</span>
          <strong>{comingSoonCount}</strong>
          <p className="muted">Katalogda hazırlık aşamasında</p>
        </div>
      </div>

      <div className="marketplace-tabs" role="tablist" aria-label="Modül mağazası sekmeleri">
        {catalogTabs.map(tab => (
          <button
            key={tab.key}
            type="button"
            className={`report-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            <strong>{tab.label}</strong>
            <span>{tab.description}</span>
            <em>{getTabCount(tab.key, allModules)}</em>
          </button>
        ))}
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

      <div className="marketplace-section-heading">
        <div>
          <h3>{activeWorkspaceCategory.label}</h3>
          <p className="muted">Seçtiğiniz modüller çalışma alanı menüsüne ve kontrol paneli seçeneklerinize bağlanır.</p>
        </div>
        <span className="status-pill muted-pill">{modules.length} sonuç</span>
      </div>

      <section className="marketplace-grid" aria-label="Modül mağazası kataloğu">
        {modules.map(module => {
          const actions = getMarketplaceModuleActions(module)
          const displayState = getCardDisplayState(module)
          const categoryDefinition = resolveMarketplaceWorkspaceCategory(module)

          return (
            <article className="marketplace-card" key={module.id}>
              <div className="marketplace-card-header">
                <span className="marketplace-module-icon" aria-hidden="true">{module.icon}</span>
                <div>
                  <div className="marketplace-card-badges">
                    {module.badges.map(badge => (
                      <span key={`${module.id}-${badge.type}`} className={`marketplace-badge ${getBadgeClassName(badge.type)}`}>
                        {badge.label}
                      </span>
                    ))}
                  </div>
                  <h3>{module.name}</h3>
                  <p>{module.shortDescription}</p>
                </div>
              </div>
              <div className="marketplace-card-meta">
                <span className={`status-pill ${displayState.className}`}>{displayState.label}</span>
                <span>{categoryDefinition.label}</span>
                <span>{moduleTypeLabels[module.moduleType]}</span>
                <span>v{module.version}</span>
              </div>
              {module.tags.length > 0 && (
                <div className="marketplace-tags" aria-label={`${module.name} etiketleri`}>
                  {module.tags.slice(0, 4).map(tag => <span key={`${module.id}-${tag}`}>{tag}</span>)}
                </div>
              )}
              <div className="marketplace-card-footer">
                <span>{module.developer}</span>
                <span>{module.workspaceConnection.autoMenuActivationReady ? 'Çalışma alanı bağlantısı hazır' : 'Bağlantı yakında'}</span>
              </div>
              <div className="marketplace-card-actions">
                {actions.map(action => (
                  <button
                    key={`${module.id}-${action.key}`}
                    className={`btn marketplace-install-button ${getActionButtonClassName(action)}`}
                    type="button"
                    disabled={action.disabled}
                    onClick={() => performLifecycleAction(module, action)}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </article>
          )
        })}
        {modules.length === 0 && (
          <div className="empty-state marketplace-empty">
            <strong>Modül bulunamadı</strong>
            <span>Arama, sekme veya filtreleri değiştirerek kataloğu tekrar görüntüleyin.</span>
          </div>
        )}
      </section>
    </div>
  )
}
