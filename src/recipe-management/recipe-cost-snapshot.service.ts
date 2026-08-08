import {
  createRecipeManagementMockData,
  loadRecipeManagementRecords
} from './recipe-management.mock'
import {
  RecipeSnapshotService
} from './recipe-snapshot.service'
import type {
  RecipeManagementRecord
} from './recipe-management.types'
import type {
  IngredientSnapshot,
  RecipeSnapshot
} from './recipe-snapshot.types'
import type {
  CostSnapshotCurrency,
  HistoricalCostSnapshot,
  HistoricalCostSnapshotCreateInput,
  HistoricalCostSnapshotDiffRow,
  HistoricalCostTrendPoint,
  HistoricalCostTrendSummary,
  IngredientCostSnapshot
} from './recipe-cost-snapshot.types'

const HISTORICAL_COST_SNAPSHOT_STORAGE_KEY = 'ra_recipe_historical_cost_snapshots'
const COST_SNAPSHOT_NO_PREFIX = 'HCS'
const SEED_COST_SNAPSHOT_MIN_COUNT = 200
const SEED_INGREDIENT_COST_SNAPSHOT_MIN_COUNT = 1500
const DEFAULT_CURRENCY: CostSnapshotCurrency = 'TRY'

const SUPPLIERS = [
  'Anadolu Gıda Tedarik',
  'Marmara Endüstriyel Ürünler',
  'Ege Soğuk Zincir',
  'Akdeniz Kurumsal Gıda',
  'Trakya Et ve Süt',
  'İstanbul Horeca Tedarik'
]

const COST_COMPONENTS = [
  { key: 'totalMaterialCost', label: 'Hammadde maliyeti' },
  { key: 'totalLaborCost', label: 'İşçilik' },
  { key: 'totalEnergyCost', label: 'Enerji' },
  { key: 'totalPackagingCost', label: 'Paketleme' },
  { key: 'totalWasteCost', label: 'Fire' },
  { key: 'totalLogisticsCost', label: 'Lojistik' },
  { key: 'totalOverheadCost', label: 'Genel gider' },
  { key: 'grandTotalCost', label: 'Toplam maliyet' },
  { key: 'unitCost', label: 'Birim maliyet' }
] as const

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeNumber = (
  value: unknown,
  fallback = 0
) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
}

const normalizeNonNegativeNumber = (
  value: unknown,
  fallback = 0
) => Math.max(0, normalizeNumber(value, fallback))

const normalizePositiveNumber = (
  value: unknown,
  fallback = 1
) => {
  const numericValue = normalizeNumber(value, fallback)
  return numericValue > 0 ? numericValue : fallback
}

const roundMoney = (value: number) => (
  Math.round((value + Number.EPSILON) * 100) / 100
)

const roundPercent = (value: number) => (
  Math.round((value + Number.EPSILON) * 100) / 100
)

const formatNumber = (value: number) => value.toLocaleString('tr-TR', {
  maximumFractionDigits: 2
})

const formatCurrency = (
  value: number,
  currency: CostSnapshotCurrency = DEFAULT_CURRENCY
) => `${value.toLocaleString('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})} ${currency}`

const formatPercent = (value: number) => `${value.toLocaleString('tr-TR', {
  maximumFractionDigits: 2
})} %`

const percent = (
  value: number,
  total: number
) => total !== 0 ? roundPercent((value / total) * 100) : 0

const getDateKey = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '2026-01-01'
  return date.toISOString().slice(0, 10)
}

const getMonthKey = (value: string) => getDateKey(value).slice(0, 7)

const getWeekKey = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '2026-H01'

  const firstDay = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const dayDifference = Math.floor((date.getTime() - firstDay.getTime()) / 86400000)
  const weekNo = Math.max(1, Math.ceil((dayDifference + firstDay.getUTCDay() + 1) / 7))
  return `${date.getUTCFullYear()}-H${String(weekNo).padStart(2, '0')}`
}

const getSafeTimestamp = (value: string) => {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

const getSnapshotDate = (
  index: number
) => new Date(Date.UTC(2026, index % 7, 1 + (index % 28), 7 + (index % 9), (index * 13) % 60)).toISOString()

const createCostSnapshotNo = (
  snapshotDate: string,
  index: number
) => `${COST_SNAPSHOT_NO_PREFIX}-${getDateKey(snapshotDate).replace(/-/g, '')}-${String(index + 1).padStart(5, '0')}`

export const createHistoricalCostSnapshotId = (
  recipeSnapshotId: string,
  productionOrderId: string
) => {
  const rawKey = `${recipeSnapshotId}_${productionOrderId}`
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return `historical_cost_snapshot_${rawKey || 'cost'}`
}

const normalizeCurrency = (value: unknown): CostSnapshotCurrency => {
  const currency = normalizeText(value).toLocaleUpperCase('tr-TR')
  if(currency === 'USD' || currency === 'EUR' || currency === 'TRY') return currency
  return DEFAULT_CURRENCY
}

const getRecipePortions = (
  recipeSnapshot: RecipeSnapshot,
  recipeRecord?: RecipeManagementRecord
) => {
  if(recipeRecord && Number.isFinite(recipeRecord.portions) && recipeRecord.portions > 0) return recipeRecord.portions

  const totalBaseQuantity = recipeSnapshot.ingredients.reduce((sum, ingredient) => (
    sum + normalizeNonNegativeNumber(ingredient.baseQuantity)
  ), 0)
  return Math.max(1, Math.round(totalBaseQuantity / 350))
}

const getPriceFactor = (
  snapshotIndex: number,
  ingredientIndex: number
) => {
  const trendFactor = 0.94 + (snapshotIndex % 32) * 0.006
  const materialFactor = 0.96 + ((snapshotIndex + ingredientIndex * 3) % 9) * 0.012
  const seasonalFactor = snapshotIndex % 11 === 0 ? 1.045 : 1
  return trendFactor * materialFactor * seasonalFactor
}

const getPriceDate = (
  snapshotDate: string,
  index: number
) => {
  const timestamp = getSafeTimestamp(snapshotDate)
  const baseDate = timestamp > 0 ? new Date(timestamp) : new Date(Date.UTC(2026, 0, 1))
  baseDate.setUTCDate(baseDate.getUTCDate() - (3 + (index % 18)))
  return baseDate.toISOString()
}

const createIngredientCostSnapshot = (
  costSnapshotId: string,
  ingredient: IngredientSnapshot,
  snapshotDate: string,
  snapshotIndex: number,
  ingredientIndex: number,
  currency: CostSnapshotCurrency
): IngredientCostSnapshot => {
  const quantity = normalizeNonNegativeNumber(ingredient.baseQuantity)
  const unitPrice = roundMoney(normalizeNonNegativeNumber(ingredient.unitCost) * getPriceFactor(snapshotIndex, ingredientIndex))
  const lineTotal = roundMoney(quantity * unitPrice)

  return {
    id: `${costSnapshotId}_ingredient_cost_${String(ingredientIndex + 1).padStart(3, '0')}`,
    costSnapshotId,
    ingredientId: ingredient.ingredientId,
    materialId: ingredient.materialId,
    materialCode: ingredient.materialCode,
    materialName: ingredient.materialName,
    quantity,
    unit: ingredient.baseUnit,
    unitPrice,
    currency,
    lineTotal,
    supplier: SUPPLIERS[(snapshotIndex + ingredientIndex) % SUPPLIERS.length],
    priceDate: getPriceDate(snapshotDate, snapshotIndex + ingredientIndex)
  }
}

const calculateCostComponents = (
  materialCost: number,
  firePercent: number,
  index: number
) => {
  const laborRate = 0.09 + (index % 5) * 0.008
  const energyRate = 0.028 + (index % 4) * 0.006
  const packagingRate = 0.032 + (index % 6) * 0.004
  const logisticsRate = 0.024 + (index % 5) * 0.005
  const overheadRate = 0.052 + (index % 4) * 0.007
  const wasteRate = Math.max(0, Math.min(35, firePercent)) / 100

  return {
    totalLaborCost: roundMoney(materialCost * laborRate),
    totalEnergyCost: roundMoney(materialCost * energyRate),
    totalPackagingCost: roundMoney(materialCost * packagingRate),
    totalLogisticsCost: roundMoney(materialCost * logisticsRate),
    totalWasteCost: roundMoney(materialCost * wasteRate),
    totalOverheadCost: roundMoney(materialCost * overheadRate)
  }
}

export const createHistoricalCostSnapshotFromRecipeSnapshot = (
  recipeSnapshot: RecipeSnapshot,
  input: HistoricalCostSnapshotCreateInput = {},
  index = 0,
  recipeRecord?: RecipeManagementRecord
): HistoricalCostSnapshot => {
  const snapshotDate = input.snapshotDate || recipeSnapshot.snapshotDate || new Date().toISOString()
  const currency = input.currency || DEFAULT_CURRENCY
  const id = createHistoricalCostSnapshotId(recipeSnapshot.id, recipeSnapshot.productionOrderId)
  const ingredients = recipeSnapshot.ingredients.map((ingredient, ingredientIndex) => (
    createIngredientCostSnapshot(id, ingredient, snapshotDate, index, ingredientIndex, currency)
  ))
  const totalMaterialCost = roundMoney(ingredients.reduce((sum, ingredient) => sum + ingredient.lineTotal, 0))
  const components = calculateCostComponents(totalMaterialCost, recipeSnapshot.firePercent, index)
  const grandTotalCost = roundMoney(
    totalMaterialCost
    + components.totalLaborCost
    + components.totalEnergyCost
    + components.totalPackagingCost
    + components.totalLogisticsCost
    + components.totalWasteCost
    + components.totalOverheadCost
  )
  const portions = getRecipePortions(recipeSnapshot, recipeRecord)

  return {
    id,
    snapshotNo: createCostSnapshotNo(snapshotDate, index),
    recipeSnapshotId: recipeSnapshot.id,
    recipeMasterId: recipeSnapshot.recipeMasterId,
    recipeVersionId: recipeSnapshot.recipeVersionId,
    versionNo: recipeSnapshot.versionNo,
    recipeCode: recipeSnapshot.recipeCode,
    recipeName: recipeSnapshot.recipeName,
    productName: recipeSnapshot.productName,
    productionOrderId: recipeSnapshot.productionOrderId,
    productionOrderNo: recipeSnapshot.productionOrderNo,
    snapshotDate,
    currency,
    totalMaterialCost,
    ...components,
    grandTotalCost,
    unitCost: roundMoney(grandTotalCost / portions),
    createdBy: input.createdBy || recipeSnapshot.createdBy || 'MIYOP Demo',
    ingredients,
    immutable: true
  }
}

const normalizeIngredientCostSnapshot = (
  item: Partial<IngredientCostSnapshot> & Record<string, unknown>,
  costSnapshotId: string,
  index: number,
  currency: CostSnapshotCurrency
): IngredientCostSnapshot => {
  const quantity = normalizeNonNegativeNumber(item.quantity)
  const unitPrice = normalizeNonNegativeNumber(item.unitPrice)

  return {
    id: normalizeText(item.id) || `${costSnapshotId}_ingredient_cost_${String(index + 1).padStart(3, '0')}`,
    costSnapshotId,
    ingredientId: normalizeText(item.ingredientId) || `ingredient_${index + 1}`,
    materialId: normalizeText(item.materialId) || normalizeText(item.ingredientId) || `material_${index + 1}`,
    materialCode: normalizeText(item.materialCode) || `HM-MALZEME-${String(index + 1).padStart(3, '0')}`,
    materialName: normalizeText(item.materialName) || 'Malzeme',
    quantity,
    unit: item.unit || 'gr',
    unitPrice,
    currency: normalizeCurrency(item.currency || currency),
    lineTotal: roundMoney(normalizeNonNegativeNumber(item.lineTotal, quantity * unitPrice)),
    supplier: normalizeText(item.supplier) || SUPPLIERS[index % SUPPLIERS.length],
    priceDate: normalizeText(item.priceDate) || new Date().toISOString()
  }
}

const normalizeHistoricalCostSnapshot = (
  item: Partial<HistoricalCostSnapshot> & Record<string, unknown>,
  index: number
): HistoricalCostSnapshot => {
  const snapshotDate = normalizeText(item.snapshotDate) || new Date().toISOString()
  const currency = normalizeCurrency(item.currency)
  const recipeSnapshotId = normalizeText(item.recipeSnapshotId) || `recipe_snapshot_${index + 1}`
  const productionOrderId = normalizeText(item.productionOrderId) || `production_order_${index + 1}`
  const id = normalizeText(item.id) || createHistoricalCostSnapshotId(recipeSnapshotId, productionOrderId)
  const ingredients = Array.isArray(item.ingredients)
    ? item.ingredients
      .filter(value => Boolean(value) && typeof value === 'object')
      .map((ingredient, ingredientIndex) => normalizeIngredientCostSnapshot(
        ingredient as Partial<IngredientCostSnapshot> & Record<string, unknown>,
        id,
        ingredientIndex,
        currency
      ))
    : []
  const totalMaterialCost = roundMoney(normalizeNonNegativeNumber(
    item.totalMaterialCost,
    ingredients.reduce((sum, ingredient) => sum + ingredient.lineTotal, 0)
  ))
  const totalLaborCost = roundMoney(normalizeNonNegativeNumber(item.totalLaborCost))
  const totalEnergyCost = roundMoney(normalizeNonNegativeNumber(item.totalEnergyCost))
  const totalPackagingCost = roundMoney(normalizeNonNegativeNumber(item.totalPackagingCost))
  const totalLogisticsCost = roundMoney(normalizeNonNegativeNumber(item.totalLogisticsCost))
  const totalWasteCost = roundMoney(normalizeNonNegativeNumber(item.totalWasteCost))
  const totalOverheadCost = roundMoney(normalizeNonNegativeNumber(item.totalOverheadCost))
  const grandTotalCost = roundMoney(normalizeNonNegativeNumber(
    item.grandTotalCost,
    totalMaterialCost + totalLaborCost + totalEnergyCost + totalPackagingCost + totalLogisticsCost + totalWasteCost + totalOverheadCost
  ))

  return {
    id,
    snapshotNo: normalizeText(item.snapshotNo) || createCostSnapshotNo(snapshotDate, index),
    recipeSnapshotId,
    recipeMasterId: normalizeText(item.recipeMasterId),
    recipeVersionId: normalizeText(item.recipeVersionId),
    versionNo: Math.max(1, Math.floor(normalizePositiveNumber(item.versionNo, 1))),
    recipeCode: normalizeText(item.recipeCode) || `RC-${String(index + 1).padStart(3, '0')}`,
    recipeName: normalizeText(item.recipeName) || 'Reçete',
    productName: normalizeText(item.productName),
    productionOrderId,
    productionOrderNo: normalizeText(item.productionOrderNo) || productionOrderId,
    snapshotDate,
    currency,
    totalMaterialCost,
    totalLaborCost,
    totalEnergyCost,
    totalPackagingCost,
    totalLogisticsCost,
    totalWasteCost,
    totalOverheadCost,
    grandTotalCost,
    unitCost: roundMoney(normalizeNonNegativeNumber(item.unitCost, grandTotalCost)),
    createdBy: normalizeText(item.createdBy) || 'MIYOP Demo',
    ingredients,
    immutable: true
  }
}

export const createHistoricalCostSnapshotSeedData = (
  recipeRecords: RecipeManagementRecord[] = createRecipeManagementMockData(),
  recipeSnapshots: RecipeSnapshot[] = RecipeSnapshotService.load(recipeRecords)
) => {
  const sourceRecipes = recipeRecords.length > 0 ? recipeRecords : createRecipeManagementMockData()
  const sourceSnapshots = recipeSnapshots.length > 0 ? recipeSnapshots : RecipeSnapshotService.createSeed(sourceRecipes)
  const recipesByVersionId = new Map(sourceRecipes.map(recipe => [recipe.id, recipe]))
  const snapshots: HistoricalCostSnapshot[] = []
  let ingredientCostSnapshotCount = 0
  let index = 0

  while(
    (
      snapshots.length < SEED_COST_SNAPSHOT_MIN_COUNT
      || ingredientCostSnapshotCount < SEED_INGREDIENT_COST_SNAPSHOT_MIN_COUNT
    )
    && index < 360
  ){
    const sourceSnapshot = sourceSnapshots[index % sourceSnapshots.length]
    const snapshotDate = getSnapshotDate(index)
    const productionOrderId = `production_order_historical_cost_${String(index + 1).padStart(4, '0')}`
    const recipeSnapshotTemplate: RecipeSnapshot = {
      ...sourceSnapshot,
      productionOrderId,
      productionOrderNo: `UE-COST-2026-${String(800 + index).padStart(4, '0')}`,
      snapshotDate
    }
    const recipeRecord = recipesByVersionId.get(sourceSnapshot.recipeVersionId)
    const costSnapshot = createHistoricalCostSnapshotFromRecipeSnapshot(
      recipeSnapshotTemplate,
      {
        snapshotDate,
        createdBy: index % 3 === 0 ? 'Maliyet Kontrol' : index % 3 === 1 ? 'Üretim Planlama' : 'MIYOP Demo',
        currency: DEFAULT_CURRENCY
      },
      index,
      recipeRecord
    )

    snapshots.push(costSnapshot)
    ingredientCostSnapshotCount += costSnapshot.ingredients.length
    index += 1
  }

  return snapshots
}

const mergeSeedCostSnapshots = (
  records: HistoricalCostSnapshot[],
  seedRecords: HistoricalCostSnapshot[]
) => {
  const existingIds = new Set(records.map(record => record.id))
  const mergedRecords = [...records]

  seedRecords.forEach(seedRecord => {
    if(existingIds.has(seedRecord.id)) return
    mergedRecords.push(seedRecord)
    existingIds.add(seedRecord.id)
  })

  return mergedRecords
}

export const saveHistoricalCostSnapshots = (
  snapshots: HistoricalCostSnapshot[]
) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(HISTORICAL_COST_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots.map(normalizeHistoricalCostSnapshot)))
}

export const loadHistoricalCostSnapshots = (
  recipeRecords?: RecipeManagementRecord[],
  recipeSnapshots?: RecipeSnapshot[]
) => {
  const sourceRecipes = recipeRecords || loadRecipeManagementRecords()
  const seedRecords = createHistoricalCostSnapshotSeedData(sourceRecipes, recipeSnapshots || RecipeSnapshotService.load(sourceRecipes))
  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(HISTORICAL_COST_SNAPSHOT_STORAGE_KEY)
  if(storedRecords === null){
    saveHistoricalCostSnapshots(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(value => Boolean(value) && typeof value === 'object')
        .map((record, index) => normalizeHistoricalCostSnapshot(
          record as Partial<HistoricalCostSnapshot> & Record<string, unknown>,
          index
        ))
      const nextRecords = mergeSeedCostSnapshots(normalizedRecords, seedRecords)
      saveHistoricalCostSnapshots(nextRecords)
      return nextRecords
    }
  } catch {
    saveHistoricalCostSnapshots(seedRecords)
    return seedRecords
  }

  saveHistoricalCostSnapshots(seedRecords)
  return seedRecords
}

export const createHistoricalCostSnapshotForProductionOrder = (
  recipeSnapshot: RecipeSnapshot,
  input: HistoricalCostSnapshotCreateInput = {},
  recipeRecord?: RecipeManagementRecord
) => {
  const existingSnapshots = loadHistoricalCostSnapshots()
  const existingSnapshot = existingSnapshots.find(snapshot => (
    snapshot.recipeSnapshotId === recipeSnapshot.id
    && snapshot.productionOrderId === recipeSnapshot.productionOrderId
  ))
  if(existingSnapshot) return existingSnapshot

  const nextSnapshot = createHistoricalCostSnapshotFromRecipeSnapshot(
    recipeSnapshot,
    input,
    existingSnapshots.length,
    recipeRecord
  )
  saveHistoricalCostSnapshots([nextSnapshot, ...existingSnapshots])
  return nextSnapshot
}

export const getHistoricalCostSnapshotsForRecipe = (
  recipe: RecipeManagementRecord,
  snapshots: HistoricalCostSnapshot[]
) => {
  const versionSnapshots = snapshots.filter(snapshot => snapshot.recipeVersionId === recipe.id)
  if(versionSnapshots.length > 0) return versionSnapshots

  const masterId = recipe.masterId || recipe.id
  return snapshots.filter(snapshot => snapshot.recipeMasterId === masterId)
}

const sortSnapshotsAsc = (
  snapshots: HistoricalCostSnapshot[]
) => [...snapshots].sort((first, second) => (
  getSafeTimestamp(first.snapshotDate) - getSafeTimestamp(second.snapshotDate)
  || first.snapshotNo.localeCompare(second.snapshotNo, 'tr-TR')
))

export const sortHistoricalCostSnapshotsDesc = (
  snapshots: HistoricalCostSnapshot[]
) => [...snapshots].sort((first, second) => (
  getSafeTimestamp(second.snapshotDate) - getSafeTimestamp(first.snapshotDate)
  || second.snapshotNo.localeCompare(first.snapshotNo, 'tr-TR')
))

const aggregateTrend = (
  snapshots: HistoricalCostSnapshot[],
  getKey: (snapshot: HistoricalCostSnapshot) => string,
  getLabel: (key: string) => string,
  limit: number
): HistoricalCostTrendPoint[] => {
  const buckets = new Map<string, { total: number; count: number }>()

  snapshots.forEach(snapshot => {
    const key = getKey(snapshot)
    const current = buckets.get(key) || { total: 0, count: 0 }
    buckets.set(key, {
      total: current.total + snapshot.grandTotalCost,
      count: current.count + 1
    })
  })

  return Array.from(buckets.entries())
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .slice(-limit)
    .map(([key, bucket]) => {
      const value = roundMoney(bucket.total / Math.max(1, bucket.count))
      return {
        label: getLabel(key),
        dateKey: key,
        value,
        formattedValue: formatCurrency(value)
      }
    })
}

export const buildHistoricalCostTrendSummary = (
  snapshots: HistoricalCostSnapshot[]
): HistoricalCostTrendSummary => {
  if(snapshots.length === 0){
    return {
      latestCost: 0,
      averageCost: 0,
      highestCost: 0,
      lowestCost: 0,
      latestUnitCost: 0,
      averageUnitCost: 0,
      last30DayChangePercent: 0,
      daily: [],
      weekly: [],
      monthly: []
    }
  }

  const sortedSnapshots = sortSnapshotsAsc(snapshots)
  const latestSnapshot = sortedSnapshots[sortedSnapshots.length - 1]
  const averageCost = roundMoney(sortedSnapshots.reduce((sum, snapshot) => sum + snapshot.grandTotalCost, 0) / sortedSnapshots.length)
  const averageUnitCost = roundMoney(sortedSnapshots.reduce((sum, snapshot) => sum + snapshot.unitCost, 0) / sortedSnapshots.length)
  const latestTimestamp = getSafeTimestamp(latestSnapshot.snapshotDate)
  const thirtyDaysAgo = latestTimestamp - 30 * 86400000
  const last30Snapshots = sortedSnapshots.filter(snapshot => getSafeTimestamp(snapshot.snapshotDate) >= thirtyDaysAgo)
  const priorSnapshots = sortedSnapshots.filter(snapshot => getSafeTimestamp(snapshot.snapshotDate) < thirtyDaysAgo)
  const last30Average = last30Snapshots.length > 0
    ? last30Snapshots.reduce((sum, snapshot) => sum + snapshot.grandTotalCost, 0) / last30Snapshots.length
    : latestSnapshot.grandTotalCost
  const priorAverage = priorSnapshots.length > 0
    ? priorSnapshots.reduce((sum, snapshot) => sum + snapshot.grandTotalCost, 0) / priorSnapshots.length
    : averageCost

  return {
    latestCost: latestSnapshot.grandTotalCost,
    averageCost,
    highestCost: Math.max(...sortedSnapshots.map(snapshot => snapshot.grandTotalCost)),
    lowestCost: Math.min(...sortedSnapshots.map(snapshot => snapshot.grandTotalCost)),
    latestUnitCost: latestSnapshot.unitCost,
    averageUnitCost,
    last30DayChangePercent: percent(last30Average - priorAverage, priorAverage),
    daily: aggregateTrend(sortedSnapshots, snapshot => getDateKey(snapshot.snapshotDate), key => key.slice(5), 14),
    weekly: aggregateTrend(sortedSnapshots, snapshot => getWeekKey(snapshot.snapshotDate), key => key, 10),
    monthly: aggregateTrend(sortedSnapshots, snapshot => getMonthKey(snapshot.snapshotDate), key => key, 8)
  }
}

export const buildHistoricalCostSnapshotDiffRows = (
  sourceSnapshot: HistoricalCostSnapshot,
  targetSnapshot: HistoricalCostSnapshot
): HistoricalCostSnapshotDiffRow[] => COST_COMPONENTS.map(component => {
  const sourceValue = sourceSnapshot[component.key]
  const targetValue = targetSnapshot[component.key]
  const difference = roundMoney(targetValue - sourceValue)

  return {
    area: component.label,
    sourceValue: formatCurrency(sourceValue, sourceSnapshot.currency),
    targetValue: formatCurrency(targetValue, targetSnapshot.currency),
    absoluteDifference: formatCurrency(difference, targetSnapshot.currency),
    percentDifference: formatPercent(percent(difference, sourceValue))
  }
})

export const formatHistoricalCostSnapshotLabel = (
  snapshot: HistoricalCostSnapshot
) => `${snapshot.snapshotNo} · ${getDateKey(snapshot.snapshotDate)} · ${formatCurrency(snapshot.grandTotalCost, snapshot.currency)}`

export const formatHistoricalCostAmount = formatCurrency

export const RecipeCostSnapshotService = {
  buildDiffRows: buildHistoricalCostSnapshotDiffRows,
  buildTrendSummary: buildHistoricalCostTrendSummary,
  capture: createHistoricalCostSnapshotForProductionOrder,
  create: createHistoricalCostSnapshotFromRecipeSnapshot,
  createSeed: createHistoricalCostSnapshotSeedData,
  formatAmount: formatHistoricalCostAmount,
  formatLabel: formatHistoricalCostSnapshotLabel,
  getForRecipe: getHistoricalCostSnapshotsForRecipe,
  load: loadHistoricalCostSnapshots,
  save: saveHistoricalCostSnapshots,
  sortDesc: sortHistoricalCostSnapshotsDesc
}
