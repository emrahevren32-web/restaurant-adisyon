import { IdentityResult } from '../identity/identity.types'
import { LoginRedirectResult, LoginRouteTarget } from '../routing/routing.types'
import { SecurityDecision } from '../security/security.types'
import { SessionSnapshot } from '../session/session.types'

export type AuthenticationPipelineRequest = {
  legacyUser?: unknown
  requestedPath?: string
  requestedTarget?: LoginRouteTarget | string
}

export type AuthenticationPipelineResult = {
  identity: IdentityResult
  session: SessionSnapshot
  loginRedirect: LoginRedirectResult
  securityDecision: SecurityDecision
}

export type AuthenticationPipelineLayer =
  | 'authentication'
  | 'identity-resolver'
  | 'login-router'
  | 'security-gateway'
  | 'application'

export const AUTHENTICATION_PIPELINE_LAYERS: AuthenticationPipelineLayer[] = [
  'authentication',
  'identity-resolver',
  'login-router',
  'security-gateway',
  'application'
]
