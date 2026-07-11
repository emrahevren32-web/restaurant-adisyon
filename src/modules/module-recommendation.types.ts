import type { BusinessWorkspaceModule } from './business-workspace.registry'
import type { SectorTemplateAssignableModuleCode } from './module-code.registry'
import type { SectorTemplate } from '../sector/sector-template.types'

export const MODULE_RECOMMENDATION_GROUPS = {
  RECOMMENDED: 'recommended',
  OPTIONAL: 'optional',
  FUTURE: 'future',
  UNSUPPORTED: 'unsupported'
} as const

export const MODULE_RECOMMENDATION_TEMPLATE_SOURCES = {
  DEFAULT: 'defaultModules',
  OPTIONAL: 'optionalModules'
} as const

export const MODULE_RECOMMENDATION_REASONS = {
  SECTOR_DEFAULT: 'sector-template-default',
  SECTOR_OPTIONAL: 'sector-template-optional',
  FUTURE_MODULE: 'future-module',
  UNSUPPORTED_MODULE: 'unsupported-module',
  DUPLICATE_TEMPLATE_MODULE: 'duplicate-template-module'
} as const

export type ModuleRecommendationGroup =
  typeof MODULE_RECOMMENDATION_GROUPS[keyof typeof MODULE_RECOMMENDATION_GROUPS]

export type ModuleRecommendationTemplateSource =
  typeof MODULE_RECOMMENDATION_TEMPLATE_SOURCES[keyof typeof MODULE_RECOMMENDATION_TEMPLATE_SOURCES]

export type ModuleRecommendationReason =
  typeof MODULE_RECOMMENDATION_REASONS[keyof typeof MODULE_RECOMMENDATION_REASONS]

export type ModuleRecommendationPlanItem = {
  moduleCode: SectorTemplateAssignableModuleCode
  moduleId: string
  name: string
  description: string
  icon: string
  group: ModuleRecommendationGroup
  source: ModuleRecommendationTemplateSource
  reason: ModuleRecommendationReason
  order: number
  module: BusinessWorkspaceModule | null
  isRegistryBacked: boolean
}

export type ModuleRecommendationPlanGroup = {
  group: ModuleRecommendationGroup
  order: number
  modules: ModuleRecommendationPlanItem[]
}

export type ModuleRecommendationPlan = {
  sectorId: string
  template: SectorTemplate
  recommendedModules: ModuleRecommendationPlanItem[]
  optionalModules: ModuleRecommendationPlanItem[]
  futureModules: ModuleRecommendationPlanItem[]
  unsupportedModules: ModuleRecommendationPlanItem[]
  orderedGroups: ModuleRecommendationPlanGroup[]
  allModules: ModuleRecommendationPlanItem[]
}
