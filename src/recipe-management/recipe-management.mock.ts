import type {
  RecipeIngredient,
  RecipeIngredientUnit,
  RecipeMasterStatus,
  RecipeManagementRecord,
  RecipeManagementRole,
  RecipeManagementStatus,
  RecipeManagementType,
  RecipeVersionStatus
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

export const RECIPE_MASTER_STATUSES: RecipeMasterStatus[] = [
  'Aktif',
  'Pasif',
  'Arşiv'
]

export const RECIPE_VERSION_STATUSES: RecipeVersionStatus[] = [
  'Taslak',
  'İncelemede',
  'Onaylandı',
  'Aktif',
  'Arşiv'
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
const DEFAULT_FIRE_PERCENT = 0
const MAX_FIRE_PERCENT = 100

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

const normalizeRecipeMasterStatus = (value: unknown, status: RecipeManagementStatus): RecipeMasterStatus => {
  if(RECIPE_MASTER_STATUSES.includes(value as RecipeMasterStatus)){
    return value as RecipeMasterStatus
  }

  return status === 'Aktif' ? 'Aktif' : 'Pasif'
}

const normalizeRecipeVersionStatus = (
  value: unknown,
  status: RecipeManagementStatus,
  active?: unknown
): RecipeVersionStatus => {
  if(RECIPE_VERSION_STATUSES.includes(value as RecipeVersionStatus)){
    return value as RecipeVersionStatus
  }

  if(active === false || status === 'Pasif') return 'Arşiv'
  return 'Aktif'
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

const normalizeFirePercent = (value: unknown) => {
  const firePercent = Number(value)
  if(!Number.isFinite(firePercent)) return DEFAULT_FIRE_PERCENT

  return Math.min(MAX_FIRE_PERCENT, Math.max(DEFAULT_FIRE_PERCENT, firePercent))
}

const normalizePositiveInteger = (value: unknown, fallback: number) => {
  const numericValue = Number(value)
  if(!Number.isFinite(numericValue) || numericValue <= 0) return fallback
  return Math.floor(numericValue)
}

const normalizeNonNegativeInteger = (value: unknown, fallback: number) => {
  const numericValue = Number(value)
  if(!Number.isFinite(numericValue) || numericValue < 0) return fallback
  return Math.round(numericValue)
}

const normalizeYieldPercent = (value: unknown, firePercent: number) => {
  const numericValue = Number(value)
  if(Number.isFinite(numericValue) && numericValue >= 0 && numericValue <= 100){
    return numericValue
  }

  return Math.max(0, Math.min(100, 100 - firePercent))
}

const createRecipeMasterId = (id: string, code: string) => {
  const normalizedCode = code
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return `recipe_master_${normalizedCode || id}`
}

const getRecipeTimingDefaults = (index: number, recipeType: RecipeManagementType) => {
  const basePreparation = recipeType === 'Ara Ürün' ? 18 : 24
  const baseCooking = recipeType === 'Ara Ürün' ? 22 : 36
  const preparationMinutes = basePreparation + (index % 5) * 4
  const cookingMinutes = baseCooking + (index % 6) * 6
  const restingMinutes = (index % 4) * 5

  return {
    preparationMinutes,
    cookingMinutes,
    restingMinutes
  }
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
    recipeMasterId?: unknown
    version?: unknown
    recipeVersion?: unknown
    createdByFullName?: unknown
  },
  index: number
): RecipeManagementRecord => {
  const portions = Number(item.portions)
  const now = new Date().toISOString()
  const productName = String(item.productName || item.product || RECIPE_PRODUCT_OPTIONS[index % RECIPE_PRODUCT_OPTIONS.length]).trim()
  const recipeName = String(item.recipeName || item.name || productName || `Reçete ${index + 1}`).trim()
  const createdAt = String(item.createdAt || now)
  const recipeRole = normalizeRecipeRole(item.recipeRole)
  const code = String(item.code || `RC-${String(index + 1).padStart(3, '0')}`).trim()
  const parentRecipeId = recipeRole === 'ALTERNATIVE' && item.parentRecipeId
    ? String(item.parentRecipeId)
    : undefined
  const firePercent = normalizeFirePercent(item.firePercent)
  const recipeType = normalizeRecipeType(item.recipeType)
  const legacyStatus = normalizeRecipeStatus(item.status, item.active)
  const versionNo = normalizePositiveInteger(item.versionNo ?? item.recipeVersion ?? item.version, 1)
  const versionStatus = normalizeRecipeVersionStatus(
    item.versionStatus,
    legacyStatus,
    item.isActiveVersion ?? item.active
  )
  const isActiveVersion = typeof item.isActiveVersion === 'boolean'
    ? item.isActiveVersion
    : versionStatus === 'Aktif'
  const status = isActiveVersion ? 'Aktif' : 'Pasif'
  const id = String(item.id || `recipe_mgmt_${String(index + 1).padStart(3, '0')}`)
  const masterId = String(item.masterId || item.recipeMasterId || createRecipeMasterId(id, code))
  const timingDefaults = getRecipeTimingDefaults(index, recipeType)
  const preparationMinutes = normalizeNonNegativeInteger(item.preparationMinutes, timingDefaults.preparationMinutes)
  const cookingMinutes = normalizeNonNegativeInteger(item.cookingMinutes, timingDefaults.cookingMinutes)
  const restingMinutes = normalizeNonNegativeInteger(item.restingMinutes, timingDefaults.restingMinutes)
  const totalMinutes = normalizeNonNegativeInteger(
    item.totalMinutes,
    preparationMinutes + cookingMinutes + restingMinutes
  )

  return {
    id,
    code,
    recipeName: recipeName || `Reçete ${index + 1}`,
    recipeType,
    recipeRole,
    parentRecipeId,
    productName: productName || recipeName || RECIPE_PRODUCT_OPTIONS[0],
    portions: Number.isFinite(portions) && portions > 0 ? portions : 1,
    firePercent,
    status,
    description: String(item.description ?? item.note ?? '').trim(),
    ingredients: normalizeIngredients(item),
    createdAt,
    updatedAt: item.updatedAt ? String(item.updatedAt) : createdAt,
    masterId,
    masterCode: String(item.masterCode || code).trim(),
    masterName: String(item.masterName || recipeName || productName).trim(),
    masterStatus: normalizeRecipeMasterStatus(item.masterStatus, status),
    versionNo,
    versionStatus,
    versionDescription: String(item.versionDescription ?? item.description ?? item.note ?? '').trim(),
    createdBy: String(item.createdBy || item.createdByFullName || 'MIYOP Demo').trim(),
    publishedAt: item.publishedAt ? String(item.publishedAt) : (isActiveVersion ? String(item.updatedAt || createdAt) : undefined),
    isActiveVersion,
    revisionNote: String(item.revisionNote || (versionNo === 1 ? 'İlk yayın' : 'Versiyon revizyonu')).trim(),
    archivedAt: item.archivedAt ? String(item.archivedAt) : undefined,
    preparationMinutes,
    cookingMinutes,
    restingMinutes,
    totalMinutes,
    yieldPercent: normalizeYieldPercent(item.yieldPercent, firePercent)
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
  parentRecipeId?: string,
  firePercent = DEFAULT_FIRE_PERCENT
): RecipeManagementRecord => normalizeStoredRecipe({
  id,
  code,
  recipeName,
  recipeType,
  recipeRole,
  parentRecipeId,
  productName,
  portions,
  firePercent,
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
    version: normalizedRecord.versionNo || 1,
    recipeVersion: normalizedRecord.versionNo || 1,
    active: Boolean(normalizedRecord.isActiveVersion),
    note: normalizedRecord.description,
    createdByUserId: 'recipe-management',
    createdByFullName: normalizedRecord.createdBy || 'MIYOP Demo',
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

const getRecipeVersionSortTime = (record: RecipeManagementRecord) => {
  const timestamp = Date.parse(record.publishedAt || record.updatedAt || record.createdAt || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

export const enforceSingleActiveRecipeVersions = (records: RecipeManagementRecord[]) => {
  const normalizedRecords = records.map(normalizeStoredRecipe)
  const recordsByMasterId = normalizedRecords.reduce<Map<string, RecipeManagementRecord[]>>((map, record) => {
    const masterId = record.masterId || createRecipeMasterId(record.id, record.code)
    map.set(masterId, [...(map.get(masterId) || []), record])
    return map
  }, new Map())
  const nextRecordsById = new Map<string, RecipeManagementRecord>()

  recordsByMasterId.forEach(masterRecords => {
    const activeRecord = masterRecords
      .filter(record => record.isActiveVersion || record.versionStatus === 'Aktif' || record.status === 'Aktif')
      .sort((first, second) => (
        (second.versionNo || 0) - (first.versionNo || 0)
        || getRecipeVersionSortTime(second) - getRecipeVersionSortTime(first)
      ))[0]
    const hasActiveVersion = Boolean(activeRecord)
    const masterStatus: RecipeMasterStatus = hasActiveVersion
      ? 'Aktif'
      : masterRecords.every(record => record.versionStatus === 'Arşiv')
        ? 'Arşiv'
        : 'Pasif'

    masterRecords.forEach(record => {
      const isActiveVersion = activeRecord?.id === record.id
      const versionStatus: RecipeVersionStatus = isActiveVersion
        ? 'Aktif'
        : record.versionStatus === 'Aktif'
          ? 'Arşiv'
          : record.versionStatus || 'Arşiv'

      nextRecordsById.set(record.id, {
        ...record,
        status: isActiveVersion ? 'Aktif' : 'Pasif',
        versionStatus,
        isActiveVersion,
        masterStatus,
        publishedAt: isActiveVersion ? record.publishedAt || record.updatedAt || record.createdAt : record.publishedAt
      })
    })
  })

  return normalizedRecords.map(record => nextRecordsById.get(record.id) || record)
}

const createBaseRecipeManagementMockData = (): RecipeManagementRecord[] => [
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

const createAdditionalRecipeManagementSeedData = (): RecipeManagementRecord[] => [
  recipe('recipe_mgmt_012', 'RC-012', 'Yayla Çorbası Standart Reçete', 'Ana Ürün', 'Yayla Çorbası', 100, 'Aktif', 'Yoğurt bazlı toplu üretim çorba reçetesi.', [
    ingredient('Yoğurt', 16, 'kg'),
    ingredient('Pirinç', 4, 'kg'),
    ingredient('Un', 2, 'kg'),
    ingredient('Yumurta', 45, 'adet'),
    ingredient('Tereyağı', 1.8, 'kg'),
    ingredient('Nane', 220, 'gr'),
    ingredient('Su', 82, 'lt'),
    ingredient('Tuz', 520, 'gr')
  ], '2026-07-16T08:10:00.000Z'),
  recipe('recipe_mgmt_013', 'RC-013', 'Sebzeli Bulgur Pilavı', 'Ana Ürün', 'Sebzeli Bulgur Pilavı', 120, 'Aktif', 'Tabldot servis için sebzeli bulgur pilavı reçetesi.', [
    ingredient('Bulgur', 20, 'kg'),
    ingredient('Kuru Soğan', 4, 'kg'),
    ingredient('Havuç', 4, 'kg'),
    ingredient('Biber', 3, 'kg'),
    ingredient('Domates Salçası', 2400, 'gr'),
    ingredient('Ayçiçek Yağı', 3, 'lt'),
    ingredient('Su', 34, 'lt'),
    ingredient('Tuz', 640, 'gr')
  ], '2026-07-16T08:35:00.000Z'),
  recipe('recipe_mgmt_014', 'RC-014', 'Fırın Köfte Ana Reçete', 'Ana Ürün', 'Fırın Köfte', 110, 'Aktif', 'Fırın hattı için tepsi köfte reçetesi.', [
    ingredient('Köfte', 42, 'kg', 0.45),
    ingredient('Patates', 35, 'kg'),
    ingredient('Domates Sosu', 10, 'kg'),
    ingredient('Biber', 4, 'kg'),
    ingredient('Ayçiçek Yağı', 2, 'lt'),
    ingredient('Tuz', 500, 'gr'),
    ingredient('Kekik', 120, 'gr')
  ], '2026-07-16T09:00:00.000Z'),
  recipe('recipe_mgmt_015', 'RC-015', 'Tavuk Sote Reçetesi', 'Ana Ürün', 'Tavuk Sote', 120, 'Aktif', 'Sıcak yemek hattı için tavuk sote reçetesi.', [
    ingredient('Tavuk But', 48, 'kg'),
    ingredient('Kuru Soğan', 6, 'kg'),
    ingredient('Biber', 6, 'kg'),
    ingredient('Domates Püresi', 12, 'kg'),
    ingredient('Ayçiçek Yağı', 3, 'lt'),
    ingredient('Tuz', 650, 'gr'),
    ingredient('Karabiber', 140, 'gr')
  ], '2026-07-16T09:25:00.000Z'),
  recipe('recipe_mgmt_016', 'RC-016', 'Mevsim Salata Bazı', 'Ara Ürün', 'Mevsim Salata', 100, 'Aktif', 'Paket salata üretimi için sebze baz reçetesi.', [
    ingredient('Marul', 18, 'kg', 0.04),
    ingredient('Havuç', 6, 'kg'),
    ingredient('Lahana', 10, 'kg', 0.025),
    ingredient('Mısır', 4, 'kg', 0.075),
    ingredient('Zeytinyağı', 1.5, 'lt'),
    ingredient('Limon Sosu', 2, 'lt', 0.09),
    ingredient('Tuz', 250, 'gr')
  ], '2026-07-16T09:50:00.000Z'),
  recipe('recipe_mgmt_017', 'RC-017', 'Sütlaç Reçetesi', 'Ana Ürün', 'Sütlaç', 160, 'Aktif', 'Paket tatlı hattı için sütlaç reçetesi.', [
    ingredient('Süt', 80, 'lt'),
    ingredient('Pirinç', 8, 'kg'),
    ingredient('Şeker', 12, 'kg'),
    ingredient('Nişasta', 2.5, 'kg', 0.045),
    ingredient('Vanilin', 300, 'gr', 0.18),
    ingredient('Tarçın', 220, 'gr', 0.2)
  ], '2026-07-16T10:15:00.000Z'),
  recipe('recipe_mgmt_018', 'RC-018', 'Paketli Sandviç Reçetesi', 'Ana Ürün', 'Paketli Sandviç', 200, 'Aktif', 'Soğuk üretim hattı için paketli sandviç reçetesi.', [
    ingredient('Sandviç Ekmeği', 200, 'adet', 4.5),
    ingredient('Kaşar Peyniri', 12, 'kg'),
    ingredient('Hindi Füme', 16, 'kg', 0.34),
    ingredient('Marul', 5, 'kg', 0.04),
    ingredient('Domates', 7, 'kg', 0.05),
    ingredient('Mayonez', 4, 'kg', 0.08)
  ], '2026-07-16T10:40:00.000Z'),
  recipe('recipe_mgmt_019', 'RC-019', 'Diyet Menü Seti', 'Ana Ürün', 'Diyet Menü Seti', 80, 'Aktif', 'Düşük kalorili öğle menüsü set reçetesi.', [
    ingredient('Izgara Tavuk', 24, 'kg', 0.23),
    ingredient('Bulgur', 10, 'kg'),
    ingredient('Brokoli', 12, 'kg', 0.08),
    ingredient('Havuç', 5, 'kg'),
    ingredient('Zeytinyağı', 1.2, 'lt'),
    ingredient('Tuz', 320, 'gr')
  ], '2026-07-16T11:05:00.000Z'),
  recipe('recipe_mgmt_020', 'RC-020', 'Vakum Pişmiş Et', 'Ara Ürün', 'Vakum Pişmiş Et', 70, 'Aktif', 'Sous-vide hattı sonrası porsiyonlanacak yarı mamul et reçetesi.', [
    ingredient('Dana Eti', 52, 'kg'),
    ingredient('Zeytinyağı', 2.2, 'lt'),
    ingredient('Sarımsak', 1, 'kg'),
    ingredient('Kekik', 180, 'gr'),
    ingredient('Karabiber', 180, 'gr'),
    ingredient('Tuz', 720, 'gr')
  ], '2026-07-16T11:30:00.000Z')
]

const createVersionedSeedRecord = (
  record: RecipeManagementRecord,
  versionNo: number,
  activeVersionNo: number,
  seedIndex: number
) => {
  const isActiveVersion = versionNo === activeVersionNo
  const versionGap = activeVersionNo - versionNo
  const masterId = record.masterId || createRecipeMasterId(record.id, record.code)
  const quantityFactor = Math.max(0.9, 1 - versionGap * 0.025)
  const costFactor = Math.max(0.92, 1 - versionGap * 0.015)
  const ingredients = record.ingredients.map((sourceIngredient, ingredientIndex) => {
    const quantity = Math.round((sourceIngredient.quantity * quantityFactor + Number.EPSILON) * 1000) / 1000

    return {
      ...sourceIngredient,
      id: `${record.id}_v${versionNo}_ing_${String(ingredientIndex + 1).padStart(2, '0')}`,
      quantity,
      ...convertToBaseUnit(quantity, sourceIngredient.unit),
      unitCost: Math.round((sourceIngredient.unitCost * costFactor + Number.EPSILON) * 1000) / 1000
    }
  })

  return normalizeStoredRecipe({
    ...record,
    id: isActiveVersion ? record.id : `${record.id}_v${versionNo}`,
    masterId,
    masterCode: record.masterCode || record.code,
    masterName: record.masterName || record.recipeName,
    masterStatus: isActiveVersion ? 'Aktif' : record.masterStatus || 'Aktif',
    versionNo,
    versionStatus: isActiveVersion ? 'Aktif' : 'Arşiv',
    versionDescription: `${record.recipeName} V${versionNo} kurumsal reçete versiyonu.`,
    revisionNote: versionNo === 1 ? 'İlk yayın' : `V${versionNo} gramaj, fire ve maliyet revizyonu`,
    isActiveVersion,
    status: isActiveVersion ? 'Aktif' : 'Pasif',
    publishedAt: isActiveVersion ? record.updatedAt || record.createdAt : undefined,
    archivedAt: isActiveVersion ? undefined : record.updatedAt || record.createdAt,
    firePercent: Math.max(0, Math.round(((record.firePercent || 0) + versionGap * 0.2) * 100) / 100),
    preparationMinutes: (record.preparationMinutes || 24) + versionGap * 2,
    cookingMinutes: (record.cookingMinutes || 36) + versionGap * 3,
    restingMinutes: record.restingMinutes || 0,
    totalMinutes: (record.totalMinutes || 60) + versionGap * 5,
    yieldPercent: Math.max(70, Math.min(100, (record.yieldPercent || 100 - (record.firePercent || 0)) - versionGap * 0.4)),
    ingredients
  }, seedIndex)
}

const createRecipeVersionSeedData = (baseRecords: RecipeManagementRecord[]) => {
  const primaryRecords = baseRecords.filter(record => record.recipeRole === 'PRIMARY')
  const alternativeRecords = baseRecords.filter(record => record.recipeRole === 'ALTERNATIVE')
  const versionedPrimaryRecords = primaryRecords.flatMap((record, index) => {
    const activeVersionNo = index < 15 ? 3 : 2
    return Array.from({ length: activeVersionNo }, (_, versionIndex) => (
      createVersionedSeedRecord(record, versionIndex + 1, activeVersionNo, index)
    ))
  })
  const normalizedAlternativeRecords = alternativeRecords.map((record, index) => (
    createVersionedSeedRecord(record, 1, 1, primaryRecords.length + index)
  ))

  return enforceSingleActiveRecipeVersions([
    ...versionedPrimaryRecords,
    ...normalizedAlternativeRecords
  ])
}

export const createRecipeManagementMockData = (): RecipeManagementRecord[] => (
  createRecipeVersionSeedData([
    ...createBaseRecipeManagementMockData(),
    ...createAdditionalRecipeManagementSeedData()
  ])
)

const mergeDemoAlternativeRecipes = (
  records: RecipeManagementRecord[],
  seedRecords: RecipeManagementRecord[]
) => {
  const existingIds = new Set(records.map(record => record.id))
  const existingVersionKeys = new Set(records.map(record => `${record.masterId || record.id}::${record.versionNo || 1}`))
  const mergedRecords = [...records]

  seedRecords
    .forEach(record => {
      const parentExists = !record.parentRecipeId || existingIds.has(record.parentRecipeId) || DEMO_ALTERNATIVE_RECIPE_IDS.includes(record.id)
      const versionKey = `${record.masterId || record.id}::${record.versionNo || 1}`

      if(existingVersionKeys.has(versionKey) || !parentExists) return

      const nextRecord = existingIds.has(record.id)
        ? { ...record, id: `${record.id}_seed_v${record.versionNo || 1}` }
        : record

      mergedRecords.push(nextRecord)
      existingIds.add(nextRecord.id)
      existingVersionKeys.add(versionKey)
    })

  return enforceSingleActiveRecipeVersions(mergedRecords)
}

export const saveRecipeManagementRecords = (records: RecipeManagementRecord[]) => {
  if(!isBrowserStorageAvailable()) return
  const normalizedRecords = enforceSingleActiveRecipeVersions(records)
  localStorage.setItem(RECIPE_MANAGEMENT_STORAGE_KEY, JSON.stringify(normalizedRecords.map(serializeRecipeForStorage)))
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
