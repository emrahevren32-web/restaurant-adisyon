import { IdentityResult } from '../identity/identity.types'
import { SessionFoundationResult, SessionModel, SessionSnapshot } from './session.types'

export const DEFAULT_SESSION_DURATION_MS = 8 * 60 * 60 * 1000

export const createSessionModel = (
  identity: IdentityResult,
  now = new Date(),
  durationMs = DEFAULT_SESSION_DURATION_MS
): SessionModel | null => {
  if(!identity.authenticated || !identity.userId) return null

  return {
    sessionId: createSessionId(identity.userId, now),
    userId: identity.userId,
    authenticated: true,
    createdAt: now,
    expiresAt: new Date(now.getTime() + durationMs),
    lastActivity: now,
    userType: identity.userType
  }
}

export const createSessionSnapshot = (
  identity: IdentityResult,
  now = new Date()
): SessionSnapshot => {
  const session = createSessionModel(identity, now)

  return {
    status: session ? 'authenticated' : 'anonymous',
    source: 'local-storage',
    identity,
    issuedAt: session ? session.createdAt.toISOString() : null,
    expiresAt: session ? session.expiresAt.toISOString() : null
  }
}

export const createSessionFoundation = (
  identity: IdentityResult,
  now = new Date()
): SessionFoundationResult => {
  return {
    session: createSessionModel(identity, now),
    snapshot: createSessionSnapshot(identity, now)
  }
}

export const touchSession = (
  session: SessionModel,
  now = new Date()
): SessionModel => ({
  ...session,
  lastActivity: now
})

export const isSessionExpired = (
  session: SessionModel | null,
  now = new Date()
) => {
  if(!session) return true
  return session.expiresAt.getTime() <= now.getTime()
}

export const expireSession = (
  session: SessionModel,
  now = new Date()
): SessionModel => ({
  ...session,
  authenticated: false,
  expiresAt: now,
  lastActivity: now
})

const createSessionId = (userId: string, date: Date) => {
  return `session_${userId}_${date.getTime()}`
}
