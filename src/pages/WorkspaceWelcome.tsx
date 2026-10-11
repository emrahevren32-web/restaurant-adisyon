import React from 'react'
import { FeatureHighlight } from '../components/FeatureHighlight'
import { GettingStartedCard } from '../components/GettingStartedCard'
import { PremiumEmptyState } from '../components/PremiumEmptyState'
import { QuickTip } from '../components/QuickTip'
import type {
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'
import { getCompanyIdForUser, loadCompanies } from '../storage'
import { getManagedWorkspaceModulesForUser } from '../workspace/workspace-module-lifecycle.service'
import { WORKSPACE_MODULE_TYPES } from '../modules/module-registry.types'
import type { User } from '../types'

type Props = {
  currentUser: User
  onOpenWorkspaceSettings: () => void
  onOpenWorkspaceRoute: (route: BusinessWorkspaceRoute, navKey: BusinessWorkspaceNavKey) => void
}

type GettingStartedAction = {
  key: string
  title: string
  description: string
  icon: 'marketplace' | 'dashboard' | 'user' | 'recipe' | 'stock' | 'settings'
  actionLabel: string
  route?: BusinessWorkspaceRoute
  navKey?: BusinessWorkspaceNavKey
  done?: boolean
  onAction?: () => void
}

export default function WorkspaceWelcome({
  currentUser,
  onOpenWorkspaceSettings,
  onOpenWorkspaceRoute
}: Props){
  const company = React.useMemo(() => {
    const companyId = getCompanyIdForUser(currentUser)
    return loadCompanies({ allTenants: true }).find(item => item.id === companyId) || null
  }, [currentUser])

  const managedBusinessModules = React.useMemo(() => (
    getManagedWorkspaceModulesForUser(currentUser)
      .filter(module => module.moduleType === WORKSPACE_MODULE_TYPES.BUSINESS)
  ), [currentUser])

  const workspaceName = company?.companyName || 'Isletme Calisma Alani'
  const ownerName = company?.authorizedPerson || company?.ownerName || currentUser.fullName || currentUser.username
  const hasBusinessModules = managedBusinessModules.length > 0

  const gettingStartedActions: GettingStartedAction[] = [
    // ⚠️ 2026-10-11 · "Ilk Modul Kur" adimi KALDIRILDI; yerine gercek bir
    // ilk adim kondu. Modul Magazasi menuden cikarildi (bkz.
    // claude/modul-magazasi-denetimi.md) ve yeni bir kiraciyi calismayan
    // bir ekrana yollamak karsilama ekraninin isi degil. Stok karti
    // olusturmak kurulumun GERCEK ilk adimi: recete de, is emri de,
    // sevkiyat da onun ustune kuruluyor.
    {
      key: 'first-stock-item',
      title: 'Ilk Stok Kartini Olustur',
      description: 'Hammadde ve mamul kartlari sistemin temeli; recete, is emri ve sevkiyat bunlarin ustune kuruluyor.',
      icon: 'stock',
      actionLabel: 'Depoya Git',
      route: 'depo',
      navKey: 'depo',
      done: hasBusinessModules
    },
    {
      key: 'first-widget',
      title: 'Ilk Widget Ekle',
      description: 'Kontrol panelinde takip etmek istediginiz ozetleri one cikarin.',
      icon: 'dashboard',
      actionLabel: 'Dashboarda Git',
      route: 'summary',
      navKey: 'dashboard'
    },
    {
      key: 'first-user',
      title: 'Ilk Kullanici Olustur',
      description: 'Ekip uyelerinizi workspace icine davet edip rollerle yonetin.',
      icon: 'user',
      actionLabel: 'Kullanicilara Git',
      route: 'users',
      navKey: 'users'
    },
    {
      key: 'first-recipe',
      title: 'Ilk Recete',
      description: 'Recete ve maliyet takibini baslatmak icin recete ekranini acin.',
      icon: 'recipe',
      actionLabel: 'Recetelere Git',
      route: 'recipes',
      navKey: 'recipes'
    },
    {
      key: 'first-product',
      title: 'Ilk Urun',
      description: 'Satis, stok ve recete baglantilari icin urun listenizi hazirlayin.',
      icon: 'stock',
      actionLabel: 'Urunlere Git',
      route: 'products',
      navKey: 'products'
    },
    {
      key: 'workspace-settings',
      title: 'Workspace Ayarlari',
      description: 'Logo, para birimi, dil ve temel workspace tercihlerinizi kontrol edin.',
      icon: 'settings',
      actionLabel: 'Ayarlari Ac',
      onAction: onOpenWorkspaceSettings
    }
  ]

  return (
    <div className="workspace-welcome-page">
      <section className="workspace-welcome-hero">
        <div>
          <span className="status-pill success">Calisma alani hazir</span>
          <h2>Hos geldiniz, {ownerName}</h2>
          <p>
            {workspaceName} baslangic deneyimi hazir. Ilk modulu kurabilir, ilk widgeti ekleyebilir ve temel kayitlara dogru ilerleyebilirsiniz.
          </p>
        </div>
        <div className="workspace-welcome-mark">
          <span aria-hidden="true">MI</span>
        </div>
      </section>

      <FeatureHighlight
        title="Premium onboarding deneyimi aktif"
        description="Product tour, quick tips, getting started kartlari ve empty state sistemi birlikte calisir."
        icon="workspace"
        tone="success"
        badge="Yeni Ozellik"
      />

      {!hasBusinessModules && (
        <PremiumEmptyState
          title="Workspace henuz bos"
          description="Bos ekran yerine ilk adimlarinizi buradan baslatabilirsiniz."
          icon="workspace"
          size="hero"
          actions={[
            {
              key: 'create-first-stock-item',
              label: 'Ilk stok kartini olustur',
              icon: 'stock',
              tone: 'primary',
              onClick: () => onOpenWorkspaceRoute('depo', 'depo')
            },
            {
              key: 'open-help',
              label: 'Yardimi ac',
              icon: 'help',
              onClick: onOpenWorkspaceSettings
            }
          ]}
        />
      )}

      <QuickTip title="Baslangic ipucu" dismissible>
        Once modulleri kurup dashboard widgetlarini ekleyin; sonra urun, recete ve kullanici kartlariyla operasyonu genisletin.
      </QuickTip>

      <section className="getting-started-grid" aria-label="Baslangic kartlari">
        {gettingStartedActions.map(action => (
          <GettingStartedCard
            key={action.key}
            title={action.title}
            description={action.description}
            icon={action.icon}
            badge={action.done ? 'Tamamlandi' : 'Baslangic'}
            actionLabel={action.actionLabel}
            steps={[
              { key: `${action.key}:discover`, label: 'Ekrani ac', done: action.done },
              { key: `${action.key}:complete`, label: 'Ilk aksiyonu tamamla', done: false }
            ]}
            onAction={action.onAction || (action.route && action.navKey
              ? () => onOpenWorkspaceRoute(action.route as BusinessWorkspaceRoute, action.navKey as BusinessWorkspaceNavKey)
              : undefined)}
          />
        ))}
      </section>

      <section className="workspace-welcome-action">
        <div>
          <h3>Kurulum bilgileri</h3>
          <p>Bu alan yeni kullanicilar icin baslangic rehberi olarak calisir. Kurulum tamamlandiktan sonra ana deneyim kontrol paneli uzerinden devam eder.</p>
        </div>
        <div className="workspace-welcome-actions">
          <button className="btn primary workspace-welcome-button" type="button" onClick={onOpenWorkspaceSettings}>
            Calisma Alani Ayarlari
          </button>
        </div>
      </section>
    </div>
  )
}
