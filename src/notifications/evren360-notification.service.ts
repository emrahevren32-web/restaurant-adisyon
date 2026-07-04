export type Evren360NotificationType =
  | 'business_application'
  | 'support_request'
  | 'license_expiry'

export type Evren360NotificationSeverity = 'info' | 'success' | 'warning'

export type Evren360Notification = {
  id: string
  type: Evren360NotificationType
  title: string
  description: string
  targetId: string
  targetLabel: string
  severity: Evren360NotificationSeverity
  createdAt: string
  readAt: string
}

type BusinessApplicationNotificationInput = {
  id: string
  companyName: string
  ownerName: string
}

const STORAGE_KEY = 'evren360_notification_center'
export const EVREN360_NOTIFICATION_EVENT = 'evren360-notifications-updated'

const isBrowser = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined'

const emitNotificationUpdate = () => {
  if(!isBrowser()) return
  window.dispatchEvent(new CustomEvent(EVREN360_NOTIFICATION_EVENT))
}

const readNotifications = (): Evren360Notification[] => {
  if(!isBrowser()) return []

  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.map(normalizeNotification).filter(Boolean) as Evren360Notification[] : []
  } catch {
    return []
  }
}

const saveNotifications = (notifications: Evren360Notification[], emit = true) => {
  if(!isBrowser()) return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.map(normalizeNotification)))
  if(emit) emitNotificationUpdate()
}

const normalizeNotification = (item: Partial<Evren360Notification>): Evren360Notification => {
  const createdAt = String(item.createdAt || new Date().toISOString())
  const type = normalizeNotificationType(item.type)

  return {
    id: String(item.id || `evren360_notification_${Date.now()}`),
    type,
    title: String(item.title || 'EVREN360 bildirimi').trim() || 'EVREN360 bildirimi',
    description: String(item.description || '').trim(),
    targetId: String(item.targetId || '').trim(),
    targetLabel: String(item.targetLabel || '').trim(),
    severity: normalizeSeverity(item.severity, type),
    createdAt,
    readAt: String(item.readAt || '').trim()
  }
}

const normalizeNotificationType = (value: unknown): Evren360NotificationType => {
  if(value === 'support_request' || value === 'license_expiry' || value === 'business_application') return value
  return 'business_application'
}

const normalizeSeverity = (
  value: unknown,
  type: Evren360NotificationType
): Evren360NotificationSeverity => {
  if(value === 'success' || value === 'warning' || value === 'info') return value
  if(type === 'license_expiry' || type === 'support_request') return 'warning'
  return 'info'
}

const sortByNewest = (notifications: Evren360Notification[]) => {
  return [...notifications].sort((first, second) => second.createdAt.localeCompare(first.createdAt))
}

const upsertNotification = (notification: Evren360Notification) => {
  const notifications = readNotifications()
  const exists = notifications.some(item => item.id === notification.id)
  const next = exists
    ? notifications.map(item => item.id === notification.id ? { ...notification, readAt: item.readAt } : item)
    : [notification, ...notifications]

  saveNotifications(sortByNewest(next))
  return notification
}

export const loadEvren360Notifications = () => sortByNewest(readNotifications())

export const loadUnreadEvren360Notifications = () => {
  return loadEvren360Notifications().filter(notification => !notification.readAt)
}

export const ensureEvren360NotificationPlaceholders = () => {
  const notifications = readNotifications()
  const now = new Date().toISOString()
  const placeholders: Evren360Notification[] = [
    normalizeNotification({
      id: 'evren360_placeholder_support_request',
      type: 'support_request',
      title: 'Yeni destek talebi',
      description: 'Placeholder: destek talebi servisi bağlandığında canlı talepler burada listelenecek.',
      targetLabel: 'Destek Merkezi',
      severity: 'warning',
      createdAt: now
    }),
    normalizeNotification({
      id: 'evren360_placeholder_license_expiry',
      type: 'license_expiry',
      title: 'Yaklaşan lisans bitişi',
      description: 'Placeholder: lisans bitiş takibi canlı lisans verisiyle beslenecek.',
      targetLabel: 'Lisans Takibi',
      severity: 'warning',
      createdAt: now
    })
  ]
  const missingPlaceholders = placeholders.filter(placeholder => (
    !notifications.some(notification => notification.id === placeholder.id)
  ))

  if(missingPlaceholders.length === 0) return
  saveNotifications(sortByNewest([...missingPlaceholders, ...notifications]))
}

export const recordBusinessApplicationNotification = (input: BusinessApplicationNotificationInput) => {
  const notification = normalizeNotification({
    id: `evren360_business_application_${input.id}`,
    type: 'business_application',
    title: 'Yeni işletme başvurusu',
    description: `${input.companyName} başvurusu alındı. Yetkili: ${input.ownerName || '-'}. Başlangıç kapsamı: çekirdek sistem modülleri.`,
    targetId: input.id,
    targetLabel: input.companyName,
    severity: 'info',
    createdAt: new Date().toISOString()
  })

  return upsertNotification(notification)
}

export const markEvren360NotificationRead = (notificationId: string) => {
  const now = new Date().toISOString()
  saveNotifications(readNotifications().map(notification => (
    notification.id === notificationId ? { ...notification, readAt: notification.readAt || now } : notification
  )))
}

export const markAllEvren360NotificationsRead = () => {
  const now = new Date().toISOString()
  saveNotifications(readNotifications().map(notification => (
    notification.readAt ? notification : { ...notification, readAt: now }
  )))
}

export const subscribeEvren360Notifications = (listener: () => void) => {
  if(!isBrowser()) return () => {}

  const handleStorage = (event: StorageEvent) => {
    if(event.key === STORAGE_KEY) listener()
  }
  const handleCustomEvent = () => listener()

  window.addEventListener('storage', handleStorage)
  window.addEventListener(EVREN360_NOTIFICATION_EVENT, handleCustomEvent)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(EVREN360_NOTIFICATION_EVENT, handleCustomEvent)
  }
}
