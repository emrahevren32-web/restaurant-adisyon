import { IdentityResult } from '../identity/identity.types'
import { JwtDescriptor, JwtPayload, JwtValidationResult } from './jwt.types'

export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 60 * 60

export const createJwtPayload = (
  identity: IdentityResult,
  issuedAtSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = DEFAULT_ACCESS_TOKEN_TTL_SECONDS
): JwtPayload | null => {
  if(!identity.authenticated || !identity.userId) return null

  return {
    sub: identity.userId,
    tenantId: identity.tenantId,
    companyId: identity.companyId,
    userType: identity.userType,
    role: identity.role,
    permissions: [...identity.permissions],
    iat: issuedAtSeconds,
    exp: issuedAtSeconds + ttlSeconds
  }
}

export const createUnsignedJwtDescriptor = (
  identity: IdentityResult,
  issuedAtSeconds = Math.floor(Date.now() / 1000),
  ttlSeconds = DEFAULT_ACCESS_TOKEN_TTL_SECONDS
): JwtDescriptor | null => {
  const payload = createJwtPayload(identity, issuedAtSeconds, ttlSeconds)
  if(!payload) return null

  return {
    tokenType: 'access',
    payload,
    signed: false
  }
}

export const validateJwtPayloadShape = (
  payload: JwtPayload | null,
  nowSeconds = Math.floor(Date.now() / 1000)
): JwtValidationResult => {
  if(!payload){
    return { valid: false, expired: false, payload: null, reason: 'JWT_PAYLOAD_MISSING' }
  }

  if(!payload.sub || !payload.userType || !Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)){
    return { valid: false, expired: false, payload, reason: 'JWT_PAYLOAD_INVALID' }
  }

  const expired = payload.exp <= nowSeconds
  return {
    valid: !expired,
    expired,
    payload,
    reason: expired ? 'JWT_EXPIRED' : null
  }
}
