import type { Supplier } from '../supplier-management/supplier-management.types'
import type { StockItem } from '../types'
import type {
  ChemicalProduct,
  ChemicalProductCategory,
  ChemicalProductHazardClass,
  ChemicalProductPhysicalState,
  ChemicalProductStatus,
  ChemicalProductStorageCondition
} from './chemical-product.types'

export const CHEMICAL_PRODUCT_STORAGE_KEY = 'ra_chemical_products'

export const CHEMICAL_PRODUCT_CATEGORIES: ChemicalProductCategory[] = [
  'DETERGENT',
  'DISINFECTANT',
  'DEGREASER',
  'DESCALER',
  'SANITIZER',
  'MAINTENANCE',
  'OTHER'
]

export const CHEMICAL_PRODUCT_HAZARD_CLASSES: ChemicalProductHazardClass[] = [
  'NONE',
  'IRRITANT',
  'CORROSIVE',
  'FLAMMABLE',
  'OXIDIZER',
  'TOXIC',
  'OTHER'
]

export const CHEMICAL_PRODUCT_PHYSICAL_STATES: ChemicalProductPhysicalState[] = [
  'LIQUID',
  'POWDER',
  'GEL',
  'SPRAY',
  'FOAM',
  'OTHER'
]

export const CHEMICAL_PRODUCT_STORAGE_CONDITIONS: ChemicalProductStorageCondition[] = [
  'ROOM_TEMPERATURE',
  'COOL',
  'VENTILATED',
  'LOCKED_CABINET',
  'FLAMMABLE_STORAGE',
  'OTHER'
]

export const CHEMICAL_PRODUCT_STATUSES: ChemicalProductStatus[] = [
  'ACTIVE',
  'INACTIVE',
  'DISCONTINUED'
]

export const CHEMICAL_PRODUCT_CATEGORY_LABELS: Record<ChemicalProductCategory, string> = {
  DETERGENT: 'Deterjan',
  DISINFECTANT: 'Dezenfektan',
  DEGREASER: 'Yağ Çözücü',
  DESCALER: 'Kireç Çözücü',
  SANITIZER: 'Sanitizer',
  MAINTENANCE: 'Bakım',
  OTHER: 'Diğer'
}

export const CHEMICAL_PRODUCT_HAZARD_CLASS_LABELS: Record<ChemicalProductHazardClass, string> = {
  NONE: 'Yok',
  IRRITANT: 'Tahriş Edici',
  CORROSIVE: 'Aşındırıcı',
  FLAMMABLE: 'Yanıcı',
  OXIDIZER: 'Oksitleyici',
  TOXIC: 'Toksik',
  OTHER: 'Diğer'
}

export const CHEMICAL_PRODUCT_PHYSICAL_STATE_LABELS: Record<ChemicalProductPhysicalState, string> = {
  LIQUID: 'Sıvı',
  POWDER: 'Toz',
  GEL: 'Jel',
  SPRAY: 'Sprey',
  FOAM: 'Köpük',
  OTHER: 'Diğer'
}

export const CHEMICAL_PRODUCT_STORAGE_CONDITION_LABELS: Record<ChemicalProductStorageCondition, string> = {
  ROOM_TEMPERATURE: 'Oda Sıcaklığı',
  COOL: 'Serin',
  VENTILATED: 'Havalandırılmış',
  LOCKED_CABINET: 'Kilitli Dolap',
  FLAMMABLE_STORAGE: 'Yanıcı Deposu',
  OTHER: 'Diğer'
}

export const CHEMICAL_PRODUCT_STATUS_LABELS: Record<ChemicalProductStatus, string> = {
  ACTIVE: 'Aktif',
  INACTIVE: 'Pasif',
  DISCONTINUED: 'Kullanımdan Kalktı'
}

type RawChemicalProductRecord = Partial<Record<keyof ChemicalProduct, unknown>> & Record<string, unknown>

const DEFAULT_CATEGORY: ChemicalProductCategory = 'DETERGENT'
const DEFAULT_HAZARD_CLASS: ChemicalProductHazardClass = 'NONE'
const DEFAULT_PHYSICAL_STATE: ChemicalProductPhysicalState = 'LIQUID'
const DEFAULT_STORAGE_CONDITION: ChemicalProductStorageCondition = 'ROOM_TEMPERATURE'
const DEFAULT_STATUS: ChemicalProductStatus = 'ACTIVE'

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawChemicalProductRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeEnum = <T extends string>(value: unknown, options: T[], fallback: T): T => {
  const normalized = normalizeText(value).toUpperCase()
  return options.includes(normalized as T) ? normalized as T : fallback
}

export const getNextChemicalCode = (records: ChemicalProduct[]) => {
  const maxNo = records.reduce((max, product) => {
    const match = product.chemicalCode.match(/CH-(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `CH-${String(maxNo + 1).padStart(4, '0')}`
}

const findStockItemByName = (
  stockItems: StockItem[],
  patterns: string[]
) => (
  stockItems.find(item => (
    patterns.some(pattern => item.name.toLocaleLowerCase('tr-TR').includes(pattern.toLocaleLowerCase('tr-TR')))
  )) || null
)

export const createChemicalProductMockData = (
  suppliers: Supplier[],
  stockItems: StockItem[]
): ChemicalProduct[] => {
  const cleaningSupplier = suppliers.find(supplier => (
    supplier.name.toLocaleLowerCase('tr-TR').includes('temizlik')
  )) || suppliers[7] || suppliers[0] || null
  const packageSupplier = suppliers.find(supplier => (
    supplier.name.toLocaleLowerCase('tr-TR').includes('ambalaj')
  )) || suppliers[8] || suppliers[0] || null
  const localSupplier = suppliers.find(supplier => supplier.companyType === 'LOCAL_SUPPLIER') || suppliers[0] || null
  const detergentStock = findStockItemByName(stockItems, ['temizlik', 'deterjan', 'hijyen'])
  const sanitizerStock = findStockItemByName(stockItems, ['dezenfektan', 'sanitizer', 'alkol'])
  const maintenanceStock = findStockItemByName(stockItems, ['bakım', 'yağ', 'makine'])
  const defaultStock = stockItems[0] || null
  const createdAt = '2026-07-20T08:30:00.000Z'

  const records = [
    ['CH-0001', 'Endüstriyel Bulaşık Deterjanı', 'CleanPro', cleaningSupplier?.id || '', detergentStock?.id || defaultStock?.id || '', 'DETERGENT', 'IRRITANT', 'LIQUID', 'LOCKED_CABINET', 'Bulaşıkhane', 'Eldiven, gözlük', 'MSDS-CLP-001', 'Makine dozaj pompası ile kullanılır.'],
    ['CH-0002', 'Yüzey Dezenfektanı', 'HygieneMax', cleaningSupplier?.id || '', sanitizerStock?.id || '', 'DISINFECTANT', 'IRRITANT', 'SPRAY', 'VENTILATED', 'Tezgah ve hazırlık alanı', 'Eldiven', 'MSDS-HGM-014', 'Temiz yüzeye uygulanır ve durulama gerektirmez.'],
    ['CH-0003', 'Fırın Yağ Çözücü', 'DegreaseX', cleaningSupplier?.id || '', detergentStock?.id || '', 'DEGREASER', 'CORROSIVE', 'GEL', 'LOCKED_CABINET', 'Fırın ve davlumbaz', 'Eldiven, gözlük, maske', 'MSDS-DGX-220', 'Soğuk yüzeye uygulanır, temas sonrası bol suyla durulanır.'],
    ['CH-0004', 'Kireç Çözücü Konsantre', 'LimeOff', cleaningSupplier?.id || '', '', 'DESCALER', 'CORROSIVE', 'LIQUID', 'LOCKED_CABINET', 'Kazan ve çay makineleri', 'Eldiven, gözlük', 'MSDS-LMO-088', 'Talimat oranında seyreltilerek kullanılır.'],
    ['CH-0005', 'El Sanitizer Jeli', 'SafeHands', packageSupplier?.id || '', sanitizerStock?.id || '', 'SANITIZER', 'FLAMMABLE', 'GEL', 'FLAMMABLE_STORAGE', 'Personel hijyen noktaları', 'Alev kaynaklarından uzak tut', 'MSDS-SFH-031', 'Ellere yeterli miktarda uygulanır.'],
    ['CH-0006', 'Paslanmaz Çelik Parlatıcı', 'SteelCare', localSupplier?.id || '', maintenanceStock?.id || '', 'MAINTENANCE', 'IRRITANT', 'SPRAY', 'VENTILATED', 'Ekipman dış yüzeyleri', 'Eldiven', 'MSDS-STC-012', 'Gıda temas yüzeylerine doğrudan uygulanmaz.'],
    ['CH-0007', 'Zemin Temizleyici', 'FloorPro', cleaningSupplier?.id || '', detergentStock?.id || '', 'DETERGENT', 'NONE', 'LIQUID', 'ROOM_TEMPERATURE', 'Mutfak zeminleri', 'Kaymaz ayakkabı, eldiven', 'MSDS-FLP-004', 'Paspas sisteminde seyreltilerek kullanılır.'],
    ['CH-0008', 'Klor Bazlı Dezenfektan', 'ChlorSafe', cleaningSupplier?.id || '', sanitizerStock?.id || '', 'DISINFECTANT', 'OXIDIZER', 'LIQUID', 'VENTILATED', 'Gıda dışı sanitasyon', 'Eldiven, gözlük, maske', 'MSDS-CLS-117', 'Asit ürünlerle karıştırılmaz.'],
    ['CH-0009', 'Sıvı El Sabunu', 'SoftClean', packageSupplier?.id || '', '', 'DETERGENT', 'NONE', 'LIQUID', 'ROOM_TEMPERATURE', 'El yıkama istasyonları', 'Gerekli değil', 'MSDS-SFC-041', 'Islak ele uygulanır, durulanır.'],
    ['CH-0010', 'Cam Temizleyici', 'GlassNet', cleaningSupplier?.id || '', '', 'DETERGENT', 'FLAMMABLE', 'SPRAY', 'VENTILATED', 'Cam ve vitrin yüzeyleri', 'Eldiven', 'MSDS-GLN-015', 'Gıda temas alanlarında püskürtme sonrası yüzey silinir.'],
    ['CH-0011', 'Drenaj Bakım Kimyasalı', 'DrainCare', localSupplier?.id || '', maintenanceStock?.id || '', 'MAINTENANCE', 'CORROSIVE', 'LIQUID', 'LOCKED_CABINET', 'Gider hatları', 'Eldiven, gözlük, yüz siperi', 'MSDS-DRC-090', 'Sadece yetkili personel tarafından uygulanır.'],
    ['CH-0012', 'Sebze Yıkama Dezenfektanı', 'VegSafe', cleaningSupplier?.id || '', sanitizerStock?.id || '', 'SANITIZER', 'IRRITANT', 'POWDER', 'COOL', 'Sebze meyve ön yıkama', 'Eldiven', 'MSDS-VGS-028', 'Ürün prosedürüne göre çözelti hazırlanır.'],
    ['CH-0013', 'Buz Makinesi Temizleyici', 'IceClean', localSupplier?.id || '', '', 'DESCALER', 'IRRITANT', 'LIQUID', 'COOL', 'Buz makinesi bakımı', 'Eldiven, gözlük', 'MSDS-ICC-011', 'Bakım modunda talimata göre uygulanır.'],
    ['CH-0014', 'Alkol Bazlı Hızlı Dezenfektan', 'Rapid70', cleaningSupplier?.id || '', sanitizerStock?.id || '', 'DISINFECTANT', 'FLAMMABLE', 'LIQUID', 'FLAMMABLE_STORAGE', 'Hızlı yüzey dezenfeksiyonu', 'Alev kaynaklarından uzak tut', 'MSDS-R70-070', 'Püskürtülür, yüzey kuruyana kadar beklenir.'],
    ['CH-0015', 'Çamaşır Ağartıcı', 'WhitePlus', packageSupplier?.id || '', '', 'SANITIZER', 'OXIDIZER', 'LIQUID', 'VENTILATED', 'Tekstil ve bez hijyeni', 'Eldiven, gözlük', 'MSDS-WHP-105', 'Renkli kumaşlarda kullanılmaz.'],
    ['CH-0016', 'Köpüklü El Dezenfektanı', 'FoamGuard', cleaningSupplier?.id || '', '', 'SANITIZER', 'IRRITANT', 'FOAM', 'ROOM_TEMPERATURE', 'Personel hijyen alanı', 'Gerekli değil', 'MSDS-FGD-016', 'Dispenser ile uygulanır.'],
    ['CH-0017', 'Izgara Temizleme Tozu', 'GrillPowder', localSupplier?.id || '', detergentStock?.id || '', 'DEGREASER', 'IRRITANT', 'POWDER', 'LOCKED_CABINET', 'Izgara ve döküm yüzeyler', 'Eldiven, maske', 'MSDS-GRP-077', 'Nemli yüzeyde bekletilerek uygulanır.'],
    ['CH-0018', 'Soğuk Oda Hijyen Spreyi', 'ColdSafe', cleaningSupplier?.id || '', '', 'DISINFECTANT', 'NONE', 'SPRAY', 'COOL', 'Soğuk oda rafları', 'Eldiven', 'MSDS-CDS-018', 'Gıda ürünleri uzaklaştırıldıktan sonra uygulanır.'],
    ['CH-0019', 'Makine Bakım Yağı', 'MachineLube', localSupplier?.id || '', maintenanceStock?.id || '', 'MAINTENANCE', 'FLAMMABLE', 'LIQUID', 'FLAMMABLE_STORAGE', 'Bakım ekipmanı', 'Eldiven', 'MSDS-MCL-002', 'Gıda temas alanlarından uzakta uygulanır.'],
    ['CH-0020', 'Genel Hijyen Temizleyici', 'DailyClean', cleaningSupplier?.id || '', detergentStock?.id || '', 'OTHER', 'NONE', 'LIQUID', 'ROOM_TEMPERATURE', 'Genel temizlik', 'Eldiven', 'MSDS-DCL-020', 'Günlük temizlik planına göre kullanılır.']
  ] as const

  return records.map((record, index) => ({
    id: `chemical_product_${String(index + 1).padStart(3, '0')}`,
    chemicalCode: record[0],
    name: record[1],
    brand: record[2],
    supplierId: record[3],
    stockItemId: record[4],
    category: record[5],
    hazardClass: record[6],
    physicalState: record[7],
    storageCondition: record[8],
    usageArea: record[9],
    requiredPPE: record[10],
    msdsDocumentNumber: record[11],
    usageInstruction: record[12],
    status: index % 9 === 0 ? 'INACTIVE' : index % 13 === 0 ? 'DISCONTINUED' : 'ACTIVE',
    notes: index % 4 === 0 ? 'MSDS bilgisi satın alma dosyasında doğrulandı.' : '',
    createdAt,
    updatedAt: createdAt
  }))
}

const normalizeChemicalProduct = (item: RawChemicalProductRecord, index: number): ChemicalProduct => {
  const now = new Date().toISOString()
  const createdAt = normalizeText(item.createdAt) || now

  return {
    id: normalizeText(item.id) || `chemical_product_${Date.now()}_${index}`,
    chemicalCode: normalizeText(item.chemicalCode) || `CH-${String(index + 1).padStart(4, '0')}`,
    name: normalizeText(item.name) || `Kimyasal Ürün ${index + 1}`,
    brand: normalizeText(item.brand),
    supplierId: normalizeText(item.supplierId),
    stockItemId: normalizeText(item.stockItemId),
    category: normalizeEnum(item.category, CHEMICAL_PRODUCT_CATEGORIES, DEFAULT_CATEGORY),
    hazardClass: normalizeEnum(item.hazardClass, CHEMICAL_PRODUCT_HAZARD_CLASSES, DEFAULT_HAZARD_CLASS),
    physicalState: normalizeEnum(item.physicalState, CHEMICAL_PRODUCT_PHYSICAL_STATES, DEFAULT_PHYSICAL_STATE),
    storageCondition: normalizeEnum(item.storageCondition, CHEMICAL_PRODUCT_STORAGE_CONDITIONS, DEFAULT_STORAGE_CONDITION),
    usageArea: normalizeText(item.usageArea),
    requiredPPE: normalizeText(item.requiredPPE),
    msdsDocumentNumber: normalizeText(item.msdsDocumentNumber),
    usageInstruction: normalizeText(item.usageInstruction),
    status: normalizeEnum(item.status, CHEMICAL_PRODUCT_STATUSES, DEFAULT_STATUS),
    notes: normalizeText(item.notes),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const saveChemicalProductRecords = (records: ChemicalProduct[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(CHEMICAL_PRODUCT_STORAGE_KEY, JSON.stringify(records))
}

export const loadChemicalProductRecords = (
  suppliers: Supplier[],
  stockItems: StockItem[]
) => {
  const seedRecords = createChemicalProductMockData(suppliers, stockItems)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(CHEMICAL_PRODUCT_STORAGE_KEY)
  if(!storedRecords){
    saveChemicalProductRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map(normalizeChemicalProduct)

      saveChemicalProductRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    saveChemicalProductRecords(seedRecords)
    return seedRecords
  }

  saveChemicalProductRecords(seedRecords)
  return seedRecords
}
