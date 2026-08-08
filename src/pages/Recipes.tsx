import React from 'react'
import * as XLSX from 'xlsx'
import {
  RECIPE_INGREDIENT_UNITS,
  RECIPE_MANAGEMENT_ROLES,
  RECIPE_MANAGEMENT_STATUSES,
  RECIPE_MANAGEMENT_TYPES,
  RECIPE_PRODUCT_OPTIONS,
  RECIPE_VERSION_STATUSES,
  enforceSingleActiveRecipeVersions,
  loadRecipeManagementRecords,
  saveRecipeManagementRecords
} from '../recipe-management/recipe-management.mock'
import {
  calculateRecipeCost,
  formatRecipeCostAmount
} from '../recipe-management/recipe-cost-engine'
import {
  calculateTotalBaseQuantity,
  convertToBaseUnit
} from '../recipe-management/recipe-unit-converter'
import {
  RecipeSnapshotService,
  buildRecipeSnapshotDiffRows
} from '../recipe-management/recipe-snapshot.service'
import {
  RecipeAlternativeMaterialService
} from '../recipe-management/recipe-alternative-material.service'
import {
  RecipeCostSnapshotService
} from '../recipe-management/recipe-cost-snapshot.service'
import type {
  RecipeIngredient,
  RecipeIngredientUnit,
  RecipeManagementRecord,
  RecipeManagementRole,
  RecipeManagementStatus,
  RecipeManagementType,
  RecipeVersionStatus
} from '../recipe-management/recipe-management.types'
import type {
  RecipeSnapshot,
  RecipeSnapshotDiffRow
} from '../recipe-management/recipe-snapshot.types'
import type {
  AlternativeMaterial,
  AlternativeMaterialApprovalStatus,
  AlternativeMaterialGroup,
  AlternativeMaterialStatus
} from '../recipe-management/recipe-alternative-material.types'
import type {
  HistoricalCostSnapshot,
  HistoricalCostSnapshotDiffRow,
  HistoricalCostTrendPoint
} from '../recipe-management/recipe-cost-snapshot.types'

type StatusFilter = RecipeManagementStatus | 'all'
type RoleFilter = RecipeManagementRole | 'all'
type VersionStatusFilter = RecipeVersionStatus | 'all'
type PanelMode = 'summary' | 'form'
type ViewMode = 'list' | 'detail'
type ToastTone = 'success' | 'info'

type RecipeFormState = {
  code: string
  recipeName: string
  recipeType: RecipeManagementType
  recipeRole: RecipeManagementRole
  parentRecipeId: string
  productName: string
  portions: string
  firePercent: string
  status: RecipeManagementStatus
  versionStatus: RecipeVersionStatus
  versionDescription: string
  revisionNote: string
  preparationMinutes: string
  cookingMinutes: string
  restingMinutes: string
  yieldPercent: string
  description: string
}

type IngredientFormState = {
  materialName: string
  quantity: string
  unit: RecipeIngredientUnit
  unitCost: string
}

type ToastState = {
  id: string
  text: string
  tone: ToastTone
}

type RecipeVersionDiffRow = {
  area: string
  item: string
  sourceValue: string
  targetValue: string
  difference: string
}

type RecipeSnapshotPrintMode = 'PDF' | 'PRINT'

const MAX_INGREDIENT_QUANTITY = 100000
const MAX_INGREDIENT_UNIT_COST = 1000000
const MIN_FIRE_PERCENT = 0
const MAX_FIRE_PERCENT = 100
const MAX_RECIPE_MINUTES = 10080
const TOTAL_GRAMAJ_BASE_UNIT = 'gr'

const createId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const formatNumber = (value: number) => value.toLocaleString('tr-TR', {
  maximumFractionDigits: 3
})

const formatFirePercent = (value: number) => value.toLocaleString('tr-TR', {
  maximumFractionDigits: 2
})

const calculateTotalGrams = (ingredients: RecipeIngredient[]) => (
  calculateTotalBaseQuantity(ingredients, TOTAL_GRAMAJ_BASE_UNIT)
)

const createIngredientFromForm = (id: string, form: IngredientFormState): RecipeIngredient => {
  const quantity = Number(form.quantity)

  return {
    id,
    materialName: form.materialName.trim(),
    quantity,
    unit: form.unit,
    ...convertToBaseUnit(quantity, form.unit),
    unitCost: Number(form.unitCost)
  }
}

const formatDateTime = (value?: string) => {
  if(!value) return '-'
  const date = new Date(value)
  if(Number.isNaN(date.getTime())) return '-'

  return date.toLocaleString('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const getRecipeMasterId = (record: RecipeManagementRecord) => record.masterId || record.id

const getRecipeVersionNo = (record: RecipeManagementRecord) => record.versionNo || 1

const getRecipeVersionStatus = (record: RecipeManagementRecord): RecipeVersionStatus => (
  record.versionStatus || (record.status === 'Aktif' ? 'Aktif' : 'Arşiv')
)

const isRecipeVersionActive = (record: RecipeManagementRecord) => (
  Boolean(record.isActiveVersion) || getRecipeVersionStatus(record) === 'Aktif'
)

const canEditRecipeVersionDirectly = (record: RecipeManagementRecord) => {
  const versionStatus = getRecipeVersionStatus(record)
  return versionStatus === 'Taslak' || versionStatus === 'İncelemede'
}

const getRecipeTotalMinutes = (record: RecipeManagementRecord) => {
  const explicitTotalMinutes = Number(record.totalMinutes)
  if(Number.isFinite(explicitTotalMinutes) && explicitTotalMinutes >= 0) return explicitTotalMinutes

  const preparationMinutes = Number(record.preparationMinutes)
  const cookingMinutes = Number(record.cookingMinutes)
  const restingMinutes = Number(record.restingMinutes)

  return [preparationMinutes, cookingMinutes, restingMinutes]
    .filter(Number.isFinite)
    .reduce((sum, value) => sum + Math.max(0, value), 0)
}

const getRecipeYieldPercent = (record: RecipeManagementRecord) => {
  const yieldPercent = Number(record.yieldPercent)
  if(Number.isFinite(yieldPercent) && yieldPercent >= 0 && yieldPercent <= 100) return yieldPercent

  return Math.max(0, Math.min(100, 100 - record.firePercent))
}

const getStatusClass = (status: RecipeManagementStatus) => (
  status === 'Aktif' ? 'success' : 'muted-pill'
)

const getVersionStatusClass = (status: RecipeVersionStatus) => {
  if(status === 'Aktif') return 'success'
  if(status === 'Onaylandı') return 'info-pill'
  if(status === 'İncelemede') return 'warning-pill'
  if(status === 'Taslak') return 'muted-pill'
  return 'danger-pill'
}

const getRecipeRoleLabel = (role: RecipeManagementRole) => (
  role === 'PRIMARY' ? 'Ana' : 'Alternatif'
)

const getRecipeRoleClass = (role: RecipeManagementRole) => (
  role === 'PRIMARY' ? 'success' : 'info-pill'
)

const getAlternativeMaterialStatusClass = (status: AlternativeMaterialStatus) => (
  status === 'Aktif' ? 'success' : 'muted-pill'
)

const getAlternativeMaterialApprovalClass = (status: AlternativeMaterialApprovalStatus) => {
  if(status === 'Onaylandı') return 'success'
  if(status === 'İncelemede') return 'warning-pill'
  if(status === 'Taslak') return 'muted-pill'
  return 'danger-pill'
}

const getAlternativeMaterialCostClass = (alternative: AlternativeMaterial) => {
  if(alternative.costDifference < 0) return 'success'
  if(alternative.costDifference > 0) return 'warning-pill'
  return 'info-pill'
}

const findParentRecipe = (record: RecipeManagementRecord, records: RecipeManagementRecord[]) => (
  record.parentRecipeId
    ? records.find(item => item.id === record.parentRecipeId) || null
    : null
)

const formatParentRecipe = (record: RecipeManagementRecord, records: RecipeManagementRecord[]) => {
  if(record.recipeRole === 'PRIMARY') return '-'

  const parentRecipe = findParentRecipe(record, records)
  return parentRecipe ? `${parentRecipe.code} · ${parentRecipe.recipeName}` : 'Bağlı ana reçete bulunamadı.'
}

const countAlternativeRecipes = (record: RecipeManagementRecord, records: RecipeManagementRecord[]) => (
  record.recipeRole === 'PRIMARY'
    ? records.filter(item => item.parentRecipeId === record.id && item.recipeRole === 'ALTERNATIVE' && isRecipeVersionActive(item)).length
    : 0
)

const getNextRecipeCode = (records: RecipeManagementRecord[]) => {
  const maxNo = records.reduce((max, record) => {
    const match = record.code.match(/(\d+)$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)

  return `RC-${String(maxNo + 1).padStart(3, '0')}`
}

const getNextRecipeVersionNo = (records: RecipeManagementRecord[], masterId: string) => (
  records
    .filter(record => getRecipeMasterId(record) === masterId)
    .reduce((max, record) => Math.max(max, getRecipeVersionNo(record)), 0) + 1
)

const getSafeDateTime = (value?: string) => {
  const timestamp = Date.parse(value || '')
  return Number.isFinite(timestamp) ? timestamp : 0
}

const sortRecipeVersionsDesc = (records: RecipeManagementRecord[]) => (
  [...records].sort((first, second) => (
    getRecipeVersionNo(second) - getRecipeVersionNo(first)
    || getSafeDateTime(second.updatedAt || second.createdAt) - getSafeDateTime(first.updatedAt || first.createdAt)
  ))
)

const sortRecipeSnapshotsDesc = (records: RecipeSnapshot[]) => (
  [...records].sort((first, second) => (
    getSafeDateTime(second.snapshotDate) - getSafeDateTime(first.snapshotDate)
    || second.snapshotNo.localeCompare(first.snapshotNo, 'tr-TR')
  ))
)

const formatVersionLabel = (record: RecipeManagementRecord) => (
  `V${getRecipeVersionNo(record)} · ${getRecipeVersionStatus(record)}`
)

const formatSnapshotLabel = (snapshot: RecipeSnapshot) => (
  `${snapshot.snapshotNo} · V${snapshot.versionNo} · ${formatDateTime(snapshot.snapshotDate)}`
)

const sortCostSnapshotsDesc = (records: HistoricalCostSnapshot[]) => (
  RecipeCostSnapshotService.sortDesc(records)
)

const formatCostSnapshotLabel = (snapshot: HistoricalCostSnapshot) => (
  RecipeCostSnapshotService.formatLabel(snapshot)
)

const toSafeText = (value: unknown) => String(value ?? '')

const escapeHtml = (value: unknown) => (
  toSafeText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
)

const buildRecipeVersionDiffRows = (
  sourceRecord: RecipeManagementRecord,
  targetRecord: RecipeManagementRecord
): RecipeVersionDiffRow[] => {
  const sourceCost = calculateRecipeCost(sourceRecord)
  const targetCost = calculateRecipeCost(targetRecord)
  const rows: RecipeVersionDiffRow[] = [
    {
      area: 'Fire',
      item: 'Fire oranı',
      sourceValue: `${formatFirePercent(sourceRecord.firePercent)} %`,
      targetValue: `${formatFirePercent(targetRecord.firePercent)} %`,
      difference: `${formatFirePercent(targetRecord.firePercent - sourceRecord.firePercent)} puan`
    },
    {
      area: 'Yield',
      item: 'Verim',
      sourceValue: `${formatFirePercent(getRecipeYieldPercent(sourceRecord))} %`,
      targetValue: `${formatFirePercent(getRecipeYieldPercent(targetRecord))} %`,
      difference: `${formatFirePercent(getRecipeYieldPercent(targetRecord) - getRecipeYieldPercent(sourceRecord))} puan`
    },
    {
      area: 'Maliyet',
      item: 'Toplam reçete maliyeti',
      sourceValue: formatRecipeCostAmount(sourceCost.recipeCost),
      targetValue: formatRecipeCostAmount(targetCost.recipeCost),
      difference: formatRecipeCostAmount(targetCost.recipeCost - sourceCost.recipeCost)
    },
    {
      area: 'Süre',
      item: 'Toplam süre',
      sourceValue: `${formatNumber(getRecipeTotalMinutes(sourceRecord))} dk`,
      targetValue: `${formatNumber(getRecipeTotalMinutes(targetRecord))} dk`,
      difference: `${formatNumber(getRecipeTotalMinutes(targetRecord) - getRecipeTotalMinutes(sourceRecord))} dk`
    }
  ]
  const sourceIngredients = new Map(sourceRecord.ingredients.map(ingredient => [
    ingredient.materialName.trim().toLocaleLowerCase('tr-TR'),
    ingredient
  ]))
  const targetIngredients = new Map(targetRecord.ingredients.map(ingredient => [
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

    const quantityDifference = targetIngredient.baseQuantity - sourceIngredient.baseQuantity
    const costDifference = targetIngredient.unitCost - sourceIngredient.unitCost
    if(quantityDifference === 0 && costDifference === 0 && sourceIngredient.unit === targetIngredient.unit) return

    rows.push({
      area: 'Gramaj',
      item: materialName,
      sourceValue: `${formatNumber(sourceIngredient.quantity)} ${sourceIngredient.unit}`,
      targetValue: `${formatNumber(targetIngredient.quantity)} ${targetIngredient.unit}`,
      difference: `${formatNumber(quantityDifference)} ${targetIngredient.baseUnit}`
    })

    if(costDifference !== 0){
      rows.push({
        area: 'Maliyet',
        item: `${materialName} birim maliyet`,
        sourceValue: formatRecipeCostAmount(sourceIngredient.unitCost),
        targetValue: formatRecipeCostAmount(targetIngredient.unitCost),
        difference: formatRecipeCostAmount(costDifference)
      })
    }
  })

  return rows
}

const openRecipePrintWindow = (
  title: string,
  columns: string[],
  rows: Array<Array<string | number>>,
  mode: 'PDF' | 'PRINT'
) => {
  const printWindow = window.open('', '_blank', 'width=1100,height=760')
  if(!printWindow) return false

  printWindow.document.write(`<!doctype html>
    <html lang="tr">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)} ${mode === 'PDF' ? 'PDF' : 'Yazdır'}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #17202a; padding: 24px; }
          h1 { font-size: 20px; margin: 0 0 12px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #d8e0ea; padding: 8px; text-align: left; vertical-align: top; }
          th { background: #eef4fb; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)}</h1>
        <table>
          <thead><tr>${columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
        <script>window.onload = () => window.print()</script>
      </body>
    </html>`)
  printWindow.document.close()
  return true
}

const createInitialRecipeForm = (records: RecipeManagementRecord[]): RecipeFormState => ({
  code: getNextRecipeCode(records),
  recipeName: '',
  recipeType: 'Ana Ürün',
  recipeRole: 'PRIMARY',
  parentRecipeId: '',
  productName: '',
  portions: '1',
  firePercent: '0',
  status: 'Aktif',
  versionStatus: 'Aktif',
  versionDescription: '',
  revisionNote: 'İlk yayın',
  preparationMinutes: '24',
  cookingMinutes: '36',
  restingMinutes: '0',
  yieldPercent: '100',
  description: ''
})

const createRecipeFormFromRecord = (record: RecipeManagementRecord): RecipeFormState => ({
  code: record.code,
  recipeName: record.recipeName,
  recipeType: record.recipeType,
  recipeRole: record.recipeRole,
  parentRecipeId: record.parentRecipeId || '',
  productName: record.productName,
  portions: String(record.portions),
  firePercent: String(Number.isFinite(record.firePercent) ? record.firePercent : 0),
  status: record.status,
  versionStatus: isRecipeVersionActive(record) ? 'Taslak' : getRecipeVersionStatus(record),
  versionDescription: record.versionDescription || record.description,
  revisionNote: record.revisionNote || `V${getRecipeVersionNo(record) + 1} revizyonu`,
  preparationMinutes: String(record.preparationMinutes ?? 24),
  cookingMinutes: String(record.cookingMinutes ?? 36),
  restingMinutes: String(record.restingMinutes ?? 0),
  yieldPercent: String(getRecipeYieldPercent(record)),
  description: record.description
})

const createInitialIngredientForm = (): IngredientFormState => ({
  materialName: '',
  quantity: '1',
  unit: 'gr',
  unitCost: '1'
})

const createIngredientFormFromRecord = (ingredient: RecipeIngredient): IngredientFormState => ({
  materialName: ingredient.materialName,
  quantity: String(ingredient.quantity),
  unit: ingredient.unit,
  unitCost: String(Number.isFinite(ingredient.unitCost) ? ingredient.unitCost : 0)
})

const validateRecipeForm = (
  form: RecipeFormState,
  ingredients: RecipeIngredient[],
  records: RecipeManagementRecord[],
  editingRecipeId: string
) => {
  if(!form.code.trim()) return 'Kod zorunludur.'
  if(!form.recipeName.trim()) return 'Reçete adı zorunludur.'
  if(!form.productName.trim()) return 'Ürün zorunludur.'
  if(!form.recipeType.trim()) return 'Reçete türü zorunludur.'
  if(!RECIPE_MANAGEMENT_ROLES.includes(form.recipeRole)) return 'Reçete rolü zorunludur.'

  const existingRecord = editingRecipeId
    ? records.find(record => record.id === editingRecipeId) || null
    : null
  const existingMasterId = existingRecord ? getRecipeMasterId(existingRecord) : ''
  if(existingRecord?.recipeRole === 'PRIMARY' && form.recipeRole === 'ALTERNATIVE'){
    const alternativeCount = countAlternativeRecipes(existingRecord, records)
    if(alternativeCount > 0) return 'Bağlı alternatifleri olan ana reçetenin rolü değiştirilemez.'
  }

  const normalizedProductName = form.productName.trim().toLocaleLowerCase('tr-TR')
  if(form.recipeRole === 'PRIMARY'){
    const duplicatePrimaryProduct = records.some(record => (
      record.id !== editingRecipeId
      && record.recipeRole === 'PRIMARY'
      && isRecipeVersionActive(record)
      && (!existingMasterId || getRecipeMasterId(record) !== existingMasterId)
      && record.productName.trim().toLocaleLowerCase('tr-TR') === normalizedProductName
    ))
    if(duplicatePrimaryProduct) return 'Bu ürün için zaten bir ana reçete tanımlı.'
  }

  if(form.recipeRole === 'ALTERNATIVE'){
    if(!form.parentRecipeId) return 'Alternatif reçete için bağlı ana reçete seçilmelidir.'

    const parentRecipe = records.find(record => record.id === form.parentRecipeId && record.recipeRole === 'PRIMARY')
    if(!parentRecipe) return 'Bağlı ana reçete geçerli olmalıdır.'
    if(parentRecipe.id === editingRecipeId) return 'Reçete kendisine bağlı alternatif olamaz.'
    if(parentRecipe.productName.trim().toLocaleLowerCase('tr-TR') !== normalizedProductName){
      return 'Alternatif reçetenin ürünü bağlı ana reçete ile aynı olmalıdır.'
    }
  }

  const portions = Number(form.portions)
  if(!form.portions.trim()) return 'Porsiyon boş bırakılamaz.'
  if(!Number.isFinite(portions)) return 'Porsiyon için geçerli bir sayı girilmelidir.'
  if(portions <= 0) return 'Porsiyon 0 veya negatif olamaz.'
  if(portions > 100000) return 'Porsiyon 100000 üzerinde olamaz.'

  const firePercent = Number(form.firePercent)
  if(!form.firePercent.trim()) return 'Fire yüzdesi boş bırakılamaz.'
  if(!Number.isFinite(firePercent)) return 'Fire yüzdesi için geçerli bir sayı girilmelidir.'
  if(firePercent < MIN_FIRE_PERCENT) return 'Fire yüzdesi negatif olamaz.'
  if(firePercent > MAX_FIRE_PERCENT) return 'Fire yüzdesi 100 değerini geçemez.'

  if(!RECIPE_VERSION_STATUSES.includes(form.versionStatus)) return 'Versiyon durumu geçerli olmalıdır.'
  const preparationMinutes = Number(form.preparationMinutes)
  const cookingMinutes = Number(form.cookingMinutes)
  const restingMinutes = Number(form.restingMinutes)
  const yieldPercent = Number(form.yieldPercent)
  if(!form.preparationMinutes.trim() || !Number.isFinite(preparationMinutes) || preparationMinutes < 0 || preparationMinutes > MAX_RECIPE_MINUTES){
    return 'Hazırlama süresi 0 ile 10080 dakika arasında olmalıdır.'
  }
  if(!form.cookingMinutes.trim() || !Number.isFinite(cookingMinutes) || cookingMinutes < 0 || cookingMinutes > MAX_RECIPE_MINUTES){
    return 'Pişirme süresi 0 ile 10080 dakika arasında olmalıdır.'
  }
  if(!form.restingMinutes.trim() || !Number.isFinite(restingMinutes) || restingMinutes < 0 || restingMinutes > MAX_RECIPE_MINUTES){
    return 'Dinlendirme süresi 0 ile 10080 dakika arasında olmalıdır.'
  }
  if(!form.yieldPercent.trim() || !Number.isFinite(yieldPercent) || yieldPercent < 0 || yieldPercent > 100){
    return 'Yield değeri 0 ile 100 arasında olmalıdır.'
  }

  if(ingredients.length === 0) return 'En az 1 malzeme eklenmelidir.'
  if(ingredients.some(ingredient => (
    !ingredient.materialName.trim()
    || ingredient.quantity <= 0
    || ingredient.quantity > MAX_INGREDIENT_QUANTITY
    || !RECIPE_INGREDIENT_UNITS.includes(ingredient.unit)
    || !Number.isFinite(ingredient.unitCost)
    || ingredient.unitCost <= 0
    || ingredient.unitCost > MAX_INGREDIENT_UNIT_COST
  ))){
    return 'Tüm malzemelerde hammadde, miktar, birim ve birim maliyet geçerli olmalıdır.'
  }

  const normalizedCode = form.code.trim().toLocaleLowerCase('tr-TR')
  const duplicateCode = records.some(record => (
    record.id !== editingRecipeId
    && record.code.trim().toLocaleLowerCase('tr-TR') === normalizedCode
    && (!existingMasterId || getRecipeMasterId(record) !== existingMasterId)
  ))
  if(duplicateCode) return 'Bu kod zaten kullanılıyor.'

  return ''
}

const validateIngredientForm = (form: IngredientFormState) => {
  if(!form.materialName.trim()) return 'Malzeme adı zorunludur.'

  const quantity = Number(form.quantity)
  if(!form.quantity.trim()) return 'Miktar boş bırakılamaz.'
  if(!Number.isFinite(quantity)) return 'Miktar için geçerli bir sayı girilmelidir.'
  if(quantity <= 0) return 'Miktar 0 veya negatif olamaz.'
  if(quantity > MAX_INGREDIENT_QUANTITY) return 'Miktar 100000 değerini geçemez.'
  if(!RECIPE_INGREDIENT_UNITS.includes(form.unit)) return 'Birim zorunludur.'

  const unitCost = Number(form.unitCost)
  if(!form.unitCost.trim()) return 'Birim maliyet boş bırakılamaz.'
  if(!Number.isFinite(unitCost)) return 'Birim maliyet için geçerli bir sayı girilmelidir.'
  if(unitCost <= 0) return 'Birim maliyet 0 veya negatif olamaz.'
  if(unitCost > MAX_INGREDIENT_UNIT_COST) return 'Birim maliyet 1000000 değerini geçemez.'

  return ''
}

export default function Recipes(){
  const [records, setRecords] = React.useState<RecipeManagementRecord[]>(() => loadRecipeManagementRecords())
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>('all')
  const [versionStatusFilter, setVersionStatusFilter] = React.useState<VersionStatusFilter>('all')
  const [selectedRecordId, setSelectedRecordId] = React.useState('recipe_mgmt_001')
  const [compareSourceId, setCompareSourceId] = React.useState('')
  const [compareTargetId, setCompareTargetId] = React.useState('')
  const [recipeSnapshots] = React.useState<RecipeSnapshot[]>(() => RecipeSnapshotService.load())
  const [costSnapshots] = React.useState<HistoricalCostSnapshot[]>(() => RecipeCostSnapshotService.load(records, recipeSnapshots))
  const [alternativeMaterialGroups] = React.useState<AlternativeMaterialGroup[]>(() => RecipeAlternativeMaterialService.load(records))
  const [selectedSnapshotId, setSelectedSnapshotId] = React.useState('')
  const [snapshotCompareSourceId, setSnapshotCompareSourceId] = React.useState('')
  const [snapshotCompareTargetId, setSnapshotCompareTargetId] = React.useState('')
  const [selectedCostSnapshotId, setSelectedCostSnapshotId] = React.useState('')
  const [costCompareSourceId, setCostCompareSourceId] = React.useState('')
  const [costCompareTargetId, setCostCompareTargetId] = React.useState('')
  const [selectedIngredientId, setSelectedIngredientId] = React.useState('')
  const [panelMode, setPanelMode] = React.useState<PanelMode>('summary')
  const [viewMode, setViewMode] = React.useState<ViewMode>('list')
  const [editingRecipeId, setEditingRecipeId] = React.useState('')
  const [recipeForm, setRecipeForm] = React.useState<RecipeFormState>(() => createInitialRecipeForm(loadRecipeManagementRecords()))
  const [recipeFormError, setRecipeFormError] = React.useState('')
  const [recipeFormIngredients, setRecipeFormIngredients] = React.useState<RecipeIngredient[]>([])
  const [recipeIngredientForm, setRecipeIngredientForm] = React.useState<IngredientFormState>(() => createInitialIngredientForm())
  const [recipeIngredientEditingId, setRecipeIngredientEditingId] = React.useState('')
  const [recipeIngredientError, setRecipeIngredientError] = React.useState('')
  const [ingredientForm, setIngredientForm] = React.useState<IngredientFormState>(() => createInitialIngredientForm())
  const [ingredientFormVisible, setIngredientFormVisible] = React.useState(false)
  const [editingIngredientId, setEditingIngredientId] = React.useState('')
  const [ingredientFormError, setIngredientFormError] = React.useState('')
  const [toast, setToast] = React.useState<ToastState | null>(null)
  const [pendingAlternativeScroll, setPendingAlternativeScroll] = React.useState(false)
  const alternativeSectionRef = React.useRef<HTMLElement | null>(null)

  const commitRecords = React.useCallback((updater: React.SetStateAction<RecipeManagementRecord[]>) => {
    setRecords(prev => {
      const nextRecords = typeof updater === 'function'
        ? (updater as (current: RecipeManagementRecord[]) => RecipeManagementRecord[])(prev)
        : updater
      const normalizedRecords = enforceSingleActiveRecipeVersions(nextRecords)
      saveRecipeManagementRecords(normalizedRecords)
      return normalizedRecords
    })
  }, [])

  const showToast = React.useCallback((text: string, tone: ToastTone = 'success') => {
    setToast({
      id: createId('recipe_toast'),
      text,
      tone
    })
  }, [])

  const visibleRecords = React.useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase('tr-TR')

    return records.filter(record => {
      const roleLabel = getRecipeRoleLabel(record.recipeRole)
      const roleText = record.recipeRole === 'PRIMARY' ? 'Ana Reçete' : 'Alternatif Reçete'
      const parentRecipeText = formatParentRecipe(record, records)
      const versionText = `V${getRecipeVersionNo(record)} ${getRecipeVersionStatus(record)} ${record.revisionNote || ''}`
      const matchesSearch = !normalizedSearch
        || record.code.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || record.recipeName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || record.productName.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || roleLabel.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || roleText.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || parentRecipeText.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
        || versionText.toLocaleLowerCase('tr-TR').includes(normalizedSearch)
      const matchesStatus = statusFilter === 'all' || record.status === statusFilter
      const matchesRole = roleFilter === 'all' || record.recipeRole === roleFilter
      const matchesVersionStatus = versionStatusFilter === 'all' || getRecipeVersionStatus(record) === versionStatusFilter

      return matchesSearch && matchesStatus && matchesRole && matchesVersionStatus
    })
  }, [records, roleFilter, search, statusFilter, versionStatusFilter])

  React.useEffect(() => {
    if(panelMode === 'form' || viewMode === 'detail') return
    if(visibleRecords.some(record => record.id === selectedRecordId)) return
    setSelectedRecordId(visibleRecords[0]?.id || '')
  }, [panelMode, selectedRecordId, viewMode, visibleRecords])

  React.useEffect(() => {
    if(!toast) return undefined

    const timeoutId = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeoutId)
  }, [toast])

  React.useEffect(() => {
    if(!pendingAlternativeScroll || viewMode !== 'detail') return undefined

    const timeoutId = window.setTimeout(() => {
      alternativeSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      })
      setPendingAlternativeScroll(false)
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [pendingAlternativeScroll, viewMode])

  const recordsById = React.useMemo(() => {
    const nextRecordsById = new Map<string, RecipeManagementRecord>()
    records.forEach(record => nextRecordsById.set(record.id, record))
    return nextRecordsById
  }, [records])
  const alternativeRecipesByParentId = React.useMemo(() => {
    const nextAlternativesByParentId = new Map<string, RecipeManagementRecord[]>()
    records.forEach(record => {
      if(record.recipeRole !== 'ALTERNATIVE' || !record.parentRecipeId || !isRecipeVersionActive(record)) return

      const parentAlternatives = nextAlternativesByParentId.get(record.parentRecipeId) || []
      parentAlternatives.push(record)
      nextAlternativesByParentId.set(record.parentRecipeId, parentAlternatives)
    })
    return nextAlternativesByParentId
  }, [records])
  const selectedRecord = recordsById.get(selectedRecordId) || null
  const selectedAlternativeRecipes = React.useMemo(() => (
    selectedRecord?.recipeRole === 'PRIMARY'
      ? alternativeRecipesByParentId.get(selectedRecord.id) || []
      : []
  ), [alternativeRecipesByParentId, selectedRecord])
  const selectedParentRecord = React.useMemo(() => (
    selectedRecord?.recipeRole === 'ALTERNATIVE' && selectedRecord.parentRecipeId
      ? recordsById.get(selectedRecord.parentRecipeId) || null
      : null
  ), [recordsById, selectedRecord])
  const selectedAlternativeMaterialGroups = React.useMemo(() => (
    selectedRecord
      ? RecipeAlternativeMaterialService.getForRecipe(selectedRecord, alternativeMaterialGroups)
      : []
  ), [alternativeMaterialGroups, selectedRecord])
  const selectedAlternativeGroupByIngredientId = React.useMemo(() => {
    const nextGroupsByIngredientId = new Map<string, AlternativeMaterialGroup>()
    selectedAlternativeMaterialGroups.forEach(group => nextGroupsByIngredientId.set(group.ingredientId, group))
    return nextGroupsByIngredientId
  }, [selectedAlternativeMaterialGroups])
  const selectedIngredient = React.useMemo(() => (
    selectedRecord?.ingredients.find(ingredient => ingredient.id === selectedIngredientId)
    || selectedRecord?.ingredients[0]
    || null
  ), [selectedIngredientId, selectedRecord])
  const selectedIngredientAlternativeGroup = selectedIngredient
    ? selectedAlternativeGroupByIngredientId.get(selectedIngredient.id) || null
    : null
  const selectedAlternativeMaterials = selectedIngredientAlternativeGroup?.alternatives || []
  const selectedAlternativeCostComparisons = React.useMemo(() => (
    selectedIngredientAlternativeGroup
      ? RecipeAlternativeMaterialService.buildCostComparisons([selectedIngredientAlternativeGroup])
      : []
  ), [selectedIngredientAlternativeGroup])
  const approvedAlternativeMaterialCount = React.useMemo(() => (
    selectedAlternativeMaterialGroups.reduce((sum, group) => (
      sum + group.alternatives.filter(RecipeAlternativeMaterialService.isApprovedForUse).length
    ), 0)
  ), [selectedAlternativeMaterialGroups])
  React.useEffect(() => {
    if(!selectedRecord){
      setSelectedIngredientId('')
      return
    }

    setSelectedIngredientId(current => (
      selectedRecord.ingredients.some(ingredient => ingredient.id === current)
        ? current
        : selectedRecord.ingredients[0]?.id || ''
    ))
  }, [selectedRecord])
  const isEditingRecipe = Boolean(editingRecipeId)
  const selectedMasterRecords = React.useMemo(() => (
    selectedRecord
      ? sortRecipeVersionsDesc(records.filter(record => getRecipeMasterId(record) === getRecipeMasterId(selectedRecord)))
      : []
  ), [records, selectedRecord])
  React.useEffect(() => {
    const versionIds = selectedMasterRecords.map(record => record.id)
    if(versionIds.length === 0) return

    setCompareSourceId(current => versionIds.includes(current) ? current : versionIds[0])
    setCompareTargetId(current => versionIds.includes(current) ? current : versionIds[1] || versionIds[0])
  }, [selectedMasterRecords])
  const selectedRecipeSnapshots = React.useMemo(() => (
    selectedRecord
      ? sortRecipeSnapshotsDesc(recipeSnapshots.filter(snapshot => (
          snapshot.recipeMasterId === getRecipeMasterId(selectedRecord)
          || snapshot.recipeVersionId === selectedRecord.id
        )))
      : []
  ), [recipeSnapshots, selectedRecord])
  const snapshotsById = React.useMemo(() => {
    const nextSnapshotsById = new Map<string, RecipeSnapshot>()
    recipeSnapshots.forEach(snapshot => nextSnapshotsById.set(snapshot.id, snapshot))
    return nextSnapshotsById
  }, [recipeSnapshots])
  const selectedSnapshot = snapshotsById.get(selectedSnapshotId)
    || selectedRecipeSnapshots[0]
    || null
  React.useEffect(() => {
    const snapshotIds = selectedRecipeSnapshots.map(snapshot => snapshot.id)
    if(snapshotIds.length === 0) return

    setSelectedSnapshotId(current => snapshotIds.includes(current) ? current : snapshotIds[0])
    setSnapshotCompareSourceId(current => snapshotIds.includes(current) ? current : snapshotIds[0])
    setSnapshotCompareTargetId(current => snapshotIds.includes(current) ? current : snapshotIds[1] || snapshotIds[0])
  }, [selectedRecipeSnapshots])
  const selectedCostSnapshots = React.useMemo(() => (
    selectedRecord
      ? sortCostSnapshotsDesc(RecipeCostSnapshotService.getForRecipe(selectedRecord, costSnapshots))
      : []
  ), [costSnapshots, selectedRecord])
  const costSnapshotsById = React.useMemo(() => {
    const nextCostSnapshotsById = new Map<string, HistoricalCostSnapshot>()
    costSnapshots.forEach(snapshot => nextCostSnapshotsById.set(snapshot.id, snapshot))
    return nextCostSnapshotsById
  }, [costSnapshots])
  const selectedCostSnapshot = costSnapshotsById.get(selectedCostSnapshotId)
    || selectedCostSnapshots[0]
    || null
  React.useEffect(() => {
    const costSnapshotIds = selectedCostSnapshots.map(snapshot => snapshot.id)
    if(costSnapshotIds.length === 0) return

    setSelectedCostSnapshotId(current => costSnapshotIds.includes(current) ? current : costSnapshotIds[0])
    setCostCompareSourceId(current => costSnapshotIds.includes(current) ? current : costSnapshotIds[0])
    setCostCompareTargetId(current => costSnapshotIds.includes(current) ? current : costSnapshotIds[1] || costSnapshotIds[0])
  }, [selectedCostSnapshots])
  const selectedCostTrendSummary = React.useMemo(() => (
    RecipeCostSnapshotService.buildTrendSummary(selectedCostSnapshots)
  ), [selectedCostSnapshots])
  const totalRecipeMasters = new Set(records.map(getRecipeMasterId)).size
  const totalRecipeVersions = records.length
  const activeRecipes = records.filter(isRecipeVersionActive).length
  const totalIngredients = records.reduce((sum, record) => sum + record.ingredients.length, 0)
  const totalAlternativeGroups = alternativeMaterialGroups.length
  const totalAlternativeMaterials = React.useMemo(() => (
    RecipeAlternativeMaterialService.flatten(alternativeMaterialGroups).length
  ), [alternativeMaterialGroups])
  const totalCostSnapshots = costSnapshots.length
  const totalPortions = records.reduce((sum, record) => sum + record.portions, 0)
  const productOptions = React.useMemo(() => {
    const options = new Set<string>(RECIPE_PRODUCT_OPTIONS)
    records.forEach(record => {
      if(record.productName.trim()) options.add(record.productName.trim())
    })
    if(recipeForm.productName.trim()) options.add(recipeForm.productName.trim())
    return Array.from(options)
  }, [records, recipeForm.productName])
  const primaryRecipeOptions = React.useMemo(() => (
    records.filter(record => record.recipeRole === 'PRIMARY' && isRecipeVersionActive(record) && record.id !== editingRecipeId)
  ), [editingRecipeId, records])

  const startNewRecipe = () => {
    setViewMode('list')
    setPanelMode('form')
    setEditingRecipeId('')
    setRecipeForm(createInitialRecipeForm(records))
    setRecipeFormIngredients([])
    setRecipeIngredientForm(createInitialIngredientForm())
    setRecipeIngredientEditingId('')
    setRecipeIngredientError('')
    setRecipeFormError('')
    setToast(null)
  }

  const startEditRecipe = (record: RecipeManagementRecord) => {
    if(getRecipeVersionStatus(record) === 'Arşiv'){
      showToast('Arşiv versiyon değiştirilemez. Yeni çalışma için aktif versiyondan yeni versiyon oluşturun.', 'info')
      return
    }

    setViewMode('list')
    setSelectedRecordId(record.id)
    setPanelMode('form')
    setEditingRecipeId(record.id)
    setRecipeForm(createRecipeFormFromRecord(record))
    setRecipeFormIngredients(record.ingredients)
    setRecipeIngredientForm(createInitialIngredientForm())
    setRecipeIngredientEditingId('')
    setRecipeIngredientError('')
    setRecipeFormError('')
    setToast(null)
  }

  const cancelRecipeForm = () => {
    setPanelMode('summary')
    setEditingRecipeId('')
    setRecipeForm(createInitialRecipeForm(records))
    setRecipeFormIngredients([])
    setRecipeIngredientForm(createInitialIngredientForm())
    setRecipeIngredientEditingId('')
    setRecipeIngredientError('')
    setRecipeFormError('')
  }

  const updateRecipeForm = <TKey extends keyof RecipeFormState>(
    key: TKey,
    value: RecipeFormState[TKey]
  ) => {
    setRecipeForm(prev => ({ ...prev, [key]: value }))
  }

  const updateRecipeRole = (recipeRole: RecipeManagementRole) => {
    setRecipeForm(prev => ({
      ...prev,
      recipeRole,
      parentRecipeId: recipeRole === 'PRIMARY' ? '' : prev.parentRecipeId
    }))
  }

  const updateParentRecipe = (parentRecipeId: string) => {
    const parentRecipe = records.find(record => record.id === parentRecipeId && record.recipeRole === 'PRIMARY')

    setRecipeForm(prev => ({
      ...prev,
      parentRecipeId,
      productName: parentRecipe?.productName || prev.productName
    }))
  }

  const updateIngredientForm = <TKey extends keyof IngredientFormState>(
    key: TKey,
    value: IngredientFormState[TKey]
  ) => {
    setIngredientForm(prev => ({ ...prev, [key]: value }))
  }

  const updateRecipeIngredientForm = <TKey extends keyof IngredientFormState>(
    key: TKey,
    value: IngredientFormState[TKey]
  ) => {
    setRecipeIngredientForm(prev => ({ ...prev, [key]: value }))
  }

  const resetRecipeIngredientForm = () => {
    setRecipeIngredientForm(createInitialIngredientForm())
    setRecipeIngredientEditingId('')
    setRecipeIngredientError('')
  }

  const startEditRecipeFormIngredient = (ingredient: RecipeIngredient) => {
    setRecipeIngredientForm(createIngredientFormFromRecord(ingredient))
    setRecipeIngredientEditingId(ingredient.id)
    setRecipeIngredientError('')
  }

  const saveRecipeFormIngredient = () => {
    const validationError = validateIngredientForm(recipeIngredientForm)
    if(validationError){
      setRecipeIngredientError(validationError)
      return
    }

    const nextIngredient = createIngredientFromForm(
      recipeIngredientEditingId || createId('recipe_ing'),
      recipeIngredientForm
    )

    setRecipeFormIngredients(prev => (
      recipeIngredientEditingId
        ? prev.map(ingredient => ingredient.id === recipeIngredientEditingId ? nextIngredient : ingredient)
        : [...prev, nextIngredient]
    ))
    resetRecipeIngredientForm()
    setRecipeFormError('')
  }

  const deleteRecipeFormIngredient = (ingredient: RecipeIngredient) => {
    setRecipeFormIngredients(prev => prev.filter(item => item.id !== ingredient.id))
    if(recipeIngredientEditingId === ingredient.id) resetRecipeIngredientForm()
  }

  const openDetail = (record: RecipeManagementRecord) => {
    setSelectedRecordId(record.id)
    setViewMode('detail')
    setPanelMode('summary')
    setIngredientFormVisible(false)
    setEditingIngredientId('')
    setIngredientFormError('')
    setPendingAlternativeScroll(false)
  }

  const scrollToAlternativeRecipes = () => {
    if(!selectedRecord || selectedRecord.recipeRole !== 'PRIMARY') return

    if(viewMode !== 'detail'){
      openDetail(selectedRecord)
      setPendingAlternativeScroll(true)
      return
    }

    alternativeSectionRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    })
  }

  const backToList = () => {
    setViewMode('list')
    setIngredientFormVisible(false)
    setEditingIngredientId('')
    setIngredientFormError('')
    setPendingAlternativeScroll(false)
  }

  const deleteRecipe = (record: RecipeManagementRecord) => {
    if(record.recipeRole === 'PRIMARY' && (alternativeRecipesByParentId.get(record.id)?.length || 0) > 0){
      showToast('Bu reçeteye bağlı aktif alternatif reçeteler bulunmaktadır.', 'info')
      return
    }

    if(getRecipeVersionStatus(record) === 'Arşiv'){
      showToast('Bu versiyon zaten arşivde.', 'info')
      return
    }

    if(!window.confirm('Bu reçete versiyonu soft archive ile arşivlenecek. Devam edilsin mi?')) return

    const now = new Date().toISOString()
    const archivedRecordId = record.id
    const nextRecords = records.map(item => (
      item.id === archivedRecordId
        ? {
            ...item,
            status: 'Pasif' as RecipeManagementStatus,
            versionStatus: 'Arşiv' as RecipeVersionStatus,
            isActiveVersion: false,
            archivedAt: now,
            updatedAt: now
          }
        : item
    ))

    commitRecords(nextRecords)
    setSelectedRecordId(nextRecords.find(item => item.id !== archivedRecordId && getRecipeMasterId(item) === getRecipeMasterId(record))?.id || nextRecords[0]?.id || '')
    setViewMode('list')
    setPanelMode('summary')

    if(editingRecipeId === record.id){
      setEditingRecipeId('')
      setRecipeForm(createInitialRecipeForm(nextRecords))
      setRecipeFormIngredients([])
      resetRecipeIngredientForm()
      setRecipeFormError('')
    }

    showToast('Reçete versiyonu arşivlendi.')
  }

  const activateRecipeVersion = (record: RecipeManagementRecord) => {
    if(getRecipeVersionStatus(record) === 'Arşiv'){
      showToast('Arşiv versiyon aktif edilemez.', 'info')
      return
    }

    if(isRecipeVersionActive(record)){
      showToast('Bu versiyon zaten aktif.', 'info')
      return
    }

    const now = new Date().toISOString()
    const masterId = getRecipeMasterId(record)

    commitRecords(prev => prev.map(item => {
      if(getRecipeMasterId(item) !== masterId) return item

      const isTargetVersion = item.id === record.id

      return {
        ...item,
        status: isTargetVersion ? 'Aktif' : 'Pasif',
        versionStatus: isTargetVersion ? 'Aktif' : (isRecipeVersionActive(item) ? 'Arşiv' : getRecipeVersionStatus(item)),
        isActiveVersion: isTargetVersion,
        publishedAt: isTargetVersion ? now : item.publishedAt,
        archivedAt: !isTargetVersion && isRecipeVersionActive(item) ? now : item.archivedAt,
        updatedAt: now
      }
    }))
    setSelectedRecordId(record.id)
    showToast(`V${getRecipeVersionNo(record)} aktif versiyon yapıldı.`)
  }

  const archiveRecipeVersion = (record: RecipeManagementRecord) => {
    deleteRecipe(record)
  }

  const getVersionHistoryRows = (versionRecords = selectedMasterRecords) => (
    versionRecords.map(record => [
      record.code,
      `V${getRecipeVersionNo(record)}`,
      getRecipeVersionStatus(record),
      record.createdBy || 'MIYOP Demo',
      formatDateTime(record.createdAt),
      formatDateTime(record.publishedAt),
      record.revisionNote || '-',
      isRecipeVersionActive(record) ? 'Evet' : 'Hayır'
    ])
  )

  const exportVersionHistoryExcel = () => {
    if(!selectedRecord) return

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Kod', 'Versiyon', 'Durum', 'Oluşturan', 'Oluşturulma', 'Yayın', 'Revizyon Notu', 'Aktif'],
      ...getVersionHistoryRows()
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Versiyon Geçmişi')
    XLSX.writeFile(workbook, `recete-version-history-${selectedRecord.code}.xlsx`)
    showToast('Versiyon geçmişi Excel oluşturuldu.')
  }

  const printVersionHistory = (mode: 'PDF' | 'PRINT') => {
    if(!selectedRecord) return

    const opened = openRecipePrintWindow(
      `${selectedRecord.code} Versiyon Geçmişi`,
      ['Kod', 'Versiyon', 'Durum', 'Oluşturan', 'Oluşturulma', 'Yayın', 'Revizyon Notu', 'Aktif'],
      getVersionHistoryRows(),
      mode
    )

    showToast(opened ? (mode === 'PDF' ? 'Versiyon geçmişi PDF hazırlandı.' : 'Versiyon geçmişi yazdırma hazırlandı.') : 'Yazdırma penceresi açılamadı.', opened ? 'success' : 'info')
  }

  const getSelectedDiffRows = () => {
    const sourceRecord = recordsById.get(compareSourceId)
    const targetRecord = recordsById.get(compareTargetId)
    if(!sourceRecord || !targetRecord) return []

    return buildRecipeVersionDiffRows(sourceRecord, targetRecord)
  }

  const exportDiffReportExcel = () => {
    if(!selectedRecord) return

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Alan', 'Kalem', 'Kaynak Versiyon', 'Hedef Versiyon', 'Fark'],
      ...getSelectedDiffRows().map(row => [row.area, row.item, row.sourceValue, row.targetValue, row.difference])
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fark Raporu')
    XLSX.writeFile(workbook, `recete-diff-report-${selectedRecord.code}.xlsx`)
    showToast('Fark raporu Excel oluşturuldu.')
  }

  const printDiffReport = (mode: 'PDF' | 'PRINT') => {
    if(!selectedRecord) return

    const opened = openRecipePrintWindow(
      `${selectedRecord.code} Fark Raporu`,
      ['Alan', 'Kalem', 'Kaynak Versiyon', 'Hedef Versiyon', 'Fark'],
      getSelectedDiffRows().map(row => [row.area, row.item, row.sourceValue, row.targetValue, row.difference]),
      mode
    )

    showToast(opened ? (mode === 'PDF' ? 'Fark raporu PDF hazırlandı.' : 'Fark raporu yazdırma hazırlandı.') : 'Yazdırma penceresi açılamadı.', opened ? 'success' : 'info')
  }

  const getSnapshotHistoryRows = (snapshots = selectedRecipeSnapshots) => (
    snapshots.map(snapshot => [
      snapshot.snapshotNo,
      snapshot.productionOrderNo,
      `V${snapshot.versionNo}`,
      formatDateTime(snapshot.snapshotDate),
      formatRecipeCostAmount(snapshot.totalCost),
      snapshot.createdBy,
      snapshot.ingredients.length
    ])
  )

  const exportSnapshotHistoryExcel = () => {
    if(!selectedRecord) return

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Snapshot No', 'Üretim Emri', 'Reçete Versiyonu', 'Snapshot Tarihi', 'Toplam Maliyet', 'Oluşturan', 'Malzeme Snapshot'],
      ...getSnapshotHistoryRows()
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Snapshot Geçmişi')
    XLSX.writeFile(workbook, `recete-snapshot-history-${selectedRecord.code}.xlsx`)
    showToast('Snapshot geçmişi Excel oluşturuldu.')
  }

  const printSnapshotHistory = (mode: RecipeSnapshotPrintMode) => {
    if(!selectedRecord) return

    const opened = openRecipePrintWindow(
      `${selectedRecord.code} Snapshot Geçmişi`,
      ['Snapshot No', 'Üretim Emri', 'Reçete Versiyonu', 'Snapshot Tarihi', 'Toplam Maliyet', 'Oluşturan', 'Malzeme Snapshot'],
      getSnapshotHistoryRows(),
      mode
    )

    showToast(opened ? (mode === 'PDF' ? 'Snapshot geçmişi PDF hazırlandı.' : 'Snapshot geçmişi yazdırma hazırlandı.') : 'Yazdırma penceresi açılamadı.', opened ? 'success' : 'info')
  }

  const getSnapshotDetailRows = (snapshot: RecipeSnapshot) => ([
    ['Snapshot No', snapshot.snapshotNo],
    ['Üretim Emri', snapshot.productionOrderNo],
    ['Reçete', `${snapshot.recipeCode} · ${snapshot.recipeName}`],
    ['Versiyon', `V${snapshot.versionNo}`],
    ['Snapshot Tarihi', formatDateTime(snapshot.snapshotDate)],
    ['Oluşturan', snapshot.createdBy],
    ['Fire', `${formatFirePercent(snapshot.firePercent)} %`],
    ['Yield', `${formatFirePercent(snapshot.yieldPercent)} %`],
    ['Toplam Süre', `${formatNumber(snapshot.totalMinutes)} dk`],
    ['Toplam Maliyet', formatRecipeCostAmount(snapshot.totalCost)],
    ...snapshot.ingredients.map(ingredient => [
      ingredient.materialName,
      `${formatNumber(ingredient.quantity)} ${ingredient.unit} · ${formatRecipeCostAmount(ingredient.totalCost)}`
    ])
  ])

  const exportSnapshotDetailExcel = () => {
    if(!selectedSnapshot) return

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Alan', 'Değer'],
      ...getSnapshotDetailRows(selectedSnapshot)
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Snapshot Detay')
    XLSX.writeFile(workbook, `recete-snapshot-detail-${selectedSnapshot.snapshotNo}.xlsx`)
    showToast('Snapshot detayı Excel oluşturuldu.')
  }

  const printSnapshotDetail = (mode: RecipeSnapshotPrintMode) => {
    if(!selectedSnapshot) return

    const opened = openRecipePrintWindow(
      `${selectedSnapshot.snapshotNo} Snapshot Detay`,
      ['Alan', 'Değer'],
      getSnapshotDetailRows(selectedSnapshot),
      mode
    )

    showToast(opened ? (mode === 'PDF' ? 'Snapshot detayı PDF hazırlandı.' : 'Snapshot detayı yazdırma hazırlandı.') : 'Yazdırma penceresi açılamadı.', opened ? 'success' : 'info')
  }

  const getSnapshotCompareRows = () => {
    const sourceSnapshot = snapshotsById.get(snapshotCompareSourceId)
    const targetSnapshot = snapshotsById.get(snapshotCompareTargetId)
    if(!sourceSnapshot || !targetSnapshot) return [] as RecipeSnapshotDiffRow[]

    return buildRecipeSnapshotDiffRows(sourceSnapshot, targetSnapshot)
  }

  const exportSnapshotCompareExcel = () => {
    if(!selectedRecord) return

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Alan', 'Kalem', 'Kaynak Snapshot', 'Hedef Snapshot', 'Fark'],
      ...getSnapshotCompareRows().map(row => [row.area, row.item, row.sourceValue, row.targetValue, row.difference])
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Snapshot Fark')
    XLSX.writeFile(workbook, `recete-snapshot-compare-${selectedRecord.code}.xlsx`)
    showToast('Snapshot karşılaştırma Excel oluşturuldu.')
  }

  const printSnapshotCompare = (mode: RecipeSnapshotPrintMode) => {
    if(!selectedRecord) return

    const opened = openRecipePrintWindow(
      `${selectedRecord.code} Snapshot Karşılaştırma`,
      ['Alan', 'Kalem', 'Kaynak Snapshot', 'Hedef Snapshot', 'Fark'],
      getSnapshotCompareRows().map(row => [row.area, row.item, row.sourceValue, row.targetValue, row.difference]),
      mode
    )

    showToast(opened ? (mode === 'PDF' ? 'Snapshot karşılaştırma PDF hazırlandı.' : 'Snapshot karşılaştırma yazdırma hazırlandı.') : 'Yazdırma penceresi açılamadı.', opened ? 'success' : 'info')
  }

  const getCostHistoryRows = (snapshots = selectedCostSnapshots) => (
    snapshots.map(snapshot => [
      snapshot.snapshotNo,
      formatDateTime(snapshot.snapshotDate),
      RecipeCostSnapshotService.formatAmount(snapshot.grandTotalCost, snapshot.currency),
      RecipeCostSnapshotService.formatAmount(snapshot.unitCost, snapshot.currency),
      `V${snapshot.versionNo}`,
      snapshot.productionOrderNo,
      snapshot.createdBy
    ])
  )

  const exportCostHistoryExcel = () => {
    if(!selectedRecord) return

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Snapshot No', 'Tarih', 'Toplam Maliyet', 'Birim Maliyet', 'Versiyon', 'Üretim Emri', 'Oluşturan'],
      ...getCostHistoryRows()
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Maliyet Geçmişi')
    XLSX.writeFile(workbook, `recete-cost-history-${selectedRecord.code}.xlsx`)
    showToast('Maliyet geçmişi Excel oluşturuldu.')
  }

  const printCostHistory = (mode: RecipeSnapshotPrintMode) => {
    if(!selectedRecord) return

    const opened = openRecipePrintWindow(
      `${selectedRecord.code} Maliyet Geçmişi`,
      ['Snapshot No', 'Tarih', 'Toplam Maliyet', 'Birim Maliyet', 'Versiyon', 'Üretim Emri', 'Oluşturan'],
      getCostHistoryRows(),
      mode
    )

    showToast(opened ? (mode === 'PDF' ? 'Maliyet geçmişi PDF hazırlandı.' : 'Maliyet geçmişi yazdırma hazırlandı.') : 'Yazdırma penceresi açılamadı.', opened ? 'success' : 'info')
  }

  const getCostDetailRows = (snapshot: HistoricalCostSnapshot) => ([
    ['Snapshot No', snapshot.snapshotNo],
    ['Recipe Snapshot', snapshot.recipeSnapshotId],
    ['Üretim Emri', snapshot.productionOrderNo],
    ['Reçete', `${snapshot.recipeCode} · ${snapshot.recipeName}`],
    ['Versiyon', `V${snapshot.versionNo}`],
    ['Tarih', formatDateTime(snapshot.snapshotDate)],
    ['Para Birimi', snapshot.currency],
    ['Hammadde', RecipeCostSnapshotService.formatAmount(snapshot.totalMaterialCost, snapshot.currency)],
    ['İşçilik', RecipeCostSnapshotService.formatAmount(snapshot.totalLaborCost, snapshot.currency)],
    ['Enerji', RecipeCostSnapshotService.formatAmount(snapshot.totalEnergyCost, snapshot.currency)],
    ['Paketleme', RecipeCostSnapshotService.formatAmount(snapshot.totalPackagingCost, snapshot.currency)],
    ['Lojistik', RecipeCostSnapshotService.formatAmount(snapshot.totalLogisticsCost, snapshot.currency)],
    ['Fire', RecipeCostSnapshotService.formatAmount(snapshot.totalWasteCost, snapshot.currency)],
    ['Genel Gider', RecipeCostSnapshotService.formatAmount(snapshot.totalOverheadCost, snapshot.currency)],
    ['Toplam Maliyet', RecipeCostSnapshotService.formatAmount(snapshot.grandTotalCost, snapshot.currency)],
    ['Birim Maliyet', RecipeCostSnapshotService.formatAmount(snapshot.unitCost, snapshot.currency)],
    ['Oluşturan', snapshot.createdBy],
    ...snapshot.ingredients.map(ingredient => [
      ingredient.materialName,
      `${formatNumber(ingredient.quantity)} ${ingredient.unit} · ${RecipeCostSnapshotService.formatAmount(ingredient.unitPrice, ingredient.currency)} · ${RecipeCostSnapshotService.formatAmount(ingredient.lineTotal, ingredient.currency)} · ${ingredient.supplier}`
    ])
  ])

  const exportCostDetailExcel = () => {
    if(!selectedCostSnapshot) return

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Alan', 'Değer'],
      ...getCostDetailRows(selectedCostSnapshot)
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Maliyet Snapshot Detay')
    XLSX.writeFile(workbook, `recete-cost-detail-${selectedCostSnapshot.snapshotNo}.xlsx`)
    showToast('Maliyet snapshot detayı Excel oluşturuldu.')
  }

  const printCostDetail = (mode: RecipeSnapshotPrintMode) => {
    if(!selectedCostSnapshot) return

    const opened = openRecipePrintWindow(
      `${selectedCostSnapshot.snapshotNo} Maliyet Snapshot Detay`,
      ['Alan', 'Değer'],
      getCostDetailRows(selectedCostSnapshot),
      mode
    )

    showToast(opened ? (mode === 'PDF' ? 'Maliyet snapshot detayı PDF hazırlandı.' : 'Maliyet snapshot detayı yazdırma hazırlandı.') : 'Yazdırma penceresi açılamadı.', opened ? 'success' : 'info')
  }

  const getCostCompareRows = () => {
    const sourceSnapshot = costSnapshotsById.get(costCompareSourceId)
    const targetSnapshot = costSnapshotsById.get(costCompareTargetId)
    if(!sourceSnapshot || !targetSnapshot) return [] as HistoricalCostSnapshotDiffRow[]

    return RecipeCostSnapshotService.buildDiffRows(sourceSnapshot, targetSnapshot)
  }

  const exportCostCompareExcel = () => {
    if(!selectedRecord) return

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Alan', 'Kaynak Snapshot', 'Hedef Snapshot', 'Mutlak Fark', 'Yüzde Fark'],
      ...getCostCompareRows().map(row => [row.area, row.sourceValue, row.targetValue, row.absoluteDifference, row.percentDifference])
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Maliyet Karşılaştırma')
    XLSX.writeFile(workbook, `recete-cost-compare-${selectedRecord.code}.xlsx`)
    showToast('Maliyet karşılaştırma Excel oluşturuldu.')
  }

  const printCostCompare = (mode: RecipeSnapshotPrintMode) => {
    if(!selectedRecord) return

    const opened = openRecipePrintWindow(
      `${selectedRecord.code} Maliyet Karşılaştırma`,
      ['Alan', 'Kaynak Snapshot', 'Hedef Snapshot', 'Mutlak Fark', 'Yüzde Fark'],
      getCostCompareRows().map(row => [row.area, row.sourceValue, row.targetValue, row.absoluteDifference, row.percentDifference]),
      mode
    )

    showToast(opened ? (mode === 'PDF' ? 'Maliyet karşılaştırma PDF hazırlandı.' : 'Maliyet karşılaştırma yazdırma hazırlandı.') : 'Yazdırma penceresi açılamadı.', opened ? 'success' : 'info')
  }

  const getTrendRows = (
    periodLabel: string,
    points: HistoricalCostTrendPoint[]
  ) => points.map(point => [
    periodLabel,
    point.label,
    point.formattedValue
  ])

  const getCostTrendRows = () => [
    ['Özet', 'Son Maliyet', RecipeCostSnapshotService.formatAmount(selectedCostTrendSummary.latestCost)],
    ['Özet', 'Ortalama Maliyet', RecipeCostSnapshotService.formatAmount(selectedCostTrendSummary.averageCost)],
    ['Özet', 'En Yüksek Maliyet', RecipeCostSnapshotService.formatAmount(selectedCostTrendSummary.highestCost)],
    ['Özet', 'En Düşük Maliyet', RecipeCostSnapshotService.formatAmount(selectedCostTrendSummary.lowestCost)],
    ['Özet', 'Son 30 Gün Değişimi', `${formatFirePercent(selectedCostTrendSummary.last30DayChangePercent)} %`],
    ...getTrendRows('Günlük', selectedCostTrendSummary.daily),
    ...getTrendRows('Haftalık', selectedCostTrendSummary.weekly),
    ...getTrendRows('Aylık', selectedCostTrendSummary.monthly)
  ]

  const exportCostTrendExcel = () => {
    if(!selectedRecord) return

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Periyot', 'Etiket', 'Değer'],
      ...getCostTrendRows()
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Maliyet Trend')
    XLSX.writeFile(workbook, `recete-cost-trend-${selectedRecord.code}.xlsx`)
    showToast('Maliyet trend Excel oluşturuldu.')
  }

  const printCostTrend = (mode: RecipeSnapshotPrintMode) => {
    if(!selectedRecord) return

    const opened = openRecipePrintWindow(
      `${selectedRecord.code} Maliyet Trend`,
      ['Periyot', 'Etiket', 'Değer'],
      getCostTrendRows(),
      mode
    )

    showToast(opened ? (mode === 'PDF' ? 'Maliyet trend PDF hazırlandı.' : 'Maliyet trend yazdırma hazırlandı.') : 'Yazdırma penceresi açılamadı.', opened ? 'success' : 'info')
  }

  const getAlternativeMaterialRows = (groups = selectedAlternativeMaterialGroups) => (
    groups.flatMap(group => group.alternatives.map(alternative => [
      group.recipeCode,
      group.recipeName,
      group.primaryMaterialName,
      alternative.materialCode,
      alternative.materialName,
      alternative.priority,
      alternative.rule.substitutionMode,
      alternative.substitutionRatio,
      `${formatFirePercent(alternative.rule.maxUsagePercent)} %`,
      `${formatFirePercent(alternative.rule.minimumQualityScore)} %`,
      alternative.rule.allergenCheck ? 'Uygun' : 'Kontrol Gerekli',
      alternative.rule.haccpCompliant ? 'Uygun' : 'Kontrol Gerekli',
      formatRecipeCostAmount(alternative.costDifference),
      `${formatFirePercent(alternative.qualityScore)} %`,
      alternative.status,
      alternative.approvalStatus,
      alternative.notes || '-'
    ]))
  )

  const exportAlternativeMaterialExcel = () => {
    if(!selectedRecord) return

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Reçete Kodu', 'Reçete', 'Birincil Malzeme', 'Alternatif Kod', 'Alternatif Malzeme', 'Öncelik', 'Kural', 'Katsayı', 'Maksimum Kullanım', 'Minimum Kalite', 'Alerjen', 'HACCP', 'Maliyet Etkisi', 'Kalite', 'Durum', 'Onay', 'Not'],
      ...getAlternativeMaterialRows()
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Alternatif Hammaddeler')
    XLSX.writeFile(workbook, `recete-alternatif-hammadde-${selectedRecord.code}.xlsx`)
    showToast('Alternatif hammadde Excel oluşturuldu.')
  }

  const printAlternativeMaterialList = (mode: RecipeSnapshotPrintMode) => {
    if(!selectedRecord) return

    const opened = openRecipePrintWindow(
      `${selectedRecord.code} Alternatif Hammaddeler`,
      ['Reçete Kodu', 'Reçete', 'Birincil Malzeme', 'Alternatif Kod', 'Alternatif Malzeme', 'Öncelik', 'Kural', 'Katsayı', 'Maksimum Kullanım', 'Minimum Kalite', 'Alerjen', 'HACCP', 'Maliyet Etkisi', 'Kalite', 'Durum', 'Onay', 'Not'],
      getAlternativeMaterialRows(),
      mode
    )

    showToast(opened ? (mode === 'PDF' ? 'Alternatif hammadde PDF hazırlandı.' : 'Alternatif hammadde yazdırma hazırlandı.') : 'Yazdırma penceresi açılamadı.', opened ? 'success' : 'info')
  }

  const getAlternativeCostComparisonRows = (groups = selectedAlternativeMaterialGroups) => (
    RecipeAlternativeMaterialService.buildCostComparisons(groups).map(row => [
      row.recipeCode,
      row.recipeName,
      row.primaryMaterialName,
      row.alternativeMaterialName,
      formatRecipeCostAmount(row.currentCost),
      formatRecipeCostAmount(row.alternativeCost),
      formatRecipeCostAmount(row.costDifference),
      `${formatFirePercent(row.costDifferencePercent)} %`,
      `${formatFirePercent(row.qualityScore)} %`,
      row.approvalStatus
    ])
  )

  const exportAlternativeCostComparisonExcel = () => {
    if(!selectedRecord) return

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Reçete Kodu', 'Reçete', 'Birincil Malzeme', 'Alternatif Malzeme', 'Mevcut Maliyet', 'Alternatif Maliyet', 'Fark', 'Fark %', 'Kalite', 'Onay'],
      ...getAlternativeCostComparisonRows()
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Maliyet Karşılaştırma')
    XLSX.writeFile(workbook, `recete-alternatif-maliyet-${selectedRecord.code}.xlsx`)
    showToast('Alternatif maliyet karşılaştırması Excel oluşturuldu.')
  }

  const printAlternativeCostComparison = (mode: RecipeSnapshotPrintMode) => {
    if(!selectedRecord) return

    const opened = openRecipePrintWindow(
      `${selectedRecord.code} Alternatif Maliyet Karşılaştırma`,
      ['Reçete Kodu', 'Reçete', 'Birincil Malzeme', 'Alternatif Malzeme', 'Mevcut Maliyet', 'Alternatif Maliyet', 'Fark', 'Fark %', 'Kalite', 'Onay'],
      getAlternativeCostComparisonRows(),
      mode
    )

    showToast(opened ? (mode === 'PDF' ? 'Alternatif maliyet PDF hazırlandı.' : 'Alternatif maliyet yazdırma hazırlandı.') : 'Yazdırma penceresi açılamadı.', opened ? 'success' : 'info')
  }

  const submitRecipeForm = (event: React.FormEvent) => {
    event.preventDefault()

    const validationError = validateRecipeForm(recipeForm, recipeFormIngredients, records, editingRecipeId)
    if(validationError){
      setRecipeFormError(validationError)
      return
    }

    const now = new Date().toISOString()
    const portions = Number(recipeForm.portions)
    const firePercent = Number(recipeForm.firePercent)
    const normalizedCode = recipeForm.code.trim().toLocaleUpperCase('tr-TR')
    const preparationMinutes = Number(recipeForm.preparationMinutes)
    const cookingMinutes = Number(recipeForm.cookingMinutes)
    const restingMinutes = Number(recipeForm.restingMinutes)
    const totalMinutes = preparationMinutes + cookingMinutes + restingMinutes
    const yieldPercent = Number(recipeForm.yieldPercent)

    if(isEditingRecipe){
      const existingRecord = records.find(record => record.id === editingRecipeId)
      if(!existingRecord){
        setRecipeFormError('Düzenlenecek reçete bulunamadı.')
        return
      }

      if(getRecipeVersionStatus(existingRecord) === 'Arşiv'){
        setRecipeFormError('Arşiv versiyon değiştirilemez.')
        return
      }

      const commonVersionFields = {
        code: normalizedCode,
        recipeName: recipeForm.recipeName.trim(),
        recipeType: recipeForm.recipeType,
        recipeRole: recipeForm.recipeRole,
        parentRecipeId: recipeForm.recipeRole === 'ALTERNATIVE' ? recipeForm.parentRecipeId : undefined,
        productName: recipeForm.productName.trim(),
        portions,
        firePercent,
        description: recipeForm.description.trim(),
        ingredients: recipeFormIngredients,
        versionDescription: recipeForm.versionDescription.trim(),
        revisionNote: recipeForm.revisionNote.trim() || `V${getRecipeVersionNo(existingRecord)} revizyonu`,
        preparationMinutes,
        cookingMinutes,
        restingMinutes,
        totalMinutes,
        yieldPercent
      }

      if(canEditRecipeVersionDirectly(existingRecord)){
        const isActiveVersion = recipeForm.versionStatus === 'Aktif'
        const updatedRecord: RecipeManagementRecord = {
          ...existingRecord,
          ...commonVersionFields,
          status: isActiveVersion ? 'Aktif' : 'Pasif',
          versionStatus: recipeForm.versionStatus,
          isActiveVersion,
          publishedAt: isActiveVersion ? now : existingRecord.publishedAt,
          updatedAt: now
        }

        commitRecords(prev => prev.map(record => {
          if(record.id === updatedRecord.id) return updatedRecord
          if(isActiveVersion && getRecipeMasterId(record) === getRecipeMasterId(updatedRecord) && isRecipeVersionActive(record)){
            return {
              ...record,
              status: 'Pasif',
              versionStatus: 'Arşiv',
              isActiveVersion: false,
              archivedAt: now,
              updatedAt: now
            }
          }

          return record
        }))
        setSelectedRecordId(updatedRecord.id)
        showToast(isActiveVersion ? 'Taslak versiyon aktif edildi.' : 'Taslak versiyon güncellendi.')
      } else {
        const masterId = getRecipeMasterId(existingRecord)
        const nextVersionNo = getNextRecipeVersionNo(records, masterId)
        const newVersionRecord: RecipeManagementRecord = {
          ...existingRecord,
          ...commonVersionFields,
          id: createId('recipe_version'),
          masterId,
          masterCode: existingRecord.masterCode || existingRecord.code,
          masterName: existingRecord.masterName || existingRecord.recipeName,
          masterStatus: existingRecord.masterStatus || 'Aktif',
          versionNo: nextVersionNo,
          versionStatus: 'Taslak',
          versionDescription: recipeForm.versionDescription.trim() || `${existingRecord.recipeName} V${nextVersionNo} taslak çalışması`,
          revisionNote: recipeForm.revisionNote.trim() || `V${nextVersionNo} revizyonu`,
          status: 'Pasif',
          isActiveVersion: false,
          publishedAt: undefined,
          archivedAt: undefined,
          createdAt: now,
          updatedAt: now,
          createdBy: 'MIYOP Demo'
        }

        commitRecords(prev => [newVersionRecord, ...prev])
        setSelectedRecordId(newVersionRecord.id)
        showToast(`V${nextVersionNo} taslak versiyon oluşturuldu. Aktif reçete korunuyor.`)
      }

      setPanelMode('summary')
      setEditingRecipeId('')
      setRecipeForm(createInitialRecipeForm(records))
      setRecipeFormIngredients([])
      resetRecipeIngredientForm()
      setRecipeFormError('')
      return
    }

    const isActiveVersion = recipeForm.versionStatus === 'Aktif' && recipeForm.status === 'Aktif'
    const masterId = createId('recipe_master')
    const newRecord: RecipeManagementRecord = {
      id: createId('recipe_mgmt'),
      code: normalizedCode,
      recipeName: recipeForm.recipeName.trim(),
      recipeType: recipeForm.recipeType,
      recipeRole: recipeForm.recipeRole,
      parentRecipeId: recipeForm.recipeRole === 'ALTERNATIVE' ? recipeForm.parentRecipeId : undefined,
      productName: recipeForm.productName.trim(),
      portions,
      firePercent,
      status: isActiveVersion ? 'Aktif' : 'Pasif',
      description: recipeForm.description.trim(),
      ingredients: recipeFormIngredients,
      createdAt: now,
      updatedAt: now,
      masterId,
      masterCode: normalizedCode,
      masterName: recipeForm.recipeName.trim(),
      masterStatus: isActiveVersion ? 'Aktif' : 'Pasif',
      versionNo: 1,
      versionStatus: isActiveVersion ? 'Aktif' : recipeForm.versionStatus,
      versionDescription: recipeForm.versionDescription.trim(),
      revisionNote: recipeForm.revisionNote.trim() || 'İlk yayın',
      isActiveVersion,
      publishedAt: isActiveVersion ? now : undefined,
      createdBy: 'MIYOP Demo',
      preparationMinutes,
      cookingMinutes,
      restingMinutes,
      totalMinutes,
      yieldPercent
    }

    commitRecords(prev => [newRecord, ...prev])
    setSelectedRecordId(newRecord.id)
    setPanelMode('summary')
    setRecipeForm(createInitialRecipeForm([newRecord, ...records]))
    setRecipeFormIngredients([])
    resetRecipeIngredientForm()
    setRecipeFormError('')
    showToast('Reçete oluşturuldu.')
  }

  const startAddIngredient = () => {
    if(!selectedRecord || !canEditRecipeVersionDirectly(selectedRecord)){
      showToast('Aktif ve arşiv versiyonlarda doğrudan malzeme değiştirilemez. Düzenleme yeni taslak versiyon oluşturur.', 'info')
      return
    }

    setIngredientFormVisible(true)
    setEditingIngredientId('')
    setIngredientForm(createInitialIngredientForm())
    setIngredientFormError('')
  }

  const startEditIngredient = (ingredient: RecipeIngredient) => {
    if(!selectedRecord || !canEditRecipeVersionDirectly(selectedRecord)){
      showToast('Aktif ve arşiv versiyonlarda doğrudan malzeme değiştirilemez. Düzenleme yeni taslak versiyon oluşturur.', 'info')
      return
    }

    setIngredientFormVisible(true)
    setEditingIngredientId(ingredient.id)
    setIngredientForm(createIngredientFormFromRecord(ingredient))
    setIngredientFormError('')
  }

  const cancelIngredientForm = () => {
    setIngredientFormVisible(false)
    setEditingIngredientId('')
    setIngredientForm(createInitialIngredientForm())
    setIngredientFormError('')
  }

  const submitIngredientForm = (event: React.FormEvent) => {
    event.preventDefault()
    if(!selectedRecord) return
    if(!canEditRecipeVersionDirectly(selectedRecord)){
      showToast('Bu versiyon doğrudan değiştirilemez.', 'info')
      return
    }

    const validationError = validateIngredientForm(ingredientForm)
    if(validationError){
      setIngredientFormError(validationError)
      return
    }

    const now = new Date().toISOString()
    const nextIngredient = createIngredientFromForm(
      editingIngredientId || createId('recipe_ing'),
      ingredientForm
    )

    const recipeId = selectedRecord.id
    const editedIngredientId = editingIngredientId

    commitRecords(prev => prev.map(record => {
      if(record.id !== recipeId) return record

      return {
        ...record,
        ingredients: editedIngredientId
          ? record.ingredients.map(ingredient => ingredient.id === editedIngredientId ? nextIngredient : ingredient)
          : [...record.ingredients, nextIngredient],
        updatedAt: now
      }
    }))
    setIngredientFormVisible(false)
    setEditingIngredientId('')
    setIngredientForm(createInitialIngredientForm())
    setIngredientFormError('')
    showToast(editingIngredientId ? 'Malzeme güncellendi.' : 'Malzeme eklendi.')
  }

  const deleteIngredient = (ingredient: RecipeIngredient) => {
    if(!selectedRecord) return
    if(!canEditRecipeVersionDirectly(selectedRecord)){
      showToast('Bu versiyon doğrudan değiştirilemez.', 'info')
      return
    }
    if(!window.confirm('Bu malzemeyi silmek istediğinize emin misiniz?')) return
    if(selectedRecord.ingredients.length <= 1){
      showToast('Reçetede en az 1 malzeme kalmalıdır.', 'info')
      return
    }

    const recipeId = selectedRecord.id
    const now = new Date().toISOString()

    commitRecords(prev => prev.map(record => (
      record.id === recipeId
        ? {
            ...record,
            ingredients: record.ingredients.filter(item => item.id !== ingredient.id),
            updatedAt: now
          }
        : record
    )))
    showToast('Malzeme silindi.')
  }

  const renderRecipeFormPanel = () => {
    const editingRecord = editingRecipeId ? recordsById.get(editingRecipeId) || null : null
    const createsNewVersion = Boolean(editingRecord && !canEditRecipeVersionDirectly(editingRecord))

    return (
      <section className="card">
        <div className="section-header compact">
          <h3>{createsNewVersion ? 'Yeni Versiyon Hazırla' : isEditingRecipe ? 'Reçete Versiyonu Düzenle' : 'Yeni Reçete'}</h3>
          <button className="btn" type="button" onClick={cancelRecipeForm}>Vazgeç</button>
        </div>

      {recipeFormError && <div className="form-error">{recipeFormError}</div>}
      {createsNewVersion && (
        <div className="recipe-version-notice">
          Aktif veya onaylı versiyon yerinde değişmez. Kaydettiğinizde mevcut aktif reçete korunur ve yeni taslak versiyon oluşur.
        </div>
      )}

      <form className="stacked-form recipe-management-form" onSubmit={submitRecipeForm}>
        <div className="form-row">
          <div className="form-field">
            <label>Kod</label>
            <input value={recipeForm.code} onChange={event => updateRecipeForm('code', event.target.value)} />
          </div>
          <div className="form-field">
            <label>Reçete Türü</label>
            <select value={recipeForm.recipeType} onChange={event => updateRecipeForm('recipeType', event.target.value as RecipeManagementType)}>
              {RECIPE_MANAGEMENT_TYPES.map(recipeType => (
                <option key={recipeType} value={recipeType}>{recipeType}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Reçete Rolü</label>
            <select value={recipeForm.recipeRole} onChange={event => updateRecipeRole(event.target.value as RecipeManagementRole)}>
              <option value="PRIMARY">Ana Reçete</option>
              <option value="ALTERNATIVE">Alternatif Reçete</option>
            </select>
          </div>
          {recipeForm.recipeRole === 'ALTERNATIVE' && (
            <div className="form-field">
              <label>Bağlı Ana Reçete</label>
              <select value={recipeForm.parentRecipeId} onChange={event => updateParentRecipe(event.target.value)}>
                <option value="">Ana reçete seçin</option>
                {primaryRecipeOptions.map(parentRecipe => (
                  <option key={parentRecipe.id} value={parentRecipe.id}>
                    {parentRecipe.code} · {parentRecipe.recipeName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Versiyon Durumu</label>
            <select
              value={recipeForm.versionStatus}
              disabled={createsNewVersion}
              onChange={event => updateRecipeForm('versionStatus', event.target.value as RecipeVersionStatus)}
            >
              {RECIPE_VERSION_STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Revizyon Notu</label>
            <input value={recipeForm.revisionNote} onChange={event => updateRecipeForm('revisionNote', event.target.value)} />
          </div>
        </div>

        <div className="form-field">
          <label>Reçete Adı</label>
          <input value={recipeForm.recipeName} onChange={event => updateRecipeForm('recipeName', event.target.value)} />
        </div>

        <div className="form-field">
          <label>Ürün</label>
          <select
            value={recipeForm.productName}
            onChange={event => updateRecipeForm('productName', event.target.value)}
          >
            <option value="">Ürün seçin</option>
            {productOptions.map(product => (
              <option key={product} value={product}>{product}</option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Porsiyon</label>
            <input
              type="number"
              min="0"
              step="1"
              value={recipeForm.portions}
              onChange={event => updateRecipeForm('portions', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Durum</label>
            <select value={recipeForm.status} onChange={event => updateRecipeForm('status', event.target.value as RecipeManagementStatus)}>
              {RECIPE_MANAGEMENT_STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Fire (%)</label>
            <input
              type="number"
              min={MIN_FIRE_PERCENT}
              max={MAX_FIRE_PERCENT}
              step="0.01"
              placeholder="0"
              value={recipeForm.firePercent}
              onChange={event => updateRecipeForm('firePercent', event.target.value)}
            />
          </div>
        </div>

        <div className="form-field">
          <label>Açıklama</label>
          <textarea
            rows={4}
            value={recipeForm.description}
            onChange={event => updateRecipeForm('description', event.target.value)}
            placeholder="Reçete kartı notu"
          />
        </div>

        <div className="form-field">
          <label>Versiyon Açıklaması</label>
          <textarea
            rows={3}
            value={recipeForm.versionDescription}
            onChange={event => updateRecipeForm('versionDescription', event.target.value)}
            placeholder="Bu versiyonda yapılan değişikliklerin özeti"
          />
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Hazırlama Süresi (dk)</label>
            <input
              type="number"
              min="0"
              max={MAX_RECIPE_MINUTES}
              step="1"
              value={recipeForm.preparationMinutes}
              onChange={event => updateRecipeForm('preparationMinutes', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Pişirme Süresi (dk)</label>
            <input
              type="number"
              min="0"
              max={MAX_RECIPE_MINUTES}
              step="1"
              value={recipeForm.cookingMinutes}
              onChange={event => updateRecipeForm('cookingMinutes', event.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-field">
            <label>Dinlendirme Süresi (dk)</label>
            <input
              type="number"
              min="0"
              max={MAX_RECIPE_MINUTES}
              step="1"
              value={recipeForm.restingMinutes}
              onChange={event => updateRecipeForm('restingMinutes', event.target.value)}
            />
          </div>
          <div className="form-field">
            <label>Yield (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={recipeForm.yieldPercent}
              onChange={event => updateRecipeForm('yieldPercent', event.target.value)}
            />
          </div>
        </div>

        <div className="recipe-form-ingredients">
          <div className="section-header compact">
            <div>
              <h3>Reçete Malzemeleri</h3>
              <p className="muted">{recipeFormIngredients.length} malzeme eklendi.</p>
            </div>
          </div>

          <div className="recipe-form-ingredient-list">
            {recipeFormIngredients.length === 0 && (
              <div className="recipe-form-ingredient-empty">En az 1 malzeme eklenmelidir.</div>
            )}
            {recipeFormIngredients.map(ingredient => (
              <div key={ingredient.id} className="recipe-form-ingredient-row">
                <div>
                  <strong>{ingredient.materialName}</strong>
                  <span>{formatNumber(ingredient.quantity)} {ingredient.unit} · {formatRecipeCostAmount(ingredient.unitCost)} / {ingredient.baseUnit}</span>
                </div>
                <div>
                  <button className="btn" type="button" onClick={() => startEditRecipeFormIngredient(ingredient)}>Düzenle</button>
                  <button className="btn danger" type="button" onClick={() => deleteRecipeFormIngredient(ingredient)}>Sil</button>
                </div>
              </div>
            ))}
          </div>

          <div className="recipe-inline-ingredient-form">
            <div className="form-field">
              <label>Hammadde</label>
              <input value={recipeIngredientForm.materialName} onChange={event => updateRecipeIngredientForm('materialName', event.target.value)} />
            </div>
            <div className="form-field">
              <label>Miktar</label>
              <input
                type="number"
                min="0"
                max={MAX_INGREDIENT_QUANTITY}
                step="0.001"
                value={recipeIngredientForm.quantity}
                onChange={event => updateRecipeIngredientForm('quantity', event.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Birim</label>
              <select value={recipeIngredientForm.unit} onChange={event => updateRecipeIngredientForm('unit', event.target.value as RecipeIngredientUnit)}>
                {RECIPE_INGREDIENT_UNITS.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Birim Maliyet</label>
              <input
                type="number"
                min="0"
                max={MAX_INGREDIENT_UNIT_COST}
                step="0.001"
                value={recipeIngredientForm.unitCost}
                onChange={event => updateRecipeIngredientForm('unitCost', event.target.value)}
              />
            </div>
            <div className="recipe-inline-ingredient-actions">
              {recipeIngredientEditingId && <button className="btn" type="button" onClick={resetRecipeIngredientForm}>Vazgeç</button>}
              <button className="btn primary" type="button" onClick={saveRecipeFormIngredient}>{recipeIngredientEditingId ? 'Malzemeyi Kaydet' : 'Malzeme Ekle'}</button>
            </div>
            {recipeIngredientError && <div className="form-error recipe-ingredient-error">{recipeIngredientError}</div>}
          </div>
        </div>

        <div className="form-actions">
          <button className="btn" type="button" onClick={cancelRecipeForm}>Vazgeç</button>
          <button className="btn primary" type="submit">{createsNewVersion ? 'Yeni Versiyon Oluştur' : isEditingRecipe ? 'Değişiklikleri Kaydet' : 'Reçete Oluştur'}</button>
        </div>
      </form>
    </section>
    )
  }

  const renderAlternativeCountSummary = (
    record: RecipeManagementRecord,
    alternativeCount: number
  ) => (
    record.recipeRole === 'PRIMARY'
      ? (
          <button className="recipe-summary-action" type="button" onClick={scrollToAlternativeRecipes}>
            <span>Alternatif Reçete Sayısı</span>
            <strong>{alternativeCount}</strong>
          </button>
        )
      : (
          <div><span>Alternatif Reçete Sayısı</span><strong>{alternativeCount}</strong></div>
        )
  )

  const renderRecipeNavigationRow = (record: RecipeManagementRecord) => {
    const recipeCost = calculateRecipeCost(record)

    return (
      <div key={record.id} className="recipe-navigation-row">
        <div className="recipe-navigation-title">
          <strong>{record.code} · V{getRecipeVersionNo(record)}</strong>
          <span>{record.recipeName}</span>
        </div>
        <div className="recipe-navigation-cost">
          <span>Toplam Maliyet</span>
          <strong>{formatRecipeCostAmount(recipeCost.recipeCost)}</strong>
        </div>
        <span className={`status-pill ${getStatusClass(record.status)}`}>{record.status}</span>
        <button className="btn" type="button" onClick={() => openDetail(record)}>Detay</button>
      </div>
    )
  }

  const renderRecipeRelationCard = () => {
    if(!selectedRecord) return null

    if(selectedRecord.recipeRole === 'PRIMARY'){
      return (
        <section ref={alternativeSectionRef} className="card recipe-relation-card">
          <div className="section-header compact">
            <h3>Alternatif Reçeteler</h3>
            <span className="status-pill info-pill">{selectedAlternativeRecipes.length}</span>
          </div>
          {selectedAlternativeRecipes.length === 0 ? (
            <div className="recipe-relation-empty">Henüz alternatif reçete bulunmuyor.</div>
          ) : (
            <div className="recipe-navigation-list">
              {selectedAlternativeRecipes.map(renderRecipeNavigationRow)}
            </div>
          )}
        </section>
      )
    }

    return (
      <section className="card recipe-relation-card">
        <div className="section-header compact">
          <h3>Bağlı Ana Reçete</h3>
        </div>
        {selectedParentRecord ? (
          <div className="recipe-navigation-list">
            {renderRecipeNavigationRow(selectedParentRecord)}
          </div>
        ) : (
          <div className="recipe-relation-empty warning">Bağlı ana reçete bulunamadı.</div>
        )}
      </section>
    )
  }

  const renderVersionHistoryCard = () => {
    if(!selectedRecord) return null

    const compareSourceRecord = recordsById.get(compareSourceId) || selectedMasterRecords[0] || selectedRecord
    const compareTargetRecord = recordsById.get(compareTargetId) || selectedMasterRecords[1] || compareSourceRecord
    const diffRows = buildRecipeVersionDiffRows(compareSourceRecord, compareTargetRecord)

    return (
      <section className="card recipe-version-card">
        <div className="section-header compact">
          <div>
            <h3>Versiyon Geçmişi</h3>
            <p className="muted">{selectedMasterRecords.length} versiyon · aktif tek sürüm kuralı uygulanır.</p>
          </div>
        </div>

        <div className="recipe-version-output-actions">
          <button className="btn" type="button" onClick={exportVersionHistoryExcel}>Geçmiş Excel</button>
          <button className="btn" type="button" onClick={() => printVersionHistory('PDF')}>Geçmiş PDF</button>
          <button className="btn" type="button" onClick={() => printVersionHistory('PRINT')}>Yazdır</button>
        </div>

        <div className="recipe-version-list">
          {selectedMasterRecords.map(record => (
            <div key={record.id} className="recipe-version-row">
              <div>
                <strong>V{getRecipeVersionNo(record)}</strong>
                <span>{record.revisionNote || '-'}</span>
              </div>
              <span className={`status-pill ${getVersionStatusClass(getRecipeVersionStatus(record))}`}>{getRecipeVersionStatus(record)}</span>
              <small>{record.createdBy || 'MIYOP Demo'} · {formatDateTime(record.createdAt)}</small>
              <div className="recipe-version-row-actions">
                <button className="btn" type="button" onClick={() => openDetail(record)}>Aç</button>
                <button className="btn" type="button" onClick={() => activateRecipeVersion(record)} disabled={isRecipeVersionActive(record) || getRecipeVersionStatus(record) === 'Arşiv'}>Aktifleştir</button>
                <button className="btn danger" type="button" onClick={() => archiveRecipeVersion(record)} disabled={getRecipeVersionStatus(record) === 'Arşiv'}>Arşivle</button>
              </div>
            </div>
          ))}
        </div>

        <div className="recipe-version-compare">
          <div className="section-header compact">
            <h3>Versiyon Karşılaştırma</h3>
          </div>
          <div className="recipe-version-compare-controls">
            <select value={compareSourceRecord.id} onChange={event => setCompareSourceId(event.target.value)}>
              {selectedMasterRecords.map(record => (
                <option key={record.id} value={record.id}>{formatVersionLabel(record)}</option>
              ))}
            </select>
            <select value={compareTargetRecord.id} onChange={event => setCompareTargetId(event.target.value)}>
              {selectedMasterRecords.map(record => (
                <option key={record.id} value={record.id}>{formatVersionLabel(record)}</option>
              ))}
            </select>
          </div>
          <div className="recipe-version-output-actions">
            <button className="btn" type="button" onClick={exportDiffReportExcel}>Fark Excel</button>
            <button className="btn" type="button" onClick={() => printDiffReport('PDF')}>Fark PDF</button>
            <button className="btn" type="button" onClick={() => printDiffReport('PRINT')}>Fark Yazdır</button>
          </div>
          <div className="recipe-version-diff-list">
            {diffRows.length === 0 ? (
              <div className="recipe-relation-empty">Seçilen versiyonlar arasında fark bulunmuyor.</div>
            ) : diffRows.slice(0, 8).map((row, index) => (
              <div key={`${row.area}_${row.item}_${index}`} className="recipe-version-diff-row">
                <span>{row.area}</span>
                <strong>{row.item}</strong>
                <small>{row.sourceValue} → {row.targetValue}</small>
                <em>{row.difference}</em>
              </div>
            ))}
          </div>
        </div>
      </section>
    )
  }

  const renderSnapshotHistoryCard = () => {
    if(!selectedRecord) return null

    const compareSourceSnapshot = snapshotsById.get(snapshotCompareSourceId) || selectedRecipeSnapshots[0] || null
    const compareTargetSnapshot = snapshotsById.get(snapshotCompareTargetId) || selectedRecipeSnapshots[1] || compareSourceSnapshot
    const snapshotDiffRows = compareSourceSnapshot && compareTargetSnapshot
      ? buildRecipeSnapshotDiffRows(compareSourceSnapshot, compareTargetSnapshot)
      : []

    return (
      <section className="card recipe-snapshot-card">
        <div className="section-header compact">
          <div>
            <h3>Snapshotlar</h3>
            <p className="muted">{selectedRecipeSnapshots.length} immutable snapshot · üretim emri yalnızca referans tutar.</p>
          </div>
        </div>

        <div className="recipe-version-output-actions">
          <button className="btn" type="button" onClick={exportSnapshotHistoryExcel}>Geçmiş Excel</button>
          <button className="btn" type="button" onClick={() => printSnapshotHistory('PDF')}>Geçmiş PDF</button>
          <button className="btn" type="button" onClick={() => printSnapshotHistory('PRINT')}>Yazdır</button>
        </div>

        {selectedRecipeSnapshots.length === 0 ? (
          <div className="recipe-relation-empty">Bu reçete için snapshot bulunmuyor.</div>
        ) : (
          <>
            <div className="recipe-snapshot-list">
              {selectedRecipeSnapshots.slice(0, 8).map(snapshot => (
                <button
                  key={snapshot.id}
                  className={`recipe-snapshot-row ${snapshot.id === selectedSnapshot?.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => setSelectedSnapshotId(snapshot.id)}
                >
                  <span>{snapshot.snapshotNo}</span>
                  <strong>{snapshot.productionOrderNo}</strong>
                  <small>V{snapshot.versionNo} · {formatDateTime(snapshot.snapshotDate)} · {formatRecipeCostAmount(snapshot.totalCost)}</small>
                </button>
              ))}
            </div>

            {selectedSnapshot && (
              <div className="recipe-snapshot-detail">
                <div className="section-header compact">
                  <div>
                    <h3>Snapshot Detay</h3>
                    <p className="muted">{selectedSnapshot.snapshotNo} · {selectedSnapshot.ingredients.length} malzeme snapshot</p>
                  </div>
                </div>
                <div className="recipe-version-output-actions">
                  <button className="btn" type="button" onClick={exportSnapshotDetailExcel}>Detay Excel</button>
                  <button className="btn" type="button" onClick={() => printSnapshotDetail('PDF')}>Detay PDF</button>
                  <button className="btn" type="button" onClick={() => printSnapshotDetail('PRINT')}>Detay Yazdır</button>
                </div>
                <div className="recipe-summary-grid">
                  <div><span>Üretim Emri</span><strong>{selectedSnapshot.productionOrderNo}</strong></div>
                  <div><span>Reçete Versiyonu</span><strong>V{selectedSnapshot.versionNo}</strong></div>
                  <div><span>Snapshot Tarihi</span><strong>{formatDateTime(selectedSnapshot.snapshotDate)}</strong></div>
                  <div><span>Toplam Maliyet</span><strong>{formatRecipeCostAmount(selectedSnapshot.totalCost)}</strong></div>
                  <div><span>Fire</span><strong>{formatFirePercent(selectedSnapshot.firePercent)} %</strong></div>
                  <div><span>Yield</span><strong>{formatFirePercent(selectedSnapshot.yieldPercent)} %</strong></div>
                  <div><span>Toplam Süre</span><strong>{formatNumber(selectedSnapshot.totalMinutes)} dk</strong></div>
                  <div><span>Oluşturan</span><strong>{selectedSnapshot.createdBy}</strong></div>
                </div>
                <div className="recipe-snapshot-ingredient-list">
                  {selectedSnapshot.ingredients.slice(0, 6).map(ingredient => (
                    <div key={ingredient.id} className="recipe-snapshot-ingredient-row">
                      <strong>{ingredient.materialName}</strong>
                      <span>{formatNumber(ingredient.quantity)} {ingredient.unit} · {formatNumber(ingredient.baseQuantity)} {ingredient.baseUnit}</span>
                      <em>{formatRecipeCostAmount(ingredient.totalCost)}</em>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="recipe-version-compare">
              <div className="section-header compact">
                <h3>Snapshot Karşılaştırma</h3>
              </div>
              <div className="recipe-version-compare-controls">
                <select value={compareSourceSnapshot?.id || ''} onChange={event => setSnapshotCompareSourceId(event.target.value)}>
                  {selectedRecipeSnapshots.map(snapshot => (
                    <option key={snapshot.id} value={snapshot.id}>{formatSnapshotLabel(snapshot)}</option>
                  ))}
                </select>
                <select value={compareTargetSnapshot?.id || ''} onChange={event => setSnapshotCompareTargetId(event.target.value)}>
                  {selectedRecipeSnapshots.map(snapshot => (
                    <option key={snapshot.id} value={snapshot.id}>{formatSnapshotLabel(snapshot)}</option>
                  ))}
                </select>
              </div>
              <div className="recipe-version-output-actions">
                <button className="btn" type="button" onClick={exportSnapshotCompareExcel}>Fark Excel</button>
                <button className="btn" type="button" onClick={() => printSnapshotCompare('PDF')}>Fark PDF</button>
                <button className="btn" type="button" onClick={() => printSnapshotCompare('PRINT')}>Fark Yazdır</button>
              </div>
              <div className="recipe-version-diff-list">
                {snapshotDiffRows.length === 0 ? (
                  <div className="recipe-relation-empty">Seçilen snapshotlar arasında fark bulunmuyor.</div>
                ) : snapshotDiffRows.slice(0, 8).map((row, index) => (
                  <div key={`${row.area}_${row.item}_${index}`} className="recipe-version-diff-row">
                    <span>{row.area}</span>
                    <strong>{row.item}</strong>
                    <small>{row.sourceValue} → {row.targetValue}</small>
                    <em>{row.difference}</em>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    )
  }

  const renderCostTrendRows = (
    title: string,
    points: HistoricalCostTrendPoint[]
  ) => {
    const maxValue = Math.max(...points.map(point => point.value), 1)

    return (
      <div className="recipe-cost-trend-panel">
        <div className="section-header compact">
          <h3>{title}</h3>
        </div>
        <div className="recipe-cost-trend-list">
          {points.length === 0 ? (
            <div className="recipe-relation-empty">Trend verisi bulunmuyor.</div>
          ) : points.map(point => (
            <div key={`${title}_${point.dateKey}`} className="recipe-cost-trend-row">
              <div>
                <strong>{point.label}</strong>
                <span>{point.formattedValue}</span>
              </div>
              <span className="recipe-cost-trend-bar"><i style={{ width: `${Math.max(6, (point.value / maxValue) * 100)}%` }} /></span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderCostHistoryCard = () => {
    if(!selectedRecord) return null

    const compareSourceSnapshot = costSnapshotsById.get(costCompareSourceId) || selectedCostSnapshots[0] || null
    const compareTargetSnapshot = costSnapshotsById.get(costCompareTargetId) || selectedCostSnapshots[1] || compareSourceSnapshot
    const costDiffRows = compareSourceSnapshot && compareTargetSnapshot
      ? RecipeCostSnapshotService.buildDiffRows(compareSourceSnapshot, compareTargetSnapshot)
      : []

    return (
      <section className="card recipe-cost-snapshot-card">
        <div className="section-header compact">
          <div>
            <h3>Maliyet Geçmişi</h3>
            <p className="muted">{selectedCostSnapshots.length} immutable maliyet snapshot · geçmiş üretim maliyetleri değişmez.</p>
          </div>
        </div>

        <div className="recipe-version-output-actions">
          <button className="btn" type="button" onClick={exportCostHistoryExcel}>Geçmiş Excel</button>
          <button className="btn" type="button" onClick={() => printCostHistory('PDF')}>Geçmiş PDF</button>
          <button className="btn" type="button" onClick={() => printCostHistory('PRINT')}>Yazdır</button>
        </div>
        <div className="recipe-version-output-actions">
          <button className="btn" type="button" onClick={exportCostTrendExcel}>Trend Excel</button>
          <button className="btn" type="button" onClick={() => printCostTrend('PDF')}>Trend PDF</button>
          <button className="btn" type="button" onClick={() => printCostTrend('PRINT')}>Trend Yazdır</button>
        </div>

        {selectedCostSnapshots.length === 0 ? (
          <div className="recipe-relation-empty">Bu reçete için maliyet snapshot bulunmuyor.</div>
        ) : (
          <>
            <div className="recipe-summary-grid recipe-cost-kpi-grid">
              <div><span>Son Maliyet</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostTrendSummary.latestCost)}</strong></div>
              <div><span>Ortalama Maliyet</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostTrendSummary.averageCost)}</strong></div>
              <div><span>En Yüksek</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostTrendSummary.highestCost)}</strong></div>
              <div><span>En Düşük</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostTrendSummary.lowestCost)}</strong></div>
              <div><span>Son Birim Maliyet</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostTrendSummary.latestUnitCost)}</strong></div>
              <div><span>Son 30 Gün Değişimi</span><strong>{formatFirePercent(selectedCostTrendSummary.last30DayChangePercent)} %</strong></div>
            </div>

            <div className="recipe-snapshot-list">
              {selectedCostSnapshots.slice(0, 8).map(snapshot => (
                <button
                  key={snapshot.id}
                  className={`recipe-snapshot-row ${snapshot.id === selectedCostSnapshot?.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => setSelectedCostSnapshotId(snapshot.id)}
                >
                  <span>{snapshot.snapshotNo}</span>
                  <strong>{snapshot.productionOrderNo}</strong>
                  <small>V{snapshot.versionNo} · {formatDateTime(snapshot.snapshotDate)} · {RecipeCostSnapshotService.formatAmount(snapshot.grandTotalCost, snapshot.currency)}</small>
                </button>
              ))}
            </div>

            {selectedCostSnapshot && (
              <div className="recipe-snapshot-detail">
                <div className="section-header compact">
                  <div>
                    <h3>Maliyet Snapshot Detay</h3>
                    <p className="muted">{selectedCostSnapshot.snapshotNo} · {selectedCostSnapshot.ingredients.length} malzeme maliyeti</p>
                  </div>
                </div>
                <div className="recipe-version-output-actions">
                  <button className="btn" type="button" onClick={exportCostDetailExcel}>Detay Excel</button>
                  <button className="btn" type="button" onClick={() => printCostDetail('PDF')}>Detay PDF</button>
                  <button className="btn" type="button" onClick={() => printCostDetail('PRINT')}>Detay Yazdır</button>
                </div>
                <div className="recipe-cost-component-grid">
                  <div><span>Hammadde</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostSnapshot.totalMaterialCost, selectedCostSnapshot.currency)}</strong></div>
                  <div><span>İşçilik</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostSnapshot.totalLaborCost, selectedCostSnapshot.currency)}</strong></div>
                  <div><span>Enerji</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostSnapshot.totalEnergyCost, selectedCostSnapshot.currency)}</strong></div>
                  <div><span>Paketleme</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostSnapshot.totalPackagingCost, selectedCostSnapshot.currency)}</strong></div>
                  <div><span>Fire</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostSnapshot.totalWasteCost, selectedCostSnapshot.currency)}</strong></div>
                  <div><span>Lojistik</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostSnapshot.totalLogisticsCost, selectedCostSnapshot.currency)}</strong></div>
                  <div><span>Genel Gider</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostSnapshot.totalOverheadCost, selectedCostSnapshot.currency)}</strong></div>
                  <div><span>Toplam</span><strong>{RecipeCostSnapshotService.formatAmount(selectedCostSnapshot.grandTotalCost, selectedCostSnapshot.currency)}</strong></div>
                </div>
                <div className="recipe-snapshot-ingredient-list">
                  {selectedCostSnapshot.ingredients.slice(0, 6).map(ingredient => (
                    <div key={ingredient.id} className="recipe-snapshot-ingredient-row">
                      <strong>{ingredient.materialName}</strong>
                      <span>{formatNumber(ingredient.quantity)} {ingredient.unit} · {ingredient.supplier} · {formatDateTime(ingredient.priceDate)}</span>
                      <em>{RecipeCostSnapshotService.formatAmount(ingredient.lineTotal, ingredient.currency)}</em>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="recipe-cost-trend-grid">
              {renderCostTrendRows('Günlük Maliyet', selectedCostTrendSummary.daily)}
              {renderCostTrendRows('Haftalık Maliyet', selectedCostTrendSummary.weekly)}
              {renderCostTrendRows('Aylık Maliyet', selectedCostTrendSummary.monthly)}
            </div>

            <div className="recipe-version-compare">
              <div className="section-header compact">
                <h3>Maliyet Karşılaştırma</h3>
              </div>
              <div className="recipe-version-compare-controls">
                <select value={compareSourceSnapshot?.id || ''} onChange={event => setCostCompareSourceId(event.target.value)}>
                  {selectedCostSnapshots.map(snapshot => (
                    <option key={snapshot.id} value={snapshot.id}>{formatCostSnapshotLabel(snapshot)}</option>
                  ))}
                </select>
                <select value={compareTargetSnapshot?.id || ''} onChange={event => setCostCompareTargetId(event.target.value)}>
                  {selectedCostSnapshots.map(snapshot => (
                    <option key={snapshot.id} value={snapshot.id}>{formatCostSnapshotLabel(snapshot)}</option>
                  ))}
                </select>
              </div>
              <div className="recipe-version-output-actions">
                <button className="btn" type="button" onClick={exportCostCompareExcel}>Fark Excel</button>
                <button className="btn" type="button" onClick={() => printCostCompare('PDF')}>Fark PDF</button>
                <button className="btn" type="button" onClick={() => printCostCompare('PRINT')}>Fark Yazdır</button>
              </div>
              <div className="recipe-version-diff-list">
                {costDiffRows.length === 0 ? (
                  <div className="recipe-relation-empty">Seçilen maliyet snapshotları arasında fark bulunmuyor.</div>
                ) : costDiffRows.map(row => (
                  <div key={row.area} className="recipe-version-diff-row">
                    <span>{row.area}</span>
                    <strong>{row.absoluteDifference}</strong>
                    <small>{row.sourceValue} → {row.targetValue}</small>
                    <em>{row.percentDifference}</em>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </section>
    )
  }

  const renderAlternativeMaterialCard = () => {
    if(!selectedRecord) return null

    const totalAlternatives = selectedAlternativeMaterialGroups.reduce((sum, group) => sum + group.alternatives.length, 0)
    const selectedApprovedCount = selectedAlternativeMaterials.filter(RecipeAlternativeMaterialService.isApprovedForUse).length

    return (
      <section className="card recipe-alternative-material-card">
        <div className="section-header compact">
          <div>
            <h3>Alternatif Hammaddeler</h3>
            <p className="muted">{selectedAlternativeMaterialGroups.length} grup · {totalAlternatives} alternatif · otomatik reçete değişikliği yapılmaz.</p>
          </div>
          <span className="status-pill info-pill">{approvedAlternativeMaterialCount} onaylı</span>
        </div>

        <div className="recipe-version-output-actions">
          <button className="btn" type="button" onClick={exportAlternativeMaterialExcel}>Liste Excel</button>
          <button className="btn" type="button" onClick={() => printAlternativeMaterialList('PDF')}>Liste PDF</button>
          <button className="btn" type="button" onClick={() => printAlternativeMaterialList('PRINT')}>Liste Yazdır</button>
        </div>
        <div className="recipe-version-output-actions">
          <button className="btn" type="button" onClick={exportAlternativeCostComparisonExcel}>Maliyet Excel</button>
          <button className="btn" type="button" onClick={() => printAlternativeCostComparison('PDF')}>Maliyet PDF</button>
          <button className="btn" type="button" onClick={() => printAlternativeCostComparison('PRINT')}>Maliyet Yazdır</button>
        </div>

        <div className="recipe-alternative-tabs" role="tablist" aria-label="Malzeme alternatifleri">
          {selectedRecord.ingredients.map(ingredient => {
            const group = selectedAlternativeGroupByIngredientId.get(ingredient.id)
            const count = group?.alternatives.length || 0

            return (
              <button
                key={ingredient.id}
                className={`recipe-alternative-tab ${ingredient.id === selectedIngredient?.id ? 'active' : ''}`}
                type="button"
                role="tab"
                aria-selected={ingredient.id === selectedIngredient?.id}
                onClick={() => setSelectedIngredientId(ingredient.id)}
              >
                <strong>{ingredient.materialName}</strong>
                <span>{count} alternatif</span>
              </button>
            )
          })}
        </div>

        {!selectedIngredient || !selectedIngredientAlternativeGroup ? (
          <div className="recipe-relation-empty">Seçilen malzeme için alternatif hammadde tanımı bulunmuyor.</div>
        ) : (
          <>
            <div className="recipe-summary-grid recipe-alternative-summary-grid">
              <div><span>Birincil Malzeme</span><strong>{selectedIngredientAlternativeGroup.primaryMaterialName}</strong></div>
              <div><span>Mevcut Maliyet</span><strong>{formatRecipeCostAmount(selectedIngredientAlternativeGroup.primaryCost)}</strong></div>
              <div><span>Alternatif Sayısı</span><strong>{selectedAlternativeMaterials.length}</strong></div>
              <div><span>Kullanıma Uygun</span><strong>{selectedApprovedCount}</strong></div>
            </div>

            <div className="table-wrap recipe-alternative-table-wrap">
              <table className="data-table recipe-alternative-table">
                <thead>
                  <tr>
                    <th>Malzeme</th>
                    <th>Öncelik</th>
                    <th>Katsayı</th>
                    <th>Maliyet Etkisi</th>
                    <th>Kalite</th>
                    <th>Durum</th>
                    <th>Onay</th>
                    <th>Kurallar</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedAlternativeMaterials.length === 0 && (
                    <tr><td colSpan={8} className="empty-cell">Alternatif hammadde bulunmuyor.</td></tr>
                  )}
                  {selectedAlternativeMaterials.map(alternative => (
                    <tr key={alternative.id}>
                      <td data-label="Malzeme">
                        <strong>{alternative.materialName}</strong>
                        <span>{alternative.materialCode}</span>
                      </td>
                      <td data-label="Öncelik">{alternative.priority}</td>
                      <td data-label="Katsayı">{formatNumber(alternative.substitutionRatio)}</td>
                      <td data-label="Maliyet Etkisi">
                        <span className={`status-pill ${getAlternativeMaterialCostClass(alternative)}`}>
                          {formatRecipeCostAmount(alternative.costDifference)}
                        </span>
                      </td>
                      <td data-label="Kalite">{formatFirePercent(alternative.qualityScore)} %</td>
                      <td data-label="Durum">
                        <span className={`status-pill ${getAlternativeMaterialStatusClass(alternative.status)}`}>{alternative.status}</span>
                      </td>
                      <td data-label="Onay">
                        <span className={`status-pill ${getAlternativeMaterialApprovalClass(alternative.approvalStatus)}`}>{alternative.approvalStatus}</span>
                      </td>
                      <td data-label="Kurallar">
                        <span>{alternative.rule.substitutionMode}</span>
                        <small>
                          Maks. {formatFirePercent(alternative.rule.maxUsagePercent)}% · Min. kalite {formatFirePercent(alternative.rule.minimumQualityScore)}% · Alerjen {alternative.rule.allergenCheck ? 'uygun' : 'kontrol'} · HACCP {alternative.rule.haccpCompliant ? 'uygun' : 'kontrol'}
                        </small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="recipe-alternative-cost-list">
              {selectedAlternativeCostComparisons.map(row => (
                <div key={row.id} className="recipe-alternative-cost-row">
                  <div>
                    <span>{row.primaryMaterialName}</span>
                    <strong>{row.alternativeMaterialName}</strong>
                  </div>
                  <div><span>Mevcut</span><strong>{formatRecipeCostAmount(row.currentCost)}</strong></div>
                  <div><span>Alternatif</span><strong>{formatRecipeCostAmount(row.alternativeCost)}</strong></div>
                  <div>
                    <span>Fark</span>
                    <strong>{formatRecipeCostAmount(row.costDifference)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    )
  }

  const renderSummaryPanel = () => {
    if(!selectedRecord){
      return (
        <section className="card">
          <div className="empty-state">Detay için bir reçete seçin.</div>
        </section>
      )
    }

    const selectedRecipeCost = calculateRecipeCost(selectedRecord)
    const selectedAlternativeCount = selectedRecord.recipeRole === 'PRIMARY' ? selectedAlternativeRecipes.length : 0
    const selectedParentRecipe = formatParentRecipe(selectedRecord, records)
    const selectedVersionStatus = getRecipeVersionStatus(selectedRecord)

    return (
      <section className="card recipe-management-summary">
        <div className="section-header compact">
          <div>
            <h3>{selectedRecord.code}</h3>
            <p className="muted">{selectedRecord.recipeName}</p>
          </div>
          <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>{selectedRecord.status}</span>
        </div>

        <div className="recipe-summary-grid">
          <div><span>Kod</span><strong>{selectedRecord.code}</strong></div>
          <div><span>Versiyon</span><strong>V{getRecipeVersionNo(selectedRecord)}</strong></div>
          <div><span>Versiyon Durumu</span><strong>{selectedVersionStatus}</strong></div>
          <div><span>Aktif Versiyon</span><strong>{isRecipeVersionActive(selectedRecord) ? 'Evet' : 'Hayır'}</strong></div>
          <div><span>Snapshot Sayısı</span><strong>{selectedRecipeSnapshots.length}</strong></div>
          <div><span>Maliyet Snapshot</span><strong>{selectedCostSnapshots.length}</strong></div>
          <div><span>Reçete Adı</span><strong>{selectedRecord.recipeName}</strong></div>
          <div><span>Reçete Türü</span><strong>{selectedRecord.recipeType}</strong></div>
          <div><span>Rol</span><strong>{getRecipeRoleLabel(selectedRecord.recipeRole)}</strong></div>
          <div><span>Bağlı Ana Reçete</span><strong>{selectedParentRecipe}</strong></div>
          {renderAlternativeCountSummary(selectedRecord, selectedAlternativeCount)}
          <div><span>Ürün</span><strong>{selectedRecord.productName}</strong></div>
          <div><span>Porsiyon</span><strong>{formatNumber(selectedRecord.portions)}</strong></div>
          <div><span>Malzeme Sayısı</span><strong>{selectedRecord.ingredients.length}</strong></div>
          <div><span>Toplam Gramaj</span><strong>{formatNumber(calculateTotalGrams(selectedRecord.ingredients))} gr</strong></div>
          <div><span>Toplam Maliyet</span><strong>{formatRecipeCostAmount(selectedRecipeCost.recipeCost)}</strong></div>
          <div><span>Fire Maliyeti</span><strong>{formatRecipeCostAmount(selectedRecipeCost.fireAmount)}</strong></div>
          <div><span>Fire</span><strong>{formatFirePercent(selectedRecord.firePercent)} %</strong></div>
          <div><span>Yield</span><strong>{formatFirePercent(getRecipeYieldPercent(selectedRecord))} %</strong></div>
          <div><span>Toplam Süre</span><strong>{formatNumber(getRecipeTotalMinutes(selectedRecord))} dk</strong></div>
          <div><span>Porsiyon Maliyeti</span><strong>{formatRecipeCostAmount(selectedRecipeCost.portionCost)}</strong></div>
          <div><span>Son Güncelleme</span><strong>{formatDateTime(selectedRecord.updatedAt || selectedRecord.createdAt)}</strong></div>
          <div><span>Revizyon Notu</span><strong>{selectedRecord.revisionNote || '-'}</strong></div>
          <div><span>Açıklama</span><strong>{selectedRecord.description || '-'}</strong></div>
        </div>

        <div className="recipe-side-actions">
          <button className="btn primary" type="button" onClick={() => openDetail(selectedRecord)}>Detay</button>
          <button className="btn" type="button" onClick={() => startEditRecipe(selectedRecord)}>
            {canEditRecipeVersionDirectly(selectedRecord) ? 'Düzenle' : 'Yeni Versiyon'}
          </button>
          <button className="btn danger" type="button" onClick={() => archiveRecipeVersion(selectedRecord)}>Arşivle</button>
        </div>
      </section>
    )
  }

  const renderIngredientForm = () => (
    <form className="recipe-ingredient-form" onSubmit={submitIngredientForm}>
      <div className="form-field">
        <label>Hammadde</label>
        <input value={ingredientForm.materialName} onChange={event => updateIngredientForm('materialName', event.target.value)} />
      </div>
      <div className="form-field">
        <label>Miktar</label>
        <input
          type="number"
          min="0"
          max={MAX_INGREDIENT_QUANTITY}
          step="0.001"
          value={ingredientForm.quantity}
          onChange={event => updateIngredientForm('quantity', event.target.value)}
        />
      </div>
      <div className="form-field">
        <label>Birim</label>
        <select value={ingredientForm.unit} onChange={event => updateIngredientForm('unit', event.target.value as RecipeIngredientUnit)}>
          {RECIPE_INGREDIENT_UNITS.map(unit => (
            <option key={unit} value={unit}>{unit}</option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label>Birim Maliyet</label>
        <input
          type="number"
          min="0"
          max={MAX_INGREDIENT_UNIT_COST}
          step="0.001"
          value={ingredientForm.unitCost}
          onChange={event => updateIngredientForm('unitCost', event.target.value)}
        />
      </div>
      <div className="recipe-ingredient-form-actions">
        <button className="btn" type="button" onClick={cancelIngredientForm}>Vazgeç</button>
        <button className="btn primary" type="submit">{editingIngredientId ? 'Kaydet' : 'Malzeme Ekle'}</button>
      </div>
      {ingredientFormError && <div className="form-error recipe-ingredient-error">{ingredientFormError}</div>}
    </form>
  )

  const renderDetailScreen = () => {
    if(!selectedRecord){
      return (
        <div className="recipes-page">
          <section className="card">
            <div className="empty-state">Detay için bir reçete seçin.</div>
            <button className="btn" type="button" onClick={backToList}>Listeye Dön</button>
          </section>
        </div>
      )
    }

    const selectedRecipeCost = calculateRecipeCost(selectedRecord)
    const selectedAlternativeCount = selectedRecord.recipeRole === 'PRIMARY' ? selectedAlternativeRecipes.length : 0
    const selectedParentRecipe = formatParentRecipe(selectedRecord, records)
    const selectedIngredientCostMap = new Map(
      selectedRecipeCost.ingredientCost.map(ingredientCost => [ingredientCost.ingredientId, ingredientCost])
    )

    return (
      <div className="recipes-page recipe-detail-page">
        <div className="page-title recipe-detail-title">
          <div>
            <h2>{selectedRecord.recipeName}</h2>
            <p className="muted">{selectedRecord.code} · V{getRecipeVersionNo(selectedRecord)} · {getRecipeVersionStatus(selectedRecord)} · {selectedRecord.recipeType} · {selectedRecord.productName}</p>
          </div>
          <div className="recipe-detail-actions">
            <button className="btn" type="button" onClick={backToList}>Listeye Dön</button>
            <button className="btn" type="button" onClick={() => startEditRecipe(selectedRecord)}>
              {canEditRecipeVersionDirectly(selectedRecord) ? 'Reçete Düzenle' : 'Yeni Versiyon'}
            </button>
          </div>
        </div>

        {toast && (
          <div className={`recipe-toast ${toast.tone}`} role="status" aria-live="polite">
            {toast.text}
          </div>
        )}

        <div className="recipe-detail-grid">
          <div className="recipe-detail-main-stack">
            <section className="card">
              <div className="section-header">
                <div>
                  <h3>Malzemeler</h3>
                  <p className="muted">{selectedRecord.ingredients.length} malzeme satırı gösteriliyor.</p>
                </div>
                <button className="btn primary" type="button" onClick={startAddIngredient} disabled={!canEditRecipeVersionDirectly(selectedRecord)}>+ Malzeme Ekle</button>
              </div>

              <div className="table-wrap recipe-ingredient-table-wrap">
                <table className="data-table recipe-ingredient-table">
                  <thead>
                    <tr>
                      <th>Hammadde</th>
                      <th>Miktar</th>
                      <th>Birim</th>
                      <th>Birim Maliyet</th>
                      <th>Satır Maliyeti</th>
                      <th>İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRecord.ingredients.length === 0 && (
                      <tr><td colSpan={6} className="empty-cell">Henüz malzeme bulunmuyor.</td></tr>
                    )}
                    {selectedRecord.ingredients.map(ingredient => {
                      const ingredientCost = selectedIngredientCostMap.get(ingredient.id)

                      return (
                        <tr key={ingredient.id} className={ingredient.id === selectedIngredient?.id ? 'selected-row' : undefined}>
                          <td data-label="Hammadde"><strong>{ingredient.materialName}</strong></td>
                          <td data-label="Miktar">{formatNumber(ingredient.quantity)}</td>
                          <td data-label="Birim">{ingredient.unit}</td>
                          <td data-label="Birim Maliyet">
                            <strong>{formatRecipeCostAmount(ingredient.unitCost)}</strong>
                          </td>
                          <td data-label="Satır Maliyeti">
                            <strong>{formatRecipeCostAmount(ingredientCost?.cost || 0)}</strong>
                          </td>
                          <td className="actions-cell" data-label="İşlemler">
                            <button className="btn" type="button" onClick={() => setSelectedIngredientId(ingredient.id)}>Alternatifler</button>
                            <button className="btn" type="button" onClick={() => startEditIngredient(ingredient)} disabled={!canEditRecipeVersionDirectly(selectedRecord)}>Düzenle</button>
                            <button className="btn danger" type="button" onClick={() => deleteIngredient(ingredient)} disabled={!canEditRecipeVersionDirectly(selectedRecord)}>Sil</button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {ingredientFormVisible ? renderIngredientForm() : (
                <div className="recipe-ingredient-add-row">
                  <button className="btn primary" type="button" onClick={startAddIngredient} disabled={!canEditRecipeVersionDirectly(selectedRecord)}>+ Malzeme Ekle</button>
                </div>
              )}
            </section>

            {renderAlternativeMaterialCard()}
          </div>

          <aside className="recipe-detail-side">
            <section className="card recipe-detail-summary">
              <div className="section-header compact">
                <h3>Reçete Kartı</h3>
                <span className={`status-pill ${getStatusClass(selectedRecord.status)}`}>{selectedRecord.status}</span>
              </div>
              <div className="recipe-summary-grid">
                <div><span>Kod</span><strong>{selectedRecord.code}</strong></div>
                <div><span>Versiyon</span><strong>V{getRecipeVersionNo(selectedRecord)}</strong></div>
                <div><span>Versiyon Durumu</span><strong>{getRecipeVersionStatus(selectedRecord)}</strong></div>
                <div><span>Aktif Versiyon</span><strong>{isRecipeVersionActive(selectedRecord) ? 'Evet' : 'Hayır'}</strong></div>
                <div><span>Maliyet Snapshot</span><strong>{selectedCostSnapshots.length}</strong></div>
                <div><span>Reçete Adı</span><strong>{selectedRecord.recipeName}</strong></div>
                <div><span>Reçete Türü</span><strong>{selectedRecord.recipeType}</strong></div>
                <div><span>Rol</span><strong>{getRecipeRoleLabel(selectedRecord.recipeRole)}</strong></div>
                <div><span>Bağlı Ana Reçete</span><strong>{selectedParentRecipe}</strong></div>
                {renderAlternativeCountSummary(selectedRecord, selectedAlternativeCount)}
                <div><span>Ürün</span><strong>{selectedRecord.productName}</strong></div>
                <div><span>Porsiyon</span><strong>{formatNumber(selectedRecord.portions)}</strong></div>
                <div><span>Malzeme Sayısı</span><strong>{selectedRecord.ingredients.length}</strong></div>
                <div><span>Alternatif Grup</span><strong>{selectedAlternativeMaterialGroups.length}</strong></div>
                <div><span>Onaylı Alternatif</span><strong>{approvedAlternativeMaterialCount}</strong></div>
                <div><span>Toplam Gramaj</span><strong>{formatNumber(calculateTotalGrams(selectedRecord.ingredients))} gr</strong></div>
                <div><span>Toplam Maliyet</span><strong>{formatRecipeCostAmount(selectedRecipeCost.recipeCost)}</strong></div>
                <div><span>Fire Maliyeti</span><strong>{formatRecipeCostAmount(selectedRecipeCost.fireAmount)}</strong></div>
                <div><span>Fire</span><strong>{formatFirePercent(selectedRecord.firePercent)} %</strong></div>
                <div><span>Yield</span><strong>{formatFirePercent(getRecipeYieldPercent(selectedRecord))} %</strong></div>
                <div><span>Toplam Süre</span><strong>{formatNumber(getRecipeTotalMinutes(selectedRecord))} dk</strong></div>
                <div><span>Porsiyon Maliyeti</span><strong>{formatRecipeCostAmount(selectedRecipeCost.portionCost)}</strong></div>
                <div><span>Son Güncelleme</span><strong>{formatDateTime(selectedRecord.updatedAt || selectedRecord.createdAt)}</strong></div>
                <div><span>Revizyon Notu</span><strong>{selectedRecord.revisionNote || '-'}</strong></div>
                <div><span>Açıklama</span><strong>{selectedRecord.description || '-'}</strong></div>
              </div>
            </section>
            {renderVersionHistoryCard()}
            {renderSnapshotHistoryCard()}
            {renderCostHistoryCard()}
            {renderRecipeRelationCard()}
          </aside>
        </div>
      </div>
    )
  }

  if(viewMode === 'detail'){
    return renderDetailScreen()
  }

  return (
    <div className="recipes-page">
      <div className="page-title">
        <div>
          <h2>Reçete Yönetimi</h2>
          <p className="muted">Endüstriyel mutfak standart reçete kartlarını ve reçete malzemelerini yönetin.</p>
        </div>
      </div>

      {toast && (
        <div className={`recipe-toast ${toast.tone}`} role="status" aria-live="polite">
          {toast.text}
        </div>
      )}

      <div className="metric-grid compact-metric-grid">
        <div className="metric-card compact-metric-card">
          <span>Reçete Master</span>
          <strong>{totalRecipeMasters}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Aktif Versiyon</span>
          <strong>{activeRecipes}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Reçete Versiyon</span>
          <strong>{totalRecipeVersions}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Toplam Malzeme</span>
          <strong>{totalIngredients}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Alternatif Grup</span>
          <strong>{totalAlternativeGroups}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Alternatif Hammadde</span>
          <strong>{totalAlternativeMaterials}</strong>
        </div>
        <div className="metric-card compact-metric-card">
          <span>Maliyet Snapshot</span>
          <strong>{totalCostSnapshots}</strong>
        </div>
      </div>

      <div className="product-layout recipe-layout">
        <section className="product-main card">
          <div className="section-header">
            <div>
              <h3>Reçete Listesi</h3>
              <p className="muted">{visibleRecords.length} reçete gösteriliyor.</p>
            </div>
            <div className="recipe-filters">
              <button className="btn primary" type="button" onClick={startNewRecipe}>Yeni Reçete</button>
              <input
                type="search"
                placeholder="Kod, reçete, ürün, rol veya ana reçete ara"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />
              <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">Tüm Durumlar</option>
                {RECIPE_MANAGEMENT_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select value={roleFilter} onChange={event => setRoleFilter(event.target.value as RoleFilter)}>
                <option value="all">Tümü</option>
                <option value="PRIMARY">Ana Reçeteler</option>
                <option value="ALTERNATIVE">Alternatif Reçeteler</option>
              </select>
              <select value={versionStatusFilter} onChange={event => setVersionStatusFilter(event.target.value as VersionStatusFilter)}>
                <option value="all">Tüm Versiyonlar</option>
                {RECIPE_VERSION_STATUSES.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table recipe-table">
              <colgroup>
                <col className="recipe-col-code" />
                <col className="recipe-col-version" />
                <col className="recipe-col-name" />
                <col className="recipe-col-type" />
                <col className="recipe-col-role" />
                <col className="recipe-col-product" />
                <col className="recipe-col-portion" />
                <col className="recipe-col-ingredients" />
                <col className="recipe-col-cost" />
                <col className="recipe-col-status" />
                <col className="recipe-col-version-status" />
                <col className="recipe-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Versiyon</th>
                  <th>Reçete Adı</th>
                  <th>Reçete Türü</th>
                  <th>Rol</th>
                  <th>Ürün</th>
                  <th>Porsiyon</th>
                  <th>Malzeme Sayısı</th>
                  <th>Toplam Maliyet</th>
                  <th>Durum</th>
                  <th>Versiyon Durumu</th>
                  <th>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 && (
                  <tr>
                    <td colSpan={12} className="empty-cell">
                      <div className="recipe-empty-list">
                        <strong>Henüz reçete bulunmuyor.</strong>
                        <span>İlk reçeteyi oluşturmak için "Yeni Reçete" butonunu kullanabilirsiniz.</span>
                        <button className="btn primary" type="button" onClick={startNewRecipe}>Yeni Reçete</button>
                      </div>
                    </td>
                  </tr>
                )}
                {records.length > 0 && visibleRecords.length === 0 && (
                  <tr><td colSpan={12} className="empty-cell">Filtrelere uygun reçete bulunamadı.</td></tr>
                )}
                {visibleRecords.map(record => {
                  const recipeCost = calculateRecipeCost(record)

                  return (
                    <tr
                      key={record.id}
                      className={record.id === selectedRecordId ? 'selected-row' : ''}
                      onClick={() => {
                        setSelectedRecordId(record.id)
                        setPanelMode('summary')
                      }}
                      onDoubleClick={() => openDetail(record)}
                    >
                      <td><strong>{record.code}</strong></td>
                      <td><strong>V{getRecipeVersionNo(record)}</strong></td>
                      <td>
                        <strong>{record.recipeName}</strong>
                        {record.description && <div className="muted small-text">{record.description}</div>}
                      </td>
                      <td>{record.recipeType}</td>
                      <td>
                        <span className={`status-pill ${getRecipeRoleClass(record.recipeRole)}`}>
                          {getRecipeRoleLabel(record.recipeRole)}
                        </span>
                      </td>
                      <td>{record.productName}</td>
                      <td>{formatNumber(record.portions)}</td>
                      <td>{record.ingredients.length}</td>
                      <td>{formatRecipeCostAmount(recipeCost.recipeCost)}</td>
                      <td><span className={`status-pill ${getStatusClass(record.status)}`}>{record.status}</span></td>
                      <td><span className={`status-pill ${getVersionStatusClass(getRecipeVersionStatus(record))}`}>{getRecipeVersionStatus(record)}</span></td>
                      <td className="actions-cell">
                        <button
                          className="btn"
                          type="button"
                          onClick={event => {
                            event.stopPropagation()
                            openDetail(record)
                          }}
                        >
                          Detay
                        </button>
                        <button
                          className="btn"
                          type="button"
                          onClick={event => {
                            event.stopPropagation()
                            startEditRecipe(record)
                          }}
                        >
                          {canEditRecipeVersionDirectly(record) ? 'Düzenle' : 'Yeni Versiyon'}
                        </button>
                        <button
                          className="btn danger"
                          type="button"
                          onClick={event => {
                            event.stopPropagation()
                            deleteRecipe(record)
                          }}
                        >
                          Arşivle
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="product-side recipe-side">
          {panelMode === 'form' ? renderRecipeFormPanel() : renderSummaryPanel()}
        </aside>
      </div>
    </div>
  )
}
