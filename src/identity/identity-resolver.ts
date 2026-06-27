import { DEFAULT_IDENTITY_RESULT } from './identity.constants'
import { IdentityResolverContext, IdentityResult } from './identity.types'

/**
 * Foundation-only resolver for Faz 20.9.1.
 *
 * This function is deliberately not wired into the live login flow yet. Faz
 * 20.9.2 can evolve it to read the legacy auth payload and produce a normalized
 * IdentityResult without changing the existing Login/App behavior first.
 */
export const resolveIdentity = (_context: IdentityResolverContext = {}): IdentityResult => {
  return {
    ...DEFAULT_IDENTITY_RESULT,
    permissions: [...DEFAULT_IDENTITY_RESULT.permissions]
  }
}

export const createAnonymousIdentityResult = (): IdentityResult => {
  return resolveIdentity()
}
