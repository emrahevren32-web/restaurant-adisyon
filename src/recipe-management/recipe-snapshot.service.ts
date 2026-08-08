import {
  createRecipeManagementMockData,
  loadRecipeManagementRecords
} from './recipe-management.mock'
import { calculateRecipeCost } from './recipe-cost-engine'
import type {
  RecipeIngredient,
  RecipeIngredientBaseUnit,
  RecipeIngredientUnit,
  RecipeManagementRecord
} from './recipe-management.types'
import type {
  IngredientSnapshot,
  RecipeSnapshot,
  RecipeSnapshotCreateInput,
  RecipeSnapshotDiffRow
} from './recipe-snapshot.types'

const RECIPE_SNAPSHOT_STORAGE_KEY = 'ra_recipe_snapshots'
const SNAPSHOT_NO_PREFIX = 'RS'
const SEED_SNAPSHOT_MIN_COUNT = 150
const SEED_INGREDIENT_SNAPSHOT_MIN_COUNT = 900

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

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

const roundMoney = (value: number) => (
  Math.round((value + Number.EPSILON) * 100) / 100
)

const formatNumber = (value: number) => value.toLocaleString('tr-TR', {
  maximumFractionDigits: 3
})

const formatPercent = (value: number) => value.toLocaleString('tr-TR', {
  maximumFractionDigits: 2
})

const formatCurrency = (value: number) => `${value.toLocaleString('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})} TL`

const getRecipeMasterId = (recipe: RecipeManagementRecord) => recipe.masterId || recipe.id

const getRecipeVersionNo = (recipe: RecipeManagementRecord) => recipe.versionNo || 1

const getRecipeYieldPercent = (recipe: RecipeManagementRecord) => {
  const yieldPercent = Number(recipe.yieldPercent)
  if(Number.isFinite(yieldPercent) && yieldPercent >= 0 && yieldPercent <= 100) return yieldPercent
  return Math.max(0, Math.min(100, 100 - recipe.firePercent))
}

const getRecipeTotalMinutes = (recipe: RecipeManagementRecord) => {
  const explicitTotal = Number(recipe.totalMinutes)
  if(Number.isFinite(explicitTotal) && explicitTotal >= 0) return explicitTotal

  return [
    Number(recipe.preparationMinutes),
    Number(recipe.cookingMinutes),
    Number(recipe.restingMinutes)
  ].filter(Number.isFinite).reduce((sum, value) => sum + Math.max(0, value), 0)
}

const createMaterialCode = (
  materialName: string,
  index: number
) => {
  const normalizedName = materialName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLocaleUpperCase('tr-TR')
    .slice(0, 8)

  return `HM-${normalizedName || 'MALZEME'}-${String(index + 1).padStart(3, '0')}`
}

const getDateKey = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '20260101'
  return date.toISOString().slice(0, 10).replace(/-/g, '')
}

export const createRecipeSnapshotId = (
  productionOrderId: string,
  recipeVersionId: string
) => {
  const rawKey = `${productionOrderId}_${recipeVersionId}`
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return `recipe_snapshot_${rawKey || createId('snapshot')}`
}

const createSnapshotNo = (
  snapshotDate: string,
  index: number
) => `${SNAPSHOT_NO_PREFIX}-${getDateKey(snapshotDate)}-${String(index + 1).padStart(5, '0')}`

const createIngredientSnapshot = (
  snapshotId: string,
  ingredient: RecipeIngredient,
  recipe: RecipeManagementRecord,
  index: number
): IngredientSnapshot => {
  const baseQuantity = normalizeNonNegativeNumber(ingredient.baseQuantity)
  const unitCost = normalizeNonNegativeNumber(ingredient.unitCost)
  const totalCost = roundMoney(baseQuantity * unitCost)

  return {
    id: `${snapshotId}_ingredient_${String(index + 1).padStart(3, '0')}`,
    snapshotId,
    ingredientId: ingredient.id,
    materialId: ingredient.id,
    materialCode: createMaterialCode(ingredient.materialName, index),
    materialName: ingredient.materialName,
    quantity: normalizeNonNegativeNumber(ingredient.quantity),
    unit: ingredient.unit,
    baseQuantity,
    baseUnit: ingredient.baseUnit,
    wastePercent: normalizeNonNegativeNumber(recipe.firePercent),
    yieldPercent: getRecipeYieldPercent(recipe),
    unitCost,
    totalCost
  }
}

export const createRecipeSnapshotFromRecipe = (
  recipe: RecipeManagementRecord,
  input: RecipeSnapshotCreateInput,
  index = 0
): RecipeSnapshot => {
  const snapshotDate = input.snapshotDate || new Date().toISOString()
  const snapshotId = createRecipeSnapshotId(input.productionOrderId, recipe.id)
  const ingredients = recipe.ingredients.map((ingredient, ingredientIndex) => (
    createIngredientSnapshot(snapshotId, ingredient, recipe, ingredientIndex)
  ))
  const cost = calculateRecipeCost(recipe)

  return {
    id: snapshotId,
    snapshotNo: createSnapshotNo(snapshotDate, index),
    recipeMasterId: getRecipeMasterId(recipe),
    recipeVersionId: recipe.id,
    versionNo: getRecipeVersionNo(recipe),
    recipeCode: recipe.code,
    recipeName: recipe.recipeName,
    productName: recipe.productName,
    productionOrderId: input.productionOrderId,
    productionOrderNo: input.productionOrderNo || input.productionOrderId,
    snapshotDate,
    createdBy: input.createdBy || recipe.createdBy || 'MIYOP Demo',
    firePercent: normalizeNonNegativeNumber(recipe.firePercent),
    yieldPercent: getRecipeYieldPercent(recipe),
    preparationMinutes: normalizeNonNegativeNumber(recipe.preparationMinutes),
    cookingMinutes: normalizeNonNegativeNumber(recipe.cookingMinutes),
    restingMinutes: normalizeNonNegativeNumber(recipe.restingMinutes),
    totalMinutes: getRecipeTotalMinutes(recipe),
    totalCost: roundMoney(cost.recipeCost),
    ingredients,
    immutable: true
  }
}

const normalizeIngredientSnapshot = (
  item: Partial<IngredientSnapshot> & Record<string, unknown>,
  snapshotId: string,
  index: number
): IngredientSnapshot => ({
  id: normalizeText(item.id) || `${snapshotId}_ingredient_${String(index + 1).padStart(3, '0')}`,
  snapshotId,
  ingredientId: normalizeText(item.ingredientId) || normalizeText(item.materialId) || `ingredient_${index + 1}`,
  materialId: normalizeText(item.materialId) || normalizeText(item.ingredientId) || `material_${index + 1}`,
  materialCode: normalizeText(item.materialCode) || createMaterialCode(normalizeText(item.materialName) || 'Malzeme', index),
  materialName: normalizeText(item.materialName) || 'Malzeme',
  quantity: normalizeNonNegativeNumber(item.quantity),
  unit: (normalizeText(item.unit) || 'gr') as RecipeIngredientUnit,
  baseQuantity: normalizeNonNegativeNumber(item.baseQuantity),
  baseUnit: (normalizeText(item.baseUnit) || 'gr') as RecipeIngredientBaseUnit,
  wastePercent: normalizeNonNegativeNumber(item.wastePercent),
  yieldPercent: normalizeNonNegativeNumber(item.yieldPercent, 100),
  unitCost: normalizeNonNegativeNumber(item.unitCost),
  totalCost: normalizeNonNegativeNumber(item.totalCost)
})

const normalizeRecipeSnapshot = (
  item: Partial<RecipeSnapshot> & Record<string, unknown>,
  index: number
): RecipeSnapshot => {
  const snapshotDate = normalizeText(item.snapshotDate) || new Date().toISOString()
  const id = normalizeText(item.id) || createRecipeSnapshotId(
    normalizeText(item.productionOrderId) || `production_order_${index + 1}`,
    normalizeText(item.recipeVersionId) || `recipe_version_${index + 1}`
  )
  const ingredients = Array.isArray(item.ingredients)
    ? item.ingredients
      .filter(value => Boolean(value) && typeof value === 'object')
      .map((ingredient, ingredientIndex) => normalizeIngredientSnapshot(
        ingredient as Partial<IngredientSnapshot> & Record<string, unknown>,
        id,
        ingredientIndex
      ))
    : []
  const totalCost = normalizeNonNegativeNumber(
    item.totalCost,
    ingredients.reduce((sum, ingredient) => sum + ingredient.totalCost, 0)
  )

  return {
    id,
    snapshotNo: normalizeText(item.snapshotNo) || createSnapshotNo(snapshotDate, index),
    recipeMasterId: normalizeText(item.recipeMasterId),
    recipeVersionId: normalizeText(item.recipeVersionId),
    versionNo: Math.max(1, Math.floor(normalizeNonNegativeNumber(item.versionNo, 1))),
    recipeCode: normalizeText(item.recipeCode),
    recipeName: normalizeText(item.recipeName) || 'Reçete Snapshot',
    productName: normalizeText(item.productName),
    productionOrderId: normalizeText(item.productionOrderId) || `production_order_${index + 1}`,
    productionOrderNo: normalizeText(item.productionOrderNo) || `UE-SNAPSHOT-${String(index + 1).padStart(5, '0')}`,
    snapshotDate,
    createdBy: normalizeText(item.createdBy) || 'MIYOP Demo',
    firePercent: normalizeNonNegativeNumber(item.firePercent),
    yieldPercent: normalizeNonNegativeNumber(item.yieldPercent, 100),
    preparationMinutes: normalizeNonNegativeNumber(item.preparationMinutes),
    cookingMinutes: normalizeNonNegativeNumber(item.cookingMinutes),
    restingMinutes: normalizeNonNegativeNumber(item.restingMinutes),
    totalMinutes: normalizeNonNegativeNumber(item.totalMinutes),
    totalCost,
    ingredients,
    immutable: true
  }
}

export const createRecipeSnapshotSeedData = (
  recipeRecords: RecipeManagementRecord[] = createRecipeManagementMockData()
) => {
  const sourceRecipes = recipeRecords.length > 0 ? recipeRecords : createRecipeManagementMockData()
  const snapshots: RecipeSnapshot[] = []
  let ingredientSnapshotCount = 0
  let index = 0

  while(
    (snapshots.length < SEED_SNAPSHOT_MIN_COUNT || ingredientSnapshotCount < SEED_INGREDIENT_SNAPSHOT_MIN_COUNT)
    && index < 240
  ){
    const recipe = sourceRecipes[index % sourceRecipes.length]
    const dayOffset = 149 - index
    const snapshotDate = new Date(Date.UTC(2026, 6, 1 + (index % 28), 7 + (index % 10), (index * 7) % 60)).toISOString()
    const productionOrderNo = `UE-2026-${String(410 + index).padStart(4, '0')}`
    const productionOrderId = `production_order_snapshot_${String(index + 1).padStart(4, '0')}`
    const snapshot = createRecipeSnapshotFromRecipe(recipe, {
      productionOrderId,
      productionOrderNo,
      snapshotDate: dayOffset > 0 ? snapshotDate : new Date().toISOString(),
      createdBy: index % 3 === 0 ? 'Üretim Planlama' : index % 3 === 1 ? 'Kalite Güvence' : 'MIYOP Demo'
    }, index)

    snapshots.push(snapshot)
    ingredientSnapshotCount += snapshot.ingredients.length
    index += 1
  }

  return snapshots
}

const mergeSeedSnapshots = (
  records: RecipeSnapshot[],
  seedRecords: RecipeSnapshot[]
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

export const saveRecipeSnapshots = (snapshots: RecipeSnapshot[]) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(RECIPE_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots.map(normalizeRecipeSnapshot)))
}

export const loadRecipeSnapshots = (
  recipeRecords?: RecipeManagementRecord[]
) => {
  const seedRecords = createRecipeSnapshotSeedData(recipeRecords || loadRecipeManagementRecords())
  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(RECIPE_SNAPSHOT_STORAGE_KEY)
  if(storedRecords === null){
    saveRecipeSnapshots(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(value => Boolean(value) && typeof value === 'object')
        .map((record, index) => normalizeRecipeSnapshot(record as Partial<RecipeSnapshot> & Record<string, unknown>, index))
      const nextRecords = mergeSeedSnapshots(normalizedRecords, seedRecords)
      saveRecipeSnapshots(nextRecords)
      return nextRecords
    }
  } catch {
    saveRecipeSnapshots(seedRecords)
    return seedRecords
  }

  saveRecipeSnapshots(seedRecords)
  return seedRecords
}

export const createSnapshotForProductionOrder = (
  recipe: RecipeManagementRecord,
  input: RecipeSnapshotCreateInput
) => {
  const existingSnapshots = loadRecipeSnapshots()
  const existingSnapshot = existingSnapshots.find(snapshot => (
    snapshot.productionOrderId === input.productionOrderId
    && snapshot.recipeVersionId === recipe.id
  ))
  if(existingSnapshot) return existingSnapshot

  const nextSnapshot = createRecipeSnapshotFromRecipe(recipe, input, existingSnapshots.length)
  saveRecipeSnapshots([nextSnapshot, ...existingSnapshots])
  return nextSnapshot
}

export const buildRecipeSnapshotDiffRows = (
  sourceSnapshot: RecipeSnapshot,
  targetSnapshot: RecipeSnapshot
): RecipeSnapshotDiffRow[] => {
  const rows: RecipeSnapshotDiffRow[] = [
    {
      area: 'Fire',
      item: 'Fire oranı',
      sourceValue: `${formatPercent(sourceSnapshot.firePercent)} %`,
      targetValue: `${formatPercent(targetSnapshot.firePercent)} %`,
      difference: `${formatPercent(targetSnapshot.firePercent - sourceSnapshot.firePercent)} puan`
    },
    {
      area: 'Yield',
      item: 'Verim',
      sourceValue: `${formatPercent(sourceSnapshot.yieldPercent)} %`,
      targetValue: `${formatPercent(targetSnapshot.yieldPercent)} %`,
      difference: `${formatPercent(targetSnapshot.yieldPercent - sourceSnapshot.yieldPercent)} puan`
    },
    {
      area: 'Maliyet',
      item: 'Toplam snapshot maliyeti',
      sourceValue: formatCurrency(sourceSnapshot.totalCost),
      targetValue: formatCurrency(targetSnapshot.totalCost),
      difference: formatCurrency(targetSnapshot.totalCost - sourceSnapshot.totalCost)
    },
    {
      area: 'Süre',
      item: 'Toplam süre',
      sourceValue: `${formatNumber(sourceSnapshot.totalMinutes)} dk`,
      targetValue: `${formatNumber(targetSnapshot.totalMinutes)} dk`,
      difference: `${formatNumber(targetSnapshot.totalMinutes - sourceSnapshot.totalMinutes)} dk`
    }
  ]
  const sourceIngredients = new Map(sourceSnapshot.ingredients.map(ingredient => [
    ingredient.materialName.trim().toLocaleLowerCase('tr-TR'),
    ingredient
  ]))
  const targetIngredients = new Map(targetSnapshot.ingredients.map(ingredient => [
    ingredient.materialName.trim().toLocaleLowerCase('tr-TR'),
    ingredient
  ]))
  const ingredientKeys = Array.from(new Set([
    ...sourceIngredients.keys(),
    ...targetIngredients.keys()
  ])).sort((first, second) => first.localeCompare(second, 'tr-TR'))

  ingredientKeys.forEach(key => {
    const sourceIngredient = sourceIngredients.get(key)
    const targetIngredient = targetIngredients.get(key)
    const materialName = targetIngredient?.materialName || sourceIngredient?.materialName || key

    if(!sourceIngredient && targetIngredient){
      rows.push({
        area: 'Malzeme',
        item: materialName,
        sourceValue: '-',
        targetValue: `${formatNumber(targetIngredient.quantity)} ${targetIngredient.unit}`,
        difference: 'Eklendi'
      })
      return
    }

    if(sourceIngredient && !targetIngredient){
      rows.push({
        area: 'Malzeme',
        item: materialName,
        sourceValue: `${formatNumber(sourceIngredient.quantity)} ${sourceIngredient.unit}`,
        targetValue: '-',
        difference: 'Çıkarıldı'
      })
      return
    }

    if(!sourceIngredient || !targetIngredient) return

    const baseQuantityDifference = targetIngredient.baseQuantity - sourceIngredient.baseQuantity
    const totalCostDifference = targetIngredient.totalCost - sourceIngredient.totalCost
    if(baseQuantityDifference === 0 && totalCostDifference === 0) return

    rows.push({
      area: 'Gramaj',
      item: materialName,
      sourceValue: `${formatNumber(sourceIngredient.quantity)} ${sourceIngredient.unit}`,
      targetValue: `${formatNumber(targetIngredient.quantity)} ${targetIngredient.unit}`,
      difference: `${formatNumber(baseQuantityDifference)} ${targetIngredient.baseUnit}`
    })

    if(totalCostDifference !== 0){
      rows.push({
        area: 'Maliyet',
        item: `${materialName} satır maliyeti`,
        sourceValue: formatCurrency(sourceIngredient.totalCost),
        targetValue: formatCurrency(targetIngredient.totalCost),
        difference: formatCurrency(totalCostDifference)
      })
    }
  })

  return rows
}

export const RecipeSnapshotService = {
  buildDiffRows: buildRecipeSnapshotDiffRows,
  capture: createSnapshotForProductionOrder,
  create: createRecipeSnapshotFromRecipe,
  createSeed: createRecipeSnapshotSeedData,
  load: loadRecipeSnapshots
}
