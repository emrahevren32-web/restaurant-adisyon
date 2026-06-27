import { UserType } from '../identity/identity.types'

export type AccessDecisionReason =
  | 'AUTHENTICATED'
  | 'UNAUTHENTICATED'
  | 'ROLE_ALLOWED'
  | 'ROLE_DENIED'
  | 'TENANT_ALLOWED'
  | 'TENANT_DENIED'
  | 'LICENSE_ALLOWED'
  | 'LICENSE_DENIED'
  | 'PERMISSION_ALLOWED'
  | 'PERMISSION_DENIED'

export type AuthorizationSubject = {
  userId: string | null
  userType: UserType
  role: string | null
  permissions: string[]
}

export type AccessDecision = {
  allowed: boolean
  reason: AccessDecisionReason
  redirectTo: string | null
  message: string | null
}

export const createPendingAccessDecision = (): AccessDecision => ({
  allowed: false,
  reason: 'UNAUTHENTICATED',
  redirectTo: null,
  message: null
})
