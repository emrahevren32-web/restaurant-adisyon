import { getCompanyIdForUser } from '../storage'
import type { User } from '../types'

export type PlatformAssistantPromptKey =
  | 'business-profile'
  | 'team-size'
  | 'module-goals'

export type PlatformAssistantPrompt = {
  key: PlatformAssistantPromptKey
  question: string
  description: string
}

export type PlatformAssistantSession = {
  id: string
  companyId: string
  title: string
  status: 'draft'
  prompts: PlatformAssistantPrompt[]
  recommendationPipelineReady: boolean
  createdAt: string
  createdByUserId: string
}

const PLATFORM_ASSISTANT_PROMPTS: PlatformAssistantPrompt[] = [
  {
    key: 'business-profile',
    question: 'İşletme türünüz nedir?',
    description: 'İleride modül önerileri işletme profilinden beslenecek.'
  },
  {
    key: 'team-size',
    question: 'Kaç personeliniz var?',
    description: 'Ekip büyüklüğü kullanıcı, vardiya ve personel modülü önerilerinde kullanılacak.'
  },
  {
    key: 'module-goals',
    question: 'Öncelikli hedefiniz nedir?',
    description: 'İşletme performansı, stok, finans, operasyon veya raporlama önceliğine göre öneri üretilecek.'
  }
]

const createAssistantSessionId = (companyId: string, createdAt: string) => {
  const companyPart = companyId.replace(/[^a-z0-9]/gi, '').slice(-8) || 'workspace'
  const timePart = new Date(createdAt).getTime().toString(36)
  return `platform_assistant_${companyPart}_${timePart}`
}

export const getPlatformAssistantStarterPrompts = () => [...PLATFORM_ASSISTANT_PROMPTS]

export const createPlatformAssistantSession = (user: User): PlatformAssistantSession | null => {
  const companyId = getCompanyIdForUser(user)
  if(!companyId) return null

  const createdAt = new Date().toISOString()

  return {
    id: createAssistantSessionId(companyId, createdAt),
    companyId,
    title: 'Platform Asistanı',
    status: 'draft',
    prompts: getPlatformAssistantStarterPrompts(),
    recommendationPipelineReady: false,
    createdAt,
    createdByUserId: user.id
  }
}
