export const USER_TYPES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  COMPANY_USER: 'COMPANY_USER',
  PUBLIC: 'PUBLIC'
} as const

export type UserType = typeof USER_TYPES[keyof typeof USER_TYPES]

export type IdentityResult = {
  authenticated: boolean
  userId: string | null
  companyId: string | null
  tenantId: string | null
  userType: UserType
  role: string | null
  permissions: string[]
  redirectTo: string | null
}

export type IdentityResolverContext = {
  /**
   * Reserved for the current legacy auth payload. It is intentionally unknown
   * so the future resolver can adapt without changing public contracts.
   */
  legacyUser?: unknown
  requestedPath?: string
}
