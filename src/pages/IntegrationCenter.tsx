import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import {
  getWorkspaceIntegrationCatalog,
  getWorkspaceIntegrationFilterOptions,
  getWorkspaceIntegrationFoundation
} from '../integrations/workspace-integration.service'
import {
  INTEGRATION_STATUSES,
  type IntegrationStatus,
  type IntegrationType
} from '../integrations/integration-registry.types'

const categoryLabels: Record<IntegrationType, string> = {
  COMMUNICATION: 'İletişim',
  PAYMENT: 'Ödeme',
  ACCOUNTING: 'Muhasebe',
  IDENTITY: 'Kimlik',
  STORAGE: 'Depolama',
  NOTIFICATION: 'Bildirim',
  ANALYTICS: 'Analitik',
  AI: 'Yapay Zeka',
  HARDWARE: 'Donanım',
  PRODUCTIVITY: 'Üretkenlik'
}

const statusLabels: Record<IntegrationStatus, string> = {
  AVAILABLE: 'Henüz yapılandırılmadı',
  CONNECTED: 'Bağlı',
  DISCONNECTED: 'Bağlantı kurulmadı',
  COMING_SOON: 'Yakında',
  DISABLED: 'Devre Dışı'
}

const statusClassNames: Record<IntegrationStatus, string> = {
  AVAILABLE: 'info-pill',
  CONNECTED: 'success',
  DISCONNECTED: 'warning-pill',
  COMING_SOON: 'warning-pill',
  DISABLED: 'muted-pill'
}

const connectionCopy: Record<IntegrationStatus, string> = {
  AVAILABLE: 'Henüz yapılandırılmadı',
  CONNECTED: 'Bağlantı kuruldu',
  DISCONNECTED: 'Bağlantı kurulmadı',
  COMING_SOON: 'Yakında açılacak',
  DISABLED: 'Kullanılamıyor'
}

export default function IntegrationCenter(){
  const [search, setSearch] = React.useState('')
  const [category, setCategory] = React.useState<IntegrationType | 'all'>('all')
  const [status, setStatus] = React.useState<IntegrationStatus | 'all'>('all')

  const integrations = React.useMemo(() => (
    getWorkspaceIntegrationCatalog({ search, category, status })
  ), [category, search, status])

  const allIntegrations = React.useMemo(() => getWorkspaceIntegrationCatalog(), [])
  const filterOptions = React.useMemo(() => getWorkspaceIntegrationFilterOptions(), [])
  const foundation = React.useMemo(() => getWorkspaceIntegrationFoundation(), [])

  const availableCount = allIntegrations.filter(item => item.status === INTEGRATION_STATUSES.AVAILABLE).length
  const connectedCount = allIntegrations.filter(item => item.status === INTEGRATION_STATUSES.CONNECTED).length
  const comingSoonCount = allIntegrations.filter(item => item.status === INTEGRATION_STATUSES.COMING_SOON).length

  return (
    <div className="integration-center-page">
      <section className="integration-center-hero">
        <div>
          <span className="status-pill info-pill">Entegrasyon Merkezi</span>
          <h2>Entegrasyon Merkezi</h2>
          <p>İşletme çalışma alanının dış sistem bağlantılarını tek merkezden izleyin ve ileride yapılandırın.</p>
        </div>
        <div className="integration-center-hero-meta">
          <span>{foundation.catalogSource}</span>
          <strong>{allIntegrations.length} entegrasyon</strong>
        </div>
      </section>

      <div className="metric-grid report-center-kpi-grid integration-center-kpi-grid">
        <div className="metric-card report-kpi-card">
          <span>Katalog</span>
          <strong>{allIntegrations.length}</strong>
          <p className="muted">Registry üzerinden gelen entegrasyonlar</p>
        </div>
        <div className="metric-card report-kpi-card">
          <span>Hazır</span>
          <strong>{availableCount}</strong>
          <p className="muted">Henüz yapılandırılmamış seçenekler</p>
        </div>
        <div className="metric-card report-kpi-card">
          <span>Bağlı</span>
          <strong>{connectedCount}</strong>
          <p className="muted">Bağlantısı tamamlanan kayıtlar</p>
        </div>
        <div className="metric-card report-kpi-card">
          <span>Yakında</span>
          <strong>{comingSoonCount}</strong>
          <p className="muted">Katalogda hazırlanan seçenekler</p>
        </div>
      </div>

      <section className="integration-foundation-panel">
        <div>
          <h3>Bağlantı Hazırlığı</h3>
          <p>Bu fazda gerçek bağlantı kurulmaz. Entegrasyonlar yapılandırma ekranları için hazır katalog olarak listelenir.</p>
        </div>
        <div className="integration-foundation-grid">
          <span>Yetkilendirme ayarları sonraki fazda açılacak</span>
          <span>API anahtarı yönetimi sonraki fazda açılacak</span>
          <span>Webhook ayarları sonraki fazda açılacak</span>
          <span>Cihaz ve servis bağlantıları sonraki fazda açılacak</span>
        </div>
      </section>

      <div className="report-toolbar integration-toolbar">
        <label>
          <span>Arama</span>
          <input
            value={search}
            placeholder="Entegrasyon adı, kategori veya etiket"
            onChange={event => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span>Kategori</span>
          <select value={category} onChange={event => setCategory(event.target.value as IntegrationType | 'all')}>
            <option value="all">Tüm kategoriler</option>
            {filterOptions.categories.map(item => (
              <option key={item} value={item}>{categoryLabels[item]}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Durum</span>
          <select value={status} onChange={event => setStatus(event.target.value as IntegrationStatus | 'all')}>
            <option value="all">Tüm durumlar</option>
            {filterOptions.statuses.map(item => (
              <option key={item} value={item}>{statusLabels[item]}</option>
            ))}
          </select>
        </label>
      </div>

      <section className="integration-grid" aria-label="Entegrasyon kataloğu">
        {integrations.map(integration => (
          <article className="integration-card" key={integration.integrationId}>
            <div className="integration-card-header">
              <span className="integration-card-icon" aria-hidden="true">
                <AppIcon
                  source={integration.icon}
                  label={integration.name}
                  context={`${integration.code} ${integration.category} ${integration.tags.join(' ')}`}
                  size="XL"
                />
              </span>
              <div>
                <span className={`status-pill ${statusClassNames[integration.status]}`}>{statusLabels[integration.status]}</span>
                <h3>{integration.name}</h3>
                <p>{integration.description}</p>
              </div>
            </div>
            <div className="integration-card-meta">
              <span>{categoryLabels[integration.category]}</span>
              <span>{integration.developer}</span>
              <span>v{integration.version}</span>
            </div>
            <div className="integration-card-footer">
              <span>{connectionCopy[integration.status]}</span>
              <span>Yapılandırma ekranı sonraki fazda açılacak</span>
            </div>
            <button className="btn integration-action-btn" type="button" disabled>
              {connectionCopy[integration.status]}
            </button>
          </article>
        ))}

        {integrations.length === 0 && (
          <div className="empty-state marketplace-empty">
            <strong>Entegrasyon bulunamadı</strong>
            <span>Arama veya filtreleri değiştirerek kataloğu tekrar görüntüleyin.</span>
          </div>
        )}
      </section>
    </div>
  )
}
