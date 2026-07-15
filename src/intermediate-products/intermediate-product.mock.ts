import type {
  IntermediateProduct,
  IntermediateProductCategory,
  IntermediateProductStatus,
  IntermediateProductUnit
} from './intermediate-product.types'

const INTERMEDIATE_PRODUCT_STORAGE_KEY = 'ra_intermediate_products'

export const INTERMEDIATE_PRODUCT_CATEGORIES: IntermediateProductCategory[] = [
  'Marine',
  'Sos',
  'Et',
  'Sebze',
  'Baz',
  'Hamur',
  'Genel'
]

export const INTERMEDIATE_PRODUCT_UNITS: IntermediateProductUnit[] = [
  'kg',
  'lt',
  'adet',
  'koli'
]

export const INTERMEDIATE_PRODUCT_STATUSES: IntermediateProductStatus[] = [
  'Aktif',
  'Kritik',
  'Pasif'
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const normalizeCategory = (value: unknown): IntermediateProductCategory => (
  INTERMEDIATE_PRODUCT_CATEGORIES.includes(value as IntermediateProductCategory)
    ? value as IntermediateProductCategory
    : 'Genel'
)

const normalizeUnit = (value: unknown): IntermediateProductUnit => (
  INTERMEDIATE_PRODUCT_UNITS.includes(value as IntermediateProductUnit)
    ? value as IntermediateProductUnit
    : 'kg'
)

const normalizeStatus = (value: unknown): IntermediateProductStatus => (
  INTERMEDIATE_PRODUCT_STATUSES.includes(value as IntermediateProductStatus)
    ? value as IntermediateProductStatus
    : 'Aktif'
)

export const resolveIntermediateProductStatus = (
  product: Pick<IntermediateProduct, 'currentStock' | 'minimumStock' | 'status'>
): IntermediateProductStatus => {
  if(product.status === 'Pasif') return 'Pasif'
  return product.minimumStock > 0 && product.currentStock <= product.minimumStock ? 'Kritik' : 'Aktif'
}

const normalizeStoredProduct = (
  item: Partial<IntermediateProduct>,
  index: number
): IntermediateProduct => {
  const currentStock = Number(item.currentStock)
  const minimumStock = Number(item.minimumStock)
  const createdAt = String(item.createdAt || new Date().toISOString())
  const product: IntermediateProduct = {
    id: String(item.id || `iproduct_${String(index + 1).padStart(3, '0')}`),
    code: String(item.code || `AU-${String(index + 1).padStart(3, '0')}`).trim(),
    name: String(item.name || 'Ara Ürün').trim() || 'Ara Ürün',
    category: normalizeCategory(item.category),
    unit: normalizeUnit(item.unit),
    currentStock: Number.isFinite(currentStock) ? currentStock : 0,
    minimumStock: Number.isFinite(minimumStock) ? Math.max(0, minimumStock) : 0,
    status: normalizeStatus(item.status),
    description: String(item.description || '').trim(),
    linkedRecipe: String(item.linkedRecipe || '').trim(),
    linkedFinalProducts: Array.isArray(item.linkedFinalProducts)
      ? item.linkedFinalProducts.map(value => String(value).trim()).filter(Boolean)
      : [],
    createdAt,
    updatedAt: item.updatedAt ? String(item.updatedAt) : createdAt
  }

  return {
    ...product,
    status: resolveIntermediateProductStatus(product)
  }
}

const product = (
  id: string,
  code: string,
  name: string,
  category: IntermediateProductCategory,
  unit: IntermediateProductUnit,
  currentStock: number,
  minimumStock: number,
  status: IntermediateProductStatus,
  description: string,
  createdAt: string
): IntermediateProduct => normalizeStoredProduct({
  id,
  code,
  name,
  category,
  unit,
  currentStock,
  minimumStock,
  status,
  description,
  linkedRecipe: '',
  linkedFinalProducts: [],
  createdAt,
  updatedAt: createdAt
}, 0)

export const createIntermediateProductMockData = (): IntermediateProduct[] => [
  product('iproduct_001', 'AU-001', 'Marine Tavuk', 'Marine', 'kg', 84, 35, 'Aktif', 'Tavuk ürünleri için standart marine edilmiş yarı mamul.', '2026-07-12T07:30:00.000Z'),
  product('iproduct_002', 'AU-002', 'Et Suyu', 'Baz', 'lt', 42, 60, 'Kritik', 'Sos ve çorba reçetelerinde kullanılan konsantre baz.', '2026-07-12T08:10:00.000Z'),
  product('iproduct_003', 'AU-003', 'Domates Sosu', 'Sos', 'kg', 118, 45, 'Aktif', 'Lazanya, pizza ve sıcak yemek üretiminde kullanılan ana sos.', '2026-07-12T09:15:00.000Z'),
  product('iproduct_004', 'AU-004', 'Patates Püresi', 'Sebze', 'kg', 52, 30, 'Aktif', 'Porsiyonlama öncesi hazır patates püresi.', '2026-07-13T06:50:00.000Z'),
  product('iproduct_005', 'AU-005', 'Köfte Harcı', 'Et', 'kg', 26, 40, 'Kritik', 'Şekillendirme öncesi dinlendirilmiş köfte karışımı.', '2026-07-13T08:20:00.000Z'),
  product('iproduct_006', 'AU-006', 'Beşamel Sos', 'Sos', 'kg', 68, 25, 'Aktif', 'Fırın ürünleri ve lazanya hazırlığında kullanılan sos.', '2026-07-13T11:30:00.000Z'),
  product('iproduct_007', 'AU-007', 'Pilav Bazı', 'Baz', 'kg', 34, 20, 'Aktif', 'Pilav üretimi için ön hazırlanmış sebzeli baz.', '2026-07-14T07:05:00.000Z'),
  product('iproduct_008', 'AU-008', 'Haşlanmış Makarna', 'Hamur', 'kg', 18, 18, 'Kritik', 'Fırın makarna ve sıcak servis hazırlığı için haşlanmış ürün.', '2026-07-14T08:40:00.000Z'),
  product('iproduct_009', 'AU-009', 'Pizza Sosu', 'Sos', 'kg', 0, 15, 'Pasif', 'Deneme üretimi sonrası pasife alınmış sos varyasyonu.', '2026-07-14T09:25:00.000Z'),
  product('iproduct_010', 'AU-010', 'Tavuk Marinasyonu', 'Marine', 'kg', 73, 35, 'Aktif', 'Günlük tavuk hazırlık üretiminde kullanılan marine karışımı.', '2026-07-15T06:35:00.000Z')
]

export const saveIntermediateProducts = (products: IntermediateProduct[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(INTERMEDIATE_PRODUCT_STORAGE_KEY, JSON.stringify(products.map(normalizeStoredProduct)))
}

export const loadIntermediateProducts = () => {
  const seedProducts = createIntermediateProductMockData()
  if(!isBrowserStorageAvailable()) return seedProducts

  const storedProducts = localStorage.getItem(INTERMEDIATE_PRODUCT_STORAGE_KEY)
  if(storedProducts === null){
    saveIntermediateProducts(seedProducts)
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

  saveIntermediateProducts(seedProducts)
  return seedProducts
}
