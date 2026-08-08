import {
  createRecipeManagementMockData,
  loadRecipeManagementRecords
} from './recipe-management.mock'
import type {
  RecipeIngredient,
  RecipeManagementRecord
} from './recipe-management.types'
import type {
  AlternativeMaterial,
  AlternativeMaterialApprovalStatus,
  AlternativeMaterialCostComparison,
  AlternativeMaterialGroup,
  AlternativeMaterialRule,
  AlternativeMaterialStatus,
  AlternativeMaterialSubstitutionMode
} from './recipe-alternative-material.types'

const ALTERNATIVE_MATERIAL_STORAGE_KEY = 'ra_recipe_alternative_material_groups'
const SEED_ALTERNATIVE_GROUP_MIN_COUNT = 45
const SEED_ALTERNATIVE_MATERIAL_MIN_COUNT = 120
const SEED_COST_COMPARISON_MIN_COUNT = 80

const MATERIAL_STATUS_OPTIONS: AlternativeMaterialStatus[] = ['Aktif', 'Pasif']
const APPROVAL_STATUS_OPTIONS: AlternativeMaterialApprovalStatus[] = ['Taslak', 'İncelemede', 'Onaylandı', 'Reddedildi']
const SUBSTITUTION_MODE_OPTIONS: AlternativeMaterialSubstitutionMode[] = ['Aynı Gramaj', 'Katsayılı Gramaj']

const TARGETED_ALTERNATIVES: Array<{ match: string; alternatives: string[] }> = [
  { match: 'mozzarella', alternatives: ['Mozzarella B', 'Mozzarella C', 'Kaşar Peyniri'] },
  { match: 'kaşar', alternatives: ['Kaşar Peyniri Premium', 'Mozzarella C', 'Dil Peyniri'] },
  { match: 'dana', alternatives: ['Dana Eti Alternatif Kesim', 'Dana Kıyma Kontrollü Lot', 'Hindi Eti'] },
  { match: 'tavuk', alternatives: ['Tavuk But Alternatif Lot', 'Tavuk Göğüs', 'Hindi Füme'] },
  { match: 'pirinç', alternatives: ['Osmancık Pirinç', 'Baldo Pirinç Alternatif Tedarikçi', 'Kırık Pirinç Kontrollü'] },
  { match: 'bulgur', alternatives: ['Pilavlık Bulgur B', 'İnce Bulgur Kontrollü Lot', 'Kinoa Karışımı'] },
  { match: 'un', alternatives: ['Endüstriyel Un B', 'Yüksek Proteinli Un', 'Glutensiz Un Karışımı'] },
  { match: 'süt', alternatives: ['Pastörize Süt B', 'Laktozsuz Süt', 'UHT Süt'] },
  { match: 'yoğurt', alternatives: ['Süzme Yoğurt', 'Endüstriyel Yoğurt B', 'Laktozsuz Yoğurt'] },
  { match: 'tereyağı', alternatives: ['Tereyağı B', 'Sade Yağ', 'Bitkisel Margarin Kontrollü'] },
  { match: 'ayçiçek', alternatives: ['Ayçiçek Yağı B', 'Kanola Yağı', 'Zeytinyağı Kontrollü'] },
  { match: 'zeytinyağı', alternatives: ['Riviera Zeytinyağı', 'Ayçiçek Yağı Kontrollü', 'Kanola Yağı'] },
  { match: 'domates', alternatives: ['Domates Püresi B', 'Domates Sosu', 'Domates Salçası Kontrollü'] },
  { match: 'salça', alternatives: ['Domates Salçası B', 'Biber Salçası Kontrollü', 'Domates Püresi Konsantre'] },
  { match: 'soğan', alternatives: ['Kuru Soğan B', 'Dondurulmuş Soğan', 'Soğan Tozu Kontrollü'] },
  { match: 'sarımsak', alternatives: ['Sarımsak B', 'Sarımsak Püresi', 'Sarımsak Tozu Kontrollü'] },
  { match: 'patates', alternatives: ['Patates B', 'Dondurulmuş Patates', 'Patates Püresi Flake'] },
  { match: 'havuç', alternatives: ['Havuç B', 'Dondurulmuş Havuç', 'Küp Havuç Kontrollü'] },
  { match: 'biber', alternatives: ['Kapya Biber', 'Dondurulmuş Biber', 'Yeşil Biber Kontrollü'] },
  { match: 'marul', alternatives: ['Marul B', 'Atom Marul', 'Mevsim Yeşilliği'] },
  { match: 'lahana', alternatives: ['Beyaz Lahana B', 'Kırmızı Lahana', 'Karışık Salata Bazı'] },
  { match: 'mısır', alternatives: ['Konserve Mısır B', 'Dondurulmuş Mısır', 'Tatlı Mısır Kontrollü'] },
  { match: 'şeker', alternatives: ['Toz Şeker B', 'Pancar Şekeri', 'Esmer Şeker Kontrollü'] },
  { match: 'tuz', alternatives: ['İyotlu Tuz B', 'Deniz Tuzu', 'Rafine Tuz Kontrollü'] },
  { match: 'karabiber', alternatives: ['Karabiber B', 'Beyaz Biber', 'Baharat Karışımı Kontrollü'] },
  { match: 'kimyon', alternatives: ['Kimyon B', 'Köfte Baharatı Kontrollü', 'Baharat Karışımı'] },
  { match: 'kekik', alternatives: ['Kekik B', 'Fesleğen Kontrollü', 'Akdeniz Baharat Karışımı'] },
  { match: 'nane', alternatives: ['Nane B', 'Kuru Nane Premium', 'Baharat Karışımı Kontrollü'] },
  { match: 'vanilin', alternatives: ['Vanilin B', 'Vanilya Aroma', 'Doğal Vanilya Kontrollü'] },
  { match: 'tarçın', alternatives: ['Tarçın B', 'Çubuk Tarçın Öğütülmüş', 'Tatlı Baharat Karışımı'] },
  { match: 'ekmeği', alternatives: ['Sandviç Ekmeği B', 'Tam Buğday Ekmeği', 'Brioche Ekmeği Kontrollü'] },
  { match: 'mayonez', alternatives: ['Mayonez B', 'Light Mayonez', 'Yoğurt Bazlı Sos'] },
  { match: 'krema', alternatives: ['Krema B', 'Bitkisel Krema', 'Süt Bazlı Krema Kontrollü'] },
  { match: 'yumurta', alternatives: ['Pastörize Yumurta', 'Yumurta B', 'Yumurta Tozu Kontrollü'] }
]

const isBrowserStorageAvailable = () => (
  typeof window !== 'undefined' && typeof localStorage !== 'undefined'
)

const normalizeText = (value: unknown) => String(value || '').trim()

const normalizeSearchText = (value: string) => normalizeText(value)
  .toLocaleLowerCase('tr-TR')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')

const slugify = (value: string) => normalizeSearchText(value)
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

const roundQuantity = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000

const calculatePercent = (
  value: number,
  total: number
) => total > 0 ? roundQuantity((value / total) * 100) : 0

const getRecipeMasterId = (record: RecipeManagementRecord) => record.masterId || record.id

const createMaterialCode = (
  materialName: string,
  index: number
) => {
  const normalizedName = slugify(materialName)
    .replace(/_/g, '')
    .toLocaleUpperCase('tr-TR')
    .slice(0, 8)

  return `HM-${normalizedName || 'MALZEME'}-${String(index + 1).padStart(3, '0')}`
}

const normalizeStatus = (value: unknown): AlternativeMaterialStatus => {
  const text = normalizeText(value)
  return MATERIAL_STATUS_OPTIONS.includes(text as AlternativeMaterialStatus)
    ? text as AlternativeMaterialStatus
    : 'Aktif'
}

const normalizeApprovalStatus = (value: unknown): AlternativeMaterialApprovalStatus => {
  const text = normalizeText(value)
  return APPROVAL_STATUS_OPTIONS.includes(text as AlternativeMaterialApprovalStatus)
    ? text as AlternativeMaterialApprovalStatus
    : 'İncelemede'
}

const normalizeSubstitutionMode = (value: unknown): AlternativeMaterialSubstitutionMode => {
  const text = normalizeText(value)
  return SUBSTITUTION_MODE_OPTIONS.includes(text as AlternativeMaterialSubstitutionMode)
    ? text as AlternativeMaterialSubstitutionMode
    : 'Katsayılı Gramaj'
}

const normalizeRule = (
  item: Partial<AlternativeMaterialRule> & Record<string, unknown>
): AlternativeMaterialRule => ({
  substitutionMode: normalizeSubstitutionMode(item.substitutionMode),
  maxUsagePercent: normalizePercent(item.maxUsagePercent, 100),
  minimumQualityScore: normalizePercent(item.minimumQualityScore, 75),
  allergenCheck: typeof item.allergenCheck === 'boolean' ? item.allergenCheck : true,
  haccpCompliant: typeof item.haccpCompliant === 'boolean' ? item.haccpCompliant : true
})

const getAlternativeMaterialNames = (
  primaryMaterialName: string,
  groupIndex: number
) => {
  const normalizedPrimary = normalizeSearchText(primaryMaterialName)
  const targeted = TARGETED_ALTERNATIVES.find(item => normalizedPrimary.includes(normalizeSearchText(item.match)))

  if(targeted) return targeted.alternatives

  const suffixes = groupIndex % 2 === 0
    ? ['Tedarikçi B', 'Premium Lot', 'Kontrollü Eşdeğer']
    : ['Alternatif Lot', 'Yerel Tedarikçi', 'Düşük Fire Profili']

  return suffixes.map(suffix => `${primaryMaterialName} ${suffix}`)
}

const createAlternativeMaterial = (
  group: Omit<AlternativeMaterialGroup, 'alternatives'>,
  ingredient: RecipeIngredient,
  materialName: string,
  groupIndex: number,
  alternativeIndex: number,
  createdAt: string
): AlternativeMaterial => {
  const priority = alternativeIndex + 1
  const substitutionRatio = alternativeIndex === 0
    ? 1
    : roundQuantity(0.94 + ((groupIndex + alternativeIndex) % 7) * 0.025)
  const unitCostFactor = 0.86 + ((groupIndex + alternativeIndex * 2) % 8) * 0.045
  const currentQuantity = normalizeNonNegativeNumber(ingredient.baseQuantity)
  const alternativeQuantity = roundQuantity(currentQuantity * substitutionRatio)
  const currentUnitCost = normalizePositiveNumber(ingredient.unitCost)
  const alternativeUnitCost = roundMoney(currentUnitCost * unitCostFactor)
  const currentCost = roundMoney(currentQuantity * currentUnitCost)
  const alternativeCost = roundMoney(alternativeQuantity * alternativeUnitCost)
  const costDifference = roundMoney(alternativeCost - currentCost)
  const qualityScore = Math.min(99, 78 + ((groupIndex * 3 + alternativeIndex * 5) % 20))
  const approvalStatus: AlternativeMaterialApprovalStatus = alternativeIndex < 2
    ? 'Onaylandı'
    : groupIndex % 5 === 0
      ? 'İncelemede'
      : 'Onaylandı'
  const allergenCheck = groupIndex % 17 !== 0 || alternativeIndex !== 2
  const haccpCompliant = groupIndex % 19 !== 0 || alternativeIndex === 0

  return {
    id: `alternative_material_${slugify(group.id)}_${String(alternativeIndex + 1).padStart(2, '0')}`,
    groupId: group.id,
    ingredientId: ingredient.id,
    materialId: `material_${slugify(materialName)}_${String(groupIndex + 1).padStart(3, '0')}`,
    materialCode: createMaterialCode(materialName, groupIndex * 3 + alternativeIndex),
    materialName,
    priority,
    substitutionRatio,
    unit: ingredient.unit,
    baseUnit: ingredient.baseUnit,
    currentQuantity,
    alternativeQuantity,
    currentUnitCost,
    alternativeUnitCost,
    currentCost,
    alternativeCost,
    costDifference,
    costDifferencePercent: calculatePercent(costDifference, currentCost),
    qualityScore,
    status: groupIndex % 11 === 0 && alternativeIndex === 2 ? 'Pasif' : 'Aktif',
    approvalStatus,
    notes: costDifference <= 0
      ? 'Maliyet avantajı ve kalite uygunluğu manuel onaya sunulabilir.'
      : 'Stok sürekliliği için maliyet etkisi onayda izlenmelidir.',
    rule: {
      substitutionMode: substitutionRatio === 1 ? 'Aynı Gramaj' : 'Katsayılı Gramaj',
      maxUsagePercent: substitutionRatio === 1 ? 100 : 70 + ((groupIndex + alternativeIndex) % 4) * 5,
      minimumQualityScore: 75 + (alternativeIndex * 3),
      allergenCheck,
      haccpCompliant
    },
    createdAt,
    updatedAt: createdAt
  }
}

const createAlternativeMaterialGroup = (
  recipe: RecipeManagementRecord,
  ingredient: RecipeIngredient,
  groupIndex: number
): AlternativeMaterialGroup => {
  const createdAt = new Date(Date.UTC(2026, 5 + (groupIndex % 2), 1 + (groupIndex % 28), 8 + (groupIndex % 8), (groupIndex * 11) % 60)).toISOString()
  const groupId = `alternative_group_${slugify(recipe.id)}_${slugify(ingredient.id)}`
  const primaryBaseQuantity = normalizeNonNegativeNumber(ingredient.baseQuantity)
  const primaryUnitCost = normalizePositiveNumber(ingredient.unitCost)
  const groupBase = {
    id: groupId,
    recipeId: recipe.id,
    recipeMasterId: getRecipeMasterId(recipe),
    recipeVersionId: recipe.id,
    recipeCode: recipe.code,
    recipeName: recipe.recipeName,
    ingredientId: ingredient.id,
    primaryMaterialName: ingredient.materialName,
    primaryUnit: ingredient.unit,
    primaryBaseUnit: ingredient.baseUnit,
    primaryQuantity: normalizeNonNegativeNumber(ingredient.quantity),
    primaryBaseQuantity,
    primaryUnitCost,
    primaryCost: roundMoney(primaryBaseQuantity * primaryUnitCost),
    status: 'Aktif' as AlternativeMaterialStatus,
    createdAt,
    updatedAt: createdAt
  }

  return {
    ...groupBase,
    alternatives: getAlternativeMaterialNames(ingredient.materialName, groupIndex)
      .slice(0, 3)
      .map((materialName, alternativeIndex) => createAlternativeMaterial(
        groupBase,
        ingredient,
        materialName,
        groupIndex,
        alternativeIndex,
        createdAt
      ))
  }
}

export const createAlternativeMaterialSeedData = (
  recipeRecords: RecipeManagementRecord[] = createRecipeManagementMockData()
) => {
  const sourceRecipes = (recipeRecords.length > 0 ? recipeRecords : createRecipeManagementMockData())
    .filter(record => record.ingredients.length > 0)
  const sourceIngredients = sourceRecipes.flatMap(recipe => (
    recipe.ingredients.map(ingredient => ({ recipe, ingredient }))
  ))

  if(sourceIngredients.length === 0) return []

  const groups: AlternativeMaterialGroup[] = []
  let index = 0

  while(
    (
      groups.length < SEED_ALTERNATIVE_GROUP_MIN_COUNT
      || flattenAlternativeMaterials(groups).length < SEED_ALTERNATIVE_MATERIAL_MIN_COUNT
      || buildAlternativeMaterialCostComparisons(groups).length < SEED_COST_COMPARISON_MIN_COUNT
    )
    && index < sourceIngredients.length * 4
  ){
    const source = sourceIngredients[index % sourceIngredients.length]
    const group = createAlternativeMaterialGroup(source.recipe, source.ingredient, index)

    if(!groups.some(item => item.id === group.id)) groups.push(group)
    index += 1
  }

  return groups
}

const normalizeAlternativeMaterial = (
  item: Partial<AlternativeMaterial> & Record<string, unknown>,
  group: AlternativeMaterialGroup,
  index: number
): AlternativeMaterial => {
  const currentQuantity = normalizeNonNegativeNumber(item.currentQuantity, group.primaryBaseQuantity)
  const substitutionRatio = normalizePositiveNumber(item.substitutionRatio, 1)
  const alternativeQuantity = normalizeNonNegativeNumber(item.alternativeQuantity, currentQuantity * substitutionRatio)
  const currentUnitCost = normalizePositiveNumber(item.currentUnitCost, group.primaryUnitCost)
  const alternativeUnitCost = normalizePositiveNumber(item.alternativeUnitCost, currentUnitCost)
  const currentCost = roundMoney(normalizeNonNegativeNumber(item.currentCost, currentQuantity * currentUnitCost))
  const alternativeCost = roundMoney(normalizeNonNegativeNumber(item.alternativeCost, alternativeQuantity * alternativeUnitCost))
  const costDifference = roundMoney(normalizeNumber(item.costDifference, alternativeCost - currentCost))
  const createdAt = normalizeText(item.createdAt) || group.createdAt

  return {
    id: normalizeText(item.id) || `alternative_material_${slugify(group.id)}_${String(index + 1).padStart(2, '0')}`,
    groupId: group.id,
    ingredientId: normalizeText(item.ingredientId) || group.ingredientId,
    materialId: normalizeText(item.materialId) || `material_${index + 1}`,
    materialCode: normalizeText(item.materialCode) || createMaterialCode(normalizeText(item.materialName) || 'Alternatif Malzeme', index),
    materialName: normalizeText(item.materialName) || 'Alternatif Malzeme',
    priority: Math.max(1, Math.floor(normalizePositiveNumber(item.priority, index + 1))),
    substitutionRatio,
    unit: item.unit || group.primaryUnit,
    baseUnit: item.baseUnit || group.primaryBaseUnit,
    currentQuantity,
    alternativeQuantity,
    currentUnitCost,
    alternativeUnitCost,
    currentCost,
    alternativeCost,
    costDifference,
    costDifferencePercent: normalizeNumber(item.costDifferencePercent, calculatePercent(costDifference, currentCost)),
    qualityScore: normalizePercent(item.qualityScore, 80),
    status: normalizeStatus(item.status),
    approvalStatus: normalizeApprovalStatus(item.approvalStatus),
    notes: normalizeText(item.notes),
    rule: normalizeRule((item.rule || {}) as Partial<AlternativeMaterialRule> & Record<string, unknown>),
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }
}

const normalizeAlternativeMaterialGroup = (
  item: Partial<AlternativeMaterialGroup> & Record<string, unknown>,
  index: number
): AlternativeMaterialGroup => {
  const createdAt = normalizeText(item.createdAt) || new Date().toISOString()
  const primaryBaseQuantity = normalizeNonNegativeNumber(item.primaryBaseQuantity)
  const primaryUnitCost = normalizePositiveNumber(item.primaryUnitCost)
  const primaryCost = roundMoney(normalizeNonNegativeNumber(item.primaryCost, primaryBaseQuantity * primaryUnitCost))
  const group: AlternativeMaterialGroup = {
    id: normalizeText(item.id) || `alternative_group_${String(index + 1).padStart(3, '0')}`,
    recipeId: normalizeText(item.recipeId) || normalizeText(item.recipeVersionId),
    recipeMasterId: normalizeText(item.recipeMasterId) || normalizeText(item.recipeId),
    recipeVersionId: normalizeText(item.recipeVersionId) || normalizeText(item.recipeId),
    recipeCode: normalizeText(item.recipeCode) || `RC-${String(index + 1).padStart(3, '0')}`,
    recipeName: normalizeText(item.recipeName) || 'Reçete',
    ingredientId: normalizeText(item.ingredientId) || `ingredient_${index + 1}`,
    primaryMaterialName: normalizeText(item.primaryMaterialName) || 'Hammadde',
    primaryUnit: item.primaryUnit || 'kg',
    primaryBaseUnit: item.primaryBaseUnit || 'gr',
    primaryQuantity: normalizeNonNegativeNumber(item.primaryQuantity),
    primaryBaseQuantity,
    primaryUnitCost,
    primaryCost,
    status: normalizeStatus(item.status),
    alternatives: [],
    createdAt,
    updatedAt: normalizeText(item.updatedAt) || createdAt
  }

  group.alternatives = Array.isArray(item.alternatives)
    ? item.alternatives
      .filter(value => Boolean(value) && typeof value === 'object')
      .map((alternative, alternativeIndex) => normalizeAlternativeMaterial(
        alternative as Partial<AlternativeMaterial> & Record<string, unknown>,
        group,
        alternativeIndex
      ))
    : []

  return group
}

const mergeSeedGroups = (
  records: AlternativeMaterialGroup[],
  seedRecords: AlternativeMaterialGroup[]
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

export const flattenAlternativeMaterials = (
  groups: AlternativeMaterialGroup[]
) => groups.flatMap(group => group.alternatives)

export const buildAlternativeMaterialCostComparisons = (
  groups: AlternativeMaterialGroup[]
): AlternativeMaterialCostComparison[] => flattenAlternativeMaterials(groups)
  .map(alternative => {
    const group = groups.find(item => item.id === alternative.groupId)

    return {
      id: `alternative_cost_${alternative.id}`,
      groupId: alternative.groupId,
      alternativeId: alternative.id,
      recipeCode: group?.recipeCode || '',
      recipeName: group?.recipeName || '',
      primaryMaterialName: group?.primaryMaterialName || '',
      alternativeMaterialName: alternative.materialName,
      currentCost: alternative.currentCost,
      alternativeCost: alternative.alternativeCost,
      costDifference: alternative.costDifference,
      costDifferencePercent: alternative.costDifferencePercent,
      qualityScore: alternative.qualityScore,
      approvalStatus: alternative.approvalStatus
    }
  })

export const saveAlternativeMaterialGroups = (
  groups: AlternativeMaterialGroup[]
) => {
  if(!isBrowserStorageAvailable()) return
  localStorage.setItem(ALTERNATIVE_MATERIAL_STORAGE_KEY, JSON.stringify(groups.map((group, index) => (
    normalizeAlternativeMaterialGroup(group, index)
  ))))
}

export const loadAlternativeMaterialGroups = (
  recipeRecords?: RecipeManagementRecord[]
) => {
  const seedRecords = createAlternativeMaterialSeedData(recipeRecords || loadRecipeManagementRecords())
  if(!isBrowserStorageAvailable()) return seedRecords

  const storedRecords = localStorage.getItem(ALTERNATIVE_MATERIAL_STORAGE_KEY)
  if(storedRecords === null){
    saveAlternativeMaterialGroups(seedRecords)
    return seedRecords
  }

  try{
    const parsed = JSON.parse(storedRecords)
    if(Array.isArray(parsed)){
      const normalizedRecords = parsed
        .filter(value => Boolean(value) && typeof value === 'object')
        .map((record, index) => normalizeAlternativeMaterialGroup(
          record as Partial<AlternativeMaterialGroup> & Record<string, unknown>,
          index
        ))
      const nextRecords = mergeSeedGroups(normalizedRecords, seedRecords)
      saveAlternativeMaterialGroups(nextRecords)
      return nextRecords
    }
  } catch {
    saveAlternativeMaterialGroups(seedRecords)
    return seedRecords
  }

  saveAlternativeMaterialGroups(seedRecords)
  return seedRecords
}

export const getAlternativeGroupsForRecipe = (
  recipe: RecipeManagementRecord,
  groups: AlternativeMaterialGroup[]
) => {
  const versionGroups = groups.filter(group => (
    group.recipeId === recipe.id
    || group.recipeVersionId === recipe.id
  ))

  if(versionGroups.length > 0) return versionGroups

  return groups.filter(group => group.recipeMasterId === getRecipeMasterId(recipe))
}

export const getAlternativeGroupForIngredient = (
  recipe: RecipeManagementRecord,
  ingredientId: string,
  groups: AlternativeMaterialGroup[]
) => getAlternativeGroupsForRecipe(recipe, groups)
  .find(group => group.ingredientId === ingredientId)

export const isAlternativeMaterialApprovedForUse = (
  alternative: AlternativeMaterial
) => (
  alternative.status === 'Aktif'
  && alternative.approvalStatus === 'Onaylandı'
  && alternative.qualityScore >= alternative.rule.minimumQualityScore
  && alternative.rule.allergenCheck
  && alternative.rule.haccpCompliant
)

export const findApprovedAlternativesForMaterial = (
  materialName: string,
  groups: AlternativeMaterialGroup[]
) => {
  const normalizedMaterialName = normalizeSearchText(materialName)

  return groups
    .filter(group => {
      const primaryName = normalizeSearchText(group.primaryMaterialName)
      return primaryName === normalizedMaterialName
        || primaryName.includes(normalizedMaterialName)
        || normalizedMaterialName.includes(primaryName)
    })
    .flatMap(group => group.alternatives.map(alternative => ({ group, alternative })))
    .filter(item => isAlternativeMaterialApprovedForUse(item.alternative))
    .sort((first, second) => (
      first.alternative.priority - second.alternative.priority
      || first.alternative.costDifference - second.alternative.costDifference
      || second.alternative.qualityScore - first.alternative.qualityScore
    ))
}

export const RecipeAlternativeMaterialService = {
  buildCostComparisons: buildAlternativeMaterialCostComparisons,
  createSeed: createAlternativeMaterialSeedData,
  findApprovedAlternativesForMaterial,
  flatten: flattenAlternativeMaterials,
  getForIngredient: getAlternativeGroupForIngredient,
  getForRecipe: getAlternativeGroupsForRecipe,
  isApprovedForUse: isAlternativeMaterialApprovedForUse,
  load: loadAlternativeMaterialGroups,
  save: saveAlternativeMaterialGroups
}
