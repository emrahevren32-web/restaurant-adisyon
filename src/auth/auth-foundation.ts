export const AUTH_FOUNDATION_STATUS = 'PREPARED_NOT_ACTIVE'

export const LEGACY_AUTH_STORAGE_KEY = 'ra_auth'

export type AuthFlowBoundary = 'legacy-local-storage' | 'identity-router' | 'access-gateway'

export type AuthFoundationDescriptor = {
  status: typeof AUTH_FOUNDATION_STATUS
  legacyStorageKey: typeof LEGACY_AUTH_STORAGE_KEY
  activeBoundary: AuthFlowBoundary
  nextBoundary: AuthFlowBoundary
}

/**
 * Documents the current auth boundary without activating a new flow.
 * The live system still uses storage.authenticateUser and ra_auth.
 */
export const AUTH_FOUNDATION: AuthFoundationDescriptor = {
  status: AUTH_FOUNDATION_STATUS,
  legacyStorageKey: LEGACY_AUTH_STORAGE_KEY,
  activeBoundary: 'legacy-local-storage',
  nextBoundary: 'identity-router'
}
