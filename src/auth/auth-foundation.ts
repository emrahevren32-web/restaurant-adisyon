export const AUTH_FOUNDATION_STATUS = 'PRODUCTION_FOUNDATION_READY'

export const LEGACY_AUTH_STORAGE_KEY = 'ra_auth'

export type AuthFlowBoundary =
  | 'legacy-local-storage'
  | 'authentication-service'
  | 'authentication-pipeline'
  | 'identity-router'
  | 'access-gateway'
  | 'jwt-session'

export type AuthFoundationDescriptor = {
  status: typeof AUTH_FOUNDATION_STATUS
  legacyStorageKey: typeof LEGACY_AUTH_STORAGE_KEY
  activeBoundary: AuthFlowBoundary
  nextBoundary: AuthFlowBoundary
}

/**
 * Documents the current auth boundary. The live system still uses the legacy
 * ra_auth payload, but access to it is centralized behind the auth service.
 */
export const AUTH_FOUNDATION: AuthFoundationDescriptor = {
  status: AUTH_FOUNDATION_STATUS,
  legacyStorageKey: LEGACY_AUTH_STORAGE_KEY,
  activeBoundary: 'authentication-service',
  nextBoundary: 'jwt-session'
}
