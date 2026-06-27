import { IdentityResult } from '../identity/identity.types'

export type SessionSource = 'local-storage' | 'jwt' | 'server-session'

export type SessionStatus = 'anonymous' | 'authenticated' | 'expired' | 'invalid'

export type SessionSnapshot = {
  status: SessionStatus
  source: SessionSource
  identity: IdentityResult
  issuedAt: string | null
  expiresAt: string | null
}

/**
 * Creates an in-memory snapshot of the resolved identity. The current app still
 * uses localStorage auth and does not create JWTs or expirations.
 */
export const createSessionSnapshot = (
  identity: IdentityResult,
  now = new Date().toISOString()
): SessionSnapshot => ({
  status: identity.authenticated ? 'authenticated' : 'anonymous',
  source: 'local-storage',
  identity,
  issuedAt: identity.authenticated ? now : null,
  expiresAt: null
})

export const createEmptySessionSnapshot = (identity: IdentityResult): SessionSnapshot => {
  return createSessionSnapshot(identity)
}
