import type { BusinessWorkspaceModule } from '../modules/business-workspace.registry'
import type { SectorTemplateAssignableModuleCode } from '../modules/module-code.registry'

export type SectorTemplate = {
  sectorId: string
  defaultModules: SectorTemplateAssignableModuleCode[]
  optionalModules: SectorTemplateAssignableModuleCode[]
  description: string
}

export type SectorTemplateModuleResolution = {
  moduleCode: SectorTemplateAssignableModuleCode
  module: BusinessWorkspaceModule | null
  isRegistered: boolean
}
