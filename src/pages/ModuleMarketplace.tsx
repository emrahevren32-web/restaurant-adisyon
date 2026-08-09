import { PRINT_RADIUS_VALUES } from '../design-system/BorderRadiusTheme'
import { PRINT_SPACING_VALUES } from '../design-system/LayoutSpacing'
import React from 'react'
import { AppIcon } from '../design-system/IconSystem'
import { PRINT_THEME_COLORS } from '../design-system/ThemeColors'
import ModuleSetupWizard from '../components/ModuleSetupWizard'
import { ExcelIntegrationService } from '../excel-engine/excel-integration.service'
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
import {
  getBusinessWorkspaceModuleById,
  type BusinessWorkspaceModule
} from '../modules/business-workspace.registry'
import type { WorkspaceModuleType } from '../modules/module-registry.types'
import type { User } from '../types'
import { getCompanyIdForUser, loadCompanies } from '../storage'
import {
  activateWorkspaceModuleForUser,
  detachWorkspaceModuleFromWorkspaceForUser,
  getWorkspaceModuleLifecycleStateForUser,
  installWorkspaceModuleForUser,
  suspendWorkspaceModuleForUser,
  WORKSPACE_MODULE_LIFECYCLE_EVENT,
  type WorkspaceModuleLifecycleAction,
  type WorkspaceModuleLifecycleResult
} from '../workspace/workspace-module-lifecycle.service'
import {
  completeModuleSetupWizardSession,
  startModuleSetupWizardForInstallResult,
  startModuleSetupWizardForModule
} from '../workspace/module-setup-wizard.service'
import type { ModuleSetupWizardSession } from '../workspace/module-setup-wizard.types'
import {
  WORKSPACE_PROVISIONING_EVENT,
  provisionWorkspaceForModuleLifecycleResult
} from '../workspace-provisioning/workspace-provisioning.service'
import {
  createModuleInstallationExperiencePreview,
  createModuleUninstallImpactAnalysis,
  getModuleLifecycleProgressSteps,
  type ModuleInstallationExperiencePreview,
  type ModuleLifecycleProgressStep,
  type ModuleUninstallImpactAnalysis
} from '../workspace/workspace-module-experience.service'

type Props = {
  currentUser: User
  onModuleLifecycleChanged: (result: WorkspaceModuleLifecycleResult) => void
}

type ToastType = 'success' | 'warning' | 'error' | 'info'

type ToastMessage = {
  id: string
  type: ToastType
  message: string
}

type ProgressStepState = ModuleLifecycleProgressStep & {
  status: 'pending' | 'running' | 'done'
}

type LifecycleProgressState = {
  action: WorkspaceModuleLifecycleAction | 'export'
  title: string
  moduleName: string
  steps: ProgressStepState[]
  percent: number
  status: 'running' | 'success' | 'failed' | 'cancelled'
  message: string
  canCancel: boolean
}

type InstallDraft = {
  module: MarketplaceModule
  definition: BusinessWorkspaceModule
  preview: ModuleInstallationExperiencePreview
}

type UninstallDraft = {
  module: MarketplaceModule
  definition: BusinessWorkspaceModule
  impact: ModuleUninstallImpactAnalysis
}

type MarketplaceOutputAction = 'EXCEL' | 'PDF' | 'PRINTED'

const stateLabels: Record<MarketplaceModuleState, string> = {
  AVAILABLE: 'Kurulabilir',
  INSTALLED: 'Kurulu',
  CONFIGURED: 'Yapılandırıldı',
  ACTIVE: 'Aktif',
  SUSPENDED: 'Pasif',
  UNINSTALLED: 'Kurulu Değil',
  DISABLED: 'Desteklenmiyor',
  COMING_SOON: 'Yakında'
}

const moduleTypeLabels: Record<WorkspaceModuleType, string> = {
  'core-system': 'Sistem',
  business: 'İş Modülü',
  integration: 'Entegrasyon'
}

const outputLabels: Record<MarketplaceOutputAction, string> = {
  EXCEL: 'Excel',
  PDF: 'PDF',
  PRINTED: 'Yazdır'
}

const getCardDisplayState = (module: MarketplaceModule) => {
  if(module.installState === 'COMING_SOON') return { label: 'Yakında', className: 'warning-pill' }
  if(module.installState === 'DISABLED') return { label: 'Desteklenmiyor', className: 'muted-pill' }
  if(module.installState === 'AVAILABLE' || module.installState === 'UNINSTALLED') return { label: 'Kurulabilir', className: 'info-pill' }
  if(module.installState === 'SUSPENDED') return { label: 'Pasif', className: 'warning-pill' }
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

const getPrimarySectorIdForUser = (user: User) => {
  const companyId = getCompanyIdForUser(user)
  if(!companyId) return ''

  return loadCompanies({ allTenants: true }).find(company => company.id === companyId)?.primarySectorId || ''
}

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms))

const createProgressState = (
  action: WorkspaceModuleLifecycleAction | 'export',
  title: string,
  moduleName: string
): LifecycleProgressState => ({
  action,
  title,
  moduleName,
  steps: getModuleLifecycleProgressSteps(action).map(step => ({ ...step, status: 'pending' })),
  percent: 0,
  status: 'running',
  message: 'İşlem hazırlanıyor.',
  canCancel: action !== 'export'
})

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const createOutputRows = (modules: MarketplaceModule[]) => modules.map(module => ({
  'Modül Adı': module.name,
  'Açıklama': module.shortDescription,
  'Kategori': module.category,
  'Tip': moduleTypeLabels[module.moduleType],
  'Durum': stateLabels[module.installState],
  'Lisans': module.licenseState === 'LICENSED' ? 'Lisanslı' : 'Lisanssız',
  'Sağlayıcı': module.developer,
  'Sürüm': module.version,
  'Aylık Ücret': module.commercial.monthlyPrice || 0,
  'Deneme Süresi': module.commercial.trialDays ? `${module.commercial.trialDays} gün` : 'Yok',
  'Menü Sayısı': module.workspaceConnection.menuKeys.length
}))

const createOutputFileName = () => `modul-magazasi-filtreli-${new Date().toLocaleDateString('sv-SE')}.xlsx`

const exportMarketplaceRowsToExcel = (modules: MarketplaceModule[]) => {
  const fileName = createOutputFileName()
  return ExcelIntegrationService.exportRows({
    moduleKey: 'module-marketplace',
    moduleLabel: 'Modul Magazasi',
    sheetName: 'Modül Mağazası',
    fileNamePrefix: 'modul-magazasi-filtreli',
    fileName,
    rows: createOutputRows(modules),
    userName: ExcelIntegrationService.defaultUserName
  }).fileName
}

const createPrintHtml = (
  modules: MarketplaceModule[],
  mode: 'A4' | 'PDF'
) => {
  const rows = modules.map(module => `
    <tr>
      <td>${escapeHtml(module.name)}</td>
      <td>${escapeHtml(module.category)}</td>
      <td>${escapeHtml(moduleTypeLabels[module.moduleType])}</td>
      <td>${escapeHtml(stateLabels[module.installState])}</td>
      <td>${escapeHtml(module.developer)}</td>
      <td>${escapeHtml(module.workspaceConnection.menuKeys.length)}</td>
    </tr>
  `).join('')

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <title>Modül Mağazası Çıktısı</title>
      <style>
        body { font-family: Arial, sans-serif; margin: ${PRINT_SPACING_VALUES.space24}; color: ${PRINT_THEME_COLORS.textInk}; }
        h1 { margin: 0 0 ${PRINT_SPACING_VALUES.space8}; font-size: 24px; }
        .meta { margin: 0 0 ${PRINT_SPACING_VALUES.space16}; color: ${PRINT_THEME_COLORS.textSoftAlt}; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th, td { border: 1px solid ${PRINT_THEME_COLORS.borderMarketplace}; padding: ${PRINT_SPACING_VALUES.space8}; text-align: left; vertical-align: top; }
        th { background: ${PRINT_THEME_COLORS.tableHeaderMarketplace}; }
        .pill { display: inline-block; margin-bottom: ${PRINT_SPACING_VALUES.space12}; border: 1px solid ${PRINT_THEME_COLORS.borderAccent}; border-radius: ${PRINT_RADIUS_VALUES.full}; padding: ${PRINT_SPACING_VALUES.space4} ${PRINT_SPACING_VALUES.space8}; color: ${PRINT_THEME_COLORS.pillText}; font-weight: 700; font-size: 12px; }
        @media print { body { margin: 14mm; } }
      </style>
    </head>
    <body>
      <span class="pill">${mode === 'PDF' ? 'PDF Hazırlık' : 'Yazdırılabilir Liste'}</span>
      <h1>Modül Mağazası Filtrelenmiş Liste</h1>
      <p class="meta">${modules.length.toLocaleString('tr-TR')} modül · ${new Date().toLocaleString('tr-TR')}</p>
      <table>
        <thead>
          <tr>
            <th>Modül</th>
            <th>Kategori</th>
            <th>Tip</th>
            <th>Durum</th>
            <th>Sağlayıcı</th>
            <th>Menü</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <script>window.addEventListener('load', () => window.print())</script>
    </body>
  </html>`
}

const openMarketplacePrintWindow = (
  modules: MarketplaceModule[],
  mode: 'A4' | 'PDF',
  targetWindow?: Window | null
) => {
  const printWindow = targetWindow || window.open('', '_blank', 'width=1180,height=840')
  if(!printWindow) throw new Error('Çıktı penceresi açılamadı.')
  printWindow.document.open()
  printWindow.document.write(createPrintHtml(modules, mode))
  printWindow.document.close()
}

export default function ModuleMarketplace({ currentUser, onModuleLifecycleChanged }: Props){
  const [search, setSearch] = React.useState('')
  const [workspaceCategory, setWorkspaceCategory] = React.useState<MarketplaceWorkspaceCategoryKey>('all')
  const [moduleType, setModuleType] = React.useState<WorkspaceModuleType | 'all'>('all')
  const [state, setState] = React.useState<MarketplaceModuleState | 'all'>('all')
  const [activeTab, setActiveTab] = React.useState<MarketplaceCatalogTab>('recommended')
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [bannerMessage, setBannerMessage] = React.useState('')
  const [bannerError, setBannerError] = React.useState('')
  const [toasts, setToasts] = React.useState<ToastMessage[]>([])
  const [activeSetupSession, setActiveSetupSession] = React.useState<ModuleSetupWizardSession | null>(null)
  const [managedModule, setManagedModule] = React.useState<MarketplaceModule | null>(null)
  const [installDraft, setInstallDraft] = React.useState<InstallDraft | null>(null)
  const [uninstallDraft, setUninstallDraft] = React.useState<UninstallDraft | null>(null)
  const [progress, setProgress] = React.useState<LifecycleProgressState | null>(null)
  const cancelRequestedRef = React.useRef(false)
  const retryOperationRef = React.useRef<(() => void) | null>(null)
  const primarySectorId = React.useMemo(() => getPrimarySectorIdForUser(currentUser), [currentUser])
  const companyId = React.useMemo(() => getCompanyIdForUser(currentUser), [currentUser])

  React.useEffect(() => {
    const refresh = () => setRefreshKey(current => current + 1)
    window.addEventListener(WORKSPACE_MODULE_LIFECYCLE_EVENT, refresh)
    window.addEventListener(WORKSPACE_PROVISIONING_EVENT, refresh)
    return () => {
      window.removeEventListener(WORKSPACE_MODULE_LIFECYCLE_EVENT, refresh)
      window.removeEventListener(WORKSPACE_PROVISIONING_EVENT, refresh)
    }
  }, [])

  const pushToast = React.useCallback((type: ToastType, message: string) => {
    const id = `toast_${Date.now()}_${Math.random().toString(16).slice(2)}`
    setToasts(current => [...current, { id, type, message }].slice(-4))
    window.setTimeout(() => {
      setToasts(current => current.filter(item => item.id !== id))
    }, 4600)
  }, [])

  const marketplaceContext = React.useMemo<MarketplaceContext>(() => ({
    getLifecycleState: module => getWorkspaceModuleLifecycleStateForUser(currentUser, module),
    sectorId: primarySectorId
  }), [currentUser, primarySectorId, refreshKey])

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
  const managedCount = installedCount + suspendedCount
  const readyRate = allModules.length > 0 ? Math.round((managedCount / allModules.length) * 100) : 0

  const refreshLifecycle = (result: WorkspaceModuleLifecycleResult, nextMessage: string) => {
    setRefreshKey(current => current + 1)
    setBannerMessage(nextMessage)
    setBannerError('')
    onModuleLifecycleChanged(result)
  }

  const updateProgressStep = (
    stepIndex: number,
    status: ProgressStepState['status'],
    percent?: number,
    message?: string
  ) => {
    setProgress(current => {
      if(!current) return current
      return {
        ...current,
        percent: percent ?? current.percent,
        message: message || current.message,
        steps: current.steps.map((step, index) => (
          index === stepIndex ? { ...step, status } : step
        ))
      }
    })
  }

  const runWithProgress = async <T,>(
    action: WorkspaceModuleLifecycleAction | 'export',
    title: string,
    moduleName: string,
    operation: () => T | Promise<T>
  ): Promise<T | null> => {
    cancelRequestedRef.current = false
    const initialProgress = createProgressState(action, title, moduleName)
    setProgress(initialProgress)
    setBannerMessage('')
    setBannerError('')

    let completedWeight = 0

    try {
      for(const [index, step] of initialProgress.steps.entries()){
        if(cancelRequestedRef.current) throw new Error('İşlem iptal edildi.')
        updateProgressStep(index, 'running', Math.min(98, completedWeight), step.label)
        await wait(280 + index * 55)
        if(cancelRequestedRef.current) throw new Error('İşlem iptal edildi.')
        completedWeight += step.weight
        updateProgressStep(index, 'done', Math.min(98, completedWeight), step.label)
      }

      setProgress(current => current ? { ...current, message: 'Son kontroller tamamlanıyor.', canCancel: false } : current)
      const timeout = new Promise<never>((_, reject) => {
        window.setTimeout(() => reject(new Error('İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.')), 15000)
      })
      const result = await Promise.race([Promise.resolve().then(operation), timeout])
      const successMessage = action === 'export'
        ? 'Çıktı hazırlandı.'
        : action === 'detach-from-workspace'
          ? `${moduleName} kaldırma akışı tamamlandı.`
          : action === 'suspend'
            ? `${moduleName} pasife alındı.`
            : `${moduleName} başarıyla etkinleştirildi.`
      setProgress(current => current ? {
        ...current,
        percent: 100,
        status: 'success',
        message: successMessage,
        canCancel: false,
        steps: current.steps.map(step => ({ ...step, status: 'done' }))
      } : current)
      await wait(650)
      setProgress(null)
      return result
    } catch(error) {
      const message = error instanceof Error ? error.message : 'İşlem tamamlanamadı.'
      const cancelled = message.includes('iptal')
      setProgress(current => current ? {
        ...current,
        status: cancelled ? 'cancelled' : 'failed',
        message,
        canCancel: false
      } : current)
      if(cancelled){
        pushToast('warning', 'İşlem iptal edildi.')
      } else {
        setBannerError(message)
        pushToast('error', message)
      }
      return null
    }
  }

  const closeProgress = () => {
    if(progress?.status === 'running') return
    setProgress(null)
  }

  const requestCancelProgress = () => {
    cancelRequestedRef.current = true
    setProgress(current => current ? {
      ...current,
      status: 'cancelled',
      message: 'İptal isteği alındı. Güvenli noktada durduruluyor.',
      canCancel: false
    } : current)
  }

  const getModuleDefinition = (module: MarketplaceModule) => {
    const moduleDefinition = getBusinessWorkspaceModuleById(module.id)
    if(!moduleDefinition) throw new Error('Modül kaydı bulunamadı.')
    return moduleDefinition
  }

  const startConfiguration = (module: MarketplaceModule) => {
    try {
      const moduleDefinition = getModuleDefinition(module)
      setBannerMessage(`${module.name} başlangıç sihirbazı açıldı.`)
      setBannerError('')
      pushToast('info', `${module.name} başlangıç sihirbazı açıldı.`)
      setActiveSetupSession(startModuleSetupWizardForModule(currentUser, moduleDefinition))
    } catch(error) {
      const message = error instanceof Error ? error.message : 'Modül kaydı bulunamadı.'
      setBannerError(message)
      pushToast('error', message)
    }
  }

  const startInstallFlow = async (module: MarketplaceModule) => {
    retryOperationRef.current = () => { void startInstallFlow(module) }

    const result = await runWithProgress(
      'install',
      `${module.name} kuruluyor...`,
      module.name,
      () => {
        const installResult = installWorkspaceModuleForUser(currentUser, module.id)
        if(installResult.alreadyInstalled) return installResult

        completeModuleSetupWizardSession(currentUser, startModuleSetupWizardForInstallResult(currentUser, installResult))
        const activationResult = activateWorkspaceModuleForUser(currentUser, module.id)
        provisionWorkspaceForModuleLifecycleResult(currentUser, activationResult)
        return activationResult
      }
    )

    if(!result) return

    const message = result.alreadyInstalled
      ? `${module.name} zaten kurulu.`
      : `${module.name} başarıyla etkinleştirildi.`
    refreshLifecycle(result, message)
    pushToast(result.alreadyInstalled ? 'info' : 'success', result.alreadyInstalled ? message : 'Modül başarıyla kuruldu.')
    setManagedModule({ ...module, installState: 'ACTIVE' })
  }

  const startActivationFlow = async (
    module: MarketplaceModule,
    actionKey: Extract<WorkspaceModuleLifecycleAction, 'activate' | 'reactivate' | 'suspend'>
  ) => {
    retryOperationRef.current = () => { void startActivationFlow(module, actionKey) }
    const result = await runWithProgress(
      actionKey,
      actionKey === 'suspend' ? `${module.name} pasife alınıyor...` : `${module.name} etkinleştiriliyor...`,
      module.name,
      () => {
        const lifecycleResult = actionKey === 'suspend'
          ? suspendWorkspaceModuleForUser(currentUser, module.id)
          : activateWorkspaceModuleForUser(currentUser, module.id)
        provisionWorkspaceForModuleLifecycleResult(currentUser, lifecycleResult)
        return lifecycleResult
      }
    )

    if(!result) return

    const nextState = actionKey === 'suspend' ? 'SUSPENDED' : 'ACTIVE'
    const message = actionKey === 'suspend'
      ? `${module.name} pasife alındı. Menü ve kontrol paneli seçenekleri güncellendi.`
      : `${module.name} etkinleştirildi. Menü ve kontrol paneli seçenekleri güncellendi.`
    refreshLifecycle(result, message)
    pushToast('success', actionKey === 'suspend' ? 'Modül pasife alındı.' : 'Modül başarıyla etkinleştirildi.')
    setManagedModule(current => current?.id === module.id ? { ...current, installState: nextState } : current)
  }

  const startUninstallFlow = async (module: MarketplaceModule) => {
    retryOperationRef.current = () => { void startUninstallFlow(module) }
    const result = await runWithProgress(
      'detach-from-workspace',
      `${module.name} kaldırılıyor...`,
      module.name,
      () => {
        const lifecycleResult = detachWorkspaceModuleFromWorkspaceForUser(currentUser, module.id)
        provisionWorkspaceForModuleLifecycleResult(currentUser, lifecycleResult)
        return lifecycleResult
      }
    )

    if(!result) return

    setActiveSetupSession(current => current?.module.id === module.id ? null : current)
    setManagedModule(current => current?.id === module.id ? null : current)
    refreshLifecycle(result, `${module.name} verileri silinmeden çalışma alanından kaldırıldı.`)
    pushToast('success', 'Modül çalışma alanından kaldırıldı.')
  }

  const openInstallWizard = (module: MarketplaceModule) => {
    try {
      const definition = getModuleDefinition(module)
      setInstallDraft({
        module,
        definition,
        preview: createModuleInstallationExperiencePreview(definition)
      })
      setBannerError('')
    } catch(error) {
      const message = error instanceof Error ? error.message : 'Kurulum önizlemesi hazırlanamadı.'
      setBannerError(message)
      pushToast('error', message)
    }
  }

  const openUninstallWizard = (module: MarketplaceModule) => {
    try {
      if(!companyId) throw new Error('Çalışma alanı bulunamadı.')
      const definition = getModuleDefinition(module)
      const impact = createModuleUninstallImpactAnalysis(companyId, definition)
      setUninstallDraft({ module, definition, impact })
      setBannerError('')
      if(impact.blocked) pushToast('warning', 'Bağımlı modüller bulundu.')
    } catch(error) {
      const message = error instanceof Error ? error.message : 'Kaldırma etki analizi hazırlanamadı.'
      setBannerError(message)
      pushToast('error', message)
    }
  }

  const performLifecycleAction = (
    module: MarketplaceModule,
    action: MarketplaceModuleActionDefinition
  ) => {
    if(action.disabled) return
    setBannerMessage('')
    setBannerError('')

    if(action.key === 'install'){
      openInstallWizard(module)
      return
    }

    if(action.key === 'configure'){
      startConfiguration(module)
      return
    }

    if(action.key === 'manage'){
      setManagedModule(module)
      pushToast('info', `${module.name} yönetim bilgileri açıldı.`)
      return
    }

    if(action.key === 'activate' || action.key === 'reactivate'){
      void startActivationFlow(module, action.key)
      return
    }

    if(action.key === 'suspend'){
      void startActivationFlow(module, 'suspend')
      return
    }

    if(action.key === 'detach-from-workspace'){
      openUninstallWizard(module)
    }
  }

  const completeSetupWizard = () => {
    if(!activeSetupSession) return

    completeModuleSetupWizardSession(currentUser, activeSetupSession)
    const activationResult = activateWorkspaceModuleForUser(currentUser, activeSetupSession.module.id)
    provisionWorkspaceForModuleLifecycleResult(currentUser, activationResult)
    setActiveSetupSession(null)
    refreshLifecycle(
      activationResult,
      `${activeSetupSession.module.name} yapılandırıldı ve çalışma alanı menüsüne eklendi.`
    )
    pushToast('success', `${activeSetupSession.module.name} yapılandırıldı.`)
  }

  const outputMarketplaceRows = async (action: MarketplaceOutputAction) => {
    if(modules.length === 0){
      pushToast('warning', 'Çıktı alınacak filtrelenmiş kayıt bulunamadı.')
      return
    }

    retryOperationRef.current = () => { void outputMarketplaceRows(action) }
    const reservedPrintWindow = action === 'EXCEL'
      ? null
      : window.open('', '_blank', 'width=1180,height=840')
    if(action !== 'EXCEL' && !reservedPrintWindow){
      const message = 'Çıktı penceresi açılamadı. Tarayıcı popup iznini kontrol edin.'
      setBannerError(message)
      pushToast('error', message)
      return
    }

    const result = await runWithProgress('export', `${outputLabels[action]} çıktısı hazırlanıyor...`, 'Modül Mağazası', () => {
      if(action === 'EXCEL'){
        return {
          fileName: exportMarketplaceRowsToExcel(modules),
          count: modules.length
        }
      }

      openMarketplacePrintWindow(modules, action === 'PDF' ? 'PDF' : 'A4', reservedPrintWindow)
      return {
        fileName: action === 'PDF' ? 'PDF çıktı penceresi' : 'Yazdırma penceresi',
        count: modules.length
      }
    })

    if(!result) return

    const message = action === 'EXCEL'
      ? `${result.count.toLocaleString('tr-TR')} modül Excel çıktısına aktarıldı.`
      : `${result.count.toLocaleString('tr-TR')} modül için ${outputLabels[action]} penceresi hazırlandı.`
    setBannerMessage(message)
    pushToast('success', action === 'EXCEL' ? 'Excel oluşturuldu.' : action === 'PDF' ? 'PDF hazırlandı.' : 'Yazdırma penceresi hazırlandı.')
  }

  return (
    <div className="module-marketplace-page">
      <div className="module-toast-stack" aria-live="polite">
        {toasts.map(toast => (
          <div className={`module-toast ${toast.type}`} key={toast.id}>
            {toast.message}
          </div>
        ))}
      </div>

      {progress && (
        <div className="module-progress-overlay" role="dialog" aria-modal="true" aria-label={progress.title}>
          <div className="module-progress-shell">
            <div className="module-progress-header">
              <span className={`status-pill ${progress.status === 'failed' ? 'danger-pill' : progress.status === 'cancelled' ? 'warning-pill' : 'info-pill'}`}>
                {progress.status === 'success' ? 'Tamamlandı' : progress.status === 'failed' ? 'Hata' : progress.status === 'cancelled' ? 'İptal' : 'İşleniyor'}
              </span>
              <h3>{progress.title}</h3>
              <p>{progress.message}</p>
            </div>
            <div className="module-progress-meter" aria-label={`İlerleme ${progress.percent}%`}>
              <span style={{ width: `${progress.percent}%` }} />
            </div>
            <strong className="module-progress-percent">{progress.percent}%</strong>
            <div className="module-progress-step-list">
              {progress.steps.map(step => (
                <div className={`module-progress-step ${step.status}`} key={step.id}>
                  <span>{step.status === 'done' ? '✓' : step.status === 'running' ? '•' : ''}</span>
                  <strong>{step.label}</strong>
                </div>
              ))}
            </div>
            <div className="module-progress-actions">
              {progress.canCancel && progress.status === 'running' && (
                <button className="btn" type="button" onClick={requestCancelProgress}>İptal Et</button>
              )}
              {progress.status === 'failed' && (
                <button className="btn primary" type="button" onClick={() => retryOperationRef.current?.()}>Tekrar Dene</button>
              )}
              {progress.status !== 'running' && (
                <button className="btn" type="button" onClick={closeProgress}>Kapat</button>
              )}
            </div>
          </div>
        </div>
      )}

      {installDraft && (
        <div className="module-lifecycle-modal-backdrop" role="presentation">
          <section className="module-lifecycle-modal" role="dialog" aria-modal="true" aria-label={`${installDraft.module.name} kurulum onayı`}>
            <div className="module-lifecycle-modal-header">
              <span className="marketplace-module-icon" aria-hidden="true">
                <AppIcon
                  source={installDraft.module.icon}
                  label={installDraft.module.name}
                  context={`${installDraft.module.category} ${installDraft.module.tags.join(' ')}`}
                  size="XL"
                />
              </span>
              <div>
                <span className="status-pill info-pill">Kurulum Sihirbazı</span>
                <h3>{installDraft.module.name}</h3>
                <p>{installDraft.preview.description}</p>
              </div>
            </div>
            <div className="module-lifecycle-summary-grid">
              <div><span>Aylık Ücret</span><strong>{installDraft.preview.monthlyFeeLabel}</strong></div>
              <div><span>Deneme Süresi</span><strong>{installDraft.preview.trialLabel}</strong></div>
              <div><span>Tahmini Süre</span><strong>{installDraft.preview.estimatedDurationLabel}</strong></div>
            </div>
            <div className="module-lifecycle-detail-grid">
              <LifecycleList title="Sağlayacağı Özellikler" items={installDraft.preview.features} emptyLabel="Özellik bulunamadı." />
              <LifecycleList title="Kurulacak Alt Bileşenler" items={installDraft.preview.subcomponents} emptyLabel="Alt bileşen bulunamadı." />
              <LifecycleList title="Kullanacağı Çalışma Alanları" items={installDraft.preview.workspaces} emptyLabel="Çalışma alanı bulunamadı." />
              <LifecycleList title="Kuracağı Menüler" items={installDraft.preview.menus} emptyLabel="Menü kaydı bulunamadı." />
              <LifecycleList title="Bağımlı Modüller" items={installDraft.preview.dependencies.map(item => `${item.moduleName} · ${item.critical ? 'Kritik' : 'Opsiyonel'}`)} emptyLabel="Bağımlı modül yok." />
              <LifecycleList title="Bağımlılık Grafiği" items={installDraft.preview.dependencyGraphLines} emptyLabel="Grafik verisi yok." />
            </div>
            <div className="module-lifecycle-modal-actions">
              <button className="btn" type="button" onClick={() => setInstallDraft(null)}>Vazgeç</button>
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  const module = installDraft.module
                  setInstallDraft(null)
                  void startInstallFlow(module)
                }}
              >
                Kurulumu Başlat
              </button>
            </div>
          </section>
        </div>
      )}

      {uninstallDraft && (
        <div className="module-lifecycle-modal-backdrop" role="presentation">
          <section className="module-lifecycle-modal" role="dialog" aria-modal="true" aria-label={`${uninstallDraft.module.name} kaldırma etki analizi`}>
            <div className="module-lifecycle-modal-header">
              <span className="marketplace-module-icon" aria-hidden="true">
                <AppIcon
                  source={uninstallDraft.module.icon}
                  label={uninstallDraft.module.name}
                  context={`${uninstallDraft.module.category} ${uninstallDraft.module.tags.join(' ')}`}
                  size="XL"
                />
              </span>
              <div>
                <span className={`status-pill ${uninstallDraft.impact.blocked ? 'danger-pill' : 'warning-pill'}`}>
                  Kaldırma Etki Analizi
                </span>
                <h3>{uninstallDraft.module.name}</h3>
                <p>
                  {uninstallDraft.impact.blocked
                    ? 'Kritik bağımlılıklar çözülmeden bu modül kaldırılamaz.'
                    : 'Veriler korunarak çalışma alanı bağlantıları kaldırılacak.'}
                </p>
              </div>
            </div>
            {uninstallDraft.impact.blocked && (
              <div className="form-error">
                Bu modül kaldırılamaz. Önce kritik bağımlı modülleri pasife alın veya çalışma alanından kaldırın.
              </div>
            )}
            <div className="module-lifecycle-detail-grid">
              <LifecycleList title="Etkilenen Modüller" items={uninstallDraft.impact.affectedModules.map(item => `${item.moduleName} · ${item.critical ? 'Kritik' : 'Dolaylı'}`)} emptyLabel="Etkilenen aktif modül yok." />
              <LifecycleList title="Kullanılamayacak Ekranlar" items={uninstallDraft.impact.unavailableScreens} emptyLabel="Ekran katkısı yok." />
              <LifecycleList title="Korunacak Veriler" items={uninstallDraft.impact.preservedData} emptyLabel="Korunacak veri listesi yok." />
              <LifecycleList title="Silinecek Önbellek" items={uninstallDraft.impact.deletedCache} emptyLabel="Önbellek kaydı yok." />
              <LifecycleList title="Bağımlılık Grafiği" items={uninstallDraft.impact.dependencyGraphLines} emptyLabel="Bağımlılık yok." />
              <div className="module-lifecycle-list">
                <h4>Yeniden Kurulabilirlik</h4>
                <strong>{uninstallDraft.impact.reinstallableLabel}</strong>
              </div>
            </div>
            <div className="module-lifecycle-modal-actions">
              <button className="btn" type="button" onClick={() => setUninstallDraft(null)}>Vazgeç</button>
              <button
                className="btn danger"
                type="button"
                disabled={uninstallDraft.impact.blocked}
                onClick={() => {
                  const module = uninstallDraft.module
                  setUninstallDraft(null)
                  void startUninstallFlow(module)
                }}
              >
                Kaldırmayı Başlat
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="marketplace-hero">
        <div>
          <span className="status-pill info-pill">MIYOP Modül Mağazası</span>
          <h2>İşletme çalışma alanı yönetim merkezi</h2>
          <p>Modülleri keşfedin, kurulum etkisini görün, güvenli şekilde etkinleştirin ve çalışma alanı yaşam döngüsünü yönetin.</p>
        </div>
        <div className="marketplace-hero-stats">
          <span>{allModules.length} modül</span>
          <strong>{managedCount} yönetilen</strong>
          <em>{readyRate}% kullanımda</em>
        </div>
      </section>

      {bannerMessage && <div className="form-success">{bannerMessage}</div>}
      {bannerError && <div className="form-error">{bannerError}</div>}

      {activeSetupSession && (
        <ModuleSetupWizard session={activeSetupSession} onComplete={completeSetupWizard} />
      )}

      {managedModule && (
        <section className="module-setup-wizard" aria-label={`${managedModule.name} yönetimi`}>
          <div className="module-setup-wizard-header">
            <span className="marketplace-module-icon" aria-hidden="true">
              <AppIcon
                source={managedModule.icon}
                label={managedModule.name}
                context={`${managedModule.category} ${managedModule.tags.join(' ')}`}
                size="XL"
              />
            </span>
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

      <div className="marketplace-output-toolbar" aria-label="Filtrelenmiş liste çıktıları">
        <span>{modules.length.toLocaleString('tr-TR')} filtrelenmiş kayıt</span>
        <button className="btn" type="button" disabled={modules.length === 0} onClick={() => void outputMarketplaceRows('EXCEL')}>Excel</button>
        <button className="btn" type="button" disabled={modules.length === 0} onClick={() => void outputMarketplaceRows('PDF')}>PDF</button>
        <button className="btn" type="button" disabled={modules.length === 0} onClick={() => void outputMarketplaceRows('PRINTED')}>Yazdır</button>
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
                <span className="marketplace-module-icon" aria-hidden="true">
                  <AppIcon
                    source={module.icon}
                    label={module.name}
                    context={`${module.category} ${module.moduleType} ${module.tags.join(' ')}`}
                    size="XL"
                  />
                </span>
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
                    disabled={action.disabled || Boolean(progress && progress.status === 'running')}
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

function LifecycleList({
  title,
  items,
  emptyLabel
}: {
  title: string
  items: string[]
  emptyLabel: string
}){
  return (
    <div className="module-lifecycle-list">
      <h4>{title}</h4>
      {items.length > 0 ? (
        <ul>
          {items.map(item => <li key={`${title}-${item}`}>{item}</li>)}
        </ul>
      ) : (
        <span>{emptyLabel}</span>
      )}
    </div>
  )
}
