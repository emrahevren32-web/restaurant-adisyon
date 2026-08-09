import {
  ALERT_CATEGORY_LABELS,
  CriticalAlertService
} from '../critical-alerts/critical-alert.service'
import type {
  AlertCategory,
  AlertLevel,
  CriticalAlert
} from '../critical-alerts/critical-alert.types'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import { formatNumber } from '../kpi-reporting/kpi.utils'
import { WasteService } from '../waste-management/waste.service'
import type {
  NotificationCategory,
  NotificationCreateInput,
  NotificationEventKey,
  NotificationFilters,
  NotificationLog,
  NotificationLogAction,
  NotificationLogFilters,
  NotificationModuleKey,
  NotificationRecord,
  NotificationStatistics,
  NotificationStatus,
  NotificationType,
  ToastNotification,
  ToastNotificationInput
} from './notification-engine.types'

export const NOTIFICATION_RECORD_STORAGE_KEY = 'ra_notification_engine_records'
export const NOTIFICATION_LOG_STORAGE_KEY = 'ra_notification_engine_logs'

export const NOTIFICATION_MODULE_LABELS: Record<NotificationModuleKey, string> = {
  purchase: 'Satin Alma',
  production: 'Uretim',
  recipes: 'Receteler',
  lots: 'Lot Takibi',
  shipments: 'Sevkiyat',
  samples: 'Numune',
  waste: 'Fire',
  quality: 'Kalite'
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  INFO: 'Info',
  SUCCESS: 'Success',
  WARNING: 'Warning',
  ERROR: 'Error',
  CRITICAL: 'Critical'
}

export const NOTIFICATION_STATUS_LABELS: Record<NotificationStatus, string> = {
  UNREAD: 'Okunmadi',
  READ: 'Okundu',
  ARCHIVED: 'Arsiv'
}

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  SYSTEM: 'Sistem Bildirimi',
  ALERT: 'Uyari',
  REMINDER: 'Hatirlatma',
  CRITICAL_ALARM: 'Kritik Alarm',
  TOAST: 'Toast'
}

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEventKey, string> = {
  CRITICAL_STOCK: 'Kritik Stok',
  EXPIRY_DATE: 'Son Kullanma Tarihi',
  DELAYED_PRODUCTION: 'Geciken Uretim',
  DELAYED_SHIPMENT: 'Geciken Sevkiyat',
  FAILED_QUALITY_CONTROL: 'Basarisiz Kalite Kontrol',
  WASTE_INCREASE: 'Fire Artisi',
  SAMPLE_EXPIRY: 'Numune Suresi',
  NEW_PURCHASE_REQUEST: 'Yeni Satin Alma Talebi',
  MANUAL: 'Manuel Bildirim',
  TOAST: 'Toast Bildirimi'
}

export const NOTIFICATION_MODULES = Object.keys(NOTIFICATION_MODULE_LABELS) as NotificationModuleKey[]
export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[]
export const NOTIFICATION_STATUSES = Object.keys(NOTIFICATION_STATUS_LABELS) as NotificationStatus[]
export const NOTIFICATION_CATEGORIES = Object.keys(NOTIFICATION_CATEGORY_LABELS) as NotificationCategory[]

const NOTIFICATION_NO_PREFIX = 'NF'
const NOTIFICATION_NO_PADDING = 6
const DEFAULT_USER_NAME = 'Notification Engine'
const DEFAULT_TOAST_DURATION_MS = 4200
const TOAST_EVENT_NAME = 'notification-engine-toast'

type RawNotificationRecord = Partial<Record<keyof NotificationRecord, unknown>> & Record<string, unknown>
type RawNotificationLog = Partial<Record<keyof NotificationLog, unknown>> & Record<string, unknown>
type ToastListener = (toast: ToastNotification) => void

const toastListeners = new Set<ToastListener>()

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value ?? '').trim()
const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')

const normalizeNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const clampScore = (value: unknown) => {
  const parsed = normalizeNumber(value, 0)
  return Math.max(0, Math.min(100, Math.round(parsed)))
}

const nowIso = () => new Date().toISOString()
const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const createStableId = (sourceKey: string) => {
  const normalized = sourceKey
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 96)
  return `notification_${normalized || createId('source')}`
}

const parseDate = (value: unknown) => {
  const text = normalizeText(value)
  if(!text) return null
  const date = new Date(text.includes('T') ? text : `${text}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

const getDateKey = (value: unknown) => {
  const date = parseDate(value)
  return date ? date.toLocaleDateString('sv-SE') : ''
}

const getDayDifference = (value: unknown) => {
  const date = parseDate(value)
  if(!date) return null
  const today = parseDate(getTodayKey())
  if(!today) return null
  return Math.ceil((date.getTime() - today.getTime()) / 86400000)
}

const isToday = (value: unknown) => getDateKey(value) === getTodayKey()

const isWithinPastDays = (value: unknown, days: number) => {
  const diff = getDayDifference(value)
  return diff !== null && diff <= 0 && diff >= -days
}

const readJson = <T,>(key: string, fallback: T): T => {
  if(!isBrowserStorageAvailable()) return fallback

  try {
    const stored = localStorage.getItem(key)
    if(!stored) return fallback
    return JSON.parse(stored) as T
  } catch {
    return fallback
  }
}

const writeJson = <T,>(key: string, value: T) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(key, JSON.stringify(value))
}

const normalizeModuleKey = (value: unknown): NotificationModuleKey => {
  const normalized = normalizeText(value) as NotificationModuleKey
  return NOTIFICATION_MODULES.includes(normalized) ? normalized : 'production'
}

const normalizeType = (value: unknown): NotificationType => {
  const normalized = normalizeText(value).toUpperCase() as NotificationType
  return NOTIFICATION_TYPES.includes(normalized) ? normalized : 'INFO'
}

const normalizeStatus = (value: unknown): NotificationStatus => {
  const normalized = normalizeText(value).toUpperCase() as NotificationStatus
  return NOTIFICATION_STATUSES.includes(normalized) ? normalized : 'UNREAD'
}

const normalizeCategory = (value: unknown): NotificationCategory => {
  const normalized = normalizeText(value).toUpperCase() as NotificationCategory
  return NOTIFICATION_CATEGORIES.includes(normalized) ? normalized : 'SYSTEM'
}

const normalizeEventKey = (value: unknown): NotificationEventKey => {
  const normalized = normalizeText(value).toUpperCase() as NotificationEventKey
  return Object.prototype.hasOwnProperty.call(NOTIFICATION_EVENT_LABELS, normalized) ? normalized : 'MANUAL'
}

const getNextNotificationNo = (
  records: Pick<NotificationRecord, 'notificationNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${NOTIFICATION_NO_PREFIX}-${year}-(\\d{${NOTIFICATION_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.notificationNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${NOTIFICATION_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(NOTIFICATION_NO_PADDING, '0')}`
}

const normalizeNotificationRecord = (
  value: RawNotificationRecord,
  index = 0
): NotificationRecord => {
  const moduleKey = normalizeModuleKey(value.moduleKey)
  const createdAt = normalizeText(value.createdAt) || nowIso()
  const sourceKey = normalizeText(value.sourceKey) || normalizeText(value.id) || createId('notification_source')
  const id = normalizeText(value.id) || createStableId(sourceKey)

  return {
    id,
    notificationNo: normalizeText(value.notificationNo) || getNextNotificationNo([], createdAt, index),
    sourceKey,
    moduleKey,
    moduleLabel: normalizeText(value.moduleLabel) || NOTIFICATION_MODULE_LABELS[moduleKey],
    type: normalizeType(value.type),
    category: normalizeCategory(value.category),
    eventKey: normalizeEventKey(value.eventKey),
    title: normalizeText(value.title) || 'Bildirim',
    message: normalizeText(value.message),
    entityType: normalizeText(value.entityType),
    entityId: normalizeText(value.entityId),
    entityCode: normalizeText(value.entityCode),
    entityName: normalizeText(value.entityName),
    actionRoute: normalizeText(value.actionRoute),
    status: normalizeStatus(value.status),
    readAt: normalizeText(value.readAt),
    createdBy: normalizeText(value.createdBy) || DEFAULT_USER_NAME,
    createdAt,
    updatedAt: normalizeText(value.updatedAt) || createdAt,
    dueAt: normalizeText(value.dueAt),
    priorityScore: clampScore(value.priorityScore)
  }
}

const normalizeNotificationLog = (
  value: RawNotificationLog,
  index = 0
): NotificationLog => {
  const moduleKey = normalizeModuleKey(value.moduleKey)
  const type = normalizeType(value.type)
  const status = normalizeStatus(value.status)
  const action = normalizeText(value.action).toUpperCase() as NotificationLogAction

  return {
    id: normalizeText(value.id) || `notification_log_${index + 1}`,
    notificationId: normalizeText(value.notificationId),
    action: ['CREATED', 'READ', 'UNREAD', 'ARCHIVED', 'TOAST', 'EVALUATED'].includes(action) ? action : 'CREATED',
    userName: normalizeText(value.userName) || DEFAULT_USER_NAME,
    date: normalizeText(value.date) || nowIso(),
    moduleKey,
    moduleLabel: normalizeText(value.moduleLabel) || NOTIFICATION_MODULE_LABELS[moduleKey],
    type,
    status,
    description: normalizeText(value.description)
  }
}

const loadStoredRecords = () => (
  readJson<RawNotificationRecord[]>(NOTIFICATION_RECORD_STORAGE_KEY, [])
    .filter(isRecord)
    .map((record, index) => normalizeNotificationRecord(record as RawNotificationRecord, index))
)

const saveRecords = (records: NotificationRecord[]) => {
  const normalized = records
    .map((record, index) => normalizeNotificationRecord(record as RawNotificationRecord, index))
    .sort((first, second) => (
      second.priorityScore - first.priorityScore
      || second.createdAt.localeCompare(first.createdAt)
      || first.notificationNo.localeCompare(second.notificationNo)
    ))
  writeJson(NOTIFICATION_RECORD_STORAGE_KEY, normalized)
  return normalized
}

const loadLogs = () => (
  readJson<RawNotificationLog[]>(NOTIFICATION_LOG_STORAGE_KEY, [])
    .filter(isRecord)
    .map((record, index) => normalizeNotificationLog(record as RawNotificationLog, index))
)

const saveLogs = (logs: NotificationLog[]) => {
  const normalized = logs
    .map((log, index) => normalizeNotificationLog(log as RawNotificationLog, index))
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 1000)
  writeJson(NOTIFICATION_LOG_STORAGE_KEY, normalized)
  return normalized
}

const appendLog = (
  record: NotificationRecord,
  action: NotificationLogAction,
  userName: string,
  description: string
) => {
  const log: NotificationLog = {
    id: createId('notification_log'),
    notificationId: record.id,
    action,
    userName: normalizeText(userName) || DEFAULT_USER_NAME,
    date: nowIso(),
    moduleKey: record.moduleKey,
    moduleLabel: record.moduleLabel,
    type: record.type,
    status: record.status,
    description
  }
  saveLogs([log, ...loadLogs()])
  return log
}

const createNotificationRecord = (
  input: NotificationCreateInput,
  existingRecords: NotificationRecord[],
  userName: string,
  createdAt = nowIso()
): NotificationRecord => {
  const moduleKey = input.moduleKey
  const sourceKey = normalizeText(input.sourceKey) || createId(`manual_${moduleKey}`)

  return {
    id: createStableId(sourceKey),
    notificationNo: getNextNotificationNo(existingRecords, createdAt),
    sourceKey,
    moduleKey,
    moduleLabel: NOTIFICATION_MODULE_LABELS[moduleKey],
    type: input.type,
    category: input.category,
    eventKey: input.eventKey,
    title: normalizeText(input.title) || NOTIFICATION_EVENT_LABELS[input.eventKey],
    message: normalizeText(input.message),
    entityType: normalizeText(input.entityType),
    entityId: normalizeText(input.entityId),
    entityCode: normalizeText(input.entityCode),
    entityName: normalizeText(input.entityName),
    actionRoute: normalizeText(input.actionRoute),
    status: 'UNREAD',
    readAt: '',
    createdBy: normalizeText(userName) || DEFAULT_USER_NAME,
    createdAt,
    updatedAt: createdAt,
    dueAt: normalizeText(input.dueAt),
    priorityScore: clampScore(input.priorityScore)
  }
}

const createEvaluatedRecord = (
  input: NotificationCreateInput,
  userName: string
): NotificationRecord => ({
  ...createNotificationRecord(input, [], userName),
  notificationNo: '',
  id: createStableId(normalizeText(input.sourceKey) || createId('evaluated_notification'))
})

const mergeStoredAndEvaluatedRecords = (
  storedRecords: NotificationRecord[],
  evaluatedRecords: NotificationRecord[],
  userName: string
) => {
  const storedBySource = new Map(storedRecords.map(record => [record.sourceKey, record]))
  const evaluatedSources = new Set(evaluatedRecords.map(record => record.sourceKey))
  const nextRecords: NotificationRecord[] = []
  let newRecordOffset = 0

  evaluatedRecords.forEach(record => {
    const stored = storedBySource.get(record.sourceKey)
    if(stored){
      nextRecords.push({
        ...record,
        id: stored.id,
        notificationNo: stored.notificationNo,
        status: stored.status,
        readAt: stored.readAt,
        createdAt: stored.createdAt,
        createdBy: stored.createdBy,
        updatedAt: record.updatedAt
      })
      return
    }

    const createdAt = record.createdAt || nowIso()
    const notificationNo = getNextNotificationNo([...storedRecords, ...nextRecords], createdAt, newRecordOffset)
    newRecordOffset += 1
    const nextRecord: NotificationRecord = {
      ...record,
      notificationNo,
      createdAt,
      updatedAt: createdAt
    }
    nextRecords.push(nextRecord)
    appendLog(nextRecord, 'EVALUATED', userName, `${nextRecord.title} sistem olayindan olusturuldu.`)
  })

  const historicalRecords = storedRecords.filter(record => !evaluatedSources.has(record.sourceKey))
  return saveRecords([...nextRecords, ...historicalRecords])
}

const mapAlertCategoryToModule = (category: AlertCategory): NotificationModuleKey => {
  if(category === 'STOCK') return 'purchase'
  if(category === 'LOT') return 'lots'
  if(category === 'SHIPMENT') return 'shipments'
  if(category === 'QUALITY' || category === 'HACCP' || category === 'GOODS_RECEIPT') return 'quality'
  if(category === 'PRODUCTION' || category === 'MACHINE' || category === 'CAPACITY' || category === 'MAINTENANCE' || category === 'PERSONNEL') return 'production'
  return 'production'
}

const mapAlertLevelToNotificationType = (level: AlertLevel): NotificationType => {
  if(level === 'CRITICAL') return 'CRITICAL'
  if(level === 'HIGH') return 'ERROR'
  if(level === 'WARNING') return 'WARNING'
  return 'INFO'
}

const mapAlertToEventKey = (alert: CriticalAlert): NotificationEventKey => {
  if(alert.category === 'STOCK') return 'CRITICAL_STOCK'
  if(alert.category === 'LOT') return 'EXPIRY_DATE'
  if(alert.category === 'SHIPMENT') return 'DELAYED_SHIPMENT'
  if(alert.category === 'QUALITY' || alert.category === 'HACCP' || alert.category === 'GOODS_RECEIPT') return 'FAILED_QUALITY_CONTROL'
  if(alert.category === 'PRODUCTION' || alert.category === 'CAPACITY' || alert.category === 'MACHINE') return 'DELAYED_PRODUCTION'
  return 'MANUAL'
}

const getProductNameForLot = (
  productId: string,
  stockItemId: string,
  sourceData: KpiSourceData
) => sourceData.productRefs.find(product => product.id === productId || product.stockItemId === stockItemId)?.name
  || sourceData.stockItems.find(item => item.id === stockItemId)?.name
  || productId
  || stockItemId
  || '-'

const getProductionOrderClosed = (status: unknown) => {
  const text = normalizeSearchText(status)
  return text.includes('tamam')
    || text.includes('sevk')
    || text.includes('iptal')
    || text.includes('cancel')
}

const evaluateCriticalAlertNotifications = (
  sourceData: KpiSourceData,
  userName: string
) => CriticalAlertService.list(sourceData)
  .filter(alert => alert.status !== 'RESOLVED' && alert.status !== 'DISMISSED')
  .map(alert => {
    const moduleKey = mapAlertCategoryToModule(alert.category)
    const eventKey = mapAlertToEventKey(alert)
    return createEvaluatedRecord({
      moduleKey,
      type: mapAlertLevelToNotificationType(alert.level),
      category: alert.level === 'CRITICAL' ? 'CRITICAL_ALARM' : 'ALERT',
      eventKey,
      sourceKey: `critical-alert:${alert.id}`,
      title: alert.title || ALERT_CATEGORY_LABELS[alert.category],
      message: alert.reason || alert.description || alert.recommendedAction,
      entityType: alert.relatedEntityType || alert.sourceModule,
      entityId: alert.relatedEntityId || alert.sourceId,
      entityCode: alert.sourceNo || alert.alertNo,
      entityName: alert.relatedEntityName || alert.sourceNo,
      actionRoute: eventKey === 'CRITICAL_STOCK' ? 'stock-cards' : eventKey === 'DELAYED_SHIPMENT' ? 'shipments' : 'critical-alerts',
      dueAt: alert.lastDetectedAt || alert.createdAt,
      priorityScore: alert.riskScore
    }, userName)
  })

const evaluateCriticalStockNotifications = (
  sourceData: KpiSourceData,
  userName: string
) => sourceData.stockItems
  .filter(item => item.active !== false && item.minQty > 0 && item.currentQty <= item.minQty)
  .map(item => {
    const shortageRatio = item.currentQty <= 0 ? 1 : Math.max(0, (item.minQty - item.currentQty) / item.minQty)
    return createEvaluatedRecord({
      moduleKey: 'purchase',
      type: shortageRatio >= 0.5 ? 'CRITICAL' : 'WARNING',
      category: shortageRatio >= 0.5 ? 'CRITICAL_ALARM' : 'ALERT',
      eventKey: 'CRITICAL_STOCK',
      sourceKey: `critical-stock:${item.id}`,
      title: 'Kritik stok',
      message: `${item.name} stok seviyesi ${formatNumber(item.currentQty)} ${item.unit}; minimum ${formatNumber(item.minQty)} ${item.unit}.`,
      entityType: 'StockItem',
      entityId: item.id,
      entityCode: item.sku || item.barcode || item.id,
      entityName: item.name,
      actionRoute: 'stock-cards',
      priorityScore: shortageRatio >= 0.5 ? 95 : 70
    }, userName)
  })

const evaluateExpiryNotifications = (
  sourceData: KpiSourceData,
  userName: string
) => sourceData.inventoryLots
  .filter(lot => !['CONSUMED', 'DISPOSED', 'RETURNED'].includes(lot.status))
  .map(lot => ({ lot, diff: getDayDifference(lot.expiryDate) }))
  .filter(item => item.diff !== null && item.diff <= 7)
  .map(({ lot, diff }) => {
    const productName = getProductNameForLot(lot.productId, lot.stockItemId, sourceData)
    const expired = Number(diff) < 0
    return createEvaluatedRecord({
      moduleKey: 'lots',
      type: expired ? 'CRITICAL' : 'WARNING',
      category: expired ? 'CRITICAL_ALARM' : 'REMINDER',
      eventKey: 'EXPIRY_DATE',
      sourceKey: `expiry-date:${lot.id}`,
      title: expired ? 'SKT gecmis lot' : 'SKT yaklasiyor',
      message: `${lot.lotNo} lotu ${expired ? `${Math.abs(Number(diff))} gun once` : `${Number(diff)} gun icinde`} son kullanma tarihine ulasiyor.`,
      entityType: 'InventoryLot',
      entityId: lot.id,
      entityCode: lot.lotNo,
      entityName: productName,
      actionRoute: 'inventory-lots',
      dueAt: lot.expiryDate,
      priorityScore: expired ? 100 : 76
    }, userName)
  })

const evaluateDelayedProductionNotifications = (
  sourceData: KpiSourceData,
  userName: string
) => sourceData.productionOrders
  .filter(order => !getProductionOrderClosed(order.status))
  .map(order => ({ order, diff: getDayDifference(order.deliveryDate) }))
  .filter(item => item.diff !== null && Number(item.diff) < 0)
  .map(({ order, diff }) => createEvaluatedRecord({
    moduleKey: 'production',
    type: Number(diff) <= -3 ? 'ERROR' : 'WARNING',
    category: Number(diff) <= -3 ? 'ALERT' : 'REMINDER',
    eventKey: 'DELAYED_PRODUCTION',
    sourceKey: `delayed-production:${order.id}`,
    title: 'Geciken uretim',
    message: `${order.workOrderNo} teslim tarihi ${Math.abs(Number(diff))} gun gecikti.`,
    entityType: 'ProductionWorkOrder',
    entityId: order.id,
    entityCode: order.workOrderNo,
    entityName: order.description || order.requester || order.workOrderNo,
    actionRoute: 'production-work-orders',
    dueAt: order.deliveryDate,
    priorityScore: Number(diff) <= -3 ? 88 : 66
  }, userName))

const evaluateDelayedShipmentNotifications = (
  sourceData: KpiSourceData,
  userName: string
) => sourceData.shipments
  .filter(shipment => !['DELIVERED', 'CANCELLED'].includes(shipment.status))
  .map(shipment => ({ shipment, diff: getDayDifference(shipment.plannedDeliveryDate) }))
  .filter(item => item.diff !== null && Number(item.diff) < 0)
  .map(({ shipment, diff }) => createEvaluatedRecord({
    moduleKey: 'shipments',
    type: Number(diff) <= -2 ? 'ERROR' : 'WARNING',
    category: 'ALERT',
    eventKey: 'DELAYED_SHIPMENT',
    sourceKey: `delayed-shipment:${shipment.id}`,
    title: 'Geciken sevkiyat',
    message: `${shipment.shipmentNo} planlanan teslim tarihini ${Math.abs(Number(diff))} gun asti.`,
    entityType: 'Shipment',
    entityId: shipment.id,
    entityCode: shipment.shipmentNo,
    entityName: shipment.destinationBranchId,
    actionRoute: 'shipments',
    dueAt: shipment.plannedDeliveryDate,
    priorityScore: Number(diff) <= -2 ? 86 : 68
  }, userName))

const evaluateFailedQualityNotifications = (
  sourceData: KpiSourceData,
  userName: string
) => sourceData.haccpRecords.flatMap(plan => {
  const ccpNameById = new Map(plan.criticalControlPoints.map(ccp => [ccp.id, ccp.name]))
  return plan.monitoringRecords
    .filter(record => record.result === 'FAIL')
    .map(record => createEvaluatedRecord({
      moduleKey: 'quality',
      type: 'ERROR',
      category: 'ALERT',
      eventKey: 'FAILED_QUALITY_CONTROL',
      sourceKey: `failed-quality:${plan.id}:${record.id}`,
      title: 'Basarisiz kalite kontrol',
      message: `${plan.name} planinda ${ccpNameById.get(record.ccpId) || record.ccpId} kontrolu basarisiz oldu.`,
      entityType: 'HACCPMonitoringRecord',
      entityId: record.id,
      entityCode: plan.code,
      entityName: ccpNameById.get(record.ccpId) || plan.name,
      actionRoute: 'haccp-management',
      dueAt: record.checkedAt,
      priorityScore: 90
    }, userName))
})

const evaluateWasteIncreaseNotifications = (
  sourceData: KpiSourceData,
  userName: string
) => {
  const recentWaste = WasteService.list(sourceData).filter(record => isWithinPastDays(record.date || record.createdAt, 7))
  if(recentWaste.length < 3) return []

  const totalCost = recentWaste.reduce((sum, record) => sum + record.totalCost, 0)
  const topRecord = [...recentWaste].sort((first, second) => second.totalCost - first.totalCost)[0]

  return [createEvaluatedRecord({
    moduleKey: 'waste',
    type: totalCost >= 5000 ? 'CRITICAL' : 'WARNING',
    category: totalCost >= 5000 ? 'CRITICAL_ALARM' : 'ALERT',
    eventKey: 'WASTE_INCREASE',
    sourceKey: `waste-increase:${getTodayKey()}`,
    title: 'Fire artisi',
    message: `Son 7 gunde ${formatNumber(recentWaste.length)} fire kaydi ve ${formatNumber(totalCost)} toplam maliyet izlendi.`,
    entityType: 'WasteRecord',
    entityId: topRecord?.id || '',
    entityCode: topRecord?.wasteNo || '',
    entityName: topRecord?.productName || 'Fire kayitlari',
    actionRoute: 'waste-management',
    priorityScore: totalCost >= 5000 ? 92 : 72
  }, userName)]
}

const evaluateSampleExpiryNotifications = (
  sourceData: KpiSourceData,
  userName: string
) => sourceData.qualitySamples
  .filter(sample => !['RELEASED', 'DISCARDED'].includes(sample.status))
  .map(sample => ({ sample, diff: getDayDifference(sample.expiryDate) }))
  .filter(item => item.diff !== null && item.diff <= 3)
  .map(({ sample, diff }) => createEvaluatedRecord({
    moduleKey: 'samples',
    type: Number(diff) < 0 ? 'ERROR' : 'WARNING',
    category: 'REMINDER',
    eventKey: 'SAMPLE_EXPIRY',
    sourceKey: `sample-expiry:${sample.id}`,
    title: Number(diff) < 0 ? 'Numune suresi gecti' : 'Numune suresi yaklasiyor',
    message: `${sample.sampleNo} numunesi ${Number(diff) < 0 ? `${Math.abs(Number(diff))} gun once` : `${Number(diff)} gun icinde`} sure limitine ulasiyor.`,
    entityType: 'QualitySample',
    entityId: sample.id,
    entityCode: sample.sampleNo,
    entityName: sample.storageLocation || sample.sampleType,
    actionRoute: 'sample-tracking',
    dueAt: sample.expiryDate,
    priorityScore: Number(diff) < 0 ? 84 : 64
  }, userName))

const evaluateNewPurchaseRequestNotifications = (
  sourceData: KpiSourceData,
  userName: string
) => sourceData.purchaseRequests
  .filter(request => isToday(request.createdAt || request.requestDate))
  .slice(0, 10)
  .map(request => createEvaluatedRecord({
    moduleKey: 'purchase',
    type: request.priority === 'URGENT' ? 'WARNING' : 'INFO',
    category: 'SYSTEM',
    eventKey: 'NEW_PURCHASE_REQUEST',
    sourceKey: `new-purchase-request:${request.id}`,
    title: 'Yeni satin alma talebi',
    message: `${request.requestNo} talebi ${request.requester} tarafindan olusturuldu.`,
    entityType: 'PurchaseRequest',
    entityId: request.id,
    entityCode: request.requestNo,
    entityName: request.title,
    actionRoute: 'purchase-requests',
    dueAt: request.requiredDate,
    priorityScore: request.priority === 'URGENT' ? 74 : 42
  }, userName))

const evaluateNotificationRecords = (
  sourceData: KpiSourceData,
  userName = DEFAULT_USER_NAME
) => [
  ...evaluateCriticalAlertNotifications(sourceData, userName),
  ...evaluateCriticalStockNotifications(sourceData, userName),
  ...evaluateExpiryNotifications(sourceData, userName),
  ...evaluateDelayedProductionNotifications(sourceData, userName),
  ...evaluateDelayedShipmentNotifications(sourceData, userName),
  ...evaluateFailedQualityNotifications(sourceData, userName),
  ...evaluateWasteIncreaseNotifications(sourceData, userName),
  ...evaluateSampleExpiryNotifications(sourceData, userName),
  ...evaluateNewPurchaseRequestNotifications(sourceData, userName)
]

export const createDefaultNotificationFilters = (): NotificationFilters => ({
  status: 'all',
  moduleKey: 'all',
  type: 'all',
  category: 'all',
  date: '',
  search: ''
})

const listNotificationRecords = (
  sourceData: KpiSourceData = loadKpiSourceData(),
  userName = DEFAULT_USER_NAME
) => {
  const storedRecords = loadStoredRecords()
  const evaluatedRecords = evaluateNotificationRecords(sourceData, userName)
  return mergeStoredAndEvaluatedRecords(storedRecords, evaluatedRecords, userName)
}

const createNotification = (
  input: NotificationCreateInput,
  userName = DEFAULT_USER_NAME
) => {
  const existingRecords = loadStoredRecords()
  const record = createNotificationRecord(input, existingRecords, userName)
  saveRecords([record, ...existingRecords])
  appendLog(record, 'CREATED', userName, `${record.title} bildirimi olusturuldu.`)
  return record
}

const updateNotificationStatus = (
  notificationId: string,
  status: NotificationStatus,
  userName = DEFAULT_USER_NAME
) => {
  const records = loadStoredRecords()
  const record = records.find(item => item.id === notificationId)
  if(!record) throw new Error('Bildirim bulunamadi.')

  const updatedAt = nowIso()
  const nextRecord: NotificationRecord = {
    ...record,
    status,
    readAt: status === 'READ' ? record.readAt || updatedAt : status === 'UNREAD' ? '' : record.readAt,
    updatedAt
  }
  saveRecords(records.map(item => item.id === notificationId ? nextRecord : item))
  appendLog(nextRecord, status === 'READ' ? 'READ' : status === 'UNREAD' ? 'UNREAD' : 'ARCHIVED', userName, `${nextRecord.notificationNo} durumu ${NOTIFICATION_STATUS_LABELS[status]} yapildi.`)
  return nextRecord
}

const markAllRead = (
  filters: NotificationFilters = createDefaultNotificationFilters(),
  userName = DEFAULT_USER_NAME
) => {
  const records = loadStoredRecords()
  const targets = new Set(filterNotificationRecords(records, filters)
    .filter(record => record.status !== 'ARCHIVED')
    .map(record => record.id))
  if(targets.size === 0) return records

  const updatedAt = nowIso()
  const nextRecords = records.map(record => targets.has(record.id)
    ? {
      ...record,
      status: 'READ' as NotificationStatus,
      readAt: record.readAt || updatedAt,
      updatedAt
    }
    : record
  )
  const saved = saveRecords(nextRecords)
  saved.filter(record => targets.has(record.id)).forEach(record => {
    appendLog(record, 'READ', userName, `${record.notificationNo} toplu okundu yapildi.`)
  })
  return saved
}

const filterNotificationRecords = (
  records: NotificationRecord[],
  filters: NotificationFilters
) => {
  const search = normalizeSearchText(filters.search)

  return records.filter(record => {
    const matchesSearch = !search || [
      record.notificationNo,
      record.title,
      record.message,
      record.moduleLabel,
      NOTIFICATION_EVENT_LABELS[record.eventKey],
      record.entityCode,
      record.entityName,
      record.createdBy
    ].some(value => normalizeSearchText(value).includes(search))

    return matchesSearch
      && (filters.status === 'all' || record.status === filters.status)
      && (filters.moduleKey === 'all' || record.moduleKey === filters.moduleKey)
      && (filters.type === 'all' || record.type === filters.type)
      && (filters.category === 'all' || record.category === filters.category)
      && (!filters.date || record.createdAt.slice(0, 10) === filters.date)
  })
}

const createNotificationStatistics = (
  records: NotificationRecord[]
): NotificationStatistics => {
  const moduleCounts = new Map<NotificationModuleKey, number>()
  records.forEach(record => {
    moduleCounts.set(record.moduleKey, (moduleCounts.get(record.moduleKey) || 0) + 1)
  })

  return {
    total: records.length,
    unread: records.filter(record => record.status === 'UNREAD').length,
    read: records.filter(record => record.status === 'READ').length,
    archived: records.filter(record => record.status === 'ARCHIVED').length,
    critical: records.filter(record => record.type === 'CRITICAL').length,
    today: records.filter(record => record.createdAt.slice(0, 10) === getTodayKey()).length,
    warning: records.filter(record => record.type === 'WARNING' || record.type === 'ERROR').length,
    modules: NOTIFICATION_MODULES
      .map(moduleKey => ({
        moduleKey,
        moduleLabel: NOTIFICATION_MODULE_LABELS[moduleKey],
        count: moduleCounts.get(moduleKey) || 0
      }))
      .filter(item => item.count > 0)
      .sort((first, second) => second.count - first.count || first.moduleLabel.localeCompare(second.moduleLabel, 'tr-TR'))
  }
}

const emitToast = (toast: ToastNotification) => {
  toastListeners.forEach(listener => listener(toast))
  if(typeof window !== 'undefined'){
    window.dispatchEvent(new CustomEvent(TOAST_EVENT_NAME, { detail: toast }))
  }
}

const subscribeToasts = (listener: ToastListener) => {
  toastListeners.add(listener)
  return () => {
    toastListeners.delete(listener)
  }
}

const publishToast = (
  input: ToastNotificationInput,
  userName = DEFAULT_USER_NAME
) => {
  const moduleKey = input.moduleKey || 'production'
  const category = input.category || 'TOAST'
  const toast: ToastNotification = {
    id: createId('toast'),
    type: input.type,
    title: normalizeText(input.title) || NOTIFICATION_TYPE_LABELS[input.type],
    message: normalizeText(input.message),
    moduleKey,
    moduleLabel: NOTIFICATION_MODULE_LABELS[moduleKey],
    category,
    createdAt: nowIso(),
    durationMs: Math.max(1200, normalizeNumber(input.durationMs, DEFAULT_TOAST_DURATION_MS))
  }

  const record = createNotification({
    moduleKey,
    type: input.type,
    category,
    eventKey: 'TOAST',
    title: toast.title,
    message: toast.message,
    sourceKey: toast.id,
    priorityScore: input.type === 'CRITICAL' ? 90 : input.type === 'ERROR' ? 76 : input.type === 'WARNING' ? 58 : 25
  }, userName)
  appendLog(record, 'TOAST', userName, `${toast.title} toast bildirimi yayinlandi.`)
  emitToast(toast)
  return toast
}

const filterNotificationLogs = (
  logs: NotificationLog[],
  filters: NotificationLogFilters
) => {
  const userSearch = normalizeSearchText(filters.userName)

  return logs.filter(log => (
    (!userSearch || normalizeSearchText(log.userName).includes(userSearch))
    && (filters.moduleKey === 'all' || log.moduleKey === filters.moduleKey)
    && (filters.type === 'all' || log.type === filters.type)
    && (filters.status === 'all' || log.status === filters.status)
    && (!filters.date || log.date.slice(0, 10) === filters.date)
  ))
}

const createLogStatistics = (logs: NotificationLog[]) => ({
  totalLogs: logs.length,
  todayLogs: logs.filter(log => log.date.slice(0, 10) === getTodayKey()).length,
  createdLogs: logs.filter(log => log.action === 'CREATED' || log.action === 'EVALUATED').length,
  readLogs: logs.filter(log => log.action === 'READ').length,
  toastLogs: logs.filter(log => log.action === 'TOAST').length
})

export const NotificationEngineService = {
  createDefaultFilters: createDefaultNotificationFilters,
  list: listNotificationRecords,
  evaluate: evaluateNotificationRecords,
  create: createNotification,
  filter: filterNotificationRecords,
  statistics: createNotificationStatistics,
  markRead: (notificationId: string, userName?: string) => updateNotificationStatus(notificationId, 'READ', userName),
  markUnread: (notificationId: string, userName?: string) => updateNotificationStatus(notificationId, 'UNREAD', userName),
  archive: (notificationId: string, userName?: string) => updateNotificationStatus(notificationId, 'ARCHIVED', userName),
  markAllRead,
  toast: publishToast,
  subscribeToasts,
  labels: {
    modules: NOTIFICATION_MODULE_LABELS,
    types: NOTIFICATION_TYPE_LABELS,
    statuses: NOTIFICATION_STATUS_LABELS,
    categories: NOTIFICATION_CATEGORY_LABELS,
    events: NOTIFICATION_EVENT_LABELS
  },
  history: {
    list: loadLogs,
    filter: (filters: NotificationLogFilters) => filterNotificationLogs(loadLogs(), filters),
    statistics: () => createLogStatistics(loadLogs())
  }
}
