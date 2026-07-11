import React from 'react'
import { getCompanyIdForUser, loadCompanies } from '../storage'
import { getManagedWorkspaceModulesForUser } from '../workspace/workspace-module-lifecycle.service'
import { WORKSPACE_MODULE_TYPES } from '../modules/module-registry.types'
import type { User } from '../types'

type Props = {
  currentUser: User
  onOpenWorkspaceSettings: () => void
}

export default function WorkspaceWelcome({
  currentUser,
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

  const workspaceName = company?.companyName || 'İşletme Çalışma Alanı'
  const ownerName = company?.authorizedPerson || company?.ownerName || currentUser.fullName || currentUser.username
  const hasBusinessModules = managedBusinessModules.length > 0

  return (
    <div className="workspace-welcome-page">
      <section className="workspace-welcome-hero">
        <div>
          <span className="status-pill success">Çalışma alanı hazır</span>
          <h2>Hoş geldiniz, {ownerName}</h2>
          <p>
            {workspaceName} kurulum bilgileri hazır. {hasBusinessModules
              ? 'Kurulu iş modülleriniz kontrol paneli deneyimini zenginleştirebilir.'
              : 'Henüz iş modülü yüklenmedi.'}
          </p>
        </div>
        <div className="workspace-welcome-mark">
          <span aria-hidden="true">MI</span>
        </div>
      </section>

      <section className="workspace-welcome-grid single">
        <article className="workspace-welcome-panel action-card">
          <span>WS</span>
          <h3>Çalışma Alanı Ayarları</h3>
          <p>Çalışma alanı adı, logo, para birimi, dil ve temel tercihlerinizi yönetin.</p>
          <button className="btn primary workspace-welcome-button" type="button" onClick={onOpenWorkspaceSettings}>
            Çalışma Alanı Ayarları
          </button>
        </article>
      </section>

      <section className="workspace-welcome-action">
        <div>
          <h3>Kurulum bilgileri</h3>
          <p>Bu ekran normal menüde gösterilmez. Çalışma alanı başlangıcı tamamlandıktan sonra ana ekran kontrol paneli olur.</p>
        </div>
        <div className="workspace-welcome-actions">
          <button className="btn primary workspace-welcome-button" type="button" onClick={onOpenWorkspaceSettings}>
            Çalışma Alanı Ayarları
          </button>
        </div>
      </section>
    </div>
  )
}
