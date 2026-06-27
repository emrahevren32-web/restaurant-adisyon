import { AuthenticationPipelineResult } from './authentication-pipeline.types'

export type AuthenticationContext = {
  authenticated: boolean
  userId: string | null
  sessionId: string | null
  loginTime: Date | null
}

/**
 * In-memory authentication context for the current legacy auth flow.
 * It does not persist sessions and does not change JWT/session behavior.
 */
export const createAuthenticationContext = (
  pipeline: AuthenticationPipelineResult,
  now = new Date()
): AuthenticationContext => ({
  authenticated: pipeline.identity.authenticated,
  userId: pipeline.identity.userId,
  sessionId: pipeline.identity.authenticated && pipeline.identity.userId
    ? createAuthenticationSessionId(pipeline.identity.userId, now)
    : null,
  loginTime: pipeline.identity.authenticated ? now : null
})

const createAuthenticationSessionId = (userId: string, date: Date) => {
  return `auth_session_${userId}_${date.getTime()}`
}
