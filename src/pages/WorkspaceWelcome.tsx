import React from 'react'
import { getCompanyIdForUser, loadCompanies } from '../storage'
import { getManagedWorkspaceModulesForUser } from '../workspace/workspace-module-lifecycle.service'
import { WORKSPACE_MODULE_TYPES } from '../modules/module-registry.types'
import type { User } from '../types'

type Props = {
  currentUser: User
  onOpenMarketplace: () => void
  onOpenIntegrationCenter: () => void
  onOpenWorkspaceSettings: () => void
}

export default function WorkspaceWelcome({
  currentUser,
  onOpenMarketplace,
  onOpenIntegrationCenter,
  onOpenWorkspaceSettings
}: Props){
  const company = React.useMemo(() => {
    const companyId = getCompanyIdForUser(currentUser)
    return loadCompanies({ allTenants: true }).find(item => item.id === companyId) || null
  }, [currentUser])

  const managedBusinessModules = React.useMemo(() => (
    getManagedWorkspaceModulesForUser(currentUser)
      .filter(module => module.moduleType === WORKSPACE_MODULE_TYPES.BUSINESS)
  ), [currentUser])

  const workspaceName = company?.companyName || 'Business Workspace'
  const ownerName = company?.authorizedPerson || company?.ownerName || currentUser.fullName || currentUser.username
  const hasBusinessModules = managedBusinessModules.length > 0

  return (
    <div className="workspace-welcome-page">
      <section className="workspace-welcome-hero">
        <div>
          <span className="status-pill success">Workspace hazır</span>
          <h2>Hoşgeldiniz, {ownerName}</h2>
          <p>
            {workspaceName} başarıyla oluşturuldu. {hasBusinessModules
              ? 'Kurulu modüllerinizle Dashboard deneyimi hazırlanabilir.'
              : 'Henüz modül yüklenmedi.'}
          </p>
        </div>
        <div className="workspace-welcome-mark">
          <span aria-hidden="true">MI</span>
        </div>
      </section>

      <section className="workspace-welcome-grid">
        <article className="workspace-welcome-panel action-card">
          <span>MP</span>
          <h3>Marketplace'e Git</h3>
          <p>Platformu kullanmaya başlamak için ilk iş modülünüzü seçin ve kurulum akışını başlatın.</p>
          <button className="btn primary workspace-welcome-button" type="button" onClick={onOpenMarketplace}>
            Marketplace'e Git
          </button>
        </article>
        <article className="workspace-welcome-panel action-card">
          <span>EN</span>
          <h3>Entegrasyon Merkezi</h3>
          <p>Dış sistem bağlantılarını inceleyin. Bağlantı kurma adımları sonraki fazlarda açılacak.</p>
          <button className="btn workspace-welcome-button" type="button" onClick={onOpenIntegrationCenter}>
            Entegrasyon Merkezi
          </button>
        </article>
        <article className="workspace-welcome-panel action-card">
          <span>WS</span>
          <h3>Workspace Ayarları</h3>
          <p>Workspace adı, logo, para birimi, dil ve temel çalışma alanı tercihlerinizi yönetin.</p>
          <button className="btn workspace-welcome-button" type="button" onClick={onOpenWorkspaceSettings}>
            Workspace Ayarları
          </button>
        </article>
      </section>

      <section className="workspace-welcome-action">
        <div>
          <h3>{hasBusinessModules ? 'Dashboard deneyimi hazır' : 'Henüz modül yüklenmedi.'}</h3>
          <p>{hasBusinessModules
            ? 'Kurulu iş modüllerinizle normal Dashboard başlangıcına geçebilirsiniz.'
            : 'Business Workspace yalnızca çekirdek sistem modülleriyle başladı. İş modülleri Marketplace üzerinden eklenir.'}</p>
        </div>
        <div className="workspace-welcome-actions">
          <button className="btn primary workspace-welcome-button" type="button" onClick={onOpenMarketplace}>
            Marketplace'e Git
          </button>
        </div>
      </section>
    </div>
  )
}
