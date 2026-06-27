import { LoginRouteTarget } from '../routing/routing.types'
import {
  authenticateUser,
  getCurrentUser,
  setCurrentUser
} from '../storage'
import { User } from '../types'
import {
  evaluateAuthenticationPipelineTarget,
  resolveAuthenticationPipeline
} from './authentication-pipeline'
import { AuthenticationPipelineResult } from './authentication-pipeline.types'
import { AuthenticationContext, createAuthenticationContext } from './authentication.context'

export type AuthenticationState = {
  currentUser: User | null
  context: AuthenticationContext
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

  return {
    currentUser: user,
    context: createAuthenticationContext(pipeline),
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
    context: createAuthenticationContext(pipeline),
    pipeline
  }
}

export const logoutAuthentication = (
  options: AuthenticationServiceOptions = {}
): AuthenticationState => {
  setCurrentUser(null)
  return createAuthenticationState(null, options)
}
