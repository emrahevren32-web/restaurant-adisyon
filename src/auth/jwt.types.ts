import { UserType } from '../identity/identity.types'

export type JwtPayload = {
  sub: string
  tenantId: string | null
  companyId: string | null
  userType: UserType
  role: string | null
  permissions: string[]
  iat: number
  exp: number
}

export type JwtTokenType = 'access' | 'refresh'

export type JwtDescriptor = {
  tokenType: JwtTokenType
  payload: JwtPayload
  signed: boolean
}

export type JwtValidationResult = {
  valid: boolean
  expired: boolean
  payload: JwtPayload | null
  reason: string | null
}
