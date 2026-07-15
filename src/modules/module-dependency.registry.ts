import {
  SECTOR_TEMPLATE_ASSIGNABLE_MODULE_CODES as MODULE_CODES,
  type ModuleCode
} from './module-code.registry'
import type { ModuleDependencyRule } from './module-dependency.types'

const defineDependencyRule = ({
  moduleCode,
  requires = [],
  recommended = [],
  optionalDependencies = [],
  conflicts = [],
  description
}: {
  moduleCode: ModuleCode
  requires?: ModuleCode[]
  recommended?: ModuleCode[]
  optionalDependencies?: ModuleCode[]
  conflicts?: ModuleCode[]
  description: string
}): ModuleDependencyRule => ({
  moduleCode,
  requires: [...requires],
  recommended: [...recommended],
  optionalDependencies: [...optionalDependencies],
  conflicts: [...conflicts],
  description
})

export const MODULE_DEPENDENCY_REGISTRY: ModuleDependencyRule[] = [
  defineDependencyRule({
    moduleCode: MODULE_CODES.QR_MENU,
    requires: [
      MODULE_CODES.PRODUCT
    ],
    recommended: [],
    optionalDependencies: [
      MODULE_CODES.COURIER
    ],
    conflicts: [],
    description: 'QR Menü dijital katalog ve talep akışını ürün/hizmet kataloğu üzerine kurar.'
  }),
  defineDependencyRule({
    moduleCode: MODULE_CODES.PRODUCTION,
    requires: [],
    recommended: [
      MODULE_CODES.WAREHOUSE,
      MODULE_CODES.STOCK,
      MODULE_CODES.RECIPE,
      MODULE_CODES.PURCHASE
    ],
    optionalDependencies: [
      MODULE_CODES.QUALITY,
      MODULE_CODES.MAINTENANCE
    ],
    conflicts: [],
    description: 'Üretim iş emirleri bu fazda bağımsız UI/domain hazırlığıdır; depo, stok, reçete ve satın alma sonraki fazlar için önerilen temel modüllerdir.'
  }),
  defineDependencyRule({
    moduleCode: MODULE_CODES.COURIER,
    requires: [
      MODULE_CODES.ORDER
    ],
    recommended: [],
    optionalDependencies: [
      MODULE_CODES.CRM
    ],
    conflicts: [],
    description: 'Kurye operasyonu sipariş akışına bağlı çalışır.'
  }),
  defineDependencyRule({
    moduleCode: MODULE_CODES.CRM,
    requires: [
      MODULE_CODES.CUSTOMER
    ],
    recommended: [
      MODULE_CODES.LOYALTY
    ],
    optionalDependencies: [
      MODULE_CODES.SMS
    ],
    conflicts: [],
    description: 'CRM müşteri kartları ve müşteri ilişkileri verisi üzerine kurulur.'
  }),
  defineDependencyRule({
    moduleCode: MODULE_CODES.RECIPE,
    requires: [
      MODULE_CODES.STOCK
    ],
    recommended: [
      MODULE_CODES.PRODUCT
    ],
    optionalDependencies: [],
    conflicts: [],
    description: 'Reçete tanımları stok tüketimi ve ürün/hizmet katalogları ile birlikte anlam kazanır.'
  }),
  defineDependencyRule({
    moduleCode: MODULE_CODES.CAMPAIGN,
    requires: [
      MODULE_CODES.CRM
    ],
    recommended: [
      MODULE_CODES.LOYALTY
    ],
    optionalDependencies: [
      MODULE_CODES.SMS
    ],
    conflicts: [],
    description: 'Kampanya yönetimi CRM verisiyle hedefleme yapar.'
  }),
  defineDependencyRule({
    moduleCode: MODULE_CODES.LOYALTY,
    requires: [
      MODULE_CODES.CUSTOMER
    ],
    recommended: [],
    optionalDependencies: [],
    conflicts: [],
    description: 'Sadakat programları müşteri kartları üzerinden çalışır.'
  }),
  defineDependencyRule({
    moduleCode: MODULE_CODES.CREDIT,
    requires: [
      MODULE_CODES.CURRENT
    ],
    recommended: [],
    optionalDependencies: [],
    conflicts: [],
    description: 'Veresiye akışı cari hesap olmadan çalışamaz.'
  }),
  defineDependencyRule({
    moduleCode: MODULE_CODES.CASH,
    requires: [],
    recommended: [
      MODULE_CODES.FINANCE
    ],
    optionalDependencies: [],
    conflicts: [],
    description: 'Kasa operasyonları finans modülü ile birlikte daha kapsamlı raporlanabilir.'
  }),
  defineDependencyRule({
    moduleCode: MODULE_CODES.RESERVATION,
    requires: [
      MODULE_CODES.CUSTOMER
    ],
    recommended: [
      MODULE_CODES.CRM
    ],
    optionalDependencies: [
      MODULE_CODES.SMS
    ],
    conflicts: [],
    description: 'Rezervasyon akışı müşteri bilgisi ve iletişim süreçleriyle birlikte çalışır.'
  }),
  defineDependencyRule({
    moduleCode: MODULE_CODES.APPOINTMENT,
    requires: [
      MODULE_CODES.CUSTOMER
    ],
    recommended: [
      MODULE_CODES.PERSONNEL
    ],
    optionalDependencies: [
      MODULE_CODES.SMS
    ],
    conflicts: [],
    description: 'Randevu akışı müşteri ve personel planlaması ile ilişkilidir.'
  })
]

export const getModuleDependencyRule = (moduleCode: ModuleCode) => {
  return MODULE_DEPENDENCY_REGISTRY.find(rule => rule.moduleCode === moduleCode) || null
}
