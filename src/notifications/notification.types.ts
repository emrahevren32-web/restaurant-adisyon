export type AnnouncementType =
  | 'Bilgilendirme'
  | 'Güncelleme'
  | 'Bakım'
  | 'Güvenlik'
  | 'Kampanya'
  | 'Lisans'

export type AnnouncementTargetType =
  | 'Tüm Kullanıcılar'
  | 'Tüm Firmalar'
  | 'Aktif Müşteriler'
  | 'Deneme Hesapları'
  | 'Belirli Firma'
  | 'Belirli Paket'

export type AnnouncementStatus =
  | 'Taslak'
  | 'Planlandı'
  | 'Yayında'
  | 'Süresi Doldu'

export type NotificationFoundationType =
  | 'Notification Center'
  | 'In-App Notifications'
  | 'Read Tracking'
  | 'Push Notifications'
  | 'Announcement Delivery'

export type AnnouncementTargetOption = {
  id: string
  label: string
}

export type SystemAnnouncement = {
  id: string
  title: string
  content: string
  type: AnnouncementType
  targetType: AnnouncementTargetType
  targetId: string
  targetLabel: string
  startAt: string
  endAt: string
  status: AnnouncementStatus
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type SystemAnnouncementInput = {
  title: string
  content: string
  type: AnnouncementType
  targetType: AnnouncementTargetType
  targetId?: string
  targetLabel?: string
  startAt: string
  endAt: string
  status: AnnouncementStatus
}
