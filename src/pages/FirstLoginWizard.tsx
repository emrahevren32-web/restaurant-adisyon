import React from 'react'
import { PremiumEmptyState } from '../components/PremiumEmptyState'
import { AppIcon } from '../design-system/IconSystem'
import {
  createBusinessSetupWizardPlan,
  getBusinessSetupModuleCategory,
  type BusinessSetupModuleGroup
} from '../onboarding/business-setup-wizard.service'
import { completeFirstLoginOnboarding } from '../onboarding/onboarding.service'
import {
  FirstLoginBusinessInfoForm,
  FirstLoginOnboardingState,
  FirstLoginPasswordForm
} from '../onboarding/onboarding.types'
import {
  MODULE_DEPENDENCY_RELATION_TYPES,
  type ModuleDependencyPlanItem
} from '../modules/module-dependency.service'
import type { ModuleRecommendationPlanItem } from '../modules/module-recommendation.service'
import { MODULE_RECOMMENDATION_TEMPLATE_SOURCES } from '../modules/module-recommendation.service'
import { DEFAULT_SECTOR_ID } from '../sector/sector.registry'
import { loadSectors } from '../storage'
import { User } from '../types'

type Props = {
  currentUser: User
  onboardingState: FirstLoginOnboardingState
  onComplete: () => void
}

type WizardStep = {
  title: string
  description: string
}

const wizardSteps: WizardStep[] = [
  { title: 'Hoş Geldiniz', description: 'Kurulum özeti' },
  { title: 'Şifrenizi Belirleyin', description: 'Güvenlik' },
  { title: 'İşletme Bilgileri', description: 'Firma ve sektör' },
  { title: 'Önerilen Modüller', description: 'Sektör önerileri' },
  { title: 'Opsiyonel Modüller', description: 'Ek ihtiyaçlar' },
  { title: 'Kurulum Özeti', description: 'Plan kontrolü' },
  { title: 'Kurulum Tamamlandı', description: 'Kontrol paneli' }
]

const currencyOptions = ['TRY', 'USD', 'EUR']
const languageOptions = [
  { value: 'tr-TR', label: 'Türkçe' },
  { value: 'en-US', label: 'English' }
]
const timezoneOptions = ['Europe/Istanbul', 'Europe/London', 'Europe/Berlin', 'UTC']

const createPasswordForm = (): FirstLoginPasswordForm => ({
  temporaryPassword: '',
  newPassword: '',
  repeatPassword: ''
})

const createBusinessInfoForm = (state: FirstLoginOnboardingState): FirstLoginBusinessInfoForm => ({
  companyName: state.company?.companyName || '',
  primarySectorId: state.company?.primarySectorId || state.primarySector?.id || DEFAULT_SECTOR_ID,
  city: state.branch?.city || state.company?.city || '',
  district: state.branch?.district || state.company?.district || '',
  branchName: state.branch?.name || 'Merkez Şube',
  phone: state.branch?.phone || state.company?.phone || '',
  address: state.branch?.address || state.company?.address || '',
  currency: state.tenantSettings?.currency || 'TRY',
  language: state.tenantSettings?.language || 'tr-TR',
  timezone: state.tenantSettings?.timezone || 'Europe/Istanbul'
})

const formatModuleCategory = (moduleCode: string) => getBusinessSetupModuleCategory(moduleCode)

const getDependencyRelationLabel = (relation: ModuleDependencyPlanItem['relation']) => {
  if(relation === MODULE_DEPENDENCY_RELATION_TYPES.REQUIRED) return 'Zorunlu bağımlılık'
  if(relation === MODULE_DEPENDENCY_RELATION_TYPES.RECOMMENDED) return 'Önerilen bağımlılık'
  if(relation === MODULE_DEPENDENCY_RELATION_TYPES.OPTIONAL) return 'Opsiyonel bağımlılık'
  return 'Seçim'
}

const ModuleCard = ({
  module,
  selected,
  disabled,
  future,
  badge,
  onToggle
}: {
  module: ModuleRecommendationPlanItem
  selected?: boolean
  disabled?: boolean
  future?: boolean
  badge?: string
  onToggle?: (moduleCode: string) => void
}) => {
  const selectable = Boolean(onToggle) && !disabled && !future
  const category = formatModuleCategory(module.moduleCode)

  return (
    <label className={`first-login-module-card selectable ${selected ? 'selected' : ''} ${!selectable ? 'disabled' : ''} ${future ? 'future' : ''}`}>
      {onToggle ? (
        <input
          type="checkbox"
          checked={Boolean(selected)}
          disabled={!selectable}
          onChange={() => onToggle(module.moduleCode)}
        />
      ) : (
        <span className="first-login-module-marker" aria-hidden="true" />
      )}
      <span aria-hidden="true">
        <AppIcon source={module.icon} label={module.name} context={module.moduleCode} size="LG" />
      </span>
      <div>
        <h3>{module.name}</h3>
        <p>{module.description}</p>
        <div className="first-login-module-badges">
          <small>{category}</small>
          {badge && <small>{badge}</small>}
          {future && <small>Gelecek</small>}
        </div>
      </div>
    </label>
  )
}

const DependencyCard = ({ module }: { module: ModuleDependencyPlanItem }) => (
  <article className={`first-login-module-card dependency ${module.isFuture ? 'future' : ''}`}>
    <span aria-hidden="true">
      <AppIcon source={module.icon} label={module.name} context={module.moduleCode} size="LG" />
    </span>
    <div>
      <h3>{module.name}</h3>
      <p>{module.description}</p>
      <div className="first-login-module-badges">
        <small>{getDependencyRelationLabel(module.relation)}</small>
        {module.requestedBy.length > 0 && <small>{module.requestedBy.join(', ')}</small>}
        {module.isFuture && <small>Gelecek</small>}
      </div>
    </div>
  </article>
)

const EmptyModuleState = ({ children }: { children: React.ReactNode }) => (
  <PremiumEmptyState
    title={children}
    description="Bu adim icin ek kurulum aksiyonu gerekmiyor."
    icon="empty"
    size="compact"
    className="first-login-empty-state"
  />
)

const OptionalModuleGroup = ({
  group,
  selectedModuleCodes,
  onToggle
}: {
  group: BusinessSetupModuleGroup
  selectedModuleCodes: string[]
  onToggle: (moduleCode: string) => void
}) => (
  <section className="first-login-module-category-group">
    <div className="first-login-module-section-header">
      <h4>{group.category}</h4>
      <span>{group.modules.length}</span>
    </div>
    <div className="first-login-module-grid selectable">
      {group.modules.map(module => (
        <ModuleCard
          key={module.moduleCode}
          module={module}
          selected={selectedModuleCodes.includes(module.moduleCode)}
          onToggle={onToggle}
        />
      ))}
    </div>
  </section>
)

export default function FirstLoginWizard({ currentUser, onboardingState, onComplete }: Props){
  const sectors = React.useMemo(() => loadSectors(), [])
  const [stepIndex, setStepIndex] = React.useState(0)
  const [password, setPassword] = React.useState<FirstLoginPasswordForm>(() => createPasswordForm())
  const [businessInfo, setBusinessInfo] = React.useState<FirstLoginBusinessInfoForm>(() => createBusinessInfoForm(onboardingState))
  const [selectedRecommendedModuleCodes, setSelectedRecommendedModuleCodes] = React.useState<string[]>([])
  const [selectedOptionalModuleCodes, setSelectedOptionalModuleCodes] = React.useState<string[]>([])
  const [error, setError] = React.useState('')
  const [completed, setCompleted] = React.useState(false)

  const basePlan = React.useMemo(() => createBusinessSetupWizardPlan({
    sectorIdOrCode: businessInfo.primarySectorId
  }), [businessInfo.primarySectorId])
  const setupPlan = React.useMemo(() => createBusinessSetupWizardPlan({
    sectorIdOrCode: businessInfo.primarySectorId,
    selectedRecommendedModuleCodes,
    selectedOptionalModuleCodes
  }), [businessInfo.primarySectorId, selectedOptionalModuleCodes, selectedRecommendedModuleCodes])

  React.useEffect(() => {
    setSelectedRecommendedModuleCodes([])
    setSelectedOptionalModuleCodes([])
  }, [basePlan.sectorId])

  const activeStep = wizardSteps[stepIndex]
  const progressValue = Math.round(((stepIndex + 1) / wizardSteps.length) * 100)
  const expectedTemporaryPassword = onboardingState.setup?.temporaryPassword || ''
  const selectedSector = sectors.find(sector => sector.id === businessInfo.primarySectorId)
    || onboardingState.primarySector
    || sectors.find(sector => sector.id === DEFAULT_SECTOR_ID)
    || null
  const originalSectorId = onboardingState.company?.primarySectorId || onboardingState.primarySector?.id || DEFAULT_SECTOR_ID
  const sectorChanged = businessInfo.primarySectorId !== originalSectorId
  const ownerName = onboardingState.company?.authorizedPerson
    || onboardingState.company?.ownerName
    || onboardingState.companyUser?.fullName
    || currentUser.fullName
    || currentUser.username
  const recommendedFutureDefaults = basePlan.futureRecommendedModules
  const futureOptionalModules = basePlan.futureOptionalModules
  const selectedOptionalModules = basePlan.optionalModules
    .filter(module => selectedOptionalModuleCodes.includes(module.moduleCode))
  const selectedRecommendedModules = basePlan.recommendedModules
    .filter(module => selectedRecommendedModuleCodes.includes(module.moduleCode))
  const requiredDependencyModules = setupPlan.requiredDependencyModules
  const additionalDependencyModules = setupPlan.installationPlan.addedByDependency
    .filter(module => module.relation !== MODULE_DEPENDENCY_RELATION_TYPES.REQUIRED)

  const updatePassword = <K extends keyof FirstLoginPasswordForm>(key: K, value: FirstLoginPasswordForm[K]) => {
    setPassword(current => ({ ...current, [key]: value }))
  }

  const updateBusinessInfo = <K extends keyof FirstLoginBusinessInfoForm>(key: K, value: FirstLoginBusinessInfoForm[K]) => {
    setBusinessInfo(current => ({ ...current, [key]: value }))
  }

  const toggleRecommendedModule = (moduleCode: string) => {
    const module = basePlan.recommendedModules.find(item => item.moduleCode === moduleCode)
    if(!module || !module.isRegistryBacked) return

    setSelectedRecommendedModuleCodes(current => (
      current.includes(moduleCode)
        ? current.filter(item => item !== moduleCode)
        : [...current, moduleCode]
    ))
  }

  const toggleOptionalModule = (moduleCode: string) => {
    const module = basePlan.optionalModules.find(item => item.moduleCode === moduleCode)
    if(!module || !module.isRegistryBacked) return

    setSelectedOptionalModuleCodes(current => (
      current.includes(moduleCode)
        ? current.filter(item => item !== moduleCode)
        : [...current, moduleCode]
    ))
  }

  const validateCurrentStep = () => {
    if(stepIndex === 1){
      if(!password.temporaryPassword.trim()) return 'Geçici şifre zorunludur.'
      if(expectedTemporaryPassword && password.temporaryPassword !== expectedTemporaryPassword) return 'Geçici şifre eşleşmiyor.'
      if(!password.newPassword.trim()) return 'Yeni şifre zorunludur.'
      if(password.newPassword.length < 6) return 'Yeni şifre en az 6 karakter olmalıdır.'
      if(password.newPassword !== password.repeatPassword) return 'Yeni şifre tekrarı eşleşmiyor.'
    }
    if(stepIndex === 2){
      if(!businessInfo.companyName.trim()) return 'Firma adı zorunludur.'
      if(!businessInfo.primarySectorId.trim()) return 'Sektör seçimi zorunludur.'
      if(!businessInfo.city.trim()) return 'Şehir zorunludur.'
      if(!businessInfo.branchName.trim()) return 'İlk şube adı zorunludur.'
      if(!businessInfo.currency.trim()) return 'Para birimi zorunludur.'
      if(!businessInfo.language.trim()) return 'Dil zorunludur.'
      if(!businessInfo.timezone.trim()) return 'Saat dilimi zorunludur.'
    }
    return ''
  }

  const finishSetup = () => {
    setError('')
    try {
      completeFirstLoginOnboarding({
        state: onboardingState,
        password,
        businessInfo,
        selectedRecommendedModuleCodes,
        selectedOptionalModuleCodes
      })
      setCompleted(true)
      setStepIndex(6)
    } catch(setupError){
      setError(setupError instanceof Error ? setupError.message : 'Kurulum tamamlanamadı.')
    }
  }

  const goNext = () => {
    const validationError = validateCurrentStep()
    if(validationError){
      setError(validationError)
      return
    }

    setError('')
    if(stepIndex === 5){
      finishSetup()
      return
    }
    setStepIndex(current => Math.min(current + 1, wizardSteps.length - 1))
  }

  const goBack = () => {
    setError('')
    setStepIndex(current => Math.max(current - 1, 0))
  }

  return (
    <div className="first-login-page">
      <section className="first-login-hero">
        <div>
          <span className="status-pill info-pill">İşletme Kurulum Sihirbazı</span>
          <h2>İşletmenizi kullanıma hazırlayın</h2>
          <p className="muted">Sektörünüzden gelen öneriler, opsiyonel modüller ve bağımlılık planı kurulumdan önce netleşir.</p>
        </div>
        <div className="first-login-progress-summary">
          <strong>{progressValue}%</strong>
          <span>{activeStep.title}</span>
        </div>
      </section>

      <section className="first-login-stepper" aria-label="Kurulum adımları">
        {wizardSteps.map((step, index) => (
          <button
            key={step.title}
            type="button"
            className={`first-login-step ${index === stepIndex ? 'active' : ''} ${index < stepIndex || completed ? 'done' : ''}`}
            disabled
          >
            <span>{index + 1}</span>
            <strong>{step.title}</strong>
            <small>{step.description}</small>
          </button>
        ))}
      </section>

      <div className="first-login-progress-track" aria-hidden="true">
        <span style={{ width: `${progressValue}%` }} />
      </div>

      {error && <div className="form-error first-login-error">{error}</div>}

      <section className="first-login-panel">
        {stepIndex === 0 && (
          <div className="first-login-welcome">
            <div>
              <span className="status-pill success">Başvuru onaylandı</span>
              <h3>{businessInfo.companyName || '-'} için hoş geldiniz.</h3>
              <p className="muted">{ownerName}, işletme kurulumunuz birkaç adımda tamamlanacak.</p>
            </div>
            <dl className="first-login-summary-list">
              <div><dt>Firma Adı</dt><dd>{businessInfo.companyName || '-'}</dd></div>
              <div><dt>Yetkili</dt><dd>{ownerName}</dd></div>
              <div><dt>Seçilen Sektör</dt><dd>{selectedSector?.name || '-'}</dd></div>
              <div><dt>Kurulum Süresi</dt><dd>5-7 dakika</dd></div>
              <div><dt>Önerilen Modül</dt><dd>{basePlan.recommendedModules.length}</dd></div>
              <div><dt>Opsiyonel Modül</dt><dd>{basePlan.optionalModules.length}</dd></div>
            </dl>
            <button className="btn primary first-login-large-action" type="button" onClick={goNext}>Kuruluma Başla</button>
          </div>
        )}

        {stepIndex === 1 && (
          <div className="first-login-password-layout">
            <div>
              <span className="status-pill info-pill">Güvenlik</span>
              <h3>Şifrenizi belirleyin</h3>
              <p className="muted">Geçici şifreniz doğrulanır ve yeni şifreniz hesabınıza kaydedilir.</p>
            </div>
            <div className="first-login-form-grid">
              <label><span>Geçici Şifre</span><input type="password" autoComplete="current-password" value={password.temporaryPassword} onChange={event => updatePassword('temporaryPassword', event.target.value)} /></label>
              <label><span>Yeni Şifre</span><input type="password" autoComplete="new-password" value={password.newPassword} onChange={event => updatePassword('newPassword', event.target.value)} /></label>
              <label><span>Yeni Şifre Tekrar</span><input type="password" autoComplete="new-password" value={password.repeatPassword} onChange={event => updatePassword('repeatPassword', event.target.value)} /></label>
            </div>
          </div>
        )}

        {stepIndex === 2 && (
          <div className="first-login-business-layout">
            <div>
              <span className="status-pill info-pill">İşletme Bilgileri</span>
              <h3>Firma ve sektör bilgileri</h3>
              <p className="muted">Başvurudan gelen temel bilgiler bu kurulum için kullanılacaktır.</p>
            </div>
            {sectorChanged && (
              <div className="first-login-warning-note">
                Kurulum önerileri sektörünüze göre yeniden hesaplanacaktır.
              </div>
            )}
            <div className="first-login-form-grid">
              <label><span>Firma</span><input value={businessInfo.companyName} onChange={event => updateBusinessInfo('companyName', event.target.value)} /></label>
              <label>
                <span>Sektör</span>
                <select value={businessInfo.primarySectorId} onChange={event => updateBusinessInfo('primarySectorId', event.target.value)}>
                  {sectors.map(sector => (
                    <option key={sector.id} value={sector.id}>{sector.name}</option>
                  ))}
                </select>
              </label>
              <label><span>Şehir</span><input value={businessInfo.city} onChange={event => updateBusinessInfo('city', event.target.value)} /></label>
              <label><span>İlçe</span><input value={businessInfo.district} onChange={event => updateBusinessInfo('district', event.target.value)} /></label>
              <label><span>İlk Şube</span><input value={businessInfo.branchName} onChange={event => updateBusinessInfo('branchName', event.target.value)} /></label>
              <label><span>Telefon</span><input value={businessInfo.phone} onChange={event => updateBusinessInfo('phone', event.target.value)} /></label>
              <label className="first-login-wide"><span>Adres</span><textarea rows={3} value={businessInfo.address} onChange={event => updateBusinessInfo('address', event.target.value)} /></label>
              <label>
                <span>Para Birimi</span>
                <select value={businessInfo.currency} onChange={event => updateBusinessInfo('currency', event.target.value)}>
                  {currencyOptions.map(currency => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </label>
              <label>
                <span>Dil</span>
                <select value={businessInfo.language} onChange={event => updateBusinessInfo('language', event.target.value)}>
                  {languageOptions.map(language => <option key={language.value} value={language.value}>{language.label}</option>)}
                </select>
              </label>
              <label>
                <span>Saat Dilimi</span>
                <select value={businessInfo.timezone} onChange={event => updateBusinessInfo('timezone', event.target.value)}>
                  {timezoneOptions.map(timezone => <option key={timezone} value={timezone}>{timezone}</option>)}
                </select>
              </label>
            </div>
          </div>
        )}

        {stepIndex === 3 && (
          <div className="first-login-module-layout">
            <div>
              <span className="status-pill success">Önerilen</span>
              <h3>{selectedSector?.name || 'Sektör'} için önerilen modüller</h3>
              <p className="muted">Bu liste Sector Template ve Recommendation Planner çıktısından hazırlanır.</p>
            </div>
            {basePlan.recommendedModules.length === 0 ? (
              <EmptyModuleState>Bu sektör için önerilen iş modülü bulunmuyor.</EmptyModuleState>
            ) : (
              <div className="first-login-module-grid selectable">
                {basePlan.recommendedModules.map(module => (
                  <ModuleCard
                    key={module.moduleCode}
                    module={module}
                    selected={selectedRecommendedModuleCodes.includes(module.moduleCode)}
                    onToggle={toggleRecommendedModule}
                  />
                ))}
              </div>
            )}
            {recommendedFutureDefaults.length > 0 && (
              <section className="first-login-module-section">
                <div className="first-login-module-section-header">
                  <h4>Gelecek öneriler</h4>
                  <span>{recommendedFutureDefaults.length}</span>
                </div>
                <div className="first-login-module-grid selectable">
                  {recommendedFutureDefaults.map(module => (
                    <ModuleCard key={module.moduleCode} module={module} future disabled />
                  ))}
                </div>
              </section>
            )}
            {requiredDependencyModules.length > 0 && (
              <section className="first-login-module-section">
                <div className="first-login-module-section-header">
                  <h4>Zorunlu bağımlılıklar</h4>
                  <span>{requiredDependencyModules.length}</span>
                </div>
                <div className="first-login-module-grid">
                  {requiredDependencyModules.map(module => (
                    <DependencyCard key={`${module.moduleCode}:${module.dependencyPath.join('>')}`} module={module} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {stepIndex === 4 && (
          <div className="first-login-module-layout">
            <div>
              <span className="status-pill info-pill">Opsiyonel</span>
              <h3>Opsiyonel modüller</h3>
              <p className="muted">Opsiyonel modüller kategori bazlı listelenir; geliştirilmemiş modüller gelecek etiketiyle kalır.</p>
            </div>
            {basePlan.groupedOptionalModules.length === 0 ? (
              <EmptyModuleState>Bu sektör için opsiyonel modül bulunmuyor.</EmptyModuleState>
            ) : (
              basePlan.groupedOptionalModules.map(group => (
                <OptionalModuleGroup
                  key={group.category}
                  group={group}
                  selectedModuleCodes={selectedOptionalModuleCodes}
                  onToggle={toggleOptionalModule}
                />
              ))
            )}
            {futureOptionalModules.length > 0 && (
              <section className="first-login-module-category-group">
                <div className="first-login-module-section-header">
                  <h4>Gelecek</h4>
                  <span>{futureOptionalModules.length}</span>
                </div>
                <div className="first-login-module-grid selectable">
                  {futureOptionalModules.map(module => (
                    <ModuleCard
                      key={module.moduleCode}
                      module={module}
                      future
                      disabled
                      badge={module.source === MODULE_RECOMMENDATION_TEMPLATE_SOURCES.OPTIONAL ? 'Opsiyonel' : undefined}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {stepIndex === 5 && (
          <div className="first-login-summary-layout">
            <div>
              <span className="status-pill success">Kurulum Planı</span>
              <h3>Kurulum özeti</h3>
              <p className="muted">Seçilen modüller gerçek iş verisi oluşturmadan Kurulum Motoru ile çalışma alanına hazırlanır.</p>
            </div>
            <dl className="first-login-summary-list">
              <div><dt>Seçilen Sektör</dt><dd>{selectedSector?.name || '-'}</dd></div>
              <div><dt>Önerilen Seçim</dt><dd>{selectedRecommendedModules.length}</dd></div>
              <div><dt>Opsiyonel Seçim</dt><dd>{selectedOptionalModules.length}</dd></div>
              <div><dt>Otomatik Bağımlılık</dt><dd>{setupPlan.installationPlan.addedByDependency.length}</dd></div>
              <div><dt>Gelecek Modül</dt><dd>{setupPlan.installationPlan.futureModules.length}</dd></div>
              <div><dt>Plan Uyarısı</dt><dd>{setupPlan.installationPlan.issues.length}</dd></div>
            </dl>

            <div className="first-login-summary-columns">
              <section className="first-login-summary-card">
                <h4>Kurulacak Modüller</h4>
                <div className="first-login-plan-list">
                  {setupPlan.installationPlan.resolvedModules.length === 0 && <span>İş modülü seçilmedi.</span>}
                  {setupPlan.installationPlan.resolvedModules.map(module => <span key={module.moduleCode}>{module.name}</span>)}
                </div>
              </section>
              <section className="first-login-summary-card">
                <h4>Otomatik Eklenen Bağımlılıklar</h4>
                <div className="first-login-plan-list">
                  {setupPlan.installationPlan.addedByDependency.length === 0 && <span>Ek bağımlılık yok.</span>}
                  {setupPlan.installationPlan.addedByDependency.map(module => (
                    <span key={`${module.moduleCode}:${module.relation}`}>{module.name} · {getDependencyRelationLabel(module.relation)}</span>
                  ))}
                </div>
              </section>
              <section className="first-login-summary-card">
                <h4>Opsiyonel Modüller</h4>
                <div className="first-login-plan-list">
                  {selectedOptionalModules.length === 0 && <span>Opsiyonel modül seçilmedi.</span>}
                  {selectedOptionalModules.map(module => <span key={module.moduleCode}>{module.name}</span>)}
                </div>
              </section>
              <section className="first-login-summary-card">
                <h4>Hazırlanacak Alanlar</h4>
                <div className="first-login-plan-list">
                  <span>Kontrol Paneli: Kurulum Motoru</span>
                  <span>Roller: Kurulum Motoru</span>
                  <span>Menü: Kurulum Motoru</span>
                  <span>Widget Grupları: Kurulum Motoru</span>
                </div>
              </section>
            </div>

            {(setupPlan.installationPlan.futureModules.length > 0 || setupPlan.installationPlan.issues.length > 0) && (
              <section className="first-login-summary-card first-login-wide-summary">
                <h4>Plan Uyarıları</h4>
                <div className="first-login-issue-list">
                  {setupPlan.installationPlan.futureModules.map(module => (
                    <span key={`future:${module.moduleCode}`}>{module.name}: Gelecek modül olarak bekletilecek.</span>
                  ))}
                  {setupPlan.installationPlan.issues.map(issue => (
                    <span key={`${issue.type}:${issue.moduleCode}:${issue.relatedModuleCode || ''}:${issue.dependencyPath.join('>')}`}>{issue.message}</span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {stepIndex === 6 && (
          <div className="first-login-complete">
            <span className="first-login-success-icon" aria-hidden="true">
              <AppIcon name="success" size="XXL" />
            </span>
            <h3>Kurulum Tamamlandı</h3>
            <p className="muted">
              İşletmeniz artık kullanıma hazır.
              <br />
              Kontrol panelinden devam edebilirsiniz.
            </p>
            <button className="btn primary first-login-large-action" type="button" onClick={onComplete}>Kontrol Paneline Git</button>
          </div>
        )}

        {stepIndex > 0 && stepIndex < 6 && (
          <div className="first-login-actions">
            <button className="btn" type="button" onClick={goBack}>Geri</button>
            <button className="btn primary" type="button" onClick={goNext}>{stepIndex === 5 ? 'Kurulumu Tamamla' : 'Devam Et'}</button>
          </div>
        )}
      </section>
    </div>
  )
}
