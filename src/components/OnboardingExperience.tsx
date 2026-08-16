import React from 'react'
import ProductTourProvider, { type ProductTourStep } from './ProductTourProvider'
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

type OnboardingStep = ProductTourStep & {
  key: OnboardingExperienceStepKey
  routeTarget?: 'dashboard' | 'module-store'
}

const onboardingSteps: OnboardingStep[] = [
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.WELCOME,
    title: 'Kurulum basariyla tamamlandi',
    description: 'Isletmeniz artik kullanima hazir. Simdi birlikte sistemi taniyalim.',
    icon: 'success'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.DASHBOARD,
    title: 'Kontrol Paneli',
    description: 'Isletmenizin onemli ozetleri ve gunluk aksiyonlari burada toplanir.',
    target: 'control-panel',
    routeTarget: 'dashboard',
    icon: 'dashboard'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.SIDE_MENU,
    title: 'Sidebar',
    description: 'Sol menu calisma alaninizdaki ekranlara hizli gecis yapmanizi saglar.',
    target: 'side-menu',
    icon: 'workspace'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.SEARCH,
    title: 'Global Arama',
    description: 'Arama kutusu ekran, modul ve islemleri hizli bulmaniza yardim eder.',
    target: 'global-search',
    icon: 'search'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.NOTIFICATIONS,
    title: 'Bildirim Merkezi',
    description: 'Basvuru, lisans, destek ve sistem uyarilari bildirim merkezinde toplanir.',
    target: 'notifications',
    icon: 'notification'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.WORKSPACE,
    title: 'Workspace ve Sube',
    description: 'Aktif workspace ve sube kapsamini buradan takip edebilirsiniz.',
    target: 'workspace-control',
    icon: 'workspace'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.WIDGETS,
    title: 'Widget Alani',
    description: 'Takip etmek istediginiz ozetleri kontrol panelinde widget olarak toplayabilirsiniz.',
    target: 'widget-area',
    routeTarget: 'dashboard',
    icon: 'module'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.MODULE_STORE,
    title: 'Modul Magazasi',
    description: 'Isletmenize uygun ek modulleri buradan kesfedebilir ve kurabilirsiniz.',
    target: 'module-store',
    routeTarget: 'module-store',
    icon: 'marketplace'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.PROFILE,
    title: 'Profil Alani',
    description: 'Kullanici, oturum ve yardim islemleri profil alaninda yer alir.',
    target: 'profile',
    icon: 'user'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.READY,
    title: 'Hazirsiniz',
    description: "MIYOP'u kendi ritminizde kesfetmeye baslayabilirsiniz.",
    icon: 'success'
  }
]

const getStepIndex = (stepKey: string) => {
  const index = onboardingSteps.findIndex(step => step.key === stepKey)
  return index >= 0 ? index : 0
}

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

  const skipExperience = React.useCallback(() => {
    skipOnboardingExperience(currentUser)
    setVisible(false)
  }, [currentUser])

  const finishExperience = React.useCallback(() => {
    completeOnboardingExperience(currentUser)
    setVisible(false)
  }, [currentUser])

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

  return (
    <ProductTourProvider
      open={visible}
      steps={onboardingSteps}
      activeIndex={activeIndex}
      welcome={isWelcomeStep}
      onBack={() => moveToStep(activeIndex - 1)}
      onNext={() => moveToStep(activeIndex + 1)}
      onSkip={skipExperience}
      onFinish={finishExperience}
      className="onboarding-experience"
    />
  )
}
