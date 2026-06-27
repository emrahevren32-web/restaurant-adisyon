import { UserType } from '../identity/identity.types'

export const LOGIN_ROUTE_TARGETS = {
  EVREN360: '/evren360',
  RESTAURANTOS_ADMIN: 'restaurantos-admin',
  RESTAURANTOS_USER: 'restaurantos-user',
  PUBLIC_APPLICATION: '/apply'
} as const

export type LoginRouteTarget = typeof LOGIN_ROUTE_TARGETS[keyof typeof LOGIN_ROUTE_TARGETS]

export type LoginRedirectResult = {
  target: LoginRouteTarget
  userType: UserType
  authenticated: boolean
  reason: string | null
}
