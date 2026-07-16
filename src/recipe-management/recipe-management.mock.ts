import type {
  RecipeIngredient,
  RecipeIngredientUnit,
  RecipeManagementRecord,
  RecipeManagementRole,
  RecipeManagementStatus,
  RecipeManagementType
} from './recipe-management.types'
import { convertToBaseUnit } from './recipe-unit-converter'

const RECIPE_MANAGEMENT_STORAGE_KEY = 'ra_recipes'

export const RECIPE_MANAGEMENT_TYPES: RecipeManagementType[] = [
  'Ana Ürün',
  'Ara Ürün'
]

export const RECIPE_MANAGEMENT_STATUSES: RecipeManagementStatus[] = [
  'Aktif',
  'Pasif'
]

export const RECIPE_MANAGEMENT_ROLES: RecipeManagementRole[] = [
  'PRIMARY',
  'ALTERNATIVE'
]

export const RECIPE_INGREDIENT_UNITS: RecipeIngredientUnit[] = [
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

export const RECIPE_PRODUCT_OPTIONS = [
  'Mercimek Çorbası',
  'Ezogelin',
  'Pilav',
  'Patates Püresi',
  'Köfte',
  'Pizza',
  'Lazanya',
  'Tavuk Döner',
  'Et Döner',
  'Domates Sosu'
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const DEMO_ALTERNATIVE_RECIPE_IDS = [
  'recipe_mgmt_010_alt_001',
  'recipe_mgmt_010_alt_002',
  'recipe_mgmt_011',
  'recipe_mgmt_011_alt_001'
]

const DEFAULT_INGREDIENT_UNIT_COST = 0

const DEMO_INGREDIENT_UNIT_COSTS: Record<string, number> = {
  'ayçiçek yağı': 0.12,
  'baldo pirinç': 0.08,
  'beşamel sos': 0.11,
  'beyaz biber': 0.3,
  'biber': 0.04,
  'bulgur': 0.055,
  'dana eti': 0.58,
  'dana kıyma': 0.5,
  'domates püresi': 0.035,
  'domates salçası': 0.09,
  'domates sosu': 0.045,
  'fesleğen': 0.24,
  'galeta unu': 0.05,
  'havuç': 0.018,
  'kaşar peyniri': 0.26,
  'karabiber': 0.28,
  'kekik': 0.2,
  'krema': 0.12,
  'kuru soğan': 0.025,
  'kuyruk yağı': 0.2,
  'kırmızı mercimek': 0.08,
  'kıymalı sos': 0.34,
  'kimyon': 0.24,
  'lazanya yaprağı': 0.09,
  'mantar': 0.07,
  'maydanoz': 0.035,
  'mozzarella': 0.28,
  'nane': 0.18,
  'patates': 0.022,
  'pirinç': 0.075,
  'pizza hamuru': 0.045,
  'pizza sosu': 0.055,
  'pul biber': 0.22,
  'sarımsak': 0.09,
  'soğan suyu': 0.018,
  'su': 0.001,
  'sucuk': 0.32,
  'süt': 0.035,
  'tavuk but': 0.18,
  'tavuk suyu': 0.03,
  'tereyağı': 0.24,
  'toz biber': 0.21,
  'tuz': 0.02,
  'un': 0.025,
  'yoğurt': 0.045,
  'yumurta': 5,
  'zeytin': 0.16,
  'zeytinyağı': 0.22,
  'şeker': 0.035
}

const normalizeMaterialCostKey = (value: string) => (
  value.trim().toLocaleLowerCase('tr-TR')
)

const getDemoIngredientUnitCost = (materialName: string) => (
  DEMO_INGREDIENT_UNIT_COSTS[normalizeMaterialCostKey(materialName)] ?? DEFAULT_INGREDIENT_UNIT_COST
)

const normalizeRecipeType = (value: unknown): RecipeManagementType => (
  RECIPE_MANAGEMENT_TYPES.includes(value as RecipeManagementType)
    ? value as RecipeManagementType
    : 'Ana Ürün'
)

const normalizeRecipeStatus = (value: unknown, active?: unknown): RecipeManagementStatus => {
  if(RECIPE_MANAGEMENT_STATUSES.includes(value as RecipeManagementStatus)){
    return value as RecipeManagementStatus
  }

  return active === false ? 'Pasif' : 'Aktif'
}

const normalizeRecipeRole = (value: unknown): RecipeManagementRole => (
  RECIPE_MANAGEMENT_ROLES.includes(value as RecipeManagementRole)
    ? value as RecipeManagementRole
    : 'PRIMARY'
)

const normalizeIngredientUnit = (value: unknown): RecipeIngredientUnit => (
  RECIPE_INGREDIENT_UNITS.includes(value as RecipeIngredientUnit)
    ? value as RecipeIngredientUnit
    : 'gr'
)

const normalizeIngredientUnitCost = (value: unknown) => {
  const unitCost = Number(value)
  return Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : DEFAULT_INGREDIENT_UNIT_COST
}

const normalizeIngredient = (
  item: Partial<RecipeIngredient> & {
    rawMaterial?: unknown
    stockItemId?: unknown
    stockItemName?: unknown
    qty?: unknown
  },
  index: number
): RecipeIngredient => {
  const quantity = Number(item.quantity ?? item.qty)
  const normalizedQuantity = Number.isFinite(quantity) ? quantity : 0
  const unit = normalizeIngredientUnit(item.unit)
  const baseConversion = convertToBaseUnit(normalizedQuantity, unit)
  const materialName = String(item.materialName || item.rawMaterial || item.stockItemName || '').trim()
  const unitCost = normalizeIngredientUnitCost(item.unitCost)

  return {
    id: String(item.id || item.stockItemId || `recipe_ing_${String(index + 1).padStart(3, '0')}`),
    materialName,
    quantity: normalizedQuantity,
    unit,
    baseQuantity: baseConversion.baseQuantity,
    baseUnit: baseConversion.baseUnit,
    unitCost
  }
}

const normalizeIngredients = (item: Partial<RecipeManagementRecord> & { items?: unknown }): RecipeIngredient[] => {
  const recipeIngredients = Array.isArray(item.ingredients)
    ? item.ingredients
      .map((ingredient, index) => normalizeIngredient(ingredient as Partial<RecipeIngredient>, index))
      .filter(ingredient => ingredient.materialName && ingredient.quantity > 0)
    : []

  if(recipeIngredients.length > 0) return recipeIngredients

  const sourceItems = Array.isArray(item.items) ? item.items : []

  return sourceItems
    .map((ingredient, index) => normalizeIngredient(ingredient as Partial<RecipeIngredient>, index))
    .filter(ingredient => ingredient.materialName && ingredient.quantity > 0)
}

const normalizeStoredRecipe = (
  item: Partial<RecipeManagementRecord> & {
    name?: unknown
    productName?: unknown
    product?: unknown
    note?: unknown
    active?: unknown
    items?: unknown
  },
  index: number
): RecipeManagementRecord => {
  const portions = Number(item.portions)
  const now = new Date().toISOString()
  const productName = String(item.productName || item.product || RECIPE_PRODUCT_OPTIONS[index % RECIPE_PRODUCT_OPTIONS.length]).trim()
  const recipeName = String(item.recipeName || item.name || productName || `Reçete ${index + 1}`).trim()
  const createdAt = String(item.createdAt || now)
  const recipeRole = normalizeRecipeRole(item.recipeRole)
  const parentRecipeId = recipeRole === 'ALTERNATIVE' && item.parentRecipeId
    ? String(item.parentRecipeId)
    : undefined

  return {
    id: String(item.id || `recipe_mgmt_${String(index + 1).padStart(3, '0')}`),
    code: String(item.code || `RC-${String(index + 1).padStart(3, '0')}`).trim(),
    recipeName: recipeName || `Reçete ${index + 1}`,
    recipeType: normalizeRecipeType(item.recipeType),
    recipeRole,
    parentRecipeId,
    productName: productName || recipeName || RECIPE_PRODUCT_OPTIONS[0],
    portions: Number.isFinite(portions) && portions > 0 ? portions : 1,
    status: normalizeRecipeStatus(item.status, item.active),
    description: String(item.description ?? item.note ?? '').trim(),
    ingredients: normalizeIngredients(item),
    createdAt,
    updatedAt: item.updatedAt ? String(item.updatedAt) : createdAt
  }
}

const ingredient = (
  materialName: string,
  quantity: number,
  unit: RecipeIngredientUnit,
  unitCost = getDemoIngredientUnitCost(materialName)
): RecipeIngredient => ({
  id: `recipe_ing_${Math.random().toString(16).slice(2)}`,
  materialName,
  quantity,
  unit,
  ...convertToBaseUnit(quantity, unit),
  unitCost
})

const recipe = (
  id: string,
  code: string,
  recipeName: string,
  recipeType: RecipeManagementType,
  productName: string,
  portions: number,
  status: RecipeManagementStatus,
  description: string,
  ingredients: RecipeIngredient[],
  updatedAt: string,
  recipeRole: RecipeManagementRole = 'PRIMARY',
  parentRecipeId?: string
): RecipeManagementRecord => normalizeStoredRecipe({
  id,
  code,
  recipeName,
  recipeType,
  recipeRole,
  parentRecipeId,
  productName,
  portions,
  status,
  description,
  ingredients,
  createdAt: updatedAt,
  updatedAt
}, 0)

const serializeRecipeForStorage = (record: RecipeManagementRecord, index: number) => {
  const normalizedRecord = normalizeStoredRecipe(record, index)

  return {
    ...normalizedRecord,
    branchId: 'branch_merkez',
    productId: normalizedRecord.productName,
    name: normalizedRecord.recipeName,
    version: 1,
    recipeVersion: 1,
    active: normalizedRecord.status === 'Aktif',
    note: normalizedRecord.description,
    createdByUserId: 'recipe-management',
    createdByFullName: 'MIYOP Demo',
    items: normalizedRecord.ingredients.map((ingredient, ingredientIndex) => ({
      id: ingredient.id || `${normalizedRecord.id}_item_${ingredientIndex + 1}`,
      stockItemId: ingredient.id || `${normalizedRecord.id}_stock_${ingredientIndex + 1}`,
      stockItemName: ingredient.materialName,
      qty: ingredient.quantity,
      unit: ingredient.unit,
      baseQuantity: ingredient.baseQuantity,
      baseUnit: ingredient.baseUnit,
      unitCost: ingredient.unitCost,
      wastePercent: 0,
      note: ''
    }))
  }
}

export const createRecipeManagementMockData = (): RecipeManagementRecord[] => [
  recipe('recipe_mgmt_001', 'RC-001', 'Mercimek Çorbası Standart Reçete', 'Ana Ürün', 'Mercimek Çorbası', 100, 'Aktif', 'Günlük üretim için standart mercimek çorbası reçetesi.', [
    ingredient('Kırmızı Mercimek', 12, 'kg'),
    ingredient('Kuru Soğan', 3, 'kg'),
    ingredient('Havuç', 2, 'kg'),
    ingredient('Domates Salçası', 1500, 'gr'),
    ingredient('Un', 1, 'kg'),
    ingredient('Tereyağı', 2, 'kg'),
    ingredient('Su', 85, 'lt'),
    ingredient('Tuz', 600, 'gr')
  ], '2026-07-15T08:10:00.000Z'),
  recipe('recipe_mgmt_002', 'RC-002', 'Ezogelin Çorbası', 'Ana Ürün', 'Ezogelin', 100, 'Aktif', 'Toplu yemek üretimi için ezogelin reçetesi.', [
    ingredient('Kırmızı Mercimek', 9, 'kg'),
    ingredient('Pirinç', 2, 'kg'),
    ingredient('Bulgur', 2, 'kg'),
    ingredient('Kuru Soğan', 3, 'kg'),
    ingredient('Domates Salçası', 1600, 'gr'),
    ingredient('Nane', 250, 'gr'),
    ingredient('Pul Biber', 200, 'gr'),
    ingredient('Su', 88, 'lt')
  ], '2026-07-15T08:35:00.000Z'),
  recipe('recipe_mgmt_003', 'RC-003', 'Pilav Ana Reçete', 'Ana Ürün', 'Pilav', 120, 'Aktif', 'Endüstriyel kazan pilav üretimi için baz reçete.', [
    ingredient('Baldo Pirinç', 18, 'kg'),
    ingredient('Tereyağı', 2.5, 'kg'),
    ingredient('Ayçiçek Yağı', 1.5, 'lt'),
    ingredient('Tavuk Suyu', 20, 'lt'),
    ingredient('Su', 16, 'lt'),
    ingredient('Tuz', 550, 'gr')
  ], '2026-07-15T09:00:00.000Z'),
  recipe('recipe_mgmt_004', 'RC-004', 'Patates Püresi', 'Ara Ürün', 'Patates Püresi', 90, 'Aktif', 'Paketleme ve tabaklama için ara ürün püre reçetesi.', [
    ingredient('Patates', 45, 'kg'),
    ingredient('Süt', 12, 'lt'),
    ingredient('Tereyağı', 3, 'kg'),
    ingredient('Krema', 4, 'lt'),
    ingredient('Tuz', 450, 'gr'),
    ingredient('Beyaz Biber', 80, 'gr')
  ], '2026-07-15T09:25:00.000Z'),
  recipe('recipe_mgmt_005', 'RC-005', 'Köfte Harcı', 'Ara Ürün', 'Köfte', 140, 'Aktif', 'Köfte şekillendirme öncesi standart harç reçetesi.', [
    ingredient('Dana Kıyma', 35, 'kg'),
    ingredient('Kuru Soğan', 5, 'kg'),
    ingredient('Galeta Unu', 4, 'kg'),
    ingredient('Yumurta', 60, 'adet'),
    ingredient('Tuz', 650, 'gr'),
    ingredient('Karabiber', 180, 'gr'),
    ingredient('Kimyon', 220, 'gr'),
    ingredient('Maydanoz', 1.2, 'kg')
  ], '2026-07-15T09:50:00.000Z'),
  recipe('recipe_mgmt_006', 'RC-006', 'Pizza Tepsi Reçetesi', 'Ana Ürün', 'Pizza', 80, 'Pasif', 'Pilot üretim reçetesi, kullanıcı testi için pasif tutuluyor.', [
    ingredient('Pizza Hamuru', 28, 'kg'),
    ingredient('Pizza Sosu', 9, 'kg'),
    ingredient('Mozzarella', 11, 'kg'),
    ingredient('Sucuk', 4, 'kg'),
    ingredient('Mantar', 3, 'kg'),
    ingredient('Biber', 2.5, 'kg'),
    ingredient('Zeytin', 1.8, 'kg')
  ], '2026-07-15T10:15:00.000Z'),
  recipe('recipe_mgmt_007', 'RC-007', 'Lazanya Reçetesi', 'Ana Ürün', 'Lazanya', 60, 'Aktif', 'Tepsi bazlı lazanya üretimi için reçete.', [
    ingredient('Lazanya Yaprağı', 14, 'kg'),
    ingredient('Kıymalı Sos', 28, 'kg'),
    ingredient('Beşamel Sos', 18, 'kg'),
    ingredient('Kaşar Peyniri', 7, 'kg'),
    ingredient('Domates Sosu', 8, 'kg'),
    ingredient('Tuz', 300, 'gr')
  ], '2026-07-15T10:40:00.000Z'),
  recipe('recipe_mgmt_008', 'RC-008', 'Tavuk Döner Marinasyon', 'Ara Ürün', 'Tavuk Döner', 150, 'Aktif', 'Döner hattı öncesi tavuk marinasyon reçetesi.', [
    ingredient('Tavuk But', 60, 'kg'),
    ingredient('Yoğurt', 8, 'kg'),
    ingredient('Ayçiçek Yağı', 4, 'lt'),
    ingredient('Domates Salçası', 3000, 'gr'),
    ingredient('Sarımsak', 1.5, 'kg'),
    ingredient('Tuz', 900, 'gr'),
    ingredient('Kekik', 250, 'gr'),
    ingredient('Toz Biber', 350, 'gr')
  ], '2026-07-15T11:05:00.000Z'),
  recipe('recipe_mgmt_009', 'RC-009', 'Et Döner Hazırlık', 'Ara Ürün', 'Et Döner', 120, 'Aktif', 'Et döner şiş dizimi öncesi hazırlık reçetesi.', [
    ingredient('Dana Eti', 55, 'kg'),
    ingredient('Kuyruk Yağı', 8, 'kg'),
    ingredient('Soğan Suyu', 5, 'lt'),
    ingredient('Süt', 4, 'lt'),
    ingredient('Zeytinyağı', 3, 'lt'),
    ingredient('Tuz', 800, 'gr'),
    ingredient('Karabiber', 220, 'gr'),
    ingredient('Kimyon', 180, 'gr')
  ], '2026-07-15T11:30:00.000Z'),
  recipe('recipe_mgmt_010', 'RC-010', 'Domates Sosu Bazı', 'Ara Ürün', 'Domates Sosu', 100, 'Aktif', 'Pizza, lazanya ve sıcak yemeklerde kullanılacak sos bazı.', [
    ingredient('Domates Püresi', 45, 'kg'),
    ingredient('Domates Salçası', 6000, 'gr'),
    ingredient('Kuru Soğan', 4, 'kg'),
    ingredient('Sarımsak', 1.2, 'kg'),
    ingredient('Zeytinyağı', 3, 'lt'),
    ingredient('Şeker', 800, 'gr'),
    ingredient('Tuz', 550, 'gr'),
    ingredient('Fesleğen', 180, 'gr')
  ], '2026-07-15T11:55:00.000Z'),
  recipe('recipe_mgmt_010_alt_001', 'RC-010-A', 'Domates Sosu Alternatif-1', 'Ara Ürün', 'Domates Sosu', 100, 'Aktif', 'Kuru soğan azaltılmış, daha yoğun salçalı alternatif domates sosu.', [
    ingredient('Domates Püresi', 42, 'kg'),
    ingredient('Domates Salçası', 8000, 'gr'),
    ingredient('Kuru Soğan', 2.5, 'kg'),
    ingredient('Sarımsak', 1.4, 'kg'),
    ingredient('Ayçiçek Yağı', 2.5, 'lt'),
    ingredient('Şeker', 700, 'gr'),
    ingredient('Tuz', 520, 'gr'),
    ingredient('Kekik', 160, 'gr')
  ], '2026-07-15T12:10:00.000Z', 'ALTERNATIVE', 'recipe_mgmt_010'),
  recipe('recipe_mgmt_010_alt_002', 'RC-010-B', 'Domates Sosu Alternatif-2', 'Ara Ürün', 'Domates Sosu', 100, 'Aktif', 'Zeytinyağı yerine ayçiçek yağı kullanılan ekonomik alternatif sos.', [
    ingredient('Domates Püresi', 48, 'kg'),
    ingredient('Domates Salçası', 5000, 'gr'),
    ingredient('Kuru Soğan', 4.5, 'kg'),
    ingredient('Sarımsak', 1, 'kg'),
    ingredient('Ayçiçek Yağı', 3.5, 'lt'),
    ingredient('Şeker', 900, 'gr'),
    ingredient('Tuz', 600, 'gr'),
    ingredient('Fesleğen', 120, 'gr')
  ], '2026-07-15T12:25:00.000Z', 'ALTERNATIVE', 'recipe_mgmt_010'),
  recipe('recipe_mgmt_011', 'RC-011', 'Pizza Hamuru Standart', 'Ara Ürün', 'Pizza Hamuru', 80, 'Aktif', 'Pizza üretimi için standart tepsi hamuru reçetesi.', [
    ingredient('Un', 35, 'kg'),
    ingredient('Su', 20, 'lt'),
    ingredient('Ayçiçek Yağı', 2, 'lt'),
    ingredient('Tuz', 700, 'gr'),
    ingredient('Şeker', 600, 'gr')
  ], '2026-07-15T12:40:00.000Z'),
  recipe('recipe_mgmt_011_alt_001', 'RC-011-A', 'Pizza Hamuru Alternatif', 'Ara Ürün', 'Pizza Hamuru', 80, 'Aktif', 'Daha yüksek hidrasyonlu alternatif pizza hamuru reçetesi.', [
    ingredient('Un', 34, 'kg'),
    ingredient('Su', 22, 'lt'),
    ingredient('Zeytinyağı', 1.5, 'lt'),
    ingredient('Tuz', 680, 'gr'),
    ingredient('Şeker', 550, 'gr')
  ], '2026-07-15T12:55:00.000Z', 'ALTERNATIVE', 'recipe_mgmt_011')
]

const mergeDemoAlternativeRecipes = (
  records: RecipeManagementRecord[],
  seedRecords: RecipeManagementRecord[]
) => {
  const existingIds = new Set(records.map(record => record.id))
  const existingCodes = new Set(records.map(record => record.code.trim().toLocaleLowerCase('tr-TR')))
  const mergedRecords = [...records]

  seedRecords
    .filter(record => DEMO_ALTERNATIVE_RECIPE_IDS.includes(record.id))
    .forEach(record => {
      const parentExists = !record.parentRecipeId || existingIds.has(record.parentRecipeId)
      const codeExists = existingCodes.has(record.code.trim().toLocaleLowerCase('tr-TR'))

      if(existingIds.has(record.id) || codeExists || !parentExists) return

      mergedRecords.push(record)
      existingIds.add(record.id)
      existingCodes.add(record.code.trim().toLocaleLowerCase('tr-TR'))
    })

  return mergedRecords
}

export const saveRecipeManagementRecords = (records: RecipeManagementRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(RECIPE_MANAGEMENT_STORAGE_KEY, JSON.stringify(records.map(serializeRecipeForStorage)))
}

export const loadRecipeManagementRecords = () => {
  const seedRecords = createRecipeManagementMockData()
  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(RECIPE_MANAGEMENT_STORAGE_KEY)
  if(storedRecords === null){
    saveRecipeManagementRecords(seedRecords)
    return seedRecords
  }

  try {
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = mergeDemoAlternativeRecipes(parsed.map(normalizeStoredRecipe), seedRecords)
      if(normalizedRecords.length > 0){
        saveRecipeManagementRecords(normalizedRecords)
        return normalizedRecords
      }
      saveRecipeManagementRecords(seedRecords)
      return seedRecords
    }
  } catch {
    // Corrupt local demo data is reset to the current recipe seed.
  }

  saveRecipeManagementRecords(seedRecords)
  return seedRecords
}
