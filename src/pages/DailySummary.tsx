import React from 'react'
import { getDashboardWidgetContainer } from '../dashboard/dashboard-widget.service'
import type { User } from '../types'

type Props = {
  currentUser: User
  onOpenMarketplace: () => void
}

export default function DailySummary({ currentUser, onOpenMarketplace }: Props){
  const [widgetPanelOpen, setWidgetPanelOpen] = React.useState(false)
  const [widgetMessage, setWidgetMessage] = React.useState('')
  const container = React.useMemo(() => getDashboardWidgetContainer(currentUser), [currentUser])

  return (
    <div className="summary-page dashboard-widget-page">
      <div className="page-title dashboard-title">
        <div>
          <h2>{container.title}</h2>
          <p className="muted">Dashboard, kurduğunuz modüllerle birlikte şekillenecek kişisel çalışma alanınızdır.</p>
        </div>
        <div className="dashboard-title-actions">
          <span className="status-pill info-pill">Dashboard</span>
          <span className="dashboard-date-pill">{currentUser.role === 'Admin' ? 'Yönetici' : 'Kullanıcı'}</span>
        </div>
      </div>

      {widgetMessage && <div className="form-success">{widgetMessage}</div>}

      <section className="dashboard-widget-empty">
        <div className="dashboard-widget-empty-icon" aria-hidden="true">DW</div>
        <div>
          <span className="status-pill warning-pill">Boş Dashboard</span>
          <h3>Henüz Dashboard widget'ı eklenmedi.</h3>
          <p>Kurduğunuz modüller, ihtiyaç duyduğunuz özet alanlarını burada gösterebilecek.</p>
          <div className="dashboard-widget-empty-actions">
            <button
              className="btn"
              type="button"
              onClick={() => {
                setWidgetPanelOpen(current => !current)
                setWidgetMessage('')
              }}
            >
              Widget Ekle
            </button>
            <button className="btn primary" type="button" onClick={onOpenMarketplace}>
              Marketplace'e Git
            </button>
          </div>
        </div>
      </section>

      {widgetPanelOpen && (
        <section className="dashboard-widget-add-panel">
          <div className="section-header compact">
            <div>
              <h3>Widget Ekle</h3>
              <p className="muted">Kurulu modüllerin Dashboard'a ekleyebileceği özet alanları burada listelenir.</p>
            </div>
            <span className="status-pill muted-pill">{container.availableWidgets.length} seçenek</span>
          </div>

          <div className="dashboard-widget-flow" aria-label="Widget ekleme akışı">
            <span>Kurulu Modüller</span>
            <span>Modül Özetleri</span>
            <span>Dashboard</span>
          </div>

          {container.availableWidgets.length > 0 ? (
            <div className="dashboard-widget-catalog-grid">
              {container.availableWidgets.map(widget => (
                <article className="dashboard-widget-catalog-card" key={widget.id}>
                  <span className="dashboard-widget-card-icon" aria-hidden="true">{widget.moduleIcon}</span>
                  <div>
                    <strong>{widget.moduleName}</strong>
                    <h4>{widget.title}</h4>
                    <p>{widget.description}</p>
                  </div>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => setWidgetMessage('Gerçek widget ekleme işlemi sonraki Dashboard Widget fazında etkinleştirilecek.')}
                  >
                    Hazırla
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="dashboard-widget-placeholder">
              <strong>Henüz Dashboard widget'ı eklenmedi.</strong>
              <span>Marketplace üzerinden bir modül kurduğunuzda eklenebilir özet alanları burada görünecek.</span>
            </div>
          )}
        </section>
      )}

      <section className="dashboard-widget-container-shell">
        <div className="section-header compact">
          <div>
            <h3>Dashboard</h3>
            <p className="muted">Bu alan Dashboard özetleriniz için ayrıldı. İçeriği siz ekledikçe dolacak.</p>
          </div>
          <span className="status-pill muted-pill">{container.widgets.length} widget</span>
        </div>

        <div className="dashboard-widget-placeholder">
          <strong>Henüz Dashboard widget'ı eklenmedi.</strong>
          <span>Dashboard içeriği yalnızca Widget Ekle akışı üzerinden oluşturulacak.</span>
        </div>
      </section>
    </div>
  )
}
