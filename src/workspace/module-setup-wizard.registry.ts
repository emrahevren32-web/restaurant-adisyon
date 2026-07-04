import type { BusinessWorkspaceModule } from '../modules/business-workspace.registry'
import type { ModuleSetupWizardDefinition } from './module-setup-wizard.types'

const createStep = (
  id: string,
  title: string,
  description: string,
  displayOrder: number,
  placeholder?: string
) => ({
  id,
  title,
  description,
  displayOrder,
  isRequired: false,
  placeholder
})

const MODULE_SETUP_WIZARD_REGISTRY: ModuleSetupWizardDefinition[] = [
  {
    moduleCode: 'adisyon',
    title: 'Adisyon Başlangıç Sihirbazı',
    description: 'Adisyon modülünün temel çalışma alanlarını sırayla hazırlayacak kurulum akışı.',
    steps: [
      createStep('venue-area', 'Salon oluştur', 'Çalışma alanı ve salon yapısı bu adımda hazırlanacak.', 10, 'Gerçek salon oluşturma sonraki fazda eklenecek.'),
      createStep('tables', 'Masaları oluştur', 'Masa planı ve servis alanları bu adımda tanımlanacak.', 20, 'Masa oluşturma şimdilik placeholder.'),
      createStep('tax', 'KDV', 'Vergi oranları ve satış ayarları bu adımda bağlanacak.', 30, 'KDV kaydı sonraki fazda gerçek ayarlara yazılacak.'),
      createStep('printer', 'Yazıcı', 'Mutfak ve kasa yazıcı bağlantıları bu adımda hazırlanacak.', 40, 'Yazıcı entegrasyonu bu sürümde çalıştırılmıyor.'),
      createStep('done', 'Tamamlandı', 'Modül başlangıç akışı tamamlandıktan sonra Dashboard alanına geçilecek.', 50)
    ]
  }
]

const createDefaultWizardDefinition = (module: BusinessWorkspaceModule): ModuleSetupWizardDefinition => ({
  moduleCode: module.code,
  title: `${module.name} Başlangıç Sihirbazı`,
  description: `${module.name} modülünün Workspace, menü ve Dashboard bağlantılarını hazırlayan genel kurulum akışı.`,
  steps: [
    createStep('module-context', 'Modül bağlamı', `${module.name} modülünün Workspace içinde hangi alanlara bağlanacağı hazırlanır.`, 10, 'Gerçek ayar kaydı sonraki modül fazında eklenecek.'),
    createStep('permissions', 'Yetki hazırlığı', 'Rol ve izin bağlantıları bu adımda kontrol edilecek.', 20, 'Yetki matrisi şimdilik sadece altyapı olarak hazır.'),
    createStep('dashboard-widgets', 'Dashboard özetleri', 'Bu modülün Dashboard üzerinde gösterebileceği özet alanları hazırlanır.', 30, 'Canlı Dashboard yerleşimi sonraki fazda eklenecek.'),
    createStep('done', 'Tamamlandı', 'Kurulum sihirbazı tamamlandıktan sonra modül kullanıma hazır kabul edilir.', 40)
  ]
})

export const getModuleSetupWizardDefinition = (module: BusinessWorkspaceModule) => {
  return MODULE_SETUP_WIZARD_REGISTRY.find(item => item.moduleCode === module.code)
    || createDefaultWizardDefinition(module)
}
