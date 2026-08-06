import {
  WORKSPACE_MODULE_LIFECYCLE_STATES,
  type WorkspaceModuleLifecycleActionDefinition
} from '../workspace/workspace-module-lifecycle.service'
import type { MarketplaceModule } from './marketplace.types'

export type MarketplaceModuleActionDefinition = WorkspaceModuleLifecycleActionDefinition

export const getMarketplaceModuleActions = (module: MarketplaceModule): MarketplaceModuleActionDefinition[] => {
  if(module.installState === 'COMING_SOON'){
    return [{
      key: 'install',
      label: 'Yakında',
      variant: 'disabled',
      visibleInStates: ['COMING_SOON'],
      disabled: true,
      displayOrder: 10
    }]
  }

  if(module.installState === 'DISABLED'){
    return [{
      key: 'install',
      label: 'Desteklenmiyor',
      variant: 'disabled',
      visibleInStates: ['DISABLED'],
      disabled: true,
      displayOrder: 10
    }]
  }

  if(module.installState === 'INSTALLED' || module.installState === 'CONFIGURED'){
    return [{
      key: 'manage',
      label: 'Yönet',
      variant: 'primary',
      visibleInStates: [module.installState],
      displayOrder: 10
    }, {
      key: 'activate',
      label: 'Aktif Et',
      variant: 'secondary',
      visibleInStates: [module.installState],
      displayOrder: 20
    }]
  }

  if(module.installState === 'ACTIVE'){
    return [{
      key: 'manage',
      label: 'Yönet',
      variant: 'primary',
      visibleInStates: [WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE],
      displayOrder: 10
    }, {
      key: 'suspend',
      label: 'Pasife Al',
      variant: 'warning',
      visibleInStates: [WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE],
      displayOrder: 20
    }, {
      key: 'detach-from-workspace',
      label: "Çalışma Alanından Kaldır",
      variant: 'danger',
      visibleInStates: [WORKSPACE_MODULE_LIFECYCLE_STATES.ACTIVE],
      displayOrder: 30
    }]
  }

  if(module.installState === 'SUSPENDED'){
    return [{
      key: 'manage',
      label: 'Yönet',
      variant: 'secondary',
      visibleInStates: [WORKSPACE_MODULE_LIFECYCLE_STATES.SUSPENDED],
      displayOrder: 10
    }, {
      key: 'reactivate',
      label: 'Tekrar Aktif Et',
      variant: 'primary',
      visibleInStates: [WORKSPACE_MODULE_LIFECYCLE_STATES.SUSPENDED],
      displayOrder: 20
    }, {
      key: 'detach-from-workspace',
      label: "Çalışma Alanından Kaldır",
      variant: 'danger',
      visibleInStates: [WORKSPACE_MODULE_LIFECYCLE_STATES.SUSPENDED],
      displayOrder: 30
    }]
  }

  return [{
    key: 'install',
    label: 'Kur',
    variant: 'primary',
    visibleInStates: [module.installState],
    displayOrder: 10
  }]
}
