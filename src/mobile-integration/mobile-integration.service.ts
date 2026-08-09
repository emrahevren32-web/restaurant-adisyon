import { createJwtPayload, validateJwtPayloadShape } from '../auth/jwt.service'
import { createAuthenticationState } from '../auth/authentication.service'
import { hasPermission } from '../authorization/authorization.service'
import type { PermissionName } from '../authorization/permission.types'
import { loadKpiSourceData } from '../kpi-reporting/kpi-source.service'
import { loadSystemAnnouncements } from '../notifications/notification.service'
import { loadUsers } from '../storage'
import type { User } from '../types'
import { WasteService } from '../waste-management/waste.service'
import type {
  MobileAuthCredentials,
  MobileAuthResult,
  MobileAuthorizationAction,
  MobileAuthorizationRequest,
  MobileAuthorizationResult,
  MobileConflict,
  MobileDeviceRecord,
  MobileDeviceRegistrationInput,
  MobileDeviceStatus,
  MobileModuleKey,
  MobileOfflineQueueInput,
  MobileOfflineQueueItem,
  MobileOperationLog,
  MobileOperationType,
  MobilePlatform,
  MobileQueueOperation,
  MobileQueueStatus,
  MobileSyncJob,
  MobileSyncMode,
  MobileSyncModuleSnapshot,
  MobileSyncRequest,
  MobileSyncResult,
  MobileSyncStatus,
  MobileSyncStatusSummary,
  MobileTokenPair,
  MobileTokenSession,
  MobileValidationCode,
  MobileValidationResult
} from './mobile.types'

const MOBILE_DEVICE_STORAGE_KEY = 'ra_mobile_devices'
const MOBILE_TOKEN_STORAGE_KEY = 'ra_mobile_token_sessions'
const MOBILE_OFFLINE_QUEUE_STORAGE_KEY = 'ra_mobile_offline_queue'
const MOBILE_SYNC_JOB_STORAGE_KEY = 'ra_mobile_sync_jobs'
const MOBILE_CONFLICT_STORAGE_KEY = 'ra_mobile_conflicts'
const MOBILE_LOG_STORAGE_KEY = 'ra_mobile_operation_logs'

const DEFAULT_USER_NAME = 'Mobil Sistem'
const ACCESS_TOKEN_TTL_SECONDS = 60 * 60
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30
const DEFAULT_QUEUE_MAX_RETRIES = 3

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

const MOBILE_MODULE_LABELS: Record<MobileModuleKey, string> = {
  'production-orders': 'Uretim Emirleri',
  lots: 'Lot Takibi',
  shipments: 'Sevkiyat',
  samples: 'Numune Takibi',
  waste: 'Fire Yonetimi',
  purchase: 'Satin Alma',
  notifications: 'Bildirimler'
}

const MOBILE_MODULE_PERMISSIONS: Record<MobileModuleKey, Record<MobileAuthorizationAction, PermissionName>> = {
  'production-orders': { READ: 'operations.read', WRITE: 'operations.write' },
  lots: { READ: 'stock.read', WRITE: 'stock.write' },
  shipments: { READ: 'operations.read', WRITE: 'operations.write' },
  samples: { READ: 'operations.read', WRITE: 'operations.write' },
  waste: { READ: 'stock.read', WRITE: 'stock.write' },
  purchase: { READ: 'operations.read', WRITE: 'operations.write' },
  notifications: { READ: 'operations.read', WRITE: 'operations.write' }
}

const SUPPORTED_MODULES = Object.keys(MOBILE_MODULE_LABELS) as MobileModuleKey[]
const SUPPORTED_PLATFORMS: MobilePlatform[] = ['ANDROID', 'IOS', 'WEB', 'PWA', 'UNKNOWN']
const SUPPORTED_SYNC_MODES: MobileSyncMode[] = ['FULL', 'INCREMENTAL', 'RETRY_FAILED']
const SUPPORTED_QUEUE_OPERATIONS: MobileQueueOperation[] = ['CREATE', 'UPDATE', 'DELETE', 'ACK', 'CUSTOM']

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const normalizeText = (value: unknown) => String(value ?? '').trim()

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

const nowIso = () => new Date().toISOString()

const secondsToIso = (seconds: number) => new Date(seconds * 1000).toISOString()

const createValidationResult = (
  codes: MobileValidationCode[],
  errors: string[]
): MobileValidationResult => ({
  valid: errors.length === 0,
  codes,
  errors
})

const mergeValidation = (...results: MobileValidationResult[]): MobileValidationResult => {
  const codes = Array.from(new Set(results.flatMap(result => result.codes)))
  const errors = Array.from(new Set(results.flatMap(result => result.errors)))
  return createValidationResult(codes, errors)
}

const successValidation = () => createValidationResult([], [])

const failedValidation = (code: MobileValidationCode, error: string) => createValidationResult([code], [error])

const readJson = <T,>(key: string, fallback: T): T => {
  if(!isBrowserStorageAvailable()) return fallback

  try{
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

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
)

const getRecordText = (record: unknown, key: string) => (
  isRecord(record) ? normalizeText(record[key]) : ''
)

const getRecordBoolean = (record: unknown, key: string, fallback: boolean) => {
  if(!isRecord(record)) return fallback
  const value = record[key]
  return typeof value === 'boolean' ? value : fallback
}

const getRecordNumber = (record: unknown, key: string, fallback: number) => {
  if(!isRecord(record)) return fallback
  const value = Number(record[key])
  return Number.isFinite(value) ? value : fallback
}

const normalizeDate = (value: unknown, fallback = '') => {
  const text = normalizeText(value)
  if(!text) return fallback
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? text : date.toISOString()
}

const normalizePlatform = (value: unknown): MobilePlatform => {
  const text = normalizeText(value).toUpperCase()
  return SUPPORTED_PLATFORMS.includes(text as MobilePlatform) ? text as MobilePlatform : 'UNKNOWN'
}

const normalizeDeviceStatus = (value: unknown): MobileDeviceStatus => {
  const text = normalizeText(value).toUpperCase()
  if(text === 'PENDING' || text === 'REVOKED') return text
  return 'AUTHORIZED'
}

const normalizeQueueStatus = (value: unknown): MobileQueueStatus => {
  const text = normalizeText(value).toUpperCase()
  if(text === 'SYNCING' || text === 'SYNCED' || text === 'FAILED' || text === 'CONFLICT') return text
  return 'PENDING'
}

const normalizeSyncStatus = (value: unknown): MobileSyncStatus => {
  const text = normalizeText(value).toUpperCase()
  if(text === 'SYNCING' || text === 'SUCCESS' || text === 'FAILED' || text === 'CONFLICT') return text
  return 'IDLE'
}

const normalizeSyncMode = (value: unknown): MobileSyncMode => {
  const text = normalizeText(value).toUpperCase()
  return SUPPORTED_SYNC_MODES.includes(text as MobileSyncMode) ? text as MobileSyncMode : 'FULL'
}

const normalizeQueueOperation = (value: unknown): MobileQueueOperation => {
  const text = normalizeText(value).toUpperCase()
  return SUPPORTED_QUEUE_OPERATIONS.includes(text as MobileQueueOperation) ? text as MobileQueueOperation : 'CUSTOM'
}

const isSupportedModule = (value: unknown): value is MobileModuleKey => (
  SUPPORTED_MODULES.includes(normalizeText(value) as MobileModuleKey)
)

const normalizeModuleKey = (value: unknown): MobileModuleKey => (
  isSupportedModule(value) ? normalizeText(value) as MobileModuleKey : 'production-orders'
)

const encodeUtf8 = (value: string) => {
  const bytes: number[] = []

  for(let index = 0; index < value.length; index += 1){
    let codePoint = value.charCodeAt(index)

    if(codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 < value.length){
      const next = value.charCodeAt(index + 1)
      if(next >= 0xdc00 && next <= 0xdfff){
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (next - 0xdc00)
        index += 1
      }
    }

    if(codePoint <= 0x7f){
      bytes.push(codePoint)
    } else if(codePoint <= 0x7ff){
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f))
    } else if(codePoint <= 0xffff){
      bytes.push(0xe0 | (codePoint >> 12), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f))
    } else {
      bytes.push(0xf0 | (codePoint >> 18), 0x80 | ((codePoint >> 12) & 0x3f), 0x80 | ((codePoint >> 6) & 0x3f), 0x80 | (codePoint & 0x3f))
    }
  }

  return bytes
}

const encodeBase64 = (bytes: number[]) => {
  let result = ''

  for(let index = 0; index < bytes.length; index += 3){
    const first = bytes[index]
    const second = bytes[index + 1]
    const third = bytes[index + 2]
    const triple = (first << 16) | ((second || 0) << 8) | (third || 0)

    result += BASE64_CHARS[(triple >> 18) & 0x3f]
    result += BASE64_CHARS[(triple >> 12) & 0x3f]
    result += second === undefined ? '=' : BASE64_CHARS[(triple >> 6) & 0x3f]
    result += third === undefined ? '=' : BASE64_CHARS[triple & 0x3f]
  }

  return result
}

const base64UrlEncode = (value: string) => (
  encodeBase64(encodeUtf8(value))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
)

const createUnsignedMobileJwt = (payload: object) => {
  const header = { alg: 'none', typ: 'JWT' }
  return `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}.mobile`
}

const normalizeDevice = (value: unknown): MobileDeviceRecord => {
  const timestamp = normalizeDate(getRecordText(value, 'createdAt'), nowIso())
  const status = normalizeDeviceStatus(getRecordText(value, 'status'))
  const deviceId = getRecordText(value, 'deviceId') || getRecordText(value, 'id') || createId('mobile_device')

  return {
    id: getRecordText(value, 'id') || `mobile_device_${deviceId}`,
    deviceId,
    platform: normalizePlatform(getRecordText(value, 'platform')),
    version: getRecordText(value, 'version') || '1.0.0',
    appVersion: getRecordText(value, 'appVersion'),
    pushToken: getRecordText(value, 'pushToken'),
    userAgent: getRecordText(value, 'userAgent'),
    userId: getRecordText(value, 'userId'),
    userName: getRecordText(value, 'userName') || DEFAULT_USER_NAME,
    authorized: getRecordBoolean(value, 'authorized', status !== 'REVOKED'),
    status,
    lastSync: normalizeDate(getRecordText(value, 'lastSync'), ''),
    createdAt: timestamp,
    updatedAt: normalizeDate(getRecordText(value, 'updatedAt'), timestamp)
  }
}

const normalizeConflict = (value: unknown): MobileConflict => ({
  id: getRecordText(value, 'id') || createId('mobile_conflict'),
  queueItemId: getRecordText(value, 'queueItemId'),
  moduleKey: normalizeModuleKey(getRecordText(value, 'moduleKey')),
  entityId: getRecordText(value, 'entityId'),
  deviceVersion: getRecordText(value, 'deviceVersion'),
  serverVersion: getRecordText(value, 'serverVersion'),
  reason: getRecordText(value, 'reason') || 'Kayit versiyonu cakisiyor.',
  resolved: getRecordBoolean(value, 'resolved', false),
  createdAt: normalizeDate(getRecordText(value, 'createdAt'), nowIso())
})

const normalizeQueueItem = (value: unknown): MobileOfflineQueueItem => {
  const timestamp = normalizeDate(getRecordText(value, 'createdAt'), nowIso())
  const moduleKey = normalizeModuleKey(getRecordText(value, 'moduleKey'))
  const entityId = getRecordText(value, 'entityId')
  return {
    id: getRecordText(value, 'id') || createId('mobile_queue'),
    idempotencyKey: getRecordText(value, 'idempotencyKey') || createId('mobile_idempotency'),
    deviceId: getRecordText(value, 'deviceId'),
    userId: getRecordText(value, 'userId'),
    moduleKey,
    entityType: getRecordText(value, 'entityType') || moduleKey,
    entityId,
    operation: normalizeQueueOperation(getRecordText(value, 'operation')),
    payload: isRecord(value) ? value.payload : null,
    baseVersion: getRecordText(value, 'baseVersion'),
    serverVersion: getRecordText(value, 'serverVersion'),
    retryCount: getRecordNumber(value, 'retryCount', 0),
    maxRetries: Math.max(1, getRecordNumber(value, 'maxRetries', DEFAULT_QUEUE_MAX_RETRIES)),
    status: normalizeQueueStatus(getRecordText(value, 'status')),
    conflict: isRecord(value) && value.conflict ? normalizeConflict(value.conflict) : null,
    error: getRecordText(value, 'error'),
    createdAt: timestamp,
    updatedAt: normalizeDate(getRecordText(value, 'updatedAt'), timestamp),
    lastTriedAt: normalizeDate(getRecordText(value, 'lastTriedAt'), '')
  }
}

const normalizeTokenSession = (value: unknown): MobileTokenSession | null => {
  if(!isRecord(value)) return null
  const accessPayload = value.accessPayload
  const refreshPayload = value.refreshPayload
  if(!isRecord(accessPayload) || !isRecord(refreshPayload)) return null

  const timestamp = normalizeDate(getRecordText(value, 'createdAt'), nowIso())
  return {
    id: getRecordText(value, 'id') || createId('mobile_token'),
    userId: getRecordText(value, 'userId'),
    userName: getRecordText(value, 'userName') || DEFAULT_USER_NAME,
    deviceId: getRecordText(value, 'deviceId'),
    accessToken: getRecordText(value, 'accessToken'),
    refreshToken: getRecordText(value, 'refreshToken'),
    accessPayload: accessPayload as MobileTokenSession['accessPayload'],
    refreshPayload: refreshPayload as MobileTokenSession['refreshPayload'],
    accessExpiresAt: normalizeDate(getRecordText(value, 'accessExpiresAt'), timestamp),
    refreshExpiresAt: normalizeDate(getRecordText(value, 'refreshExpiresAt'), timestamp),
    revoked: getRecordBoolean(value, 'revoked', false),
    createdAt: timestamp,
    updatedAt: normalizeDate(getRecordText(value, 'updatedAt'), timestamp)
  }
}

const normalizeSyncJob = (value: unknown): MobileSyncJob => {
  const validationSource = isRecord(value) ? value.validation : null
  const validation = isRecord(validationSource)
    ? createValidationResult(
      Array.isArray(validationSource.codes) ? validationSource.codes.filter((code): code is MobileValidationCode => typeof code === 'string') : [],
      Array.isArray(validationSource.errors) ? validationSource.errors.filter((error): error is string => typeof error === 'string') : []
    )
    : successValidation()
  const timestamp = normalizeDate(getRecordText(value, 'startedAt'), nowIso())

  return {
    id: getRecordText(value, 'id') || createId('mobile_sync'),
    deviceId: getRecordText(value, 'deviceId'),
    userId: getRecordText(value, 'userId'),
    mode: normalizeSyncMode(getRecordText(value, 'mode')),
    modules: isRecord(value) && Array.isArray(value.modules)
      ? value.modules.filter(isSupportedModule)
      : [],
    status: normalizeSyncStatus(getRecordText(value, 'status')),
    recordCount: getRecordNumber(value, 'recordCount', 0),
    processedQueueCount: getRecordNumber(value, 'processedQueueCount', 0),
    conflictCount: getRecordNumber(value, 'conflictCount', 0),
    validation,
    startedAt: timestamp,
    completedAt: normalizeDate(getRecordText(value, 'completedAt'), timestamp)
  }
}

const normalizeLog = (value: unknown): MobileOperationLog => ({
  id: getRecordText(value, 'id') || createId('mobile_log'),
  userId: getRecordText(value, 'userId'),
  userName: getRecordText(value, 'userName') || DEFAULT_USER_NAME,
  deviceId: getRecordText(value, 'deviceId'),
  operation: normalizeText(getRecordText(value, 'operation')).toUpperCase() as MobileOperationType || 'VALIDATION',
  moduleKey: isSupportedModule(getRecordText(value, 'moduleKey')) ? getRecordText(value, 'moduleKey') as MobileModuleKey : 'mobile',
  status: normalizeText(getRecordText(value, 'status')).toUpperCase() === 'FAILED' ? 'FAILED' : 'SUCCESS',
  message: getRecordText(value, 'message'),
  createdAt: normalizeDate(getRecordText(value, 'createdAt'), nowIso())
})

const loadDevices = () => readJson<unknown[]>(MOBILE_DEVICE_STORAGE_KEY, []).map(normalizeDevice)
const saveDevices = (records: MobileDeviceRecord[]) => writeJson(MOBILE_DEVICE_STORAGE_KEY, records.map(normalizeDevice))

const loadTokenSessions = () => readJson<unknown[]>(MOBILE_TOKEN_STORAGE_KEY, [])
  .map(normalizeTokenSession)
  .filter((session): session is MobileTokenSession => Boolean(session))
const saveTokenSessions = (records: MobileTokenSession[]) => writeJson(MOBILE_TOKEN_STORAGE_KEY, records.map(record => record))

const loadOfflineQueue = () => readJson<unknown[]>(MOBILE_OFFLINE_QUEUE_STORAGE_KEY, []).map(normalizeQueueItem)
const saveOfflineQueue = (records: MobileOfflineQueueItem[]) => writeJson(MOBILE_OFFLINE_QUEUE_STORAGE_KEY, records.map(normalizeQueueItem))

const loadSyncJobs = () => readJson<unknown[]>(MOBILE_SYNC_JOB_STORAGE_KEY, []).map(normalizeSyncJob)
const saveSyncJobs = (records: MobileSyncJob[]) => writeJson(MOBILE_SYNC_JOB_STORAGE_KEY, records.map(normalizeSyncJob))

const loadConflicts = () => readJson<unknown[]>(MOBILE_CONFLICT_STORAGE_KEY, []).map(normalizeConflict)
const saveConflicts = (records: MobileConflict[]) => writeJson(MOBILE_CONFLICT_STORAGE_KEY, records.map(normalizeConflict))

const loadLogs = () => readJson<unknown[]>(MOBILE_LOG_STORAGE_KEY, []).map(normalizeLog)
const saveLogs = (records: MobileOperationLog[]) => writeJson(MOBILE_LOG_STORAGE_KEY, records.map(normalizeLog))

const logOperation = (input: Omit<MobileOperationLog, 'id' | 'createdAt'>) => {
  const log: MobileOperationLog = {
    id: createId('mobile_log'),
    createdAt: nowIso(),
    ...input
  }
  saveLogs([log, ...loadLogs()].slice(0, 500))
  return log
}

const findUserByCredentials = (username: string, password: string) => (
  loadUsers({ allTenants: true }).find(user => (
    user.username === username
    && user.password === password
    && user.active
  )) || null
)

const getUserName = (user: Pick<User, 'fullName' | 'username'> | null) => (
  user ? user.fullName || user.username : DEFAULT_USER_NAME
)

const getDevice = (deviceId: string) => (
  loadDevices().find(device => device.deviceId === deviceId) || null
)

const validateDevice = (deviceId: string): MobileValidationResult => {
  const device = getDevice(deviceId)
  if(!device) return failedValidation('MISSING_DEVICE', 'Cihaz kaydi bulunamadi.')
  if(!device.authorized || device.status !== 'AUTHORIZED') return failedValidation('UNAUTHORIZED_DEVICE', 'Yetkisiz cihaz.')
  return successValidation()
}

const createTokenSession = (
  user: User,
  device: MobileDeviceRecord
): { session: MobileTokenSession; pair: MobileTokenPair } => {
  const state = createAuthenticationState(user)
  const identity = state.pipeline.identity
  const issuedAtSeconds = Math.floor(Date.now() / 1000)
  const accessPayload = createJwtPayload(identity, issuedAtSeconds, ACCESS_TOKEN_TTL_SECONDS)
  const refreshPayload = createJwtPayload(identity, issuedAtSeconds, REFRESH_TOKEN_TTL_SECONDS)

  if(!accessPayload || !refreshPayload) throw new Error('Mobil JWT payload olusturulamadi.')

  const accessToken = createUnsignedMobileJwt({
    ...accessPayload,
    tokenUse: 'access',
    deviceId: device.deviceId
  })
  const refreshToken = createUnsignedMobileJwt({
    ...refreshPayload,
    tokenUse: 'refresh',
    deviceId: device.deviceId,
    nonce: createId('refresh')
  })
  const timestamp = nowIso()
  const pair: MobileTokenPair = {
    tokenType: 'Bearer',
    accessToken,
    refreshToken,
    accessExpiresAt: secondsToIso(accessPayload.exp),
    refreshExpiresAt: secondsToIso(refreshPayload.exp)
  }
  const session: MobileTokenSession = {
    id: createId('mobile_token'),
    userId: user.id,
    userName: getUserName(user),
    deviceId: device.deviceId,
    accessToken,
    refreshToken,
    accessPayload,
    refreshPayload,
    accessExpiresAt: pair.accessExpiresAt,
    refreshExpiresAt: pair.refreshExpiresAt,
    revoked: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }

  return { session, pair }
}

const validateTokenSession = (
  token: string,
  kind: 'access' | 'refresh',
  deviceId = ''
) => {
  if(!normalizeText(token)){
    return {
      session: null,
      validation: failedValidation('MISSING_TOKEN', 'Token zorunludur.')
    }
  }

  const sessions = loadTokenSessions()
  const session = sessions.find(item => (
    kind === 'access'
      ? item.accessToken === token
      : item.refreshToken === token
  )) || null

  if(!session || session.revoked){
    return {
      session: null,
      validation: failedValidation('TOKEN_INVALID', 'Gecersiz mobil token.')
    }
  }

  const payload = kind === 'access' ? session.accessPayload : session.refreshPayload
  const jwtValidation = validateJwtPayloadShape(payload)
  const tokenValidation = jwtValidation.valid
    ? successValidation()
    : failedValidation(jwtValidation.expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID', jwtValidation.expired ? 'Suresi dolmus token.' : 'Gecersiz token.')
  const deviceValidation = deviceId || session.deviceId
    ? validateDevice(deviceId || session.deviceId)
    : successValidation()
  const mismatchValidation = deviceId && session.deviceId !== deviceId
    ? failedValidation('UNAUTHORIZED_DEVICE', 'Token farkli bir cihaza aittir.')
    : successValidation()

  return {
    session,
    validation: mergeValidation(tokenValidation, deviceValidation, mismatchValidation)
  }
}

const registerDevice = (
  input: MobileDeviceRegistrationInput,
  user: Pick<User, 'id' | 'fullName' | 'username'> | null = null,
  authorized = true
): MobileDeviceRecord => {
  const devices = loadDevices()
  const current = devices.find(device => device.deviceId === normalizeText(input.deviceId))
  const timestamp = nowIso()
  const nextDevice: MobileDeviceRecord = {
    id: current?.id || `mobile_device_${normalizeText(input.deviceId) || createId('device')}`,
    deviceId: normalizeText(input.deviceId) || createId('device'),
    platform: normalizePlatform(input.platform),
    version: normalizeText(input.version) || '1.0.0',
    appVersion: normalizeText(input.appVersion),
    pushToken: normalizeText(input.pushToken || current?.pushToken),
    userAgent: normalizeText(input.userAgent || current?.userAgent),
    userId: user?.id || current?.userId || '',
    userName: user ? getUserName(user) : current?.userName || DEFAULT_USER_NAME,
    authorized,
    status: authorized ? 'AUTHORIZED' : 'PENDING',
    lastSync: current?.lastSync || '',
    createdAt: current?.createdAt || timestamp,
    updatedAt: timestamp
  }
  const nextDevices = current
    ? devices.map(device => device.deviceId === nextDevice.deviceId ? nextDevice : device)
    : [nextDevice, ...devices]
  saveDevices(nextDevices)
  logOperation({
    userId: nextDevice.userId,
    userName: nextDevice.userName,
    deviceId: nextDevice.deviceId,
    operation: 'DEVICE_REGISTRATION',
    moduleKey: 'mobile',
    status: 'SUCCESS',
    message: `${nextDevice.platform} cihaz kaydi guncellendi.`
  })
  return nextDevice
}

const setDeviceLastSync = (deviceId: string, timestamp: string) => {
  const devices = loadDevices()
  saveDevices(devices.map(device => (
    device.deviceId === deviceId
      ? { ...device, lastSync: timestamp, updatedAt: nowIso() }
      : device
  )))
}

const getRecordVersion = (record: unknown) => (
  getRecordText(record, 'updatedAt')
  || getRecordText(record, 'createdAt')
  || getRecordText(record, 'date')
  || getRecordText(record, 'version')
  || getRecordText(record, 'id')
)

const filterIncrementalRecords = (records: unknown[], since: string) => {
  if(!since) return records
  const sinceTime = Date.parse(since)
  if(Number.isNaN(sinceTime)) return records
  return records.filter(record => {
    const version = getRecordVersion(record)
    const versionTime = Date.parse(version)
    return Number.isNaN(versionTime) || versionTime >= sinceTime
  })
}

const createModuleRecords = (moduleKey: MobileModuleKey) => {
  const sourceData = loadKpiSourceData()

  if(moduleKey === 'production-orders') return sourceData.productionOrders
  if(moduleKey === 'lots') return sourceData.inventoryLots
  if(moduleKey === 'shipments') return sourceData.shipments
  if(moduleKey === 'samples') return sourceData.qualitySamples
  if(moduleKey === 'waste') return WasteService.list(sourceData)
  if(moduleKey === 'purchase') return sourceData.purchaseRequests
  return loadSystemAnnouncements({ companies: [], packages: [] })
}

const createModuleSnapshot = (
  moduleKey: MobileModuleKey,
  mode: MobileSyncMode,
  since: string,
  cursor: string
): MobileSyncModuleSnapshot => {
  const records = createModuleRecords(moduleKey)
  const scopedRecords = mode === 'INCREMENTAL' ? filterIncrementalRecords(records, since) : records

  return {
    moduleKey,
    moduleLabel: MOBILE_MODULE_LABELS[moduleKey],
    records: scopedRecords,
    recordCount: scopedRecords.length,
    cursor
  }
}

const findServerRecord = (moduleKey: MobileModuleKey, entityId: string) => (
  createModuleRecords(moduleKey).find(record => getRecordText(record, 'id') === entityId) || null
)

const detectConflict = (item: MobileOfflineQueueItem): MobileConflict | null => {
  if(!item.baseVersion) return null
  const serverRecord = findServerRecord(item.moduleKey, item.entityId)
  const serverVersion = getRecordVersion(serverRecord)
  if(!serverVersion || serverVersion === item.baseVersion) return null

  return {
    id: createId('mobile_conflict'),
    queueItemId: item.id,
    moduleKey: item.moduleKey,
    entityId: item.entityId,
    deviceVersion: item.baseVersion,
    serverVersion,
    reason: 'Sunucu kaydi mobil cihazdaki temel versiyondan sonra degisti.',
    resolved: false,
    createdAt: nowIso()
  }
}

const processQueueItems = (
  request: Pick<MobileSyncRequest, 'accessToken' | 'deviceId'> & { moduleKey?: MobileModuleKey }
) => {
  const tokenResult = validateTokenSession(request.accessToken, 'access', request.deviceId)
  if(!tokenResult.validation.valid){
    logOperation({
      userId: tokenResult.session?.userId || '',
      userName: tokenResult.session?.userName || DEFAULT_USER_NAME,
      deviceId: request.deviceId,
      operation: 'OFFLINE_QUEUE',
      moduleKey: request.moduleKey || 'mobile',
      status: 'FAILED',
      message: tokenResult.validation.errors.join(' ')
    })
    return { processed: [], conflicts: [], validation: tokenResult.validation }
  }

  const queue = loadOfflineQueue()
  const nextQueue: MobileOfflineQueueItem[] = []
  const processed: MobileOfflineQueueItem[] = []
  const conflicts: MobileConflict[] = []

  queue.forEach(item => {
    const matchesDevice = item.deviceId === request.deviceId
    const matchesModule = !request.moduleKey || item.moduleKey === request.moduleKey
    const eligible = matchesDevice && matchesModule && (item.status === 'PENDING' || item.status === 'FAILED')

    if(!eligible){
      nextQueue.push(item)
      return
    }

    const timestamp = nowIso()
    const retriedItem: MobileOfflineQueueItem = {
      ...item,
      status: 'SYNCING',
      retryCount: item.retryCount + 1,
      lastTriedAt: timestamp,
      updatedAt: timestamp
    }
    const conflict = detectConflict(retriedItem)

    if(conflict){
      const conflictItem: MobileOfflineQueueItem = {
        ...retriedItem,
        status: 'CONFLICT',
        conflict,
        serverVersion: conflict.serverVersion,
        error: conflict.reason,
        updatedAt: nowIso()
      }
      nextQueue.push(conflictItem)
      processed.push(conflictItem)
      conflicts.push(conflict)
      return
    }

    if(retriedItem.retryCount > retriedItem.maxRetries){
      const failedItem: MobileOfflineQueueItem = {
        ...retriedItem,
        status: 'FAILED',
        error: 'Maksimum retry sayisi asildi.',
        updatedAt: nowIso()
      }
      nextQueue.push(failedItem)
      processed.push(failedItem)
      return
    }

    const syncedItem: MobileOfflineQueueItem = {
      ...retriedItem,
      status: 'SYNCED',
      serverVersion: getRecordVersion(findServerRecord(retriedItem.moduleKey, retriedItem.entityId)) || retriedItem.baseVersion,
      error: '',
      updatedAt: nowIso()
    }
    nextQueue.push(syncedItem)
    processed.push(syncedItem)
  })

  saveOfflineQueue(nextQueue)
  if(conflicts.length > 0) saveConflicts([...conflicts, ...loadConflicts()])

  const validation = conflicts.length > 0
    ? failedValidation('CONFLICTING_RECORD', 'Cakisan kayit bulundu.')
    : successValidation()

  logOperation({
    userId: tokenResult.session?.userId || '',
    userName: tokenResult.session?.userName || DEFAULT_USER_NAME,
    deviceId: request.deviceId,
    operation: 'OFFLINE_QUEUE',
    moduleKey: request.moduleKey || 'mobile',
    status: validation.valid ? 'SUCCESS' : 'FAILED',
    message: `${processed.length} offline queue kaydi islendi.`
  })

  return {
    processed,
    conflicts,
    validation
  }
}

const createSyncJob = (
  request: MobileSyncRequest,
  status: MobileSyncStatus,
  modules: MobileModuleKey[],
  recordCount: number,
  processedQueueCount: number,
  conflictCount: number,
  validation: MobileValidationResult,
  userId: string
) => {
  const timestamp = nowIso()
  const job: MobileSyncJob = {
    id: createId('mobile_sync'),
    deviceId: request.deviceId,
    userId,
    mode: request.mode,
    modules,
    status,
    recordCount,
    processedQueueCount,
    conflictCount,
    validation,
    startedAt: timestamp,
    completedAt: timestamp
  }
  saveSyncJobs([job, ...loadSyncJobs()].slice(0, 250))
  return job
}

const emptySyncResult = (
  mode: MobileSyncMode,
  validation: MobileValidationResult
): MobileSyncResult => ({
  status: 'FAILED',
  mode,
  cursor: nowIso(),
  modules: [],
  processedQueue: [],
  conflicts: [],
  validation
})

export const MobileIntegrationService = {
  defaultUserName: DEFAULT_USER_NAME,
  moduleLabels: MOBILE_MODULE_LABELS,
  supportedModules: SUPPORTED_MODULES,

  authenticate: (credentials: MobileAuthCredentials): MobileAuthResult => {
    const user = findUserByCredentials(credentials.username, credentials.password)
    if(!user){
      const validation = failedValidation('TOKEN_INVALID', 'Mobil kullanici dogrulanamadi.')
      logOperation({
        userId: '',
        userName: credentials.username,
        deviceId: credentials.device.deviceId,
        operation: 'AUTHENTICATION',
        moduleKey: 'mobile',
        status: 'FAILED',
        message: validation.errors.join(' ')
      })
      return { success: false, userId: '', userName: credentials.username, device: null, tokens: null, validation }
    }

    const device = registerDevice(credentials.device, user, true)
    const tokenSession = createTokenSession(user, device)
    saveTokenSessions([tokenSession.session, ...loadTokenSessions().filter(session => !(
      session.userId === user.id && session.deviceId === device.deviceId && !session.revoked
    ))])

    logOperation({
      userId: user.id,
      userName: getUserName(user),
      deviceId: device.deviceId,
      operation: 'AUTHENTICATION',
      moduleKey: 'mobile',
      status: 'SUCCESS',
      message: 'Mobil oturum acildi.'
    })

    return {
      success: true,
      userId: user.id,
      userName: getUserName(user),
      device,
      tokens: tokenSession.pair,
      validation: successValidation()
    }
  },

  refreshToken: (refreshToken: string, deviceId: string): MobileAuthResult => {
    const tokenResult = validateTokenSession(refreshToken, 'refresh', deviceId)
    if(!tokenResult.session || !tokenResult.validation.valid){
      logOperation({
        userId: tokenResult.session?.userId || '',
        userName: tokenResult.session?.userName || DEFAULT_USER_NAME,
        deviceId,
        operation: 'TOKEN_MANAGEMENT',
        moduleKey: 'mobile',
        status: 'FAILED',
        message: tokenResult.validation.errors.join(' ')
      })
      return { success: false, userId: '', userName: DEFAULT_USER_NAME, device: null, tokens: null, validation: tokenResult.validation }
    }

    const user = loadUsers({ allTenants: true }).find(item => item.id === tokenResult.session?.userId) || null
    const device = getDevice(deviceId)
    if(!user || !device){
      const validation = failedValidation('TOKEN_INVALID', 'Refresh token kullanicisi veya cihazi bulunamadi.')
      return { success: false, userId: '', userName: DEFAULT_USER_NAME, device: null, tokens: null, validation }
    }

    const nextTokenSession = createTokenSession(user, device)
    saveTokenSessions([
      nextTokenSession.session,
      ...loadTokenSessions().map(session => (
        session.id === tokenResult.session?.id
          ? { ...session, revoked: true, updatedAt: nowIso() }
          : session
      ))
    ])
    logOperation({
      userId: user.id,
      userName: getUserName(user),
      deviceId,
      operation: 'TOKEN_MANAGEMENT',
      moduleKey: 'mobile',
      status: 'SUCCESS',
      message: 'Mobil refresh token yenilendi.'
    })
    return {
      success: true,
      userId: user.id,
      userName: getUserName(user),
      device,
      tokens: nextTokenSession.pair,
      validation: successValidation()
    }
  },

  revokeToken: (token: string, userName = DEFAULT_USER_NAME) => {
    const sessions = loadTokenSessions()
    const target = sessions.find(session => session.accessToken === token || session.refreshToken === token) || null
    if(!target) return false

    saveTokenSessions(sessions.map(session => (
      session.id === target.id ? { ...session, revoked: true, updatedAt: nowIso() } : session
    )))
    logOperation({
      userId: target.userId,
      userName,
      deviceId: target.deviceId,
      operation: 'TOKEN_MANAGEMENT',
      moduleKey: 'mobile',
      status: 'SUCCESS',
      message: 'Mobil token iptal edildi.'
    })
    return true
  },

  validateToken: (accessToken: string, deviceId = '') => {
    const tokenResult = validateTokenSession(accessToken, 'access', deviceId)
    logOperation({
      userId: tokenResult.session?.userId || '',
      userName: tokenResult.session?.userName || DEFAULT_USER_NAME,
      deviceId: deviceId || tokenResult.session?.deviceId || '',
      operation: 'VALIDATION',
      moduleKey: 'mobile',
      status: tokenResult.validation.valid ? 'SUCCESS' : 'FAILED',
      message: tokenResult.validation.valid ? 'Mobil token dogrulandi.' : tokenResult.validation.errors.join(' ')
    })
    return tokenResult.validation
  },

  authorize: (request: MobileAuthorizationRequest): MobileAuthorizationResult => {
    const tokenResult = validateTokenSession(request.accessToken, 'access', request.deviceId)
    const moduleValidation = isSupportedModule(request.moduleKey)
      ? successValidation()
      : failedValidation('UNSUPPORTED_MODULE', 'Desteklenmeyen mobil modul.')
    const moduleKey = normalizeModuleKey(request.moduleKey)
    const requiredPermission = MOBILE_MODULE_PERMISSIONS[moduleKey][request.action]
    const session = tokenResult.session
    const allowed = Boolean(
      session
      && tokenResult.validation.valid
      && moduleValidation.valid
      && hasPermission({ permissions: session.accessPayload.permissions as PermissionName[] }, requiredPermission)
    )
    const permissionValidation = allowed
      ? successValidation()
      : failedValidation('PERMISSION_DENIED', 'Mobil modul icin yetki yok.')
    const validation = mergeValidation(tokenResult.validation, moduleValidation, permissionValidation)

    logOperation({
      userId: session?.userId || '',
      userName: session?.userName || DEFAULT_USER_NAME,
      deviceId: request.deviceId,
      operation: 'AUTHORIZATION',
      moduleKey,
      status: allowed ? 'SUCCESS' : 'FAILED',
      message: allowed ? `${moduleKey} ${request.action} yetkisi verildi.` : validation.errors.join(' ')
    })

    return {
      allowed,
      moduleKey,
      action: request.action,
      requiredPermission,
      userId: session?.userId || '',
      validation
    }
  },

  registerDevice,

  setDeviceAuthorization: (deviceId: string, status: MobileDeviceStatus, userName = DEFAULT_USER_NAME) => {
    const devices = loadDevices()
    const nextDevices = devices.map(device => (
      device.deviceId === deviceId
        ? { ...device, status, authorized: status === 'AUTHORIZED', updatedAt: nowIso() }
        : device
    ))
    saveDevices(nextDevices)
    logOperation({
      userId: '',
      userName,
      deviceId,
      operation: 'DEVICE_REGISTRATION',
      moduleKey: 'mobile',
      status: 'SUCCESS',
      message: `Cihaz durumu ${status} olarak guncellendi.`
    })
    return nextDevices.find(device => device.deviceId === deviceId) || null
  },

  registerPushToken: (deviceId: string, pushToken: string, userName = DEFAULT_USER_NAME) => {
    const devices = loadDevices()
    const target = devices.find(device => device.deviceId === deviceId) || null
    if(!target){
      logOperation({
        userId: '',
        userName,
        deviceId,
        operation: 'PUSH_REGISTRATION',
        moduleKey: 'notifications',
        status: 'FAILED',
        message: 'Push token icin cihaz bulunamadi.'
      })
      return null
    }

    const nextDevice = { ...target, pushToken: normalizeText(pushToken), updatedAt: nowIso() }
    saveDevices(devices.map(device => device.deviceId === deviceId ? nextDevice : device))
    logOperation({
      userId: nextDevice.userId,
      userName,
      deviceId,
      operation: 'PUSH_REGISTRATION',
      moduleKey: 'notifications',
      status: 'SUCCESS',
      message: 'Push token kaydedildi.'
    })
    return nextDevice
  },

  enqueueOfflineAction: (input: MobileOfflineQueueInput): MobileOfflineQueueItem => {
    const tokenValidation = input.accessToken ? validateTokenSession(input.accessToken, 'access', input.deviceId).validation : validateDevice(input.deviceId)
    const moduleValidation = isSupportedModule(input.moduleKey)
      ? successValidation()
      : failedValidation('UNSUPPORTED_MODULE', 'Desteklenmeyen mobil modul.')
    const validation = mergeValidation(tokenValidation, moduleValidation)
    const tokenSession = input.accessToken ? validateTokenSession(input.accessToken, 'access', input.deviceId).session : null
    const timestamp = nowIso()
    const existingQueue = loadOfflineQueue()
    const duplicate = input.idempotencyKey
      ? existingQueue.find(item => item.idempotencyKey === input.idempotencyKey) || null
      : null

    if(duplicate) return duplicate

    const item: MobileOfflineQueueItem = {
      id: createId('mobile_queue'),
      idempotencyKey: normalizeText(input.idempotencyKey) || createId('mobile_idempotency'),
      deviceId: normalizeText(input.deviceId),
      userId: tokenSession?.userId || getDevice(input.deviceId)?.userId || '',
      moduleKey: normalizeModuleKey(input.moduleKey),
      entityType: normalizeText(input.entityType),
      entityId: normalizeText(input.entityId),
      operation: input.operation,
      payload: input.payload,
      baseVersion: normalizeText(input.baseVersion),
      serverVersion: '',
      retryCount: 0,
      maxRetries: Math.max(1, Number(input.maxRetries) || DEFAULT_QUEUE_MAX_RETRIES),
      status: validation.valid ? 'PENDING' : 'FAILED',
      conflict: null,
      error: validation.errors.join(' '),
      createdAt: timestamp,
      updatedAt: timestamp,
      lastTriedAt: ''
    }

    saveOfflineQueue([item, ...existingQueue])
    logOperation({
      userId: item.userId,
      userName: tokenSession?.userName || getDevice(input.deviceId)?.userName || DEFAULT_USER_NAME,
      deviceId: item.deviceId,
      operation: 'OFFLINE_QUEUE',
      moduleKey: item.moduleKey,
      status: validation.valid ? 'SUCCESS' : 'FAILED',
      message: validation.valid ? `${item.operation} offline queue kaydi eklendi.` : validation.errors.join(' ')
    })
    return item
  },

  processOfflineQueue: processQueueItems,

  retryFailed: (accessToken: string, deviceId: string, moduleKey?: MobileModuleKey) => {
    const queue = loadOfflineQueue()
    saveOfflineQueue(queue.map(item => (
      item.deviceId === deviceId
      && (!moduleKey || item.moduleKey === moduleKey)
      && item.status === 'FAILED'
        ? { ...item, status: 'PENDING', error: '', updatedAt: nowIso() }
        : item
    )))
    return processQueueItems({ accessToken, deviceId, moduleKey })
  },

  detectConflict,

  sync: (request: MobileSyncRequest): MobileSyncResult => {
    const modeValidation = SUPPORTED_SYNC_MODES.includes(request.mode)
      ? successValidation()
      : failedValidation('INVALID_SYNC', 'Gecersiz senkronizasyon modu.')
    const tokenResult = validateTokenSession(request.accessToken, 'access', request.deviceId)
    const modules = (request.modules && request.modules.length > 0 ? request.modules : SUPPORTED_MODULES)
      .filter((moduleKey): moduleKey is MobileModuleKey => isSupportedModule(moduleKey))
    const moduleValidation = modules.length > 0
      ? successValidation()
      : failedValidation('UNSUPPORTED_MODULE', 'Senkronize edilecek destekli modul bulunamadi.')
    const baseValidation = mergeValidation(modeValidation, tokenResult.validation, moduleValidation)

    if(!baseValidation.valid){
      createSyncJob(request, 'FAILED', modules, 0, 0, 0, baseValidation, tokenResult.session?.userId || '')
      logOperation({
        userId: tokenResult.session?.userId || '',
        userName: tokenResult.session?.userName || DEFAULT_USER_NAME,
        deviceId: request.deviceId,
        operation: 'SYNC_QUEUE',
        moduleKey: 'mobile',
        status: 'FAILED',
        message: baseValidation.errors.join(' ')
      })
      return emptySyncResult(request.mode, baseValidation)
    }

    const cursor = nowIso()
    const since = request.since || getDevice(request.deviceId)?.lastSync || ''
    const queueResult = request.mode === 'RETRY_FAILED' || request.includeQueue
      ? processQueueItems({ accessToken: request.accessToken, deviceId: request.deviceId })
      : { processed: [] as MobileOfflineQueueItem[], conflicts: [] as MobileConflict[], validation: successValidation() }
    const snapshots = request.mode === 'RETRY_FAILED'
      ? []
      : modules.map(moduleKey => createModuleSnapshot(moduleKey, request.mode, since, cursor))
    const validation = mergeValidation(baseValidation, queueResult.validation)
    const status: MobileSyncStatus = queueResult.conflicts.length > 0
      ? 'CONFLICT'
      : validation.valid
        ? 'SUCCESS'
        : 'FAILED'
    const recordCount = snapshots.reduce((sum, snapshot) => sum + snapshot.recordCount, 0)

    if(status === 'SUCCESS') setDeviceLastSync(request.deviceId, cursor)
    createSyncJob(request, status, modules, recordCount, queueResult.processed.length, queueResult.conflicts.length, validation, tokenResult.session?.userId || '')
    logOperation({
      userId: tokenResult.session?.userId || '',
      userName: tokenResult.session?.userName || DEFAULT_USER_NAME,
      deviceId: request.deviceId,
      operation: 'SYNC_QUEUE',
      moduleKey: 'mobile',
      status: status === 'FAILED' ? 'FAILED' : 'SUCCESS',
      message: `${request.mode} mobil senkronizasyon tamamlandi.`
    })

    return {
      status,
      mode: request.mode,
      cursor,
      modules: snapshots,
      processedQueue: queueResult.processed,
      conflicts: queueResult.conflicts,
      validation
    }
  },

  getSyncStatus: (deviceId: string): MobileSyncStatusSummary => {
    const queue = loadOfflineQueue().filter(item => item.deviceId === deviceId)
    const device = getDevice(deviceId)
    const pending = queue.filter(item => item.status === 'PENDING' || item.status === 'SYNCING').length
    const failed = queue.filter(item => item.status === 'FAILED').length
    const conflicts = queue.filter(item => item.status === 'CONFLICT').length
    const synced = queue.filter(item => item.status === 'SYNCED').length
    const status: MobileSyncStatus = conflicts > 0 ? 'CONFLICT' : failed > 0 ? 'FAILED' : pending > 0 ? 'SYNCING' : 'SUCCESS'

    return {
      deviceId,
      lastSync: device?.lastSync || '',
      pending,
      failed,
      conflicts,
      synced,
      status
    }
  },

  devices: {
    list: loadDevices,
    save: saveDevices
  },
  tokens: {
    list: loadTokenSessions,
    save: saveTokenSessions
  },
  offlineQueue: {
    list: loadOfflineQueue,
    save: saveOfflineQueue
  },
  syncJobs: {
    list: loadSyncJobs,
    save: saveSyncJobs
  },
  conflicts: {
    list: loadConflicts,
    save: saveConflicts
  },
  logs: {
    list: loadLogs,
    save: saveLogs,
    add: logOperation
  }
}
