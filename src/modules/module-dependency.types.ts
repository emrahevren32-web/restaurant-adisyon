import type { BusinessWorkspaceModule } from './business-workspace.registry'
import type { ModuleCode } from './module-code.registry'
import type {
  ModuleRecommendationGroup,
  ModuleRecommendationPlan
} from './module-recommendation.types'

export const MODULE_DEPENDENCY_RELATION_TYPES = {
  RECOMMENDATION: 'recommendation',
  REQUIRED: 'required',
  RECOMMENDED: 'recommended',
  OPTIONAL: 'optional'
} as const

export const MODULE_DEPENDENCY_ISSUE_TYPES = {
  MISSING_REQUIRED: 'missing-required',
  FUTURE_MODULE: 'future-module',
  UNSUPPORTED_MODULE: 'unsupported-module',
  CONFLICT: 'conflict',
  CIRCULAR_DEPENDENCY: 'circular-dependency'
} as const

export type ModuleDependencyRelationType =
  typeof MODULE_DEPENDENCY_RELATION_TYPES[keyof typeof MODULE_DEPENDENCY_RELATION_TYPES]

export type ModuleDependencyIssueType =
  typeof MODULE_DEPENDENCY_ISSUE_TYPES[keyof typeof MODULE_DEPENDENCY_ISSUE_TYPES]

export type ModuleDependencyRule = {
  moduleCode: ModuleCode
  requires: ModuleCode[]
  recommended: ModuleCode[]
  optionalDependencies: ModuleCode[]
  conflicts: ModuleCode[]
  description: string
}

export type ModuleDependencyPlanItem = {
  moduleCode: ModuleCode
  moduleId: string
  name: string
  description: string
  icon: string
  module: BusinessWorkspaceModule | null
  relation: ModuleDependencyRelationType
  recommendationGroup?: ModuleRecommendationGroup
  requestedBy: ModuleCode[]
  dependencyPath: ModuleCode[]
  order: number
  isRegistryBacked: boolean
  isFuture: boolean
  isUnsupported: boolean
}

export type ModuleDependencyIssue = {
  type: ModuleDependencyIssueType
  moduleCode: ModuleCode
  relatedModuleCode?: ModuleCode
  dependencyPath: ModuleCode[]
  message: string
}

export type ModuleInstallationPlan = {
  sectorId: string
  recommendationPlan: ModuleRecommendationPlan
  resolvedModules: ModuleDependencyPlanItem[]
  addedByDependency: ModuleDependencyPlanItem[]
  missingModules: ModuleDependencyIssue[]
  conflictingModules: ModuleDependencyIssue[]
  futureModules: ModuleDependencyPlanItem[]
  unsupportedModules: ModuleDependencyPlanItem[]
  circularDependencies: ModuleDependencyIssue[]
  allModules: ModuleDependencyPlanItem[]
  issues: ModuleDependencyIssue[]
}
