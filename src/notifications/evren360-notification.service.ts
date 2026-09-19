// ═══════════════════════════════════════════════════════════════════════════
// MİYOP · Bildirim merkezi (zil ikonu)
//
// ⚠️ İKİ AYRI ŞEY BURADA:
//   1. `localStorage`da SAKLANAN bildirimler — eski yol. Yeni bildirimler
//      saklanmıyor, başvuru defterinden TÜRETİLİYOR (basvuru-bildirimleri.ts).
//   2. OKUNDU bilgisi — hangi bildirimi Emrah gördü. Bu gerçekten kişisel
//      ekran durumu, veri değil; `localStorage` doğru yer.
//
// Türetilen bildirimlerin `readAt` alanı (2)'den geliyor. Böylece defter
// değişse de "okudum" bilgisi kaybolmuyor.
//
// ── SAHTE BİLDİRİMLER KALDIRILDI (2026-09-19) ────────────────────────────
// Burada `ensureEvren360NotificationPlaceholders` diye bir işlev vardı ve
// zile iki uydurma satır yazıyordu ("Placeholder: destek talebi servisi
// bağlandığında..."). Kural açıktı: müşterinin — ve sahibinin — görmemesi
// gereken hiçbir şey ekranda olmaz. Bir şey henüz yoksa zil SUSAR; olmayan
// bir şeyi varmış gibi göstermez.
// ═══════════════════════════════════════════════════════════════════════════

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
/** Bildirim kimliği → okunma zamanı. Türetilen bildirimler bunu kullanır. */
const OKUNDU_KEY = 'evren360_bildirim_okundu'
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

/**
 * Eskiden zile yazılmış sahte satırları TEMİZLER.
 *
 * Kaldırmak yetmiyor: o iki satır kullanıcıların tarayıcısına çoktan
 * yazıldı ve orada duruyor. Kod değişikliği onları silmez — bu işlev siler.
 * Zil her açıldığında çağrılıyor; bir kez temizlendikten sonra hiçbir şey
 * yapmıyor.
 */
export const eskiSahteBildirimleriTemizle = () => {
  const notifications = readNotifications()
  const temiz = notifications.filter(n => !n.id.startsWith('evren360_placeholder_'))
  if(temiz.length === notifications.length) return
  saveNotifications(temiz)
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

/**
 * Okundu defteri.
 *
 * Bozuksa boş sayılıyor — okunmamış göstermek, hiç göstermemekten iyidir.
 */
export const loadOkunanBildirimler = (): Record<string, string> => {
  if(!isBrowser()) return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(OKUNDU_KEY) || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, string>
      : {}
  } catch {
    return {}
  }
}

const saveOkunanBildirimler = (kayit: Record<string, string>) => {
  if(!isBrowser()) return
  // ⚠️ Sınırsız büyümesin: başvurular kapandıkça eski kimlikler ölü kalır.
  // En yeni 500 kayıt fazlasıyla yeter; zil zaten en çok 30 satır gösteriyor.
  const girdiler = Object.entries(kayit)
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 500)
  localStorage.setItem(OKUNDU_KEY, JSON.stringify(Object.fromEntries(girdiler)))
  emitNotificationUpdate()
}

export const markEvren360NotificationRead = (notificationId: string) => {
  const now = new Date().toISOString()
  // Saklanan bildirimler (eski yol)
  saveNotifications(readNotifications().map(notification => (
    notification.id === notificationId ? { ...notification, readAt: notification.readAt || now } : notification
  )), false)
  // Türetilen bildirimler (yeni yol)
  const okunanlar = loadOkunanBildirimler()
  if(!okunanlar[notificationId]) okunanlar[notificationId] = now
  saveOkunanBildirimler(okunanlar)
}

/**
 * Hepsini okundu işaretler.
 *
 * ⚠️ Kimlikleri DIŞARIDAN alıyor. Türetilen bildirimler bu dosyada
 * tutulmuyor; "hepsi"nin ne olduğunu bilen taraf, ekranın o an gösterdiği
 * listedir. Burada uydurmak, görülmemiş bir bildirimi okundu saymak olurdu.
 */
export const markAllEvren360NotificationsRead = (kimlikler: string[] = []) => {
  const now = new Date().toISOString()
  saveNotifications(readNotifications().map(notification => (
    notification.readAt ? notification : { ...notification, readAt: now }
  )), false)

  const okunanlar = loadOkunanBildirimler()
  for(const kimlik of kimlikler){
    if(!okunanlar[kimlik]) okunanlar[kimlik] = now
  }
  saveOkunanBildirimler(okunanlar)
}

export const subscribeEvren360Notifications = (listener: () => void) => {
  if(!isBrowser()) return () => {}

  const handleStorage = (event: StorageEvent) => {
    if(event.key === STORAGE_KEY || event.key === OKUNDU_KEY) listener()
  }
  const handleCustomEvent = () => listener()

  window.addEventListener('storage', handleStorage)
  window.addEventListener(EVREN360_NOTIFICATION_EVENT, handleCustomEvent)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(EVREN360_NOTIFICATION_EVENT, handleCustomEvent)
  }
}
