import {
  SECTOR_TEMPLATE_MODULE_CODES,
  WORKSPACE_MODULE_CODES,
  type ModuleCode
} from '../modules/module-code.registry'
import {
  createModuleInstallationPlan,
  MODULE_DEPENDENCY_RELATION_TYPES,
  type ModuleDependencyPlanItem,
  type ModuleInstallationPlan
} from '../modules/module-dependency.service'
import {
  createModuleRecommendationPlan,
  MODULE_RECOMMENDATION_GROUPS,
  MODULE_RECOMMENDATION_TEMPLATE_SOURCES,
  type ModuleRecommendationGroup,
  type ModuleRecommendationPlan,
  type ModuleRecommendationPlanGroup,
  type ModuleRecommendationPlanItem
} from '../modules/module-recommendation.service'
import { DEFAULT_SECTOR_ID } from '../sector/sector.registry'

export const BUSINESS_SETUP_MODULE_CATEGORIES = {
  OPERATION: 'Operasyon',
  FINANCE: 'Finans',
  CRM: 'CRM',
  PERSONNEL: 'Personel',
  ANALYSIS: 'Analiz',
  SYSTEM: 'Sistem',
  GENERAL: 'Genel'
} as const

export type BusinessSetupModuleCategory =
  typeof BUSINESS_SETUP_MODULE_CATEGORIES[keyof typeof BUSINESS_SETUP_MODULE_CATEGORIES]

export type BusinessSetupModuleGroup = {
  category: BusinessSetupModuleCategory
  modules: ModuleRecommendationPlanItem[]
}

export type BusinessSetupWizardPlan = {
  sectorId: string
  recommendationPlan: ModuleRecommendationPlan
  selectedRecommendationPlan: ModuleRecommendationPlan
  installationPlan: ModuleInstallationPlan
  recommendedModules: ModuleRecommendationPlanItem[]
  futureRecommendedModules: ModuleRecommendationPlanItem[]
  optionalModules: ModuleRecommendationPlanItem[]
  futureOptionalModules: ModuleRecommendationPlanItem[]
  unsupportedModules: ModuleRecommendationPlanItem[]
  requiredDependencyModules: ModuleDependencyPlanItem[]
  groupedOptionalModules: BusinessSetupModuleGroup[]
}

export type CreateBusinessSetupWizardPlanInput = {
  sectorIdOrCode?: string
  selectedRecommendedModuleCodes?: readonly string[]
  selectedOptionalModuleCodes?: readonly string[]
}

const MODULE_CATEGORY_BY_CODE: Partial<Record<ModuleCode, BusinessSetupModuleCategory>> = {
  [WORKSPACE_MODULE_CODES.ADISYON]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [WORKSPACE_MODULE_CODES.QR_MENU]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [WORKSPACE_MODULE_CODES.STOCK]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [WORKSPACE_MODULE_CODES.RECIPE]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [WORKSPACE_MODULE_CODES.CURRENT]: BUSINESS_SETUP_MODULE_CATEGORIES.FINANCE,
  [WORKSPACE_MODULE_CODES.CREDIT]: BUSINESS_SETUP_MODULE_CATEGORIES.FINANCE,
  [WORKSPACE_MODULE_CODES.FINANCE]: BUSINESS_SETUP_MODULE_CATEGORIES.FINANCE,
  [WORKSPACE_MODULE_CODES.PERSONNEL]: BUSINESS_SETUP_MODULE_CATEGORIES.PERSONNEL,
  [WORKSPACE_MODULE_CODES.MULTI_BRANCH]: BUSINESS_SETUP_MODULE_CATEGORIES.SYSTEM,
  [WORKSPACE_MODULE_CODES.MANAGER_ALERTS]: BUSINESS_SETUP_MODULE_CATEGORIES.ANALYSIS,
  [SECTOR_TEMPLATE_MODULE_CODES.PRODUCT]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [SECTOR_TEMPLATE_MODULE_CODES.ORDER]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [SECTOR_TEMPLATE_MODULE_CODES.WAREHOUSE]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [SECTOR_TEMPLATE_MODULE_CODES.PRODUCTION]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [SECTOR_TEMPLATE_MODULE_CODES.PURCHASE]: BUSINESS_SETUP_MODULE_CATEGORIES.FINANCE,
  [SECTOR_TEMPLATE_MODULE_CODES.CRM]: BUSINESS_SETUP_MODULE_CATEGORIES.CRM,
  [SECTOR_TEMPLATE_MODULE_CODES.CAMPAIGN]: BUSINESS_SETUP_MODULE_CATEGORIES.CRM,
  [SECTOR_TEMPLATE_MODULE_CODES.LOYALTY]: BUSINESS_SETUP_MODULE_CATEGORIES.CRM,
  [SECTOR_TEMPLATE_MODULE_CODES.COURIER]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [SECTOR_TEMPLATE_MODULE_CODES.QUALITY]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [SECTOR_TEMPLATE_MODULE_CODES.MAINTENANCE]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [SECTOR_TEMPLATE_MODULE_CODES.APPOINTMENT]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [SECTOR_TEMPLATE_MODULE_CODES.CUSTOMER]: BUSINESS_SETUP_MODULE_CATEGORIES.CRM,
  [SECTOR_TEMPLATE_MODULE_CODES.CASH]: BUSINESS_SETUP_MODULE_CATEGORIES.FINANCE,
  [SECTOR_TEMPLATE_MODULE_CODES.SMS]: BUSINESS_SETUP_MODULE_CATEGORIES.CRM,
  [SECTOR_TEMPLATE_MODULE_CODES.RESERVATION]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION,
  [SECTOR_TEMPLATE_MODULE_CODES.TOURNAMENT]: BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION
}

const GROUP_ORDER: Record<ModuleRecommendationGroup, number> = {
  [MODULE_RECOMMENDATION_GROUPS.RECOMMENDED]: 10,
  [MODULE_RECOMMENDATION_GROUPS.OPTIONAL]: 20,
  [MODULE_RECOMMENDATION_GROUPS.FUTURE]: 30,
  [MODULE_RECOMMENDATION_GROUPS.UNSUPPORTED]: 40
}

const CATEGORY_ORDER: Record<BusinessSetupModuleCategory, number> = {
  [BUSINESS_SETUP_MODULE_CATEGORIES.OPERATION]: 10,
  [BUSINESS_SETUP_MODULE_CATEGORIES.FINANCE]: 20,
  [BUSINESS_SETUP_MODULE_CATEGORIES.CRM]: 30,
  [BUSINESS_SETUP_MODULE_CATEGORIES.PERSONNEL]: 40,
  [BUSINESS_SETUP_MODULE_CATEGORIES.ANALYSIS]: 50,
  [BUSINESS_SETUP_MODULE_CATEGORIES.SYSTEM]: 60,
  [BUSINESS_SETUP_MODULE_CATEGORIES.GENERAL]: 70
}

const sortRecommendationItems = (items: ModuleRecommendationPlanItem[]) => (
  [...items].sort((first, second) => (
    first.order - second.order
    || first.moduleCode.localeCompare(second.moduleCode, 'tr-TR')
  ))
)

const createGroup = (
  group: ModuleRecommendationGroup,
  modules: ModuleRecommendationPlanItem[]
): ModuleRecommendationPlanGroup => ({
  group,
  order: GROUP_ORDER[group],
  modules: sortRecommendationItems(modules.filter(module => module.group === group))
})

const uniquePlanItems = (items: ModuleRecommendationPlanItem[]) => {
  const seen = new Set<string>()
  return items.filter(item => {
    if(seen.has(item.moduleCode)) return false
    seen.add(item.moduleCode)
    return true
  })
}

const createSelectedRecommendationPlan = (
  plan: ModuleRecommendationPlan,
  selectedRecommendedModuleCodes: readonly string[],
  selectedOptionalModuleCodes: readonly string[]
): ModuleRecommendationPlan => {
  const selectedCodes = new Set<string>([
    ...selectedRecommendedModuleCodes,
    ...selectedOptionalModuleCodes
  ])
  const selectedItems = plan.allModules.filter(item => selectedCodes.has(item.moduleCode))
  const defaultFutureItems = plan.futureModules.filter(item => item.source === MODULE_RECOMMENDATION_TEMPLATE_SOURCES.DEFAULT)
  const defaultUnsupportedItems = plan.unsupportedModules.filter(item => item.source === MODULE_RECOMMENDATION_TEMPLATE_SOURCES.DEFAULT)
  const allModules = sortRecommendationItems(uniquePlanItems([
    ...selectedItems,
    ...defaultFutureItems,
    ...defaultUnsupportedItems
  ]))
  const recommendedModules = sortRecommendationItems(allModules.filter(module => module.group === MODULE_RECOMMENDATION_GROUPS.RECOMMENDED))
  const optionalModules = sortRecommendationItems(allModules.filter(module => module.group === MODULE_RECOMMENDATION_GROUPS.OPTIONAL))
  const futureModules = sortRecommendationItems(allModules.filter(module => module.group === MODULE_RECOMMENDATION_GROUPS.FUTURE))
  const unsupportedModules = sortRecommendationItems(allModules.filter(module => module.group === MODULE_RECOMMENDATION_GROUPS.UNSUPPORTED))

  return {
    ...plan,
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

const groupOptionalModules = (modules: ModuleRecommendationPlanItem[]): BusinessSetupModuleGroup[] => {
  const groups = modules.reduce<Map<BusinessSetupModuleCategory, ModuleRecommendationPlanItem[]>>((acc, module) => {
    const category = getBusinessSetupModuleCategory(module.moduleCode)
    acc.set(category, [...(acc.get(category) || []), module])
    return acc
  }, new Map())

  return Array.from(groups.entries())
    .map(([category, groupModules]) => ({
      category,
      modules: sortRecommendationItems(groupModules)
    }))
    .sort((first, second) => (
      CATEGORY_ORDER[first.category] - CATEGORY_ORDER[second.category]
      || first.category.localeCompare(second.category, 'tr-TR')
    ))
}

export const getBusinessSetupModuleCategory = (moduleCode: string): BusinessSetupModuleCategory => {
  return MODULE_CATEGORY_BY_CODE[moduleCode as ModuleCode] || BUSINESS_SETUP_MODULE_CATEGORIES.GENERAL
}

export const getDefaultRecommendedModuleCodes = (sectorIdOrCode = DEFAULT_SECTOR_ID): string[] => {
  return createModuleRecommendationPlan(sectorIdOrCode)
    .recommendedModules
    .map(module => module.moduleCode)
}

export const createBusinessSetupWizardPlan = ({
  sectorIdOrCode = DEFAULT_SECTOR_ID,
  selectedRecommendedModuleCodes,
  selectedOptionalModuleCodes = []
}: CreateBusinessSetupWizardPlanInput = {}): BusinessSetupWizardPlan => {
  const recommendationPlan = createModuleRecommendationPlan(sectorIdOrCode)
  const recommendedModuleCodes = selectedRecommendedModuleCodes
    || recommendationPlan.recommendedModules.map(module => module.moduleCode)
  const selectedRecommendationPlan = createSelectedRecommendationPlan(
    recommendationPlan,
    recommendedModuleCodes,
    selectedOptionalModuleCodes
  )
  const installationPlan = createModuleInstallationPlan(selectedRecommendationPlan)
  const futureRecommendedModules = recommendationPlan.futureModules
    .filter(module => module.source === MODULE_RECOMMENDATION_TEMPLATE_SOURCES.DEFAULT)
  const futureOptionalModules = recommendationPlan.futureModules
    .filter(module => module.source === MODULE_RECOMMENDATION_TEMPLATE_SOURCES.OPTIONAL)

  return {
    sectorId: recommendationPlan.sectorId,
    recommendationPlan,
    selectedRecommendationPlan,
    installationPlan,
    recommendedModules: recommendationPlan.recommendedModules,
    futureRecommendedModules: sortRecommendationItems(futureRecommendedModules),
    optionalModules: recommendationPlan.optionalModules,
    futureOptionalModules: sortRecommendationItems(futureOptionalModules),
    unsupportedModules: recommendationPlan.unsupportedModules,
    requiredDependencyModules: installationPlan.addedByDependency
      .filter(module => module.relation === MODULE_DEPENDENCY_RELATION_TYPES.REQUIRED),
    groupedOptionalModules: groupOptionalModules(recommendationPlan.optionalModules)
  }
}
