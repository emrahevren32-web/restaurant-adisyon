import {
  SECTOR_TEMPLATE_ASSIGNABLE_MODULE_CODES as MODULE_CODES,
  type SectorTemplateAssignableModuleCode
} from '../modules/module-code.registry'
import { DEFAULT_SECTOR_ID, SECTOR_CODES, createSectorId } from './sector.registry'
import type { SectorTemplate } from './sector-template.types'

const uniqueModules = (modules: readonly SectorTemplateAssignableModuleCode[]) => Array.from(new Set(modules))

const createTemplate = ({
  sectorId,
  defaultModules,
  optionalModules,
  description
}: SectorTemplate): SectorTemplate => ({
  sectorId,
  defaultModules: uniqueModules(defaultModules),
  optionalModules: uniqueModules(optionalModules),
  description
})

const createTemplateFromBase = (
  sectorId: string,
  baseTemplate: SectorTemplate,
  description: string,
  extraDefaultModules: readonly SectorTemplateAssignableModuleCode[] = [],
  extraOptionalModules: readonly SectorTemplateAssignableModuleCode[] = []
) => createTemplate({
  sectorId,
  defaultModules: [...baseTemplate.defaultModules, ...extraDefaultModules],
  optionalModules: [...baseTemplate.optionalModules, ...extraOptionalModules],
  description
})

const RESTAURANT_TEMPLATE = createTemplate({
  sectorId: createSectorId(SECTOR_CODES.RESTAURANT),
  description: 'Restaurant işletmeleri için ürün, adisyon, dijital menü ve cari temelli başlangıç şablonu.',
  defaultModules: [
    MODULE_CODES.PRODUCT,
    MODULE_CODES.ADISYON,
    MODULE_CODES.QR_MENU,
    MODULE_CODES.CURRENT
  ],
  optionalModules: [
    MODULE_CODES.PERSONNEL,
    MODULE_CODES.CRM,
    MODULE_CODES.CAMPAIGN,
    MODULE_CODES.LOYALTY,
    MODULE_CODES.COURIER,
    MODULE_CODES.MULTI_BRANCH
  ]
})

const INDUSTRIAL_KITCHEN_TEMPLATE = createTemplate({
  sectorId: createSectorId(SECTOR_CODES.INDUSTRIAL_KITCHEN),
  description: 'Endüstriyel mutfak işletmeleri için depo, stok, reçete, üretim, cari ve satın alma odaklı şablon.',
  defaultModules: [
    MODULE_CODES.WAREHOUSE,
    MODULE_CODES.STOCK,
    MODULE_CODES.RECIPE,
    MODULE_CODES.PRODUCTION,
    MODULE_CODES.CURRENT,
    MODULE_CODES.PURCHASE
  ],
  optionalModules: [
    MODULE_CODES.PERSONNEL,
    MODULE_CODES.CRM,
    MODULE_CODES.QUALITY,
    MODULE_CODES.MAINTENANCE,
    MODULE_CODES.MULTI_BRANCH
  ]
})

const CAFE_TEMPLATE = createTemplateFromBase(
  createSectorId(SECTOR_CODES.CAFE),
  RESTAURANT_TEMPLATE,
  'Cafe işletmeleri için Restaurant şablonunu temel alan hızlı servis şablonu.'
)

const PATISSERIE_TEMPLATE = createTemplateFromBase(
  createSectorId(SECTOR_CODES.PATISSERIE),
  RESTAURANT_TEMPLATE,
  'Pastane işletmeleri için Restaurant şablonunu üretim, stok ve reçete modülleriyle genişleten şablon.',
  [
    MODULE_CODES.STOCK,
    MODULE_CODES.RECIPE,
    MODULE_CODES.PRODUCTION
  ]
)

const HAIRDRESSER_TEMPLATE = createTemplate({
  sectorId: createSectorId(SECTOR_CODES.HAIRDRESSER),
  description: 'Kuaför işletmeleri için randevu, müşteri, personel ve kasa temelli hizmet şablonu.',
  defaultModules: [
    MODULE_CODES.APPOINTMENT,
    MODULE_CODES.CUSTOMER,
    MODULE_CODES.PERSONNEL,
    MODULE_CODES.CASH
  ],
  optionalModules: [
    MODULE_CODES.CRM,
    MODULE_CODES.LOYALTY,
    MODULE_CODES.SMS
  ]
})

const FOOTBALL_FIELD_TEMPLATE = createTemplate({
  sectorId: createSectorId(SECTOR_CODES.FOOTBALL_FIELD),
  description: 'Halı saha işletmeleri için rezervasyon, müşteri ve kasa temelli tesis şablonu.',
  defaultModules: [
    MODULE_CODES.RESERVATION,
    MODULE_CODES.CUSTOMER,
    MODULE_CODES.CASH
  ],
  optionalModules: [
    MODULE_CODES.TOURNAMENT,
    MODULE_CODES.CRM
  ]
})

const GENERAL_BUSINESS_TEMPLATE = createTemplate({
  sectorId: DEFAULT_SECTOR_ID,
  description: 'Genel işletmeler için iş modülü seçmeyen, yalnızca çekirdek sistemle başlayan şablon.',
  defaultModules: [],
  optionalModules: []
})

export const SECTOR_TEMPLATE_REGISTRY: SectorTemplate[] = [
  RESTAURANT_TEMPLATE,
  CAFE_TEMPLATE,
  PATISSERIE_TEMPLATE,
  INDUSTRIAL_KITCHEN_TEMPLATE,
  HAIRDRESSER_TEMPLATE,
  FOOTBALL_FIELD_TEMPLATE,
  GENERAL_BUSINESS_TEMPLATE
]
