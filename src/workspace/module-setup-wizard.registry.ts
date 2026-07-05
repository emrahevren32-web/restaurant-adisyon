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
    title: 'İşlem Yönetimi Başlangıç Sihirbazı',
    description: 'İşlem Yönetimi modülünün temel çalışma alanlarını sırayla hazırlayacak kurulum akışı.',
    steps: [
      createStep('workspace-area', 'Alan oluştur', 'Çalışma alanı yapısı bu adımda hazırlanacak.', 10, 'Gerçek alan oluşturma sonraki fazda eklenecek.'),
      createStep('operation-units', 'İşlem alanlarını oluştur', 'İşletmeye özel işlem alanları bu adımda tanımlanacak.', 20, 'Alan oluşturma şimdilik placeholder.'),
      createStep('tax', 'Vergi', 'Vergi oranları ve gelir ayarları bu adımda bağlanacak.', 30, 'Vergi kaydı sonraki fazda gerçek ayarlara yazılacak.'),
      createStep('output', 'Çıktı', 'Belge ve çıktı bağlantıları bu adımda hazırlanacak.', 40, 'Çıktı entegrasyonu bu sürümde çalıştırılmıyor.'),
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
