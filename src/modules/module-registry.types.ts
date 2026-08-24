import type { PermissionName } from '../authorization/permission.types'
import type { DashboardWidgetModuleContribution } from '../dashboard/dashboard-widget.types'
import type { LicenseModuleKey } from '../types'
import type { ProvisionManifest } from '../workspace-provisioning/provision-manifest.types'

export const WORKSPACE_MODULE_TYPES = {
  CORE_SYSTEM: 'core-system',
  BUSINESS: 'business',
  INTEGRATION: 'integration'
} as const

export const MODULE_SCOPES = {
  SYSTEM: 'SYSTEM',
  BUSINESS: 'BUSINESS',
  PLATFORM: 'PLATFORM'
} as const

/**
 * Production Foundation kapsamı — ADR-002.
 *
 * 'core'   : gerçek veri katmanına taşınan, menüde görünen, testleri yazılan modül.
 * 'frozen' : kodu repoda duran ama menüde ve rotada kapalı olan modül.
 *
 * Bu alan `scope` (SYSTEM/BUSINESS/PLATFORM) ile karıştırılmamalıdır; o organizasyonel
 * yerleşimi, bu ise teslim kapsamını anlatır. `isEnabled`/`isVisible` ile de aynı şey
 * değildir: onlar lisans ve marketplace kavramlarıdır.
 */
export type FoundationScope = 'core' | 'frozen'

export type WorkspaceModuleType = typeof WORKSPACE_MODULE_TYPES[keyof typeof WORKSPACE_MODULE_TYPES]
export type ModuleScope = typeof MODULE_SCOPES[keyof typeof MODULE_SCOPES]
export type WorkspaceModuleCategory = WorkspaceModuleType
export type WorkspaceModuleAvailability = 'mandatory' | 'optional'
export type WorkspaceModuleActivationPolicy = 'always-on' | 'license-controlled' | 'external-controlled'

export type WorkspaceModulePricingModel =
  | 'included'
  | 'free'
  | 'paid'
  | 'usage-based'
  | 'custom'

export type WorkspaceModulePricing = {
  model: WorkspaceModulePricingModel
  currency?: string
  monthlyPrice?: number
  yearlyPrice?: number
  trialDays?: number
}

export type WorkspaceModuleMarketplace = {
  isMarketplaceReady: boolean
  canBePurchased: boolean
  canBeActivated: boolean
  purchaseUrl?: string
}

export type WorkspaceModuleLifecycle = {
  availability: WorkspaceModuleAvailability
  activationPolicy: WorkspaceModuleActivationPolicy
  canBeDisabled: boolean
  canBeDetachedFromWorkspace: boolean
  canBePurchased: boolean
  canBeActivatedManually: boolean
}

export type WorkspaceModuleMenuItem<Route extends string, NavKey extends string> = {
  key: NavKey
  label: string
  route?: Route
  icon: string
  parent?: NavKey
  order?: number
  children?: WorkspaceModuleMenuItem<Route, NavKey>[]
  requiredPermission?: PermissionName
  visible?: boolean
  expandedByDefault?: boolean
  adminOnly?: boolean
  platformAdminOnly?: boolean
  badge?: number
  locked?: boolean
  hidden?: boolean
  disabledReason?: string
  displayOrder?: number
  /** Belirtilmezse modülün foundationScope'u geçerlidir. Bkz. ADR-002. */
  foundationScope?: FoundationScope
}

export type WorkspaceModuleRegistryItem<Route extends string, NavKey extends string> = {
  id: string
  code: string
  name: string
  description: string
  category: WorkspaceModuleCategory
  moduleType: WorkspaceModuleType
  scope: ModuleScope
  /** Production Foundation teslim kapsamı — zorunlu. Bkz. ADR-002. */
  foundationScope: FoundationScope
  icon: string
  route: Route
  permissions: PermissionName[]
  isCoreModule: boolean
  isBusinessModule: boolean
  isIntegrationModule: boolean
  isRequired: boolean
  isAlwaysActive: boolean
  isMarketplaceEligible: boolean
  isEnabled: boolean
  isVisible: boolean
  displayOrder: number
  dependencies: string[]
  tags: string[]
  supportedSectorIds?: string[]
  lifecycle: WorkspaceModuleLifecycle
  licenseModuleKey?: LicenseModuleKey
  pricing?: WorkspaceModulePricing
  marketplace?: WorkspaceModuleMarketplace
  menuItems: WorkspaceModuleMenuItem<Route, NavKey>[]
  dashboardWidgets?: DashboardWidgetModuleContribution[]
  provisionManifest: ProvisionManifest
}
