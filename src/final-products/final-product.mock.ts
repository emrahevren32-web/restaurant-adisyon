import type {
  FinalProduct,
  FinalProductCategory,
  FinalProductStatus,
  FinalProductUnit
} from './final-product.types'

const FINAL_PRODUCT_STORAGE_KEY = 'ra_final_products'

export const FINAL_PRODUCT_CATEGORIES: FinalProductCategory[] = [
  'Çorba',
  'Et',
  'Tavuk',
  'Sebze',
  'Hamur',
  'Pizza',
  'Makarna',
  'Tatlı',
  'Genel'
]

export const FINAL_PRODUCT_UNITS: FinalProductUnit[] = [
  'kg',
  'lt',
  'adet',
  'koli',
  'tepsi'
]

export const FINAL_PRODUCT_STATUSES: FinalProductStatus[] = [
  'Aktif',
  'Kritik',
  'Pasif'
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const normalizeCategory = (value: unknown): FinalProductCategory => (
  FINAL_PRODUCT_CATEGORIES.includes(value as FinalProductCategory)
    ? value as FinalProductCategory
    : 'Genel'
)

const normalizeUnit = (value: unknown): FinalProductUnit => (
  FINAL_PRODUCT_UNITS.includes(value as FinalProductUnit)
    ? value as FinalProductUnit
    : 'kg'
)

const normalizeStatus = (value: unknown): FinalProductStatus => (
  FINAL_PRODUCT_STATUSES.includes(value as FinalProductStatus)
    ? value as FinalProductStatus
    : 'Aktif'
)

export const resolveFinalProductStatus = (
  product: Pick<FinalProduct, 'currentStock' | 'minimumStock' | 'status'>
): FinalProductStatus => {
  if(product.status === 'Pasif') return 'Pasif'
  return product.minimumStock > 0 && product.currentStock < product.minimumStock ? 'Kritik' : 'Aktif'
}

const normalizeStoredProduct = (
  item: Partial<FinalProduct>,
  index: number
): FinalProduct => {
  const currentStock = Number(item.currentStock)
  const minimumStock = Number(item.minimumStock)
  const createdAt = String(item.createdAt || new Date().toISOString())
  const product: FinalProduct = {
    id: String(item.id || `fproduct_${String(index + 1).padStart(3, '0')}`),
    code: String(item.code || `SP-${String(index + 1).padStart(3, '0')}`).trim(),
    name: String(item.name || 'Son Ürün').trim() || 'Son Ürün',
    category: normalizeCategory(item.category),
    unit: normalizeUnit(item.unit),
    currentStock: Number.isFinite(currentStock) ? currentStock : 0,
    minimumStock: Number.isFinite(minimumStock) ? Math.max(0, minimumStock) : 0,
    status: normalizeStatus(item.status),
    description: String(item.description || '').trim(),
    linkedIntermediateProducts: Array.isArray(item.linkedIntermediateProducts)
      ? item.linkedIntermediateProducts.map(value => String(value).trim()).filter(Boolean)
      : [],
    linkedPackaging: String(item.linkedPackaging || '').trim(),
    createdAt,
    updatedAt: item.updatedAt ? String(item.updatedAt) : createdAt
  }

  return {
    ...product,
    status: resolveFinalProductStatus(product)
  }
}

const product = (
  id: string,
  code: string,
  name: string,
  category: FinalProductCategory,
  unit: FinalProductUnit,
  currentStock: number,
  minimumStock: number,
  status: FinalProductStatus,
  description: string,
  createdAt: string
): FinalProduct => normalizeStoredProduct({
  id,
  code,
  name,
  category,
  unit,
  currentStock,
  minimumStock,
  status,
  description,
  linkedIntermediateProducts: [],
  linkedPackaging: '',
  createdAt,
  updatedAt: createdAt
}, 0)

export const createFinalProductMockData = (): FinalProduct[] => [
  product('fproduct_001', 'SP-001', 'Mercimek Çorbası', 'Çorba', 'lt', 180, 70, 'Aktif', 'Sevkiyata hazır günlük çorba üretimi.', '2026-07-15T07:10:00.000Z'),
  product('fproduct_002', 'SP-002', 'Ezogelin Çorbası', 'Çorba', 'lt', 38, 50, 'Kritik', 'Toplu yemek sevkiyatları için hazırlanan çorba.', '2026-07-15T07:35:00.000Z'),
  product('fproduct_003', 'SP-003', 'Tavuk Döner', 'Tavuk', 'kg', 126, 55, 'Aktif', 'Dilimlenmiş ve paketlemeye hazır tavuk döner.', '2026-07-15T08:20:00.000Z'),
  product('fproduct_004', 'SP-004', 'Et Döner', 'Et', 'kg', 72, 35, 'Aktif', 'Soğuk zincir sevkiyatına hazır et döner.', '2026-07-15T08:50:00.000Z'),
  product('fproduct_005', 'SP-005', 'Köfte', 'Et', 'kg', 20, 35, 'Kritik', 'Porsiyonlanmış pişirmeye hazır köfte ürünü.', '2026-07-15T09:25:00.000Z'),
  product('fproduct_006', 'SP-006', 'Patates Püresi', 'Sebze', 'kg', 84, 30, 'Aktif', 'Garnitür sevkiyatları için paketli püre.', '2026-07-15T10:05:00.000Z'),
  product('fproduct_007', 'SP-007', 'Pilav', 'Genel', 'kg', 96, 45, 'Aktif', 'Toplu yemek operasyonu için pişmiş pilav.', '2026-07-15T10:40:00.000Z'),
  product('fproduct_008', 'SP-008', 'Lazanya', 'Makarna', 'tepsi', 9, 14, 'Kritik', 'Tepsi bazlı paketlenmiş lazanya ürünü.', '2026-07-15T11:15:00.000Z'),
  product('fproduct_009', 'SP-009', 'Pizza', 'Pizza', 'adet', 64, 24, 'Aktif', 'Dilimleme ve paketleme sonrası sevkiyata hazır pizza.', '2026-07-15T12:00:00.000Z'),
  product('fproduct_010', 'SP-010', 'Tavuk Sote', 'Tavuk', 'kg', 0, 20, 'Pasif', 'Menü revizyonu nedeniyle geçici pasif ürün.', '2026-07-15T12:35:00.000Z')
]

export const saveFinalProducts = (products: FinalProduct[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(FINAL_PRODUCT_STORAGE_KEY, JSON.stringify(products.map(normalizeStoredProduct)))
}

export const loadFinalProducts = () => {
  const seedProducts = createFinalProductMockData()
  if(!isBrowserStorageAvailable()) return seedProducts

  const storedProducts = localStorage.getItem(FINAL_PRODUCT_STORAGE_KEY)
  if(storedProducts === null){
    saveFinalProducts(seedProducts)
    return seedProducts
  }

  try {
    const parsed = JSON.parse(storedProducts)
    if(Array.isArray(parsed)){
      return parsed.map(normalizeStoredProduct)
    }
  } catch {
    // Corrupt local demo data is reset to the current mock seed.
  }

  saveFinalProducts(seedProducts)
  return seedProducts
}
