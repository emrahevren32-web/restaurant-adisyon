import type { BusinessWorkspaceModule } from './business-workspace.registry'
import {
  getSectorTemplateModuleMetadata,
  isSectorTemplateAssignableModuleCode,
  type SectorTemplateAssignableModuleCode
} from './module-code.registry'
import { WORKSPACE_MODULE_TYPES } from './module-registry.types'
import {
  getSectorTemplate,
  getSectorTemplateModuleResolution
} from '../sector/sector-template.service'
import type { SectorTemplateModuleResolution } from '../sector/sector-template.types'
import {
  MODULE_RECOMMENDATION_GROUPS,
  MODULE_RECOMMENDATION_REASONS,
  MODULE_RECOMMENDATION_TEMPLATE_SOURCES,
  type ModuleRecommendationGroup,
  type ModuleRecommendationPlan,
  type ModuleRecommendationPlanGroup,
  type ModuleRecommendationPlanItem,
  type ModuleRecommendationReason,
  type ModuleRecommendationTemplateSource
} from './module-recommendation.types'

export type {
  ModuleRecommendationGroup,
  ModuleRecommendationPlan,
  ModuleRecommendationPlanGroup,
  ModuleRecommendationPlanItem,
  ModuleRecommendationReason,
  ModuleRecommendationTemplateSource
} from './module-recommendation.types'

export {
  MODULE_RECOMMENDATION_GROUPS,
  MODULE_RECOMMENDATION_REASONS,
  MODULE_RECOMMENDATION_TEMPLATE_SOURCES
} from './module-recommendation.types'

const GROUP_ORDER: Record<ModuleRecommendationGroup, number> = {
  [MODULE_RECOMMENDATION_GROUPS.RECOMMENDED]: 10,
  [MODULE_RECOMMENDATION_GROUPS.OPTIONAL]: 20,
  [MODULE_RECOMMENDATION_GROUPS.FUTURE]: 30,
  [MODULE_RECOMMENDATION_GROUPS.UNSUPPORTED]: 40
}

const SOURCE_ORDER: Record<ModuleRecommendationTemplateSource, number> = {
  [MODULE_RECOMMENDATION_TEMPLATE_SOURCES.DEFAULT]: 10,
  [MODULE_RECOMMENDATION_TEMPLATE_SOURCES.OPTIONAL]: 20
}

const isSupportedRecommendationModule = (module: BusinessWorkspaceModule) => {
  return module.moduleType === WORKSPACE_MODULE_TYPES.BUSINESS
    || module.moduleType === WORKSPACE_MODULE_TYPES.INTEGRATION
}

const createFallbackModuleName = (moduleCode: SectorTemplateAssignableModuleCode) => {
  const metadata = getSectorTemplateModuleMetadata(moduleCode)
  if(metadata) return metadata.name
  return moduleCode
    .split('-')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toLocaleUpperCase('tr-TR')}${part.slice(1)}`)
    .join(' ')
}

const createFallbackModuleIcon = (moduleCode: SectorTemplateAssignableModuleCode) => {
  const metadata = getSectorTemplateModuleMetadata(moduleCode)
  if(metadata) return metadata.icon
  return moduleCode.replace(/[^a-z0-9]/gi, '').slice(0, 2).toLocaleUpperCase('tr-TR') || 'MD'
}

const createFallbackModuleDescription = (moduleCode: SectorTemplateAssignableModuleCode) => {
  const metadata = getSectorTemplateModuleMetadata(moduleCode)
  return metadata?.description || `${createFallbackModuleName(moduleCode)} modülü henüz Module Registry içinde tanımlı değildir.`
}

const resolveGroup = (
  resolution: SectorTemplateModuleResolution,
  source: ModuleRecommendationTemplateSource,
  seenModuleCodes: Set<string>
): { group: ModuleRecommendationGroup; reason: ModuleRecommendationReason } => {
  if(seenModuleCodes.has(resolution.moduleCode)){
    return {
      group: MODULE_RECOMMENDATION_GROUPS.UNSUPPORTED,
      reason: MODULE_RECOMMENDATION_REASONS.DUPLICATE_TEMPLATE_MODULE
    }
  }

  if(!isSectorTemplateAssignableModuleCode(resolution.moduleCode)){
    return {
      group: MODULE_RECOMMENDATION_GROUPS.UNSUPPORTED,
      reason: MODULE_RECOMMENDATION_REASONS.UNSUPPORTED_MODULE
    }
  }

  if(!resolution.module){
    return {
      group: MODULE_RECOMMENDATION_GROUPS.FUTURE,
      reason: MODULE_RECOMMENDATION_REASONS.FUTURE_MODULE
    }
  }

  if(!isSupportedRecommendationModule(resolution.module)){
    return {
      group: MODULE_RECOMMENDATION_GROUPS.UNSUPPORTED,
      reason: MODULE_RECOMMENDATION_REASONS.UNSUPPORTED_MODULE
    }
  }

  return source === MODULE_RECOMMENDATION_TEMPLATE_SOURCES.DEFAULT
    ? {
      group: MODULE_RECOMMENDATION_GROUPS.RECOMMENDED,
      reason: MODULE_RECOMMENDATION_REASONS.SECTOR_DEFAULT
    }
    : {
      group: MODULE_RECOMMENDATION_GROUPS.OPTIONAL,
      reason: MODULE_RECOMMENDATION_REASONS.SECTOR_OPTIONAL
    }
}

const createPlanItem = (
  resolution: SectorTemplateModuleResolution,
  source: ModuleRecommendationTemplateSource,
  index: number,
  seenModuleCodes: Set<string>
): ModuleRecommendationPlanItem => {
  const { group, reason } = resolveGroup(resolution, source, seenModuleCodes)
  seenModuleCodes.add(resolution.moduleCode)

  return {
    moduleCode: resolution.moduleCode,
    moduleId: resolution.module?.id || '',
    name: resolution.module?.name || createFallbackModuleName(resolution.moduleCode),
    description: resolution.module?.description || createFallbackModuleDescription(resolution.moduleCode),
    icon: resolution.module?.icon || createFallbackModuleIcon(resolution.moduleCode),
    group,
    source,
    reason,
    order: GROUP_ORDER[group] * 1000 + SOURCE_ORDER[source] * 100 + index,
    module: resolution.module,
    isRegistryBacked: Boolean(resolution.module)
  }
}

const sortPlanItems = (items: ModuleRecommendationPlanItem[]) => {
  return [...items].sort((first, second) => (
    first.order - second.order
    || first.moduleCode.localeCompare(second.moduleCode, 'tr')
  ))
}

const createGroup = (
  group: ModuleRecommendationGroup,
  modules: ModuleRecommendationPlanItem[]
): ModuleRecommendationPlanGroup => ({
  group,
  order: GROUP_ORDER[group],
  modules: sortPlanItems(modules.filter(module => module.group === group))
})

const createPlanItems = (
  defaultModules: SectorTemplateModuleResolution[],
  optionalModules: SectorTemplateModuleResolution[]
) => {
  const seenModuleCodes = new Set<string>()

  return [
    ...defaultModules.map((module, index) => createPlanItem(
      module,
      MODULE_RECOMMENDATION_TEMPLATE_SOURCES.DEFAULT,
      index,
      seenModuleCodes
    )),
    ...optionalModules.map((module, index) => createPlanItem(
      module,
      MODULE_RECOMMENDATION_TEMPLATE_SOURCES.OPTIONAL,
      index,
      seenModuleCodes
    ))
  ]
}

export const createModuleRecommendationPlan = (sectorIdOrCode: string): ModuleRecommendationPlan => {
  const template = getSectorTemplate(sectorIdOrCode)
  const resolution = getSectorTemplateModuleResolution(template.sectorId)
  const allModules = sortPlanItems(createPlanItems(resolution.defaultModules, resolution.optionalModules))
  const recommendedModules = sortPlanItems(allModules.filter(module => module.group === MODULE_RECOMMENDATION_GROUPS.RECOMMENDED))
  const optionalModules = sortPlanItems(allModules.filter(module => module.group === MODULE_RECOMMENDATION_GROUPS.OPTIONAL))
  const futureModules = sortPlanItems(allModules.filter(module => module.group === MODULE_RECOMMENDATION_GROUPS.FUTURE))
  const unsupportedModules = sortPlanItems(allModules.filter(module => module.group === MODULE_RECOMMENDATION_GROUPS.UNSUPPORTED))

  return {
    sectorId: template.sectorId,
    template,
    recommendedModules,
    optionalModules,
    futureModules,
    unsupportedModules,
    orderedGroups: [
      createGroup(MODULE_RECOMMENDATION_GROUPS.RECOMMENDED, allModules),
      createGroup(MODULE_RECOMMENDATION_GROUPS.OPTIONAL, allModules),
      createGroup(MODULE_RECOMMENDATION_GROUPS.FUTURE, allModules),
      createGroup(MODULE_RECOMMENDATION_GROUPS.UNSUPPORTED, allModules)
    ],
    allModules
  }
}

export const getModuleRecommendationPlan = createModuleRecommendationPlan

export const getRecommendedModules = (sectorIdOrCode: string): ModuleRecommendationPlanItem[] => {
  return createModuleRecommendationPlan(sectorIdOrCode).recommendedModules
}

export const getOptionalRecommendationModules = (sectorIdOrCode: string): ModuleRecommendationPlanItem[] => {
  return createModuleRecommendationPlan(sectorIdOrCode).optionalModules
}

export const getFutureRecommendationModules = (sectorIdOrCode: string): ModuleRecommendationPlanItem[] => {
  return createModuleRecommendationPlan(sectorIdOrCode).futureModules
}

export const getUnsupportedRecommendationModules = (sectorIdOrCode: string): ModuleRecommendationPlanItem[] => {
  return createModuleRecommendationPlan(sectorIdOrCode).unsupportedModules
}
