import { getCompanyIdForUser } from '../storage'
import type { User } from '../types'

const KEY_ONBOARDING_EXPERIENCE = 'ra_onboarding_experience_states'

export const ONBOARDING_EXPERIENCE_STATUSES = {
  IN_PROGRESS: 'inProgress',
  COMPLETED: 'completed',
  SKIPPED: 'skipped'
} as const

export type OnboardingExperienceStatus =
  typeof ONBOARDING_EXPERIENCE_STATUSES[keyof typeof ONBOARDING_EXPERIENCE_STATUSES]

export type OnboardingExperienceSource = 'auto' | 'manual'

export type OnboardingExperienceState = {
  key: string
  userId: string
  companyId: string
  status: OnboardingExperienceStatus
  currentStepKey: string
  source: OnboardingExperienceSource
  startedAt: string
  completedAt: string
  skippedAt: string
  updatedAt: string
}

export const ONBOARDING_EXPERIENCE_STEP_KEYS = {
  WELCOME: 'welcome',
  DASHBOARD: 'dashboard',
  SIDE_MENU: 'side-menu',
  SEARCH: 'search',
  NOTIFICATIONS: 'notifications',
  WORKSPACE: 'workspace',
  WIDGETS: 'widgets',
  MODULE_STORE: 'module-store',
  PROFILE: 'profile',
  READY: 'ready'
} as const

export type OnboardingExperienceStepKey =
  typeof ONBOARDING_EXPERIENCE_STEP_KEYS[keyof typeof ONBOARDING_EXPERIENCE_STEP_KEYS]

const createExperienceKey = (user: User) => {
  const companyId = getCompanyIdForUser(user) || user.companyId || user.tenantId || 'platform'
  return `${companyId}:${user.id}`
}

const readExperienceStates = (): OnboardingExperienceState[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY_ONBOARDING_EXPERIENCE) || '[]')
    return Array.isArray(parsed)
      ? parsed.filter(item => item?.key && item?.userId && item?.status)
      : []
  } catch {
    return []
  }
}

const saveExperienceStates = (states: OnboardingExperienceState[]) => {
  localStorage.setItem(KEY_ONBOARDING_EXPERIENCE, JSON.stringify(states))
}

const upsertExperienceState = (state: OnboardingExperienceState) => {
  saveExperienceStates([
    state,
    ...readExperienceStates().filter(item => item.key !== state.key)
  ])
  return state
}

export const getOnboardingExperienceState = (user: User): OnboardingExperienceState | null => {
  const key = createExperienceKey(user)
  return readExperienceStates().find(state => state.key === key) || null
}

export const shouldAutoStartOnboardingExperience = (user: User) => {
  const state = getOnboardingExperienceState(user)
  return !state || state.status === ONBOARDING_EXPERIENCE_STATUSES.IN_PROGRESS
}

export const startOnboardingExperience = (
  user: User,
  source: OnboardingExperienceSource = 'auto'
): OnboardingExperienceState => {
  const now = new Date().toISOString()
  const companyId = getCompanyIdForUser(user) || user.companyId || user.tenantId || 'platform'
  const existing = getOnboardingExperienceState(user)

  return upsertExperienceState({
    key: createExperienceKey(user),
    userId: user.id,
    companyId,
    status: ONBOARDING_EXPERIENCE_STATUSES.IN_PROGRESS,
    currentStepKey: existing?.status === ONBOARDING_EXPERIENCE_STATUSES.IN_PROGRESS
      ? existing.currentStepKey
      : ONBOARDING_EXPERIENCE_STEP_KEYS.WELCOME,
    source,
    startedAt: existing?.startedAt || now,
    completedAt: '',
    skippedAt: '',
    updatedAt: now
  })
}

export const updateOnboardingExperienceStep = (
  user: User,
  stepKey: OnboardingExperienceStepKey
): OnboardingExperienceState => {
  const now = new Date().toISOString()
  const state = getOnboardingExperienceState(user) || startOnboardingExperience(user)

  return upsertExperienceState({
    ...state,
    status: ONBOARDING_EXPERIENCE_STATUSES.IN_PROGRESS,
    currentStepKey: stepKey,
    updatedAt: now
  })
}

export const completeOnboardingExperience = (user: User): OnboardingExperienceState => {
  const now = new Date().toISOString()
  const state = getOnboardingExperienceState(user) || startOnboardingExperience(user)

  return upsertExperienceState({
    ...state,
    status: ONBOARDING_EXPERIENCE_STATUSES.COMPLETED,
    currentStepKey: ONBOARDING_EXPERIENCE_STEP_KEYS.READY,
    completedAt: now,
    skippedAt: '',
    updatedAt: now
  })
}

export const skipOnboardingExperience = (user: User): OnboardingExperienceState => {
  const now = new Date().toISOString()
  const state = getOnboardingExperienceState(user) || startOnboardingExperience(user)

  return upsertExperienceState({
    ...state,
    status: ONBOARDING_EXPERIENCE_STATUSES.SKIPPED,
    skippedAt: now,
    updatedAt: now
  })
}
