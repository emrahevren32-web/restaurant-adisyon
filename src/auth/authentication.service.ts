import { LoginRouteTarget } from '../routing/routing.types'
import {
  authenticateUser,
  getCurrentUser,
  setCurrentUser
} from '../storage'
import { User } from '../types'
import { createSessionModel } from '../session/session.service'
import { SessionModel } from '../session/session.types'
import { TenantContextModel } from '../tenant/tenant.types'
import { AuthorizationContext } from '../authorization/authorization.types'
import { createUnsignedJwtDescriptor } from './jwt.service'
import { JwtDescriptor } from './jwt.types'
import {
  evaluateAuthenticationPipelineTarget,
  resolveAuthenticationPipeline
} from './authentication-pipeline'
import { AuthenticationPipelineResult } from './authentication-pipeline.types'
import { AuthenticationContext, createAuthenticationContext } from './authentication.context'

export type AuthenticationState = {
  currentUser: User | null
  context: AuthenticationContext
  session: SessionModel | null
  jwt: JwtDescriptor | null
  tenantContext: TenantContextModel
  authorization: AuthorizationContext
  pipeline: AuthenticationPipelineResult
}

export type AuthenticationServiceOptions = {
  requestedPath?: string
  requestedTarget?: LoginRouteTarget | string
}

export type AuthenticationLoginResult = {
  success: boolean
  user: User | null
  state: AuthenticationState
}

export const getInitialAuthenticationState = (
  options: AuthenticationServiceOptions = {}
): AuthenticationState => {
  return createAuthenticationState(getCurrentUser(), options)
}

export const authenticateCredentials = (
  username: string,
  password: string,
  options: AuthenticationServiceOptions = {}
): AuthenticationLoginResult => {
  const user = authenticateUser(username, password)
  const state = createAuthenticationState(user, options)

  return {
    success: Boolean(user),
    user,
    state
  }
}

export const createAuthenticationState = (
  user: User | null,
  options: AuthenticationServiceOptions = {}
): AuthenticationState => {
  const pipeline = resolveAuthenticationPipeline({
    legacyUser: user,
    requestedPath: options.requestedPath,
    requestedTarget: options.requestedTarget
  })
  const session = createSessionModel(pipeline.identity)
  const jwt = createUnsignedJwtDescriptor(pipeline.identity)

  return {
    currentUser: user,
    context: createAuthenticationContext(pipeline, session),
    session,
    jwt,
    tenantContext: pipeline.tenantContext,
    authorization: pipeline.authorization,
    pipeline
  }
}

export const evaluateAuthenticationStateTarget = (
  state: AuthenticationState,
  target: LoginRouteTarget | string
): AuthenticationState => {
  const pipeline = evaluateAuthenticationPipelineTarget(state.pipeline, target)

  return {
    ...state,
    context: createAuthenticationContext(pipeline, state.session),
    tenantContext: pipeline.tenantContext,
    authorization: pipeline.authorization,
    pipeline
  }
}

export const logoutAuthentication = (
  options: AuthenticationServiceOptions = {}
): AuthenticationState => {
  setCurrentUser(null)
  return createAuthenticationState(null, options)
}
