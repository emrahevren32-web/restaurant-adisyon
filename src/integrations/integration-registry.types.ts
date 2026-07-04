export const INTEGRATION_TYPES = {
  COMMUNICATION: 'COMMUNICATION',
  PAYMENT: 'PAYMENT',
  ACCOUNTING: 'ACCOUNTING',
  IDENTITY: 'IDENTITY',
  STORAGE: 'STORAGE',
  NOTIFICATION: 'NOTIFICATION',
  ANALYTICS: 'ANALYTICS',
  AI: 'AI',
  HARDWARE: 'HARDWARE',
  PRODUCTIVITY: 'PRODUCTIVITY'
} as const

export type IntegrationType = typeof INTEGRATION_TYPES[keyof typeof INTEGRATION_TYPES]

export const INTEGRATION_STATUSES = {
  AVAILABLE: 'AVAILABLE',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  COMING_SOON: 'COMING_SOON',
  DISABLED: 'DISABLED'
} as const

export type IntegrationStatus = typeof INTEGRATION_STATUSES[keyof typeof INTEGRATION_STATUSES]

export type IntegrationAuthMethod =
  | 'NONE'
  | 'API_KEY'
  | 'OAUTH'
  | 'WEBHOOK'
  | 'DEVICE_PAIRING'

export type IntegrationRegistryItem = {
  integrationId: string
  code: string
  name: string
  icon: string
  description: string
  developer: string
  category: IntegrationType
  version: string
  status: IntegrationStatus
  authMethods: IntegrationAuthMethod[]
  webhookReady: boolean
  marketplaceVisible: boolean
  displayOrder: number
  tags: string[]
}

export type WorkspaceIntegrationCatalogItem = IntegrationRegistryItem & {
  connectionReady: boolean
  authorizationReady: boolean
}

export type WorkspaceIntegrationQuery = {
  search?: string
  category?: IntegrationType | 'all'
  status?: IntegrationStatus | 'all'
}

export type WorkspaceIntegrationFilterOptions = {
  categories: IntegrationType[]
  statuses: IntegrationStatus[]
}
