import type { BusinessWorkspaceModule } from '../modules/business-workspace.registry'

export type ModuleSetupWizardStep = {
  id: string
  title: string
  description: string
  placeholder?: string
  displayOrder: number
  isRequired: boolean
}

export type ModuleSetupWizardDefinition = {
  moduleCode: string
  title: string
  description: string
  steps: ModuleSetupWizardStep[]
}

export type ModuleSetupWizardSessionStatus =
  | 'active'
  | 'completed'

export type ModuleSetupWizardSession = {
  id: string
  companyId: string
  module: BusinessWorkspaceModule
  definition: ModuleSetupWizardDefinition
  status: ModuleSetupWizardSessionStatus
  startedAt: string
  completedAt?: string
  startedByUserId: string
}
