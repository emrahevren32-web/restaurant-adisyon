import { IdentityResult, USER_TYPES } from '../identity/identity.types'
import { LOGIN_ROUTE_TARGETS, LoginRedirectResult } from './routing.types'

/**
 * Central login routing decision layer.
 *
 * The router only consumes IdentityResult. It does not read storage, users,
 * tenants, licenses, routes, or browser state. App.tsx maps this panel-level
 * decision back to the existing in-memory Business Workspace navigation.
 */
export const resolveLoginRedirect = (identity: IdentityResult): LoginRedirectResult => {
  if(!identity.authenticated || identity.userType === USER_TYPES.PUBLIC){
    return {
      target: LOGIN_ROUTE_TARGETS.PUBLIC_APPLICATION,
      userType: USER_TYPES.PUBLIC,
      authenticated: false,
      reason: 'PUBLIC_APPLICATION_ENTRY'
    }
  }

  if(identity.userType === USER_TYPES.SUPER_ADMIN){
    return {
      target: LOGIN_ROUTE_TARGETS.EVREN360,
      userType: identity.userType,
      authenticated: true,
      reason: 'SUPER_ADMIN_PLATFORM'
    }
  }

  if(identity.userType === USER_TYPES.COMPANY_ADMIN){
    return {
      target: LOGIN_ROUTE_TARGETS.BUSINESS_WORKSPACE_ADMIN,
      userType: identity.userType,
      authenticated: true,
      reason: 'COMPANY_ADMIN_BUSINESS_WORKSPACE'
    }
  }

  return {
    target: LOGIN_ROUTE_TARGETS.BUSINESS_WORKSPACE_USER,
    userType: identity.userType,
    authenticated: true,
    reason: 'COMPANY_USER_BUSINESS_WORKSPACE'
  }
}
