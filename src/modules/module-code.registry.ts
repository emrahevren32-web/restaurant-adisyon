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
  ORDER: 'order',
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

export type SectorTemplateModuleMetadata = {
  code: SectorTemplateModuleCode
  name: string
  description: string
  icon: string
}

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

export const SECTOR_TEMPLATE_MODULE_METADATA: Record<SectorTemplateModuleCode, SectorTemplateModuleMetadata> = {
  [SECTOR_TEMPLATE_MODULE_CODES.PRODUCT]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.PRODUCT,
    name: 'Ürün',
    description: 'Ürün ve hizmet katalog tanımlarını temsil eden sektör şablonu modülü.',
    icon: 'UR'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.ORDER]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.ORDER,
    name: 'Sipariş',
    description: 'Sipariş alma, takip ve operasyon akışını temsil eden sektör şablonu modülü.',
    icon: 'SP'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.WAREHOUSE]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.WAREHOUSE,
    name: 'Depo',
    description: 'Depo ve lokasyon bazlı stok alanlarını temsil eden sektör şablonu modülü.',
    icon: 'DP'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.PRODUCTION]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.PRODUCTION,
    name: 'Üretim',
    description: 'Üretim operasyonlarını ve üretim planlama ihtiyacını temsil eden sektör şablonu modülü.',
    icon: 'UR'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.PURCHASE]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.PURCHASE,
    name: 'Satın Alma',
    description: 'Satın alma, tedarik ve sipariş süreçlerini temsil eden sektör şablonu modülü.',
    icon: 'SA'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.CRM]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.CRM,
    name: 'CRM',
    description: 'Müşteri ilişkileri ve satış takip süreçlerini temsil eden sektör şablonu modülü.',
    icon: 'CR'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.CAMPAIGN]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.CAMPAIGN,
    name: 'Kampanya',
    description: 'Kampanya, indirim ve pazarlama aksiyonlarını temsil eden sektör şablonu modülü.',
    icon: 'KP'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.LOYALTY]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.LOYALTY,
    name: 'Sadakat',
    description: 'Sadakat puanı, üyelik ve tekrar müşteri kazanımı süreçlerini temsil eden sektör şablonu modülü.',
    icon: 'SD'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.COURIER]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.COURIER,
    name: 'Kurye',
    description: 'Kurye, teslimat ve dış servis operasyonlarını temsil eden sektör şablonu modülü.',
    icon: 'KY'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.QUALITY]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.QUALITY,
    name: 'Kalite',
    description: 'Kalite kontrol ve denetim süreçlerini temsil eden sektör şablonu modülü.',
    icon: 'KL'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.MAINTENANCE]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.MAINTENANCE,
    name: 'Bakım',
    description: 'Ekipman bakım ve servis operasyonlarını temsil eden sektör şablonu modülü.',
    icon: 'BK'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.APPOINTMENT]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.APPOINTMENT,
    name: 'Randevu',
    description: 'Randevu, takvim ve hizmet planlama süreçlerini temsil eden sektör şablonu modülü.',
    icon: 'RN'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.CUSTOMER]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.CUSTOMER,
    name: 'Müşteri',
    description: 'Müşteri kartları ve müşteri geçmişi süreçlerini temsil eden sektör şablonu modülü.',
    icon: 'MS'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.CASH]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.CASH,
    name: 'Kasa',
    description: 'Kasa, tahsilat ve ödeme hareketlerini temsil eden sektör şablonu modülü.',
    icon: 'KS'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.SMS]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.SMS,
    name: 'SMS',
    description: 'SMS bilgilendirme ve kampanya iletişimini temsil eden sektör şablonu modülü.',
    icon: 'SM'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.RESERVATION]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.RESERVATION,
    name: 'Rezervasyon',
    description: 'Rezervasyon ve zaman dilimi yönetimini temsil eden sektör şablonu modülü.',
    icon: 'RZ'
  },
  [SECTOR_TEMPLATE_MODULE_CODES.TOURNAMENT]: {
    code: SECTOR_TEMPLATE_MODULE_CODES.TOURNAMENT,
    name: 'Turnuva',
    description: 'Turnuva, fikstür ve etkinlik organizasyonlarını temsil eden sektör şablonu modülü.',
    icon: 'TR'
  }
}

export const getSectorTemplateAssignableModuleCodes = (): SectorTemplateAssignableModuleCode[] => (
  Object.values(SECTOR_TEMPLATE_ASSIGNABLE_MODULE_CODES)
)

export const isSectorTemplateAssignableModuleCode = (value: string): value is SectorTemplateAssignableModuleCode => (
  getSectorTemplateAssignableModuleCodes().includes(value as SectorTemplateAssignableModuleCode)
)

export const getSectorTemplateModuleMetadata = (moduleCode: SectorTemplateAssignableModuleCode) => {
  return SECTOR_TEMPLATE_MODULE_METADATA[moduleCode as SectorTemplateModuleCode] || null
}
