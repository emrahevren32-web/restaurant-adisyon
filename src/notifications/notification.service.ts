import {
  AnnouncementStatus,
  AnnouncementTargetOption,
  AnnouncementTargetType,
  AnnouncementType,
  NotificationFoundationType,
  SystemAnnouncement,
  SystemAnnouncementInput
} from './notification.types'

const STORAGE_KEY = 'evren360_system_announcements'

export const ANNOUNCEMENT_TYPES: AnnouncementType[] = [
  'Bilgilendirme',
  'Güncelleme',
  'Bakım',
  'Güvenlik',
  'Kampanya',
  'Lisans'
]

export const ANNOUNCEMENT_TARGET_TYPES: AnnouncementTargetType[] = [
  'Tüm Kullanıcılar',
  'Tüm Firmalar',
  'Aktif Müşteriler',
  'Deneme Hesapları',
  'Belirli Firma',
  'Belirli Paket'
]

export const ANNOUNCEMENT_STATUSES: AnnouncementStatus[] = [
  'Taslak',
  'Planlandı',
  'Yayında',
  'Süresi Doldu'
]

export const NOTIFICATION_FOUNDATION_TYPES: NotificationFoundationType[] = [
  'Notification Center',
  'In-App Notifications',
  'Read Tracking',
  'Push Notifications',
  'Announcement Delivery'
]

type DemoAnnouncementContext = {
  companies: AnnouncementTargetOption[]
  packages: AnnouncementTargetOption[]
}

type LegacyAnnouncement = Partial<SystemAnnouncement> & {
  publishAt?: string
}

const createId = () => `system_announcement_${Date.now()}_${Math.random().toString(16).slice(2)}`

const normalizeLookup = (value: string) => value
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/Ä±/g, 'i')
  .replace(/ı/g, 'i')
  .replace(/[^a-z0-9]+/g, '')

const addDays = (days: number, baseValue = new Date().toISOString()) => {
  const date = new Date(baseValue)
  if(Number.isNaN(date.getTime())) date.setTime(Date.now())
  date.setDate(date.getDate() + days)
  date.setMinutes(0, 0, 0)
  return date.toISOString()
}

const readAnnouncements = () => {
  try {
    const rawValue = localStorage.getItem(STORAGE_KEY)
    if(!rawValue) return null
    const parsed = JSON.parse(rawValue)
    return Array.isArray(parsed) ? parsed as LegacyAnnouncement[] : []
  } catch {
    return []
  }
}

const getRuntimeStatus = (announcement: Pick<SystemAnnouncement, 'startAt' | 'endAt' | 'status'>): AnnouncementStatus => {
  if(announcement.status === 'Taslak') return 'Taslak'

  const startDate = new Date(announcement.startAt)
  const endDate = new Date(announcement.endAt)
  const now = Date.now()

  if(!Number.isNaN(endDate.getTime()) && endDate.getTime() < now) return 'Süresi Doldu'
  if(!Number.isNaN(startDate.getTime()) && startDate.getTime() > now) return 'Planlandı'
  return 'Yayında'
}

const normalizeAnnouncementType = (value: unknown): AnnouncementType => {
  const normalized = normalizeLookup(String(value || ''))
  if(normalized.includes('guncelleme')) return 'Güncelleme'
  if(normalized.includes('bakim')) return 'Bakım'
  if(normalized.includes('guvenlik')) return 'Güvenlik'
  if(normalized.includes('kampanya')) return 'Kampanya'
  if(normalized.includes('lisans')) return 'Lisans'
  return 'Bilgilendirme'
}

const normalizeTargetType = (value: unknown): AnnouncementTargetType => {
  const normalized = normalizeLookup(String(value || ''))
  if(normalized.includes('tumkullanici')) return 'Tüm Kullanıcılar'
  if(normalized.includes('tummusteri') || normalized.includes('tumfirma')) return 'Tüm Firmalar'
  if(normalized.includes('aktif')) return 'Aktif Müşteriler'
  if(normalized.includes('deneme')) return 'Deneme Hesapları'
  if(normalized.includes('firma')) return 'Belirli Firma'
  if(normalized.includes('paket')) return 'Belirli Paket'
  return 'Tüm Kullanıcılar'
}

const normalizeStatus = (value: unknown): AnnouncementStatus => {
  const normalized = normalizeLookup(String(value || ''))
  if(normalized.includes('taslak') || normalized.includes('yayindankaldirildi')) return 'Taslak'
  if(normalized.includes('plan')) return 'Planlandı'
  if(normalized.includes('aktif') || normalized.includes('yayinda')) return 'Yayında'
  if(normalized.includes('suresi') || normalized.includes('doldu')) return 'Süresi Doldu'
  return 'Taslak'
}

const normalizeAnnouncement = (item: LegacyAnnouncement): SystemAnnouncement => {
  const timestamp = item.createdAt || new Date().toISOString()
  const startAt = item.startAt || item.publishAt || timestamp
  const endAt = item.endAt || addDays(7, startAt)
  const targetType = normalizeTargetType(item.targetType)
  const announcement: SystemAnnouncement = {
    id: String(item.id || createId()),
    title: String(item.title || 'Sistem duyurusu').trim() || 'Sistem duyurusu',
    content: String(item.content || '').trim(),
    type: normalizeAnnouncementType(item.type),
    targetType,
    targetId: String(item.targetId || '').trim(),
    targetLabel: String(item.targetLabel || targetType).trim() || targetType,
    startAt,
    endAt,
    status: normalizeStatus(item.status),
    createdBy: String(item.createdBy || 'EVREN360 Admin').trim() || 'EVREN360 Admin',
    createdAt: timestamp,
    updatedAt: item.updatedAt || timestamp
  }

  return {
    ...announcement,
    status: getRuntimeStatus(announcement)
  }
}

// ⚠️ 25.10.2026 · `createDemoAnnouncements` SİLİNDİ (MIYOP-059).
// Üç uydurma duyuru üretiyordu — biri "Planlı bakım bildirimi · Pazar
// gecesi", biri "Lisans yenileme hatırlatması" — ve bunlar müşterinin
// gördüğü giriş vitrininde gerçek duyuru gibi görünüyordu. Tarihler her
// açılışta yeniden üretildiği için her gün "iki gün sonra bakım" diyordu.
// Emrah'ın kuralı: *"mock veri asla ama asla olmayacak."*
//
// Kayıt yoksa artık BOŞ dönüyor. Vitrindeki Duyurular bölümü de
// kaldırıldı (bkz. `src/pages/Login.tsx`), çünkü duyuru yazma ekranı
// donmuş ve yazılan duyuru yalnız tarayıcıda kalıyor — yani özellik
// bugün ÇALIŞMIYOR. Geri gelmesi için sunucu tarafı gerekiyor.

export const loadSystemAnnouncements = (): SystemAnnouncement[] => {
  // ⚠️ Kayıt yoksa BOŞ. Eskiden burada demo üretici çağrılıyordu (MIYOP-059).
  const storedAnnouncements = readAnnouncements()
  if(storedAnnouncements === null) return []
  return storedAnnouncements
    .map(normalizeAnnouncement)
    .sort((first, second) => second.startAt.localeCompare(first.startAt))
}

export const saveSystemAnnouncements = (announcements: SystemAnnouncement[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(announcements.map(normalizeAnnouncement)))
}

export const resolveAnnouncementTargetLabel = (
  input: Pick<SystemAnnouncementInput, 'targetType' | 'targetId' | 'targetLabel'>,
  context: DemoAnnouncementContext
) => {
  if(input.targetType === 'Belirli Firma'){
    return context.companies.find(company => company.id === input.targetId)?.label || input.targetLabel || 'Belirli Firma'
  }

  if(input.targetType === 'Belirli Paket'){
    return context.packages.find(packageItem => packageItem.id === input.targetId)?.label || input.targetLabel || 'Belirli Paket'
  }

  return input.targetType
}

export const createSystemAnnouncement = (
  input: SystemAnnouncementInput,
  createdBy: string,
  context: DemoAnnouncementContext
) => {
  const now = new Date().toISOString()
  return normalizeAnnouncement({
    id: createId(),
    ...input,
    targetLabel: resolveAnnouncementTargetLabel(input, context),
    createdBy,
    createdAt: now,
    updatedAt: now
  })
}

export const updateSystemAnnouncement = (
  announcement: SystemAnnouncement,
  input: SystemAnnouncementInput,
  context: DemoAnnouncementContext
) => normalizeAnnouncement({
  ...announcement,
  ...input,
  targetLabel: resolveAnnouncementTargetLabel(input, context),
  updatedAt: new Date().toISOString()
})

export const publishSystemAnnouncement = (announcement: SystemAnnouncement) => {
  const now = new Date().toISOString()
  const currentEnd = new Date(announcement.endAt)
  const endAt = Number.isNaN(currentEnd.getTime()) || currentEnd.getTime() < Date.now()
    ? addDays(7, now)
    : announcement.endAt

  return normalizeAnnouncement({
    ...announcement,
    startAt: now,
    endAt,
    status: 'Yayında',
    updatedAt: now
  })
}

export const archiveSystemAnnouncement = (announcement: SystemAnnouncement) => normalizeAnnouncement({
  ...announcement,
  status: 'Taslak',
  updatedAt: new Date().toISOString()
})
