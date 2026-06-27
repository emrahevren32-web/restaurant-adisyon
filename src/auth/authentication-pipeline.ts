import { IdentityResult, USER_TYPES } from '../identity/identity.types'
import { resolveIdentity } from '../identity/identity-resolver'
import { resolveLoginRedirect } from '../routing/login-router'
import { LOGIN_ROUTE_TARGETS, LoginRouteTarget } from '../routing/routing.types'
import { evaluateSecurityGateway } from '../security/security-gateway'
import { createSessionSnapshot } from '../session/session.service'
import { resolveTenantContextFromIdentity } from '../tenant/tenant.service'
import { AuthenticationPipelineRequest, AuthenticationPipelineResult } from './authentication-pipeline.types'

const getBrowserPath = () => {
  return typeof window === 'undefined' ? '' : window.location.pathname
}

export const resolveAuthenticationPipeline = ({
  legacyUser,
  requestedPath = getBrowserPath(),
  requestedTarget
}: AuthenticationPipelineRequest = {}): AuthenticationPipelineResult => {
  const identity = resolveIdentity({ legacyUser, requestedPath })
  const session = createSessionSnapshot(identity)
  const tenantContext = resolveTenantContextFromIdentity(identity)
  const loginRedirect = resolveLoginRedirect(identity)
  const securityTarget = normalizeSecurityTarget(requestedTarget || resolveSecurityTargetForPath(identity, requestedPath))

  return {
    identity,
    session,
    tenantContext,
    loginRedirect,
    securityDecision: evaluateSecurityGateway({
      identity,
      loginRedirect,
      target: securityTarget
    })
  }
}

export const evaluateAuthenticationPipelineTarget = (
  pipeline: AuthenticationPipelineResult,
  target: LoginRouteTarget | string
): AuthenticationPipelineResult => {
  const securityTarget = normalizeSecurityTarget(target)

  return {
    ...pipeline,
    securityDecision: evaluateSecurityGateway({
      identity: pipeline.identity,
      loginRedirect: pipeline.loginRedirect,
      target: securityTarget
    })
  }
}

export const resolveSecurityTargetForPath = (
  identity: IdentityResult,
  path = getBrowserPath()
): LoginRouteTarget => {
  if(/^\/(?:evren360|platform)(?:\/|$)/.test(path)) return LOGIN_ROUTE_TARGETS.EVREN360
  if(/^\/(?:basvuru|apply)(?:\/|$)/.test(path)) return LOGIN_ROUTE_TARGETS.PUBLIC_APPLICATION
  if(/^\/restaurant-admin(?:\/|$)/.test(path)) return LOGIN_ROUTE_TARGETS.RESTAURANTOS_ADMIN
  if(/^\/restaurant-user(?:\/|$)/.test(path)) return LOGIN_ROUTE_TARGETS.RESTAURANTOS_USER
  if(/^\/(?:restaurant|restaurantos)(?:\/|$)/.test(path)){
    return identity.userType === USER_TYPES.COMPANY_USER
      ? LOGIN_ROUTE_TARGETS.RESTAURANTOS_USER
      : LOGIN_ROUTE_TARGETS.RESTAURANTOS_ADMIN
  }

  return resolveSecurityTargetForIdentity(identity)
}

export const resolveSecurityTargetForIdentity = (identity: IdentityResult): LoginRouteTarget => {
  if(identity.userType === USER_TYPES.SUPER_ADMIN) return LOGIN_ROUTE_TARGETS.EVREN360
  if(identity.userType === USER_TYPES.COMPANY_ADMIN) return LOGIN_ROUTE_TARGETS.RESTAURANTOS_ADMIN
  if(identity.userType === USER_TYPES.COMPANY_USER) return LOGIN_ROUTE_TARGETS.RESTAURANTOS_USER
  return LOGIN_ROUTE_TARGETS.PUBLIC_APPLICATION
}

const normalizeSecurityTarget = (target: LoginRouteTarget | string) => {
  return String(target || '').trim()
}
