import {
  getActiveWorkspaceModules,
  type WorkspaceModuleLifecycleAction
} from './workspace-module-lifecycle.service'
import {
  getBusinessWorkspaceModuleByCode,
  type BusinessWorkspaceModule
} from '../modules/business-workspace.registry'
import type { WorkspaceModuleMenuItem } from '../modules/module-registry.types'
import { getModuleDependencyRule } from '../modules/module-dependency.registry'
import type { ModuleCode } from '../modules/module-code.registry'
import type {
  BusinessWorkspaceNavKey,
  BusinessWorkspaceRoute
} from '../navigation/app-navigation.types'

export type ModuleDependencyRelation = 'required' | 'recommended' | 'optional' | 'direct'

export type ModuleDependencyInfo = {
  moduleCode: string
  moduleName: string
  relation: ModuleDependencyRelation
  critical: boolean
}

export type ModuleInstallationExperiencePreview = {
  moduleId: string
  moduleName: string
  description: string
  features: string[]
  subcomponents: string[]
  workspaces: string[]
  menus: string[]
  dependencies: ModuleDependencyInfo[]
  dependencyGraphLines: string[]
  monthlyFeeLabel: string
  trialLabel: string
  estimatedDurationLabel: string
}

export type ModuleUninstallImpactItem = ModuleDependencyInfo & {
  reason: string
}

export type ModuleUninstallImpactAnalysis = {
  moduleId: string
  moduleName: string
  affectedModules: ModuleUninstallImpactItem[]
  unavailableScreens: string[]
  preservedData: string[]
  deletedCache: string[]
  reinstallableLabel: string
  blocked: boolean
  dependencyGraphLines: string[]
}

export type ModuleLifecycleProgressStep = {
  id: string
  label: string
  weight: number
}

const flattenMenuItems = (
  items: WorkspaceModuleMenuItem<BusinessWorkspaceRoute, BusinessWorkspaceNavKey>[]
): WorkspaceModuleMenuItem<BusinessWorkspaceRoute, BusinessWorkspaceNavKey>[] => (
  items.flatMap(item => [
    item,
    ...flattenMenuItems(item.children || [])
  ])
)

const unique = (items: string[]) => Array.from(new Set(items.filter(Boolean)))

const relationOrder: Record<ModuleDependencyRelation, number> = {
  required: 10,
  direct: 20,
  recommended: 30,
  optional: 40
}

const relationLabels: Record<ModuleDependencyRelation, string> = {
  required: 'Zorunlu',
  direct: 'Doğrudan',
  recommended: 'Önerilen',
  optional: 'Opsiyonel'
}

const getModuleNameForCode = (moduleCode: string) => (
  getBusinessWorkspaceModuleByCode(moduleCode)?.name
  || moduleCode
    .split('-')
    .filter(Boolean)
    .map(part => `${part.charAt(0).toLocaleUpperCase('tr-TR')}${part.slice(1)}`)
    .join(' ')
)

const upsertDependency = (
  map: Map<string, ModuleDependencyInfo>,
  moduleCode: string,
  relation: ModuleDependencyRelation
) => {
  if(!moduleCode) return
  const existing = map.get(moduleCode)
  const critical = relation === 'required' || relation === 'direct'

  if(existing){
    map.set(moduleCode, {
      ...existing,
      relation: relationOrder[relation] < relationOrder[existing.relation] ? relation : existing.relation,
      critical: existing.critical || critical
    })
    return
  }

  map.set(moduleCode, {
    moduleCode,
    moduleName: getModuleNameForCode(moduleCode),
    relation,
    critical
  })
}

const sortDependencies = <TItem extends ModuleDependencyInfo>(items: TItem[]) => (
  [...items].sort((first, second) => (
    relationOrder[first.relation] - relationOrder[second.relation]
    || first.moduleName.localeCompare(second.moduleName, 'tr')
  ))
)

export const getModuleDependencies = (module: BusinessWorkspaceModule): ModuleDependencyInfo[] => {
  const dependencies = new Map<string, ModuleDependencyInfo>()
  const rule = getModuleDependencyRule(module.code as ModuleCode)

  module.dependencies.forEach(moduleCode => upsertDependency(dependencies, moduleCode, 'direct'))
  rule?.requires.forEach(moduleCode => upsertDependency(dependencies, moduleCode, 'required'))
  rule?.recommended.forEach(moduleCode => upsertDependency(dependencies, moduleCode, 'recommended'))
  rule?.optionalDependencies.forEach(moduleCode => upsertDependency(dependencies, moduleCode, 'optional'))

  dependencies.delete(module.code)
  return sortDependencies(Array.from(dependencies.values()))
}

const getWorkspaceNames = (module: BusinessWorkspaceModule) => {
  const workspaces = [
    module.menuItems.length ? 'Çalışma Alanı Menüsü' : '',
    module.dashboardWidgets?.length ? 'Kontrol paneli' : '',
    module.permissions.length ? 'Yetkilendirme' : '',
    module.provisionManifest.settings.length ? 'Modül Ayarları' : '',
    module.isIntegrationModule ? 'Entegrasyon Merkezi' : '',
    'Okuma Modeli önbelleği'
  ]

  return unique(workspaces)
}

const getFeatureNames = (module: BusinessWorkspaceModule) => {
  const menus = flattenMenuItems(module.menuItems).map(item => item.label)
  const widgets = (module.dashboardWidgets || []).map(widget => widget.title)
  return unique([
    module.description,
    ...menus.slice(0, 4).map(label => `${label} ekranı`),
    ...widgets.slice(0, 3).map(title => `${title} kontrol paneli özeti`),
    module.permissions.length ? 'Rol ve yetki entegrasyonu' : ''
  ]).slice(0, 8)
}

const getSubcomponents = (module: BusinessWorkspaceModule) => {
  const flatMenus = flattenMenuItems(module.menuItems)
  const manifest = module.provisionManifest
  return [
    `${flatMenus.length} menü kaydı`,
    `${module.permissions.length} yetki kaydı`,
    `${module.dashboardWidgets?.length || 0} kontrol paneli bileşeni`,
    `${manifest.emptyStates.length} boş durum tanımı`,
    `${manifest.settings.length} varsayılan ayar`,
    'Okuma Modeli hazırlığı',
    'Varsayılan veri senaryoları'
  ]
}

const formatPrice = (module: BusinessWorkspaceModule) => {
  const pricing = module.pricing
  if(!pricing || pricing.model === 'included') return 'Paket kapsamında'
  if(pricing.model === 'free') return 'Ücretsiz'
  if(pricing.monthlyPrice){
    return `${pricing.monthlyPrice.toLocaleString('tr-TR')} ${pricing.currency || 'TRY'} / ay`
  }
  if(pricing.yearlyPrice){
    return `${pricing.yearlyPrice.toLocaleString('tr-TR')} ${pricing.currency || 'TRY'} / yıl`
  }
  if(pricing.model === 'usage-based') return 'Kullanıma göre'
  return 'Teklif ile'
}

const formatTrial = (module: BusinessWorkspaceModule) => {
  const trialDays = module.pricing?.trialDays || 0
  return trialDays > 0 ? `${trialDays} gün deneme` : 'Deneme süresi yok'
}

const getEstimatedDuration = (module: BusinessWorkspaceModule) => {
  const flatMenus = flattenMenuItems(module.menuItems).length
  const widgets = module.dashboardWidgets?.length || 0
  const seconds = Math.min(95, Math.max(18, 16 + flatMenus * 3 + widgets * 4 + module.permissions.length))
  return `Yaklaşık ${seconds} saniye`
}

export const createModuleInstallationExperiencePreview = (
  module: BusinessWorkspaceModule
): ModuleInstallationExperiencePreview => {
  const dependencies = getModuleDependencies(module)
  return {
    moduleId: module.id,
    moduleName: module.name,
    description: module.description,
    features: getFeatureNames(module),
    subcomponents: getSubcomponents(module),
    workspaces: getWorkspaceNames(module),
    menus: flattenMenuItems(module.menuItems).map(item => item.label),
    dependencies,
    dependencyGraphLines: [
      module.name,
      ...dependencies.map(item => `├── ${item.moduleName} (${relationLabels[item.relation]})`)
    ],
    monthlyFeeLabel: formatPrice(module),
    trialLabel: formatTrial(module),
    estimatedDurationLabel: getEstimatedDuration(module)
  }
}

export const createModuleUninstallImpactAnalysis = (
  companyId: string,
  module: BusinessWorkspaceModule
): ModuleUninstallImpactAnalysis => {
  const affectedModules = getActiveWorkspaceModules(companyId)
    .filter(activeModule => activeModule.id !== module.id)
    .flatMap((activeModule): ModuleUninstallImpactItem[] => {
      const dependencies = getModuleDependencies(activeModule)
      const dependency = dependencies.find(item => item.moduleCode === module.code)
      if(!dependency) return []

      return [{
        ...dependency,
        moduleCode: activeModule.code,
        moduleName: activeModule.name,
        reason: `${activeModule.name}, ${module.name} modülünü ${relationLabels[dependency.relation].toLocaleLowerCase('tr-TR')} bağımlılık olarak kullanıyor.`
      }]
    })

  const flatMenus = flattenMenuItems(module.menuItems)
  const unavailableScreens = flatMenus
    .filter(item => item.route)
    .map(item => item.label)

  const preservedData = [
    'Modül işlem kayıtları',
    'Firma ve şube verileri',
    'Audit geçmişi',
    'Kurulum geçmişi',
    'Lisans ve abonelik bilgileri'
  ]

  const deletedCache = [
    'Menü görünürlük önbelleği',
    'Kontrol paneli bileşen önbelleği',
    'Okuma Modeli geçici kayıtları',
    'Kurulum progress oturumu'
  ]

  const sortedAffectedModules = sortDependencies(affectedModules)
  return {
    moduleId: module.id,
    moduleName: module.name,
    affectedModules: sortedAffectedModules,
    unavailableScreens,
    preservedData,
    deletedCache,
    reinstallableLabel: module.marketplace?.isMarketplaceReady === false ? 'Yeniden kurulum şu anda kapalı' : 'Marketplace üzerinden yeniden kurulabilir',
    blocked: sortedAffectedModules.some(item => item.critical),
    dependencyGraphLines: [
      module.name,
      ...sortedAffectedModules.map(item => `├── ${item.moduleName} (${relationLabels[item.relation]})`)
    ]
  }
}

export const getModuleLifecycleProgressSteps = (
  action: WorkspaceModuleLifecycleAction | 'export'
): ModuleLifecycleProgressStep[] => {
  if(action === 'detach-from-workspace'){
    return [
      { id: 'impact', label: 'Etki analizi doğrulanıyor', weight: 16 },
      { id: 'menu', label: 'Menü katkıları kaldırılıyor', weight: 18 },
      { id: 'permissions', label: 'Yetkilendirme güncelleniyor', weight: 16 },
      { id: 'dashboard', label: 'Kontrol paneli bağlantıları temizleniyor', weight: 18 },
      { id: 'cache', label: 'Önbellek kayıtları temizleniyor', weight: 16 },
      { id: 'data', label: 'Veriler korunuyor', weight: 16 }
    ]
  }

  if(action === 'suspend'){
    return [
      { id: 'state', label: 'Modül durumu pasife alınıyor', weight: 28 },
      { id: 'menu', label: 'Menü görünürlüğü güncelleniyor', weight: 24 },
      { id: 'dashboard', label: 'Kontrol paneli seçenekleri kapatılıyor', weight: 24 },
      { id: 'audit', label: 'Audit kaydı oluşturuluyor', weight: 24 }
    ]
  }

  if(action === 'activate' || action === 'reactivate'){
    return [
      { id: 'license', label: 'Lisans ve erişim kontrol ediliyor', weight: 24 },
      { id: 'menu', label: 'Menü kayıtları etkinleştiriliyor', weight: 26 },
      { id: 'dashboard', label: 'Kontrol paneli bağlantıları hazırlanıyor', weight: 26 },
      { id: 'audit', label: 'Audit kaydı oluşturuluyor', weight: 24 }
    ]
  }

  if(action === 'export'){
    return [
      { id: 'filter', label: 'Filtrelenmiş liste hazırlanıyor', weight: 30 },
      { id: 'file', label: 'Çıktı dosyası oluşturuluyor', weight: 40 },
      { id: 'history', label: 'İşlem bildirimi hazırlanıyor', weight: 30 }
    ]
  }

  return [
    { id: 'workspace', label: 'Çalışma alanı hazırlanıyor', weight: 16 },
    { id: 'menu', label: 'Menü kayıtları oluşturuluyor', weight: 18 },
    { id: 'permissions', label: 'Yetkilendirme hazırlanıyor', weight: 16 },
    { id: 'dashboard', label: 'Kontrol paneli oluşturuluyor', weight: 18 },
    { id: 'read-model', label: 'Okuma Modeli hazırlanıyor', weight: 16 },
    { id: 'seed', label: 'Varsayılan veriler yükleniyor', weight: 16 }
  ]
}
