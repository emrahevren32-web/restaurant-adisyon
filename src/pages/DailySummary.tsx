import React from 'react'
import {
  DashboardExperienceHeader
} from '../components/DashboardExperience'
import { AppIcon } from '../design-system/IconSystem'
import {
  addDashboardWidget,
  DASHBOARD_WIDGET_LAYOUT_EVENT,
  getDashboardWidgetContainer,
  removeDashboardWidget,
  setDashboardWidgetVisibility
} from '../dashboard/dashboard-widget.service'
import type {
  DashboardWidgetCatalogItem,
  DashboardWidgetContainer,
  DashboardWidgetViewModel
} from '../dashboard/dashboard-widget.types'
import {
  WORKSPACE_TEMPLATE_ACTION_TYPES,
  WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS,
  type WorkspaceTemplateEmptyState,
  type WorkspaceTemplateQuickAction
} from '../workspace-template/workspace-template.types'
import { WORKSPACE_PROVISIONING_EVENT } from '../workspace-provisioning/workspace-provisioning.service'
import {
  getManagedWorkspaceModulesForUser,
  WORKSPACE_MODULE_LIFECYCLE_EVENT
} from '../workspace/workspace-module-lifecycle.service'
import type { User } from '../types'

type Props = {
  currentUser: User
  onOpenMarketplace: () => void
  onOpenWorkspaceSettings?: () => void
}

const getCatalogActionLabel = (widget: DashboardWidgetCatalogItem) => {
  if(widget.added && widget.visibleInDashboard) return 'Eklendi'
  if(widget.added && !widget.visibleInDashboard) return 'Göster'
  return 'Ekle'
}

const hasManagedBusinessModules = (user: User) => (
  getManagedWorkspaceModulesForUser(user).some(module => module.isBusinessModule)
)

const getEmptyState = (
  container: DashboardWidgetContainer,
  key: WorkspaceTemplateEmptyState['key']
) => container.emptyStates.find(state => state.key === key)

const getQuickActionButtonClassName = (action: WorkspaceTemplateQuickAction) => (
  action.actionType === WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_MARKETPLACE ? 'btn primary' : 'btn'
)

const WidgetCard = ({
  widget,
  onHide,
  onRemove
}: {
  widget: DashboardWidgetViewModel
  onHide: (widgetId: string) => void
  onRemove: (widgetId: string) => void
}) => (
  <article className={`dashboard-widget-card ${widget.size}`}>
    <span className="dashboard-widget-card-icon" aria-hidden="true">
      <AppIcon
        source={widget.definition.icon || widget.definition.moduleIcon}
        label={widget.definition.title}
        context={`${widget.definition.moduleCode} ${widget.definition.category} ${widget.definition.moduleName}`}
        size="LG"
      />
    </span>
    <div className="dashboard-widget-card-body">
      <div className="dashboard-widget-card-meta">
        <strong>{widget.definition.moduleName}</strong>
      </div>
      <h4>{widget.definition.title}</h4>
      <p>{widget.definition.description}</p>
      <div className="dashboard-widget-render-placeholder">
        <span>{widget.definition.emptyTitle || 'Henüz veri oluşmadı.'}</span>
        <small>{widget.definition.emptyDescription || 'Bu widget veri üretmeye başladığında burada gösterilecek.'}</small>
      </div>
    </div>
    <div className="dashboard-widget-card-actions">
      <button className="btn ghost" type="button" onClick={() => onHide(widget.id)}>
        <AppIcon name="hide" size="SM" />
        Gizle
      </button>
      <button className="btn danger" type="button" onClick={() => onRemove(widget.id)}>
        <AppIcon name="remove" size="SM" />
        Kaldır
      </button>
    </div>
  </article>
)

export default function DailySummary({ currentUser, onOpenMarketplace, onOpenWorkspaceSettings }: Props){
  const [widgetPanelOpen, setWidgetPanelOpen] = React.useState(false)
  const [widgetMessage, setWidgetMessage] = React.useState('')
  const [hasBusinessModules, setHasBusinessModules] = React.useState(() => (
    hasManagedBusinessModules(currentUser)
  ))
  const [container, setContainer] = React.useState<DashboardWidgetContainer>(() => (
    getDashboardWidgetContainer(currentUser)
  ))

  const refreshContainer = React.useCallback(() => {
    setContainer(getDashboardWidgetContainer(currentUser))
    setHasBusinessModules(hasManagedBusinessModules(currentUser))
  }, [currentUser])

  React.useEffect(() => {
    refreshContainer()
  }, [refreshContainer])

  React.useEffect(() => {
    const refresh = () => refreshContainer()

    window.addEventListener('storage', refresh)
    window.addEventListener(DASHBOARD_WIDGET_LAYOUT_EVENT, refresh)
    window.addEventListener(WORKSPACE_PROVISIONING_EVENT, refresh)
    window.addEventListener(WORKSPACE_MODULE_LIFECYCLE_EVENT, refresh)

    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener(DASHBOARD_WIDGET_LAYOUT_EVENT, refresh)
      window.removeEventListener(WORKSPACE_PROVISIONING_EVENT, refresh)
      window.removeEventListener(WORKSPACE_MODULE_LIFECYCLE_EVENT, refresh)
    }
  }, [refreshContainer])

  React.useEffect(() => {
    if(!widgetPanelOpen) return undefined

    const closeOnEscape = (event: KeyboardEvent) => {
      if(event.key === 'Escape') setWidgetPanelOpen(false)
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [widgetPanelOpen])

  const handleAddWidget = (widget: DashboardWidgetCatalogItem) => {
    const nextContainer = widget.added
      ? setDashboardWidgetVisibility(currentUser, widget.instanceId || widget.id, true)
      : addDashboardWidget(currentUser, widget.id)

    setContainer(nextContainer)
    setWidgetMessage(widget.added
      ? `${widget.title} yeniden kontrol panelinde gösteriliyor.`
      : `${widget.title} kontrol paneline eklendi.`
    )
  }

  const handleHideWidget = (widgetId: string) => {
    const nextContainer = setDashboardWidgetVisibility(currentUser, widgetId, false)
    setContainer(nextContainer)
    setWidgetMessage('Widget gizlendi. Katalog üzerinden tekrar görünür hale getirebilirsiniz.')
  }

  const handleRemoveWidget = (widgetId: string) => {
    const nextContainer = removeDashboardWidget(currentUser, widgetId)
    setContainer(nextContainer)
    setWidgetMessage('Widget kontrol paneli yerleşiminden kaldırıldı.')
  }

  const dashboardEmptyState = getEmptyState(container, WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS.DASHBOARD)
  const widgetCatalogEmptyState = getEmptyState(container, WORKSPACE_TEMPLATE_EMPTY_STATE_KEYS.WIDGET_CATALOG)

  const handleQuickAction = (action: WorkspaceTemplateQuickAction) => {
    setWidgetMessage('')

    if(action.actionType === WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_WIDGET_DRAWER){
      setWidgetPanelOpen(true)
      return
    }

    if(action.actionType === WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_MARKETPLACE){
      onOpenMarketplace()
      return
    }

    if(action.actionType === WORKSPACE_TEMPLATE_ACTION_TYPES.OPEN_WORKSPACE_SETTINGS){
      onOpenWorkspaceSettings?.()
    }
  }

  return (
    <div className="summary-page dashboard-widget-page dashboard-experience-page">
      <DashboardExperienceHeader
        eyebrow="Dashboard Experience"
        title={container.title}
        description={container.description}
        icon="dashboard"
        dataOnboardingTarget="control-panel"
        meta={container.isEmpty ? [] : [
          { key: 'visible-widget-count', label: `${container.visibleWidgets.length} widget`, icon: 'dashboard', tone: 'info' },
          { key: 'user-role', label: currentUser.role === 'Admin' ? 'Yönetici' : 'Kullanıcı', icon: 'user', tone: 'neutral' }
        ]}
      />
      <div className="page-title dashboard-title dashboard-title-legacy" hidden>
        <div>
          <h2>{container.title}</h2>
          <p className="muted">
            {container.description}
          </p>
        </div>
        {!container.isEmpty && (
          <div className="dashboard-title-actions">
            <span className="status-pill info-pill">{container.visibleWidgets.length} widget</span>
            <span className="dashboard-date-pill">{currentUser.role === 'Admin' ? 'Yönetici' : 'Kullanıcı'}</span>
          </div>
        )}
      </div>

      {widgetMessage && <div className="form-success">{widgetMessage}</div>}

      {container.quickActions.length > 0 && (
        <section className="dashboard-template-actions" aria-label="Hızlı işlemler">
          {container.quickActions.map(action => (
            <button
              className={getQuickActionButtonClassName(action)}
              type="button"
              key={action.id}
              title={action.description}
              onClick={() => handleQuickAction(action)}
            >
              <span className="dashboard-template-action-icon" aria-hidden="true">
                <AppIcon source={action.icon} label={action.label} context={action.actionType} size="XS" />
              </span>
              <span>{action.label}</span>
            </button>
          ))}
        </section>
      )}

      {container.isEmpty ? (
        <section className="dashboard-widget-empty" data-onboarding-target="widget-area">
          <span className="dashboard-widget-empty-icon" aria-hidden="true">
            <AppIcon source={dashboardEmptyState?.icon || 'KP'} label={dashboardEmptyState?.title} context="dashboard empty state" size="XXL" />
          </span>
          <div>
            <h3>{dashboardEmptyState?.title || 'İlk widgetınızı ekleyin'}</h3>
            <p>{dashboardEmptyState?.description || 'Kontrol paneliniz, takip etmek istediğiniz özetleri tek alanda toplar.'}</p>
            <div className="dashboard-widget-empty-actions">
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  setWidgetPanelOpen(true)
                  setWidgetMessage('')
                }}
              >
                <AppIcon name="plus" size="SM" />
                {dashboardEmptyState?.actionLabel || 'Widget Ekle'}
              </button>
              {!hasBusinessModules && (
                <button className="btn" type="button" onClick={onOpenMarketplace}>
                  <AppIcon name="marketplace" size="SM" />
                  Modül Mağazasına Git
                </button>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="dashboard-widget-container-shell dashboard-widget-container-clean" data-onboarding-target="widget-area">
          <div className="dashboard-widget-toolbar">
            <button
              className="btn"
              type="button"
              onClick={() => {
                setWidgetPanelOpen(true)
                setWidgetMessage('')
              }}
            >
              <AppIcon name="plus" size="SM" />
              + Widget Ekle
            </button>
          </div>

          <div className="dashboard-widget-group-stack">
            {container.groupedWidgets.map(group => (
              <section className="dashboard-widget-group" key={group.category}>
                <div className="dashboard-widget-group-title">
                  <h3>{group.category}</h3>
                </div>
                <div className="dashboard-widget-grid">
                  {group.widgets.map(widget => (
                    <WidgetCard
                      key={widget.id}
                      widget={widget}
                      onHide={handleHideWidget}
                      onRemove={handleRemoveWidget}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      )}

      {widgetPanelOpen && (
        <div className="dashboard-widget-drawer-overlay" role="presentation" onClick={() => setWidgetPanelOpen(false)}>
          <aside
            className="dashboard-widget-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Widget ekle"
            onClick={event => event.stopPropagation()}
          >
            <div className="dashboard-widget-drawer-header">
              <div>
                <h3>Widget Ekle</h3>
                <p>Kategorilerden ihtiyacınız olan widgetları seçin.</p>
              </div>
              <button className="btn ghost" type="button" onClick={() => setWidgetPanelOpen(false)}>
                Kapat
              </button>
            </div>

            {container.catalogGroups.length > 0 ? (
              <div className="dashboard-widget-catalog-stack">
                {container.catalogGroups.map(group => (
                  <section className="dashboard-widget-catalog-group" key={group.category}>
                    <div className="dashboard-widget-group-title compact">
                      <h3>{group.category}</h3>
                      <span>{group.widgets.length} seçenek</span>
                    </div>
                    <div className="dashboard-widget-catalog-grid">
                      {group.widgets.map(widget => (
                        <article className="dashboard-widget-catalog-card compact" key={widget.id}>
                          <span className="dashboard-widget-card-icon" aria-hidden="true">
                            <AppIcon
                              source={widget.icon || widget.moduleIcon}
                              label={widget.title}
                              context={`${widget.moduleCode} ${widget.category} ${widget.moduleName}`}
                              size="MD"
                            />
                          </span>
                          <div>
                            <strong>{widget.moduleName}</strong>
                            <h4>{widget.title}</h4>
                            <p>{widget.description}</p>
                            <div className="dashboard-widget-catalog-meta">
                              <span>{widget.added ? (widget.visibleInDashboard ? 'Kontrol panelinde' : 'Gizli') : 'Eklenebilir'}</span>
                            </div>
                          </div>
                          <button
                            className={widget.added && widget.visibleInDashboard ? 'btn ghost' : 'btn primary'}
                            type="button"
                            disabled={widget.added && widget.visibleInDashboard}
                            onClick={() => handleAddWidget(widget)}
                          >
                            <AppIcon name={widget.added && widget.visibleInDashboard ? 'success' : 'plus'} size="SM" />
                            {getCatalogActionLabel(widget)}
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="dashboard-widget-placeholder">
                <strong>{widgetCatalogEmptyState?.title || 'Widget kataloğu boş.'}</strong>
                <span>{widgetCatalogEmptyState?.description || 'Modül mağazası üzerinden modül kurduğunuzda widget seçenekleri burada listelenecek.'}</span>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
