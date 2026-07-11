export const WORKSPACE_MODULE_CODES = {
  WORKSPACE_WELCOME: 'workspace-welcome',
  DASHBOARD: 'dashboard',
  WORKSPACE: 'workspace',
  MARKETPLACE: 'marketplace',
  INTEGRATION_CENTER: 'integration-center',
  EXECUTIVE_CENTER: 'executive-center',
  USERS: 'users',
  ROLES: 'roles',
  BRANCHES: 'branches',
  NOTIFICATIONS: 'notifications',
  LICENSE: 'license',
  SUBSCRIPTION: 'subscription',
  AUDIT: 'audit',
  SETTINGS: 'settings',
  SUPPORT: 'support',
  AI_CENTER: 'ai-center',
  ADISYON: 'adisyon',
  QR_MENU: 'qr-menu',
  STOCK: 'stock',
  RECIPE: 'recipe',
  CURRENT: 'current',
  CREDIT: 'credit',
  FINANCE: 'finance',
  PERSONNEL: 'personnel',
  MULTI_BRANCH: 'multi-branch',
  MANAGER_ALERTS: 'manager-alerts'
} as const

export const SECTOR_TEMPLATE_MODULE_CODES = {
  PRODUCT: 'product',
  WAREHOUSE: 'warehouse',
  PRODUCTION: 'production',
  PURCHASE: 'purchase',
  CRM: 'crm',
  CAMPAIGN: 'campaign',
  LOYALTY: 'loyalty',
  COURIER: 'courier',
  QUALITY: 'quality',
  MAINTENANCE: 'maintenance',
  APPOINTMENT: 'appointment',
  CUSTOMER: 'customer',
  CASH: 'cash',
  SMS: 'sms',
  RESERVATION: 'reservation',
  TOURNAMENT: 'tournament'
} as const

export const BUSINESS_MODULE_CODES = {
  ADISYON: WORKSPACE_MODULE_CODES.ADISYON,
  QR_MENU: WORKSPACE_MODULE_CODES.QR_MENU,
  STOCK: WORKSPACE_MODULE_CODES.STOCK,
  RECIPE: WORKSPACE_MODULE_CODES.RECIPE,
  CURRENT: WORKSPACE_MODULE_CODES.CURRENT,
  CREDIT: WORKSPACE_MODULE_CODES.CREDIT,
  FINANCE: WORKSPACE_MODULE_CODES.FINANCE,
  PERSONNEL: WORKSPACE_MODULE_CODES.PERSONNEL,
  MULTI_BRANCH: WORKSPACE_MODULE_CODES.MULTI_BRANCH,
  MANAGER_ALERTS: WORKSPACE_MODULE_CODES.MANAGER_ALERTS
} as const

export const SECTOR_TEMPLATE_ASSIGNABLE_MODULE_CODES = {
  ...BUSINESS_MODULE_CODES,
  ...SECTOR_TEMPLATE_MODULE_CODES
} as const

export const MODULE_CODES = {
  ...WORKSPACE_MODULE_CODES,
  ...SECTOR_TEMPLATE_MODULE_CODES
} as const

export const LICENSE_MODULE_CODES = {
  ADISYON: WORKSPACE_MODULE_CODES.ADISYON,
  QR_MENU: WORKSPACE_MODULE_CODES.QR_MENU,
  STOCK: WORKSPACE_MODULE_CODES.STOCK,
  RECIPE: WORKSPACE_MODULE_CODES.RECIPE,
  CURRENT: WORKSPACE_MODULE_CODES.CURRENT,
  CREDIT: WORKSPACE_MODULE_CODES.CREDIT,
  FINANCE: WORKSPACE_MODULE_CODES.FINANCE,
  PERSONNEL: WORKSPACE_MODULE_CODES.PERSONNEL,
  BOSS_DASHBOARD: 'boss-dashboard',
  MULTI_BRANCH: WORKSPACE_MODULE_CODES.MULTI_BRANCH,
  ANALYTICS: 'analytics',
  AI_CONSULTANT: 'ai-consultant',
  TASK_MANAGEMENT: 'task-management',
  CALENDAR: 'calendar'
} as const

export type WorkspaceModuleCode = typeof WORKSPACE_MODULE_CODES[keyof typeof WORKSPACE_MODULE_CODES]
export type BusinessModuleCode = typeof BUSINESS_MODULE_CODES[keyof typeof BUSINESS_MODULE_CODES]
export type SectorTemplateModuleCode = typeof SECTOR_TEMPLATE_MODULE_CODES[keyof typeof SECTOR_TEMPLATE_MODULE_CODES]
export type SectorTemplateAssignableModuleCode =
  typeof SECTOR_TEMPLATE_ASSIGNABLE_MODULE_CODES[keyof typeof SECTOR_TEMPLATE_ASSIGNABLE_MODULE_CODES]
export type ModuleCode = typeof MODULE_CODES[keyof typeof MODULE_CODES]
export type LicenseModuleCode = typeof LICENSE_MODULE_CODES[keyof typeof LICENSE_MODULE_CODES]
