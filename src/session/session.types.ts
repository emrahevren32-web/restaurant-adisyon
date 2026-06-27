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
 * Session foundation only. The current app does not create JWTs or expirations;
 * this model exists so future phases can introduce them behind a stable shape.
 */
export const createEmptySessionSnapshot = (identity: IdentityResult): SessionSnapshot => ({
  status: identity.authenticated ? 'authenticated' : 'anonymous',
  source: 'local-storage',
  identity,
  issuedAt: null,
  expiresAt: null
})
