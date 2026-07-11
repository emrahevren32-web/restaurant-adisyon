import {
  getBusinessWorkspaceModuleByCode,
  type BusinessWorkspaceModule
} from './business-workspace.registry'
import {
  getSectorTemplateModuleMetadata,
  isSectorTemplateAssignableModuleCode,
  type ModuleCode
} from './module-code.registry'
import {
  MODULE_DEPENDENCY_REGISTRY,
  getModuleDependencyRule
} from './module-dependency.registry'
import {
  MODULE_DEPENDENCY_ISSUE_TYPES,
  MODULE_DEPENDENCY_RELATION_TYPES,
  type ModuleDependencyIssue,
  type ModuleDependencyPlanItem,
  type ModuleDependencyRelationType,
  type ModuleDependencyRule,
  type ModuleInstallationPlan
} from './module-dependency.types'
import {
  MODULE_RECOMMENDATION_GROUPS,
  createModuleRecommendationPlan
} from './module-recommendation.service'
import type {
  ModuleRecommendationPlan,
  ModuleRecommendationPlanItem
} from './module-recommendation.types'
import { WORKSPACE_MODULE_TYPES } from './module-registry.types'

export type {
  ModuleDependencyIssue,
  ModuleDependencyPlanItem,
  ModuleDependencyRelationType,
  ModuleDependencyRule,
  ModuleInstallationPlan
} from './module-dependency.types'

export {
  MODULE_DEPENDENCY_ISSUE_TYPES,
  MODULE_DEPENDENCY_RELATION_TYPES
} from './module-dependency.types'

export { MODULE_DEPENDENCY_REGISTRY, getModuleDependencyRule } from './module-dependency.registry'

const RELATION_ORDER: Record<ModuleDependencyRelationType, number> = {
  [MODULE_DEPENDENCY_RELATION_TYPES.RECOMMENDATION]: 10,
  [MODULE_DEPENDENCY_RELATION_TYPES.REQUIRED]: 20,
  [MODULE_DEPENDENCY_RELATION_TYPES.RECOMMENDED]: 30,
  [MODULE_DEPENDENCY_RELATION_TYPES.OPTIONAL]: 40
}

const isRegistryInstallableModule = (module: BusinessWorkspaceModule | null) => {
  return Boolean(module && (
    module.moduleType === WORKSPACE_MODULE_TYPES.BUSINESS
    || module.moduleType === WORKSPACE_MODULE_TYPES.INTEGRATION
  ))
}

const uniqueCodes = (items: readonly ModuleCode[]) => Array.from(new Set(items))

const createDisplayName = (moduleCode: ModuleCode, module: BusinessWorkspaceModule | null) => {
  if(module) return module.name

  const metadata = isSectorTemplateAssignableModuleCode(moduleCode)
    ? getSectorTemplateModuleMetadata(moduleCode)
    : null

  if(metadata) return metadata.name

  return moduleCode
    .split('-')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toLocaleUpperCase('tr-TR')}${part.slice(1)}`)
    .join(' ')
}

const createDisplayIcon = (moduleCode: ModuleCode, module: BusinessWorkspaceModule | null) => {
  if(module) return module.icon

  const metadata = isSectorTemplateAssignableModuleCode(moduleCode)
    ? getSectorTemplateModuleMetadata(moduleCode)
    : null

  return metadata?.icon || moduleCode.replace(/[^a-z0-9]/gi, '').slice(0, 2).toLocaleUpperCase('tr-TR') || 'MD'
}

const createDisplayDescription = (moduleCode: ModuleCode, module: BusinessWorkspaceModule | null) => {
  if(module) return module.description

  const metadata = isSectorTemplateAssignableModuleCode(moduleCode)
    ? getSectorTemplateModuleMetadata(moduleCode)
    : null

  return metadata?.description || `${createDisplayName(moduleCode, module)} modülü henüz Module Registry içinde tanımlı değildir.`
}

const isFutureModule = (moduleCode: ModuleCode, module: BusinessWorkspaceModule | null) => (
  !module && isSectorTemplateAssignableModuleCode(moduleCode) && Boolean(getSectorTemplateModuleMetadata(moduleCode))
)

const isUnsupportedModule = (
  moduleCode: ModuleCode,
  module: BusinessWorkspaceModule | null,
  recommendationItem?: ModuleRecommendationPlanItem
) => {
  if(recommendationItem?.group === MODULE_RECOMMENDATION_GROUPS.UNSUPPORTED) return true
  if(module) return !isRegistryInstallableModule(module)
  return !isFutureModule(moduleCode, module)
}

const sortRecommendationItems = (items: ModuleRecommendationPlanItem[]) => {
  return [...items].sort((first, second) => (
    first.order - second.order
    || first.moduleCode.localeCompare(second.moduleCode, 'tr')
  ))
}

const sortPlanItems = (items: ModuleDependencyPlanItem[]) => {
  return [...items].sort((first, second) => (
    first.order - second.order
    || first.moduleCode.localeCompare(second.moduleCode, 'tr')
  ))
}

const sortIssues = (items: ModuleDependencyIssue[]) => {
  return [...items].sort((first, second) => (
    first.moduleCode.localeCompare(second.moduleCode, 'tr')
    || String(first.relatedModuleCode || '').localeCompare(String(second.relatedModuleCode || ''), 'tr')
    || first.type.localeCompare(second.type, 'tr')
  ))
}

const createIssue = (
  type: ModuleDependencyIssue['type'],
  moduleCode: ModuleCode,
  relatedModuleCode: ModuleCode | undefined,
  dependencyPath: ModuleCode[],
  message: string
): ModuleDependencyIssue => ({
  type,
  moduleCode,
  relatedModuleCode,
  dependencyPath: [...dependencyPath],
  message
})

export const createModuleInstallationPlan = (
  recommendationPlan: ModuleRecommendationPlan
): ModuleInstallationPlan => {
  const itemsByCode = new Map<ModuleCode, ModuleDependencyPlanItem>()
  const expandedModules = new Set<ModuleCode>()
  const issues: ModuleDependencyIssue[] = []
  const missingModules: ModuleDependencyIssue[] = []
  const conflictingModules: ModuleDependencyIssue[] = []
  const circularDependencies: ModuleDependencyIssue[] = []
  const issueKeys = new Set<string>()
  let nextOrder = 10

  const addIssue = (issue: ModuleDependencyIssue, targetList?: ModuleDependencyIssue[]) => {
    const key = `${issue.type}:${issue.moduleCode}:${issue.relatedModuleCode || ''}:${issue.dependencyPath.join('>')}`
    if(issueKeys.has(key)) return
    issueKeys.add(key)
    issues.push(issue)
    targetList?.push(issue)
  }

  const createPlanItem = (
    moduleCode: ModuleCode,
    relation: ModuleDependencyRelationType,
    requestedBy: ModuleCode[],
    dependencyPath: ModuleCode[],
    recommendationItem?: ModuleRecommendationPlanItem
  ): ModuleDependencyPlanItem => {
    const module = recommendationItem?.module || getBusinessWorkspaceModuleByCode(moduleCode) || null
    const isFuture = isFutureModule(moduleCode, module)
    const isUnsupported = isUnsupportedModule(moduleCode, module, recommendationItem)

    return {
      moduleCode,
      moduleId: module?.id || recommendationItem?.moduleId || '',
      name: recommendationItem?.name || createDisplayName(moduleCode, module),
      description: recommendationItem?.description || createDisplayDescription(moduleCode, module),
      icon: recommendationItem?.icon || createDisplayIcon(moduleCode, module),
      module,
      relation,
      recommendationGroup: recommendationItem?.group,
      requestedBy: uniqueCodes(requestedBy),
      dependencyPath: [...dependencyPath],
      order: nextOrder,
      isRegistryBacked: Boolean(module),
      isFuture,
      isUnsupported
    }
  }

  const upsertPlanItem = (
    moduleCode: ModuleCode,
    relation: ModuleDependencyRelationType,
    requestedBy: ModuleCode[],
    dependencyPath: ModuleCode[],
    recommendationItem?: ModuleRecommendationPlanItem
  ) => {
    const existing = itemsByCode.get(moduleCode)

    if(existing){
      const nextRequestedBy = uniqueCodes([...existing.requestedBy, ...requestedBy])
      const shouldPromoteToRecommendation = relation === MODULE_DEPENDENCY_RELATION_TYPES.RECOMMENDATION
        && existing.relation !== MODULE_DEPENDENCY_RELATION_TYPES.RECOMMENDATION

      itemsByCode.set(moduleCode, {
        ...existing,
        relation: shouldPromoteToRecommendation ? relation : existing.relation,
        recommendationGroup: recommendationItem?.group || existing.recommendationGroup,
        requestedBy: nextRequestedBy,
        dependencyPath: existing.dependencyPath.length <= dependencyPath.length ? existing.dependencyPath : dependencyPath
      })
      return itemsByCode.get(moduleCode) as ModuleDependencyPlanItem
    }

    const item = createPlanItem(moduleCode, relation, requestedBy, dependencyPath, recommendationItem)
    itemsByCode.set(moduleCode, item)
    nextOrder += RELATION_ORDER[relation]
    return item
  }

  const recordMissingRequired = (
    moduleCode: ModuleCode,
    requestedBy: ModuleCode,
    dependencyPath: ModuleCode[]
  ) => {
    const module = getBusinessWorkspaceModuleByCode(moduleCode) || null
    if(module) return

    addIssue(createIssue(
      MODULE_DEPENDENCY_ISSUE_TYPES.MISSING_REQUIRED,
      moduleCode,
      requestedBy,
      dependencyPath,
      `${createDisplayName(moduleCode, module)} required dependency olarak isteniyor fakat Module Registry içinde kurulum yapılabilir modül olarak bulunmuyor.`
    ), missingModules)
  }

  const expandModuleDependencies = (moduleCode: ModuleCode, dependencyPath: ModuleCode[]) => {
    if(expandedModules.has(moduleCode)) return
    expandedModules.add(moduleCode)

    const rule = getModuleDependencyRule(moduleCode)
    if(!rule) return

    const processDependency = (
      dependencyCode: ModuleCode,
      relation: ModuleDependencyRelationType
    ) => {
      if(dependencyPath.includes(dependencyCode)){
        const circularPath = [...dependencyPath, dependencyCode]
        const issue = createIssue(
          MODULE_DEPENDENCY_ISSUE_TYPES.CIRCULAR_DEPENDENCY,
          dependencyCode,
          moduleCode,
          circularPath,
          `${dependencyCode} için circular dependency tespit edildi.`
        )
        addIssue(issue, circularDependencies)
        return
      }

      const nextPath = [...dependencyPath, dependencyCode]
      upsertPlanItem(dependencyCode, relation, [moduleCode], nextPath)

      if(relation === MODULE_DEPENDENCY_RELATION_TYPES.REQUIRED){
        recordMissingRequired(dependencyCode, moduleCode, nextPath)
      }

      expandModuleDependencies(dependencyCode, nextPath)
    }

    rule.requires.forEach(dependencyCode => processDependency(
      dependencyCode,
      MODULE_DEPENDENCY_RELATION_TYPES.REQUIRED
    ))
    rule.recommended.forEach(dependencyCode => processDependency(
      dependencyCode,
      MODULE_DEPENDENCY_RELATION_TYPES.RECOMMENDED
    ))
    rule.optionalDependencies.forEach(dependencyCode => processDependency(
      dependencyCode,
      MODULE_DEPENDENCY_RELATION_TYPES.OPTIONAL
    ))
  }

  const initialRecommendationItems = sortRecommendationItems(recommendationPlan.allModules)
  initialRecommendationItems.forEach(item => {
    upsertPlanItem(
      item.moduleCode,
      MODULE_DEPENDENCY_RELATION_TYPES.RECOMMENDATION,
      [],
      [item.moduleCode],
      item
    )
  })

  initialRecommendationItems.forEach(item => {
    expandModuleDependencies(item.moduleCode, [item.moduleCode])
  })

  sortPlanItems(Array.from(itemsByCode.values())).forEach(item => {
    const rule = getModuleDependencyRule(item.moduleCode)
    if(!rule) return

    rule.conflicts.forEach(conflictCode => {
      if(!itemsByCode.has(conflictCode)) return

      addIssue(createIssue(
        MODULE_DEPENDENCY_ISSUE_TYPES.CONFLICT,
        item.moduleCode,
        conflictCode,
        [item.moduleCode, conflictCode],
        `${item.moduleCode} modülü ${conflictCode} modülü ile conflict tanımlıyor.`
      ), conflictingModules)
    })
  })

  const allModules = sortPlanItems(Array.from(itemsByCode.values()))
  const resolvedModules = sortPlanItems(allModules.filter(item => item.isRegistryBacked && !item.isUnsupported))
  const addedByDependency = sortPlanItems(allModules.filter(item => item.relation !== MODULE_DEPENDENCY_RELATION_TYPES.RECOMMENDATION))
  const futureModules = sortPlanItems(allModules.filter(item => item.isFuture))
  const unsupportedModules = sortPlanItems(allModules.filter(item => item.isUnsupported))

  unsupportedModules.forEach(item => {
    addIssue(createIssue(
      MODULE_DEPENDENCY_ISSUE_TYPES.UNSUPPORTED_MODULE,
      item.moduleCode,
      undefined,
      item.dependencyPath,
      `${item.name} dependency plan içinde unsupported olarak işaretlendi.`
    ))
  })

  return {
    sectorId: recommendationPlan.sectorId,
    recommendationPlan,
    resolvedModules,
    addedByDependency,
    missingModules: sortIssues(missingModules),
    conflictingModules: sortIssues(conflictingModules),
    futureModules,
    unsupportedModules,
    circularDependencies: sortIssues(circularDependencies),
    allModules,
    issues: sortIssues(issues)
  }
}

export const createModuleInstallationPlanForSector = (sectorIdOrCode: string): ModuleInstallationPlan => {
  return createModuleInstallationPlan(createModuleRecommendationPlan(sectorIdOrCode))
}

export const getModuleInstallationPlan = createModuleInstallationPlanForSector
export const createModuleDependencyPlan = createModuleInstallationPlan
export const createModuleDependencyPlanForSector = createModuleInstallationPlanForSector
