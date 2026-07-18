import type { StockItem } from '../types'
import type {
  Supplier,
  SupplierProduct,
  SupplierProductStatus,
  SupplierProductUnit
} from './supplier-management.types'

export const SUPPLIER_PRODUCT_STORAGE_KEY = 'ra_supplier_products'

export const SUPPLIER_PRODUCT_STATUSES: SupplierProductStatus[] = [
  'ACTIVE',
  'PASSIVE'
]

export const SUPPLIER_PRODUCT_UNITS: SupplierProductUnit[] = [
  'gr',
  'kg',
  'ml',
  'lt',
  'adet',
  'paket',
  'koli',
  'çuval',
  'kasa'
]

export const SUPPLIER_PRODUCT_STATUS_LABELS: Record<SupplierProductStatus, string> = {
  ACTIVE: 'Aktif',
  PASSIVE: 'Pasif'
}

type RawSupplierProductRecord = Partial<Record<keyof SupplierProduct, unknown>> & Record<string, unknown>

type SupplierProductSeed = {
  supplierIndex: number
  stockSearchName: string
  supplierSku: string
  supplierProductName: string
  brand: string
  manufacturer: string
  purchaseUnit: SupplierProductUnit
  packageQuantity: number
  conversionFactor: number
  defaultUnitPrice: number
  minimumOrderQuantity: number
  leadTimeDays: number
  isPreferred: boolean
  status: SupplierProductStatus
  notes: string
}

const DEFAULT_CURRENCY = 'TRY'
const DEFAULT_PURCHASE_UNIT: SupplierProductUnit = 'kg'

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const isRecord = (value: unknown): value is RawSupplierProductRecord => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizePositiveNumber = (value: unknown, fallback = 1) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const normalizeNonNegativeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0
}

const normalizeUnit = (value: unknown): SupplierProductUnit => {
  const normalized = normalizeText(value)
  return SUPPLIER_PRODUCT_UNITS.includes(normalized as SupplierProductUnit)
    ? normalized as SupplierProductUnit
    : DEFAULT_PURCHASE_UNIT
}

const normalizeStatus = (value: unknown): SupplierProductStatus => {
  const normalized = normalizeText(value).toUpperCase()
  return SUPPLIER_PRODUCT_STATUSES.includes(normalized as SupplierProductStatus)
    ? normalized as SupplierProductStatus
    : 'ACTIVE'
}

const normalizeCurrency = (value: unknown) => {
  const normalized = normalizeText(value).toUpperCase()
  return normalized || DEFAULT_CURRENCY
}

const normalizeMatchKey = (value: string) => (
  value.trim().toLocaleLowerCase('tr-TR')
)

const findStockItem = (stockItems: StockItem[], searchName: string, fallbackIndex: number) => {
  const normalizedSearchName = normalizeMatchKey(searchName)
  return stockItems.find(stockItem => normalizeMatchKey(stockItem.name).includes(normalizedSearchName))
    || stockItems[fallbackIndex % stockItems.length]
}

const createSeedRecords = (): SupplierProductSeed[] => [
  { supplierIndex: 8, stockSearchName: 'Domates Salçası', supplierSku: 'MET-TAT-DS-5KG', supplierProductName: 'Tat Domates Salçası 5 KG', brand: 'Tat', manufacturer: 'Tat Gıda', purchaseUnit: 'kg', packageQuantity: 5, conversionFactor: 5000, defaultUnitPrice: 620, minimumOrderQuantity: 4, leadTimeDays: 2, isPreferred: true, status: 'ACTIVE', notes: 'Standart reçete salça ihtiyacı için tercih edilen ürün.' },
  { supplierIndex: 5, stockSearchName: 'Domates Salçası', supplierSku: 'ABC-TAT-DS-10KG', supplierProductName: 'Tat Domates Salçası 10 KG', brand: 'Tat', manufacturer: 'Tat Gıda', purchaseUnit: 'kg', packageQuantity: 10, conversionFactor: 10000, defaultUnitPrice: 1180, minimumOrderQuantity: 2, leadTimeDays: 3, isPreferred: false, status: 'ACTIVE', notes: 'Yüksek hacimli üretim için alternatif ambalaj.' },
  { supplierIndex: 2, stockSearchName: 'Domates Salçası', supplierSku: 'YOR-DS-20KG', supplierProductName: 'Yöre Domates Salçası 20 KG', brand: 'Yöre', manufacturer: 'Yöre Gıda', purchaseUnit: 'kg', packageQuantity: 20, conversionFactor: 20000, defaultUnitPrice: 2140, minimumOrderQuantity: 1, leadTimeDays: 2, isPreferred: false, status: 'ACTIVE', notes: 'Aynı stok kartına bağlı üçüncü tedarikçi ürünü.' },
  { supplierIndex: 0, stockSearchName: 'Dana Eti', supplierSku: 'AET-DE-5KG', supplierProductName: 'Dana Kuşbaşı Vakum 5 KG', brand: 'Anadolu Et', manufacturer: 'Anadolu Et', purchaseUnit: 'kg', packageQuantity: 5, conversionFactor: 5000, defaultUnitPrice: 2950, minimumOrderQuantity: 3, leadTimeDays: 2, isPreferred: true, status: 'ACTIVE', notes: 'Et döner ve sıcak yemek üretimi için.' },
  { supplierIndex: 0, stockSearchName: 'Dana Kıyma', supplierSku: 'AET-DK-10KG', supplierProductName: 'Dana Kıyma 10 KG', brand: 'Anadolu Et', manufacturer: 'Anadolu Et', purchaseUnit: 'kg', packageQuantity: 10, conversionFactor: 10000, defaultUnitPrice: 5200, minimumOrderQuantity: 2, leadTimeDays: 2, isPreferred: true, status: 'ACTIVE', notes: 'Köfte üretimi için ana tedarikçi.' },
  { supplierIndex: 1, stockSearchName: 'Tavuk But', supplierSku: 'BKG-TB-10KG', supplierProductName: 'Tavuk But 10 KG', brand: 'Beyaz Kanat', manufacturer: 'Beyaz Kanat', purchaseUnit: 'kg', packageQuantity: 10, conversionFactor: 10000, defaultUnitPrice: 1850, minimumOrderQuantity: 3, leadTimeDays: 1, isPreferred: true, status: 'ACTIVE', notes: 'Marinasyon reçetesi için hızlı teslim.' },
  { supplierIndex: 1, stockSearchName: 'Tavuk Suyu', supplierSku: 'BKG-TS-12LT', supplierProductName: 'Tavuk Suyu 12 LT', brand: 'Beyaz Kanat', manufacturer: 'Beyaz Kanat', purchaseUnit: 'lt', packageQuantity: 12, conversionFactor: 12000, defaultUnitPrice: 720, minimumOrderQuantity: 2, leadTimeDays: 1, isPreferred: false, status: 'ACTIVE', notes: 'Pilav üretimi için hacim bazlı ürün.' },
  { supplierIndex: 2, stockSearchName: 'Kuru Soğan', supplierSku: 'YS-SOG-25KG', supplierProductName: 'Kuru Soğan Çuval 25 KG', brand: 'Yeşilova', manufacturer: 'Yeşilova Hal', purchaseUnit: 'çuval', packageQuantity: 1, conversionFactor: 25000, defaultUnitPrice: 650, minimumOrderQuantity: 2, leadTimeDays: 1, isPreferred: true, status: 'ACTIVE', notes: 'Günlük sebze tedariği.' },
  { supplierIndex: 2, stockSearchName: 'Havuç', supplierSku: 'YS-HAV-10KG', supplierProductName: 'Havuç 10 KG', brand: 'Yeşilova', manufacturer: 'Yeşilova Hal', purchaseUnit: 'kg', packageQuantity: 10, conversionFactor: 10000, defaultUnitPrice: 280, minimumOrderQuantity: 3, leadTimeDays: 1, isPreferred: false, status: 'ACTIVE', notes: 'Çorba üretimi için.' },
  { supplierIndex: 3, stockSearchName: 'Şeker', supplierSku: 'EMH-SEK-25KG', supplierProductName: 'Toz Şeker 25 KG', brand: 'Ege Meyve', manufacturer: 'Ege Meyve Hal', purchaseUnit: 'çuval', packageQuantity: 1, conversionFactor: 25000, defaultUnitPrice: 950, minimumOrderQuantity: 1, leadTimeDays: 2, isPreferred: false, status: 'ACTIVE', notes: 'Sos ve tatlı üretiminde kullanılır.' },
  { supplierIndex: 4, stockSearchName: 'Süt', supplierSku: 'MSU-SUT-12LT', supplierProductName: 'Pastörize Süt 12 LT', brand: 'Marmara Süt', manufacturer: 'Marmara Süt', purchaseUnit: 'koli', packageQuantity: 1, conversionFactor: 12000, defaultUnitPrice: 540, minimumOrderQuantity: 4, leadTimeDays: 2, isPreferred: true, status: 'ACTIVE', notes: 'Süt ürünleri grubunun ana ürünü.' },
  { supplierIndex: 4, stockSearchName: 'Krema', supplierSku: 'MSU-KRE-5LT', supplierProductName: 'Krema 5 LT', brand: 'Marmara Süt', manufacturer: 'Marmara Süt', purchaseUnit: 'lt', packageQuantity: 5, conversionFactor: 5000, defaultUnitPrice: 620, minimumOrderQuantity: 2, leadTimeDays: 2, isPreferred: false, status: 'ACTIVE', notes: 'Ara ürün reçeteleri için.' },
  { supplierIndex: 4, stockSearchName: 'Tereyağı', supplierSku: 'MSU-TRY-5KG', supplierProductName: 'Tereyağı Blok 5 KG', brand: 'Marmara Süt', manufacturer: 'Marmara Süt', purchaseUnit: 'kg', packageQuantity: 5, conversionFactor: 5000, defaultUnitPrice: 1350, minimumOrderQuantity: 2, leadTimeDays: 2, isPreferred: false, status: 'ACTIVE', notes: 'Çorba ve pilav reçeteleri için.' },
  { supplierIndex: 5, stockSearchName: 'Tuz', supplierSku: 'DBH-TUZ-25KG', supplierProductName: 'Rafine Tuz 25 KG', brand: 'Doğu Baharat', manufacturer: 'Doğu Baharat', purchaseUnit: 'çuval', packageQuantity: 1, conversionFactor: 25000, defaultUnitPrice: 360, minimumOrderQuantity: 1, leadTimeDays: 3, isPreferred: true, status: 'ACTIVE', notes: 'Genel üretim tuzu.' },
  { supplierIndex: 5, stockSearchName: 'Karabiber', supplierSku: 'DBH-KRB-1KG', supplierProductName: 'Karabiber 1 KG', brand: 'Doğu Baharat', manufacturer: 'Doğu Baharat', purchaseUnit: 'kg', packageQuantity: 1, conversionFactor: 1000, defaultUnitPrice: 680, minimumOrderQuantity: 2, leadTimeDays: 3, isPreferred: true, status: 'ACTIVE', notes: 'Baharat grubu.' },
  { supplierIndex: 5, stockSearchName: 'Kimyon', supplierSku: 'DBH-KMY-1KG', supplierProductName: 'Kimyon 1 KG', brand: 'Doğu Baharat', manufacturer: 'Doğu Baharat', purchaseUnit: 'kg', packageQuantity: 1, conversionFactor: 1000, defaultUnitPrice: 520, minimumOrderQuantity: 2, leadTimeDays: 3, isPreferred: false, status: 'ACTIVE', notes: 'Köfte ve döner reçeteleri için.' },
  { supplierIndex: 6, stockSearchName: 'Su', supplierSku: 'SID-SU-19LT', supplierProductName: 'Damacana Su 19 LT', brand: 'Serin', manufacturer: 'Serin İçecek', purchaseUnit: 'adet', packageQuantity: 1, conversionFactor: 19000, defaultUnitPrice: 95, minimumOrderQuantity: 10, leadTimeDays: 2, isPreferred: false, status: 'PASSIVE', notes: 'Pasif tedarikçi ürünü örneği.' },
  { supplierIndex: 7, stockSearchName: 'Temizlik', supplierSku: 'HPT-DEZ-5LT', supplierProductName: 'Dezenfektan 5 LT', brand: 'Hijyen Pro', manufacturer: 'Hijyen Pro', purchaseUnit: 'lt', packageQuantity: 5, conversionFactor: 5000, defaultUnitPrice: 480, minimumOrderQuantity: 2, leadTimeDays: 4, isPreferred: true, status: 'ACTIVE', notes: 'Temizlik sarf grubu.' },
  { supplierIndex: 8, stockSearchName: 'Ambalaj', supplierSku: 'PAM-KAP-500', supplierProductName: 'Sıcak Yemek Kabı 500 Adet', brand: 'Paket', manufacturer: 'Paket Ambalaj', purchaseUnit: 'koli', packageQuantity: 1, conversionFactor: 500, defaultUnitPrice: 1250, minimumOrderQuantity: 1, leadTimeDays: 5, isPreferred: true, status: 'ACTIVE', notes: 'Paketleme sarf ürünü.' },
  { supplierIndex: 9, stockSearchName: 'Un', supplierSku: 'BUM-UN-25KG', supplierProductName: 'Endüstriyel Un 25 KG', brand: 'Bereket', manufacturer: 'Bereket Unlu', purchaseUnit: 'çuval', packageQuantity: 1, conversionFactor: 25000, defaultUnitPrice: 760, minimumOrderQuantity: 2, leadTimeDays: 2, isPreferred: false, status: 'PASSIVE', notes: 'Unlu mamul grubu.' }
]

export const createSupplierProductMockData = (
  suppliers: Supplier[],
  stockItems: StockItem[]
): SupplierProduct[] => {
  if(suppliers.length === 0 || stockItems.length === 0) return []

  return createSeedRecords().map((seed, index) => {
    const stockItem = findStockItem(stockItems, seed.stockSearchName, index)
    const supplier = suppliers[seed.supplierIndex % suppliers.length]
    const createdAt = `2026-07-12T${String(8 + Math.floor(index / 2)).padStart(2, '0')}:${String((index % 2) * 30).padStart(2, '0')}:00.000Z`

    return {
      id: `supplier_product_${String(index + 1).padStart(3, '0')}`,
      supplierId: supplier.id,
      stockItemId: stockItem.id,
      supplierSku: seed.supplierSku,
      supplierProductName: seed.supplierProductName,
      brand: seed.brand,
      manufacturer: seed.manufacturer,
      purchaseUnit: seed.purchaseUnit,
      packageQuantity: seed.packageQuantity,
      baseUnit: stockItem.unit,
      conversionFactor: seed.conversionFactor,
      defaultUnitPrice: seed.defaultUnitPrice,
      currency: DEFAULT_CURRENCY,
      minimumOrderQuantity: seed.minimumOrderQuantity,
      leadTimeDays: seed.leadTimeDays,
      isPreferred: seed.isPreferred,
      status: seed.status,
      notes: seed.notes,
      createdAt,
      updatedAt: createdAt
    }
  })
}

const normalizeSupplierProduct = (
  item: RawSupplierProductRecord,
  index: number,
  suppliers: Supplier[],
  stockItems: StockItem[]
): SupplierProduct => {
  const now = new Date().toISOString()
  const fallbackSupplier = suppliers[index % Math.max(suppliers.length, 1)]
  const fallbackStockItem = stockItems[index % Math.max(stockItems.length, 1)]
  const requestedSupplierId = normalizeText(item.supplierId)
  const supplier = suppliers.find(record => record.id === requestedSupplierId) || fallbackSupplier
  const requestedStockItemId = normalizeText(item.stockItemId)
  const stockItem = stockItems.find(stock => stock.id === requestedStockItemId) || fallbackStockItem
  const supplierProductName = normalizeText(item.supplierProductName || item.productName || item.name)
  const createdAt = normalizeText(item.createdAt) || now

  return {
    id: normalizeText(item.id) || `supplier_product_${Date.now()}_${index}`,
    supplierId: supplier?.id || requestedSupplierId || '',
    stockItemId: stockItem?.id || requestedStockItemId || '',
    supplierSku: normalizeText(item.supplierSku || item.sku),
    supplierProductName: supplierProductName || `Tedarikçi Ürünü ${index + 1}`,
    brand: normalizeText(item.brand),
    manufacturer: normalizeText(item.manufacturer),
    purchaseUnit: normalizeUnit(item.purchaseUnit),
    packageQuantity: normalizePositiveNumber(item.packageQuantity),
    baseUnit: stockItem?.unit || normalizeText(item.baseUnit),
    conversionFactor: normalizePositiveNumber(item.conversionFactor),
    defaultUnitPrice: normalizeNonNegativeNumber(item.defaultUnitPrice ?? item.unitPrice),
    currency: normalizeCurrency(item.currency),
    minimumOrderQuantity: normalizeNonNegativeNumber(item.minimumOrderQuantity),
    leadTimeDays: normalizeNonNegativeNumber(item.leadTimeDays),
    isPreferred: item.isPreferred === true,
    status: normalizeStatus(item.status),
    notes: normalizeText(item.notes || item.note),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

export const saveSupplierProductRecords = (records: SupplierProduct[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(SUPPLIER_PRODUCT_STORAGE_KEY, JSON.stringify(records))
}

export const loadSupplierProductRecords = (
  suppliers: Supplier[],
  stockItems: StockItem[]
) => {
  const seedRecords = createSupplierProductMockData(suppliers, stockItems)

  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(SUPPLIER_PRODUCT_STORAGE_KEY)

  if(!storedRecords){
    if(seedRecords.length > 0) saveSupplierProductRecords(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(isRecord)
        .map((item, index) => normalizeSupplierProduct(item, index, suppliers, stockItems))

      saveSupplierProductRecords(normalizedRecords)
      return normalizedRecords
    }
  } catch {
    if(seedRecords.length > 0) saveSupplierProductRecords(seedRecords)
    return seedRecords
  }

  if(seedRecords.length > 0) saveSupplierProductRecords(seedRecords)
  return seedRecords
}
