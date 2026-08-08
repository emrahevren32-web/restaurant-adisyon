import {
  createRecipeManagementMockData,
  loadRecipeManagementRecords
} from './recipe-management.mock'
import {
  RecipeAlternativeMaterialService
} from './recipe-alternative-material.service'
import {
  RecipeCostSnapshotService
} from './recipe-cost-snapshot.service'
import type {
  RecipeManagementRecord
} from './recipe-management.types'
import type {
  HistoricalCostSnapshot,
  IngredientCostSnapshot
} from './recipe-cost-snapshot.types'
import type {
  RecipeCostScenario,
  RecipeCostScenarioType,
  RecipeCostSimulation,
  RecipeCostSimulationBreakdown,
  RecipeCostSimulationCompareRow,
  RecipeCostSimulationCreateInput,
  RecipeCostSimulationMaterialBreakdown,
  RecipeCostSimulationOutput,
  RecipeCostSimulationStatus,
  RecipeCostSimulationTrendPoint
} from './recipe-cost-simulation.types'

const RECIPE_COST_SIMULATION_STORAGE_KEY = 'ra_recipe_cost_simulations'
const SEED_SIMULATION_MIN_COUNT = 120
const SEED_SCENARIO_MIN_COUNT = 300
const SEED_SAVINGS_SCENARIO_MIN_COUNT = 80

export const RECIPE_COST_SCENARIO_TYPES: RecipeCostScenarioType[] = [
  'Hammadde fiyatı arttı',
  'Hammadde fiyatı düştü',
  'Alternatif hammadde kullanıldı',
  'Fire oranı değişti',
  'Yield değişti',
  'İşçilik maliyeti değişti',
  'Enerji maliyeti değişti',
  'Paketleme maliyeti değişti',
  'Genel gider değişti'
]

export const RECIPE_COST_SIMULATION_STATUSES: RecipeCostSimulationStatus[] = [
  'Taslak',
  'Kaydedildi',
  'İncelemede',
  'Arşiv'
]

const COST_DISTRIBUTION_LABELS = [
  ['simulatedMaterialCost', 'Hammadde'],
  ['simulatedLaborCost', 'İşçilik'],
  ['simulatedEnergyCost', 'Enerji'],
  ['simulatedPackagingCost', 'Paketleme'],
  ['simulatedLogisticsCost', 'Lojistik'],
  ['simulatedWasteCost', 'Fire'],
  ['simulatedOverheadCost', 'Genel Gider']
] as const

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const normalizeText = (value: unknown) => String(value || '').trim()

const slugify = (value: string) => normalizeText(value)
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/gi, '_')
  .replace(/^_+|_+$/g, '')

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

const normalizePercent = (
  value: unknown,
  fallback = 0
) => Math.max(0, Math.min(100, normalizeNumber(value, fallback)))

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const roundPercent = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const percent = (
  value: number,
  total: number
) => total !== 0 ? roundPercent((value / total) * 100) : 0

const formatCurrency = (
  value: number,
  currency = 'TRY'
) => `${value.toLocaleString('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})} ${currency}`

const formatPercent = (value: number) => `${value.toLocaleString('tr-TR', {
  maximumFractionDigits: 2
})} %`

const getSafeTimestamp = (value: string) => {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : 0
}

const getDateKey = (value: string) => {
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '2026-01-01'
  return date.toISOString().slice(0, 10)
}

const normalizeSimulationStatus = (value: unknown): RecipeCostSimulationStatus => {
  const status = normalizeText(value)
  return RECIPE_COST_SIMULATION_STATUSES.includes(status as RecipeCostSimulationStatus)
    ? status as RecipeCostSimulationStatus
    : 'Kaydedildi'
}

const normalizeScenarioType = (value: unknown): RecipeCostScenarioType => {
  const scenarioType = normalizeText(value)
  return RECIPE_COST_SCENARIO_TYPES.includes(scenarioType as RecipeCostScenarioType)
    ? scenarioType as RecipeCostScenarioType
    : 'Hammadde fiyatı arttı'
}

const createSimulationId = (
  recipeVersionId: string,
  simulationName: string,
  index: number
) => `recipe_cost_simulation_${slugify(recipeVersionId)}_${slugify(simulationName) || String(index + 1).padStart(3, '0')}`

const getBaselineYield = (
  baselineSnapshot: HistoricalCostSnapshot
) => Math.max(40, Math.min(100, 100 - percent(baselineSnapshot.totalWasteCost, Math.max(1, baselineSnapshot.totalMaterialCost))))

const getEstimatedPortions = (
  baselineSnapshot: HistoricalCostSnapshot
) => Math.max(1, Math.round(baselineSnapshot.grandTotalCost / Math.max(0.01, baselineSnapshot.unitCost)))

const getComponentRate = (
  componentCost: number,
  materialCost: number
) => materialCost > 0 ? componentCost / materialCost : 0

const createDistribution = (
  output: Pick<RecipeCostSimulationOutput, typeof COST_DISTRIBUTION_LABELS[number][0]>
): RecipeCostSimulationBreakdown[] => {
  const total = COST_DISTRIBUTION_LABELS.reduce((sum, [key]) => sum + output[key], 0)

  return COST_DISTRIBUTION_LABELS.map(([key, label]) => ({
    id: key,
    label,
    value: output[key],
    percent: percent(output[key], total)
  }))
}

const cloneIngredientLines = (
  baselineSnapshot: HistoricalCostSnapshot
) => baselineSnapshot.ingredients.map(ingredient => ({ ...ingredient }))

const getTargetIngredient = (
  scenario: RecipeCostScenario,
  ingredientLines: IngredientCostSnapshot[],
  fallbackIndex: number
) => ingredientLines.find(ingredient => ingredient.ingredientId === scenario.ingredientId)
  || ingredientLines[fallbackIndex % Math.max(1, ingredientLines.length)]
  || null

const applyMaterialScenario = (
  scenario: RecipeCostScenario,
  ingredientLines: IngredientCostSnapshot[],
  scenarioIndex: number
) => {
  const targetIngredient = getTargetIngredient(scenario, ingredientLines, scenarioIndex)
  if(!targetIngredient) return

  const absoluteChangePercent = Math.abs(normalizeNumber(scenario.changePercent, 0))
  const direction = scenario.type === 'Hammadde fiyatı düştü' ? -1 : 1
  const priceFactor = 1 + ((absoluteChangePercent * direction) / 100)
  targetIngredient.unitPrice = roundMoney(Math.max(0.01, targetIngredient.unitPrice * priceFactor))
  targetIngredient.lineTotal = roundMoney(targetIngredient.quantity * targetIngredient.unitPrice)
}

const applyAlternativeMaterialScenario = (
  scenario: RecipeCostScenario,
  ingredientLines: IngredientCostSnapshot[],
  scenarioIndex: number
) => {
  const targetIngredient = getTargetIngredient(scenario, ingredientLines, scenarioIndex)
  if(!targetIngredient) return

  const changePercent = normalizeNumber(scenario.changePercent, -8)
  targetIngredient.materialId = scenario.alternativeMaterialId || targetIngredient.materialId
  targetIngredient.materialName = scenario.alternativeMaterialName || scenario.materialName || `${targetIngredient.materialName} Alternatif`
  targetIngredient.unitPrice = roundMoney(Math.max(0.01, targetIngredient.unitPrice * (1 + changePercent / 100)))
  targetIngredient.lineTotal = roundMoney(targetIngredient.quantity * targetIngredient.unitPrice)
}

const calculateSimulationOutput = (
  baselineSnapshot: HistoricalCostSnapshot,
  scenarios: RecipeCostScenario[]
): RecipeCostSimulationOutput => {
  const ingredientLines = cloneIngredientLines(baselineSnapshot)
  let firePercent = percent(baselineSnapshot.totalWasteCost, Math.max(1, baselineSnapshot.totalMaterialCost))
  let expectedYield = getBaselineYield(baselineSnapshot)
  let laborMultiplier = 1
  let energyMultiplier = 1
  let packagingMultiplier = 1
  let overheadMultiplier = 1

  scenarios.forEach((scenario, scenarioIndex) => {
    if(scenario.type === 'Hammadde fiyatı arttı' || scenario.type === 'Hammadde fiyatı düştü'){
      applyMaterialScenario(scenario, ingredientLines, scenarioIndex)
      return
    }

    if(scenario.type === 'Alternatif hammadde kullanıldı'){
      applyAlternativeMaterialScenario(scenario, ingredientLines, scenarioIndex)
      return
    }

    if(scenario.type === 'Fire oranı değişti'){
      firePercent = normalizePercent(scenario.targetValue ?? scenario.changePercent, firePercent)
      return
    }

    if(scenario.type === 'Yield değişti'){
      expectedYield = Math.max(40, Math.min(100, normalizeNumber(scenario.targetValue ?? scenario.changePercent, expectedYield)))
      return
    }

    if(scenario.type === 'İşçilik maliyeti değişti'){
      laborMultiplier *= normalizePositiveNumber(scenario.multiplier, 1 + normalizeNumber(scenario.changePercent, 0) / 100)
      return
    }

    if(scenario.type === 'Enerji maliyeti değişti'){
      energyMultiplier *= normalizePositiveNumber(scenario.multiplier, 1 + normalizeNumber(scenario.changePercent, 0) / 100)
      return
    }

    if(scenario.type === 'Paketleme maliyeti değişti'){
      packagingMultiplier *= normalizePositiveNumber(scenario.multiplier, 1 + normalizeNumber(scenario.changePercent, 0) / 100)
      return
    }

    if(scenario.type === 'Genel gider değişti'){
      overheadMultiplier *= normalizePositiveNumber(scenario.multiplier, 1 + normalizeNumber(scenario.changePercent, 0) / 100)
    }
  })

  const simulatedMaterialCost = roundMoney(ingredientLines.reduce((sum, ingredient) => sum + ingredient.lineTotal, 0))
  const simulatedLaborCost = roundMoney(simulatedMaterialCost * getComponentRate(baselineSnapshot.totalLaborCost, baselineSnapshot.totalMaterialCost) * laborMultiplier)
  const simulatedEnergyCost = roundMoney(simulatedMaterialCost * getComponentRate(baselineSnapshot.totalEnergyCost, baselineSnapshot.totalMaterialCost) * energyMultiplier)
  const simulatedPackagingCost = roundMoney(simulatedMaterialCost * getComponentRate(baselineSnapshot.totalPackagingCost, baselineSnapshot.totalMaterialCost) * packagingMultiplier)
  const simulatedLogisticsCost = roundMoney(simulatedMaterialCost * getComponentRate(baselineSnapshot.totalLogisticsCost, baselineSnapshot.totalMaterialCost))
  const simulatedWasteCost = roundMoney(simulatedMaterialCost * (firePercent / 100))
  const simulatedOverheadCost = roundMoney(simulatedMaterialCost * getComponentRate(baselineSnapshot.totalOverheadCost, baselineSnapshot.totalMaterialCost) * overheadMultiplier)
  const simulatedTotalCost = roundMoney(
    simulatedMaterialCost
    + simulatedLaborCost
    + simulatedEnergyCost
    + simulatedPackagingCost
    + simulatedLogisticsCost
    + simulatedWasteCost
    + simulatedOverheadCost
  )
  const portions = getEstimatedPortions(baselineSnapshot)
  const yieldAdjustedPortions = Math.max(1, portions * (expectedYield / Math.max(1, getBaselineYield(baselineSnapshot))))
  const simulatedUnitCost = roundMoney(simulatedTotalCost / yieldAdjustedPortions)
  const difference = roundMoney(simulatedTotalCost - baselineSnapshot.grandTotalCost)
  const materialBreakdown: RecipeCostSimulationMaterialBreakdown[] = baselineSnapshot.ingredients.map((ingredient, index) => {
    const simulatedIngredient = ingredientLines[index] || ingredient
    const materialDifference = roundMoney(simulatedIngredient.lineTotal - ingredient.lineTotal)

    return {
      ingredientId: ingredient.ingredientId,
      materialName: simulatedIngredient.materialName,
      currentCost: ingredient.lineTotal,
      simulatedCost: simulatedIngredient.lineTotal,
      difference: materialDifference,
      differencePercent: percent(materialDifference, ingredient.lineTotal)
    }
  })
  const baseOutput = {
    currentUnitCost: baselineSnapshot.unitCost,
    simulatedUnitCost,
    currentTotalCost: baselineSnapshot.grandTotalCost,
    simulatedTotalCost,
    difference,
    differencePercent: percent(difference, baselineSnapshot.grandTotalCost),
    expectedProfitability: percent(Math.max(0, -difference), simulatedTotalCost),
    expectedFireImpact: roundMoney(simulatedWasteCost - baselineSnapshot.totalWasteCost),
    expectedYield,
    savingsOpportunity: Math.max(0, roundMoney(-difference)),
    simulatedMaterialCost,
    simulatedLaborCost,
    simulatedEnergyCost,
    simulatedPackagingCost,
    simulatedLogisticsCost,
    simulatedWasteCost,
    simulatedOverheadCost,
    materialBreakdown
  }

  return {
    ...baseOutput,
    costDistribution: createDistribution(baseOutput)
  }
}

const normalizeScenario = (
  item: Partial<RecipeCostScenario> & Record<string, unknown>,
  simulationId: string,
  index: number
): RecipeCostScenario => ({
  id: normalizeText(item.id) || `${simulationId}_scenario_${String(index + 1).padStart(3, '0')}`,
  simulationId,
  type: normalizeScenarioType(item.type),
  ingredientId: normalizeText(item.ingredientId) || undefined,
  materialId: normalizeText(item.materialId) || undefined,
  materialName: normalizeText(item.materialName) || undefined,
  alternativeMaterialId: normalizeText(item.alternativeMaterialId) || undefined,
  alternativeMaterialName: normalizeText(item.alternativeMaterialName) || undefined,
  changePercent: item.changePercent === undefined ? undefined : normalizeNumber(item.changePercent),
  targetValue: item.targetValue === undefined ? undefined : normalizeNumber(item.targetValue),
  multiplier: item.multiplier === undefined ? undefined : normalizePositiveNumber(item.multiplier),
  notes: normalizeText(item.notes)
})

const normalizeBreakdown = (
  item: Partial<RecipeCostSimulationBreakdown> & Record<string, unknown>,
  index: number
): RecipeCostSimulationBreakdown => ({
  id: normalizeText(item.id) || `breakdown_${index + 1}`,
  label: normalizeText(item.label) || `Kalem ${index + 1}`,
  value: normalizeNonNegativeNumber(item.value),
  percent: normalizeNumber(item.percent)
})

const normalizeMaterialBreakdown = (
  item: Partial<RecipeCostSimulationMaterialBreakdown> & Record<string, unknown>,
  index: number
): RecipeCostSimulationMaterialBreakdown => {
  const currentCost = normalizeNonNegativeNumber(item.currentCost)
  const simulatedCost = normalizeNonNegativeNumber(item.simulatedCost)
  const difference = normalizeNumber(item.difference, simulatedCost - currentCost)

  return {
    ingredientId: normalizeText(item.ingredientId) || `ingredient_${index + 1}`,
    materialName: normalizeText(item.materialName) || 'Malzeme',
    currentCost,
    simulatedCost,
    difference,
    differencePercent: normalizeNumber(item.differencePercent, percent(difference, currentCost))
  }
}

const normalizeOutput = (
  item: Partial<RecipeCostSimulationOutput> & Record<string, unknown>,
  baselineSnapshot?: HistoricalCostSnapshot
): RecipeCostSimulationOutput => {
  const currentTotalCost = normalizeNonNegativeNumber(item.currentTotalCost, baselineSnapshot?.grandTotalCost || 0)
  const simulatedTotalCost = normalizeNonNegativeNumber(item.simulatedTotalCost, currentTotalCost)
  const difference = normalizeNumber(item.difference, simulatedTotalCost - currentTotalCost)
  const baseOutput = {
    currentUnitCost: normalizeNonNegativeNumber(item.currentUnitCost, baselineSnapshot?.unitCost || 0),
    simulatedUnitCost: normalizeNonNegativeNumber(item.simulatedUnitCost, baselineSnapshot?.unitCost || 0),
    currentTotalCost,
    simulatedTotalCost,
    difference,
    differencePercent: normalizeNumber(item.differencePercent, percent(difference, currentTotalCost)),
    expectedProfitability: normalizeNumber(item.expectedProfitability),
    expectedFireImpact: normalizeNumber(item.expectedFireImpact),
    expectedYield: normalizePercent(item.expectedYield, 100),
    savingsOpportunity: normalizeNonNegativeNumber(item.savingsOpportunity),
    simulatedMaterialCost: normalizeNonNegativeNumber(item.simulatedMaterialCost),
    simulatedLaborCost: normalizeNonNegativeNumber(item.simulatedLaborCost),
    simulatedEnergyCost: normalizeNonNegativeNumber(item.simulatedEnergyCost),
    simulatedPackagingCost: normalizeNonNegativeNumber(item.simulatedPackagingCost),
    simulatedLogisticsCost: normalizeNonNegativeNumber(item.simulatedLogisticsCost),
    simulatedWasteCost: normalizeNonNegativeNumber(item.simulatedWasteCost),
    simulatedOverheadCost: normalizeNonNegativeNumber(item.simulatedOverheadCost),
    materialBreakdown: Array.isArray(item.materialBreakdown)
      ? item.materialBreakdown
        .filter(value => Boolean(value) && typeof value === 'object')
        .map((row, index) => normalizeMaterialBreakdown(row as Partial<RecipeCostSimulationMaterialBreakdown> & Record<string, unknown>, index))
      : []
  }

  return {
    ...baseOutput,
    costDistribution: Array.isArray(item.costDistribution)
      ? item.costDistribution
        .filter(value => Boolean(value) && typeof value === 'object')
        .map((row, index) => normalizeBreakdown(row as Partial<RecipeCostSimulationBreakdown> & Record<string, unknown>, index))
      : createDistribution(baseOutput)
  }
}

export const createRecipeCostSimulationFromSnapshot = (
  recipe: RecipeManagementRecord,
  baselineSnapshot: HistoricalCostSnapshot,
  input: RecipeCostSimulationCreateInput,
  index = 0
): RecipeCostSimulation => {
  const simulationId = createSimulationId(recipe.id, input.simulationName, index)
  const scenarios = input.scenarios.map((scenario, scenarioIndex) => normalizeScenario({
    ...scenario,
    id: `${simulationId}_scenario_${String(scenarioIndex + 1).padStart(3, '0')}`
  }, simulationId, scenarioIndex))

  return {
    id: simulationId,
    recipeMasterId: recipe.masterId || recipe.id,
    recipeVersionId: recipe.id,
    recipeCode: recipe.code,
    recipeName: recipe.recipeName,
    productName: recipe.productName,
    baselineCostSnapshotId: baselineSnapshot.id,
    simulationName: input.simulationName.trim() || `Maliyet Simülasyonu ${index + 1}`,
    createdBy: input.createdBy || 'MIYOP Demo',
    createdDate: input.createdDate || new Date().toISOString(),
    status: input.status || 'Kaydedildi',
    notes: input.notes || '',
    currency: baselineSnapshot.currency,
    scenarios,
    output: calculateSimulationOutput(baselineSnapshot, scenarios)
  }
}

const createSeedScenarios = (
  baselineSnapshot: HistoricalCostSnapshot,
  simulationIndex: number
): Array<Omit<RecipeCostScenario, 'id' | 'simulationId'>> => {
  const ingredient = baselineSnapshot.ingredients[simulationIndex % Math.max(1, baselineSnapshot.ingredients.length)]
  const scenarioBucket = simulationIndex % 9
  const savingsFocused = simulationIndex % 3 !== 1
  const scenarios: Array<Omit<RecipeCostScenario, 'id' | 'simulationId'>> = []

  if(savingsFocused){
    scenarios.push({
      type: 'Hammadde fiyatı düştü',
      ingredientId: ingredient?.ingredientId,
      materialName: ingredient?.materialName,
      changePercent: 12 + (simulationIndex % 14),
      notes: 'Tedarikçi fiyat iyileştirme senaryosu.'
    })
  } else {
    scenarios.push({
      type: 'Hammadde fiyatı arttı',
      ingredientId: ingredient?.ingredientId,
      materialName: ingredient?.materialName,
      changePercent: 4 + (simulationIndex % 12),
      notes: 'Satın alma fiyat artışı what-if senaryosu.'
    })
  }

  if(savingsFocused && (scenarioBucket === 1 || scenarioBucket === 4 || scenarioBucket === 7)){
    scenarios.push({
      type: 'Alternatif hammadde kullanıldı',
      ingredientId: ingredient?.ingredientId,
      materialName: ingredient?.materialName,
      alternativeMaterialName: `${ingredient?.materialName || 'Malzeme'} Alternatif Tedarikçi`,
      changePercent: -8 - (simulationIndex % 9),
      notes: 'Onaylı alternatif hammadde simülasyonu.'
    })
  }

  if(simulationIndex % 2 === 0){
    scenarios.push({
      type: 'Fire oranı değişti',
      targetValue: savingsFocused
        ? Math.max(1, Math.min(6, 2 + (simulationIndex % 4)))
        : Math.max(5, Math.min(18, 6 + (simulationIndex % 10))),
      notes: 'Fire toleransı what-if girdisi.'
    })
  }

  if(simulationIndex % 3 === 0){
    scenarios.push({
      type: 'Yield değişti',
      targetValue: savingsFocused
        ? Math.max(92, Math.min(99, 94 + (simulationIndex % 5)))
        : Math.max(70, Math.min(90, 82 + (simulationIndex % 8))),
      notes: 'Yield iyileştirme/kayıp senaryosu.'
    })
  }

  if(simulationIndex % 4 === 0){
    scenarios.push({
      type: 'İşçilik maliyeti değişti',
      changePercent: savingsFocused ? -4 - (simulationIndex % 4) : 6,
      notes: 'Vardiya ve işçilik katsayısı senaryosu.'
    })
  }

  if(simulationIndex % 5 === 0){
    scenarios.push({
      type: 'Enerji maliyeti değişti',
      changePercent: savingsFocused ? -3 - (simulationIndex % 3) : 7,
      notes: 'Enerji birim maliyet senaryosu.'
    })
  }

  return scenarios
}

const createRecipeLookup = (
  recipeRecords: RecipeManagementRecord[]
) => {
  const recordsByVersionId = new Map(recipeRecords.map(recipe => [recipe.id, recipe]))
  const recordsByMasterId = new Map<string, RecipeManagementRecord>()
  recipeRecords.forEach(recipe => {
    const masterId = recipe.masterId || recipe.id
    if(!recordsByMasterId.has(masterId)) recordsByMasterId.set(masterId, recipe)
  })

  return { recordsByVersionId, recordsByMasterId }
}

export const createRecipeCostSimulationSeedData = (
  recipeRecords: RecipeManagementRecord[] = createRecipeManagementMockData(),
  costSnapshots: HistoricalCostSnapshot[] = RecipeCostSnapshotService.load(recipeRecords)
) => {
  const sourceRecipes = recipeRecords.length > 0 ? recipeRecords : createRecipeManagementMockData()
  const sourceSnapshots = costSnapshots.length > 0 ? costSnapshots : RecipeCostSnapshotService.createSeed(sourceRecipes)
  const { recordsByVersionId, recordsByMasterId } = createRecipeLookup(sourceRecipes)
  const simulations: RecipeCostSimulation[] = []
  let scenarioCount = 0
  let savingsScenarioCount = 0
  let index = 0

  while(
    (
      simulations.length < SEED_SIMULATION_MIN_COUNT
      || scenarioCount < SEED_SCENARIO_MIN_COUNT
      || savingsScenarioCount < SEED_SAVINGS_SCENARIO_MIN_COUNT
    )
    && index < 360
  ){
    const baselineSnapshot = sourceSnapshots[index % sourceSnapshots.length]
    const recipe = recordsByVersionId.get(baselineSnapshot.recipeVersionId)
      || recordsByMasterId.get(baselineSnapshot.recipeMasterId)
      || sourceRecipes[index % sourceRecipes.length]
    const scenarios = createSeedScenarios(baselineSnapshot, index)
    const simulation = createRecipeCostSimulationFromSnapshot(recipe, baselineSnapshot, {
      simulationName: `${recipe.recipeName} Simülasyon ${String(index + 1).padStart(3, '0')}`,
      createdBy: index % 3 === 0 ? 'Maliyet Kontrol' : index % 3 === 1 ? 'Satın Alma' : 'MIYOP Demo',
      createdDate: new Date(Date.UTC(2026, 6 + (index % 2), 1 + (index % 28), 9 + (index % 6), (index * 7) % 60)).toISOString(),
      status: index % 9 === 0 ? 'İncelemede' : 'Kaydedildi',
      notes: 'What-if simülasyonu; gerçek reçete ve stok verisi değişmez.',
      scenarios
    }, index)

    simulations.push(simulation)
    scenarioCount += simulation.scenarios.length
    if(simulation.output.difference < 0) savingsScenarioCount += 1
    index += 1
  }

  return simulations
}

const normalizeSimulation = (
  item: Partial<RecipeCostSimulation> & Record<string, unknown>,
  index: number,
  baselineSnapshotsById: Map<string, HistoricalCostSnapshot>
): RecipeCostSimulation => {
  const simulationName = normalizeText(item.simulationName) || `Maliyet Simülasyonu ${index + 1}`
  const recipeVersionId = normalizeText(item.recipeVersionId) || `recipe_version_${index + 1}`
  const id = normalizeText(item.id) || createSimulationId(recipeVersionId, simulationName, index)
  const scenarios = Array.isArray(item.scenarios)
    ? item.scenarios
      .filter(value => Boolean(value) && typeof value === 'object')
      .map((scenario, scenarioIndex) => normalizeScenario(
        scenario as Partial<RecipeCostScenario> & Record<string, unknown>,
        id,
        scenarioIndex
      ))
    : []
  const baselineCostSnapshotId = normalizeText(item.baselineCostSnapshotId)
  const baselineSnapshot = baselineSnapshotsById.get(baselineCostSnapshotId)

  return {
    id,
    recipeMasterId: normalizeText(item.recipeMasterId) || recipeVersionId,
    recipeVersionId,
    recipeCode: normalizeText(item.recipeCode) || `RC-${String(index + 1).padStart(3, '0')}`,
    recipeName: normalizeText(item.recipeName) || 'Reçete',
    productName: normalizeText(item.productName),
    baselineCostSnapshotId,
    simulationName,
    createdBy: normalizeText(item.createdBy) || 'MIYOP Demo',
    createdDate: normalizeText(item.createdDate) || new Date().toISOString(),
    status: normalizeSimulationStatus(item.status),
    notes: normalizeText(item.notes),
    currency: item.currency === 'USD' || item.currency === 'EUR' ? item.currency : 'TRY',
    scenarios,
    output: normalizeOutput((item.output || {}) as Partial<RecipeCostSimulationOutput> & Record<string, unknown>, baselineSnapshot)
  }
}

const mergeSeedSimulations = (
  records: RecipeCostSimulation[],
  seedRecords: RecipeCostSimulation[]
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

export const saveRecipeCostSimulations = (
  simulations: RecipeCostSimulation[]
) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(RECIPE_COST_SIMULATION_STORAGE_KEY, JSON.stringify(simulations))
}

export const loadRecipeCostSimulations = (
  recipeRecords?: RecipeManagementRecord[],
  costSnapshots?: HistoricalCostSnapshot[]
) => {
  const sourceRecipes = recipeRecords || loadRecipeManagementRecords()
  const sourceCostSnapshots = costSnapshots || RecipeCostSnapshotService.load(sourceRecipes)
  const seedRecords = createRecipeCostSimulationSeedData(sourceRecipes, sourceCostSnapshots)
  const baselineSnapshotsById = new Map(sourceCostSnapshots.map(snapshot => [snapshot.id, snapshot]))
  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(RECIPE_COST_SIMULATION_STORAGE_KEY)
  if(storedRecords === null){
    saveRecipeCostSimulations(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(value => Boolean(value) && typeof value === 'object')
        .map((record, index) => normalizeSimulation(
          record as Partial<RecipeCostSimulation> & Record<string, unknown>,
          index,
          baselineSnapshotsById
        ))
      const nextRecords = mergeSeedSimulations(normalizedRecords, seedRecords)
      saveRecipeCostSimulations(nextRecords)
      return nextRecords
    }
  } catch {
    saveRecipeCostSimulations(seedRecords)
    return seedRecords
  }

  saveRecipeCostSimulations(seedRecords)
  return seedRecords
}

export const getRecipeCostSimulationsForRecipe = (
  recipe: RecipeManagementRecord,
  simulations: RecipeCostSimulation[]
) => {
  const versionSimulations = simulations.filter(simulation => simulation.recipeVersionId === recipe.id)
  if(versionSimulations.length > 0) return sortRecipeCostSimulationsDesc(versionSimulations)

  const masterId = recipe.masterId || recipe.id
  return sortRecipeCostSimulationsDesc(simulations.filter(simulation => simulation.recipeMasterId === masterId))
}

export const sortRecipeCostSimulationsDesc = (
  simulations: RecipeCostSimulation[]
) => [...simulations].sort((first, second) => (
  getSafeTimestamp(second.createdDate) - getSafeTimestamp(first.createdDate)
  || first.simulationName.localeCompare(second.simulationName, 'tr-TR')
))

export const buildRecipeCostSimulationCompareRows = (
  simulation: RecipeCostSimulation
): RecipeCostSimulationCompareRow[] => {
  const currentMaterialCost = simulation.output.materialBreakdown.reduce((sum, row) => sum + row.currentCost, 0)
  const rows = [
    ['Toplam Maliyet', simulation.output.currentTotalCost, simulation.output.simulatedTotalCost],
    ['Birim Maliyet', simulation.output.currentUnitCost, simulation.output.simulatedUnitCost],
    ['Hammadde', currentMaterialCost, simulation.output.simulatedMaterialCost],
    ['Fire Etkisi', 0, simulation.output.expectedFireImpact],
    ['Beklenen Yield', 100, simulation.output.expectedYield],
    ['Beklenen Karlılık', 0, simulation.output.expectedProfitability]
  ] as const

  return rows.map(([area, currentValue, simulatedValue]) => {
    const difference = roundMoney(simulatedValue - currentValue)
    const differencePercent = percent(difference, currentValue)

    return {
      area,
      currentValue: area.includes('Yield') || area.includes('Karlılık') ? formatPercent(currentValue) : formatCurrency(currentValue, simulation.currency),
      simulatedValue: area.includes('Yield') || area.includes('Karlılık') ? formatPercent(simulatedValue) : formatCurrency(simulatedValue, simulation.currency),
      difference: area.includes('Yield') || area.includes('Karlılık') ? formatPercent(difference) : formatCurrency(difference, simulation.currency),
      differencePercent: formatPercent(differencePercent),
      tone: difference < 0 ? 'success' : difference > 0 ? 'danger' : 'neutral'
    }
  })
}

export const buildRecipeCostSimulationTrend = (
  simulations: RecipeCostSimulation[]
): RecipeCostSimulationTrendPoint[] => {
  const buckets = new Map<string, { total: number; count: number }>()

  simulations.forEach(simulation => {
    const key = getDateKey(simulation.createdDate)
    const current = buckets.get(key) || { total: 0, count: 0 }
    buckets.set(key, {
      total: current.total + simulation.output.difference,
      count: current.count + 1
    })
  })

  return Array.from(buckets.entries())
    .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
    .slice(-12)
    .map(([key, bucket]) => {
      const value = roundMoney(bucket.total / Math.max(1, bucket.count))
      return {
        label: key.slice(5),
        dateKey: key,
        value,
        formattedValue: formatCurrency(value)
      }
    })
}

export const findApprovedAlternativeScenarioForIngredient = (
  materialName: string,
  ingredientId: string
) => {
  const alternatives = RecipeAlternativeMaterialService.findApprovedAlternativesForMaterial(
    materialName,
    RecipeAlternativeMaterialService.load()
  )
  const alternative = alternatives.find(item => item.group.ingredientId === ingredientId) || alternatives[0]
  if(!alternative) return null

  return {
    alternativeMaterialId: alternative.alternative.materialId,
    alternativeMaterialName: alternative.alternative.materialName,
    changePercent: alternative.alternative.costDifferencePercent
  }
}

export const formatRecipeCostSimulationAmount = formatCurrency

export const RecipeCostSimulationService = {
  buildCompareRows: buildRecipeCostSimulationCompareRows,
  buildTrend: buildRecipeCostSimulationTrend,
  create: createRecipeCostSimulationFromSnapshot,
  createSeed: createRecipeCostSimulationSeedData,
  findApprovedAlternativeScenarioForIngredient,
  formatAmount: formatRecipeCostSimulationAmount,
  getForRecipe: getRecipeCostSimulationsForRecipe,
  load: loadRecipeCostSimulations,
  save: saveRecipeCostSimulations,
  sortDesc: sortRecipeCostSimulationsDesc
}
