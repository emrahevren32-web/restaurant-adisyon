import type { JwtPayload } from '../auth/jwt.types'
import type { PermissionName } from '../authorization/permission.types'

export type MobileModuleKey =
  | 'production-orders'
  | 'lots'
  | 'shipments'
  | 'samples'
  | 'waste'
  | 'purchase'
  | 'notifications'

export type MobilePlatform = 'ANDROID' | 'IOS' | 'WEB' | 'PWA' | 'UNKNOWN'

export type MobileDeviceStatus = 'PENDING' | 'AUTHORIZED' | 'REVOKED'

export type MobileTokenKind = 'ACCESS' | 'REFRESH'

export type MobileSyncMode = 'FULL' | 'INCREMENTAL' | 'RETRY_FAILED'

export type MobileQueueOperation = 'CREATE' | 'UPDATE' | 'DELETE' | 'ACK' | 'CUSTOM'

export type MobileQueueStatus = 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED' | 'CONFLICT'

export type MobileSyncStatus = 'IDLE' | 'SYNCING' | 'SUCCESS' | 'FAILED' | 'CONFLICT'

export type MobileAuthorizationAction = 'READ' | 'WRITE'

export type MobileValidationCode =
  | 'UNAUTHORIZED_DEVICE'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'CONFLICTING_RECORD'
  | 'INVALID_SYNC'
  | 'UNSUPPORTED_MODULE'
  | 'PERMISSION_DENIED'
  | 'MISSING_DEVICE'
  | 'MISSING_TOKEN'

export type MobileOperationType =
  | 'AUTHENTICATION'
  | 'AUTHORIZATION'
  | 'TOKEN_MANAGEMENT'
  | 'OFFLINE_QUEUE'
  | 'SYNC_QUEUE'
  | 'PUSH_REGISTRATION'
  | 'DEVICE_REGISTRATION'
  | 'VALIDATION'

export type MobileValidationResult = {
  valid: boolean
  codes: MobileValidationCode[]
  errors: string[]
}

export type MobileDeviceRegistrationInput = {
  deviceId: string
  platform: MobilePlatform | string
  version: string
  appVersion?: string
  pushToken?: string
  userAgent?: string
}

export type MobileDeviceRecord = {
  id: string
  deviceId: string
  platform: MobilePlatform
  version: string
  appVersion: string
  pushToken: string
  userAgent: string
  userId: string
  userName: string
  authorized: boolean
  status: MobileDeviceStatus
  lastSync: string
  createdAt: string
  updatedAt: string
}

export type MobileAuthCredentials = {
  username: string
  password: string
  device: MobileDeviceRegistrationInput
}

export type MobileTokenPair = {
  tokenType: 'Bearer'
  accessToken: string
  refreshToken: string
  accessExpiresAt: string
  refreshExpiresAt: string
}

export type MobileTokenSession = {
  id: string
  userId: string
  userName: string
  deviceId: string
  accessToken: string
  refreshToken: string
  accessPayload: JwtPayload
  refreshPayload: JwtPayload
  accessExpiresAt: string
  refreshExpiresAt: string
  revoked: boolean
  createdAt: string
  updatedAt: string
}

export type MobileAuthResult = {
  success: boolean
  userId: string
  userName: string
  device: MobileDeviceRecord | null
  tokens: MobileTokenPair | null
  validation: MobileValidationResult
}

export type MobileAuthorizationRequest = {
  accessToken: string
  deviceId: string
  moduleKey: MobileModuleKey
  action: MobileAuthorizationAction
}

export type MobileAuthorizationResult = {
  allowed: boolean
  moduleKey: MobileModuleKey
  action: MobileAuthorizationAction
  requiredPermission: PermissionName
  userId: string
  validation: MobileValidationResult
}

export type MobileOfflineQueueInput = {
  accessToken?: string
  deviceId: string
  moduleKey: MobileModuleKey | string
  entityType: string
  entityId: string
  operation: MobileQueueOperation
  payload: unknown
  baseVersion?: string
  idempotencyKey?: string
  maxRetries?: number
}

export type MobileConflict = {
  id: string
  queueItemId: string
  moduleKey: MobileModuleKey
  entityId: string
  deviceVersion: string
  serverVersion: string
  reason: string
  resolved: boolean
  createdAt: string
}

export type MobileOfflineQueueItem = {
  id: string
  idempotencyKey: string
  deviceId: string
  userId: string
  moduleKey: MobileModuleKey
  entityType: string
  entityId: string
  operation: MobileQueueOperation
  payload: unknown
  baseVersion: string
  serverVersion: string
  retryCount: number
  maxRetries: number
  status: MobileQueueStatus
  conflict: MobileConflict | null
  error: string
  createdAt: string
  updatedAt: string
  lastTriedAt: string
}

export type MobileSyncRequest = {
  accessToken: string
  deviceId: string
  mode: MobileSyncMode
  modules?: MobileModuleKey[]
  since?: string
  includeQueue?: boolean
}

export type MobileSyncModuleSnapshot = {
  moduleKey: MobileModuleKey
  moduleLabel: string
  records: unknown[]
  recordCount: number
  cursor: string
}

export type MobileSyncJob = {
  id: string
  deviceId: string
  userId: string
  mode: MobileSyncMode
  modules: MobileModuleKey[]
  status: MobileSyncStatus
  recordCount: number
  processedQueueCount: number
  conflictCount: number
  validation: MobileValidationResult
  startedAt: string
  completedAt: string
}

export type MobileSyncResult = {
  status: MobileSyncStatus
  mode: MobileSyncMode
  cursor: string
  modules: MobileSyncModuleSnapshot[]
  processedQueue: MobileOfflineQueueItem[]
  conflicts: MobileConflict[]
  validation: MobileValidationResult
}

export type MobileSyncStatusSummary = {
  deviceId: string
  lastSync: string
  pending: number
  failed: number
  conflicts: number
  synced: number
  status: MobileSyncStatus
}

export type MobileOperationLog = {
  id: string
  userId: string
  userName: string
  deviceId: string
  operation: MobileOperationType
  moduleKey: MobileModuleKey | 'mobile'
  status: 'SUCCESS' | 'FAILED'
  message: string
  createdAt: string
}
