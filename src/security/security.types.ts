import { IdentityResult, UserType } from '../identity/identity.types'
import { LoginRedirectResult } from '../routing/routing.types'

export type SecurityDecision = {
  allowed: boolean
  authenticated: boolean
  userType: UserType
  target: string
  reason: string | null
}

export type SecurityGatewayRequest = {
  identity: IdentityResult | null
  loginRedirect: LoginRedirectResult | null
  target: string
}

export const SECURITY_PIPELINE_STEPS = [
  'request',
  'authentication',
  'identity',
  'login-router',
  'security-gateway',
  'access-decision'
] as const

export type SecurityPipelineStep = typeof SECURITY_PIPELINE_STEPS[number]

export const FUTURE_SECURITY_LAYERS = [
  'jwt',
  'session',
  'permission',
  'role',
  'tenant',
  'module-activation',
  'subscription',
  'feature-flags',
  'audit',
  'maintenance-mode'
] as const

export type FutureSecurityLayer = typeof FUTURE_SECURITY_LAYERS[number]
