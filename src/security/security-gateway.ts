import { IdentityResult, UserType, USER_TYPES } from '../identity/identity.types'
import { LoginRedirectResult } from '../routing/routing.types'
import { SecurityDecision, SecurityGatewayRequest } from './security.types'

/**
 * Central Security Gateway for MIYOP platform access decisions.
 *
 * Faz 20.9.4 only evaluates access. It deliberately does not redirect, mutate
 * routes, enforce permissions, validate JWTs, or change UI behavior.
 */
export const evaluateSecurityGateway = ({
  identity,
  loginRedirect,
  target
}: SecurityGatewayRequest): SecurityDecision => {
  const requestedTarget = normalizeTarget(target)
  const userType = getDecisionUserType(identity)

  if(!isValidIdentity(identity)){
    return deny(false, userType, requestedTarget, 'IDENTITY_INVALID')
  }

  if(!identity.authenticated || identity.userType === USER_TYPES.PUBLIC){
    return deny(false, identity.userType, requestedTarget, 'AUTHENTICATION_REQUIRED')
  }

  if(!isValidLoginRedirect(loginRedirect)){
    return deny(identity.authenticated, identity.userType, requestedTarget, 'LOGIN_REDIRECT_INVALID')
  }

  if(identity.userType !== loginRedirect.userType){
    return deny(identity.authenticated, identity.userType, requestedTarget, 'IDENTITY_REDIRECT_USER_TYPE_MISMATCH')
  }

  if(identity.authenticated !== loginRedirect.authenticated){
    return deny(identity.authenticated, identity.userType, requestedTarget, 'AUTHENTICATION_REDIRECT_MISMATCH')
  }

  if(loginRedirect.target !== requestedTarget){
    return deny(identity.authenticated, identity.userType, requestedTarget, 'REDIRECT_TARGET_MISMATCH')
  }

  return {
    allowed: true,
    authenticated: identity.authenticated,
    userType: identity.userType,
    target: requestedTarget,
    reason: null
  }
}

const isValidIdentity = (identity: IdentityResult | null): identity is IdentityResult => {
  if(!identity) return false
  if(!isKnownUserType(identity.userType)) return false
  if(identity.userType === USER_TYPES.PUBLIC) return !identity.authenticated
  if(!identity.authenticated) return false

  return Boolean(identity.userId)
}

const isValidLoginRedirect = (loginRedirect: LoginRedirectResult | null): loginRedirect is LoginRedirectResult => {
  if(!loginRedirect) return false
  if(!isKnownUserType(loginRedirect.userType)) return false

  return Boolean(normalizeTarget(loginRedirect.target))
}

const isKnownUserType = (value: unknown): value is UserType => {
  return Object.values(USER_TYPES).includes(value as UserType)
}

const getDecisionUserType = (identity: IdentityResult | null): UserType => {
  return identity && isKnownUserType(identity.userType) ? identity.userType : USER_TYPES.PUBLIC
}

const normalizeTarget = (target: string) => {
  return String(target || '').trim()
}

const deny = (
  authenticated: boolean,
  userType: UserType,
  target: string,
  reason: string
): SecurityDecision => ({
  allowed: false,
  authenticated,
  userType,
  target,
  reason
})
