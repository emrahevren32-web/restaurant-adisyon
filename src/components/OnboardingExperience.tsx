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

// ⚠️ 28.10.2026 · BU DOSYANIN METİNLERİ TÜRKÇE KARAKTERSİZ YAZILMIŞTI
// ("Kurulum basariyla tamamlandi", "Isletmeniz artik kullanima hazir").
// Emrah 28.10'da gerçek bir davet akışı denedi: müşteri şifresini belirledi
// ve **ilk gördüğü ekran** bu turdu. Türkçesiz bir karşılama, ürünün
// tamamı hakkında ilk izlenimi verir.
//
// ⚠️ Metinler aynı turda İÇERİK olarak da yenilendi: "Sidebar", "Global
// Arama", "Widget Alani" gibi başlıklar kullanıcının dilinde değil
// geliştiricinin dilindeydi. Tur, ekranda DURAN şeyi kullanıcının
// kelimeleriyle anlatır.
const onboardingSteps: OnboardingStep[] = [
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.WELCOME,
    title: 'Kurulum tamamlandı',
    description: 'İşletmeniz kullanıma hazır. Birlikte kısa bir tur yapalım; '
      + 'iki dakika sürer, istediğiniz an kapatabilirsiniz.',
    icon: 'success'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.DASHBOARD,
    title: 'Kontrol Paneli',
    description: 'Günün özeti burada: depodaki kalem, açık iş emri, sevk bekleyen '
      + 've dikkat gerektiren konular. Bütün rakamlar kendi defterinizden okunur.',
    target: 'control-panel',
    routeTarget: 'dashboard',
    icon: 'dashboard'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.SIDE_MENU,
    title: 'Sol menü',
    description: 'Ekranlar burada gruplanır: Satın Alma, Depo, Üretim, Kalite. '
      + 'Yetkiniz olmayan ekran menüde hiç görünmez.',
    target: 'side-menu',
    icon: 'workspace'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.SEARCH,
    title: 'Arama',
    description: 'Ekran, modül ya da işlem adını yazın; menüde gezmeden doğrudan '
      + 'açılır.',
    target: 'global-search',
    icon: 'search'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.NOTIFICATIONS,
    title: 'Bildirimler',
    description: 'Lisans, destek ve sistem uyarıları burada toplanır. Okunmamış '
      + 'bildirim sayısı zilin üstünde yazar.',
    target: 'notifications',
    icon: 'notification'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.WORKSPACE,
    // ⚠️ TEK MERKEZ KARARI (25.10): bugün tek şube var ve bu seçici
    // kaldırılacak (HEDEFLER A2 · MIYOP-008). Adım o zaman yeniden yazılır;
    // şimdilik ekranda DURAN şeyi anlatıyor, olmayanı değil.
    title: 'Aktif şube',
    description: 'Hangi şubede çalıştığınız burada yazar. Yazdığınız her kayıt '
      + 'bu şubeye işlenir.',
    target: 'workspace-control',
    icon: 'workspace'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.WIDGETS,
    title: 'Özet kartları',
    description: 'Takip etmek istediğiniz özetleri kontrol paneline kart olarak '
      + 'ekleyebilirsiniz.',
    target: 'widget-area',
    routeTarget: 'dashboard',
    icon: 'module'
  },
  // ⚠️ 2026-10-11 · "Modul Magazasi" adimi KALDIRILDI.
  // Magaza menuden cikarildi (claude/modul-magazasi-denetimi.md). Olmayan
  // bir menu ogesini isaret eden bir tanitim turu, yeni kiracinin ilk
  // dakikasinda kirilir — ve ilk kiraci pilot musteri olacak.
  // ONBOARDING_EXPERIENCE_STEP_KEYS.MODULE_STORE anahtari duruyor; magaza
  // geri gelirse adim da geri gelir.
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.PROFILE,
    title: 'Profiliniz',
    description: 'Şifre değiştirme, oturumu kapatma ve Yardım Merkezi buradan '
      + 'açılır.',
    target: 'profile',
    icon: 'user'
  },
  {
    key: ONBOARDING_EXPERIENCE_STEP_KEYS.READY,
    title: 'Hazırsınız',
    description: 'İlk adım önerimiz: Depo → Stok Durumu ekranından ilk stok '
      + 'kartınızı açmak. Reçete, iş emri ve sevkiyat onun üstüne kurulur.',
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
