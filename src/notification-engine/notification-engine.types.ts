export type NotificationModuleKey =
  | 'purchase'
  | 'production'
  | 'recipes'
  | 'lots'
  | 'shipments'
  | 'samples'
  | 'waste'
  | 'quality'

export type NotificationType =
  | 'INFO'
  | 'SUCCESS'
  | 'WARNING'
  | 'ERROR'
  | 'CRITICAL'

export type NotificationStatus =
  | 'UNREAD'
  | 'READ'
  | 'ARCHIVED'

export type NotificationCategory =
  | 'SYSTEM'
  | 'ALERT'
  | 'REMINDER'
  | 'CRITICAL_ALARM'
  | 'TOAST'

export type NotificationEventKey =
  | 'CRITICAL_STOCK'
  | 'EXPIRY_DATE'
  | 'DELAYED_PRODUCTION'
  | 'DELAYED_SHIPMENT'
  | 'FAILED_QUALITY_CONTROL'
  | 'WASTE_INCREASE'
  | 'SAMPLE_EXPIRY'
  | 'NEW_PURCHASE_REQUEST'
  | 'MANUAL'
  | 'TOAST'

export type NotificationLogAction =
  | 'CREATED'
  | 'READ'
  | 'UNREAD'
  | 'ARCHIVED'
  | 'TOAST'
  | 'EVALUATED'

export type NotificationRecord = {
  id: string
  notificationNo: string
  sourceKey: string
  moduleKey: NotificationModuleKey
  moduleLabel: string
  type: NotificationType
  category: NotificationCategory
  eventKey: NotificationEventKey
  title: string
  message: string
  entityType: string
  entityId: string
  entityCode: string
  entityName: string
  actionRoute: string
  status: NotificationStatus
  readAt: string
  createdBy: string
  createdAt: string
  updatedAt: string
  dueAt: string
  priorityScore: number
}

export type NotificationCreateInput = {
  moduleKey: NotificationModuleKey
  type: NotificationType
  category: NotificationCategory
  eventKey: NotificationEventKey
  title: string
  message: string
  entityType?: string
  entityId?: string
  entityCode?: string
  entityName?: string
  actionRoute?: string
  sourceKey?: string
  dueAt?: string
  priorityScore?: number
}

export type NotificationFilters = {
  status: NotificationStatus | 'all'
  moduleKey: NotificationModuleKey | 'all'
  type: NotificationType | 'all'
  category: NotificationCategory | 'all'
  date: string
  search: string
}

export type NotificationStatistics = {
  total: number
  unread: number
  read: number
  archived: number
  critical: number
  today: number
  warning: number
  modules: Array<{
    moduleKey: NotificationModuleKey
    moduleLabel: string
    count: number
  }>
}

export type NotificationLog = {
  id: string
  notificationId: string
  action: NotificationLogAction
  userName: string
  date: string
  moduleKey: NotificationModuleKey
  moduleLabel: string
  type: NotificationType
  status: NotificationStatus
  description: string
}

export type NotificationLogFilters = {
  userName: string
  moduleKey: NotificationModuleKey | 'all'
  type: NotificationType | 'all'
  status: NotificationStatus | 'all'
  date: string
}

export type ToastNotificationInput = {
  type: NotificationType
  title: string
  message: string
  moduleKey?: NotificationModuleKey
  category?: NotificationCategory
  durationMs?: number
}

export type ToastNotification = {
  id: string
  type: NotificationType
  title: string
  message: string
  moduleKey: NotificationModuleKey
  moduleLabel: string
  category: NotificationCategory
  createdAt: string
  durationMs: number
}
