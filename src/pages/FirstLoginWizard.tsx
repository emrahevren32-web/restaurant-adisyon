import React from 'react'
import { completeFirstLoginOnboarding } from '../onboarding/onboarding.service'
import {
  FirstLoginBranchForm,
  FirstLoginModuleSummary,
  FirstLoginOnboardingState,
  FirstLoginPasswordForm,
  FirstLoginWorkspaceForm
} from '../onboarding/onboarding.types'
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
  { title: 'Hoş Geldiniz', description: 'Firma ve lisans özeti' },
  { title: 'Şifrenizi Oluşturun', description: 'Güvenlik hazırlığı' },
  { title: 'Business Workspace', description: 'Çalışma alanı' },
  { title: 'İlk Şube', description: 'Operasyon noktası' },
  { title: 'Sistem Modülleri', description: 'Platform temeli' },
  { title: 'İş Modülleri', description: 'İlk kurulum seçimi' },
  { title: 'Tebrikler', description: 'Workspace hazır' }
]

const currencyOptions = ['TRY', 'USD', 'EUR']
const languageOptions = [
  { value: 'tr-TR', label: 'Türkçe' },
  { value: 'en-US', label: 'English' }
]
const timezoneOptions = ['Europe/Istanbul', 'Europe/London', 'Europe/Berlin', 'UTC']

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(`${value}T12:00:00`)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR')
}

const readImageFile = (file: File | undefined, onLoad: (dataUrl: string) => void) => {
  if(!file) return
  const reader = new FileReader()
  reader.onload = () => onLoad(String(reader.result || ''))
  reader.readAsDataURL(file)
}

const createPasswordForm = (): FirstLoginPasswordForm => ({
  temporaryPassword: '',
  newPassword: '',
  repeatPassword: ''
})

const createWorkspaceForm = (state: FirstLoginOnboardingState): FirstLoginWorkspaceForm => ({
  workspaceName: state.company?.companyName || '',
  logoUrl: state.company?.logoUrl || '',
  currency: state.tenantSettings?.currency || 'TRY',
  language: state.tenantSettings?.language || 'tr-TR',
  timezone: state.tenantSettings?.timezone || 'Europe/Istanbul'
})

const createBranchForm = (state: FirstLoginOnboardingState): FirstLoginBranchForm => ({
  name: state.branch?.name || 'Merkez Şube',
  address: state.branch?.address || state.company?.address || '',
  phone: state.branch?.phone || state.company?.phone || '',
  city: state.branch?.city || state.company?.city || '',
  district: state.branch?.district || state.company?.district || ''
})

const getInitials = (value: string, fallback: string) => {
  const clean = value.trim()
  return (clean ? clean.slice(0, 2) : fallback).toLocaleUpperCase('tr-TR')
}

const ModuleGrid = ({ modules, emptyText }: { modules: FirstLoginModuleSummary[]; emptyText: string }) => {
  if(modules.length === 0){
    return <div className="empty-state">{emptyText}</div>
  }

  return (
    <div className="first-login-module-grid">
      {modules.map(module => (
        <article className="first-login-module-card" key={module.key}>
          <span>{module.icon || module.name.slice(0, 2).toLocaleUpperCase('tr-TR')}</span>
          <div>
            <h3>{module.name}</h3>
            <p>{module.description}</p>
          </div>
        </article>
      ))}
    </div>
  )
}

const SystemModuleInfoList = ({ modules }: { modules: FirstLoginModuleSummary[] }) => {
  if(modules.length === 0){
    return <div className="empty-state">Aktif sistem modülü bulunamadı.</div>
  }

  return (
    <div className="first-login-placeholder-note">
      <strong>Bu modüller her Business Workspace içinde hazır gelir.</strong>
      <ul>
        {modules.map(module => (
          <li key={module.key}>
            <strong>{module.name}</strong>
            <span>{module.description}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const isSelectableMarketplaceModule = (module: FirstLoginModuleSummary) => {
  return module.installState === 'AVAILABLE' || module.installState === 'UNINSTALLED'
}

type SelectableModuleGridProps = {
  modules: FirstLoginModuleSummary[]
  selectedModuleIds: string[]
  onToggle: (moduleId: string) => void
}

const SelectableModuleGrid = ({ modules, selectedModuleIds, onToggle }: SelectableModuleGridProps) => {
  if(modules.length === 0){
    return <div className="empty-state">Marketplace içinde kurulabilir iş modülü bulunamadı.</div>
  }

  return (
    <div className="first-login-module-grid selectable">
      {modules.map(module => {
        const moduleId = module.moduleId || module.key
        const selectable = isSelectableMarketplaceModule(module)
        const selected = selectedModuleIds.includes(moduleId)

        return (
          <label className={`first-login-module-card selectable ${selected ? 'selected' : ''} ${!selectable ? 'disabled' : ''}`} key={module.key}>
            <input
              type="checkbox"
              checked={selected}
              disabled={!selectable}
              onChange={() => onToggle(moduleId)}
            />
            <span>{module.icon || module.name.slice(0, 2).toLocaleUpperCase('tr-TR')}</span>
            <div>
              <h3>{module.name}</h3>
              <p>{module.description}</p>
              <small>{module.category || 'Business'} · v{module.version || '1.0.0'} · {module.developer || 'MIYOP'}</small>
            </div>
          </label>
        )
      })}
    </div>
  )
}

export default function FirstLoginWizard({ currentUser, onboardingState, onComplete }: Props){
  const [stepIndex, setStepIndex] = React.useState(0)
  const [password, setPassword] = React.useState<FirstLoginPasswordForm>(() => createPasswordForm())
  const [workspace, setWorkspace] = React.useState<FirstLoginWorkspaceForm>(() => createWorkspaceForm(onboardingState))
  const [branch, setBranch] = React.useState<FirstLoginBranchForm>(() => createBranchForm(onboardingState))
  const [selectedInitialModuleIds, setSelectedInitialModuleIds] = React.useState<string[]>([])
  const [error, setError] = React.useState('')
  const [completed, setCompleted] = React.useState(false)

  const activeStep = wizardSteps[stepIndex]
  const progressValue = Math.round(((stepIndex + 1) / wizardSteps.length) * 100)
  const activeBusinessModuleCount = onboardingState.businessModules.length
  const license = onboardingState.license
  const expectedTemporaryPassword = onboardingState.setup?.temporaryPassword || ''
  const companyName = onboardingState.company?.companyName || '-'
  const ownerName = onboardingState.company?.authorizedPerson
    || onboardingState.company?.ownerName
    || onboardingState.companyUser?.fullName
    || currentUser.fullName
    || currentUser.username
  const workspaceName = workspace.workspaceName.trim() || companyName
  const licenseStart = onboardingState.company?.licenseStart || license?.startDate || ''
  const licenseEnd = onboardingState.company?.licenseEnd || license?.endDate || ''
  const marketplaceBusinessModules = onboardingState.marketplaceBusinessModules

  const toggleInitialModule = (moduleId: string) => {
    const module = marketplaceBusinessModules.find(item => (item.moduleId || item.key) === moduleId)
    if(!module || !isSelectableMarketplaceModule(module)) return

    setSelectedInitialModuleIds(current => (
      current.includes(moduleId)
        ? current.filter(item => item !== moduleId)
        : [...current, moduleId]
    ))
  }

  const updatePassword = <K extends keyof FirstLoginPasswordForm>(key: K, value: FirstLoginPasswordForm[K]) => {
    setPassword(current => ({ ...current, [key]: value }))
  }

  const updateWorkspace = <K extends keyof FirstLoginWorkspaceForm>(key: K, value: FirstLoginWorkspaceForm[K]) => {
    setWorkspace(current => ({ ...current, [key]: value }))
  }

  const updateBranch = <K extends keyof FirstLoginBranchForm>(key: K, value: FirstLoginBranchForm[K]) => {
    setBranch(current => ({ ...current, [key]: value }))
  }

  const validateCurrentStep = () => {
    if(stepIndex === 1){
      if(!password.temporaryPassword.trim()) return 'Geçici şifre zorunludur.'
      if(expectedTemporaryPassword && password.temporaryPassword !== expectedTemporaryPassword) return 'Geçici şifre eşleşmiyor.'
      if(!password.newPassword.trim()) return 'Yeni şifre zorunludur.'
      if(password.newPassword.length < 6) return 'Yeni şifre en az 6 karakter olmalıdır.'
      if(password.newPassword !== password.repeatPassword) return 'Yeni şifre tekrarı eşleşmiyor.'
    }
    if(stepIndex === 2 && !workspace.workspaceName.trim()) return 'Workspace adı zorunludur.'
    if(stepIndex === 2 && !workspace.currency.trim()) return 'Para birimi zorunludur.'
    if(stepIndex === 2 && !workspace.language.trim()) return 'Dil zorunludur.'
    if(stepIndex === 2 && !workspace.timezone.trim()) return 'Saat dilimi zorunludur.'
    if(stepIndex === 3 && !branch.name.trim()) return 'İlk şube adı zorunludur.'
    return ''
  }

  const finishSetup = () => {
    setError('')
    try {
      completeFirstLoginOnboarding({
        state: onboardingState,
        password,
        workspace,
        branch,
        selectedBusinessModuleIds: selectedInitialModuleIds
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
          <span className="status-pill info-pill">First Login Wizard</span>
          <h2>Business Workspace'inizi hazırlayın</h2>
          <p className="muted">Business Workspace ana ekranına geçmeden önce çalışma alanı, ilk şube ve modül görünümü netleşir.</p>
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
              <h3>{companyName} için hoş geldiniz.</h3>
              <p className="muted">
                {ownerName}, Business Workspace kurulumu birkaç adımda tamamlanacak.
              </p>
            </div>
            <dl className="first-login-summary-list">
              <div><dt>Firma</dt><dd>{companyName}</dd></div>
              <div><dt>Yetkili</dt><dd>{ownerName}</dd></div>
              <div><dt>Workspace Adı</dt><dd>{workspaceName}</dd></div>
              <div><dt>Aktif İş Modülü</dt><dd>{activeBusinessModuleCount}</dd></div>
              <div><dt>Lisans Başlangıç</dt><dd>{formatDate(licenseStart)}</dd></div>
              <div><dt>Lisans Bitiş</dt><dd>{formatDate(licenseEnd)}</dd></div>
            </dl>
            <button className="btn primary first-login-large-action" type="button" onClick={goNext}>Kuruluma Başla</button>
          </div>
        )}

        {stepIndex === 1 && (
          <div className="first-login-password-layout">
            <div>
              <span className="status-pill warning-pill">Placeholder</span>
              <h3>Şifrenizi oluşturun</h3>
              <p className="muted">Geçici şifre kontrolü ve yeni şifre alanları hazırlandı. Gerçek şifre değiştirme işlemi sonraki servis fazında bağlanacaktır.</p>
            </div>
            <div className="first-login-form-grid">
              <label><span>Geçici Şifre</span><input type="password" value={password.temporaryPassword} onChange={event => updatePassword('temporaryPassword', event.target.value)} /></label>
              <label><span>Yeni Şifre</span><input type="password" value={password.newPassword} onChange={event => updatePassword('newPassword', event.target.value)} /></label>
              <label><span>Yeni Şifre Tekrar</span><input type="password" value={password.repeatPassword} onChange={event => updatePassword('repeatPassword', event.target.value)} /></label>
            </div>
            <div className="first-login-placeholder-note">
              Bu adımda şifre alanları doğrulanır, ancak kullanıcı şifresi henüz kaydedilmez.
            </div>
          </div>
        )}

        {stepIndex === 2 && (
          <div className="first-login-workspace-layout">
            <div className="first-login-upload-preview">
              {workspace.logoUrl ? <img src={workspace.logoUrl} alt="Workspace logosu" /> : <span>{getInitials(workspace.workspaceName, 'MI')}</span>}
            </div>
            <div className="first-login-form-grid">
              <label><span>Workspace Adı</span><input value={workspace.workspaceName} onChange={event => updateWorkspace('workspaceName', event.target.value)} /></label>
              <label>
                <span>Para Birimi</span>
                <select value={workspace.currency} onChange={event => updateWorkspace('currency', event.target.value)}>
                  {currencyOptions.map(currency => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </label>
              <label>
                <span>Dil</span>
                <select value={workspace.language} onChange={event => updateWorkspace('language', event.target.value)}>
                  {languageOptions.map(language => <option key={language.value} value={language.value}>{language.label}</option>)}
                </select>
              </label>
              <label>
                <span>Saat Dilimi</span>
                <select value={workspace.timezone} onChange={event => updateWorkspace('timezone', event.target.value)}>
                  {timezoneOptions.map(timezone => <option key={timezone} value={timezone}>{timezone}</option>)}
                </select>
              </label>
              <label className="first-login-wide">
                <span>Logo</span>
                <input type="file" accept="image/*" onChange={event => readImageFile(event.target.files?.[0], value => updateWorkspace('logoUrl', value))} />
                <small className="first-login-field-note">Placeholder: gerçek medya servisi yerine bu fazda local önizleme kullanılır.</small>
              </label>
            </div>
          </div>
        )}

        {stepIndex === 3 && (
          <div className="first-login-form-grid">
            <label><span>Şube Adı</span><input value={branch.name} onChange={event => updateBranch('name', event.target.value)} /></label>
            <label><span>Telefon</span><input value={branch.phone} onChange={event => updateBranch('phone', event.target.value)} /></label>
            <label><span>Şehir</span><input value={branch.city} onChange={event => updateBranch('city', event.target.value)} /></label>
            <label><span>İlçe</span><input value={branch.district} onChange={event => updateBranch('district', event.target.value)} /></label>
            <label className="first-login-wide"><span>Adres</span><textarea rows={4} value={branch.address} onChange={event => updateBranch('address', event.target.value)} /></label>
          </div>
        )}

        {stepIndex === 4 && (
          <div className="first-login-module-layout">
            <div>
              <span className="status-pill info-pill">Bilgilendirme</span>
              <h3>Sistem Modülleri</h3>
              <p className="muted">Bu adımda seçim yapılmaz. Sistem modülleri her Workspace için otomatik olarak hazır gelir.</p>
            </div>
            <SystemModuleInfoList modules={onboardingState.systemModules} />
          </div>
        )}

        {stepIndex === 5 && (
          <div className="first-login-module-layout">
            <div>
              <span className="status-pill success">Marketplace Seçimi</span>
              <h3>İş Modülleri</h3>
              <p className="muted">Bu fazda gerçek satın alma yapılmaz. Seçtiğiniz modüller kurulum tamamlandığında bu Workspace için etkinleştirilir.</p>
            </div>
            <SelectableModuleGrid
              modules={marketplaceBusinessModules}
              selectedModuleIds={selectedInitialModuleIds}
              onToggle={toggleInitialModule}
            />
            <div className="first-login-placeholder-note">
              Seçtiğiniz modüller kurulum tamamlandığında Workspace menünüzde görünecek. Ödeme ve gerçek satın alma adımları sonraki fazda eklenecek.
            </div>
          </div>
        )}

        {stepIndex === 6 && (
          <div className="first-login-complete">
            <span className="first-login-success-icon" aria-hidden="true">✓</span>
            <h3>Tebrikler!</h3>
            <p className="muted">
              Business Workspace'iniz başarıyla oluşturuldu.
              <br />
              Artık MIYOP platformunu kullanmaya hazırsınız.
            </p>
            <button className="btn primary first-login-large-action" type="button" onClick={onComplete}>Business Workspace'e Git</button>
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
