import { AuthenticationPipelineResult } from './authentication-pipeline.types'
import { SessionModel } from '../session/session.types'

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
  session: SessionModel | null = null,
  now = new Date()
): AuthenticationContext => ({
  authenticated: pipeline.identity.authenticated,
  userId: pipeline.identity.userId,
  sessionId: session?.sessionId || null,
  loginTime: session?.createdAt || (pipeline.identity.authenticated ? now : null)
})
