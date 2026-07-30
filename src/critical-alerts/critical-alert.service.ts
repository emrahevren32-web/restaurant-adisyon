import type { KpiSourceData } from '../kpi-reporting/kpi.types'
import {
  ALL_FILTER,
  roundKpi
} from '../kpi-reporting/kpi.utils'
import {
  ALERT_CATEGORIES,
  ALERT_CATEGORY_LABELS,
  ALERT_LEVEL_LABELS,
  ALERT_LEVELS,
  ALERT_PRIORITIES,
  ALERT_PRIORITY_LABELS,
  ALERT_STATUSES,
  ALERT_STATUS_LABELS
} from './critical-alert.constants'
import { evaluateCriticalAlerts, AlertEvaluationService } from './alert-evaluation.service'
import { appendAlertHistory, createAlertHistory } from './alert-history.service'
import { AlertRuleService } from './alert-rule.service'
import { createAlertStatistics } from './alert-statistics.service'
import type {
  AlertCategory,
  AlertHistory,
  AlertHistoryAction,
  AlertLevel,
  AlertPriority,
  AlertStatus,
  CriticalAlert,
  CriticalAlertFilters
} from './critical-alert.types'

export {
  ALERT_CATEGORIES,
  ALERT_CATEGORY_LABELS,
  ALERT_LEVEL_LABELS,
  ALERT_LEVELS,
  ALERT_PRIORITIES,
  ALERT_PRIORITY_LABELS,
  ALERT_STATUSES,
  ALERT_STATUS_LABELS
} from './critical-alert.constants'

export const CRITICAL_ALERT_STORAGE_KEY = 'ra_critical_alert_engine_records'

type RawCriticalAlert = Partial<Record<keyof CriticalAlert, unknown>> & Record<string, unknown>

const ALERT_NO_PREFIX = 'AL'
const ALERT_NO_PADDING = 6

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()
const normalizeSearchText = (value: unknown) => normalizeText(value).toLocaleLowerCase('tr-TR')
const normalizeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? roundKpi(parsed) : 0
}

const getTodayKey = () => new Date().toLocaleDateString('sv-SE')

const getNextAlertNo = (
  records: Pick<CriticalAlert, 'alertNo'>[],
  dateValue = getTodayKey(),
  offset = 0
) => {
  const year = (dateValue || getTodayKey()).slice(0, 4)
  const pattern = new RegExp(`^${ALERT_NO_PREFIX}-${year}-(\\d{${ALERT_NO_PADDING}})$`)
  const maxNo = records.reduce((max, record) => {
    const match = record.alertNo.match(pattern)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `${ALERT_NO_PREFIX}-${year}-${String(maxNo + 1 + offset).padStart(ALERT_NO_PADDING, '0')}`
}

export const createDefaultCriticalAlertFilters = (): CriticalAlertFilters => ({
  category: ALL_FILTER,
  level: ALL_FILTER,
  status: ALL_FILTER,
  branchId: ALL_FILTER,
  productionLineId: ALL_FILTER,
  machineId: ALL_FILTER,
  employeeId: ALL_FILTER,
  date: '',
  search: ''
})

const mapLevel = (value: unknown): AlertLevel => {
  const normalized = normalizeText(value).toUpperCase() as AlertLevel
  return ALERT_LEVELS.includes(normalized) ? normalized : 'INFO'
}

const mapCategory = (value: unknown): AlertCategory => {
  const normalized = normalizeText(value).toUpperCase() as AlertCategory
  return ALERT_CATEGORIES.includes(normalized) ? normalized : 'PRODUCTION'
}

const mapStatus = (value: unknown): AlertStatus => {
  const normalized = normalizeText(value).toUpperCase() as AlertStatus
  return ALERT_STATUSES.includes(normalized) ? normalized : 'ACTIVE'
}

const mapPriority = (value: unknown): AlertPriority => {
  const normalized = normalizeText(value).toUpperCase() as AlertPriority
  return ALERT_PRIORITIES.includes(normalized) ? normalized : 'NORMAL'
}

const normalizeHistory = (
  value: unknown,
  alertId: string,
  actorName: string
): AlertHistory[] => {
  if(!Array.isArray(value)) return []

  return value.filter(isRecord).map((history, index) => ({
    id: normalizeText(history.id) || `${alertId}_history_${index + 1}`,
    alertId,
    action: normalizeText(history.action).toUpperCase() as AlertHistoryAction,
    actorName: normalizeText(history.actorName) || actorName,
    description: normalizeText(history.description) || 'Alert guncellendi.',
    createdAt: normalizeText(history.createdAt) || new Date().toISOString()
  }))
}

const normalizeAlert = (
  value: RawCriticalAlert,
  index: number
): CriticalAlert => {
  const id = normalizeText(value.id) || `critical_alert_${index + 1}`
  const alertNo = normalizeText(value.alertNo) || getNextAlertNo([], normalizeText(value.createdAt) || getTodayKey(), index)
  const createdAt = normalizeText(value.createdAt) || new Date().toISOString()
  const actorName = 'Critical Alert Engine'
  const sourceModule = normalizeText(value.sourceModule) as CriticalAlert['sourceModule']
  const alert: CriticalAlert = {
    id,
    alertNo,
    ruleId: normalizeText(value.ruleId),
    status: mapStatus(value.status),
    level: mapLevel(value.level),
    category: mapCategory(value.category),
    priority: mapPriority(value.priority),
    title: normalizeText(value.title) || 'Critical Alert',
    description: normalizeText(value.description),
    reason: normalizeText(value.reason),
    recommendedAction: normalizeText(value.recommendedAction),
    expectedImpact: normalizeText(value.expectedImpact),
    riskScore: normalizeNumber(value.riskScore),
    impactScore: normalizeNumber(value.impactScore),
    durationMinutes: normalizeNumber(value.durationMinutes),
    repeatCount: normalizeNumber(value.repeatCount) || 1,
    sourceModule: sourceModule || 'ReadModel',
    sourceId: normalizeText(value.sourceId),
    sourceNo: normalizeText(value.sourceNo),
    relatedEntityType: normalizeText(value.relatedEntityType),
    relatedEntityId: normalizeText(value.relatedEntityId),
    relatedEntityName: normalizeText(value.relatedEntityName),
    branchId: normalizeText(value.branchId),
    branchName: normalizeText(value.branchName),
    productionLineId: normalizeText(value.productionLineId),
    productionLineName: normalizeText(value.productionLineName),
    machineId: normalizeText(value.machineId),
    machineCode: normalizeText(value.machineCode),
    machineName: normalizeText(value.machineName),
    employeeId: normalizeText(value.employeeId),
    employeeName: normalizeText(value.employeeName),
    lotId: normalizeText(value.lotId),
    lotNo: normalizeText(value.lotNo),
    createdAt,
    updatedAt: normalizeText(value.updatedAt) || createdAt,
    firstDetectedAt: normalizeText(value.firstDetectedAt) || createdAt,
    lastDetectedAt: normalizeText(value.lastDetectedAt) || createdAt,
    history: normalizeHistory(value.history, id, actorName)
  }

  return {
    ...alert,
    history: alert.history.length > 0
      ? alert.history
      : [createAlertHistory(alert.id, 'CREATED', actorName, `${alert.alertNo} alert read-model olarak olusturuldu.`)]
  }
}

const mergeEvaluatedAlerts = (
  storedAlerts: CriticalAlert[],
  evaluatedAlerts: CriticalAlert[]
) => {
  const storedById = new Map(storedAlerts.map(alert => [alert.id, alert]))
  const evaluatedIds = new Set(evaluatedAlerts.map(alert => alert.id))
  const mergedEvaluated = evaluatedAlerts.map(alert => {
    const stored = storedById.get(alert.id)
    if(!stored) return alert

    const repeatCount = stored.repeatCount + 1
    const firstDetectedAt = stored.firstDetectedAt || stored.createdAt
    const durationMinutes = Math.max(0, Math.round((new Date(alert.lastDetectedAt).getTime() - new Date(firstDetectedAt).getTime()) / 60000))
    return {
      ...alert,
      alertNo: stored.alertNo,
      status: stored.status === 'RESOLVED' || stored.status === 'DISMISSED' ? stored.status : alert.status,
      createdAt: stored.createdAt,
      firstDetectedAt,
      durationMinutes,
      repeatCount,
      history: stored.history,
      updatedAt: alert.updatedAt
    }
  })
  const inactiveStored = storedAlerts.filter(alert => !evaluatedIds.has(alert.id) && (alert.status === 'RESOLVED' || alert.status === 'DISMISSED'))

  return [...mergedEvaluated, ...inactiveStored]
    .sort((first, second) => (
      second.riskScore - first.riskScore
      || second.createdAt.localeCompare(first.createdAt)
      || first.alertNo.localeCompare(second.alertNo)
    ))
}

export const saveCriticalAlerts = (alerts: CriticalAlert[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(CRITICAL_ALERT_STORAGE_KEY, JSON.stringify(alerts))
}

export const evaluateCriticalAlertRecords = (
  sourceData: KpiSourceData,
  existingAlerts: CriticalAlert[] = [],
  actorName = 'Critical Alert Engine'
) => evaluateCriticalAlerts({
  sourceData,
  actorName,
  getAlertNo: index => getNextAlertNo(existingAlerts, getTodayKey(), index)
})

export const loadCriticalAlerts = (
  sourceData: KpiSourceData
) => {
  const evaluatedAlerts = evaluateCriticalAlertRecords(sourceData)
  if(!isBrowserStorageAvailable()) return evaluatedAlerts

  const stored = localStorage.getItem(CRITICAL_ALERT_STORAGE_KEY)
  if(stored === null){
    saveCriticalAlerts(evaluatedAlerts)
    return evaluatedAlerts
  }

  try {
    const parsed = JSON.parse(stored)
    if(Array.isArray(parsed)){
      const storedAlerts = parsed
        .filter(isRecord)
        .map((record, index) => normalizeAlert(record as RawCriticalAlert, index))
      const nextEvaluatedAlerts = evaluateCriticalAlertRecords(sourceData, storedAlerts)
      const merged = mergeEvaluatedAlerts(storedAlerts, nextEvaluatedAlerts)
      saveCriticalAlerts(merged)
      return merged
    }
  } catch {
    // Corrupt local alert cache is replaced with fresh read-model evaluation.
  }

  saveCriticalAlerts(evaluatedAlerts)
  return evaluatedAlerts
}

export const filterCriticalAlerts = (
  alerts: CriticalAlert[],
  filters: CriticalAlertFilters
) => {
  const search = normalizeSearchText(filters.search)

  return alerts.filter(alert => {
    const matchesSearch = !search || [
      alert.alertNo,
      alert.title,
      alert.reason,
      alert.recommendedAction,
      alert.sourceModule,
      alert.sourceNo,
      alert.relatedEntityName,
      alert.productionLineName,
      alert.machineCode,
      alert.employeeName,
      alert.lotNo
    ].some(value => normalizeSearchText(value).includes(search))

    return matchesSearch
      && (filters.category === ALL_FILTER || alert.category === filters.category)
      && (filters.level === ALL_FILTER || alert.level === filters.level)
      && (filters.status === ALL_FILTER || alert.status === filters.status)
      && (filters.branchId === ALL_FILTER || alert.branchId === filters.branchId)
      && (filters.productionLineId === ALL_FILTER || alert.productionLineId === filters.productionLineId)
      && (filters.machineId === ALL_FILTER || alert.machineId === filters.machineId)
      && (filters.employeeId === ALL_FILTER || alert.employeeId === filters.employeeId)
      && (!filters.date || alert.createdAt.slice(0, 10) === filters.date)
  })
}

const upsertAlert = (
  alerts: CriticalAlert[],
  nextAlert: CriticalAlert
) => alerts.some(alert => alert.id === nextAlert.id)
  ? alerts.map(alert => alert.id === nextAlert.id ? nextAlert : alert)
  : [nextAlert, ...alerts]

export const updateCriticalAlertStatus = (
  alertId: string,
  status: Extract<AlertStatus, 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const alerts = loadCriticalAlerts(sourceData)
  const alert = alerts.find(record => record.id === alertId)
  if(!alert) throw new Error('Critical alert bulunamadi.')

  const actionByStatus: Record<Extract<AlertStatus, 'ACKNOWLEDGED' | 'RESOLVED' | 'DISMISSED'>, AlertHistoryAction> = {
    ACKNOWLEDGED: 'ACKNOWLEDGED',
    RESOLVED: 'RESOLVED',
    DISMISSED: 'DISMISSED'
  }
  const nextAlert = appendAlertHistory(
    {
      ...alert,
      status
    },
    actionByStatus[status],
    actorName,
    `${alert.alertNo} ${ALERT_STATUS_LABELS[status]} durumuna alindi.`
  )
  saveCriticalAlerts(upsertAlert(alerts, nextAlert))
  return nextAlert
}

export const recordCriticalAlertOutput = (
  alertId: string,
  action: Extract<AlertHistoryAction, 'PRINTED' | 'PDF' | 'EXCEL'>,
  sourceData: KpiSourceData,
  actorName: string
) => {
  const alerts = loadCriticalAlerts(sourceData)
  const alert = alerts.find(record => record.id === alertId)
  if(!alert) throw new Error('Critical alert bulunamadi.')
  const nextAlert = appendAlertHistory(
    alert,
    action,
    actorName,
    action === 'EXCEL' ? `${alert.alertNo} Excel export edildi.` : `${alert.alertNo} cikti penceresi acildi.`
  )
  saveCriticalAlerts(upsertAlert(alerts, nextAlert))
  return nextAlert
}

export const CriticalAlertService = {
  createDefaultFilters: createDefaultCriticalAlertFilters,
  getNextNo: getNextAlertNo,
  save: saveCriticalAlerts,
  list: loadCriticalAlerts,
  evaluate: evaluateCriticalAlertRecords,
  filter: filterCriticalAlerts,
  updateStatus: updateCriticalAlertStatus,
  recordOutput: recordCriticalAlertOutput,
  statistics: createAlertStatistics,
  rules: AlertRuleService,
  evaluation: AlertEvaluationService
}
