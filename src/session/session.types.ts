import { IdentityResult, UserType } from '../identity/identity.types'

export type SessionSource = 'local-storage' | 'jwt' | 'server-session'

export type SessionStatus = 'anonymous' | 'authenticated' | 'expired' | 'invalid'

export type SessionModel = {
  sessionId: string
  userId: string
  authenticated: boolean
  createdAt: Date
  expiresAt: Date
  lastActivity: Date
  userType: UserType
}

export type SessionSnapshot = {
  status: SessionStatus
  source: SessionSource
  identity: IdentityResult
  issuedAt: string | null
  expiresAt: string | null
}

export type SessionLifecycleStep =
  | 'login'
  | 'session-created'
  | 'authentication'
  | 'identity'
  | 'login-router'
  | 'security-gateway'
  | 'application'
  | 'session-expired'
  | 'logout'

export const SESSION_LIFECYCLE_STEPS: SessionLifecycleStep[] = [
  'login',
  'session-created',
  'authentication',
  'identity',
  'login-router',
  'security-gateway',
  'application',
  'session-expired',
  'logout'
]

export type SessionFoundationResult = {
  session: SessionModel | null
  snapshot: SessionSnapshot
}
