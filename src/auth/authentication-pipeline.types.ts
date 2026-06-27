import { IdentityResult } from '../identity/identity.types'
import { AuthorizationContext } from '../authorization/authorization.types'
import { JwtDescriptor } from './jwt.types'
import { LoginRedirectResult, LoginRouteTarget } from '../routing/routing.types'
import { SecurityDecision } from '../security/security.types'
import { SessionModel, SessionSnapshot } from '../session/session.types'
import { TenantContextModel } from '../tenant/tenant.types'

export type AuthenticationPipelineRequest = {
  legacyUser?: unknown
  requestedPath?: string
  requestedTarget?: LoginRouteTarget | string
}

export type AuthenticationPipelineResult = {
  identity: IdentityResult
  sessionModel: SessionModel | null
  session: SessionSnapshot
  jwt: JwtDescriptor | null
  tenantContext: TenantContextModel
  authorization: AuthorizationContext
  loginRedirect: LoginRedirectResult
  securityDecision: SecurityDecision
}

export type AuthenticationPipelineLayer =
  | 'authentication'
  | 'session'
  | 'jwt'
  | 'tenant-context'
  | 'role-engine'
  | 'permission-engine'
  | 'identity-resolver'
  | 'login-router'
  | 'security-gateway'
  | 'application'

export const AUTHENTICATION_PIPELINE_LAYERS: AuthenticationPipelineLayer[] = [
  'authentication',
  'session',
  'jwt',
  'tenant-context',
  'role-engine',
  'permission-engine',
  'identity-resolver',
  'login-router',
  'security-gateway',
  'application'
]
