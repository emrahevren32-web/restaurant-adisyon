import React from 'react'
import {
  completeOnboardingExperience,
  ONBOARDING_EXPERIENCE_STEP_KEYS,
  shouldAutoStartOnboardingExperience,
  skipOnboardingExperience,
  startOnboardingExperience,
  updateOnboardingExperienceStep,
  type OnboardingExperienceStepKey
} from '../onboarding/onboarding-experience.service'
import type { User } from '../types'

type Props = {
  currentUser: User
  enabled: boolean
  startSignal: number
  onOpenDashboard: () => void
  onOpenModuleStore: () => void
}

type OnboardingStep = {
  key: OnboardingExperienceStepKey
  title: string
  description: string
  target?: string
  routeTarget?: 'dashboard' | 'module-store'
}

const onboardingSteps: OnboardingStep[] = [
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.WELCOME,
    title: 'Kurulum başarıyla tamamlandı',
    description: 'İşletmeniz artık kullanıma hazır; şimdi birlikte sistemi tanıyalım.'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.DASHBOARD,
    title: 'Kontrol Paneli',
    description: 'Burası kontrol panelinizdir; işletmenizin önemli bilgileri burada gösterilir.',
    target: 'control-panel',
    routeTarget: 'dashboard'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.SIDE_MENU,
    title: 'Sol Menü',
    description: 'Sol menü, çalışma alanınızdaki ekranlara hızlı geçiş yapmanızı sağlar.',
    target: 'side-menu'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.WIDGETS,
    title: 'Widget Alanı',
    description: 'Widget alanı, takip etmek istediğiniz özetleri kontrol panelinde toplar.',
    target: 'widget-area',
    routeTarget: 'dashboard'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.MODULE_STORE,
    title: 'Modül Mağazası',
    description: 'Modül mağazası, işletmenize uygun ek modülleri keşfetmeniz için kullanılır.',
    target: 'module-store',
    routeTarget: 'module-store'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.PROFILE,
    title: 'Profil',
    description: 'Profil alanı, kullanıcı ve oturum bilgilerinizi görmenizi sağlar.',
    target: 'profile'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.READY,
    title: 'Hazırsınız',
    description: "Hazırsınız; MIYOP'u kendi ritminizde keşfetmeye başlayabilirsiniz."
  }
]

const getStepIndex = (stepKey: string) => {
  const index = onboardingSteps.findIndex(step => step.key === stepKey)
  return index >= 0 ? index : 0
}

const getTargetSelector = (target: string) => `[data-onboarding-target="${target}"]`

export default function OnboardingExperience({
  currentUser,
  enabled,
  startSignal,
  onOpenDashboard,
  onOpenModuleStore
}: Props){
  const [visible, setVisible] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const autoStartedKeyRef = React.useRef('')
  const lastStartSignalRef = React.useRef(startSignal)
  const activeStep = onboardingSteps[activeIndex] || onboardingSteps[0]
  const isWelcomeStep = activeStep.key === ONBOARDING_EXPERIENCE_STEP_KEYS.WELCOME
  const isReadyStep = activeStep.key === ONBOARDING_EXPERIENCE_STEP_KEYS.READY
  const guideStepNumber = Math.max(1, activeIndex)
  const guideStepTotal = onboardingSteps.length - 1

  const openStepRoute = React.useCallback((step: OnboardingStep) => {
    if(step.routeTarget === 'dashboard') onOpenDashboard()
    if(step.routeTarget === 'module-store') onOpenModuleStore()
  }, [onOpenDashboard, onOpenModuleStore])

  const openExperience = React.useCallback((source: 'auto' | 'manual') => {
    const state = startOnboardingExperience(currentUser, source)
    const nextIndex = getStepIndex(state.currentStepKey)
    setActiveIndex(nextIndex)
    setVisible(true)
    openStepRoute(onboardingSteps[nextIndex] || onboardingSteps[0])
  }, [currentUser, openStepRoute])

  const moveToStep = React.useCallback((nextIndex: number) => {
    const boundedIndex = Math.max(0, Math.min(nextIndex, onboardingSteps.length - 1))
    const nextStep = onboardingSteps[boundedIndex]
    updateOnboardingExperienceStep(currentUser, nextStep.key)
    setActiveIndex(boundedIndex)
    openStepRoute(nextStep)
  }, [currentUser, openStepRoute])

  const skipExperience = () => {
    skipOnboardingExperience(currentUser)
    setVisible(false)
  }

  const finishExperience = () => {
    completeOnboardingExperience(currentUser)
    setVisible(false)
  }

  React.useEffect(() => {
    if(!enabled){
      setVisible(false)
      return
    }

    const autoKey = `${currentUser.companyId || currentUser.tenantId || 'platform'}:${currentUser.id}`
    if(autoStartedKeyRef.current === autoKey) return
    autoStartedKeyRef.current = autoKey

    if(shouldAutoStartOnboardingExperience(currentUser)){
      openExperience('auto')
    }
  }, [currentUser, enabled, openExperience])

  React.useEffect(() => {
    if(startSignal === lastStartSignalRef.current) return
    lastStartSignalRef.current = startSignal
    if(!enabled) return
    openExperience('manual')
  }, [enabled, openExperience, startSignal])

  React.useEffect(() => {
    document.querySelectorAll('.onboarding-highlight').forEach(element => {
      element.classList.remove('onboarding-highlight')
    })

    if(!visible || !activeStep.target) return undefined

    const highlightTimer = window.setTimeout(() => {
      const target = document.querySelector(getTargetSelector(activeStep.target || ''))
      target?.classList.add('onboarding-highlight')
      target?.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' })
    }, 180)

    return () => {
      window.clearTimeout(highlightTimer)
      document.querySelectorAll('.onboarding-highlight').forEach(element => {
        element.classList.remove('onboarding-highlight')
      })
    }
  }, [activeStep, visible])

  if(!visible) return null

  return (
    <div className={`onboarding-experience ${isWelcomeStep ? 'welcome' : 'guided'}`} role="presentation">
      <div className="onboarding-scrim" />
      <section className="onboarding-card" role="dialog" aria-modal="false" aria-label="MIYOP onboarding rehberi">
        <div className="onboarding-card-header">
          <span className="status-pill info-pill">
            {isWelcomeStep ? 'Hoş Geldiniz' : `Adım ${guideStepNumber}/${guideStepTotal}`}
          </span>
          <button className="btn ghost onboarding-close" type="button" onClick={skipExperience}>Atla</button>
        </div>
        <div className="onboarding-card-copy">
          <h3>{activeStep.title}</h3>
          <p>{activeStep.description}</p>
        </div>
        {!isWelcomeStep && (
          <div className="onboarding-progress-track" aria-hidden="true">
            <span style={{ width: `${Math.round((guideStepNumber / guideStepTotal) * 100)}%` }} />
          </div>
        )}
        <div className="onboarding-actions">
          {!isWelcomeStep && (
            <button className="btn" type="button" onClick={() => moveToStep(activeIndex - 1)}>
              Geri
            </button>
          )}
          {isWelcomeStep ? (
            <button className="btn primary" type="button" onClick={() => moveToStep(1)}>
              Rehberi Başlat
            </button>
          ) : isReadyStep ? (
            <button className="btn primary" type="button" onClick={finishExperience}>
              Bitir
            </button>
          ) : (
            <button className="btn primary" type="button" onClick={() => moveToStep(activeIndex + 1)}>
              Devam Et
            </button>
          )}
        </div>
      </section>
    </div>
  )
}
