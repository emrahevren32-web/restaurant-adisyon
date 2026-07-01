import React from 'react'
import { completeFirstLoginOnboarding } from '../onboarding/onboarding.service'
import {
  FirstLoginBranchForm,
  FirstLoginCompanyForm,
  FirstLoginOnboardingState,
  FirstLoginProfileForm
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
  { title: 'Hoş Geldiniz', description: 'Platform kurulumu başlıyor' },
  { title: 'Firma Bilgileri', description: 'Temel firma kaydı' },
  { title: 'Logo', description: 'Marka görseli' },
  { title: 'İlk Şube', description: 'Operasyon noktası' },
  { title: 'Profil', description: 'İlk kullanıcı' },
  { title: 'Lisans Özeti', description: 'Paket ve limitler' },
  { title: 'Tamamlandı', description: 'RestaurantOS hazır' }
]

const formatDate = (value: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('tr-TR')
}

const getRemainingDays = (value: string) => {
  if(!value) return '-'
  const date = new Date(`${value}T12:00:00`)
  if(Number.isNaN(date.getTime())) return '-'
  const today = new Date()
  today.setHours(12, 0, 0, 0)
  return Math.max(0, Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))).toLocaleString('tr-TR')
}

const readImageFile = (file: File | undefined, onLoad: (dataUrl: string) => void) => {
  if(!file) return
  const reader = new FileReader()
  reader.onload = () => onLoad(String(reader.result || ''))
  reader.readAsDataURL(file)
}

const createCompanyForm = (state: FirstLoginOnboardingState): FirstLoginCompanyForm => ({
  companyName: state.company?.companyName || '',
  phone: state.company?.phone || '',
  email: state.company?.email || '',
  taxOffice: state.company?.taxOffice || '',
  taxNumber: state.company?.taxNumber || '',
  address: state.company?.address || '',
  city: state.company?.city || '',
  district: state.company?.district || '',
  logoUrl: state.company?.logoUrl || ''
})

const createBranchForm = (state: FirstLoginOnboardingState): FirstLoginBranchForm => ({
  name: state.branch?.name || 'Merkez Şube',
  address: state.branch?.address || state.company?.address || '',
  phone: state.branch?.phone || state.company?.phone || ''
})

const createProfileForm = (state: FirstLoginOnboardingState, currentUser: User): FirstLoginProfileForm => ({
  fullName: state.companyUser?.fullName || currentUser.fullName || '',
  phone: state.companyUser?.phone || currentUser.phone || state.company?.phone || '',
  profilePhotoUrl: currentUser.profilePhotoUrl || ''
})

export default function FirstLoginWizard({ currentUser, onboardingState, onComplete }: Props){
  const [stepIndex, setStepIndex] = React.useState(0)
  const [company, setCompany] = React.useState<FirstLoginCompanyForm>(() => createCompanyForm(onboardingState))
  const [branch, setBranch] = React.useState<FirstLoginBranchForm>(() => createBranchForm(onboardingState))
  const [profile, setProfile] = React.useState<FirstLoginProfileForm>(() => createProfileForm(onboardingState, currentUser))
  const [error, setError] = React.useState('')
  const [completed, setCompleted] = React.useState(false)

  const activeStep = wizardSteps[stepIndex]
  const progressValue = Math.round(((stepIndex + 1) / wizardSteps.length) * 100)
  const packageName = onboardingState.packageItem?.name || onboardingState.company?.companyName || 'Mevcut paket'
  const license = onboardingState.license

  const updateCompany = <K extends keyof FirstLoginCompanyForm>(key: K, value: FirstLoginCompanyForm[K]) => {
    setCompany(current => ({ ...current, [key]: value }))
  }

  const updateBranch = <K extends keyof FirstLoginBranchForm>(key: K, value: FirstLoginBranchForm[K]) => {
    setBranch(current => ({ ...current, [key]: value }))
  }

  const updateProfile = <K extends keyof FirstLoginProfileForm>(key: K, value: FirstLoginProfileForm[K]) => {
    setProfile(current => ({ ...current, [key]: value }))
  }

  const validateCurrentStep = () => {
    if(stepIndex === 1 && !company.companyName.trim()) return 'Firma adı zorunludur.'
    if(stepIndex === 1 && !company.email.trim()) return 'E-posta zorunludur.'
    if(stepIndex === 3 && !branch.name.trim()) return 'İlk şube adı zorunludur.'
    if(stepIndex === 4 && !profile.fullName.trim()) return 'Ad soyad zorunludur.'
    return ''
  }

  const finishSetup = () => {
    setError('')
    try {
      completeFirstLoginOnboarding({
        state: onboardingState,
        company,
        branch,
        profile
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
          <h2>Kurulumu tamamlayın</h2>
          <p className="muted">RestaurantOS açılmadan önce firma, ilk şube, profil ve lisans özetini netleştirin.</p>
        </div>
        <div className="first-login-progress-summary">
          <strong>{progressValue}%</strong>
          <span>{activeStep.title}</span>
        </div>
      </section>

      <section className="first-login-stepper" aria-label="Kurulum adimlari">
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
              <h3>{onboardingState.company?.companyName || 'Yeni firma'} için hoş geldiniz.</h3>
              <p className="muted">
                {onboardingState.company?.ownerName || currentUser.fullName}, MIYOP kurulumu birkaç adımda tamamlanacak.
              </p>
            </div>
            <dl className="first-login-summary-list">
              <div><dt>Firma</dt><dd>{onboardingState.company?.companyName || '-'}</dd></div>
              <div><dt>Yetkili</dt><dd>{onboardingState.company?.ownerName || currentUser.fullName}</dd></div>
              <div><dt>Başvuru Paketi</dt><dd>{packageName}</dd></div>
            </dl>
            <button className="btn primary" type="button" onClick={goNext}>Kuruluma Başla</button>
          </div>
        )}

        {stepIndex === 1 && (
          <div className="first-login-form-grid">
            <label><span>Firma Adı</span><input value={company.companyName} onChange={event => updateCompany('companyName', event.target.value)} /></label>
            <label><span>Telefon</span><input value={company.phone} onChange={event => updateCompany('phone', event.target.value)} /></label>
            <label><span>E-Posta</span><input type="email" value={company.email} onChange={event => updateCompany('email', event.target.value)} /></label>
            <label><span>Vergi Dairesi</span><input value={company.taxOffice} onChange={event => updateCompany('taxOffice', event.target.value)} /></label>
            <label><span>Vergi No</span><input value={company.taxNumber} onChange={event => updateCompany('taxNumber', event.target.value)} /></label>
            <label><span>Şehir</span><input value={company.city} onChange={event => updateCompany('city', event.target.value)} /></label>
            <label><span>İlçe</span><input value={company.district} onChange={event => updateCompany('district', event.target.value)} /></label>
            <label className="first-login-wide"><span>Adres</span><textarea rows={4} value={company.address} onChange={event => updateCompany('address', event.target.value)} /></label>
          </div>
        )}

        {stepIndex === 2 && (
          <div className="first-login-upload-layout">
            <div className="first-login-upload-preview">
              {company.logoUrl ? <img src={company.logoUrl} alt="Firma logosu" /> : <span>{company.companyName.slice(0, 2).toLocaleUpperCase('tr-TR') || 'MI'}</span>}
            </div>
            <div>
              <h3>Firma logosu</h3>
              <p className="muted">Bu fazda logo local/demo olarak saklanır. Gerçek medya servisi sonraki platform servislerinde bağlanacaktır.</p>
              <input type="file" accept="image/*" onChange={event => readImageFile(event.target.files?.[0], value => updateCompany('logoUrl', value))} />
              {company.logoUrl && <button className="btn" type="button" onClick={() => updateCompany('logoUrl', '')}>Logoyu Kaldır</button>}
            </div>
          </div>
        )}

        {stepIndex === 3 && (
          <div className="first-login-form-grid">
            <label><span>Şube Adı</span><input value={branch.name} onChange={event => updateBranch('name', event.target.value)} /></label>
            <label><span>Telefon</span><input value={branch.phone} onChange={event => updateBranch('phone', event.target.value)} /></label>
            <label className="first-login-wide"><span>Adres</span><textarea rows={4} value={branch.address} onChange={event => updateBranch('address', event.target.value)} /></label>
          </div>
        )}

        {stepIndex === 4 && (
          <div className="first-login-upload-layout">
            <div className="first-login-upload-preview profile">
              {profile.profilePhotoUrl ? <img src={profile.profilePhotoUrl} alt="Profil fotoğrafı" /> : <span>{profile.fullName.slice(0, 2).toLocaleUpperCase('tr-TR') || 'KU'}</span>}
            </div>
            <div className="first-login-form-grid compact">
              <label><span>Ad Soyad</span><input value={profile.fullName} onChange={event => updateProfile('fullName', event.target.value)} /></label>
              <label><span>Telefon</span><input value={profile.phone} onChange={event => updateProfile('phone', event.target.value)} /></label>
              <label className="first-login-wide"><span>Profil Fotoğrafı</span><input type="file" accept="image/*" onChange={event => readImageFile(event.target.files?.[0], value => updateProfile('profilePhotoUrl', value))} /></label>
            </div>
          </div>
        )}

        {stepIndex === 5 && (
          <div className="first-login-license-layout">
            {/* TODO: Future License Engine
                - Module Based License
                - User Limit
                - Branch Limit
                - AI Credits
                - Storage
                - Support Level */}
            <article>
              <span className="status-pill info-pill">Paket</span>
              <strong>{packageName}</strong>
              <p>{onboardingState.packageItem?.description || 'Mevcut paket mantığı ile gösterilir.'}</p>
            </article>
            <article>
              <span className={`status-pill ${license?.status === 'Aktif' || license?.status === 'Deneme' ? 'success' : 'warning-pill'}`}>{license?.status || 'Hazir'}</span>
              <strong>{license ? `${formatDate(license.startDate)} - ${formatDate(license.endDate)}` : '-'}</strong>
              <p>Kalan gün: {getRemainingDays(license?.endDate || '')}</p>
            </article>
            <article>
              <span className="status-pill muted-pill">Limitler</span>
              <strong>{onboardingState.packageItem?.maxUsers || '-'} kullanıcı / {onboardingState.packageItem?.maxBranches || '-'} şube</strong>
              <p>Modül bazlı lisans motoruna uyumlu özet alanı.</p>
            </article>
          </div>
        )}

        {stepIndex === 6 && (
          <div className="first-login-complete">
            <span className="status-pill success">Kurulum tamamlandı</span>
            <h3>RestaurantOS kullanıma hazır.</h3>
            <p className="muted">Firma bilgileri, ilk şube, profil ve lisans özeti kaydedildi.</p>
            <button className="btn primary" type="button" onClick={onComplete}>RestaurantOS'a Git</button>
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
