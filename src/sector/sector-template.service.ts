import {
  getBusinessWorkspaceModuleByCode,
  isBusinessWorkspaceModuleAvailableForSector,
  type BusinessWorkspaceModule
} from '../modules/business-workspace.registry'
import type { SectorTemplateAssignableModuleCode } from '../modules/module-code.registry'
import { DEFAULT_SECTOR_ID, SECTOR_ID_PREFIX, createSectorId } from './sector.registry'
import { SECTOR_TEMPLATE_REGISTRY } from './sector-template.registry'
import type { SectorTemplate, SectorTemplateModuleResolution } from './sector-template.types'

const cloneTemplate = (template: SectorTemplate): SectorTemplate => ({
  ...template,
  defaultModules: [...template.defaultModules],
  optionalModules: [...template.optionalModules]
})

const normalizeSectorTemplateId = (sectorIdOrCode: string) => {
  const value = sectorIdOrCode.trim()
  if(!value) return DEFAULT_SECTOR_ID
  return value.startsWith(SECTOR_ID_PREFIX) ? value : createSectorId(value)
}

const generalBusinessTemplate = () => (
  SECTOR_TEMPLATE_REGISTRY.find(template => template.sectorId === DEFAULT_SECTOR_ID)
  || SECTOR_TEMPLATE_REGISTRY[0]
)

export const getSectorTemplates = () => SECTOR_TEMPLATE_REGISTRY.map(cloneTemplate)

export const getSectorTemplate = (sectorIdOrCode: string): SectorTemplate => {
  const sectorId = normalizeSectorTemplateId(sectorIdOrCode)
  const template = SECTOR_TEMPLATE_REGISTRY.find(item => item.sectorId === sectorId) || generalBusinessTemplate()
  return cloneTemplate(template)
}

export const getDefaultModules = (sectorIdOrCode: string): SectorTemplateAssignableModuleCode[] => {
  return getSectorTemplate(sectorIdOrCode).defaultModules
}

export const getOptionalModules = (sectorIdOrCode: string): SectorTemplateAssignableModuleCode[] => {
  return getSectorTemplate(sectorIdOrCode).optionalModules
}

export const resolveSectorTemplateModules = (
  modules: readonly SectorTemplateAssignableModuleCode[],
  sectorIdOrCode?: string
): SectorTemplateModuleResolution[] => (
  modules.map(moduleCode => {
    const sectorId = sectorIdOrCode ? normalizeSectorTemplateId(sectorIdOrCode) : ''
    const module = getBusinessWorkspaceModuleByCode(moduleCode) || null
    const isAvailableForSector = module ? isBusinessWorkspaceModuleAvailableForSector(module, sectorId) : false

    return {
      moduleCode,
      module: isAvailableForSector ? module : null,
      isRegistered: Boolean(module && isAvailableForSector)
    }
  })
)

const getResolvedWorkspaceModules = (
  modules: readonly SectorTemplateAssignableModuleCode[],
  sectorIdOrCode: string
): BusinessWorkspaceModule[] => (
  resolveSectorTemplateModules(modules, sectorIdOrCode)
    .map(result => result.module)
    .filter(Boolean) as BusinessWorkspaceModule[]
)

export const getDefaultWorkspaceModules = (sectorIdOrCode: string): BusinessWorkspaceModule[] => {
  return getResolvedWorkspaceModules(getDefaultModules(sectorIdOrCode), sectorIdOrCode)
}

export const getOptionalWorkspaceModules = (sectorIdOrCode: string): BusinessWorkspaceModule[] => {
  return getResolvedWorkspaceModules(getOptionalModules(sectorIdOrCode), sectorIdOrCode)
}

export const getSectorTemplateModuleResolution = (sectorIdOrCode: string) => {
  const template = getSectorTemplate(sectorIdOrCode)
  return {
    sectorId: template.sectorId,
    defaultModules: resolveSectorTemplateModules(template.defaultModules, template.sectorId),
    optionalModules: resolveSectorTemplateModules(template.optionalModules, template.sectorId)
  }
}
