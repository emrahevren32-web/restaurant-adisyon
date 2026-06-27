export const AUTHENTICATION_EVENT_TYPES = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  SESSION_EXPIRED: 'SESSION_EXPIRED'
} as const

export type AuthenticationEventType = typeof AUTHENTICATION_EVENT_TYPES[keyof typeof AUTHENTICATION_EVENT_TYPES]

export type AuthenticationEvent = {
  type: AuthenticationEventType
  userId: string | null
  createdAt: string
}

export const AUTHENTICATION_LIFECYCLE_STEPS = [
  'login',
  'authentication',
  'session-created',
  'jwt-prepared',
  'tenant-loaded',
  'role-resolution',
  'permission-resolution',
  'identity-resolution',
  'login-router',
  'security-gateway',
  'application',
  'logout',
  'session-cleared'
] as const

export type AuthenticationLifecycleStep = typeof AUTHENTICATION_LIFECYCLE_STEPS[number]

/**
 * Event model foundation only. Faz 20.10.1 prepares event names and payloads,
 * but no event bus, side effect, or audit dispatch is active yet.
 */
export const createAuthenticationEvent = (
  type: AuthenticationEventType,
  userId: string | null,
  createdAt = new Date().toISOString()
): AuthenticationEvent => ({
  type,
  userId,
  createdAt
})
